import React, { useState, useEffect } from 'react';
import { Exam, ExamSubject, Mark, Enrollment, ClassLevel } from '@/types/database';
import { examApi, studentApi, academicStructureApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { calculateGrade, formatCurrency, formatDate } from '@/lib/utils';
import { exportToSafeCSV } from '@/lib/csv-sanitizer';
import { PrintReportCard, SubjectResultItem } from '@/components/print/PrintReportCard';
import {
  Award,
  Save,
  Printer,
  FileDown,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const ResultsPage: React.FC = () => {
  const { user, role } = useAuth();
  const { settings, selectedSessionId, currentSession } = useSchool();

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState<string>('');

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [localMarks, setLocalMarks] = useState<
    Record<string, { marks_obtained: number; is_absent: boolean; remarks: string }>
  >({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Individual Report Card Modal
  const [isReportCardModalOpen, setIsReportCardModalOpen] = useState(false);
  const [reportCardData, setReportCardData] = useState<{
    enrollment: Enrollment;
    subjectResults: SubjectResultItem[];
  } | null>(null);

  // Load available exams
  useEffect(() => {
    const init = async () => {
      const eList = await examApi.getExams(selectedSessionId);
      setExams(eList);
      if (eList.length > 0) {
        setSelectedExamId(eList[0].id);
      }
    };
    init();
  }, [selectedSessionId]);

  // Load exam subjects when exam changes
  useEffect(() => {
    if (!selectedExamId) return;
    const loadSubjects = async () => {
      const esList = await examApi.getExamSubjects(selectedExamId);
      setExamSubjects(esList);
      if (esList.length > 0) {
        setSelectedExamSubjectId(esList[0].id);
      } else {
        setSelectedExamSubjectId('');
      }
    };
    loadSubjects();
  }, [selectedExamId]);

  // Load marks & roster when exam subject changes
  const loadRosterAndMarks = async () => {
    if (!selectedExamSubjectId) return;
    setIsLoading(true);
    try {
      const activeES = examSubjects.find((es) => es.id === selectedExamSubjectId);
      if (!activeES) return;

      const [enrList, marksList] = await Promise.all([
        studentApi.getEnrollments(selectedSessionId),
        examApi.getMarks(selectedExamSubjectId),
      ]);

      // Filter enrollments matching the class of this exam subject
      const classEnrollments = enrList.filter((e) => e.section?.class_id === activeES.class_id);
      setEnrollments(classEnrollments);
      setMarks(marksList);

      const map: Record<string, { marks_obtained: number; is_absent: boolean; remarks: string }> = {};
      classEnrollments.forEach((e) => {
        const found = marksList.find((m) => m.enrollment_id === e.id);
        map[e.id] = {
          marks_obtained: found ? (found.is_absent ? 0 : Number(found.marks_obtained || 0)) : 0,
          is_absent: found?.is_absent || false,
          remarks: found?.remarks || '',
        };
      });
      setLocalMarks(map);
    } catch (e) {
      console.error('Failed to load marks', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRosterAndMarks();
  }, [selectedExamSubjectId]);

  const activePaper = examSubjects.find((es) => es.id === selectedExamSubjectId);

  const handleMarksChange = (enrollmentId: string, val: number) => {
    const max = activePaper ? Number(activePaper.max_marks) : 100;
    const validVal = Math.min(max, Math.max(0, val));
    setLocalMarks((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        marks_obtained: validVal,
        is_absent: false,
      },
    }));
  };

  const handleAbsentToggle = (enrollmentId: string, is_absent: boolean) => {
    setLocalMarks((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        is_absent,
        marks_obtained: is_absent ? 0 : prev[enrollmentId]?.marks_obtained || 0,
      },
    }));
  };

  const handleRemarksChange = (enrollmentId: string, remarks: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        remarks,
      },
    }));
  };

  const handleSaveMarks = async () => {
    if (!selectedExamSubjectId) return;
    setIsSaving(true);
    try {
      const payload = enrollments.map((e) => ({
        enrollment_id: e.id,
        marks_obtained: localMarks[e.id]?.is_absent ? 0 : localMarks[e.id]?.marks_obtained || 0,
        is_absent: localMarks[e.id]?.is_absent || false,
        remarks: localMarks[e.id]?.remarks || '',
      }));

      await examApi.saveMarksBatch(selectedExamSubjectId, payload, {
        id: user?.id,
        name: user?.full_name,
      });

      await loadRosterAndMarks();
      alert('Examination marks recorded successfully!');
    } catch (err: any) {
      alert(`Failed to save marks: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenReportCard = async (enr: Enrollment) => {
    try {
      const report = await examApi.getStudentReportCardData(enr.id, selectedExamId);
      setReportCardData({
        enrollment: enr,
        subjectResults: report.subjectResults,
      });
      setIsReportCardModalOpen(true);
    } catch (err: any) {
      alert(`Could not generate report card: ${err.message}`);
    }
  };

  const handleExportMarksCSV = () => {
    const rows = enrollments.map((e) => {
      const m = localMarks[e.id];
      const maxMarks = activePaper ? Number(activePaper.max_marks) : 100;
      const pct = maxMarks > 0 ? ((m?.marks_obtained || 0) / maxMarks) * 100 : 0;
      const gr = calculateGrade(pct, settings.grading_rules);

      return {
        roll_no: e.roll_no,
        admission_no: e.student?.admission_no || '',
        student_name: e.student?.full_name || '',
        subject: activePaper?.subject?.name || '',
        max_marks: maxMarks,
        marks_obtained: m?.is_absent ? 'ABSENT' : m?.marks_obtained || 0,
        percentage: m?.is_absent ? '0%' : `${pct.toFixed(1)}%`,
        grade: m?.is_absent ? 'F' : gr.grade,
        remarks: m?.remarks || '',
      };
    });

    exportToSafeCSV(rows, `Marks_${activePaper?.subject?.code || 'Result'}_${selectedExamId}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Results & Report Cards
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Marks entry, absent student tagging, Pakistani BISE grading, and printable transcripts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileDown className="w-3.5 h-3.5" />}
            onClick={handleExportMarksCSV}
          >
            Export Sheet CSV
          </Button>

          <Button
            size="sm"
            leftIcon={<Save className="w-4 h-4" />}
            isLoading={isSaving}
            onClick={handleSaveMarks}
          >
            Save Marks
          </Button>
        </div>
      </div>

      {/* Selector Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Examination:</span>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.status})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Subject Paper:</span>
            <select
              value={selectedExamSubjectId}
              onChange={(e) => setSelectedExamSubjectId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
            >
              {examSubjects.map((es) => (
                <option key={es.id} value={es.id}>
                  {es.class?.name} — {es.subject?.name} (Max {es.max_marks} marks)
                </option>
              ))}
            </select>
          </div>
        </div>

        {activePaper && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
            <span className="text-slate-500">Passing Threshold:</span>
            <span className="font-mono font-bold text-navy-900 dark:text-brand-300">
              {activePaper.passing_marks} / {activePaper.max_marks} marks
            </span>
          </div>
        )}
      </div>

      {/* Marks Entry Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">
              {activePaper?.class?.name} — {activePaper?.subject?.name} Marks Register
            </h3>
            <p className="text-xs text-slate-400">Total Enrolled: {enrollments.length} Students</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 w-16 text-center">Roll #</th>
                <th className="p-3">Student Name</th>
                <th className="p-3 text-center">Absent?</th>
                <th className="p-3 text-center">Marks Obtained</th>
                <th className="p-3 text-center">Percentage</th>
                <th className="p-3 text-center">BISE Grade</th>
                <th className="p-3">Remarks</th>
                <th className="p-3 text-right">Report Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {enrollments.map((enr) => {
                const item = localMarks[enr.id];
                const maxMarks = activePaper ? Number(activePaper.max_marks) : 100;
                const marksObtained = item?.marks_obtained || 0;
                const isAbsent = item?.is_absent || false;
                const percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
                const gradeInfo = calculateGrade(percentage, settings.grading_rules);

                return (
                  <tr key={enr.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="p-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {enr.roll_no}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {enr.student?.full_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {enr.student?.admission_no} ({enr.section?.name})
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAbsent}
                          onChange={(e) => handleAbsentToggle(enr.id, e.target.checked)}
                          className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                        />
                        <span className={`text-[10px] font-bold ${isAbsent ? 'text-rose-600' : 'text-slate-400'}`}>
                          ABSENT
                        </span>
                      </label>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        disabled={isAbsent}
                        value={isAbsent ? '' : marksObtained}
                        onChange={(e) => handleMarksChange(enr.id, Number(e.target.value))}
                        max={maxMarks}
                        min={0}
                        step={0.5}
                        placeholder={isAbsent ? 'Absent' : '0'}
                        className="w-20 px-2.5 py-1 text-center font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-navy-900 disabled:opacity-40"
                      />
                    </td>
                    <td className="p-3 text-center font-mono font-medium">
                      {isAbsent ? <span className="text-slate-400">—</span> : `${percentage.toFixed(1)}%`}
                    </td>
                    <td className="p-3 text-center">
                      {isAbsent ? (
                        <span className="text-rose-600 font-bold">F</span>
                      ) : (
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-xs ${
                            gradeInfo.grade === 'F'
                              ? 'bg-rose-100 text-rose-700'
                              : gradeInfo.grade.startsWith('A')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {gradeInfo.grade}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        placeholder="Teacher remark..."
                        value={item?.remarks || ''}
                        onChange={(e) => handleRemarksChange(enr.id, e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 text-xs"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleOpenReportCard(enr)}
                        className="p-1.5 text-navy-900 dark:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                        title="Print Student Report Card"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Official Pakistani Board Report Card */}
      <Modal
        isOpen={isReportCardModalOpen}
        onClose={() => setIsReportCardModalOpen(false)}
        title="Student Examination Progress Report Card"
        size="xl"
      >
        {reportCardData && (
          <div className="space-y-4">
            <PrintReportCard
              enrollment={reportCardData.enrollment}
              examName={exams.find((e) => e.id === selectedExamId)?.name || 'Examination'}
              sessionName={currentSession?.name || '2025-2026'}
              subjectResults={reportCardData.subjectResults}
              settings={settings}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsReportCardModalOpen(false)}>
                Close
              </Button>
              <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print Report Card
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
