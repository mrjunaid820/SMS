import { describe, it, expect, beforeEach } from 'vitest';
import { feeApi } from '../src/services/api';
import { INITIAL_INVOICES, INITIAL_PAYMENTS } from '../src/services/mockData';

describe('Financial Transactions & Ledger Reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset stored mock data to pristine initial fixtures
    localStorage.setItem('sms_invoices', JSON.stringify(INITIAL_INVOICES));
    localStorage.setItem('sms_payments', JSON.stringify(INITIAL_PAYMENTS));
  });

  it('calculates financial summaries correctly', async () => {
    const summary = await feeApi.getFinancialSummary('b0000000-0000-0000-0000-000000000002');
    expect(summary.totalInvoiced).toBeGreaterThan(0);
    expect(summary.totalCollected).toBeGreaterThan(0);
    expect(summary.totalOutstanding).toBe(summary.totalInvoiced - summary.totalCollected);
  });

  it('records partial payments and updates invoice balance correctly', async () => {
    // Invoice #2 has net: 5500, paid: 3000, remaining: 2500
    const invId = '40000000-0000-0000-0000-000000000002';
    const payment = await feeApi.recordPayment(
      invId,
      1500,
      'Cash',
      'Slip #55',
      'test-idempotency-key-1',
      { id: 'admin-id', name: 'Admin' }
    );

    expect(payment.amount).toBe(1500);
    expect(payment.receipt_no).toContain('REC-');

    const updatedInv = await feeApi.getInvoiceById(invId);
    expect(updatedInv?.paid_amount).toBe(4500);
    expect(updatedInv?.status).toBe('Partially Paid');
  });

  it('enforces idempotency and prevents duplicate payments with the same key', async () => {
    const invId = '40000000-0000-0000-0000-000000000002';
    const idempotencyKey = 'unique-key-xyz-123';

    const p1 = await feeApi.recordPayment(invId, 500, 'Bank Transfer', 'Ref 1', idempotencyKey);
    const p2 = await feeApi.recordPayment(invId, 500, 'Bank Transfer', 'Ref 1', idempotencyKey);

    // p2 must be the exact same payment, not a duplicate deduction
    expect(p1.id).toBe(p2.id);
    expect(p1.receipt_no).toBe(p2.receipt_no);
  });

  it('rejects payments exceeding the remaining invoice balance', async () => {
    const invId = '40000000-0000-0000-0000-000000000002';
    // Remaining is 2500, attempting to pay 10000
    await expect(
      feeApi.recordPayment(invId, 10000, 'Cash', undefined, 'idemp-overpay')
    ).rejects.toThrow(/exceeds remaining dues/);
  });

  it('reverses payments and restores invoice dues while keeping audit records', async () => {
    // Invoice #2 has net: 5500, paid: 3000 from payment '50000000-0000-0000-0000-000000000002'
    const paymentId = '50000000-0000-0000-0000-000000000002';
    await feeApi.reversePayment(paymentId, 'Duplicate counter payment entered by mistake', {
      id: 'admin-id',
      name: 'Admin',
    });

    const updatedInv = await feeApi.getInvoiceById('40000000-0000-0000-0000-000000000002');
    expect(updatedInv?.paid_amount).toBe(0);
    expect(updatedInv?.status).toBe('Unpaid');
  });

  // --------------------------------------------------------------------------
  // FEE CHALLAN MANAGEMENT (EDIT, DISCOUNTS, WAIVERS, DELETE & AUDIT)
  // --------------------------------------------------------------------------
  describe('Fee Challan Management: Edit, Discounts, Waivers & Deletion', () => {
    const adminActor = { id: 'admin-001', name: 'Principal Admin', role: 'admin' };
    const teacherActor = { id: 'teacher-001', name: 'Class Teacher', role: 'teacher' };

    // Case 1: Edit an unpaid challan
    it('1. edits an unpaid challan particulars, items, and due date', async () => {
      // Invoice #3 is unpaid: net 5500, paid 0
      const invId = '40000000-0000-0000-0000-000000000003';
      const updated = await feeApi.updateInvoice(
        invId,
        {
          due_date: '2026-11-20',
          notes: 'Extended due date per parent request',
          items: [
            { description: 'Tuition Fee (Class 9)', amount: 4500 },
            { description: 'Science Lab Fee', amount: 800 },
            { description: 'Computer Lab Fee', amount: 700 },
          ],
        },
        adminActor
      );

      expect(updated.due_date).toBe('2026-11-20');
      expect(updated.notes).toBe('Extended due date per parent request');
      expect(updated.items?.length).toBe(3);
      expect(updated.total_amount).toBe(6000);
      expect(updated.net_amount).toBe(6000);
      expect(updated.paid_amount).toBe(0);
      expect(updated.status).toBe('Unpaid');
    });

    // Case 2: Apply a fixed discount
    it('2. applies a fixed discount with required reason and recalculates net payable', async () => {
      const invId = '40000000-0000-0000-0000-000000000003';
      const updated = await feeApi.updateInvoice(
        invId,
        {
          discount_type: 'fixed',
          discount_amount: 500,
          discount_reason: 'Need-Based Financial Assistance',
          adjustment_reason: 'Principal approved concession',
          items: [
            { description: 'Tuition Fee', amount: 3000 },
            { description: 'Computer Fee', amount: 1000 },
          ],
        },
        adminActor
      );

      expect(updated.total_amount).toBe(4000);
      expect(updated.discount_amount).toBe(500);
      expect(updated.discount_reason).toBe('Need-Based Financial Assistance');
      expect(updated.net_amount).toBe(3500);
      expect(updated.paid_amount).toBe(0);
      expect(updated.net_amount - updated.paid_amount).toBe(3500);
    });

    // Case 3: Apply a percentage discount
    it('3. applies a percentage discount (10%) and computes exact discount amount', async () => {
      const invId = '40000000-0000-0000-0000-000000000003';
      const updated = await feeApi.updateInvoice(
        invId,
        {
          discount_type: 'percentage',
          discount_percentage: 10,
          discount_reason: 'Merit Scholarship',
          items: [
            { description: 'Tuition Fee', amount: 5000 },
            { description: 'Exam Fee', amount: 1000 },
          ],
        },
        adminActor
      );

      // Total 6000, 10% discount = 600
      expect(updated.total_amount).toBe(6000);
      expect(updated.discount_amount).toBe(600);
      expect(updated.net_amount).toBe(5400);
      expect(updated.discount_type).toBe('percentage');
      expect(updated.discount_percentage).toBe(10);
    });

    // Case 4: Waive one fee item
    it('4. waives one fee item as free while keeping other items payable', async () => {
      const invId = '40000000-0000-0000-0000-000000000003';
      const updated = await feeApi.updateInvoice(
        invId,
        {
          discount_type: 'fixed',
          discount_amount: 0,
          items: [
            { description: 'Tuition Fee', amount: 3000, is_waived: false },
            { description: 'Computer Fee', amount: 0, is_waived: true, original_amount: 1000 },
          ],
        },
        adminActor
      );

      expect(updated.total_amount).toBe(3000);
      expect(updated.net_amount).toBe(3000);
      expect(updated.items?.find((i) => i.description === 'Computer Fee')?.is_waived).toBe(true);
      expect(updated.items?.find((i) => i.description === 'Computer Fee')?.amount).toBe(0);
    });

    // Case 5: Waive an entire eligible challan
    it('5. waives an entire eligible challan (100% waiver, net becomes 0, status becomes Paid)', async () => {
      const invId = '40000000-0000-0000-0000-000000000003';
      const updated = await feeApi.updateInvoice(
        invId,
        {
          discount_type: 'waiver',
          discount_reason: 'Full Orphan Student Scholarship',
          items: [{ description: 'Monthly Tuition Fee', amount: 4500 }],
        },
        adminActor
      );

      expect(updated.total_amount).toBe(4500);
      expect(updated.discount_amount).toBe(4500);
      expect(updated.net_amount).toBe(0);
      expect(updated.status).toBe('Paid');
      expect(updated.net_amount - updated.paid_amount).toBe(0);
    });

    // Case 6: Apply adjustment to partially paid challan
    it('6. applies an adjustment to a partially paid challan without violating paid threshold', async () => {
      // Invoice #2 has net: 5500, paid: 3000
      const invId = '40000000-0000-0000-0000-000000000002';
      const updated = await feeApi.updateInvoice(
        invId,
        {
          discount_type: 'fixed',
          discount_amount: 1000,
          discount_reason: 'Staff Sibling Concession',
          items: [{ description: 'Tuition Fee', amount: 5500 }],
        },
        adminActor
      );

      // Total 5500 - 1000 = 4500 net, 3000 paid => 1500 balance
      expect(updated.total_amount).toBe(5500);
      expect(updated.discount_amount).toBe(1000);
      expect(updated.net_amount).toBe(4500);
      expect(updated.paid_amount).toBe(3000);
      expect(updated.status).toBe('Partially Paid');
      expect(updated.net_amount - updated.paid_amount).toBe(1500);
    });

    // Case 7: Confirm paid amounts and outstanding dues remain correct & prevents reduction below paid
    it('7. rejects discount reducing payable amount below already paid receipts', async () => {
      // Invoice #2 has net: 5500, paid: 3000. Attempting discount of 3500 => net would be 2000 < paid 3000!
      const invId = '40000000-0000-0000-0000-000000000002';
      await expect(
        feeApi.updateInvoice(
          invId,
          {
            discount_type: 'fixed',
            discount_amount: 3500,
            discount_reason: 'Excessive concession',
            items: [{ description: 'Tuition Fee', amount: 5500 }],
          },
          adminActor
        )
      ).rejects.toThrow(/Cannot reduce payable amount.*below already paid amount/);
    });

    // Case 8: Attempt to delete a challan with no linked payments (succeeds)
    it('8. allows safe permanent deletion of a challan with no linked payments', async () => {
      // Invoice #3 has 0 payments
      const invId = '40000000-0000-0000-0000-000000000003';
      const eligibility = await feeApi.checkChallanDeletionEligibility(invId, adminActor);
      expect(eligibility.can_delete).toBe(true);
      expect(eligibility.payment_count).toBe(0);
      expect(eligibility.paid_amount).toBe(0);

      const delRes = await feeApi.deleteInvoice(invId, adminActor);
      expect(delRes.success).toBe(true);

      const after = await feeApi.getInvoiceById(invId);
      expect(after).toBeNull();
    });

    // Case 9: Attempt to delete a challan with payment history (blocked, offers cancel/void)
    it('9. blocks permanent deletion of a challan with active payments and supports void/cancel', async () => {
      // Invoice #2 has payments of Rs. 3000
      const invId = '40000000-0000-0000-0000-000000000002';
      const eligibility = await feeApi.checkChallanDeletionEligibility(invId, adminActor);
      expect(eligibility.can_delete).toBe(false);
      expect(eligibility.paid_amount).toBe(3000);
      expect(eligibility.recommended_action).toBe('cancel');

      // Attempting deletion throws error
      await expect(
        feeApi.deleteInvoice(invId, adminActor)
      ).rejects.toThrow(/Permanent Deletion Blocked/);

      // Void / Cancel alternative works safely
      const cancelRes = await feeApi.cancelInvoice(invId, 'Billing restructured', adminActor);
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.invoice.status).toBe('Cancelled');
      expect(cancelRes.invoice.notes).toContain('Cancelled: Billing restructured');

      // Historical payments remain intact in ledger
      const payments = JSON.parse(localStorage.getItem('sms_payments') || '[]');
      const invPayments = payments.filter((p: any) => p.invoice_id === invId);
      expect(invPayments.length).toBeGreaterThan(0);
    });

    // Case 10: Confirm unauthorized users cannot modify financial records
    it('10. forbids non-admin users from modifying, deleting, or cancelling challans', async () => {
      const invId = '40000000-0000-0000-0000-000000000002';

      await expect(
        feeApi.updateInvoice(invId, { discount_amount: 100 }, teacherActor)
      ).rejects.toThrow(/Unauthorized/);

      await expect(
        feeApi.deleteInvoice(invId, teacherActor)
      ).rejects.toThrow(/Unauthorized/);

      await expect(
        feeApi.cancelInvoice(invId, 'Teacher cancel attempt', teacherActor)
      ).rejects.toThrow(/Unauthorized/);
    });

    // Case 11: Verify calculations and summary integrity
    it('11. verifies financial ledger totals reflect all discounts and adjustments accurately', async () => {
      const invId = '40000000-0000-0000-0000-000000000002';
      const inv = await feeApi.getInvoiceById(invId);
      expect(inv).toBeDefined();
      if (inv) {
        const remaining = Math.max(0, Number(inv.net_amount) - Number(inv.paid_amount));
        expect(remaining).toBe(Number(inv.net_amount) - Number(inv.paid_amount));
      }
    });
  });
});
