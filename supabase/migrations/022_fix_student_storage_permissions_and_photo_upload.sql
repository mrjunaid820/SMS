-- ==============================================================================
-- 022_fix_student_storage_permissions_and_photo_upload.sql
-- Noor-Ul-Ilm School System — Supabase Storage RLS Permissions & Student Photo Management
-- ==============================================================================

-- 1. STORAGE BUCKET CONFIGURATION FOR STUDENT AVATARS
-- Ensures 'student-avatars' bucket exists with public read access, 5MB file limit, and allowed image MIME types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-avatars',
    'student-avatars',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. SECURITY DEFINER HELPER FUNCTIONS
-- Standardized functions for secure role checks without search path vulnerabilities
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'student' AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_student_id()
RETURNS UUID AS $$
DECLARE
    v_student_id UUID;
BEGIN
    SELECT id INTO v_student_id 
    FROM public.students 
    WHERE profile_id = auth.uid() 
    LIMIT 1;
    
    RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_current_student_id() TO authenticated, anon;

-- 3. STORAGE ROW LEVEL SECURITY (RLS) POLICIES ON storage.objects
-- Drop previous policies to eliminate conflicting or broken checks
DROP POLICY IF EXISTS "Public can view student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users upload student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users update student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users delete student avatars" ON storage.objects;

-- A. SELECT: Public read access for student avatars (needed for student ID cards and portal display)
CREATE POLICY "Public read student avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'student-avatars');

-- B. INSERT: Admins can upload for any student; Students can upload ONLY for their own student record
CREATE POLICY "Authorized users upload student avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'student-avatars'
        AND (
            -- Administrators have full authority to upload photos for any student
            public.is_admin()
            -- Students can only upload into their own student path (avatars/{student_id}-... or {student_id}-...)
            OR (
                public.is_student()
                AND public.get_current_student_id() IS NOT NULL
                AND (
                    name LIKE 'avatars/' || public.get_current_student_id()::text || '-%'
                    OR name LIKE 'avatars/' || public.get_current_student_id()::text || '/%'
                    OR name LIKE public.get_current_student_id()::text || '-%'
                )
            )
        )
    );

-- C. UPDATE: Admins can update/replace any avatar; Students can replace ONLY their own avatar
CREATE POLICY "Authorized users update student avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'student-avatars'
        AND (
            public.is_admin()
            OR (
                public.is_student()
                AND public.get_current_student_id() IS NOT NULL
                AND (
                    name LIKE 'avatars/' || public.get_current_student_id()::text || '-%'
                    OR name LIKE 'avatars/' || public.get_current_student_id()::text || '/%'
                    OR name LIKE public.get_current_student_id()::text || '-%'
                )
            )
        )
    )
    WITH CHECK (
        bucket_id = 'student-avatars'
        AND (
            public.is_admin()
            OR (
                public.is_student()
                AND public.get_current_student_id() IS NOT NULL
                AND (
                    name LIKE 'avatars/' || public.get_current_student_id()::text || '-%'
                    OR name LIKE 'avatars/' || public.get_current_student_id()::text || '/%'
                    OR name LIKE public.get_current_student_id()::text || '-%'
                )
            )
        )
    );

-- D. DELETE: Admins can delete student avatars; Students can delete ONLY their own avatar
CREATE POLICY "Authorized users delete student avatars"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'student-avatars'
        AND (
            public.is_admin()
            OR (
                public.is_student()
                AND public.get_current_student_id() IS NOT NULL
                AND (
                    name LIKE 'avatars/' || public.get_current_student_id()::text || '-%'
                    OR name LIKE 'avatars/' || public.get_current_student_id()::text || '/%'
                    OR name LIKE public.get_current_student_id()::text || '-%'
                )
            )
        )
    );

-- 4. STUDENTS TABLE RLS POLICY FOR PHOTO_URL UPDATES
DROP POLICY IF EXISTS "Students can update own photo_url" ON public.students;
CREATE POLICY "Students can update own photo_url"
    ON public.students FOR UPDATE
    TO authenticated
    USING (
        public.is_admin() OR profile_id = auth.uid()
    )
    WITH CHECK (
        public.is_admin() OR profile_id = auth.uid()
    );

-- 5. TRIGGER: ENFORCE RESTRICTION THAT STUDENTS CAN ONLY UPDATE photo_url
CREATE OR REPLACE FUNCTION public.enforce_student_photo_only_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Direct database operations, migrations, and service_role have full authority
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Administrators retain full administrative authority
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- If caller is a student updating their own record, verify protected demographic/academic fields are unchanged
    IF (
        OLD.full_name IS DISTINCT FROM NEW.full_name OR
        OLD.admission_no IS DISTINCT FROM NEW.admission_no OR
        OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth OR
        OLD.gender IS DISTINCT FROM NEW.gender OR
        OLD.b_form_or_cnic IS DISTINCT FROM NEW.b_form_or_cnic OR
        OLD.admission_date IS DISTINCT FROM NEW.admission_date OR
        OLD.guardian_name IS DISTINCT FROM NEW.guardian_name OR
        OLD.guardian_relation IS DISTINCT FROM NEW.guardian_relation OR
        OLD.guardian_cnic IS DISTINCT FROM NEW.guardian_cnic OR
        OLD.guardian_phone IS DISTINCT FROM NEW.guardian_phone OR
        OLD.emergency_contact IS DISTINCT FROM NEW.emergency_contact OR
        OLD.address IS DISTINCT FROM NEW.address OR
        OLD.blood_group IS DISTINCT FROM NEW.blood_group OR
        OLD.is_active IS DISTINCT FROM NEW.is_active OR
        OLD.profile_id IS DISTINCT FROM NEW.profile_id OR
        OLD.email IS DISTINCT FROM NEW.email
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Students are only permitted to update their profile picture.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_student_photo_only_update ON public.students;
CREATE TRIGGER trg_enforce_student_photo_only_update
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_student_photo_only_update();
