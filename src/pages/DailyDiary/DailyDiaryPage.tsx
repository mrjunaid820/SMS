import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import {
  DailyDiary,
  DiaryStatus,
  ClassLevel,
  Section,
  Subject,
  TeacherAssignment,
} from '@/types/database';
import {
  diaryApi,
  academicStructureApi,
  teacherApi,
} from '@/services/api';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import {
  BookOpen,
  Calendar,
  PlusCircle,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  Users,
  Eye,
  Lock,
  FileText,
  Search,
} from 'lucide-react';

export const DailyDiaryPage: React.FC = () => {
  const { user, role } = useAuth();
  const { currentSession } = useSchool();
  const isAdmin = role === 'admin';

  // Academic metadata
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  // Filter states
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Diary items
  const [diaries, setDiaries] = useState<DailyDiary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal: Create / Edit Diary Entry
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [formSectionId, setFormSectionId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formLessonTopics, setFormLessonTopics] = useState('');
  const [formHomework, setFormHomework] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formUpcomingTest, setFormUpcomingTest] = useState('');
  const [formPrivateNotes, setFormPrivateNotes] = useState('');
  const [formStatus, setFormStatus] = useState<DiaryStatus>('published');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actor = useMemo(
    () => (user ? { id: user.id, name: user.full_name, role, email: user.email } : undefined),
    [user, role]
  );

  // 1. Load Academic Metadata
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

  // Determine authorized assignments for current teacher
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
    const secIds = new Set(authorizedAssignments.map((a) => a.section_id));
    return sections.filter((s) => secIds.has(s.id));
  }, [isAdmin, selectedClassId, sections, authorizedAssignments]);

  const availableSubjects = useMemo(() => {
    const secId = isModalOpen ? formSectionId : selectedSectionId;
    if (!secId) return subjects;
    if (isAdmin) {
      const sec = sections.find((s) => s.id === secId);
      return subjects.filter((sub) => sub.class_id === sec?.class_id);
    }
    const subIds = new Set(
      authorizedAssignments.filter((a) => a.section_id === secId).map((a) => a.subject_id)
    );
    return subjects.filter((s) => subIds.has(s.id));
  }, [isModalOpen, formSectionId, selectedSectionId, isAdmin, sections, subjects, authorizedAssignments]);

  // 2. Fetch Diaries
  const fetchDiaries = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await diaryApi.getDiaries(
        {
          sessionId: currentSession?.id,
          classId: selectedClassId || undefined,
          sectionId: selectedSectionId || undefined,
          subjectId: selectedSubjectId || undefined,
          date: selectedDate || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
        actor
      );
      setDiaries(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load daily diary entries.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentSession?.id, selectedClassId, selectedSectionId, selectedSubjectId, selectedDate, statusFilter, actor]);

  useEffect(() => {
    fetchDiaries();
  }, [fetchDiaries]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingDiaryId(null);
    const defaultSecId = availableSections[0]?.id || '';
    setFormSectionId(defaultSecId);

    const defaultSubIds = authorizedAssignments
      .filter((a) => a.section_id === defaultSecId)
      .map((a) => a.subject_id);
    setFormSubjectId(defaultSubIds[0] || availableSubjects[0]?.id || '');

    setFormDate(new Date().toISOString().slice(0, 10));
    setFormLessonTopics('');
    setFormHomework('');
    setFormInstructions('');
    setFormUpcomingTest('');
    setFormPrivateNotes('');
    setFormStatus('published');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (diary: DailyDiary) => {
    setEditingDiaryId(diary.id);
    setFormSectionId(diary.section_id);
    setFormSubjectId(diary.subject_id);
    setFormDate(diary.diary_date);
    setFormLessonTopics(diary.lesson_topics);
    setFormHomework(diary.homework);
    setFormInstructions(diary.instructions || '');
    setFormUpcomingTest(diary.upcoming_test_info || '');
    setFormPrivateNotes(diary.private_teacher_notes || '');
    setFormStatus(diary.status);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Diary Form
  const handleSubmitDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSectionId) {
      setFormError('Please select a class and section.');
      return;
    }
    if (!formSubjectId) {
      setFormError('Please select a subject.');
      return;
    }
    if (!formLessonTopics.trim()) {
      setFormError('Please enter lesson topics covered.');
      return;
    }
    if (!formHomework.trim()) {
      setFormError('Please enter homework or assignment instructions.');
      return;
    }

    setIsSubmitting(true);
    try {
      const sec = sections.find((s) => s.id === formSectionId);
      const classId = sec?.class_id || (classes[0]?.id as string);

      // Determine teacher ID
      let teacherId = '';
      if (isAdmin) {
        const asgn = assignments.find(
          (a) => a.section_id === formSectionId && a.subject_id === formSubjectId
        );
        teacherId = asgn?.teacher_id || assignments[0]?.teacher_id || '';
      } else {
        const myTeacher = authorizedAssignments.find(
          (a) => a.section_id === formSectionId && a.subject_id === formSubjectId
        );
        teacherId = myTeacher?.teacher_id || authorizedAssignments[0]?.teacher_id || '';
      }

      await diaryApi.saveDiary(
        {
          id: editingDiaryId || undefined,
          academic_session_id: currentSession?.id || '',
          class_id: classId,
          section_id: formSectionId,
          subject_id: formSubjectId,
          teacher_id: teacherId,
          diary_date: formDate,
          lesson_topics: formLessonTopics.trim(),
          homework: formHomework.trim(),
          instructions: formInstructions.trim() || undefined,
          upcoming_test_info: formUpcomingTest.trim() || undefined,
          private_teacher_notes: formPrivateNotes.trim() || undefined,
          status: formStatus,
        },
        actor
      );

      setFeedback({
        type: 'success',
        message: `Diary entry for ${formDate} saved successfully.`,
      });
      setIsModalOpen(false);
      await fetchDiaries();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save daily diary entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Diary Entry
  const handleDeleteDiary = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this diary entry?')) return;
    try {
      await diaryApi.deleteDiary(id, actor);
      setFeedback({ type: 'success', message: 'Diary entry deleted successfully.' });
      await fetchDiaries();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-brand-600" />
            Subject-Wise Daily Diary
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish daily classroom topics, homework assignments, and upcoming test notifications for students.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Badge variant="default" className="bg-navy-50 text-navy-800 dark:bg-navy-950/60 dark:text-brand-300">
              <Users className="w-3.5 h-3.5 mr-1" /> Administrator Oversight
            </Badge>
          ) : (
            <Badge variant="success">
              <Layers className="w-3.5 h-3.5 mr-1" /> Scoped to Your Teaching Allocations
            </Badge>
          )}

          <Button
            size="sm"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={handleOpenCreateModal}
          >
            New Diary Entry
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Section Filter */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Class & Section
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => {
                  setSelectedSectionId(e.target.value);
                  setSelectedSubjectId('');
                }}
                className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              >
                <option value="">All Authorized Sections</option>
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

            {/* Subject Filter */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              >
                <option value="">All Subjects</option>
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 py-1 rounded-md font-medium text-center transition-colors cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('published')}
                  className={`flex-1 py-1 rounded-md font-medium text-center transition-colors cursor-pointer ${
                    statusFilter === 'published'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Published
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('draft')}
                  className={`flex-1 py-1 rounded-md font-medium text-center transition-colors cursor-pointer ${
                    statusFilter === 'draft'
                      ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Draft
                </button>
              </div>
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

      {/* Diary Entries List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-navy-900 dark:text-brand-400" />
            Loading daily diary entries...
          </div>
        ) : diaries.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No daily diary entries found.
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select your assigned section and subject, then click "New Diary Entry" to record lesson topics and homework assignments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {diaries.map((diary) => (
              <Card key={diary.id} className="overflow-hidden hover:shadow-xs transition-shadow">
                <CardHeader className="bg-slate-50/60 dark:bg-slate-800/40 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {diary.subject?.name || 'Subject'}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({diary.class?.name} - Section {diary.section?.name})
                      </span>
                      <Badge
                        variant={diary.status === 'published' ? 'success' : 'warning'}
                      >
                        {diary.status === 'published' ? 'Published' : 'Draft Only'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(diary.diary_date)}
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(diary)}
                        className="p-1.5"
                        title="Edit Entry"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDiary(diary.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  {/* Lesson Topics */}
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase text-[10px] tracking-wider mb-0.5">
                      Classwork / Lesson Topics Covered:
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                      {diary.lesson_topics}
                    </p>
                  </div>

                  {/* Homework */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-navy-950 dark:text-brand-300 block uppercase text-[10px] tracking-wider mb-0.5">
                      Homework / Home Assignment:
                    </span>
                    <p className="text-slate-900 dark:text-slate-100 font-medium whitespace-pre-line leading-relaxed">
                      {diary.homework}
                    </p>
                  </div>

                  {/* Instructions & Upcoming Test Alerts */}
                  {(diary.instructions || diary.upcoming_test_info) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {diary.instructions && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-700 dark:text-slate-300">Instructions: </strong>
                          {diary.instructions}
                        </div>
                      )}
                      {diary.upcoming_test_info && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Upcoming Test: {diary.upcoming_test_info}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Private Teacher Notes (Exclusively for Teachers/Admins) */}
                  {diary.private_teacher_notes && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <strong className="block uppercase text-[9px] tracking-wider font-bold">
                          Private Teacher Notes (Internal Only — Hidden from Student Portal):
                        </strong>
                        <p className="mt-0.5">{diary.private_teacher_notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      Teacher: <b>{diary.teacher?.full_name || 'Staff'}</b>
                    </span>
                    <span>Last updated: {formatDate(diary.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Diary Entry */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDiaryId ? 'Edit Daily Diary Entry' : 'Create Subject-Wise Daily Diary Entry'}
        size="lg"
      >
        <form onSubmit={handleSubmitDiary} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Class & Section *
              </label>
              <select
                value={formSectionId}
                onChange={(e) => setFormSectionId(e.target.value)}
                required
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
              >
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject *
              </label>
              <select
                value={formSubjectId}
                onChange={(e) => setFormSubjectId(e.target.value)}
                required
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
              >
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Diary Date *
              </label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Classwork / Lesson Topics Covered *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Chapter 4: Quadratic Equations. Derived the quadratic formula and solved questions 1 to 4."
              value={formLessonTopics}
              onChange={(e) => setFormLessonTopics(e.target.value)}
              required
              className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Homework / Home Assignment *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Solve Exercise 4.1 Questions 5 to 10 in homework register. Review derivation steps."
              value={formHomework}
              onChange={(e) => setFormHomework(e.target.value)}
              required
              className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Optional Instructions / Student Materials
              </label>
              <Input
                type="text"
                placeholder="e.g. Bring graph notebooks tomorrow"
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Upcoming Assessment / Test Alert
              </label>
              <Input
                type="text"
                placeholder="e.g. Chapter 4 Quiz scheduled for Monday"
                value={formUpcomingTest}
                onChange={(e) => setFormUpcomingTest(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-600" /> Private Teacher Notes (Internal Only)
              </label>
              <span className="text-[10px] text-amber-600 font-medium">
                Strictly hidden from students
              </span>
            </div>
            <textarea
              rows={2}
              placeholder="e.g. Students struggled with discriminant method; allocate 15 minutes for review next period."
              value={formPrivateNotes}
              onChange={(e) => setFormPrivateNotes(e.target.value)}
              className="w-full p-2.5 text-xs border border-amber-300 dark:border-amber-800/80 rounded-lg bg-amber-50/30 dark:bg-amber-950/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Status radio / toggle */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Publication Status
              </span>
              <span className="text-[11px] text-slate-500">
                {formStatus === 'published'
                  ? 'Published: Visible to authorized students and staff.'
                  : 'Draft: Visible only to teachers and administrators.'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormStatus('draft')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  formStatus === 'draft'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => setFormStatus('published')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  formStatus === 'published'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Publish Now
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingDiaryId ? 'Update Diary' : 'Save Diary Entry'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
