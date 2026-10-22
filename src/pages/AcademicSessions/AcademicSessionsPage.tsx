import React, { useState, useEffect } from 'react';
import { AcademicSession } from '@/types/database';
import { settingsApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import { CalendarRange, Plus, Check } from 'lucide-react';

export const AcademicSessionsPage: React.FC = () => {
  const { user } = useAuth();
  const { refreshSettings } = useSchool();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    is_current: false,
  });

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await settingsApi.getSessions();
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '2026-2027',
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      is_current: false,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.start_date || !formData.end_date) {
      alert('Please fill out all session fields.');
      return;
    }

    try {
      await settingsApi.createSession(formData, { id: user?.id, name: user?.full_name });
      setIsAddModalOpen(false);
      await loadSessions();
      await refreshSettings();
    } catch (err: any) {
      alert(`Error creating session: ${err.message}`);
    }
  };

  const columns: Column<AcademicSession>[] = [
    {
      key: 'name',
      header: 'Session Name',
      sortable: true,
      className: 'font-bold text-navy-900 dark:text-brand-300 text-sm',
    },
    {
      key: 'start_date',
      header: 'Start Date',
      sortable: true,
      render: (row) => formatDate(row.start_date),
    },
    {
      key: 'end_date',
      header: 'End Date',
      sortable: true,
      render: (row) => formatDate(row.end_date),
    },
    {
      key: 'status',
      header: 'Current Active',
      render: (row) => (
        <Badge variant={row.is_current ? 'success' : 'default'}>
          {row.is_current ? 'Active Session' : 'Past / Upcoming'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Academic Sessions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure school operational years and term boundary dates
          </p>
        </div>

        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenAdd}>
          New Session
        </Button>
      </div>

      <DataTable
        data={sessions}
        columns={columns}
        isLoading={isLoading}
        rowKey={(s) => s.id}
        searchPlaceholder="Search academic sessions..."
      />

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Academic Session"
        description="Creates a new annual session cycle for admissions and accounts"
        size="md"
      >
        <form onSubmit={handleSaveSession} className="space-y-4">
          <Input
            label="Session Name"
            required
            placeholder="e.g. 2026-2027"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_current"
              checked={formData.is_current}
              onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
              className="rounded text-navy-900 focus:ring-navy-900 w-4 h-4"
            />
            <label htmlFor="is_current" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Set as the current active academic session
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Session</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
