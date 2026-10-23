// TypeScript Database Models matching 20 PostgreSQL Tables

export type UserRole = 'admin' | 'teacher' | 'student';

export interface Profile {
  id: string; // references auth.users(id)
  role: UserRole;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicSession {
  id: string;
  name: string; // e.g. "2025-2026"
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface ClassLevel {
  id: string;
  name: string; // e.g. "Class 9"
  numeric_order: number;
  description?: string;
  created_at: string;
}

export interface Section {
  id: string;
  class_id: string;
  name: string; // e.g. "A", "B"
  capacity: number;
  room_no?: string;
  created_at: string;
  // joined fields
  class?: ClassLevel;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  class_id?: string;
  is_elective: boolean;
  credit_hours: number;
  created_at: string;
  // joined fields
  class?: ClassLevel;
}

export interface Teacher {
  id: string;
  profile_id?: string;
  employee_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  qualification: string;
  joining_date: string;
  designation: string;
  is_active: boolean;
  created_at: string;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  academic_session_id: string;
  section_id: string;
  subject_id: string;
  is_class_teacher: boolean;
  created_at: string;
  // joined fields
  teacher?: Teacher;
  section?: Section;
  subject?: Subject;
  academic_session?: AcademicSession;
}

export interface Student {
  id: string;
  profile_id?: string;
  email?: string;
  admission_no: string;
  full_name: string;
  date_of_birth: string;
  gender: 'Male' | 'Female' | 'Other';
  b_form_or_cnic?: string;
  admission_date: string;
  guardian_name: string;
  guardian_relation: string;
  guardian_cnic?: string;
  guardian_phone: string;
  emergency_contact?: string;
  address: string;
  photo_url?: string;
  blood_group?: string;
  is_active: boolean;
  archived_at?: string;
  archive_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  academic_session_id: string;
  section_id: string;
  roll_no: number;
  enrollment_date: string;
  status: 'active' | 'promoted' | 'transferred' | 'graduated' | 'withdrawn';
  created_at: string;
  // joined fields
  student?: Student;
  academic_session?: AcademicSession;
  section?: Section & { class?: ClassLevel };
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

export interface AttendanceRecord {
  id: string;
  enrollment_id: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
  marked_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  // joined
  enrollment?: Enrollment;
}

export interface FeeStructure {
  id: string;
  academic_session_id: string;
  class_id: string;
  name: string;
  monthly_tuition: number;
  admission_fee: number;
  exam_fee: number;
  lab_library_fee: number;
  other_charges: number;
  created_at: string;
  // joined
  class?: ClassLevel;
  academic_session?: AcademicSession;
}

export type InvoiceStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';

export interface FeeInvoice {
  id: string;
  invoice_no: string;
  enrollment_id: string;
  academic_session_id: string;
  billing_month: string; // YYYY-MM
  issue_date: string;
  due_date: string;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
  // joined
  enrollment?: Enrollment;
  items?: FeeInvoiceItem[];
  payments?: FeePayment[];
}

export interface FeeInvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online/Slip' | 'EasyPaisa/JazzCash';

export interface FeePayment {
  id: string;
  receipt_no: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_no?: string;
  recorded_by?: string;
  idempotency_key?: string;
  is_reversed: boolean;
  created_at: string;
  // joined
  invoice?: FeeInvoice;
}

export interface FeePaymentReversal {
  id: string;
  payment_id: string;
  reversal_date: string;
  amount: number;
  reason: string;
  reversed_by: string;
  created_at: string;
}

export type ExamStatus = 'Draft' | 'Under Review' | 'Published';

export interface Exam {
  id: string;
  academic_session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: ExamStatus;
  created_at: string;
  academic_session?: AcademicSession;
}

export interface ExamSubject {
  id: string;
  exam_id: string;
  class_id: string;
  subject_id: string;
  max_marks: number;
  passing_marks: number;
  exam_date?: string;
  created_at: string;
  // joined
  exam?: Exam;
  class?: ClassLevel;
  subject?: Subject;
}

export interface Mark {
  id: string;
  exam_subject_id: string;
  enrollment_id: string;
  marks_obtained?: number;
  is_absent: boolean;
  remarks?: string;
  entered_by?: string;
  created_at: string;
  updated_at: string;
  // joined
  exam_subject?: ExamSubject;
  enrollment?: Enrollment;
}

export interface GradeRule {
  grade: string;
  min_percentage: number;
  max_percentage: number;
  gpa: number;
  remarks: string;
}

export interface SchoolSettings {
  id: string;
  school_name: string;
  registration_number?: string;
  affiliation?: string;
  phone?: string;
  email?: string;
  address?: string;
  principal_name?: string;
  logo_url?: string;
  currency_symbol: string;
  bank_name?: string;
  bank_account_no?: string;
  current_session_id?: string;
  grading_rules: GradeRule[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

// -------------------------------------------------------------
// QUIZZES & CLASSROOM ASSESSMENTS
// -------------------------------------------------------------
export interface Quiz {
  id: string;
  academic_session_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  title: string;
  assessment_date: string;
  max_marks: number;
  instructions?: string;
  status?: 'draft' | 'published';
  created_by?: string;
  created_at: string;
  // joined
  class?: ClassLevel;
  section?: Section;
  subject?: Subject;
  academic_session?: AcademicSession;
}

export interface QuizMark {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  marks_obtained?: number;
  is_absent: boolean;
  remarks?: string;
  created_at: string;
  updated_at: string;
  // joined
  quiz?: Quiz;
  enrollment?: Enrollment;
}

// -------------------------------------------------------------
// SUBJECT-WISE DAILY DIARY
// -------------------------------------------------------------
export type DiaryStatus = 'draft' | 'published';

export interface DailyDiary {
  id: string;
  academic_session_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  diary_date: string; // YYYY-MM-DD
  lesson_topics: string;
  homework: string;
  homework_details?: string;
  homework_due_date?: string;
  instructions?: string;
  upcoming_test_info?: string;
  instructions_or_test_alerts?: string;
  private_teacher_notes?: string;
  status: DiaryStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // joined
  class?: ClassLevel;
  section?: Section;
  subject?: Subject;
  teacher?: Teacher;
  academic_session?: AcademicSession;
}

export interface StudentSearchResult {
  student: Student;
  enrollment?: Enrollment;
}

export interface StudentAcademicSummary {
  student: Student;
  enrollment?: Enrollment;
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    percentage: number;
    history: AttendanceRecord[];
  };
  exams: {
    exam_id: string;
    exam_name: string;
    subject_id: string;
    subject_name: string;
    marks_obtained?: number;
    max_marks: number;
    percentage?: number;
    grade: string;
    is_absent: boolean;
    remarks?: string;
    exam_date?: string;
  }[];
  quizzes: {
    quiz_id: string;
    title: string;
    subject_name: string;
    assessment_date: string;
    marks_obtained?: number;
    max_marks: number;
    percentage?: number;
    is_absent: boolean;
    remarks?: string;
  }[];
  fees: {
    total_invoiced: number;
    total_paid: number;
    outstanding_balance: number;
    status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
    invoices: FeeInvoice[];
  } | null;
  performanceTrend: {
    date: string;
    title: string;
    subject: string;
    type: 'Quiz' | 'Exam';
    percentage: number;
  }[];
  diaryEntries?: DailyDiary[];
}
