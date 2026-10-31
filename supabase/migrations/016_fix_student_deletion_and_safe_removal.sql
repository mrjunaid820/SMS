-- 016_fix_student_deletion_and_safe_removal.sql
-- Professional School Management System (PostgreSQL 15+ / Supabase)
-- Robust Student Deletion, Safe Removal, and Historical Record Integrity
-- ==============================================================================

-- 1. FUNCTION: public.admin_check_student_deletion_eligibility
-- Inspects academic, assessment, and financial dependencies before deletion
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
    v_quiz_result_count INT := 0;
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

        -- Count fee payments (through fee invoices)
        SELECT count(*) INTO v_fee_payment_count 
        FROM public.fee_payments 
        WHERE invoice_id IN (
            SELECT id FROM public.fee_invoices WHERE enrollment_id = ANY(v_enrollment_ids)
        );

        -- Count exam marks
        SELECT count(*) INTO v_mark_count 
        FROM public.marks 
        WHERE enrollment_id = ANY(v_enrollment_ids);

        -- Count quiz results if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_results') THEN
            EXECUTE 'SELECT count(*) FROM public.quiz_results WHERE enrollment_id = ANY($1)'
            INTO v_quiz_result_count
            USING v_enrollment_ids;
        END IF;
    END IF;

    -- Evaluate whether the student has institutional dependencies
    IF v_attendance_count > 0 OR v_fee_invoice_count > 0 OR v_fee_payment_count > 0 OR v_mark_count > 0 OR v_quiz_result_count > 0 THEN
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
            'exam_marks', v_mark_count,
            'quiz_results', v_quiz_result_count
        ),
        'explanation', CASE 
            WHEN v_has_dependencies THEN 
                format('Student has %s attendance records, %s fee invoices, %s fee payments, and %s exam marks. Permanent database deletion is blocked to protect institutional data integrity and financial audit trails. Please use "Archive / Safe Deactivation" instead.', 
                    v_attendance_count, v_fee_invoice_count, v_fee_payment_count, v_mark_count)
            ELSE 
                'Student has no academic or financial history. Record is eligible for permanent removal.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- 2. FUNCTION: public.admin_safe_delete_student
-- Permanently deletes clean student records (0 attendance, 0 fees, 0 marks)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_safe_delete_student(
    p_student_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_check JSONB;
    v_student RECORD;
    v_profile_id UUID;
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

    -- 4. Clean up Auth profile if present
    IF v_profile_id IS NOT NULL THEN
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


-- 3. FUNCTION: public.admin_safe_deactivate_student
-- Safely deactivates student, revokes portal access, and preserves historical data
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_safe_deactivate_student(
    p_student_id UUID,
    p_reason TEXT DEFAULT 'Safely removed from active roster by administrator (historical records retained)'
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_profile_id UUID;
    v_reason TEXT := COALESCE(NULLIF(trim(p_reason), ''), 'Safely removed from active roster by administrator (historical records retained)');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to remove student records.';
    END IF;

    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found in database.';
    END IF;

    v_profile_id := v_student.profile_id;

    -- 1. Mark student inactive and record archiving timestamp & reason
    UPDATE public.students 
    SET is_active = FALSE,
        archived_at = now(),
        archive_reason = v_reason,
        updated_at = now()
    WHERE id = p_student_id;

    -- 2. Revoke portal login access if profile exists
    IF v_profile_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET is_active = FALSE,
            updated_at = now()
        WHERE id = v_profile_id;
    END IF;

    -- 3. Audit Log
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
        'STUDENT_RECORD_SAFELY_DEACTIVATED',
        'students',
        p_student_id::text,
        jsonb_build_object(
            'student_name', v_student.full_name,
            'admission_no', v_student.admission_no,
            'reason', v_reason,
            'profile_id', v_profile_id,
            'historical_records_retained', true
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'student_name', v_student.full_name,
        'admission_no', v_student.admission_no,
        'message', format('Student "%s" (Admission No: %s) has been safely deactivated and removed from the active roster. All historical records have been preserved.', v_student.full_name, v_student.admission_no)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- 4. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_check_student_deletion_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_safe_delete_student TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_safe_deactivate_student TO authenticated;
