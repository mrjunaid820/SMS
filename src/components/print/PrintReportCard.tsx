import React from 'react';
import { Enrollment, SchoolSettings } from '@/types/database';
import { calculateGrade } from '@/lib/utils';
import { Award, Shield } from 'lucide-react';

export interface SubjectResultItem {
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passingMarks: number;
  marksObtained: number;
  isAbsent: boolean;
  percentage: number;
  isPassed: boolean;
  remarks?: string;
}

export interface PrintReportCardProps {
  enrollment: Enrollment;
  examName: string;
  sessionName: string;
  subjectResults: SubjectResultItem[];
  settings: SchoolSettings;
  attendancePercentage?: number;
}

export const PrintReportCard: React.FC<PrintReportCardProps> = ({
  enrollment,
  examName,
  sessionName,
  subjectResults,
  settings,
  attendancePercentage = 94,
}) => {
  const student = enrollment.student;
  const section = enrollment.section;
  const cls = section?.class;

  const totalMax = subjectResults.reduce((acc, curr) => acc + curr.maxMarks, 0);
  const totalObtained = subjectResults.reduce(
    (acc, curr) => acc + (curr.isAbsent ? 0 : curr.marksObtained),
    0
  );
  const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
  const overallGrade = calculateGrade(overallPct, settings.grading_rules);
  const hasFailedSubject = subjectResults.some((s) => !s.isPassed);

  return (
    <div className="max-w-3xl mx-auto bg-white text-slate-900 border-2 border-navy-950 p-8 font-sans text-xs shadow-md print:p-6 print:border-none print:shadow-none">
      {/* Header with Emblem */}
      <div className="text-center border-b-2 border-navy-900 pb-4 mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="w-8 h-8 text-navy-900" />
          <h1 className="text-xl font-black uppercase tracking-wider text-navy-950">
            {settings.school_name}
          </h1>
        </div>
        <p className="text-xs text-slate-600 font-semibold">{settings.affiliation}</p>
        <p className="text-[11px] text-slate-500">Reg No: {settings.registration_number} | {settings.address}</p>
        <div className="mt-2 inline-block bg-navy-900 text-white text-xs font-bold uppercase px-4 py-1 rounded-full">
          Progress & Examination Report Card — {examName} ({sessionName})
        </div>
      </div>

      {/* Student Profile Info */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-xs">
        <div className="flex">
          <span className="w-32 text-slate-500 font-medium">Student Name:</span>
          <span className="font-bold text-slate-900">{student?.full_name}</span>
        </div>
        <div className="flex">
          <span className="w-32 text-slate-500 font-medium">Admission No:</span>
          <span className="font-mono font-bold text-navy-900">{student?.admission_no}</span>
        </div>
        <div className="flex">
          <span className="w-32 text-slate-500 font-medium">Father's Name:</span>
          <span className="font-semibold text-slate-800">{student?.guardian_name}</span>
        </div>
        <div className="flex">
          <span className="w-32 text-slate-500 font-medium">Roll Number:</span>
          <span className="font-bold text-slate-900">{enrollment.roll_no}</span>
        </div>
        <div className="flex">
          <span className="w-32 text-slate-500 font-medium">Class & Section:</span>
          <span className="font-bold text-slate-900">{cls?.name} - Section {section?.name}</span>
        </div>
        <div className="flex">
          <span className="w-32 text-slate-500 font-medium">Attendance:</span>
          <span className="font-bold text-emerald-700">{attendancePercentage}% Present</span>
        </div>
      </div>

      {/* Marks Statement Table */}
      <table className="w-full text-left border-collapse border border-slate-300 text-xs mb-5">
        <thead className="bg-navy-900 text-white uppercase text-[10px] tracking-wider font-semibold">
          <tr>
            <th className="border border-navy-900 p-2">#</th>
            <th className="border border-navy-900 p-2">Subject Title</th>
            <th className="border border-navy-900 p-2 text-center">Max Marks</th>
            <th className="border border-navy-900 p-2 text-center">Passing</th>
            <th className="border border-navy-900 p-2 text-center">Marks Obtained</th>
            <th className="border border-navy-900 p-2 text-center">Percentage</th>
            <th className="border border-navy-900 p-2 text-center">Grade</th>
            <th className="border border-navy-900 p-2">Remarks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {subjectResults.map((sub, index) => {
            const subGrade = calculateGrade(sub.percentage, settings.grading_rules);
            return (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="border border-slate-300 p-2 text-slate-400 font-mono">{index + 1}</td>
                <td className="border border-slate-300 p-2 font-medium">{sub.subjectName}</td>
                <td className="border border-slate-300 p-2 text-center font-mono">{sub.maxMarks}</td>
                <td className="border border-slate-300 p-2 text-center font-mono text-slate-500">{sub.passingMarks}</td>
                <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                  {sub.isAbsent ? (
                    <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">ABSENT</span>
                  ) : (
                    <span className={sub.isPassed ? 'text-slate-900' : 'text-rose-600'}>
                      {sub.marksObtained}
                    </span>
                  )}
                </td>
                <td className="border border-slate-300 p-2 text-center font-mono">
                  {sub.isAbsent ? '0%' : `${sub.percentage}%`}
                </td>
                <td className="border border-slate-300 p-2 text-center font-bold">
                  <span
                    className={
                      subGrade.grade === 'F'
                        ? 'text-rose-600'
                        : subGrade.grade === 'A+' || subGrade.grade === 'A'
                        ? 'text-emerald-700'
                        : 'text-slate-800'
                    }
                  >
                    {subGrade.grade}
                  </span>
                </td>
                <td className="border border-slate-300 p-2 text-[11px] text-slate-600">
                  {sub.remarks || subGrade.remarks}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-100 font-bold border-t-2 border-navy-900 text-xs">
          <tr>
            <td colSpan={2} className="border border-slate-300 p-2 uppercase text-navy-950">Grand Total</td>
            <td className="border border-slate-300 p-2 text-center font-mono text-navy-950">{totalMax}</td>
            <td className="border border-slate-300 p-2 text-center text-slate-400">—</td>
            <td className="border border-slate-300 p-2 text-center font-mono text-navy-950">{totalObtained}</td>
            <td className="border border-slate-300 p-2 text-center font-mono text-navy-950">{overallPct}%</td>
            <td className="border border-slate-300 p-2 text-center text-navy-950 text-sm font-black">{overallGrade.grade}</td>
            <td className="border border-slate-300 p-2 text-slate-700">{overallGrade.remarks}</td>
          </tr>
        </tfoot>
      </table>

      {/* Aggregate Score Card & Grading Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Performance Box */}
        <div className="bg-navy-50/60 border border-navy-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Final Result</p>
            <h4 className="text-base font-bold text-navy-950 mt-0.5">
              {!hasFailedSubject ? 'PASSED & PROMOTED' : 'NEEDS COMPARTMENT EXAM'}
            </h4>
            <p className="text-xs text-slate-600 mt-1">GPA Equivalent: <span className="font-bold text-navy-900">{overallGrade.gpa.toFixed(1)} / 4.0</span></p>
          </div>
          <div className="w-14 h-14 rounded-full bg-navy-900 text-white flex flex-col items-center justify-center font-black text-xl shadow-xs">
            {overallGrade.grade}
          </div>
        </div>

        {/* Board Grading Scale */}
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-[10px]">
          <p className="font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            BISE Grading Standard
          </p>
          <div className="grid grid-cols-4 gap-1 text-slate-600">
            <span>A+ (90-100%)</span>
            <span>A (80-89%)</span>
            <span>B (70-79%)</span>
            <span>C (60-69%)</span>
            <span>D (50-59%)</span>
            <span>E (33-49%)</span>
            <span className="text-rose-600 font-semibold">F (&lt;33% Fail)</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[10px] text-slate-600">
        <div>
          <div className="border-b border-slate-400 mb-1.5" />
          <p className="font-bold uppercase text-slate-800">Class Teacher</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mb-1.5" />
          <p className="font-bold uppercase text-slate-800">Controller of Exams</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mb-1.5" />
          <p className="font-bold uppercase text-navy-900">Principal Signature & Stamp</p>
        </div>
      </div>
    </div>
  );
};
