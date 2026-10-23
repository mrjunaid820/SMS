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
