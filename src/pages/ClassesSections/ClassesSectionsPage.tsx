import React, { useState, useEffect } from 'react';
import { ClassLevel, Section } from '@/types/database';
import { academicStructureApi } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { School, Plus, DoorOpen, Users } from 'lucide-react';

export const ClassesSectionsPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);

  const [classForm, setClassForm] = useState({ name: '', numeric_order: 1, description: '' });
  const [sectionForm, setSectionForm] = useState({ class_id: '', name: 'A', capacity: 40, room_no: 'Room 101' });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cList, sList] = await Promise.all([
        academicStructureApi.getClasses(),
        academicStructureApi.getSections(),
      ]);
      setClasses(cList);
      setSections(sList);
    } catch (e) {
      console.error('Failed to load class/section data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name) return;
    try {
      await academicStructureApi.createClass(classForm);
      setIsAddClassModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error creating class: ${err.message}`);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.class_id || !sectionForm.name) return;
    try {
      await academicStructureApi.createSection(sectionForm);
      setIsAddSectionModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Error creating section: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Classes & Sections
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage academic tiers, class levels, classroom allocations and capacities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setSectionForm({
                class_id: classes[0]?.id || '',
                name: 'C',
                capacity: 40,
                room_no: 'Room 105',
              });
              setIsAddSectionModalOpen(true);
            }}
          >
            Add Section
          </Button>

          <Button
            size="sm"
            leftIcon={<School className="w-4 h-4" />}
            onClick={() => {
              setClassForm({ name: `Class ${classes.length + 1}`, numeric_order: classes.length + 1, description: '' });
              setIsAddClassModalOpen(true);
            }}
          >
            Add Class
          </Button>
        </div>
      </div>

      {/* Class Levels Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const classSections = sections.filter((s) => s.class_id === cls.id);
          return (
            <Card key={cls.id} className="border-t-4 border-t-navy-900 dark:border-t-brand-500">
              <CardHeader className="py-3">
                <div>
                  <CardTitle className="text-sm font-bold text-navy-950 dark:text-white">
                    {cls.name}
                  </CardTitle>
                  <p className="text-[11px] text-slate-400">Order: Grade {cls.numeric_order}</p>
                </div>
                <Badge variant="outline">{classSections.length} Sections</Badge>
              </CardHeader>
              <CardContent className="space-y-2.5 p-4">
                {cls.description && (
                  <p className="text-xs text-slate-500 mb-2">{cls.description}</p>
                )}

                <div className="space-y-1.5">
                  {classSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Section {sec.name}
                        </span>
                        {sec.room_no && (
                          <span className="text-[10px] text-slate-400">({sec.room_no})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Users className="w-3.5 h-3.5" />
                        <span>Cap: {sec.capacity}</span>
                      </div>
                    </div>
                  ))}
                  {classSections.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2 text-center">
                      No sections configured for this class yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal: Add Class */}
      <Modal
        isOpen={isAddClassModalOpen}
        onClose={() => setIsAddClassModalOpen(false)}
        title="Create New Class Level"
        size="sm"
      >
        <form onSubmit={handleCreateClass} className="space-y-4">
          <Input
            label="Class Title"
            required
            placeholder="e.g. Class 9 or Grade 1"
            value={classForm.name}
            onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
          />
          <Input
            label="Numeric Order"
            type="number"
            required
            value={classForm.numeric_order}
            onChange={(e) => setClassForm({ ...classForm, numeric_order: Number(e.target.value) })}
          />
          <Input
            label="Description / Level"
            placeholder="e.g. Secondary School Certificate"
            value={classForm.description}
            onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddClassModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Class</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Section */}
      <Modal
        isOpen={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        title="Add Section to Class"
        size="sm"
      >
        <form onSubmit={handleCreateSection} className="space-y-4">
          <Select
            label="Select Class"
            required
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            value={sectionForm.class_id}
            onChange={(e) => setSectionForm({ ...sectionForm, class_id: e.target.value })}
          />
          <Input
            label="Section Name"
            required
            placeholder="e.g. A, B, Blue, Rose"
            value={sectionForm.name}
            onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Student Capacity"
              type="number"
              required
              value={sectionForm.capacity}
              onChange={(e) => setSectionForm({ ...sectionForm, capacity: Number(e.target.value) })}
            />
            <Input
              label="Room / Hall #"
              placeholder="e.g. Room 102"
              value={sectionForm.room_no}
              onChange={(e) => setSectionForm({ ...sectionForm, room_no: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddSectionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Section</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
