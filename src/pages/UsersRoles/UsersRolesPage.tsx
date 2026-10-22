import React, { useState, useEffect } from 'react';
import { Profile, UserRole } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { formatDate } from '@/lib/utils';
import { INITIAL_PROFILES } from '@/services/mockData';
import { UserCog, KeyRound, ShieldCheck, UserCheck, Plus } from 'lucide-react';

export const UsersRolesPage: React.FC = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const saved = localStorage.getItem('sms_profiles');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_PROFILES;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'teacher' as UserRole,
    phone: '',
  });

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) return;

    const newProfile: Profile = {
      id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`,
      full_name: formData.full_name,
      email: formData.email,
      role: formData.role,
      phone: formData.phone,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [...profiles, newProfile];
    setProfiles(updated);
    localStorage.setItem('sms_profiles', JSON.stringify(updated));
    setIsAddModalOpen(false);
  };

  const handleResetPassword = (profile: Profile) => {
    alert(`A secure password reset authorization token has been dispatched to ${profile.email}`);
  };

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'Full Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{row.full_name}</div>
          <div className="text-[11px] text-slate-500 font-mono">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            row.role === 'admin'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          {row.role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
          {row.role}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (row) => row.phone || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Provisioned On',
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResetPassword(row)}
          className="text-xs py-1"
          leftIcon={<KeyRound className="w-3.5 h-3.5 text-slate-400" />}
        >
          Reset Password
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            User Accounts & Security Roles
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Admin-controlled credential provisioning; no self-registration allowed
          </p>
        </div>

        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsAddModalOpen(true)}>
          Provision New Account
        </Button>
      </div>

      <DataTable
        data={profiles}
        columns={columns}
        rowKey={(p) => p.id}
        searchPlaceholder="Search accounts by name or email..."
      />

      {/* Modal: Provision User Account */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Provision Authorized System Account"
        description="Creates secure credentials for staff. Teachers receive scoped permissions automatically."
        size="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <Input
            label="Full Name"
            required
            placeholder="e.g. Asif Mehmood"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          />

          <Input
            label="Official Email"
            type="email"
            required
            placeholder="staff@islamiapublic.edu.pk"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label="Phone"
            placeholder="+92 300 xxxxxxx"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <Select
            label="System Role Authorization"
            required
            options={[
              { value: 'teacher', label: 'Teacher (Scoped to Assigned Classes)' },
              { value: 'admin', label: 'School Administrator (Full Privileges)' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Provision Account</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
