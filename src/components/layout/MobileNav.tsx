import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MAIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '@/config/constants';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { SchoolEmblem } from '@/components/common/SchoolEmblem';
import {
  X,
  LayoutDashboard,
  GraduationCap,
  Users,
  CalendarRange,
  School,
  BookOpen,
  UserCheck,
  ClipboardCheck,
  CalendarCheck,
  Receipt,
  FileSpreadsheet,
  Award,
  FileDown,
  ShieldAlert,
  Sliders,
  UserCog,
  Search,
  CreditCard,
  Megaphone,
  ChevronDown,
  LogOut,
  Activity,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4 shrink-0" />,
  Search: <Search className="w-4 h-4 shrink-0" />,
  GraduationCap: <GraduationCap className="w-4 h-4 shrink-0" />,
  Users: <Users className="w-4 h-4 shrink-0" />,
  CalendarRange: <CalendarRange className="w-4 h-4 shrink-0" />,
  School: <School className="w-4 h-4 shrink-0" />,
  BookOpen: <BookOpen className="w-4 h-4 shrink-0" />,
  UserCheck: <UserCheck className="w-4 h-4 shrink-0" />,
  ClipboardCheck: <ClipboardCheck className="w-4 h-4 shrink-0" />,
  CalendarCheck: <CalendarCheck className="w-4 h-4 shrink-0" />,
  Receipt: <Receipt className="w-4 h-4 shrink-0" />,
  FileSpreadsheet: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
  Award: <Award className="w-4 h-4 shrink-0" />,
  FileDown: <FileDown className="w-4 h-4 shrink-0" />,
  CreditCard: <CreditCard className="w-4 h-4 shrink-0" />,
  ShieldAlert: <ShieldAlert className="w-4 h-4 shrink-0" />,
  Sliders: <Sliders className="w-4 h-4 shrink-0" />,
  UserCog: <UserCog className="w-4 h-4 shrink-0" />,
  Megaphone: <Megaphone className="w-4 h-4 shrink-0" />,
  Activity: <Activity className="w-4 h-4 shrink-0" />,
};

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { role, logout } = useAuth();
  const { settings } = useSchool();
  const location = useLocation();

  const [isAcademicOpen, setIsAcademicOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const p = location.pathname;
    if (['/students', '/teachers', '/classes-sections', '/subjects', '/teacher-assignments', '/quiz-marks', '/daily-diary'].includes(p)) {
      setIsAcademicOpen(true);
    }
    if (['/examinations', '/results-report-cards'].includes(p)) {
      setIsExamOpen(true);
    }
    if (['/events-announcements'].includes(p)) {
      setIsCommOpen(true);
    }
    if (['/school-settings', '/academic-sessions', '/quick-search', '/audit-logs', '/users-roles', '/server-database'].includes(p)) {
      setIsSettingsOpen(true);
    }
  }, [location.pathname]);

  if (!isOpen) return null;

  const isAcademicActive = ['/students', '/teachers', '/classes-sections', '/subjects', '/teacher-assignments', '/quiz-marks', '/daily-diary'].includes(location.pathname);
  const isExamActive = ['/examinations', '/results-report-cards'].includes(location.pathname);
  const isCommActive = ['/events-announcements'].includes(location.pathname);
  const isSettingsActive = ['/school-settings', '/academic-sessions', '/quick-search', '/audit-logs', '/users-roles', '/server-database'].includes(location.pathname);
  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/admin-dashboard' || location.pathname === '/teacher-dashboard';

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-[#0c1831] text-white shadow-2xl flex flex-col z-10 border-r border-[#152549]">
        {/* Header */}
        <div className="p-4 border-b border-[#152549] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SchoolEmblem size={36} logoUrl={settings.logo_url} schoolName={settings.school_name} />
            <div className="truncate">
              <h2 className="text-xs font-bold text-white truncate leading-tight">
                {settings.school_name || 'Islamia Public High School'}
              </h2>
              <span className="text-[10px] text-blue-300 font-medium capitalize">{role} Portal</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          {role === 'admin' ? (
            <>
              {/* Dashboard */}
              <NavLink
                to="/admin-dashboard"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors',
                  isDashboardActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-300 hover:bg-[#142346] hover:text-white'
                )}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </NavLink>

              {/* Academic */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsAcademicOpen(!isAcademicOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors',
                    isAcademicActive && !isAcademicOpen
                      ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                      : 'text-slate-300 hover:bg-[#142346] hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 shrink-0 text-blue-400" />
                    <span>Academic</span>
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200', !isAcademicOpen && '-rotate-90')} />
                </button>
                {isAcademicOpen && (
                  <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                    <NavLink to="/students" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <GraduationCap className="w-3.5 h-3.5" /> <span>Students</span>
                    </NavLink>
                    <NavLink to="/teachers" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <Users className="w-3.5 h-3.5" /> <span>Teachers</span>
                    </NavLink>
                    <NavLink to="/classes-sections" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <School className="w-3.5 h-3.5" /> <span>Classes & Sections</span>
                    </NavLink>
                    <NavLink to="/subjects" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <BookOpen className="w-3.5 h-3.5" /> <span>Subjects</span>
                    </NavLink>
                    <NavLink to="/teacher-assignments" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <UserCheck className="w-3.5 h-3.5" /> <span>Teacher Assignments</span>
                    </NavLink>
                    <NavLink to="/quiz-marks" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <Award className="w-3.5 h-3.5" /> <span>Quiz Marks</span>
                    </NavLink>
                    <NavLink to="/daily-diary" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <ClipboardCheck className="w-3.5 h-3.5" /> <span>Daily Diary</span>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* Attendance */}
              <NavLink to="/attendance" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors', isActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-300 hover:bg-[#142346] hover:text-white')}>
                <CalendarCheck className="w-4 h-4 shrink-0 text-purple-400" />
                <span>Attendance</span>
              </NavLink>

              {/* Fees */}
              <NavLink to="/fees-accounts" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors', isActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-300 hover:bg-[#142346] hover:text-white')}>
                <Receipt className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Fees</span>
              </NavLink>

              {/* Examinations */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsExamOpen(!isExamOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors',
                    isExamActive && !isExamOpen ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30' : 'text-slate-300 hover:bg-[#142346] hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Examinations</span>
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200', !isExamOpen && '-rotate-90')} />
                </button>
                {isExamOpen && (
                  <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                    <NavLink to="/examinations" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <FileSpreadsheet className="w-3.5 h-3.5" /> <span>Exams Schedule</span>
                    </NavLink>
                    <NavLink to="/results-report-cards" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <Award className="w-3.5 h-3.5" /> <span>Results & Report Cards</span>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* Communication */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsCommOpen(!isCommOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors',
                    isCommActive && !isCommOpen ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30' : 'text-slate-300 hover:bg-[#142346] hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Megaphone className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Communication</span>
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200', !isCommOpen && '-rotate-90')} />
                </button>
                {isCommOpen && (
                  <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                    <NavLink to="/events-announcements" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <Megaphone className="w-3.5 h-3.5" /> <span>Events & Notices</span>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* Reports */}
              <NavLink to="/reports-exports" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors', isActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-300 hover:bg-[#142346] hover:text-white')}>
                <FileDown className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>Reports</span>
              </NavLink>

              {/* Settings */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors',
                    isSettingsActive && !isSettingsOpen ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30' : 'text-slate-300 hover:bg-[#142346] hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Sliders className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>Settings</span>
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200', !isSettingsOpen && '-rotate-90')} />
                </button>
                {isSettingsOpen && (
                  <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                    <NavLink to="/school-settings" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <Sliders className="w-3.5 h-3.5" /> <span>School Settings</span>
                    </NavLink>
                    <NavLink to="/academic-sessions" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <CalendarRange className="w-3.5 h-3.5" /> <span>Academic Sessions</span>
                    </NavLink>
                    <NavLink to="/quick-search" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <Search className="w-3.5 h-3.5" /> <span>Quick Search</span>
                    </NavLink>
                    <NavLink to="/audit-logs" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <ShieldAlert className="w-3.5 h-3.5" /> <span>Audit Logs</span>
                    </NavLink>
                    <NavLink to="/users-roles" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <UserCog className="w-3.5 h-3.5" /> <span>User Accounts</span>
                    </NavLink>
                    <NavLink to="/server-database" onClick={onClose} className={({ isActive }) => cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white')}>
                      <Activity className="w-3.5 h-3.5" /> <span>Server & Database</span>
                    </NavLink>
                  </div>
                )}
              </div>
            </>
          ) : (
            (role === 'student' ? STUDENT_NAV_ITEMS : MAIN_NAV_ITEMS.filter((i) => !i.adminOnly)).map((item) => (
              <NavLink
                key={item.id}
                to={item.id === 'dashboard' ? (role === 'teacher' ? '/teacher-dashboard' : '/admin-dashboard') : item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors',
                    isActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-300 hover:bg-[#142346] hover:text-white'
                  )
                }
              >
                {iconMap[item.iconName]}
                <span>{item.label}</span>
              </NavLink>
            ))
          )}
        </div>

        {/* Logout at bottom */}
        <div className="p-3 border-t border-[#152549] bg-[#0c1831]">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
