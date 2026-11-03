import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { complaintApi, studentPortalApi } from '../src/services/api';
import {
  STUDENT_PORTAL_NAV_ITEMS,
  MAIN_NAV_ITEMS,
  TEACHER_NAV_ITEMS,
} from '../src/config/constants';
import { INITIAL_PROFILES, INITIAL_STUDENTS } from '../src/services/mockData';

describe('Student Complaints & Feedback System Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Database Migration 018 Schema & RLS Verification', () => {
    it('verifies migration 018 exists and contains student_complaints, student_complaint_notes, and history tables', () => {
      const migrationPath = path.resolve(
        __dirname,
        '../supabase/migrations/018_student_complaints_and_feedback.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Table definitions
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.student_complaints');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.student_complaint_notes');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.student_complaint_history');

      // Helper function
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_current_student_id()');

      // RLS enabled
      expect(sql).toContain('ALTER TABLE public.student_complaints ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.student_complaint_notes ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.student_complaint_history ENABLE ROW LEVEL SECURITY;');

      // Strict RLS policies
      expect(sql).toContain('CREATE POLICY "Admin full access on student_complaints"');
      expect(sql).toContain('CREATE POLICY "Students view own complaints"');
      expect(sql).toContain('CREATE POLICY "Students submit own complaints"');
      expect(sql).toContain('CREATE POLICY "Admin full access on student_complaint_notes"');
      expect(sql).toContain('CREATE POLICY "Students view own non-internal complaint history"');

      // Verifies NO teacher policies exist (default deny in Postgres RLS)
      expect(sql).not.toContain('Teachers view student_complaints');
      expect(sql).not.toContain('Teachers insert student_complaints');
      expect(sql).not.toContain('Teachers update student_complaints');
    });
  });

  describe('2. Navigation and Role-Based Menu Scoping', () => {
    it('verifies Student Portal includes Complaints & Feedback sidebar item', () => {
      const complaintItem = STUDENT_PORTAL_NAV_ITEMS.find((item) => item.id === 'my-complaints');
      expect(complaintItem).toBeDefined();
      expect(complaintItem?.label).toBe('Complaints & Feedback');
      expect(complaintItem?.path).toBe('/my-complaints');
      expect(complaintItem?.iconName).toBe('MessageSquareWarning');
    });

    it('verifies Teacher navigation strictly EXCLUDES any complaint menu or link', () => {
      const teacherPaths = TEACHER_NAV_ITEMS.map((item) => item.path);
      expect(teacherPaths).not.toContain('/my-complaints');
      expect(teacherPaths).not.toContain('/student-complaints');

      const nonAdminPaths = MAIN_NAV_ITEMS.filter((item) => !item.adminOnly).map((item) => item.path);
      expect(nonAdminPaths).not.toContain('/my-complaints');
      expect(nonAdminPaths).not.toContain('/student-complaints');
    });
  });

  describe('3. Complaint Submission, Scoping & Privacy Enforcement', () => {
    const studentA = INITIAL_STUDENTS[0]; // Hamza Khan (10000000-0000-0000-0000-000000000001)
    const studentB = INITIAL_STUDENTS[1]; // Ayan Ahmed (10000000-0000-0000-0000-000000000002)

    it('Scenario 1: Student A submits a complaint with automatic reference number', async () => {
      const created = await complaintApi.submitComplaint(
        {
          subject: 'Broken desk in classroom 102',
          category: 'Classroom Issue',
          description: 'The right armrest of desk 4 in row 2 is loose and needs carpenter repair.',
        },
        studentA.id
      );

      expect(created.id).toBeDefined();
      expect(created.complaint_reference).toMatch(/^CMP-\d{4}-\d{4}$/);
      expect(created.student_id).toBe(studentA.id);
      expect(created.status).toBe('Submitted');
      expect(created.subject).toBe('Broken desk in classroom 102');
    });

    it('Scenario 2: Student A can see their own complaints', async () => {
      const studentAComplaints = await complaintApi.getMyComplaints(studentA.id);
      expect(studentAComplaints.length).toBeGreaterThan(0);
      expect(studentAComplaints.every((c) => c.student_id === studentA.id)).toBe(true);
    });

    it('Scenario 3: Student B cannot see Student A complaints', async () => {
      const studentBComplaints = await complaintApi.getMyComplaints(studentB.id);
      // None of student B's returned complaints should belong to student A
      expect(studentBComplaints.every((c) => c.student_id === studentB.id)).toBe(true);
      expect(studentBComplaints.some((c) => c.student_id === studentA.id)).toBe(false);
    });

    it('Scenario 4: Admin can see all student complaints', async () => {
      const allComplaints = await complaintApi.getComplaints(undefined, { role: 'admin' });
      expect(allComplaints.length).toBeGreaterThanOrEqual(2);

      const studentIds = allComplaints.map((c) => c.student_id);
      expect(studentIds).toContain(studentA.id);
      expect(studentIds).toContain(studentB.id);
    });

    it('Scenario 5 & 6: Admin can update complaint status and add official response visible to Student A', async () => {
      const complaints = await complaintApi.getMyComplaints(studentA.id);
      const target = complaints[0];

      const updated = await complaintApi.updateComplaintStatus(
        target.id,
        'In Progress',
        {
          adminResponse: 'Carpenter has been assigned to inspect classroom 102 tomorrow morning.',
          comment: 'Status updated to In Progress by Principal',
        },
        { id: 'u0000000-0000-0000-0000-000000000001', name: 'Principal Malik', role: 'admin' }
      );

      expect(updated.status).toBe('In Progress');
      expect(updated.admin_response).toBe(
        'Carpenter has been assigned to inspect classroom 102 tomorrow morning.'
      );

      // Verify Student A sees this update
      const studentAView = await complaintApi.getComplaintById(target.id, {
        id: studentA.id,
        role: 'student',
        email: studentA.email,
      });

      expect(studentAView.status).toBe('In Progress');
      expect(studentAView.admin_response).toBe(
        'Carpenter has been assigned to inspect classroom 102 tomorrow morning.'
      );
    });

    it('Scenario 7: Student A CANNOT see internal Admin notes', async () => {
      const complaints = await complaintApi.getMyComplaints(studentA.id);
      const target = complaints[0];

      // Admin adds internal note
      await complaintApi.addAdminNote(
        target.id,
        'Internal note: Contractor XYZ called for bulk timber discount on desk batch.',
        { id: 'u0000000-0000-0000-0000-000000000001', name: 'Principal Malik', role: 'admin' }
      );

      // Student A views the complaint
      const studentAView = await complaintApi.getComplaintById(target.id, {
        id: studentA.id,
        role: 'student',
        email: studentA.email,
      });

      // Internal notes stripped
      expect(studentAView.notes).toEqual([]);
      expect(studentAView.internal_notes).toBeUndefined();

      // Non-internal history only
      if (studentAView.history) {
        expect(studentAView.history.some((h) => h.is_internal)).toBe(false);
      }
    });

    it('Scenario 8, 9 & 10: Teacher is STRICTLY DENIED from accessing complaints via API and queries', async () => {
      const teacherActor = {
        id: 'u0000000-0000-0000-0000-000000000002',
        role: 'teacher',
        email: 'tariq.math@islamiapublic.edu.pk',
      };

      // 1. getComplaints as teacher MUST throw
      await expect(complaintApi.getComplaints(undefined, teacherActor)).rejects.toThrow(
        /Access denied: Teachers are strictly unauthorized/i
      );

      // 2. getComplaintById as teacher MUST throw
      await expect(
        complaintApi.getComplaintById('cmp-0000000-0000-0000-0000-000000000001', teacherActor)
      ).rejects.toThrow(/Access denied: Teachers are strictly unauthorized/i);

      // 3. updateComplaintStatus as teacher MUST throw
      await expect(
        complaintApi.updateComplaintStatus(
          'cmp-0000000-0000-0000-0000-000000000001',
          'Resolved',
          {},
          teacherActor
        )
      ).rejects.toThrow(/Access denied: Only authorized administrators/i);

      // 4. addAdminNote as teacher MUST throw
      await expect(
        complaintApi.addAdminNote(
          'cmp-0000000-0000-0000-0000-000000000001',
          'Unauthorized teacher note',
          teacherActor
        )
      ).rejects.toThrow(/Access denied: Only authorized administrators/i);

      // 5. getComplaintStats as teacher MUST throw
      await expect(complaintApi.getComplaintStats(teacherActor)).rejects.toThrow(
        /Access denied: Teachers cannot access complaint statistics/i
      );
    });

    it('Scenario 11: Teachers do not receive complaint notifications in Header component', () => {
      const headerPath = path.resolve(__dirname, '../src/components/layout/Header.tsx');
      expect(fs.existsSync(headerPath)).toBe(true);
      const headerContent = fs.readFileSync(headerPath, 'utf8');

      // Confirms complaint alerts are scoped only to 'admin' and 'student'
      expect(headerContent).toContain("if (role === 'admin')");
      expect(headerContent).toContain("else if (role === 'student')");
      expect(headerContent).toContain("complaintApi.getComplaints({ status: 'Submitted' }");
      expect(headerContent).toContain('complaintApi.getMyComplaints');
    });

    it('Scenario 12: Route guards protect /student-complaints and /my-complaints in App.tsx', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      expect(fs.existsSync(appPath)).toBe(true);
      const appContent = fs.readFileSync(appPath, 'utf8');

      // Admin route guard
      expect(appContent).toContain('<Route\n                  path="/student-complaints"\n                  element={\n                    <AdminRoute>\n                      <StudentComplaintsPage />\n                    </AdminRoute>\n                  }');

      // Student route guard
      expect(appContent).toContain('<Route\n                  path="/my-complaints"\n                  element={\n                    <StudentRoute>\n                      <MyComplaintsPage />\n                    </StudentRoute>\n                  }');
    });

    it('Scenario 13: Summary statistics are computed from real complaint records', async () => {
      const stats = await complaintApi.getComplaintStats({ role: 'admin' });
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(typeof stats.submitted).toBe('number');
      expect(typeof stats.underReview).toBe('number');
      expect(typeof stats.inProgress).toBe('number');
      expect(typeof stats.resolved).toBe('number');
      expect(typeof stats.rejected).toBe('number');
      expect(stats.submitted + stats.underReview + stats.inProgress + stats.resolved + stats.rejected).toBe(
        stats.total
      );
    });
  });
});
