import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSchool } from '@/context/SchoolContext';
import { isLiveSupabaseConfigured } from '@/config/supabase';
import { Menu, Sun, Moon, LogOut, Calendar, Search, Bell, Megaphone, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { announcementApi } from '@/services/api';
import { SchoolAnnouncement } from '@/types/database';
import { formatDate } from '@/lib/utils';

export interface HeaderProps {
  onToggleMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { sessions, selectedSessionId, setSelectedSessionId } = useSchool();

  const [notifications, setNotifications] = useState<SchoolAnnouncement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const items = await announcementApi.getAnnouncements(
        { status: 'published' },
        { id: user.id, role, email: user.email }
      );
      setNotifications(items.slice(0, 5));
      setUnreadCount(items.filter((a) => !a.is_read).length);
    } catch (e) {
      // non-blocking
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id, role]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    if (!user) return;
    for (const n of notifications) {
      if (!n.is_read) {
        await announcementApi.markAsRead(n.id, user.id);
      }
    }
    await loadNotifications();
  };

  const handleOpenNotice = async (n: SchoolAnnouncement) => {
    if (user && !n.is_read) {
      await announcementApi.markAsRead(n.id, user.id);
    }
    setIsNotifOpen(false);
    navigate(role === 'student' ? '/my-announcements' : '/events-announcements');
  };

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

      {/* Right: Theme Toggle & Authenticated User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Persistence Mode Indicator */}
        {isLiveSupabaseConfigured() ? (
          <button
            onClick={() => role === 'admin' && navigate('/server-database')}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full transition-colors ${role === 'admin' ? 'hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer' : 'cursor-default'}`}
            title={role === 'admin' ? 'Click to inspect Server & Database Health' : 'Connected to Supabase Cloud Database'}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cloud Live</span>
          </button>
        ) : (
          <button
            onClick={() => role === 'admin' && navigate('/server-database')}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-full transition-colors ${role === 'admin' ? 'hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer' : 'cursor-default'}`}
            title={role === 'admin' ? 'Click to inspect Server & Database Connection' : 'Running in Local Development Mode (Offline Storage)'}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Local Storage</span>
          </button>
        )}

        {/* Quick Search Shortcut */}
        <button
          onClick={() => navigate('/quick-search')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors focus:outline-none cursor-pointer"
          title="Student Quick Search & Academic Performance"
        >
          <Search className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span className="hidden md:inline">Quick Search</span>
        </button>

        {/* Notifications Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none relative"
            title="School Notices & Announcements"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute 1.5 top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">School Notices</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active announcements found.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleOpenNotice(n)}
                      className={`p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                        !n.is_read ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {n.content}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                        <span className="capitalize">{n.category}</span>
                        <span>{formatDate(n.publish_date)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center">
                <button
                  onClick={() => {
                    setIsNotifOpen(false);
                    navigate(role === 'student' ? '/my-announcements' : '/events-announcements');
                  }}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  View All Events & Announcements &rarr;
                </button>
              </div>
            </div>
          )}
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
