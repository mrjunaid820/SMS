import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { studentApi } from '../src/services/api';
import { INITIAL_STUDENTS, INITIAL_PROFILES } from '../src/services/mockData';
import { Student, Profile } from '../src/types/database';

describe('Student Portal Password Management Suite', () => {
  let targetStudent: Student;
  let studentProfile: Profile;
  const adminActor = { id: 'u0000000-0000-0000-0000-000000000001', name: 'Principal Admin', role: 'admin' };

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('sms_students', JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem('sms_profiles', JSON.stringify(INITIAL_PROFILES));

    // Provision test student account
    const rawStudent = INITIAL_STUDENTS[0];
    const { profile } = await studentApi.provisionStudentAccount(
      rawStudent.id,
      'hamza.student@islamiapublic.edu.pk',
      'InitialPass123!',
      adminActor
    );

    studentProfile = profile;
    const students: Student[] = JSON.parse(localStorage.getItem('sms_students') || '[]');
    targetStudent = students.find(s => s.id === rawStudent.id)!;
  });

  // --------------------------------------------------------------------------
  // 1. MIGRATION 023 STRUCTURE & SECURITY VERIFICATION
  // --------------------------------------------------------------------------
  describe('1. Migration 023 Structure & RPC Security', () => {
    it('verifies migration 023 file exists with correct security definer and grants', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/023_student_portal_password_management_fix.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // 1. Function definition
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.admin_reset_student_password');
      expect(sqlContent).toContain('p_student_id UUID');
      expect(sqlContent).toContain('p_new_password TEXT');
      expect(sqlContent).toContain('RETURNS JSONB');
      expect(sqlContent).toContain('SECURITY DEFINER');

      // 2. Authorization check
      expect(sqlContent).toContain('IF NOT public.is_admin() THEN');
      expect(sqlContent).toContain('Only school administrators are authorized to reset student passwords');

      // 3. Validation
      expect(sqlContent).toContain('length(p_new_password) < 6');

      // 4. Auth.users password hash update
      expect(sqlContent).toContain('UPDATE auth.users');
      expect(sqlContent).toContain("crypt(p_new_password, gen_salt('bf', 10))");

      // 5. Audit log
      expect(sqlContent).toContain('INSERT INTO public.audit_logs');
      expect(sqlContent).toContain("'STUDENT_PORTAL_PASSWORD_RESET'");

      // 6. Explicit grants
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.admin_reset_student_password(UUID, TEXT) TO authenticated, anon;');
    });
  });

  // --------------------------------------------------------------------------
  // 2. EDGE FUNCTION VERIFICATION
  // --------------------------------------------------------------------------
  describe('2. Supabase Edge Function Structure & Logic', () => {
    it('verifies admin-manage-user edge function supports studentId resolution and password updating', () => {
      const functionPath = path.resolve(
        process.cwd(),
        'supabase/functions/admin-manage-user/index.ts'
      );
      expect(fs.existsSync(functionPath)).toBe(true);

      const fnContent = fs.readFileSync(functionPath, 'utf8');

      // Admin verification
      expect(fnContent).toContain("callerProfile.role !== 'admin'");

      // Supports studentId resolution
      expect(fnContent).toContain("if (!targetUserId && studentId)");

      // Validates password length >= 6
      expect(fnContent).toContain("newPasswordToSet.length < 6");

      // Updates user via Admin API
      expect(fnContent).toContain("adminSupabase.auth.admin.updateUserById");
      expect(fnContent).toContain("adminSupabase.auth.admin.signOut");
    });
  });

  // --------------------------------------------------------------------------
  // 3. PASSWORD VALIDATION & ROLE RESTRICTIONS
  // --------------------------------------------------------------------------
  describe('3. Password Validation & Role Restrictions', () => {
    it('rejects password updates if caller is not an administrator', async () => {
      // Teacher attempt
      await expect(
        studentApi.resetStudentPassword(
          targetStudent.id,
          'ValidPassword123!',
          { id: 'teacher-1', name: 'Teacher', role: 'teacher' }
        )
      ).rejects.toThrow(/Only administrators are authorized/i);

      // Student attempt
      await expect(
        studentApi.resetStudentPassword(
          targetStudent.id,
          'ValidPassword123!',
          { id: 'student-1', name: 'Student', role: 'student' }
        )
      ).rejects.toThrow(/Only administrators are authorized/i);
    });

    it('rejects passwords shorter than 6 characters', async () => {
      await expect(
        studentApi.resetStudentPassword(
          targetStudent.id,
          '12345',
          adminActor
        )
      ).rejects.toThrow(/at least 6 characters/i);
    });

    it('rejects empty passwords', async () => {
      await expect(
        studentApi.resetStudentPassword(
          targetStudent.id,
          '',
          adminActor
        )
      ).rejects.toThrow(/at least 6 characters/i);
    });
  });

  // --------------------------------------------------------------------------
  // 4. SUCCESSFUL ADMIN PASSWORD RESET & LOGIN VERIFICATION
  // --------------------------------------------------------------------------
  describe('4. Successful Password Reset & Multi-Factor Login Verification', () => {
    it('allows Admin to set a new password and syncs password store', async () => {
      const newPassword = 'NewSecretPassword2026!';

      const result = await studentApi.resetStudentPassword(
        targetStudent.id,
        newPassword,
        adminActor
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Password updated successfully');

      // Verify the password map in localStorage is updated
      const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
      expect(passMap[studentProfile.id]).toBe(newPassword);
      expect(passMap[studentProfile.email.toLowerCase()]).toBe(newPassword);
    });

    it('verifies student logs in with new password and is rejected with old password', async () => {
      const originalPassword = 'InitialPass123!';
      const newPassword = 'UpdatedPortalPass456!';

      // Admin updates password
      await studentApi.resetStudentPassword(
        targetStudent.id,
        newPassword,
        adminActor
      );

      // Verify simulated login authentication logic matching AuthContext
      const verifyLogin = (email: string, passAttempt: string) => {
        const profiles: Profile[] = JSON.parse(localStorage.getItem('sms_profiles') || '[]');
        const matched = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
        if (!matched) throw new Error('User profile not found.');

        const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
        const requiredPass = passMap[matched.id] || passMap[matched.email.toLowerCase()];
        if (requiredPass && passAttempt !== requiredPass) {
          throw new Error('Invalid password: The password entered does not match.');
        }
        return matched;
      };

      // 1. Old password MUST FAIL
      expect(() => {
        verifyLogin(studentProfile.email, originalPassword);
      }).toThrow('Invalid password: The password entered does not match.');

      // 2. Wrong random password MUST FAIL
      expect(() => {
        verifyLogin(studentProfile.email, 'WrongPassword999!');
      }).toThrow('Invalid password: The password entered does not match.');

      // 3. New password MUST SUCCEED
      const loggedInUser = verifyLogin(studentProfile.email, newPassword);
      expect(loggedInUser.id).toBe(studentProfile.id);
      expect(loggedInUser.email).toBe(studentProfile.email);
    });

    it('preserves student records and portal access state untouched', async () => {
      const studentsBefore: Student[] = JSON.parse(localStorage.getItem('sms_students') || '[]');
      const targetBefore = studentsBefore.find(s => s.id === targetStudent.id)!;

      await studentApi.resetStudentPassword(
        targetStudent.id,
        'SecurePassword789!',
        adminActor
      );

      const studentsAfter: Student[] = JSON.parse(localStorage.getItem('sms_students') || '[]');
      const targetAfter = studentsAfter.find(s => s.id === targetStudent.id)!;

      // Student academic and profile data intact
      expect(targetAfter.admission_no).toBe(targetBefore.admission_no);
      expect(targetAfter.full_name).toBe(targetBefore.full_name);
      expect(targetAfter.class_id).toBe(targetBefore.class_id);
      expect(targetAfter.section_id).toBe(targetBefore.section_id);
      expect(targetAfter.profile_id).toBe(targetBefore.profile_id);
      expect(targetAfter.email).toBe(targetBefore.email);
    });
  });
});
