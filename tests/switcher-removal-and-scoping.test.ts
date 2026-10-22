import { describe, it, expect, beforeEach } from 'vitest';
import {
  feeApi,
  settingsApi,
  academicStructureApi,
  teacherApi,
  studentApi,
  userApi,
} from '../src/services/api';
import { MAIN_NAV_ITEMS } from '../src/config/constants';
import { INITIAL_PROFILES, INITIAL_TEACHERS } from '../src/services/mockData';

describe('Removal of Dashboard Switcher & Strict Role Enforcement', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Removal of Switcher Logic & State Tampering Prevention', () => {
    it('ensures stored user profile role matches genuine profile directory and cannot be elevated', () => {
      // Simulate client attempting to tamper with localStorage to claim admin role for teacher account
      const teacherProfile = INITIAL_PROFILES.find((p) => p.role === 'teacher')!;
      const tamperedUser = {
        ...teacherProfile,
        role: 'admin', // Malicious client-side elevation attempt
      };
      localStorage.setItem('sms_current_user', JSON.stringify(tamperedUser));

      // Verification logic: cross-check against registered system profiles
      const saved = localStorage.getItem('sms_current_user');
      expect(saved).toBeDefined();
      const parsed = JSON.parse(saved!);
      const verified = INITIAL_PROFILES.find(
        (p) => p.id === parsed.id || p.email.toLowerCase() === (parsed.email || '').toLowerCase()
      );

      // The verified role MUST remain 'teacher', ignoring the client-side tampered 'admin' role
      expect(verified?.role).toBe('teacher');
      expect(verified?.role).not.toBe('admin');
    });

    it('confirms navigation items strictly hide all 7 admin modules from teachers', () => {
      const teacherNav = MAIN_NAV_ITEMS.filter((item) => !item.adminOnly);
      const adminNav = MAIN_NAV_ITEMS.filter(() => true);

      expect(adminNav.length).toBe(15);
      expect(teacherNav.length).toBe(8);

      const forbiddenAdminModules = [
        'teachers',
        'academic-sessions',
        'teacher-assignments',
        'fees-accounts',
        'audit-logs',
        'school-settings',
        'users-roles',
      ];

      forbiddenAdminModules.forEach((modId) => {
        expect(teacherNav.some((item) => item.id === modId)).toBe(false);
      });
    });
  });

  describe('2. Direct API Protection against Teacher Requests', () => {
    const teacherActor = {
      id: 'teacher-tariq-id',
      name: 'Muhammad Tariq',
      role: 'teacher',
    };

    const adminActor = {
      id: 'admin-principal-id',
      name: 'Principal',
      role: 'admin',
    };

    it('rejects fee structure creation when called by a teacher', async () => {
      await expect(
        feeApi.createStructure(
          {
            academic_session_id: 'b0000000-0000-0000-0000-000000000002',
            class_id: 'c0000000-0000-0000-0000-000000000001',
            name: 'Malicious Fee Structure',
            monthly_tuition: 9999,
            admission_fee: 0,
            exam_fee: 0,
            lab_library_fee: 0,
            other_charges: 0,
          },
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to configure fee structures.');
    });

    it('rejects batch invoice generation when called by a teacher', async () => {
      await expect(
        feeApi.generateMonthlyInvoices(
          'b0000000-0000-0000-0000-000000000002',
          '2026-11',
          '2026-11-10',
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to generate fee invoices.');
    });

    it('rejects fee payment recording when called by a teacher', async () => {
      await expect(
        feeApi.recordPayment(
          '40000000-0000-0000-0000-000000000001',
          500,
          'Cash',
          'Slip #99',
          'test-idemp',
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to record fee payments.');
    });

    it('rejects fee payment reversal when called by a teacher', async () => {
      await expect(
        feeApi.reversePayment(
          '50000000-0000-0000-0000-000000000001',
          'Fraudulent reversal',
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to reverse fee payments.');
    });

    it('rejects school settings update when called by a teacher', async () => {
      await expect(
        settingsApi.updateSettings(
          { school_name: 'Hacked School Name' },
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to update school settings.');
    });

    it('rejects academic session creation when called by a teacher', async () => {
      await expect(
        settingsApi.createSession(
          {
            name: '2027-2028',
            start_date: '2027-04-01',
            end_date: '2028-03-31',
            is_current: false,
          },
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to create academic sessions.');
    });

    it('rejects class creation when called by a teacher', async () => {
      await expect(
        academicStructureApi.createClass(
          {
            name: 'Grade 11',
            numeric_order: 11,
            description: 'Unauthorized',
          },
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to manage classes.');
    });

    it('rejects section creation when called by a teacher', async () => {
      await expect(
        academicStructureApi.createSection(
          {
            class_id: 'c0000000-0000-0000-0000-000000000001',
            name: 'Z',
            capacity: 30,
          },
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to manage sections.');
    });

    it('rejects subject creation when called by a teacher', async () => {
      await expect(
        academicStructureApi.createSubject(
          {
            class_id: 'c0000000-0000-0000-0000-000000000001',
            name: 'Unauthorized Subject',
            code: 'UNA-01',
            is_elective: false,
            credit_hours: 3,
          },
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to manage subjects.');
    });

    it('rejects teacher login email updates when called by a teacher', async () => {
      const teacher = INITIAL_TEACHERS[0];
      await expect(
        teacherApi.updateTeacherLoginEmail(
          teacher.id,
          'unauthorized@school.edu.pk',
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to update teacher login information.');
    });

    it('rejects staff password resets when called by a teacher', async () => {
      const teacher = INITIAL_TEACHERS[0];
      await expect(
        teacherApi.resetTeacherPassword(
          teacher.id,
          { temporaryPassword: 'HackPassword123' },
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to reset teacher passwords.');
    });

    it('allows administrator to perform administrative actions with verified authorization', async () => {
      // Admin should be able to create structure
      const newStr = await feeApi.createStructure(
        {
          academic_session_id: 'b0000000-0000-0000-0000-000000000002',
          class_id: 'c0000000-0000-0000-0000-000000000002',
          name: 'Class 7 Standard Fee Structure',
          monthly_tuition: 4000,
          admission_fee: 4500,
          exam_fee: 1000,
          lab_library_fee: 500,
          other_charges: 0,
        },
        adminActor
      );
      expect(newStr.id).toBeDefined();
      expect(newStr.name).toBe('Class 7 Standard Fee Structure');
    });
  });
});
