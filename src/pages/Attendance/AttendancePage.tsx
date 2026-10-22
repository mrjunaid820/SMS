import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceStatus, AttendanceRecord, Enrollment, Section, ClassLevel } from '@/types/database';
import { attendanceApi, studentApi, academicStructureApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { formatDate } from '@/lib/utils';
import { exportToSafeCSV } from '@/lib/csv-sanitizer';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  FileDown,
  Printer,
  Save,
  CheckCheck,
  CalendarDays,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { selectedSessionId } = useSchool();

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [localStatuses, setLocalStatuses] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [bulkStatusToApply, setBulkStatusToApply] = useState<AttendanceStatus>('Present');

  // Load classes and sections
  useEffect(() => {
    const init = async () => {
      const [cList, sList] = await Promise.all([
        academicStructureApi.getClasses(),
        academicStructureApi.getSections(),
      ]);
      setClasses(cList);
      setSections(sList);
      if (sList.length > 0 && !selectedSectionId) {
        setSelectedSectionId(sList[0].id);
      }
    };
    init();
  }, []);

  // Load section enrollments and attendance for date
  const loadSectionAttendance = async () => {
    if (!selectedSectionId) return;
    setIsLoading(true);
    try {
      const [enrList, attList] = await Promise.all([
        studentApi.getEnrollments(selectedSessionId, selectedSectionId),
        attendanceApi.getAttendance(date, selectedSectionId),
      ]);
      setEnrollments(enrList);
      setAttendanceRecords(attList);

      // Populate local status map
      const map: Record<string, { status: AttendanceStatus; remarks: string }> = {};
      enrList.forEach((e) => {
        const found = attList.find((a) => a.enrollment_id === e.id);
        map[e.id] = {
          status: found ? found.status : 'Present',
          remarks: found?.remarks || '',
        };
      });
      setLocalStatuses(map);
    } catch (e) {
      console.error('Failed to load attendance', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSectionAttendance();
  }, [date, selectedSectionId, selectedSessionId]);

  const handleStatusChange = (enrollmentId: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        status,
      },
    }));
  };

  const handleRemarksChange = (enrollmentId: string, remarks: string) => {
    setLocalStatuses((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        remarks,
      },
    }));
  };

  const handleApplyBulkConfirm = () => {
    const updated = { ...localStatuses };
    enrollments.forEach((e) => {
      updated[e.id] = {
        ...updated[e.id],
        status: bulkStatusToApply,
      };
    });
    setLocalStatuses(updated);
    setIsBulkConfirmOpen(false);
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const payload = enrollments.map((e) => ({
        enrollment_id: e.id,
        status: localStatuses[e.id]?.status || 'Present',
        remarks: localStatuses[e.id]?.remarks || '',
      }));

      await attendanceApi.markBatchAttendance(date, payload, {
        id: user?.id,
        name: user?.full_name,
      });

      await loadSectionAttendance();
      alert(`Attendance for ${date} successfully recorded!`);
    } catch (err: any) {
      alert(`Failed to save attendance: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Summary counts
  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    enrollments.forEach((e) => {
      const s = localStatuses[e.id]?.status || 'Present';
      if (s === 'Present') present++;
      else if (s === 'Absent') absent++;
      else if (s === 'Late') late++;
      else if (s === 'Leave') leave++;
    });
    const total = enrollments.length;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { present, absent, late, leave, total, percentage };
  }, [enrollments, localStatuses]);

  const handleExportCSV = () => {
    const rows = enrollments.map((e) => ({
      date,
      roll_no: e.roll_no,
      admission_no: e.student?.admission_no || '',
      student_name: e.student?.full_name || '',
      class: e.section?.class?.name || '',
      section: e.section?.name || '',
      status: localStatuses[e.id]?.status || 'Present',
      remarks: localStatuses[e.id]?.remarks || '',
    }));

    exportToSafeCSV(rows, `Attendance_${date}_Section_${selectedSectionId}`);
  };

  const activeSectionObj = sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Daily Attendance Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Class register, bulk status confirmation, holiday tracking and export
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => window.print()}
          >
            Print Register
          </Button>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileDown className="w-3.5 h-3.5" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>

          <Button
            size="sm"
            leftIcon={<Save className="w-4 h-4" />}
            isLoading={isSaving}
            onClick={handleSaveAttendance}
          >
            Save Attendance
          </Button>
        </div>
      </div>

      {/* Control Toolbar: Date Picker, Section Selector & Quick Bulk Action */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          {/* Section Picker */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Class & Section:</span>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.class?.name || 'Class'} — Section {sec.name} ({sec.room_no || 'Room'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Pill */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
            onClick={() => {
              setBulkStatusToApply('Present');
              setIsBulkConfirmOpen(true);
            }}
          >
            Mark All Present
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBulkStatusToApply('Absent');
              setIsBulkConfirmOpen(true);
            }}
          >
            Mark All Absent
          </Button>
        </div>
      </div>

      {/* Attendance KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Enrolled</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{summary.total}</div>
        </div>
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Present</span>
          <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{summary.present}</div>
        </div>
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase">Absent</span>
          <div className="text-xl font-bold text-rose-800 dark:text-rose-300">{summary.absent}</div>
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Late</span>
          <div className="text-xl font-bold text-amber-800 dark:text-amber-300">{summary.late}</div>
        </div>
        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 text-center">
          <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 uppercase">Rate</span>
          <div className="text-xl font-bold text-sky-800 dark:text-sky-300">{summary.percentage}%</div>
        </div>
      </div>

      {/* Main Student Attendance Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">
              {activeSectionObj?.class?.name || 'Class'} — Section {activeSectionObj?.name} Student Register
            </h3>
            <p className="text-xs text-slate-400">Date: {formatDate(date)}</p>
          </div>
          <span className="text-xs font-mono font-medium text-slate-500">
            {enrollments.length} Students on Roll
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 w-16 text-center">Roll #</th>
                <th className="p-3 w-28">Adm #</th>
                <th className="p-3">Student Name</th>
                <th className="p-3 text-center">Attendance Status</th>
                <th className="p-3">Remarks / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {enrollments.map((enr) => {
                const currentStatus = localStatuses[enr.id]?.status || 'Present';
                const currentRemarks = localStatuses[enr.id]?.remarks || '';

                return (
                  <tr key={enr.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="p-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {enr.roll_no}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {enr.student?.admission_no}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {enr.student?.full_name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Guardian: {enr.student?.guardian_name} ({enr.student?.guardian_phone})
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800 gap-1">
                        {(['Present', 'Absent', 'Late', 'Leave'] as AttendanceStatus[]).map((st) => {
                          const isActive = currentStatus === st;
                          const activeStyles = {
                            Present: 'bg-emerald-600 text-white font-bold',
                            Absent: 'bg-rose-600 text-white font-bold',
                            Late: 'bg-amber-500 text-white font-bold',
                            Leave: 'bg-sky-600 text-white font-bold',
                          };
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(enr.id, st)}
                              className={`px-3 py-1 rounded text-xs transition-colors ${
                                isActive
                                  ? activeStyles[st]
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        placeholder="Optional note (e.g. sick leave, traffic)"
                        value={currentRemarks}
                        onChange={(e) => handleRemarksChange(enr.id, e.target.value)}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-navy-900 text-slate-800 dark:text-slate-200"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog: Bulk Marking */}
      <ConfirmationDialog
        isOpen={isBulkConfirmOpen}
        onClose={() => setIsBulkConfirmOpen(false)}
        onConfirm={handleApplyBulkConfirm}
        title="Apply Bulk Attendance Status"
        message={`Are you sure you want to mark all ${enrollments.length} students as "${bulkStatusToApply}" for ${date}? You can still adjust individual rows before saving.`}
        confirmText={`Set All to ${bulkStatusToApply}`}
        variant="primary"
      />
    </div>
  );
};
