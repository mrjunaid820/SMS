import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  studentApi,
  studentPortalApi,
  quizApi,
  diaryApi,
  feeApi,
} from '../src/services/api';
import { MAIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '../src/config/constants';
import { INITIAL_PROFILES } from '../src/services/mockData';
import { Student, Enrollment, Quiz, DailyDiary } from '../src/types/database';

describe('Student Portal & Identity Architecture Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Migration 007 Structure & Additive Parity', () => {
    it('verifies migration 007 exists and contains all required additive schema modifications', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/007_student_portal_and_identity.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // Role check constraint update to include 'student'
      expect(sqlContent).toContain('profiles_role_check');
      expect(sqlContent).toContain("'student'");

      // Student profile identity linkage
      expect(sqlContent).toContain('ADD COLUMN profile_id UUID UNIQUE REFERENCES public.profiles(id)');

      // Quiz status lifecycle
      expect(sqlContent).toContain("ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'published'");
      expect(sqlContent).toContain("status IN ('draft', 'published')");

      // Student Row Level Security (RLS) policies
      expect(sqlContent).toContain('Students can view own student record');
      expect(sqlContent).toContain('Students can view published quizzes for their section');
      expect(sqlContent).toContain('Students can view their own published quiz marks');
      expect(sqlContent).toContain('Students can view published diary entries for enrolled section');
    });
  });

  describe('2. Navigation Constants Integrity & Test Safety', () => {
    it('preserves existing MAIN_NAV_ITEMS length = 15 and teacher non-admin count = 8', () => {
      expect(MAIN_NAV_ITEMS.length).toBe(15);
      const teacherItems = MAIN_NAV_ITEMS.filter((item) => !item.adminOnly);
      expect(teacherItems.length).toBe(8);
    });

    it('defines dedicated STUDENT_NAV_ITEMS with exactly 4 scoped portal items', () => {
      expect(Array.isArray(STUDENT_NAV_ITEMS)).toBe(true);
      expect(STUDENT_NAV_ITEMS.length).toBe(4);

      const paths = STUDENT_NAV_ITEMS.map((item) => item.path);
      expect(paths).toContain('/student-dashboard');
      expect(paths).toContain('/my-quiz-marks');
      expect(paths).toContain('/my-daily-diary');
      expect(paths).toContain('/my-profile');

      // Verify none of the administrative routes are present
      expect(paths).not.toContain('/teachers');
      expect(paths).not.toContain('/fees-accounts');
      expect(paths).not.toContain('/users-roles');
      expect(paths).not.toContain('/audit-logs');
    });
  });

  describe('3. Student Account Provisioning & Role-Based Authorization', () => {
    const adminActor = { id: 'admin-id-1', name: 'Principal Admin', role: 'admin' };
    const teacherActor = { id: 'teacher-id-1', name: 'Class Teacher', role: 'teacher' };
    const studentActor = { id: 'student-id-1', name: 'Zeeshan Khan', role: 'student' };

    it('provisions a new student account when requested by an administrator', async () => {
      const students = await studentApi.getStudents();
      expect(students.length).toBeGreaterThan(0);
      const targetStudent = students[0];

      const loginEmail = `student.${targetStudent.admission_no.toLowerCase()}@test.edu.pk`;
      const initialPassword = 'SecureStudentPass123';

      const result = await studentApi.provisionStudentAccount(
        targetStudent.id,
        loginEmail,
        initialPassword,
        adminActor
      );

      expect(result.profile).toBeDefined();
      expect(result.profile.role).toBe('student');
      expect(result.profile.email.toLowerCase()).toBe(loginEmail.toLowerCase());
      expect(result.student.profile_id).toBe(result.profile.id);
      expect(result.student.email).toBe(loginEmail);

      // Verify password was securely registered
      const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
      expect(passMap[result.profile.id]).toBe(initialPassword);
    });

    it('rejects student provisioning when called by a teacher or student', async () => {
      const students = await studentApi.getStudents();
      const target = students[0];

      await expect(
        studentApi.provisionStudentAccount(
          target.id,
          'unauthorized@test.com',
          'Password123',
          teacherActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to provision student accounts.');

      await expect(
        studentApi.provisionStudentAccount(
          target.id,
          'unauthorized@test.com',
          'Password123',
          studentActor
        )
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to provision student accounts.');
    });

    it('rejects duplicate email assignment during provisioning', async () => {
      const students = await studentApi.getStudents();
      const first = students[0];
      const second = students[1];

      const sharedEmail = 'shared.student@test.edu.pk';

      // Provision first
      await studentApi.provisionStudentAccount(first.id, sharedEmail, 'Pass123!', adminActor);

      // Attempt provisioning second with same email
      await expect(
        studentApi.provisionStudentAccount(second.id, sharedEmail, 'Pass456!', adminActor)
      ).rejects.toThrow('already registered');
    });

    it('allows administrator to reset student password and toggle account status', async () => {
      const students = await studentApi.getStudents();
      const target = students[0];

      await studentApi.provisionStudentAccount(
        target.id,
        'portal.student@test.edu.pk',
        'InitialPass123',
        adminActor
      );

      // Reset password
      const resetResult = await studentApi.resetStudentPassword(
        target.id,
        'BrandNewPassword456',
        adminActor
      );
      expect(resetResult.success).toBe(true);

      const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
      expect(passMap[resetResult.profileId!]).toBe('BrandNewPassword456');

      // Toggle deactivate
      const toggled = await studentApi.toggleStudentAccountStatus(target.id, adminActor);
      expect(toggled.profile.is_active).toBe(false);

      // Toggle reactivate
      const reactivated = await studentApi.toggleStudentAccountStatus(target.id, adminActor);
      expect(reactivated.profile.is_active).toBe(true);
    });
  });

  describe('4. Quiz Status Lifecycle & Privacy Scoping', () => {
    it('enforces that draft quizzes are completely invisible to student portal consumers', async () => {
      const adminActor = { id: 'admin-id-1', name: 'Principal Admin', role: 'admin' };
      const students = await studentApi.getStudents();
      const enrollments = await studentApi.getEnrollments();
      const targetStudent = students[0];
      const enrollment = enrollments.find((e) => e.student_id === targetStudent.id);
      expect(enrollment).toBeDefined();

      // Provision target student
      const { profile } = await studentApi.provisionStudentAccount(
        targetStudent.id,
        'quiz.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      // Create a DRAFT quiz
      const draftQuiz = await quizApi.createQuiz(
        {
          academic_session_id: enrollment!.academic_session_id,
          class_id: enrollment!.section?.class_id || 'class-1',
          section_id: enrollment!.section_id,
          subject_id: 'sub-math-1',
          title: 'Upcoming Secret Draft Quiz',
          assessment_date: '2026-10-30',
          max_marks: 25,
          status: 'draft',
        },
        adminActor
      );

      // Teacher adds marks for student in draft quiz
      await quizApi.saveQuizMarksBatch(
        draftQuiz.id,
        [{ enrollment_id: enrollment!.id, marks_obtained: 22, is_absent: false }],
        adminActor
      );

      // Student calls studentPortalApi to fetch their marks
      const studentMarks = await studentPortalApi.getMyQuizMarks(profile.id);
      const draftMark = studentMarks.find((m) => m.quiz_id === draftQuiz.id);
      expect(draftMark).toBeUndefined();

      // Now publish the quiz
      await quizApi.updateQuiz(draftQuiz.id, { status: 'published' }, adminActor);

      // Now student should see the published quiz mark
      const updatedStudentMarks = await studentPortalApi.getMyQuizMarks(profile.id);
      const publishedMark = updatedStudentMarks.find((m) => m.quiz_id === draftQuiz.id);
      expect(publishedMark).toBeDefined();
      expect(publishedMark?.marks_obtained).toBe(22);
      expect(publishedMark?.quiz?.title).toBe('Upcoming Secret Draft Quiz');
    });
  });

  describe('5. Daily Diary Privacy & Private Teacher Notes Omission', () => {
    it('strictly strips private_teacher_notes when returned to student portal', async () => {
      const adminActor = { id: 'admin-id-1', name: 'Principal Admin', role: 'admin' };
      const students = await studentApi.getStudents();
      const enrollments = await studentApi.getEnrollments();
      const targetStudent = students[0];
      const enrollment = enrollments.find((e) => e.student_id === targetStudent.id);

      const { profile } = await studentApi.provisionStudentAccount(
        targetStudent.id,
        'diary.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      // Create a diary entry with confidential private notes
      const secretNote = 'Student was restless today. Staff consultation advised.';
      const diaryEntry = await diaryApi.saveDiary(
        {
          academic_session_id: enrollment!.academic_session_id,
          section_id: enrollment!.section_id,
          subject_id: 'sub-science-1',
          teacher_id: 'teacher-1',
          diary_date: '2026-10-23',
          lesson_topics: 'Cell Biology & Mitosis',
          homework: 'Complete textbook review questions 1-5',
          homework_due_date: '2026-10-25',
          status: 'published',
          private_teacher_notes: secretNote,
        },
        adminActor
      );

      // When fetched by faculty/admin, private note is present
      const facultyDiaries = await diaryApi.getDiaries(
        { sectionId: enrollment!.section_id, status: 'published' },
        adminActor
      );
      const facultyEntry = facultyDiaries.find((d) => d.id === diaryEntry.id);
      expect(facultyEntry?.private_teacher_notes).toBe(secretNote);

      // When fetched by student portal, private note MUST BE STRIPPED
      const studentDiaries = await studentPortalApi.getMyDailyDiary(profile.id);
      const studentEntry = studentDiaries.find((d) => d.id === diaryEntry.id);

      expect(studentEntry).toBeDefined();
      expect(studentEntry?.lesson_topics).toBe('Cell Biology & Mitosis');
      expect(studentEntry?.homework).toBe('Complete textbook review questions 1-5');
      expect(studentEntry?.private_teacher_notes).toBeUndefined();
    });
  });

  describe('6. Student Data Isolation & Security Boundaries', () => {
    it('prevents students from accessing fee payment recording or reversing', async () => {
      const studentActor = { id: 'student-id-99', name: 'Malicious Student', role: 'student' };

      await expect(
        feeApi.recordPayment('inv-123', 500, 'Cash', undefined, undefined, studentActor)
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to record fee payments.');

      await expect(
        feeApi.reversePayment('pay-123', 'Unauthorized reversal', studentActor)
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to reverse fee payments.');
    });

    it('loads student self profile and guarantees proper enrollment linkage', async () => {
      const adminActor = { id: 'admin-id-1', name: 'Principal Admin', role: 'admin' };
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      const { profile } = await studentApi.provisionStudentAccount(
        targetStudent.id,
        'self.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const selfData = await studentPortalApi.getStudentSelf(profile.id);
      expect(selfData.student.id).toBe(targetStudent.id);
      expect(selfData.student.admission_no).toBe(targetStudent.admission_no);
      expect(selfData.enrollment).toBeDefined();
    });
  });
});
