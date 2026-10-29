import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { announcementApi, eventApi, studentPortalApi } from '@/services/api';
import { SchoolAnnouncement, SchoolEvent } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { formatDate } from '@/lib/utils';
import {
  Megaphone,
  Calendar,
  CalendarDays,
  Pin,
  Clock,
  MapPin,
  FileText,
  Search,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Eye,
  Info,
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  exam: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  holiday: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  meeting: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  admission: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  result: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
  sports: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  celebration: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  emergency: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-bold',
};

export const MyAnnouncementsPage: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSchool();

  const [announcements, setAnnouncements] = useState<SchoolAnnouncement[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<SchoolAnnouncement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'notices' | 'calendar'>('notices');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [allNotices, allEvents] = await Promise.all([
        announcementApi.getAnnouncements(
          { status: 'published' },
          { id: user.id, role: 'student', email: user.email }
        ),
        eventApi.getEvents({}, { id: user.id, role: 'student' }),
      ]);
      setAnnouncements(allNotices);
      setEvents(allEvents);
    } catch (err) {
      console.error('Failed to load student notices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleOpenNotice = async (notice: SchoolAnnouncement) => {
    setSelectedNotice(notice);
    if (user && !notice.is_read) {
      await announcementApi.markAsRead(notice.id, user.id);
      setAnnouncements((prev) =>
        prev.map((item) => (item.id === notice.id ? { ...item, is_read: true } : item))
      );
    }
  };

  const filteredNotices = announcements.filter((a) => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-brand-950 text-white p-6 sm:p-8 border border-navy-800 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold border border-brand-500/30">
              <Megaphone className="w-3.5 h-3.5" />
              School Circulars & Event Calendar
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              School Events & Announcements
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Stay informed on upcoming exam schedules, holiday notices, sports galas, and school activities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-center">
              <p className="text-xl font-bold">{announcements.length}</p>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider">Active Notices</p>
            </div>
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-center">
              <p className="text-xl font-bold">{events.length}</p>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider">Upcoming Events</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('notices')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'notices'
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Circulars & Notices</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {filteredNotices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'calendar'
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>School Calendar Events</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {events.length}
            </span>
          </button>
        </div>

        {activeTab === 'notices' && (
          <div className="hidden sm:flex items-center gap-2 pb-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Categories</option>
              <option value="exam">Exams</option>
              <option value="holiday">Holidays</option>
              <option value="sports">Sports</option>
              <option value="celebration">Celebrations</option>
              <option value="general">General</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: NOTICES & CIRCULARS */}
      {activeTab === 'notices' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading notices...</div>
          ) : filteredNotices.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 border-dashed">
              <Megaphone className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No announcements found</p>
              <p className="text-xs text-slate-400">There are no active circulars matching your filter.</p>
            </Card>
          ) : (
            filteredNotices.map((a) => (
              <Card
                key={a.id}
                onClick={() => handleOpenNotice(a)}
                className={`p-4 sm:p-5 transition-all hover:shadow-xs cursor-pointer border ${
                  a.is_pinned
                    ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                } ${!a.is_read ? 'ring-1 ring-brand-500/30' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.is_pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                          <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
                          IMPORTANT
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS.general}`}>
                        {a.category}
                      </span>
                      {!a.is_read && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          NEW
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 hover:text-brand-600 transition-colors">
                      {a.title}
                    </h2>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {a.content}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span>Date: {formatDate(a.publish_date)}</span>
                      {a.attachment_url && (
                        <span className="text-brand-600 dark:text-brand-400 font-medium flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Has Attachment
                        </span>
                      )}
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" className="shrink-0 self-end sm:self-center">
                    <Eye className="w-4 h-4 text-slate-400" />
                    <span className="text-xs">Read Notice</span>
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 2: EVENTS & CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-400 text-xs">
              No school events scheduled currently.
            </div>
          ) : (
            events.map((ev) => (
              <Card key={ev.id} className="p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {ev.category}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-brand-500" />
                      {formatDate(ev.event_date)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{ev.title}</h3>

                  {ev.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{ev.description}</p>
                  )}

                  <div className="space-y-1 pt-2 text-[11px] text-slate-600 dark:text-slate-300">
                    {ev.venue && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{ev.venue}</span>
                      </div>
                    )}
                    {ev.start_time && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>
                          {ev.start_time} {ev.end_time ? `- ${ev.end_time}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {ev.instructions && (
                  <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-800/60 rounded text-[11px] text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold block text-[10px] text-slate-500">Notice for Students:</span>
                    {ev.instructions}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* NOTICE DETAIL MODAL */}
      {selectedNotice && (
        <Modal
          isOpen={Boolean(selectedNotice)}
          onClose={() => setSelectedNotice(null)}
          title="Official School Notice"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${CATEGORY_COLORS[selectedNotice.category]}`}>
                {selectedNotice.category}
              </span>
              <span className="text-xs text-slate-400">Date: {formatDate(selectedNotice.publish_date)}</span>
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {selectedNotice.title}
            </h2>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {selectedNotice.content}
            </div>

            {selectedNotice.attachment_url && (
              <div className="p-3 bg-brand-50/50 dark:bg-brand-950/20 rounded-lg border border-brand-200 dark:border-brand-800 flex items-center justify-between">
                <span className="text-xs text-brand-700 dark:text-brand-300 font-medium">Download Attachment</span>
                <a
                  href={selectedNotice.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Open Document &rarr;
                </a>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedNotice(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MyAnnouncementsPage;
