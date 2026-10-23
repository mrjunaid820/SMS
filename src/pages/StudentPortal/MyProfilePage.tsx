import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studentPortalApi, studentApi } from '@/services/api';
import { Student, Enrollment } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/lib/utils';
import {
  UserCheck,
  Shield,
  KeyRound,
  Lock,
  Phone,
  Home,
  AlertCircle,
  CheckCircle2,
  Calendar,
  GraduationCap,
  CreditCard,
  Info,
} from 'lucide-react';

export const MyProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identifier = user?.id || user?.email || '';
      const data = await studentPortalApi.getStudentSelf(identifier);
      setStudent(data.student);
      setEnrollment(data.enrollment || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load student profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters in length.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter your new password.');
      return;
    }
    if (!student) return;

    setPasswordLoading(true);
    try {
      await studentApi.resetStudentPassword(
        student.id,
        newPassword,
        { id: user?.id, name: user?.full_name, role: user?.role }
      );
      setPasswordSuccess('Your portal password has been updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading student profile record...</p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Profile Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {error || 'No student profile record matches your authenticated portal user.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            My Student Profile & Credentials
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified institutional identity, enrollment details, and account security
          </p>
        </div>

        <Badge variant="success" size="md">
          <Shield className="w-3.5 h-3.5 mr-1" />
          Verified Student Record
        </Badge>
      </div>

      {/* Advisory Banner */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <span className="font-semibold">Official Record Notice:</span> Academic, personal, and guardian enrollment data are certified by the institutional registrar and are read-only in this portal. For corrections to names, birth dates, or guardian information, please contact the school administration office.
        </div>
      </div>

      {/* Grid: Personal Info & Enrollment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-600" />
              Student Identity & Bio
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Full Name</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{student.full_name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Admission Number</span>
              <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{student.admission_no}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Gender</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{student.gender}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Date of Birth</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(student.date_of_birth)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Blood Group</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{student.blood_group || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">B-Form / CNIC</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{student.b_form_or_cnic || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Admission Date</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(student.admission_date)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Academic Enrollment */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand-600" />
              Academic Enrollment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Class</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {enrollment?.section?.class?.name || 'Class 9'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Section</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Section {enrollment?.section?.name || 'A'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Roll Number</span>
              <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                #{enrollment?.roll_no || '1'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Academic Session</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {enrollment?.academic_session?.name || '2025-2026'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Enrollment Status</span>
              <Badge variant="success" size="sm">
                Active Enrolled
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Guardian Contacts & Security Password Change */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Guardian & Contact Information */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Home className="w-4 h-4 text-brand-600" />
              Guardian & Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Guardian Name</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{student.guardian_name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Relationship</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{student.guardian_relation}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Guardian Phone</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{student.guardian_phone}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Emergency Phone</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{student.emergency_contact || 'Same as Guardian'}</span>
            </div>
            <div className="py-1.5">
              <span className="text-slate-500 block mb-1">Residential Address</span>
              <p className="font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                {student.address}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Credentials & Self-Service Password Change */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-600" />
              Portal Account & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Portal Login Email:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {student.email || user?.email || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Access:</span>
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              </div>
            </div>

            {passwordError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-3 pt-2">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                Change Portal Password
              </h4>

              <Input
                label="New Password"
                type="password"
                required
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                label="Confirm New Password"
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <Button
                type="submit"
                size="sm"
                className="w-full mt-2"
                isLoading={passwordLoading}
                disabled={!newPassword || newPassword.length < 6}
              >
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
