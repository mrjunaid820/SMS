-- ==============================================================================
-- 009_student_avatar_update_policy.sql
-- Additive Migration: Restrict student profile modifications exclusively to photo_url
-- Enforces storage bucket policies and database-level trigger restrictions
-- ==============================================================================

-- 1. STORAGE BUCKET CONFIGURATION FOR STUDENT AVATARS
-- Ensures the 'student-avatars' storage bucket exists for profile photo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-avatars', 'student-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. STORAGE ROW LEVEL SECURITY (RLS) POLICIES
-- A. Public read access to student avatars
DROP POLICY IF EXISTS "Public can view student avatars" ON storage.objects;
CREATE POLICY "Public can view student avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'student-avatars');

-- B. Authenticated students can upload avatar images into student-avatars bucket
DROP POLICY IF EXISTS "Authenticated users can upload student avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload student avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'student-avatars'
        AND (
            (auth.jwt() ->> 'role') = 'student'
            OR public.is_admin()
        )
    );

-- C. Authenticated students can update or replace their avatars
DROP POLICY IF EXISTS "Authenticated users can update student avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update student avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'student-avatars'
        AND (
            (auth.jwt() ->> 'role') = 'student'
            OR public.is_admin()
        )
    );

-- 3. STUDENTS TABLE ROW LEVEL SECURITY (RLS) POLICY FOR SELF-UPDATE
-- Allows students to UPDATE only their own student record (profile_id = auth.uid())
DROP POLICY IF EXISTS "Students can update own photo_url" ON public.students;
CREATE POLICY "Students can update own photo_url"
    ON public.students FOR UPDATE
    TO authenticated
    USING (
        profile_id = auth.uid() OR public.is_admin()
    )
    WITH CHECK (
        profile_id = auth.uid() OR public.is_admin()
    );

-- 4. DATABASE TRIGGER: ENFORCE RESTRICTION THAT STUDENTS CAN ONLY UPDATE photo_url
-- Protects all identity, bio, academic, and guardian fields from tampering by students
CREATE OR REPLACE FUNCTION public.enforce_student_photo_only_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Direct database operations, migrations, and service_role (auth.uid() IS NULL) have full authority
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Administrators retain full administrative update authority
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- If caller is a student updating their own record, verify protected fields are unchanged
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_student_photo_only_update ON public.students;
CREATE TRIGGER trg_enforce_student_photo_only_update
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_student_photo_only_update();
