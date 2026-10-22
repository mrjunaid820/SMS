import React, { useState, useEffect } from 'react';
import {
  FeeInvoice,
  FeePayment,
  FeeStructure,
  PaymentMethod,
  ClassLevel,
  Enrollment,
} from '@/types/database';
import { feeApi, academicStructureApi, studentApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { formatCurrency, formatDate, generateUUID } from '@/lib/utils';
import { exportToSafeCSV } from '@/lib/csv-sanitizer';
import { PrintFeeVoucher } from '@/components/print/PrintFeeVoucher';
import { PrintReceipt } from '@/components/print/PrintReceipt';
import { PAYMENT_METHODS } from '@/config/constants';
import {
  Receipt,
  FilePlus,
  CreditCard,
  Printer,
  FileDown,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const FeesAccountsPage: React.FC = () => {
  const { user } = useAuth();
  const { settings, selectedSessionId } = useSchool();

  const [activeTab, setActiveTab] = useState<'invoices' | 'structures' | 'payments'>('invoices');
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [isAddStructureModalOpen, setIsAddStructureModalOpen] = useState(false);
  const [isPrintVoucherModalOpen, setIsPrintVoucherModalOpen] = useState(false);
  const [isPrintReceiptModalOpen, setIsPrintReceiptModalOpen] = useState(false);
  const [isReverseDialogOpen, setIsReverseDialogOpen] = useState(false);

  // Selected items for operations
  const [selectedInvoice, setSelectedInvoice] = useState<FeeInvoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<FeePayment | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Form states
  const [generateForm, setGenerateForm] = useState({
    billing_month: '2026-10',
    due_date: '2026-10-15',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'Cash' as PaymentMethod,
    reference_no: '',
    idempotency_key: '',
  });

  const [structureForm, setStructureForm] = useState({
    class_id: '',
    name: 'Standard Fee Schedule',
    monthly_tuition: 4500,
    admission_fee: 5000,
    exam_fee: 1500,
    lab_library_fee: 800,
    other_charges: 200,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invList, strList, cList] = await Promise.all([
        feeApi.getInvoices(selectedSessionId),
        feeApi.getStructures(selectedSessionId),
        academicStructureApi.getClasses(),
      ]);
      setInvoices(invList);
      setStructures(strList);
      setClasses(cList);

      // Extract all payments from invoices
      const allPayments: FeePayment[] = [];
      invList.forEach((inv) => {
        if (inv.payments) {
          inv.payments.forEach((p) => {
            allPayments.push({ ...p, invoice: inv });
          });
        }
      });
      setPayments(allPayments);
    } catch (e) {
      console.error('Failed to load financial records', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSessionId]);

  // Open Record Payment Modal
  const handleOpenRecordPayment = (invoice: FeeInvoice) => {
    const outstanding = Math.max(0, Number(invoice.net_amount) - Number(invoice.paid_amount));
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: outstanding,
      payment_method: 'Bank Transfer',
      reference_no: '',
      idempotency_key: generateUUID(), // Fresh idempotency key for this payment submission
    });
    setIsRecordPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (paymentForm.amount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    try {
      const payment = await feeApi.recordPayment(
        selectedInvoice.id,
        paymentForm.amount,
        paymentForm.payment_method,
        paymentForm.reference_no,
        paymentForm.idempotency_key,
        { id: user?.id, name: user?.full_name }
      );

      setIsRecordPaymentModalOpen(false);
      await loadData();

      // Show receipt option
      setSelectedPayment(payment);
      setIsPrintReceiptModalOpen(true);
    } catch (err: any) {
      alert(`Payment recording failed: ${err.message}`);
    }
  };

  const handleExecuteGenerateInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await feeApi.generateMonthlyInvoices(
        selectedSessionId,
        generateForm.billing_month,
        generateForm.due_date,
        { id: user?.id, name: user?.full_name }
      );
      setIsGenerateModalOpen(false);
      await loadData();
      alert(`Successfully generated ${result.generatedCount} monthly fee invoices!`);
    } catch (err: any) {
      alert(`Failed to generate invoices: ${err.message}`);
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!structureForm.class_id) return;
    try {
      await feeApi.createStructure({
        ...structureForm,
        academic_session_id: selectedSessionId,
      });
      setIsAddStructureModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error saving fee structure: ${err.message}`);
    }
  };

  const handleReversePaymentConfirm = async () => {
    if (!selectedPayment) return;
    try {
      await feeApi.reversePayment(
        selectedPayment.id,
        reversalReason || 'Administrative fee correction',
        { id: user?.id, name: user?.full_name }
      );
      setIsReverseDialogOpen(false);
      setSelectedPayment(null);
      await loadData();
      alert('Payment reversed and invoice balance restored.');
    } catch (err: any) {
      alert(`Reversal failed: ${err.message}`);
    }
  };

  const handleExportInvoicesCSV = () => {
    const rows = invoices.map((inv) => ({
      invoice_no: inv.invoice_no,
      billing_month: inv.billing_month,
      student_name: inv.enrollment?.student?.full_name || '',
      admission_no: inv.enrollment?.student?.admission_no || '',
      class: inv.enrollment?.section?.class?.name || '',
      section: inv.enrollment?.section?.name || '',
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      net_amount: inv.net_amount,
      paid_amount: inv.paid_amount,
      balance: Number(inv.net_amount) - Number(inv.paid_amount),
      status: inv.status,
    }));
    exportToSafeCSV(rows, `Invoices_Register_${selectedSessionId}`);
  };

  // Invoice Table Columns
  const invoiceColumns: Column<FeeInvoice>[] = [
    {
      key: 'invoice_no',
      header: 'Invoice #',
      sortable: true,
      className: 'font-mono text-xs font-bold text-navy-900 dark:text-brand-400',
    },
    {
      key: 'student',
      header: 'Student & Roll',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {row.enrollment?.student?.full_name}
          </div>
          <div className="text-[11px] text-slate-400">
            {row.enrollment?.section?.class?.name} - {row.enrollment?.section?.name} (Roll #{row.enrollment?.roll_no})
          </div>
        </div>
      ),
    },
    {
      key: 'billing_month',
      header: 'Month',
      sortable: true,
      render: (row) => <span className="font-semibold">{row.billing_month}</span>,
    },
    {
      key: 'net_amount',
      header: 'Invoiced',
      sortable: true,
      render: (row) => <span className="font-mono font-medium">{formatCurrency(row.net_amount)}</span>,
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
          {formatCurrency(row.paid_amount)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Remaining Dues',
      render: (row) => {
        const bal = Math.max(0, Number(row.net_amount) - Number(row.paid_amount));
        return (
          <span className={`font-mono font-bold ${bal > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {formatCurrency(bal)}
          </span>
        );
      },
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (row) => formatDate(row.due_date),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const variantMap: Record<string, any> = {
          Paid: 'success',
          'Partially Paid': 'warning',
          Unpaid: 'danger',
          Overdue: 'danger',
          Cancelled: 'default',
        };
        return <Badge variant={variantMap[row.status] || 'default'}>{row.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        const outstanding = Number(row.net_amount) - Number(row.paid_amount);
        return (
          <div className="flex items-center justify-end gap-1">
            {outstanding > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenRecordPayment(row)}
                className="text-[11px] py-1 px-2.5"
              >
                Receive Fee
              </Button>
            )}
            <button
              onClick={() => {
                setSelectedInvoice(row);
                setIsPrintVoucherModalOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-navy-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Print Bank Challan Voucher"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  // Payments Table Columns
  const paymentColumns: Column<FeePayment>[] = [
    {
      key: 'receipt_no',
      header: 'Receipt #',
      sortable: true,
      className: 'font-mono text-xs font-bold text-navy-900 dark:text-brand-400',
    },
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      render: (row) => formatDate(row.payment_date),
    },
    {
      key: 'amount',
      header: 'Amount Paid',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (row) => (
        <div>
          <span className="font-semibold">{row.payment_method}</span>
          {row.reference_no && <div className="text-[10px] text-slate-400 font-mono">{row.reference_no}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_reversed ? 'danger' : 'success'}>
          {row.is_reversed ? 'Reversed / Refunded' : 'Valid'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setSelectedPayment(row);
              if (row.invoice) setSelectedInvoice(row.invoice);
              setIsPrintReceiptModalOpen(true);
            }}
            className="p-1.5 text-slate-500 hover:text-navy-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Print Official Receipt"
          >
            <Printer className="w-4 h-4" />
          </button>
          {!row.is_reversed && (
            <button
              onClick={() => {
                setSelectedPayment(row);
                setIsReverseDialogOpen(true);
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="Reverse Payment"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Fee Billing & Financial Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pakistani bank challan vouchers, partial payments, receipts, reversals and ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileDown className="w-3.5 h-3.5" />}
            onClick={handleExportInvoicesCSV}
          >
            Export Invoices CSV
          </Button>

          <Button
            size="sm"
            leftIcon={<FilePlus className="w-4 h-4" />}
            onClick={() => setIsGenerateModalOpen(true)}
          >
            Generate Monthly Billing
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-navy-900 text-navy-900 dark:border-brand-500 dark:text-brand-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Student Fee Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-navy-900 text-navy-900 dark:border-brand-500 dark:text-brand-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Receipts ({payments.length})
        </button>

        <button
          onClick={() => setActiveTab('structures')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'structures'
              ? 'border-navy-900 text-navy-900 dark:border-brand-500 dark:text-brand-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Class Fee Schedules ({structures.length})
        </button>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === 'invoices' && (
        <DataTable
          data={invoices}
          columns={invoiceColumns}
          isLoading={isLoading}
          rowKey={(i) => i.id}
          searchPlaceholder="Search invoices by invoice #, student name..."
          searchFilter={(row, term) => {
            return (
              row.invoice_no.toLowerCase().includes(term) ||
              (row.enrollment?.student?.full_name || '').toLowerCase().includes(term) ||
              row.billing_month.includes(term)
            );
          }}
        />
      )}

      {/* Tab 2: Payments */}
      {activeTab === 'payments' && (
        <DataTable
          data={payments}
          columns={paymentColumns}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          searchPlaceholder="Search payments by receipt #, reference..."
        />
      )}

      {/* Tab 3: Fee Structures */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              leftIcon={<FilePlus className="w-4 h-4" />}
              onClick={() => {
                setStructureForm({
                  class_id: classes[0]?.id || '',
                  name: 'Standard Fee Schedule',
                  monthly_tuition: 4500,
                  admission_fee: 5000,
                  exam_fee: 1500,
                  lab_library_fee: 800,
                  other_charges: 200,
                });
                setIsAddStructureModalOpen(true);
              }}
            >
              Add Class Fee Schedule
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {structures.map((str) => (
              <div
                key={str.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-navy-950 dark:text-white">
                      {str.class?.name || 'Class Schedule'}
                    </h4>
                    <p className="text-xs text-slate-500">{str.name}</p>
                  </div>
                  <Badge variant="outline">Active Schedule</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-slate-400">Monthly Tuition:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(str.monthly_tuition)}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-slate-400">Lab & Library:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(str.lab_library_fee)}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-slate-400">Exam Fee:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(str.exam_fee)}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-slate-400">Admission Fee:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(str.admission_fee)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Generate Monthly Invoices */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Monthly Fee Billing"
        description="Generates fee invoices for all currently enrolled students matching their class fee schedules"
        size="md"
      >
        <form onSubmit={handleExecuteGenerateInvoices} className="space-y-4">
          <Input
            label="Billing Cycle Month (YYYY-MM)"
            required
            placeholder="e.g. 2026-10"
            value={generateForm.billing_month}
            onChange={(e) => setGenerateForm({ ...generateForm, billing_month: e.target.value })}
          />

          <Input
            label="Payment Due Date"
            type="date"
            required
            value={generateForm.due_date}
            onChange={(e) => setGenerateForm({ ...generateForm, due_date: e.target.value })}
          />

          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
            Duplicate Protection: Students who already have an invoice for this billing cycle will be automatically skipped.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Execute Batch Invoicing</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Record Fee Payment */}
      <Modal
        isOpen={isRecordPaymentModalOpen}
        onClose={() => setIsRecordPaymentModalOpen(false)}
        title={`Receive Fee Payment — ${selectedInvoice?.invoice_no}`}
        size="md"
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Student:</span>
              <span className="font-bold">{selectedInvoice?.enrollment?.student?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Net Payable:</span>
              <span className="font-mono">{formatCurrency(selectedInvoice?.net_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Already Paid:</span>
              <span className="font-mono text-emerald-600">{formatCurrency(selectedInvoice?.paid_amount)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
              <span>Remaining Balance:</span>
              <span className="font-mono text-rose-600">
                {formatCurrency(Math.max(0, Number(selectedInvoice?.net_amount || 0) - Number(selectedInvoice?.paid_amount || 0)))}
              </span>
            </div>
          </div>

          <Input
            label="Payment Amount (PKR)"
            type="number"
            required
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
          />

          <Select
            label="Payment Method"
            required
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
            value={paymentForm.payment_method}
            onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
          />

          <Input
            label="Bank Slip / Reference / Transaction ID"
            placeholder="e.g. HBL-FT-9412 or Counter Receipt #12"
            value={paymentForm.reference_no}
            onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsRecordPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Confirm & Issue Receipt</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Fee Structure */}
      <Modal
        isOpen={isAddStructureModalOpen}
        onClose={() => setIsAddStructureModalOpen(false)}
        title="Configure Class Fee Schedule"
        size="md"
      >
        <form onSubmit={handleSaveStructure} className="space-y-4">
          <Select
            label="Class Level"
            required
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            value={structureForm.class_id}
            onChange={(e) => setStructureForm({ ...structureForm, class_id: e.target.value })}
          />

          <Input
            label="Schedule Title"
            required
            value={structureForm.name}
            onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monthly Tuition (PKR)"
              type="number"
              required
              value={structureForm.monthly_tuition}
              onChange={(e) => setStructureForm({ ...structureForm, monthly_tuition: Number(e.target.value) })}
            />
            <Input
              label="Lab & Library Fee (PKR)"
              type="number"
              required
              value={structureForm.lab_library_fee}
              onChange={(e) => setStructureForm({ ...structureForm, lab_library_fee: Number(e.target.value) })}
            />
            <Input
              label="Examination Fee (PKR)"
              type="number"
              required
              value={structureForm.exam_fee}
              onChange={(e) => setStructureForm({ ...structureForm, exam_fee: Number(e.target.value) })}
            />
            <Input
              label="Admission Fee (One-time)"
              type="number"
              required
              value={structureForm.admission_fee}
              onChange={(e) => setStructureForm({ ...structureForm, admission_fee: Number(e.target.value) })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddStructureModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Schedule</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Print Bank Challan Voucher */}
      <Modal
        isOpen={isPrintVoucherModalOpen}
        onClose={() => setIsPrintVoucherModalOpen(false)}
        title="3-Copy Bank Challan Voucher"
        size="full"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <PrintFeeVoucher invoice={selectedInvoice} settings={settings} />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsPrintVoucherModalOpen(false)}>
                Close
              </Button>
              <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print Challan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Print Payment Receipt */}
      <Modal
        isOpen={isPrintReceiptModalOpen}
        onClose={() => setIsPrintReceiptModalOpen(false)}
        title="Official Payment Receipt"
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <PrintReceipt
              payment={selectedPayment}
              invoice={selectedInvoice || (selectedPayment.invoice as any)}
              settings={settings}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsPrintReceiptModalOpen(false)}>
                Close
              </Button>
              <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reversal Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isReverseDialogOpen}
        onClose={() => setIsReverseDialogOpen(false)}
        onConfirm={handleReversePaymentConfirm}
        title="Reverse Fee Payment"
        message={`Are you sure you want to reverse payment ${selectedPayment?.receipt_no} of ${formatCurrency(selectedPayment?.amount)}? This will restore the student's outstanding fee balance and create an immutable audit log entry.`}
        confirmText="Confirm Payment Reversal"
        variant="danger"
      />
    </div>
  );
};
