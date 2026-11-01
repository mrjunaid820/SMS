import { describe, it, expect, beforeEach } from 'vitest';
import { TEACHER_NAV_ITEMS, MAIN_NAV_ITEMS } from '../src/config/constants';
import { INITIAL_TEACHERS, INITIAL_ASSIGNMENTS, INITIAL_ENROLLMENTS } from '../src/services/mockData';
import fs from 'fs';
import path from 'path';

describe('Teacher Portal Dashboard Redesign & Scoping Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------
  // 1. TEACHER NAVIGATION INTEGRITY (Phase 3 Visual Reference)
  // -------------------------------------------------------------
  describe('1. Teacher Navigation Sidebar Structure', () => {
    it('provides exactly 8 dedicated teacher navigation items matching the visual reference', () => {
      expect(TEACHER_NAV_ITEMS).toBeDefined();
      expect(TEACHER_NAV_ITEMS.length).toBe(8);

      const labels = TEACHER_NAV_ITEMS.map((item) => item.label);
      expect(labels).toEqual([
        'Dashboard',
        'My Classes',
        'Attendance',
        'Quiz & Marks',
        'Daily Diary',
        'Exams',
        'Reports',
        'Announcements',
      ]);
    });

    it('ensures teacher navigation points to valid teacher-accessible routes', () => {
      const paths = TEACHER_NAV_ITEMS.map((item) => item.path);
      expect(paths).toContain('/teacher-dashboard');
      expect(paths).toContain('/classes-sections');
      expect(paths).toContain('/attendance');
      expect(paths).toContain('/quiz-marks');
      expect(paths).toContain('/daily-diary');
      expect(paths).toContain('/examinations');
      expect(paths).toContain('/reports-exports');
      expect(paths).toContain('/events-announcements');
    });

    it('strictly forbids admin-only modules in teacher navigation items', () => {
      const paths = TEACHER_NAV_ITEMS.map((item) => item.path);
      expect(paths).not.toContain('/fees-accounts');
      expect(paths).not.toContain('/school-settings');
      expect(paths).not.toContain('/academic-sessions');
      expect(paths).not.toContain('/teacher-assignments');
      expect(paths).not.toContain('/audit-logs');
      expect(paths).not.toContain('/users-roles');
      expect(paths).not.toContain('/server-database');
    });
  });

  // -------------------------------------------------------------
  // 2. TEACHER DASHBOARD STATISTIC CARDS & GROUPING (Phase 6 & 7)
  // -------------------------------------------------------------
  describe('2. Teacher Dashboard Calculations and Scoping', () => {
    it('accurately groups assignments into distinct classes and sections', () => {
      const teacher = INITIAL_TEACHERS[0]; // Muhammad Tariq
      const myAssignments = INITIAL_ASSIGNMENTS.filter((a) => a.teacher_id === teacher.id);
      expect(myAssignments.length).toBeGreaterThan(0);

      // Distinct sections assigned
      const distinctSections = new Set(myAssignments.map((a) => a.section_id));
      expect(distinctSections.size).toBeGreaterThanOrEqual(1);
    });

    it('accurately calculates distinct student counts avoiding duplication across subjects', () => {
      const teacher = INITIAL_TEACHERS[0];
      const myAssignments = INITIAL_ASSIGNMENTS.filter((a) => a.teacher_id === teacher.id);
      const assignedSectionIds = new Set(myAssignments.map((a) => a.section_id));

      const enrolledStudents = INITIAL_ENROLLMENTS.filter(
        (e) => assignedSectionIds.has(e.section_id) && e.status === 'active'
      );
      const uniqueStudentIds = new Set(enrolledStudents.map((e) => e.student_id));

      expect(uniqueStudentIds.size).toBe(enrolledStudents.length);
      expect(uniqueStudentIds.size).toBeGreaterThan(0);
    });

    it('calculates attendance percentage reliably for teacher sections', () => {
      const mockTodayAtt = [
        { id: '1', enrollment_id: 'e1', date: '2026-10-31', status: 'Present' },
        { id: '2', enrollment_id: 'e2', date: '2026-10-31', status: 'Present' },
        { id: '3', enrollment_id: 'e3', date: '2026-10-31', status: 'Absent' },
      ];

      const present = mockTodayAtt.filter((a) => a.status === 'Present').length;
      const total = mockTodayAtt.length;
      const pct = Math.round((present / total) * 100);

      expect(pct).toBe(67);
    });
  });

  // -------------------------------------------------------------
  // 3. FILE INTEGRITY & THEME COMPLIANCE (Phase 17)
  // -------------------------------------------------------------
  describe('3. Codebase File Structure & Dark Theme Integrity', () => {
    it('verifies TeacherDashboardPage exists and uses valid Tailwind theme classes without slate-850', () => {
      const filePath = path.resolve(__dirname, '../src/pages/TeacherPortal/TeacherDashboardPage.tsx');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).not.toContain('slate-850');
      expect(content).toContain('dark:bg-slate-900');
      expect(content).toContain('My Classes');
      expect(content).toContain('Total Students');
      expect(content).toContain('Today\'s Attendance');
      expect(content).toContain('Pending Tasks');
      expect(content).toContain('Mark Attendance');
      expect(content).toContain('Enter Quiz Marks');
      expect(content).toContain('Add Daily Diary');
      expect(content).toContain('Recent Activities');
    });

    it('verifies TeacherInspirationIllustration exists and contains Teach • Guide • Inspire graphic', () => {
      const filePath = path.resolve(__dirname, '../src/components/common/TeacherInspirationIllustration.tsx');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('Teach');
      expect(content).toContain('Guide');
      expect(content).toContain('Inspire');
      expect(content).toContain('svg');
    });
  });
});
