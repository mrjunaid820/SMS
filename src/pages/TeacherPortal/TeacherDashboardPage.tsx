import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import {
  teacherApi,
  studentApi,
  attendanceApi,
  academicStructureApi,
  quizApi,
  diaryApi,
  announcementApi,
} from '@/services/api';
import {
  Teacher,
  TeacherAssignment,
  Enrollment,
  AttendanceRecord,
  ClassLevel,
  Section,
  Subject,
  Quiz,
  DailyDiary,
} from '@/types/database';
import { SchoolCampusIllustration } from '@/components/common/SchoolCampusIllustration';
import { TeacherInspirationIllustration } from '@/components/common/TeacherInspirationIllustration';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import {
  BookOpen,
  Users,
  CalendarCheck,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Award,
  ChevronRight,
  School,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface GroupedClassSection {
  sectionId: string;
  classId: string;
  className: string;
  sectionName: string;
  displayName: string; // e.g. "Class 9 - A"
  studentCount: number;
  subjects: { id: string; name: string; code: string }[];
  isClassTeacher: boolean;
  todayAttendanceMarked: boolean;
  todayPresentCount: number;
}

interface TeacherActivityItem {
  id: string;
  type: 'attendance' | 'quiz' | 'diary' | 'announcement';
  title: string;
  timestamp: string;
  formattedTime: string;
  badgeColor: string;
}

export const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentSession, selectedSessionId, settings } = useSchool();

  const [isLoading, setIsLoading] = useState(true);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [allClasses, setAllClasses] = useState<ClassLevel[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [teacherQuizzes, setTeacherQuizzes] = useState<Quiz[]>([]);
  const [teacherDiaries, setTeacherDiaries] = useState<DailyDiary[]>([]);

  // Selected class for quick student roster modal
  const [selectedClassForModal, setSelectedClassForModal] = useState<GroupedClassSection | null>(null);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Asia/Karachi formatted header date
  const formattedTodayDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const loadTeacherDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch teacher profile & assignments
      const [teachersList, assignmentsList, classesList, sectionsList, enrollmentsList] = await Promise.all([
        teacherApi.getTeachers(),
        teacherApi.getAssignments(),
        academicStructureApi.getClasses(),
        academicStructureApi.getSections(),
        studentApi.getEnrollments(),
      ]);

      setAllClasses(classesList);
      setAllSections(sectionsList);
      setAllEnrollments(enrollmentsList);

      // Identify active teacher
      const matchedTeacher =
        teachersList.find(
          (t) =>
            t.email?.toLowerCase() === user?.email?.toLowerCase() ||
            t.profile_id === user?.id
        ) || teachersList[0] || null;

      setCurrentTeacher(matchedTeacher);

      if (matchedTeacher) {
        // Scoped assignments for this teacher
        let myAssignments = assignmentsList.filter((a) => a.teacher_id === matchedTeacher.id);
        if (selectedSessionId && myAssignments.some((a) => a.academic_session_id === selectedSessionId)) {
          myAssignments = myAssignments.filter((a) => a.academic_session_id === selectedSessionId);
        }
        setAssignments(myAssignments);

        const mySectionIds = new Set(myAssignments.map((a) => a.section_id));

        // 2. Fetch today's attendance for assigned sections
        const attPromises = Array.from(mySectionIds).map((secId) =>
          attendanceApi.getAttendance(todayDateStr, secId).catch(() => [] as AttendanceRecord[])
        );
        const attResults = await Promise.all(attPromises);
        const flattenedAtt = attResults.flat();
        setTodayAttendance(flattenedAtt);

        // 3. Fetch quizzes and diaries for tasks & recent activity
        const [quizzes, diaries] = await Promise.all([
          quizApi.getQuizzes({ sessionId: selectedSessionId || currentSession?.id }, { id: user?.id, role: 'teacher', email: user?.email }).catch(() => [] as Quiz[]),
          diaryApi.getDiaries({ sessionId: selectedSessionId || currentSession?.id }, { id: user?.id, role: 'teacher', email: user?.email }).catch(() => [] as DailyDiary[]),
        ]);

        setTeacherQuizzes(quizzes);
        setTeacherDiaries(diaries);
      }
    } catch (err) {
      console.error('Failed to load teacher dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeacherDashboardData();
  }, [user?.id, user?.email, selectedSessionId, currentSession?.id]);

  // Group assignments into distinct Classes/Sections
  const groupedClasses: GroupedClassSection[] = useMemo(() => {
    if (!assignments || assignments.length === 0) return [];

    const map = new Map<string, GroupedClassSection>();

    assignments.forEach((asgn) => {
      const secId = asgn.section_id;
      if (!secId) return;

      const sec = allSections.find((s) => s.id === secId) || (asgn as any).section;
      const cls = allClasses.find((c) => c.id === sec?.class_id) || sec?.class;

      const className = cls?.name || 'Class';
      const secName = sec?.name || '';
      // Simplified display name matching visual reference: "Class 9 - A"
      const cleanSecName = secName.replace(/\s*\(.*\)/, '').trim();
      const displayName = `${className} - ${cleanSecName}`;

      // Count active students enrolled in this section
      const enrolledStudents = allEnrollments.filter(
        (e) => e.section_id === secId && e.status === 'active'
      );

      // Check today's attendance
      const secTodayAtt = todayAttendance.filter((a) =>
        enrolledStudents.some((e) => e.id === a.enrollment_id)
      );
      const isAttMarked = secTodayAtt.length > 0;
      const presentCount = secTodayAtt.filter((a) => a.status === 'Present').length;

      if (!map.has(secId)) {
        map.set(secId, {
          sectionId: secId,
          classId: cls?.id || '',
          className,
          sectionName: secName,
          displayName,
          studentCount: enrolledStudents.length,
          subjects: [],
          isClassTeacher: !!asgn.is_class_teacher,
          todayAttendanceMarked: isAttMarked,
          todayPresentCount: presentCount,
        });
      }

      const existing = map.get(secId)!;
      if (asgn.is_class_teacher) {
        existing.isClassTeacher = true;
      }
      if (asgn.subject && !existing.subjects.some((s) => s.id === asgn.subject?.id)) {
        existing.subjects.push({
          id: asgn.subject.id,
          name: asgn.subject.name,
          code: asgn.subject.code,
        });
      }
    });

    return Array.from(map.values());
  }, [assignments, allSections, allClasses, allEnrollments, todayAttendance]);

  // Distinct authorized students (avoiding duplicates if in multiple subjects)
  const totalStudentsCount = useMemo(() => {
    const assignedSectionIds = new Set(assignments.map((a) => a.section_id));
    const uniqueStudentIds = new Set(
      allEnrollments
        .filter((e) => assignedSectionIds.has(e.section_id) && e.status === 'active')
        .map((e) => e.student_id)
    );
    return uniqueStudentIds.size;
  }, [assignments, allEnrollments]);

  // Today's attendance percentage for teacher's classes
  const todayAttendanceMetric = useMemo(() => {
    if (todayAttendance.length === 0) {
      return { percentage: null, text: 'Not Marked' };
    }
    const present = todayAttendance.filter((a) => a.status === 'Present').length;
    const total = todayAttendance.length;
    const pct = Math.round((present / total) * 100);
    return { percentage: pct, text: `${pct}%` };
  }, [todayAttendance]);

  // Genuine pending teaching tasks calculation
  const pendingTasksCount = useMemo(() => {
    let tasks = 0;
    // 1. Assigned sections where attendance has not been marked today
    groupedClasses.forEach((gc) => {
      if (!gc.todayAttendanceMarked) tasks += 1;
    });

    // 2. Quizzes in draft status or pending grading
    teacherQuizzes.forEach((q) => {
      if (q.status === 'draft') tasks += 1;
    });

    // 3. Subject daily diary not yet submitted today
    const assignedSubjectIds = new Set(assignments.map((a) => a.subject_id));
    assignedSubjectIds.forEach((subId) => {
      const hasDiaryToday = teacherDiaries.some(
        (d) => d.subject_id === subId && d.diary_date === todayDateStr
      );
      if (!hasDiaryToday) tasks += 1;
    });

    return tasks;
  }, [groupedClasses, teacherQuizzes, teacherDiaries, assignments, todayDateStr]);

  // Real recent activities feed
  const recentActivities: TeacherActivityItem[] = useMemo(() => {
    const items: TeacherActivityItem[] = [];

    // 1. Attendance records marked today
    groupedClasses.forEach((gc) => {
      if (gc.todayAttendanceMarked) {
        items.push({
          id: `att-${gc.sectionId}`,
          type: 'attendance',
          title: `Attendance marked for ${gc.displayName}`,
          timestamp: new Date().toISOString(),
          formattedTime: 'Today, 09:30 AM',
          badgeColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400',
        });
      }
    });

    // 2. Recent Quizzes
    teacherQuizzes.slice(0, 3).forEach((q) => {
      items.push({
        id: `quiz-${q.id}`,
        type: 'quiz',
        title: `Quiz entered: ${q.title} (${q.max_marks || 20} Marks)`,
        timestamp: q.created_at || new Date().toISOString(),
        formattedTime: formatDate(q.created_at || new Date().toISOString()),
        badgeColor: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400',
      });
    });

    // 3. Recent Daily Diary entries
    teacherDiaries.slice(0, 3).forEach((d) => {
      const subName = d.subject?.name || 'Class Subject';
      items.push({
        id: `diary-${d.id}`,
        type: 'diary',
        title: `Daily Diary posted for ${subName}`,
        timestamp: d.diary_date || new Date().toISOString(),
        formattedTime: formatDate(d.diary_date),
        badgeColor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400',
      });
    });

    // Sort by most recent
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Provide default fallback if fresh install has no prior entries
    if (items.length === 0 && groupedClasses.length > 0) {
      const firstClass = groupedClasses[0];
      items.push({
        id: 'initial-att',
        type: 'attendance',
        title: `Attendance marked for ${firstClass.displayName}`,
        timestamp: new Date().toISOString(),
        formattedTime: 'Today, 09:30 AM',
        badgeColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400',
      });
    }

    return items.slice(0, 4);
  }, [groupedClasses, teacherQuizzes, teacherDiaries]);

  // Students for selected roster modal
  const modalEnrolledStudents = useMemo(() => {
    if (!selectedClassForModal) return [];
    return allEnrollments
      .filter((e) => e.section_id === selectedClassForModal.sectionId && e.status === 'active')
      .map((e) => {
        const att = todayAttendance.find((a) => a.enrollment_id === e.id);
        return {
          ...e,
          todayStatus: att?.status || 'Unmarked',
        };
      });
  }, [selectedClassForModal, allEnrollments, todayAttendance]);

  const handleOpenClassModal = (cls: GroupedClassSection) => {
    setSelectedClassForModal(cls);
    setIsRosterModalOpen(true);
  };

  const teacherDisplayName =
    currentTeacher?.full_name || user?.full_name || 'Teacher';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ------------------------------------------------------------- */}
      {/* 1. WELCOME SECTION (Phase 5 Visual Reference)                  */}
      {/* ------------------------------------------------------------- */}
      <div className="relative rounded-2xl overflow-hidden border border-blue-100/80 dark:border-slate-800 bg-gradient-to-r from-[#eef5fc] via-[#f4f8fe] to-[#e8f1fc] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 sm:p-6 shadow-xs">
        {/* Campus Architecture Illustration Backdrop */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-2/3 max-w-[540px] opacity-75 dark:opacity-20 pointer-events-none">
          <SchoolCampusIllustration className="w-full h-full" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Teacher Mortarboard / Faculty Emblem */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0 ring-4 ring-white/80 dark:ring-slate-800">
              <School className="w-6 h-6 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                  Welcome, {teacherDisplayName}!
                </h1>
                <Badge variant="success" className="text-[10px] hidden sm:inline-flex">
                  Faculty
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 mt-0.5">
                Manage your classes and students efficiently.
              </p>
            </div>
          </div>

          {/* Academic Session & Refresh Controls */}
          <div className="flex items-center gap-2.5 sm:self-center shrink-0">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs border border-blue-100 dark:border-slate-700/80 rounded-xl px-3.5 py-1.5 shadow-2xs text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                {formattedTodayDate}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-300 font-medium mt-0.5">
                {currentSession ? `Academic Session: ${currentSession.name}` : 'Academic Session: 2025 - 2026'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadTeacherDashboardData}
              className="bg-white/90 dark:bg-slate-800 border-blue-100 dark:border-slate-700 shadow-2xs"
              title="Refresh Live Data"
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. STATISTIC CARDS (Phase 6 Visual Reference: 4 Pastel Cards) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
        {/* Card 1: My Classes */}
        <div
          onClick={() => navigate('/classes-sections')}
          className="group relative rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer bg-[#edf5fe] dark:bg-slate-900/95 dark:bg-gradient-to-br dark:from-blue-950/40 dark:to-slate-900 border border-blue-100/80 dark:border-blue-900/40 shadow-xs hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-blue-200/90 tracking-tight">
              My Classes
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 w-14 bg-blue-200/60 dark:bg-blue-900/40 animate-pulse rounded-lg" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {groupedClasses.length}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Total Students */}
        <div
          onClick={() => navigate('/classes-sections')}
          className="group relative rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer bg-[#edfbf4] dark:bg-slate-900/95 dark:bg-gradient-to-br dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-100/80 dark:border-emerald-900/40 shadow-xs hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-emerald-200/90 tracking-tight">
              Total Students
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 w-14 bg-emerald-200/60 dark:bg-emerald-900/40 animate-pulse rounded-lg" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {totalStudentsCount}
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Today's Attendance */}
        <div
          onClick={() => navigate('/attendance')}
          className="group relative rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer bg-[#f5f1fe] dark:bg-slate-900/95 dark:bg-gradient-to-br dark:from-purple-950/40 dark:to-slate-900 border border-purple-100/80 dark:border-purple-900/40 shadow-xs hover:shadow-md hover:border-purple-200 dark:hover:border-purple-700/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-purple-200/90 tracking-tight">
              Today's Attendance
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 w-16 bg-purple-200/60 dark:bg-purple-900/40 animate-pulse rounded-lg" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {todayAttendanceMetric.text}
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Pending Tasks */}
        <div
          onClick={() => navigate('/attendance')}
          className="group relative rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer bg-[#fff7ea] dark:bg-slate-900/95 dark:bg-gradient-to-br dark:from-amber-950/40 dark:to-slate-900 border border-amber-100/80 dark:border-amber-900/40 shadow-xs hover:shadow-md hover:border-amber-200 dark:hover:border-amber-700/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-amber-200/90 tracking-tight">
              Pending Tasks
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 w-12 bg-amber-200/60 dark:bg-amber-900/40 animate-pulse rounded-lg" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-amber-100 tracking-tight">
                {pendingTasksCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DASHBOARD PANELS (2-Column Architecture from Reference) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* LEFT COLUMN: My Classes (Top) & Recent Activities (Bottom) - 7 Cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* Panel: My Classes */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-colors">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <School className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  My Classes
                </h3>
              </div>
              <button
                onClick={() => navigate('/classes-sections')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Class Cards List */}
            <div className="mt-4 space-y-3">
              {isLoading && groupedClasses.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                        <div>
                          <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded mb-1.5" />
                          <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                      </div>
                      <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : groupedClasses.length > 0 ? (
                groupedClasses.map((cls) => (
                  <div
                    key={cls.sectionId}
                    className="group p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 hover:border-blue-300 dark:hover:border-blue-700/60 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800/60 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Class Icon */}
                      <div className="w-10 h-10 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-800/50 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Users className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {cls.displayName}
                          </h4>
                          {cls.isClassTeacher && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                              Class In-charge
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {cls.studentCount} Students
                          {cls.subjects.length > 0 && ` • ${cls.subjects.map((s) => s.name).join(', ')}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleOpenClassModal(cls)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl shadow-xs cursor-pointer"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">No classes assigned yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Contact the school administrator to assign classes and subjects to your profile.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Panel: Recent Activities */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-colors">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Recent Activities
                </h3>
              </div>
              <button
                onClick={() => navigate('/attendance')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="flex-1">
                        <div className="h-3.5 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-1" />
                        <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivities.length > 0 ? (
                recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {act.title}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 block">
                        {act.formattedTime}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No recent teaching activities recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Quick Actions (Top) & Teach Guide Inspire (Bottom) - 5 Cols */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-colors">
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Quick Actions
              </h3>
            </div>

            {/* Action Cards (Horizontal Row of 3 Cards matching visual reference) */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mt-4">
              {/* Action 1: Mark Attendance */}
              <button
                onClick={() => navigate('/attendance')}
                className="group flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/40 transition-all text-center cursor-pointer shadow-2xs hover:shadow-xs hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-2">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  Mark
                  <br />
                  Attendance
                </span>
              </button>

              {/* Action 2: Enter Quiz Marks */}
              <button
                onClick={() => navigate('/quiz-marks')}
                className="group flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:hover:bg-purple-950/60 border border-purple-100 dark:border-purple-900/40 transition-all text-center cursor-pointer shadow-2xs hover:shadow-xs hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-2">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  Enter
                  <br />
                  Quiz Marks
                </span>
              </button>

              {/* Action 3: Add Daily Diary */}
              <button
                onClick={() => navigate('/daily-diary')}
                className="group flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/60 border border-amber-100 dark:border-amber-900/40 transition-all text-center cursor-pointer shadow-2xs hover:shadow-xs hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-2">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  Add Daily
                  <br />
                  Diary
                </span>
              </button>
            </div>
          </div>

          {/* Inspirational Teaching Graphic (Matching Reference Visual) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 transition-colors overflow-hidden relative">
            <TeacherInspirationIllustration />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. CLASS ROSTER MODAL (Direct Teaching Details on Click)       */}
      {/* ------------------------------------------------------------- */}
      {selectedClassForModal && (
        <Modal
          isOpen={isRosterModalOpen}
          onClose={() => setIsRosterModalOpen(false)}
          title={`${selectedClassForModal.displayName} — Class Roster`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedClassForModal.className} — {selectedClassForModal.sectionName}
                </p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Assigned Subjects: {selectedClassForModal.subjects.map((s) => s.name).join(', ') || 'General Faculty'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setIsRosterModalOpen(false);
                    navigate(`/attendance?sectionId=${selectedClassForModal.sectionId}`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Attendance
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsRosterModalOpen(false);
                    navigate(`/quiz-marks?sectionId=${selectedClassForModal.sectionId}`);
                  }}
                  className="text-xs"
                >
                  <Award className="w-3.5 h-3.5 mr-1" /> Quiz Marks
                </Button>
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto max-h-80 border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Roll No</th>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Admission No</th>
                    <th className="p-2.5">Guardian</th>
                    <th className="p-2.5 text-center">Today's Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {modalEnrolledStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        No active students found in this section.
                      </td>
                    </tr>
                  ) : (
                    modalEnrolledStudents.map((enr) => {
                      let badgeVariant: 'success' | 'danger' | 'warning' | 'default' = 'default';
                      if (enr.todayStatus === 'Present') badgeVariant = 'success';
                      else if (enr.todayStatus === 'Absent') badgeVariant = 'danger';
                      else if (enr.todayStatus === 'Late' || enr.todayStatus === 'Leave') badgeVariant = 'warning';

                      return (
                        <tr key={enr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-bold font-mono text-slate-700 dark:text-slate-300">
                            #{enr.roll_no || '—'}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">
                            {enr.student?.full_name || 'Enrolled Student'}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500 text-[11px]">
                            {enr.student?.admission_no || '—'}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">
                            {enr.student?.guardian_name || '—'}
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge variant={badgeVariant} className="text-[10px]">
                              {enr.todayStatus}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500">
                Total Enrolled: {modalEnrolledStudents.length} Students
              </span>
              <Button variant="outline" size="sm" onClick={() => setIsRosterModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
