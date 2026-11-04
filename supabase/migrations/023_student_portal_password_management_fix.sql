-- ==============================================================================
-- 023_student_portal_password_management_fix.sql
-- Noor-Ul-Ilm School System — Secure Student Portal Password Management & RPC Grants
-- ==============================================================================

-- 1. SECURITY DEFINER FUNCTION FOR ATOMIC STUDENT PASSWORD RESETS
CREATE OR REPLACE FUNCTION public.admin_reset_student_password(
    p_student_id UUID,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
BEGIN
    -- 1. Verify caller is an active administrator
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to reset student passwords.';
    END IF;

    -- 2. Validate password complexity
    IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Validation Error: Password must be at least 6 characters in length.';
    END IF;

    -- 3. Lookup student record
    SELECT * INTO v_student 
    FROM public.students 
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found for ID: %', p_student_id;
    END IF;

    IF v_student.profile_id IS NULL THEN
        RAISE EXCEPTION 'Student "%" does not have a provisioned portal account.', v_student.full_name;
    END IF;

    -- 4. Atomically update Auth password hash and clear recovery tokens
    UPDATE auth.users 
    SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
        confirmation_token = '',
        recovery_token = '',
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_student.profile_id;

    -- 5. Record institutional audit log (without recording password)
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
        'STUDENT_PORTAL_PASSWORD_RESET',
        'students',
        p_student_id::text,
        jsonb_build_object(
            'profile_id', v_student.profile_id,
            'student_name', v_student.full_name,
            'admission_no', v_student.admission_no,
            'email', v_student.email,
            'method', 'ADMIN_PASSWORD_SET'
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password updated successfully. Student can log in immediately.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

-- 2. EXPLICIT EXECUTE GRANTS FOR AUTHENTICATED CALLERS
GRANT EXECUTE ON FUNCTION public.admin_reset_student_password(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_student_status(UUID) TO authenticated, anon;
