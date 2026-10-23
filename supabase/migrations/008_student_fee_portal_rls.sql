-- ==============================================================================
-- 008_student_fee_portal_rls.sql
-- Additive Row Level Security (RLS) policies for Student Fee Portal
-- Enforces that students can ONLY view their own fee invoices, invoice items, and payments
-- ==============================================================================

-- 1. STUDENT FEE INVOICES ACCESS POLICY
-- Enables students to SELECT only fee invoices assigned to their active enrollment(s)
DROP POLICY IF EXISTS "Students can view own fee invoices" ON public.fee_invoices;
CREATE POLICY "Students can view own fee invoices"
    ON public.fee_invoices FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        )
    );

-- 2. STUDENT FEE INVOICE ITEMS ACCESS POLICY
-- Enables students to SELECT particulars and itemized fee breakdowns for their own invoices
DROP POLICY IF EXISTS "Students can view own fee invoice items" ON public.fee_invoice_items;
CREATE POLICY "Students can view own fee invoice items"
    ON public.fee_invoice_items FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR invoice_id IN (
            SELECT fi.id FROM public.fee_invoices fi
            JOIN public.enrollments e ON e.id = fi.enrollment_id
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        )
    );

-- 3. STUDENT FEE PAYMENTS ACCESS POLICY
-- Enables students to SELECT recorded payment receipts for their own invoices
DROP POLICY IF EXISTS "Students can view own fee payments" ON public.fee_payments;
CREATE POLICY "Students can view own fee payments"
    ON public.fee_payments FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR invoice_id IN (
            SELECT fi.id FROM public.fee_invoices fi
            JOIN public.enrollments e ON e.id = fi.enrollment_id
            JOIN public.students s ON s.id = e.student_id
            WHERE s.profile_id = auth.uid()
        )
    );

-- 4. PERFORMANCE & SCOPING INDEXES
CREATE INDEX IF NOT EXISTS idx_fee_invoices_enrollment_id ON public.fee_invoices(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_invoice_id ON public.fee_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoice_items_invoice_id ON public.fee_invoice_items(invoice_id);
