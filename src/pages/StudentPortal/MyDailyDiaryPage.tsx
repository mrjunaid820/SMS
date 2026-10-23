import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studentPortalApi, academicStructureApi } from '@/services/api';
import { Subject, DailyDiary } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/lib/utils';
import {
  Calendar,
  BookOpen,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FileText,
  AlertCircle,
  HelpCircle,
  Flame,
} from 'lucide-react';

export const MyDailyDiaryPage: React.FC = () => {
  const { user } = useAuth();
  const [diaries, setDiaries] = useState<DailyDiary[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [homeworkOnly, setHomeworkOnly] = useState<boolean>(false);
  const [testOnly, setTestOnly] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const [allDiaries, allSubjects] = await Promise.all([
        studentPortalApi.getMyDailyDiary(identifier),
        academicStructureApi.getSubjects(),
      ]);
      setDiaries(allDiaries);
      setSubjects(allSubjects);
    } catch (err: any) {
      setError(err.message || 'Failed to load daily diary entries.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Client filtering
  const filteredDiaries = useMemo(() => {
    return diaries.filter((d) => {
      const entryDate = d.diary_date || (d as any).entry_date;
      const hw = d.homework || (d as any).homework_assigned || d.homework_details;
      const hasTest = Boolean(d.instructions_or_test_alerts || d.instructions || (d as any).test_scheduled);

      if (selectedSubjectId && d.subject_id !== selectedSubjectId) return false;
      if (selectedDate && entryDate !== selectedDate) return false;
      if (homeworkOnly && !hw) return false;
      if (testOnly && !hasTest) return false;
      return true;
    });
  }, [diaries, selectedSubjectId, selectedDate, homeworkOnly, testOnly]);

  const handleResetFilters = () => {
    setSelectedSubjectId('');
    setSelectedDate('');
    setHomeworkOnly(false);
    setTestOnly(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your classroom daily diary...</p>
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
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Unable to Load Daily Diary</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            My Daily Diary & Homework
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Classroom lesson summaries, homework tasks, due dates, and test alerts
          </p>
        </div>

        <Badge variant="info" size="md">
          <Calendar className="w-3.5 h-3.5 mr-1" />
          Official Section Stream
        </Badge>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="p-4 space-y-3">
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
                Filter by Entry Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {(selectedSubjectId || selectedDate || homeworkOnly || testOnly) && (
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

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Quick Filters:</span>
            <button
              onClick={() => setHomeworkOnly(!homeworkOnly)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                homeworkOnly
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
              }`}
            >
              Has Homework Assigned
            </button>
            <button
              onClick={() => setTestOnly(!testOnly)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                testOnly
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
              }`}
            >
              Has Test / Assessment Alert
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Diary Entries List */}
      <div className="space-y-4">
        {filteredDiaries.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-3">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Diary Entries Found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                There are no published daily diary entries matching your selected filters. Teachers will post new lesson activities and homework daily.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDiaries.map((diary) => (
            <Card key={diary.id} className="overflow-hidden border-slate-200 dark:border-slate-800 hover:border-slate-300 transition-all">
              <div className="p-4 sm:p-5 space-y-4">
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="info" size="md">
                      {diary.subject?.name || 'Subject'}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {formatDate(diary.diary_date || (diary as any).entry_date)}
                    </span>
                    {diary.teacher?.full_name && (
                      <span className="text-[11px] text-slate-400">
                        • Teacher: {diary.teacher.full_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {(diary.instructions_or_test_alerts || diary.instructions) && (
                      <Badge variant="danger" size="sm">
                        <Flame className="w-3 h-3 mr-1" />
                        Test / Alert
                      </Badge>
                    )}
                    {diary.homework_due_date && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3.5 h-3.5" />
                        Due {formatDate(diary.homework_due_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Lesson & Topic */}
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Lesson Topic Covered
                  </h3>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {diary.lesson_topics || (diary as any).lesson_topic}
                  </p>
                </div>

                {/* Classroom Activities */}
                {(diary as any).classroom_activities && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Classroom Activities
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      {(diary as any).classroom_activities}
                    </p>
                  </div>
                )}

                {/* Homework Assigned */}
                {(diary.homework || diary.homework_details || (diary as any).homework_assigned) ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Homework Assignment
                      </h4>
                      {(diary as any).submission_required && (
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          * Mandatory Submission Required
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/60 font-medium">
                      {diary.homework || diary.homework_details || (diary as any).homework_assigned}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">
                    No homework assigned for this session.
                  </div>
                )}

                {/* Test Schedule Alert if any */}
                {(diary.instructions_or_test_alerts || diary.instructions) && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Class Assessment Notice:
                    </div>
                    <p>{diary.instructions_or_test_alerts || diary.instructions}</p>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
