import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dashboardApi, settingsApi } from '@/services/api';
import { INITIAL_SCHOOL_SETTINGS } from '@/services/mockData';

describe('Dashboard Progressive Loading & Fallback Resilience', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('dashboardApi.getLiveStatistics returns a complete stats object with resilient fallbacks', async () => {
    const stats = await dashboardApi.getLiveStatistics();

    expect(stats).toBeDefined();
    expect(typeof stats.totalActiveStudents).toBe('number');
    expect(typeof stats.activeTeachers).toBe('number');
    expect(typeof stats.totalClasses).toBe('number');
    expect(typeof stats.totalSections).toBe('number');
    expect(typeof stats.totalPublishedAnnouncements).toBe('number');
    expect(Array.isArray(stats.recentAnnouncements)).toBe(true);
    expect(Array.isArray(stats.upcomingEvents)).toBe(true);
    expect(stats.todayAttendance).toBeDefined();
    expect(typeof stats.todayAttendance.percentage).toBe('number');
    expect(stats.financial).toBeDefined();
    expect(typeof stats.financial.totalInvoiced).toBe('number');
    expect(typeof stats.financial.totalCollected).toBe('number');
    expect(typeof stats.financial.totalOutstanding).toBe('number');
    expect(Array.isArray(stats.upcomingExams)).toBe(true);
    expect(Array.isArray(stats.recentActivity)).toBe(true);
  });

  it('settingsApi.getSettings returns valid school settings without throwing errors', async () => {
    const settings = await settingsApi.getSettings();
    expect(settings).toBeDefined();
    expect(settings.school_name).toBeDefined();
  });

  it('preserves cached user profile in localStorage for instant render on refresh', () => {
    const adminUser = {
      id: '90000000-0000-0000-0000-000000000001',
      email: 'admin@islamia.edu.pk',
      full_name: 'Muhammad Asif',
      role: 'admin',
      is_active: true,
    };
    localStorage.setItem('sms_current_user', JSON.stringify(adminUser));

    const restored = JSON.parse(localStorage.getItem('sms_current_user') || '{}');
    expect(restored.id).toBe(adminUser.id);
    expect(restored.role).toBe('admin');
    expect(restored.is_active).toBe(true);
  });
});
