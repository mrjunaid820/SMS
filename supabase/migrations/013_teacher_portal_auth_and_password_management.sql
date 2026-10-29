-- ==============================================================================
-- 013_teacher_portal_auth_and_password_management.sql
-- Complete Teacher Authentication, Portal Provisioning & Privileged Password Management
-- 
-- Key Features:
-- 1. Automatic sync of existing teachers into auth.users & auth.identities
-- 2. admin_provision_teacher (Atomic provisioning with bcrypt password & GoTrue identity)
-- 3. admin_reset_teacher_password (Admin-controlled password reset without service-role exposure)
-- 4. admin_bulk_provision_teachers (Batch provisioning for faculty staff)
-- 5. admin_toggle_teacher_status (Synchronous active status toggle)
-- 6. Strict public.is_admin() server-side authorization enforcement
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SELF-HEALING & MIGRATION SYNC FOR ALL EXISTING TEACHERS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r_teacher RECORD;
    v_user_id UUID;
    v_clean_email TEXT;
BEGIN
    FOR r_teacher IN 
        SELECT id, employee_id, full_name, phone, email, is_active, profile_id
        FROM public.teachers
        WHERE email IS NOT NULL AND email != ''
    LOOP
        v_clean_email := lower(trim(r_teacher.email));
        
        -- Check if an auth.users record already exists with this email
        SELECT id INTO v_user_id 
        FROM auth.users 
        WHERE lower(email) = v_clean_email;

        IF v_user_id IS NOT NULL THEN
            -- User exists in auth.users: ensure clean GoTrue tokens & metadata
            UPDATE auth.users
            SET confirmation_token = COALESCE(confirmation_token, ''),
                recovery_token = COALESCE(recovery_token, ''),
                email_change_token_new = COALESCE(email_change_token_new, ''),
                email_change = COALESCE(email_change, ''),
                email_confirmed_at = COALESCE(email_confirmed_at, now()),
                raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
                raw_user_meta_data = jsonb_build_object('role', 'teacher', 'full_name', trim(r_teacher.full_name)),
                updated_at = now()
            WHERE id = v_user_id;

            -- Upsert auth.identities record with provider_id = clean_email
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

            -- Update existing identity if provider_id was wrong
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
            -- No auth user exists: Create a new Auth account with standard Teacher123! password
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
                crypt('Teacher123!', gen_salt('bf', 10)),
                now(),
                'authenticated',
                'authenticated',
                '{"provider": "email", "providers": ["email"]}'::jsonb,
                jsonb_build_object('role', 'teacher', 'full_name', trim(r_teacher.full_name)),
                '',
                '',
                '',
                '',
                now(),
                now()
            );

            -- Insert identity record
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

        -- Upsert into public.profiles
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
            'teacher',
            trim(r_teacher.full_name),
            v_clean_email,
            r_teacher.phone,
            r_teacher.is_active,
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            role = 'teacher',
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            is_active = EXCLUDED.is_active,
            updated_at = now();

        -- Link teacher profile_id
        UPDATE public.teachers
        SET profile_id = v_user_id,
            email = v_clean_email
        WHERE id = r_teacher.id;
    END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 2. FUNCTION: public.admin_provision_teacher
-- Safely provisions a teacher portal account with role='teacher' and GoTrue identity
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_provision_teacher(
    p_teacher_id UUID,
    p_email TEXT,
    p_password TEXT DEFAULT 'Teacher123!'
)
RETURNS JSONB AS $$
DECLARE
    v_teacher RECORD;
    v_clean_email TEXT;
    v_existing_user_id UUID;
    v_user_id UUID;
    v_existing_profile RECORD;
BEGIN
    -- 1. Authorization: Only school administrators can provision teacher accounts
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to provision teacher portal accounts.';
    END IF;

    -- 2. Input validation
    v_clean_email := lower(trim(p_email));
    IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
        RAISE EXCEPTION 'Validation Error: A valid email address is required (e.g. teacher.name@islamiapublic.edu.pk).';
    END IF;

    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Validation Error: Initial password must be at least 6 characters in length.';
    END IF;

    -- 3. Retrieve teacher record
    SELECT * INTO v_teacher 
    FROM public.teachers 
    WHERE id = p_teacher_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher record not found in database (ID: %).', p_teacher_id;
    END IF;

    IF NOT v_teacher.is_active THEN
        RAISE EXCEPTION 'Cannot provision portal account for an inactive teacher.';
    END IF;

    -- 4. Check for existing auth user with requested email
    SELECT id INTO v_existing_user_id 
    FROM auth.users 
    WHERE lower(email) = v_clean_email;

    IF v_existing_user_id IS NOT NULL THEN
        -- Prevent stealing another teacher's account
        IF EXISTS (SELECT 1 FROM public.teachers WHERE profile_id = v_existing_user_id AND id != p_teacher_id) THEN
            RAISE EXCEPTION 'Conflict Error: Email address "%" is already linked to another teacher record.', v_clean_email;
        END IF;

        -- Prevent claiming admin or student accounts
        SELECT * INTO v_existing_profile FROM public.profiles WHERE id = v_existing_user_id;
        IF FOUND AND v_existing_profile.role != 'teacher' THEN
            RAISE EXCEPTION 'Conflict Error: Email address "%" is already registered to a % account.', v_clean_email, v_existing_profile.role;
        END IF;

        -- Update existing auth user password and tokens
        v_user_id := v_existing_user_id;
        UPDATE auth.users 
        SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = jsonb_build_object('role', 'teacher', 'full_name', trim(v_teacher.full_name)),
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            updated_at = now()
        WHERE id = v_user_id;

        -- Upsert identity
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
        -- Create new Auth user with UUID id
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
            jsonb_build_object('role', 'teacher', 'full_name', trim(v_teacher.full_name)),
            '',
            '',
            '',
            '',
            now(),
            now()
        );

        -- Insert identity record
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

    -- Upsert into public.profiles
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
        'teacher',
        trim(v_teacher.full_name),
        v_clean_email,
        v_teacher.phone,
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'teacher',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        is_active = true,
        updated_at = now();

    -- Link to public.teachers
    UPDATE public.teachers 
    SET profile_id = v_user_id,
        email = v_clean_email
    WHERE id = p_teacher_id;

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
        'TEACHER_PORTAL_ACCOUNT_PROVISIONED',
        'teachers',
        p_teacher_id::text,
        jsonb_build_object(
            'profile_id', v_user_id,
            'email', v_clean_email,
            'employee_id', v_teacher.employee_id,
            'teacher_name', v_teacher.full_name
        ),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_email,
        'teacher_id', p_teacher_id,
        'full_name', v_teacher.full_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 3. FUNCTION: public.admin_reset_teacher_password
-- Privileged password reset by school administrator without service-role key
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_teacher_password(
    p_teacher_id UUID,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_teacher RECORD;
    v_user_id UUID;
BEGIN
    -- 1. Authorization: Only school administrators can reset teacher passwords
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to reset teacher passwords.';
    END IF;

    -- 2. Input validation
    IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Validation Error: Password must be at least 6 characters in length.';
    END IF;

    -- 3. Retrieve teacher record
    SELECT * INTO v_teacher 
    FROM public.teachers 
    WHERE id = p_teacher_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher record not found.';
    END IF;

    v_user_id := v_teacher.profile_id;
    IF v_user_id IS NULL THEN
        -- If profile_id is not set, attempt to find user by email
        IF v_teacher.email IS NOT NULL THEN
            SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(v_teacher.email));
            IF v_user_id IS NOT NULL THEN
                UPDATE public.teachers SET profile_id = v_user_id WHERE id = p_teacher_id;
            END IF;
        END IF;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Teacher % does not have a provisioned portal account. Please provision the account first.', v_teacher.full_name;
    END IF;

    -- 4. Update Auth password hash and clear confirmation/recovery tokens
    UPDATE auth.users 
    SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;

    -- 5. Ensure identity record exists and is synced
    IF v_teacher.email IS NOT NULL THEN
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
                'email', lower(trim(v_teacher.email)),
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            lower(trim(v_teacher.email)),
            now(),
            now(),
            now()
        )
        ON CONFLICT DO NOTHING;

        UPDATE auth.identities
        SET provider_id = lower(trim(v_teacher.email)),
            updated_at = now()
        WHERE user_id = v_user_id AND provider = 'email';
    END IF;

    -- 6. Audit log
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
        'TEACHER_PORTAL_PASSWORD_RESET',
        'teachers',
        p_teacher_id::text,
        jsonb_build_object('profile_id', v_user_id, 'email', v_teacher.email, 'teacher_name', v_teacher.full_name),
        '127.0.0.1',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password updated successfully. Teacher can log in immediately.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 4. FUNCTION: public.admin_bulk_provision_teachers
-- Batch provisions portal accounts for multiple teachers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_provision_teachers(
    p_teacher_ids UUID[],
    p_default_password TEXT DEFAULT 'Teacher123!'
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
    v_generated_email TEXT;
BEGIN
    -- 1. Authorization check
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators can perform bulk teacher provisioning.';
    END IF;

    -- 2. Process each teacher
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

        -- If already provisioned, skip
        IF v_teacher.profile_id IS NOT NULL THEN
            v_skipped_count := v_skipped_count + 1;
            v_results := v_results || jsonb_build_object(
                'teacher_id', v_teacher_id,
                'status', 'skipped',
                'message', 'Teacher already provisioned'
            );
            CONTINUE;
        END IF;

        -- Determine or generate email
        IF v_teacher.email IS NOT NULL AND v_teacher.email != '' THEN
            v_generated_email := lower(trim(v_teacher.email));
        ELSE
            v_generated_email := lower(regexp_replace(v_teacher.full_name, '[^a-zA-Z0-9]', '', 'g')) || '@islamiapublic.edu.pk';
        END IF;

        BEGIN
            v_res := public.admin_provision_teacher(v_teacher_id, v_generated_email, p_default_password);
            v_success_count := v_success_count + 1;
            v_results := v_results || jsonb_build_object(
                'teacher_id', v_teacher_id,
                'status', 'success',
                'email', v_generated_email,
                'full_name', v_teacher.full_name
            );
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_results := v_results || jsonb_build_object(
                'teacher_id', v_teacher_id,
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
-- 5. FUNCTION: public.admin_toggle_teacher_status
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_toggle_teacher_status(
    p_teacher_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_teacher RECORD;
    v_new_active BOOLEAN;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators are authorized to modify teacher status.';
    END IF;

    SELECT * INTO v_teacher FROM public.teachers WHERE id = p_teacher_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher record not found.';
    END IF;

    v_new_active := NOT v_teacher.is_active;

    UPDATE public.teachers 
    SET is_active = v_new_active
    WHERE id = p_teacher_id;

    IF v_teacher.profile_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET is_active = v_new_active,
            updated_at = now()
        WHERE id = v_teacher.profile_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'teacher_id', p_teacher_id,
        'is_active', v_new_active,
        'message', CASE WHEN v_new_active THEN 'Teacher activated successfully.' ELSE 'Teacher deactivated.' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- ------------------------------------------------------------------------------
-- 6. GRANT EXECUTE ON ALL ADMIN FUNCTIONS TO AUTHENTICATED
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_provision_teacher TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_teacher_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_provision_teachers TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_teacher_status TO authenticated;
