-- ==============================================================================
-- 018_student_complaints_and_feedback.sql
-- Student Complaints & Feedback System with Strict Admin-Only Scoping & RLS
-- Islamia Public High School — School Management System
--
-- Security Rules:
-- 1. Students can submit complaints linked only to their authenticated student record.
-- 2. Students can view only their own complaints and public admin responses.
-- 3. Students CANNOT view internal admin notes or modify complaints after submission.
-- 4. Authorized Admins have full access to view, update, respond, and add internal notes.
-- 5. Teachers have ZERO access (no SELECT, no INSERT, no UPDATE, no DELETE).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HELPER FUNCTION: Current Student Record ID
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_student_id()
RETURNS UUID AS $$
DECLARE
    v_student_id UUID;
BEGIN
    SELECT id INTO v_student_id 
    FROM public.students 
    WHERE profile_id = auth.uid() 
      AND is_active = TRUE;
    RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.student_complaints
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_reference VARCHAR(50) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    attachment_path TEXT,
    attachment_name TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
    admin_response TEXT,
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_complaint_category CHECK (
        category IN (
            'Teacher-related Complaint',
            'Classroom Issue',
            'Academic Issue',
            'Examination Issue',
            'Fee-related Issue',
            'School Facilities',
            'Discipline Issue',
            'Bullying or Harassment',
            'Transport Issue',
            'Other'
        )
    ),
    CONSTRAINT chk_complaint_status CHECK (
        status IN (
            'Submitted',
            'Under Review',
            'In Progress',
            'Resolved',
            'Rejected'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_student_complaints_student_id ON public.student_complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_student_complaints_status ON public.student_complaints(status);
CREATE INDEX IF NOT EXISTS idx_student_complaints_category ON public.student_complaints(category);
CREATE INDEX IF NOT EXISTS idx_student_complaints_created_at ON public.student_complaints(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.student_complaint_notes (Internal Administrative Notes)
-- Completely separated from student access to guarantee privacy at database level.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_complaint_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.student_complaints(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_name VARCHAR(255) NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_notes_complaint_id ON public.student_complaint_notes(complaint_id);

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.student_complaint_history (Milestone Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_complaint_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.student_complaints(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    comment TEXT,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    performed_by_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint_id ON public.student_complaint_history(complaint_id);

-- ------------------------------------------------------------------------------
-- 5. FUNCTION & TRIGGER: Generate Sequential Reference Number (e.g. CMP-2026-0001)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_complaint_reference()
RETURNS TRIGGER AS $$
DECLARE
    v_year TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_count INT;
BEGIN
    IF NEW.complaint_reference IS NULL OR NEW.complaint_reference = '' THEN
        SELECT COUNT(*) + 1 INTO v_count
        FROM public.student_complaints
        WHERE complaint_reference LIKE 'CMP-' || v_year || '-%';

        NEW.complaint_reference := 'CMP-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_complaint_reference ON public.student_complaints;
CREATE TRIGGER trg_set_complaint_reference
    BEFORE INSERT OR UPDATE ON public.student_complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.set_complaint_reference();

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.student_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_complaint_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_complaint_history ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- A. POLICIES ON public.student_complaints
-- ==============================================================================

-- 1. Admin full access
DROP POLICY IF EXISTS "Admin full access on student_complaints" ON public.student_complaints;
CREATE POLICY "Admin full access on student_complaints"
    ON public.student_complaints FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 2. Student SELECT own complaints
DROP POLICY IF EXISTS "Students view own complaints" ON public.student_complaints;
CREATE POLICY "Students view own complaints"
    ON public.student_complaints FOR SELECT
    TO authenticated
    USING (
        student_id = public.get_current_student_id()
    );

-- 3. Student INSERT own complaints
DROP POLICY IF EXISTS "Students submit own complaints" ON public.student_complaints;
CREATE POLICY "Students submit own complaints"
    ON public.student_complaints FOR INSERT
    TO authenticated
    WITH CHECK (
        student_id = public.get_current_student_id()
    );

-- (Notice: NO student UPDATE policy. Students cannot alter status, responses, or content once submitted)
-- (Notice: NO teacher policy. In Postgres RLS, default is DENY. Teachers receive zero access.)

-- ==============================================================================
-- B. POLICIES ON public.student_complaint_notes (Admin-only internal notes)
-- ==============================================================================

DROP POLICY IF EXISTS "Admin full access on student_complaint_notes" ON public.student_complaint_notes;
CREATE POLICY "Admin full access on student_complaint_notes"
    ON public.student_complaint_notes FOR ALL
    TO authenticated
    USING (public.is_admin());

-- (Students and Teachers have ZERO access to student_complaint_notes)

-- ==============================================================================
-- C. POLICIES ON public.student_complaint_history
-- ==============================================================================

-- 1. Admin full access
DROP POLICY IF EXISTS "Admin full access on student_complaint_history" ON public.student_complaint_history;
CREATE POLICY "Admin full access on student_complaint_history"
    ON public.student_complaint_history FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 2. Student SELECT non-internal history for own complaints
DROP POLICY IF EXISTS "Students view own non-internal complaint history" ON public.student_complaint_history;
CREATE POLICY "Students view own non-internal complaint history"
    ON public.student_complaint_history FOR SELECT
    TO authenticated
    USING (
        is_internal = FALSE AND
        complaint_id IN (
            SELECT id FROM public.student_complaints 
            WHERE student_id = public.get_current_student_id()
        )
    );

-- (Teachers have ZERO access to student_complaint_history)

-- ------------------------------------------------------------------------------
-- 7. SEED INITIAL SAMPLE COMPLAINT DATA FOR VERIFICATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_admin_id UUID;
    v_student_id UUID;
    v_comp1_id UUID;
    v_comp2_id UUID;
BEGIN
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    SELECT id INTO v_student_id FROM public.students WHERE admission_no = 'ADM-2025-0001' LIMIT 1;

    IF v_student_id IS NOT NULL THEN
        -- Sample 1: Resolved Library Complaint
        INSERT INTO public.student_complaints (
            complaint_reference,
            student_id,
            subject,
            category,
            description,
            status,
            admin_response,
            reviewed_by,
            resolved_at,
            created_at,
            updated_at
        ) VALUES (
            'CMP-2026-0001',
            v_student_id,
            'Request for additional Physics textbook copies in library',
            'School Facilities',
            'The Class 9 Physics textbooks in the central library are insufficient during exam preparation week. Kindly arrange 5 additional copies.',
            'Resolved',
            'The library committee has procured 6 new copies of the textbook, now available in Section B of the senior reading hall.',
            v_admin_id,
            now() - interval '2 days',
            now() - interval '5 days',
            now() - interval '2 days'
        )
        ON CONFLICT (complaint_reference) DO NOTHING
        RETURNING id INTO v_comp1_id;

        IF v_comp1_id IS NOT NULL THEN
            INSERT INTO public.student_complaint_history (
                complaint_id, action, status, comment, is_internal, performed_by, performed_by_name, created_at
            ) VALUES
            (v_comp1_id, 'Submitted', 'Submitted', 'Complaint submitted via Student Portal', FALSE, NULL, 'Muhammad Hamza Khan', now() - interval '5 days'),
            (v_comp1_id, 'Status Changed to In Progress', 'In Progress', 'Forwarded to Library Incharge', FALSE, v_admin_id, 'Principal Malik', now() - interval '4 days'),
            (v_comp1_id, 'Status Changed to Resolved', 'Resolved', 'Procurement complete', FALSE, v_admin_id, 'Principal Malik', now() - interval '2 days');

            INSERT INTO public.student_complaint_notes (
                complaint_id, admin_id, admin_name, note, created_at
            ) VALUES
            (v_comp1_id, v_admin_id, 'Principal Malik', 'Approved budget Rs. 4,500 from school discretionary maintenance fund.', now() - interval '4 days');
        END IF;

        -- Sample 2: In Progress Classroom Fan Issue
        INSERT INTO public.student_complaints (
            complaint_reference,
            student_id,
            subject,
            category,
            description,
            status,
            admin_response,
            reviewed_by,
            created_at,
            updated_at
        ) VALUES (
            'CMP-2026-0002',
            v_student_id,
            'Class 9-A ceiling fan making loud noise',
            'Classroom Issue',
            'The rear ceiling fan in Classroom 102 (Class 9-A) vibrates loudly and distracts the lecture.',
            'Under Review',
            'Maintenance team has scheduled electrical inspection today after 2:00 PM.',
            v_admin_id,
            now() - interval '1 day',
            now() - interval '4 hours'
        )
        ON CONFLICT (complaint_reference) DO NOTHING
        RETURNING id INTO v_comp2_id;

        IF v_comp2_id IS NOT NULL THEN
            INSERT INTO public.student_complaint_history (
                complaint_id, action, status, comment, is_internal, performed_by, performed_by_name, created_at
            ) VALUES
            (v_comp2_id, 'Submitted', 'Submitted', 'Complaint submitted via Student Portal', FALSE, NULL, 'Muhammad Hamza Khan', now() - interval '1 day'),
            (v_comp2_id, 'Status Changed to Under Review', 'Under Review', 'Inspection ticket issued to electrician', FALSE, v_admin_id, 'Principal Malik', now() - interval '4 hours');
        END IF;
    END IF;
END $$;
