import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { studentApi, studentPortalApi, extractStoragePath } from '../src/services/api';
import { INITIAL_STUDENTS, INITIAL_PROFILES } from '../src/services/mockData';
import { Student } from '../src/types/database';

describe('Student Profile Photo Upload & Storage Security Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sms_students', JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem('sms_profiles', JSON.stringify(INITIAL_PROFILES));
  });

  // --------------------------------------------------------------------------
  // 1. MIGRATION 022 STRUCTURE & RLS POLICIES VERIFICATION
  // --------------------------------------------------------------------------
  describe('1. Migration 022 Structure & Storage RLS Verification', () => {
    it('verifies migration 022 exists and contains bucket config, helper functions, and RLS policies', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/022_fix_student_storage_permissions_and_photo_upload.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // Bucket configuration
      expect(sqlContent).toContain("INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)");
      expect(sqlContent).toContain("'student-avatars'");
      expect(sqlContent).toContain("5242880"); // 5 MB
      expect(sqlContent).toContain("ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']");

      // Security Definer functions
      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.is_admin()");
      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.is_student()");
      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.get_current_student_id()");
      expect(sqlContent).toContain("SET search_path = public");

      // Storage RLS Policies
      expect(sqlContent).toContain('CREATE POLICY "Public read student avatars"');
      expect(sqlContent).toContain('ON storage.objects FOR SELECT');
      expect(sqlContent).toContain('CREATE POLICY "Authorized users upload student avatars"');
      expect(sqlContent).toContain('ON storage.objects FOR INSERT');
      expect(sqlContent).toContain('CREATE POLICY "Authorized users update student avatars"');
      expect(sqlContent).toContain('ON storage.objects FOR UPDATE');
      expect(sqlContent).toContain('CREATE POLICY "Authorized users delete student avatars"');
      expect(sqlContent).toContain('ON storage.objects FOR DELETE');

      // Teacher is not granted write access to student-avatars
      expect(sqlContent).not.toContain('is_teacher()');

      // Students table update policy and trigger
      expect(sqlContent).toContain('CREATE POLICY "Students can update own photo_url"');
      expect(sqlContent).toContain('ON public.students FOR UPDATE');
      expect(sqlContent).toContain('CREATE TRIGGER trg_enforce_student_photo_only_update');
    });
  });

  // --------------------------------------------------------------------------
  // 2. STORAGE PATH EXTRACTION HELPER
  // --------------------------------------------------------------------------
  describe('2. Storage Path Extraction Helper', () => {
    it('correctly extracts object path from Supabase storage URL', () => {
      const url = 'https://abcdefghijkl.supabase.co/storage/v1/object/public/student-avatars/avatars/s001-1730000000.png';
      const extracted = extractStoragePath(url, 'student-avatars');
      expect(extracted).toBe('avatars/s001-1730000000.png');
    });

    it('returns null for non-storage or empty URLs', () => {
      expect(extractStoragePath(null)).toBeNull();
      expect(extractStoragePath('')).toBeNull();
      expect(extractStoragePath('https://images.unsplash.com/photo-1534528741775')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. FILE VALIDATION & SECURITY CHECKS
  // --------------------------------------------------------------------------
  describe('3. File Validation & Size Limits', () => {
    it('rejects files exceeding 5MB size limit', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      const oversizedFile = new File(['a'.repeat(5 * 1024 * 1024 + 10)], 'large-photo.jpg', {
        type: 'image/jpeg',
      });

      await expect(
        studentApi.uploadStudentPhoto(targetStudent.id, oversizedFile, {
          id: 'admin-id',
          name: 'Principal',
          role: 'admin',
        })
      ).rejects.toThrow('File size exceeds the 5MB limit');
    });

    it('rejects disallowed file types (PDF, TXT, JSON)', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      const pdfFile = new File(['%PDF-1.4 mock content'], 'document.pdf', {
        type: 'application/pdf',
      });

      await expect(
        studentApi.uploadStudentPhoto(targetStudent.id, pdfFile, {
          id: 'admin-id',
          name: 'Principal',
          role: 'admin',
        })
      ).rejects.toThrow('Invalid file format');
    });

    it('accepts allowed formats: JPG, PNG, WEBP, GIF', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      const jpgFile = new File(['mock-jpg-data'], 'avatar.jpg', { type: 'image/jpeg' });
      const res = await studentApi.uploadStudentPhoto(targetStudent.id, jpgFile, {
        id: 'admin-id',
        name: 'Principal',
        role: 'admin',
      });

      expect(res.photo_url).toBeTruthy();
      expect(res.student.photo_url).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 4. ADMIN PHOTO MANAGEMENT (UPLOAD, REPLACE, REMOVE)
  // --------------------------------------------------------------------------
  describe('4. Admin Photo Operations', () => {
    it('Admin uploads a student JPG photo and verifies persistence', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      const jpgFile = new File(['mock-jpg-bytes'], 'student-pic.jpg', { type: 'image/jpeg' });
      const result = await studentApi.uploadStudentPhoto(targetStudent.id, jpgFile, {
        id: 'admin-001',
        name: 'Admin Malik',
        role: 'admin',
      });

      expect(result.photo_url).toBeTruthy();

      // Verify student in database / localStorage
      const refreshedList = await studentApi.getStudents();
      const updated = refreshedList.find((s) => s.id === targetStudent.id);
      expect(updated?.photo_url).toBe(result.photo_url);
    });

    it('Admin uploads a student PNG photo', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[1] || students[0];

      const pngFile = new File(['mock-png-bytes'], 'student-badge.png', { type: 'image/png' });
      const result = await studentApi.uploadStudentPhoto(targetStudent.id, pngFile, {
        id: 'admin-001',
        name: 'Admin Malik',
        role: 'admin',
      });

      expect(result.photo_url).toBeTruthy();
      const refreshedList = await studentApi.getStudents();
      const updated = refreshedList.find((s) => s.id === targetStudent.id);
      expect(updated?.photo_url).toBe(result.photo_url);
    });

    it('Admin replaces an existing photo with a new image', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      // Initial photo upload
      const initialFile = new File(['initial-bytes'], 'initial.png', { type: 'image/png' });
      const res1 = await studentApi.uploadStudentPhoto(targetStudent.id, initialFile, {
        id: 'admin-001',
        name: 'Admin Malik',
        role: 'admin',
      });

      // Replacement upload
      const replacementFile = new File(['replacement-bytes'], 'replacement.webp', { type: 'image/webp' });
      const res2 = await studentApi.uploadStudentPhoto(targetStudent.id, replacementFile, {
        id: 'admin-001',
        name: 'Admin Malik',
        role: 'admin',
      });

      expect(res2.photo_url).toBeTruthy();
      expect(res2.photo_url).not.toBe(res1.photo_url);

      const refreshedList = await studentApi.getStudents();
      const updated = refreshedList.find((s) => s.id === targetStudent.id);
      expect(updated?.photo_url).toBe(res2.photo_url);
    });

    it('Admin removes student photo and reverts to default avatar', async () => {
      const students = await studentApi.getStudents();
      const targetStudent = students[0];

      // Ensure student has a photo
      await studentApi.uploadStudentPhoto(
        targetStudent.id,
        'https://example.com/mock-avatar.jpg',
        { id: 'admin-001', name: 'Admin', role: 'admin' }
      );

      // Admin removes photo
      const removalResult = await studentApi.removeStudentPhoto(targetStudent.id, {
        id: 'admin-001',
        name: 'Admin Malik',
        role: 'admin',
      });

      expect(removalResult.success).toBe(true);

      const refreshedList = await studentApi.getStudents();
      const updated = refreshedList.find((s) => s.id === targetStudent.id);
      expect(updated?.photo_url).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 5. STUDENT SELF-UPLOAD & ACCESS CONTROL SCOPING
  // --------------------------------------------------------------------------
  describe('5. Student Portal Photo Management & Scoping', () => {
    it('Student can upload and update their own profile picture', async () => {
      const students = await studentApi.getStudents();
      const student = students.find((s) => s.profile_id) || students[0];

      const file = new File(['self-photo-bytes'], 'self-avatar.jpg', { type: 'image/jpeg' });
      const res = await studentPortalApi.updateMyAvatar(student.profile_id || student.id, file, {
        id: student.profile_id || student.id,
        name: student.full_name,
        role: 'student',
      });

      expect(res.photo_url).toBeTruthy();

      const refreshedList = await studentApi.getStudents();
      const updated = refreshedList.find((s) => s.id === student.id);
      expect(updated?.photo_url).toBe(res.photo_url);
    });

    it('Student CANNOT upload or replace photo for a different student', async () => {
      const students = await studentApi.getStudents();
      const studentA = students[0];
      const studentB = students[1];

      const maliciousFile = new File(['hacked-photo'], 'hack.png', { type: 'image/png' });

      // Student A attempts to upload for Student B
      await expect(
        studentApi.uploadStudentPhoto(studentB.id, maliciousFile, {
          id: studentA.profile_id || studentA.id,
          name: studentA.full_name,
          role: 'student',
        })
      ).rejects.toThrow('Unauthorized: Students can only upload or update their own profile picture');
    });

    it('Student can remove their own profile photo', async () => {
      const students = await studentApi.getStudents();
      const student = students.find((s) => s.profile_id) || students[0];

      // Set photo
      await studentApi.uploadStudentPhoto(
        student.id,
        'https://example.com/initial.jpg',
        { id: student.profile_id || student.id, name: student.full_name, role: 'student' }
      );

      // Remove photo
      const res = await studentPortalApi.removeMyAvatar(student.profile_id || student.id, {
        id: student.profile_id || student.id,
        name: student.full_name,
        role: 'student',
      });

      expect(res.success).toBe(true);
      const refreshedList = await studentApi.getStudents();
      const updated = refreshedList.find((s) => s.id === student.id);
      expect(updated?.photo_url).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 6. UNAUTHORIZED ROLE REJECTION (TEACHERS & OTHERS)
  // --------------------------------------------------------------------------
  describe('6. Unauthorized Role Rejection', () => {
    it('Teacher role is strictly rejected from uploading student photos', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      const file = new File(['teacher-upload'], 'pic.png', { type: 'image/png' });

      await expect(
        studentApi.uploadStudentPhoto(student.id, file, {
          id: 'teacher-123',
          name: 'Mr. Tariq',
          role: 'teacher',
        })
      ).rejects.toThrow('Unauthorized: Teachers and unauthorized users cannot upload student photos');
    });

    it('Teacher role is strictly rejected from removing student photos', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      await expect(
        studentApi.removeStudentPhoto(student.id, {
          id: 'teacher-123',
          name: 'Mr. Tariq',
          role: 'teacher',
        })
      ).rejects.toThrow('Unauthorized: Teachers and unauthorized users cannot remove student photos');
    });
  });

  // --------------------------------------------------------------------------
  // 7. DATA INTEGRITY & AUDIT TRAIL
  // --------------------------------------------------------------------------
  describe('7. Data Integrity & Audit Trail', () => {
    it('Preserves other student demographic and academic fields when photo is updated', async () => {
      const students = await studentApi.getStudents();
      const original = students[0];

      const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' });
      await studentApi.uploadStudentPhoto(original.id, file, {
        id: 'admin-id',
        name: 'Admin',
        role: 'admin',
      });

      const refreshed = (await studentApi.getStudents()).find((s) => s.id === original.id)!;
      expect(refreshed.full_name).toBe(original.full_name);
      expect(refreshed.admission_no).toBe(original.admission_no);
      expect(refreshed.date_of_birth).toBe(original.date_of_birth);
      expect(refreshed.guardian_name).toBe(original.guardian_name);
      expect(refreshed.guardian_phone).toBe(original.guardian_phone);
      expect(refreshed.address).toBe(original.address);
    });

    it('Logs audit records for photo upload and removal', async () => {
      const students = await studentApi.getStudents();
      const student = students[0];

      await studentApi.uploadStudentPhoto(student.id, 'https://example.com/test.jpg', {
        id: 'admin-id',
        name: 'Admin Principal',
        role: 'admin',
      });

      const auditLogs = JSON.parse(localStorage.getItem('sms_audit_logs') || '[]');
      const uploadLog = auditLogs.find((l: any) => l.action === 'STUDENT_PHOTO_UPLOADED' && l.entity_id === student.id);
      expect(uploadLog).toBeTruthy();
      expect(uploadLog.actor_name).toBe('Admin Principal');

      await studentApi.removeStudentPhoto(student.id, {
        id: 'admin-id',
        name: 'Admin Principal',
        role: 'admin',
      });

      const auditLogsAfter = JSON.parse(localStorage.getItem('sms_audit_logs') || '[]');
      const removeLog = auditLogsAfter.find((l: any) => l.action === 'STUDENT_PHOTO_REMOVED' && l.entity_id === student.id);
      expect(removeLog).toBeTruthy();
    });
  });
});
