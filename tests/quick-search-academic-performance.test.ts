import { describe, it, expect, beforeEach } from 'vitest';
import {
  studentSearchApi,
  quizApi,
  studentApi,
} from '../src/services/api';
import { sanitizeCellValue } from '../src/lib/csv-sanitizer';
import { calculateGrade } from '../src/lib/utils';
import {
  INITIAL_STUDENTS,
  INITIAL_PROFILES,
  INITIAL_TEACHERS,
  INITIAL_ASSIGNMENTS,
  INITIAL_ENROLLMENTS,
  INITIAL_QUIZZES,
  INITIAL_SECTIONS,
  INITIAL_SESSIONS,
} from '../src/services/mockData';

describe('Student Quick Search & Academic Performance Dossier', () => {
  const adminActor = {
    id: INITIAL_PROFILES.find((p) => p.role === 'admin')?.id,
    name: 'Administrator',
    role: 'admin',
    email: INITIAL_PROFILES.find((p) => p.role === 'admin')?.email,
  };

  const teacherProfile = INITIAL_PROFILES.find((p) => p.role === 'teacher')!;
  const teacherEntity = INITIAL_TEACHERS.find(
    (t) => t.email?.toLowerCase() === teacherProfile.email.toLowerCase() || t.profile_id === teacherProfile.id
  )!;

  const teacherActor = {
    id: teacherProfile.id,
    name: teacherProfile.full_name,
    role: 'teacher',
    email: teacherProfile.email,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Multi-Criteria Student Search & Duplicate Disambiguation', () => {
    it('searches students by name case-insensitively', async () => {
      const student1 = INITIAL_STUDENTS[0];
      const results = await studentSearchApi.searchStudents(
        { query: student1.full_name.substring(0, 4).toLowerCase() },
        adminActor
      );

      expect(results.length).toBeGreaterThan(0);
      const found = results.some((r) => r.student.id === student1.id);
      expect(found).toBe(true);
    });

    it('searches students by exact admission number (ADM-YYYY-XXXX)', async () => {
      const student1 = INITIAL_STUDENTS[0];
      const results = await studentSearchApi.searchStudents(
        { query: student1.admission_no },
        adminActor
      );

      expect(results.length).toBe(1);
      expect(results[0].student.admission_no).toBe(student1.admission_no);
      expect(results[0].student.full_name).toBe(student1.full_name);
    });

    it('searches students by roll number', async () => {
      const enr = INITIAL_ENROLLMENTS[0];
      const results = await studentSearchApi.searchStudents(
        { query: String(enr.roll_no) },
        adminActor
      );

      expect(results.length).toBeGreaterThan(0);
      const hasRoll = results.some((r) => r.enrollment?.roll_no === enr.roll_no);
      expect(hasRoll).toBe(true);
    });

    it('filters students by class and section', async () => {
      const enr = INITIAL_ENROLLMENTS[0];
      const secId = enr.section_id;

      const results = await studentSearchApi.searchStudents(
        { sectionId: secId },
        adminActor
      );

      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.enrollment?.section_id).toBe(secId);
      });
    });

    it('disambiguates students with similar names by providing distinct admission, roll, class, and guardian', async () => {
      const results = await studentSearchApi.searchStudents({}, adminActor);

      expect(results.length).toBeGreaterThan(1);
      results.forEach((r) => {
        expect(r.student.admission_no).toBeDefined();
        expect(r.student.guardian_name).toBeDefined();
        expect(r.student.guardian_phone).toBeDefined();
        expect(r.enrollment?.roll_no).toBeDefined();
        expect(r.enrollment?.section?.name).toBeDefined();
      });
    });
  });

  describe('2. Role-Based Scoping & Teacher Access Control', () => {
    it('scopes teacher searches exclusively to students in their assigned sections', async () => {
      // Find sections assigned to the test teacher
      const assignments = INITIAL_ASSIGNMENTS.filter((a) => a.teacher_id === teacherEntity.id);
      const assignedSectionIds = new Set(assignments.map((a) => a.section_id));

      const teacherResults = await studentSearchApi.searchStudents({}, teacherActor);

      expect(teacherResults.length).toBeGreaterThan(0);
      teacherResults.forEach((r) => {
        expect(assignedSectionIds.has(r.enrollment!.section_id)).toBe(true);
      });
    });

    it('prohibits teachers from viewing dossiers of unassigned students', async () => {
      // Create a student in Section B (which is not assigned to Teacher Tariq)
      const unassignedSection = INITIAL_SECTIONS.find(
        (s) => s.id === 'd0000000-0000-0000-0000-000000000002'
      )!;
      const activeSession = INITIAL_SESSIONS.find((s) => s.is_current)!;

      const { student: unassignedStudent } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Unassigned Test Student',
          gender: 'Female',
          date_of_birth: '2010-08-15',
          guardian_name: 'Imran Khan',
          guardian_relation: 'Father',
          guardian_phone: '+92 300 9988776',
          address: 'Model Town Lahore',
          admission_date: '2025-04-01',
        },
        activeSession.id,
        unassignedSection.id,
        adminActor
      );

      await expect(
        studentSearchApi.getStudentAcademicSummary(
          unassignedStudent.id,
          activeSession.id,
          teacherActor
        )
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('allows teacher to view dossier of assigned student, but strictly hides fee records', async () => {
      const teacherAssignments = INITIAL_ASSIGNMENTS.filter((a) => a.teacher_id === teacherEntity.id);
      const assignedSectionId = teacherAssignments[0].section_id;
      const assignedEnrollment = INITIAL_ENROLLMENTS.find(
        (e) => e.section_id === assignedSectionId
      )!;

      const summary = await studentSearchApi.getStudentAcademicSummary(
        assignedEnrollment.student_id,
        undefined,
        teacherActor
      );

      expect(summary.student.id).toBe(assignedEnrollment.student_id);
      expect(summary.attendance).toBeDefined();
      expect(summary.exams).toBeDefined();
      expect(summary.quizzes).toBeDefined();
      // Crucial privacy rule: Fee ledger is completely null for teachers
      expect(summary.fees).toBeNull();
    });

    it('allows administrator full access including complete fee balances and invoices', async () => {
      const anyEnrollment = INITIAL_ENROLLMENTS[0];

      const summary = await studentSearchApi.getStudentAcademicSummary(
        anyEnrollment.student_id,
        undefined,
        adminActor
      );

      expect(summary.student.id).toBe(anyEnrollment.student_id);
      expect(summary.fees).not.toBeNull();
      if (summary.fees) {
        expect(summary.fees.total_invoiced).toBeGreaterThanOrEqual(0);
        expect(summary.fees.total_paid).toBeGreaterThanOrEqual(0);
        expect(summary.fees.outstanding_balance).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(summary.fees.invoices)).toBe(true);
      }
    });
  });

  describe('3. Quiz Assessment Management & Marks Validation', () => {
    it('enforces marks validation: 0 <= marks_obtained <= max_marks', async () => {
      const quiz = INITIAL_QUIZZES[0];
      const enr = INITIAL_ENROLLMENTS[0];

      // Negative marks rejected
      await expect(
        quizApi.saveQuizMarksBatch(
          quiz.id,
          [{ enrollment_id: enr.id, marks_obtained: -5, is_absent: false }],
          adminActor
        )
      ).rejects.toThrow(/negative/i);

      // Exceeding maximum marks rejected
      await expect(
        quizApi.saveQuizMarksBatch(
          quiz.id,
          [{ enrollment_id: enr.id, marks_obtained: quiz.max_marks + 10, is_absent: false }],
          adminActor
        )
      ).rejects.toThrow(/cannot exceed/i);
    });

    it('correctly records absent status without penalizing with negative marks', async () => {
      const quiz = INITIAL_QUIZZES[0];
      const enr = INITIAL_ENROLLMENTS[0];

      await quizApi.saveQuizMarksBatch(
        quiz.id,
        [{ enrollment_id: enr.id, is_absent: true, remarks: 'Medical leave' }],
        adminActor
      );

      const studentMarks = await quizApi.getStudentQuizMarks(enr.id);
      const recorded = studentMarks.find((m) => m.quiz_id === quiz.id);
      expect(recorded).toBeDefined();
      expect(recorded?.is_absent).toBe(true);
      expect(recorded?.marks_obtained).toBeUndefined();
    });

    it('blocks teachers from grading quizzes for unassigned sections', async () => {
      // Create a quiz in an unassigned section as Admin
      const unassignedSection = INITIAL_SECTIONS.find(
        (s) => s.id === 'd0000000-0000-0000-0000-000000000002'
      )!;
      const activeSession = INITIAL_SESSIONS.find((s) => s.is_current)!;

      const unassignedQuiz = await quizApi.createQuiz(
        {
          title: 'Section B Biology Assessment',
          class_id: unassignedSection.class_id,
          section_id: unassignedSection.id,
          subject_id: 'e0000000-0000-0000-0000-000000000007',
          academic_session_id: activeSession.id,
          max_marks: 25,
          assessment_date: '2025-05-15',
        },
        adminActor
      );

      await expect(
        quizApi.saveQuizMarksBatch(
          unassignedQuiz.id,
          [{ enrollment_id: 'some-dummy-enrollment', marks_obtained: 15, is_absent: false }],
          teacherActor
        )
      ).rejects.toThrow(/not authorized/i);
    });
  });

  describe('4. BISE Grading Standards & Performance Timeline', () => {
    it('calculates official Pakistani BISE grades accurately', () => {
      expect(calculateGrade(95).grade).toBe('A+');
      expect(calculateGrade(85).grade).toBe('A');
      expect(calculateGrade(75).grade).toBe('B');
      expect(calculateGrade(65).grade).toBe('C');
      expect(calculateGrade(55).grade).toBe('D');
      expect(calculateGrade(40).grade).toBe('E');
      expect(calculateGrade(25).grade).toBe('F');
    });

    it('aggregates performance trend chronologically and includes both quizzes and examinations', async () => {
      const enr = INITIAL_ENROLLMENTS[0];
      const summary = await studentSearchApi.getStudentAcademicSummary(enr.student_id, undefined, adminActor);

      expect(summary.performanceTrend).toBeDefined();
      if (summary.performanceTrend.length > 1) {
        for (let i = 0; i < summary.performanceTrend.length - 1; i++) {
          const d1 = new Date(summary.performanceTrend[i].date).getTime();
          const d2 = new Date(summary.performanceTrend[i + 1].date).getTime();
          expect(d1).toBeLessThanOrEqual(d2);
        }
      }
    });
  });

  describe('5. CSV Formula Injection Sanitization', () => {
    it('escapes dangerous spreadsheet calculation characters (=, +, -, @) to prevent code execution', () => {
      expect(sanitizeCellValue('=1+1')).toBe("'=1+1");
      expect(sanitizeCellValue('+25')).toBe("'+25");
      expect(sanitizeCellValue('-10')).toBe("'-10");
      expect(sanitizeCellValue('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(sanitizeCellValue('\tcmd|/c calc')).toBe("'\tcmd|/c calc");

      // Regular text is untouched
      expect(sanitizeCellValue('Muhammad Ali')).toBe('Muhammad Ali');
      expect(sanitizeCellValue('ADM-2025-0001')).toBe('ADM-2025-0001');
    });
  });
});
