import React from 'react';
import { Student, Enrollment, SchoolSettings } from '@/types/database';
import { Shield } from 'lucide-react';

export interface PrintStudentIDProps {
  student: Student;
  enrollment?: Enrollment;
  settings: SchoolSettings;
}

export const PrintStudentID: React.FC<PrintStudentIDProps> = ({ student, enrollment, settings }) => {
  return (
    <div className="w-[340px] h-[520px] rounded-2xl border-2 border-navy-900 bg-white text-slate-800 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden select-none font-sans mx-auto">
      {/* Top Banner */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-navy-900 flex flex-col items-center justify-center text-white px-4">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-brand-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-center">{settings.school_name}</h2>
        </div>
        <p className="text-[10px] text-slate-300 font-medium">STUDENT IDENTITY CARD</p>
      </div>

      {/* Photo & Basic Details */}
      <div className="mt-20 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-slate-100 flex items-center justify-center text-2xl font-bold text-navy-900 overflow-hidden mb-2">
          {student.photo_url ? (
            <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
          ) : (
            student.full_name[0]
          )}
        </div>
        <h3 className="text-base font-bold text-navy-950 leading-tight">{student.full_name}</h3>
        <p className="text-xs text-brand-700 font-semibold mt-0.5">{student.admission_no}</p>
      </div>

      {/* Info Grid */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5 my-2">
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Class & Section:</span>
          <span className="font-bold text-slate-800">
            {enrollment?.section?.class?.name || 'Class 9'} - {enrollment?.section?.name || 'A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Roll Number:</span>
          <span className="font-bold text-slate-800">{enrollment?.roll_no || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Father / Guardian:</span>
          <span className="font-semibold text-slate-800 truncate max-w-[150px]">{student.guardian_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Emergency Contact:</span>
          <span className="font-semibold text-slate-800">{student.guardian_phone}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Blood Group:</span>
          <span className="font-bold text-rose-600">{student.blood_group || '—'}</span>
        </div>
      </div>

      {/* Footer Signatures */}
      <div className="pt-2 border-t border-slate-200 flex justify-between items-end text-[9px] text-slate-500">
        <div>
          <p className="font-mono text-[8px] text-slate-400">ISSUED: 2025-26</p>
          <p className="font-semibold text-slate-600">{settings.phone}</p>
        </div>
        <div className="text-center">
          <div className="w-20 border-b border-slate-400 mb-0.5" />
          <p className="font-semibold uppercase text-navy-900">Principal</p>
        </div>
      </div>
    </div>
  );
};
