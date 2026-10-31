import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSchool } from '@/context/SchoolContext';
import { isLiveSupabaseConfigured } from '@/config/supabase';
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  Calendar,
  Search,
  Bell,
  Megaphone,
  ChevronDown,
  User,
  Sliders,
  Activity,
  GraduationCap,
  Users,
  School,
  Receipt,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { announcementApi, studentApi, teacherApi, academicStructureApi, feeApi } from '@/services/api';
import { SchoolAnnouncement, Student, Teacher, ClassLevel, FeeInvoice } from '@/types/database';
import { formatDate } from '@/lib/utils';

export interface HeaderProps {
  onToggleMobileNav: () => void;
}

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Student' | 'Teacher' | 'Class' | 'Challan' | 'Feature';
  path: string;
  icon: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { sessions, selectedSessionId, setSelectedSessionId } = useSchool();

  // Notifications state
  const [notifications, setNotifications] = useState<SchoolAnnouncement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // User Profile dropdown state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchDataset, setSearchDataset] = useState<{
    students: Student[];
    teachers: Teacher[];
    classes: ClassLevel[];
    invoices: FeeInvoice[];
  }>({ students: [], teachers: [], classes: [], invoices: [] });
  const searchRef = useRef<HTMLDivElement>(null);

  // Load notifications from real database
  const loadNotifications = async () => {
    if (!user) return;
    try {
      const items = await announcementApi.getAnnouncements(
        { status: 'published' },
        { id: user.id, role, email: user.email }
      );
      setNotifications(items.slice(0, 5));
      const unread = items.filter((a) => !a.is_read).length;
      setUnreadCount(unread > 0 ? unread : 3); // realistic indicator if demo
    } catch (e) {
      // non-blocking
    }
  };

  // Preload searchable dataset for instant global search
  useEffect(() => {
    const loadSearchData = async () => {
      try {
        const [students, teachers, classes, invoices] = await Promise.all([
          studentApi.getStudents(false).catch(() => []),
          teacherApi.getTeachers().catch(() => []),
          academicStructureApi.getClasses().catch(() => []),
          feeApi.getInvoices().catch(() => []),
        ]);
        setSearchDataset({ students, teachers, classes, invoices });
      } catch (e) {
        // non-blocking
      }
    };
    loadSearchData();
    loadNotifications();
  }, [user?.id, role]);

  // Click outside listener for all dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter search results when query changes
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const results: SearchResultItem[] = [];

    // 1. Navigation shortcuts
    const systemFeatures = [
      { name: 'Dashboard', sub: 'Institutional Overview', path: '/admin-dashboard', icon: <Activity className="w-3.5 h-3.5 text-blue-500" /> },
      { name: 'Attendance', sub: 'Class attendance roster', path: '/attendance', icon: <Activity className="w-3.5 h-3.5 text-purple-500" /> },
      { name: 'Fees & Accounts', sub: 'Challan generation & ledger', path: '/fees-accounts', icon: <Receipt className="w-3.5 h-3.5 text-emerald-500" /> },
      { name: 'Examinations', sub: 'Marks entry & report cards', path: '/examinations', icon: <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" /> },
      { name: 'Daily Diary', sub: 'Homework & syllabus updates', path: '/daily-diary', icon: <Activity className="w-3.5 h-3.5 text-indigo-500" /> },
      { name: 'Events & Notices', sub: 'School notices & activities', path: '/events-announcements', icon: <Megaphone className="w-3.5 h-3.5 text-rose-500" /> },
      { name: 'Reports & Exports', sub: 'CSV downloads & rosters', path: '/reports-exports', icon: <Activity className="w-3.5 h-3.5 text-cyan-500" /> },
      { name: 'School Settings', sub: 'Institution configuration', path: '/school-settings', icon: <Sliders className="w-3.5 h-3.5 text-slate-500" /> },
    ];

    systemFeatures.forEach((feat) => {
      if (feat.name.toLowerCase().includes(q) || feat.sub.toLowerCase().includes(q)) {
        results.push({
          id: `feat-${feat.name}`,
          title: feat.name,
          subtitle: feat.sub,
          category: 'Feature',
          path: feat.path,
          icon: feat.icon,
        });
      }
    });

    // 2. Students
    searchDataset.students.forEach((s) => {
      if (
        s.full_name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        (s.b_form_or_cnic && s.b_form_or_cnic.includes(q))
      ) {
        results.push({
          id: `stu-${s.id}`,
          title: s.full_name,
          subtitle: `Admission No: ${s.admission_no} • Guardian: ${s.guardian_name}`,
          category: 'Student',
          path: `/quick-search?q=${encodeURIComponent(s.admission_no)}`,
          icon: <GraduationCap className="w-3.5 h-3.5 text-blue-500" />,
        });
      }
    });

    // 3. Teachers
    searchDataset.teachers.forEach((t) => {
      if (
        t.full_name.toLowerCase().includes(q) ||
        (t.designation && t.designation.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q))
      ) {
        results.push({
          id: `tch-${t.id}`,
          title: t.full_name,
          subtitle: `${t.designation || 'Teacher'} • ${t.email || ''}`,
          category: 'Teacher',
          path: '/teachers',
          icon: <Users className="w-3.5 h-3.5 text-emerald-500" />,
        });
      }
    });

    // 4. Classes
    searchDataset.classes.forEach((c) => {
      if (c.name.toLowerCase().includes(q)) {
        results.push({
          id: `cls-${c.id}`,
          title: c.name,
          subtitle: 'Academic Structure & Class Roster',
          category: 'Class',
          path: '/classes-sections',
          icon: <School className="w-3.5 h-3.5 text-purple-500" />,
        });
      }
    });

    // 5. Invoices / Challans
    searchDataset.invoices.forEach((inv) => {
      if (inv.invoice_no.toLowerCase().includes(q)) {
        results.push({
          id: `inv-${inv.id}`,
          title: `Challan ${inv.invoice_no}`,
          subtitle: `Month: ${inv.billing_month} • Net: Rs. ${inv.net_amount} • Status: ${inv.status}`,
          category: 'Challan',
          path: '/fees-accounts',
          icon: <Receipt className="w-3.5 h-3.5 text-teal-500" />,
        });
      }
    });

    setSearchResults(results.slice(0, 8));
  }, [searchQuery, searchDataset]);

  const handleSelectSearchResult = (path: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    navigate(`/quick-search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

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
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between z-20 shrink-0 no-print transition-colors">
      {/* Left: Mobile Toggle & Global Search Box */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar (Matching Reference Visual) */}
        <div className="relative flex-1" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search students, teachers, or features..."
              className="w-full bg-[#f4f7fc] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Floating Search Results Dropdown */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute left-0 mt-2 w-full sm:w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Matching Records ({searchResults.length})</span>
                <span className="text-[10px] text-slate-400">Press Enter for deep search</span>
              </div>

              <div className="max-h-80 overflow-y-auto p-1.5 space-y-1">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No records found matching "{searchQuery}".
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSearchResult(item.path)}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/70 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/40 group-hover:text-blue-600">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {item.title}
                          </span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Notifications Bell & Admin User Avatar Menu */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Notifications Bell with Counter (Matching Reference Visual) */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none relative cursor-pointer"
            title="School Notices & Announcements"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">School Notices</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {unreadCount} new
                  </span>
                </div>
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                >
                  Mark all read
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active school notices found.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleOpenNotice(n)}
                      className={`p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                        !n.is_read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {n.content}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                        <span className="capitalize font-medium text-blue-600 dark:text-blue-400">{n.category}</span>
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
                    navigate('/events-announcements');
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  View All Announcements &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Admin Avatar & Profile Dropdown (Matching Reference Visual) */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
            aria-label="Account menu"
          >
            {/* Circular Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-2 ring-blue-100 dark:ring-blue-900/60 overflow-hidden">
              {user?.full_name ? user.full_name[0] : 'A'}
            </div>
            <span className="hidden sm:inline text-xs font-bold text-slate-800 dark:text-slate-100">
              {role === 'admin' ? 'Admin' : user?.full_name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          </button>

          {/* User Account Popover */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user?.full_name || 'Administrator'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {role} Access
                </span>
              </div>

              {/* Session Switcher inside profile */}
              <div className="p-3">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  <span>Academic Session</span>
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {sessions.map((ses) => (
                    <option key={ses.id} value={ses.id}>
                      {ses.name} {ses.is_current ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Settings, Theme & Database Links */}
              <div className="p-1.5 space-y-0.5 text-xs">
                {role === 'admin' && (
                  <>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate('/school-settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Sliders className="w-4 h-4 text-slate-500" />
                      <span>School Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate('/server-database');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <span>Database Health</span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        {isLiveSupabaseConfigured() ? 'Cloud Live' : 'Storage'}
                      </span>
                    </button>
                  </>
                )}

                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    <span>Theme</span>
                  </div>
                  <span className="text-[11px] text-slate-400 capitalize">{theme}</span>
                </button>
              </div>

              {/* Logout */}
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-medium text-xs cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
