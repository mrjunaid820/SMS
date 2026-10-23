import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studentPortalApi, academicStructureApi } from '@/services/api';
import { Subject, QuizMark, Quiz } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Select } from '@/components/common/Select';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/lib/utils';
import {
  BookOpen,
  Award,
  Filter,
  RotateCcw,
  AlertCircle,
  Calendar,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

const getBiseGrade = (percentage: number): { grade: string; label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'default' } => {
  if (percentage >= 80) return { grade: 'A+', label: 'Exceptional', variant: 'success' };
  if (percentage >= 70) return { grade: 'A', label: 'Excellent', variant: 'success' };
  if (percentage >= 60) return { grade: 'B', label: 'Very Good', variant: 'info' };
  if (percentage >= 50) return { grade: 'C', label: 'Good', variant: 'info' };
  if (percentage >= 40) return { grade: 'D', label: 'Fair', variant: 'warning' };
  if (percentage >= 33) return { grade: 'E', label: 'Satisfactory', variant: 'warning' };
  return { grade: 'F', label: 'Needs Improvement', variant: 'danger' };
};

export const MyQuizMarksPage: React.FC = () => {
  const { user } = useAuth();
  const [marks, setMarks] = useState<(QuizMark & { quiz: Quiz })[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const [allMarks, allSubjects] = await Promise.all([
        studentPortalApi.getMyQuizMarks(identifier),
        academicStructureApi.getSubjects(),
      ]);
      setMarks(allMarks);
      setSubjects(allSubjects);
    } catch (err: any) {
      setError(err.message || 'Failed to load your quiz marks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Client-side filtering
  const filteredMarks = useMemo(() => {
    return marks.filter((m) => {
      if (selectedSubjectId && m.quiz?.subject_id !== selectedSubjectId) return false;
      if (selectedDate && m.quiz?.assessment_date !== selectedDate) return false;
      return true;
    });
  }, [marks, selectedSubjectId, selectedDate]);

  // Aggregate stats
  const performanceSummary = useMemo(() => {
    const totalAssessments = filteredMarks.length;
    const nonAbsent = filteredMarks.filter((m) => !m.is_absent);
    const totalMax = filteredMarks.reduce((acc, curr) => acc + (curr.quiz?.max_marks || 0), 0);
    const totalObtained = filteredMarks.reduce(
      (acc, curr) => acc + (curr.is_absent ? 0 : curr.marks_obtained || 0),
      0
    );
    const averagePct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
    const highestMark = nonAbsent.reduce(
      (max, curr) => Math.max(max, curr.marks_obtained || 0),
      0
    );

    return {
      totalAssessments,
      averagePct,
      highestMark,
      overallGrade: getBiseGrade(averagePct),
    };
  }, [filteredMarks]);

  const handleResetFilters = () => {
    setSelectedSubjectId('');
    setSelectedDate('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your published quiz marks...</p>
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
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Unable to Load Quiz Marks</h2>
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
            My Quiz Marks & Performance
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified classroom assessments, BISE grades, and teacher feedback
          </p>
        </div>

        <Badge variant="info" size="md">
          <Award className="w-3.5 h-3.5 mr-1" />
          Official BISE Standard Evaluation
        </Badge>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {performanceSummary.totalAssessments}
            </div>
            <div className="text-[11px] text-slate-500">Total Assessments</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {performanceSummary.averagePct}%
            </div>
            <div className="text-[11px] text-slate-500">Average Percentage</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>{performanceSummary.overallGrade.grade}</span>
              <span className="text-xs font-normal text-slate-500">({performanceSummary.overallGrade.label})</span>
            </div>
            <div className="text-[11px] text-slate-500">Overall BISE Grade</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {performanceSummary.highestMark}
            </div>
            <div className="text-[11px] text-slate-500">Highest Score Obtained</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Filter by Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:w-56">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Filter by Assessment Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {(selectedSubjectId || selectedDate) && (
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

      {/* Quiz Marks Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Assessment Records ({filteredMarks.length})</span>
            <span className="text-xs font-normal text-slate-500">Only published quizzes are visible</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredMarks.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No quiz records matching your criteria
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No published quiz marks match the selected subject or date filters. Draft quizzes currently being graded by teachers are held until publication.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Quiz Title & Description</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Max Marks</th>
                    <th className="py-3 px-4 text-center">Marks Obtained</th>
                    <th className="py-3 px-4 text-center">Score %</th>
                    <th className="py-3 px-4 text-center">BISE Grade</th>
                    <th className="py-3 px-4">Teacher Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMarks.map((mark) => {
                    const max = mark.quiz?.max_marks || 1;
                    const obtained = mark.marks_obtained || 0;
                    const pct = mark.is_absent ? 0 : Math.round((obtained / max) * 100);
                    const bise = getBiseGrade(pct);

                    return (
                      <tr
                        key={mark.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <Badge variant="info" size="sm">
                            {mark.quiz?.subject?.name || 'Subject'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {mark.quiz?.title || 'Class Quiz'}
                          </div>
                          {mark.quiz?.instructions && (
                            <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {mark.quiz.instructions}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatDate(mark.quiz?.assessment_date)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                          {max}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          {mark.is_absent ? (
                            <Badge variant="danger" size="sm">
                              Absent
                            </Badge>
                          ) : (
                            <span className="text-slate-900 dark:text-slate-100 text-sm">
                              {obtained}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">
                          {mark.is_absent ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span className={pct >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}>
                              {pct}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {mark.is_absent ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <Badge variant={bise.variant} size="sm">
                              {bise.grade} ({bise.label})
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {mark.remarks ? (
                            <span className="italic">"{mark.remarks}"</span>
                          ) : (
                            <span className="text-slate-400 italic">No notes</span>
                          )}
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
