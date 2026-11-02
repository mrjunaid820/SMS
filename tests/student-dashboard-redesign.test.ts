import { describe, it, expect, beforeEach } from 'vitest';
import { STUDENT_PORTAL_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../src/config/constants';
import { studentPortalApi, studentApi } from '../src/services/api';
import { INITIAL_STUDENTS, INITIAL_PROFILES } from '../src/services/mockData';

describe('Student Portal Dashboard Redesign & Scoping Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------
  // 1. STUDENT NAVIGATION SIDEBAR INTEGRITY (Phase 3 Visual Reference)
  // -------------------------------------------------------------
  describe('1. Student Navigation Sidebar Structure', () => {
    it('provides exactly 8 dedicated student navigation items matching the visual reference', () => {
      expect(STUDENT_PORTAL_NAV_ITEMS).toBeDefined();
      expect(STUDENT_PORTAL_NAV_ITEMS.length).toBe(8);

      const labels = STUDENT_PORTAL_NAV_ITEMS.map((item) => item.label);
      expect(labels).toEqual([
        'Dashboard',
        'My Profile',
        'Attendance',
        'Quiz Marks',
        'Exam Results',
        'Fees & Dues',
        'Daily Diary',
        'Announcements',
      ]);
    });

    it('ensures student navigation points to valid student-accessible routes', () => {
      const paths = STUDENT_PORTAL_NAV_ITEMS.map((item) => item.path);
      expect(paths).toContain('/student-dashboard');
      expect(paths).toContain('/my-profile');
      expect(paths).toContain('/my-attendance');
      expect(paths).toContain('/my-quiz-marks');
      expect(paths).toContain('/my-exam-results');
      expect(paths).toContain('/my-fees');
      expect(paths).toContain('/my-daily-diary');
      expect(paths).toContain('/my-announcements');
    });

    it('strictly forbids admin-only modules in student navigation items', () => {
      const paths = STUDENT_PORTAL_NAV_ITEMS.map((item) => item.path);
      expect(paths).not.toContain('/teachers');
      expect(paths).not.toContain('/fees-accounts');
      expect(paths).not.toContain('/school-settings');
      expect(paths).not.toContain('/academic-sessions');
      expect(paths).not.toContain('/teacher-assignments');
      expect(paths).not.toContain('/audit-logs');
      expect(paths).not.toContain('/users-roles');
      expect(paths).not.toContain('/server-database');
    });

    it('preserves legacy STUDENT_NAV_ITEMS for backwards compatibility', () => {
      expect(Array.isArray(STUDENT_NAV_ITEMS)).toBe(true);
      expect(STUDENT_NAV_ITEMS.length).toBe(8);
      const paths = STUDENT_NAV_ITEMS.map((item) => item.path);
      expect(paths).toContain('/student-dashboard');
      expect(paths).toContain('/my-fees');
      expect(paths).toContain('/my-fee-challans');
      expect(paths).toContain('/my-dues');
      expect(paths).toContain('/my-quiz-marks');
      expect(paths).toContain('/my-daily-diary');
      expect(paths).toContain('/my-profile');
    });
  });

  // -------------------------------------------------------------
  // 2. STUDENT DASHBOARD STATISTIC CARDS & GROUPING (Phase 5, 6, 7)
  // -------------------------------------------------------------
  describe('2. Student Dashboard Calculations and Scoping', () => {
    it('retrieves accurate student dashboard statistics for active student', async () => {
      // Provision Hamza Khan
      const students = await studentApi.getStudents();
      const hamza = students[0];
      const result = await studentApi.provisionStudentAccount(
        hamza.id,
        'hamza.khan@student.islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const stats = await studentPortalApi.getMyDashboardStats(result.profile.id);

      expect(stats.student).toBeDefined();
      expect(stats.student.id).toBe(hamza.id);
      expect(stats.student.full_name).toBe('Muhammad Hamza Khan');

      // Verify Attendance Rate
      expect(typeof stats.attendancePct).toBe('number');
      expect(stats.attendancePct).toBeGreaterThanOrEqual(0);
      expect(stats.attendancePct).toBeLessThanOrEqual(100);

      // Verify Fee Summary
      expect(stats.feeSummary).toBeDefined();
      expect(stats.feeSummary.totalAssigned).toBe(5000);
      expect(stats.feeSummary.totalPaid).toBe(5000);
      expect(stats.feeSummary.remainingBalance).toBe(0);
      expect(stats.feeSummary.status).toBe('Paid');

      // Verify Exam Result
      expect(stats.latestExamResult).toBeDefined();
      expect(stats.latestExamResult?.examName).toBe('Mid-Term Examinations 2025-26');
      expect(stats.latestExamResult?.overallPercentage).toBe(34.2);
      expect(stats.latestExamResult?.grade).toBe('E');

      // Verify Upcoming Events
      expect(Array.isArray(stats.upcomingEvents)).toBe(true);
      expect(stats.upcomingEvents.length).toBeGreaterThan(0);
    });

    it('fetches student attendance history with monthly summary', async () => {
      const students = await studentApi.getStudents();
      const hamza = students[0];
      const result = await studentApi.provisionStudentAccount(
        hamza.id,
        'hamza.khan2@student.islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const attData = await studentPortalApi.getMyAttendance(result.profile.id);

      expect(attData.student).toBeDefined();
      expect(attData.totalDays).toBeGreaterThan(0);
      expect(attData.presentDays).toBeGreaterThanOrEqual(1);
      expect(attData.attendancePercentage).toBe(100);
      expect(Array.isArray(attData.records)).toBe(true);
      expect(Array.isArray(attData.monthlySummary)).toBe(true);
      expect(attData.monthlySummary.length).toBeGreaterThan(0);
    });

    it('fetches student exam results with subject breakdown and report card', async () => {
      const students = await studentApi.getStudents();
      const hamza = students[0];
      const result = await studentApi.provisionStudentAccount(
        hamza.id,
        'hamza.khan3@student.islamiapublic.edu.pk',
        'Student123!',
        { id: 'admin-1', role: 'admin' }
      );

      const examData = await studentPortalApi.getMyExamResults(result.profile.id);

      expect(examData.student).toBeDefined();
      expect(Array.isArray(examData.exams)).toBe(true);
      expect(examData.exams.length).toBeGreaterThan(0);

      const firstExam = examData.exams[0];
      expect(firstExam.exam.name).toBe('Mid-Term Examinations 2025-26');
      expect(firstExam.reportCard.overallPercentage).toBe(34.2);
      expect(firstExam.reportCard.grade).toBe('E');
      expect(firstExam.reportCard.subjectResults.length).toBeGreaterThan(0);
      expect(firstExam.reportCard.subjectResults[0].marksObtained).toBe(94);
      expect(firstExam.reportCard.subjectResults[0].percentage).toBe(94);
    });

    it('enforces student privacy boundaries: unauthenticated or invalid profile rejects gracefully', async () => {
      await expect(
        studentPortalApi.getMyDashboardStats('invalid-profile-uuid-999')
      ).rejects.toThrow('No student record is linked to this user profile.');
    });
  });
});
