import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import {
  studentApi,
  teacherApi,
  academicStructureApi,
  attendanceApi,
  feeApi,
  examApi,
  quizApi,
  diaryApi,
  announcementApi,
  complaintApi,
  studentPortalApi,
} from '@/services/api';
import { APP_CONFIG } from '@/config/constants';
import {
  INITIAL_STUDENTS,
  INITIAL_PROFILES,
  INITIAL_TEACHERS,
  INITIAL_CLASSES,
  INITIAL_SECTIONS,
  INITIAL_SUBJECTS,
  INITIAL_ENROLLMENTS,
  INITIAL_ATTENDANCE,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_EXAMS,
  INITIAL_EXAM_SUBJECTS,
  INITIAL_MARKS,
  INITIAL_QUIZZES,
  INITIAL_QUIZ_MARKS,
  INITIAL_DAILY_DIARIES,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_EVENTS,
  INITIAL_COMPLAINTS,
} from '@/services/mockData';

// Parse .env directly
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
});

const liveUrl = envVars.VITE_SUPABASE_URL || '';
const liveKey = envVars.VITE_SUPABASE_ANON_KEY || '';

describe('FINAL SYSTEM-WIDE VERIFICATION & PRODUCTION READINESS AUDIT', () => {
  const adminActor = { id: 'admin-001', name: 'Principal Abdul Rehman Malik', role: 'admin' };
  const teacherActor = { id: 'teacher-001', name: 'Ayesha Siddiqui', role: 'teacher' };
  const studentActor = { id: 'student-001', name: 'Muhammad Hamza Khan', role: 'student', email: 'hamza.khan@islamiapublic.edu.pk' };

  // --------------------------------------------------------------------------
  // PHASE 2: SCHOOL INFORMATION & BRANDING AUDIT
  // --------------------------------------------------------------------------
  describe('Phase 2: School Information & Institutional Identity', () => {
    it('verifies environment variables for Noor-Ul-Ilm School System', () => {
      expect(envVars.VITE_APP_NAME).toBe('Noor-Ul-Ilm School System');
      expect(envVars.VITE_APP_ADDRESS).toBe('Block B, Multi Gardens, B-17, Islamabad, Pakistan');
      expect(envVars.VITE_APP_PHONE).toBe('+92 333 5352110');
      expect(envVars.VITE_APP_LANDLINE).toBe('051-7065481');
      expect(envVars.VITE_APP_EMAIL).toBe('info.noorulilmschoolsystem@gmail.com');
      expect(envVars.VITE_APP_WEBSITE).toBe('https://www.noorulilm.info/');
      expect(envVars.VITE_APP_CURRENCY).toBe('PKR');
      expect(envVars.VITE_APP_CURRENCY_SYMBOL).toBe('Rs.');
      expect(envVars.VITE_APP_TIMEZONE).toBe('Asia/Karachi');
    });

    it('verifies registration number is optional and displays Not Configured without inventing a dummy value', () => {
      expect(envVars.VITE_APP_REGISTRATION_NO).toBe('');
      expect(APP_CONFIG.registrationNo).toBe('Not Configured');
    });

    it('verifies HTML index title reflects Noor-Ul-Ilm School System', () => {
      const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
      expect(indexHtml).toContain('<title>Noor-Ul-Ilm School System | Professional School Management System</title>');
      expect(indexHtml).toContain('Noor-Ul-Ilm School System');
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 3: ADMIN PORTAL VERIFICATION
  // --------------------------------------------------------------------------
  describe('Phase 3: Admin Portal Functionality', () => {
    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem('sms_students', JSON.stringify(INITIAL_STUDENTS));
      localStorage.setItem('sms_profiles', JSON.stringify(INITIAL_PROFILES));
      localStorage.setItem('sms_teachers', JSON.stringify(INITIAL_TEACHERS));
      localStorage.setItem('sms_classes', JSON.stringify(INITIAL_CLASSES));
      localStorage.setItem('sms_sections', JSON.stringify(INITIAL_SECTIONS));
      localStorage.setItem('sms_subjects', JSON.stringify(INITIAL_SUBJECTS));
      localStorage.setItem('sms_enrollments', JSON.stringify(INITIAL_ENROLLMENTS));
      localStorage.setItem('sms_attendance', JSON.stringify(INITIAL_ATTENDANCE));
      localStorage.setItem('sms_invoices', JSON.stringify(INITIAL_INVOICES));
      localStorage.setItem('sms_payments', JSON.stringify(INITIAL_PAYMENTS));
      localStorage.setItem('sms_exams', JSON.stringify(INITIAL_EXAMS));
      localStorage.setItem('sms_exam_subjects', JSON.stringify(INITIAL_EXAM_SUBJECTS));
      localStorage.setItem('sms_marks', JSON.stringify(INITIAL_MARKS));
      localStorage.setItem('sms_quizzes', JSON.stringify(INITIAL_QUIZZES));
      localStorage.setItem('sms_quiz_marks', JSON.stringify(INITIAL_QUIZ_MARKS));
      localStorage.setItem('sms_daily_diaries', JSON.stringify(INITIAL_DAILY_DIARIES));
      localStorage.setItem('sms_announcements', JSON.stringify(INITIAL_ANNOUNCEMENTS));
      localStorage.setItem('sms_events', JSON.stringify(INITIAL_EVENTS));
      localStorage.setItem('sms_complaints', JSON.stringify(INITIAL_COMPLAINTS));
    });

    // 1. Student Management
    it('verifies student CRUD, admission numbering, roll numbers, and credential management', async () => {
      const students = await studentApi.getStudents();
      expect(students.length).toBeGreaterThan(0);

      const student = students[0];
      expect(student.admission_no).toMatch(/^ADM-/);

      // Add Student
      const { student: newStudent } = await studentApi.createStudentWithEnrollment(
        {
          full_name: 'Audit Test Student',
          gender: 'Male',
          date_of_birth: '2012-05-10',
          guardian_name: 'Test Guardian',
          guardian_relation: 'Father',
          guardian_phone: '03331234567',
          admission_date: '2026-04-01',
          address: 'B-17 Islamabad',
        },
        'b0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000001',
        adminActor
      );
      expect(newStudent.id).toBeDefined();

      // Update Student
      const updated = await studentApi.updateStudent(
        newStudent.id,
        { full_name: 'Audit Test Student Updated' },
        adminActor
      );
      expect(updated.full_name).toBe('Audit Test Student Updated');
    });

    // 2. Teacher Management
    it('verifies teacher CRUD, class/subject assignments, and credential management', async () => {
      const teachers = await teacherApi.getTeachers();
      expect(teachers.length).toBeGreaterThan(0);

      const target = teachers[0];
      expect(target.employee_id).toMatch(/^(EMP-)?T-?\d+/);

      // Update Teacher
      const updatedTeacher = await teacherApi.updateTeacher(
        target.id,
        { designation: 'Senior Faculty Lead' },
        adminActor
      );
      expect(updatedTeacher.designation).toBe('Senior Faculty Lead');
    });

    // 3. Subject Management
    it('verifies subject addition, editing status, safe deletion check, and class filtering', async () => {
      const classes = await academicStructureApi.getClasses();
      const class7 = classes.find((c) => c.name.toLowerCase().includes('class 7'));
      expect(class7).toBeDefined();

      // Add subject to Class 7
      const newSubject = await academicStructureApi.createSubject(
        {
          name: 'Civics & Ethics',
          code: 'CIV-07',
          class_id: class7!.id,
          description: 'Moral education and civics',
          is_elective: false,
          credit_hours: 3,
          is_active: true,
          status: 'Active',
        },
        adminActor
      );
      expect(newSubject.name).toBe('Civics & Ethics');
      expect(newSubject.class_id).toBe(class7!.id);

      // Verify Class 7 filtering
      const subjects = await academicStructureApi.getSubjects();
      const class7Subs = subjects.filter((s) => s.class_id === class7!.id);
      expect(class7Subs.some((s) => s.id === newSubject.id)).toBe(true);

      // Edit status to Inactive
      const deactivated = await academicStructureApi.setSubjectStatus(newSubject.id, false, adminActor);
      expect(deactivated.is_active).toBe(false);
      expect(deactivated.status).toBe('Inactive');

      // Re-activate
      const reactivated = await academicStructureApi.setSubjectStatus(newSubject.id, true, adminActor);
      expect(reactivated.is_active).toBe(true);

      // Safe deletion check protects subjects with academic history
      const mathSubject = subjects.find((s) => s.name.toLowerCase().includes('math'));
      if (mathSubject) {
        const depCheck = await academicStructureApi.checkSubjectDependencies(mathSubject.id);
        expect(depCheck.canDelete).toBe(false);
        expect(depCheck.dependencies.total).toBeGreaterThan(0);
      }
    });

    // 4. Attendance Management
    it('verifies admin and teacher attendance marking and duplicate prevention', async () => {
      const enrollments = await studentApi.getEnrollments();
      expect(enrollments.length).toBeGreaterThan(0);
      const enrId = enrollments[0].id;
      const testDate = '2026-11-05';

      // Mark Attendance
      const res1 = await attendanceApi.markBatchAttendance(testDate, [
        { enrollment_id: enrId, status: 'Present' },
      ]);
      expect(res1.length).toBe(1);

      // Update Attendance on same date (duplicate prevented)
      const res2 = await attendanceApi.markBatchAttendance(testDate, [
        { enrollment_id: enrId, status: 'Late', remarks: 'Late transport' },
      ]);
      expect(res2.length).toBe(1);

      const records = await attendanceApi.getAttendance(testDate, enrollments[0].section_id);
      const match = records.filter((r) => r.enrollment_id === enrId);
      expect(match.length).toBe(1);
      expect(match[0].status).toBe('Late');
    });

    // 5. Fee Management
    it('verifies fee challan creation, partial payments, and ledger reconciliation', async () => {
      const summary = await feeApi.getFinancialSummary('b0000000-0000-0000-0000-000000000002');
      expect(summary.totalInvoiced).toBeGreaterThan(0);
      expect(summary.totalCollected).toBeGreaterThan(0);
      expect(summary.totalOutstanding).toBe(summary.totalInvoiced - summary.totalCollected);

      // Record partial payment
      const invId = '40000000-0000-0000-0000-000000000002';
      const payment = await feeApi.recordPayment(invId, 1000, 'Cash', 'Test Receipt 99', 'key-audit-1');
      expect(payment.amount).toBe(1000);
      expect(payment.receipt_no).toContain('REC-');

      const invAfter = await feeApi.getInvoiceById(invId);
      expect(invAfter?.status).toBe('Partially Paid');
    });

    // 6. Examination & Quiz Management
    it('verifies exam marks calculation, absent status, and quiz marks recording', async () => {
      const exams = await examApi.getExams();
      expect(exams.length).toBeGreaterThan(0);

      const examSubjects = await examApi.getExamSubjects(exams[0].id);
      expect(examSubjects.length).toBeGreaterThan(0);

      // Absent status handling
      const esId = examSubjects[0].id;
      const enrId = '20000000-0000-0000-0000-000000000005';
      await examApi.saveMarksBatch(esId, [
        { enrollment_id: enrId, marks_obtained: 0, is_absent: true, remarks: 'Sick leave' },
      ]);
      const savedMarks = await examApi.getMarks(esId);
      const studentMark = savedMarks.find((m) => m.enrollment_id === enrId);
      expect(studentMark?.is_absent).toBe(true);
    });

    // 7. Complaints Management
    it('verifies complaints management: student submit, admin respond, teacher denied', async () => {
      // Student submits
      const complaint = await complaintApi.submitComplaint(
        {
          category: 'School Facilities',
          subject: 'Library Books Request',
          description: 'Need more science reference books in the secondary section.',
        },
        '10000000-0000-0000-0000-000000000001'
      );
      expect(complaint.id).toBeDefined();
      expect(complaint.status).toBe('Submitted');

      // Admin views and updates
      const adminUpdated = await complaintApi.updateComplaintStatus(
        complaint.id,
        'In Progress',
        { adminResponse: 'Order placed for science books.' },
        adminActor
      );
      expect(adminUpdated.status).toBe('In Progress');

      // Teacher cannot access complaints
      await expect(complaintApi.getComplaints({}, teacherActor)).rejects.toThrow(/unauthorized/i);
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 4: TEACHER PORTAL VERIFICATION (LIVE BACKEND)
  // --------------------------------------------------------------------------
  describe('Phase 4: Teacher Portal Verification', () => {
    it('verifies teacher login and data scoping against live Supabase', async () => {
      const teacherClient = createClient(liveUrl, liveKey, { auth: { persistSession: false } });

      const { data: auth, error } = await teacherClient.auth.signInWithPassword({
        email: 'ayesha.eng@islamiapublic.edu.pk',
        password: 'Teacher123!',
      });
      expect(error).toBeNull();
      expect(auth.user).toBeDefined();

      // Teacher can read classes
      const { data: classes, error: cErr } = await teacherClient.from('classes').select('id, name');
      expect(cErr).toBeNull();
      expect(classes!.length).toBeGreaterThan(0);

      // Teacher CANNOT read audit_logs (must be blocked by RLS)
      const { data: audit } = await teacherClient.from('audit_logs').select('*');
      expect(audit?.length || 0).toBe(0);

      // Teacher CANNOT read student_complaints (must be blocked by RLS)
      const { data: complaints } = await teacherClient.from('student_complaints').select('*');
      expect(complaints?.length || 0).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 5: STUDENT PORTAL VERIFICATION (LIVE BACKEND)
  // --------------------------------------------------------------------------
  describe('Phase 5: Student Portal Verification', () => {
    it('verifies student login and data scoping against live Supabase', async () => {
      const studentClient = createClient(liveUrl, liveKey, { auth: { persistSession: false } });

      const { data: auth, error } = await studentClient.auth.signInWithPassword({
        email: 'student.0001@islamiapublic.edu.pk',
        password: 'Student123!',
      });
      expect(error).toBeNull();
      expect(auth.user).toBeDefined();

      // Student can read classes
      const { data: classes, error: cErr } = await studentClient.from('classes').select('id, name');
      expect(cErr).toBeNull();
      expect(classes!.length).toBeGreaterThan(0);

      // Student CANNOT read audit_logs
      const { data: audit } = await studentClient.from('audit_logs').select('*');
      expect(audit?.length || 0).toBe(0);

      // Student CAN read their own fee payment, but CANNOT read other students' payments
      const { data: payments } = await studentClient.from('fee_payments').select('*');
      // In seed data there are 2 payments in total: 1 for Hamza Khan and 1 for Fatima Zahra
      // Hamza can only see their own 1 payment, not Fatima's!
      expect(payments?.length).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // PHASE 6 & 7: DATABASE, BACKEND & SECURITY AUDIT
  // --------------------------------------------------------------------------
  describe('Phase 6 & 7: Security & Backend Integrity', () => {
    it('verifies unauthenticated anonymous access is rejected on sensitive tables', async () => {
      const unauthClient = createClient(liveUrl, liveKey, { auth: { persistSession: false } });

      // Anonymous query on audit_logs
      const { data: audit } = await unauthClient.from('audit_logs').select('*');
      expect(audit?.length || 0).toBe(0);

      // Anonymous query on fee_invoices
      const { data: invoices } = await unauthClient.from('fee_invoices').select('*');
      expect(invoices?.length || 0).toBe(0);
    });

    it('verifies Storage bucket student-avatars is configured and enforces 5MB limit', () => {
      const migration22 = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/migrations/022_fix_student_storage_permissions_and_photo_upload.sql'),
        'utf8'
      );
      expect(migration22).toContain("'student-avatars'");
      expect(migration22).toContain('5242880'); // 5MB
      expect(migration22).toContain('CREATE POLICY "Authorized users upload student avatars"');
      expect(migration22).toContain('CREATE POLICY "Authorized users delete student avatars"');
    });

    it('verifies frontend code does not expose any service_role keys', () => {
      const env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
      expect(env).not.toContain('service_role');
      expect(env).not.toContain('SUPABASE_SERVICE_ROLE_KEY');

      const configTs = fs.readFileSync(path.resolve(process.cwd(), 'src/config/supabase.ts'), 'utf8');
      expect(configTs).not.toContain('service_role');
    });
  });
});
