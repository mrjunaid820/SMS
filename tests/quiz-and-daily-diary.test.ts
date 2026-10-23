import { describe, it, expect, beforeEach } from 'vitest';
import {
  quizApi,
  diaryApi,
  studentSearchApi,
  studentApi,
  teacherApi,
  academicStructureApi,
  attendanceApi,
} from '../src/services/api';
import {
  INITIAL_STUDENTS,
  INITIAL_PROFILES,
  INITIAL_TEACHERS,
  INITIAL_ASSIGNMENTS,
  INITIAL_ENROLLMENTS,
  INITIAL_CLASSES,
  INITIAL_SECTIONS,
  INITIAL_SESSIONS,
  INITIAL_SUBJECTS,
} from '../src/services/mockData';

describe('Upgrade: Quiz Marks Management, Subject-Wise Daily Diary & Student Portal Readiness', () => {
  // Actors
  const adminProfile = INITIAL_PROFILES.find((p) => p.role === 'admin')!;
  const adminActor = {
    id: adminProfile.id,
    name: adminProfile.full_name,
    role: 'admin',
    email: adminProfile.email,
  };

  // Teacher Tariq: assigned to Class 9-A (sec1), Math
  const teacherTariq = INITIAL_TEACHERS[0];
  const teacherTariqProfile = INITIAL_PROFILES.find(
    (p) => p.id === teacherTariq.profile_id || p.email?.toLowerCase() === teacherTariq.email?.toLowerCase()
  )!;
  const teacherTariqActor = {
    id: teacherTariqProfile.id,
    name: teacherTariq.full_name,
    role: 'teacher',
    email: teacherTariq.email,
  };

  // Teacher Ayesha: assigned to Class 9-A (sec1), English
  const teacherAyesha = INITIAL_TEACHERS[1];
  const teacherAyeshaProfile = INITIAL_PROFILES.find(
    (p) => p.id === teacherAyesha.profile_id || p.email?.toLowerCase() === teacherAyesha.email?.toLowerCase()
  )!;
  const teacherAyeshaActor = {
    id: teacherAyeshaProfile.id,
    name: teacherAyesha.full_name,
    role: 'teacher',
    email: teacherAyesha.email,
  };

  // Student Actor (for future student portal testing)
  const studentActor = {
    id: 'u-student-001',
    name: INITIAL_STUDENTS[0].full_name,
    role: 'student',
    email: 'student@school.edu.pk',
  };

  const currentSession = INITIAL_SESSIONS.find((s) => s.is_current) || INITIAL_SESSIONS[0];
  const sessionId = currentSession.id;

  const section1 = INITIAL_SECTIONS[0]; // Class 9-A
  const section1Id = section1.id;
  const class1Id = section1.class_id;

  const sectionUnassigned = INITIAL_SECTIONS[2]; // Class 10-A
  const sectionUnassignedId = sectionUnassigned.id;
  const classUnassignedId = sectionUnassigned.class_id;

  const mathSubject = INITIAL_SUBJECTS.find((s) => s.name.includes('Math')) || INITIAL_SUBJECTS[3];
  const mathSubjectId = mathSubject.id;

  const englishSubject = INITIAL_SUBJECTS.find((s) => s.name.includes('English')) || INITIAL_SUBJECTS[0];
  const englishSubjectId = englishSubject.id;

  const physicsSubject = INITIAL_SUBJECTS.find((s) => s.name.includes('Physics')) || INITIAL_SUBJECTS[4];
  const physicsSubjectId = physicsSubject.id;

  const enrollment1 = INITIAL_ENROLLMENTS[0];
  const enrollment2 = INITIAL_ENROLLMENTS[1];

  beforeEach(() => {
    localStorage.clear();
  });

  // --------------------------------------------------------------------------
  // FEATURE 1: TEACHER QUIZ MARKS MANAGEMENT
  // --------------------------------------------------------------------------
  describe('Feature 1: Quiz Marks Management & Teacher Scoping', () => {
    it('1. Teacher can create a quiz for an assigned class, section, and subject', async () => {
      // Tariq is assigned to Class 9-A + Math
      const newQuiz = await quizApi.createQuiz(
        {
          title: 'Algebra Polynomials Quiz',
          class_id: class1Id,
          section_id: section1Id,
          subject_id: mathSubjectId,
          academic_session_id: sessionId,
          max_marks: 25,
          assessment_date: '2026-10-24',
          instructions: 'Attempt all 5 questions. No calculators allowed.',
        },
        teacherTariqActor
      );

      expect(newQuiz).toBeDefined();
      expect(newQuiz.id).toBeDefined();
      expect(newQuiz.title).toBe('Algebra Polynomials Quiz');
      expect(newQuiz.max_marks).toBe(25);
      expect(newQuiz.instructions).toBe('Attempt all 5 questions. No calculators allowed.');

      // Verify quiz is in the persistent storage
      const allQuizzes = await quizApi.getQuizzes({ sectionId: section1Id });
      const found = allQuizzes.find((q) => q.id === newQuiz.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Algebra Polynomials Quiz');
    });

    it('2. Teacher can enter and save quiz marks with batch saving', async () => {
      // Create quiz
      const quiz = await quizApi.createQuiz(
        {
          title: 'Trigonometry Formative Quiz',
          class_id: class1Id,
          section_id: section1Id,
          subject_id: mathSubjectId,
          academic_session_id: sessionId,
          max_marks: 20,
          assessment_date: '2026-10-25',
        },
        teacherTariqActor
      );

      // Section 1 has students enrollment1 and enrollment2
      await quizApi.saveQuizMarksBatch(
        quiz.id,
        [
          { enrollment_id: enrollment1.id, marks_obtained: 18.5, is_absent: false, remarks: 'Excellent' },
          { enrollment_id: enrollment2.id, marks_obtained: 0, is_absent: true, remarks: 'Medical leave' },
        ],
        teacherTariqActor
      );

      // Verify saved marks
      const marks = await quizApi.getQuizMarks(quiz.id);
      expect(marks.length).toBe(2);

      const m1 = marks.find((m) => m.enrollment_id === enrollment1.id);
      expect(m1?.marks_obtained).toBe(18.5);
      expect(m1?.is_absent).toBe(false);
      expect(m1?.remarks).toBe('Excellent');

      const m2 = marks.find((m) => m.enrollment_id === enrollment2.id);
      expect(m2?.marks_obtained).toBeUndefined();
      expect(m2?.is_absent).toBe(true);
      expect(m2?.remarks).toBe('Medical leave');
    });

    it('3. Teacher can edit existing quiz marks without creating duplicate records', async () => {
      const quiz = await quizApi.createQuiz(
        {
          title: 'Geometry Theorem Quiz',
          class_id: class1Id,
          section_id: section1Id,
          subject_id: mathSubjectId,
          academic_session_id: sessionId,
          max_marks: 30,
          assessment_date: '2026-10-26',
        },
        teacherTariqActor
      );

      // Initial mark entry
      await quizApi.saveQuizMarksBatch(
        quiz.id,
        [{ enrollment_id: enrollment1.id, marks_obtained: 22, is_absent: false, remarks: 'Good' }],
        teacherTariqActor
      );

      let marks = await quizApi.getQuizMarks(quiz.id);
      expect(marks.length).toBe(1);
      expect(marks[0].marks_obtained).toBe(22);

      // Teacher edits the mark after recounting
      await quizApi.saveQuizMarksBatch(
        quiz.id,
        [{ enrollment_id: enrollment1.id, marks_obtained: 26.5, is_absent: false, remarks: 'Recounted +4.5 marks' }],
        teacherTariqActor
      );

      // Verify marks were updated in-place without duplicate
      marks = await quizApi.getQuizMarks(quiz.id);
      expect(marks.length).toBe(1);
      expect(marks[0].marks_obtained).toBe(26.5);
      expect(marks[0].remarks).toBe('Recounted +4.5 marks');

      // Edit quiz details
      const updatedQuiz = await quizApi.updateQuiz(
        quiz.id,
        { title: 'Geometry Theorem Quiz (Updated)', max_marks: 35 },
        teacherTariqActor
      );
      expect(updatedQuiz.title).toBe('Geometry Theorem Quiz (Updated)');
      expect(updatedQuiz.max_marks).toBe(35);
    });

    it('4. Validation strictly prevents marks > max_marks and negative marks', async () => {
      const quiz = await quizApi.createQuiz(
        {
          title: 'Strict Validation Quiz',
          class_id: class1Id,
          section_id: section1Id,
          subject_id: mathSubjectId,
          academic_session_id: sessionId,
          max_marks: 20,
          assessment_date: '2026-10-27',
        },
        teacherTariqActor
      );

      // Exceeds max marks
      await expect(
        quizApi.saveQuizMarksBatch(
          quiz.id,
          [{ enrollment_id: enrollment1.id, marks_obtained: 25, is_absent: false }],
          teacherTariqActor
        )
      ).rejects.toThrow(/cannot exceed maximum marks/i);

      // Negative marks
      await expect(
        quizApi.saveQuizMarksBatch(
          quiz.id,
          [{ enrollment_id: enrollment1.id, marks_obtained: -3, is_absent: false }],
          teacherTariqActor
        )
      ).rejects.toThrow(/cannot be negative/i);

      // Invalid quiz creation: max_marks <= 0
      await expect(
        quizApi.createQuiz(
          {
            title: 'Zero Marks Quiz',
            class_id: class1Id,
            section_id: section1Id,
            subject_id: mathSubjectId,
            academic_session_id: sessionId,
            max_marks: 0,
            assessment_date: '2026-10-27',
          },
          teacherTariqActor
        )
      ).rejects.toThrow(/greater than zero/i);
    });

    it('5. Teacher cannot create a quiz for an unassigned class, section, or subject', async () => {
      // Tariq is NOT assigned to English (sub2)
      await expect(
        quizApi.createQuiz(
          {
            title: 'English Vocabulary Quiz',
            class_id: class1Id,
            section_id: section1Id,
            subject_id: englishSubjectId,
            academic_session_id: sessionId,
            max_marks: 20,
            assessment_date: '2026-10-28',
          },
          teacherTariqActor
        )
      ).rejects.toThrow(/Unauthorized: You are not authorized/i);

      // Tariq is NOT assigned to Section 3 (Class 10-A)
      await expect(
        quizApi.createQuiz(
          {
            title: 'Class 10 Math Quiz',
            class_id: classUnassignedId,
            section_id: sectionUnassignedId,
            subject_id: mathSubjectId,
            academic_session_id: sessionId,
            max_marks: 20,
            assessment_date: '2026-10-28',
          },
          teacherTariqActor
        )
      ).rejects.toThrow(/Unauthorized: You are not authorized/i);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 2: SUBJECT-WISE DAILY DIARY
  // --------------------------------------------------------------------------
  describe('Feature 2: Subject-Wise Daily Diary & Scoping', () => {
    it('6. Teacher can save a draft daily diary entry with lesson topics and private teacher notes', async () => {
      // Tariq logs draft for 9-A Math
      const draft = await diaryApi.saveDiary(
        {
          academic_session_id: sessionId,
          section_id: section1Id,
          subject_id: mathSubjectId,
          diary_date: '2026-10-24',
          teacher_id: teacherTariq.id,
          lesson_topics: 'Quadratic Equations Exercise 2.1 Q1-Q5',
          homework_details: 'Complete Exercise 2.1 Q6-Q10 on homework notebook',
          homework_due_date: '2026-10-25',
          instructions_or_test_alerts: 'Bring geometry set tomorrow for parabolas.',
          private_teacher_notes: 'Section was weak on formula derivation. Re-explain tomorrow.',
          status: 'draft',
        },
        teacherTariqActor
      );

      expect(draft).toBeDefined();
      expect(draft.id).toBeDefined();
      expect(draft.status).toBe('draft');
      expect(draft.lesson_topics).toContain('Quadratic Equations');
      expect(draft.private_teacher_notes).toBe('Section was weak on formula derivation. Re-explain tomorrow.');

      // Retrieve diary
      const retrieved = await diaryApi.getDiaryById(draft.id, teacherTariqActor);
      expect(retrieved?.status).toBe('draft');
      expect(retrieved?.private_teacher_notes).toBe('Section was weak on formula derivation. Re-explain tomorrow.');
    });

    it('7. Teacher can publish a diary entry and duplicate entries for the same date/subject/section are prevented', async () => {
      // Step 1: Save draft
      const entry = await diaryApi.saveDiary(
        {
          academic_session_id: sessionId,
          section_id: section1Id,
          subject_id: mathSubjectId,
          diary_date: '2026-10-25',
          teacher_id: teacherTariq.id,
          lesson_topics: 'Matrices: Multiplication of Matrices',
          homework_details: 'Exercise 1.4 questions 1 to 4',
          status: 'draft',
        },
        teacherTariqActor
      );
      expect(entry.status).toBe('draft');

      // Step 2: Publish the diary entry
      const published = await diaryApi.saveDiary(
        {
          ...entry,
          status: 'published',
          instructions_or_test_alerts: 'Chapter 1 Assessment on Monday!',
        },
        teacherTariqActor
      );
      expect(published.id).toBe(entry.id);
      expect(published.status).toBe('published');
      expect(published.instructions_or_test_alerts).toBe('Chapter 1 Assessment on Monday!');

      // Step 3: Prevent duplicate diary on same (section_id, subject_id, diary_date, session)
      const duplicateSubmission = await diaryApi.saveDiary(
        {
          academic_session_id: sessionId,
          section_id: section1Id,
          subject_id: mathSubjectId,
          diary_date: '2026-10-25',
          teacher_id: teacherTariq.id,
          lesson_topics: 'Matrices: Updated Lesson Topics',
          homework_details: 'Exercise 1.4 question 5 added',
          status: 'published',
        },
        teacherTariqActor
      );

      // Should have updated the existing entry rather than creating a new record
      expect(duplicateSubmission.id).toBe(entry.id);
      expect(duplicateSubmission.lesson_topics).toBe('Matrices: Updated Lesson Topics');

      const allForSection = await diaryApi.getDiaries(
        { sectionId: section1Id, subjectId: mathSubjectId, date: '2026-10-25' },
        teacherTariqActor
      );
      expect(allForSection.length).toBe(1);
    });

    it('8. Teacher cannot create or edit a diary entry for an unassigned class or subject', async () => {
      // Tariq tries to create diary for English
      await expect(
        diaryApi.saveDiary(
          {
            academic_session_id: sessionId,
            section_id: section1Id,
            subject_id: englishSubjectId,
            diary_date: '2026-10-26',
            teacher_id: teacherTariq.id,
            lesson_topics: 'Poem: The Daffodils',
            homework_details: 'Write summary of the poem',
            status: 'published',
          },
          teacherTariqActor
        )
      ).rejects.toThrow(/Unauthorized: You are not authorized to create or edit diary entries/i);

      // Tariq tries to create diary for Class 10-A
      await expect(
        diaryApi.saveDiary(
          {
            academic_session_id: sessionId,
            section_id: sectionUnassignedId,
            subject_id: mathSubjectId,
            diary_date: '2026-10-26',
            teacher_id: teacherTariq.id,
            lesson_topics: 'Class 10 Math Chapter 1',
            homework_details: 'Homework Ex 1.1',
            status: 'published',
          },
          teacherTariqActor
        )
      ).rejects.toThrow(/Unauthorized: You are not authorized to create or edit diary entries/i);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: ADMINISTRATOR SCHOOL-WIDE OVERSIGHT
  // --------------------------------------------------------------------------
  describe('Feature 3: Administrator School-Wide Oversight', () => {
    it('9. Admin can view and manage quizzes across all classes and subjects without restriction', async () => {
      // Admin creates quiz for any class/section/subject
      const adminQuiz = await quizApi.createQuiz(
        {
          title: 'Institutional Mid-Term Review Quiz',
          class_id: classUnassignedId,
          section_id: sectionUnassignedId,
          subject_id: physicsSubjectId,
          academic_session_id: sessionId,
          max_marks: 50,
          assessment_date: '2026-10-29',
          instructions: 'School-wide Physics diagnostic evaluation.',
        },
        adminActor
      );
      expect(adminQuiz.id).toBeDefined();

      // Admin updates quiz
      const updated = await quizApi.updateQuiz(
        adminQuiz.id,
        { title: 'Institutional Mid-Term Review Quiz (Edited)' },
        adminActor
      );
      expect(updated.title).toBe('Institutional Mid-Term Review Quiz (Edited)');

      // Admin deletes quiz
      await quizApi.deleteQuiz(adminQuiz.id, adminActor);
      const remaining = await quizApi.getQuizzes({ sectionId: sectionUnassignedId });
      expect(remaining.some((q) => q.id === adminQuiz.id)).toBe(false);
    });

    it('10. Admin can view and manage diary entries across all classes including private teacher notes', async () => {
      // Tariq creates diary with private notes
      const diary = await diaryApi.saveDiary(
        {
          academic_session_id: sessionId,
          section_id: section1Id,
          subject_id: mathSubjectId,
          diary_date: '2026-10-27',
          teacher_id: teacherTariq.id,
          lesson_topics: 'Surds and Radicals',
          homework_details: 'Ex 2.3 Questions',
          private_teacher_notes: 'Principal review needed for student engagement.',
          status: 'draft',
        },
        teacherTariqActor
      );

      // Admin retrieves diary
      const adminView = await diaryApi.getDiaryById(diary.id, adminActor);
      expect(adminView).toBeDefined();
      expect(adminView?.private_teacher_notes).toBe('Principal review needed for student engagement.');

      // Admin can publish teacher diary
      const publishedByAdmin = await diaryApi.saveDiary(
        { ...adminView!, status: 'published' },
        adminActor
      );
      expect(publishedByAdmin.status).toBe('published');

      // Admin can delete diary entry
      await diaryApi.deleteDiary(diary.id, adminActor);
      const afterDelete = await diaryApi.getDiaryById(diary.id, adminActor);
      expect(afterDelete).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: STUDENT DOSSIER & FUTURE STUDENT PORTAL ACCESS CONTROL
  // --------------------------------------------------------------------------
  describe('Feature 4: Student Quick Search Dossier & Future Student Portal Readiness', () => {
    it('11. Quick Search displays quiz history and published class daily diary entries for student', async () => {
      const student1 = INITIAL_STUDENTS[0]; // In Section 1 (9-A)

      // Ensure a published diary exists for sec1
      await diaryApi.saveDiary(
        {
          academic_session_id: sessionId,
          section_id: section1Id,
          subject_id: mathSubjectId,
          diary_date: '2026-10-23',
          teacher_id: teacherTariq.id,
          lesson_topics: 'Class 9 Math Theorem 12.1',
          homework_details: 'Practice Theorem 12.1 proof on neat notebook',
          homework_due_date: '2026-10-24',
          instructions_or_test_alerts: 'Bring Geometry Box Tomorrow!',
          status: 'published',
        },
        teacherTariqActor
      );

      const summary = await studentSearchApi.getStudentAcademicSummary(student1.id, sessionId, adminActor);

      expect(summary.student.id).toBe(student1.id);
      expect(summary.quizzes).toBeDefined();
      expect(Array.isArray(summary.quizzes)).toBe(true);

      // Check daily diary entries attached to student summary
      expect(summary.diaryEntries).toBeDefined();
      expect(summary.diaryEntries!.length).toBeGreaterThan(0);

      const mathEntry = summary.diaryEntries!.find((d) => d.lesson_topics.includes('Theorem 12.1'));
      expect(mathEntry).toBeDefined();
      expect(mathEntry?.homework_details).toContain('Practice Theorem 12.1');
      expect(mathEntry?.instructions_or_test_alerts).toBe('Bring Geometry Box Tomorrow!');
    });

    it('12. Private teacher notes and draft diary entries are strictly hidden from student queries', async () => {
      const student1 = INITIAL_STUDENTS[0]; // In Section 1

      // Create a draft diary entry with private notes
      await diaryApi.saveDiary(
        {
          academic_session_id: sessionId,
          section_id: section1Id,
          subject_id: mathSubjectId,
          diary_date: '2026-10-30',
          teacher_id: teacherTariq.id,
          lesson_topics: 'Draft Topics Not Yet Covered',
          homework_details: 'Unpublished Homework',
          private_teacher_notes: 'CONFIDENTIAL: Teacher grading notes',
          status: 'draft',
        },
        teacherTariqActor
      );

      // Create a published diary entry with private notes
      await diaryApi.saveDiary(
        {
          academic_session_id: sessionId,
          section_id: section1Id,
          subject_id: englishSubjectId,
          diary_date: '2026-10-30',
          teacher_id: teacherAyesha.id,
          lesson_topics: 'Published English Chapter 3',
          homework_details: 'Reading comprehension questions 1-5',
          private_teacher_notes: 'CONFIDENTIAL: Student needs tutoring',
          status: 'published',
        },
        teacherAyeshaActor
      );

      // Query as student role
      const studentSummary = await studentSearchApi.getStudentAcademicSummary(
        student1.id,
        sessionId,
        studentActor
      );

      // 1. Draft entries must NOT appear to student
      const hasDraft = studentSummary.diaryEntries?.some((d) => d.status === 'draft');
      expect(hasDraft).toBe(false);

      // 2. Published entries DO appear to student
      const publishedEnglish = studentSummary.diaryEntries?.find((d) =>
        d.lesson_topics.includes('Published English Chapter 3')
      );
      expect(publishedEnglish).toBeDefined();

      // 3. Private teacher notes MUST be stripped out
      expect(publishedEnglish?.private_teacher_notes).toBeUndefined();

      // 4. Financial fee information is hidden from student summary
      expect(studentSummary.fees).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 5: UNBROKEN PRESERVATION OF EXISTING SYSTEM FUNCTIONALITY
  // --------------------------------------------------------------------------
  describe('Feature 5: Preservation of Existing Core Modules', () => {
    it('13. Preserves existing student editing, teacher editing, attendance, and examinations', async () => {
      // 1. Student editing works
      const student1 = INITIAL_STUDENTS[0];
      const updatedStudent = await studentApi.updateStudent(
        student1.id,
        { guardian_name: 'Muhammad Ali Khan (Updated)' },
        adminActor
      );
      expect(updatedStudent.guardian_name).toBe('Muhammad Ali Khan (Updated)');

      // 2. Teacher editing works
      const updatedTeacher = await teacherApi.updateTeacher(
        teacherTariq.id,
        { qualification: 'M.Sc Mathematics & M.Ed' },
        adminActor
      );
      expect(updatedTeacher.qualification).toBe('M.Sc Mathematics & M.Ed');

      // 3. Attendance records are intact
      const attendance = await attendanceApi.getAttendanceByEnrollment(enrollment1.id);
      expect(Array.isArray(attendance)).toBe(true);

      // 4. Academic structure (classes, sections, subjects) intact
      const classes = await academicStructureApi.getClasses();
      const sections = await academicStructureApi.getSections();
      const subjects = await academicStructureApi.getSubjects();
      expect(classes.length).toBeGreaterThan(0);
      expect(sections.length).toBeGreaterThan(0);
      expect(subjects.length).toBeGreaterThan(0);
    });
  });
});
