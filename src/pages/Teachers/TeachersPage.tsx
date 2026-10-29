import React, { useState, useEffect, useMemo } from 'react';
import { Teacher, TeacherAssignment, ClassLevel, Section, Subject, Profile } from '@/types/database';
import { teacherApi, academicStructureApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import {
  UserPlus,
  UserCheck,
  UserX,
  BookOpen,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Plus,
  ShieldAlert,
  KeyRound,
  Lock,
  Check,
  Copy,
  Sparkles,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

export const TeachersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { selectedSessionId } = useSchool();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManageLoginModalOpen, setIsManageLoginModalOpen] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Form State for Add
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    phone: '',
    email: '',
    qualification: '',
    joining_date: new Date().toISOString().split('T')[0],
    designation: 'Senior Subject Master',
  });

  // Form State for Admin Editing (Profile details only)
  const [editFormData, setEditFormData] = useState({
    employee_id: '',
    full_name: '',
    phone: '',
    qualification: '',
    joining_date: '',
    designation: '',
    is_active: true,
  });
  const [editAssignments, setEditAssignments] = useState<
    { section_id: string; subject_id: string; is_class_teacher?: boolean }[]
  >([]);
  const [newAssignSectionId, setNewAssignSectionId] = useState('');
  const [newAssignSubjectId, setNewAssignSubjectId] = useState('');
  const [newAssignIsClassTeacher, setNewAssignIsClassTeacher] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // State for Manage Login Modal
  const [loginTeacher, setLoginTeacher] = useState<Teacher | null>(null);
  const [loginTeacherProfile, setLoginTeacherProfile] = useState<Profile | null>(null);
  const [newLoginEmail, setNewLoginEmail] = useState('');
  const [loginPasswordMethod, setLoginPasswordMethod] = useState<'temp' | 'link'>('temp');
  const [newTemporaryPassword, setNewTemporaryPassword] = useState('');
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Single Teacher Portal Toggle Confirmation State
  const [teacherPortalToggleConfirm, setTeacherPortalToggleConfirm] = useState<{
    isOpen: boolean;
    teacher: Teacher | null;
    active: boolean;
  }>({
    isOpen: false,
    teacher: null,
    active: false,
  });

  // State for Multi-selection & Bulk Operations
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [bulkActionType, setBulkActionType] = useState<'activate' | 'deactivate' | 'reactivate'>('activate');
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkDefaultPassword, setBulkDefaultPassword] = useState('Teacher123!');
  const [isBulkReportOpen, setIsBulkReportOpen] = useState(false);
  const [bulkReport, setBulkReport] = useState<{
    total: number;
    successCount: number;
    skippedCount: number;
    failedCount: number;
    results: any[];
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tList, aList, cList, secList, subList] = await Promise.all([
        teacherApi.getTeachers(),
        teacherApi.getAssignments(),
        academicStructureApi.getClasses(),
        academicStructureApi.getSections(),
        academicStructureApi.getSubjects(),
      ]);
      setTeachers(tList);
      setAssignments(aList);
      setClasses(cList);
      setSections(secList);
      setSubjects(subList);
    } catch (e) {
      console.error('Failed to load teachers data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    const nextId = `EMP-T${String(100 + teachers.length + 1)}`;
    setFormData({
      employee_id: nextId,
      full_name: '',
      phone: '',
      email: '',
      qualification: 'M.Sc. Mathematics, B.Ed',
      joining_date: new Date().toISOString().split('T')[0],
      designation: 'Subject Teacher',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setEditFormData({
      employee_id: teacher.employee_id,
      full_name: teacher.full_name,
      phone: teacher.phone || '',
      qualification: teacher.qualification,
      joining_date: teacher.joining_date,
      designation: teacher.designation,
      is_active: teacher.is_active,
    });

    const currentTeacherAssignments = assignments
      .filter((a) => a.teacher_id === teacher.id && (!selectedSessionId || a.academic_session_id === selectedSessionId))
      .map((a) => ({
        section_id: a.section_id,
        subject_id: a.subject_id,
        is_class_teacher: a.is_class_teacher || false,
      }));
    setEditAssignments(currentTeacherAssignments);
    setNewAssignSectionId(sections[0]?.id || '');
    setNewAssignSubjectId(subjects[0]?.id || '');
    setNewAssignIsClassTeacher(false);
    setEditError(null);
    setEditSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleOpenManageLogin = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setLoginTeacher(teacher);
    setNewLoginEmail(teacher.email || '');
    setLoginPasswordMethod('temp');
    setNewTemporaryPassword(teacher.profile_id ? `Tch-${Math.random().toString(36).slice(-6)}!` : 'Teacher123!');
    setLoginError(null);
    setLoginSuccess(null);
    setCopiedCredentials(false);
    setIsManageLoginModalOpen(true);

    try {
      const profile = await teacherApi.ensureTeacherProfile(teacher.id, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role,
      });
      setLoginTeacherProfile(profile);
    } catch (e: any) {
      console.error('Failed to ensure teacher profile', e);
    }
  };

  const handleProvisionTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginTeacher) return;
    setLoginError(null);
    setLoginSuccess(null);

    const email = newLoginEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError('Validation Error: A valid email address is required.');
      return;
    }

    if (!newTemporaryPassword || newTemporaryPassword.length < 6) {
      setLoginError('Validation Error: Initial password must be at least 6 characters.');
      return;
    }

    setIsLoginSubmitting(true);
    try {
      const res = await teacherApi.provisionTeacherAccount(
        loginTeacher.id,
        email,
        newTemporaryPassword,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setLoginSuccess(res.message);
      await loadData();
      // Update local modal state to reflect active status
      setLoginTeacher({ ...loginTeacher, email, profile_id: res.user_id || 'active' });
    } catch (err: any) {
      setLoginError(err.message || 'Failed to provision teacher portal account.');
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  // Groups of teachers in current view
  const unprovisionedTeachers = useMemo(() => {
    return teachers.filter((t) => t.portal_status === 'not_provisioned' || !t.profile_id);
  }, [teachers]);

  const activePortalTeachers = useMemo(() => {
    return teachers.filter((t) => t.portal_status === 'active' || (t.profile_id && t.is_active && t.portal_status !== 'inactive'));
  }, [teachers]);

  const inactivePortalTeachers = useMemo(() => {
    return teachers.filter((t) => t.portal_status === 'inactive' || (t.profile_id && !t.is_active));
  }, [teachers]);

  const eligibleBulkTeachers = useMemo(() => {
    const selected = teachers.filter((t) => selectedTeacherIds.has(t.id));
    if (bulkActionType === 'activate') {
      return selected.filter((t) => t.portal_status === 'not_provisioned' || !t.profile_id);
    }
    if (bulkActionType === 'deactivate') {
      return selected.filter((t) => t.portal_status === 'active' || (t.profile_id && t.is_active && t.portal_status !== 'inactive'));
    }
    if (bulkActionType === 'reactivate') {
      return selected.filter((t) => t.portal_status === 'inactive' || (t.profile_id && !t.is_active));
    }
    return selected;
  }, [teachers, selectedTeacherIds, bulkActionType]);

  const selectedUnprovisionedCount = useMemo(() => {
    return teachers.filter((t) => selectedTeacherIds.has(t.id) && (t.portal_status === 'not_provisioned' || !t.profile_id)).length;
  }, [teachers, selectedTeacherIds]);

  const selectedActiveCount = useMemo(() => {
    return teachers.filter((t) => selectedTeacherIds.has(t.id) && (t.portal_status === 'active' || (t.profile_id && t.is_active && t.portal_status !== 'inactive'))).length;
  }, [teachers, selectedTeacherIds]);

  const selectedInactiveCount = useMemo(() => {
    return teachers.filter((t) => selectedTeacherIds.has(t.id) && (t.portal_status === 'inactive' || (t.profile_id && !t.is_active))).length;
  }, [teachers, selectedTeacherIds]);

  const handleToggleSelectTeacher = (id: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTeachers = () => {
    setSelectedTeacherIds(new Set(teachers.map((t) => t.id)));
  };

  const handleSelectAllUnprovisionedTeachers = () => {
    setSelectedTeacherIds(new Set(unprovisionedTeachers.map((t) => t.id)));
  };

  const handleSelectAllActiveTeachers = () => {
    setSelectedTeacherIds(new Set(activePortalTeachers.map((t) => t.id)));
  };

  const handleSelectAllInactiveTeachers = () => {
    setSelectedTeacherIds(new Set(inactivePortalTeachers.map((t) => t.id)));
  };

  const handleClearTeacherSelection = () => {
    setSelectedTeacherIds(new Set());
  };

  const handleStartBulkTeacherAction = (action: 'activate' | 'deactivate' | 'reactivate') => {
    setBulkActionType(action);
    setBulkDefaultPassword('Teacher123!');
    setIsBulkConfirmOpen(true);
  };

  const handleExecuteBulkTeacherAction = async () => {
    setIsBulkConfirmOpen(false);
    setIsBulkSubmitting(true);
    try {
      const idsArray = eligibleBulkTeachers.map((t) => t.id);
      if (bulkActionType === 'activate') {
        const report = await teacherApi.bulkProvisionTeacherAccounts(
          idsArray,
          bulkDefaultPassword,
          { id: user?.id, name: user?.full_name, role: user?.role }
        );
        setBulkReport(report);
      } else {
        const isReactivating = bulkActionType === 'reactivate';
        const report = await teacherApi.bulkSetPortalActive(
          idsArray,
          isReactivating,
          { id: user?.id, name: user?.full_name, role: user?.role }
        );
        setBulkReport(report);
      }
      setIsBulkReportOpen(true);
      setSelectedTeacherIds(new Set());
      await loadData();
    } catch (err: any) {
      alert(`Bulk operation error: ${err.message}`);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Single Teacher Portal Toggle Handlers
  const handleToggleTeacherPortalDirect = (teacher: Teacher, active: boolean) => {
    setTeacherPortalToggleConfirm({
      isOpen: true,
      teacher,
      active,
    });
  };

  const handleExecuteTeacherPortalToggle = async () => {
    if (!teacherPortalToggleConfirm.teacher) return;
    try {
      const res = await teacherApi.setPortalActive(
        teacherPortalToggleConfirm.teacher.id,
        teacherPortalToggleConfirm.active,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setTeacherPortalToggleConfirm({ isOpen: false, teacher: null, active: false });
      await loadData();
      alert(res.message);
    } catch (err: any) {
      alert(`Failed to update teacher portal status: ${err.message}`);
    }
  };

  const handleAddAssignment = () => {
    if (!newAssignSectionId || !newAssignSubjectId) return;
    const exists = editAssignments.some(
      (a) => a.section_id === newAssignSectionId && a.subject_id === newAssignSubjectId
    );
    if (exists) {
      alert('This subject assignment for this section already exists.');
      return;
    }
    setEditAssignments([
      ...editAssignments,
      {
        section_id: newAssignSectionId,
        subject_id: newAssignSubjectId,
        is_class_teacher: newAssignIsClassTeacher,
      },
    ]);
    setNewAssignIsClassTeacher(false);
  };

  const handleRemoveAssignment = (index: number) => {
    setEditAssignments(editAssignments.filter((_, i) => i !== index));
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.employee_id || !formData.qualification) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      await teacherApi.createTeacher(
        {
          employee_id: formData.employee_id,
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email,
          qualification: formData.qualification,
          joining_date: formData.joining_date,
          designation: formData.designation,
          is_active: true,
        },
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error saving teacher: ${err.message}`);
    }
  };

  const handleUpdateTeacherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    setEditError(null);
    setEditSuccess(null);

    if (!editFormData.full_name.trim() || !editFormData.employee_id.trim() || !editFormData.qualification.trim()) {
      setEditError('Please fill out all required fields (Full Name, Employee ID, Qualification).');
      return;
    }

    setIsEditSubmitting(true);
    try {
      await teacherApi.updateTeacherFull(
        selectedTeacher.id,
        {
          employee_id: editFormData.employee_id.trim(),
          full_name: editFormData.full_name.trim(),
          phone: editFormData.phone.trim(),
          qualification: editFormData.qualification.trim(),
          joining_date: editFormData.joining_date,
          designation: editFormData.designation.trim(),
          is_active: editFormData.is_active,
        },
        editAssignments,
        selectedSessionId,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );

      setEditSuccess(`Teacher profile for "${editFormData.full_name}" successfully updated.`);
      await loadData();
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(null);
      }, 1000);
    } catch (err: any) {
      setEditError(err.message || 'Database error: Failed to update teacher profile.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleUpdateLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginTeacher) return;
    setLoginError(null);
    setLoginSuccess(null);

    if (!newLoginEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLoginEmail.trim())) {
      setLoginError('Validation Error: Please enter a valid email address.');
      return;
    }

    setIsLoginSubmitting(true);
    try {
      const res = await teacherApi.updateTeacherLoginEmail(
        loginTeacher.id,
        newLoginEmail.trim(),
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setLoginSuccess(res.message);
      await loadData();
    } catch (err: any) {
      setLoginError(err.message || 'Database error: Failed to update teacher login email.');
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleResetTeacherPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginTeacher) return;
    setLoginError(null);
    setLoginSuccess(null);

    if (loginPasswordMethod === 'temp' && (!newTemporaryPassword || newTemporaryPassword.length < 6)) {
      setLoginError('Validation Error: Temporary password must be at least 6 characters.');
      return;
    }

    setIsLoginSubmitting(true);
    try {
      const res = await teacherApi.resetTeacherPassword(
        loginTeacher.id,
        {
          temporaryPassword: loginPasswordMethod === 'temp' ? newTemporaryPassword : undefined,
          sendResetLink: loginPasswordMethod === 'link',
        },
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setLoginSuccess(res.message);
    } catch (err: any) {
      setLoginError(err.message || 'Database error: Failed to process password reset.');
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleToggleStatus = async (teacher: Teacher) => {
    try {
      await teacherApi.updateTeacherFull(
        teacher.id,
        { is_active: !teacher.is_active },
        undefined,
        selectedSessionId,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      await loadData();
    } catch (err: any) {
      alert(`Error updating teacher status: ${err.message}`);
    }
  };

  const columns: Column<Teacher>[] = [
    ...(isAdmin
      ? [
          {
            key: 'selection',
            header: (
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  checked={teachers.length > 0 && teachers.every((t) => selectedTeacherIds.has(t.id))}
                  onChange={(e) => {
                    if (e.target.checked) handleSelectAllTeachers();
                    else handleClearTeacherSelection();
                  }}
                  title="Select or deselect all teachers"
                />
              </div>
            ),
            className: 'w-10 text-center px-2',
            render: (row: Teacher) => (
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.has(row.id)}
                  onChange={() => handleToggleSelectTeacher(row.id)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  title={`Select ${row.full_name}`}
                />
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'employee_id',
      header: 'Employee ID',
      sortable: true,
      className: 'font-mono text-xs font-bold text-navy-900 dark:text-brand-400',
    },
    {
      key: 'full_name',
      header: 'Teacher Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{row.full_name}</div>
          <div className="text-[11px] text-slate-500">{row.designation}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <Phone className="w-3 h-3 text-slate-400" />
            <span>{row.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <Mail className="w-3 h-3 text-slate-400" />
            <span className="truncate max-w-[150px] font-mono text-[11px]">{row.email || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'qualification',
      header: 'Qualification',
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">{row.qualification}</span>
      ),
    },
    {
      key: 'joining_date',
      header: 'Joined',
      sortable: true,
      render: (row) => formatDate(row.joining_date),
    },
    {
      key: 'assignments_count',
      header: 'Assigned Classes',
      render: (row) => {
        const count = assignments.filter((a) => a.teacher_id === row.id).length;
        return (
          <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
            {count} {count === 1 ? 'Subject' : 'Subjects'}
          </span>
        );
      },
    },
    {
      key: 'portal_status',
      header: 'Portal Access',
      render: (row) => {
        const status = row.portal_status || (!row.profile_id ? 'not_provisioned' : row.is_active ? 'active' : 'inactive');
        if (status === 'active') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Active
            </span>
          );
        }
        if (status === 'inactive') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <UserX className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              Inactive
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Not Provisioned
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Active' : 'Deactivated'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        const status = row.portal_status || (!row.profile_id ? 'not_provisioned' : row.is_active ? 'active' : 'inactive');
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => {
                setSelectedTeacher(row);
                setIsViewModalOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-navy-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="View Teaching Allocations"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            {isAdmin && (
              <button
                onClick={() => handleOpenEdit(row)}
                className="p-1.5 text-slate-500 hover:text-navy-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Edit Teacher Profile"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {isAdmin && (
              <>
                {status === 'not_provisioned' ? (
                  <button
                    onClick={() => handleOpenManageLogin(row)}
                    className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-md"
                    title="Activate Teacher Portal Account"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                ) : status === 'inactive' ? (
                  <button
                    onClick={() => handleToggleTeacherPortalDirect(row, true)}
                    className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md"
                    title="Reactivate Teacher Portal"
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleTeacherPortalDirect(row, false)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md"
                    title="Deactivate Teacher Portal"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenManageLogin(row)}
                  className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                  title="Manage Login & Password"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const unprovisionedCount = teachers.filter((t) => !t.profile_id && t.is_active).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Teacher Faculty Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Profiles, employment records, qualifications, subject assignments and login credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={handleOpenAdd}>
              Add New Teacher
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Selection Action Toolbar for Teachers */}
      {isAdmin && (
        <div className="p-3.5 bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-slate-800/90 dark:to-slate-900 border border-brand-200 dark:border-brand-900/50 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 text-white rounded-lg shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Teacher Faculty Portal Controls
                {selectedTeacherIds.size > 0 ? (
                  <Badge variant="info">
                    {selectedTeacherIds.size} teacher{selectedTeacherIds.size > 1 ? 's' : ''} selected
                  </Badge>
                ) : (
                  <Badge variant="default">
                    {unprovisionedTeachers.length} unprovisioned
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                Batch activate, deactivate, or reactivate faculty portal accounts
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={handleSelectAllUnprovisionedTeachers}
                disabled={unprovisionedTeachers.length === 0}
                className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[11px] font-medium disabled:opacity-40"
              >
                Unprovisioned ({unprovisionedTeachers.length})
              </button>
              <button
                type="button"
                onClick={handleSelectAllActiveTeachers}
                disabled={activePortalTeachers.length === 0}
                className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[11px] font-medium disabled:opacity-40"
              >
                Active ({activePortalTeachers.length})
              </button>
              <button
                type="button"
                onClick={handleSelectAllInactiveTeachers}
                disabled={inactivePortalTeachers.length === 0}
                className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[11px] font-medium disabled:opacity-40"
              >
                Inactive ({inactivePortalTeachers.length})
              </button>
            </div>

            {selectedTeacherIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearTeacherSelection}
                className="text-slate-600 dark:text-slate-400"
              >
                Clear
              </Button>
            )}

            <Button
              size="sm"
              variant="primary"
              disabled={selectedUnprovisionedCount === 0}
              onClick={() => handleStartBulkTeacherAction('activate')}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Bulk Activate ({selectedUnprovisionedCount})
            </Button>

            <Button
              size="sm"
              variant="danger"
              disabled={selectedActiveCount === 0}
              onClick={() => handleStartBulkTeacherAction('deactivate')}
              leftIcon={<UserX className="w-3.5 h-3.5" />}
            >
              Bulk Deactivate ({selectedActiveCount})
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={selectedInactiveCount === 0}
              onClick={() => handleStartBulkTeacherAction('reactivate')}
              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
            >
              Bulk Reactivate ({selectedInactiveCount})
            </Button>
          </div>
        </div>
      )}

      {/* Teachers DataTable */}
      <DataTable
        data={teachers}
        columns={columns}
        isLoading={isLoading}
        rowKey={(t) => t.id}
        searchPlaceholder="Search teachers by name, ID, qualification..."
        searchFilter={(row, term) => {
          return (
            row.full_name.toLowerCase().includes(term) ||
            row.employee_id.toLowerCase().includes(term) ||
            row.qualification.toLowerCase().includes(term)
          );
        }}
      />

      {/* 1. Modal: Add Teacher Form */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Teacher Profile"
        description="Registers faculty record and prepares login authorization"
        size="md"
      >
        <form onSubmit={handleSaveTeacher} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Employee ID"
              required
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            />
            <Input
              label="Designation"
              required
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            />
          </div>

          <Input
            label="Full Name"
            required
            placeholder="e.g. Prof. Tariq Mehmood"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              placeholder="+92 300 xxxxxxx"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="teacher@islamiapublic.edu.pk"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <Input
            label="Academic Qualification & Degree"
            required
            placeholder="e.g. M.Sc. Physics (Punjab University), B.Ed"
            value={formData.qualification}
            onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
          />

          <Input
            label="Joining Date"
            type="date"
            required
            value={formData.joining_date}
            onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Teacher Profile</Button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: View Teacher Assignments */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={selectedTeacher ? `${selectedTeacher.full_name} — Faculty Details` : 'Faculty Details'}
        size="md"
      >
        <div className="space-y-3">
          {selectedTeacher && (
            <>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs flex justify-between">
                <span>Emp ID: <b>{selectedTeacher.employee_id}</b></span>
                <span>Qualification: <b>{selectedTeacher.qualification}</b></span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Contact Number:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTeacher.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Official Login Email:</span>{' '}
                  <span className="font-mono text-navy-900 dark:text-brand-400 font-semibold">{selectedTeacher.email || '—'}</span>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Class & Subject Allocations
                </h4>
                {assignments.filter((a) => a.teacher_id === selectedTeacher.id).length > 0 ? (
                  assignments
                    .filter((a) => a.teacher_id === selectedTeacher.id)
                    .map((a) => (
                      <div
                        key={a.id}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {a.subject?.name}
                          </span>
                          <span className="text-slate-500 ml-2">
                            ({a.section?.class?.name} - Sec {a.section?.name})
                          </span>
                        </div>
                        {a.is_class_teacher && (
                          <Badge variant="success">Class In-charge</Badge>
                        )}
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No active subject assignments. Head to "Teacher Assignments" to allocate classes.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Pencil className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setIsViewModalOpen(false);
                      if (selectedTeacher) handleOpenEdit(selectedTeacher);
                    }}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<KeyRound className="w-3.5 h-3.5 text-amber-500" />}
                    onClick={() => {
                      setIsViewModalOpen(false);
                      if (selectedTeacher) handleOpenManageLogin(selectedTeacher);
                    }}
                  >
                    Manage Login
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* 3. Modal: Admin Edit Teacher Profile (Profile details only) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedTeacher ? `Edit Teacher Profile: ${selectedTeacher.full_name}` : 'Edit Teacher Profile'}
        description="Updates employee records, status, and subject allocations. To modify login credentials, use 'Manage Login'."
        size="lg"
      >
        <form onSubmit={handleUpdateTeacherProfile} className="space-y-4">
          {editError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium">
              {editError}
            </div>
          )}
          {editSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              {editSuccess}
            </div>
          )}

          {/* Read-Only Login Identity Banner distinguishing profile from auth credentials */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-500">Official Login Identity:</span>{' '}
              <span className="font-mono font-bold text-navy-900 dark:text-brand-400">
                {selectedTeacher?.email || 'Not configured'}
              </span>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
              Credentials managed separately via "Manage Login"
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Employee ID"
              required
              value={editFormData.employee_id}
              onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
            />
            <Input
              label="Designation"
              required
              value={editFormData.designation}
              onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
            />
          </div>

          <Input
            label="Full Name"
            required
            value={editFormData.full_name}
            onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Phone Number"
              placeholder="+92 300 xxxxxxx"
              value={editFormData.phone}
              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
            />
            <Input
              label="Academic Qualification & Degree"
              required
              value={editFormData.qualification}
              onChange={(e) => setEditFormData({ ...editFormData, qualification: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Joining Date"
              type="date"
              required
              value={editFormData.joining_date}
              onChange={(e) => setEditFormData({ ...editFormData, joining_date: e.target.value })}
            />

            <Select
              label="Employment Status"
              options={[
                { value: 'true', label: 'Active (Permitted to access school portal)' },
                { value: 'false', label: 'Deactivated (Revokes all login & data access)' },
              ]}
              value={String(editFormData.is_active)}
              onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'true' })}
            />
          </div>

          {!editFormData.is_active && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Deactivating will immediately deny this teacher access to login, attendance marking, and examination grading.</span>
            </div>
          )}

          {/* Section & Subject Assignments Management */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Manage Section & Subject Allocations (Active Session)
            </h4>

            {editAssignments.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {editAssignments.map((asgn, idx) => {
                  const sec = sections.find((s) => s.id === asgn.section_id);
                  const cls = classes.find((c) => c.id === sec?.class_id);
                  const sub = subjects.find((sb) => sb.id === asgn.subject_id);
                  return (
                    <div
                      key={idx}
                      className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {sub?.name || 'Subject'}
                        </span>
                        <span className="text-slate-500 ml-2">
                          ({cls?.name || 'Class'} - Sec {sec?.name || 'A'})
                        </span>
                        {asgn.is_class_teacher && (
                          <Badge variant="success" className="ml-2 text-[10px]">
                            Class In-charge
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded"
                        title="Remove Assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No teaching allocations assigned for active session.</p>
            )}

            {/* Add new assignment row */}
            <div className="p-3 bg-slate-100/60 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
              <select
                value={newAssignSectionId}
                onChange={(e) => setNewAssignSectionId(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200"
              >
                {sections.map((sec) => {
                  const cls = classes.find((c) => c.id === sec.class_id);
                  return (
                    <option key={sec.id} value={sec.id}>
                      {cls?.name} - Sec {sec.name}
                    </option>
                  );
                })}
              </select>

              <select
                value={newAssignSubjectId}
                onChange={(e) => setNewAssignSubjectId(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAssignIsClassTeacher}
                  onChange={(e) => setNewAssignIsClassTeacher(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Class In-charge
              </label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3 h-3" />}
                onClick={handleAddAssignment}
              >
                Add Assignment
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isEditSubmitting}>
              Save Teacher Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Modal: Manage Teacher Login & Credentials */}
      <Modal
        isOpen={isManageLoginModalOpen}
        onClose={() => setIsManageLoginModalOpen(false)}
        title={
          loginTeacher
            ? loginTeacher.profile_id
              ? `Manage Credentials: ${loginTeacher.full_name}`
              : `Provision Portal Access: ${loginTeacher.full_name}`
            : 'Manage Teacher Login'
        }
        description="Administrator-controlled login identity and credential management"
        size="lg"
      >
        <div className="space-y-6">
          {loginError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{loginError}</span>
              </div>
              <button onClick={() => setLoginError(null)} className="text-rose-400 hover:text-rose-600 text-xs">
                &times;
              </button>
            </div>
          )}
          {loginSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{loginSuccess}</span>
              </div>
              <button onClick={() => setLoginSuccess(null)} className="text-emerald-400 hover:text-emerald-600 text-xs">
                &times;
              </button>
            </div>
          )}

          {/* Account Overview */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Teacher:</span>{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">{loginTeacher?.full_name}</span>
            </div>
            <div>
              <span className="text-slate-500">Employee ID:</span>{' '}
              <span className="font-mono font-semibold text-navy-900 dark:text-brand-400">{loginTeacher?.employee_id}</span>
            </div>
            <div>
              <span className="text-slate-500">Official Email:</span>{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{loginTeacher?.email || 'None'}</span>
            </div>
            <div>
              <span className="text-slate-500">Portal Status:</span>{' '}
              {loginTeacher?.profile_id ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" /> Active & Linked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <UserX className="w-3.5 h-3.5" /> Not Provisioned
                </span>
              )}
            </div>
          </div>

          {/* Conditional Workflow: Provision Account vs Manage Credentials */}
          {!loginTeacher?.profile_id ? (
            /* Workflow: PROVISION UNLINKED TEACHER */
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Activate Teacher Portal Account
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    This teacher does not currently have an active login account in Supabase Auth. Confirm the official institutional email address and set the initial password to grant portal access.
                  </p>
                </div>
              </div>

              <form onSubmit={handleProvisionTeacher} className="space-y-4 pt-1">
                <Input
                  label="Teacher Login Email Address"
                  type="email"
                  required
                  placeholder="teacher.name@islamiapublic.edu.pk"
                  value={newLoginEmail}
                  onChange={(e) => setNewLoginEmail(e.target.value)}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Initial Portal Password
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewTemporaryPassword('Teacher123!')}
                        className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 underline font-medium"
                      >
                        Use Default (Teacher123!)
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setNewTemporaryPassword(`Tch-${Math.random().toString(36).slice(-6)}!`)}
                        className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium"
                      >
                        <Sparkles className="w-3 h-3" /> Generate Random
                      </button>
                    </div>
                  </div>

                  <Input
                    type="text"
                    required
                    placeholder="Minimum 6 characters"
                    value={newTemporaryPassword}
                    onChange={(e) => setNewTemporaryPassword(e.target.value)}
                  />
                </div>

                {/* Credential Slip for Admin */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-xs truncate">
                    <span className="text-slate-500">Credentials: </span>
                    <span className="font-mono font-bold text-navy-900 dark:text-brand-400">
                      {newLoginEmail || 'email'} / {newTemporaryPassword || 'password'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    leftIcon={copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={() => {
                      navigator.clipboard.writeText(`Teacher: ${loginTeacher?.full_name || ''}\nEmail: ${newLoginEmail}\nPassword: ${newTemporaryPassword}`);
                      setCopiedCredentials(true);
                      setTimeout(() => setCopiedCredentials(false), 2000);
                    }}
                  >
                    {copiedCredentials ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" isLoading={isLoginSubmitting} leftIcon={<UserCheck className="w-4 h-4" />}>
                    Activate Portal Account
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Workflow: MANAGE PROVISIONED TEACHER */
            <>
              {/* SECTION A: Update Login Email / Identity */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    1. Update Teacher Login Email / Identity
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Updates the authentication identity in Supabase Auth and synchronizes linked profile records while preserving user records.
                </p>

                <form onSubmit={handleUpdateLoginEmail} className="space-y-3">
                  <Input
                    label="New Login Email Address"
                    type="email"
                    required
                    placeholder="teacher.new@islamiapublic.edu.pk"
                    value={newLoginEmail}
                    onChange={(e) => setNewLoginEmail(e.target.value)}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" size="sm" isLoading={isLoginSubmitting}>
                      Update Login Email
                    </Button>
                  </div>
                </form>
              </div>

              {/* SECTION B: Administrator-Controlled Password Reset */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    2. Administrator-Controlled Password Reset
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Teachers cannot change passwords directly. As an Administrator, setting a new temporary password updates Supabase Auth and allows the teacher to log in immediately.
                </p>

                <form onSubmit={handleResetTeacherPassword} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label
                      className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                        loginPasswordMethod === 'temp'
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-900 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="loginPasswordMethod"
                          checked={loginPasswordMethod === 'temp'}
                          onChange={() => setLoginPasswordMethod('temp')}
                        />
                        <span>Temporary Password</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Assign immediate password & revoke existing sessions
                      </span>
                    </label>

                    <label
                      className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                        loginPasswordMethod === 'link'
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-900 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="loginPasswordMethod"
                          checked={loginPasswordMethod === 'link'}
                          onChange={() => setLoginPasswordMethod('link')}
                        />
                        <span>Dispatch Reset Link</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Send secure one-time password reset link to teacher email
                      </span>
                    </label>
                  </div>

                  {loginPasswordMethod === 'temp' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Authorized Temporary Password
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setNewTemporaryPassword('Teacher123!')}
                            className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 underline font-medium"
                          >
                            Use Default (Teacher123!)
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <button
                            type="button"
                            onClick={() => setNewTemporaryPassword(`Tch-${Math.random().toString(36).slice(-6)}!`)}
                            className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium"
                          >
                            <Sparkles className="w-3 h-3" /> Generate Random
                          </button>
                        </div>
                      </div>

                      <Input
                        type="text"
                        required
                        placeholder="Minimum 6 characters"
                        value={newTemporaryPassword}
                        onChange={(e) => setNewTemporaryPassword(e.target.value)}
                      />

                      {/* Credential Slip for Admin */}
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                        <div className="text-xs truncate">
                          <span className="text-slate-500">New Credentials: </span>
                          <span className="font-mono font-bold text-navy-900 dark:text-brand-400">
                            {loginTeacher?.email || 'email'} / {newTemporaryPassword || 'password'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          leftIcon={copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          onClick={() => {
                            navigator.clipboard.writeText(`Teacher: ${loginTeacher?.full_name}\nEmail: ${loginTeacher?.email}\nPassword: ${newTemporaryPassword}`);
                            setCopiedCredentials(true);
                            setTimeout(() => setCopiedCredentials(false), 2000);
                          }}
                        >
                          {copiedCredentials ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] text-slate-400 italic">
                      * Password change will be recorded in audit log without storing plaintext password.
                    </span>
                    <Button type="submit" size="sm" isLoading={isLoginSubmitting}>
                      Confirm Password Reset
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsManageLoginModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. Confirmation Dialog: Single Teacher Portal Toggle */}
      <ConfirmationDialog
        isOpen={teacherPortalToggleConfirm.isOpen}
        onClose={() => setTeacherPortalToggleConfirm({ isOpen: false, teacher: null, active: false })}
        onConfirm={handleExecuteTeacherPortalToggle}
        title={teacherPortalToggleConfirm.active ? 'Reactivate Teacher Portal' : 'Deactivate Teacher Portal'}
        message={
          teacherPortalToggleConfirm.active
            ? `Are you sure you want to reactivate portal access for ${teacherPortalToggleConfirm.teacher?.full_name} (${teacherPortalToggleConfirm.teacher?.employee_id})? The teacher will be able to log in again.`
            : `Are you sure you want to deactivate portal access for ${teacherPortalToggleConfirm.teacher?.full_name} (${teacherPortalToggleConfirm.teacher?.employee_id})? The teacher will be prevented from logging in immediately, but all teaching allocations, attendance, and exam records will be preserved.`
        }
        confirmText={teacherPortalToggleConfirm.active ? 'Reactivate Portal' : 'Deactivate Portal'}
        variant={teacherPortalToggleConfirm.active ? 'primary' : 'danger'}
      />

      {/* 6. Modal: Bulk Teacher Portal Action Confirmation */}
      <Modal
        isOpen={isBulkConfirmOpen}
        onClose={() => setIsBulkConfirmOpen(false)}
        title={
          bulkActionType === 'activate'
            ? `Bulk Teacher Portal Activation (${eligibleBulkTeachers.length} Teachers)`
            : bulkActionType === 'deactivate'
            ? `Bulk Teacher Portal Deactivation (${eligibleBulkTeachers.length} Teachers)`
            : `Bulk Teacher Portal Reactivation (${eligibleBulkTeachers.length} Teachers)`
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-200">
              {bulkActionType === 'activate' && (
                <span>
                  <span className="font-semibold">Batch Portal Provisioning:</span> Each selected unprovisioned faculty member will be provisioned with a portal login account using their institutional email address.
                </span>
              )}
              {bulkActionType === 'deactivate' && (
                <span>
                  <span className="font-semibold">Batch Portal Deactivation:</span> Each selected teacher will have their portal access revoked. Subject allocations and classroom attendance records will not be altered.
                </span>
              )}
              {bulkActionType === 'reactivate' && (
                <span>
                  <span className="font-semibold">Batch Portal Reactivation:</span> Each selected teacher will regain login access to the teacher portal.
                </span>
              )}
            </div>
          </div>

          {bulkActionType === 'activate' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Default Teacher Password
              </label>
              <Input
                type="text"
                value={bulkDefaultPassword}
                onChange={(e) => setBulkDefaultPassword(e.target.value)}
                placeholder="e.g. Teacher123!"
                required
              />
              <p className="text-[11px] text-slate-500">
                This initial password will be assigned to all newly provisioned teacher accounts.
              </p>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Eligible Faculty Preview ({eligibleBulkTeachers.length})
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              {eligibleBulkTeachers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No selected teachers match this operation criteria.
                </div>
              ) : (
                eligibleBulkTeachers.map((t) => (
                  <div key={t.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{t.full_name}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">({t.employee_id})</span>
                    </div>
                    <Badge
                      variant={
                        t.portal_status === 'active'
                          ? 'success'
                          : t.portal_status === 'inactive'
                          ? 'danger'
                          : 'default'
                      }
                    >
                      {t.portal_status ? t.portal_status.toUpperCase() : 'NOT PROVISIONED'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsBulkConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={bulkActionType === 'deactivate' ? 'danger' : 'primary'}
              disabled={eligibleBulkTeachers.length === 0}
              isLoading={isBulkSubmitting}
              onClick={handleExecuteBulkTeacherAction}
              leftIcon={
                bulkActionType === 'activate' ? (
                  <UserPlus className="w-4 h-4" />
                ) : bulkActionType === 'deactivate' ? (
                  <UserX className="w-4 h-4" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )
              }
            >
              Confirm & {bulkActionType === 'activate' ? 'Activate' : bulkActionType === 'deactivate' ? 'Deactivate' : 'Reactivate'} {eligibleBulkTeachers.length} Portals
            </Button>
          </div>
        </div>
      </Modal>

      {/* 7. Modal: Bulk Teacher Action Report */}
      <Modal
        isOpen={isBulkReportOpen}
        onClose={() => setIsBulkReportOpen(false)}
        title="Teacher Bulk Operation Report"
        size="md"
      >
        <div className="space-y-4">
          {bulkReport && (
            <>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>Bulk Operation Completed</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded border border-emerald-200 dark:border-emerald-800">
                    <div className="text-lg font-bold text-emerald-600">{bulkReport.successCount}</div>
                    <div className="text-[10px] text-slate-500">Processed</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                    <div className="text-lg font-bold text-slate-600">{bulkReport.skippedCount}</div>
                    <div className="text-[10px] text-slate-500">Skipped</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                    <div className="text-lg font-bold text-rose-600">{bulkReport.failedCount}</div>
                    <div className="text-[10px] text-slate-500">Failed</div>
                  </div>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {bulkReport.results.map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.full_name || r.teacher_id}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{r.email || r.error || r.message}</div>
                    </div>
                    <Badge variant={r.status === 'success' ? 'success' : r.status === 'skipped' ? 'info' : 'danger'}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button onClick={() => setIsBulkReportOpen(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
