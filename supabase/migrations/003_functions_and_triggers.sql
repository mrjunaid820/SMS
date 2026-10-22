-- ==============================================================================
-- 003_functions_and_triggers.sql
-- Atomic Transactions, Sequential ID Generators, Financial Idempotency, and Audit Triggers
-- ==============================================================================

-- 1. ADMISSION NUMBER GENERATOR (ADM-YYYY-XXXX)
CREATE OR REPLACE FUNCTION public.fn_generate_admission_no()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_seq INT;
    v_new_adm VARCHAR;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(admission_no FROM 10)::INT), 0) + 1
    INTO v_seq
    FROM public.students
    WHERE admission_no LIKE 'ADM-' || v_year || '-%';

    v_new_adm := 'ADM-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    RETURN v_new_adm;
END;
$$ LANGUAGE plpgsql;

-- 2. NEXT ROLL NUMBER IN SECTION GENERATOR
CREATE OR REPLACE FUNCTION public.fn_next_roll_no(p_session_id UUID, p_section_id UUID)
RETURNS INT AS $$
DECLARE
    v_next_roll INT;
BEGIN
    SELECT COALESCE(MAX(roll_no), 0) + 1
    INTO v_next_roll
    FROM public.enrollments
    WHERE academic_session_id = p_session_id AND section_id = p_section_id;

    RETURN v_next_roll;
END;
$$ LANGUAGE plpgsql;

-- 3. INVOICE NUMBER GENERATOR (INV-YYYYMM-XXXX)
CREATE OR REPLACE FUNCTION public.fn_generate_invoice_no()
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-';
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM 12)::INT), 0) + 1
    INTO v_seq
    FROM public.fee_invoices
    WHERE invoice_no LIKE v_prefix || '%';

    RETURN v_prefix || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. RECEIPT NUMBER GENERATOR (REC-YYYYMM-XXXX)
CREATE OR REPLACE FUNCTION public.fn_generate_receipt_no()
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR := 'REC-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-';
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(receipt_no FROM 12)::INT), 0) + 1
    INTO v_seq
    FROM public.fee_payments
    WHERE receipt_no LIKE v_prefix || '%';

    RETURN v_prefix || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. TRANSACTIONAL ATOMIC FEE PAYMENT PROCESSING (WITH IDEMPOTENCY)
CREATE OR REPLACE FUNCTION public.fn_process_fee_payment(
    p_invoice_id UUID,
    p_amount NUMERIC(12,2),
    p_payment_method VARCHAR,
    p_reference_no VARCHAR DEFAULT NULL,
    p_recorded_by UUID DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
    v_existing_payment RECORD;
    v_new_payment_id UUID;
    v_receipt_no VARCHAR;
    v_new_paid NUMERIC(12,2);
    v_new_status VARCHAR;
BEGIN
    -- 1. Check idempotency if key provided
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_payment
        FROM public.fee_payments
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'message', 'Payment already processed (idempotent)',
                'payment_id', v_existing_payment.id,
                'receipt_no', v_existing_payment.receipt_no,
                'amount', v_existing_payment.amount
            );
        END IF;
    END IF;

    -- 2. Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    -- 3. Lock invoice row for update
    SELECT * INTO v_invoice
    FROM public.fee_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice with ID % does not exist.', p_invoice_id;
    END IF;

    IF v_invoice.status = 'Cancelled' THEN
        RAISE EXCEPTION 'Cannot accept payments on a cancelled invoice.';
    END IF;

    -- Check overpayment
    IF (v_invoice.paid_amount + p_amount) > v_invoice.net_amount THEN
        RAISE EXCEPTION 'Payment of % exceeds remaining balance of %',
            p_amount, (v_invoice.net_amount - v_invoice.paid_amount);
    END IF;

    -- 4. Generate receipt number & insert payment record
    v_receipt_no := public.fn_generate_receipt_no();
    INSERT INTO public.fee_payments (
        receipt_no,
        invoice_id,
        payment_date,
        amount,
        payment_method,
        reference_no,
        recorded_by,
        idempotency_key
    ) VALUES (
        v_receipt_no,
        p_invoice_id,
        CURRENT_DATE,
        p_amount,
        p_payment_method,
        p_reference_no,
        p_recorded_by,
        p_idempotency_key
    )
    RETURNING id INTO v_new_payment_id;

    -- 5. Update invoice balance and status
    v_new_paid := v_invoice.paid_amount + p_amount;
    IF v_new_paid >= v_invoice.net_amount THEN
        v_new_status := 'Paid';
    ELSE
        v_new_status := 'Partially Paid';
    END IF;

    UPDATE public.fee_invoices
    SET paid_amount = v_new_paid,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- 6. Log in Audit Trail
    INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_recorded_by,
        'PAYMENT_RECORDED',
        'fee_payments',
        v_new_payment_id::TEXT,
        jsonb_build_object(
            'receipt_no', v_receipt_no,
            'invoice_id', p_invoice_id,
            'amount', p_amount,
            'payment_method', p_payment_method,
            'new_invoice_status', v_new_status,
            'new_paid_balance', v_new_paid
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', v_new_payment_id,
        'receipt_no', v_receipt_no,
        'amount', p_amount,
        'invoice_status', v_new_status,
        'remaining_balance', (v_invoice.net_amount - v_new_paid)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRANSACTIONAL PAYMENT REVERSAL / REFUND
CREATE OR REPLACE FUNCTION public.fn_reverse_fee_payment(
    p_payment_id UUID,
    p_reason TEXT,
    p_reversed_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
    v_new_paid NUMERIC(12,2);
    v_new_status VARCHAR;
BEGIN
    -- 1. Lock payment row
    SELECT * INTO v_payment
    FROM public.fee_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record % not found.', p_payment_id;
    END IF;

    IF v_payment.is_reversed THEN
        RAISE EXCEPTION 'This payment has already been reversed.';
    END IF;

    -- 2. Lock invoice row
    SELECT * INTO v_invoice
    FROM public.fee_invoices
    WHERE id = v_payment.invoice_id
    FOR UPDATE;

    -- 3. Mark payment as reversed
    UPDATE public.fee_payments
    SET is_reversed = TRUE
    WHERE id = p_payment_id;

    -- 4. Record reversal audit record
    INSERT INTO public.fee_payment_reversals (
        payment_id,
        amount,
        reason,
        reversed_by
    ) VALUES (
        p_payment_id,
        v_payment.amount,
        p_reason,
        p_reversed_by
    );

    -- 5. Restore invoice balance
    v_new_paid := GREATEST(0.00, v_invoice.paid_amount - v_payment.amount);
    IF v_new_paid = 0.00 THEN
        v_new_status := 'Unpaid';
    ELSE
        v_new_status := 'Partially Paid';
    END IF;

    UPDATE public.fee_invoices
    SET paid_amount = v_new_paid,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_payment.invoice_id;

    -- 6. Log audit event
    INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_reversed_by,
        'PAYMENT_REVERSED',
        'fee_payments',
        p_payment_id::TEXT,
        jsonb_build_object(
            'receipt_no', v_payment.receipt_no,
            'reversed_amount', v_payment.amount,
            'reason', p_reason,
            'invoice_id', v_payment.invoice_id,
            'new_invoice_status', v_new_status,
            'new_paid_balance', v_new_paid
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'receipt_no', v_payment.receipt_no,
        'reversed_amount', v_payment.amount,
        'new_invoice_status', v_new_status,
        'new_paid_balance', v_new_paid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
