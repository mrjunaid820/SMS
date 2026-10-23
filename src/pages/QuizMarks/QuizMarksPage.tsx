import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import {
  Quiz,
  QuizMark,
  ClassLevel,
  Section,
  Subject,
  Enrollment,
  TeacherAssignment,
} from '@/types/database';
import {
  quizApi,
  academicStructureApi,
  studentApi,
  teacherApi,
} from '@/services/api';
import { calculateGrade } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import {
  Award,
  BookOpen,
  PlusCircle,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit,
  Trash2,
  Calendar,
  Layers,
  Users,
  Search,
} from 'lucide-react';

interface LocalMarkRow {
  enrollment_id: string;
  marks_obtained: number | string;
  is_absent: boolean;
  remarks: string;
}

export const QuizMarksPage: React.FC = () => {
  const { user, role } = useAuth();
  const { currentSession, settings } = useSchool();
  const isAdmin = role === 'admin';

  // Academic metadata
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState('');

  // Data states
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [localMarks, setLocalMarks] = useState<Record<string, LocalMarkRow>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal: Create / Edit Quiz
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDate, setModalDate] = useState(new Date().toISOString().slice(0, 10));
  const [modalMaxMarks, setModalMaxMarks] = useState(25);
  const [modalInstructions, setModalInstructions] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

  const actor = useMemo(
    () => (user ? { id: user.id, name: user.full_name, role, email: user.email } : undefined),
    [user, role]
  );

  // 1. Initial Load: Academic metadata
  useEffect(() => {
    async function loadMeta() {
      try {
        const [cls, sec, sub, asgn] = await Promise.all([
          academicStructureApi.getClasses(),
          academicStructureApi.getSections(),
          academicStructureApi.getSubjects(),
          teacherApi.getAssignments(currentSession?.id),
        ]);
        setClasses(cls);
        setSections(sec);
        setSubjects(sub);
        setAssignments(asgn);
      } catch (err: any) {
        console.error('Failed to load academic metadata', err);
      }
    }
    loadMeta();
  }, [currentSession?.id]);

  // Determine authorized sections and subjects for current teacher
  const authorizedAssignments = useMemo(() => {
    if (isAdmin) return assignments;
    return assignments.filter(
      (a) =>
        a.teacher?.email?.toLowerCase() === user?.email?.toLowerCase() ||
        a.teacher?.profile_id === user?.id
    );
  }, [assignments, isAdmin, user?.email, user?.id]);

  const availableSections = useMemo(() => {
    if (isAdmin) {
      return selectedClassId
        ? sections.filter((s) => s.class_id === selectedClassId)
        : sections;
    }
    const sectionIds = new Set(authorizedAssignments.map((a) => a.section_id));
    return sections.filter((s) => sectionIds.has(s.id));
  }, [isAdmin, selectedClassId, sections, authorizedAssignments]);

  const availableSubjects = useMemo(() => {
    if (!selectedSectionId) return [];
    if (isAdmin) {
      const sec = sections.find((s) => s.id === selectedSectionId);
      return subjects.filter((sub) => sub.class_id === sec?.class_id);
    }
    const authorizedSubIds = new Set(
      authorizedAssignments
        .filter((a) => a.section_id === selectedSectionId)
        .map((a) => a.subject_id)
    );
    return subjects.filter((s) => authorizedSubIds.has(s.id));
  }, [selectedSectionId, isAdmin, sections, subjects, authorizedAssignments]);

  // Auto-select first section & subject when list loads
  useEffect(() => {
    if (availableSections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(availableSections[0].id);
      setSelectedClassId(availableSections[0].class_id);
    }
  }, [availableSections, selectedSectionId]);

  useEffect(() => {
    if (availableSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedSubjectId]);

  // 2. Fetch Quizzes when Section & Subject change
  const fetchQuizzes = useCallback(async () => {
    if (!selectedSectionId || !selectedSubjectId) return;
    try {
      const list = await quizApi.getQuizzes(
        {
          sessionId: currentSession?.id,
          sectionId: selectedSectionId,
          subjectId: selectedSubjectId,
        },
        actor
      );
      setQuizzes(list);
      if (list.length > 0 && (!selectedQuizId || !list.some((q) => q.id === selectedQuizId))) {
        setSelectedQuizId(list[0].id);
      } else if (list.length === 0) {
        setSelectedQuizId('');
      }
    } catch (err: any) {
      console.error('Failed to fetch quizzes', err);
    }
  }, [selectedSectionId, selectedSubjectId, currentSession?.id, actor, selectedQuizId]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // 3. Fetch Enrollments & Existing Marks when Selected Quiz changes
  const activeQuiz = useMemo(() => quizzes.find((q) => q.id === selectedQuizId), [quizzes, selectedQuizId]);

  const loadQuizMarksRoster = useCallback(async () => {
    if (!selectedSectionId) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const [allEnrs, existingMarks] = await Promise.all([
        studentApi.getEnrollments(currentSession?.id, selectedSectionId),
        selectedQuizId ? quizApi.getQuizMarks(selectedQuizId) : Promise.resolve([]),
      ]);

      const sortedEnrs = allEnrs.sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0));
      setEnrollments(sortedEnrs);

      // Populate local editable state
      const initialMap: Record<string, LocalMarkRow> = {};
      sortedEnrs.forEach((enr) => {
        const mark = existingMarks.find((m) => m.enrollment_id === enr.id);
        initialMap[enr.id] = {
          enrollment_id: enr.id,
          marks_obtained: mark && mark.marks_obtained !== undefined ? mark.marks_obtained : '',
          is_absent: Boolean(mark?.is_absent),
          remarks: mark?.remarks || '',
        };
      });
      setLocalMarks(initialMap);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load student roster.' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedSectionId, selectedQuizId, currentSession?.id]);

  useEffect(() => {
    loadQuizMarksRoster();
  }, [loadQuizMarksRoster]);

  // Handle Mark Change
  const handleMarkChange = (enrollmentId: string, value: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        marks_obtained: value,
        is_absent: false,
      },
    }));
  };

  // Handle Absent Toggle
  const handleAbsentToggle = (enrollmentId: string, is_absent: boolean) => {
    setLocalMarks((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        is_absent,
        marks_obtained: is_absent ? 0 : '',
      },
    }));
  };

  // Handle Remarks Change
  const handleRemarksChange = (enrollmentId: string, remarks: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        remarks,
      },
    }));
  };

  // Save Batch Quiz Marks
  const handleSaveMarks = async () => {
    if (!activeQuiz) {
      setFeedback({ type: 'error', message: 'Please select or create a quiz first.' });
      return;
    }

    setFeedback(null);
    const max = Number(activeQuiz.max_marks);

    // Validate marks before sending
    for (const enr of enrollments) {
      const row = localMarks[enr.id];
      if (!row) continue;
      if (!row.is_absent && row.marks_obtained !== '') {
        const val = Number(row.marks_obtained);
        if (isNaN(val) || val < 0) {
          setFeedback({
            type: 'error',
            message: `Marks for ${enr.student?.full_name} (Roll #${enr.roll_no}) cannot be negative.`,
          });
          return;
        }
        if (val > max) {
          setFeedback({
            type: 'error',
            message: `Marks for ${enr.student?.full_name} (${val}) exceed maximum quiz marks (${max}).`,
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payload = enrollments
        .filter((enr) => {
          const row = localMarks[enr.id];
          return row && (row.is_absent || row.marks_obtained !== '');
        })
        .map((enr) => {
          const row = localMarks[enr.id];
          return {
            enrollment_id: enr.id,
            marks_obtained: row.is_absent ? undefined : Number(row.marks_obtained),
            is_absent: row.is_absent,
            remarks: row.remarks.trim() || undefined,
          };
        });

      await quizApi.saveQuizMarksBatch(activeQuiz.id, payload, actor);
      setFeedback({ type: 'success', message: `Saved marks for ${payload.length} students successfully.` });
      await loadQuizMarksRoster();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save quiz marks.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Open Create / Edit Quiz Modal
  const handleOpenCreateQuiz = () => {
    setEditingQuizId(null);
    setModalTitle('');
    setModalDate(new Date().toISOString().slice(0, 10));
    setModalMaxMarks(25);
    setModalInstructions('');
    setModalError(null);
    setIsQuizModalOpen(true);
  };

  const handleOpenEditQuiz = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setModalTitle(quiz.title);
    setModalDate(quiz.assessment_date);
    setModalMaxMarks(quiz.max_marks);
    setModalInstructions(quiz.instructions || '');
    setModalError(null);
    setIsQuizModalOpen(true);
  };

  // Save Quiz Metadata (Create or Update)
  const handleSaveQuizMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!modalTitle.trim()) {
      setModalError('Please enter a quiz title.');
      return;
    }
    const max = Number(modalMaxMarks);
    if (isNaN(max) || max <= 0) {
      setModalError('Maximum marks must be greater than zero.');
      return;
    }

    setIsSubmittingQuiz(true);
    try {
      const sec = sections.find((s) => s.id === selectedSectionId);
      const classId = sec?.class_id || (classes[0]?.id as string);

      if (editingQuizId) {
        await quizApi.updateQuiz(
          editingQuizId,
          {
            title: modalTitle.trim(),
            assessment_date: modalDate,
            max_marks: max,
            instructions: modalInstructions.trim() || undefined,
          },
          actor
        );
      } else {
        const created = await quizApi.createQuiz(
          {
            academic_session_id: currentSession?.id || '',
            class_id: classId,
            section_id: selectedSectionId,
            subject_id: selectedSubjectId,
            title: modalTitle.trim(),
            assessment_date: modalDate,
            max_marks: max,
            instructions: modalInstructions.trim() || undefined,
          },
          actor
        );
        setSelectedQuizId(created.id);
      }

      setIsQuizModalOpen(false);
      await fetchQuizzes();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save quiz.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz and its recorded student marks?')) {
      return;
    }
    try {
      await quizApi.deleteQuiz(quizId, actor);
      if (selectedQuizId === quizId) {
        setSelectedQuizId('');
      }
      await fetchQuizzes();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Scope Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Award className="w-6 h-6 text-brand-600" />
            Classroom Quiz Marks Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create classroom tests, enter formative assessment marks, and calculate student score percentages.
          </p>
        </div>

        {isAdmin ? (
          <Badge variant="default" className="bg-navy-50 text-navy-800 dark:bg-navy-950/60 dark:text-brand-300">
            <Users className="w-3.5 h-3.5 mr-1" /> Administrator Oversight
          </Badge>
        ) : (
          <Badge variant="success">
            <Layers className="w-3.5 h-3.5 mr-1" /> Scoped to Your Teaching Allocations
          </Badge>
        )}
      </div>

      {/* Filter & Allocation Selector Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Section / Class Picker */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Class & Section *
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => {
                  setSelectedSectionId(e.target.value);
                  const sec = sections.find((s) => s.id === e.target.value);
                  if (sec) setSelectedClassId(sec.class_id);
                  setSelectedSubjectId('');
                }}
                className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
              >
                {availableSections.length === 0 && <option value="">No authorized sections found</option>}
                {availableSections.map((s) => {
                  const cls = classes.find((c) => c.id === s.class_id);
                  return (
                    <option key={s.id} value={s.id}>
                      {cls?.name || 'Class'} — Section {s.name}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Subject Picker */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject *
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={!selectedSectionId}
                className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 disabled:opacity-50"
              >
                {availableSubjects.length === 0 && <option value="">No authorized subjects</option>}
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Quiz Picker & Create Action */}
            <div className="sm:col-span-4 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Active Quiz *
                </label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  disabled={quizzes.length === 0}
                  className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                >
                  {quizzes.length === 0 && <option value="">No quizzes created yet</option>}
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.assessment_date}) — Max: {q.max_marks}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                size="sm"
                onClick={handleOpenCreateQuiz}
                disabled={!selectedSectionId || !selectedSubjectId}
                leftIcon={<PlusCircle className="w-4 h-4" />}
                className="shrink-0"
                title="Create New Quiz"
              >
                New Quiz
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Quiz Details Card & Actions */}
      {activeQuiz && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {activeQuiz.title}
              </h2>
              <Badge variant="outline" className="font-mono">
                Max Marks: {activeQuiz.max_marks}
              </Badge>
              <Badge variant="default" className="bg-slate-100 dark:bg-slate-800">
                <Calendar className="w-3 h-3 mr-1" /> {activeQuiz.assessment_date}
              </Badge>
            </div>
            {activeQuiz.instructions && (
              <p className="text-xs text-slate-500 italic">
                Guidelines: {activeQuiz.instructions}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => handleOpenEditQuiz(activeQuiz)}
            >
              Edit Quiz
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleDeleteQuiz(activeQuiz.id)}
            >
              Delete
            </Button>
            <Button
              size="sm"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              onClick={handleSaveMarks}
              isLoading={isSaving}
            >
              Save Marks
            </Button>
          </div>
        </div>
      )}

      {/* Student Roster Marks Entry Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
              Student Marks Roster ({enrollments.length} Students)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter obtained marks or mark students absent. Percentages and BISE grades update in real time.
            </p>
          </div>
          {activeQuiz && (
            <Button
              size="sm"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              onClick={handleSaveMarks}
              isLoading={isSaving}
            >
              Save Changes
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!activeQuiz ? (
            <div className="py-16 text-center text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {quizzes.length === 0 ? 'No quizzes found for this subject.' : 'Select a quiz above to enter marks.'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {quizzes.length === 0
                  ? 'Click "+ New Quiz" to create your first classroom quiz for this section.'
                  : 'Choose a quiz from the dropdown list above.'}
              </p>
            </div>
          ) : isLoading ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-navy-900 dark:text-brand-400" />
              Loading student roster and recorded marks...
            </div>
          ) : enrollments.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No active students enrolled in this section.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 text-center">Roll #</th>
                    <th className="p-3">Admission #</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3 text-center">Marks Obtained (Max: {activeQuiz.max_marks})</th>
                    <th className="p-3 text-center">Percentage</th>
                    <th className="p-3 text-center">Grade</th>
                    <th className="p-3 text-center">Absent</th>
                    <th className="p-3">Teacher Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {enrollments.map((enr) => {
                    const row = localMarks[enr.id] || {
                      enrollment_id: enr.id,
                      marks_obtained: '',
                      is_absent: false,
                      remarks: '',
                    };
                    const maxMarks = Number(activeQuiz.max_marks);
                    const numericObtained = Number(row.marks_obtained);
                    const hasValidValue = !row.is_absent && row.marks_obtained !== '' && !isNaN(numericObtained);
                    const percentage = hasValidValue
                      ? Math.round((numericObtained / maxMarks) * 1000) / 10
                      : 0;
                    const gradeInfo = hasValidValue ? calculateGrade(percentage, settings.grading_rules) : null;
                    const isExceeding = hasValidValue && (numericObtained > maxMarks || numericObtained < 0);

                    return (
                      <tr key={enr.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        {/* Roll Number */}
                        <td className="p-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                          {enr.roll_no}
                        </td>

                        {/* Admission No */}
                        <td className="p-3 font-mono text-slate-500">
                          {enr.student?.admission_no}
                        </td>

                        {/* Student Name */}
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {enr.student?.full_name}
                        </td>

                        {/* Marks Obtained Input */}
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={maxMarks}
                            step="0.5"
                            disabled={row.is_absent}
                            value={row.is_absent ? '' : row.marks_obtained}
                            onChange={(e) => handleMarkChange(enr.id, e.target.value)}
                            placeholder={row.is_absent ? 'Absent' : '0.0'}
                            className={`w-24 px-2 py-1.5 text-center font-mono font-bold text-xs rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 ${
                              isExceeding
                                ? 'border-rose-500 bg-rose-50 text-rose-700'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                            } disabled:opacity-40 disabled:bg-slate-100`}
                          />
                        </td>

                        {/* Score Percentage */}
                        <td className="p-3 text-center font-mono font-semibold">
                          {row.is_absent ? (
                            <span className="text-slate-400">—</span>
                          ) : hasValidValue ? (
                            <span className={percentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}>
                              {percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* BISE Grade */}
                        <td className="p-3 text-center">
                          {row.is_absent ? (
                            <span className="text-rose-600 font-bold">F</span>
                          ) : gradeInfo ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                gradeInfo.grade === 'F'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                  : gradeInfo.grade.startsWith('A')
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {gradeInfo.grade}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Absent Toggle Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.is_absent}
                            onChange={(e) => handleAbsentToggle(enr.id, e.target.checked)}
                            className="rounded border-slate-300 text-navy-900 focus:ring-navy-900"
                            title="Mark as Absent"
                          />
                        </td>

                        {/* Remarks */}
                        <td className="p-3">
                          <input
                            type="text"
                            placeholder="Teacher feedback..."
                            value={row.remarks}
                            onChange={(e) => handleRemarksChange(enr.id, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded text-slate-800 dark:text-slate-200"
                          />
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

      {/* Modal: Create or Edit Quiz */}
      <Modal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        title={editingQuizId ? 'Edit Quiz Assessment' : 'Create New Classroom Quiz'}
        size="md"
      >
        <form onSubmit={handleSaveQuizMetadata} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quiz Title *
            </label>
            <Input
              type="text"
              placeholder="e.g. Chapter 4 Quiz, Weekly Math Test"
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assessment Date *
              </label>
              <Input
                type="date"
                value={modalDate}
                onChange={(e) => setModalDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Max Marks *
              </label>
              <Input
                type="number"
                min="1"
                step="0.5"
                value={modalMaxMarks}
                onChange={(e) => setModalMaxMarks(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Instructions or Syllabus Covered (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Questions 1 to 5 from Exercise 4.2. Bring geometry box."
              value={modalInstructions}
              onChange={(e) => setModalInstructions(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsQuizModalOpen(false)}
              disabled={isSubmittingQuiz}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingQuiz}>
              {editingQuizId ? 'Update Quiz' : 'Create Quiz'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
