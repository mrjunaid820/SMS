-- ==============================================================================
-- 011_admin_student_portal_provisioning.sql
-- Professional School Management System (PostgreSQL 15+ / Supabase)
-- Atomic Administrator Student Portal Provisioning & Password Management
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. FUNCTION: public.admin_provision_student
-- Atomically provisions a Supabase Auth user, creates the student profile,
-- links the student record, and logs the action in a single ACID transaction.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_provision_student(
    p_student_id UUID,
    p_email TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_clean_email TEXT;
    v_existing_user_id UUID;
    v_user_id UUID;
    v_existing_profile RECORD;
BEGIN
    -- 1. Authorization: Only verified administrators may call this function
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to provision student portal accounts.';
    END IF;

    -- 2. Validate input parameters
    v_clean_email := lower(trim(p_email));
    IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
        RAISE EXCEPTION 'Validation Error: A valid email address is required (e.g. student.adm001@islamiapublic.edu.pk).';
    END IF;

    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Validation Error: Initial password must be at least 6 characters in length.';
    END IF;

    -- 3. Retrieve student record
    SELECT * INTO v_student 
    FROM public.students 
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found in database (ID: %).', p_student_id;
    END IF;

    IF NOT v_student.is_active THEN
        RAISE EXCEPTION 'Cannot provision portal account for an archived or inactive student.';
    END IF;

    IF v_student.profile_id IS NOT NULL THEN
        RAISE EXCEPTION 'Student % already has an active portal login account linked (Profile ID: %).', 
            v_student.full_name, v_student.profile_id;
    END IF;

    -- 4. Check for existing auth users with the requested email
    SELECT id INTO v_existing_user_id 
    FROM auth.users 
    WHERE lower(email) = v_clean_email;

    IF v_existing_user_id IS NOT NULL THEN
        -- Verify that the existing user is not already claimed by another student
        IF EXISTS (SELECT 1 FROM public.students WHERE profile_id = v_existing_user_id AND id != p_student_id) THEN
            RAISE EXCEPTION 'Conflict Error: Email address "%" is already linked to another student record.', v_clean_email;
        END IF;

        -- Verify that the existing user is not a teacher or admin profile
        SELECT * INTO v_existing_profile FROM public.profiles WHERE id = v_existing_user_id;
        IF FOUND AND v_existing_profile.role != 'student' THEN
            RAISE EXCEPTION 'Conflict Error: Email address "%" is already registered to a % account.', v_clean_email, v_existing_profile.role;
        END IF;

        -- Safe recovery: The user was created in auth.users during an earlier interrupted attempt
        v_user_id := v_existing_user_id;
        UPDATE auth.users 
        SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = jsonb_build_object('role', 'student', 'full_name', trim(v_student.full_name)),
            updated_at = now()
        WHERE id = v_user_id;
    ELSE
        -- 5. Create new Auth User in auth.users
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            aud,
            role,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            v_clean_email,
            crypt(p_password, gen_salt('bf', 10)),
            now(),
            'authenticated',
            'authenticated',
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            jsonb_build_object('role', 'student', 'full_name', trim(v_student.full_name)),
            now(),
            now()
        );

        -- 6. Insert corresponding identity record into auth.identities
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id::text,
            v_user_id,
            jsonb_build_object(
                'sub', v_user_id::text,
                'email', v_clean_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_user_id::text,
            now(),
            now(),
            now()
        );
    END IF;

    -- 7. Upsert into public.profiles
    INSERT INTO public.profiles (
        id,
        role,
        full_name,
        email,
        phone,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        'student',
        trim(v_student.full_name),
        v_clean_email,
        v_student.guardian_phone,
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'student',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        is_active = true,
        updated_at = now();

    -- 8. Link to public.students
    UPDATE public.students 
    SET profile_id = v_user_id,
        email = v_clean_email,
        updated_at = now()
    WHERE id = p_student_id;

    -- 9. Record in Institutional Audit Log
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
        'STUDENT_PORTAL_ACCOUNT_PROVISIONED',
        'students',
        p_student_id,
        jsonb_build_object(
            'profile_id', v_user_id,
            'email', v_clean_email,
            'admission_no', v_student.admission_no,
            'student_name', v_student.full_name
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_email,
        'student_id', p_student_id,
        'full_name', v_student.full_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

-- ------------------------------------------------------------------------------
-- 2. FUNCTION: public.admin_reset_student_password
-- Securely updates the password for a provisioned student account without
-- relying on external mail delivery.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_student_password(
    p_student_id UUID,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to reset student passwords.';
    END IF;

    IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Validation Error: Password must be at least 6 characters in length.';
    END IF;

    SELECT * INTO v_student 
    FROM public.students 
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found.';
    END IF;

    IF v_student.profile_id IS NULL THEN
        RAISE EXCEPTION 'Student % does not have a provisioned portal account.', v_student.full_name;
    END IF;

    -- Update Auth password hash
    UPDATE auth.users 
    SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_student.profile_id;

    -- Audit log
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
        p_student_id,
        jsonb_build_object('profile_id', v_student.profile_id, 'email', v_student.email),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password updated successfully. Student can log in immediately.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

-- ------------------------------------------------------------------------------
-- 3. FUNCTION: public.admin_toggle_student_status
-- Toggles active/deactivated state of a student's portal account.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_toggle_student_status(
    p_student_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_new_active BOOLEAN;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators are authorized to modify portal access status.';
    END IF;

    SELECT * INTO v_student 
    FROM public.students 
    WHERE id = p_student_id;

    IF NOT FOUND OR v_student.profile_id IS NULL THEN
        RAISE EXCEPTION 'Student does not have an active portal account.';
    END IF;

    SELECT NOT is_active INTO v_new_active 
    FROM public.profiles 
    WHERE id = v_student.profile_id;

    UPDATE public.profiles 
    SET is_active = v_new_active,
        updated_at = now()
    WHERE id = v_student.profile_id;

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
        'STUDENT_PORTAL_STATUS_TOGGLED',
        'students',
        p_student_id,
        jsonb_build_object('profile_id', v_student.profile_id, 'is_active', v_new_active),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_active', v_new_active
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;
