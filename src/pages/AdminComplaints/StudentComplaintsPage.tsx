import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { complaintApi } from '@/services/api';
import {
  StudentComplaint,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintSummaryStats,
} from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  MessageSquareWarning,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  Search,
  Filter,
  X,
  Send,
  Lock,
  User,
  GraduationCap,
  Calendar,
  Building,
  Check,
  ShieldAlert,
  ChevronRight,
  Plus,
  RefreshCw,
} from 'lucide-react';

const CATEGORIES: ComplaintCategory[] = [
  'Teacher-related Complaint',
  'Classroom Issue',
  'Academic Issue',
  'Examination Issue',
  'Fee-related Issue',
  'School Facilities',
  'Discipline Issue',
  'Bullying or Harassment',
  'Transport Issue',
  'Other',
];

export const StudentComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [stats, setStats] = useState<ComplaintSummaryStats>({
    total: 0,
    submitted: 0,
    underReview: 0,
    inProgress: 0,
    resolved: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Complaint for Drawer/Modal
  const [selectedComplaint, setSelectedComplaint] = useState<StudentComplaint | null>(null);

  // Action States inside Drawer
  const [activeTab, setActiveTab] = useState<'details' | 'response' | 'notes' | 'history'>('details');
  const [officialResponse, setOfficialResponse] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadComplaints = async () => {
    setIsLoading(true);
    try {
      const actor = { id: user?.id, name: user?.full_name, role: 'admin' };
      const [list, statsData] = await Promise.all([
        complaintApi.getComplaints(
          {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          actor
        ),
        complaintApi.getComplaintStats(actor),
      ]);

      setComplaints(list);
      setStats(statsData);

      // If drawer is open, refresh selected complaint
      if (selectedComplaint) {
        const fresh = list.find((c) => c.id === selectedComplaint.id);
        if (fresh) setSelectedComplaint(fresh);
      }
    } catch (err: any) {
      console.error('Failed to load admin complaints', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [startDate, endDate]);

  const handleOpenComplaint = (c: StudentComplaint) => {
    setSelectedComplaint(c);
    setOfficialResponse(c.admin_response || '');
    setInternalNote('');
    setRejectionReason('');
    setActiveTab('details');
    setFeedbackMsg(null);
  };

  const handleStatusUpdate = async (newStatus: ComplaintStatus, customComment?: string) => {
    if (!selectedComplaint) return;
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const adminActor = {
        id: user?.id,
        name: user?.full_name || 'Administrator (Principal)',
        role: 'admin',
      };

      const updated = await complaintApi.updateComplaintStatus(
        selectedComplaint.id,
        newStatus,
        {
          adminResponse: officialResponse.trim() || undefined,
          comment: customComment,
        },
        adminActor
      );

      setFeedbackMsg({
        type: 'success',
        text: `Complaint marked as "${newStatus}" successfully.`,
      });

      await loadComplaints();
      const refreshed = await complaintApi.getComplaintById(selectedComplaint.id, adminActor);
      setSelectedComplaint(refreshed);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to update complaint status.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedComplaint) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejecting this complaint.');
      return;
    }
    setActionLoading(true);

    try {
      const adminActor = {
        id: user?.id,
        name: user?.full_name || 'Administrator (Principal)',
        role: 'admin',
      };

      await complaintApi.updateComplaintStatus(
        selectedComplaint.id,
        'Rejected',
        {
          rejectionReason: rejectionReason.trim(),
          comment: `Complaint rejected: ${rejectionReason.trim()}`,
        },
        adminActor
      );

      setIsRejectModalOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: 'Complaint has been marked as Rejected.',
      });

      await loadComplaints();
      const refreshed = await complaintApi.getComplaintById(selectedComplaint.id, adminActor);
      setSelectedComplaint(refreshed);
    } catch (err: any) {
      alert(err.message || 'Failed to reject complaint.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveResponse = async () => {
    if (!selectedComplaint) return;
    if (!officialResponse.trim()) {
      alert('Please enter a response to send to the student.');
      return;
    }
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const adminActor = {
        id: user?.id,
        name: user?.full_name || 'Administrator (Principal)',
        role: 'admin',
      };

      await complaintApi.updateComplaintStatus(
        selectedComplaint.id,
        selectedComplaint.status === 'Submitted' ? 'Under Review' : selectedComplaint.status,
        {
          adminResponse: officialResponse.trim(),
          comment: 'Official response added by School Administration',
        },
        adminActor
      );

      setFeedbackMsg({
        type: 'success',
        text: 'Official response saved and made visible to the student.',
      });

      await loadComplaints();
      const refreshed = await complaintApi.getComplaintById(selectedComplaint.id, adminActor);
      setSelectedComplaint(refreshed);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to save response.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!selectedComplaint) return;
    if (!internalNote.trim()) {
      alert('Internal note cannot be empty.');
      return;
    }
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const adminActor = {
        id: user?.id,
        name: user?.full_name || 'Administrator (Principal)',
        role: 'admin',
      };

      await complaintApi.addAdminNote(selectedComplaint.id, internalNote.trim(), adminActor);
      setInternalNote('');
      setFeedbackMsg({
        type: 'success',
        text: 'Private administrative note recorded successfully.',
      });

      await loadComplaints();
      const refreshed = await complaintApi.getComplaintById(selectedComplaint.id, adminActor);
      setSelectedComplaint(refreshed);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to add internal note.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Submitted
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <Eye className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            Under Review
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            In Progress
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Resolved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      searchTerm === '' ||
      c.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.complaint_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.student?.full_name && c.student.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.student?.admission_no && c.student.admission_no.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Page Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <MessageSquareWarning className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Student Complaints & Feedback Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                Admin Confidential
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Review, investigate, respond, and resolve student grievances and feedback directly.
            </p>
          </div>
        </div>

        <button
          onClick={loadComplaints}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Strict Role-Based Privacy Notice */}
      <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 rounded-xl p-3.5 flex items-center gap-3">
        <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong className="font-semibold">Confidential Admin Panel:</strong> This module and its underlying database records are strictly restricted to authorized administrators. Faculty members and teachers cannot view, search, or access student complaint data.
        </p>
      </div>

      {/* Summary Statistic Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total</span>
            <span className="w-2 h-2 rounded-full bg-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {stats.total}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">All student cases</span>
        </div>

        {/* New / Submitted */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Submitted</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {stats.submitted}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Awaiting initial review</span>
        </div>

        {/* Under Review */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">Under Review</span>
            <span className="w-2 h-2 rounded-full bg-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-2 font-mono">
            {stats.underReview}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Being evaluated</span>
        </div>

        {/* In Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">In Progress</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
            {stats.inProgress}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Action underway</span>
        </div>

        {/* Resolved */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Resolved</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {stats.resolved}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Closed & answered</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student, admission #, ref #..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none max-w-[180px] truncate"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setCategoryFilter('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-1 font-medium"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Complaints Table */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading student complaints...</p>
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            No Student Complaints Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'No complaint records match your active search filters.'
              : 'There are currently no complaints submitted by students.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Ref #</th>
                  <th className="py-3.5 px-4">Student & Admission</th>
                  <th className="py-3.5 px-4">Class & Section</th>
                  <th className="py-3.5 px-4">Subject & Category</th>
                  <th className="py-3.5 px-4">Submitted Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredComplaints.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {c.complaint_reference}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {c.student?.full_name || 'Student'}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {c.student?.admission_no || 'N/A'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {c.student?.enrollment?.section
                        ? `${c.student.enrollment.section.class?.name || 'Class 9'} - ${c.student.enrollment.section.name}`
                        : 'Class 9 - A'}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {c.subject}
                      </div>
                      <span className="inline-block mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {c.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenComplaint(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complaint Management Drawer / Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-in fade-in-50 zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60">
                    {selectedComplaint.complaint_reference}
                  </span>
                  {getStatusBadge(selectedComplaint.status)}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {selectedComplaint.subject}
                </h3>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student Context Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Student Profile Context
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Full Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedComplaint.student?.full_name || 'Hamza Khan'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Admission No:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {selectedComplaint.student?.admission_no || 'ADM-2025-0001'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Class & Section:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedComplaint.student?.enrollment?.section
                      ? `${selectedComplaint.student.enrollment.section.class?.name || 'Class 9'} - ${selectedComplaint.student.enrollment.section.name}`
                      : 'Class 9 - A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Submitted Date:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatDate(selectedComplaint.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Status Change Action Bar */}
            <div className="bg-slate-100/80 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Change Status:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={actionLoading || selectedComplaint.status === 'Under Review'}
                  onClick={() => handleStatusUpdate('Under Review')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Under Review
                </button>
                <button
                  type="button"
                  disabled={actionLoading || selectedComplaint.status === 'In Progress'}
                  onClick={() => handleStatusUpdate('In Progress')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  In Progress
                </button>
                <button
                  type="button"
                  disabled={actionLoading || selectedComplaint.status === 'Resolved'}
                  onClick={() => handleStatusUpdate('Resolved')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Mark Resolved
                </button>
                <button
                  type="button"
                  disabled={actionLoading || selectedComplaint.status === 'Rejected'}
                  onClick={() => setIsRejectModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </div>

            {feedbackMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'details'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Description & Attachment
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('response')}
                className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'response'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Official Student Response
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'notes'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <Lock className="w-3 h-3 text-amber-500" />
                <span>Internal Notes ({selectedComplaint.notes?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                History Trail
              </button>
            </div>

            {/* Tab 1: Description */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Complaint Text
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs text-slate-800 dark:text-slate-200 leading-relaxed border border-slate-200/60 dark:border-slate-800 whitespace-pre-wrap">
                    {selectedComplaint.description}
                  </div>
                </div>

                {selectedComplaint.attachment_name && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-500 dark:text-slate-400">Attachment:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedComplaint.attachment_name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Response */}
            {activeTab === 'response' && (
              <div className="space-y-4">
                <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 p-3 rounded-xl text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                  The message below is transmitted directly to the student portal and will be visible under their complaint status.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Official Student Response
                  </label>
                  <textarea
                    rows={4}
                    value={officialResponse}
                    onChange={(e) => setOfficialResponse(e.target.value)}
                    placeholder="Type official response, decision, or steps taken for the student..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleSaveResponse}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Response to Student</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Internal Notes (Admin-Only) */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Strictly Confidential:</strong> Internal notes are accessible only to school administrators. Students and teachers can NEVER see these notes.
                  </span>
                </div>

                {/* Existing Notes */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {selectedComplaint.notes && selectedComplaint.notes.length > 0 ? (
                    selectedComplaint.notes.map((n) => (
                      <div
                        key={n.id}
                        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 p-3 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {n.admin_name}
                          </span>
                          <span>{formatDate(n.created_at)}</span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {n.note}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No internal notes added yet.</p>
                  )}
                </div>

                {/* Add Note Input */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Add Administrative Note
                  </label>
                  <textarea
                    rows={2}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Enter confidential notes, investigator findings, or private instructions..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleAddInternalNote}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Note</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: History */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Action Audit Trail
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedComplaint.history && selectedComplaint.history.length > 0 ? (
                    selectedComplaint.history.map((h) => (
                      <div
                        key={h.id}
                        className="bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex items-start gap-3"
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            h.is_internal ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {h.action}
                              {h.is_internal && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  Internal
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(h.created_at)}
                            </span>
                          </div>
                          {h.comment && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {h.comment}
                            </p>
                          )}
                          {h.performed_by_name && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Actor: {h.performed_by_name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No history records logged.</p>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {isRejectModalOpen && selectedComplaint && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Reject Complaint #{selectedComplaint.complaint_reference}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Please state the official administrative reason for rejecting this complaint. This reason will be recorded and communicated to the student.
            </p>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Issue already addressed under maintenance ticket #412 / Duplicate request..."
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleReject}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
