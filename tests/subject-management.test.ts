import { describe, it, expect, beforeEach } from 'vitest';
import { academicStructureApi } from '@/services/api';
import {
  INITIAL_CLASSES,
  INITIAL_SUBJECTS,
  INITIAL_ASSIGNMENTS,
  INITIAL_EXAM_SUBJECTS,
  INITIAL_MARKS,
  INITIAL_QUIZZES,
  INITIAL_QUIZ_MARKS,
  INITIAL_DAILY_DIARIES,
} from '@/services/mockData';

describe('Curriculum & Subject Management (Add, Edit, Safe Deletion, Dynamic Class Filter)', () => {
  const adminActor = { id: 'admin-001', name: 'System Admin', role: 'admin' };
  const teacherActor = { id: 'teacher-001', name: 'Faculty Member', role: 'teacher' };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sms_classes', JSON.stringify(INITIAL_CLASSES));
    localStorage.setItem('sms_subjects', JSON.stringify(INITIAL_SUBJECTS));
    localStorage.setItem('sms_assignments', JSON.stringify(INITIAL_ASSIGNMENTS));
    localStorage.setItem('sms_exam_subjects', JSON.stringify(INITIAL_EXAM_SUBJECTS));
    localStorage.setItem('sms_marks', JSON.stringify(INITIAL_MARKS));
    localStorage.setItem('sms_quizzes', JSON.stringify(INITIAL_QUIZZES));
    localStorage.setItem('sms_quiz_marks', JSON.stringify(INITIAL_QUIZ_MARKS));
    localStorage.setItem('sms_daily_diaries', JSON.stringify(INITIAL_DAILY_DIARIES));
  });

  describe('1. Add Subject', () => {
    it('allows Admin to add a new subject associated with Class 7', async () => {
      const classes = await academicStructureApi.getClasses();
      const class7 = classes.find((c) => c.name.toLowerCase().includes('class 7'));
      expect(class7).toBeDefined();

      const newSubj = await academicStructureApi.createSubject(
        {
          name: 'General Science',
          code: 'GSC-07',
          class_id: class7!.id,
          description: 'Middle school general science and experimental basics',
          is_elective: false,
          credit_hours: 5,
          is_active: true,
          status: 'Active',
        },
        adminActor
      );

      expect(newSubj.id).toBeTruthy();
      expect(newSubj.name).toBe('General Science');
      expect(newSubj.code).toBe('GSC-07');
      expect(newSubj.class_id).toBe(class7!.id);
      expect(newSubj.is_active).toBe(true);
      expect(newSubj.status).toBe('Active');
      expect(newSubj.description).toBe('Middle school general science and experimental basics');

      // Verify immediate persistence
      const allSubjects = await academicStructureApi.getSubjects();
      const found = allSubjects.find((s) => s.id === newSubj.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('General Science');
      expect(found?.class?.name).toBe(class7!.name);
    });

    it('auto-generates a subject code when code is omitted (optional code requirement)', async () => {
      const classes = await academicStructureApi.getClasses();
      const class7 = classes.find((c) => c.name.toLowerCase().includes('class 7'))!;

      const newSubj = await academicStructureApi.createSubject(
        {
          name: 'Art and Design',
          class_id: class7.id,
          is_elective: true,
          credit_hours: 3,
        },
        adminActor
      );

      expect(newSubj.code).toBeTruthy();
      expect(typeof newSubj.code).toBe('string');
      expect(newSubj.code!.length).toBeGreaterThan(0);
      expect(newSubj.is_active).toBe(true);
      expect(newSubj.status).toBe('Active');
    });

    it('prevents non-admin users from creating subjects', async () => {
      const classes = await academicStructureApi.getClasses();
      await expect(
        academicStructureApi.createSubject(
          {
            name: 'Unauthorized Subject',
            code: 'UNA-01',
            class_id: classes[0].id,
            is_elective: false,
            credit_hours: 4,
          },
          teacherActor
        )
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe('2. Dynamic Class Filter', () => {
    it('populates classes dynamically and correctly filters subjects by class', async () => {
      const classes = await academicStructureApi.getClasses();
      expect(classes.length).toBeGreaterThanOrEqual(5);

      const class7 = classes.find((c) => c.name.includes('Class 7'))!;
      const class9 = classes.find((c) => c.name.includes('Class 9'))!;

      // Class 7 initially has 0 subjects
      let allSubjects = await academicStructureApi.getSubjects();
      let class7Subjects = allSubjects.filter((s) => s.class_id === class7.id);
      expect(class7Subjects.length).toBe(0);

      // Add a subject for Class 7
      await academicStructureApi.createSubject(
        {
          name: 'Social Studies',
          code: 'SST-07',
          class_id: class7.id,
          is_elective: false,
          credit_hours: 4,
          is_active: true,
          status: 'Active',
        },
        adminActor
      );

      allSubjects = await academicStructureApi.getSubjects();

      // Filter by Class 7
      class7Subjects = allSubjects.filter((s) => s.class_id === class7.id);
      expect(class7Subjects.length).toBe(1);
      expect(class7Subjects[0].name).toBe('Social Studies');

      // Filter by Class 9
      const class9Subjects = allSubjects.filter((s) => s.class_id === class9.id);
      expect(class9Subjects.length).toBeGreaterThanOrEqual(8);
      expect(class9Subjects.some((s) => s.name === 'English Compulsory')).toBe(true);
      expect(class9Subjects.some((s) => s.name === 'Social Studies')).toBe(false);

      // "All Classes" shows both
      expect(allSubjects.length).toBe(class9Subjects.length + class7Subjects.length);
    });
  });

  describe('3. Edit Subject', () => {
    it('allows Admin to edit subject details and updates list immediately', async () => {
      const classes = await academicStructureApi.getClasses();
      const class6 = classes.find((c) => c.name.includes('Class 6'))!;
      const class7 = classes.find((c) => c.name.includes('Class 7'))!;

      // Create initial subject
      const created = await academicStructureApi.createSubject(
        {
          name: 'History',
          code: 'HST-06',
          class_id: class6.id,
          description: 'Ancient and medieval history',
          is_elective: false,
          credit_hours: 3,
          is_active: true,
          status: 'Active',
        },
        adminActor
      );

      // Edit name, code, class assignment, description, and status
      const updated = await academicStructureApi.updateSubject(
        created.id,
        {
          name: 'World & Subcontinent History',
          code: 'HST-07',
          class_id: class7.id,
          description: 'Updated comprehensive history curriculum for Class 7',
          credit_hours: 4,
          is_active: false,
          status: 'Inactive',
        },
        adminActor
      );

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('World & Subcontinent History');
      expect(updated.code).toBe('HST-07');
      expect(updated.class_id).toBe(class7.id);
      expect(updated.description).toBe('Updated comprehensive history curriculum for Class 7');
      expect(updated.credit_hours).toBe(4);
      expect(updated.is_active).toBe(false);
      expect(updated.status).toBe('Inactive');

      // Verify list reflects changes immediately
      const refreshedList = await academicStructureApi.getSubjects();
      const savedInList = refreshedList.find((s) => s.id === created.id);
      expect(savedInList?.name).toBe('World & Subcontinent History');
      expect(savedInList?.class_id).toBe(class7.id);
      expect(savedInList?.status).toBe('Inactive');
    });

    it('rejects subject edits from unauthorized users', async () => {
      const allSubjects = await academicStructureApi.getSubjects();
      const first = allSubjects[0];

      await expect(
        academicStructureApi.updateSubject(
          first.id,
          { name: 'Hacked Subject Name' },
          teacherActor
        )
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe('4. Safe Deletion & Dependency Blocking', () => {
    it('blocks deletion of subjects with linked academic records (exams, marks, quizzes, diaries, assignments)', async () => {
      // English Compulsory has active assignments, exam schedules, and marks in INITIAL_DATA
      const allSubjects = await academicStructureApi.getSubjects();
      const englishSubj = allSubjects.find((s) => s.name === 'English Compulsory')!;
      expect(englishSubj).toBeDefined();

      const dependencyCheck = await academicStructureApi.checkSubjectDependencies(englishSubj.id);
      expect(dependencyCheck.canDelete).toBe(false);
      expect(dependencyCheck.dependencies.total).toBeGreaterThan(0);
      expect(dependencyCheck.dependencies.examSubjects).toBeGreaterThan(0);
      expect(dependencyCheck.dependencies.teacherAssignments).toBeGreaterThan(0);
      expect(dependencyCheck.reason).toContain('Cannot permanently delete');

      // Attempting to delete must throw with reason
      await expect(
        academicStructureApi.deleteSubject(englishSubj.id, adminActor)
      ).rejects.toThrow(/Cannot permanently delete/i);

      // Verify subject is still in the database
      const listAfterAttempt = await academicStructureApi.getSubjects();
      expect(listAfterAttempt.some((s) => s.id === englishSubj.id)).toBe(true);
    });

    it('offers safe deactivation as an alternative when deletion is blocked', async () => {
      const allSubjects = await academicStructureApi.getSubjects();
      const mathSubj = allSubjects.find((s) => s.name === 'Mathematics Science')!;

      // Deactivate subject safely
      const deactivated = await academicStructureApi.setSubjectStatus(mathSubj.id, false, adminActor);
      expect(deactivated.is_active).toBe(false);
      expect(deactivated.status).toBe('Inactive');

      // Verify historical data remains intact
      const listAfter = await academicStructureApi.getSubjects();
      const storedMath = listAfter.find((s) => s.id === mathSubj.id);
      expect(storedMath?.status).toBe('Inactive');
      expect(storedMath?.is_active).toBe(false);
    });

    it('allows permanent deletion when subject has zero linked academic records', async () => {
      const classes = await academicStructureApi.getClasses();
      const class8 = classes.find((c) => c.name.includes('Class 8'))!;

      // Create an unlinked brand-new subject
      const freshSubj = await academicStructureApi.createSubject(
        {
          name: 'Robotics & AI',
          code: 'ROB-08',
          class_id: class8.id,
          is_elective: true,
          credit_hours: 2,
        },
        adminActor
      );

      const check = await academicStructureApi.checkSubjectDependencies(freshSubj.id);
      expect(check.canDelete).toBe(true);
      expect(check.dependencies.total).toBe(0);

      // Safe permanent deletion succeeds
      const result = await academicStructureApi.deleteSubject(freshSubj.id, adminActor);
      expect(result.success).toBe(true);

      const afterDeleteList = await academicStructureApi.getSubjects();
      expect(afterDeleteList.some((s) => s.id === freshSubj.id)).toBe(false);
    });
  });

  describe('5. Search and Combined Filters', () => {
    it('supports searching by name or code combined with class and status filters', async () => {
      const classes = await academicStructureApi.getClasses();
      const class9 = classes.find((c) => c.name.includes('Class 9'))!;

      const allSubjects = await academicStructureApi.getSubjects();

      // Combined: Class 9 + Active + Search "Physics"
      const physicsResults = allSubjects.filter((s) => {
        const matchesClass = s.class_id === class9.id;
        const matchesStatus = s.is_active !== false;
        const matchesSearch = s.name.toLowerCase().includes('physics') || (s.code?.toLowerCase().includes('physics') ?? false);
        return matchesClass && matchesStatus && matchesSearch;
      });

      expect(physicsResults.length).toBe(1);
      expect(physicsResults[0].code).toBe('PHY-09');

      // Search by subject code "URD-09"
      const codeResults = allSubjects.filter((s) => s.code?.toLowerCase().includes('urd-09'));
      expect(codeResults.length).toBe(1);
      expect(codeResults[0].name).toBe('Urdu Compulsory');
    });
  });
});
