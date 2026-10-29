import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { teacherApi } from '../src/services/api';
import { INITIAL_TEACHERS, INITIAL_PROFILES } from '../src/services/mockData';
import { Teacher } from '../src/types/database';

describe('Teacher Portal Authentication, Provisioning & Password Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------
  // 1. MIGRATION 013 SPECIFICATION & SCHEMA INTEGRITY
  // -------------------------------------------------------------
  describe('1. Migration 013 Schema Integrity', () => {
    it('verifies migration 013 exists and defines secure teacher RPCs', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/013_teacher_portal_auth_and_password_management.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // Check self-healing teacher sync
      expect(sqlContent).toContain('SELF-HEALING & MIGRATION SYNC FOR ALL EXISTING TEACHERS');
      expect(sqlContent).toContain('Teacher123!');

      // Check admin_provision_teacher
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.admin_provision_teacher');
      expect(sqlContent).toContain('public.is_admin()');
      expect(sqlContent).toContain("role = 'teacher'");

      // Check admin_reset_teacher_password
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.admin_reset_teacher_password');
      expect(sqlContent).toContain('TEACHER_PORTAL_PASSWORD_RESET');

      // Check admin_bulk_provision_teachers
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.admin_bulk_provision_teachers');

      // Check admin_toggle_teacher_status
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.admin_toggle_teacher_status');

      // Check execute grants
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.admin_provision_teacher TO authenticated');
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.admin_reset_teacher_password TO authenticated');
    });
  });

  // -------------------------------------------------------------
  // 2. TEACHER PORTAL PROVISIONING (SINGLE)
  // -------------------------------------------------------------
  describe('2. Single Teacher Portal Account Provisioning', () => {
    it('allows an administrator to provision an unlinked teacher portal account', async () => {
      // Find a teacher without a linked profile
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      const res = await teacherApi.provisionTeacherAccount(
        targetTeacher.id,
        'tariq.math@islamiapublic.edu.pk',
        'Teacher123!',
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(res.success).toBe(true);
      expect(res.user_id).toBeDefined();

      // Verify teacher record is updated with profile_id
      const updatedTeachers = await teacherApi.getTeachers();
      const verified = updatedTeachers.find((t) => t.id === targetTeacher.id);
      expect(verified?.profile_id).toBe(res.user_id);
      expect(verified?.email).toBe('tariq.math@islamiapublic.edu.pk');
    });

    it('rejects provisioning attempts with an invalid email address', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      await expect(
        teacherApi.provisionTeacherAccount(
          targetTeacher.id,
          'invalid-email',
          'Teacher123!',
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow(/valid email address/i);
    });

    it('rejects provisioning attempts with a password shorter than 6 characters', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      await expect(
        teacherApi.provisionTeacherAccount(
          targetTeacher.id,
          'valid.email@islamiapublic.edu.pk',
          '123',
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow(/at least 6 characters/i);
    });

    it('blocks non-administrator actors from provisioning teacher portal accounts', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      await expect(
        teacherApi.provisionTeacherAccount(
          targetTeacher.id,
          'unauthorized@islamiapublic.edu.pk',
          'Teacher123!',
          { id: 'teacher-2', name: 'Other Teacher', role: 'teacher' }
        )
      ).rejects.toThrow(/Unauthorized: Only administrators/i);
    });
  });

  // -------------------------------------------------------------
  // 3. BULK TEACHER PROVISIONING
  // -------------------------------------------------------------
  describe('3. Bulk Teacher Portal Account Provisioning', () => {
    it('allows administrator to bulk provision unlinked teachers', async () => {
      const teachers = await teacherApi.getTeachers();
      const teacherIds = teachers.slice(0, 3).map((t) => t.id);

      const report = await teacherApi.bulkProvisionTeacherAccounts(
        teacherIds,
        'Teacher123!',
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(report.success).toBe(true);
      expect(report.total).toBe(3);
      expect(report.successCount).toBe(3);
      expect(report.failedCount).toBe(0);

      // Verify all 3 teachers are now linked
      const updatedTeachers = await teacherApi.getTeachers();
      for (const id of teacherIds) {
        const t = updatedTeachers.find((item) => item.id === id);
        expect(t?.profile_id).toBeDefined();
      }
    });

    it('blocks non-administrators from bulk provisioning teacher accounts', async () => {
      const teachers = await teacherApi.getTeachers();
      const teacherIds = teachers.map((t) => t.id);

      await expect(
        teacherApi.bulkProvisionTeacherAccounts(
          teacherIds,
          'Teacher123!',
          { id: 'student-1', name: 'Student', role: 'student' }
        )
      ).rejects.toThrow(/Unauthorized: Only administrators/i);
    });
  });

  // -------------------------------------------------------------
  // 4. ADMINISTRATOR-CONTROLLED PASSWORD RESET
  // -------------------------------------------------------------
  describe('4. Administrator-Controlled Teacher Password Reset', () => {
    it('allows an administrator to assign a new temporary password to a teacher', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      // Ensure provisioned first
      await teacherApi.provisionTeacherAccount(
        targetTeacher.id,
        'tariq.math@islamiapublic.edu.pk',
        'Teacher123!',
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      // Admin resets password
      const newPassword = 'NewSecretPassword2026!';
      const res = await teacherApi.resetTeacherPassword(
        targetTeacher.id,
        { temporaryPassword: newPassword },
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(res.success).toBe(true);
      expect(res.message).toMatch(/Temporary password successfully assigned/i);

      // Verify password stored in local credentials store
      const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
      expect(passMap['tariq.math@islamiapublic.edu.pk']).toBe(newPassword);
    });

    it('allows an administrator to dispatch a password reset link', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      const res = await teacherApi.resetTeacherPassword(
        targetTeacher.id,
        { sendResetLink: true },
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(res.success).toBe(true);
      expect(res.message).toMatch(/Authorized password reset link dispatched/i);
    });

    it('rejects passwords under 6 characters during reset', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      await expect(
        teacherApi.resetTeacherPassword(
          targetTeacher.id,
          { temporaryPassword: '123' },
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow(/at least 6 characters/i);
    });

    it('blocks a teacher from resetting another teacher password', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      await expect(
        teacherApi.resetTeacherPassword(
          targetTeacher.id,
          { temporaryPassword: 'HackedPassword123!' },
          { id: 'teacher-2', name: 'Ayesha Siddiqui', role: 'teacher' }
        )
      ).rejects.toThrow(/Unauthorized: Only administrators/i);
    });
  });

  // -------------------------------------------------------------
  // 5. TEACHER ROLE & PORTAL ROUTING INTEGRITY
  // -------------------------------------------------------------
  describe('5. Teacher Role & Portal Integrity', () => {
    it('ensures teacher profile has role="teacher" and preserves faculty status', async () => {
      const teachers = await teacherApi.getTeachers();
      const targetTeacher = teachers[0];

      const profile = await teacherApi.ensureTeacherProfile(targetTeacher.id, {
        id: 'admin-1',
        name: 'Principal',
        role: 'admin',
      });

      expect(profile.role).toBe('teacher');
      expect(profile.is_active).toBe(true);
      expect(profile.full_name).toBe(targetTeacher.full_name);
    });
  });
});
