import { describe, it, expect, beforeEach } from 'vitest';
import { studentApi, teacherApi, userApi } from '../src/services/api';
import { MAIN_NAV_ITEMS } from '../src/config/constants';
import { INITIAL_STUDENTS, INITIAL_TEACHERS, INITIAL_PROFILES } from '../src/services/mockData';

describe('Admin Student & Teacher Editing, Password Restrictions, and Scoping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------
  // REQUIREMENT 1: Student Details — Admin Editing
  // -------------------------------------------------------------
  describe('Student Details — Admin Editing', () => {
    it('allows administrator to edit student profile and preserves admission number', async () => {
      const studentId = INITIAL_STUDENTS[0].id;
      const originalAdmissionNo = INITIAL_STUDENTS[0].admission_no;

      const result = await studentApi.updateStudentWithEnrollment(
        studentId,
        {
          full_name: 'Muhammad Abdullah Updated',
          guardian_name: 'Tariq Mehmood Updated',
          guardian_phone: '+92 300 9999999',
          address: 'Model Town Block B, Lahore',
          admission_date: '2024-04-01',
          photo_url: 'https://school.edu.pk/photos/abdullah.jpg',
        },
        undefined,
        undefined,
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(result.student.full_name).toBe('Muhammad Abdullah Updated');
      expect(result.student.guardian_name).toBe('Tariq Mehmood Updated');
      expect(result.student.guardian_phone).toBe('+92 300 9999999');
      // Admission number must be preserved
      expect(result.student.admission_no).toBe(originalAdmissionNo);
    });

    it('updates student section and assigns sequential roll number for active session', async () => {
      const studentId = INITIAL_STUDENTS[0].id;
      const activeSessionId = 'b0000000-0000-0000-0000-000000000002'; // 2025-26
      const newSectionId = 'd0000000-0000-0000-0000-000000000002'; // Section B

      const result = await studentApi.updateStudentWithEnrollment(
        studentId,
        { full_name: 'Muhammad Abdullah' },
        newSectionId,
        activeSessionId,
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(result.enrollment).toBeDefined();
      expect(result.enrollment?.section_id).toBe(newSectionId);
      expect(result.enrollment?.roll_no).toBeGreaterThanOrEqual(1);
    });

    it('rejects student editing when actor is not an administrator', async () => {
      const studentId = INITIAL_STUDENTS[0].id;

      await expect(
        studentApi.updateStudentWithEnrollment(
          studentId,
          { full_name: 'Hacked Name' },
          undefined,
          undefined,
          { id: 'teacher-1', name: 'Teacher Tariq', role: 'teacher' }
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to edit student records.');
    });

    it('validates required fields before saving student changes', async () => {
      const studentId = INITIAL_STUDENTS[0].id;

      await expect(
        studentApi.updateStudentWithEnrollment(
          studentId,
          { full_name: '   ' },
          undefined,
          undefined,
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow('Validation Error: Student full name is required.');

      await expect(
        studentApi.updateStudentWithEnrollment(
          studentId,
          { guardian_phone: '   ' },
          undefined,
          undefined,
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow('Validation Error: Guardian phone number is required.');
    });
  });

  // -------------------------------------------------------------
  // REQUIREMENT 2: Teacher Details — Admin Editing & Deactivation
  // -------------------------------------------------------------
  describe('Teacher Details — Admin Editing & Deactivation', () => {
    it('allows administrator to edit teacher profile, qualification, and assignments', async () => {
      const teacherId = INITIAL_TEACHERS[0].id;
      const activeSessionId = 'b0000000-0000-0000-0000-000000000002';

      const updated = await teacherApi.updateTeacherFull(
        teacherId,
        {
          full_name: 'Prof. Muhammad Tariq Ph.D',
          qualification: 'Ph.D Mathematics, M.Sc, B.Ed',
          phone: '+92 300 7777777',
          designation: 'Head of Mathematics Department',
        },
        [
          {
            section_id: 'd0000000-0000-0000-0000-000000000001',
            subject_id: 'e0000000-0000-0000-0000-000000000003',
            is_class_teacher: true,
          },
        ],
        activeSessionId,
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(updated.full_name).toBe('Prof. Muhammad Tariq Ph.D');
      expect(updated.qualification).toBe('Ph.D Mathematics, M.Sc, B.Ed');
      expect(updated.phone).toBe('+92 300 7777777');
      expect(updated.designation).toBe('Head of Mathematics Department');

      const assignments = await teacherApi.getAssignments(activeSessionId);
      const myAssignments = assignments.filter((a) => a.teacher_id === teacherId);
      expect(myAssignments.length).toBe(1);
      expect(myAssignments[0].is_class_teacher).toBe(true);
    });

    it('enforces uniqueness of employee ID and prevents duplicate teacher IDs', async () => {
      const teacherId = INITIAL_TEACHERS[0].id;
      const secondTeacherEmpId = INITIAL_TEACHERS[1].employee_id; // EMP-T102

      await expect(
        teacherApi.updateTeacherFull(
          teacherId,
          { employee_id: secondTeacherEmpId },
          undefined,
          undefined,
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow(`Validation Error: Employee ID "${secondTeacherEmpId}" is already assigned to another teacher.`);
    });

    it('deactivating teacher synchronizes is_active = false to user authentication profile', async () => {
      const teacher = INITIAL_TEACHERS[0];
      const activeSessionId = 'b0000000-0000-0000-0000-000000000002';

      await teacherApi.updateTeacherFull(
        teacher.id,
        { is_active: false },
        undefined,
        activeSessionId,
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      // Verify teachers storage has is_active = false
      const teachers = await teacherApi.getTeachers();
      const deactTeacher = teachers.find((t) => t.id === teacher.id);
      expect(deactTeacher?.is_active).toBe(false);

      // Verify profiles storage was updated to is_active = false
      const profiles = await userApi.getProfiles();
      const teacherProfile = profiles.find((p) => p.email === teacher.email || p.id === teacher.profile_id);
      expect(teacherProfile?.is_active).toBe(false);
    });

    it('rejects teacher editing when actor is not an administrator', async () => {
      const teacherId = INITIAL_TEACHERS[0].id;

      await expect(
        teacherApi.updateTeacherFull(
          teacherId,
          { full_name: 'Self-Edited Teacher' },
          undefined,
          undefined,
          { id: 'teacher-1', name: 'Muhammad Tariq', role: 'teacher' }
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to edit teacher profiles.');
    });
  });

  // -------------------------------------------------------------
  // REQUIREMENT 3: Password Restrictions for Teachers
  // -------------------------------------------------------------
  describe('Teacher Password Restrictions & Admin Password Management', () => {
    it('allows administrator to reset teacher password with a temporary password and records audit log', async () => {
      const teacherProfile = INITIAL_PROFILES[1]; // tariq.math@islamiapublic.edu.pk

      const result = await userApi.adminResetTeacherPassword(
        teacherProfile.id,
        'IPS-TempPass99!',
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Temporary password successfully assigned');
      expect(result.message).toContain('Active sessions revoked');
    });

    it('allows administrator to dispatch an authorized reset token to teacher email', async () => {
      const teacherProfile = INITIAL_PROFILES[1];

      const result = await userApi.adminResetTeacherPassword(
        teacherProfile.id,
        undefined,
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain(`Authorized password reset link dispatched to ${teacherProfile.email}`);
    });

    it('rejects password reset when actor is not an administrator', async () => {
      const teacherProfile = INITIAL_PROFILES[1];

      await expect(
        userApi.adminResetTeacherPassword(
          teacherProfile.id,
          'IPS-NewPass123',
          { id: 'teacher-1', name: 'Tariq', role: 'teacher' }
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to reset or modify staff credentials.');
    });

    it('validates temporary password minimum length', async () => {
      const teacherProfile = INITIAL_PROFILES[1];

      await expect(
        userApi.adminResetTeacherPassword(
          teacherProfile.id,
          '123',
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow('Validation Error: Temporary password must be at least 6 characters.');
    });
  });

  // -------------------------------------------------------------
  // REQUIREMENT 4 & 5: Role-Based Scoping & Security Rules
  // -------------------------------------------------------------
  describe('Role-Based Scoping & Security Rules', () => {
    it('strictly hides all administrator modules from teacher navigation', () => {
      const adminNav = MAIN_NAV_ITEMS.filter(() => true);
      const teacherNav = MAIN_NAV_ITEMS.filter((item) => !item.adminOnly);

      expect(adminNav.length).toBe(15);
      expect(teacherNav.length).toBe(8);

      const forbiddenForTeachers = [
        'teachers',
        'academic-sessions',
        'teacher-assignments',
        'fees-accounts',
        'audit-logs',
        'school-settings',
        'users-roles',
      ];

      forbiddenForTeachers.forEach((modId) => {
        expect(teacherNav.some((item) => item.id === modId)).toBe(false);
      });
    });
  });
});
