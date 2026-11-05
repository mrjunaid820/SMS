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
  EyeOff,
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
  Camera,
  Mail,
  Lock,
  Copy,
  Sparkles,
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

  // Student Manage Credentials Modal State
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [portalStudent, setPortalStudent] = useState<Student | null>(null);
  const [newStudentLoginEmail, setNewStudentLoginEmail] = useState('');
  const [studentPasswordMethod, setStudentPasswordMethod] = useState<'temp' | 'link'>('temp');
  const [studentTemporaryPassword, setStudentTemporaryPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [copiedStudentCredentials, setCopiedStudentCredentials] = useState(false);
  const [isStudentEmailSubmitting, setIsStudentEmailSubmitting] = useState(false);
  const [isStudentPasswordSubmitting, setIsStudentPasswordSubmitting] = useState(false);
  const [isStudentStatusSubmitting, setIsStudentStatusSubmitting] = useState(false);
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
  const [isDeactivatingStudent, setIsDeactivatingStudent] = useState(false);
  const [safeRemovalReason, setSafeRemovalReason] = useState('');
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
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  const { activeStudentClassSection, activeStudentRollNo } = useMemo(() => {
    if (!portalStudent) return { activeStudentClassSection: 'Unassigned', activeStudentRollNo: 'N/A' };
    const enr = enrollments.find((e) => e.student_id === portalStudent.id);
    const sec = enr?.section || sections.find((s) => s.id === enr?.section_id);
    const cls = sec?.class || classes.find((c) => c.id === sec?.class_id);
    const classStr = cls ? cls.name : 'Class';
    const sectionStr = sec ? sec.name : '';
    const classSec = sec ? `${classStr} - ${sectionStr}` : (cls ? cls.name : 'Unassigned');
    const roll = enr?.roll_no ? `${enr.roll_no}` : 'N/A';
    return { activeStudentClassSection: classSec, activeStudentRollNo: roll };
  }, [portalStudent, enrollments, sections, classes]);

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

  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;
    setIsPhotoUploading(true);
    setPhotoMessage(null);
    try {
      const res = await studentApi.uploadStudentPhoto(selectedStudent.id, file, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role || 'admin',
      });
      setPhotoMessage({ type: 'success', text: 'Student photo updated successfully!' });
      setSelectedStudent(res.student);
      setStudents((prev) => prev.map((s) => (s.id === res.student.id ? res.student : s)));
    } catch (err: any) {
      setPhotoMessage({ type: 'error', text: err.message || 'Failed to upload photo.' });
    } finally {
      setIsPhotoUploading(false);
      e.target.value = '';
    }
  };

  const handleAdminPhotoRemove = async (studentId: string) => {
    if (!window.confirm('Are you sure you want to remove this photo and revert to the default avatar?')) return;
    setIsPhotoUploading(true);
    setPhotoMessage(null);
    try {
      const res = await studentApi.removeStudentPhoto(studentId, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role || 'admin',
      });
      setPhotoMessage({ type: 'success', text: res.message });
      setSelectedStudent(res.student);
      setStudents((prev) => prev.map((s) => (s.id === res.student.id ? res.student : s)));
      await loadData();
    } catch (err: any) {
      setPhotoMessage({ type: 'error', text: err.message || 'Failed to remove photo.' });
    } finally {
      setIsPhotoUploading(false);
    }
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
      // Explicitly normalize photo_url: if empty or cleared, send NULL so database column is cleared
      const photoPayload = editFormData.photo_url && editFormData.photo_url.trim().length > 0
        ? editFormData.photo_url.trim()
        : null;

      const result = await studentApi.updateStudentWithEnrollment(
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
          photo_url: photoPayload,
        },
        editFormData.section_id,
        selectedSessionId,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );

      // Immediately synchronize React component state with the confirmed database record
      setSelectedStudent(result.student);
      setStudents((prev) => prev.map((s) => (s.id === result.student.id ? result.student : s)));

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
    setShowStudentPassword(false);
    setCopiedStudentCredentials(false);
    setStudentPasswordMethod('temp');

    if (student.email) {
      setNewStudentLoginEmail(student.email.trim());
    } else {
      const sanitizedAdmission = (student.admission_no || 'stu')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      setNewStudentLoginEmail(`student.${sanitizedAdmission}@islamiapublic.edu.pk`);
    }

    if (student.profile_id || student.email) {
      setStudentTemporaryPassword(`Stu-${Math.random().toString(36).slice(-6)}!`);
    } else {
      setStudentTemporaryPassword('Student123!');
    }
    setIsPortalModalOpen(true);
  };

  const handleProvisionPortalAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalStudent) return;
    setPortalError(null);
    setPortalSuccess(null);

    const cleanEmail = newStudentLoginEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setPortalError('Please provide a valid login email address (e.g. student.adm001@islamiapublic.edu.pk).');
      return;
    }
    if (!studentTemporaryPassword || studentTemporaryPassword.length < 6) {
      setPortalError('Initial password must be at least 6 characters.');
      return;
    }

    setIsStudentPasswordSubmitting(true);
    try {
      const res = await studentApi.provisionStudentAccount(
        portalStudent.id,
        cleanEmail,
        studentTemporaryPassword,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPortalSuccess(`Portal account provisioned successfully! Official Login Email: ${res.profile.email}. Initial password: ${studentTemporaryPassword}`);
      await loadData();
      setPortalStudent((prev) => (prev ? { ...prev, profile_id: res.profile.id, email: res.profile.email, portal_status: 'active' } : null));
    } catch (err: any) {
      setPortalError(err.message || 'Failed to provision portal account.');
    } finally {
      setIsStudentPasswordSubmitting(false);
    }
  };

  const handleUpdateStudentEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalStudent) return;
    setPortalError(null);
    setPortalSuccess(null);

    const cleanEmail = newStudentLoginEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setPortalError('Validation Error: Please enter a valid email address.');
      return;
    }

    if (cleanEmail === (portalStudent.email || '').toLowerCase()) {
      setPortalError('Validation Error: The new email address is identical to the current login email.');
      return;
    }

    setIsStudentEmailSubmitting(true);
    try {
      const res = await studentApi.updateStudentLoginEmail(
        portalStudent.id,
        cleanEmail,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPortalSuccess(res.message);
      setPortalStudent((prev) => (prev ? { ...prev, email: cleanEmail } : null));
      await loadData();
    } catch (err: any) {
      setPortalError(err.message || 'Database error: Failed to update student login email.');
    } finally {
      setIsStudentEmailSubmitting(false);
    }
  };

  const handleResetStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalStudent) return;
    setPortalError(null);
    setPortalSuccess(null);

    if (studentPasswordMethod === 'temp' && (!studentTemporaryPassword || studentTemporaryPassword.length < 6)) {
      setPortalError('Validation Error: Temporary password must be at least 6 characters.');
      return;
    }

    setIsStudentPasswordSubmitting(true);
    try {
      const res = await studentApi.resetStudentPassword(
        portalStudent.id,
        {
          temporaryPassword: studentPasswordMethod === 'temp' ? studentTemporaryPassword : undefined,
          sendResetLink: studentPasswordMethod === 'link',
        },
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPortalSuccess(res.message);
    } catch (err: any) {
      setPortalError(err.message || 'Database error: Failed to process password reset.');
    } finally {
      setIsStudentPasswordSubmitting(false);
    }
  };

  const handleTogglePortalStatus = async () => {
    if (!portalStudent) return;
    setPortalError(null);
    setPortalSuccess(null);

    setIsStudentStatusSubmitting(true);
    try {
      const res = await studentApi.toggleStudentAccountStatus(
        portalStudent.id,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      const newStatus = res.is_active ? 'active' : 'inactive';
      setPortalStudent((prev) => (prev ? { ...prev, portal_status: newStatus } : null));
      setPortalSuccess(
        res.is_active
          ? `Student portal access has been reactivated for ${portalStudent.full_name}. The student can log in again.`
          : `Student portal access has been deactivated for ${portalStudent.full_name}. Login access is now blocked.`
      );
      await loadData();
    } catch (err: any) {
      setPortalError(err.message || 'Database error: Failed to update portal access status.');
    } finally {
      setIsStudentStatusSubmitting(false);
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
    setSafeRemovalReason('');
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

  const handleExecuteSafeDeactivate = async () => {
    if (!deletingStudent) return;
    setIsDeactivatingStudent(true);
    setDeleteError(null);
    try {
      const res = await studentApi.safelyDeactivateAndRemoveStudent(
        deletingStudent.id,
        safeRemovalReason || 'Safely removed from active roster by administrator (historical records retained)',
        {
          id: user?.id,
          name: user?.full_name,
          role: user?.role,
        }
      );
      setIsSafeDeleteModalOpen(false);
      setDeletingStudent(null);
      setSafeRemovalReason('');
      await loadData();
      alert(res.message);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to safely remove student.');
    } finally {
      setIsDeactivatingStudent(false);
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
                  title="Manage Credentials"
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
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    {selectedStudent.photo_url ? (
                      <img
                        src={selectedStudent.photo_url}
                        alt={selectedStudent.full_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-brand-500 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                        {selectedStudent.full_name[0]}
                      </div>
                    )}
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

                {/* Admin Photo Management Controls */}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id={`admin-student-photo-${selectedStudent.id}`}
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAdminPhotoUpload}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={isPhotoUploading}
                      onClick={() => document.getElementById(`admin-student-photo-${selectedStudent.id}`)?.click()}
                      title="Upload or replace student photo"
                    >
                      <Camera className="w-3.5 h-3.5 mr-1.5" />
                      {selectedStudent.photo_url ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    {selectedStudent.photo_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={isPhotoUploading}
                        onClick={() => handleAdminPhotoRemove(selectedStudent.id)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="Remove student photo and revert to default avatar"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {photoMessage && (
                <div
                  className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                    photoMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900'
                      : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200 dark:border-rose-900'
                  }`}
                >
                  {photoMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{photoMessage.text}</span>
                </div>
              )}
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
                <div className="flex items-center gap-2">
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
                  <Button
                    variant="outline"
                    leftIcon={<KeyRound className="w-4 h-4 text-brand-500" />}
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      if (selectedStudent) handleOpenPortalModal(selectedStudent);
                    }}
                  >
                    Manage Credentials
                  </Button>
                </div>
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

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Student Profile Photo
              </label>
              <div className="flex items-center gap-3">
                {editFormData.photo_url ? (
                  <img
                    src={editFormData.photo_url}
                    alt="Preview"
                    className="w-12 h-12 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold">
                    {editFormData.full_name?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    id="edit-student-photo-file-picker"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !selectedStudent) return;
                      try {
                        const res = await studentApi.uploadStudentPhoto(selectedStudent.id, file, {
                          id: user?.id,
                          name: user?.full_name,
                          role: user?.role || 'admin',
                        });
                        setEditFormData((prev) => ({ ...prev, photo_url: res.photo_url }));
                        setSelectedStudent(res.student);
                        setStudents((prev) => prev.map((s) => (s.id === res.student.id ? res.student : s)));
                      } catch (err: any) {
                        alert(err.message || 'Failed to upload photo');
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById('edit-student-photo-file-picker')?.click()}
                    >
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      Browse Image File...
                    </Button>
                    {editFormData.photo_url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditFormData((prev) => ({ ...prev, photo_url: '' }))}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold"
                        title="Remove photo (click Save Changes to apply to database)"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remove Photo
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">JPG, PNG, WEBP or GIF up to 5MB</p>
                </div>
              </div>
              {!editFormData.photo_url && selectedStudent?.photo_url && (
                <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Photo marked for removal. Click <strong>Save Changes</strong> below to update the database.</span>
                </div>
              )}
              <Input
                label="Or Image URL (Optional)"
                placeholder="https://example.com/photo.jpg"
                value={editFormData.photo_url}
                onChange={(e) => setEditFormData({ ...editFormData, photo_url: e.target.value })}
              />
            </div>

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

      {/* 5. Modal: Manage Student Login & Credentials */}
      <Modal
        isOpen={isPortalModalOpen}
        onClose={() => {
          setIsPortalModalOpen(false);
          setPortalError(null);
          setPortalSuccess(null);
          setShowStudentPassword(false);
          setCopiedStudentCredentials(false);
        }}
        title={
          portalStudent
            ? portalStudent.profile_id || portalStudent.email
              ? `Manage Credentials: ${portalStudent.full_name}`
              : `Provision Portal Access: ${portalStudent.full_name}`
            : 'Manage Student Credentials'
        }
        description="Administrator-controlled login identity and credential management"
        size="lg"
      >
        <div className="space-y-6">
          {portalError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{portalError}</span>
              </div>
              <button onClick={() => setPortalError(null)} className="text-rose-400 hover:text-rose-600 text-xs">
                &times;
              </button>
            </div>
          )}

          {portalSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{portalSuccess}</span>
              </div>
              <button onClick={() => setPortalSuccess(null)} className="text-emerald-400 hover:text-emerald-600 text-xs">
                &times;
              </button>
            </div>
          )}

          {/* Student Account Overview: All 8 Required Fields */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <span className="text-slate-500">Student Name:</span>{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">{portalStudent?.full_name}</span>
            </div>
            <div>
              <span className="text-slate-500">Admission Number:</span>{' '}
              <span className="font-mono font-semibold text-navy-900 dark:text-brand-400">{portalStudent?.admission_no}</span>
            </div>
            <div>
              <span className="text-slate-500">Class & Section:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{activeStudentClassSection}</span>
            </div>
            <div>
              <span className="text-slate-500">Roll Number:</span>{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{activeStudentRollNo}</span>
            </div>
            <div>
              <span className="text-slate-500">Guardian Name:</span>{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{portalStudent?.guardian_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500">Guardian Contact:</span>{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">{portalStudent?.guardian_phone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500">Official Student Email:</span>{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{portalStudent?.email || 'Not Configured'}</span>
            </div>
            <div>
              <span className="text-slate-500">Portal Access Status:</span>{' '}
              {portalStudent?.portal_status === 'not_provisioned' || (!portalStudent?.profile_id && !portalStudent?.email) ? (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <UserX className="w-3.5 h-3.5" /> Not Provisioned
                </span>
              ) : portalStudent?.portal_status === 'inactive' ? (
                <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                  <UserX className="w-3.5 h-3.5" /> Inactive (Access Blocked)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" /> Active & Linked
                </span>
              )}
            </div>
          </div>

          {/* Conditional Workflow: Provision Account vs Manage Credentials */}
          {!portalStudent?.profile_id && !portalStudent?.email ? (
            /* Workflow: PROVISION UNLINKED STUDENT */
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Activate Student Portal Account
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    This student does not currently have an active login account in Supabase Auth. Confirm the official student email address and set the initial password to grant portal access.
                  </p>
                </div>
              </div>

              <form onSubmit={handleProvisionPortalAccount} className="space-y-4 pt-1">
                <Input
                  label="Student Login Email Address"
                  type="email"
                  required
                  placeholder="student.name@islamiapublic.edu.pk"
                  value={newStudentLoginEmail}
                  onChange={(e) => setNewStudentLoginEmail(e.target.value)}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Initial Portal Password
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStudentTemporaryPassword('Student123!')}
                        className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 underline font-medium"
                      >
                        Use Default (Student123!)
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setStudentTemporaryPassword(`Stu-${Math.random().toString(36).slice(-6)}!`)}
                        className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium"
                      >
                        <Sparkles className="w-3 h-3" /> Generate Random
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type={showStudentPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 6 characters"
                      value={studentTemporaryPassword}
                      onChange={(e) => setStudentTemporaryPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900 dark:focus:ring-brand-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStudentPassword(!showStudentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                      aria-label={showStudentPassword ? 'Hide password' : 'Show password'}
                    >
                      {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Credential Slip for Admin */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-xs truncate">
                    <span className="text-slate-500">Credentials: </span>
                    <span className="font-mono font-bold text-navy-900 dark:text-brand-400">
                      {newStudentLoginEmail || 'email'} / {studentTemporaryPassword || 'password'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    leftIcon={copiedStudentCredentials ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={() => {
                      navigator.clipboard.writeText(`Student: ${portalStudent?.full_name || ''}\nAdmission No: ${portalStudent?.admission_no || ''}\nEmail: ${newStudentLoginEmail}\nPassword: ${studentTemporaryPassword}`);
                      setCopiedStudentCredentials(true);
                      setTimeout(() => setCopiedStudentCredentials(false), 2000);
                    }}
                    disabled={!studentTemporaryPassword}
                  >
                    {copiedStudentCredentials ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" isLoading={isStudentPasswordSubmitting} leftIcon={<UserCheck className="w-4 h-4" />}>
                    Activate Portal Account
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Workflow: MANAGE PROVISIONED STUDENT */
            <>
              {/* SECTION 1: Update Student Login Email / Identity */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    1. Update Student Login Email / Identity
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Updates the student login identity in Supabase Auth and synchronizes linked profile records while preserving admission history, fee records, and exam marks.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Current Student Login Email
                  </label>
                  <div className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono text-slate-700 dark:text-slate-300">
                    {portalStudent?.email || 'No active email configured'}
                  </div>
                </div>

                <form onSubmit={handleUpdateStudentEmail} className="space-y-3">
                  <Input
                    label="New Login Email Address"
                    type="email"
                    required
                    placeholder="student.new@islamiapublic.edu.pk"
                    value={newStudentLoginEmail}
                    onChange={(e) => setNewStudentLoginEmail(e.target.value)}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" size="sm" isLoading={isStudentEmailSubmitting}>
                      Update Login Email
                    </Button>
                  </div>
                </form>
              </div>

              {/* SECTION 2: Administrator-Controlled Password Reset */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    2. Administrator-Controlled Password Reset
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Students cannot reset passwords directly. As an Administrator, setting a new temporary password updates Supabase Auth and allows the student to log in immediately.
                </p>

                <form onSubmit={handleResetStudentPassword} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label
                      className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 transition-colors ${
                        studentPasswordMethod === 'temp'
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-900 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="studentPasswordMethod"
                          checked={studentPasswordMethod === 'temp'}
                          onChange={() => setStudentPasswordMethod('temp')}
                        />
                        <span>Temporary Password</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Assign immediate password & revoke existing sessions
                      </span>
                    </label>

                    <label
                      className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 transition-colors ${
                        studentPasswordMethod === 'link'
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-900 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="studentPasswordMethod"
                          checked={studentPasswordMethod === 'link'}
                          onChange={() => setStudentPasswordMethod('link')}
                        />
                        <span>Dispatch Reset Link</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Send secure password recovery link to student email
                      </span>
                    </label>
                  </div>

                  {studentPasswordMethod === 'temp' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Authorized Temporary Password
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setStudentTemporaryPassword('Student123!')}
                            className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 underline font-medium"
                          >
                            Use Default (Student123!)
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <button
                            type="button"
                            onClick={() => setStudentTemporaryPassword(`Stu-${Math.random().toString(36).slice(-6)}!`)}
                            className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium"
                          >
                            <Sparkles className="w-3 h-3" /> Generate Random
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <input
                          type={showStudentPassword ? 'text' : 'password'}
                          required
                          placeholder="Minimum 6 characters"
                          value={studentTemporaryPassword}
                          onChange={(e) => setStudentTemporaryPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900 dark:focus:ring-brand-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStudentPassword(!showStudentPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                          aria-label={showStudentPassword ? 'Hide password' : 'Show password'}
                        >
                          {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Credential Slip for Admin */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 mt-2">
                        <div className="text-xs truncate">
                          <span className="text-slate-500">New Credentials: </span>
                          <span className="font-mono font-bold text-navy-900 dark:text-brand-400">
                            {portalStudent?.email || newStudentLoginEmail || 'email'} / {showStudentPassword ? (studentTemporaryPassword || 'password') : '••••••••'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          leftIcon={copiedStudentCredentials ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          onClick={() => {
                            const emailStr = portalStudent?.email || newStudentLoginEmail || '';
                            navigator.clipboard.writeText(`Student: ${portalStudent?.full_name}\nAdmission No: ${portalStudent?.admission_no}\nEmail: ${emailStr}\nPassword: ${studentTemporaryPassword}`);
                            setCopiedStudentCredentials(true);
                            setTimeout(() => setCopiedStudentCredentials(false), 2000);
                          }}
                          disabled={!studentTemporaryPassword}
                        >
                          {copiedStudentCredentials ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] text-slate-400 italic">
                      * Password change will be recorded in audit log without storing plaintext password.
                    </span>
                    <Button type="submit" size="sm" isLoading={isStudentPasswordSubmitting}>
                      Confirm Password Reset
                    </Button>
                  </div>
                </form>
              </div>

              {/* SECTION 3: Student Portal Access Status */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    3. Account Portal Access Status
                  </h4>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      Current Access Status
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {portalStudent?.portal_status === 'inactive'
                        ? 'Account Deactivated — Student login access is currently blocked.'
                        : 'Account Active — Student can log in and view their academic records.'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={portalStudent?.portal_status === 'inactive' ? 'primary' : 'danger'}
                    isLoading={isStudentStatusSubmitting}
                    onClick={handleTogglePortalStatus}
                    leftIcon={portalStudent?.portal_status === 'inactive' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                  >
                    {portalStudent?.portal_status === 'inactive' ? 'Activate Access' : 'Deactivate Access'}
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsPortalModalOpen(false)}>
              Done
            </Button>
          </div>
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

      {/* 5c. Modal: Safe Student Record Deletion & Removal */}
      <Modal
        isOpen={isSafeDeleteModalOpen}
        onClose={() => setIsSafeDeleteModalOpen(false)}
        title={
          deletionEligibility?.has_dependencies
            ? 'Student Removal & Institutional Record Protection'
            : 'Permanent Student Record Deletion'
        }
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
                    Permanent Deletion Blocked — Historical Records Retained
                  </div>
                  <div className="text-amber-800 dark:text-amber-300">
                    This student record has active historical records linked to their account. Deleting them permanently would violate institutional data integrity, delete financial transactions, and break audit trails.
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

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs space-y-2">
                <div className="font-semibold text-blue-900 dark:text-blue-200">
                  Recommended Authorized Action: Safe Deactivation & Removal
                </div>
                <div className="text-blue-800 dark:text-blue-300">
                  This will safely remove <b>{deletingStudent?.full_name}</b> from all active class lists, revoke their student portal login access, and preserve all attendance, fee payments, and examination marks for institutional record-keeping.
                </div>
                <div className="mt-2 space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    Reason for removal (optional):
                  </label>
                  <input
                    type="text"
                    value={safeRemovalReason}
                    onChange={(e) => setSafeRemovalReason(e.target.value)}
                    placeholder="e.g., Transferred to another institution, Withdrawn, Graduated..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {deleteError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                  {deleteError}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSafeDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isLoading={isDeactivatingStudent}
                  onClick={handleExecuteSafeDeactivate}
                  leftIcon={<Archive className="w-3.5 h-3.5" />}
                >
                  Deactivate & Remove from Active Roster
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
                    This student has no attendance, exam, or fee history. Permanent deletion is safe and irreversible.
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
                <div className="text-slate-500 text-[11px] mt-1">This will permanently erase the student record, empty enrollments, and any unlinked portal profile from the database.</div>
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
