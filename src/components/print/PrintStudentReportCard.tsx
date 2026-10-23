import React from 'react';
import { StudentAcademicSummary, SchoolSettings } from '@/types/database';
import { calculateGrade } from '@/lib/utils';
import { Shield, Award, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface PrintStudentReportCardProps {
  summary: StudentAcademicSummary;
  settings: SchoolSettings;
  sessionName?: string;
}

export const PrintStudentReportCard: React.FC<PrintStudentReportCardProps> = ({
  summary,
  settings,
  sessionName = '2025-2026',
}) => {
  const { student, enrollment, attendance, exams, quizzes } = summary;
  const section = enrollment?.section;
  const cls = section?.class;

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

  return (
    <div className="max-w-4xl mx-auto bg-white text-slate-900 border-2 border-navy-950 p-8 font-sans text-xs shadow-md print:p-4 print:border-none print:shadow-none print:max-w-full">
      {/* School Header */}
      <div className="text-center border-b-2 border-navy-900 pb-4 mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="w-8 h-8 text-navy-900" />
          <h1 className="text-xl font-black uppercase tracking-wider text-navy-950">
            {settings.school_name}
          </h1>
        </div>
        <p className="text-xs text-slate-600 font-semibold">{settings.affiliation}</p>
        <p className="text-[11px] text-slate-500">
          Reg No: {settings.registration_number} | Phone: {settings.phone} | {settings.address}
        </p>
        <div className="mt-2 inline-block bg-navy-900 text-white text-xs font-bold uppercase px-4 py-1 rounded-full">
          Official Student Academic Dossier & Performance Report ({sessionName})
        </div>
      </div>

      {/* Student Profile Info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-xs">
        <div className="flex">
          <span className="w-28 text-slate-500 font-medium">Student Name:</span>
          <span className="font-bold text-slate-900">{student.full_name}</span>
        </div>
        <div className="flex">
          <span className="w-28 text-slate-500 font-medium">Admission No:</span>
          <span className="font-mono font-bold text-navy-900">{student.admission_no}</span>
        </div>
        <div className="flex">
          <span className="w-28 text-slate-500 font-medium">Roll Number:</span>
          <span className="font-bold text-slate-900">{enrollment?.roll_no || '—'}</span>
        </div>
        <div className="flex">
          <span className="w-28 text-slate-500 font-medium">Father / Guardian:</span>
          <span className="font-semibold text-slate-800">{student.guardian_name}</span>
        </div>
        <div className="flex">
          <span className="w-28 text-slate-500 font-medium">Class & Section:</span>
          <span className="font-bold text-slate-900">
            {cls?.name || '—'} - {section?.name || '—'}
          </span>
        </div>
        <div className="flex">
          <span className="w-28 text-slate-500 font-medium">Contact:</span>
          <span className="text-slate-700">{student.guardian_phone}</span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
          <p className="text-[10px] uppercase font-bold text-slate-500">Overall Examinations</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-navy-950">
              {overallExamPct.toFixed(1)}%
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-navy-900 text-white">
              Grade {overallGrade.grade}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {totalExamObtained} / {totalExamMax} Marks ({overallGrade.remarks})
          </p>
        </div>

        <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
          <p className="text-[10px] uppercase font-bold text-slate-500">Classroom Quizzes</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-slate-900">
              {quizAvgPct.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              ({quizzes.length} Assessments)
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {totalQuizObtained} / {totalQuizMax} Total Marks
          </p>
        </div>

        <div
          className={`p-3 border rounded-lg ${
            isAttendanceShort ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'
          }`}
        >
          <p className="text-[10px] uppercase font-bold text-slate-500">Attendance Record</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-lg font-black ${
                isAttendanceShort ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {attendance.percentage.toFixed(1)}%
            </span>
            {isAttendanceShort ? (
              <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> Short
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Regular
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Present: {attendance.present} / {attendance.total} | Absent: {attendance.absent} | Leave: {attendance.leave}
          </p>
        </div>
      </div>

      {/* Major Examination Results Table */}
      <div className="mb-5">
        <h3 className="font-bold text-navy-950 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-brand-600" />
          Major Examination Results (BISE Standards)
        </h3>
        {exams.length === 0 ? (
          <p className="p-3 text-slate-500 italic bg-slate-50 border border-slate-200 rounded">
            No formal examination records found for this student.
          </p>
        ) : (
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead className="bg-navy-900 text-white uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="border border-navy-900 p-2">Exam Title</th>
                <th className="border border-navy-900 p-2">Subject</th>
                <th className="border border-navy-900 p-2 text-center">Max Marks</th>
                <th className="border border-navy-900 p-2 text-center">Obtained</th>
                <th className="border border-navy-900 p-2 text-center">Percentage</th>
                <th className="border border-navy-900 p-2 text-center">Grade</th>
                <th className="border border-navy-900 p-2">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {exams.map((res, idx) => {
                const subGrade = calculateGrade(res.percentage || 0, settings.grading_rules);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="border border-slate-300 p-2 font-medium">{res.exam_name}</td>
                    <td className="border border-slate-300 p-2">{res.subject_name}</td>
                    <td className="border border-slate-300 p-2 text-center font-mono">{res.max_marks}</td>
                    <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                      {res.is_absent ? (
                        <span className="text-rose-600 font-semibold text-[10px]">ABSENT</span>
                      ) : (
                        res.marks_obtained ?? 0
                      )}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-mono">
                      {res.is_absent ? '0%' : `${(res.percentage || 0).toFixed(1)}%`}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-bold">
                      <span className={res.is_absent || subGrade.grade === 'F' ? 'text-rose-600' : 'text-slate-900'}>
                        {res.is_absent ? 'F' : res.grade || subGrade.grade}
                      </span>
                    </td>
                    <td className="border border-slate-300 p-2 text-[11px] text-slate-600">
                      {res.remarks || subGrade.remarks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-navy-900 text-xs">
              <tr>
                <td colSpan={2} className="border border-slate-300 p-2 uppercase text-navy-950">
                  Aggregate Total
                </td>
                <td className="border border-slate-300 p-2 text-center font-mono text-navy-950">
                  {totalExamMax}
                </td>
                <td className="border border-slate-300 p-2 text-center font-mono text-navy-950">
                  {totalExamObtained}
                </td>
                <td className="border border-slate-300 p-2 text-center font-mono text-navy-950">
                  {overallExamPct.toFixed(1)}%
                </td>
                <td className="border border-slate-300 p-2 text-center text-navy-950 font-black">
                  {overallGrade.grade}
                </td>
                <td className="border border-slate-300 p-2 text-slate-700">
                  {overallGrade.remarks}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Classroom Quizzes Summary Table */}
      {quizzes.length > 0 && (
        <div className="mb-5">
          <h3 className="font-bold text-navy-950 text-xs uppercase tracking-wider mb-2">
            Classroom Quizzes & Regular Assessments
          </h3>
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="border border-slate-700 p-1.5">Quiz Title</th>
                <th className="border border-slate-700 p-1.5">Subject</th>
                <th className="border border-slate-700 p-1.5 text-center">Date</th>
                <th className="border border-slate-700 p-1.5 text-center">Max Marks</th>
                <th className="border border-slate-700 p-1.5 text-center">Obtained</th>
                <th className="border border-slate-700 p-1.5 text-center">Score %</th>
                <th className="border border-slate-700 p-1.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {quizzes.map((qm, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="border border-slate-300 p-1.5 font-medium">{qm.title}</td>
                  <td className="border border-slate-300 p-1.5">{qm.subject_name}</td>
                  <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-600">
                    {qm.assessment_date}
                  </td>
                  <td className="border border-slate-300 p-1.5 text-center font-mono">{qm.max_marks}</td>
                  <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">
                    {qm.is_absent ? (
                      <span className="text-rose-600 text-[10px]">ABSENT</span>
                    ) : (
                      qm.marks_obtained ?? 0
                    )}
                  </td>
                  <td className="border border-slate-300 p-1.5 text-center font-mono font-semibold">
                    {qm.is_absent ? '0%' : `${(qm.percentage || 0).toFixed(1)}%`}
                  </td>
                  <td className="border border-slate-300 p-1.5 text-[11px] text-slate-600">
                    {qm.remarks || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BISE Grading Legend */}
      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-[10px] mb-6">
        <p className="font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-amber-600" />
          Board of Intermediate & Secondary Education (BISE) Official Grading Scale
        </p>
        <div className="grid grid-cols-7 gap-1 text-slate-600 text-center border-t border-slate-200 pt-1">
          <span><strong>A+</strong>: 90–100%</span>
          <span><strong>A</strong>: 80–89%</span>
          <span><strong>B</strong>: 70–79%</span>
          <span><strong>C</strong>: 60–69%</span>
          <span><strong>D</strong>: 50–59%</span>
          <span><strong>E</strong>: 33–49%</span>
          <span className="text-rose-600"><strong>F</strong>: &lt;33% Fail</span>
        </div>
      </div>

      {/* Signature & Stamp Section */}
      <div className="pt-6 grid grid-cols-3 gap-6 text-center text-[10px] text-slate-600">
        <div>
          <div className="border-b border-slate-400 mb-1.5" />
          <p className="font-bold uppercase text-slate-800">Class Teacher</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mb-1.5" />
          <p className="font-bold uppercase text-slate-800">Controller of Examinations</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mb-1.5" />
          <p className="font-bold uppercase text-navy-900">{settings.principal_name}</p>
          <p className="text-[9px] text-slate-500">Principal Signature & Stamp</p>
        </div>
      </div>
    </div>
  );
};
