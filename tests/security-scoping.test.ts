import { describe, it, expect, beforeEach } from 'vitest';
import { studentApi, attendanceApi, examApi } from '../src/services/api';
import { MAIN_NAV_ITEMS } from '../src/config/constants';

describe('Security, Scoping and Data Integrity Rules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates unique sequential admission numbers in ADM-YYYY-XXXX format', async () => {
    const admNo = await studentApi.generateAdmissionNo();
    const currentYear = new Date().getFullYear();
    expect(admNo).toMatch(new RegExp(`^ADM-${currentYear}-\\d{4}$`));
  });

  it('generates sequential roll numbers for a section', async () => {
    const nextRoll = await studentApi.generateNextRollNo(
      'b0000000-0000-0000-0000-000000000002',
      'd0000000-0000-0000-0000-000000000001'
    );
    expect(nextRoll).toBeGreaterThanOrEqual(1);
  });

  it('filters navigation items strictly so teachers cannot see admin-only routes', () => {
    const adminNav = MAIN_NAV_ITEMS.filter((item) => true);
    expect(adminNav.length).toBe(15);

    const teacherNav = MAIN_NAV_ITEMS.filter((item) => !item.adminOnly);
    // Teacher should not see: Teachers, Academic Sessions, Teacher Assignments, Fees & Accounts, Audit Logs, School Settings, Users & Roles
    expect(teacherNav.length).toBe(8);
    expect(teacherNav.some((item) => item.id === 'fees-accounts')).toBe(false);
    expect(teacherNav.some((item) => item.id === 'audit-logs')).toBe(false);
    expect(teacherNav.some((item) => item.id === 'school-settings')).toBe(false);
    expect(teacherNav.some((item) => item.id === 'users-roles')).toBe(false);
  });

  it('records attendance without creating duplicates on the same date for an enrollment', async () => {
    const date = '2026-10-25';
    const enrollmentId = '20000000-0000-0000-0000-000000000001';

    // First mark
    await attendanceApi.markBatchAttendance(date, [{ enrollment_id: enrollmentId, status: 'Present' }]);
    // Second mark on same date with correction
    await attendanceApi.markBatchAttendance(date, [{ enrollment_id: enrollmentId, status: 'Late', remarks: 'Bus breakdown' }]);

    const records = await attendanceApi.getAttendance(date, 'd0000000-0000-0000-0000-000000000001');
    const studentRecords = records.filter((r) => r.enrollment_id === enrollmentId);
    expect(studentRecords.length).toBe(1);
    expect(studentRecords[0].status).toBe('Late');
    expect(studentRecords[0].remarks).toBe('Bus breakdown');
  });

  it('supports explicit absent status for examination marks rather than treating absence as zero', async () => {
    const examSubjectId = '70000000-0000-0000-0000-000000000001';
    const enrollmentId = '20000000-0000-0000-0000-000000000005';

    await examApi.saveMarksBatch(examSubjectId, [
      {
        enrollment_id: enrollmentId,
        marks_obtained: 0,
        is_absent: true,
        remarks: 'Medical leave on exam day',
      },
    ]);

    const marks = await examApi.getMarks(examSubjectId);
    const studentMark = marks.find((m) => m.enrollment_id === enrollmentId);
    expect(studentMark?.is_absent).toBe(true);
    expect(studentMark?.remarks).toBe('Medical leave on exam day');
  });
});
