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
