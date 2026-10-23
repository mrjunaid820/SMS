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
-- Adds a nullable, unique profile_id foreign key to public.students
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
