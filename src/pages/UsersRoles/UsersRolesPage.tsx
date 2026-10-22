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
import { userApi, logAudit } from '@/services/api';
import { INITIAL_PROFILES } from '@/services/mockData';
import {
  UserCog,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Plus,
  Lock,
  AlertTriangle,
  CheckCircle2,
  UserX,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

export const UsersRolesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return <Navigate to="/teacher-dashboard" replace />;
  }

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

  // Admin Password Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [resetMethod, setResetMethod] = useState<'temp' | 'link'>('temp');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const loadProfiles = async () => {
    try {
      const list = await userApi.getProfiles();
      setProfiles(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
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
    await logAudit(
      { id: user?.id, name: user?.full_name, role: user?.role },
      'ACCOUNT_PROVISIONED',
      'profiles',
      newProfile.id,
      { email: newProfile.email, role: newProfile.role }
    );
    setIsAddModalOpen(false);
    setFormData({ full_name: '', email: '', role: 'teacher', phone: '' });
  };

  const handleOpenResetModal = (profile: Profile) => {
    setTargetProfile(profile);
    setResetMethod('temp');
    setTemporaryPassword(`IPS-${Math.random().toString(36).slice(-6)}`);
    setResetError(null);
    setResetSuccess(null);
    setIsResetModalOpen(true);
  };

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProfile) return;
    setResetError(null);
    setResetSuccess(null);

    if (resetMethod === 'temp' && (!temporaryPassword || temporaryPassword.length < 6)) {
      setResetError('Temporary password must be at least 6 characters long.');
      return;
    }

    setIsResetSubmitting(true);
    try {
      const res = await userApi.adminResetTeacherPassword(
        targetProfile.id,
        resetMethod === 'temp' ? temporaryPassword : undefined,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setResetSuccess(res.message);
      setTimeout(() => {
        setIsResetModalOpen(false);
        setResetSuccess(null);
      }, 1500);
    } catch (err: any) {
      setResetError(err.message || 'Failed to process administrator password reset.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleToggleStatus = async (profile: Profile) => {
    const updated = profiles.map((p) =>
      p.id === profile.id ? { ...p, is_active: !p.is_active, updated_at: new Date().toISOString() } : p
    );
    setProfiles(updated);
    localStorage.setItem('sms_profiles', JSON.stringify(updated));
    await logAudit(
      { id: user?.id, name: user?.full_name, role: user?.role },
      profile.is_active ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED',
      'profiles',
      profile.id,
      { previous_status: profile.is_active, new_status: !profile.is_active }
    );
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
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenResetModal(row)}
            className="text-xs py-1"
            leftIcon={<KeyRound className="w-3.5 h-3.5 text-slate-400" />}
          >
            Reset Password
          </Button>

          {row.role !== 'admin' && (
            <button
              onClick={() => handleToggleStatus(row)}
              className={`p-1.5 rounded-md ${
                row.is_active
                  ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
              title={row.is_active ? 'Disable Account Access' : 'Enable Account Access'}
            >
              {row.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </button>
          )}
        </div>
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
            Admin-controlled credential provisioning. Teachers cannot modify their own passwords.
          </p>
        </div>

        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsAddModalOpen(true)}>
          Provision New Account
        </Button>
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
        <Lock className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          <b>Institutional Password Security Policy:</b> Teachers do not possess self-service password reset or password modification options. All staff credential resets must be executed by an authorized Administrator with audit tracking.
        </span>
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

      {/* Modal: Admin Password Reset for Staff */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={`Administrative Password Reset: ${targetProfile?.full_name || ''}`}
        description="Teacher self-service password modification is disabled. Administrator authorization is required."
        size="md"
      >
        <form onSubmit={handleExecutePasswordReset} className="space-y-4">
          {resetError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium">
              {resetError}
            </div>
          )}
          {resetSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              {resetSuccess}
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1">
            <div>
              <span className="text-slate-500">Target Staff:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {targetProfile?.full_name} ({targetProfile?.email})
              </span>
            </div>
            <div>
              <span className="text-slate-500">System Role:</span>{' '}
              <span className="font-bold uppercase tracking-wider text-navy-900 dark:text-brand-400">
                {targetProfile?.role}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Reset Methodology
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                  resetMethod === 'temp'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-900 dark:text-brand-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <input
                    type="radio"
                    name="resetMethod"
                    checked={resetMethod === 'temp'}
                    onChange={() => setResetMethod('temp')}
                  />
                  <span>Temporary Password</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Assign immediate temporary password & revoke existing sessions
                </span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                  resetMethod === 'link'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-900 dark:text-brand-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <input
                    type="radio"
                    name="resetMethod"
                    checked={resetMethod === 'link'}
                    onChange={() => setResetMethod('link')}
                  />
                  <span>Dispatch Reset Link</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Send secure one-time authorization link to staff email
                </span>
              </label>
            </div>
          </div>

          {resetMethod === 'temp' && (
            <Input
              label="Authorized Temporary Password"
              required
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          )}

          <div className="text-[11px] text-slate-500 italic">
            * This administrative reset will be securely logged to the institutional audit log without recording the plain-text password.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsResetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isResetSubmitting}>
              Confirm Password Reset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
