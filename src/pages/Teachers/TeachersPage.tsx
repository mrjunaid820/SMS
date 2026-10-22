import React, { useState, useEffect } from 'react';
import { Teacher, TeacherAssignment } from '@/types/database';
import { teacherApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import { UserPlus, UserCheck, UserX, BookOpen, Mail, Phone } from 'lucide-react';

export const TeachersPage: React.FC = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    phone: '',
    email: '',
    qualification: '',
    joining_date: new Date().toISOString().split('T')[0],
    designation: 'Senior Subject Master',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tList, aList] = await Promise.all([
        teacherApi.getTeachers(),
        teacherApi.getAssignments(),
      ]);
      setTeachers(tList);
      setAssignments(aList);
    } catch (e) {
      console.error('Failed to load teachers', e);
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
        { id: user?.id, name: user?.full_name }
      );
      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error saving teacher: ${err.message}`);
    }
  };

  const handleToggleStatus = async (teacher: Teacher) => {
    try {
      await teacherApi.updateTeacher(
        teacher.id,
        { is_active: !teacher.is_active },
        { id: user?.id, name: user?.full_name }
      );
      await loadData();
    } catch (err: any) {
      alert(`Error updating teacher status: ${err.message}`);
    }
  };

  const columns: Column<Teacher>[] = [
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
            <span className="truncate max-w-[150px]">{row.email || '—'}</span>
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
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setSelectedTeacher(row);
              setIsViewModalOpen(true);
            }}
            className="p-1.5 text-slate-500 hover:text-navy-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            title="View Teaching Assignments"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-md ${
              row.is_active
                ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
            title={row.is_active ? 'Deactivate Teacher Account' : 'Activate Teacher Account'}
          >
            {row.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Teacher Faculty Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Profiles, employment records, qualifications and subject assignments
          </p>
        </div>

        <Button size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={handleOpenAdd}>
          Add New Teacher
        </Button>
      </div>

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
        title={selectedTeacher ? `${selectedTeacher.full_name} — Assigned Classes` : 'Assignments'}
        size="md"
      >
        <div className="space-y-3">
          {selectedTeacher && (
            <>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs flex justify-between">
                <span>Emp ID: <b>{selectedTeacher.employee_id}</b></span>
                <span>Qualification: <b>{selectedTeacher.qualification}</b></span>
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

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
