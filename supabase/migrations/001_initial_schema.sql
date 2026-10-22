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
