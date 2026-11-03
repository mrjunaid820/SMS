import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { complaintApi, studentPortalApi } from '@/services/api';
import {
  StudentComplaint,
  ComplaintCategory,
  ComplaintStatus,
  Student,
  Enrollment,
} from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  MessageSquareWarning,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  ShieldAlert,
  Search,
  Filter,
  ArrowLeft,
  X,
  Send,
  Eye,
  CheckCircle,
  HelpCircle,
  User,
  GraduationCap,
  Calendar,
  Lock,
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

export const MyComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [studentInfo, setStudentInfo] = useState<{
    student: Student;
    enrollment?: Enrollment;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'submit'>('list');

  // Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('School Facilities');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentPath, setAttachmentPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Detail Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<StudentComplaint | null>(null);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const identifier = user.id || user.email || '';
      const info = await studentPortalApi.getStudentSelf(identifier);
      setStudentInfo(info);

      const items = await complaintApi.getMyComplaints(identifier);
      setComplaints(items);
    } catch (err: any) {
      console.error('Failed to load student complaints', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be under 5 MB.');
        return;
      }
      setAttachmentName(file.name);
      // In web app, create a local preview object URL or safe string
      const fakeUrl = URL.createObjectURL(file);
      setAttachmentPath(fakeUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setFormError('Please enter a clear complaint subject.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setFormError('Please enter a detailed description (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const identifier = user?.id || user?.email || '';
      const created = await complaintApi.submitComplaint(
        {
          subject: subject.trim(),
          category,
          description: description.trim(),
          attachment_name: attachmentName || undefined,
          attachment_path: attachmentPath || undefined,
        },
        identifier
      );

      setFormSuccess(
        `Your complaint has been submitted successfully with Reference #${created.complaint_reference}. School administration will review it.`
      );
      // Reset form
      setSubject('');
      setDescription('');
      setCategory('School Facilities');
      setAttachmentName('');
      setAttachmentPath('');

      // Refresh list
      await loadData();

      // Return to list after short delay
      setTimeout(() => {
        setActiveTab('list');
        setFormSuccess(null);
      }, 2500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit complaint. Please try again.');
    } finally {
      setIsSubmitting(false);
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
      c.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <MessageSquareWarning className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Complaints & Feedback
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Submit confidential concerns directly to school administration.
            </p>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'list' ? (
            <button
              onClick={() => setActiveTab('submit')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Complaint</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('list')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to My Complaints</span>
            </button>
          )}
        </div>
      </div>

      {/* Strict Privacy Notice Banner */}
      <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-3.5 sm:p-4 flex items-start gap-3">
        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
          <strong className="font-semibold">Strict Confidentiality Guaranteed:</strong> All student complaints are routed strictly and exclusively to authorized School Administrators (Principal & Admin Office). Teachers have no access to view or manage student complaints.
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'submit' ? (
        /* Submission Form View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Submit a New Complaint or Feedback
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Please provide clear and truthful details so the administration can investigate and assist promptly.
            </p>
          </div>

          {/* Student Identity Card (Read-only, auto-associated) */}
          {studentInfo && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                Authenticated Student Record
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Student Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {studentInfo.student.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Admission No:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {studentInfo.student.admission_no}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Class & Section:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {studentInfo.enrollment?.section
                      ? `${studentInfo.enrollment.section.class?.name || 'Class 9'} - ${studentInfo.enrollment.section.name}`
                      : 'Class 9 - A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Roll Number:</span>
                  <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                    #{studentInfo.enrollment?.roll_no ?? '1'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl p-3 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Complaint Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue (e.g. Science Lab microscope adjustment)"
                maxLength={150}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Complaint Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Complaint Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe your concern in your own words with dates, location, and relevant context..."
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Optional Attachment */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Optional Attachment (PDF, Image, or Document - Max 5 MB)
              </label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                  />
                </label>
                {attachmentName ? (
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                    <FileText className="w-4 h-4" />
                    <span>{attachmentName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName('');
                        setAttachmentPath('');
                      }}
                      className="text-slate-400 hover:text-rose-500 ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">No file attached</span>
                )}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Submit Complaint</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Complaint History View */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search complaints or ref #..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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
            </div>
          </div>

          {/* Complaints Table / List */}
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading your complaints...</p>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                No Complaints Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'No complaints match your active filter criteria.'
                  : 'You have not submitted any complaints or feedback yet. Click "New Complaint" above to submit one.'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Ref #</th>
                      <th className="py-3.5 px-4">Subject</th>
                      <th className="py-3.5 px-4">Category</th>
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
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                          {c.subject}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
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
                            onClick={() => setSelectedComplaint(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Complaint Details Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-in fade-in-50 zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60">
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meta Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl text-xs border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Category:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedComplaint.category}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Submitted On:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatDate(selectedComplaint.created_at)}
                </span>
              </div>
              {selectedComplaint.resolved_at && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Resolved On:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatDate(selectedComplaint.resolved_at)}
                  </span>
                </div>
              )}
            </div>

            {/* Complaint Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Your Complaint Description
              </h4>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs text-slate-800 dark:text-slate-200 leading-relaxed border border-slate-200/60 dark:border-slate-800 whitespace-pre-wrap">
                {selectedComplaint.description}
              </div>
            </div>

            {/* Attachment if present */}
            {selectedComplaint.attachment_name && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <span className="text-slate-500 dark:text-slate-400">Attached File:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedComplaint.attachment_name}
                </span>
              </div>
            )}

            {/* Official Administration Response (Green/Blue card) */}
            {selectedComplaint.admin_response && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Official Administration Response
                </h4>
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed whitespace-pre-wrap">
                  {selectedComplaint.admin_response}
                </div>
              </div>
            )}

            {/* Rejection Reason if Rejected */}
            {selectedComplaint.status === 'Rejected' && selectedComplaint.rejection_reason && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Administration Decision / Rejection Reason
                </h4>
                <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-4 rounded-xl text-xs text-rose-900 dark:text-rose-200 leading-relaxed whitespace-pre-wrap">
                  {selectedComplaint.rejection_reason}
                </div>
              </div>
            )}

            {/* Milestone Timeline (Public non-internal history) */}
            {selectedComplaint.history && selectedComplaint.history.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Status Timeline
                </h4>
                <div className="space-y-2">
                  {selectedComplaint.history.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="flex items-start gap-3 text-xs bg-slate-50/60 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {h.action}
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
