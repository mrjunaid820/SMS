import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studentPortalApi } from '@/services/api';
import { AttendanceRecord, AttendanceStatus } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/lib/utils';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Filter,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  School,
  FileText,
} from 'lucide-react';

export const MyAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [attendanceData, setAttendanceData] = useState<{
    student: any;
    enrollment?: any;
    enrollments?: any[];
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
    attendancePercentage: number;
    records: AttendanceRecord[];
    monthlySummary: {
      month: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      leave: number;
      percentage: number;
    }[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const loadAttendance = async (month?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const data = await studentPortalApi.getMyAttendance(identifier, {
        month: month !== 'all' ? month : undefined,
      });
      setAttendanceData(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load attendance records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance(selectedMonth);
  }, [user, selectedMonth]);

  const uniqueMonths = useMemo(() => {
    if (!attendanceData?.monthlySummary) return [];
    return attendanceData.monthlySummary.map((m) => m.month);
  }, [attendanceData?.monthlySummary]);

  const formatMonthName = (monthStr: string) => {
    if (!monthStr || monthStr === 'all') return 'All Months';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getStatusBadge = (status: AttendanceStatus | string) => {
    switch (status) {
      case 'Present':
        return (
          <Badge variant="success" className="inline-flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Present
          </Badge>
        );
      case 'Late':
        return (
          <Badge variant="warning" className="inline-flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3 text-amber-600" /> Late
          </Badge>
        );
      case 'Leave':
        return (
          <Badge variant="info" className="inline-flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3 text-sky-600" /> Approved Leave
          </Badge>
        );
      case 'Absent':
      default:
        return (
          <Badge variant="danger" className="inline-flex items-center gap-1 font-medium">
            <XCircle className="w-3 h-3 text-rose-600" /> Absent
          </Badge>
        );
    }
  };

  if (isLoading && !attendanceData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your attendance records...</p>
        </div>
      </div>
    );
  }

  if (error || !attendanceData?.student) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Unable to Load Attendance</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {error || 'No active enrollment record was found for your student profile.'}
        </p>
        <Button size="sm" onClick={() => loadAttendance(selectedMonth)}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Try Again
        </Button>
      </div>
    );
  }

  const {
    totalDays,
    presentDays,
    absentDays,
    lateDays,
    leaveDays,
    attendancePercentage,
    records,
    monthlySummary,
    enrollment,
    student,
  } = attendanceData;

  const currentClassName =
    enrollment?.section?.class?.name || enrollment?.section?.name
      ? `Class ${enrollment.section?.class?.name || ''} - Section ${enrollment.section?.name || ''}`
      : 'Class 9 - Section A';

  const currentSessionName = enrollment?.academic_session?.name || 'Academic Session 2025-2026';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            <CalendarCheck className="w-4 h-4" />
            <span>Student Attendance Record</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            My Attendance History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {currentClassName} • {currentSessionName} • Student: {student?.full_name || 'Enrolled Student'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Filter */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Filter attendance by month"
              className="bg-transparent text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Months</option>
              {uniqueMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthName(m)}
                </option>
              ))}
            </select>
          </div>

          <Button size="sm" variant="outline" onClick={() => loadAttendance(selectedMonth)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter notification pill if month selected */}
      {selectedMonth !== 'all' && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-800 dark:text-blue-300">
          <span>
            Showing records for <strong>{formatMonthName(selectedMonth)}</strong> ({records.length} session{records.length === 1 ? '' : 's'})
          </span>
          <button
            onClick={() => setSelectedMonth('all')}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            Show All Months
          </button>
        </div>
      )}

      {/* 6 Attendance Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Overall Attendance Rate */}
        <div className="p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-[#0e2a1d] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Attendance Rate</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-950 dark:text-white">
            {totalDays > 0 ? `${attendancePercentage}%` : 'N/A'}
          </div>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80 mt-1">
            {attendancePercentage >= 85
              ? 'Excellent'
              : attendancePercentage >= 75
              ? 'Satisfactory'
              : totalDays === 0
              ? 'No sessions yet'
              : 'Attention required'}
          </p>
        </div>

        {/* 2. Total Recorded Sessions */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Total Sessions</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-950 dark:text-white">
            {totalDays}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Recorded school days
          </p>
        </div>

        {/* 3. Days Present */}
        <div className="p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-[#13233a] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">Days Present</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-950 dark:text-white">
            {presentDays}
          </div>
          <p className="text-[10px] text-blue-600 dark:text-blue-400/80 mt-1">
            Full sessions attended
          </p>
        </div>

        {/* 4. Days Absent */}
        <div className="p-4 rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/70 dark:bg-[#2d1519] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">Days Absent</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-950 dark:text-white">
            {absentDays}
          </div>
          <p className="text-[10px] text-rose-600 dark:text-rose-400/80 mt-1">
            Unexcused absences
          </p>
        </div>

        {/* 5. Days Late */}
        <div className="p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/70 dark:bg-[#2e2311] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Days Late</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-950 dark:text-white">
            {lateDays}
          </div>
          <p className="text-[10px] text-amber-700 dark:text-amber-400/80 mt-1">
            Tardy arrivals noted
          </p>
        </div>

        {/* 6. Approved Leaves */}
        <div className="p-4 rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/70 dark:bg-[#241738] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300">Approved Leaves</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-950 dark:text-white">
            {leaveDays}
          </div>
          <p className="text-[10px] text-purple-600 dark:text-purple-400/80 mt-1">
            Official leave slips
          </p>
        </div>
      </div>

      {/* Monthly Summary Breakdown (if multiple months exist) */}
      {monthlySummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Monthly Attendance Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {monthlySummary.map((m) => (
                <div
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedMonth === m.month
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {formatMonthName(m.month)}
                    </span>
                    <Badge variant={m.percentage >= 85 ? 'success' : m.percentage >= 75 ? 'warning' : 'danger'}>
                      {m.percentage}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 py-1">
                    <span>Present: {m.present}</span>
                    <span>Late: {m.late}</span>
                    <span>Absent: {m.absent}</span>
                    <span>Leave: {m.leave}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, m.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance History Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
            <span>Attendance Log</span>
            <span className="text-xs font-normal text-slate-400">({records.length} records)</span>
          </CardTitle>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Sorted chronologically (Newest first)
          </div>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CalendarCheck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No attendance records found
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No attendance marks have been recorded for the selected period. Attendance marked by administration or teachers will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Class & Section</th>
                    <th className="py-2.5 px-3">Session / Period</th>
                    <th className="py-2.5 px-3">Attendance Status</th>
                    <th className="py-2.5 px-3">Remarks / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {records.map((r) => {
                    const rowClass =
                      r.enrollment?.section?.class?.name || r.enrollment?.section?.name
                        ? `Class ${r.enrollment.section?.class?.name || ''} - ${r.enrollment.section?.name || ''}`
                        : currentClassName;

                    const rowSession =
                      r.enrollment?.academic_session?.name || currentSessionName;

                    return (
                      <tr
                        key={r.id || `${r.date}-${r.enrollment_id}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <School className="w-3 h-3 text-slate-400" />
                            {rowClass}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {rowSession}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {getStatusBadge(r.status)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {r.remarks || '—'}
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
    </div>
  );
};
export default MyAttendancePage;
