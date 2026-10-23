import { GradeRule } from '@/types/database';

export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'Islamia Public High School',
  registrationNo: import.meta.env.VITE_APP_REGISTRATION_NO || 'SED-LHR-2018-9412',
  currency: import.meta.env.VITE_APP_CURRENCY || 'PKR',
  currencySymbol: import.meta.env.VITE_APP_CURRENCY_SYMBOL || 'Rs.',
  timezone: import.meta.env.VITE_APP_TIMEZONE || 'Asia/Karachi',
};

// Pakistani BISE Standard Grading Scale Defaults
export const DEFAULT_GRADING_RULES: GradeRule[] = [
  { grade: 'A+', min_percentage: 90, max_percentage: 100, gpa: 4.0, remarks: 'Outstanding' },
  { grade: 'A', min_percentage: 80, max_percentage: 89.99, gpa: 3.7, remarks: 'Excellent' },
  { grade: 'B', min_percentage: 70, max_percentage: 79.99, gpa: 3.0, remarks: 'Very Good' },
  { grade: 'C', min_percentage: 60, max_percentage: 69.99, gpa: 2.5, remarks: 'Good' },
  { grade: 'D', min_percentage: 50, max_percentage: 59.99, gpa: 2.0, remarks: 'Fair / Satisfactory' },
  { grade: 'E', min_percentage: 33, max_percentage: 49.99, gpa: 1.0, remarks: 'Pass' },
  { grade: 'F', min_percentage: 0, max_percentage: 32.99, gpa: 0.0, remarks: 'Fail' },
];

export const ATTENDANCE_STATUS_COLORS = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  Absent: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
  Late: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  Leave: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800',
};

export const INVOICE_STATUS_COLORS = {
  Paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Partially Paid': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  Unpaid: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  Overdue: 'bg-red-100 text-red-900 font-semibold dark:bg-red-950 dark:text-red-300',
  Cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

export const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'Cheque',
  'Online/Slip',
  'EasyPaisa/JazzCash',
] as const;

export const PAKISTAN_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Complete 15 Main Navigation Modules
export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  iconName: string;
  adminOnly?: boolean;
  category?: 'core' | 'academic' | 'finance' | 'admin';
}

export const MAIN_NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', iconName: 'LayoutDashboard', category: 'core' },
  { id: 'students', label: 'Students', path: '/students', iconName: 'GraduationCap', category: 'academic' },
  { id: 'teachers', label: 'Teachers', path: '/teachers', iconName: 'Users', adminOnly: true, category: 'academic' },
  { id: 'academic-sessions', label: 'Academic Sessions', path: '/academic-sessions', iconName: 'CalendarRange', adminOnly: true, category: 'academic' },
  { id: 'classes-sections', label: 'Classes & Sections', path: '/classes-sections', iconName: 'School', category: 'academic' },
  { id: 'subjects', label: 'Subjects', path: '/subjects', iconName: 'BookOpen', category: 'academic' },
  { id: 'teacher-assignments', label: 'Teacher Assignments', path: '/teacher-assignments', iconName: 'UserCheck', adminOnly: true, category: 'academic' },
  { id: 'attendance', label: 'Attendance', path: '/attendance', iconName: 'ClipboardCheck', category: 'academic' },
  { id: 'fees-accounts', label: 'Fees & Accounts', path: '/fees-accounts', iconName: 'Receipt', adminOnly: true, category: 'finance' },
  { id: 'examinations', label: 'Examinations', path: '/examinations', iconName: 'FileSpreadsheet', category: 'academic' },
  { id: 'results-report-cards', label: 'Results & Report Cards', path: '/results-report-cards', iconName: 'Award', category: 'academic' },
  { id: 'reports-exports', label: 'Reports & Exports', path: '/reports-exports', iconName: 'FileDown', category: 'core' },
  { id: 'audit-logs', label: 'Audit Logs', path: '/audit-logs', iconName: 'ShieldAlert', adminOnly: true, category: 'admin' },
  { id: 'school-settings', label: 'School Settings', path: '/school-settings', iconName: 'Sliders', adminOnly: true, category: 'admin' },
  { id: 'users-roles', label: 'User & Role Mgmt', path: '/users-roles', iconName: 'UserCog', adminOnly: true, category: 'admin' },
];

export const STUDENT_NAV_ITEMS: NavItemConfig[] = [
  { id: 'student-dashboard', label: 'My Dashboard', path: '/student-dashboard', iconName: 'LayoutDashboard', category: 'core' },
  { id: 'my-quiz-marks', label: 'My Quiz Marks', path: '/my-quiz-marks', iconName: 'BookOpen', category: 'academic' },
  { id: 'my-daily-diary', label: 'My Daily Diary', path: '/my-daily-diary', iconName: 'ClipboardCheck', category: 'academic' },
  { id: 'my-profile', label: 'My Profile', path: '/my-profile', iconName: 'UserCheck', category: 'core' },
];
