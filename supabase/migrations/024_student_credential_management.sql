-- ==============================================================================
-- 024_student_credential_management.sql
-- Noor-Ul-Ilm School System — Student Credential & Login Identity Management
-- Matches Teacher Credential Architecture with Security Definer Functions & Grants
-- ==============================================================================

-- 1. SECURITY DEFINER FUNCTION TO ATOMICALLY UPDATE STUDENT LOGIN EMAIL
CREATE OR REPLACE FUNCTION public.admin_update_student_login_email(
    p_student_id UUID,
    p_new_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_clean_email TEXT;
    v_dup_profile RECORD;
BEGIN
    -- 1. Verify caller is an active administrator
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to update student credentials.';
    END IF;

    -- 2. Validate email syntax
    v_clean_email := lower(trim(p_new_email));
    IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Validation Error: Please enter a valid email address.';
    END IF;

    -- 3. Lookup target student
    SELECT * INTO v_student 
    FROM public.students 
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found for ID: %', p_student_id;
    END IF;

    IF v_student.profile_id IS NULL THEN
        RAISE EXCEPTION 'Student "%" does not have an active portal account. Please activate portal access first.', v_student.full_name;
    END IF;

    -- 4. Check for duplicate email across profiles
    SELECT id, full_name INTO v_dup_profile
    FROM public.profiles
    WHERE lower(email) = v_clean_email
      AND id != v_student.profile_id;

    IF FOUND THEN
        RAISE EXCEPTION 'Validation Error: The email address "%" is already registered to another user account.', v_clean_email;
    END IF;

    -- 5. Atomically update Auth Users identity
    UPDATE auth.users 
    SET email = v_clean_email,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_student.profile_id;

    -- 6. Synchronize public.profiles
    UPDATE public.profiles 
    SET email = v_clean_email,
        updated_at = now()
    WHERE id = v_student.profile_id;

    -- 7. Synchronize public.students official email
    UPDATE public.students 
    SET email = v_clean_email,
        updated_at = now()
    WHERE id = p_student_id;

    -- 8. Record audit log
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
        'STUDENT_LOGIN_EMAIL_UPDATED',
        'students',
        p_student_id::text,
        jsonb_build_object(
            'profile_id', v_student.profile_id,
            'student_name', v_student.full_name,
            'admission_no', v_student.admission_no,
            'previous_email', v_student.email,
            'new_email', v_clean_email,
            'method', 'ADMIN_MANAGE_CREDENTIALS'
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Student login email successfully updated to ' || v_clean_email || '.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

-- 2. EXPLICIT EXECUTE GRANTS
GRANT EXECUTE ON FUNCTION public.admin_update_student_login_email(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_student_password(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_student_status(UUID) TO authenticated, anon;
