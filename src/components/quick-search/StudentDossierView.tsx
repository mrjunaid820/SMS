import React, { useState } from 'react';
import {
  StudentAcademicSummary,
  SchoolSettings,
  UserRole,
  Subject,
  AttendanceStatus,
} from '@/types/database';
import {
  calculateGrade,
  formatCurrency,
  formatDate,
} from '@/lib/utils';
import { exportToSafeCSV } from '@/lib/csv-sanitizer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { PrintStudentReportCard } from '@/components/print/PrintStudentReportCard';
import { ATTENDANCE_STATUS_COLORS, INVOICE_STATUS_COLORS } from '@/config/constants';
import {
  ArrowLeft,
  Printer,
  FileDown,
  Award,
  CalendarCheck,
  Receipt,
  TrendingUp,
  BookOpen,
  BookMarked,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { quizApi } from '@/services/api';

export interface StudentDossierViewProps {
  summary: StudentAcademicSummary;
  settings: SchoolSettings;
  currentRole: UserRole;
  currentActor?: { id?: string; name?: string; role?: string; email?: string };
  onBack: () => void;
  onRefresh: () => Promise<void> | void;
  allSubjects?: Subject[];
}

export const StudentDossierView: React.FC<StudentDossierViewProps> = ({
  summary,
  settings,
  currentRole,
  currentActor,
  onBack,
  onRefresh,
  allSubjects = [],
}) => {
  const { student, enrollment, attendance, exams, quizzes, performanceTrend, fees } = summary;

  const section = enrollment?.section;
  const cls = section?.class;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'performance' | 'quizzes' | 'exams' | 'attendance' | 'diary' | 'fees'>('performance');

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Add / Record Quiz Mark Modal State
  const [isAddQuizModalOpen, setIsAddQuizModalOpen] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizSubjectId, setNewQuizSubjectId] = useState(allSubjects[0]?.id || '');
  const [newQuizDate, setNewQuizDate] = useState(new Date().toISOString().slice(0, 10));
  const [newQuizMaxMarks, setNewQuizMaxMarks] = useState(25);
  const [newQuizMarksObtained, setNewQuizMarksObtained] = useState<number | string>(20);
  const [newQuizIsAbsent, setNewQuizIsAbsent] = useState(false);
  const [newQuizRemarks, setNewQuizRemarks] = useState('');
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizFormError, setQuizFormError] = useState<string | null>(null);
  const [quizFormSuccess, setQuizFormSuccess] = useState<string | null>(null);

  // Quiz Filter State
  const [quizSubjectFilter, setQuizSubjectFilter] = useState<string>('all');
  const [quizDateFilter, setQuizDateFilter] = useState<string>('');

  const filteredQuizzes = quizzes.filter((qm) => {
    if (quizSubjectFilter !== 'all' && qm.subject_name.toLowerCase() !== quizSubjectFilter.toLowerCase()) {
      return false;
    }
    if (quizDateFilter && qm.assessment_date !== quizDateFilter) {
      return false;
    }
    return true;
  });

  // Daily Diary Filter State
  const [diarySubjectFilter, setDiarySubjectFilter] = useState<string>('all');
  const [diaryStartDateFilter, setDiaryStartDateFilter] = useState<string>('');
  const [diaryEndDateFilter, setDiaryEndDateFilter] = useState<string>('');

  const diaryEntries = summary.diaryEntries || [];
  const filteredDiaries = diaryEntries.filter((d) => {
    if (diarySubjectFilter !== 'all') {
      const subjMatch =
        d.subject_id === diarySubjectFilter ||
        d.subject?.name?.toLowerCase() === diarySubjectFilter.toLowerCase();
      if (!subjMatch) return false;
    }
    if (diaryStartDateFilter && d.diary_date < diaryStartDateFilter) {
      return false;
    }
    if (diaryEndDateFilter && d.diary_date > diaryEndDateFilter) {
      return false;
    }
    return true;
  });

  // Performance Chart Filter State
  const [trendFilter, setTrendFilter] = useState<'all' | 'quiz' | 'exam'>('all');

  const filteredTrend = performanceTrend.filter((pt) => {
    if (trendFilter === 'all') return true;
    if (trendFilter === 'quiz') return pt.type === 'Quiz';
    if (trendFilter === 'exam') return pt.type === 'Exam';
    return true;
  });

  // Calculate Aggregates
  const totalExamMax = exams.reduce((acc, curr) => acc + curr.max_marks, 0);
  const totalExamObtained = exams.reduce(
    (acc, curr) => acc + (curr.is_absent ? 0 : curr.marks_obtained || 0),
    0
  );
  const overallExamPct =
    totalExamMax > 0 ? Math.round((totalExamObtained / totalExamMax) * 1000) / 10 : 0;
  const overallGrade = calculateGrade(overallExamPct, settings.grading_rules);

  const totalQuizMax = quizzes.reduce((acc, curr) => acc + curr.max_marks, 0);
  const totalQuizObtained = quizzes.reduce(
    (acc, curr) => acc + (curr.is_absent ? 0 : curr.marks_obtained || 0),
    0
  );
  const quizAvgPct =
    totalQuizMax > 0 ? Math.round((totalQuizObtained / totalQuizMax) * 1000) / 10 : 0;

  const isAttendanceShort = attendance.percentage < 75;

  // Handle Safe CSV Export
  const handleExportCSV = () => {
    const filename = `${student.admission_no}_academic_dossier`;

    const exportRows: any[] = [];

    // 1. Add Exam Results
    exams.forEach((ex) => {
      exportRows.push({
        'Student Name': student.full_name,
        'Admission No': student.admission_no,
        'Roll No': enrollment?.roll_no || '—',
        'Class & Section': `${cls?.name || ''} - ${section?.name || ''}`,
        'Record Type': 'Exam',
        'Assessment Title': ex.exam_name,
        Subject: ex.subject_name,
        Date: ex.exam_date || '—',
        'Max Marks': ex.max_marks,
        'Marks Obtained': ex.is_absent ? 'ABSENT' : ex.marks_obtained ?? 0,
        'Percentage (%)': ex.is_absent ? 0 : (ex.percentage || 0).toFixed(1),
        'BISE Grade': ex.is_absent ? 'F' : ex.grade,
        Remarks: ex.remarks || '',
      });
    });

    // 2. Add Quiz Marks
    quizzes.forEach((qm) => {
      exportRows.push({
        'Student Name': student.full_name,
        'Admission No': student.admission_no,
        'Roll No': enrollment?.roll_no || '—',
        'Class & Section': `${cls?.name || ''} - ${section?.name || ''}`,
        'Record Type': 'Quiz',
        'Assessment Title': qm.title,
        Subject: qm.subject_name,
        Date: qm.assessment_date,
        'Max Marks': qm.max_marks,
        'Marks Obtained': qm.is_absent ? 'ABSENT' : qm.marks_obtained ?? 0,
        'Percentage (%)': qm.is_absent ? 0 : (qm.percentage || 0).toFixed(1),
        'BISE Grade': '—',
        Remarks: qm.remarks || '',
      });
    });

    if (exportRows.length === 0) {
      exportRows.push({
        'Student Name': student.full_name,
        'Admission No': student.admission_no,
        'Roll No': enrollment?.roll_no || '—',
        'Class & Section': `${cls?.name || ''} - ${section?.name || ''}`,
        'Record Type': 'Profile Summary',
        'Assessment Title': 'Attendance Summary',
        Subject: 'All Subjects',
        Date: new Date().toISOString().slice(0, 10),
        'Max Marks': attendance.total,
        'Marks Obtained': attendance.present,
        'Percentage (%)': attendance.percentage.toFixed(1),
        'BISE Grade': '—',
        Remarks: `Attendance: ${attendance.percentage}%`,
      });
    }

    exportToSafeCSV(exportRows, filename);
  };

  // Submit New Quiz & Mark
  const handleSaveQuizMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuizFormError(null);
    setQuizFormSuccess(null);

    if (!enrollment) {
      setQuizFormError('Cannot record quiz: Student has no active enrollment.');
      return;
    }

    if (!newQuizTitle.trim()) {
      setQuizFormError('Please enter a quiz or assessment title.');
      return;
    }

    const maxMarks = Number(newQuizMaxMarks);
    if (isNaN(maxMarks) || maxMarks <= 0) {
      setQuizFormError('Maximum marks must be a positive number greater than 0.');
      return;
    }

    let marksObtained = Number(newQuizMarksObtained);
    if (newQuizIsAbsent) {
      marksObtained = 0;
    } else {
      if (isNaN(marksObtained) || marksObtained < 0) {
        setQuizFormError('Marks obtained cannot be negative.');
        return;
      }
      if (marksObtained > maxMarks) {
        setQuizFormError(`Marks obtained (${marksObtained}) cannot exceed Maximum Marks (${maxMarks}).`);
        return;
      }
    }

    setIsSubmittingQuiz(true);
    try {
      const subjectId = newQuizSubjectId || allSubjects[0]?.id;
      const classId = section?.class_id || (cls?.id as string);

      // 1. Create Quiz
      const quiz = await quizApi.createQuiz(
        {
          title: newQuizTitle.trim(),
          class_id: classId,
          section_id: enrollment.section_id,
          subject_id: subjectId,
          academic_session_id: enrollment.academic_session_id,
          max_marks: maxMarks,
          assessment_date: newQuizDate,
          created_by: currentActor?.id,
        },
        currentActor
      );

      // 2. Save Quiz Mark for this student
      await quizApi.saveQuizMarksBatch(
        quiz.id,
        [
          {
            enrollment_id: enrollment.id,
            marks_obtained: marksObtained,
            is_absent: newQuizIsAbsent,
            remarks: newQuizRemarks.trim(),
          },
        ],
        currentActor
      );

      setQuizFormSuccess('Quiz assessment and marks saved successfully!');
      setTimeout(() => {
        setIsAddQuizModalOpen(false);
        setQuizFormSuccess(null);
        setNewQuizTitle('');
        setNewQuizRemarks('');
        onRefresh();
      }, 800);
    } catch (err: any) {
      setQuizFormError(err.message || 'Failed to save quiz assessment.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Student Search
        </button>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={() => setIsPrintModalOpen(true)}
          >
            Print Dossier
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileDown className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            Export Safe CSV
          </Button>
          <Button
            size="sm"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={() => {
              setQuizFormError(null);
              setQuizFormSuccess(null);
              setIsAddQuizModalOpen(true);
            }}
          >
            Record Quiz Mark
          </Button>
        </div>
      </div>

      {/* Student Identity Dossier Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">
              {student.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {student.full_name}
                </h1>
                <Badge variant={student.is_active ? 'success' : 'danger'}>
                  {student.is_active ? 'Active Enrolled' : 'Archived'}
                </Badge>
                <Badge variant="outline" className="font-mono font-bold text-navy-800 dark:text-brand-300">
                  {student.admission_no}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mt-3 text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-slate-400 block font-medium">Class & Section:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {cls?.name || '—'} - {section?.name || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Roll Number:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                    {enrollment?.roll_no || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Father / Guardian:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {student.guardian_name} ({student.guardian_relation || 'Father'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Emergency Contact:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {student.guardian_phone}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {student.address || 'Address not listed'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  DOB: {formatDate(student.date_of_birth)}
                </span>
                <span>•</span>
                <span>Gender: {student.gender}</span>
                {student.blood_group && (
                  <>
                    <span>•</span>
                    <span>Blood: <strong className="text-rose-600 font-bold">{student.blood_group}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Academic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Exam Average */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Exam Average</span>
            <Award className="w-4 h-4 text-brand-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {overallExamPct.toFixed(1)}%
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                overallGrade.grade === 'F'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              }`}
            >
              Grade {overallGrade.grade}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {totalExamObtained} / {totalExamMax} Marks ({exams.length} Subjects)
          </p>
        </div>

        {/* KPI 2: Quiz Average */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Quiz Score</span>
            <BookOpen className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {quizAvgPct.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({quizzes.length} Tests)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {totalQuizObtained} / {totalQuizMax} Total Marks
          </p>
        </div>

        {/* KPI 3: Attendance */}
        <div
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs ${
            isAttendanceShort ? 'border-amber-300 dark:border-amber-700/60' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Attendance Rate</span>
            <CalendarCheck className={`w-4 h-4 ${isAttendanceShort ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl font-black ${
                isAttendanceShort ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {attendance.percentage.toFixed(1)}%
            </span>
            {isAttendanceShort ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Short Alert
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                Good Standing
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Present {attendance.present} of {attendance.total} recorded days
          </p>
        </div>

        {/* KPI 4: Fee Ledger Status (ADMIN ONLY) */}
        {currentRole === 'admin' ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Fee Balance</span>
              <Receipt className="w-4 h-4 text-brand-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span
                className={`text-2xl font-black ${
                  fees && fees.outstanding_balance > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {fees ? formatCurrency(fees.outstanding_balance) : formatCurrency(0)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Paid: {fees ? formatCurrency(fees.total_paid) : '—'} / Total:{' '}
              {fees ? formatCurrency(fees.total_invoiced) : '—'}
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Finance Restricted
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Student financial & fee records are restricted to school administrators.
            </p>
          </div>
        )}
      </div>

      {/* Tabs Navigation Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'performance'
              ? 'border-navy-900 text-navy-900 dark:border-brand-400 dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Performance Trend Graph
        </button>

        <button
          onClick={() => setActiveTab('quizzes')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'quizzes'
              ? 'border-navy-900 text-navy-900 dark:border-brand-400 dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Quizzes & Assessments ({quizzes.length})
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'exams'
              ? 'border-navy-900 text-navy-900 dark:border-brand-400 dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Award className="w-4 h-4" />
          Examination Results ({exams.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'attendance'
              ? 'border-navy-900 text-navy-900 dark:border-brand-400 dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          Attendance History
        </button>

        <button
          onClick={() => setActiveTab('diary')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'diary'
              ? 'border-navy-900 text-navy-900 dark:border-brand-400 dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <BookMarked className="w-4 h-4" />
          Daily Diary ({diaryEntries.length})
        </button>

        {/* Tab is exclusively for Admins */}
        {currentRole === 'admin' && (
          <button
            onClick={() => setActiveTab('fees')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'fees'
                ? 'border-navy-900 text-navy-900 dark:border-brand-400 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Fee Invoices & Ledger
          </button>
        )}
      </div>

      {/* Tab 1: Performance Graph */}
      {activeTab === 'performance' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Academic Performance Over Time
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological assessment trends across quizzes and major term examinations.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
              <button
                onClick={() => setTrendFilter('all')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  trendFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTrendFilter('quiz')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  trendFilter === 'quiz'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Quizzes Only
              </button>
              <button
                onClick={() => setTrendFilter('exam')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  trendFilter === 'exam'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Exams Only
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTrend.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <TrendingUp className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-semibold">No assessment data points recorded yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add quiz marks or enter examination results to view the student's progress graph.
                </p>
              </div>
            ) : (
              <div className="h-80 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={filteredTrend}
                    margin={{ top: 10, right: 30, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val) => {
                        try {
                          const d = new Date(val);
                          return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const subGrade = calculateGrade(data.percentage, settings.grading_rules);
                          return (
                            <div className="bg-navy-950 text-white text-xs p-3 rounded-lg shadow-lg border border-navy-800 space-y-1">
                              <div className="flex items-center justify-between gap-4 font-bold border-b border-navy-800 pb-1">
                                <span>{data.title}</span>
                                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-navy-800 text-brand-300">
                                  {data.type}
                                </span>
                              </div>
                              <p className="text-slate-300">
                                Subject: <span className="text-white font-medium">{data.subject}</span>
                              </p>
                              <p className="text-slate-300">
                                Date: <span className="text-white">{data.date}</span>
                              </p>
                              <div className="pt-1 flex items-baseline justify-between gap-3 font-mono">
                                <span className="text-sm font-black text-emerald-400">
                                  {data.percentage.toFixed(1)}%
                                </span>
                                <span className="text-slate-300 text-[11px]">
                                  Grade: {subGrade.grade}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <ReferenceLine
                      y={33}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{
                        value: 'Passing (33%)',
                        fill: '#ef4444',
                        fontSize: 10,
                        position: 'insideBottomRight',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      name="Score (%)"
                      stroke="#0284c7"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#0369a1', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Quizzes & Classroom Assessments */}
      {activeTab === 'quizzes' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Classroom Quizzes & Regular Assessments
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Subject-specific classroom tests, weekly quizzes, and formative grading.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Subject Filter */}
              <select
                value={quizSubjectFilter}
                onChange={(e) => setQuizSubjectFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Subjects</option>
                {Array.from(new Set(quizzes.map((q) => q.subject_name))).map((sName) => (
                  <option key={sName} value={sName}>
                    {sName}
                  </option>
                ))}
              </select>

              {/* Date Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px]">Date:</span>
                <input
                  type="date"
                  value={quizDateFilter}
                  onChange={(e) => setQuizDateFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-slate-800 dark:text-slate-200"
                />
              </div>

              {(quizSubjectFilter !== 'all' || quizDateFilter) && (
                <button
                  onClick={() => {
                    setQuizSubjectFilter('all');
                    setQuizDateFilter('');
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                >
                  Reset
                </button>
              )}

              <Button
                size="sm"
                leftIcon={<PlusCircle className="w-4 h-4" />}
                onClick={() => {
                  setQuizFormError(null);
                  setQuizFormSuccess(null);
                  setIsAddQuizModalOpen(true);
                }}
              >
                Add Quiz Mark
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredQuizzes.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-semibold">
                  {quizzes.length === 0
                    ? 'No quizzes recorded for this student yet.'
                    : 'No quizzes match the selected filter criteria.'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Click "+ Add Quiz Mark" above to record a new assessment score.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Quiz Title</th>
                      <th className="p-3">Subject</th>
                      <th className="p-3 text-center">Quiz Date</th>
                      <th className="p-3 text-center">Max Marks</th>
                      <th className="p-3 text-center">Marks Obtained</th>
                      <th className="p-3 text-center">Score %</th>
                      <th className="p-3">Teacher Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredQuizzes.map((qm, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                          {qm.title}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {qm.subject_name}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500">
                          {qm.assessment_date}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">
                          {qm.max_marks}
                        </td>
                        <td className="p-3 text-center font-mono font-bold">
                          {qm.is_absent ? (
                            <span className="text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded text-[10px]">
                              ABSENT
                            </span>
                          ) : (
                            <span className="text-slate-900 dark:text-slate-100">
                              {qm.marks_obtained ?? 0}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-semibold">
                          {qm.is_absent ? (
                            '0%'
                          ) : (
                            <span
                              className={
                                (qm.percentage || 0) >= 70
                                   ? 'text-emerald-600 dark:text-emerald-400'
                                   : 'text-slate-700 dark:text-slate-300'
                              }
                            >
                              {(qm.percentage || 0).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 italic">{qm.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Major Examination Results */}
      {activeTab === 'exams' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Official Examination Results (Board of Intermediate and Secondary Education Standards)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Mid-term, terminal, and annual examination scores with BISE grading scale.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {exams.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Award className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-semibold">No examination results recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Exam Title</th>
                      <th className="p-3">Subject</th>
                      <th className="p-3 text-center">Max Marks</th>
                      <th className="p-3 text-center">Marks Obtained</th>
                      <th className="p-3 text-center">Percentage</th>
                      <th className="p-3 text-center">Grade</th>
                      <th className="p-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {exams.map((ex, idx) => {
                      const subGrade = calculateGrade(ex.percentage || 0, settings.grading_rules);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            {ex.exam_name}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{ex.subject_name}</td>
                          <td className="p-3 text-center font-mono text-slate-500">{ex.max_marks}</td>
                          <td className="p-3 text-center font-mono font-bold">
                            {ex.is_absent ? (
                              <span className="text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded text-[10px]">
                                ABSENT
                              </span>
                            ) : (
                              <span className="text-slate-900 dark:text-slate-100">
                                {ex.marks_obtained ?? 0}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">
                            {ex.is_absent ? '0%' : `${(ex.percentage || 0).toFixed(1)}%`}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                ex.is_absent || subGrade.grade === 'F'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                  : subGrade.grade.startsWith('A')
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {ex.is_absent ? 'F' : ex.grade || subGrade.grade}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{ex.remarks || subGrade.remarks}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold border-t border-slate-200 dark:border-slate-700 text-xs">
                    <tr>
                      <td colSpan={2} className="p-3 uppercase">Total Aggregate</td>
                      <td className="p-3 text-center font-mono">{totalExamMax}</td>
                      <td className="p-3 text-center font-mono">{totalExamObtained}</td>
                      <td className="p-3 text-center font-mono">{overallExamPct.toFixed(1)}%</td>
                      <td className="p-3 text-center font-black text-navy-900 dark:text-brand-300">
                        {overallGrade.grade}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{overallGrade.remarks}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Attendance History */}
      {activeTab === 'attendance' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Student Attendance Record & Calendar
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily presence, absences, lates, and sanctioned leaves.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Present</span>
                <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">
                  {attendance.present}
                </p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">Absent</span>
                <p className="text-2xl font-black text-rose-800 dark:text-rose-200 mt-1">
                  {attendance.absent}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">Late</span>
                <p className="text-2xl font-black text-amber-800 dark:text-amber-200 mt-1">
                  {attendance.late}
                </p>
              </div>
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-300">Leave</span>
                <p className="text-2xl font-black text-sky-800 dark:text-sky-200 mt-1">
                  {attendance.leave}
                </p>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 font-bold text-xs text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                Detailed Date Log ({attendance.history.length} Records)
              </div>
              {attendance.history.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No attendance entries recorded yet.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 uppercase sticky top-0">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {attendance.history.map((rec) => {
                        const statusColor =
                          ATTENDANCE_STATUS_COLORS[rec.status as AttendanceStatus] ||
                          'bg-slate-100 text-slate-700 border-slate-300';
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2.5 font-mono">{formatDate(rec.date)}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`}>
                                {rec.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-500">{rec.remarks || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Daily Diary Entries */}
      {activeTab === 'diary' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Subject-Wise Daily Classroom Diary
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily lesson logs, assigned homework, and upcoming test alerts for {cls?.name} - {section?.name}.
              </p>
            </div>
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={diarySubjectFilter}
                onChange={(e) => setDiarySubjectFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Subjects</option>
                {allSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px]">From:</span>
                <input
                  type="date"
                  value={diaryStartDateFilter}
                  onChange={(e) => setDiaryStartDateFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px]">To:</span>
                <input
                  type="date"
                  value={diaryEndDateFilter}
                  onChange={(e) => setDiaryEndDateFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-slate-800 dark:text-slate-200"
                />
              </div>
              {(diarySubjectFilter !== 'all' || diaryStartDateFilter || diaryEndDateFilter) && (
                <button
                  onClick={() => {
                    setDiarySubjectFilter('all');
                    setDiaryStartDateFilter('');
                    setDiaryEndDateFilter('');
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredDiaries.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <BookMarked className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-semibold">No daily diary entries found.</p>
                <p className="text-xs text-slate-500 mt-1">
                  {diaryEntries.length === 0
                    ? 'No published daily diary entries have been posted for this class & section yet.'
                    : 'No entries match your selected subject or date filters.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDiaries.map((diary) => (
                  <div
                    key={diary.id}
                    className="p-4 bg-slate-50/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-bold text-navy-900 dark:text-brand-300">
                          {diary.subject?.name || 'Subject'} {diary.subject?.code ? `(${diary.subject.code})` : ''}
                        </Badge>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Teacher: <strong className="text-slate-900 dark:text-slate-200">{diary.teacher?.full_name || 'Class Teacher'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(diary.diary_date)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider block">
                          📖 Lesson Topics Covered:
                        </span>
                        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                          {diary.lesson_topics}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider block">
                            ✏️ Homework / Assignment:
                          </span>
                          {diary.homework_due_date && (
                            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              Due: {formatDate(diary.homework_due_date)}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                          {diary.homework_details}
                        </p>
                      </div>
                    </div>

                    {diary.instructions_or_test_alerts && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-[11px]">Notice / Test Alert:</span>
                          <span className="whitespace-pre-wrap">{diary.instructions_or_test_alerts}</span>
                        </div>
                      </div>
                    )}

                    {/* Teacher/Admin only private notes */}
                    {currentRole !== 'student' && diary.private_teacher_notes && (
                      <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-lg text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2">
                        <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-[11px]">Private Teacher Notes (Internal Only):</span>
                          <span className="italic whitespace-pre-wrap">{diary.private_teacher_notes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Fee Invoices & Ledger (Strictly Admin Only) */}
      {currentRole === 'admin' && activeTab === 'fees' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Fee Invoices & Payment Ledger
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Official billing history, monthly dues, and outstanding fee accounts for this student.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total Invoiced</span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {fees ? formatCurrency(fees.total_invoiced) : '—'}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Total Collected</span>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                  {fees ? formatCurrency(fees.total_paid) : '—'}
                </p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">Outstanding Balance</span>
                <p className="text-xl font-bold text-rose-800 dark:text-rose-200 mt-1">
                  {fees ? formatCurrency(fees.outstanding_balance) : '—'}
                </p>
              </div>
            </div>

            {fees && fees.invoices.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No invoices generated for this student.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] text-slate-500 tracking-wider">
                    <tr>
                      <th className="p-3">Invoice #</th>
                      <th className="p-3">Billing Month</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3 text-right">Net Amount</th>
                      <th className="p-3 text-right">Paid Amount</th>
                      <th className="p-3 text-right">Balance Due</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fees?.invoices.map((inv) => {
                      const balance = inv.net_amount - inv.paid_amount;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-navy-900 dark:text-brand-300">
                            {inv.invoice_no}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {inv.billing_month}
                          </td>
                          <td className="p-3 text-slate-500 font-mono">{formatDate(inv.due_date)}</td>
                          <td className="p-3 text-right font-mono font-semibold">{formatCurrency(inv.net_amount)}</td>
                          <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(inv.paid_amount)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600">
                            {formatCurrency(balance)}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                              {inv.status}
                            </span>
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
      )}

      {/* Modal: Official Pakistani Printable Dossier */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Student Academic Dossier & Performance Report"
        size="xl"
      >
        <div className="space-y-4">
          <PrintStudentReportCard
            summary={summary}
            settings={settings}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>
              Close
            </Button>
            <Button
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={() => window.print()}
            >
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Quiz & Record Marks */}
      <Modal
        isOpen={isAddQuizModalOpen}
        onClose={() => setIsAddQuizModalOpen(false)}
        title="Record Classroom Quiz Assessment"
        size="md"
      >
        <form onSubmit={handleSaveQuizMark} className="space-y-4">
          {quizFormError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{quizFormError}</span>
            </div>
          )}

          {quizFormSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{quizFormSuccess}</span>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg text-xs">
            <span className="text-slate-500 block">Student:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {student.full_name} ({student.admission_no}) — {cls?.name} {section?.name}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assessment Title *
            </label>
            <Input
              type="text"
              placeholder="e.g. Chapter 4 Quiz, Weekly Math Test"
              value={newQuizTitle}
              onChange={(e) => setNewQuizTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject *
              </label>
              <select
                value={newQuizSubjectId}
                onChange={(e) => setNewQuizSubjectId(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              >
                {allSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quiz Date *
              </label>
              <Input
                type="date"
                value={newQuizDate}
                onChange={(e) => setNewQuizDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Max Marks *
              </label>
              <Input
                type="number"
                min="1"
                step="0.5"
                value={newQuizMaxMarks}
                onChange={(e) => setNewQuizMaxMarks(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Marks Obtained *
              </label>
              <Input
                type="number"
                min="0"
                max={newQuizMaxMarks}
                step="0.5"
                disabled={newQuizIsAbsent}
                value={newQuizIsAbsent ? 0 : newQuizMarksObtained}
                onChange={(e) => setNewQuizMarksObtained(e.target.value)}
                required={!newQuizIsAbsent}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="quizAbsent"
              checked={newQuizIsAbsent}
              onChange={(e) => {
                setNewQuizIsAbsent(e.target.checked);
                if (e.target.checked) {
                  setNewQuizMarksObtained(0);
                }
              }}
              className="rounded border-slate-300 text-navy-900 focus:ring-navy-900"
            />
            <label htmlFor="quizAbsent" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Mark Student as Absent (0 Marks)
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Remarks (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Good effort, needs revision in algebra"
              value={newQuizRemarks}
              onChange={(e) => setNewQuizRemarks(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddQuizModalOpen(false)}
              disabled={isSubmittingQuiz}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingQuiz}
            >
              Save Quiz Mark
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
