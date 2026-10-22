import React, { useState, useEffect } from 'react';
import { studentApi, academicStructureApi, feeApi, attendanceApi, examApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { exportToSafeCSV } from '@/lib/csv-sanitizer';
import {
  FileDown,
  Printer,
  Users,
  Receipt,
  ClipboardCheck,
  FileSpreadsheet,
  Award,
  Archive,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { selectedSessionId, currentSession } = useSchool();
  const [reportType, setReportType] = useState<
    'enrollment' | 'attendance' | 'fees' | 'exams' | 'archived'
  >('enrollment');

  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [archivedStudents, setArchivedStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadReportData = async () => {
      setIsLoading(true);
      try {
        const [enrList, invList, archList] = await Promise.all([
          studentApi.getEnrollments(selectedSessionId),
          feeApi.getInvoices(selectedSessionId),
          studentApi.getStudents(true),
        ]);
        setEnrollments(enrList);
        setInvoices(invList);
        setArchivedStudents(archList.filter((s) => !s.is_active));
      } catch (e) {
        console.error('Failed to load report data', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadReportData();
  }, [selectedSessionId]);

  const handleExportCurrent = () => {
    if (reportType === 'enrollment') {
      const rows = enrollments.map((e) => ({
        roll_no: e.roll_no,
        admission_no: e.student?.admission_no,
        student_name: e.student?.full_name,
        gender: e.student?.gender,
        class: e.section?.class?.name,
        section: e.section?.name,
        guardian: e.student?.guardian_name,
        phone: e.student?.guardian_phone,
        admission_date: e.student?.admission_date,
      }));
      exportToSafeCSV(rows, `Enrollment_Report_${currentSession?.name}`);
    } else if (reportType === 'fees') {
      const rows = invoices.map((i) => ({
        invoice_no: i.invoice_no,
        student: i.enrollment?.student?.full_name,
        class: i.enrollment?.section?.class?.name,
        month: i.billing_month,
        due_date: i.due_date,
        total: i.total_amount,
        discount: i.discount_amount,
        net: i.net_amount,
        paid: i.paid_amount,
        balance: Number(i.net_amount) - Number(i.paid_amount),
        status: i.status,
      }));
      exportToSafeCSV(rows, `Fee_Ledger_Report_${currentSession?.name}`);
    } else if (reportType === 'archived') {
      const rows = archivedStudents.map((s) => ({
        admission_no: s.admission_no,
        full_name: s.full_name,
        guardian_name: s.guardian_name,
        archived_at: s.archived_at,
        archive_reason: s.archive_reason,
      }));
      exportToSafeCSV(rows, `Archived_Students_${currentSession?.name}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Institutional Reports & Data Exports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified spreadsheet exports with formula-injection sanitization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => window.print()}
          >
            Print Report
          </Button>
          <Button
            size="sm"
            leftIcon={<FileDown className="w-4 h-4" />}
            onClick={handleExportCurrent}
          >
            Download CSV
          </Button>
        </div>
      </div>

      {/* Report Categories Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setReportType('enrollment')}
          className={`p-3 rounded-xl border text-left transition-all ${
            reportType === 'enrollment'
              ? 'border-navy-900 bg-navy-50/50 dark:bg-navy-950/60 font-bold'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <Users className="w-5 h-5 text-brand-600 mb-1" />
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Enrollment Register</div>
          <p className="text-[10px] text-slate-400 mt-0.5">{enrollments.length} Active Students</p>
        </button>

        <button
          onClick={() => setReportType('fees')}
          className={`p-3 rounded-xl border text-left transition-all ${
            reportType === 'fees'
              ? 'border-navy-900 bg-navy-50/50 dark:bg-navy-950/60 font-bold'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <Receipt className="w-5 h-5 text-emerald-600 mb-1" />
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Fee Accounts & Dues</div>
          <p className="text-[10px] text-slate-400 mt-0.5">{invoices.length} Invoices Tracked</p>
        </button>

        <button
          onClick={() => setReportType('archived')}
          className={`p-3 rounded-xl border text-left transition-all ${
            reportType === 'archived'
              ? 'border-navy-900 bg-navy-50/50 dark:bg-navy-950/60 font-bold'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <Archive className="w-5 h-5 text-amber-600 mb-1" />
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Archived Records</div>
          <p className="text-[10px] text-slate-400 mt-0.5">{archivedStudents.length} Students Archived</p>
        </button>
      </div>

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {reportType === 'enrollment' && 'Active Enrollment Roster'}
            {reportType === 'fees' && 'Fee Billing & Aging Ledger'}
            {reportType === 'archived' && 'Historical Archived Students'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[500px]">
            {reportType === 'enrollment' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">Roll #</th>
                    <th className="p-2.5">Adm #</th>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Class & Section</th>
                    <th className="p-2.5">Guardian</th>
                    <th className="p-2.5">Phone</th>
                    <th className="p-2.5">Admission Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {enrollments.map((e) => (
                    <tr key={e.id}>
                      <td className="p-2.5 font-mono font-bold">{e.roll_no}</td>
                      <td className="p-2.5 font-mono text-slate-500">{e.student?.admission_no}</td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{e.student?.full_name}</td>
                      <td className="p-2.5">{e.section?.class?.name} - {e.section?.name}</td>
                      <td className="p-2.5">{e.student?.guardian_name}</td>
                      <td className="p-2.5 font-mono text-slate-500">{e.student?.guardian_phone}</td>
                      <td className="p-2.5">{formatDate(e.student?.admission_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'fees' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Student</th>
                    <th className="p-2.5">Month</th>
                    <th className="p-2.5 text-right">Invoiced</th>
                    <th className="p-2.5 text-right">Paid</th>
                    <th className="p-2.5 text-right">Remaining</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="p-2.5 font-mono font-bold text-navy-900 dark:text-brand-400">{inv.invoice_no}</td>
                      <td className="p-2.5 font-medium">{inv.enrollment?.student?.full_name}</td>
                      <td className="p-2.5">{inv.billing_month}</td>
                      <td className="p-2.5 text-right font-mono">{formatCurrency(inv.net_amount)}</td>
                      <td className="p-2.5 text-right font-mono text-emerald-600 font-bold">{formatCurrency(inv.paid_amount)}</td>
                      <td className="p-2.5 text-right font-mono text-rose-600 font-bold">
                        {formatCurrency(Math.max(0, Number(inv.net_amount) - Number(inv.paid_amount)))}
                      </td>
                      <td className="p-2.5 text-center">{inv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'archived' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">Admission #</th>
                    <th className="p-2.5">Full Name</th>
                    <th className="p-2.5">Guardian</th>
                    <th className="p-2.5">Archived On</th>
                    <th className="p-2.5">Archive Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {archivedStudents.map((s) => (
                    <tr key={s.id}>
                      <td className="p-2.5 font-mono">{s.admission_no}</td>
                      <td className="p-2.5 font-semibold">{s.full_name}</td>
                      <td className="p-2.5">{s.guardian_name}</td>
                      <td className="p-2.5">{formatDate(s.archived_at)}</td>
                      <td className="p-2.5 text-slate-500">{s.archive_reason || 'Archived'}</td>
                    </tr>
                  ))}
                  {archivedStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No students are currently archived.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
