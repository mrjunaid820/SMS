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

  // Data Table Columns Definition
  const columns: Column<Student>[] = [
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
        const hasPortal = Boolean(row.profile_id || row.email);
        return (
          <Badge variant={hasPortal ? 'info' : 'default'}>
            {hasPortal ? 'Portal Active' : 'No Account'}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        const enr = enrollments.find((e) => e.student_id === row.id);
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
              <button
                onClick={() => handleOpenPortalModal(row)}
                className="p-1.5 text-brand-600 hover:text-brand-800 dark:hover:text-brand-300 rounded-md hover:bg-brand-50 dark:hover:bg-brand-950/40"
                title="Manage Student Portal Account"
              >
                <KeyRound className="w-4 h-4" />
              </button>
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
              row.is_active ? (
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
              )
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
                    Account Status Controls
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Temporarily disable or restore student login access
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={portalLoading}
                  onClick={handleTogglePortalStatus}
                >
                  Toggle Access
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
    </div>
  );
};
