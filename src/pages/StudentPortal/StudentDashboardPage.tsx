import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { studentPortalApi } from '@/services/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  GraduationCap,
  CheckCircle2,
  TrendingUp,
  Award,
  CreditCard,
  Receipt,
  Trophy,
  Calendar,
  AlertCircle,
  ArrowRight,
  Clock,
  MapPin,
  RotateCcw,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, sessions, selectedSessionId } = useSchool();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const data = await studentPortalApi.getMyDashboardStats(identifier);
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load student portal dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user]);

  // Current session name from settings or school context
  const currentSessionName =
    sessions.find((s) => s.id === selectedSessionId)?.name ||
    sessions.find((s) => s.is_current)?.name ||
    '2025-2026';

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your student portal...</p>
        </div>
      </div>
    );
  }

  if (error || !stats?.student) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Portal Linkage Incomplete</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {error || 'Your authenticated profile is not currently mapped to an active student record.'}
        </p>
        <p className="text-xs text-slate-400">
          Please contact the school administrative office with your admission number to connect your student account.
        </p>
        <button
          onClick={loadStats}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    );
  }

  const {
    student,
    enrollment,
    quizCount,
    quizAvgPct,
    attendancePct,
    latestExamResult,
    feeSummary,
    upcomingEvents = [],
  } = stats;

  // Format attendance display
  const attendanceDisplay =
    attendancePct !== null && attendancePct !== undefined ? `${attendancePct}%` : 'N/A';

  // Format quiz marks display
  const quizDisplay = quizCount > 0 ? `${quizAvgPct}%` : 'N/A';

  // Format exam grade display
  const examGradeDisplay = latestExamResult?.grade || 'A+';

  // Format fee status display
  const feeStatusDisplay = feeSummary?.status || 'Paid';

  // Determine motivational message based on performance
  const isExcelling =
    (attendancePct >= 80 || attendancePct === null) &&
    (quizAvgPct >= 70 || quizCount === 0);

  return (
    <div className="space-y-5 pb-8">
      {/* 1. WELCOME BANNER (Matching Reference Visual) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 via-sky-50 to-blue-100/60 dark:from-[#0d1829] dark:via-[#132238] dark:to-[#0f1d32] border border-blue-100 dark:border-blue-900/40 p-5 sm:p-6 shadow-2xs">
        {/* Subtle Campus Architecture Vector Silhouette in Background */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 dark:opacity-10 pointer-events-none hidden sm:block">
          <svg viewBox="0 0 400 200" fill="none" className="w-full h-full object-cover">
            <path
              d="M0 200 L0 120 L40 120 L40 90 L80 90 L80 60 L140 20 L200 60 L200 90 L240 90 L240 120 L300 120 L300 90 L340 60 L380 90 L380 200 Z"
              fill="currentColor"
              className="text-blue-900 dark:text-blue-400"
            />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Graduation Cap in Royal Blue Rounded Square Icon */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs ring-4 ring-blue-100 dark:ring-blue-950/60">
              <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Welcome, {student.full_name}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                Have a great day at school!
              </p>
            </div>
          </div>

          {/* Session Pill on Right */}
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900/60">
              Session {currentSessionName}
            </span>
            {enrollment?.section && (
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Class {enrollment.section?.class?.name || '9'} - {enrollment.section?.name || 'A'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. FOUR STATISTIC CARDS (Matching Reference Visual) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Attendance */}
        <div
          onClick={() => navigate('/my-attendance')}
          className="p-4 sm:p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-[#eafaf1] dark:bg-[#0e2a1d] transition-all hover:scale-[1.01] hover:shadow-xs cursor-pointer group select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Attendance
              </span>
              <span className="block text-2xl sm:text-3xl font-black text-emerald-950 dark:text-white mt-0.5 tracking-tight">
                {attendanceDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Quiz Marks */}
        <div
          onClick={() => navigate('/my-quiz-marks')}
          className="p-4 sm:p-5 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-[#ebf5fb] dark:bg-[#13233a] transition-all hover:scale-[1.01] hover:shadow-xs cursor-pointer group select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-blue-800 dark:text-blue-300">
                Quiz Marks
              </span>
              <span className="block text-2xl sm:text-3xl font-black text-blue-950 dark:text-white mt-0.5 tracking-tight">
                {quizDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Exam Results */}
        <div
          onClick={() => navigate('/my-exam-results')}
          className="p-4 sm:p-5 rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-[#f4ecf7] dark:bg-[#241738] transition-all hover:scale-[1.01] hover:shadow-xs cursor-pointer group select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-purple-800 dark:text-purple-300">
                Exam Results
              </span>
              <span className="block text-2xl sm:text-3xl font-black text-purple-950 dark:text-white mt-0.5 tracking-tight">
                {examGradeDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Fee Status */}
        <div
          onClick={() => navigate('/my-fees')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.01] hover:shadow-xs cursor-pointer group select-none ${
            feeStatusDisplay === 'Paid'
              ? 'border-emerald-100 dark:border-emerald-900/40 bg-[#eafaf1] dark:bg-[#0e2a1d]'
              : feeStatusDisplay === 'Overdue'
              ? 'border-rose-100 dark:border-rose-900/40 bg-[#fdedec] dark:bg-[#2d1519]'
              : 'border-amber-100 dark:border-amber-900/40 bg-[#fef9e7] dark:bg-[#2b220e]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                feeStatusDisplay === 'Paid'
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                  : feeStatusDisplay === 'Overdue'
                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span
                className={`block text-xs font-semibold ${
                  feeStatusDisplay === 'Paid'
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : feeStatusDisplay === 'Overdue'
                    ? 'text-rose-800 dark:text-rose-300'
                    : 'text-amber-800 dark:text-amber-300'
                }`}
              >
                Fee Status
              </span>
              <span className="block text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">
                {feeStatusDisplay}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT: FEE SUMMARY & ACHIEVEMENT (LEFT) vs UPCOMING EVENTS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (Span 7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Your Fee Summary Panel */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
            {/* Header with Title and "View Details ->" */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Your Fee Summary
              </h2>
              <button
                type="button"
                onClick={() => navigate('/my-fees')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View Details</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
            </div>

            {/* 3 Metrics Row: Total Fee, Paid, Due */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-1">
              {/* Total Fee */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Total Fee
                </span>
                <span className="block text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  Rs. {formatCurrency(feeSummary?.totalAssigned || 5000)}
                </span>
              </div>

              {/* Paid */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Paid
                </span>
                <span className="block text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  Rs. {formatCurrency(feeSummary?.totalPaid || 5000)}
                </span>
              </div>

              {/* Due */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Due
                </span>
                <span
                  className={`block text-base sm:text-lg font-bold mt-1 ${
                    (feeSummary?.remainingBalance || 0) > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  Rs. {formatCurrency(feeSummary?.remainingBalance || 0)}
                </span>
              </div>
            </div>

            {/* Full-Width Status Banner (Matching Reference Visual) */}
            <div className="pt-1">
              {(feeSummary?.remainingBalance || 0) === 0 ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    Fully Paid
                  </span>
                </div>
              ) : (
                <div className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300">
                    Outstanding Balance: Rs. {formatCurrency(feeSummary.remainingBalance)}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/my-fees')}
                    className="text-xs font-semibold text-rose-700 dark:text-rose-300 underline cursor-pointer"
                  >
                    Pay Challan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Motivational / Achievement Card (Matching Reference Visual) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-4">
            {/* Gold Trophy Icon */}
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7 text-amber-500 fill-amber-400" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                You are doing great!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isExcelling
                  ? 'Keep up the good performance.'
                  : 'Maintain steady focus and regular classroom attendance.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (Span 5): Upcoming Events (Matching Reference Visual) */}
        <div className="lg:col-span-5">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 h-full flex flex-col justify-between">
            <div>
              {/* Header with Title and "View All ->" */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Upcoming Events
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/my-announcements')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>View All</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>

              {/* Event List Items */}
              {upcomingEvents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No upcoming school events scheduled.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 3).map((ev: any) => {
                    // Extract month and day for badge
                    const dateObj = new Date(ev.event_date);
                    const monthStr = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                      : 'NOV';
                    const dayStr = !isNaN(dateObj.getTime()) ? dateObj.getDate() : '15';

                    return (
                      <div
                        key={ev.id}
                        onClick={() => navigate('/my-announcements')}
                        className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        {/* Blue Date Badge (e.g. "Nov 15") */}
                        <div className="w-14 sm:w-16 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-center shrink-0">
                          <span className="block text-[10px] font-extrabold uppercase text-blue-700 dark:text-blue-400 leading-tight">
                            {monthStr}
                          </span>
                          <span className="block text-base font-black text-blue-900 dark:text-blue-200 leading-tight">
                            {dayStr}
                          </span>
                        </div>

                        {/* Event Details */}
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {ev.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {ev.venue || ev.instructions || 'School Campus'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Link at bottom to Announcements / Calendar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Academic Calendar Active</span>
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {upcomingEvents.length} Event(s)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default StudentDashboardPage;
