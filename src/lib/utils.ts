import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_CONFIG, DEFAULT_GRADING_RULES } from '@/config/constants';
import { GradeRule } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num === undefined || num === null || isNaN(num)) return `${APP_CONFIG.currencySymbol} 0.00`;
  return `${APP_CONFIG.currencySymbol} ${num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function calculateGrade(
  percentage: number,
  rules: GradeRule[] = DEFAULT_GRADING_RULES
): { grade: string; gpa: number; remarks: string } {
  const matched = rules.find(
    (r) => percentage >= r.min_percentage && percentage <= r.max_percentage
  );
  if (matched) {
    return {
      grade: matched.grade,
      gpa: matched.gpa,
      remarks: matched.remarks,
    };
  }
  return { grade: 'F', gpa: 0.0, remarks: 'Fail' };
}

export function calculateAttendancePercentage(presentCount: number, totalDays: number): number {
  if (!totalDays || totalDays <= 0) return 0;
  const pct = (presentCount / totalDays) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
