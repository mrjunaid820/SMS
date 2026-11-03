import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { attendanceApi, studentApi, studentPortalApi } from '../src/services/api';
import { INITIAL_STUDENTS, INITIAL_ENROLLMENTS, INITIAL_ATTENDANCE } from '../src/services/mockData';
import { AttendanceRecord, Student, Enrollment } from '../src/types/database';

describe('Student Portal Attendance Database Synchronization & Scoping Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    // Initialize clean local test storage
    localStorage.setItem('sms_students', JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem('sms_enrollments', JSON.stringify(INITIAL_ENROLLMENTS));
    localStorage.setItem('sms_attendance', JSON.stringify(INITIAL_ATTENDANCE));
  });

  // -------------------------------------------------------------
  // 1. MIGRATION 021 STRUCTURE & RLS POLICIES VERIFICATION
  // -------------------------------------------------------------
  describe('1. Migration 021 Structure & RLS Verification', () => {
    it('verifies migration 021 exists and contains student attendance policies and indexes', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/021_student_attendance_access_and_synchronization.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // Check RLS policies
      expect(sqlContent).toContain('ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('CREATE POLICY "Students can view own attendance"');
      expect(sqlContent).toContain('ON public.attendance FOR SELECT');
      expect(sqlContent).toContain('public.get_current_student_id()');

      // Check Admin & Teacher policies
      expect(sqlContent).toContain('CREATE POLICY "Admin full access on attendance"');
      expect(sqlContent).toContain('CREATE POLICY "Teachers view attendance for assigned sections"');
      expect(sqlContent).toContain('CREATE POLICY "Teachers insert attendance for assigned sections"');
      expect(sqlContent).toContain('CREATE POLICY "Teachers update attendance for assigned sections"');

      // Check academic structure read permissions for students
      expect(sqlContent).toContain('CREATE POLICY "Authenticated users read classes"');
      expect(sqlContent).toContain('CREATE POLICY "Authenticated users read sections"');
      expect(sqlContent).toContain('CREATE POLICY "Authenticated users read academic_sessions"');

      // Check performance indexes
      expect(sqlContent).toContain('idx_attendance_enrollment_date');
      expect(sqlContent).toContain('idx_attendance_status');
    });
  });

  // -------------------------------------------------------------
  // 2. STUDENT IDENTIFICATION & MAPPING
  // -------------------------------------------------------------
  describe('2. Student Identification & Mapping', () => {
    it('maps authenticated student profile correctly to student record and active enrollment', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      // Provision student account
      const provisionResult = await studentApi.provisionStudentAccount(
        student.id,
        'hamza.sync@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      // Verify mapping using profile ID
      const selfByProfileId = await studentPortalApi.getStudentSelf(provisionResult.profile.id);
      expect(selfByProfileId.student.id).toBe(student.id);
      expect(selfByProfileId.student.full_name).toBe(student.full_name);
      expect(selfByProfileId.enrollment).toBeDefined();
      expect(selfByProfileId.enrollment?.student_id).toBe(student.id);

      // Verify mapping using email
      const selfByEmail = await studentPortalApi.getStudentSelf('hamza.sync@islamiapublic.edu.pk');
      expect(selfByEmail.student.id).toBe(student.id);

      // Verify mapping using admission number
      const selfByAdmNo = await studentPortalApi.getStudentSelf(student.admission_no);
      expect(selfByAdmNo.student.id).toBe(student.id);

      // Verify mapping using direct student ID
      const selfByStudentId = await studentPortalApi.getStudentSelf(student.id);
      expect(selfByStudentId.student.id).toBe(student.id);
    });

    it('rejects unlinked or non-existent profile identifiers with descriptive error', async () => {
      await expect(studentPortalApi.getStudentSelf('non-existent-profile-uuid-000')).rejects.toThrow(
        'No student record is linked to this user profile.'
      );
    });
  });

  // -------------------------------------------------------------
  // 3. SYNCHRONIZE ADMIN ATTENDANCE MARKING
  // -------------------------------------------------------------
  describe('3. Synchronize Admin Attendance Marking', () => {
    it('immediately reflects attendance records submitted by Admin in the Student Portal', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      const provisionResult = await studentApi.provisionStudentAccount(
        student.id,
        'hamza.admin.sync@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const enrollments = await studentApi.getEnrollments();
      const studentEnrollment = enrollments.find((e) => e.student_id === student.id)!;

      // Admin records attendance for 2026-11-04
      const testDate = '2026-11-04';
      await attendanceApi.markBatchAttendance(
        testDate,
        [
          {
            enrollment_id: studentEnrollment.id,
            status: 'Present',
            remarks: 'Admin recorded morning session',
          },
        ],
        { id: 'admin-1', name: 'Principal Malik' }
      );

      // Student views attendance immediately
      const myAttendance = await studentPortalApi.getMyAttendance(provisionResult.profile.id);

      const targetRecord = myAttendance.records.find((r) => r.date === testDate);
      expect(targetRecord).toBeDefined();
      expect(targetRecord?.status).toBe('Present');
      expect(targetRecord?.remarks).toBe('Admin recorded morning session');
      expect(targetRecord?.enrollment_id).toBe(studentEnrollment.id);
    });
  });

  // -------------------------------------------------------------
  // 4. SYNCHRONIZE TEACHER ATTENDANCE MARKING
  // -------------------------------------------------------------
  describe('4. Synchronize Teacher Attendance Marking', () => {
    it('immediately reflects attendance records submitted by Teachers in the Student Portal', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      const provisionResult = await studentApi.provisionStudentAccount(
        student.id,
        'hamza.teacher.sync@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const enrollments = await studentApi.getEnrollments();
      const studentEnrollment = enrollments.find((e) => e.student_id === student.id)!;

      // Teacher marks student as 'Late' with remarks
      const teacherTestDate = '2026-11-05';
      await attendanceApi.markBatchAttendance(
        teacherTestDate,
        [
          {
            enrollment_id: studentEnrollment.id,
            status: 'Late',
            remarks: 'Heavy traffic on GT Road, arrived 15 min late',
          },
        ],
        { id: 'teacher-1', name: 'Mr. Muhammad Tariq' }
      );

      // Student views attendance
      const myAttendance = await studentPortalApi.getMyAttendance(provisionResult.profile.id);

      const record = myAttendance.records.find((r) => r.date === teacherTestDate);
      expect(record).toBeDefined();
      expect(record?.status).toBe('Late');
      expect(record?.remarks).toBe('Heavy traffic on GT Road, arrived 15 min late');
    });

    it('correctly handles all four attendance statuses: Present, Absent, Late, Leave', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      const provisionResult = await studentApi.provisionStudentAccount(
        student.id,
        'hamza.statuses@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const enrollments = await studentApi.getEnrollments();
      const studentEnrollment = enrollments.find((e) => e.student_id === student.id)!;

      // Overwrite attendance with a controlled set of 4 statuses across distinct dates
      const controlledAttendance: AttendanceRecord[] = [
        {
          id: 'test-att-1',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-10',
          status: 'Present',
          remarks: 'Present in class',
          created_at: '2026-11-10T08:00:00Z',
          updated_at: '2026-11-10T08:00:00Z',
        },
        {
          id: 'test-att-2',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-11',
          status: 'Late',
          remarks: 'Late arrival',
          created_at: '2026-11-11T08:00:00Z',
          updated_at: '2026-11-11T08:00:00Z',
        },
        {
          id: 'test-att-3',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-12',
          status: 'Absent',
          remarks: 'Uninformed absence',
          created_at: '2026-11-12T08:00:00Z',
          updated_at: '2026-11-12T08:00:00Z',
        },
        {
          id: 'test-att-4',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-13',
          status: 'Leave',
          remarks: 'Sick leave approved',
          created_at: '2026-11-13T08:00:00Z',
          updated_at: '2026-11-13T08:00:00Z',
        },
      ];

      localStorage.setItem('sms_attendance', JSON.stringify(controlledAttendance));

      const res = await studentPortalApi.getMyAttendance(provisionResult.profile.id);

      expect(res.totalDays).toBe(4);
      expect(res.presentDays).toBe(1);
      expect(res.lateDays).toBe(1);
      expect(res.absentDays).toBe(1);
      expect(res.leaveDays).toBe(1);

      // Formula: (Present + Late) / Total * 100 = (1 + 1) / 4 * 100 = 50%
      expect(res.attendancePercentage).toBe(50);
    });
  });

  // -------------------------------------------------------------
  // 5. ATTENDANCE STATISTICS & FORMULA VERIFICATION
  // -------------------------------------------------------------
  describe('5. Attendance Statistics & Accurate Formula', () => {
    it('applies (Present + Late) / Total Recorded Sessions * 100 accurately without counting unrecorded days', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      const provisionResult = await studentApi.provisionStudentAccount(
        student.id,
        'hamza.formula@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const enrollments = await studentApi.getEnrollments();
      const studentEnrollment = enrollments.find((e) => e.student_id === student.id)!;

      // 8 Present, 2 Late, 1 Absent, 1 Leave = Total 12 sessions
      // Attendance Rate = (8 + 2) / 12 * 100 = 83.3%
      const records: AttendanceRecord[] = [
        ...Array.from({ length: 8 }).map((_, i) => ({
          id: `p-${i}`,
          enrollment_id: studentEnrollment.id,
          date: `2026-11-${String(i + 1).padStart(2, '0')}`,
          status: 'Present' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        {
          id: 'l-1',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-09',
          status: 'Late' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'l-2',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-10',
          status: 'Late' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'ab-1',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-11',
          status: 'Absent' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'lv-1',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-12',
          status: 'Leave' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      localStorage.setItem('sms_attendance', JSON.stringify(records));

      const data = await studentPortalApi.getMyAttendance(provisionResult.profile.id);

      expect(data.totalDays).toBe(12);
      expect(data.presentDays).toBe(8);
      expect(data.lateDays).toBe(2);
      expect(data.absentDays).toBe(1);
      expect(data.leaveDays).toBe(1);
      expect(data.attendancePercentage).toBe(83.3);
    });

    it('returns 0% and N/A safely when a student has 0 recorded attendance sessions', async () => {
      const students = await studentApi.getStudents();
      const student = students[1]; // Fatima Zahra

      const provisionResult = await studentApi.provisionStudentAccount(
        student.id,
        'fatima.zero@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      // Clear all attendance for this student
      localStorage.setItem('sms_attendance', JSON.stringify([]));

      const data = await studentPortalApi.getMyAttendance(provisionResult.profile.id);

      expect(data.totalDays).toBe(0);
      expect(data.presentDays).toBe(0);
      expect(data.absentDays).toBe(0);
      expect(data.lateDays).toBe(0);
      expect(data.leaveDays).toBe(0);
      expect(data.attendancePercentage).toBe(0);
      expect(data.records).toEqual([]);
      expect(data.monthlySummary).toEqual([]);
    });
  });

  // -------------------------------------------------------------
  // 6. MONTH FILTERING & CHRONOLOGICAL SORTING
  // -------------------------------------------------------------
  describe('6. Month Filtering & History Log', () => {
    it('supports month filtering and returns chronological order (newest first)', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      const provisionResult = await studentApi.provisionStudentAccount(
        student.id,
        'hamza.filter@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const enrollments = await studentApi.getEnrollments();
      const studentEnrollment = enrollments.find((e) => e.student_id === student.id)!;

      const multiMonthRecords: AttendanceRecord[] = [
        {
          id: 'rec-oct-1',
          enrollment_id: studentEnrollment.id,
          date: '2026-10-15',
          status: 'Present',
          remarks: 'October Day 1',
          created_at: '2026-10-15T08:00:00Z',
          updated_at: '2026-10-15T08:00:00Z',
        },
        {
          id: 'rec-oct-2',
          enrollment_id: studentEnrollment.id,
          date: '2026-10-25',
          status: 'Present',
          remarks: 'October Day 2',
          created_at: '2026-10-25T08:00:00Z',
          updated_at: '2026-10-25T08:00:00Z',
        },
        {
          id: 'rec-nov-1',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-01',
          status: 'Late',
          remarks: 'November Day 1',
          created_at: '2026-11-01T08:00:00Z',
          updated_at: '2026-11-01T08:00:00Z',
        },
        {
          id: 'rec-nov-2',
          enrollment_id: studentEnrollment.id,
          date: '2026-11-03',
          status: 'Present',
          remarks: 'November Day 2',
          created_at: '2026-11-03T08:00:00Z',
          updated_at: '2026-11-03T08:00:00Z',
        },
      ];

      localStorage.setItem('sms_attendance', JSON.stringify(multiMonthRecords));

      // 1. All Months query
      const allMonthsData = await studentPortalApi.getMyAttendance(provisionResult.profile.id, {
        month: 'all',
      });
      expect(allMonthsData.records.length).toBe(4);
      // Verify chronological sort: newest first
      expect(allMonthsData.records[0].date).toBe('2026-11-03');
      expect(allMonthsData.records[1].date).toBe('2026-11-01');
      expect(allMonthsData.records[2].date).toBe('2026-10-25');
      expect(allMonthsData.records[3].date).toBe('2026-10-15');

      // 2. Filter by 2026-10
      const octData = await studentPortalApi.getMyAttendance(provisionResult.profile.id, {
        month: '2026-10',
      });
      expect(octData.records.length).toBe(2);
      expect(octData.records.every((r) => r.date.startsWith('2026-10'))).toBe(true);
      expect(octData.totalDays).toBe(2);
      expect(octData.presentDays).toBe(2);

      // 3. Filter by 2026-11
      const novData = await studentPortalApi.getMyAttendance(provisionResult.profile.id, {
        month: '2026-11',
      });
      expect(novData.records.length).toBe(2);
      expect(novData.records.every((r) => r.date.startsWith('2026-11'))).toBe(true);
      expect(novData.lateDays).toBe(1);
      expect(novData.presentDays).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // 7. DATA ISOLATION & PRIVACY BETWEEN STUDENTS
  // -------------------------------------------------------------
  describe('7. Data Isolation & Privacy', () => {
    it('ensures student cannot view attendance records of other students', async () => {
      const students = await studentApi.getStudents();
      const studentA = students[0]; // Hamza
      const studentB = students[1]; // Fatima

      const provA = await studentApi.provisionStudentAccount(
        studentA.id,
        'studentA@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const provB = await studentApi.provisionStudentAccount(
        studentB.id,
        'studentB@islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const enrollments = await studentApi.getEnrollments();
      const enrA = enrollments.find((e) => e.student_id === studentA.id)!;
      const enrB = enrollments.find((e) => e.student_id === studentB.id)!;

      const records: AttendanceRecord[] = [
        {
          id: 'rec-A',
          enrollment_id: enrA.id,
          date: '2026-11-01',
          status: 'Present',
          remarks: 'Student A Record',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'rec-B',
          enrollment_id: enrB.id,
          date: '2026-11-01',
          status: 'Absent',
          remarks: 'Student B Private Record',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      localStorage.setItem('sms_attendance', JSON.stringify(records));

      // Student A queries their attendance
      const dataA = await studentPortalApi.getMyAttendance(provA.profile.id);
      expect(dataA.records.length).toBe(1);
      expect(dataA.records[0].enrollment_id).toBe(enrA.id);
      expect(dataA.records[0].remarks).toBe('Student A Record');
      expect(dataA.records.some((r) => r.enrollment_id === enrB.id)).toBe(false);

      // Student B queries their attendance
      const dataB = await studentPortalApi.getMyAttendance(provB.profile.id);
      expect(dataB.records.length).toBe(1);
      expect(dataB.records[0].enrollment_id).toBe(enrB.id);
      expect(dataB.records[0].remarks).toBe('Student B Private Record');
      expect(dataB.records.some((r) => r.enrollment_id === enrA.id)).toBe(false);
    });
  });
});
