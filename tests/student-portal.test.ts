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

    it('defines dedicated STUDENT_NAV_ITEMS with scoped portal items', () => {
      expect(Array.isArray(STUDENT_NAV_ITEMS)).toBe(true);
      expect(STUDENT_NAV_ITEMS.length).toBe(7);

      const paths = STUDENT_NAV_ITEMS.map((item) => item.path);
      expect(paths).toContain('/student-dashboard');
      expect(paths).toContain('/my-fees');
      expect(paths).toContain('/my-fee-challans');
      expect(paths).toContain('/my-dues');
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

  describe('7. Student Fee Management, Challans & Dues Verification', () => {
    const adminActor = { id: 'admin-id-1', name: 'Principal Admin', role: 'admin' };

    it('verifies migration 008 defines student fee RLS policies for invoices, items, and payments', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/008_student_fee_portal_rls.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      expect(sql).toContain('Students can view own fee invoices');
      expect(sql).toContain('Students can view own fee invoice items');
      expect(sql).toContain('Students can view own fee payments');
      expect(sql).toContain('idx_fee_invoices_enrollment_id');
      expect(sql).toContain('idx_fee_payments_invoice_id');
    });

    it('retrieves student fee ledger, balances, and payment history correctly', async () => {
      const students = await studentApi.getStudents();
      const firstStudent = students[0];

      const { profile } = await studentApi.provisionStudentAccount(
        firstStudent.id,
        'fee.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const feeData = await studentPortalApi.getMyFees(profile.id);
      expect(feeData.student.id).toBe(firstStudent.id);
      expect(feeData.invoices.length).toBeGreaterThan(0);
      expect(feeData.summary.totalAssigned).toBeGreaterThan(0);
      expect(feeData.summary.totalPaid).toBeGreaterThanOrEqual(0);
      expect(feeData.summary.remainingBalance).toBe(
        Math.max(0, feeData.summary.totalAssigned - feeData.summary.totalPaid)
      );

      // Verify invoice particulars breakdown is populated
      const firstInv = feeData.invoices[0];
      expect(firstInv.invoice_no).toBeDefined();
      expect(firstInv.billing_month).toBeDefined();
      expect(firstInv.items).toBeDefined();
      expect(firstInv.items!.length).toBeGreaterThan(0);
    });

    it('enforces strict student-to-student fee isolation (Student A cannot see Student B fees)', async () => {
      const students = await studentApi.getStudents();
      const studentA = students[0];
      const studentB = students[1];

      const { profile: profileA } = await studentApi.provisionStudentAccount(
        studentA.id,
        'student.a@test.edu.pk',
        'Pass123!',
        adminActor
      );
      const { profile: profileB } = await studentApi.provisionStudentAccount(
        studentB.id,
        'student.b@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const feesA = await studentPortalApi.getMyFees(profileA.id);
      const feesB = await studentPortalApi.getMyFees(profileB.id);

      // Verify invoice sets are completely disjoint
      const invoiceIdsA = new Set(feesA.invoices.map((i) => i.id));
      const invoiceIdsB = new Set(feesB.invoices.map((i) => i.id));

      for (const idA of invoiceIdsA) {
        expect(invoiceIdsB.has(idA)).toBe(false);
      }

      for (const idB of invoiceIdsB) {
        expect(invoiceIdsA.has(idB)).toBe(false);
      }
    });

    it('retrieves printable fee challans for student with student and class details', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      const { profile } = await studentApi.provisionStudentAccount(
        student.id,
        'challan.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const challans = await studentPortalApi.getMyFeeChallans(profile.id);
      expect(challans.length).toBeGreaterThan(0);
      const challan = challans[0];

      expect(challan.invoice_no).toBeDefined();
      expect(challan.due_date).toBeDefined();
      expect(challan.net_amount).toBeGreaterThan(0);
      expect(challan.enrollment?.student?.full_name).toBe(student.full_name);
    });

    it('accurately calculates outstanding dues, overdue flags, and late surcharges', async () => {
      const students = await studentApi.getStudents();
      // Student 2 has partially paid / overdue invoices in mock data
      const student2 = students[1];

      const { profile } = await studentApi.provisionStudentAccount(
        student2.id,
        'dues.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const dues = await studentPortalApi.getMyDues(profile.id);
      expect(dues.student.id).toBe(student2.id);

      if (dues.dueInvoices.length > 0) {
        expect(dues.outstandingBase).toBeGreaterThan(0);
        expect(dues.unpaidMonths.length).toBeGreaterThan(0);
        expect(dues.totalPayableNow).toBe(dues.outstandingBase + dues.totalLateFines);

        const firstDue = dues.dueInvoices[0];
        expect(firstDue.remainingBalance).toBe(firstDue.net_amount - firstDue.paid_amount);
        expect(firstDue.totalPayable).toBe(firstDue.remainingBalance + firstDue.lateFine);
      }
    });

    it('reflects admin-recorded payments dynamically in student balances and dues', async () => {
      const students = await studentApi.getStudents();
      const student2 = students[1];

      const { profile } = await studentApi.provisionStudentAccount(
        student2.id,
        'payment.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const initialFees = await studentPortalApi.getMyFees(profile.id);
      const pendingInvoice = initialFees.invoices.find((i) => i.status !== 'Paid');
      expect(pendingInvoice).toBeDefined();

      const remainingBefore = Number(pendingInvoice!.net_amount) - Number(pendingInvoice!.paid_amount);
      expect(remainingBefore).toBeGreaterThan(0);

      const paymentAmount = Math.min(1000, remainingBefore);

      // Admin records verified payment
      await feeApi.recordPayment(
        pendingInvoice!.id,
        paymentAmount,
        'Bank Transfer',
        'TEST-SLIP-999',
        undefined,
        adminActor
      );

      // Re-query student fees
      const updatedFees = await studentPortalApi.getMyFees(profile.id);
      expect(updatedFees.summary.totalPaid).toBe(initialFees.summary.totalPaid + paymentAmount);
      expect(updatedFees.summary.remainingBalance).toBe(initialFees.summary.remainingBalance - paymentAmount);

      // Verify payment appears in verified payment transactions
      const recorded = updatedFees.payments.find((p) => p.reference_no === 'TEST-SLIP-999');
      expect(recorded).toBeDefined();
      expect(recorded?.amount).toBe(paymentAmount);
    });
  });

  describe('9. Migration 009 & Profile Security Restrictions', () => {
    const adminActor = { id: 'admin-id-1', name: 'Principal Admin', role: 'admin' };

    it('verifies migration 009 exists with avatar storage policies, RLS, and tamper protection trigger', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/009_student_avatar_update_policy.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // Storage bucket creation
      expect(sqlContent).toContain("INSERT INTO storage.buckets (id, name, public)");
      expect(sqlContent).toContain("'student-avatars'");

      // Storage policies
      expect(sqlContent).toContain('Public can view student avatars');
      expect(sqlContent).toContain('Authenticated users can upload student avatars');
      expect(sqlContent).toContain('Authenticated users can update student avatars');

      // Table RLS policy
      expect(sqlContent).toContain('Students can update own photo_url');
      expect(sqlContent).toContain('profile_id = auth.uid()');

      // Tamper-protection trigger & function
      expect(sqlContent).toContain('enforce_student_photo_only_update()');
      expect(sqlContent).toContain('trg_enforce_student_photo_only_update');
      expect(sqlContent).toContain('OLD.full_name IS DISTINCT FROM NEW.full_name');
      expect(sqlContent).toContain('OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth');
      expect(sqlContent).toContain('OLD.guardian_name IS DISTINCT FROM NEW.guardian_name');
      expect(sqlContent).toContain('OLD.guardian_phone IS DISTINCT FROM NEW.guardian_phone');
      expect(sqlContent).toContain('OLD.b_form_or_cnic IS DISTINCT FROM NEW.b_form_or_cnic');
      expect(sqlContent).toContain('Unauthorized: Students are only permitted to update their profile picture.');
    });

    it('allows student to upload and update their profile picture only', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      const { profile } = await studentApi.provisionStudentAccount(
        targetStudent.id,
        'avatar.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const studentActor = { id: profile.id, name: profile.full_name, role: 'student' };
      const newAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop';

      // Update avatar
      const updateResult = await studentPortalApi.updateMyAvatar(profile.id, newAvatarUrl, studentActor);
      expect(updateResult.photo_url).toBe(newAvatarUrl);

      // Verify profile reload reflects the updated photo_url
      const selfData = await studentPortalApi.getStudentSelf(profile.id);
      expect(selfData.student.photo_url).toBe(newAvatarUrl);
    });

    it('validates avatar file format and size limits', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      const { profile } = await studentApi.provisionStudentAccount(
        targetStudent.id,
        'validator.student@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const studentActor = { id: profile.id, name: profile.full_name, role: 'student' };

      // Invalid mime type
      const fakeDocFile = {
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
      } as any;

      await expect(
        studentPortalApi.updateMyAvatar(profile.id, fakeDocFile, studentActor)
      ).rejects.toThrow('Invalid file format');

      // Oversized file (> 5MB)
      const oversizedFile = {
        name: 'huge.jpg',
        type: 'image/jpeg',
        size: 6 * 1024 * 1024,
      } as any;

      await expect(
        studentPortalApi.updateMyAvatar(profile.id, oversizedFile, studentActor)
      ).rejects.toThrow('File size exceeds the 5MB limit');
    });

    it('prevents a student from updating another student avatar', async () => {
      const students = await studentApi.getStudents();
      const studentA = students[0];
      const studentB = students[1];

      const { profile: profileA } = await studentApi.provisionStudentAccount(
        studentA.id,
        'student.a.photo@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const { profile: profileB } = await studentApi.provisionStudentAccount(
        studentB.id,
        'student.b.photo@test.edu.pk',
        'Pass123!',
        adminActor
      );

      const actorA = { id: profileA.id, name: profileA.full_name, role: 'student' };

      // Student A tries to update Student B's avatar
      await expect(
        studentPortalApi.updateMyAvatar(profileB.id, 'https://example.com/hacker.jpg', actorA)
      ).rejects.toThrow('Unauthorized');
    });

    it('rejects student attempts to edit general student text/demographic fields', async () => {
      const students = await studentApi.getStudents();
      const target = students[0];

      const studentActor = { id: 'some-student-id', name: 'Zeeshan Khan', role: 'student' };

      // Attempting to alter name/guardian via studentApi.updateStudent must be rejected
      await expect(
        studentApi.updateStudent(target.id, { full_name: 'Hacked Name' }, studentActor)
      ).rejects.toThrow('Unauthorized: Only administrators are authorized to edit student records.');
    });

    it('verifies MyProfilePage.tsx completely removes the password change form and security card', () => {
      const profilePagePath = path.resolve(__dirname, '../src/pages/StudentPortal/MyProfilePage.tsx');
      expect(fs.existsSync(profilePagePath)).toBe(true);
      const content = fs.readFileSync(profilePagePath, 'utf8');

      // Must NOT contain the old security card or password form
      expect(content).not.toContain('Portal Account & Security');
      expect(content).not.toContain('Change Portal Password');
      expect(content).not.toContain('Update Password');
      expect(content).not.toContain('newPassword');
      expect(content).not.toContain('confirmPassword');
      expect(content).not.toContain('handleUpdatePassword');

      // Must contain read-only demographic fields
      expect(content).toContain('student.full_name');
      expect(content).toContain('student.admission_no');
      expect(content).toContain('student.gender');
      expect(content).toContain('student.date_of_birth');
      expect(content).toContain('student.blood_group');
      expect(content).toContain('student.b_form_or_cnic');
      expect(content).toContain('student.admission_date');
      expect(content).toContain('student.guardian_name');
      expect(content).toContain('student.guardian_phone');
      expect(content).toContain('student.address');

      // Must contain photo upload features
      expect(content).toContain('handleAvatarChange');
      expect(content).toContain('updateMyAvatar');
      expect(content).toContain('student.photo_url');
      expect(content).toContain('accept="image/jpeg,image/png,image/webp,image/gif"');
    });
  });
});
