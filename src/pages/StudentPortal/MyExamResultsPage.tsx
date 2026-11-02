import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { studentPortalApi } from '@/services/api';
import { Exam, Student, Enrollment } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { formatDate } from '@/lib/utils';
import {
  FileSpreadsheet,
  Award,
  Printer,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface ExamWithReport {
  exam: Exam;
  reportCard: {
    subjectResults: {
      subjectName: string;
      subjectCode: string;
      maxMarks: number;
      passingMarks: number;
      marksObtained: number;
      isAbsent: boolean;
      percentage: number;
      isPassed: boolean;
      remarks: string;
    }[];
    totalMaxMarks: number;
    totalMarksObtained: number;
    overallPercentage: number;
    grade: string;
    gpa: number;
    remarks: string;
    status: 'Passed' | 'Needs Attention';
  };
}

export const MyExamResultsPage: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSchool();
  const [data, setData] = useState<{
    student: Student;
    enrollment?: Enrollment;
    exams: ExamWithReport[];
  } | null>(null);

  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadExamResults = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const result = await studentPortalApi.getMyExamResults(identifier);
      setData(result);
      if (result.exams.length > 0 && !selectedExamId) {
        setSelectedExamId(result.exams[0].exam.id);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load examination results.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExamResults();
  }, [user]);

  const activeExamData = data?.exams.find((e) => e.exam.id === selectedExamId) || data?.exams[0];

  const handlePrint = () => {
    window.print();
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your examination results...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.student) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Results Unavailable</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {error || 'No published examination records are linked to your profile.'}
        </p>
        <Button size="sm" onClick={loadExamResults}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Try Again
        </Button>
      </div>
    );
  }

  const { student, enrollment, exams } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
            <Award className="w-4 h-4" />
            <span>Academic Examinations & Progress</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Exam Results & Report Cards
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {enrollment?.section
              ? `Official published examination marks for Class ${enrollment.section?.class?.name || ''} - Section ${enrollment.section?.name || ''}`
              : 'Official published examination marks and term performance report.'}
          </p>
        </div>

        {activeExamData && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsPrintModalOpen(true)}>
              <Printer className="w-3.5 h-3.5 mr-1" /> Printable Report
            </Button>
            <Button size="sm" variant="outline" onClick={loadExamResults}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        )}
      </div>

      {exams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Published Examination Results Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your teachers and the administrative examination office are currently grading your assessments.
              Results will appear here as soon as they are officially published.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Exam Selector Tabs (if multiple exams exist) */}
          {exams.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {exams.map((item) => (
                <button
                  key={item.exam.id}
                  onClick={() => setSelectedExamId(item.exam.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeExamData?.exam.id === item.exam.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.exam.name}
                </button>
              ))}
            </div>
          )}

          {activeExamData && (
            <div className="space-y-6">
              {/* Exam Overall Result Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Overall Grade */}
                <div className="p-4 sm:p-5 rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/70 dark:bg-[#241738] shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                      Overall Grade
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-purple-950 dark:text-white">
                    {activeExamData.reportCard.grade}
                  </div>
                  <p className="text-[11px] text-purple-700 dark:text-purple-400/80 mt-1 font-medium">
                    {activeExamData.reportCard.remarks || 'Standard Assessment'}
                  </p>
                </div>

                {/* Percentage */}
                <div className="p-4 sm:p-5 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-[#13233a] shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                      Aggregate Percentage
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-blue-950 dark:text-white">
                    {activeExamData.reportCard.overallPercentage}%
                  </div>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400/80 mt-1">
                    GPA {activeExamData.reportCard.gpa.toFixed(1)} / 4.0
                  </p>
                </div>

                {/* Total Marks */}
                <div className="p-4 sm:p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-[#0e2a1d] shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Marks Obtained
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-950 dark:text-white">
                    {activeExamData.reportCard.totalMarksObtained}
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold ml-1">
                      / {activeExamData.reportCard.totalMaxMarks}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400/80 mt-1">
                    {activeExamData.reportCard.subjectResults.length} Subject(s) evaluated
                  </p>
                </div>

                {/* Result Status */}
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Result Status
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                  <div className="mt-1">
                    <Badge
                      variant={activeExamData.reportCard.status === 'Passed' ? 'success' : 'danger'}
                      className="text-sm px-3 py-1 font-bold"
                    >
                      {activeExamData.reportCard.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Official BISE Examination Standard
                  </p>
                </div>
              </div>

              {/* Subject-Wise Results Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                      <span>{activeExamData.exam.name} — Subject-Wise Marksheet</span>
                    </CardTitle>
                    <span className="text-xs text-slate-400">
                      Conducted: {formatDate(activeExamData.exam.start_date)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3 text-center">Max</th>
                          <th className="py-2.5 px-3 text-center">Pass</th>
                          <th className="py-2.5 px-3 text-center">Obtained</th>
                          <th className="py-2.5 px-3 text-center">Percentage</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {activeExamData.reportCard.subjectResults.map((sub, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                              {sub.subjectName}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                              {sub.subjectCode || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                              {sub.maxMarks}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500">
                              {sub.passingMarks}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100">
                              {sub.isAbsent ? (
                                <span className="text-rose-600 font-bold">Absent</span>
                              ) : (
                                sub.marksObtained
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-blue-600 dark:text-blue-400">
                              {sub.isAbsent ? '0%' : `${sub.percentage}%`}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {sub.isPassed ? (
                                <Badge variant="success" className="text-[10px]">Pass</Badge>
                              ) : (
                                <Badge variant="danger" className="text-[10px]">Fail</Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                              {sub.remarks || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/80 dark:bg-slate-800/60 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                        <tr>
                          <td colSpan={2} className="py-2.5 px-3 text-slate-900 dark:text-slate-100">
                            Total Evaluation
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-900 dark:text-slate-100">
                            {activeExamData.reportCard.totalMaxMarks}
                          </td>
                          <td className="py-2.5 px-3 text-center">—</td>
                          <td className="py-2.5 px-3 text-center text-slate-900 dark:text-slate-100">
                            {activeExamData.reportCard.totalMarksObtained}
                          </td>
                          <td className="py-2.5 px-3 text-center text-blue-600 dark:text-blue-400 font-extrabold">
                            {activeExamData.reportCard.overallPercentage}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant={activeExamData.reportCard.status === 'Passed' ? 'success' : 'danger'}>
                              {activeExamData.reportCard.grade}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {activeExamData.reportCard.remarks}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Printable Report Card Modal */}
      {isPrintModalOpen && activeExamData && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={`Official Report Card — ${activeExamData.exam.name}`}
          size="xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end no-print">
              <Button size="sm" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Official Copy
              </Button>
            </div>

            {/* Printable View Container */}
            <div className="p-6 bg-white text-slate-900 border-2 border-slate-900 rounded-xl space-y-4 text-xs font-sans print:border-none print:p-0">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">
                  {settings.school_name || 'Islamia Public High School'}
                </h2>
                <p className="text-[11px] text-slate-600">{settings.affiliation}</p>
                <p className="text-[10px] text-slate-500">
                  Phone: {settings.phone} • {settings.address}
                </p>
                <div className="mt-2 inline-block bg-slate-900 text-white font-bold px-3 py-0.5 rounded-full text-[11px]">
                  STUDENT TERM EXAMINATION REPORT CARD
                </div>
              </div>

              {/* Student Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Student Name:</span>
                  <span className="font-bold text-slate-900">{student.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Admission No:</span>
                  <span className="font-bold font-mono text-slate-900">{student.admission_no}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Class & Section:</span>
                  <span className="font-bold text-slate-900">
                    {enrollment?.section?.class?.name || 'Class 9'} - {enrollment?.section?.name || 'A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Examination:</span>
                  <span className="font-bold text-slate-900">{activeExamData.exam.name}</span>
                </div>
              </div>

              {/* Subject Breakdown */}
              <table className="w-full text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 p-1.5 text-left">Subject</th>
                    <th className="border border-slate-300 p-1.5 text-center">Max Marks</th>
                    <th className="border border-slate-300 p-1.5 text-center">Passing</th>
                    <th className="border border-slate-300 p-1.5 text-center">Marks Obtained</th>
                    <th className="border border-slate-300 p-1.5 text-center">Percentage</th>
                    <th className="border border-slate-300 p-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeExamData.reportCard.subjectResults.map((sub, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-1.5 font-medium">{sub.subjectName}</td>
                      <td className="border border-slate-300 p-1.5 text-center">{sub.maxMarks}</td>
                      <td className="border border-slate-300 p-1.5 text-center">{sub.passingMarks}</td>
                      <td className="border border-slate-300 p-1.5 text-center font-bold">
                        {sub.isAbsent ? 'Absent' : sub.marksObtained}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center font-semibold">
                        {sub.isAbsent ? '0%' : `${sub.percentage}%`}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center">
                        {sub.isPassed ? 'Passed' : 'Failed'}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-100">
                    <td className="border border-slate-300 p-1.5">Grand Total</td>
                    <td className="border border-slate-300 p-1.5 text-center">{activeExamData.reportCard.totalMaxMarks}</td>
                    <td className="border border-slate-300 p-1.5 text-center">—</td>
                    <td className="border border-slate-300 p-1.5 text-center">{activeExamData.reportCard.totalMarksObtained}</td>
                    <td className="border border-slate-300 p-1.5 text-center">{activeExamData.reportCard.overallPercentage}%</td>
                    <td className="border border-slate-300 p-1.5 text-center font-extrabold text-blue-700">
                      Grade {activeExamData.reportCard.grade}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-8 flex justify-between text-center text-[10px] text-slate-700">
                <div className="w-36 border-t border-slate-400 pt-1">Class Teacher</div>
                <div className="w-36 border-t border-slate-400 pt-1">Controller of Exams</div>
                <div className="w-36 border-t border-slate-400 pt-1">Principal Signature</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default MyExamResultsPage;
