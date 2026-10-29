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
  // REQUIREMENT 3: Teacher Login Information & Credentials Editing
  // -------------------------------------------------------------
  describe('Teacher Login Information & Credentials Editing', () => {
    it('allows administrator to update teacher login email and preserves auth UUID', async () => {
      const teacher = INITIAL_TEACHERS[0]; // Muhammad Tariq
      const originalProfileId = teacher.profile_id;
      const newLoginEmail = 'tariq.senior@islamiapublic.edu.pk';

      const result = await teacherApi.updateTeacherLoginEmail(
        teacher.id,
        newLoginEmail,
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain(newLoginEmail);

      // Verify teacher record email was updated and profile_id preserved
      const teachers = await teacherApi.getTeachers();
      const updatedTeacher = teachers.find((t) => t.id === teacher.id);
      expect(updatedTeacher?.email).toBe(newLoginEmail);
      expect(updatedTeacher?.profile_id).toBe(originalProfileId);

      // Verify linked profile email was updated
      const profiles = await userApi.getProfiles();
      const linkedProfile = profiles.find((p) => p.id === originalProfileId);
      expect(linkedProfile?.email).toBe(newLoginEmail);
    });

    it('blocks duplicate email addresses when updating teacher login email', async () => {
      const teacher = INITIAL_TEACHERS[0];
      const existingOtherEmail = INITIAL_TEACHERS[1].email!; // ayesha.eng@islamiapublic.edu.pk

      await expect(
        teacherApi.updateTeacherLoginEmail(
          teacher.id,
          existingOtherEmail,
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow(`Validation Error: The email address "${existingOtherEmail}" is already registered to another user account.`);
    });

    it('rejects invalid email formats', async () => {
      const teacher = INITIAL_TEACHERS[0];

      await expect(
        teacherApi.updateTeacherLoginEmail(
          teacher.id,
          'invalid-email-address',
          { id: 'admin-1', name: 'Principal', role: 'admin' }
        )
      ).rejects.toThrow('Validation Error: A valid email address is required.');
    });

    it('rejects login email updates when actor is not an administrator', async () => {
      const teacher = INITIAL_TEACHERS[0];

      await expect(
        teacherApi.updateTeacherLoginEmail(
          teacher.id,
          'hacked@school.edu.pk',
          { id: 'teacher-1', name: 'Tariq', role: 'teacher' }
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to update teacher login information.');
    });

    it('allows administrator to assign a temporary password and records audit log', async () => {
      const teacher = INITIAL_TEACHERS[0];

      const res = await teacherApi.resetTeacherPassword(
        teacher.id,
        { temporaryPassword: 'IPS-FacultyTemp2026!' },
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('Temporary password successfully assigned');
      expect(res.message).toContain('Active sessions revoked');

      // Verify credentials map has stored temporary password for newly configured credentials login
      const creds = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
      expect(creds[(teacher.email || '').toLowerCase()]).toBe('IPS-FacultyTemp2026!');
    });

    it('allows administrator to dispatch an authorized reset link to teacher email', async () => {
      const teacher = INITIAL_TEACHERS[0];

      const res = await teacherApi.resetTeacherPassword(
        teacher.id,
        { sendResetLink: true },
        { id: 'admin-1', name: 'Principal', role: 'admin' }
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain(`Authorized password reset link dispatched to ${teacher.email}`);
    });

    it('rejects teacher password reset when actor is not an administrator', async () => {
      const teacher = INITIAL_TEACHERS[0];

      await expect(
        teacherApi.resetTeacherPassword(
          teacher.id,
          { temporaryPassword: 'NewPassword123' },
          { id: 'teacher-1', name: 'Tariq', role: 'teacher' }
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to reset teacher passwords.');
    });

    it('ensures legacy teacher without profile_id is automatically provisioned and linked', async () => {
      // Find a teacher without profile_id (e.g. Dr. Imran Qureshi)
      const legacyTeacher = INITIAL_TEACHERS.find((t) => !t.profile_id) || INITIAL_TEACHERS[2];

      const profile = await teacherApi.ensureTeacherProfile(legacyTeacher.id, {
        id: 'admin-1',
        name: 'Principal',
        role: 'admin',
      });

      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.role).toBe('teacher');

      const teachers = await teacherApi.getTeachers();
      const updatedLegacyTeacher = teachers.find((t) => t.id === legacyTeacher.id);
      expect(updatedLegacyTeacher?.profile_id).toBe(profile.id);
    });
  });

  // -------------------------------------------------------------
  // REQUIREMENT 4 & 5: Role-Based Scoping & Security Rules
  // -------------------------------------------------------------
  describe('Role-Based Scoping & Security Rules', () => {
    it('strictly hides all administrator modules from teacher navigation', () => {
      const adminNav = MAIN_NAV_ITEMS.filter(() => true);
      const teacherNav = MAIN_NAV_ITEMS.filter((item) => !item.adminOnly);

      expect(adminNav.length).toBe(16);
      expect(teacherNav.length).toBe(9);

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
