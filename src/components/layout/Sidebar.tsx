import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MAIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '@/config/constants';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
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
  ChevronLeft,
  ChevronRight,
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
  Receipt: <Receipt className="w-4 h-4 shrink-0" />,
  FileSpreadsheet: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
  Award: <Award className="w-4 h-4 shrink-0" />,
  FileDown: <FileDown className="w-4 h-4 shrink-0" />,
  CreditCard: <CreditCard className="w-4 h-4 shrink-0" />,
  ShieldAlert: <ShieldAlert className="w-4 h-4 shrink-0" />,
  Sliders: <Sliders className="w-4 h-4 shrink-0" />,
  UserCog: <UserCog className="w-4 h-4 shrink-0" />,
};

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse, className }) => {
  const { role } = useAuth();
  const { settings, currentSession } = useSchool();

  // Filter items based on user role (Admin vs Teacher vs Student)
  const allowedNavItems =
    role === 'student'
      ? STUDENT_NAV_ITEMS
      : MAIN_NAV_ITEMS.filter((item) => {
          if (role === 'teacher' && item.adminOnly) return false;
          return true;
        });

  const location = useLocation();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-navy-950 text-slate-300 border-r border-slate-800 transition-all duration-300 relative select-none z-30 shrink-0 no-print',
        isCollapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-navy-900 bg-navy-950/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
            IPS
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <h1 className="text-sm font-bold text-white tracking-tight truncate">
                {settings.school_name || 'Islamia Public'}
              </h1>
              <p className="text-[11px] text-brand-300 font-medium">
                {currentSession ? `Session ${currentSession.name}` : 'School ERP'}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-navy-800 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {allowedNavItems.map((item) => {
          const targetPath =
            item.id === 'dashboard'
              ? role === 'teacher'
                ? '/teacher-dashboard'
                : '/admin-dashboard'
              : item.path;
          const isDashboardActive =
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group',
                  isActive || isDashboardActive
                    ? 'bg-brand-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-navy-900 hover:text-white',
                  isCollapsed && 'justify-center px-0'
                )
              }
            >
              {iconMap[item.iconName]}
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* Role Indicator Footer */}
      <div className="p-3 border-t border-navy-900 bg-navy-900/40">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Access Scope</p>
              <p className="text-xs font-semibold text-white capitalize">{role} Portal</p>
            </div>
            <span
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider',
                role === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : role === 'teacher'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              )}
            >
              {role}
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                role === 'admin'
                  ? 'bg-amber-500/20 text-amber-300'
                  : role === 'teacher'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-indigo-500/20 text-indigo-300'
              )}
              title={`Logged in as ${role}`}
            >
              {role === 'admin' ? 'ADM' : role === 'teacher' ? 'TCH' : 'STU'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
