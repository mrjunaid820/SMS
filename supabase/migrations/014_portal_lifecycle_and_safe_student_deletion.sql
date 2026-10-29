-- ==============================================================================
-- 014_portal_lifecycle_and_safe_student_deletion.sql
-- Complete Portal Lifecycle (Activation, Deactivation, Reactivation) & Safe Student Deletion
-- 
-- Key Features:
-- 1. admin_set_student_portal_active (Individual student portal toggle)
-- 2. admin_bulk_set_student_portal_active (Bulk student portal activate/deactivate/reactivate)
-- 3. admin_set_teacher_portal_active (Individual teacher portal toggle)
-- 4. admin_bulk_set_teacher_portal_active (Bulk teacher portal activate/deactivate/reactivate)
-- 5. admin_check_student_deletion_eligibility (Pre-check for financial & academic dependencies)
-- 6. admin_safe_delete_student (Safe student deletion preserving institutional integrity)
-- 7. Reinforced RLS policies enforcing profiles.is_active = TRUE for student & teacher sessions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCTION: public.admin_set_student_portal_active
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_student_portal_active(
    p_student_id UUID,
    p_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_profile RECORD;
BEGIN
    -- 1. Authorization check
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to modify portal access.';
    END IF;

    -- 2. Retrieve student
    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found in database.';
    END IF;

    IF v_student.profile_id IS NULL THEN
        RAISE EXCEPTION 'Student "%" does not have a provisioned portal account. Please activate/provision the portal first.', v_student.full_name;
    END IF;

    -- 3. Update public.profiles
    UPDATE public.profiles
    SET is_active = p_active,
        updated_at = now()
    WHERE id = v_student.profile_id;

    -- 4. Invalidate session if deactivating
    IF NOT p_active THEN
        UPDATE auth.users
        SET updated_at = now()
        WHERE id = v_student.profile_id;
    END IF;

    -- 5. Institutional Audit Log
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
        CASE WHEN p_active THEN 'STUDENT_PORTAL_REACTIVATED' ELSE 'STUDENT_PORTAL_DEACTIVATED' END,
        'students',
        p_student_id::text,
        jsonb_build_object(
            'profile_id', v_student.profile_id,
            'student_name', v_student.full_name,
            'admission_no', v_student.admission_no,
            'new_portal_status', CASE WHEN p_active THEN 'active' ELSE 'inactive' END
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'profile_id', v_student.profile_id,
        'is_active', p_active,
        'portal_status', CASE WHEN p_active THEN 'active' ELSE 'inactive' END,
        'message', CASE 
            WHEN p_active THEN 'Student portal reactivated successfully. Student can now log in.'
            ELSE 'Student portal deactivated successfully. Login access revoked.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 2. FUNCTION: public.admin_bulk_set_student_portal_active
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_set_student_portal_active(
    p_student_ids UUID[],
    p_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_student_id UUID;
    v_res JSONB;
    v_results JSONB := '[]'::jsonb;
    v_success_count INT := 0;
    v_skipped_count INT := 0;
    v_failed_count INT := 0;
    v_student RECORD;
    v_profile RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to perform bulk portal operations.';
    END IF;

    FOREACH v_student_id IN ARRAY p_student_ids
    LOOP
        SELECT * INTO v_student FROM public.students WHERE id = v_student_id;
        
        IF NOT FOUND THEN
            v_failed_count := v_failed_count + 1;
            v_results := v_results || jsonb_build_object(
                'student_id', v_student_id,
                'status', 'failed',
                'error', 'Student record not found'
            );
            CONTINUE;
        END IF;

        IF v_student.profile_id IS NULL THEN
            v_skipped_count := v_skipped_count + 1;
            v_results := v_results || jsonb_build_object(
                'student_id', v_student_id,
                'full_name', v_student.full_name,
                'status', 'skipped',
                'message', 'No portal account provisioned'
            );
            CONTINUE;
        END IF;

        SELECT * INTO v_profile FROM public.profiles WHERE id = v_student.profile_id;
        IF FOUND AND v_profile.is_active = p_active THEN
            v_skipped_count := v_skipped_count + 1;
            v_results := v_results || jsonb_build_object(
                'student_id', v_student_id,
                'full_name', v_student.full_name,
                'status', 'skipped',
                'message', CASE WHEN p_active THEN 'Portal is already active' ELSE 'Portal is already deactivated' END
            );
            CONTINUE;
        END IF;

        BEGIN
            v_res := public.admin_set_student_portal_active(v_student_id, p_active);
            v_success_count := v_success_count + 1;
            v_results := v_results || jsonb_build_object(
                'student_id', v_student_id,
                'full_name', v_student.full_name,
                'status', 'success',
                'portal_status', CASE WHEN p_active THEN 'active' ELSE 'inactive' END
            );
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_results := v_results || jsonb_build_object(
                'student_id', v_student_id,
                'full_name', v_student.full_name,
                'status', 'failed',
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total_requested', array_length(p_student_ids, 1),
        'success_count', v_success_count,
        'skipped_count', v_skipped_count,
        'failed_count', v_failed_count,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 3. FUNCTION: public.admin_set_teacher_portal_active
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_teacher_portal_active(
    p_teacher_id UUID,
    p_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_teacher RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to modify teacher portal access.';
    END IF;

    SELECT * INTO v_teacher FROM public.teachers WHERE id = p_teacher_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher record not found.';
    END IF;

    -- Update teacher status
    UPDATE public.teachers 
    SET is_active = p_active
    WHERE id = p_teacher_id;

    -- Update profile status if linked
    IF v_teacher.profile_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET is_active = p_active,
            updated_at = now()
        WHERE id = v_teacher.profile_id;

        IF NOT p_active THEN
            UPDATE auth.users
            SET updated_at = now()
            WHERE id = v_teacher.profile_id;
        END IF;
    END IF;

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
        CASE WHEN p_active THEN 'TEACHER_PORTAL_REACTIVATED' ELSE 'TEACHER_PORTAL_DEACTIVATED' END,
        'teachers',
        p_teacher_id::text,
        jsonb_build_object(
            'profile_id', v_teacher.profile_id,
            'teacher_name', v_teacher.full_name,
            'employee_id', v_teacher.employee_id,
            'new_status', CASE WHEN p_active THEN 'active' ELSE 'inactive' END
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'teacher_id', p_teacher_id,
        'profile_id', v_teacher.profile_id,
        'is_active', p_active,
        'message', CASE 
            WHEN p_active THEN 'Teacher portal reactivated successfully.'
            ELSE 'Teacher portal deactivated successfully. Access revoked.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 4. FUNCTION: public.admin_bulk_set_teacher_portal_active
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_set_teacher_portal_active(
    p_teacher_ids UUID[],
    p_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_teacher_id UUID;
    v_res JSONB;
    v_results JSONB := '[]'::jsonb;
    v_success_count INT := 0;
    v_skipped_count INT := 0;
    v_failed_count INT := 0;
    v_teacher RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators can perform bulk teacher portal operations.';
    END IF;

    FOREACH v_teacher_id IN ARRAY p_teacher_ids
    LOOP
        SELECT * INTO v_teacher FROM public.teachers WHERE id = v_teacher_id;
        
        IF NOT FOUND THEN
            v_failed_count := v_failed_count + 1;
            v_results := v_results || jsonb_build_object(
                'teacher_id', v_teacher_id,
                'status', 'failed',
                'error', 'Teacher record not found'
            );
            CONTINUE;
        END IF;

        IF v_teacher.is_active = p_active THEN
            v_skipped_count := v_skipped_count + 1;
            v_results := v_results || jsonb_build_object(
                'teacher_id', v_teacher_id,
                'full_name', v_teacher.full_name,
                'status', 'skipped',
                'message', CASE WHEN p_active THEN 'Already active' ELSE 'Already deactivated' END
            );
            CONTINUE;
        END IF;

        BEGIN
            v_res := public.admin_set_teacher_portal_active(v_teacher_id, p_active);
            v_success_count := v_success_count + 1;
            v_results := v_results || jsonb_build_object(
                'teacher_id', v_teacher_id,
                'full_name', v_teacher.full_name,
                'status', 'success'
            );
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_results := v_results || jsonb_build_object(
                'teacher_id', v_teacher_id,
                'full_name', v_teacher.full_name,
                'status', 'failed',
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total_requested', array_length(p_teacher_ids, 1),
        'success_count', v_success_count,
        'skipped_count', v_skipped_count,
        'failed_count', v_failed_count,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 5. FUNCTION: public.admin_check_student_deletion_eligibility
-- Inspects academic & financial record dependencies before deletion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_check_student_deletion_eligibility(
    p_student_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_enrollment_ids UUID[];
    v_enrollment_count INT := 0;
    v_attendance_count INT := 0;
    v_fee_invoice_count INT := 0;
    v_fee_payment_count INT := 0;
    v_mark_count INT := 0;
    v_has_dependencies BOOLEAN := FALSE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators can inspect deletion dependencies.';
    END IF;

    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found.';
    END IF;

    -- Get all enrollment IDs for this student
    SELECT array_agg(id) INTO v_enrollment_ids 
    FROM public.enrollments 
    WHERE student_id = p_student_id;

    IF v_enrollment_ids IS NOT NULL THEN
        v_enrollment_count := array_length(v_enrollment_ids, 1);

        -- Count attendance records
        SELECT count(*) INTO v_attendance_count 
        FROM public.attendance 
        WHERE enrollment_id = ANY(v_enrollment_ids);

        -- Count fee invoices
        SELECT count(*) INTO v_fee_invoice_count 
        FROM public.fee_invoices 
        WHERE enrollment_id = ANY(v_enrollment_ids);

        -- Count fee payments
        SELECT count(*) INTO v_fee_payment_count 
        FROM public.fee_payments 
        WHERE invoice_id IN (
            SELECT id FROM public.fee_invoices WHERE enrollment_id = ANY(v_enrollment_ids)
        );

        -- Count marks
        SELECT count(*) INTO v_mark_count 
        FROM public.marks 
        WHERE enrollment_id = ANY(v_enrollment_ids);
    END IF;

    -- Check if student has non-trivial dependencies
    IF v_attendance_count > 0 OR v_fee_invoice_count > 0 OR v_fee_payment_count > 0 OR v_mark_count > 0 THEN
        v_has_dependencies := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'student_id', p_student_id,
        'student_name', v_student.full_name,
        'admission_no', v_student.admission_no,
        'has_dependencies', v_has_dependencies,
        'eligible_for_permanent_deletion', NOT v_has_dependencies,
        'recommendation', CASE WHEN v_has_dependencies THEN 'archive_recommended' ELSE 'permanent_deletion' END,
        'dependencies', jsonb_build_object(
            'enrollments', v_enrollment_count,
            'attendance_records', v_attendance_count,
            'fee_invoices', v_fee_invoice_count,
            'fee_payments', v_fee_payment_count,
            'exam_marks', v_mark_count
        ),
        'explanation', CASE 
            WHEN v_has_dependencies THEN 
                format('Student has %s attendance records, %s fee invoices, %s fee payments, and %s exam marks. To preserve financial and academic history, please use "Archive Student" instead of permanent deletion.', 
                    v_attendance_count, v_fee_invoice_count, v_fee_payment_count, v_mark_count)
            ELSE 
                'Student has no academic or financial history. Record is eligible for permanent removal.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 6. FUNCTION: public.admin_safe_delete_student
-- Safely deletes unlinked student records without corrupting institutional data
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_safe_delete_student(
    p_student_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_check JSONB;
    v_student RECORD;
    v_profile_id UUID;
    v_enrollment_ids UUID[];
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to delete student records.';
    END IF;

    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found in database.';
    END IF;

    -- Run dependency pre-check
    v_check := public.admin_check_student_deletion_eligibility(p_student_id);

    IF (v_check->>'has_dependencies')::boolean THEN
        RAISE EXCEPTION 'Permanent Deletion Blocked: %', v_check->>'explanation';
    END IF;

    v_profile_id := v_student.profile_id;

    -- 1. Safely remove empty draft enrollments if present
    DELETE FROM public.enrollments WHERE student_id = p_student_id;

    -- 2. Unlink profile_id
    UPDATE public.students SET profile_id = NULL WHERE id = p_student_id;

    -- 3. Delete student record
    DELETE FROM public.students WHERE id = p_student_id;

    -- 4. If student had an Auth profile, clean it up safely
    IF v_profile_id IS NOT NULL THEN
        -- Only delete profile if it belongs to role 'student' and has no other links
        DELETE FROM public.profiles WHERE id = v_profile_id AND role = 'student';
        DELETE FROM auth.identities WHERE user_id = v_profile_id;
        DELETE FROM auth.users WHERE id = v_profile_id;
    END IF;

    -- 5. Audit Log
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
        'STUDENT_RECORD_PERMANENTLY_DELETED',
        'students',
        p_student_id::text,
        jsonb_build_object(
            'student_name', v_student.full_name,
            'admission_no', v_student.admission_no,
            'cleaned_profile_id', v_profile_id
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'student_name', v_student.full_name,
        'admission_no', v_student.admission_no,
        'message', format('Student "%s" (Admission No: %s) has been permanently deleted.', v_student.full_name, v_student.admission_no)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 7. REINFORCE RLS POLICIES FOR INACTIVE STUDENT & TEACHER SESSIONS
-- Denies data access immediately whenever profiles.is_active = FALSE
-- ------------------------------------------------------------------------------

-- Update get_current_student_id() to enforce profiles.is_active = TRUE
CREATE OR REPLACE FUNCTION public.get_current_student_id()
RETURNS UUID AS $$
DECLARE
    v_student_id UUID;
BEGIN
    SELECT s.id INTO v_student_id 
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid() AND p.is_active = TRUE
    LIMIT 1;
    
    RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update get_current_student_section_id() to enforce profiles.is_active = TRUE
CREATE OR REPLACE FUNCTION public.get_current_student_section_id()
RETURNS UUID AS $$
DECLARE
    v_section_id UUID;
BEGIN
    SELECT e.section_id INTO v_section_id
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid() AND p.is_active = TRUE
    ORDER BY e.created_at DESC
    LIMIT 1;
    
    RETURN v_section_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update get_current_teacher_id() to enforce profiles.is_active = TRUE
CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS UUID AS $$
DECLARE
    t_id UUID;
BEGIN
    SELECT t.id INTO t_id 
    FROM public.teachers t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid() AND t.is_active = TRUE AND p.is_active = TRUE;
    
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update students view policy to check active status
DROP POLICY IF EXISTS "Students can view own student record" ON public.students;
CREATE POLICY "Students can view own student record" 
    ON public.students FOR SELECT 
    TO authenticated
    USING (
        (profile_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE))
        OR public.is_admin() 
        OR public.is_teacher()
    );


-- ------------------------------------------------------------------------------
-- 8. GRANT EXECUTE PERMISSIONS ON ALL NEW FUNCTIONS
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_set_student_portal_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_set_student_portal_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_portal_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_set_teacher_portal_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_check_student_deletion_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_safe_delete_student TO authenticated;
