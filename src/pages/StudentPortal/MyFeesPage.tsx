import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { studentPortalApi } from '@/services/api';
import { FeeInvoice, FeePayment, InvoiceStatus } from '@/types/database';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { PrintFeeVoucher } from '@/components/print/PrintFeeVoucher';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  RotateCcw,
  AlertCircle,
  FileDown,
  Calendar,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';

const getStatusBadgeVariant = (status: InvoiceStatus): 'success' | 'warning' | 'danger' | 'default' => {
  switch (status) {
    case 'Paid':
      return 'success';
    case 'Partially Paid':
      return 'warning';
    case 'Overdue':
      return 'danger';
    case 'Unpaid':
    default:
      return 'default';
  }
};

export const MyFeesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSchool();

  const [feeData, setFeeData] = useState<{
    student: any;
    enrollment?: any;
    summary: {
      totalAssigned: number;
      totalPaid: number;
      remainingBalance: number;
      totalInvoices: number;
      paidCount: number;
      partialCount: number;
      unpaidCount: number;
      overdueCount: number;
    };
    invoices: FeeInvoice[];
    payments: FeePayment[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Print voucher modal
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<FeeInvoice | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const data = await studentPortalApi.getMyFees(identifier);
      setFeeData(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load student fee records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Unique billing months for filter dropdown
  const billingMonths = useMemo(() => {
    if (!feeData?.invoices) return [];
    const months = Array.from(new Set(feeData.invoices.map((i) => i.billing_month)));
    return months.sort((a, b) => b.localeCompare(a));
  }, [feeData]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (!feeData?.invoices) return [];
    return feeData.invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (monthFilter !== 'all' && inv.billing_month !== monthFilter) return false;
      return true;
    });
  }, [feeData, statusFilter, monthFilter]);

  const handleResetFilters = () => {
    setStatusFilter('all');
    setMonthFilter('all');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your fee ledgers and payment history...</p>
        </div>
      </div>
    );
  }

  if (error || !feeData) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Fee Records Unavailable</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  const { student, enrollment, summary, invoices, payments } = feeData;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            My Fee Ledger & Payment History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Student: <span className="font-semibold text-slate-800 dark:text-slate-200">{student.full_name}</span> ({student.admission_no}) • Class: {enrollment?.section?.class?.name || 'Class 9'} - {enrollment?.section?.name || 'A'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/my-fee-challans')}
            leftIcon={<FileDown className="w-3.5 h-3.5" />}
          >
            Download Challans
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/my-dues')}
            leftIcon={<CreditCard className="w-3.5 h-3.5" />}
          >
            Payable Dues
          </Button>
        </div>
      </div>

      {/* Financial Summary StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assigned Fees"
          value={formatCurrency(summary.totalAssigned)}
          subtitle={`${summary.totalInvoices} billing months invoiced`}
          icon={<Receipt className="w-5 h-5" />}
          color="navy"
        />
        <StatCard
          title="Total Paid"
          value={formatCurrency(summary.totalPaid)}
          subtitle={`${payments.length} verified transactions recorded`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Remaining Balance"
          value={formatCurrency(summary.remainingBalance)}
          subtitle={summary.remainingBalance > 0 ? `${summary.unpaidCount + summary.partialCount + summary.overdueCount} pending months` : 'All dues fully cleared'}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={summary.remainingBalance > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          title="Overdue Status"
          value={summary.overdueCount > 0 ? `${summary.overdueCount} Overdue` : 'Up to Date'}
          subtitle={summary.overdueCount > 0 ? 'Late surcharges may apply' : 'No overdue challans'}
          icon={<Clock className="w-5 h-5" />}
          color={summary.overdueCount > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Statuses ({invoices.length})</option>
                <option value="Paid">Paid ({summary.paidCount})</option>
                <option value="Partially Paid">Partially Paid ({summary.partialCount})</option>
                <option value="Unpaid">Unpaid ({summary.unpaidCount})</option>
                <option value="Overdue">Overdue ({summary.overdueCount})</option>
              </select>
            </div>

            <div className="sm:w-56">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Filter by Billing Month
              </label>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Months</option>
                {billingMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {(statusFilter !== 'all' || monthFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Month-wise Invoices Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand-600" />
            Month-Wise Invoices & Challan Records ({filteredInvoices.length})
          </CardTitle>
          <span className="text-xs text-slate-400">Authenticated Student View</span>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No fee invoices found
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No fee invoice records match your current filter selection.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Billing Month</th>
                    <th className="py-3 px-4">Challan / Inv #</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Particulars & Breakdown</th>
                    <th className="py-3 px-4 text-right">Net Payable</th>
                    <th className="py-3 px-4 text-right">Paid Amount</th>
                    <th className="py-3 px-4 text-right">Remaining Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvoices.map((inv) => {
                    const balance = Math.max(0, Number(inv.net_amount) - Number(inv.paid_amount));
                    const badgeVariant = getStatusBadgeVariant(inv.status);

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {inv.billing_month}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {inv.invoice_no}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                          <div>Issued: {formatDate(inv.issue_date)}</div>
                          <div className={inv.status === 'Overdue' ? 'text-rose-600 font-medium' : ''}>
                            Due: {formatDate(inv.due_date)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5 max-w-xs">
                            {inv.items && inv.items.length > 0 ? (
                              inv.items.map((it) => (
                                <div key={it.id} className="text-[11px] text-slate-600 dark:text-slate-300 flex justify-between gap-2">
                                  <span className="truncate">{it.description}</span>
                                  <span className="font-mono">{formatCurrency(it.amount)}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                Monthly Tuition Fee
                              </div>
                            )}
                            {Number(inv.discount_amount) > 0 && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex justify-between gap-2 font-medium">
                                <span>Scholarship / Discount</span>
                                <span>-{formatCurrency(inv.discount_amount)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatCurrency(inv.net_amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(inv.paid_amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span className={balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
                            {formatCurrency(balance)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <Badge variant={badgeVariant} size="sm">
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Printer className="w-3.5 h-3.5" />}
                            onClick={() => setSelectedInvoiceForPrint(inv)}
                          >
                            Print Challan
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History & Receipts Section */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Verified Payment Transactions ({payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No payment transactions have been recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Receipt Number</th>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Reference / Slip #</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {p.receipt_no}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {p.reference_no || 'Cash Deposit'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="success" size="sm">
                          Verified & Cleared
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Challan Voucher Modal */}
      <Modal
        isOpen={Boolean(selectedInvoiceForPrint)}
        onClose={() => setSelectedInvoiceForPrint(null)}
        title="Official 3-Part Bank Challan"
        size="full"
      >
        {selectedInvoiceForPrint && (
          <div className="space-y-4">
            <PrintFeeVoucher invoice={selectedInvoiceForPrint} settings={settings} />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 no-print">
              <Button variant="outline" onClick={() => setSelectedInvoiceForPrint(null)}>
                Close
              </Button>
              <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
