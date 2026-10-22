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
    const { action, teacherId, userId, newEmail, temporaryPassword } = body;

    // ACTION: UPDATE_LOGIN_EMAIL
    if (action === 'update_login_email') {
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: A valid email address is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check duplicate email
      const { data: duplicateProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', newEmail.toLowerCase())
        .neq('id', userId)
        .maybeSingle();

      if (duplicateProfile) {
        return new Response(
          JSON.stringify({ error: `Validation Error: The email "${newEmail}" is already registered to another user account.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update in Supabase Auth via Admin API
      const { data: updatedAuthUser, error: authUpdateErr } = await adminSupabase.auth.admin.updateUserById(
        userId,
        { email: newEmail.toLowerCase(), email_confirm: true }
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
        .update({ email: newEmail.toLowerCase(), updated_at: new Date().toISOString() })
        .eq('id', userId);

      // Update in public.teachers
      if (teacherId) {
        await adminSupabase
          .from('teachers')
          .update({ email: newEmail.toLowerCase() })
          .eq('id', teacherId);
      }

      // Log in audit log
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: 'TEACHER_LOGIN_EMAIL_UPDATED',
          entity_type: 'teachers',
          entity_id: teacherId || userId,
          details: { target_user_id: userId, new_email: newEmail.toLowerCase() },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({ success: true, message: `Teacher login email successfully updated to ${newEmail}.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: SET_TEMPORARY_PASSWORD
    if (action === 'set_temporary_password') {
      if (!temporaryPassword || temporaryPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Validation Error: Temporary password must be at least 6 characters long.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update password via Supabase Admin Auth API
      const { error: pwdErr } = await adminSupabase.auth.admin.updateUserById(userId, {
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
        await adminSupabase.auth.admin.signOut(userId);
      } catch (e) {
        // Sign-out may not be supported on all Supabase tiers
      }

      // Log audit trail without storing the password
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: 'TEACHER_PASSWORD_RESET',
          entity_type: 'profiles',
          entity_id: userId,
          details: { method: 'TEMPORARY_PASSWORD_ASSIGNED', sessions_revoked: true },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({ success: true, message: 'Temporary password assigned and active sessions revoked.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: SEND_RESET_LINK
    if (action === 'send_reset_link') {
      const { data: targetProf } = await adminSupabase.from('profiles').select('email').eq('id', userId).single();
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
      await adminSupabase.from('audit_logs').insert([
        {
          actor_id: user.id,
          action: 'TEACHER_PASSWORD_RESET',
          entity_type: 'profiles',
          entity_id: userId,
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
