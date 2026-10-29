-- ==============================================================================
-- 012_fix_uuid_and_bulk_provisioning.sql
-- Professional School Management System (PostgreSQL 15+ / Supabase)
-- Fixes "Database error querying schema", UUID/Text mismatch & implements Bulk Student Provisioning
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. FIX EXISTING AUTH USERS & SYNCHRONIZE AUTH IDENTITIES
-- Resolves "Database error querying schema" caused by:
-- a) NULL token columns in auth.users (Go driver fails to scan NULL to string)
-- b) Missing or mismatched auth.identities records where provider_id != email
-- ------------------------------------------------------------------------------

-- Step 1A: Clean up token columns in auth.users
UPDATE auth.users
SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    aud = COALESCE(NULLIF(aud, ''), 'authenticated'),
    role = COALESCE(NULLIF(role, ''), 'authenticated'),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE email IS NOT NULL;

-- Step 1B: Repair existing identities where provider_id was wrongly set to user_id::text
UPDATE auth.identities i
SET 
    provider_id = lower(trim(u.email)),
    identity_data = jsonb_build_object(
        'sub', u.id::text,
        'email', lower(trim(u.email)),
        'email_verified', true,
        'phone_verified', false
    ),
    updated_at = now()
FROM auth.users u
WHERE i.user_id = u.id 
  AND i.provider = 'email'
  AND (i.provider_id != lower(trim(u.email)) OR i.provider_id IS NULL);

-- Step 1C: Insert missing identities for any user without an 'email' provider identity
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object(
        'sub', u.id::text,
        'email', lower(trim(u.email)),
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    lower(trim(u.email)),
    COALESCE(u.last_sign_in_at, now()),
    COALESCE(u.created_at, now()),
    COALESCE(u.updated_at, now())
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  )
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. FUNCTION: public.admin_provision_student (Fixed UUID & Email provider_id)
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
    -- 1. Authorization: Only administrators can provision accounts
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to provision student portal accounts.';
    END IF;

    -- 2. Input validation
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
        RAISE EXCEPTION 'Student % already has an active portal login account linked.', v_student.full_name;
    END IF;

    -- 4. Check for existing auth user with requested email
    SELECT id INTO v_existing_user_id 
    FROM auth.users 
    WHERE lower(email) = v_clean_email;

    IF v_existing_user_id IS NOT NULL THEN
        -- Prevent stealing another student's account
        IF EXISTS (SELECT 1 FROM public.students WHERE profile_id = v_existing_user_id AND id != p_student_id) THEN
            RAISE EXCEPTION 'Conflict Error: Email address "%" is already linked to another student record.', v_clean_email;
        END IF;

        -- Prevent claiming admin/teacher accounts
        SELECT * INTO v_existing_profile FROM public.profiles WHERE id = v_existing_user_id;
        IF FOUND AND v_existing_profile.role != 'student' THEN
            RAISE EXCEPTION 'Conflict Error: Email address "%" is already registered to a % account.', v_clean_email, v_existing_profile.role;
        END IF;

        -- Self-healing recovery: update existing auth user
        v_user_id := v_existing_user_id;
        UPDATE auth.users 
        SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = jsonb_build_object('role', 'student', 'full_name', trim(v_student.full_name)),
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            updated_at = now()
        WHERE id = v_user_id;

        -- Ensure matching identity exists and has provider_id = v_clean_email
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
            gen_random_uuid(),
            v_user_id,
            jsonb_build_object(
                'sub', v_user_id::text,
                'email', v_clean_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_clean_email,
            now(),
            now(),
            now()
        )
        ON CONFLICT DO NOTHING;

        -- Also update if identity exists with wrong provider_id
        UPDATE auth.identities
        SET provider_id = v_clean_email,
            identity_data = jsonb_build_object(
                'sub', v_user_id::text,
                'email', v_clean_email,
                'email_verified', true,
                'phone_verified', false
            ),
            updated_at = now()
        WHERE user_id = v_user_id AND provider = 'email';

    ELSE
        -- 5. Create new Auth user with UUID id and non-null token defaults
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
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
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
            '',
            '',
            '',
            '',
            now(),
            now()
        );

        -- 6. Insert corresponding identity record (ID IS UUID, provider_id IS clean_email)
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
            gen_random_uuid(),
            v_user_id,
            jsonb_build_object(
                'sub', v_user_id::text,
                'email', v_clean_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_clean_email,
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
        p_student_id::text,
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
-- 3. FUNCTION: public.admin_bulk_provision_students (Bulk Processing)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_provision_students(
    p_student_ids UUID[],
    p_default_password TEXT DEFAULT 'Student123!'
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
    v_admission_clean TEXT;
    v_email TEXT;
BEGIN
    -- 1. Authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to bulk provision student accounts.';
    END IF;

    -- 2. Process each student ID with independent fault-tolerance
    FOREACH v_student_id IN ARRAY p_student_ids
    LOOP
        BEGIN
            SELECT * INTO v_student FROM public.students WHERE id = v_student_id;
            
            IF NOT FOUND THEN
                v_results := v_results || jsonb_build_object(
                    'student_id', v_student_id,
                    'student_name', 'Unknown',
                    'admission_no', 'N/A',
                    'email', NULL,
                    'status', 'failed',
                    'message', 'Student record not found in database.'
                );
                v_failed_count := v_failed_count + 1;
                CONTINUE;
            END IF;

            IF NOT v_student.is_active THEN
                v_results := v_results || jsonb_build_object(
                    'student_id', v_student_id,
                    'student_name', v_student.full_name,
                    'admission_no', v_student.admission_no,
                    'email', v_student.email,
                    'status', 'skipped',
                    'message', 'Student is inactive or archived.'
                );
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
            END IF;

            IF v_student.profile_id IS NOT NULL THEN
                v_results := v_results || jsonb_build_object(
                    'student_id', v_student_id,
                    'student_name', v_student.full_name,
                    'admission_no', v_student.admission_no,
                    'email', v_student.email,
                    'status', 'skipped',
                    'message', 'Portal account is already active and linked.'
                );
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
            END IF;

            -- Generate standardized login identifier
            IF v_student.email IS NOT NULL AND v_student.email != '' THEN
                v_email := lower(trim(v_student.email));
            ELSE
                v_admission_clean := lower(regexp_replace(v_student.admission_no, '[^a-zA-Z0-9]', '', 'g'));
                IF v_admission_clean IS NULL OR v_admission_clean = '' THEN
                    v_admission_clean := 'stu' || substr(replace(v_student_id::text, '-', ''), 1, 6);
                END IF;
                v_email := 'student.' || v_admission_clean || '@islamiapublic.edu.pk';
            END IF;

            -- Provision student via core procedure
            v_res := public.admin_provision_student(v_student_id, v_email, p_default_password);

            v_results := v_results || jsonb_build_object(
                'student_id', v_student_id,
                'student_name', v_student.full_name,
                'admission_no', v_student.admission_no,
                'email', v_email,
                'status', 'success',
                'message', 'Account provisioned successfully.'
            );
            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_results := v_results || jsonb_build_object(
                'student_id', v_student_id,
                'student_name', COALESCE(v_student.full_name, 'Student'),
                'admission_no', COALESCE(v_student.admission_no, 'N/A'),
                'email', v_email,
                'status', 'failed',
                'message', SQLERRM
            );
            v_failed_count := v_failed_count + 1;
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
-- 4. FUNCTION: public.admin_reset_student_password (Secure Password Reset)
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

    -- Update Auth password hash and clear tokens
    UPDATE auth.users 
    SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
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
        p_student_id::text,
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
-- 5. FUNCTION: public.admin_toggle_student_status
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
        p_student_id::text,
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
