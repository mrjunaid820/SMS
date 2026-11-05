import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { studentApi } from '../src/services/api';
import { INITIAL_STUDENTS, INITIAL_PROFILES } from '../src/services/mockData';
import { Student, Profile } from '../src/types/database';

describe('Manage Student Credentials & Identity Suite (Teacher Credentials Equivalent)', () => {
  let targetStudent: Student;
  let studentProfile: Profile;
  const adminActor = { id: 'u0000000-0000-0000-0000-000000000001', name: 'Principal Admin', role: 'admin' };
  const teacherActor = { id: 'u0000000-0000-0000-0000-000000000002', name: 'Muhammad Tariq', role: 'teacher' };
  const studentActor = { id: 'student-actor-id', name: 'Student Actor', role: 'student' };

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('sms_students', JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem('sms_profiles', JSON.stringify(INITIAL_PROFILES));

    // Provision test student account
    const rawStudent = INITIAL_STUDENTS[0];
    const { profile } = await studentApi.provisionStudentAccount(
      rawStudent.id,
      'hamza.credentials@islamiapublic.edu.pk',
      'StudentInitial123!',
      adminActor
    );

    studentProfile = profile;
    const students: Student[] = JSON.parse(localStorage.getItem('sms_students') || '[]');
    targetStudent = students.find((s) => s.id === rawStudent.id)!;
  });

  // --------------------------------------------------------------------------
  // 1. MIGRATION 024 STRUCTURE & RPC SECURITY VERIFICATION
  // --------------------------------------------------------------------------
  describe('1. Migration 024 Structure & PostgreSQL RPC Security', () => {
    it('verifies migration 024 exists and defines atomic student email update function with grants', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/024_student_credential_management.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // Function definition
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.admin_update_student_login_email');
      expect(sqlContent).toContain('p_student_id UUID');
      expect(sqlContent).toContain('p_new_email TEXT');
      expect(sqlContent).toContain('RETURNS JSONB');
      expect(sqlContent).toContain('SECURITY DEFINER');

      // Authorization verification
      expect(sqlContent).toContain('IF NOT public.is_admin() THEN');
      expect(sqlContent).toContain('Only school administrators are authorized to update student credentials');

      // Duplicate email check
      expect(sqlContent).toContain('FROM public.profiles');
      expect(sqlContent).toContain('lower(email) = v_clean_email');

      // Auth & Profile synchronization
      expect(sqlContent).toContain('UPDATE auth.users');
      expect(sqlContent).toContain('UPDATE public.profiles');
      expect(sqlContent).toContain('UPDATE public.students');

      // Audit log
      expect(sqlContent).toContain('STUDENT_LOGIN_EMAIL_UPDATED');

      // Explicit grants
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.admin_update_student_login_email(UUID, TEXT) TO authenticated, anon;');
    });
  });

  // --------------------------------------------------------------------------
  // 2. EDGE FUNCTION VERIFICATION
  // --------------------------------------------------------------------------
  describe('2. Supabase Edge Function Structure & Logic', () => {
    it('verifies admin-manage-user handles update_login_email with studentId resolution', () => {
      const functionPath = path.resolve(
        process.cwd(),
        'supabase/functions/admin-manage-user/index.ts'
      );
      expect(fs.existsSync(functionPath)).toBe(true);

      const fnContent = fs.readFileSync(functionPath, 'utf8');

      expect(fnContent).toContain("action === 'update_login_email'");
      expect(fnContent).toContain('if (!targetUserId && studentId)');
      expect(fnContent).toContain("from('students')");
      expect(fnContent).toContain("adminSupabase.auth.admin.updateUserById");
      expect(fnContent).toContain("email_confirm: true");
    });
  });

  // --------------------------------------------------------------------------
  // 3. SECTION 1 — UPDATE STUDENT LOGIN EMAIL / IDENTITY
  // --------------------------------------------------------------------------
  describe('3. Section 1 — Update Student Login Email / Identity', () => {
    it('allows Admin to update student login email and synchronizes profiles and credentials', async () => {
      const newEmail = 'hamza.updated@islamiapublic.edu.pk';

      const res = await studentApi.updateStudentLoginEmail(
        targetStudent.id,
        newEmail,
        adminActor
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain(newEmail);

      // Verify updated student in storage
      const students: Student[] = JSON.parse(localStorage.getItem('sms_students') || '[]');
      const updatedStudent = students.find((s) => s.id === targetStudent.id)!;
      expect(updatedStudent.email).toBe(newEmail);

      // Verify updated profile in storage
      const profiles: Profile[] = JSON.parse(localStorage.getItem('sms_profiles') || '[]');
      const updatedProfile = profiles.find((p) => p.id === studentProfile.id)!;
      expect(updatedProfile.email).toBe(newEmail);

      // Verify student ID, admission number, and guardian details remain untouched
      expect(updatedStudent.id).toBe(targetStudent.id);
      expect(updatedStudent.admission_no).toBe(targetStudent.admission_no);
      expect(updatedStudent.guardian_name).toBe(targetStudent.guardian_name);
      expect(updatedStudent.guardian_phone).toBe(targetStudent.guardian_phone);
    });

    it('rejects email update attempts from unauthorized Teachers or Students', async () => {
      await expect(
        studentApi.updateStudentLoginEmail(
          targetStudent.id,
          'hacker@school.edu.pk',
          teacherActor
        )
      ).rejects.toThrow(/Only administrators are authorized/i);

      await expect(
        studentApi.updateStudentLoginEmail(
          targetStudent.id,
          'hacker@school.edu.pk',
          studentActor
        )
      ).rejects.toThrow(/Only administrators are authorized/i);
    });

    it('rejects invalid email formats', async () => {
      await expect(
        studentApi.updateStudentLoginEmail(
          targetStudent.id,
          'invalid-email-format',
          adminActor
        )
      ).rejects.toThrow(/valid email address is required/i);
    });

    it('rejects duplicate email if already registered to another user account', async () => {
      // Use existing teacher email from mock profiles
      const existingTeacherEmail = INITIAL_PROFILES[1].email;

      await expect(
        studentApi.updateStudentLoginEmail(
          targetStudent.id,
          existingTeacherEmail,
          adminActor
        )
      ).rejects.toThrow(/already registered to another user account/i);
    });
  });

  // --------------------------------------------------------------------------
  // 4. SECTION 2 — ADMINISTRATOR-CONTROLLED PASSWORD RESET
  // --------------------------------------------------------------------------
  describe('4. Section 2 — Administrator-Controlled Password Reset', () => {
    it('Option A: sets temporary password, updates auth store, and verifies new password authentication', async () => {
      const newTemporaryPass = 'Stu-X9yZ8q!';

      const res = await studentApi.resetStudentPassword(
        targetStudent.id,
        { temporaryPassword: newTemporaryPass },
        adminActor
      );

      expect(res.success).toBe(true);

      // Authentication verification function matching AuthContext logic
      const simulateAuth = (email: string, passAttempt: string) => {
        const profiles: Profile[] = JSON.parse(localStorage.getItem('sms_profiles') || '[]');
        const matched = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
        if (!matched) throw new Error('User account not found.');

        const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
        const requiredPass = passMap[matched.id] || passMap[matched.email.toLowerCase()];
        if (requiredPass && passAttempt !== requiredPass) {
          throw new Error('Invalid password: The password entered does not match.');
        }
        return matched;
      };

      // New temporary password succeeds
      const user = simulateAuth(studentProfile.email, newTemporaryPass);
      expect(user.id).toBe(studentProfile.id);

      // Old password fails
      expect(() => {
        simulateAuth(studentProfile.email, 'StudentInitial123!');
      }).toThrow('Invalid password: The password entered does not match.');
    });

    it('Option B: dispatches password recovery link without breaking state', async () => {
      const res = await studentApi.resetStudentPassword(
        targetStudent.id,
        { sendResetLink: true },
        adminActor
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('reset link dispatched');
    });

    it('rejects temporary passwords shorter than 6 characters', async () => {
      await expect(
        studentApi.resetStudentPassword(
          targetStudent.id,
          { temporaryPassword: 'short' },
          adminActor
        )
      ).rejects.toThrow(/at least 6 characters/i);
    });
  });

  // --------------------------------------------------------------------------
  // 5. SECTION 3 — STUDENT PORTAL ACCESS STATUS (ACTIVATE / DEACTIVATE)
  // --------------------------------------------------------------------------
  describe('5. Section 3 — Student Portal Access Status (Activate / Deactivate)', () => {
    it('deactivates student portal access and blocks login', async () => {
      // Toggle to deactivate
      const toggleRes = await studentApi.toggleStudentAccountStatus(targetStudent.id, adminActor);
      expect(toggleRes.is_active).toBe(false);

      // Verify profile is inactive in storage
      const profiles: Profile[] = JSON.parse(localStorage.getItem('sms_profiles') || '[]');
      const prof = profiles.find((p) => p.id === studentProfile.id)!;
      expect(prof.is_active).toBe(false);

      // Simulate AuthContext login check
      const simulateAuth = (email: string) => {
        const pList: Profile[] = JSON.parse(localStorage.getItem('sms_profiles') || '[]');
        const matched = pList.find((p) => p.email.toLowerCase() === email.toLowerCase());
        if (!matched) throw new Error('User profile not found.');
        if (!matched.is_active) {
          throw new Error('Your account has been deactivated. Please contact the school administrator.');
        }
        return matched;
      };

      expect(() => {
        simulateAuth(studentProfile.email);
      }).toThrow('Your account has been deactivated. Please contact the school administrator.');
    });

    it('reactivates student portal access and restores login without creating duplicate account', async () => {
      // 1. Deactivate
      await studentApi.toggleStudentAccountStatus(targetStudent.id, adminActor);

      // 2. Reactivate
      const reactivateRes = await studentApi.toggleStudentAccountStatus(targetStudent.id, adminActor);
      expect(reactivateRes.is_active).toBe(true);

      const profiles: Profile[] = JSON.parse(localStorage.getItem('sms_profiles') || '[]');
      const matchingProfiles = profiles.filter((p) => p.id === studentProfile.id);
      expect(matchingProfiles.length).toBe(1); // No duplicates
      expect(matchingProfiles[0].is_active).toBe(true);

      // Verify student record and admission data remain intact
      const students: Student[] = JSON.parse(localStorage.getItem('sms_students') || '[]');
      const targetAfter = students.find((s) => s.id === targetStudent.id)!;
      expect(targetAfter.admission_no).toBe(targetStudent.admission_no);
      expect(targetAfter.full_name).toBe(targetStudent.full_name);
    });
  });
});
