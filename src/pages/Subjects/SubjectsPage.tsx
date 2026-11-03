import React, { useState, useEffect, useMemo } from 'react';
import { Subject, ClassLevel, SubjectDependencySummary } from '@/types/database';
import { academicStructureApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Search,
  RotateCcw,
  ShieldAlert,
  Archive,
  Layers,
  Clock,
} from 'lucide-react';

interface SubjectFormData {
  name: string;
  code: string;
  class_id: string;
  description: string;
  is_elective: boolean;
  credit_hours: number;
  is_active: boolean;
  status: 'Active' | 'Inactive';
}

const INITIAL_FORM_DATA: SubjectFormData = {
  name: '',
  code: '',
  class_id: '',
  description: '',
  is_elective: false,
  credit_hours: 5,
  is_active: true,
  status: 'Active',
};

export const SubjectsPage: React.FC = () => {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<SubjectFormData>(INITIAL_FORM_DATA);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Deletion Check State
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);
  const [dependencySummary, setDependencySummary] = useState<SubjectDependencySummary | null>(null);

  // Notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actor = {
    id: user?.id,
    name: user?.full_name || 'System Admin',
    role: role || 'admin',
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sList, cList] = await Promise.all([
        academicStructureApi.getSubjects(),
        academicStructureApi.getClasses(),
      ]);
      setSubjects(sList);
      setClasses(cList);
    } catch (e) {
      console.error('Failed to load curriculum subjects', e);
      setFeedback({ type: 'error', message: 'Failed to load curriculum data from database.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-dismiss feedback after 6 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Combined Filtering Logic
  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      // 1. Class Filter
      if (selectedClassId !== 'all') {
        if (subject.class_id !== selectedClassId) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        const subjectStatus = subject.status || (subject.is_active === false ? 'Inactive' : 'Active');
        if (subjectStatus !== statusFilter) return false;
      }

      // 3. Search Query (Name or Code or Description)
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const matchesName = subject.name?.toLowerCase().includes(term);
        const matchesCode = subject.code?.toLowerCase().includes(term);
        const matchesDesc = subject.description?.toLowerCase().includes(term);
        const matchesClass = subject.class?.name.toLowerCase().includes(term);
        if (!matchesName && !matchesCode && !matchesDesc && !matchesClass) return false;
      }

      return true;
    });
  }, [subjects, selectedClassId, statusFilter, searchQuery]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = subjects.length;
    const active = subjects.filter((s) => s.is_active !== false && s.status !== 'Inactive').length;
    const core = subjects.filter((s) => !s.is_elective).length;
    const elective = subjects.filter((s) => s.is_elective).length;
    return { total, active, core, elective };
  }, [subjects]);

  // Handle Add Subject Modal
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      code: '',
      class_id: selectedClassId !== 'all' ? selectedClassId : classes[0]?.id || '',
      description: '',
      is_elective: false,
      credit_hours: 5,
      is_active: true,
      status: 'Active',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: 'Subject Title is required.' });
      return;
    }
    if (!formData.class_id) {
      setFeedback({ type: 'error', message: 'Please select a Class Level for this subject.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await academicStructureApi.createSubject(
        {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          class_id: formData.class_id,
          description: formData.description.trim() || undefined,
          is_elective: formData.is_elective,
          credit_hours: Number(formData.credit_hours) || 4,
          is_active: formData.is_active,
          status: formData.status,
        },
        actor
      );

      setIsAddModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Subject "${created.name}" (${created.code}) created successfully.`,
      });
      await loadData();
    } catch (err: any) {
      console.error('Create subject failed', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to create subject.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Subject Modal
  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject);
    const isActive = subject.is_active !== false && subject.status !== 'Inactive';
    setFormData({
      name: subject.name,
      code: subject.code || '',
      class_id: subject.class_id || classes[0]?.id || '',
      description: subject.description || '',
      is_elective: !!subject.is_elective,
      credit_hours: subject.credit_hours || 4,
      is_active: isActive,
      status: isActive ? 'Active' : 'Inactive',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: 'Subject Title is required.' });
      return;
    }

    const targetIsActive = formData.status === 'Active';

    setIsSubmitting(true);
    try {
      const updated = await academicStructureApi.updateSubject(
        editingSubject.id,
        {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          class_id: formData.class_id,
          description: formData.description.trim(),
          is_elective: formData.is_elective,
          credit_hours: Number(formData.credit_hours) || 4,
          is_active: targetIsActive,
          status: targetIsActive ? 'Active' : 'Inactive',
        },
        actor
      );

      setIsEditModalOpen(false);
      setEditingSubject(null);
      await loadData();
      setFeedback({
        type: 'success',
        message: `Subject "${updated.name}" updated successfully. Status is now ${updated.is_active ? 'Active' : 'Inactive'}.`,
      });
    } catch (err: any) {
      console.error('Update subject failed', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to update subject.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Subject Modal & Dependency Verification
  const handleOpenDelete = async (subject: Subject) => {
    setDeletingSubject(subject);
    setDependencySummary(null);
    setIsDeleteModalOpen(true);
    setIsCheckingDependencies(true);

    try {
      const summary = await academicStructureApi.checkSubjectDependencies(subject.id);
      setDependencySummary(summary);
    } catch (err: any) {
      console.error('Failed to inspect subject dependencies', err);
      setFeedback({
        type: 'error',
        message: `Failed to inspect dependencies: ${err.message}`,
      });
    } finally {
      setIsCheckingDependencies(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deletingSubject) return;
    setIsSubmitting(true);
    try {
      const res = await academicStructureApi.deleteSubject(deletingSubject.id, actor);
      setSubjects((prev) => prev.filter((s) => s.id !== deletingSubject.id));
      setIsDeleteModalOpen(false);
      setDeletingSubject(null);
      setDependencySummary(null);
      await loadData();
      setFeedback({ type: 'success', message: res.message });
    } catch (err: any) {
      console.error('Permanent delete failed', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to delete subject.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateInstead = async () => {
    if (!deletingSubject) return;
    setIsSubmitting(true);
    try {
      const updated = await academicStructureApi.updateSubject(
        deletingSubject.id,
        { is_active: false, status: 'Inactive' },
        actor
      );

      setSubjects((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? { ...updated, is_active: false, status: 'Inactive', class: classes.find((c) => c.id === updated.class_id) }
            : s
        )
      );

      setIsDeleteModalOpen(false);
      setDeletingSubject(null);
      setDependencySummary(null);
      await loadData();
      setFeedback({
        type: 'success',
        message: `Subject "${updated.name}" was safely deactivated. Historical records and marks remain preserved.`,
      });
    } catch (err: any) {
      console.error('Deactivation failed', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to deactivate subject.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedClassId('all');
    setSearchQuery('');
    setStatusFilter('all');
  };

  const hasActiveFilters = selectedClassId !== 'all' || searchQuery.trim() !== '' || statusFilter !== 'all';

  // Table Columns
  const columns: Column<Subject>[] = [
    {
      key: 'code',
      header: 'Subject Code',
      sortable: true,
      className: 'w-32',
      render: (row) => (
        <span className="inline-flex items-center font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-brand-300 border border-slate-200 dark:border-slate-700">
          {row.code || '—'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Subject Title & Description',
      sortable: true,
      render: (row) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{row.name}</span>
            {row.is_elective && (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Elective
              </span>
            )}
          </div>
          {row.description ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{row.description}</p>
          ) : (
            <p className="text-xs italic text-slate-400 dark:text-slate-500">No description provided</p>
          )}
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class Level',
      sortable: true,
      className: 'w-40',
      render: (row) => {
        const clsName = row.class?.name || classes.find((c) => c.id === row.class_id)?.name;
        return (
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
              {clsName || 'All Classes'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Curriculum Type',
      className: 'w-36',
      render: (row) => (
        <Badge variant={row.is_elective ? 'warning' : 'default'} size="sm">
          {row.is_elective ? 'Elective' : 'Core Compulsory'}
        </Badge>
      ),
    },
    {
      key: 'credit_hours',
      header: 'Weekly Periods',
      sortable: true,
      className: 'w-36',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.credit_hours || 4} periods/week</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-28',
      render: (row) => {
        const isActive = row.is_active !== false && row.status !== 'Inactive';
        return (
          <Badge variant={isActive ? 'success' : 'outline'} size="sm">
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: <span className="text-right block">Actions</span>,
      className: 'w-32 text-right',
      render: (row) => {
        if (!isAdmin) {
          return <span className="text-xs text-slate-400 italic">Read-only</span>;
        }
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              title="Edit Subject"
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => handleOpenEdit(row)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Delete Subject"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleOpenDelete(row)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Add Subject Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-navy-50 dark:bg-navy-950/50 rounded-lg border border-navy-100 dark:border-navy-800 text-navy-800 dark:text-brand-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Curriculum & Subjects
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage subject allocations, class level associations, and academic course structures
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
            className="shadow-sm"
          >
            Add Subject
          </Button>
        )}
      </div>

      {/* 2. Notification / Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-lg border flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs font-medium leading-relaxed">{feedback.message}</div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Subjects</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {metrics.total}
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active Subjects</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {metrics.active}
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Core Compulsory</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {metrics.core}
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Elective Tracks</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {metrics.elective}
          </p>
        </div>
      </div>

      {/* 4. Controls & Filters Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Class Filter (Very Important) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="w-full sm:w-56">
              <label htmlFor="class-filter" className="sr-only">
                Filter by Class
              </label>
              <div className="relative">
                <Select
                  id="class-filter"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  options={[
                    { value: 'all', label: `All Classes (${subjects.length})` },
                    ...classes.map((c) => {
                      const count = subjects.filter((s) => s.class_id === c.id).length;
                      return {
                        value: c.id,
                        label: `${c.name} (${count})`,
                      };
                    }),
                  ]}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-44">
              <label htmlFor="status-filter" className="sr-only">
                Filter by Status
              </label>
              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'Active', label: 'Active Only' },
                  { value: 'Inactive', label: 'Inactive Only' },
                ]}
              />
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject name, code, or description..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-navy-900 dark:focus:ring-brand-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleResetFilters}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>

        {/* Active Filter Chips indicator */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Active Filters:</span>
            {selectedClassId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-navy-50 dark:bg-navy-950/60 text-navy-800 dark:text-brand-300 border border-navy-200 dark:border-navy-800">
                Class: {classes.find((c) => c.id === selectedClassId)?.name || selectedClassId}
                <button onClick={() => setSelectedClassId('all')} className="hover:text-red-500 ml-1">
                  ✕
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="hover:text-red-500 ml-1">
                  ✕
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Search: &quot;{searchQuery}&quot;
                <button onClick={() => setSearchQuery('')} className="hover:text-red-500 ml-1">
                  ✕
                </button>
              </span>
            )}
            <span className="text-slate-400 text-[11px] ml-auto">
              Showing {filteredSubjects.length} of {subjects.length} subjects
            </span>
          </div>
        )}
      </div>

      {/* 5. Subjects Table */}
      <DataTable
        data={filteredSubjects}
        columns={columns}
        isLoading={isLoading}
        rowKey={(s) => s.id}
        emptyTitle={hasActiveFilters ? 'No matching subjects found' : 'No curriculum subjects available'}
        emptyDescription={
          hasActiveFilters
            ? 'Try adjusting your class filter, status selection, or search query.'
            : 'Click "Add Subject" above to register subjects for your classes.'
        }
      />

      {/* 6. MODAL: Add Subject */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="Add Curriculum Subject"
        size="md"
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <Input
            label="Subject Title"
            required
            placeholder="e.g. Pakistan Studies or General Science"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Subject Code"
                placeholder="e.g. PST-07 (optional)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Auto-generated if left blank</p>
            </div>

            <Select
              label="Target Class"
              required
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              value={formData.class_id}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject Description (Optional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Outline course scope, textbook reference, or syllabus requirements..."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2.5 focus:outline-hidden focus:ring-2 focus:ring-navy-900 dark:focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Weekly Periods"
              type="number"
              min={1}
              max={20}
              required
              value={formData.credit_hours}
              onChange={(e) => setFormData({ ...formData, credit_hours: Number(e.target.value) })}
            />

            <Select
              label="Subject Status"
              options={[
                { value: 'Active', label: 'Active (Available for teaching & exams)' },
                { value: 'Inactive', label: 'Inactive (Archived / Not scheduled)' },
              ]}
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as 'Active' | 'Inactive',
                  is_active: e.target.value === 'Active',
                })
              }
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_elective_add"
              checked={formData.is_elective}
              onChange={(e) => setFormData({ ...formData, is_elective: e.target.checked })}
              className="rounded text-navy-900 focus:ring-navy-900 w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="is_elective_add"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Elective subject (optional / track-specific)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. MODAL: Edit Subject */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title={editingSubject ? `Edit Subject — ${editingSubject.name}` : 'Edit Subject'}
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Subject Title"
            required
            placeholder="e.g. Mathematics"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Subject Code"
                placeholder="e.g. MTH-09"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Unique course identifier</p>
            </div>

            <Select
              label="Target Class"
              required
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              value={formData.class_id}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Outline course scope, syllabus requirements, etc."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2.5 focus:outline-hidden focus:ring-2 focus:ring-navy-900 dark:focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Weekly Periods"
              type="number"
              min={1}
              max={20}
              required
              value={formData.credit_hours}
              onChange={(e) => setFormData({ ...formData, credit_hours: Number(e.target.value) })}
            />

            <Select
              label="Subject Status"
              options={[
                { value: 'Active', label: 'Active (Available for teaching & exams)' },
                { value: 'Inactive', label: 'Inactive (Archived / Not scheduled)' },
              ]}
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as 'Active' | 'Inactive',
                  is_active: e.target.value === 'Active',
                })
              }
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_elective_edit"
              checked={formData.is_elective}
              onChange={(e) => setFormData({ ...formData, is_elective: e.target.checked })}
              className="rounded text-navy-900 focus:ring-navy-900 w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="is_elective_edit"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Elective subject (optional / track-specific)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. MODAL: Delete Subject & Safe Dependency Verification */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
        title="Subject Deletion & Safety Verification"
        size="md"
      >
        <div className="space-y-4">
          {/* Deletion candidate info */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {deletingSubject?.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Code: <span className="font-mono">{deletingSubject?.code || 'None'}</span> • Target:{' '}
                  {deletingSubject?.class?.name || classes.find((c) => c.id === deletingSubject?.class_id)?.name || 'All'}
                </p>
              </div>
              <Badge variant={deletingSubject?.is_active !== false ? 'success' : 'outline'} size="sm">
                {deletingSubject?.status || 'Active'}
              </Badge>
            </div>
          </div>

          {/* Dependency Scan in Progress */}
          {isCheckingDependencies && (
            <div className="p-6 text-center space-y-2">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-navy-900 dark:border-brand-400 border-t-transparent" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Scanning institutional academic dependencies (marks, quizzes, exams, diaries)...
              </p>
            </div>
          )}

          {/* Dependency Results */}
          {!isCheckingDependencies && dependencySummary && (
            <>
              {/* CASE A: Deletion Blocked due to dependencies */}
              {!dependencySummary.canDelete ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Deletion Blocked — Linked Academic Records Found
                      </h5>
                      <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                        This subject cannot be permanently deleted because historical institutional records depend on it.
                        Deleting it would destroy past report cards, examination marks, and attendance archives.
                      </p>
                    </div>
                  </div>

                  {/* Dependency Breakdown */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Active Dependency Breakdown ({dependencySummary.dependencies.total} records total):
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Teacher Assignments:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {dependencySummary.dependencies.teacherAssignments}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Exam Schedules:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {dependencySummary.dependencies.examSubjects}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Student Exam Marks:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {dependencySummary.dependencies.marks}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Quizzes & Marks:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {dependencySummary.dependencies.quizzes + dependencySummary.dependencies.quizMarks}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 flex justify-between col-span-2">
                        <span className="text-slate-600 dark:text-slate-400">Daily Diary Entries:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {dependencySummary.dependencies.dailyDiaries}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation to Deactivate */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
                    <p className="font-semibold">Recommended Safe Alternative:</p>
                    <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                      Deactivate this subject. It will be immediately archived from active class schedules while
                      safely preserving all existing marks, student report cards, and historical records.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      type="button"
                      isLoading={isSubmitting}
                      leftIcon={<Archive className="w-4 h-4" />}
                      onClick={handleDeactivateInstead}
                      className="bg-navy-900 hover:bg-navy-800 text-white"
                    >
                      Deactivate Subject Instead
                    </Button>
                  </div>
                </div>
              ) : (
                /* CASE B: Safe Deletion Allowed (0 dependencies) */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Safe to Delete
                      </h5>
                      <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-200 mt-0.5">
                        No linked examination marks, quizzes, diaries, or teacher assignments depend on this subject.
                        It can be removed cleanly without affecting academic records.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Are you sure you want to permanently delete{' '}
                    <strong className="text-slate-900 dark:text-slate-100">{deletingSubject?.name}</strong>? This
                    action cannot be undone.
                  </p>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      type="button"
                      isLoading={isSubmitting}
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={handleConfirmPermanentDelete}
                    >
                      Delete Permanently
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
