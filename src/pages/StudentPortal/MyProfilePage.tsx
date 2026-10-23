import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studentPortalApi } from '@/services/api';
import { Student, Enrollment } from '@/types/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/lib/utils';
import {
  UserCheck,
  Shield,
  ShieldCheck,
  Home,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Info,
  Camera,
  User,
  Mail,
  Hash,
  School,
} from 'lucide-react';

export const MyProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Avatar Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarSuccess(null);

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setAvatarError('Please upload a valid image file (JPG, PNG, WEBP, or GIF).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setAvatarError('Image file size exceeds the 5MB limit. Please choose a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const identifier = user?.id || user?.email || '';
      const result = await studentPortalApi.updateMyAvatar(identifier, file, {
        id: user?.id,
        name: user?.full_name,
        role: user?.role,
      });

      // Update student state immediately with the new photo_url
      setStudent((prev) => (prev ? { ...prev, photo_url: result.photo_url } : null));
      setAvatarSuccess('Profile picture updated successfully!');
    } catch (err: any) {
      setAvatarError(err.message || 'Failed to update profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  // Generate initials for avatar fallback if photo is not set
  const initials = student.full_name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            My Student Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Institutional identity, verified enrollment details, and official photo
          </p>
        </div>

        <Badge variant="success" size="md">
          <Shield className="w-3.5 h-3.5 mr-1" />
          Verified Student Record
        </Badge>
      </div>

      {/* Profile Picture & Identity Showcase Card */}
      <Card className="overflow-hidden border-brand-100 dark:border-slate-800 bg-gradient-to-r from-brand-50/40 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar Preview & Upload Trigger */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-slate-800 shadow-md ring-2 ring-brand-500/20 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-bold text-2xl tracking-wider select-none">
                    {initials}
                  </div>
                )}
              </div>

              {/* Quick overlay camera icon */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Change student photo"
                className="absolute bottom-0 right-0 p-2 rounded-full bg-brand-600 text-white shadow-md hover:bg-brand-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Overview & Avatar Management Controls */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                    {student.full_name}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-md bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-semibold">
                      <Hash className="w-3 h-3" />
                      {student.admission_no}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                      <School className="w-3 h-3" />
                      {enrollment?.section?.class?.name || 'Class 9'} ({enrollment?.section?.name || 'A'})
                    </span>
                    <Badge variant="success" size="sm">
                      Roll #{enrollment?.roll_no || '1'}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={isUploadingAvatar}
                    className="w-full sm:w-auto shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    {student.photo_url ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Accepts JPG, PNG, WEBP, or GIF (max 5 MB). This official image is displayed on your Student ID Card and examination reports.
              </p>

              {/* Upload Success Alert */}
              {avatarSuccess && (
                <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{avatarSuccess}</span>
                </div>
              )}

              {/* Upload Error Alert */}
              {avatarError && (
                <div className="mt-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{avatarError}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advisory Banner */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <span className="font-semibold">Official Record Notice:</span> Academic, personal, and guardian enrollment data are certified by the institutional registrar and are strictly read-only in this portal. For official corrections to names, birth dates, or guardian information, please contact the school administration office.
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

      {/* Grid: Guardian Contacts & Institutional Record Info */}
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

        {/* Institutional Record & Verification Status */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              Institutional Record & Support
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Student Portal ID:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {student.id.slice(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Portal Login Email:</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {student.email || user?.email || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Account Access:</span>
                <Badge variant="success" size="sm">
                  Active & Verified
                </Badge>
              </div>
            </div>

            <div className="text-slate-600 dark:text-slate-400 space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Need to update official student records or credentials?
              </p>
              <p className="leading-relaxed">
                For administrative security and integrity, official student records (including names, dates of birth, B-Form/CNIC, and guardian phone numbers) can only be amended by the school administration office. Passwords are also securely managed by administrators.
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div>• <span className="font-medium text-slate-700 dark:text-slate-300">Registrar Office:</span> Admin Block, Ground Floor</div>
                <div>• <span className="font-medium text-slate-700 dark:text-slate-300">Office Timings:</span> Monday – Friday, 8:00 AM – 2:00 PM</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
