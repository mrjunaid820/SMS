import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import {
  announcementApi,
  eventApi,
  academicStructureApi,
  teacherApi,
} from '@/services/api';
import {
  SchoolAnnouncement,
  SchoolEvent,
  AnnouncementCategory,
  AnnouncementAudience,
  AnnouncementStatus,
  EventCategory,
  EventStatus,
  ClassLevel,
  Section,
} from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { formatDate } from '@/lib/utils';
import {
  Megaphone,
  Calendar,
  Plus,
  Pin,
  PinOff,
  Eye,
  Edit2,
  Trash2,
  Search,
  Filter,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle,
  Archive,
  Send,
  CalendarDays,
  List,
  Sparkles,
  Users,
  Shield,
  Layers,
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

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Everyone',
  teachers: 'Teachers Only',
  students: 'Students Only',
  class_section: 'Class / Section',
};

export const EventsAnnouncementsPage: React.FC = () => {
  const { user, role } = useAuth();
  const { settings } = useSchool();

  const [activeTab, setActiveTab] = useState<'announcements' | 'events'>('announcements');
  const [announcements, setAnnouncements] = useState<SchoolAnnouncement[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isCreateAnnouncementOpen, setIsCreateAnnouncementOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<SchoolAnnouncement | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<SchoolAnnouncement | null>(null);
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: 'announcement' | 'event';
    id: string;
    title: string;
  }>({ isOpen: false, type: 'announcement', id: '', title: '' });

  // Announcement Form State
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    category: 'general' as AnnouncementCategory,
    target_audience: 'all' as AnnouncementAudience,
    class_id: '',
    section_id: '',
    is_pinned: false,
    status: 'published' as AnnouncementStatus,
    publish_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    attachment_url: '',
  });

  // Event Form State
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    category: 'academic' as EventCategory,
    event_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '12:00',
    venue: 'School Main Campus',
    instructions: '',
    target_audience: 'all' as AnnouncementAudience,
    class_id: '',
    section_id: '',
    status: 'scheduled' as EventStatus,
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [allAnnouncements, allEvents, allCls, allSecs] = await Promise.all([
        announcementApi.getAnnouncements(
          {},
          { id: user?.id, role, email: user?.email }
        ),
        eventApi.getEvents({}, { id: user?.id, role }),
        academicStructureApi.getClasses(),
        academicStructureApi.getSections(),
      ]);

      setAnnouncements(allAnnouncements);
      setEvents(allEvents);
      setClasses(allCls);
      setSections(allSecs);
    } catch (err) {
      console.error('Failed to load events and announcements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user?.id, role]);

  // Filtered Announcements
  const filteredAnnouncements = announcements.filter((a) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (audienceFilter !== 'all' && a.target_audience !== audienceFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  // Filtered Events
  const filteredEvents = events.filter((e) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    return true;
  });

  // Handlers for Announcement Creation / Editing
  const openCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({
      title: '',
      content: '',
      category: 'general',
      target_audience: role === 'teacher' ? 'class_section' : 'all',
      class_id: '',
      section_id: '',
      is_pinned: false,
      status: 'published',
      publish_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      attachment_url: '',
    });
    setFormError('');
    setIsCreateAnnouncementOpen(true);
  };

  const openEditAnnouncement = (a: SchoolAnnouncement) => {
    setEditingAnnouncement(a);
    setAnnouncementForm({
      title: a.title,
      content: a.content,
      category: a.category,
      target_audience: a.target_audience,
      class_id: a.class_id || '',
      section_id: a.section_id || '',
      is_pinned: a.is_pinned,
      status: a.status,
      publish_date: a.publish_date,
      expiry_date: a.expiry_date || '',
      attachment_url: a.attachment_url || '',
    });
    setFormError('');
    setIsCreateAnnouncementOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!announcementForm.title.trim()) {
      setFormError('Please enter an announcement title.');
      return;
    }
    if (!announcementForm.content.trim()) {
      setFormError('Please enter announcement body content.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAnnouncement) {
        await announcementApi.updateAnnouncement(
          editingAnnouncement.id,
          {
            ...announcementForm,
            class_id: announcementForm.class_id || undefined,
            section_id: announcementForm.section_id || undefined,
            expiry_date: announcementForm.expiry_date || undefined,
            attachment_url: announcementForm.attachment_url || undefined,
          },
          { id: user?.id, name: user?.full_name, role }
        );
      } else {
        await announcementApi.createAnnouncement(
          {
            ...announcementForm,
            class_id: announcementForm.class_id || undefined,
            section_id: announcementForm.section_id || undefined,
            expiry_date: announcementForm.expiry_date || undefined,
            attachment_url: announcementForm.attachment_url || undefined,
          },
          { id: user?.id, name: user?.full_name, role }
        );
      }
      setIsCreateAnnouncementOpen(false);
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (a: SchoolAnnouncement) => {
    if (role !== 'admin') return;
    try {
      await announcementApi.updateAnnouncement(a.id, { is_pinned: !a.is_pinned }, { id: user?.id, role });
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update pinned status.');
    }
  };

  // Toggle Publish / Archive
  const handleToggleStatus = async (a: SchoolAnnouncement, newStatus: AnnouncementStatus) => {
    try {
      await announcementApi.updateAnnouncement(a.id, { status: newStatus }, { id: user?.id, role });
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  // Handlers for Event Creation / Editing
  const openCreateEvent = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      description: '',
      category: 'academic',
      event_date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '12:00',
      venue: 'School Main Campus',
      instructions: '',
      target_audience: 'all',
      class_id: '',
      section_id: '',
      status: 'scheduled',
    });
    setFormError('');
    setIsCreateEventOpen(true);
  };

  const openEditEvent = (ev: SchoolEvent) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      description: ev.description || '',
      category: ev.category,
      event_date: ev.event_date,
      start_time: ev.start_time || '09:00',
      end_time: ev.end_time || '12:00',
      venue: ev.venue || 'School Main Campus',
      instructions: ev.instructions || '',
      target_audience: ev.target_audience,
      class_id: ev.class_id || '',
      section_id: ev.section_id || '',
      status: ev.status,
    });
    setFormError('');
    setIsCreateEventOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!eventForm.title.trim()) {
      setFormError('Please enter an event title.');
      return;
    }
    if (!eventForm.event_date) {
      setFormError('Please select the event date.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEvent) {
        await eventApi.updateEvent(
          editingEvent.id,
          {
            ...eventForm,
            class_id: eventForm.class_id || undefined,
            section_id: eventForm.section_id || undefined,
          },
          { id: user?.id, name: user?.full_name, role }
        );
      } else {
        await eventApi.createEvent(
          {
            ...eventForm,
            class_id: eventForm.class_id || undefined,
            section_id: eventForm.section_id || undefined,
          },
          { id: user?.id, name: user?.full_name, role }
        );
      }
      setIsCreateEventOpen(false);
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save school event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Action Execution
  const handleExecuteDelete = async () => {
    try {
      if (deleteConfirmation.type === 'announcement') {
        await announcementApi.deleteAnnouncement(deleteConfirmation.id, { id: user?.id, role });
      } else {
        await eventApi.deleteEvent(deleteConfirmation.id, { id: user?.id, role });
      }
      setDeleteConfirmation({ isOpen: false, type: 'announcement', id: '', title: '' });
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Delete operation failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Events & Announcements
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish institutional notices, exam schedules, sports updates, and manage school calendar activities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateEvent}
            leftIcon={<Calendar className="w-4 h-4" />}
          >
            Add Event
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateAnnouncement}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Announcement
          </Button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Published Notices</span>
            <Megaphone className="w-4 h-4 text-brand-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {announcements.filter((a) => a.status === 'published').length}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 inline-block">Active Broadcasts</span>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pinned Important</span>
            <Pin className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {announcements.filter((a) => a.is_pinned).length}
          </p>
          <span className="text-[11px] text-amber-600 font-medium mt-1 inline-block">Top of Dashboards</span>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Upcoming Events</span>
            <CalendarDays className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {events.filter((e) => e.status === 'scheduled').length}
          </p>
          <span className="text-[11px] text-blue-600 font-medium mt-1 inline-block">Scheduled in Term</span>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Drafts & Scheduled</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {announcements.filter((a) => a.status === 'draft' || a.status === 'scheduled').length}
          </p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">Pending Broadcast</span>
        </Card>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'announcements'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Announcements & Circulars</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {filteredAnnouncements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'events'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>School Calendar Events</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {filteredEvents.length}
          </span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder={activeTab === 'announcements' ? 'Search notices by title or content...' : 'Search events by name...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'announcements' && (
            <>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="exam">Exams & Tests</option>
                <option value="holiday">Holidays & Vacations</option>
                <option value="meeting">PTM & Staff Meetings</option>
                <option value="admission">Admissions</option>
                <option value="result">Results</option>
                <option value="sports">Sports</option>
                <option value="celebration">Celebrations & Days</option>
                <option value="emergency">Emergency / Alert</option>
                <option value="general">General Notices</option>
              </select>

              <select
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Audiences</option>
                <option value="all">Everyone</option>
                <option value="teachers">Teachers Only</option>
                <option value="students">Students Only</option>
                <option value="class_section">Class / Section</option>
              </select>

              {role === 'admin' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </select>
              )}
            </>
          )}

          {activeTab === 'events' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Event Types</option>
              <option value="academic">Academic & Science</option>
              <option value="sports">Sports Gala</option>
              <option value="cultural">Cultural / Iqbal Day</option>
              <option value="holiday">Holiday Celebrations</option>
              <option value="meeting">PTM & Conferences</option>
              <option value="examination">Examination Schedule</option>
              <option value="other">Other School Activities</option>
            </select>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ANNOUNCEMENTS LIST */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading announcements and notices...</div>
          ) : filteredAnnouncements.length === 0 ? (
            <Card className="p-8 text-center text-slate-500 space-y-3 border-dashed">
              <Megaphone className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No announcements match your filter.</p>
              <p className="text-xs text-slate-400">Create a new circular or change filter criteria above.</p>
              <Button size="sm" onClick={openCreateAnnouncement} leftIcon={<Plus className="w-4 h-4" />}>
                Create Announcement
              </Button>
            </Card>
          ) : (
            filteredAnnouncements.map((a) => (
              <Card
                key={a.id}
                className={`p-4 sm:p-5 transition-all hover:shadow-xs border ${
                  a.is_pinned
                    ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.is_pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                          <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
                          PINNED
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS.general}`}>
                        {a.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {AUDIENCE_LABELS[a.target_audience] || a.target_audience}
                        {a.class && ` (${a.class.name}${a.section ? ` - ${a.section.name}` : ''})`}
                      </span>
                      {a.status !== 'published' && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {a.status}
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {a.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-3 leading-relaxed">
                      {a.content}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-2">
                      <span>Published: {formatDate(a.publish_date)}</span>
                      {a.expiry_date && <span>Valid Until: {formatDate(a.expiry_date)}</span>}
                      {a.attachment_url && (
                        <a
                          href={a.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 dark:text-brand-400 font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Supporting Document
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 self-end sm:self-start shrink-0 pt-2 sm:pt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewAnnouncement(a)}
                      title="Preview announcement"
                    >
                      <Eye className="w-4 h-4 text-slate-500" />
                    </Button>

                    {role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePin(a)}
                        title={a.is_pinned ? 'Unpin from dashboard' : 'Pin to top of dashboards'}
                      >
                        {a.is_pinned ? (
                          <PinOff className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Pin className="w-4 h-4 text-slate-400 hover:text-amber-500" />
                        )}
                      </Button>
                    )}

                    {(role === 'admin' || a.author_id === user?.id) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditAnnouncement(a)}
                          title="Edit announcement"
                        >
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </Button>

                        {role === 'admin' && a.status === 'published' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(a, 'archived')}
                            title="Archive notice"
                          >
                            <Archive className="w-4 h-4 text-slate-400" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteConfirmation({
                              isOpen: true,
                              type: 'announcement',
                              id: a.id,
                              title: a.title,
                            })
                          }
                          title="Delete notice"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SCHOOL CALENDAR EVENTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full p-12 text-center text-slate-400 text-xs">Loading school calendar...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-400 text-xs">
              No school events scheduled matching filter.
            </div>
          ) : (
            filteredEvents.map((ev) => (
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{ev.description}</p>
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

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Audience: {ev.target_audience}
                  </span>
                  {role === 'admin' && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditEvent(ev)} title="Edit Event">
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteConfirmation({
                            isOpen: true,
                            type: 'event',
                            id: ev.id,
                            title: ev.title,
                          })
                        }
                        title="Delete Event"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: CREATE / EDIT ANNOUNCEMENT */}
      {/* ------------------------------------------------------------- */}
      {isCreateAnnouncementOpen && (
        <Modal
          isOpen={isCreateAnnouncementOpen}
          onClose={() => setIsCreateAnnouncementOpen(false)}
          title={editingAnnouncement ? 'Edit Announcement' : 'Create School Announcement'}
          size="lg"
        >
          <form onSubmit={handleSaveAnnouncement} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 rounded-lg text-xs font-medium">
                {formError}
              </div>
            )}

            <Input
              label="Announcement Title"
              required
              placeholder="e.g. Mid-Term Examination Date Sheet or Sports Day Registration"
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Announcement Body / Message Content *
              </label>
              <textarea
                required
                rows={4}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Type the complete circular text, instructions, and schedule details..."
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={announcementForm.category}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, category: e.target.value as AnnouncementCategory })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="general">General Notice</option>
                  <option value="exam">Examination & Assessment</option>
                  <option value="holiday">Holiday / Vacation</option>
                  <option value="meeting">PTM / Staff Meeting</option>
                  <option value="admission">Admissions</option>
                  <option value="result">Result Declaration</option>
                  <option value="sports">Sports & Athletics</option>
                  <option value="celebration">Celebration / National Day</option>
                  <option value="emergency">Emergency / Alert</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Audience
                </label>
                <select
                  value={announcementForm.target_audience}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, target_audience: e.target.value as AnnouncementAudience })
                  }
                  disabled={role === 'teacher'}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="all">Everyone (School-Wide)</option>
                  <option value="teachers">Faculty / Teachers Only</option>
                  <option value="students">Students & Parents Only</option>
                  <option value="class_section">Specific Class / Section</option>
                </select>
              </div>
            </div>

            {announcementForm.target_audience === 'class_section' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Class (Optional)
                  </label>
                  <select
                    value={announcementForm.class_id}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, class_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Section (Optional)
                  </label>
                  <select
                    value={announcementForm.section_id}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, section_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Sections</option>
                    {sections
                      .filter((s) => !announcementForm.class_id || s.class_id === announcementForm.class_id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          Section {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Publish Date"
                type="date"
                required
                value={announcementForm.publish_date}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, publish_date: e.target.value })}
              />

              <Input
                label="Expiry Date (Optional)"
                type="date"
                value={announcementForm.expiry_date}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, expiry_date: e.target.value })}
              />
            </div>

            <Input
              label="Supporting Attachment URL / Cloud Document Link (Optional)"
              placeholder="https://... or PDF document link"
              value={announcementForm.attachment_url}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, attachment_url: e.target.value })}
            />

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pin to Top of Dashboards
                </span>
                <p className="text-[11px] text-slate-400">
                  Highlights this announcement prominently on the relevant user dashboards.
                </p>
              </div>
              <input
                type="checkbox"
                checked={announcementForm.is_pinned}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, is_pinned: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateAnnouncementOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPreviewAnnouncement({
                    ...announcementForm,
                    id: 'preview',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                }
              >
                Preview Notice
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                {editingAnnouncement ? 'Save Changes' : 'Publish Announcement'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CREATE / EDIT SCHOOL EVENT */}
      {/* ------------------------------------------------------------- */}
      {isCreateEventOpen && (
        <Modal
          isOpen={isCreateEventOpen}
          onClose={() => setIsCreateEventOpen(false)}
          title={editingEvent ? 'Edit School Event' : 'Schedule School Event'}
          size="lg"
        >
          <form onSubmit={handleSaveEvent} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 rounded-lg text-xs font-medium">
                {formError}
              </div>
            )}

            <Input
              label="Event Name / Title"
              required
              placeholder="e.g. Annual Science Exhibition or Inter-House Cricket Match"
              value={eventForm.title}
              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Event Description
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                placeholder="Details of activities, schedule, and objectives..."
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Event Category
                </label>
                <select
                  value={eventForm.category}
                  onChange={(e) => setEventForm({ ...eventForm, category: e.target.value as EventCategory })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="academic">Academic & Science</option>
                  <option value="sports">Sports</option>
                  <option value="cultural">Cultural / Arts</option>
                  <option value="holiday">Holiday Celebration</option>
                  <option value="meeting">PTM / Conference</option>
                  <option value="examination">Examination</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <Input
                label="Event Date"
                type="date"
                required
                value={eventForm.event_date}
                onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Start Time"
                type="time"
                value={eventForm.start_time}
                onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
              />

              <Input
                label="End Time"
                type="time"
                value={eventForm.end_time}
                onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
              />
            </div>

            <Input
              label="Venue / Location"
              placeholder="e.g. Main Auditorium, Sports Ground, Room 101"
              value={eventForm.venue}
              onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
            />

            <Input
              label="Special Instructions / Dress Code (Optional)"
              placeholder="e.g. Proper lab uniform, bring sports kit"
              value={eventForm.instructions}
              onChange={(e) => setEventForm({ ...eventForm, instructions: e.target.value })}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateEventOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                {editingEvent ? 'Save Event' : 'Schedule Event'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: PREVIEW ANNOUNCEMENT */}
      {/* ------------------------------------------------------------- */}
      {previewAnnouncement && (
        <Modal
          isOpen={Boolean(previewAnnouncement)}
          onClose={() => setPreviewAnnouncement(null)}
          title="Announcement Official Preview"
          size="lg"
        >
          <div className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {settings.school_name || 'Islamia Public High School'}
                </h4>
                <p className="text-[11px] text-slate-400">Institutional Administration Office Circular</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${CATEGORY_COLORS[previewAnnouncement.category]}`}>
                {previewAnnouncement.category}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {previewAnnouncement.title}
              </h2>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                <span>Date: {formatDate(previewAnnouncement.publish_date)}</span>
                <span>•</span>
                <span>Target: {AUDIENCE_LABELS[previewAnnouncement.target_audience]}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {previewAnnouncement.content}
            </div>

            {previewAnnouncement.attachment_url && (
              <div className="p-3 bg-brand-50/50 dark:bg-brand-950/20 rounded-lg border border-brand-200 dark:border-brand-800 flex items-center justify-between">
                <span className="text-xs text-brand-700 dark:text-brand-300 font-medium">Attached Official Document</span>
                <a
                  href={previewAnnouncement.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Download / View &rarr;
                </a>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewAnnouncement(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog for Deletions */}
      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, type: 'announcement', id: '', title: '' })}
        onConfirm={handleExecuteDelete}
        title={`Delete ${deleteConfirmation.type === 'announcement' ? 'Announcement' : 'Event'}?`}
        message={`Are you sure you want to permanently delete "${deleteConfirmation.title}"? This action will remove the record from all portal dashboards.`}
        confirmText="Yes, Delete"
        variant="danger"
      />
    </div>
  );
};
export default EventsAnnouncementsPage;
