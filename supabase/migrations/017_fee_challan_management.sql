-- 017_fee_challan_management.sql
-- Professional School Management System (PostgreSQL 15+ / Supabase)
-- Fee Challan Management, Discounts, Waivers, Adjustments & Audit Integrity
-- ==============================================================================

-- 1. ADD COLUMNS FOR DISCOUNTS, WAIVERS & NOTES
ALTER TABLE public.fee_invoices 
ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage', 'waiver')),
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
ADD COLUMN IF NOT EXISTS discount_reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.fee_invoice_items 
ADD COLUMN IF NOT EXISTS is_waived BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2);

-- 2. FUNCTION: public.admin_update_fee_challan
-- Safely updates fee challan particulars, discounts, and recalculates net payable
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_fee_challan(
    p_invoice_id UUID,
    p_due_date DATE,
    p_notes TEXT,
    p_discount_type VARCHAR(20),
    p_discount_percentage NUMERIC(5,2),
    p_discount_amount NUMERIC(12,2),
    p_discount_reason TEXT,
    p_adjustment_reason TEXT,
    p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_total_amount NUMERIC(12,2) := 0.00;
    v_discount_amount NUMERIC(12,2) := 0.00;
    v_net_amount NUMERIC(12,2) := 0.00;
    v_new_status VARCHAR(20);
    v_item RECORD;
    v_elem JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to modify fee challans.';
    END IF;

    SELECT * INTO v_inv FROM public.fee_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fee invoice not found in database.';
    END IF;

    -- Calculate total amount from item array
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF (v_elem->>'amount')::NUMERIC < 0 THEN
            RAISE EXCEPTION 'Fee item amount cannot be negative.';
        END IF;
        v_total_amount := v_total_amount + (v_elem->>'amount')::NUMERIC;
    END LOOP;

    -- Compute discount amount
    IF p_discount_type = 'percentage' THEN
        IF p_discount_percentage < 0 OR p_discount_percentage > 100 THEN
            RAISE EXCEPTION 'Discount percentage must be between 0 and 100.';
        END IF;
        v_discount_amount := round((p_discount_percentage / 100.0) * v_total_amount, 2);
    ELSIF p_discount_type = 'waiver' THEN
        v_discount_amount := v_total_amount;
    ELSE
        v_discount_amount := COALESCE(p_discount_amount, 0.00);
    END IF;

    IF v_discount_amount < 0 THEN
        RAISE EXCEPTION 'Discount amount cannot be negative.';
    END IF;
    IF v_discount_amount > v_total_amount THEN
        RAISE EXCEPTION 'Discount amount (Rs. %) cannot exceed eligible total fee (Rs. %).', v_discount_amount, v_total_amount;
    END IF;

    v_net_amount := v_total_amount - v_discount_amount;

    -- Check constraint protection: net_amount cannot be less than already paid amount
    IF v_net_amount < v_inv.paid_amount THEN
        RAISE EXCEPTION 'Cannot reduce payable amount (Rs. %) below already paid amount (Rs. %). Please reverse excess payments before adjusting challan.', v_net_amount, v_inv.paid_amount;
    END IF;

    -- Compute status
    IF v_net_amount = 0.00 THEN
        v_new_status := 'Paid';
    ELSIF v_inv.paid_amount >= v_net_amount THEN
        v_new_status := 'Paid';
    ELSIF v_inv.paid_amount > 0 THEN
        v_new_status := 'Partially Paid';
    ELSE
        IF p_due_date < CURRENT_DATE THEN
            v_new_status := 'Overdue';
        ELSE
            v_new_status := 'Unpaid';
        END IF;
    END IF;

    -- Update invoice master
    UPDATE public.fee_invoices
    SET due_date = p_due_date,
        total_amount = v_total_amount,
        discount_type = p_discount_type,
        discount_percentage = COALESCE(p_discount_percentage, 0.00),
        discount_amount = v_discount_amount,
        discount_reason = p_discount_reason,
        net_amount = v_net_amount,
        status = v_new_status,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- Recreate line items
    DELETE FROM public.fee_invoice_items WHERE invoice_id = p_invoice_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.fee_invoice_items (
            id,
            invoice_id,
            description,
            amount,
            is_waived,
            original_amount,
            created_at
        ) VALUES (
            gen_random_uuid(),
            p_invoice_id,
            v_elem->>'description',
            (v_elem->>'amount')::NUMERIC,
            COALESCE((v_elem->>'is_waived')::BOOLEAN, false),
            (v_elem->>'original_amount')::NUMERIC,
            NOW()
        );
    END LOOP;

    -- Audit trail
    INSERT INTO public.audit_logs (
        id, actor_id, actor_name, action, entity_type, entity_id, details, ip_address, created_at
    ) VALUES (
        gen_random_uuid(),
        auth.uid(),
        'Administrator',
        'CHALLAN_FINANCIALLY_ADJUSTED',
        'fee_invoices',
        p_invoice_id::text,
        jsonb_build_object(
            'invoice_no', v_inv.invoice_no,
            'previous_total', v_inv.total_amount,
            'new_total', v_total_amount,
            'previous_net', v_inv.net_amount,
            'new_net', v_net_amount,
            'discount_type', p_discount_type,
            'discount_amount', v_discount_amount,
            'discount_reason', p_discount_reason,
            'adjustment_reason', p_adjustment_reason
        ),
        '127.0.0.1',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_no', v_inv.invoice_no,
        'total_amount', v_total_amount,
        'discount_amount', v_discount_amount,
        'net_amount', v_net_amount,
        'paid_amount', v_inv.paid_amount,
        'remaining_balance', v_net_amount - v_inv.paid_amount,
        'status', v_new_status,
        'message', format('Challan %s updated successfully. Final payable: Rs. %s', v_inv.invoice_no, v_net_amount)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- 3. FUNCTION: public.admin_delete_fee_challan
-- Safely deletes a fee challan if no payments exist, protecting financial ledger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_fee_challan(
    p_invoice_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_payment_count INT := 0;
    v_paid_total NUMERIC(12,2) := 0.00;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to delete fee challans.';
    END IF;

    SELECT * INTO v_inv FROM public.fee_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fee invoice not found in database.';
    END IF;

    -- Count active payments
    SELECT count(*), COALESCE(sum(amount), 0.00) 
    INTO v_payment_count, v_paid_total
    FROM public.fee_payments 
    WHERE invoice_id = p_invoice_id AND is_reversed = FALSE;

    IF v_payment_count > 0 OR v_inv.paid_amount > 0 THEN
        RAISE EXCEPTION 'Permanent Deletion Blocked: Challan % has active payments (Rs. % paid across % receipts). Permanent deletion is blocked to protect accounting integrity. Please void or cancel the challan instead.',
            v_inv.invoice_no, v_paid_total, v_payment_count;
    END IF;

    -- Delete items
    DELETE FROM public.fee_invoice_items WHERE invoice_id = p_invoice_id;

    -- Delete invoice
    DELETE FROM public.fee_invoices WHERE id = p_invoice_id;

    -- Audit log
    INSERT INTO public.audit_logs (
        id, actor_id, actor_name, action, entity_type, entity_id, details, ip_address, created_at
    ) VALUES (
        gen_random_uuid(),
        auth.uid(),
        'Administrator',
        'CHALLAN_PERMANENTLY_DELETED',
        'fee_invoices',
        p_invoice_id::text,
        jsonb_build_object(
            'invoice_no', v_inv.invoice_no,
            'total_amount', v_inv.total_amount,
            'net_amount', v_inv.net_amount,
            'billing_month', v_inv.billing_month
        ),
        '127.0.0.1',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_no', v_inv.invoice_no,
        'message', format('Fee challan %s has been permanently deleted.', v_inv.invoice_no)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- 4. FUNCTION: public.admin_cancel_fee_challan
-- Voids/cancels a fee challan when permanent deletion is blocked by payment history
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cancel_fee_challan(
    p_invoice_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by administrator'
)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_reason TEXT := COALESCE(NULLIF(trim(p_reason), ''), 'Cancelled by administrator');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only school administrators are authorized to cancel fee challans.';
    END IF;

    SELECT * INTO v_inv FROM public.fee_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fee invoice not found in database.';
    END IF;

    UPDATE public.fee_invoices
    SET status = 'Cancelled',
        notes = COALESCE(notes || ' | ', '') || 'Cancelled: ' || v_reason,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    INSERT INTO public.audit_logs (
        id, actor_id, actor_name, action, entity_type, entity_id, details, ip_address, created_at
    ) VALUES (
        gen_random_uuid(),
        auth.uid(),
        'Administrator',
        'CHALLAN_CANCELLED',
        'fee_invoices',
        p_invoice_id::text,
        jsonb_build_object(
            'invoice_no', v_inv.invoice_no,
            'reason', v_reason,
            'paid_amount', v_inv.paid_amount
        ),
        '127.0.0.1',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_no', v_inv.invoice_no,
        'message', format('Fee challan %s has been cancelled/voided.', v_inv.invoice_no)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;


-- 5. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_update_fee_challan TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_fee_challan TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_fee_challan TO authenticated;
