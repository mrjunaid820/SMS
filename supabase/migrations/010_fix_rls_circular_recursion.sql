-- ==============================================================================
-- 010_fix_rls_circular_recursion.sql
-- Professional School Management System (PostgreSQL 15+ / Supabase)
-- Breaks Circular RLS Recursion between students, enrollments, diary, and quizzes
-- ==============================================================================

-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- Running with SECURITY DEFINER bypasses RLS evaluation within function queries,
-- thereby breaking the mutual recursion loop between public.students & public.enrollments.

CREATE OR REPLACE FUNCTION public.get_current_student_id()
RETURNS UUID AS $$
DECLARE
    v_student_id UUID;
BEGIN
    SELECT id INTO v_student_id 
    FROM public.students 
    WHERE profile_id = auth.uid() 
    LIMIT 1;
    
    RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_student_section_id()
RETURNS UUID AS $$
DECLARE
    v_section_id UUID;
BEGIN
    SELECT e.section_id INTO v_section_id
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE s.profile_id = auth.uid()
    ORDER BY e.created_at DESC
    LIMIT 1;
    
    RETURN v_section_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_student_in_teacher_sections(p_student_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    curr_t_id UUID := public.get_current_teacher_id();
BEGIN
    IF curr_t_id IS NULL THEN 
        RETURN FALSE; 
    END IF;
    
    RETURN EXISTS (
        SELECT 1 
        FROM public.enrollments e
        JOIN public.teacher_assignments ta ON ta.section_id = e.section_id
        WHERE e.student_id = p_student_id AND ta.teacher_id = curr_t_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. POLICIES ON public.students
DROP POLICY IF EXISTS "Admin full access on students" ON public.students;
CREATE POLICY "Admin full access on students" 
    ON public.students FOR ALL 
    TO authenticated 
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers view active students in their assigned sections" ON public.students;
CREATE POLICY "Teachers view active students in their assigned sections" 
    ON public.students FOR SELECT 
    TO authenticated
    USING (public.is_teacher() AND public.is_student_in_teacher_sections(id));

DROP POLICY IF EXISTS "Students can view own student record" ON public.students;
CREATE POLICY "Students can view own student record" 
    ON public.students FOR SELECT 
    TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin() OR public.is_teacher());

-- 3. POLICIES ON public.enrollments
DROP POLICY IF EXISTS "Admin full access on enrollments" ON public.enrollments;
CREATE POLICY "Admin full access on enrollments" 
    ON public.enrollments FOR ALL 
    TO authenticated 
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers view enrollments for assigned sections" ON public.enrollments;
CREATE POLICY "Teachers view enrollments for assigned sections" 
    ON public.enrollments FOR SELECT 
    TO authenticated
    USING (public.is_teacher() AND public.teacher_assigned_to_section(section_id));

DROP POLICY IF EXISTS "Students can view own enrollment" ON public.enrollments;
CREATE POLICY "Students can view own enrollment" 
    ON public.enrollments FOR SELECT 
    TO authenticated
    USING (
        public.is_admin()
        OR (public.is_teacher() AND public.teacher_assigned_to_section(section_id))
        OR student_id = public.get_current_student_id()
    );

-- 4. POLICIES ON public.daily_diary
DROP POLICY IF EXISTS "Students can view published diary entries for enrolled section" ON public.daily_diary;
CREATE POLICY "Students can view published diary entries for enrolled section" 
    ON public.daily_diary FOR SELECT 
    TO authenticated
    USING (
        status = 'published' AND (
            public.is_admin()
            OR public.is_teacher()
            OR section_id = public.get_current_student_section_id()
        )
    );

-- 5. POLICIES ON public.quizzes
DROP POLICY IF EXISTS "Students can view published quizzes" ON public.quizzes;
CREATE POLICY "Students can view published quizzes" 
    ON public.quizzes FOR SELECT 
    TO authenticated
    USING (
        status = 'published' AND (
            public.is_admin()
            OR public.is_teacher()
            OR class_id IN (
                SELECT s.class_id FROM public.sections s 
                WHERE s.id = public.get_current_student_section_id()
            )
        )
    );

-- 6. POLICIES ON FEE INVOICES, ITEMS, AND PAYMENTS
DROP POLICY IF EXISTS "Students can view own fee invoices" ON public.fee_invoices;
CREATE POLICY "Students can view own fee invoices" 
    ON public.fee_invoices FOR SELECT 
    TO authenticated
    USING (
        public.is_admin()
        OR enrollment_id IN (
            SELECT id FROM public.enrollments 
            WHERE student_id = public.get_current_student_id()
        )
    );

DROP POLICY IF EXISTS "Students can view own fee invoice items" ON public.fee_invoice_items;
CREATE POLICY "Students can view own fee invoice items" 
    ON public.fee_invoice_items FOR SELECT 
    TO authenticated
    USING (
        public.is_admin()
        OR invoice_id IN (
            SELECT fi.id FROM public.fee_invoices fi
            JOIN public.enrollments e ON fi.enrollment_id = e.id
            WHERE e.student_id = public.get_current_student_id()
        )
    );

DROP POLICY IF EXISTS "Students can view own fee payments" ON public.fee_payments;
CREATE POLICY "Students can view own fee payments" 
    ON public.fee_payments FOR SELECT 
    TO authenticated
    USING (
        public.is_admin()
        OR invoice_id IN (
            SELECT fi.id FROM public.fee_invoices fi
            JOIN public.enrollments e ON fi.enrollment_id = e.id
            WHERE e.student_id = public.get_current_student_id()
        )
    );
