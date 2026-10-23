import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MAIN_NAV_ITEMS, STUDENT_NAV_ITEMS } from '@/config/constants';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
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
  Receipt,
  FileSpreadsheet,
  Award,
  FileDown,
  ShieldAlert,
  Sliders,
  UserCog,
  Search,
  CreditCard,
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

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const { settings } = useSchool();
  const location = useLocation();

  if (!isOpen) return null;

  const allowedNavItems =
    role === 'student'
      ? STUDENT_NAV_ITEMS
      : MAIN_NAV_ITEMS.filter((item) => {
          if (role === 'teacher' && item.adminOnly) return false;
          return true;
        });

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-navy-950 text-white shadow-xl flex flex-col z-10 border-r border-navy-900">
        <div className="h-16 flex items-center justify-between px-4 border-b border-navy-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-sm">
              IPS
            </div>
            <span className="text-sm font-bold truncate">{settings.school_name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-navy-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
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
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors',
                    isActive || isDashboardActive
                      ? 'bg-brand-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-navy-900 hover:text-white'
                  )
                }
              >
                {iconMap[item.iconName]}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
};
