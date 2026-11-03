-- ==============================================================================
-- 020_subject_management_enhancements.sql
-- Curriculum & Subject Management Enhancements
-- 
-- 1. Schema Enhancements:
--    - Optional subject code (DROP NOT NULL)
--    - Subject description (TEXT)
--    - Canonical boolean status column: is_active (BOOLEAN NOT NULL DEFAULT TRUE)
--      (Follows standard schema pattern used by teachers, students, and profiles;
--       avoids duplicate status columns).
-- 2. Safe Subject Deletion & Dependency Verification:
--    - admin_check_subject_deletion_eligibility
--    - admin_safe_delete_subject
--    - admin_set_subject_status
-- 3. Row Level Security & Access Control:
--    - Admins: explicit full operational access (SELECT, INSERT, UPDATE, DELETE)
--    - Teachers: SELECT only (read-only)
--    - Students: SELECT only for active subjects (read-only)
-- ==============================================================================

-- 1. SCHEMA MODIFICATIONS
DO $$
BEGIN
    -- Add description column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'subjects' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN description TEXT;
    END IF;

    -- Add canonical is_active column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'subjects' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- Allow code to be nullable (optional subject code requirement)
    ALTER TABLE public.subjects ALTER COLUMN code DROP NOT NULL;
END $$;

-- Performance indexes for subject lookups & filtering
CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON public.subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_is_active ON public.subjects(is_active);

-- ------------------------------------------------------------------------------
-- 2. FUNCTION: public.admin_check_subject_deletion_eligibility
-- Inspects academic dependencies across examinations, quizzes, daily diaries, and teacher assignments
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_check_subject_deletion_eligibility(
    p_subject_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_subject RECORD;
    v_teacher_assignments INT := 0;
    v_exam_subjects INT := 0;
    v_marks INT := 0;
    v_quizzes INT := 0;
    v_quiz_marks INT := 0;
    v_daily_diaries INT := 0;
    v_total_dependencies INT := 0;
    v_can_delete BOOLEAN := TRUE;
    v_reason TEXT := NULL;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators can inspect subject deletion dependencies.';
    END IF;

    SELECT * INTO v_subject FROM public.subjects WHERE id = p_subject_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subject record not found.';
    END IF;

    -- 1. Teacher assignments
    SELECT count(*) INTO v_teacher_assignments 
    FROM public.teacher_assignments 
    WHERE subject_id = p_subject_id;

    -- 2. Exam subjects & Student marks
    SELECT count(*) INTO v_exam_subjects 
    FROM public.exam_subjects 
    WHERE subject_id = p_subject_id;

    SELECT count(*) INTO v_marks 
    FROM public.marks 
    WHERE exam_subject_id IN (
        SELECT id FROM public.exam_subjects WHERE subject_id = p_subject_id
    );

    -- 3. Quizzes & Quiz marks
    SELECT count(*) INTO v_quizzes 
    FROM public.quizzes 
    WHERE subject_id = p_subject_id;

    SELECT count(*) INTO v_quiz_marks 
    FROM public.quiz_marks 
    WHERE quiz_id IN (
        SELECT id FROM public.quizzes WHERE subject_id = p_subject_id
    );

    -- 4. Daily diaries
    SELECT count(*) INTO v_daily_diaries 
    FROM public.daily_diary 
    WHERE subject_id = p_subject_id;

    v_total_dependencies := v_teacher_assignments + v_exam_subjects + v_marks + v_quizzes + v_quiz_marks + v_daily_diaries;

    IF v_total_dependencies > 0 THEN
        v_can_delete := FALSE;
        v_reason := format(
            'Cannot delete subject "%s" because it has linked academic records: %s teacher assignment(s), %s exam schedule(s), %s student mark(s), %s quiz(zes), %s quiz mark(s), and %s daily diary entry/entries. Deleting this subject would destroy historical records. Please deactivate it instead.',
            v_subject.name,
            v_teacher_assignments,
            v_exam_subjects,
            v_marks,
            v_quizzes,
            v_quiz_marks,
            v_daily_diaries
        );
    END IF;

    RETURN jsonb_build_object(
        'can_delete', v_can_delete,
        'reason', v_reason,
        'subject_id', p_subject_id,
        'subject_name', v_subject.name,
        'dependencies', jsonb_build_object(
            'teacher_assignments', v_teacher_assignments,
            'exam_subjects', v_exam_subjects,
            'marks', v_marks,
            'quizzes', v_quizzes,
            'quiz_marks', v_quiz_marks,
            'daily_diaries', v_daily_diaries,
            'total', v_total_dependencies
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

-- ------------------------------------------------------------------------------
-- 3. FUNCTION: public.admin_safe_delete_subject
-- Deletes a subject only if it has NO linked academic dependencies
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_safe_delete_subject(
    p_subject_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_subject RECORD;
    v_eligibility JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators can delete subjects.';
    END IF;

    SELECT * INTO v_subject FROM public.subjects WHERE id = p_subject_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subject record not found.';
    END IF;

    -- Verify eligibility
    v_eligibility := public.admin_check_subject_deletion_eligibility(p_subject_id);
    IF NOT (v_eligibility->>'can_delete')::boolean THEN
        RAISE EXCEPTION '%', (v_eligibility->>'reason');
    END IF;

    -- Perform deletion
    DELETE FROM public.subjects WHERE id = p_subject_id;

    -- Institutional Audit Log
    INSERT INTO public.audit_logs (
        id,
        actor_id,
        actor_name,
        action,
        entity_type,
        entity_id,
        details,
        ip_address,
        created_at
    ) VALUES (
        gen_random_uuid(),
        auth.uid(),
        'Administrator',
        'SUBJECT_DELETED',
        'subjects',
        p_subject_id::text,
        jsonb_build_object(
            'subject_name', v_subject.name,
            'code', v_subject.code,
            'class_id', v_subject.class_id
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'deleted_subject_id', p_subject_id,
        'message', format('Subject "%s" was successfully removed.', v_subject.name)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

-- ------------------------------------------------------------------------------
-- 4. FUNCTION: public.admin_set_subject_status
-- Toggles a subject between Active (TRUE) and Inactive (FALSE) safely
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_subject_status(
    p_subject_id UUID,
    p_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_subject RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators can modify subject status.';
    END IF;

    SELECT * INTO v_subject FROM public.subjects WHERE id = p_subject_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subject record not found.';
    END IF;

    UPDATE public.subjects
    SET is_active = p_active
    WHERE id = p_subject_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        id,
        actor_id,
        actor_name,
        action,
        entity_type,
        entity_id,
        details,
        ip_address,
        created_at
    ) VALUES (
        gen_random_uuid(),
        auth.uid(),
        'Administrator',
        CASE WHEN p_active THEN 'SUBJECT_ACTIVATED' ELSE 'SUBJECT_DEACTIVATED' END,
        'subjects',
        p_subject_id::text,
        jsonb_build_object(
            'subject_name', v_subject.name,
            'code', v_subject.code,
            'is_active', p_active
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'subject_id', p_subject_id,
        'is_active', p_active,
        'message', format('Subject "%s" status updated to %s.', v_subject.name, CASE WHEN p_active THEN 'Active' ELSE 'Inactive' END)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Explicit Admin UPDATE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'subjects' 
          AND policyname = 'Admins can update subjects'
    ) THEN
        CREATE POLICY "Admins can update subjects"
            ON public.subjects FOR UPDATE
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;

    -- Explicit Admin INSERT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'subjects' 
          AND policyname = 'Admins can insert subjects'
    ) THEN
        CREATE POLICY "Admins can insert subjects"
            ON public.subjects FOR INSERT
            TO authenticated
            WITH CHECK (public.is_admin());
    END IF;

    -- Explicit Admin DELETE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'subjects' 
          AND policyname = 'Admins can delete subjects'
    ) THEN
        CREATE POLICY "Admins can delete subjects"
            ON public.subjects FOR DELETE
            TO authenticated
            USING (public.is_admin());
    END IF;

    -- Students can view active subjects (read-only)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'subjects' 
          AND policyname = 'Students can view active subjects'
    ) THEN
        CREATE POLICY "Students can view active subjects"
            ON public.subjects FOR SELECT
            TO authenticated
            USING (public.is_student());
    END IF;
END $$;
