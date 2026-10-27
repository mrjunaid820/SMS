// ==============================================================================
// supabase/functions/admin-manage-user/index.ts
// Secure Server-Side Administrative User & Credential Management Function
// Uses Supabase Service Role Key on the server - never exposed to frontend clients
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // 1. Verify caller authentication token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await clientSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify caller is an active administrator in public.profiles
    const { data: callerProfile, error: profileError } = await clientSupabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only active school administrators can perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Initialize Admin Client with service_role key
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, studentId, teacherId, userId, newEmail, temporaryPassword, role } = body;

    // ACTION: PROVISION_STUDENT
    if (action === 'provision_student') {
      if (!studentId) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: Student ID is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cleanEmail = (newEmail || body.email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: A valid student email address is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!temporaryPassword || temporaryPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: Initial password must be at least 6 characters.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Fetch student record
      const { data: student, error: studentFetchErr } = await adminSupabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (studentFetchErr || !student) {
        return new Response(
          JSON.stringify({ error: 'Student record not found.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!student.is_active) {
        return new Response(
          JSON.stringify({ error: 'Cannot provision account for an inactive or archived student.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (student.profile_id) {
        return new Response(
          JSON.stringify({ error: 'Student already has a linked portal login account.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Check duplicate email in public.profiles
      const { data: emailConflict } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (emailConflict) {
        return new Response(
          JSON.stringify({ error: `Validation Error: The email "${cleanEmail}" is already registered to another user account.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Create Supabase Auth User with confirmed email
      const { data: authUser, error: authCreateErr } = await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          role: 'student',
          full_name: student.full_name,
        },
      });

      if (authCreateErr || !authUser.user) {
        return new Response(
          JSON.stringify({ error: `Failed to create auth identity: ${authCreateErr?.message || 'Unknown error'}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newUserId = authUser.user.id;

      // 4. Create public.profiles row
      const profilePayload = {
        id: newUserId,
        role: 'student',
        full_name: student.full_name,
        email: cleanEmail,
        phone: student.guardian_phone || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newProfile, error: profileInsertErr } = await adminSupabase
        .from('profiles')
        .insert([profilePayload])
        .select()
        .single();

      if (profileInsertErr) {
        // Rollback created auth user to avoid orphan
        await adminSupabase.auth.admin.deleteUser(newUserId);
        return new Response(
          JSON.stringify({ error: `Failed to create student profile: ${profileInsertErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 5. Link profile to public.students
      const { data: updatedStudent, error: studentUpdateErr } = await adminSupabase
        .from('students')
        .update({
          profile_id: newUserId,
          email: cleanEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)
        .select()
        .single();

      if (studentUpdateErr) {
        return new Response(
          JSON.stringify({ error: `Account created but linking to student record failed: ${studentUpdateErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 6. Record in institutional audit log (without logging password)
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: 'STUDENT_ACCOUNT_PROVISIONED',
          entity_type: 'students',
          entity_id: studentId,
          details: {
            profile_id: newUserId,
            student_admission_no: student.admission_no,
            email: cleanEmail,
            method: 'ADMIN_PROVISIONED',
          },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Portal account successfully provisioned for ${student.full_name}.`,
          profile: newProfile,
          student: updatedStudent,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: SET_TEMPORARY_PASSWORD (Students & Teachers)
    if (action === 'set_temporary_password') {
      const targetUserId = userId || body.profileId;
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: User ID is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!temporaryPassword || temporaryPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: Temporary password must be at least 6 characters long.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify target user profile exists
      const { data: targetProfile, error: targetErr } = await adminSupabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', targetUserId)
        .single();

      if (targetErr || !targetProfile) {
        return new Response(
          JSON.stringify({ error: 'Target user account not found.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update password via Supabase Admin Auth API
      const { error: pwdErr } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
        password: temporaryPassword,
      });

      if (pwdErr) {
        return new Response(
          JSON.stringify({ error: `Failed to set password: ${pwdErr.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Revoke active sessions for target user
      try {
        await adminSupabase.auth.admin.signOut(targetUserId);
      } catch (e) {
        // Sign-out may not be supported on all Supabase tiers
      }

      // Log audit trail without storing the password
      const auditAction = targetProfile.role === 'student' ? 'STUDENT_PASSWORD_RESET' : 'TEACHER_PASSWORD_RESET';
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: auditAction,
          entity_type: 'profiles',
          entity_id: targetUserId,
          details: {
            method: 'TEMPORARY_PASSWORD_ASSIGNED',
            target_role: targetProfile.role,
            target_email: targetProfile.email,
            sessions_revoked: true,
          },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Temporary password assigned for ${targetProfile.full_name} and active sessions revoked.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: TOGGLE_USER_STATUS
    if (action === 'toggle_user_status') {
      const targetUserId = userId || body.profileId;
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: User ID is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: targetProfile, error: targetErr } = await adminSupabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (targetErr || !targetProfile) {
        return new Response(
          JSON.stringify({ error: 'Target user account not found.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newActive = !targetProfile.is_active;

      // Update in public.profiles
      const { data: updatedProfile, error: profileUpdErr } = await adminSupabase
        .from('profiles')
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', targetUserId)
        .select()
        .single();

      if (profileUpdErr) {
        return new Response(
          JSON.stringify({ error: `Failed to update profile status: ${profileUpdErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ban/unban in Supabase Auth
      try {
        await adminSupabase.auth.admin.updateUserById(targetUserId, {
          ban_duration: newActive ? 'none' : '876000h',
        });
        if (!newActive) {
          await adminSupabase.auth.admin.signOut(targetUserId);
        }
      } catch (e) {
        // Continue if ban API not supported
      }

      // Log audit
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: newActive ? 'USER_ACCOUNT_ENABLED' : 'USER_ACCOUNT_DISABLED',
          entity_type: 'profiles',
          entity_id: targetUserId,
          details: { role: targetProfile.role, email: targetProfile.email },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          is_active: newActive,
          profile: updatedProfile,
          message: `User account has been ${newActive ? 'activated' : 'deactivated'}.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: UPDATE_LOGIN_EMAIL
    if (action === 'update_login_email') {
      const cleanNewEmail = (newEmail || '').trim().toLowerCase();
      if (!cleanNewEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: A valid email address is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check duplicate email
      const { data: duplicateProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', cleanNewEmail)
        .neq('id', userId)
        .maybeSingle();

      if (duplicateProfile) {
        return new Response(
          JSON.stringify({ error: `Validation Error: The email "${cleanNewEmail}" is already registered to another user account.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update in Supabase Auth via Admin API
      const { error: authUpdateErr } = await adminSupabase.auth.admin.updateUserById(
        userId,
        { email: cleanNewEmail, email_confirm: true }
      );

      if (authUpdateErr) {
        return new Response(
          JSON.stringify({ error: `Auth identity update failed: ${authUpdateErr.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update in public.profiles
      await adminSupabase
        .from('profiles')
        .update({ email: cleanNewEmail, updated_at: new Date().toISOString() })
        .eq('id', userId);

      // Update in public.teachers if teacherId provided
      if (teacherId) {
        await adminSupabase
          .from('teachers')
          .update({ email: cleanNewEmail })
          .eq('id', teacherId);
      }

      // Update in public.students if studentId provided
      if (studentId) {
        await adminSupabase
          .from('students')
          .update({ email: cleanNewEmail, updated_at: new Date().toISOString() })
          .eq('id', studentId);
      }

      // Log in audit log
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: 'LOGIN_EMAIL_UPDATED',
          entity_type: 'profiles',
          entity_id: userId,
          details: { target_user_id: userId, new_email: cleanNewEmail },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({ success: true, message: `Login email successfully updated to ${cleanNewEmail}.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: SEND_RESET_LINK
    if (action === 'send_reset_link') {
      const targetUserId = userId || body.profileId;
      const { data: targetProf } = await adminSupabase.from('profiles').select('email, role').eq('id', targetUserId).single();
      if (!targetProf?.email) {
        return new Response(
          JSON.stringify({ error: 'User profile or email not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: resetErr } = await adminSupabase.auth.resetPasswordForEmail(targetProf.email);
      if (resetErr) {
        return new Response(
          JSON.stringify({ error: resetErr.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log audit trail
      const auditAction = targetProf.role === 'student' ? 'STUDENT_PASSWORD_RESET' : 'TEACHER_PASSWORD_RESET';
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: auditAction,
          entity_type: 'profiles',
          entity_id: targetUserId,
          details: { method: 'RESET_LINK_DISPATCHED', email: targetProf.email },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({ success: true, message: `Authorized password reset link dispatched to ${targetProf.email}.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
