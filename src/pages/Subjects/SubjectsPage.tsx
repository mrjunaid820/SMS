import React, { useState, useEffect } from 'react';
import { Subject, ClassLevel } from '@/types/database';
import { academicStructureApi } from '@/services/api';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { BookOpen, Plus } from 'lucide-react';

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    class_id: '',
    is_elective: false,
    credit_hours: 5,
  });

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
      console.error('Failed to load subjects', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      code: '',
      class_id: classes[0]?.id || '',
      is_elective: false,
      credit_hours: 5,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return;
    try {
      await academicStructureApi.createSubject(formData);
      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error creating subject: ${err.message}`);
    }
  };

  const columns: Column<Subject>[] = [
    {
      key: 'code',
      header: 'Subject Code',
      sortable: true,
      className: 'font-mono text-xs font-bold text-navy-900 dark:text-brand-400',
    },
    {
      key: 'name',
      header: 'Subject Title',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</span>
      ),
    },
    {
      key: 'class',
      header: 'Target Class',
      render: (row) => row.class?.name || 'All Classes',
    },
    {
      key: 'type',
      header: 'Subject Type',
      render: (row) => (
        <Badge variant={row.is_elective ? 'info' : 'default'}>
          {row.is_elective ? 'Elective' : 'Core Compulsory'}
        </Badge>
      ),
    },
    {
      key: 'credit_hours',
      header: 'Weekly Periods',
      sortable: true,
      render: (row) => `${row.credit_hours} periods/week`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Curriculum & Subjects
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Core compulsory and elective subjects across all academic levels
          </p>
        </div>

        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenAdd}>
          Add Subject
        </Button>
      </div>

      <DataTable
        data={subjects}
        columns={columns}
        isLoading={isLoading}
        rowKey={(s) => s.id}
        searchPlaceholder="Search subjects by name or code..."
      />

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Curriculum Subject"
        size="md"
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <Input
            label="Subject Title"
            required
            placeholder="e.g. Pakistan Studies"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Subject Code"
              required
              placeholder="e.g. PST-09"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
            <Input
              label="Weekly Periods"
              type="number"
              required
              value={formData.credit_hours}
              onChange={(e) => setFormData({ ...formData, credit_hours: Number(e.target.value) })}
            />
          </div>

          <Select
            label="Class Level"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            value={formData.class_id}
            onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_elective"
              checked={formData.is_elective}
              onChange={(e) => setFormData({ ...formData, is_elective: e.target.checked })}
              className="rounded text-navy-900 focus:ring-navy-900 w-4 h-4"
            />
            <label htmlFor="is_elective" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Elective subject (optional / track-specific)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Subject</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
