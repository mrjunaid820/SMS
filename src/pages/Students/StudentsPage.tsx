import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, Enrollment, ClassLevel, Section, AcademicSession } from '@/types/database';
import { studentApi, academicStructureApi, settingsApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import { exportToSafeCSV, parseAndValidateStudentCSV, CSVStudentRow } from '@/lib/csv-sanitizer';
import { PrintStudentID } from '@/components/print/PrintStudentID';
import {
  UserPlus,
  FileDown,
  Upload,
  CreditCard,
  Eye,
  Archive,
  RotateCcw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Search,
  KeyRound,
  ShieldCheck,
  Users,
  RefreshCw,
  XCircle,
  Trash2,
  UserCheck,
  UserX,
  AlertCircle,
  Check,
} from 'lucide-react';

export const StudentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { settings, currentSession, selectedSessionId } = useSchool();

  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  // Student Portal Account Provisioning Modal
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [portalStudent, setPortalStudent] = useState<Student | null>(null);
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalSuccess, setPortalSuccess] = useState<string | null>(null);

  // Single Portal Toggle Confirm State
  const [portalToggleConfirm, setPortalToggleConfirm] = useState<{
    isOpen: boolean;
    student: Student | null;
    active: boolean;
  }>({
    isOpen: false,
    student: null,
    active: false,
  });

  // Safe Deletion Modal State
  const [isSafeDeleteModalOpen, setIsSafeDeleteModalOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [deletionEligibility, setDeletionEligibility] = useState<{
    student_id: string;
    student_name: string;
    admission_no: string;
    has_dependencies: boolean;
    eligible_for_permanent_deletion: boolean;
    recommendation: 'archive_recommended' | 'permanent_deletion';
    dependencies: {
      enrollments: number;
      attendance_records: number;
      fee_invoices: number;
      fee_payments: number;
      exam_marks: number;
    };
    explanation: string;
  } | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bulk Student Portal State
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkActionType, setBulkActionType] = useState<'activate' | 'deactivate' | 'reactivate'>('activate');
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkPassword, setBulkPassword] = useState('Student123!');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; currentStudentName: string }>({
    current: 0,
    total: 0,
    currentStudentName: '',
  });
  const [bulkResultsModalOpen, setBulkResultsModalOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    total_requested: number;
    success_count: number;
    skipped_count: number;
    failed_count: number;
    results: Array<{
      student_id: string;
      student_name: string;
      admission_no: string;
      email: string | null;
      status: 'success' | 'skipped' | 'failed';
      message: string;
    }>;
  } | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  // Form State for Add
  const [formData, setFormData] = useState({
    full_name: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    date_of_birth: '2010-01-01',
    b_form_or_cnic: '',
    guardian_name: '',
    guardian_relation: 'Father',
    guardian_cnic: '',
    guardian_phone: '',
    emergency_contact: '',
    address: '',
    blood_group: 'B+',
    admission_date: new Date().toISOString().split('T')[0],
    class_id: '',
    section_id: '',
  });

  // Form State for Admin Editing
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    date_of_birth: '2010-01-01',
    b_form_or_cnic: '',
    guardian_name: '',
    guardian_relation: 'Father',
    guardian_cnic: '',
    guardian_phone: '',
    emergency_contact: '',
    address: '',
    blood_group: 'B+',
    admission_date: '',
    photo_url: '',
    class_id: '',
    section_id: '',
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // CSV Import State
  const [csvPreview, setCsvPreview] = useState<{
    validRows: CSVStudentRow[];
    errors: { rowNumber: number; reason: string }[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sList, eList, cList, secList] = await Promise.all([
        studentApi.getStudents(showArchived),
        studentApi.getEnrollments(selectedSessionId),
        academicStructureApi.getClasses(),
        academicStructureApi.getSections(),
      ]);
      setStudents(sList);
      setEnrollments(eList);
      setClasses(cList);
      setSections(secList);
    } catch (e) {
      console.error('Failed to load students data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSessionId, showArchived]);

  // Filter sections by selected class in dropdowns
  const availableSections = useMemo(() => {
    if (!formData.class_id) return [];
    return sections.filter((s) => s.class_id === formData.class_id);
  }, [sections, formData.class_id]);

  const availableEditSections = useMemo(() => {
    if (!editFormData.class_id) return [];
    return sections.filter((s) => s.class_id === editFormData.class_id);
  }, [sections, editFormData.class_id]);

  const handleOpenAdd = () => {
    setFormData({
      full_name: '',
      gender: 'Male',
      date_of_birth: '2010-01-01',
      b_form_or_cnic: '',
      guardian_name: '',
      guardian_relation: 'Father',
      guardian_cnic: '',
      guardian_phone: '',
      emergency_contact: '',
      address: '',
      blood_group: 'B+',
      admission_date: new Date().toISOString().split('T')[0],
      class_id: classes[0]?.id || '',
      section_id: sections.find((s) => s.class_id === classes[0]?.id)?.id || '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    const enr = enrollments.find((e) => e.student_id === student.id);
    setSelectedStudent(student);
    const clsId = enr?.section?.class_id || enr?.section?.class?.id || classes[0]?.id || '';
    setEditFormData({
      full_name: student.full_name,
      gender: student.gender,
      date_of_birth: student.date_of_birth,
      b_form_or_cnic: student.b_form_or_cnic || '',
      guardian_name: student.guardian_name,
      guardian_relation: student.guardian_relation || 'Father',
      guardian_cnic: student.guardian_cnic || '',
      guardian_phone: student.guardian_phone,
      emergency_contact: student.emergency_contact || '',
      address: student.address,
      blood_group: student.blood_group || 'B+',
      admission_date: student.admission_date,
      photo_url: student.photo_url || '',
      class_id: clsId,
      section_id: enr?.section_id || sections.find((s) => s.class_id === clsId)?.id || '',
    });
    setEditError(null);
    setEditSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setEditError(null);
    setEditSuccess(null);

    if (!editFormData.full_name.trim() || !editFormData.guardian_name.trim() || !editFormData.guardian_phone.trim() || !editFormData.address.trim()) {
      setEditError('Please fill out all required fields (Name, Guardian Name, Guardian Phone, Address).');
      return;
    }

    setIsEditSubmitting(true);
    try {
      await studentApi.updateStudentWithEnrollment(
        selectedStudent.id,
        {
          full_name: editFormData.full_name.trim(),
          gender: editFormData.gender,
          date_of_birth: editFormData.date_of_birth,
          b_form_or_cnic: editFormData.b_form_or_cnic.trim(),
          guardian_name: editFormData.guardian_name.trim(),
          guardian_relation: editFormData.guardian_relation,
          guardian_cnic: editFormData.guardian_cnic.trim(),
          guardian_phone: editFormData.guardian_phone.trim(),
          emergency_contact: editFormData.emergency_contact.trim(),
          address: editFormData.address.trim(),
          blood_group: editFormData.blood_group,
          admission_date: editFormData.admission_date,
          photo_url: editFormData.photo_url ? editFormData.photo_url.trim() : undefined,
        },
        editFormData.section_id,
        selectedSessionId,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );

      setEditSuccess(`Student record for "${editFormData.full_name}" updated successfully.`);
      await loadData();
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(null);
      }, 1000);
    } catch (err: any) {
      setEditError(err.message || 'Database error: Failed to update student profile.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.guardian_name || !formData.guardian_phone || !formData.address) {
      alert('Please fill out all required fields.');
      return;
    }
    if (!formData.section_id) {
      alert('Please select a valid class and section for enrollment.');
      return;
    }

    try {
      await studentApi.createStudentWithEnrollment(
        {
          full_name: formData.full_name,
          gender: formData.gender,
          date_of_birth: formData.date_of_birth,
          b_form_or_cnic: formData.b_form_or_cnic,
          admission_date: formData.admission_date,
          guardian_name: formData.guardian_name,
          guardian_relation: formData.guardian_relation,
          guardian_cnic: formData.guardian_cnic,
          guardian_phone: formData.guardian_phone,
          emergency_contact: formData.emergency_contact,
          address: formData.address,
          blood_group: formData.blood_group,
        },
        selectedSessionId,
        formData.section_id,
        { id: user?.id, name: user?.full_name }
      );

      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error creating student: ${err.message}`);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!selectedStudent) return;
    try {
      await studentApi.archiveStudent(selectedStudent.id, archiveReason || 'Administrative archiving', {
        id: user?.id,
        name: user?.full_name,
        role: user?.role,
      });
      setIsArchiveDialogOpen(false);
      setSelectedStudent(null);
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRestore = async (student: Student) => {
    try {
      await studentApi.restoreStudent(student.id, { id: user?.id, name: user?.full_name, role: user?.role });
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleOpenPortalModal = (student: Student) => {
    setPortalStudent(student);
    setPortalError(null);
    setPortalSuccess(null);
    setPortalPassword('Student123!');
    if (student.email) {
      setPortalEmail(student.email.trim());
    } else {
      const sanitizedAdmission = (student.admission_no || 'stu')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      setPortalEmail(`student.${sanitizedAdmission}@islamiapublic.edu.pk`);
    }
    setIsPortalModalOpen(true);
  };

  const handleProvisionPortalAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalStudent) return;
    setPortalError(null);
    setPortalSuccess(null);

    const cleanEmail = portalEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setPortalError('Please provide a valid login email address (e.g. student.adm001@islamiapublic.edu.pk).');
      return;
    }
    if (!portalPassword || portalPassword.length < 6) {
      setPortalError('Initial password must be at least 6 characters.');
      return;
    }

    setPortalLoading(true);
    try {
      const res = await studentApi.provisionStudentAccount(
        portalStudent.id,
        cleanEmail,
        portalPassword,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPortalSuccess(`Portal account provisioned successfully! Login email: ${res.profile.email}. Initial password: ${portalPassword}`);
      await loadData();
      setPortalStudent((prev) => (prev ? { ...prev, profile_id: res.profile.id, email: res.profile.email } : null));
    } catch (err: any) {
      setPortalError(err.message || 'Failed to provision portal account.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleResetPortalPassword = async () => {
    if (!portalStudent) return;
    setPortalError(null);
    setPortalSuccess(null);

    if (!portalPassword || portalPassword.length < 6) {
      setPortalError('New password must be at least 6 characters.');
      return;
    }

    setPortalLoading(true);
    try {
      await studentApi.resetStudentPassword(
        portalStudent.id,
        portalPassword,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPortalSuccess(`Password reset successfully for ${portalStudent.full_name}.`);
      setPortalPassword('');
    } catch (err: any) {
      setPortalError(err.message || 'Failed to reset password.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleTogglePortalStatus = async () => {
    if (!portalStudent) return;
    setPortalError(null);
    setPortalSuccess(null);

    setPortalLoading(true);
    try {
      const res = await studentApi.toggleStudentAccountStatus(
        portalStudent.id,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPortalSuccess(`Account is now ${res.profile.is_active ? 'Active' : 'Deactivated'}.`);
      await loadData();
    } catch (err: any) {
      setPortalError(err.message || 'Failed to update account status.');
    } finally {
      setPortalLoading(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const rows = students.map((s) => {
      const enr = enrollments.find((e) => e.student_id === s.id);
      return {
        admission_no: s.admission_no,
        full_name: s.full_name,
        gender: s.gender,
        date_of_birth: s.date_of_birth,
        class: enr?.section?.class?.name || '—',
        section: enr?.section?.name || '—',
        roll_no: enr?.roll_no || '—',
        guardian_name: s.guardian_name,
        guardian_phone: s.guardian_phone,
        b_form_or_cnic: s.b_form_or_cnic || '',
        address: s.address,
        blood_group: s.blood_group || '',
        status: s.is_active ? 'Active' : 'Archived',
      };
    });

    exportToSafeCSV(rows, `Students_Register_${currentSession?.name || '2025-26'}`);
  };

  // CSV Import File Processing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await parseAndValidateStudentCSV(text);
    setCsvPreview(result);
  };

  const handleExecuteImport = async () => {
    if (!csvPreview || csvPreview.validRows.length === 0) return;
    const defaultSection = sections[0];
    if (!defaultSection) {
      alert('Please ensure at least one section exists before importing.');
      return;
    }

    setIsImporting(true);
    try {
      for (const row of csvPreview.validRows) {
        await studentApi.createStudentWithEnrollment(
          {
            full_name: row.full_name,
            gender: row.gender as any,
            date_of_birth: row.date_of_birth,
            guardian_name: row.guardian_name,
            guardian_relation: row.guardian_relation || 'Father',
            guardian_phone: row.guardian_phone,
            guardian_cnic: row.guardian_cnic,
            address: row.address,
            blood_group: row.blood_group,
            admission_date: row.admission_date || new Date().toISOString().split('T')[0],
          },
          selectedSessionId,
          defaultSection.id,
          { id: user?.id, name: user?.full_name }
        );
      }
      setIsCsvImportModalOpen(false);
      setCsvPreview(null);
      await loadData();
      alert(`Successfully imported ${csvPreview.validRows.length} student records!`);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Filter students by class & section
  const displayedStudents = useMemo(() => {
    return students.filter((s) => {
      const enr = enrollments.find((e) => e.student_id === s.id);
      if (selectedClassId && enr?.section?.class_id !== selectedClassId) return false;
      if (selectedSectionId && enr?.section_id !== selectedSectionId) return false;
      return true;
    });
  }, [students, enrollments, selectedClassId, selectedSectionId]);

  // Groups of students in current filtered view
  const unprovisionedStudents = useMemo(() => {
    return displayedStudents.filter(
      (s) => (s.portal_status === 'not_provisioned' || (!s.profile_id && !s.email)) && s.is_active
    );
  }, [displayedStudents]);

  const activePortalStudents = useMemo(() => {
    return displayedStudents.filter((s) => s.portal_status === 'active');
  }, [displayedStudents]);

  const inactivePortalStudents = useMemo(() => {
    return displayedStudents.filter((s) => s.portal_status === 'inactive');
  }, [displayedStudents]);

  // Students eligible for currently selected bulk operation
  const eligibleBulkStudents = useMemo(() => {
    const selected = displayedStudents.filter((s) => selectedStudentIds.has(s.id));
    if (bulkActionType === 'activate') {
      return selected.filter((s) => s.portal_status === 'not_provisioned' || (!s.profile_id && !s.email));
    }
    if (bulkActionType === 'deactivate') {
      return selected.filter((s) => s.portal_status === 'active');
    }
    if (bulkActionType === 'reactivate') {
      return selected.filter((s) => s.portal_status === 'inactive');
    }
    return selected;
  }, [displayedStudents, selectedStudentIds, bulkActionType]);

  const selectedUnprovisionedCount = useMemo(() => {
    return displayedStudents.filter(
      (s) => selectedStudentIds.has(s.id) && (s.portal_status === 'not_provisioned' || (!s.profile_id && !s.email))
    ).length;
  }, [displayedStudents, selectedStudentIds]);

  const selectedActiveCount = useMemo(() => {
    return displayedStudents.filter((s) => selectedStudentIds.has(s.id) && s.portal_status === 'active').length;
  }, [displayedStudents, selectedStudentIds]);

  const selectedInactiveCount = useMemo(() => {
    return displayedStudents.filter((s) => selectedStudentIds.has(s.id) && s.portal_status === 'inactive').length;
  }, [displayedStudents, selectedStudentIds]);

  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAllDisplayed = () => {
    setSelectedStudentIds(new Set(displayedStudents.map((s) => s.id)));
  };

  const handleSelectAllUnprovisioned = () => {
    setSelectedStudentIds(new Set(unprovisionedStudents.map((s) => s.id)));
  };

  const handleSelectAllActive = () => {
    setSelectedStudentIds(new Set(activePortalStudents.map((s) => s.id)));
  };

  const handleSelectAllInactive = () => {
    setSelectedStudentIds(new Set(inactivePortalStudents.map((s) => s.id)));
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const handleStartBulkAction = (action: 'activate' | 'deactivate' | 'reactivate') => {
    setBulkActionType(action);
    setBulkPassword('Student123!');
    setIsBulkConfirmOpen(true);
  };

  const handleExecuteBulkAction = async () => {
    setIsBulkConfirmOpen(false);
    setIsBulkProcessing(true);
    setBulkProgress({
      current: 0,
      total: eligibleBulkStudents.length,
      currentStudentName: `Executing bulk ${bulkActionType}...`,
    });

    try {
      const idsArray = eligibleBulkStudents.map((s) => s.id);
      if (bulkActionType === 'activate') {
        const res = await studentApi.bulkProvisionStudentAccounts(
          idsArray,
          bulkPassword,
          { id: user?.id, name: user?.full_name, role: user?.role }
        );
        setBulkResults(res);
      } else {
        const isReactivating = bulkActionType === 'reactivate';
        const res = await studentApi.bulkSetPortalActive(
          idsArray,
          isReactivating,
          { id: user?.id, name: user?.full_name, role: user?.role }
        );
        setBulkResults({
          total_requested: res.total_requested,
          success_count: res.success_count,
          skipped_count: res.skipped_count,
          failed_count: res.failed_count,
          results: res.results.map((r: any) => ({
            student_id: r.student_id,
            student_name: r.full_name || 'Student',
            admission_no: '—',
            email: null,
            status: r.status,
            message: r.message || r.error || (isReactivating ? 'Portal reactivated successfully.' : 'Portal deactivated successfully.'),
          })),
        });
      }

      setBulkResultsModalOpen(true);
      setSelectedStudentIds(new Set());
      await loadData();
    } catch (err: any) {
      alert(`Bulk operation error: ${err.message}`);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleRetryFailed = () => {
    if (!bulkResults) return;
    const failedIds = bulkResults.results
      .filter((r) => r.status === 'failed')
      .map((r) => r.student_id);
    setSelectedStudentIds(new Set(failedIds));
    setBulkResultsModalOpen(false);
    setIsBulkConfirmOpen(true);
  };

  // Single Portal Toggle Handlers
  const handleTogglePortalStatusDirect = (student: Student, active: boolean) => {
    setPortalToggleConfirm({
      isOpen: true,
      student,
      active,
    });
  };

  const handleExecutePortalToggle = async () => {
    if (!portalToggleConfirm.student) return;
    try {
      const res = await studentApi.setPortalActive(
        portalToggleConfirm.student.id,
        portalToggleConfirm.active,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPortalToggleConfirm({ isOpen: false, student: null, active: false });
      await loadData();
      alert(res.message);
    } catch (err: any) {
      alert(`Failed to update portal status: ${err.message}`);
    }
  };

  // Safe Deletion Handlers
  const handleOpenSafeDelete = async (student: Student) => {
    setDeletingStudent(student);
    setDeletionEligibility(null);
    setDeleteError(null);
    setIsSafeDeleteModalOpen(true);
    setIsCheckingEligibility(true);
    try {
      const eligibility = await studentApi.checkDeletionEligibility(student.id, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role,
      });
      setDeletionEligibility(eligibility);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to inspect student dependencies.');
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleExecuteSafeDelete = async () => {
    if (!deletingStudent) return;
    setIsDeletingStudent(true);
    setDeleteError(null);
    try {
      const res = await studentApi.safeDeleteStudent(deletingStudent.id, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role,
      });
      setIsSafeDeleteModalOpen(false);
      setDeletingStudent(null);
      await loadData();
      alert(res.message);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete student.');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // Data Table Columns Definition
  const columns: Column<Student>[] = [
    ...(isAdmin
      ? [
          {
            key: 'selection',
            header: (
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  checked={
                    displayedStudents.length > 0 &&
                    displayedStudents.every((s) => selectedStudentIds.has(s.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSelectAllDisplayed();
                    } else {
                      handleClearSelection();
                    }
                  }}
                  title="Select or deselect all visible students"
                />
              </div>
            ),
            className: 'w-10 text-center px-2',
            render: (row: Student) => {
              const isSelected = selectedStudentIds.has(row.id);
              return (
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelectStudent(row.id)}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    title={`Select ${row.full_name}`}
                  />
                </div>
              );
            },
          },
        ]
      : []),
    {
      key: 'admission_no',
      header: 'Admission #',
      sortable: true,
      className: 'font-mono text-xs font-semibold text-navy-900 dark:text-brand-400',
    },
    {
      key: 'full_name',
      header: 'Student Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{row.full_name}</div>
          <div className="text-[11px] text-slate-400">DOB: {formatDate(row.date_of_birth)} ({row.gender})</div>
        </div>
      ),
    },
    {
      key: 'class_section',
      header: 'Class / Roll',
      render: (row) => {
        const enr = enrollments.find((e) => e.student_id === row.id);
        if (!enr) return <span className="text-slate-400 italic">Unassigned</span>;
        return (
          <div>
            <div className="font-medium text-slate-800 dark:text-slate-200">
              {enr.section?.class?.name || 'Class 9'} - {enr.section?.name || 'A'}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Roll #{enr.roll_no}</div>
          </div>
        );
      },
    },
    {
      key: 'guardian',
      header: 'Guardian Info',
      render: (row) => (
        <div>
          <div className="text-slate-800 dark:text-slate-200 font-medium">{row.guardian_name}</div>
          <div className="text-[11px] text-slate-500 font-mono">{row.guardian_phone}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Active' : 'Archived'}
        </Badge>
      ),
    },
    {
      key: 'portal_access',
      header: 'Portal Access',
      render: (row) => {
        const status = row.portal_status || (!row.profile_id && !row.email ? 'not_provisioned' : 'active');
        if (status === 'active') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Portal Active
            </span>
          );
        }
        if (status === 'inactive') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Portal Inactive
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Not Provisioned
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        const enr = enrollments.find((e) => e.student_id === row.id);
        const status = row.portal_status || (!row.profile_id && !row.email ? 'not_provisioned' : 'active');
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => {
                setSelectedStudent(row);
                setIsProfileModalOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-navy-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="View Profile"
            >
              <Eye className="w-4 h-4" />
            </button>
            {isAdmin && (
              <button
                onClick={() => handleOpenEdit(row)}
                className="p-1.5 text-slate-500 hover:text-navy-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Edit Student Details"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {isAdmin && (
              <>
                {status === 'not_provisioned' ? (
                  <button
                    onClick={() => handleOpenPortalModal(row)}
                    className="p-1.5 text-amber-600 hover:text-amber-800 dark:hover:text-amber-300 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    title="Activate Portal Account"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                ) : status === 'inactive' ? (
                  <button
                    onClick={() => handleTogglePortalStatusDirect(row, true)}
                    className="p-1.5 text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-300 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Reactivate Student Portal"
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleTogglePortalStatusDirect(row, false)}
                    className="p-1.5 text-rose-600 hover:text-rose-800 dark:hover:text-rose-300 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Deactivate Student Portal"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenPortalModal(row)}
                  className="p-1.5 text-brand-600 hover:text-brand-800 dark:hover:text-brand-300 rounded-md hover:bg-brand-50 dark:hover:bg-brand-950/40"
                  title="Manage Portal Credentials & Password"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                setSelectedStudent(row);
                setIsIdCardModalOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-brand-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Print Student ID Card"
            >
              <CreditCard className="w-4 h-4" />
            </button>
            {isAdmin && (
              <>
                {row.is_active ? (
                  <button
                    onClick={() => {
                      setSelectedStudent(row);
                      setIsArchiveDialogOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Archive Student Record"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleRestore(row)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Restore Student Record"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenSafeDelete(row)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Permanently Delete Student"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Student Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Admissions, enrollments, roll assignments, ID cards and records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Search className="w-3.5 h-3.5" />}
            onClick={() => navigate('/quick-search')}
          >
            Quick Search & Performance
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? 'bg-slate-200 dark:bg-slate-800' : ''}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>

          {isAdmin ? (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => setIsCsvImportModalOpen(true)}
              >
                Import CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileDown className="w-3.5 h-3.5" />}
                onClick={handleExportCSV}
              >
                Export CSV
              </Button>

              <Button size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={handleOpenAdd}>
                Admit New Student
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileDown className="w-3.5 h-3.5" />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Class & Section Filter Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Filter By:
        </span>

        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setSelectedSectionId('');
          }}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
        >
          <option value="">All Classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>

        <select
          value={selectedSectionId}
          onChange={(e) => setSelectedSectionId(e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
        >
          <option value="">All Sections</option>
          {sections
            .filter((s) => !selectedClassId || s.class_id === selectedClassId)
            .map((sec) => (
              <option key={sec.id} value={sec.id}>
                Section {sec.name}
              </option>
            ))}
        </select>

        {(selectedClassId || selectedSectionId) && (
          <button
            onClick={() => {
              setSelectedClassId('');
              setSelectedSectionId('');
            }}
            className="text-xs text-rose-600 hover:underline font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Bulk Selection Action Toolbar */}
      {isAdmin && (
        <div className="p-3.5 bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-slate-800/90 dark:to-slate-900 border border-brand-200 dark:border-brand-900/50 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 text-white rounded-lg shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Student Portal Controls
                {selectedStudentIds.size > 0 ? (
                  <Badge variant="info">
                    {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 's' : ''} selected
                  </Badge>
                ) : (
                  <Badge variant="default">
                    {unprovisionedStudents.length} unprovisioned
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                Batch activate, deactivate, or reactivate student portal access
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={handleSelectAllUnprovisioned}
                disabled={unprovisionedStudents.length === 0}
                className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[11px] font-medium disabled:opacity-40"
              >
                Unprovisioned ({unprovisionedStudents.length})
              </button>
              <button
                type="button"
                onClick={handleSelectAllActive}
                disabled={activePortalStudents.length === 0}
                className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[11px] font-medium disabled:opacity-40"
              >
                Active ({activePortalStudents.length})
              </button>
              <button
                type="button"
                onClick={handleSelectAllInactive}
                disabled={inactivePortalStudents.length === 0}
                className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[11px] font-medium disabled:opacity-40"
              >
                Inactive ({inactivePortalStudents.length})
              </button>
            </div>

            {selectedStudentIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-slate-600 dark:text-slate-400"
              >
                Clear
              </Button>
            )}

            <Button
              size="sm"
              variant="primary"
              disabled={selectedUnprovisionedCount === 0}
              onClick={() => handleStartBulkAction('activate')}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Bulk Activate ({selectedUnprovisionedCount})
            </Button>

            <Button
              size="sm"
              variant="danger"
              disabled={selectedActiveCount === 0}
              onClick={() => handleStartBulkAction('deactivate')}
              leftIcon={<UserX className="w-3.5 h-3.5" />}
            >
              Bulk Deactivate ({selectedActiveCount})
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={selectedInactiveCount === 0}
              onClick={() => handleStartBulkAction('reactivate')}
              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
            >
              Bulk Reactivate ({selectedInactiveCount})
            </Button>
          </div>
        </div>
      )}

      {/* Main Student Data Table */}
      <DataTable
        data={displayedStudents}
        columns={columns}
        isLoading={isLoading}
        rowKey={(s) => s.id}
        searchPlaceholder="Search by name, admission #, guardian..."
        searchFilter={(row, term) => {
          return (
            row.full_name.toLowerCase().includes(term) ||
            row.admission_no.toLowerCase().includes(term) ||
            row.guardian_name.toLowerCase().includes(term) ||
            row.guardian_phone.includes(term)
          );
        }}
      />

      {/* 1. Modal: Admit New Student Form */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Student Admission & Academic Enrollment"
        description="Auto-generates sequential admission and section roll numbers"
        size="lg"
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Student Full Name"
              required
              placeholder="e.g. Muhammad Abdullah"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />

            <Select
              label="Gender"
              required
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' },
              ]}
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
            />

            <Input
              label="Date of Birth"
              type="date"
              required
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            />

            <Input
              label="B-Form / CNIC"
              placeholder="35201-xxxxxxx-x"
              value={formData.b_form_or_cnic}
              onChange={(e) => setFormData({ ...formData, b_form_or_cnic: e.target.value })}
            />

            <Input
              label="Father / Guardian Name"
              required
              placeholder="e.g. Tariq Mehmood"
              value={formData.guardian_name}
              onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
            />

            <Input
              label="Guardian Phone"
              required
              placeholder="+92 300 xxxxxxx"
              value={formData.guardian_phone}
              onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
            />

            <Select
              label="Enroll in Class"
              required
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              value={formData.class_id}
              onChange={(e) => {
                const clsId = e.target.value;
                const firstSec = sections.find((s) => s.class_id === clsId);
                setFormData({ ...formData, class_id: clsId, section_id: firstSec?.id || '' });
              }}
            />

            <Select
              label="Assign Section"
              required
              options={availableSections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))}
              value={formData.section_id}
              onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
            />
          </div>

          <Input
            label="Residential Address"
            required
            placeholder="House #, Street, Town / City"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Complete Admission</Button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Student ID Card Preview & Print */}
      <Modal
        isOpen={isIdCardModalOpen}
        onClose={() => setIsIdCardModalOpen(false)}
        title="Student Identity Card"
        size="md"
      >
        {selectedStudent && (
          <div className="space-y-4">
            <PrintStudentID
              student={selectedStudent}
              enrollment={enrollments.find((e) => e.student_id === selectedStudent.id)}
              settings={settings}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsIdCardModalOpen(false)}>
                Close
              </Button>
              <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print ID Card
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Modal: Student Profile Details View */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Student Profile & Enrollment Record"
        size="lg"
      >
        {selectedStudent && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xl">
                {selectedStudent.full_name[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedStudent.full_name}
                </h3>
                <p className="text-xs font-mono text-brand-600 dark:text-brand-400 font-semibold">
                  {selectedStudent.admission_no}
                </p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={selectedStudent.is_active ? 'success' : 'danger'}>
                    {selectedStudent.is_active ? 'Active Enrollment' : 'Archived'}
                  </Badge>
                  <Badge variant="default">Blood Group: {selectedStudent.blood_group || 'N/A'}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase">Student Info</h4>
                <p><span className="text-slate-500">Gender:</span> {selectedStudent.gender}</p>
                <p><span className="text-slate-500">Date of Birth:</span> {formatDate(selectedStudent.date_of_birth)}</p>
                <p><span className="text-slate-500">B-Form:</span> {selectedStudent.b_form_or_cnic || '—'}</p>
                <p><span className="text-slate-500">Admission Date:</span> {formatDate(selectedStudent.admission_date)}</p>
                <p><span className="text-slate-500">Address:</span> {selectedStudent.address}</p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase">Guardian Info</h4>
                <p><span className="text-slate-500">Name:</span> {selectedStudent.guardian_name}</p>
                <p><span className="text-slate-500">Relation:</span> {selectedStudent.guardian_relation}</p>
                <p><span className="text-slate-500">CNIC:</span> {selectedStudent.guardian_cnic || '—'}</p>
                <p><span className="text-slate-500">Phone:</span> {selectedStudent.guardian_phone}</p>
                <p><span className="text-slate-500">Emergency:</span> {selectedStudent.emergency_contact || '—'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
              {isAdmin ? (
                <Button
                  variant="outline"
                  leftIcon={<Pencil className="w-4 h-4" />}
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    if (selectedStudent) handleOpenEdit(selectedStudent);
                  }}
                >
                  Edit Student
                </Button>
              ) : <div />}
              <Button onClick={() => setIsProfileModalOpen(false)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Admin Edit Student */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedStudent ? `Edit Student: ${selectedStudent.full_name}` : 'Edit Student Details'}
        description="Preserves admission number, past attendance, examinations, and fee records"
        size="lg"
      >
        <form onSubmit={handleUpdateStudent} className="space-y-4">
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

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Admission Number (Preserved):</span>{' '}
              <span className="font-mono font-bold text-navy-900 dark:text-brand-400">
                {selectedStudent?.admission_no}
              </span>
            </div>
            <Badge variant={selectedStudent?.is_active ? 'success' : 'danger'}>
              {selectedStudent?.is_active ? 'Active' : 'Archived'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Student Full Name"
              required
              value={editFormData.full_name}
              onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
            />

            <Select
              label="Gender"
              required
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' },
              ]}
              value={editFormData.gender}
              onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as any })}
            />

            <Input
              label="Date of Birth"
              type="date"
              required
              value={editFormData.date_of_birth}
              onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
            />

            <Input
              label="B-Form / CNIC"
              placeholder="35201-xxxxxxx-x"
              value={editFormData.b_form_or_cnic}
              onChange={(e) => setEditFormData({ ...editFormData, b_form_or_cnic: e.target.value })}
            />

            <Input
              label="Admission Date"
              type="date"
              required
              value={editFormData.admission_date}
              onChange={(e) => setEditFormData({ ...editFormData, admission_date: e.target.value })}
            />

            <Select
              label="Blood Group"
              options={[
                { value: 'A+', label: 'A+' },
                { value: 'A-', label: 'A-' },
                { value: 'B+', label: 'B+' },
                { value: 'B-', label: 'B-' },
                { value: 'AB+', label: 'AB+' },
                { value: 'AB-', label: 'AB-' },
                { value: 'O+', label: 'O+' },
                { value: 'O-', label: 'O-' },
              ]}
              value={editFormData.blood_group}
              onChange={(e) => setEditFormData({ ...editFormData, blood_group: e.target.value })}
            />

            <Input
              label="Father / Guardian Name"
              required
              value={editFormData.guardian_name}
              onChange={(e) => setEditFormData({ ...editFormData, guardian_name: e.target.value })}
            />

            <Select
              label="Guardian Relation"
              options={[
                { value: 'Father', label: 'Father' },
                { value: 'Mother', label: 'Mother' },
                { value: 'Uncle', label: 'Uncle' },
                { value: 'Grandparent', label: 'Grandparent' },
                { value: 'Legal Guardian', label: 'Legal Guardian' },
              ]}
              value={editFormData.guardian_relation}
              onChange={(e) => setEditFormData({ ...editFormData, guardian_relation: e.target.value })}
            />

            <Input
              label="Guardian CNIC"
              placeholder="35201-xxxxxxx-x"
              value={editFormData.guardian_cnic}
              onChange={(e) => setEditFormData({ ...editFormData, guardian_cnic: e.target.value })}
            />

            <Input
              label="Guardian Contact Number"
              required
              placeholder="+92 300 xxxxxxx"
              value={editFormData.guardian_phone}
              onChange={(e) => setEditFormData({ ...editFormData, guardian_phone: e.target.value })}
            />

            <Input
              label="Emergency Contact"
              placeholder="+92 321 xxxxxxx"
              value={editFormData.emergency_contact}
              onChange={(e) => setEditFormData({ ...editFormData, emergency_contact: e.target.value })}
            />

            <Input
              label="Student Photo URL (Optional)"
              placeholder="https://example.com/photo.jpg"
              value={editFormData.photo_url}
              onChange={(e) => setEditFormData({ ...editFormData, photo_url: e.target.value })}
            />

            <Select
              label="Class"
              required
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              value={editFormData.class_id}
              onChange={(e) => {
                const clsId = e.target.value;
                const firstSec = sections.find((s) => s.class_id === clsId);
                setEditFormData({ ...editFormData, class_id: clsId, section_id: firstSec?.id || '' });
              }}
            />

            <Select
              label="Section"
              required
              options={availableEditSections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))}
              value={editFormData.section_id}
              onChange={(e) => setEditFormData({ ...editFormData, section_id: e.target.value })}
            />
          </div>

          <Input
            label="Residential Address"
            required
            placeholder="House #, Street, Town / City"
            value={editFormData.address}
            onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isEditSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Modal: CSV Bulk Import */}
      <Modal
        isOpen={isCsvImportModalOpen}
        onClose={() => {
          setIsCsvImportModalOpen(false);
          setCsvPreview(null);
        }}
        title="Bulk Student Admission via CSV"
        description="Upload a CSV with columns: Full Name, Gender, Date of Birth, Guardian Name, Guardian Phone, Address"
        size="lg"
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-navy-900 file:text-white hover:file:bg-navy-800 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              UTF-8 CSV format with standard headers. Automatically validates every row before saving.
            </p>
          </div>

          {/* Validation & Preview Summary */}
          {csvPreview && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  {csvPreview.validRows.length} Valid Rows Ready
                </div>
                {csvPreview.errors.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    {csvPreview.errors.length} Errors Found
                  </div>
                )}
              </div>

              {csvPreview.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-2.5 text-xs text-rose-700 space-y-1">
                  {csvPreview.errors.map((err, idx) => (
                    <div key={idx}>
                      Row {err.rowNumber}: {err.reason}
                    </div>
                  ))}
                </div>
              )}

              {csvPreview.validRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-semibold">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">Gender</th>
                        <th className="p-2">DOB</th>
                        <th className="p-2">Guardian</th>
                        <th className="p-2">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvPreview.validRows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td className="p-2">{r.full_name}</td>
                          <td className="p-2">{r.gender}</td>
                          <td className="p-2">{r.date_of_birth}</td>
                          <td className="p-2">{r.guardian_name}</td>
                          <td className="p-2">{r.guardian_phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.validRows.length > 5 && (
                    <p className="text-[11px] text-slate-400 p-2 text-center bg-slate-50">
                      ...and {csvPreview.validRows.length - 5} more records
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsCsvImportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!csvPreview || csvPreview.validRows.length === 0}
              isLoading={isImporting}
              onClick={handleExecuteImport}
            >
              Confirm Import ({csvPreview?.validRows.length || 0} Students)
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. Student Portal Account Management Modal */}
      <Modal
        isOpen={isPortalModalOpen}
        onClose={() => {
          setIsPortalModalOpen(false);
          setPortalError(null);
          setPortalSuccess(null);
        }}
        title={`Student Portal Access — ${portalStudent?.full_name || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {portalStudent?.full_name} ({portalStudent?.admission_no})
              </div>
              <div className="text-[11px] text-slate-500">
                Guardian: {portalStudent?.guardian_name} ({portalStudent?.guardian_phone})
              </div>
            </div>
            <Badge variant={portalStudent?.profile_id || portalStudent?.email ? 'info' : 'default'}>
              {portalStudent?.profile_id || portalStudent?.email ? 'Provisioned' : 'Not Provisioned'}
            </Badge>
          </div>

          {portalError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium">
              {portalError}
            </div>
          )}

          {portalSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              {portalSuccess}
            </div>
          )}

          {portalStudent?.profile_id || portalStudent?.email ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Linked Student Login Email
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={portalStudent.email || portalEmail}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Reset Account Password
                </h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter new password (min 6 chars)"
                    type="password"
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={portalLoading}
                    onClick={handleResetPortalPassword}
                    disabled={!portalPassword || portalPassword.length < 6}
                  >
                    Set Password
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Account Portal Access Status
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {portalStudent.portal_status === 'inactive'
                      ? 'Currently Deactivated — Student cannot log in'
                      : 'Currently Active — Student can log in'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={portalStudent.portal_status === 'inactive' ? 'primary' : 'danger'}
                  isLoading={portalLoading}
                  onClick={handleTogglePortalStatus}
                >
                  {portalStudent.portal_status === 'inactive' ? 'Reactivate Access' : 'Deactivate Access'}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProvisionPortalAccount} className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Create a dedicated login profile for this student. Once provisioned, the student can log in to view their own quiz marks, class daily diary, and academic record.
              </p>

              <Input
                label="Student Login Email"
                type="email"
                required
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="e.g. student@school.edu.pk"
              />

              <Input
                label="Initial Password"
                type="password"
                required
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="Enter password (min 6 characters)"
              />

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPortalModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={portalLoading}>
                  Provision Portal Account
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* 5. Confirmation Dialog: Soft Archive */}
      <ConfirmationDialog
        isOpen={isArchiveDialogOpen}
        onClose={() => setIsArchiveDialogOpen(false)}
        onConfirm={handleArchiveConfirm}
        title="Archive Student Record"
        message={`Are you sure you want to archive student ${selectedStudent?.full_name}? The student's academic and financial history will be preserved, but they will be marked inactive.`}
        confirmText="Archive Student"
        variant="danger"
      />

      {/* 5b. Confirmation Dialog: Single Student Portal Status Toggle */}
      <ConfirmationDialog
        isOpen={portalToggleConfirm.isOpen}
        onClose={() => setPortalToggleConfirm({ isOpen: false, student: null, active: false })}
        onConfirm={handleExecutePortalToggle}
        title={portalToggleConfirm.active ? 'Reactivate Student Portal' : 'Deactivate Student Portal'}
        message={
          portalToggleConfirm.active
            ? `Are you sure you want to reactivate portal access for ${portalToggleConfirm.student?.full_name} (${portalToggleConfirm.student?.admission_no})? The student will be able to log in again.`
            : `Are you sure you want to deactivate portal access for ${portalToggleConfirm.student?.full_name} (${portalToggleConfirm.student?.admission_no})? The student will be prevented from logging in immediately, but all academic and financial history will be preserved.`
        }
        confirmText={portalToggleConfirm.active ? 'Reactivate Portal' : 'Deactivate Portal'}
        variant={portalToggleConfirm.active ? 'primary' : 'danger'}
      />

      {/* 5c. Modal: Safe Student Record Deletion */}
      <Modal
        isOpen={isSafeDeleteModalOpen}
        onClose={() => setIsSafeDeleteModalOpen(false)}
        title="Safe Student Record Deletion"
        size="md"
      >
        <div className="space-y-4">
          {isCheckingEligibility ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-xs text-slate-500">Inspecting academic and financial dependencies...</p>
            </div>
          ) : deletionEligibility?.has_dependencies ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-200">
                    Permanent Deletion Blocked
                  </div>
                  <div className="text-amber-800 dark:text-amber-300">
                    This student record has active historical records linked to their account. Deleting them permanently would violate institutional data integrity and break financial audit trails.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Linked Institutional Dependencies:
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500">Attendance Records:</span>{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {deletionEligibility.dependencies.attendance_records}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500">Fee Invoices:</span>{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {deletionEligibility.dependencies.fee_invoices}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500">Fee Payments:</span>{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {deletionEligibility.dependencies.fee_payments}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500">Exam Marks:</span>{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {deletionEligibility.dependencies.exam_marks}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                <b>Recommended Action:</b> Archive this student instead. Archiving marks the student inactive and revokes portal access while preserving all financial and examination history.
              </p>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSafeDeleteModalOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsSafeDeleteModalOpen(false);
                    if (deletingStudent) {
                      setSelectedStudent(deletingStudent);
                      setIsArchiveDialogOpen(true);
                    }
                  }}
                  leftIcon={<Archive className="w-3.5 h-3.5" />}
                >
                  Archive Student Instead
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-rose-900 dark:text-rose-200">
                    Confirm Permanent Student Deletion
                  </div>
                  <div className="text-rose-800 dark:text-rose-300">
                    This student has no attendance, exam, or fee history. Deletion is safe and permanent.
                  </div>
                </div>
              </div>

              {deleteError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                  {deleteError}
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div><b>Student:</b> {deletingStudent?.full_name}</div>
                <div><b>Admission Number:</b> {deletingStudent?.admission_no}</div>
                <div className="text-slate-500 text-[11px] mt-1">This will permanently erase the student record and any unlinked portal profile.</div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSafeDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isLoading={isDeletingStudent}
                  onClick={handleExecuteSafeDelete}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Permanently Delete Student
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 6. Modal: Bulk Student Portal Action Confirmation */}
      <Modal
        isOpen={isBulkConfirmOpen}
        onClose={() => setIsBulkConfirmOpen(false)}
        title={
          bulkActionType === 'activate'
            ? `Bulk Student Portal Activation (${eligibleBulkStudents.length} Students)`
            : bulkActionType === 'deactivate'
            ? `Bulk Student Portal Deactivation (${eligibleBulkStudents.length} Students)`
            : `Bulk Student Portal Reactivation (${eligibleBulkStudents.length} Students)`
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-200">
              {bulkActionType === 'activate' && (
                <span>
                  <span className="font-semibold">Batch Account Provisioning:</span> Each selected unprovisioned student will be provisioned with an individual authentication account and linked profile. Their login identifier will be automatically derived from their official admission number.
                </span>
              )}
              {bulkActionType === 'deactivate' && (
                <span>
                  <span className="font-semibold">Batch Portal Deactivation:</span> Each selected student will have their portal login access deactivated. All grades, attendance, and fee transactions are preserved completely.
                </span>
              )}
              {bulkActionType === 'reactivate' && (
                <span>
                  <span className="font-semibold">Batch Portal Reactivation:</span> Each selected student will regain portal login access with their existing credentials.
                </span>
              )}
            </div>
          </div>

          {bulkActionType === 'activate' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Default Initial Password
              </label>
              <Input
                type="text"
                value={bulkPassword}
                onChange={(e) => setBulkPassword(e.target.value)}
                placeholder="e.g. Student123!"
                required
              />
              <p className="text-[11px] text-slate-500">
                This password will be assigned to all newly created student accounts. Students can update their passwords upon login.
              </p>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Eligible Students Preview ({eligibleBulkStudents.length})
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              {eligibleBulkStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No selected students match this operation criteria.
                </div>
              ) : (
                eligibleBulkStudents.map((student) => (
                  <div key={student.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{student.full_name}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">({student.admission_no})</span>
                    </div>
                    <Badge
                      variant={
                        student.portal_status === 'active'
                          ? 'success'
                          : student.portal_status === 'inactive'
                          ? 'danger'
                          : 'default'
                      }
                    >
                      {student.portal_status ? student.portal_status.toUpperCase() : 'NOT PROVISIONED'}
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
              disabled={eligibleBulkStudents.length === 0}
              onClick={handleExecuteBulkAction}
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
              Confirm & {bulkActionType === 'activate' ? 'Activate' : bulkActionType === 'deactivate' ? 'Deactivate' : 'Reactivate'} {eligibleBulkStudents.length} Portals
            </Button>
          </div>
        </div>
      </Modal>

      {/* 7. Modal: Live Bulk Activation Progress */}
      <Modal
        isOpen={isBulkProcessing}
        onClose={() => {}}
        title="Activating Student Portals..."
        size="sm"
      >
        <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Provisioning Accounts
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Communicating with Supabase Auth and database... Please do not close this window.
            </p>
          </div>
        </div>
      </Modal>

      {/* 8. Modal: Bulk Activation Operational Report */}
      <Modal
        isOpen={bulkResultsModalOpen}
        onClose={() => setBulkResultsModalOpen(false)}
        title="Bulk Portal Activation Report"
        size="lg"
      >
        <div className="space-y-4">
          {bulkResults && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500">Requested</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {bulkResults.total_requested}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-center border border-emerald-200 dark:border-emerald-900">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">Activated</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {bulkResults.success_count}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-center border border-amber-200 dark:border-amber-900">
                  <div className="text-xs text-amber-700 dark:text-amber-300">Skipped</div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {bulkResults.skipped_count}
                  </div>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-center border border-rose-200 dark:border-rose-900">
                  <div className="text-xs text-rose-700 dark:text-rose-300">Failed</div>
                  <div className="text-lg font-bold text-rose-700 dark:text-rose-300">
                    {bulkResults.failed_count}
                  </div>
                </div>
              </div>

              {/* Results Breakdown Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Student</th>
                        <th className="p-2.5">Admission #</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {bulkResults.results.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5">
                            <Badge
                              variant={
                                r.status === 'success'
                                  ? 'success'
                                  : r.status === 'skipped'
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {r.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">
                            {r.student_name}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            {r.admission_no}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {r.email || '—'}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">
                            {r.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  {bulkResults.failed_count > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryFailed}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      className="text-rose-600 border-rose-300 hover:bg-rose-50"
                    >
                      Retry Failed Students ({bulkResults.failed_count})
                    </Button>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setBulkResultsModalOpen(false)}
                >
                  Close & Refresh
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
