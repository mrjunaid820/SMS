import React, { useState, useEffect } from 'react';
import { Exam, ExamSubject, ClassLevel, Subject } from '@/types/database';
import { examApi, academicStructureApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import { FileSpreadsheet, Plus, Settings2, Calendar } from 'lucide-react';

export const ExaminationsPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedSessionId } = useSchool();

  const [exams, setExams] = useState<Exam[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const [examForm, setExamForm] = useState({
    name: 'First Term Examination 2026',
    start_date: '2026-05-15',
    end_date: '2026-05-25',
    status: 'Draft' as Exam['status'],
  });

  const [examSubForm, setExamSubForm] = useState({
    exam_id: '',
    class_id: '',
    subject_id: '',
    max_marks: 100,
    passing_marks: 33,
    exam_date: '2026-05-16',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eList, esList, cList, sList] = await Promise.all([
        examApi.getExams(selectedSessionId),
        examApi.getExamSubjects(),
        academicStructureApi.getClasses(),
        academicStructureApi.getSubjects(),
      ]);
      setExams(eList);
      setExamSubjects(esList);
      setClasses(cList);
      setSubjects(sList);
    } catch (e) {
      console.error('Failed to load exams', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSessionId]);

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await examApi.createExam(
        {
          ...examForm,
          academic_session_id: selectedSessionId,
        },
        { id: user?.id, name: user?.full_name }
      );
      setIsAddExamModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error creating exam: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (exam: Exam, newStatus: Exam['status']) => {
    try {
      await examApi.updateExamStatus(exam.id, newStatus, { id: user?.id, name: user?.full_name });
      await loadData();
    } catch (err: any) {
      alert(`Error updating exam status: ${err.message}`);
    }
  };

  const handleSaveExamSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examSubForm.exam_id || !examSubForm.class_id || !examSubForm.subject_id) return;
    try {
      await examApi.createExamSubject(examSubForm);
      setIsAddSubjectModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error adding exam subject: ${err.message}`);
    }
  };

  const columns: Column<Exam>[] = [
    {
      key: 'name',
      header: 'Examination Title',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-navy-950 dark:text-slate-100">{row.name}</span>
          <div className="text-[11px] text-slate-400">
            {formatDate(row.start_date)} to {formatDate(row.end_date)}
          </div>
        </div>
      ),
    },
    {
      key: 'subjects_count',
      header: 'Papers Scheduled',
      render: (row) => {
        const count = examSubjects.filter((es) => es.exam_id === row.id).length;
        return (
          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
            {count} Subjects
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Workflow Stage',
      sortable: true,
      render: (row) => {
        const variantMap: Record<string, any> = {
          Draft: 'default',
          'Under Review': 'warning',
          Published: 'success',
        };
        return <Badge variant={variantMap[row.status]}>{row.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'Draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(row, 'Under Review')}
              className="text-[11px] py-1"
            >
              Submit for Review
            </Button>
          )}
          {row.status === 'Under Review' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleUpdateStatus(row, 'Published')}
              className="text-[11px] py-1"
            >
              Publish Results
            </Button>
          )}
          <button
            onClick={() => {
              setSelectedExam(row);
              setExamSubForm({
                exam_id: row.id,
                class_id: classes[0]?.id || '',
                subject_id: subjects[0]?.id || '',
                max_marks: 100,
                passing_marks: 33,
                exam_date: row.start_date,
              });
              setIsAddSubjectModalOpen(true);
            }}
            className="p-1.5 text-slate-500 hover:text-navy-900 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Configure Papers & Marks"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Examinations & Terms
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create assessment terms, configure subject papers, maximum marks and approval workflows
          </p>
        </div>

        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsAddExamModalOpen(true)}>
          New Examination
        </Button>
      </div>

      <DataTable
        data={exams}
        columns={columns}
        isLoading={isLoading}
        rowKey={(e) => e.id}
        searchPlaceholder="Search examinations..."
      />

      {/* Modal: New Exam */}
      <Modal
        isOpen={isAddExamModalOpen}
        onClose={() => setIsAddExamModalOpen(false)}
        title="Schedule Academic Examination"
        size="md"
      >
        <form onSubmit={handleSaveExam} className="space-y-4">
          <Input
            label="Examination Name"
            required
            placeholder="e.g. Mid-Term Examination 2026"
            value={examForm.name}
            onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              required
              value={examForm.start_date}
              onChange={(e) => setExamForm({ ...examForm, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={examForm.end_date}
              onChange={(e) => setExamForm({ ...examForm, end_date: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddExamModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Examination</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Exam Subject Paper */}
      <Modal
        isOpen={isAddSubjectModalOpen}
        onClose={() => setIsAddSubjectModalOpen(false)}
        title={`Configure Subject Paper — ${selectedExam?.name}`}
        size="md"
      >
        <form onSubmit={handleSaveExamSubject} className="space-y-4">
          <Select
            label="Target Class"
            required
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            value={examSubForm.class_id}
            onChange={(e) => setExamSubForm({ ...examSubForm, class_id: e.target.value })}
          />

          <Select
            label="Subject"
            required
            options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
            value={examSubForm.subject_id}
            onChange={(e) => setExamSubForm({ ...examSubForm, subject_id: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Maximum Marks"
              type="number"
              required
              value={examSubForm.max_marks}
              onChange={(e) => setExamSubForm({ ...examSubForm, max_marks: Number(e.target.value) })}
            />
            <Input
              label="Passing Marks"
              type="number"
              required
              value={examSubForm.passing_marks}
              onChange={(e) => setExamSubForm({ ...examSubForm, passing_marks: Number(e.target.value) })}
            />
          </div>

          <Input
            label="Exam Date"
            type="date"
            value={examSubForm.exam_date}
            onChange={(e) => setExamSubForm({ ...examSubForm, exam_date: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddSubjectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Paper Configuration</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
