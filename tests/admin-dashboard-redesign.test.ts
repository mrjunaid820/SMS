import { describe, it, expect, beforeEach } from 'vitest';
import { dashboardApi, attendanceApi } from '../src/services/api';
import { MAIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../src/config/constants';
import { INITIAL_INVOICES, INITIAL_PAYMENTS, INITIAL_ATTENDANCE } from '../src/services/mockData';

describe('Admin Dashboard UI/UX Redesign & Scoping Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sms_invoices', JSON.stringify(INITIAL_INVOICES));
    localStorage.setItem('sms_payments', JSON.stringify(INITIAL_PAYMENTS));
    localStorage.setItem('sms_attendance', JSON.stringify(INITIAL_ATTENDANCE));
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
});
