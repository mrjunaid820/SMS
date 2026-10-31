import { describe, it, expect, beforeEach } from 'vitest';
import { studentApi, teacherApi } from '@/services/api';
import { INITIAL_STUDENTS, INITIAL_PROFILES, INITIAL_TEACHERS, INITIAL_ENROLLMENTS } from '@/services/mockData';
import fs from 'fs';
import path from 'path';

describe('Portal Lifecycle (Activation, Deactivation, Reactivation) & Safe Student Deletion', () => {
  const adminActor = { id: 'admin-001', name: 'System Admin', role: 'admin' };
  const teacherActor = { id: 'teacher-001', name: 'Faculty Member', role: 'teacher' };

  beforeEach(() => {
    // Reset local storage to clean mock state before each test
    localStorage.clear();
    localStorage.setItem('sms_students', JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem('sms_profiles', JSON.stringify(INITIAL_PROFILES));
    localStorage.setItem('sms_teachers', JSON.stringify(INITIAL_TEACHERS));
    localStorage.setItem('sms_enrollments', JSON.stringify(INITIAL_ENROLLMENTS));
    localStorage.setItem('sms_attendance', JSON.stringify([]));
    localStorage.setItem('sms_fee_invoices', JSON.stringify([]));
    localStorage.setItem('sms_fee_payments', JSON.stringify([]));
    localStorage.setItem('sms_marks', JSON.stringify([]));
  });

  describe('Part 1: Student Portal Lifecycle (Single & Bulk)', () => {
    it('correctly maps portal_status on getStudents', async () => {
      const students = await studentApi.getStudents(true);
      expect(students.length).toBeGreaterThan(0);
      students.forEach((s) => {
        expect(['not_provisioned', 'active', 'inactive']).toContain(s.portal_status);
      });
    });

    it('provisions, deactivates, and reactivates an individual student portal', async () => {
      // 1. Create a fresh student without a profile
      const { student } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Zainab Fatima',
          gender: 'Female',
          date_of_birth: '2012-04-15',
          guardian_name: 'Tariq Mehmood',
          guardian_relation: 'Father',
          guardian_phone: '03001234567',
          admission_date: '2025-04-01',
          address: 'Islamabad, Pakistan',
        },
        'sess-2025-26',
        'sec-9a',
        adminActor
      );

      expect(student.profile_id).toBeFalsy();

      // 2. Provision / Activate portal account
      const provisionRes = await studentApi.provisionStudentAccount(
        student.id,
        'zainab.fatima@islamiapublic.edu.pk',
        'Zainab123!',
        adminActor
      );

      expect(provisionRes.profile.is_active).toBe(true);

      let fetchedStudents = await studentApi.getStudents(true);
      let s = fetchedStudents.find((item) => item.id === student.id);
      expect(s?.portal_status).toBe('active');
      expect(s?.is_active).toBe(true); // School enrollment active

      // 3. Deactivate portal access
      const deactRes = await studentApi.setPortalActive(student.id, false, adminActor);
      expect(deactRes.success).toBe(true);
      expect(deactRes.portal_status).toBe('inactive');

      fetchedStudents = await studentApi.getStudents(true);
      s = fetchedStudents.find((item) => item.id === student.id);
      expect(s?.portal_status).toBe('inactive');
      // Crucial: School enrollment remains Active even when Portal is Inactive!
      expect(s?.is_active).toBe(true);

      // 4. Reactivate portal access
      const reactRes = await studentApi.setPortalActive(student.id, true, adminActor);
      expect(reactRes.success).toBe(true);
      expect(reactRes.portal_status).toBe('active');

      fetchedStudents = await studentApi.getStudents(true);
      s = fetchedStudents.find((item) => item.id === student.id);
      expect(s?.portal_status).toBe('active');
    });

    it('rejects portal modification when caller is not an administrator', async () => {
      const students = await studentApi.getStudents(true);
      const student = students[0];

      await expect(
        studentApi.setPortalActive(student.id, false, teacherActor)
      ).rejects.toThrow(/Unauthorized/);
    });

    it('performs bulk student portal activation and bulk deactivation', async () => {
      // Create 2 test students
      const { student: s1 } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Student Alpha',
          gender: 'Male',
          date_of_birth: '2011-01-01',
          guardian_name: 'Father A',
          guardian_relation: 'Father',
          guardian_phone: '03001111111',
          admission_date: '2025-04-01',
          address: 'Lahore',
        },
        'sess-2025-26',
        'sec-9a',
        adminActor
      );

      const { student: s2 } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Student Beta',
          gender: 'Female',
          date_of_birth: '2011-02-02',
          guardian_name: 'Father B',
          guardian_relation: 'Father',
          guardian_phone: '03002222222',
          admission_date: '2025-04-01',
          address: 'Rawalpindi',
        },
        'sess-2025-26',
        'sec-9a',
        adminActor
      );

      // Bulk provision
      const bulkProv = await studentApi.bulkProvisionStudentAccounts(
        [s1.id, s2.id],
        'DefaultPass123!',
        adminActor
      );
      expect(bulkProv.success).toBe(true);
      expect(bulkProv.success_count).toBe(2);

      // Verify both are active
      let students = await studentApi.getStudents(true);
      expect(students.find((s) => s.id === s1.id)?.portal_status).toBe('active');
      expect(students.find((s) => s.id === s2.id)?.portal_status).toBe('active');

      // Bulk deactivate
      const bulkDeact = await studentApi.bulkSetPortalActive([s1.id, s2.id], false, adminActor);
      expect(bulkDeact.success).toBe(true);
      expect(bulkDeact.success_count).toBe(2);

      students = await studentApi.getStudents(true);
      expect(students.find((s) => s.id === s1.id)?.portal_status).toBe('inactive');
      expect(students.find((s) => s.id === s2.id)?.portal_status).toBe('inactive');

      // Bulk reactivate
      const bulkReact = await studentApi.bulkSetPortalActive([s1.id, s2.id], true, adminActor);
      expect(bulkReact.success).toBe(true);
      expect(bulkReact.success_count).toBe(2);

      students = await studentApi.getStudents(true);
      expect(students.find((s) => s.id === s1.id)?.portal_status).toBe('active');
      expect(students.find((s) => s.id === s2.id)?.portal_status).toBe('active');
    });
  });

  describe('Part 2: Teacher Portal Lifecycle (Single & Bulk)', () => {
    it('correctly maps portal_status on getTeachers', async () => {
      const teachers = await teacherApi.getTeachers();
      expect(teachers.length).toBeGreaterThan(0);
      teachers.forEach((t) => {
        expect(['not_provisioned', 'active', 'inactive']).toContain(t.portal_status);
      });
    });

    it('activates, deactivates, and reactivates teacher portal while preserving assignments', async () => {
      // 1. Create teacher
      const newTeacher = await teacherApi.createTeacher(
        {
          employee_id: 'EMP-TCH-999',
          full_name: 'Professor Arshad',
          email: 'prof.arshad@islamiapublic.edu.pk',
          phone: '03009999999',
          qualification: 'M.Phil Mathematics',
          joining_date: '2025-01-01',
          designation: 'Senior Mathematics Instructor',
          is_active: true,
        },
        adminActor
      );

      // 2. Assign subject
      const asgn = await teacherApi.createAssignment(
        {
          teacher_id: newTeacher.id,
          academic_session_id: 'sess-2025-26',
          section_id: 'sec-9a',
          subject_id: 'sub-math-9',
          is_class_teacher: true,
        },
        adminActor
      );

      // 3. Provision portal account
      const provRes = await teacherApi.provisionTeacherAccount(
        newTeacher.id,
        newTeacher.email,
        'TeacherPass123!',
        adminActor
      );
      expect(provRes.success).toBe(true);

      let teacherList = await teacherApi.getTeachers();
      let t = teacherList.find((item) => item.id === newTeacher.id);
      expect(t?.portal_status).toBe('active');

      // 4. Deactivate teacher portal
      const deact = await teacherApi.setPortalActive(newTeacher.id, false, adminActor);
      expect(deact.success).toBe(true);
      expect(deact.portal_status).toBe('inactive');

      teacherList = await teacherApi.getTeachers();
      t = teacherList.find((item) => item.id === newTeacher.id);
      expect(t?.portal_status).toBe('inactive');
      expect(t?.is_active).toBe(false);

      // Verify teaching assignments remain intact!
      const assignments = await teacherApi.getAssignments('sess-2025-26');
      const teacherAsgns = assignments.filter((a) => a.teacher_id === newTeacher.id);
      expect(teacherAsgns.length).toBe(1);
      expect(teacherAsgns[0].id).toBe(asgn.id);

      // 5. Reactivate teacher portal
      const react = await teacherApi.setPortalActive(newTeacher.id, true, adminActor);
      expect(react.success).toBe(true);
      expect(react.portal_status).toBe('active');

      teacherList = await teacherApi.getTeachers();
      t = teacherList.find((item) => item.id === newTeacher.id);
      expect(t?.portal_status).toBe('active');
      expect(t?.is_active).toBe(true);
    });

    it('performs bulk teacher portal activation, deactivation, and reactivation', async () => {
      const t1 = await teacherApi.createTeacher(
        {
          employee_id: 'EMP-B1',
          full_name: 'Teacher One',
          email: 't1@islamiapublic.edu.pk',
          phone: '03001112222',
          qualification: 'M.Sc Physics',
          joining_date: '2025-01-01',
          designation: 'Physics Teacher',
          is_active: true,
        },
        adminActor
      );

      const t2 = await teacherApi.createTeacher(
        {
          employee_id: 'EMP-B2',
          full_name: 'Teacher Two',
          email: 't2@islamiapublic.edu.pk',
          phone: '03003334444',
          qualification: 'M.A English',
          joining_date: '2025-01-01',
          designation: 'English Teacher',
          is_active: true,
        },
        adminActor
      );

      // Bulk provision
      const bulkProv = await teacherApi.bulkProvisionTeacherAccounts([t1.id, t2.id], 'Teach123!', adminActor);
      expect(bulkProv.success).toBe(true);
      expect(bulkProv.successCount).toBe(2);

      // Bulk deactivate
      const bulkDeact = await teacherApi.bulkSetPortalActive([t1.id, t2.id], false, adminActor);
      expect(bulkDeact.success).toBe(true);
      expect(bulkDeact.successCount).toBe(2);

      let list = await teacherApi.getTeachers();
      expect(list.find((t) => t.id === t1.id)?.portal_status).toBe('inactive');
      expect(list.find((t) => t.id === t2.id)?.portal_status).toBe('inactive');

      // Bulk reactivate
      const bulkReact = await teacherApi.bulkSetPortalActive([t1.id, t2.id], true, adminActor);
      expect(bulkReact.success).toBe(true);
      expect(bulkReact.successCount).toBe(2);

      list = await teacherApi.getTeachers();
      expect(list.find((t) => t.id === t1.id)?.portal_status).toBe('active');
      expect(list.find((t) => t.id === t2.id)?.portal_status).toBe('active');
    });
  });

  describe('Part 3: Safe Student Deletion, Removal & Dependency Protection', () => {
    it('allows safe permanent deletion of a clean student with no academic or financial history', async () => {
      // Create a clean student (only draft enrollment, 0 attendance, 0 fee invoices, 0 marks)
      const { student } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Temporary Clean Student',
          gender: 'Male',
          date_of_birth: '2012-05-20',
          guardian_name: 'Clean Guardian',
          guardian_relation: 'Father',
          guardian_phone: '03005555555',
          admission_date: '2025-04-01',
          address: 'Islamabad',
        },
        'sess-2025-26',
        'sec-9a',
        adminActor
      );

      // 1. Dependency pre-check
      const eligibility = await studentApi.checkDeletionEligibility(student.id, adminActor);
      expect(eligibility.has_dependencies).toBe(false);
      expect(eligibility.eligible_for_permanent_deletion).toBe(true);
      expect(eligibility.recommendation).toBe('permanent_deletion');
      expect(eligibility.dependencies.attendance_records).toBe(0);
      expect(eligibility.dependencies.fee_invoices).toBe(0);
      expect(eligibility.dependencies.fee_payments).toBe(0);
      expect(eligibility.dependencies.exam_marks).toBe(0);

      // 2. Safe deletion execution
      const delRes = await studentApi.safeDeleteStudent(student.id, adminActor);
      expect(delRes.success).toBe(true);
      expect(delRes.message).toContain('permanently deleted');

      // 3. Verify student record is gone
      const allStudents = await studentApi.getStudents(true);
      expect(allStudents.find((s) => s.id === student.id)).toBeUndefined();
    });

    it('blocks permanent deletion and safely deactivates student when attendance records exist', async () => {
      // 1. Create student
      const { student, enrollment } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Student With Attendance',
          gender: 'Female',
          date_of_birth: '2012-03-14',
          guardian_name: 'Attendance Guardian',
          guardian_relation: 'Mother',
          guardian_phone: '03006666666',
          admission_date: '2025-04-01',
          address: 'Lahore',
        },
        'sess-2025-26',
        'sec-9a',
        adminActor
      );

      // 2. Add attendance records
      const attendances = [
        {
          id: 'att-101',
          enrollment_id: enrollment.id,
          date: '2026-10-20',
          status: 'Present',
        },
        {
          id: 'att-102',
          enrollment_id: enrollment.id,
          date: '2026-10-21',
          status: 'Late',
        },
      ];
      localStorage.setItem('sms_attendance', JSON.stringify(attendances));

      // 3. Pre-check
      const eligibility = await studentApi.checkDeletionEligibility(student.id, adminActor);
      expect(eligibility.has_dependencies).toBe(true);
      expect(eligibility.eligible_for_permanent_deletion).toBe(false);
      expect(eligibility.dependencies.attendance_records).toBe(2);

      // 4. Hard deletion is strictly blocked
      await expect(
        studentApi.safeDeleteStudent(student.id, adminActor)
      ).rejects.toThrow(/Permanent Deletion Blocked/);

      // 5. Safe deactivation & removal from active roster
      const removalRes = await studentApi.safelyDeactivateAndRemoveStudent(
        student.id,
        'Transferred to Lahore Model School',
        adminActor
      );
      expect(removalRes.success).toBe(true);
      expect(removalRes.student.is_active).toBe(false);
      expect(removalRes.student.archive_reason).toContain('Transferred');

      // 6. Verify historical records preserved intact
      const savedAttendance = JSON.parse(localStorage.getItem('sms_attendance') || '[]');
      expect(savedAttendance.length).toBe(2);
      expect(savedAttendance[0].enrollment_id).toBe(enrollment.id);

      // Student is excluded from active student list
      const activeStudents = await studentApi.getStudents(false);
      expect(activeStudents.find((s) => s.id === student.id)).toBeUndefined();
    });

    it('blocks permanent deletion and safely deactivates student when fee invoices and payments exist', async () => {
      // 1. Create student
      const { student, enrollment } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Student With Invoices & Payments',
          gender: 'Male',
          date_of_birth: '2011-08-10',
          guardian_name: 'Finance Guardian',
          guardian_relation: 'Father',
          guardian_phone: '03007777777',
          admission_date: '2025-04-01',
          address: 'Peshawar',
        },
        'sess-2025-26',
        'sec-9a',
        adminActor
      );

      // 2. Add an invoice and payment dependency
      const invoices = [
        {
          id: 'inv-test-999',
          enrollment_id: enrollment.id,
          month: 'October 2026',
          net_amount: 5000,
          status: 'paid',
        },
      ];
      const payments = [
        {
          id: 'pay-test-999',
          invoice_id: 'inv-test-999',
          receipt_no: 'REC-999',
          amount: 5000,
          payment_date: '2026-10-15',
        },
      ];
      localStorage.setItem('sms_fee_invoices', JSON.stringify(invoices));
      localStorage.setItem('sms_fee_payments', JSON.stringify(payments));

      // 3. Check deletion eligibility
      const eligibility = await studentApi.checkDeletionEligibility(student.id, adminActor);
      expect(eligibility.has_dependencies).toBe(true);
      expect(eligibility.eligible_for_permanent_deletion).toBe(false);
      expect(eligibility.dependencies.fee_invoices).toBe(1);
      expect(eligibility.dependencies.fee_payments).toBe(1);

      // 4. Attempting permanent deletion must throw
      await expect(
        studentApi.safeDeleteStudent(student.id, adminActor)
      ).rejects.toThrow(/Permanent Deletion Blocked/);

      // 5. Safe deactivation & removal
      const res = await studentApi.safelyDeactivateAndRemoveStudent(
        student.id,
        'Withdrawn with settled accounts',
        adminActor
      );
      expect(res.success).toBe(true);
      expect(res.student.is_active).toBe(false);

      // 6. Verify financial ledger is untouched
      const storedInvoices = JSON.parse(localStorage.getItem('sms_fee_invoices') || '[]');
      const storedPayments = JSON.parse(localStorage.getItem('sms_fee_payments') || '[]');
      expect(storedInvoices.length).toBe(1);
      expect(storedPayments.length).toBe(1);
      expect(storedPayments[0].receipt_no).toBe('REC-999');
    });

    it('blocks permanent deletion and safely deactivates student when exam marks exist', async () => {
      // 1. Create student
      const { student, enrollment } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Student With Exam Marks',
          gender: 'Female',
          date_of_birth: '2012-01-25',
          guardian_name: 'Academic Guardian',
          guardian_relation: 'Father',
          guardian_phone: '03008888888',
          admission_date: '2025-04-01',
          address: 'Rawalpindi',
        },
        'sess-2025-26',
        'sec-9a',
        adminActor
      );

      // 2. Add exam marks
      const marks = [
        {
          id: 'mark-001',
          enrollment_id: enrollment.id,
          exam_subject_id: 'es-math-midterm',
          marks_obtained: 88,
          total_marks: 100,
        },
      ];
      localStorage.setItem('sms_marks', JSON.stringify(marks));

      // 3. Pre-check
      const eligibility = await studentApi.checkDeletionEligibility(student.id, adminActor);
      expect(eligibility.has_dependencies).toBe(true);
      expect(eligibility.dependencies.exam_marks).toBe(1);

      // 4. Hard deletion blocked
      await expect(
        studentApi.safeDeleteStudent(student.id, adminActor)
      ).rejects.toThrow(/Permanent Deletion Blocked/);

      // 5. Safe deactivation
      const removal = await studentApi.safelyDeactivateAndRemoveStudent(
        student.id,
        'Completed term and relocated',
        adminActor
      );
      expect(removal.success).toBe(true);
      expect(removal.student.is_active).toBe(false);

      // 6. Exam marks remain intact in the academic record
      const storedMarks = JSON.parse(localStorage.getItem('sms_marks') || '[]');
      expect(storedMarks.length).toBe(1);
      expect(storedMarks[0].marks_obtained).toBe(88);
    });

    it('strictly forbids unauthorized users from deleting or deactivating students', async () => {
      const all = await studentApi.getStudents(true);
      const student = all[0];

      // Teacher actor trying to check eligibility
      await expect(
        studentApi.checkDeletionEligibility(student.id, teacherActor)
      ).rejects.toThrow(/Unauthorized/);

      // Teacher actor trying permanent deletion
      await expect(
        studentApi.safeDeleteStudent(student.id, teacherActor)
      ).rejects.toThrow(/Unauthorized/);

      // Teacher actor trying safe deactivation
      await expect(
        studentApi.safelyDeactivateAndRemoveStudent(student.id, 'Hacked reason', teacherActor)
      ).rejects.toThrow(/Unauthorized/);

      // Verify student remains active and untouched
      const after = await studentApi.getStudents(true);
      expect(after.find((s) => s.id === student.id)?.is_active).toBe(student.is_active);
    });
  });

  describe('Part 4: Database Migrations 014 & 016 Verification', () => {
    it('verifies SQL files exist and contain all required RPC functions and RLS policies', () => {
      const migration14Path = path.resolve(
        process.cwd(),
        'supabase/migrations/014_portal_lifecycle_and_safe_student_deletion.sql'
      );
      expect(fs.existsSync(migration14Path)).toBe(true);

      const content14 = fs.readFileSync(migration14Path, 'utf-8');
      expect(content14).toContain('admin_set_student_portal_active');
      expect(content14).toContain('admin_bulk_set_student_portal_active');
      expect(content14).toContain('admin_set_teacher_portal_active');
      expect(content14).toContain('admin_bulk_set_teacher_portal_active');
      expect(content14).toContain('admin_check_student_deletion_eligibility');
      expect(content14).toContain('admin_safe_delete_student');
      expect(content14).toContain('SECURITY DEFINER');

      const migration16Path = path.resolve(
        process.cwd(),
        'supabase/migrations/016_fix_student_deletion_and_safe_removal.sql'
      );
      expect(fs.existsSync(migration16Path)).toBe(true);

      const content16 = fs.readFileSync(migration16Path, 'utf-8');
      expect(content16).toContain('admin_safe_deactivate_student');
      expect(content16).toContain('admin_safe_delete_student');
      expect(content16).toContain('admin_check_student_deletion_eligibility');
      expect(content16).toContain('SECURITY DEFINER');
      expect(content16).toContain('GRANT EXECUTE ON FUNCTION public.admin_safe_deactivate_student');
    });
  });
});
