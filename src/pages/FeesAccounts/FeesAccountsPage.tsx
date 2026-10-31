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
  Edit2,
  Trash2,
  Percent,
  Tag,
  AlertTriangle,
  Plus,
  Ban,
  Check,
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

  const isAdmin = user?.role === 'admin';

  // Edit Challan states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<FeeInvoice | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDiscountType, setEditDiscountType] = useState<'fixed' | 'percentage' | 'waiver'>('fixed');
  const [editDiscountValue, setEditDiscountValue] = useState<number | string>(0);
  const [editDiscountReason, setEditDiscountReason] = useState('');
  const [editAdjustmentReason, setEditAdjustmentReason] = useState('');
  const [editItems, setEditItems] = useState<Array<{
    id?: string;
    description: string;
    amount: number;
    is_waived?: boolean;
    original_amount?: number;
  }>>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete / Void Challan states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState<FeeInvoice | null>(null);
  const [deletionEligibility, setDeletionEligibility] = useState<{
    can_delete: boolean;
    payment_count: number;
    paid_amount: number;
    explanation: string;
    recommended_action: 'delete' | 'cancel';
  } | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Edit Challan Handlers
  const handleOpenEditChallan = (invoice: FeeInvoice) => {
    setEditingInvoice(invoice);
    setEditDueDate(invoice.due_date || '');
    setEditNotes(invoice.notes || '');
    setEditDiscountType(invoice.discount_type || 'fixed');
    setEditDiscountValue(
      invoice.discount_type === 'percentage'
        ? Number(invoice.discount_percentage || 0)
        : Number(invoice.discount_amount || 0)
    );
    setEditDiscountReason(invoice.discount_reason || '');
    setEditAdjustmentReason('');
    setEditItems(
      (invoice.items && invoice.items.length > 0
        ? invoice.items
        : [
            {
              id: generateUUID(),
              description: 'Monthly Tuition Fee',
              amount: Number(invoice.total_amount),
              is_waived: false,
              original_amount: Number(invoice.total_amount),
            },
          ]
      ).map((it) => ({
        id: it.id,
        description: it.description,
        amount: Number(it.amount),
        is_waived: !!it.is_waived,
        original_amount: it.original_amount !== undefined ? Number(it.original_amount) : Number(it.amount),
      }))
    );
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleToggleItemWaive = (index: number) => {
    setEditItems((prev) => {
      const copy = [...prev];
      const it = copy[index];
      if (it.is_waived) {
        copy[index] = {
          ...it,
          is_waived: false,
          amount: it.original_amount !== undefined ? it.original_amount : it.amount,
        };
      } else {
        copy[index] = {
          ...it,
          is_waived: true,
          original_amount: it.amount,
          amount: 0,
        };
      }
      return copy;
    });
  };

  const handleAddItem = () => {
    setEditItems((prev) => [
      ...prev,
      {
        id: generateUUID(),
        description: '',
        amount: 0,
        is_waived: false,
        original_amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (editItems.length <= 1) return;
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: 'description' | 'amount', value: any) => {
    setEditItems((prev) => {
      const copy = [...prev];
      const val = field === 'amount' ? Math.max(0, Number(value) || 0) : value;
      copy[index] = {
        ...copy[index],
        [field]: val,
        ...(field === 'amount' ? { original_amount: val, is_waived: false } : {}),
      };
      return copy;
    });
  };

  // Calculations for Edit Challan
  const computedTotal = editItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  let computedDiscount = 0;
  if (editDiscountType === 'percentage') {
    const pct = Math.min(100, Math.max(0, Number(editDiscountValue) || 0));
    computedDiscount = Math.round((pct / 100) * computedTotal * 100) / 100;
  } else if (editDiscountType === 'waiver') {
    computedDiscount = computedTotal;
  } else {
    computedDiscount = Math.min(computedTotal, Math.max(0, Number(editDiscountValue) || 0));
  }
  const computedNet = Math.max(0, computedTotal - computedDiscount);
  const alreadyPaid = Number(editingInvoice?.paid_amount || 0);
  const remainingBalance = Math.max(0, computedNet - alreadyPaid);
  const isUnderpaidReduction = computedNet < alreadyPaid;

  const handleSaveEditChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    setEditError(null);

    if (isUnderpaidReduction) {
      setEditError(
        `Cannot reduce payable amount (${formatCurrency(computedNet)}) below already paid amount (${formatCurrency(alreadyPaid)}). Please reverse excess payments before adjusting challan.`
      );
      return;
    }

    if (computedDiscount > 0 && !editDiscountReason.trim()) {
      setEditError('Please select or enter a reason for applying this discount / waiver.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const updated = await feeApi.updateInvoice(
        editingInvoice.id,
        {
          due_date: editDueDate,
          notes: editNotes,
          discount_type: editDiscountType,
          discount_percentage: editDiscountType === 'percentage' ? Number(editDiscountValue) : 0,
          discount_amount: computedDiscount,
          discount_reason: editDiscountReason,
          adjustment_reason: editAdjustmentReason || 'Administrative adjustment',
          items: editItems,
        },
        {
          id: user?.id,
          name: user?.full_name,
          role: user?.role,
        }
      );

      setIsEditModalOpen(false);
      setEditingInvoice(null);
      await loadData();
      alert(`Challan ${updated.invoice_no} updated successfully! Final payable: ${formatCurrency(updated.net_amount)}`);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update challan.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Challan Handlers
  const handleOpenDeleteChallan = async (invoice: FeeInvoice) => {
    setDeletingInvoice(invoice);
    setDeletionEligibility(null);
    setDeleteError(null);
    setCancelReason('');
    setIsDeleteModalOpen(true);
    setIsCheckingEligibility(true);
    try {
      const elig = await feeApi.checkChallanDeletionEligibility(invoice.id, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role,
      });
      setDeletionEligibility(elig);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to check challan dependencies.');
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleExecuteDeleteChallan = async () => {
    if (!deletingInvoice) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await feeApi.deleteInvoice(deletingInvoice.id, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role,
      });
      setIsDeleteModalOpen(false);
      setDeletingInvoice(null);
      await loadData();
      alert(res.message);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete challan.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteCancelChallan = async () => {
    if (!deletingInvoice) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await feeApi.cancelInvoice(
        deletingInvoice.id,
        cancelReason || 'Cancelled by administrator',
        {
          id: user?.id,
          name: user?.full_name,
          role: user?.role,
        }
      );
      setIsDeleteModalOpen(false);
      setDeletingInvoice(null);
      await loadData();
      alert(res.message);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to cancel challan.');
    } finally {
      setIsDeleting(false);
    }
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
            {isAdmin && (
              <>
                <button
                  onClick={() => handleOpenEditChallan(row)}
                  className="p-1.5 text-slate-500 hover:text-brand-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Edit Fee Challan (Particulars, Discounts & Waivers)"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenDeleteChallan(row)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Delete or Void Fee Challan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
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

      {/* Modal: Edit Fee Challan (Particulars, Discounts & Waivers) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Fee Challan - ${editingInvoice?.invoice_no}`}
        size="lg"
      >
        {editingInvoice && (
          <form onSubmit={handleSaveEditChallan} className="space-y-4">
            {/* Student info banner */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap justify-between items-center text-xs gap-2">
              <div>
                <span className="text-slate-500">Student:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {editingInvoice.enrollment?.student?.full_name}
                </span>{' '}
                <span className="text-slate-400">
                  (Adm #{editingInvoice.enrollment?.student?.admission_no})
                </span>
              </div>
              <div>
                <span className="text-slate-500">Class:</span>{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {editingInvoice.enrollment?.section?.class?.name} - {editingInvoice.enrollment?.section?.name}
                </span>{' '}
                <span className="text-slate-400">(Roll #{editingInvoice.enrollment?.roll_no})</span>
              </div>
              <div>
                <span className="text-slate-500">Billing Month:</span>{' '}
                <span className="font-mono font-semibold">{editingInvoice.billing_month}</span>
              </div>
            </div>

            {/* Due date & notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Due Date"
                type="date"
                required
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
              <Input
                label="Payment Notes / Remarks (Optional)"
                placeholder="e.g. Approved concession, 1st installment"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            {/* Fee Items section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Fee Items & Particulars
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleAddItem}
                  className="text-xs py-1"
                >
                  Add Fee Item
                </Button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {editItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs"
                  >
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        placeholder="Particular description (e.g. Tuition Fee)"
                        required
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="w-full sm:w-32 flex items-center gap-1">
                      <span className="text-slate-400 font-mono">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        required
                        disabled={item.is_waived}
                        value={item.amount}
                        onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                        className={`w-full px-2.5 py-1.5 font-mono text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                          item.is_waived ? 'opacity-50 line-through' : ''
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleItemWaive(idx)}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                          item.is_waived
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                        title={item.is_waived ? 'Restore item fee' : 'Waive this item (make FREE)'}
                      >
                        {item.is_waived ? 'Waived (FREE)' : 'Waive Item'}
                      </button>
                      {editItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Remove Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discounts, Concessions & Waivers (Requirement 2) */}
            <div className="p-3.5 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-900/40 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Discount, Concession & Fee Waiver Options
                </span>
              </div>

              {/* Discount type toggle buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditDiscountType('fixed');
                    if (editDiscountType === 'waiver') setEditDiscountValue(0);
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                    editDiscountType === 'fixed'
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Fixed Discount (Rs.)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditDiscountType('percentage');
                    if (editDiscountType === 'waiver') setEditDiscountValue(10);
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                    editDiscountType === 'percentage'
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Percentage (%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditDiscountType('waiver');
                    setEditDiscountValue(computedTotal);
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                    editDiscountType === 'waiver'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Full Waiver (100% Free)
                </button>
              </div>

              {/* Discount inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {editDiscountType === 'fixed' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Fixed Discount Amount (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={computedTotal}
                      step="50"
                      value={editDiscountValue}
                      onChange={(e) => setEditDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="e.g. 500"
                      className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                )}
                {editDiscountType === 'percentage' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Discount Percentage (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editDiscountValue}
                        onChange={(e) =>
                          setEditDiscountValue(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                        }
                        placeholder="e.g. 10"
                        className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                )}
                {editDiscountType === 'waiver' && (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Full fee waiver applied. Final payable will be Rs. 0.</span>
                  </div>
                )}

                {/* Discount reason */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Discount / Waiver Reason {computedDiscount > 0 && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    list="discount-reasons"
                    placeholder="e.g. Merit Scholarship, Need-based Assistance"
                    value={editDiscountReason}
                    onChange={(e) => setEditDiscountReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <datalist id="discount-reasons">
                    <option value="Merit Scholarship" />
                    <option value="Need-Based Financial Assistance" />
                    <option value="Staff / Sibling Concession" />
                    <option value="Principal Discretionary Concession" />
                    <option value="Special Fee Waiver" />
                  </datalist>
                </div>
              </div>
            </div>

            {/* Audit Adjustment Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Administrative Adjustment Reason (for Audit Trail)
              </label>
              <input
                type="text"
                placeholder="e.g. Corrected fee head per principal approval; applied mid-session waiver"
                value={editAdjustmentReason}
                onChange={(e) => setEditAdjustmentReason(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Calculated Breakdown Summary Box (Requirement 2 Table) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                Challan Financial Breakdown & Calculations
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr className="bg-white dark:bg-slate-800">
                      <td className="p-2 text-slate-600 dark:text-slate-300">Original Fee Total</td>
                      <td className="p-2 text-right font-mono font-medium">{formatCurrency(computedTotal)}</td>
                    </tr>
                    <tr className="bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400">
                      <td className="p-2">
                        Discount / Concession
                        {editDiscountReason && (
                          <span className="ml-1.5 text-[11px] font-normal text-emerald-600">
                            ({editDiscountReason})
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">-{formatCurrency(computedDiscount)}</td>
                    </tr>
                    <tr className="bg-slate-100 dark:bg-slate-900 font-bold">
                      <td className="p-2 text-slate-900 dark:text-slate-100">Final Payable Amount</td>
                      <td className="p-2 text-right font-mono text-brand-600 dark:text-brand-400">
                        {formatCurrency(computedNet)}
                      </td>
                    </tr>
                    <tr className="bg-white dark:bg-slate-800">
                      <td className="p-2 text-slate-600 dark:text-slate-300">Amount Already Paid</td>
                      <td className="p-2 text-right font-mono font-medium text-emerald-600">
                        {formatCurrency(alreadyPaid)}
                      </td>
                    </tr>
                    <tr className="bg-rose-50/80 dark:bg-rose-950/30 font-bold text-rose-800 dark:text-rose-300">
                      <td className="p-2">Remaining Outstanding Balance</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(remainingBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error banner */}
            {editError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs font-medium">
                {editError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSavingEdit} leftIcon={<Check className="w-4 h-4" />}>
                Save Challan Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Delete or Void Fee Challan (Requirement 3) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Delete / Cancel Fee Challan - ${deletingInvoice?.invoice_no}`}
        size="md"
      >
        <div className="space-y-4">
          {isCheckingEligibility ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-xs text-slate-500">Checking payment dependencies & receipts...</p>
            </div>
          ) : (
            deletingInvoice && (
              <div className="space-y-4">
                {/* Challan Summary Card */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1">
                  <div>
                    <b>Challan #:</b> <span className="font-mono">{deletingInvoice.invoice_no}</span>
                  </div>
                  <div>
                    <b>Student:</b> {deletingInvoice.enrollment?.student?.full_name} (
                    {deletingInvoice.enrollment?.student?.admission_no})
                  </div>
                  <div>
                    <b>Month:</b> {deletingInvoice.billing_month}
                  </div>
                  <div>
                    <b>Invoiced:</b> {formatCurrency(deletingInvoice.net_amount)} | <b>Paid:</b>{' '}
                    {formatCurrency(deletingInvoice.paid_amount)}
                  </div>
                </div>

                {/* Safe deletion vs Payment Block */}
                {deletionEligibility?.can_delete ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-rose-900 dark:text-rose-200">
                          Confirm Permanent Challan Deletion
                        </div>
                        <div className="text-rose-800 dark:text-rose-300">
                          {deletionEligibility.explanation}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      This action is permanent and will remove this fee challan and its line items from the database.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-amber-900 dark:text-amber-200">
                          Permanent Deletion Blocked
                        </div>
                        <div className="text-amber-800 dark:text-amber-300">
                          {deletionEligibility?.explanation}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs space-y-2">
                      <div className="font-semibold text-blue-900 dark:text-blue-200">
                        Recommended Action: Void / Cancel Challan
                      </div>
                      <div className="text-blue-800 dark:text-blue-300">
                        Cancelling will mark the challan as <b>Cancelled</b>, preventing further fee collection while preserving all existing payment receipts for financial accounting compliance.
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Cancellation Reason (Required):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Issued in error, billing cycle corrected, student withdrawn"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {deleteError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                    Cancel
                  </Button>
                  {deletionEligibility?.can_delete ? (
                    <Button
                      variant="danger"
                      isLoading={isDeleting}
                      onClick={handleExecuteDeleteChallan}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Permanently Delete Challan
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      isLoading={isDeleting}
                      onClick={handleExecuteCancelChallan}
                      leftIcon={<Ban className="w-3.5 h-3.5" />}
                    >
                      Void / Cancel Challan
                    </Button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
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
