-- ==============================================================================
-- 021_student_attendance_access_and_synchronization.sql
-- Noor-Ul-Ilm School System — Student Portal Attendance Access & RLS Synchronization
-- ==============================================================================

-- 1. SECURITY DEFINER HELPER: get_current_student_id
-- Ensures students can securely obtain their student_id without circular RLS recursion
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

-- 2. ENABLE ROW LEVEL SECURITY ON ATTENDANCE
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES ON public.attendance
DROP POLICY IF EXISTS "Admin full access on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers view attendance for assigned sections" ON public.attendance;
DROP POLICY IF EXISTS "Teachers insert attendance for assigned sections" ON public.attendance;
DROP POLICY IF EXISTS "Teachers update attendance for assigned sections" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view their own attendance" ON public.attendance;

-- A. Admin Full Access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin full access on attendance"
    ON public.attendance FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- B. Teachers: View attendance for sections they are assigned to
CREATE POLICY "Teachers view attendance for assigned sections"
    ON public.attendance FOR SELECT
    TO authenticated
    USING (
        public.is_teacher() AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.id = attendance.enrollment_id AND public.teacher_assigned_to_section(e.section_id)
        )
    );

-- C. Teachers: Insert attendance for sections they are assigned to
CREATE POLICY "Teachers insert attendance for assigned sections"
    ON public.attendance FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_teacher() AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.id = attendance.enrollment_id AND public.teacher_assigned_to_section(e.section_id)
        )
    );

-- D. Teachers: Update attendance for sections they are assigned to
CREATE POLICY "Teachers update attendance for assigned sections"
    ON public.attendance FOR UPDATE
    TO authenticated
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

-- E. Students: Read-ONLY access to their own attendance records
CREATE POLICY "Students can view own attendance"
    ON public.attendance FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR (public.is_teacher() AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.id = attendance.enrollment_id AND public.teacher_assigned_to_section(e.section_id)
        ))
        OR enrollment_id IN (
            SELECT id FROM public.enrollments 
            WHERE student_id = public.get_current_student_id()
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        )
    );

-- 4. READ PERMISSIONS ON ACADEMIC STRUCTURE FOR ALL AUTHENTICATED USERS
-- Ensure Students can read classes, sections, and sessions for attendance joins
DROP POLICY IF EXISTS "Authenticated users read academic_sessions" ON public.academic_sessions;
CREATE POLICY "Authenticated users read academic_sessions" 
    ON public.academic_sessions FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Authenticated users read classes" ON public.classes;
CREATE POLICY "Authenticated users read classes" 
    ON public.classes FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Authenticated users read sections" ON public.sections;
CREATE POLICY "Authenticated users read sections" 
    ON public.sections FOR SELECT 
    TO authenticated 
    USING (true);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_enrollment_date 
    ON public.attendance(enrollment_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_status 
    ON public.attendance(status);

CREATE INDEX IF NOT EXISTS idx_attendance_date 
    ON public.attendance(date);

-- 6. SAMPLE ATTENDANCE SEED FOR DEMO & TESTING
-- Provides historical records for the primary test enrollment (Hamza Khan & Class 9)
INSERT INTO public.attendance (enrollment_id, date, status, remarks)
VALUES
    ('20000000-0000-0000-0000-000000000001', '2026-10-15', 'Present', 'On time'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-16', 'Present', 'Regular classroom attendance'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-19', 'Present', 'Active participation'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-20', 'Late', 'Heavy traffic on Islamabad Expressway'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-21', 'Present', 'Attended laboratory session'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-22', 'Present', 'Morning assembly present'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-23', 'Leave', 'Medical leave submitted with slip'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-26', 'Present', 'Returned from approved leave'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-27', 'Present', 'Full day present'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-28', 'Absent', 'Uninformed absence'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-29', 'Present', 'Parental note submitted'),
    ('20000000-0000-0000-0000-000000000001', '2026-10-30', 'Present', 'Friday session attended'),
    ('20000000-0000-0000-0000-000000000001', '2026-11-02', 'Present', 'Morning assembly on time'),
    ('20000000-0000-0000-0000-000000000001', '2026-11-03', 'Present', 'Attended all periods')
ON CONFLICT (enrollment_id, date) DO NOTHING;
