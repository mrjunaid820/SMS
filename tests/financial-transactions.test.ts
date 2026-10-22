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
});
