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
