import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { studentPortalApi } from '@/services/api';
import { FeeInvoice, FeePayment } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { PrintFeeVoucher } from '@/components/print/PrintFeeVoucher';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  Printer,
  Receipt,
  FileDown,
  Info,
  Clock,
  ShieldAlert,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export const MyDuesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSchool();

  const [duesData, setDuesData] = useState<{
    student: any;
    enrollment?: any;
    outstandingBase: number;
    totalLateFines: number;
    totalPayableNow: number;
    unpaidMonths: string[];
    overdueCount: number;
    dueInvoices: (FeeInvoice & {
      remainingBalance: number;
      isOverdue: boolean;
      lateFine: number;
      totalPayable: number;
    })[];
    clearedInvoices: FeeInvoice[];
    paymentHistory: FeePayment[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Print voucher modal
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<FeeInvoice | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const data = await studentPortalApi.getMyDues(identifier);
      setDuesData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load outstanding dues.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Calculating outstanding dues and fee balances...</p>
        </div>
      </div>
    );
  }

  if (error || !duesData) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Unable to Calculate Dues</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  const {
    student,
    enrollment,
    outstandingBase,
    totalLateFines,
    totalPayableNow,
    unpaidMonths,
    overdueCount,
    dueInvoices,
    clearedInvoices,
    paymentHistory,
  } = duesData;

  const isClear = totalPayableNow === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            My Outstanding Dues & Payable Balances
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Student: <span className="font-semibold text-slate-800 dark:text-slate-200">{student.full_name}</span> ({student.admission_no}) • Roll #{enrollment?.roll_no || '1'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/my-fees')}
            leftIcon={<Receipt className="w-3.5 h-3.5" />}
          >
            Fee Ledger
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/my-fee-challans')}
            leftIcon={<FileDown className="w-3.5 h-3.5" />}
          >
            View Challans
          </Button>
        </div>
      </div>

      {/* Hero Payable Card */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border text-white relative overflow-hidden shadow-sm ${
          isClear
            ? 'bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 border-emerald-800'
            : 'bg-gradient-to-br from-rose-950 via-slate-900 to-navy-950 border-rose-900/60'
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-xs bg-white/10 border-white/20">
              {isClear ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dues Cleared Status</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Payment Action Required</span>
                </>
              )}
            </div>

            <div>
              <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold">
                Total Amount Currently Payable
              </p>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white mt-1">
                {formatCurrency(totalPayableNow)}
              </div>
            </div>

            <p className="text-xs text-slate-300 max-w-xl">
              {isClear
                ? 'All academic fees and institutional dues have been settled in full. Thank you for timely payment!'
                : `Includes base outstanding balance of ${formatCurrency(outstandingBase)}${
                    totalLateFines > 0 ? ` plus ${formatCurrency(totalLateFines)} in late surcharges for overdue vouchers.` : '.'
                  }`}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap md:flex-col gap-2 shrink-0 bg-white/5 backdrop-blur-xs p-4 rounded-xl border border-white/10 text-xs">
            <div className="flex justify-between gap-6">
              <span className="text-slate-400">Base Dues:</span>
              <span className="font-mono font-bold text-white">{formatCurrency(outstandingBase)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-slate-400">Late Surcharge:</span>
              <span className="font-mono font-bold text-amber-300">{formatCurrency(totalLateFines)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-slate-400">Pending Months:</span>
              <span className="font-semibold text-white">
                {unpaidMonths.length > 0 ? unpaidMonths.join(', ') : 'None'}
              </span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-slate-400">Overdue Challans:</span>
              <span className={`font-bold ${overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {overdueCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Due Challans Breakdown */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-600" />
              Itemized Pending Challans ({dueInvoices.length})
            </span>
            <span className="text-xs font-normal text-slate-500">
              Only unpaid and partially paid records
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {dueInvoices.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Zero Pending Dues
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                There are no pending, partially paid, or overdue fee invoices for your account. All payments are verified.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Billing Month</th>
                    <th className="py-3 px-4">Challan #</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Net Amount</th>
                    <th className="py-3 px-4 text-right">Paid So Far</th>
                    <th className="py-3 px-4 text-right">Remaining Due</th>
                    <th className="py-3 px-4 text-right">Late Fine</th>
                    <th className="py-3 px-4 text-right">Payable Now</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dueInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {inv.billing_month}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {inv.invoice_no}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={inv.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                          {formatDate(inv.due_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrency(inv.net_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(inv.paid_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(inv.remainingBalance)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400">
                        {inv.lateFine > 0 ? `+${formatCurrency(inv.lateFine)}` : 'Rs. 0'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(inv.totalPayable)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={inv.isOverdue ? 'danger' : inv.paid_amount > 0 ? 'warning' : 'default'} size="sm">
                          {inv.isOverdue ? 'Overdue' : inv.paid_amount > 0 ? 'Partially Paid' : 'Unpaid'}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid: Bank Payment Instructions & Security Notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Instructions Card */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-600" />
              Institutional Payment Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Designated Bank:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {settings.bank_name || 'Habib Bank Limited (HBL)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Title:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {settings.school_name || 'Islamia Public High School'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Number:</span>
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                  {settings.bank_account_no || '0123-45678901-03'}
                </span>
              </div>
            </div>

            <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>Print the 3-part bank challan voucher using the button above.</li>
              <li>Deposit the total payable amount at any branch counter of the designated bank.</li>
              <li>The bank will stamp all three copies, retaining the Bank Copy.</li>
              <li>Submit the School Copy to the accounts office if required, and keep the Student Copy permanently.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Security & Verification Notice */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Security, Verification & Settlement Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Administrative Verification:</span> Fee payments can only be recorded and verified by authorized school administrators. Students cannot alter invoice amounts or manually mark fees as paid.
            </p>
            <p>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Turnaround Time:</span> Once deposited at the bank, payments are reconciled and updated in your student portal ledger within 24 to 48 business hours.
            </p>
            <p>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Discrepancy Reporting:</span> If an approved bank deposit has not reflected after 48 hours, please bring your stamped Student Copy to the school accounts department for instant manual verification.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cleared Vouchers & Payment History */}
      {clearedInvoices.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Previously Settled Invoices ({clearedInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Billing Month</th>
                    <th className="py-3 px-4">Challan #</th>
                    <th className="py-3 px-4 text-right">Invoiced Amount</th>
                    <th className="py-3 px-4 text-right">Paid Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clearedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {inv.billing_month}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {inv.invoice_no}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatCurrency(inv.net_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(inv.paid_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="success" size="sm">
                          Paid in Full
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Printer className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedInvoiceForPrint(inv)}
                        >
                          Print Voucher
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3-Copy Bank Challan Modal */}
      <Modal
        isOpen={Boolean(selectedInvoiceForPrint)}
        onClose={() => setSelectedInvoiceForPrint(null)}
        title="Official 3-Part Bank Challan Voucher"
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
                Print / Save PDF (All 3 Copies)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
