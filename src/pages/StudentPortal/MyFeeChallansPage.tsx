import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { studentPortalApi } from '@/services/api';
import { FeeInvoice, InvoiceStatus } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { PrintFeeVoucher } from '@/components/print/PrintFeeVoucher';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FileDown,
  Printer,
  Calendar,
  CreditCard,
  Building,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  AlertCircle,
  FileText,
  Clock,
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

export const MyFeeChallansPage: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSchool();

  const [challans, setChallans] = useState<FeeInvoice[]>([]);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Print voucher modal
  const [activeChallanForPrint, setActiveChallanForPrint] = useState<FeeInvoice | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const data = await studentPortalApi.getMyFees(identifier);
      setChallans(data.invoices);
      setStudentInfo(data.student);
    } catch (err: any) {
      setError(err.message || 'Failed to load fee challans.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const billingMonths = useMemo(() => {
    return Array.from(new Set(challans.map((c) => c.billing_month))).sort((a, b) => b.localeCompare(a));
  }, [challans]);

  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      if (selectedMonth !== 'all' && c.billing_month !== selectedMonth) return false;
      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
      return true;
    });
  }, [challans, selectedMonth, selectedStatus]);

  const handleResetFilters = () => {
    setSelectedMonth('all');
    setSelectedStatus('all');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading student fee challans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Unable to Load Challans</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Download & Print Fee Challans
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Official 3-copy bank vouchers (Bank, School & Student copies)
          </p>
        </div>

        <Badge variant="info" size="md">
          <Building className="w-3.5 h-3.5 mr-1" />
          Bank Deposit Challans
        </Badge>
      </div>

      {/* Advisory Banner */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed space-y-1">
          <div className="font-semibold">Deposit Instructions & Bank Protocol:</div>
          <div>
            Print the official 3-copy voucher and present it at any authorized branch of <span className="font-semibold">{settings.bank_name || 'Habib Bank Ltd (HBL)'}</span>. After receiving deposit confirmation, retain the Student Copy for your permanent records.
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Filter by Billing Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
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

            <div className="sm:w-56">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Filter by Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Statuses</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Overdue">Overdue</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            {(selectedMonth !== 'all' || selectedStatus !== 'all') && (
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

      {/* Challans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredChallans.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <FileDown className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No fee challans found
            </p>
            <p className="text-xs text-slate-500">
              No fee vouchers match your selected filters.
            </p>
          </div>
        ) : (
          filteredChallans.map((challan) => {
            const balance = Math.max(0, Number(challan.net_amount) - Number(challan.paid_amount));
            const isOverdue = challan.status === 'Overdue';
            const badgeVariant = getStatusBadgeVariant(challan.status);

            return (
              <Card
                key={challan.id}
                className="flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
              >
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono text-slate-400 block">
                        Challan #{challan.invoice_no}
                      </span>
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {challan.billing_month} Fee Voucher
                      </CardTitle>
                    </div>
                    <Badge variant={badgeVariant} size="sm">
                      {challan.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-3 text-xs flex-1">
                  <div className="space-y-1 py-1">
                    <div className="flex justify-between text-slate-500">
                      <span>Issue Date:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {formatDate(challan.issue_date)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Due Date:</span>
                      <span className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
                        {formatDate(challan.due_date)}
                      </span>
                    </div>
                  </div>

                  {/* Fee Items Breakdown */}
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                      Fee Breakdown
                    </div>
                    {challan.items && challan.items.length > 0 ? (
                      challan.items.map((it) => (
                        <div key={it.id} className="flex justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400 truncate max-w-[170px]">
                            {it.description}
                          </span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">
                            {formatCurrency(it.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-400">Monthly Tuition Fee</span>
                        <span className="font-mono">{formatCurrency(challan.total_amount)}</span>
                      </div>
                    )}
                    {Number(challan.discount_amount) > 0 && (
                      <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1 border-t border-slate-200 dark:border-slate-700">
                        <span>Scholarship / Discount</span>
                        <span>-{formatCurrency(challan.discount_amount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Figures */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Net Amount:</span>
                      <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(challan.net_amount)}
                      </span>
                    </div>
                    {balance > 0 ? (
                      <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
                        <span className="font-medium">Remaining Due:</span>
                        <span className="font-mono font-bold">{formatCurrency(balance)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>Payment Status:</span>
                        <span>Fully Paid & Cleared</span>
                      </div>
                    )}
                  </div>
                </CardContent>

                <div className="p-4 pt-0">
                  <Button
                    className="w-full"
                    size="sm"
                    variant={challan.status === 'Paid' ? 'outline' : 'primary'}
                    leftIcon={<Printer className="w-3.5 h-3.5" />}
                    onClick={() => setActiveChallanForPrint(challan)}
                  >
                    {challan.status === 'Paid' ? 'View / Print Paid Voucher' : 'Print Bank Challan'}
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* 3-Copy Bank Challan Voucher Modal */}
      <Modal
        isOpen={Boolean(activeChallanForPrint)}
        onClose={() => setActiveChallanForPrint(null)}
        title={`Official Fee Challan Voucher — ${activeChallanForPrint?.invoice_no || ''}`}
        size="full"
      >
        {activeChallanForPrint && (
          <div className="space-y-4">
            <PrintFeeVoucher invoice={activeChallanForPrint} settings={settings} />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 no-print">
              <Button variant="outline" onClick={() => setActiveChallanForPrint(null)}>
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
