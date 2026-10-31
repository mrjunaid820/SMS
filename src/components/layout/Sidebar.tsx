import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MAIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '@/config/constants';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { SchoolEmblem } from '@/components/common/SchoolEmblem';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  CalendarRange,
  School,
  BookOpen,
  UserCheck,
  ClipboardCheck,
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Activity,
  CalendarCheck,
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

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse, className }) => {
  const { role, logout } = useAuth();
  const { settings } = useSchool();
  const location = useLocation();

  // Accordion open states for Admin navigation groups
  const [isAcademicOpen, setIsAcademicOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auto-expand group if current path is a sub-route
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

  const isAcademicActive = ['/students', '/teachers', '/classes-sections', '/subjects', '/teacher-assignments', '/quiz-marks', '/daily-diary'].includes(location.pathname);
  const isExamActive = ['/examinations', '/results-report-cards'].includes(location.pathname);
  const isCommActive = ['/events-announcements'].includes(location.pathname);
  const isSettingsActive = ['/school-settings', '/academic-sessions', '/quick-search', '/audit-logs', '/users-roles', '/server-database'].includes(location.pathname);
  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/admin-dashboard' || location.pathname === '/teacher-dashboard';

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-[#0c1831] text-slate-300 border-r border-[#152549] transition-all duration-300 relative select-none z-30 shrink-0 no-print',
        isCollapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Brand Header with School Crest */}
      <div className={cn(
        'flex flex-col items-center justify-center border-b border-[#152549] bg-[#0c1831]/95 transition-all duration-300 relative',
        isCollapsed ? 'py-4 px-2' : 'py-5 px-4'
      )}>
        {/* School Crest / Emblem */}
        <div className="flex flex-col items-center text-center">
          <SchoolEmblem
            size={isCollapsed ? 38 : 52}
            logoUrl={settings.logo_url}
            schoolName={settings.school_name}
            className="transition-transform duration-200 hover:scale-105"
          />
          {!isCollapsed && (
            <div className="mt-2 text-center">
              <h1 className="text-sm font-bold text-white tracking-tight leading-snug line-clamp-2">
                {settings.school_name || 'Islamia Public High School'}
              </h1>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="absolute top-3 right-2 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/60 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation Links Area */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
        {role === 'admin' ? (
          <>
            {/* 1. Dashboard */}
            <NavLink
              to="/admin-dashboard"
              title={isCollapsed ? 'Dashboard' : undefined}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group',
                isDashboardActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                isCollapsed && 'justify-center px-0'
              )}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Dashboard</span>}
            </NavLink>

            {/* 2. Academic (Expandable Group) */}
            <div>
              <button
                type="button"
                onClick={() => !isCollapsed && setIsAcademicOpen(!isAcademicOpen)}
                title={isCollapsed ? 'Academic' : undefined}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer',
                  isAcademicActive && !isAcademicOpen
                    ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                    : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 shrink-0 text-blue-400" />
                  {!isCollapsed && <span>Academic</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                      !isAcademicOpen && '-rotate-90'
                    )}
                  />
                )}
              </button>

              {/* Sub-menu */}
              {isAcademicOpen && !isCollapsed && (
                <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                  <NavLink
                    to="/students"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Students</span>
                  </NavLink>
                  <NavLink
                    to="/teachers"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Teachers</span>
                  </NavLink>
                  <NavLink
                    to="/classes-sections"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>Classes & Sections</span>
                  </NavLink>
                  <NavLink
                    to="/subjects"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Subjects</span>
                  </NavLink>
                  <NavLink
                    to="/teacher-assignments"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Teacher Assignments</span>
                  </NavLink>
                  <NavLink
                    to="/quiz-marks"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Quiz Marks</span>
                  </NavLink>
                  <NavLink
                    to="/daily-diary"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Daily Diary</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* 3. Attendance */}
            <NavLink
              to="/attendance"
              title={isCollapsed ? 'Attendance' : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )
              }
            >
              <CalendarCheck className="w-4 h-4 shrink-0 text-purple-400" />
              {!isCollapsed && <span className="truncate">Attendance</span>}
            </NavLink>

            {/* 4. Fees */}
            <NavLink
              to="/fees-accounts"
              title={isCollapsed ? 'Fees & Accounts' : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )
              }
            >
              <Receipt className="w-4 h-4 shrink-0 text-emerald-400" />
              {!isCollapsed && <span className="truncate">Fees</span>}
            </NavLink>

            {/* 5. Examinations (Expandable Group) */}
            <div>
              <button
                type="button"
                onClick={() => !isCollapsed && setIsExamOpen(!isExamOpen)}
                title={isCollapsed ? 'Examinations' : undefined}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer',
                  isExamActive && !isExamOpen
                    ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                    : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-amber-400" />
                  {!isCollapsed && <span>Examinations</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                      !isExamOpen && '-rotate-90'
                    )}
                  />
                )}
              </button>

              {/* Sub-menu */}
              {isExamOpen && !isCollapsed && (
                <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                  <NavLink
                    to="/examinations"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exams Schedule</span>
                  </NavLink>
                  <NavLink
                    to="/results-report-cards"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Results & Report Cards</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* 6. Communication (Expandable Group) */}
            <div>
              <button
                type="button"
                onClick={() => !isCollapsed && setIsCommOpen(!isCommOpen)}
                title={isCollapsed ? 'Communication' : undefined}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer',
                  isCommActive && !isCommOpen
                    ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                    : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <div className="flex items-center gap-3">
                  <Megaphone className="w-4 h-4 shrink-0 text-rose-400" />
                  {!isCollapsed && <span>Communication</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                      !isCommOpen && '-rotate-90'
                    )}
                  />
                )}
              </button>

              {/* Sub-menu */}
              {isCommOpen && !isCollapsed && (
                <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                  <NavLink
                    to="/events-announcements"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>Events & Notices</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* 7. Reports */}
            <NavLink
              to="/reports-exports"
              title={isCollapsed ? 'Reports' : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )
              }
            >
              <FileDown className="w-4 h-4 shrink-0 text-cyan-400" />
              {!isCollapsed && <span className="truncate">Reports</span>}
            </NavLink>

            {/* 8. Settings (Expandable Group) */}
            <div>
              <button
                type="button"
                onClick={() => !isCollapsed && setIsSettingsOpen(!isSettingsOpen)}
                title={isCollapsed ? 'Settings' : undefined}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer',
                  isSettingsActive && !isSettingsOpen
                    ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                    : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 shrink-0 text-slate-400" />
                  {!isCollapsed && <span>Settings</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                      !isSettingsOpen && '-rotate-90'
                    )}
                  />
                )}
              </button>

              {/* Sub-menu */}
              {isSettingsOpen && !isCollapsed && (
                <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                  <NavLink
                    to="/school-settings"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>School Settings</span>
                  </NavLink>
                  <NavLink
                    to="/academic-sessions"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span>Academic Sessions</span>
                  </NavLink>
                  <NavLink
                    to="/quick-search"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Quick Search</span>
                  </NavLink>
                  <NavLink
                    to="/audit-logs"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Audit Logs</span>
                  </NavLink>
                  <NavLink
                    to="/users-roles"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    <span>User Accounts</span>
                  </NavLink>
                  <NavLink
                    to="/server-database"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#142346]/80'
                      )
                    }
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Server & Database</span>
                  </NavLink>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Teacher / Student Navigation */
          (role === 'student'
            ? STUDENT_NAV_ITEMS
            : MAIN_NAV_ITEMS.filter((item) => (role === 'teacher' ? !item.adminOnly : true))
          ).map((item) => {
            const targetPath =
              item.id === 'dashboard'
                ? role === 'teacher'
                  ? '/teacher-dashboard'
                  : '/admin-dashboard'
                : item.path;
            const isItemDashboardActive =
              item.id === 'dashboard' &&
              (location.pathname === '/dashboard' ||
                location.pathname === '/admin-dashboard' ||
                location.pathname === '/teacher-dashboard');

            return (
              <NavLink
                key={item.id}
                to={targetPath}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group',
                    isActive || isItemDashboardActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-[#142346] hover:text-white',
                    isCollapsed && 'justify-center px-0'
                  )
                }
              >
                {iconMap[item.iconName] || <LayoutDashboard className="w-4 h-4 shrink-0" />}
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })
        )}
      </div>

      {/* Logout Action at Bottom (Red) */}
      <div className="p-3 border-t border-[#152549] bg-[#0c1831]/80">
        <button
          onClick={logout}
          title={isCollapsed ? 'Logout' : undefined}
          className={cn(
            'flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer',
            isCollapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
