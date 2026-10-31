import { describe, it, expect, beforeEach } from 'vitest';
import { dashboardApi, attendanceApi, studentApi } from '../src/services/api';
import { MAIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../src/config/constants';
import { INITIAL_INVOICES, INITIAL_PAYMENTS, INITIAL_ATTENDANCE, INITIAL_STUDENTS } from '../src/services/mockData';

describe('Admin Dashboard UI/UX Redesign & Scoping Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sms_invoices', JSON.stringify(INITIAL_INVOICES));
    localStorage.setItem('sms_payments', JSON.stringify(INITIAL_PAYMENTS));
    localStorage.setItem('sms_attendance', JSON.stringify(INITIAL_ATTENDANCE));
    localStorage.setItem('sms_students', JSON.stringify(INITIAL_STUDENTS));
  });

  it('1. verifies all 16 MAIN_NAV_ITEMS remain intact for routing and testing compatibility', () => {
    expect(MAIN_NAV_ITEMS.length).toBe(16);
    const nonAdminItems = MAIN_NAV_ITEMS.filter((i) => !i.adminOnly);
    expect(nonAdminItems.length).toBe(9);
    expect(STUDENT_NAV_ITEMS.length).toBe(8);
  });

  it('2. retrieves live dashboard statistics from real database records', async () => {
    const stats = await dashboardApi.getLiveStatistics();

    expect(stats).toBeDefined();
    expect(stats.totalActiveStudents).toBeGreaterThan(0);
    expect(stats.activeTeachers).toBeGreaterThan(0);
    expect(stats.financial).toBeDefined();
    expect(stats.financial.totalInvoiced).toBeGreaterThan(0);
    expect(stats.financial.totalCollected).toBeGreaterThan(0);
    expect(stats.financial.totalOutstanding).toBe(
      stats.financial.totalInvoiced - stats.financial.totalCollected
    );
  });

  it('3. calculates attendance summary by period without zero-division errors', async () => {
    const monthSummary = await attendanceApi.getAttendanceSummaryByPeriod('this_month');
    expect(monthSummary).toBeDefined();
    expect(monthSummary.total).toBeGreaterThan(0);
    expect(monthSummary.presentPercentage).toBeGreaterThanOrEqual(0);
    expect(monthSummary.presentPercentage).toBeLessThanOrEqual(100);

    const weekSummary = await attendanceApi.getAttendanceSummaryByPeriod('this_week');
    expect(weekSummary).toBeDefined();
    expect(weekSummary.presentPercentage).toBeGreaterThanOrEqual(0);

    const todaySummary = await attendanceApi.getAttendanceSummaryByPeriod('today');
    expect(todaySummary).toBeDefined();
    expect(todaySummary.presentPercentage).toBeGreaterThanOrEqual(0);
  });

  it('4. ensures financial dues strictly reconcile payments and approved adjustments', async () => {
    const stats = await dashboardApi.getLiveStatistics();
    // Outstanding dues must equal Invoiced - Collected
    expect(stats.financial.totalOutstanding).toBe(
      stats.financial.totalInvoiced - stats.financial.totalCollected
    );
  });

  it('5. retrieves upcoming events and announcements for admin oversight', async () => {
    const stats = await dashboardApi.getLiveStatistics();
    expect(Array.isArray(stats.recentAnnouncements)).toBe(true);
    expect(Array.isArray(stats.upcomingEvents)).toBe(true);
    expect(Array.isArray(stats.recentActivity)).toBe(true);
  });

  it('6. updates Active Students count dynamically when students are added, archived, or restored', async () => {
    const adminActor = { id: 'admin-1', name: 'Admin', role: 'admin' };
    const initialStats = await dashboardApi.getLiveStatistics();
    const initialActiveCount = initialStats.totalActiveStudents;

    // 1. Archive student #1
    const studentToArchive = INITIAL_STUDENTS[0];
    await studentApi.archiveStudent(studentToArchive.id, 'Graduated from high school', adminActor);

    const afterArchiveStats = await dashboardApi.getLiveStatistics();
    expect(afterArchiveStats.totalActiveStudents).toBe(initialActiveCount - 1);

    // 2. Restore student #1
    await studentApi.restoreStudent(studentToArchive.id, adminActor);

    const afterRestoreStats = await dashboardApi.getLiveStatistics();
    expect(afterRestoreStats.totalActiveStudents).toBe(initialActiveCount);

    // 3. Add new active student
    await studentApi.createStudentWithEnrollment(
      {
        full_name: 'Test Active Student',
        date_of_birth: '2011-01-01',
        gender: 'Male',
        admission_date: '2026-10-31',
        guardian_name: 'Test Guardian',
        guardian_relation: 'Father',
        guardian_phone: '03001234567',
        address: 'Lahore',
      },
      'b0000000-0000-0000-0000-000000000002',
      'd0000000-0000-0000-0000-000000000001',
      adminActor
    );

    const afterAddStats = await dashboardApi.getLiveStatistics();
    expect(afterAddStats.totalActiveStudents).toBe(initialActiveCount + 1);
  });

  it('7. returns 0 for Active Students when no active student records exist', async () => {
    const adminActor = { id: 'admin-1', name: 'Admin', role: 'admin' };
    // Deactivate all students
    const allStudents = await studentApi.getStudents(true);
    for (const s of allStudents) {
      await studentApi.archiveStudent(s.id, 'Deactivated for test', adminActor);
    }

    const stats = await dashboardApi.getLiveStatistics();
    expect(stats.totalActiveStudents).toBe(0);
  });
});
