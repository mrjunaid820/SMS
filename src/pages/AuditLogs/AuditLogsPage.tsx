import React, { useState, useEffect } from 'react';
import { AuditLog } from '@/types/database';
import { auditApi } from '@/services/api';
import { DataTable, Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { formatDateTime } from '@/lib/utils';
import { ShieldAlert, Eye, Terminal } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await auditApi.getLogs();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load audit trail', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      className: 'font-mono text-xs text-slate-500',
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: 'action',
      header: 'Event Action',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-navy-950 dark:text-brand-300 font-mono text-xs">
          {row.action}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Performed By',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {row.actor_name || 'System / Admin'}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Target Entity',
      render: (row) => (
        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
          {row.entity_type}
        </span>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      className: 'font-mono text-xs text-slate-400',
    },
    {
      key: 'details',
      header: 'Inspector',
      className: 'text-right',
      render: (row) => (
        <button
          onClick={() => setSelectedLog(row)}
          className="p-1.5 text-navy-900 dark:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          title="Inspect Safe Change Metadata"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            System Audit Trail & Security Logs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable log of sensitive administrative, financial, attendance and grading mutations
          </p>
        </div>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        isLoading={isLoading}
        rowKey={(l) => l.id}
        searchPlaceholder="Filter logs by action, actor, entity..."
        searchFilter={(row, term) => {
          return (
            row.action.toLowerCase().includes(term) ||
            (row.actor_name || '').toLowerCase().includes(term) ||
            row.entity_type.toLowerCase().includes(term)
          );
        }}
      />

      {/* Inspector Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Metadata Inspector"
        size="md"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
              <div>
                <span className="text-slate-400">Action:</span>
                <p className="font-bold text-navy-900 dark:text-brand-300 font-mono">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-slate-400">Actor:</span>
                <p className="font-semibold">{selectedLog.actor_name}</p>
              </div>
              <div>
                <span className="text-slate-400">Entity:</span>
                <p className="font-mono">{selectedLog.entity_type} ({selectedLog.entity_id})</p>
              </div>
              <div>
                <span className="text-slate-400">Timestamp:</span>
                <p className="font-mono">{formatDateTime(selectedLog.created_at)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Change Payload
              </h4>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
                {JSON.stringify(selectedLog.details, null, 2) || '{}'}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
