import React, { useState, useEffect } from 'react';
import { Teacher, TeacherAssignment, Section, Subject, AcademicSession } from '@/types/database';
import { teacherApi, academicStructureApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Select } from '@/components/common/Select';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { Badge } from '@/components/common/Badge';
import { UserCheck, Trash2, Plus, ShieldCheck } from 'lucide-react';

export const TeacherAssignmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedSessionId } = useSchool();

  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null);

  const [formData, setFormData] = useState({
    teacher_id: '',
    section_id: '',
    subject_id: '',
    is_class_teacher: false,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [aList, tList, secList, subList] = await Promise.all([
        teacherApi.getAssignments(selectedSessionId),
        teacherApi.getTeachers(),
        academicStructureApi.getSections(),
        academicStructureApi.getSubjects(),
      ]);
      setAssignments(aList);
      setTeachers(tList.filter((t) => t.is_active));
      setSections(secList);
      setSubjects(subList);
    } catch (e) {
      console.error('Failed to load assignments', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSessionId]);

  const handleOpenAdd = () => {
    setFormData({
      teacher_id: teachers[0]?.id || '',
      section_id: sections[0]?.id || '',
      subject_id: subjects[0]?.id || '',
      is_class_teacher: false,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacher_id || !formData.section_id || !formData.subject_id) return;

    // Check duplicate
    const exists = assignments.some(
      (a) =>
        a.teacher_id === formData.teacher_id &&
        a.section_id === formData.section_id &&
        a.subject_id === formData.subject_id
    );
    if (exists) {
      alert('This teacher is already assigned to this subject and section.');
      return;
    }

    try {
      await teacherApi.createAssignment(
        {
          teacher_id: formData.teacher_id,
          academic_session_id: selectedSessionId,
          section_id: formData.section_id,
          subject_id: formData.subject_id,
          is_class_teacher: formData.is_class_teacher,
        },
        { id: user?.id, name: user?.full_name }
      );
      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error saving assignment: ${err.message}`);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!selectedAssignment) return;
    try {
      await teacherApi.deleteAssignment(selectedAssignment.id, { id: user?.id, name: user?.full_name });
      setIsDeleteDialogOpen(false);
      setSelectedAssignment(null);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting assignment: ${err.message}`);
    }
  };

  const columns: Column<TeacherAssignment>[] = [
    {
      key: 'teacher',
      header: 'Teacher Name',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.teacher?.full_name}</span>
          <span className="text-xs text-slate-400 font-mono ml-2">({row.teacher?.employee_id})</span>
        </div>
      ),
    },
    {
      key: 'section',
      header: 'Assigned Class & Section',
      render: (row) => (
        <span className="font-medium text-slate-800 dark:text-slate-200">
          {row.section?.class?.name} — Section {row.section?.name}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject Taught',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200">{row.subject?.name}</span>
          <span className="text-xs text-brand-600 dark:text-brand-400 font-mono ml-2">({row.subject?.code})</span>
        </div>
      ),
    },
    {
      key: 'incharge',
      header: 'Class In-charge',
      render: (row) => (
        row.is_class_teacher ? (
          <Badge variant="success">Class Teacher</Badge>
        ) : (
          <span className="text-xs text-slate-400">Subject Master</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <button
          onClick={() => {
            setSelectedAssignment(row);
            setIsDeleteDialogOpen(true);
          }}
          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
          title="Revoke Assignment"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Teacher Assignments & Scopes
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Maps faculty to sections and subjects for automated RLS and exam grading permissions
          </p>
        </div>

        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenAdd}>
          New Assignment
        </Button>
      </div>

      <DataTable
        data={assignments}
        columns={columns}
        isLoading={isLoading}
        rowKey={(a) => a.id}
        searchPlaceholder="Search assignments by teacher, class, subject..."
        searchFilter={(row, term) => {
          return (
            (row.teacher?.full_name || '').toLowerCase().includes(term) ||
            (row.subject?.name || '').toLowerCase().includes(term) ||
            (row.section?.class?.name || '').toLowerCase().includes(term)
          );
        }}
      />

      {/* Modal: New Assignment */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Assign Teacher to Class & Subject"
        description="Grants portal permission for section attendance and subject marks entry"
        size="md"
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4">
          <Select
            label="Select Teacher"
            required
            options={teachers.map((t) => ({ value: t.id, label: `${t.full_name} (${t.employee_id})` }))}
            value={formData.teacher_id}
            onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
          />

          <Select
            label="Select Section"
            required
            options={sections.map((s) => ({ value: s.id, label: `${s.class?.name || 'Class'} - Section ${s.name}` }))}
            value={formData.section_id}
            onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
          />

          <Select
            label="Select Subject"
            required
            options={subjects.map((sub) => ({ value: sub.id, label: `${sub.name} (${sub.code})` }))}
            value={formData.subject_id}
            onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_class_teacher"
              checked={formData.is_class_teacher}
              onChange={(e) => setFormData({ ...formData, is_class_teacher: e.target.checked })}
              className="rounded text-navy-900 focus:ring-navy-900 w-4 h-4"
            />
            <label htmlFor="is_class_teacher" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Appoint as Section Class In-charge (authorized for master register)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Assign Teacher</Button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteAssignment}
        title="Revoke Teacher Assignment"
        message="Are you sure you want to revoke this teacher assignment? The teacher will no longer be authorized to record attendance or grade exams for this section."
        confirmText="Revoke Assignment"
        variant="danger"
      />
    </div>
  );
};
