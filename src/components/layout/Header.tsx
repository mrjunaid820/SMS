import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSchool } from '@/context/SchoolContext';
import { Menu, Sun, Moon, LogOut, Calendar, ShieldCheck, UserCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';

export interface HeaderProps {
  onToggleMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const { user, role, logout, switchUserRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { sessions, selectedSessionId, setSelectedSessionId } = useSchool();

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-20 shrink-0 no-print">
      {/* Left: Mobile Toggle & Session Picker */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Academic Session Selector */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">Session:</span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
          >
            {sessions.map((ses) => (
              <option key={ses.id} value={ses.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {ses.name} {ses.is_current ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Role Switcher Demo, Theme Toggle, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role Switch Pill (Admin vs Teacher preview) */}
        <div className="hidden lg:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => switchUserRole('admin')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              role === 'admin'
                ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>Admin</span>
          </button>
          <button
            onClick={() => switchUserRole('teacher')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              role === 'teacher'
                ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Teacher</span>
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900"
          aria-label="Toggle dark mode"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-navy-800 dark:bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            {user?.full_name ? user.full_name[0] : 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[120px]">
              {user?.full_name || 'User'}
            </p>
            <p className="text-[10px] text-slate-400 capitalize">{role}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
