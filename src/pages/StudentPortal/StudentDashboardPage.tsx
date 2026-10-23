import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { studentPortalApi } from '@/services/api';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import {
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  UserCheck,
  Calendar,
  ArrowRight,
  Award,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    loadStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your academic portal...</p>
        </div>
      </div>
    );
  }

  if (error || !stats?.student) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Portal Linkage Incomplete</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {error || 'Your authenticated profile is not currently mapped to an active student admission record.'}
        </p>
        <p className="text-xs text-slate-400">
          Please contact the school administrative office or your class teacher with your admission number to connect your portal account.
        </p>
      </div>
    );
  }

  const { student, enrollment, quizCount, quizAvgPct, attendancePct, recentQuizzes, recentDiaries } = stats;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-brand-950 text-white p-6 sm:p-8 border border-navy-800 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold border border-brand-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Student Academic Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {student.full_name}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Track your classroom daily diaries, review published quiz marks, and monitor your academic progress.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 shrink-0 bg-white/5 backdrop-blur-xs p-4 rounded-xl border border-white/10 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Admission No:</span>
              <span className="font-mono font-bold text-white">{student.admission_no}</span>
            </div>
            {enrollment && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Class & Section:</span>
                  <span className="font-semibold text-white">
                    {enrollment.section?.class?.name || 'Class'} - {enrollment.section?.name || 'Sec'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Roll Number:</span>
                  <span className="font-mono font-bold text-brand-300">#{enrollment.roll_no}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Published Quizzes"
          value={quizCount}
          subtitle="Evaluated & published assessments"
          icon={<BookOpen className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Quiz Average"
          value={`${quizAvgPct}%`}
          subtitle="Overall score across subjects"
          icon={<Award className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendancePct}%`}
          subtitle="Present & late attendance"
          icon={<ClipboardCheck className="w-5 h-5" />}
          color="navy"
        />
        <StatCard
          title="Diary Stream"
          value={recentDiaries.length}
          subtitle="Recent classroom entries"
          icon={<Calendar className="w-5 h-5" />}
          color="amber"
        />
      </div>

      {/* Main Content Grid: Recent Quizzes & Recent Diaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quiz Marks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-brand-600" />
                Recent Quiz Results
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Published assessment scores and feedback</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/my-quiz-marks')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {recentQuizzes.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No published quiz marks yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Once your subject teacher publishes quiz grades, they will show up here.
                </p>
              </div>
            ) : (
              recentQuizzes.map((mark: any) => {
                const max = mark.quiz?.max_marks || 1;
                const obtained = mark.marks_obtained || 0;
                const pct = mark.is_absent ? 0 : Math.round((obtained / max) * 100);

                return (
                  <div
                    key={mark.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {mark.quiz?.title || 'Class Quiz'}
                        </span>
                        <Badge size="sm" variant="info">
                          {mark.quiz?.subject?.name || 'Subject'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Date: {formatDate(mark.quiz?.assessment_date)}</span>
                        {mark.remarks && <span>• Note: {mark.remarks}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {mark.is_absent ? (
                        <Badge variant="danger" size="sm">
                          Absent
                        </Badge>
                      ) : (
                        <div>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                            {obtained} / {max}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 ml-1.5 font-mono">
                            ({pct}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Daily Diary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                Latest Daily Diary
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Lesson updates and assigned homework</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/my-daily-diary')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {recentDiaries.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No published diary entries</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Daily lesson summaries and homework assignments will appear here once posted by teachers.
                </p>
              </div>
            ) : (
              recentDiaries.map((diary: any) => (
                <div
                  key={diary.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge size="sm" variant="info">
                        {diary.subject?.name || 'Subject'}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDate(diary.diary_date || diary.entry_date)}
                      </span>
                    </div>
                    {diary.homework_due_date && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" /> Due {formatDate(diary.homework_due_date)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Topic:</span>{' '}
                    {diary.lesson_topics || diary.lesson_topic}
                  </p>

                  {(diary.homework || diary.homework_assigned) && (
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Homework:</span>{' '}
                      {diary.homework || diary.homework_assigned}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/my-quiz-marks')}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:border-brand-500 hover:shadow-xs transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 transition-colors">
                My Quiz Marks
              </h3>
              <p className="text-[11px] text-slate-500">Filter by subject and view BISE grades</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
        </div>

        <div
          onClick={() => navigate('/my-daily-diary')}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:border-brand-500 hover:shadow-xs transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 transition-colors">
                My Daily Diary
              </h3>
              <p className="text-[11px] text-slate-500">Check class tasks and submission dates</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
        </div>

        <div
          onClick={() => navigate('/my-profile')}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:border-brand-500 hover:shadow-xs transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 transition-colors">
                My Profile & Identity
              </h3>
              <p className="text-[11px] text-slate-500">View enrollment and change password</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  );
};
