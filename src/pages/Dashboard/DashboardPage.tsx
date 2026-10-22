import React, { useState, useEffect } from 'react';
import { dashboardApi } from '@/services/api';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import {
  GraduationCap,
  Users,
  School,
  ClipboardCheck,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'this_month' | 'last_3_months' | 'all'>('this_month');

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await dashboardApi.getLiveStatistics();
      setStats(data);
    } catch (e) {
      console.error('Failed to load dashboard statistics', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [dateFilter]);

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Financial chart data
  const financeChartData = [
    { name: 'Total Invoiced', amount: stats.financial.totalInvoiced },
    { name: 'Collected', amount: stats.financial.totalCollected },
    { name: 'Outstanding Dues', amount: stats.financial.totalOutstanding },
  ];

  // Attendance distribution data
  const attendancePieData = [
    { name: 'Present', value: stats.todayAttendance.present, color: '#10b981' },
    { name: 'Absent', value: stats.todayAttendance.absent, color: '#f43f5e' },
    { name: 'On Leave', value: stats.todayAttendance.leave, color: '#0ea5e9' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Institutional Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time administrative, financial and attendance metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            <option value="this_month">Current Billing Cycle</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="all">Entire Academic Year</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadStats} title="Refresh Live Data">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Students"
          value={stats.totalActiveStudents}
          subtitle="Enrolled in current session"
          icon={<GraduationCap className="w-5 h-5" />}
          color="navy"
        />

        <StatCard
          title="Active Teachers"
          value={stats.activeTeachers}
          subtitle="Assigned to academic faculty"
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />

        <StatCard
          title="Today's Attendance"
          value={`${stats.todayAttendance.percentage}%`}
          subtitle={`${stats.todayAttendance.present} Present, ${stats.todayAttendance.absent} Absent`}
          icon={<ClipboardCheck className="w-5 h-5" />}
          color={stats.todayAttendance.percentage >= 85 ? 'emerald' : 'amber'}
        />

        <StatCard
          title="Fees Collected"
          value={formatCurrency(stats.financial.totalCollected)}
          subtitle={`Dues: ${formatCurrency(stats.financial.totalOutstanding)}`}
          icon={<Receipt className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      {/* Visual Charts: Financial Health & Attendance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Flow Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Financial Reconciliation Breakdown</CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Invoiced Amounts vs. Verified Realized Payments (NUMERIC precision)
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
              {stats.financial.invoiceCount} Invoices
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeChartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Amount']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <Bar dataKey="amount" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Attendance Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Presence Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            {attendancePieData.length > 0 ? (
              <div className="h-72 w-full flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={attendancePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {attendancePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [value, 'Students']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 text-xs mt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Present ({stats.todayAttendance.present})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Absent ({stats.todayAttendance.absent})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    Leave ({stats.todayAttendance.leave})
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-center text-slate-500 text-xs p-4">
                <AlertCircle className="w-8 h-8 text-slate-400 mb-2" />
                <p>No attendance has been taken yet for today.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Navigate to Attendance to mark class rosters.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Upcoming Examinations & Recent Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Examinations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-brand-600" />
              <CardTitle>Academic Examinations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.upcomingExams && stats.upcomingExams.length > 0 ? (
              stats.upcomingExams.map((exam: any) => (
                <div
                  key={exam.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {exam.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(exam.start_date)} — {formatDate(exam.end_date)}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      exam.status === 'Published'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : exam.status === 'Under Review'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {exam.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">No scheduled exams found.</p>
            )}
          </CardContent>
        </Card>

        {/* Live Audit Log Feed */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-navy-800 dark:text-brand-400" />
              <CardTitle>Recent Administrative Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      by {log.actor_name}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">No audit records found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
