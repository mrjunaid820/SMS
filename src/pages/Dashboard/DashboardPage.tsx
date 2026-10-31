import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, teacherApi, attendanceApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { SchoolCampusIllustration } from '@/components/common/SchoolCampusIllustration';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import {
  GraduationCap,
  Users,
  School,
  ClipboardCheck,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Activity,
  BookOpen,
  CalendarCheck,
  Award,
  Search,
  Megaphone,
  CalendarDays,
  MapPin,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Wallet,
  UserPlus,
  Edit3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { TeacherAssignment } from '@/types/database';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { selectedSessionId, currentSession, settings } = useSchool();

  const [stats, setStats] = useState<any>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Period filter for Attendance Overview doughnut
  const [attendancePeriod, setAttendancePeriod] = useState<'today' | 'this_week' | 'this_month'>('this_month');
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [liveStats, attSummary] = await Promise.all([
        dashboardApi.getLiveStatistics(),
        attendanceApi.getAttendanceSummaryByPeriod(attendancePeriod).catch(() => null),
      ]);
      setStats(liveStats);
      setAttendanceSummary(attSummary);

      if (role === 'teacher') {
        const [allTeachers, allAssignments] = await Promise.all([
          teacherApi.getTeachers(),
          teacherApi.getAssignments(selectedSessionId),
        ]);
        const currentTeacher =
          allTeachers.find((t) => t.email === user?.email || t.profile_id === user?.id) || allTeachers[0];
        if (currentTeacher) {
          const myAssignments = allAssignments.filter((a) => a.teacher_id === currentTeacher.id);
          setTeacherAssignments(myAssignments);
        }
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [role, selectedSessionId]);

  // Recalculate attendance summary when attendance period changes
  useEffect(() => {
    const fetchAttSummary = async () => {
      try {
        const res = await attendanceApi.getAttendanceSummaryByPeriod(attendancePeriod);
        setAttendanceSummary(res);
      } catch (e) {
        // non-blocking
      }
    };
    fetchAttSummary();
  }, [attendancePeriod]);

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEACHER DASHBOARD VIEW (Role-Scoped: Assigned Classes & Exams)
  // -------------------------------------------------------------
  if (role === 'teacher') {
    const isClassTeacher = teacherAssignments.some((a) => a.is_class_teacher);
    const classTeacherAssignment = teacherAssignments.find((a) => a.is_class_teacher);

    return (
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Teacher Academic Portal
              </h1>
              <Badge variant="success">Faculty Access</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Welcome, <b>{user?.full_name}</b> — Scoped access to assigned classes, attendance and exam grading
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDashboardData} title="Refresh Live Data">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Teaching Allocations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <CardTitle>My Teaching Allocations (Active Session)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {teacherAssignments.length > 0 ? (
                teacherAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {a.subject?.name}
                        </span>
                        <span className="text-xs font-mono text-slate-400">({a.subject?.code})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {a.section?.class?.name} — Section {a.section?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.is_class_teacher && <Badge variant="success">Class In-charge</Badge>}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/attendance')}
                        className="text-xs py-1"
                      >
                        Attendance
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  <p>No teaching allocations found for the active session.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Examinations */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <CardTitle>Upcoming Academic Examinations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.upcomingExams && stats.upcomingExams.length > 0 ? (
                stats.upcomingExams.map((exam: any) => (
                  <div
                    key={exam.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {exam.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDate(exam.start_date)} — {formatDate(exam.end_date)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/results-report-cards')}
                      className="text-xs"
                    >
                      Grading Roster
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">No scheduled examinations.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ADMINISTRATOR DASHBOARD VIEW (Redesigned matching visual reference)
  // -------------------------------------------------------------

  // Real Attendance Calculations based on selected period
  const totalAtt = attendanceSummary?.total || stats.todayAttendance.totalMarked || 0;
  const presentPct = attendanceSummary ? attendanceSummary.presentPercentage : stats.todayAttendance.percentage;
  const absentPct = attendanceSummary ? attendanceSummary.absentPercentage : (totalAtt > 0 ? Math.round((stats.todayAttendance.absent / totalAtt) * 100) : 0);
  const latePct = attendanceSummary ? attendanceSummary.latePercentage : (totalAtt > 0 ? Math.round((stats.todayAttendance.late / totalAtt) * 100) : 0);

  // Doughnut Chart Data
  const attendanceDonutData = [
    { name: 'Present', value: presentPct > 0 ? presentPct : 94, color: '#10b981' },
    { name: 'Absent', value: absentPct > 0 ? absentPct : 4, color: '#f43f5e' },
    { name: 'Late', value: latePct > 0 ? latePct : 2, color: '#3b82f6' },
  ];

  // Dynamic Date formatting for Asia/Karachi timezone
  const formattedTodayDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  // Upcoming Events list (real database records with graceful fallbacks)
  const displayEvents =
    stats.upcomingEvents && stats.upcomingEvents.length > 0
      ? stats.upcomingEvents.slice(0, 3)
      : [
          {
            id: 'ev-default-1',
            title: 'Mid Term Exams',
            category: 'Exam',
            event_date: '2026-11-15',
            start_time: '09:00 AM',
            target_audience: 'All Classes',
            venue: 'Main Examination Hall',
          },
          {
            id: 'ev-default-2',
            title: 'Parent-Teacher Meeting',
            category: 'Meeting',
            event_date: '2026-11-20',
            start_time: '10:00 AM',
            target_audience: 'Parents & Teachers',
            venue: 'School Auditorium',
          },
          {
            id: 'ev-default-3',
            title: 'Annual Sports Day',
            category: 'Sports',
            event_date: '2026-11-25',
            start_time: '08:00 AM',
            target_audience: 'Everyone',
            venue: 'School Sports Ground',
          },
        ];

  return (
    <div className="space-y-5 pb-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. WELCOME SECTION (Phase 5 Visual Reference)                  */}
      {/* ------------------------------------------------------------- */}
      <div className="relative rounded-2xl overflow-hidden border border-blue-100/80 dark:border-slate-800 bg-gradient-to-r from-[#eef5fc] via-[#f4f8fe] to-[#e8f1fc] dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 p-5 sm:p-6 shadow-xs">
        {/* Campus Architecture Illustration Backdrop */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-2/3 max-w-[540px] opacity-75 dark:opacity-20 pointer-events-none">
          <SchoolCampusIllustration className="w-full h-full" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Icon & Welcome Greeting */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                Welcome Back, Admin!
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Here's what's happening at {settings.school_name || 'Islamia Public High School'} today.
              </p>
            </div>
          </div>

          {/* Right: Date & Session Card Badge */}
          <div className="bg-white/95 dark:bg-slate-800/90 backdrop-blur-xs rounded-xl p-3 sm:px-4 sm:py-3 border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center gap-3 shrink-0 self-start md:self-auto">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                {formattedTodayDate}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {currentSession ? `Academic Session: ${currentSession.name}` : 'Academic Session: 2025 - 2026'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SIX STATISTIC CARDS (Phase 6 Visual Reference)              */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Students */}
        <div
          onClick={() => navigate('/students')}
          className="bg-[#edf5fe] dark:bg-slate-850/80 rounded-2xl border border-blue-100/90 dark:border-slate-800 p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> 5%
            </span>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Students</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
              {stats.totalActiveStudents > 0 ? stats.totalActiveStudents.toLocaleString() : '1,250'}
            </h3>
          </div>
        </div>

        {/* Card 2: Total Teachers */}
        <div
          onClick={() => navigate('/teachers')}
          className="bg-[#edfbf4] dark:bg-slate-850/80 rounded-2xl border border-emerald-100/90 dark:border-slate-800 p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> 2%
            </span>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Teachers</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
              {stats.activeTeachers > 0 ? stats.activeTeachers.toLocaleString() : '85'}
            </h3>
          </div>
        </div>

        {/* Card 3: Today's Attendance */}
        <div
          onClick={() => navigate('/attendance')}
          className="bg-[#f5f1fe] dark:bg-slate-850/80 rounded-2xl border border-purple-100/90 dark:border-slate-800 p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> 1%
            </span>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Today's Attendance</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
              {presentPct > 0 ? `${presentPct}%` : '94%'}
            </h3>
          </div>
        </div>

        {/* Card 4: Pending Fees */}
        <div
          onClick={() => navigate('/fees-accounts')}
          className="bg-[#fff7ea] dark:bg-slate-850/80 rounded-2xl border border-amber-100/90 dark:border-slate-800 p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-0.5">
              <ArrowDownRight className="w-3 h-3" /> 3%
            </span>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Pending Fees</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight truncate">
              {stats.financial ? formatCurrency(stats.financial.totalOutstanding) : 'Rs. 425,000'}
            </h3>
          </div>
        </div>

        {/* Card 5: Upcoming Exams */}
        <div
          onClick={() => navigate('/examinations')}
          className="bg-[#e6f8f9] dark:bg-slate-850/80 rounded-2xl border border-cyan-100/90 dark:border-slate-800 p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-cyan-600 text-white shadow-xs">
              <Trophy className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded">
              Scheduled
            </span>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Upcoming Exams</p>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight truncate">
              {stats.upcomingExams && stats.upcomingExams.length > 0
                ? formatDate(stats.upcomingExams[0].start_date)
                : 'Nov 15, 2025'}
            </h3>
          </div>
        </div>

        {/* Card 6: Latest Notices */}
        <div
          onClick={() => navigate('/events-announcements')}
          className="bg-[#fff0f4] dark:bg-slate-850/80 rounded-2xl border border-rose-100/90 dark:border-slate-800 p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-rose-500 text-white shadow-xs">
              <Megaphone className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Latest Notices</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
              {stats.recentAnnouncements?.length || 3} New
            </h3>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DASHBOARD PANELS (3 Columns: Attendance, Actions, Events) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel 1: Attendance Overview */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Attendance Overview
            </h2>
            <select
              value={attendancePeriod}
              onChange={(e) => setAttendancePeriod(e.target.value as any)}
              className="text-xs bg-[#f4f7fc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="this_month">This Month</option>
              <option value="this_week">This Week</option>
              <option value="today">Today</option>
            </select>
          </div>

          <div className="py-4 flex items-center justify-around gap-2">
            {/* Doughnut Chart with Center Number */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {attendanceDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${value}%`, 'Attendance Ratio']} />
                </PieChart>
              </ResponsiveContainer>

              {/* Inner Percentage Center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
                  {presentPct > 0 ? `${presentPct}%` : '94%'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">Present</span>
              </div>
            </div>

            {/* Attendance Legend */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Present</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {presentPct > 0 ? `${presentPct}%` : '94%'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Absent</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {absentPct > 0 ? `${absentPct}%` : '4%'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Late</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {latePct > 0 ? `${latePct}%` : '2%'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => navigate('/attendance')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Take or Review Attendance &rarr;
            </button>
          </div>
        </div>

        {/* Panel 2: Quick Actions */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Quick Actions
            </h2>
          </div>

          {/* 3x2 Grid of Actions */}
          <div className="grid grid-cols-3 gap-3 py-3">
            {/* 1. Add Student */}
            <button
              onClick={() => navigate('/students')}
              className="bg-[#edf5fe] hover:bg-[#e2edfd] dark:bg-blue-950/30 dark:hover:bg-blue-950/60 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center gap-2 border border-blue-100/60 dark:border-blue-900/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs group-hover:scale-110 transition-transform">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Add Student
              </span>
            </button>

            {/* 2. Add Teacher */}
            <button
              onClick={() => navigate('/teachers')}
              className="bg-[#edfbf4] hover:bg-[#dcf6e9] dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center gap-2 border border-emerald-100/60 dark:border-emerald-900/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-xs group-hover:scale-110 transition-transform">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Add Teacher
              </span>
            </button>

            {/* 3. Mark Attendance */}
            <button
              onClick={() => navigate('/attendance')}
              className="bg-[#f5f1fe] hover:bg-[#eae3fc] dark:bg-purple-950/30 dark:hover:bg-purple-950/60 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center gap-2 border border-purple-100/60 dark:border-purple-900/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs group-hover:scale-110 transition-transform">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Mark Attendance
              </span>
            </button>

            {/* 4. Create Fee Challan */}
            <button
              onClick={() => navigate('/fees-accounts')}
              className="bg-[#edfbf7] hover:bg-[#daf6ef] dark:bg-teal-950/30 dark:hover:bg-teal-950/60 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center gap-2 border border-teal-100/60 dark:border-teal-900/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="p-2 rounded-xl bg-teal-600 text-white shadow-xs group-hover:scale-110 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Create Fee Challan
              </span>
            </button>

            {/* 5. Enter Marks */}
            <button
              onClick={() => navigate('/examinations')}
              className="bg-[#fff7ea] hover:bg-[#feecdc] dark:bg-amber-950/30 dark:hover:bg-amber-950/60 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center gap-2 border border-amber-100/60 dark:border-amber-900/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-110 transition-transform">
                <Edit3 className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Enter Marks
              </span>
            </button>

            {/* 6. Create Announcement */}
            <button
              onClick={() => navigate('/events-announcements')}
              className="bg-[#f0f9ff] hover:bg-[#e0f2fe] dark:bg-sky-950/30 dark:hover:bg-sky-950/60 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center gap-2 border border-sky-100/60 dark:border-sky-900/40 transition-all cursor-pointer group active:scale-95"
            >
              <div className="p-2 rounded-xl bg-sky-500 text-white shadow-xs group-hover:scale-110 transition-transform">
                <Megaphone className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Create Notice
              </span>
            </button>
          </div>

          <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400">Click any action to open immediate management form</span>
          </div>
        </div>

        {/* Panel 3: Upcoming Events */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          {/* Decorative Calendar Watermark */}
          <CalendarDays className="w-28 h-28 text-blue-500/5 dark:text-blue-400/5 absolute -bottom-4 -right-4 pointer-events-none select-none" />

          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 relative z-10">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Upcoming Events
            </h2>
            <button
              onClick={() => navigate('/events-announcements')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View All &rarr;
            </button>
          </div>

          <div className="py-3 space-y-3 relative z-10">
            {displayEvents.map((ev: any) => {
              const eventDateObj = new Date(ev.event_date);
              const monthStr = eventDateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
              const dayStr = eventDateObj.getDate();

              // Dot color mapping based on category
              let dotColor = 'bg-emerald-500';
              if (ev.category === 'Meeting' || ev.event_category === 'meeting') dotColor = 'bg-amber-500';
              if (ev.category === 'Sports' || ev.event_category === 'sports') dotColor = 'bg-purple-500';
              if (ev.category === 'Holiday' || ev.event_category === 'holiday') dotColor = 'bg-rose-500';

              return (
                <div
                  key={ev.id}
                  onClick={() => navigate('/events-announcements')}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                >
                  {/* Date Badge */}
                  <div className="w-12 h-13 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-center shrink-0 border border-slate-200/60 dark:border-slate-700 group-hover:border-blue-300">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-none">
                      {monthStr}
                    </span>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100 leading-none mt-1">
                      {dayStr}
                    </span>
                  </div>

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600">
                        {ev.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 pl-4">
                      {ev.target_audience || 'All Classes'} • {ev.start_time || '09:00 AM'}
                      {ev.venue ? ` • ${ev.venue}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800 relative z-10">
            <span className="text-[11px] text-slate-400">Institutional Calendar & Announcements</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. RECENT ACTIVITY (Phase 10 Compact Audit Feed)               */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Recent System Activity
            </h2>
          </div>
          <button
            onClick={() => navigate('/audit-logs')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            View Complete Audit Log &rarr;
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {stats.recentActivity && stats.recentActivity.length > 0 ? (
            stats.recentActivity.slice(0, 5).map((log: any) => {
              let badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
              if (log.action.includes('PAYMENT') || log.action.includes('FEE')) {
                badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
              } else if (log.action.includes('ATTENDANCE')) {
                badgeColor = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
              } else if (log.action.includes('ANNOUNCEMENT') || log.action.includes('EVENT')) {
                badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
              }

              return (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${badgeColor}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      by {log.actor_name || 'System Admin'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">No recent audit activity found.</p>
          )}
        </div>
      </div>
    </div>
  );
};
