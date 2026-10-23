-- ==============================================================================
-- FILE: 001_initial_schema.sql
-- ==============================================================================

-- ==============================================================================
-- 001_initial_schema.sql
-- Professional School Management System (PostgreSQL 15+ / Supabase)
-- 20 Normalized Core Tables with UUIDs, Indexes, and Integrity Constraints
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher')),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ACADEMIC SESSIONS
CREATE TABLE IF NOT EXISTS public.academic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE, -- e.g. '2025-2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_session_dates CHECK (end_date > start_date)
);

-- 3. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE, -- e.g. 'Class 9', 'Class 10'
    numeric_order INT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SECTIONS
CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name VARCHAR(20) NOT NULL, -- e.g. 'A', 'B', 'Rose'
    capacity INT NOT NULL DEFAULT 40 CHECK (capacity > 0),
    room_no VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_class_section UNIQUE (class_id, name)
);

-- 5. SUBJECTS
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- e.g. 'Mathematics', 'Urdu'
    code VARCHAR(20) NOT NULL UNIQUE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    is_elective BOOLEAN NOT NULL DEFAULT FALSE,
    credit_hours INT NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TEACHERS
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    qualification VARCHAR(100) NOT NULL,
    joining_date DATE NOT NULL,
    designation VARCHAR(50) NOT NULL DEFAULT 'Subject Teacher',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TEACHER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_teacher_assignment UNIQUE (teacher_id, academic_session_id, section_id, subject_id)
);

-- 8. STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_no VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    b_form_or_cnic VARCHAR(30),
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    guardian_name VARCHAR(100) NOT NULL,
    guardian_relation VARCHAR(50) NOT NULL DEFAULT 'Father',
    guardian_cnic VARCHAR(30),
    guardian_phone VARCHAR(20) NOT NULL,
    emergency_contact VARCHAR(20),
    address TEXT NOT NULL,
    photo_url TEXT,
    blood_group VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    archived_at TIMESTAMPTZ,
    archive_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ENROLLMENTS (Session-specific placement of a student in a class & section)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
    roll_no INT NOT NULL CHECK (roll_no > 0),
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'transferred', 'graduated', 'withdrawn')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_student_session UNIQUE (student_id, academic_session_id),
    CONSTRAINT uq_session_section_roll UNIQUE (academic_session_id, section_id, roll_no)
);

-- 10. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave')),
    remarks VARCHAR(255),
    marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment_date UNIQUE (enrollment_id, date)
);

-- 11. FEE STRUCTURES
CREATE TABLE IF NOT EXISTS public.fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    monthly_tuition NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (monthly_tuition >= 0),
    admission_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (admission_fee >= 0),
    exam_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (exam_fee >= 0),
    lab_library_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (lab_library_fee >= 0),
    other_charges NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (other_charges >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_class_fee UNIQUE (academic_session_id, class_id)
);

-- 12. FEE INVOICES
CREATE TABLE IF NOT EXISTS public.fee_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
    billing_month VARCHAR(20) NOT NULL, -- Format 'YYYY-MM', e.g. '2026-10'
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0 AND paid_amount <= net_amount),
    status VARCHAR(20) NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled')),
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment_month UNIQUE (enrollment_id, billing_month),
    CONSTRAINT chk_net_amount CHECK (net_amount = (total_amount - discount_amount))
);

-- 13. FEE INVOICE ITEMS
CREATE TABLE IF NOT EXISTS public.fee_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.fee_invoices(id) ON DELETE CASCADE,
    description VARCHAR(150) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. FEE PAYMENTS
CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no VARCHAR(50) NOT NULL UNIQUE,
    invoice_id UUID NOT NULL REFERENCES public.fee_invoices(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Cheque', 'Online/Slip', 'EasyPaisa/JazzCash')),
    reference_no VARCHAR(100),
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(100) UNIQUE,
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. FEE PAYMENT REVERSALS
CREATE TABLE IF NOT EXISTS public.fee_payment_reversals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.fee_payments(id) ON DELETE RESTRICT,
    reversal_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    reversed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. EXAMINATIONS
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Under Review', 'Published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_exam_dates CHECK (end_date >= start_date)
);

-- 17. EXAM SUBJECTS
CREATE TABLE IF NOT EXISTS public.exam_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    max_marks NUMERIC(6,2) NOT NULL DEFAULT 100.00 CHECK (max_marks > 0),
    passing_marks NUMERIC(6,2) NOT NULL DEFAULT 33.00 CHECK (passing_marks >= 0 AND passing_marks <= max_marks),
    exam_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_exam_class_subject UNIQUE (exam_id, class_id, subject_id)
);

-- 18. MARKS
CREATE TABLE IF NOT EXISTS public.marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_subject_id UUID NOT NULL REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(6,2) CHECK (marks_obtained >= 0),
    is_absent BOOLEAN NOT NULL DEFAULT FALSE,
    remarks VARCHAR(255),
    entered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_exam_subject_enrollment UNIQUE (exam_subject_id, enrollment_id)
);

-- 19. SCHOOL SETTINGS
CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name VARCHAR(150) NOT NULL,
    registration_number VARCHAR(100),
    affiliation VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    principal_name VARCHAR(100),
    logo_url TEXT,
    currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rs.',
    current_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
    grading_rules JSONB NOT NULL DEFAULT '[
        {"grade": "A+", "min_percentage": 90, "max_percentage": 100, "gpa": 4.0, "remarks": "Outstanding"},
        {"grade": "A", "min_percentage": 80, "max_percentage": 89.99, "gpa": 3.7, "remarks": "Excellent"},
        {"grade": "B", "min_percentage": 70, "max_percentage": 79.99, "gpa": 3.0, "remarks": "Very Good"},
        {"grade": "C", "min_percentage": 60, "max_percentage": 69.99, "gpa": 2.5, "remarks": "Good"},
        {"grade": "D", "min_percentage": 50, "max_percentage": 59.99, "gpa": 2.0, "remarks": "Satisfactory"},
        {"grade": "E", "min_percentage": 33, "max_percentage": 49.99, "gpa": 1.0, "remarks": "Pass"},
        {"grade": "F", "min_percentage": 0, "max_percentage": 32.99, "gpa": 0.0, "remarks": "Fail"}
    ]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR HIGH QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_section ON public.enrollments(section_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_session ON public.enrollments(academic_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_enrollment ON public.attendance(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_enrollment ON public.fee_invoices(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_month ON public.fee_invoices(billing_month);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_status ON public.fee_invoices(status);
CREATE INDEX IF NOT EXISTS idx_fee_payments_invoice ON public.fee_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_date ON public.fee_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_marks_exam_subject ON public.marks(exam_subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_enrollment ON public.marks(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_section ON public.teacher_assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);


-- ==============================================================================
-- FILE: 002_rls_and_policies.sql
-- ==============================================================================

-- ==============================================================================
-- 002_rls_and_policies.sql
-- Row Level Security (RLS) & Granular Access Control Policies
-- Administrators: Full operational access to school records
-- Teachers: Strictly scoped to assigned sections, attendance & examination subjects
-- ==============================================================================

-- Enable RLS on all 20 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payment_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- HELPER FUNCTIONS FOR SECURITY CONTEXT
-- ==============================================================================

-- Check if current authenticated user has 'admin' role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current authenticated user has 'teacher' role
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher' AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retrieve teacher record ID for current authenticated user
CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS UUID AS $$
DECLARE
    t_id UUID;
BEGIN
    SELECT id INTO t_id FROM public.teachers WHERE profile_id = auth.uid() AND is_active = TRUE;
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current teacher is assigned to a specific section
CREATE OR REPLACE FUNCTION public.teacher_assigned_to_section(sec_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    curr_t_id UUID := public.get_current_teacher_id();
BEGIN
    IF curr_t_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.teacher_assignments
        WHERE teacher_id = curr_t_id AND section_id = sec_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current teacher is authorized to grade a specific exam_subject
CREATE OR REPLACE FUNCTION public.teacher_authorized_for_exam_subject(ex_subj_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    curr_t_id UUID := public.get_current_teacher_id();
    v_class_id UUID;
    v_subject_id UUID;
BEGIN
    IF curr_t_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT class_id, subject_id INTO v_class_id, v_subject_id
    FROM public.exam_subjects
    WHERE id = ex_subj_id;

    RETURN EXISTS (
        SELECT 1 FROM public.teacher_assignments ta
        JOIN public.sections s ON ta.section_id = s.id
        WHERE ta.teacher_id = curr_t_id
          AND s.class_id = v_class_id
          AND ta.subject_id = v_subject_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- 1. PROFILES
CREATE POLICY "Admin full access on profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can read their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 2. ACADEMIC SESSIONS, CLASSES, SECTIONS, SUBJECTS
-- Admins: Full control. Teachers: Read-only.
CREATE POLICY "Admin full access on academic_sessions" ON public.academic_sessions FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teacher read academic_sessions" ON public.academic_sessions FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "Admin full access on classes" ON public.classes FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teacher read classes" ON public.classes FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "Admin full access on sections" ON public.sections FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teacher read sections" ON public.sections FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "Admin full access on subjects" ON public.subjects FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teacher read subjects" ON public.subjects FOR SELECT TO authenticated USING (public.is_teacher());

-- 3. TEACHERS & TEACHER ASSIGNMENTS
CREATE POLICY "Admin full access on teachers" ON public.teachers FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers can view active teachers" ON public.teachers FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "Admin full access on teacher_assignments" ON public.teacher_assignments FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers can view their own assignments" ON public.teacher_assignments FOR SELECT TO authenticated 
USING (public.is_teacher() AND teacher_id = public.get_current_teacher_id());

-- 4. STUDENTS & ENROLLMENTS
CREATE POLICY "Admin full access on students" ON public.students FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers view active students in their assigned sections" ON public.students FOR SELECT TO authenticated
USING (
    public.is_teacher() AND EXISTS (
        SELECT 1 FROM public.enrollments e
        JOIN public.teacher_assignments ta ON ta.section_id = e.section_id
        WHERE e.student_id = students.id
          AND ta.teacher_id = public.get_current_teacher_id()
    )
);

CREATE POLICY "Admin full access on enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers view enrollments for assigned sections" ON public.enrollments FOR SELECT TO authenticated
USING (
    public.is_teacher() AND public.teacher_assigned_to_section(section_id)
);

-- 5. ATTENDANCE
CREATE POLICY "Admin full access on attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers view attendance for assigned sections" ON public.attendance FOR SELECT TO authenticated
USING (
    public.is_teacher() AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = attendance.enrollment_id AND public.teacher_assigned_to_section(e.section_id)
    )
);
CREATE POLICY "Teachers insert attendance for assigned sections" ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
    public.is_teacher() AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = attendance.enrollment_id AND public.teacher_assigned_to_section(e.section_id)
    )
);
CREATE POLICY "Teachers update attendance for assigned sections" ON public.attendance FOR UPDATE TO authenticated
USING (
    public.is_teacher() AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = attendance.enrollment_id AND public.teacher_assigned_to_section(e.section_id)
    )
)
WITH CHECK (
    public.is_teacher() AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = attendance.enrollment_id AND public.teacher_assigned_to_section(e.section_id)
    )
);

-- 6. FEES & FINANCIAL TRANSACTIONS (Strictly Admin only)
CREATE POLICY "Admin full access on fee_structures" ON public.fee_structures FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access on fee_invoices" ON public.fee_invoices FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access on fee_invoice_items" ON public.fee_invoice_items FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access on fee_payments" ON public.fee_payments FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access on fee_payment_reversals" ON public.fee_payment_reversals FOR ALL TO authenticated USING (public.is_admin());

-- 7. EXAMS & EXAM SUBJECTS
CREATE POLICY "Admin full access on exams" ON public.exams FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers can view exams" ON public.exams FOR SELECT TO authenticated USING (public.is_teacher());

CREATE POLICY "Admin full access on exam_subjects" ON public.exam_subjects FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers can view exam_subjects" ON public.exam_subjects FOR SELECT TO authenticated USING (public.is_teacher());

-- 8. MARKS
CREATE POLICY "Admin full access on marks" ON public.marks FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers can view marks for authorized exam subjects" ON public.marks FOR SELECT TO authenticated
USING (
    public.is_teacher() AND public.teacher_authorized_for_exam_subject(exam_subject_id)
);
CREATE POLICY "Teachers can insert marks for authorized exam subjects" ON public.marks FOR INSERT TO authenticated
WITH CHECK (
    public.is_teacher() AND public.teacher_authorized_for_exam_subject(exam_subject_id)
);
CREATE POLICY "Teachers can update marks for authorized exam subjects" ON public.marks FOR UPDATE TO authenticated
USING (
    public.is_teacher() AND public.teacher_authorized_for_exam_subject(exam_subject_id)
)
WITH CHECK (
    public.is_teacher() AND public.teacher_authorized_for_exam_subject(exam_subject_id)
);

-- 9. SCHOOL SETTINGS
CREATE POLICY "Admin full access on school_settings" ON public.school_settings FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Teachers can view school_settings" ON public.school_settings FOR SELECT TO authenticated USING (public.is_teacher());

-- 10. AUDIT LOGS (Immutable: No UPDATE or DELETE permitted)
CREATE POLICY "Admin view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (TRUE);
-- Deny update and delete for all users on audit_logs
CREATE POLICY "Deny update on audit logs" ON public.audit_logs FOR UPDATE TO authenticated USING (FALSE);
CREATE POLICY "Deny delete on audit logs" ON public.audit_logs FOR DELETE TO authenticated USING (FALSE);


-- ==============================================================================
-- FILE: 003_functions_and_triggers.sql
-- ==============================================================================

-- ==============================================================================
-- 003_functions_and_triggers.sql
-- Atomic Transactions, Sequential ID Generators, Financial Idempotency, and Audit Triggers
-- ==============================================================================

-- 1. ADMISSION NUMBER GENERATOR (ADM-YYYY-XXXX)
CREATE OR REPLACE FUNCTION public.fn_generate_admission_no()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_seq INT;
    v_new_adm VARCHAR;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(admission_no FROM 10)::INT), 0) + 1
    INTO v_seq
    FROM public.students
    WHERE admission_no LIKE 'ADM-' || v_year || '-%';

    v_new_adm := 'ADM-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    RETURN v_new_adm;
END;
$$ LANGUAGE plpgsql;

-- 2. NEXT ROLL NUMBER IN SECTION GENERATOR
CREATE OR REPLACE FUNCTION public.fn_next_roll_no(p_session_id UUID, p_section_id UUID)
RETURNS INT AS $$
DECLARE
    v_next_roll INT;
BEGIN
    SELECT COALESCE(MAX(roll_no), 0) + 1
    INTO v_next_roll
    FROM public.enrollments
    WHERE academic_session_id = p_session_id AND section_id = p_section_id;

    RETURN v_next_roll;
END;
$$ LANGUAGE plpgsql;

-- 3. INVOICE NUMBER GENERATOR (INV-YYYYMM-XXXX)
CREATE OR REPLACE FUNCTION public.fn_generate_invoice_no()
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-';
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM 12)::INT), 0) + 1
    INTO v_seq
    FROM public.fee_invoices
    WHERE invoice_no LIKE v_prefix || '%';

    RETURN v_prefix || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. RECEIPT NUMBER GENERATOR (REC-YYYYMM-XXXX)
CREATE OR REPLACE FUNCTION public.fn_generate_receipt_no()
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR := 'REC-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-';
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(receipt_no FROM 12)::INT), 0) + 1
    INTO v_seq
    FROM public.fee_payments
    WHERE receipt_no LIKE v_prefix || '%';

    RETURN v_prefix || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. TRANSACTIONAL ATOMIC FEE PAYMENT PROCESSING (WITH IDEMPOTENCY)
CREATE OR REPLACE FUNCTION public.fn_process_fee_payment(
    p_invoice_id UUID,
    p_amount NUMERIC(12,2),
    p_payment_method VARCHAR,
    p_reference_no VARCHAR DEFAULT NULL,
    p_recorded_by UUID DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
    v_existing_payment RECORD;
    v_new_payment_id UUID;
    v_receipt_no VARCHAR;
    v_new_paid NUMERIC(12,2);
    v_new_status VARCHAR;
BEGIN
    -- 1. Check idempotency if key provided
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_payment
        FROM public.fee_payments
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'message', 'Payment already processed (idempotent)',
                'payment_id', v_existing_payment.id,
                'receipt_no', v_existing_payment.receipt_no,
                'amount', v_existing_payment.amount
            );
        END IF;
    END IF;

    -- 2. Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    -- 3. Lock invoice row for update
    SELECT * INTO v_invoice
    FROM public.fee_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice with ID % does not exist.', p_invoice_id;
    END IF;

    IF v_invoice.status = 'Cancelled' THEN
        RAISE EXCEPTION 'Cannot accept payments on a cancelled invoice.';
    END IF;

    -- Check overpayment
    IF (v_invoice.paid_amount + p_amount) > v_invoice.net_amount THEN
        RAISE EXCEPTION 'Payment of % exceeds remaining balance of %',
            p_amount, (v_invoice.net_amount - v_invoice.paid_amount);
    END IF;

    -- 4. Generate receipt number & insert payment record
    v_receipt_no := public.fn_generate_receipt_no();
    INSERT INTO public.fee_payments (
        receipt_no,
        invoice_id,
        payment_date,
        amount,
        payment_method,
        reference_no,
        recorded_by,
        idempotency_key
    ) VALUES (
        v_receipt_no,
        p_invoice_id,
        CURRENT_DATE,
        p_amount,
        p_payment_method,
        p_reference_no,
        p_recorded_by,
        p_idempotency_key
    )
    RETURNING id INTO v_new_payment_id;

    -- 5. Update invoice balance and status
    v_new_paid := v_invoice.paid_amount + p_amount;
    IF v_new_paid >= v_invoice.net_amount THEN
        v_new_status := 'Paid';
    ELSE
        v_new_status := 'Partially Paid';
    END IF;

    UPDATE public.fee_invoices
    SET paid_amount = v_new_paid,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- 6. Log in Audit Trail
    INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_recorded_by,
        'PAYMENT_RECORDED',
        'fee_payments',
        v_new_payment_id::TEXT,
        jsonb_build_object(
            'receipt_no', v_receipt_no,
            'invoice_id', p_invoice_id,
            'amount', p_amount,
            'payment_method', p_payment_method,
            'new_invoice_status', v_new_status,
            'new_paid_balance', v_new_paid
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', v_new_payment_id,
        'receipt_no', v_receipt_no,
        'amount', p_amount,
        'invoice_status', v_new_status,
        'remaining_balance', (v_invoice.net_amount - v_new_paid)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRANSACTIONAL PAYMENT REVERSAL / REFUND
CREATE OR REPLACE FUNCTION public.fn_reverse_fee_payment(
    p_payment_id UUID,
    p_reason TEXT,
    p_reversed_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
    v_new_paid NUMERIC(12,2);
    v_new_status VARCHAR;
BEGIN
    -- 1. Lock payment row
    SELECT * INTO v_payment
    FROM public.fee_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record % not found.', p_payment_id;
    END IF;

    IF v_payment.is_reversed THEN
        RAISE EXCEPTION 'This payment has already been reversed.';
    END IF;

    -- 2. Lock invoice row
    SELECT * INTO v_invoice
    FROM public.fee_invoices
    WHERE id = v_payment.invoice_id
    FOR UPDATE;

    -- 3. Mark payment as reversed
    UPDATE public.fee_payments
    SET is_reversed = TRUE
    WHERE id = p_payment_id;

    -- 4. Record reversal audit record
    INSERT INTO public.fee_payment_reversals (
        payment_id,
        amount,
        reason,
        reversed_by
    ) VALUES (
        p_payment_id,
        v_payment.amount,
        p_reason,
        p_reversed_by
    );

    -- 5. Restore invoice balance
    v_new_paid := GREATEST(0.00, v_invoice.paid_amount - v_payment.amount);
    IF v_new_paid = 0.00 THEN
        v_new_status := 'Unpaid';
    ELSE
        v_new_status := 'Partially Paid';
    END IF;

    UPDATE public.fee_invoices
    SET paid_amount = v_new_paid,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_payment.invoice_id;

    -- 6. Log audit event
    INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_reversed_by,
        'PAYMENT_REVERSED',
        'fee_payments',
        p_payment_id::TEXT,
        jsonb_build_object(
            'receipt_no', v_payment.receipt_no,
            'reversed_amount', v_payment.amount,
            'reason', p_reason,
            'invoice_id', v_payment.invoice_id,
            'new_invoice_status', v_new_status,
            'new_paid_balance', v_new_paid
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'receipt_no', v_payment.receipt_no,
        'reversed_amount', v_payment.amount,
        'new_invoice_status', v_new_status,
        'new_paid_balance', v_new_paid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- FILE: 004_seed_data.sql
-- ==============================================================================

-- ==============================================================================
-- 004_seed_data.sql
-- Comprehensive Synthetic Seed Data for a Pakistani School (300-1500 students)
-- ==============================================================================

-- 1. SCHOOL SETTINGS
INSERT INTO public.school_settings (
    id, school_name, registration_number, affiliation, phone, email, address, principal_name, currency_symbol
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Islamia Public High School',
    'SED-LHR-2018-9412',
    'Board of Intermediate and Secondary Education (BISE) Lahore',
    '+92 42 35881234',
    'admin@islamiapublic.edu.pk',
    'Plot 42-B, Model Town Link Road, Lahore, Punjab, Pakistan',
    'Prof. Abdul Rehman Malik (M.Sc., M.Ed)',
    'Rs.'
) ON CONFLICT (id) DO NOTHING;

-- 2. ACADEMIC SESSIONS
INSERT INTO public.academic_sessions (id, name, start_date, end_date, is_current) VALUES
('b0000000-0000-0000-0000-000000000001', '2024-2025', '2024-04-01', '2025-03-31', FALSE),
('b0000000-0000-0000-0000-000000000002', '2025-2026', '2025-04-01', '2026-03-31', TRUE)
ON CONFLICT (name) DO NOTHING;

UPDATE public.school_settings 
SET current_session_id = 'b0000000-0000-0000-0000-000000000002'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 3. CLASSES
INSERT INTO public.classes (id, name, numeric_order, description) VALUES
('c0000000-0000-0000-0000-000000000001', 'Class 6', 6, 'Middle School - Grade 6'),
('c0000000-0000-0000-0000-000000000002', 'Class 7', 7, 'Middle School - Grade 7'),
('c0000000-0000-0000-0000-000000000003', 'Class 8', 8, 'Middle School - Grade 8'),
('c0000000-0000-0000-0000-000000000004', 'Class 9', 9, 'Secondary School Certificate (Matric Part 1)'),
('c0000000-0000-0000-0000-000000000005', 'Class 10', 10, 'Secondary School Certificate (Matric Part 2)')
ON CONFLICT (name) DO NOTHING;

-- 4. SECTIONS
INSERT INTO public.sections (id, class_id, name, capacity, room_no) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'A', 40, 'Room 101'),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'B', 40, 'Room 102'),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'A', 40, 'Room 201'),
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005', 'B', 40, 'Room 202')
ON CONFLICT (class_id, name) DO NOTHING;

-- 5. SUBJECTS
INSERT INTO public.subjects (id, name, code, class_id, is_elective, credit_hours) VALUES
('e0000000-0000-0000-0000-000000000001', 'English Compulsory', 'ENG-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 6),
('e0000000-0000-0000-0000-000000000002', 'Urdu Compulsory', 'URD-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 6),
('e0000000-0000-0000-0000-000000000003', 'Islamiyat Compulsory', 'ISL-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 3),
('e0000000-0000-0000-0000-000000000004', 'Mathematics Science', 'MTH-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 6),
('e0000000-0000-0000-0000-000000000005', 'Physics Theory & Practical', 'PHY-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 5),
('e0000000-0000-0000-0000-000000000006', 'Chemistry', 'CHM-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 5),
('e0000000-0000-0000-0000-000000000007', 'Biology', 'BIO-09', 'c0000000-0000-0000-0000-000000000004', TRUE, 5),
('e0000000-0000-0000-0000-000000000008', 'Computer Science', 'CSC-09', 'c0000000-0000-0000-0000-000000000004', TRUE, 5)
ON CONFLICT (code) DO NOTHING;

-- 6. TEACHERS
INSERT INTO public.teachers (id, employee_id, full_name, phone, email, qualification, joining_date, designation) VALUES
('f0000000-0000-0000-0000-000000000001', 'T-101', 'Muhammad Tariq', '+92 300 4567891', 'tariq.math@islamiapublic.edu.pk', 'M.Sc. Mathematics, B.Ed', '2019-08-15', 'Senior Mathematics Master'),
('f0000000-0000-0000-0000-000000000002', 'T-102', 'Ayesha Siddiqui', '+92 301 7891234', 'ayesha.eng@islamiapublic.edu.pk', 'M.A. English Literature, B.Ed', '2020-09-01', 'Head of English Dept'),
('f0000000-0000-0000-0000-000000000003', 'T-103', 'Dr. Imran Qureshi', '+92 321 9876543', 'imran.phy@islamiapublic.edu.pk', 'M.Sc., Ph.D Physics', '2018-03-10', 'Senior Science Master'),
('f0000000-0000-0000-0000-000000000004', 'T-104', 'Bushra Noreen', '+92 333 1122334', 'bushra.urd@islamiapublic.edu.pk', 'M.A. Urdu, B.Ed', '2021-02-01', 'Senior Urdu Teacher'),
('f0000000-0000-0000-0000-000000000005', 'T-105', 'Asif Mehmood', '+92 345 5566778', 'asif.cs@islamiapublic.edu.pk', 'MS Computer Science', '2022-01-15', 'IT & Computer Instructor')
ON CONFLICT (employee_id) DO NOTHING;

-- 7. TEACHER ASSIGNMENTS
INSERT INTO public.teacher_assignments (id, teacher_id, academic_session_id, section_id, subject_id, is_class_teacher) VALUES
('fa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', TRUE),
('fa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', FALSE),
('fa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', FALSE),
('fa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000008', FALSE)
ON CONFLICT (teacher_id, academic_session_id, section_id, subject_id) DO NOTHING;

-- 8. STUDENTS (Synthetic Sample of Students)
INSERT INTO public.students (
    id, admission_no, full_name, date_of_birth, gender, b_form_or_cnic,
    admission_date, guardian_name, guardian_relation, guardian_cnic,
    guardian_phone, address, blood_group
) VALUES
('10000000-0000-0000-0000-000000000001', 'ADM-2025-0001', 'Muhammad Hamza Khan', '2010-05-14', 'Male', '35201-1234567-1', '2025-04-05', 'Javed Iqbal Khan', 'Father', '35201-9876543-1', '+92 300 1234567', 'House 14, Street 3, Gulberg III, Lahore', 'B+'),
('10000000-0000-0000-0000-000000000002', 'ADM-2025-0002', 'Fatima Zahra', '2010-09-20', 'Female', '35202-2345678-2', '2025-04-06', 'Tariq Mehmood', 'Father', '35202-8765432-1', '+92 321 2345678', 'Flat 4B, Eden Heights, Jail Road, Lahore', 'O+'),
('10000000-0000-0000-0000-000000000003', 'ADM-2025-0003', 'Ali Hassan Raza', '2010-03-11', 'Male', '35201-3456789-3', '2025-04-07', 'Syed Raza Abbas', 'Father', '35201-7654321-1', '+92 333 3456789', 'House 88, Block C, Faisal Town, Lahore', 'A+'),
('10000000-0000-0000-0000-000000000004', 'ADM-2025-0004', 'Zainab Bibi', '2010-11-28', 'Female', '35202-4567890-4', '2025-04-08', 'Rashid Minhas', 'Father', '35202-6543210-1', '+92 345 4567890', 'House 22, Shadman Colony, Lahore', 'AB+'),
('10000000-0000-0000-0000-000000000005', 'ADM-2025-0005', 'Bilal Ahmed Sheikh', '2010-07-04', 'Male', '35201-5678901-5', '2025-04-10', 'Sheikh Niaz Ahmed', 'Father', '35201-5432109-1', '+92 302 5678901', 'House 112, Sector B, DHA Phase 5, Lahore', 'O-')
ON CONFLICT (admission_no) DO NOTHING;

-- 9. ENROLLMENTS
INSERT INTO public.enrollments (id, student_id, academic_session_id, section_id, roll_no, enrollment_date, status) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 1, '2025-04-05', 'active'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 2, '2025-04-06', 'active'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 3, '2025-04-07', 'active'),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 4, '2025-04-08', 'active'),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 5, '2025-04-10', 'active')
ON CONFLICT (student_id, academic_session_id) DO NOTHING;

-- 10. FEE STRUCTURES
INSERT INTO public.fee_structures (
    id, academic_session_id, class_id, name, monthly_tuition, admission_fee, exam_fee, lab_library_fee, other_charges
) VALUES (
    '30000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000004',
    'Class 9 Science Fee Structure 2025-2026',
    4500.00,
    5000.00,
    1500.00,
    800.00,
    200.00
) ON CONFLICT (academic_session_id, class_id) DO NOTHING;

-- 11. INVOICES
INSERT INTO public.fee_invoices (
    id, invoice_no, enrollment_id, academic_session_id, billing_month, issue_date, due_date,
    total_amount, discount_amount, net_amount, paid_amount, status
) VALUES
('40000000-0000-0000-0000-000000000001', 'INV-202610-0001', '20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '2026-10', '2026-10-01', '2026-10-15', 5500.00, 500.00, 5000.00, 5000.00, 'Paid'),
('40000000-0000-0000-0000-000000000002', 'INV-202610-0002', '20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '2026-10', '2026-10-01', '2026-10-15', 5500.00, 0.00, 5500.00, 3000.00, 'Partially Paid'),
('40000000-0000-0000-0000-000000000003', 'INV-202610-0003', '20000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', '2026-10', '2026-10-01', '2026-10-15', 5500.00, 0.00, 5500.00, 0.00, 'Unpaid')
ON CONFLICT (invoice_no) DO NOTHING;

-- 12. PAYMENTS
INSERT INTO public.fee_payments (
    id, receipt_no, invoice_id, payment_date, amount, payment_method, reference_no
) VALUES
('50000000-0000-0000-0000-000000000001', 'REC-202610-0001', '40000000-0000-0000-0000-000000000001', '2026-10-08', 5000.00, 'Bank Transfer', 'HBL-FT-984128'),
('50000000-0000-0000-0000-000000000002', 'REC-202610-0002', '40000000-0000-0000-0000-000000000002', '2026-10-10', 3000.00, 'Cash', 'Counter Voucher #44')
ON CONFLICT (receipt_no) DO NOTHING;

-- 13. EXAMS
INSERT INTO public.exams (id, academic_session_id, name, start_date, end_date, status) VALUES
('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Mid-Term Examinations 2025-26', '2025-10-15', '2025-10-25', 'Published'),
('60000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Annual Final Examination 2026', '2026-03-01', '2026-03-15', 'Draft')
ON CONFLICT DO NOTHING;

-- 14. EXAM SUBJECTS
INSERT INTO public.exam_subjects (id, exam_id, class_id, subject_id, max_marks, passing_marks, exam_date) VALUES
('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 100.00, 33.00, '2025-10-16'),
('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 100.00, 33.00, '2025-10-18'),
('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000005', 75.00, 25.00, '2025-10-20')
ON CONFLICT (exam_id, class_id, subject_id) DO NOTHING;

-- 15. MARKS
INSERT INTO public.marks (id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks) VALUES
('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 94.00, FALSE, 'Outstanding performance'),
('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 88.50, FALSE, 'Excellent conceptual clarity'),
('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 72.00, FALSE, 'Good effort, needs algebra practice'),
('80000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 64.00, FALSE, 'Fair attempt'),
('80000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 0.00, TRUE, 'Medical leave on exam day')
ON CONFLICT (exam_subject_id, enrollment_id) DO NOTHING;


-- ==============================================================================
-- FILE: 005_quizzes_and_assessments.sql
-- ==============================================================================

-- ==============================================================================
-- 005_quizzes_and_assessments.sql
-- Classroom Continuous Assessments, Quizzes, and Marks Tracking
-- ==============================================================================

-- 1. QUIZZES (Continuous Classroom Assessments)
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    assessment_date DATE NOT NULL,
    max_marks NUMERIC(5,2) NOT NULL CHECK (max_marks > 0),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. QUIZ MARKS
CREATE TABLE IF NOT EXISTS public.quiz_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(5,2) CHECK (marks_obtained >= 0),
    is_absent BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quiz_enrollment UNIQUE (quiz_id, enrollment_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quizzes_section ON public.quizzes(section_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON public.quizzes(subject_id);
CREATE INDEX IF NOT EXISTS idx_quiz_marks_enrollment ON public.quiz_marks(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_marks_quiz ON public.quiz_marks(quiz_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_marks ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR QUIZZES
-- Administrator: Full Access
CREATE POLICY "Admin full access on quizzes"
    ON public.quizzes FOR ALL
    TO authenticated
    USING (public.is_admin());

-- Teacher: View quizzes for assigned sections
CREATE POLICY "Teachers can view quizzes for assigned sections"
    ON public.quizzes FOR SELECT
    TO authenticated
    USING (
        public.is_teacher() AND (
            section_id IN (
                SELECT ta.section_id 
                FROM public.teacher_assignments ta
                JOIN public.teachers t ON t.id = ta.teacher_id
                WHERE t.profile_id = auth.uid()
            )
        )
    );

-- Teacher: Insert quizzes for assigned sections and subjects
CREATE POLICY "Teachers can insert quizzes for assigned sections"
    ON public.quizzes FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_teacher() AND (
            section_id IN (
                SELECT ta.section_id 
                FROM public.teacher_assignments ta
                JOIN public.teachers t ON t.id = ta.teacher_id
                WHERE t.profile_id = auth.uid()
            )
        )
    );

-- Teacher: Update quizzes for assigned sections
CREATE POLICY "Teachers can update quizzes for assigned sections"
    ON public.quizzes FOR UPDATE
    TO authenticated
    USING (
        public.is_teacher() AND (
            section_id IN (
                SELECT ta.section_id 
                FROM public.teacher_assignments ta
                JOIN public.teachers t ON t.id = ta.teacher_id
                WHERE t.profile_id = auth.uid()
            )
        )
    );

-- 4. RLS POLICIES FOR QUIZ MARKS
-- Administrator: Full Access
CREATE POLICY "Admin full access on quiz_marks"
    ON public.quiz_marks FOR ALL
    TO authenticated
    USING (public.is_admin());

-- Teacher: View quiz marks for assigned sections
CREATE POLICY "Teachers can view quiz marks for assigned sections"
    ON public.quiz_marks FOR SELECT
    TO authenticated
    USING (
        public.is_teacher() AND (
            quiz_id IN (
                SELECT q.id FROM public.quizzes q
                WHERE q.section_id IN (
                    SELECT ta.section_id 
                    FROM public.teacher_assignments ta
                    JOIN public.teachers t ON t.id = ta.teacher_id
                    WHERE t.profile_id = auth.uid()
                )
            )
        )
    );

-- Teacher: Insert/Update marks for assigned sections
CREATE POLICY "Teachers can modify quiz marks for assigned sections"
    ON public.quiz_marks FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_teacher() AND (
            quiz_id IN (
                SELECT q.id FROM public.quizzes q
                WHERE q.section_id IN (
                    SELECT ta.section_id 
                    FROM public.teacher_assignments ta
                    JOIN public.teachers t ON t.id = ta.teacher_id
                    WHERE t.profile_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Teachers can update quiz marks for assigned sections"
    ON public.quiz_marks FOR UPDATE
    TO authenticated
    USING (
        public.is_teacher() AND (
            quiz_id IN (
                SELECT q.id FROM public.quizzes q
                WHERE q.section_id IN (
                    SELECT ta.section_id 
                    FROM public.teacher_assignments ta
                    JOIN public.teachers t ON t.id = ta.teacher_id
                    WHERE t.profile_id = auth.uid()
                )
            )
        )
    );


-- ==============================================================================
-- FILE: 006_daily_diary_and_student_portal_prep.sql
-- ==============================================================================

-- ==============================================================================
-- 006_daily_diary_and_student_portal_prep.sql
-- Subject-Wise Daily Diary, Quiz Enhancements, and Student Portal Readiness
-- ==============================================================================

-- 1. EXTEND QUIZZES (Add instructions column if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'quizzes' 
          AND column_name = 'instructions'
    ) THEN
        ALTER TABLE public.quizzes ADD COLUMN instructions TEXT;
    END IF;
END $$;

-- 2. SUBJECT-WISE DAILY DIARY TABLE
CREATE TABLE IF NOT EXISTS public.daily_diary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    diary_date DATE NOT NULL,
    lesson_topics TEXT NOT NULL,
    homework TEXT NOT NULL,
    instructions TEXT,
    upcoming_test_info TEXT,
    private_teacher_notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_diary_entry UNIQUE (section_id, subject_id, diary_date, academic_session_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_daily_diary_section_date ON public.daily_diary(section_id, diary_date);
CREATE INDEX IF NOT EXISTS idx_daily_diary_subject ON public.daily_diary(subject_id);
CREATE INDEX IF NOT EXISTS idx_daily_diary_teacher ON public.daily_diary(teacher_id);
CREATE INDEX IF NOT EXISTS idx_daily_diary_status ON public.daily_diary(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_diary ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR DAILY DIARY

-- A. Administrator: Full Access
CREATE POLICY "Admin full access on daily_diary"
    ON public.daily_diary FOR ALL
    TO authenticated
    USING (public.is_admin());

-- B. Teacher: Select diary entries for assigned sections and subjects
CREATE POLICY "Teachers can view assigned diary entries"
    ON public.daily_diary FOR SELECT
    TO authenticated
    USING (
        public.is_teacher() AND (
            section_id IN (
                SELECT ta.section_id 
                FROM public.teacher_assignments ta
                JOIN public.teachers t ON t.id = ta.teacher_id
                WHERE t.profile_id = auth.uid()
            )
        )
    );

-- C. Teacher: Insert diary entries only for assigned sections and subjects
CREATE POLICY "Teachers can insert assigned diary entries"
    ON public.daily_diary FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_teacher() AND (
            section_id IN (
                SELECT ta.section_id 
                FROM public.teacher_assignments ta
                JOIN public.teachers t ON t.id = ta.teacher_id
                WHERE t.profile_id = auth.uid() 
                  AND ta.subject_id = public.daily_diary.subject_id
            )
        )
    );

-- D. Teacher: Update diary entries only for assigned sections and subjects
CREATE POLICY "Teachers can update assigned diary entries"
    ON public.daily_diary FOR UPDATE
    TO authenticated
    USING (
        public.is_teacher() AND (
            section_id IN (
                SELECT ta.section_id 
                FROM public.teacher_assignments ta
                JOIN public.teachers t ON t.id = ta.teacher_id
                WHERE t.profile_id = auth.uid()
                  AND ta.subject_id = public.daily_diary.subject_id
            )
        )
    );

-- E. Teacher: Delete diary entries only for assigned sections and subjects
CREATE POLICY "Teachers can delete assigned diary entries"
    ON public.daily_diary FOR DELETE
    TO authenticated
    USING (
        public.is_teacher() AND (
            section_id IN (
                SELECT ta.section_id 
                FROM public.teacher_assignments ta
                JOIN public.teachers t ON t.id = ta.teacher_id
                WHERE t.profile_id = auth.uid()
                  AND ta.subject_id = public.daily_diary.subject_id
            )
        )
    );

-- 4. FUTURE STUDENT PORTAL ACCESS CONTROLS (PREPARATION)
-- When a student authenticates, their user profile is linked to their student enrollment record.
-- Students can ONLY view published diary entries for their active class section.
CREATE POLICY "Students can view published diary entries for enrolled section"
    ON public.daily_diary FOR SELECT
    TO authenticated
    USING (
        status = 'published' AND
        section_id IN (
            SELECT e.section_id 
            FROM public.enrollments e
            JOIN public.students s ON s.id = e.student_id
            WHERE s.id::text = auth.jwt() ->> 'student_id'
               OR s.admission_no = auth.jwt() ->> 'admission_no'
        )
    );

-- Students can ONLY view their own quiz marks for completed quizzes
CREATE POLICY "Students can view their own quiz marks"
    ON public.quiz_marks FOR SELECT
    TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id 
            FROM public.enrollments e
            JOIN public.students s ON s.id = e.student_id
            WHERE s.id::text = auth.jwt() ->> 'student_id'
               OR s.admission_no = auth.jwt() ->> 'admission_no'
        )
    );


-- ==============================================================================
-- FILE: 007_student_portal_and_identity.sql
-- ==============================================================================

-- ==============================================================================
-- 007_student_portal_and_identity.sql
-- Student Portal Identity, Quiz Publishing Lifecycle, and RLS Authorization
-- ==============================================================================

-- 1. UPDATE PROFILES ROLE CONSTRAINT SAFELY
-- Broadens the allowed roles to ('admin', 'teacher', 'student')
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('admin', 'teacher', 'student'));
END $$;

-- 2. LINK STUDENT RECORDS TO AUTHENTICATED USER PROFILES
-- Adds a nullable, unique profile_id foreign key and email column to public.students
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'students' 
          AND column_name = 'profile_id'
    ) THEN
        ALTER TABLE public.students 
            ADD COLUMN profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'students' 
          AND column_name = 'email'
    ) THEN
        ALTER TABLE public.students 
            ADD COLUMN email VARCHAR(100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_profile_id ON public.students(profile_id);

-- 3. ADD STATUS COLUMN TO QUIZZES FOR PUBLISHING LIFECYCLE
-- Defaults to 'published' so that all existing historical quizzes remain intact
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'quizzes' 
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.quizzes 
            ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'published' 
            CHECK (status IN ('draft', 'published'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quizzes_status ON public.quizzes(status);

-- 4. DATABASE ROW LEVEL SECURITY (RLS) FOR STUDENT PORTAL

-- A. Students can ONLY view their own student profile record
DROP POLICY IF EXISTS "Students can view own student record" ON public.students;
CREATE POLICY "Students can view own student record"
    ON public.students FOR SELECT
    TO authenticated
    USING (
        profile_id = auth.uid() OR public.is_admin() OR public.is_teacher()
    );

-- B. Students can ONLY view their own academic enrollment
DROP POLICY IF EXISTS "Students can view own enrollment" ON public.enrollments;
CREATE POLICY "Students can view own enrollment"
    ON public.enrollments FOR SELECT
    TO authenticated
    USING (
        student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
        OR public.is_admin() 
        OR public.is_teacher()
    );

-- C. Students can ONLY view published quizzes for their enrolled section
DROP POLICY IF EXISTS "Students can view published quizzes for their section" ON public.quizzes;
CREATE POLICY "Students can view published quizzes for their section"
    ON public.quizzes FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR (public.is_teacher() AND section_id IN (
            SELECT ta.section_id FROM public.teacher_assignments ta
            JOIN public.teachers t ON t.id = ta.teacher_id
            WHERE t.profile_id = auth.uid()
        ))
        OR (status = 'published' AND section_id IN (
            SELECT e.section_id FROM public.enrollments e
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        ))
    );

-- D. Students can ONLY view their own marks for published quizzes
DROP POLICY IF EXISTS "Students can view their own published quiz marks" ON public.quiz_marks;
CREATE POLICY "Students can view their own published quiz marks"
    ON public.quiz_marks FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR (public.is_teacher() AND quiz_id IN (
            SELECT q.id FROM public.quizzes q
            JOIN public.teacher_assignments ta ON ta.section_id = q.section_id AND ta.subject_id = q.subject_id
            JOIN public.teachers t ON t.id = ta.teacher_id
            WHERE t.profile_id = auth.uid()
        ))
        OR (
            enrollment_id IN (
                SELECT e.id FROM public.enrollments e
                JOIN public.students s ON s.id = e.student_id
                WHERE s.profile_id = auth.uid()
            )
            AND quiz_id IN (SELECT id FROM public.quizzes WHERE status = 'published')
        )
    );

-- E. Students can view published Daily Diary entries for their enrolled section
DROP POLICY IF EXISTS "Students can view published diary entries for enrolled section" ON public.daily_diary;
CREATE POLICY "Students can view published diary entries for enrolled section"
    ON public.daily_diary FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR (public.is_teacher() AND section_id IN (
            SELECT ta.section_id FROM public.teacher_assignments ta
            JOIN public.teachers t ON t.id = ta.teacher_id
            WHERE t.profile_id = auth.uid()
        ))
        OR (
            status = 'published' AND section_id IN (
                SELECT e.section_id FROM public.enrollments e
                JOIN public.students s ON s.id = e.student_id
                WHERE s.profile_id = auth.uid()
            )
        )
    );


-- ==============================================================================
-- FILE: 008_student_fee_portal_rls.sql
-- ==============================================================================

-- ==============================================================================
-- 008_student_fee_portal_rls.sql
-- Additive Row Level Security (RLS) policies for Student Fee Portal
-- Enforces that students can ONLY view their own fee invoices, invoice items, and payments
-- ==============================================================================

-- 1. STUDENT FEE INVOICES ACCESS POLICY
-- Enables students to SELECT only fee invoices assigned to their active enrollment(s)
DROP POLICY IF EXISTS "Students can view own fee invoices" ON public.fee_invoices;
CREATE POLICY "Students can view own fee invoices"
    ON public.fee_invoices FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        )
    );

-- 2. STUDENT FEE INVOICE ITEMS ACCESS POLICY
-- Enables students to SELECT particulars and itemized fee breakdowns for their own invoices
DROP POLICY IF EXISTS "Students can view own fee invoice items" ON public.fee_invoice_items;
CREATE POLICY "Students can view own fee invoice items"
    ON public.fee_invoice_items FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR invoice_id IN (
            SELECT fi.id FROM public.fee_invoices fi
            JOIN public.enrollments e ON e.id = fi.enrollment_id
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        )
    );

-- 3. STUDENT FEE PAYMENTS ACCESS POLICY
-- Enables students to SELECT recorded payment receipts for their own invoices
DROP POLICY IF EXISTS "Students can view own fee payments" ON public.fee_payments;
CREATE POLICY "Students can view own fee payments"
    ON public.fee_payments FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR invoice_id IN (
            SELECT fi.id FROM public.fee_invoices fi
            JOIN public.enrollments e ON e.id = fi.enrollment_id
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        )
    );

-- 4. PERFORMANCE & SCOPING INDEXES
CREATE INDEX IF NOT EXISTS idx_fee_invoices_enrollment_id ON public.fee_invoices(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_invoice_id ON public.fee_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoice_items_invoice_id ON public.fee_invoice_items(invoice_id);


-- ==============================================================================
-- FILE: 009_student_avatar_update_policy.sql
-- ==============================================================================

-- ==============================================================================
-- 009_student_avatar_update_policy.sql
-- Additive Migration: Restrict student profile modifications exclusively to photo_url
-- Enforces storage bucket policies and database-level trigger restrictions
-- ==============================================================================

-- 1. STORAGE BUCKET CONFIGURATION FOR STUDENT AVATARS
-- Ensures the 'student-avatars' storage bucket exists for profile photo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-avatars', 'student-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. STORAGE ROW LEVEL SECURITY (RLS) POLICIES
-- A. Public read access to student avatars
DROP POLICY IF EXISTS "Public can view student avatars" ON storage.objects;
CREATE POLICY "Public can view student avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'student-avatars');

-- B. Authenticated students can upload avatar images into student-avatars bucket
DROP POLICY IF EXISTS "Authenticated users can upload student avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload student avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'student-avatars'
        AND (
            (auth.jwt() ->> 'role') = 'student'
            OR public.is_admin()
        )
    );

-- C. Authenticated students can update or replace their avatars
DROP POLICY IF EXISTS "Authenticated users can update student avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update student avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'student-avatars'
        AND (
            (auth.jwt() ->> 'role') = 'student'
            OR public.is_admin()
        )
    );

-- 3. STUDENTS TABLE ROW LEVEL SECURITY (RLS) POLICY FOR SELF-UPDATE
-- Allows students to UPDATE only their own student record (profile_id = auth.uid())
DROP POLICY IF EXISTS "Students can update own photo_url" ON public.students;
CREATE POLICY "Students can update own photo_url"
    ON public.students FOR UPDATE
    TO authenticated
    USING (
        profile_id = auth.uid() OR public.is_admin()
    )
    WITH CHECK (
        profile_id = auth.uid() OR public.is_admin()
    );

-- 4. DATABASE TRIGGER: ENFORCE RESTRICTION THAT STUDENTS CAN ONLY UPDATE photo_url
-- Protects all identity, bio, academic, and guardian fields from tampering by students
CREATE OR REPLACE FUNCTION public.enforce_student_photo_only_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Direct database operations, migrations, and service_role (auth.uid() IS NULL) have full authority
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Administrators retain full administrative update authority
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- If caller is a student updating their own record, verify protected fields are unchanged
    IF (
        OLD.full_name IS DISTINCT FROM NEW.full_name OR
        OLD.admission_no IS DISTINCT FROM NEW.admission_no OR
        OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth OR
        OLD.gender IS DISTINCT FROM NEW.gender OR
        OLD.b_form_or_cnic IS DISTINCT FROM NEW.b_form_or_cnic OR
        OLD.admission_date IS DISTINCT FROM NEW.admission_date OR
        OLD.guardian_name IS DISTINCT FROM NEW.guardian_name OR
        OLD.guardian_relation IS DISTINCT FROM NEW.guardian_relation OR
        OLD.guardian_cnic IS DISTINCT FROM NEW.guardian_cnic OR
        OLD.guardian_phone IS DISTINCT FROM NEW.guardian_phone OR
        OLD.emergency_contact IS DISTINCT FROM NEW.emergency_contact OR
        OLD.address IS DISTINCT FROM NEW.address OR
        OLD.blood_group IS DISTINCT FROM NEW.blood_group OR
        OLD.is_active IS DISTINCT FROM NEW.is_active OR
        OLD.profile_id IS DISTINCT FROM NEW.profile_id OR
        OLD.email IS DISTINCT FROM NEW.email
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Students are only permitted to update their profile picture.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_student_photo_only_update ON public.students;
CREATE TRIGGER trg_enforce_student_photo_only_update
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_student_photo_only_update();



-- ==============================================================================
-- 10. INITIAL AUTH USERS & PROFILES SETUP (OPTIONAL / CONVENIENCE)
-- Creates default Admin, Teacher, and Student login accounts for immediate testing
-- ==============================================================================

-- 1. Create initial Admin, Teacher, and Student in auth.users
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES 
(
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@islamiapublic.edu.pk',
    crypt('Admin123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Principal Abdul Rehman Malik","role":"admin"}',
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'tariq.math@islamiapublic.edu.pk',
    crypt('Teacher123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Muhammad Tariq","role":"teacher"}',
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'student.0001@islamiapublic.edu.pk',
    crypt('Student123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Muhammad Hamza Khan","role":"student"}',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Link corresponding public.profiles
INSERT INTO public.profiles (id, role, full_name, email, phone, is_active) VALUES
('90000000-0000-0000-0000-000000000001', 'admin', 'Principal Abdul Rehman Malik', 'admin@islamiapublic.edu.pk', '+92 42 35881234', true),
('90000000-0000-0000-0000-000000000002', 'teacher', 'Muhammad Tariq', 'tariq.math@islamiapublic.edu.pk', '+92 300 4567891', true),
('90000000-0000-0000-0000-000000000003', 'student', 'Muhammad Hamza Khan', 'student.0001@islamiapublic.edu.pk', '+92 300 1234567', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Link teacher and student records to auth profiles
UPDATE public.teachers 
SET profile_id = '90000000-0000-0000-0000-000000000002'
WHERE email = 'tariq.math@islamiapublic.edu.pk';

UPDATE public.students
SET profile_id = '90000000-0000-0000-0000-000000000003',
    email = 'student.0001@islamiapublic.edu.pk'
WHERE admission_no = 'ADM-2025-0001';
