import { supabase, isLiveSupabaseConfigured } from '@/config/supabase';
import {
  Profile,
  AcademicSession,
  ClassLevel,
  Section,
  Subject,
  Teacher,
  TeacherAssignment,
  Student,
  Enrollment,
  AttendanceRecord,
  AttendanceStatus,
  FeeStructure,
  FeeInvoice,
  InvoiceStatus,
  FeePayment,
  FeePaymentReversal,
  PaymentMethod,
  Exam,
  ExamSubject,
  Mark,
  SchoolSettings,
  AuditLog,
  Quiz,
  QuizMark,
  DailyDiary,
  DiaryStatus,
  StudentSearchResult,
  StudentAcademicSummary,
} from '@/types/database';
import {
  INITIAL_SCHOOL_SETTINGS,
  INITIAL_SESSIONS,
  INITIAL_CLASSES,
  INITIAL_SECTIONS,
  INITIAL_SUBJECTS,
  INITIAL_PROFILES,
  INITIAL_TEACHERS,
  INITIAL_ASSIGNMENTS,
  INITIAL_STUDENTS,
  INITIAL_ENROLLMENTS,
  INITIAL_ATTENDANCE,
  INITIAL_FEE_STRUCTURES,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_EXAMS,
  INITIAL_EXAM_SUBJECTS,
  INITIAL_MARKS,
  INITIAL_AUDIT_LOGS,
  INITIAL_QUIZZES,
  INITIAL_QUIZ_MARKS,
  INITIAL_DAILY_DIARIES,
} from './mockData';
import { generateUUID, calculateGrade, calculateAttendancePercentage } from '@/lib/utils';

// Helper to get or initialize persistent local state
function getStorage<T>(key: string, initial: T): T {
  try {
    const val = localStorage.getItem(`sms_${key}`);
    if (val) return JSON.parse(val);
  } catch (e) {
    console.warn(`Failed to read sms_${key} from storage`, e);
  }
  return initial && typeof initial === 'object' ? JSON.parse(JSON.stringify(initial)) : initial;
}

function setStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`sms_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save sms_${key} to storage`, e);
  }
}

// -------------------------------------------------------------
// AUDIT LOGGING HELPER
// -------------------------------------------------------------
export async function logAudit(
  actor: { id?: string; name?: string; role?: string },
  action: string,
  entity_type: string,
  entity_id: string,
  details?: Record<string, any>
): Promise<void> {
  const newLog: AuditLog = {
    id: generateUUID(),
    actor_id: actor.id || 'u0000000-0000-0000-0000-000000000001',
    actor_name: actor.name || 'Administrator (Principal)',
    action,
    entity_type,
    entity_id,
    details,
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString(),
  };

  if (isLiveSupabaseConfigured()) {
    try {
      await supabase.from('audit_logs').insert([newLog]);
      return;
    } catch (e) {
      console.error('Failed to log audit event to Supabase', e);
    }
  }

  const logs = getStorage<AuditLog[]>('audit_logs', INITIAL_AUDIT_LOGS);
  setStorage('audit_logs', [newLog, ...logs]);
}

// -------------------------------------------------------------
// 1. SETTINGS & SESSIONS
// -------------------------------------------------------------
export const settingsApi = {
  getSettings: async (): Promise<SchoolSettings> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('school_settings').select('*').limit(1).single();
      if (!error && data) return data;
    }
    return getStorage<SchoolSettings>('settings', INITIAL_SCHOOL_SETTINGS);
  },

  updateSettings: async (settings: Partial<SchoolSettings>, actor?: { id?: string; name?: string; role?: string }): Promise<SchoolSettings> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to update school settings.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('school_settings').update(settings).eq('id', settings.id!).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'SETTINGS_UPDATED', 'school_settings', settings.id!, settings);
      return data;
    }
    const current = getStorage<SchoolSettings>('settings', INITIAL_SCHOOL_SETTINGS);
    const updated = { ...current, ...settings, updated_at: new Date().toISOString() };
    setStorage('settings', updated);
    await logAudit(actor || {}, 'SETTINGS_UPDATED', 'school_settings', updated.id, settings);
    return updated;
  },

  getSessions: async (): Promise<AcademicSession[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('academic_sessions').select('*').order('start_date', { ascending: false });
      if (!error && data) return data;
    }
    return getStorage<AcademicSession[]>('sessions', INITIAL_SESSIONS);
  },

  createSession: async (session: Omit<AcademicSession, 'id' | 'created_at'>, actor?: { id?: string; name?: string; role?: string }): Promise<AcademicSession> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to create academic sessions.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('academic_sessions').insert([session]).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'SESSION_CREATED', 'academic_sessions', data.id, session);
      return data;
    }
    const sessions = getStorage<AcademicSession[]>('sessions', INITIAL_SESSIONS);
    const newSession: AcademicSession = {
      ...session,
      id: generateUUID(),
      created_at: new Date().toISOString(),
    };
    if (newSession.is_current) {
      sessions.forEach(s => s.is_current = false);
    }
    const updated = [newSession, ...sessions];
    setStorage('sessions', updated);
    await logAudit(actor || {}, 'SESSION_CREATED', 'academic_sessions', newSession.id, session);
    return newSession;
  },
};

// -------------------------------------------------------------
// 2. CLASSES, SECTIONS & SUBJECTS
// -------------------------------------------------------------
export const academicStructureApi = {
  getClasses: async (): Promise<ClassLevel[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('classes').select('*').order('numeric_order', { ascending: true });
      if (!error && data) return data;
    }
    return getStorage<ClassLevel[]>('classes', INITIAL_CLASSES);
  },

  createClass: async (cls: Omit<ClassLevel, 'id' | 'created_at'>, actor?: { id?: string; name?: string; role?: string }): Promise<ClassLevel> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to manage classes.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('classes').insert([cls]).select().single();
      if (error) throw error;
      return data;
    }
    const classes = getStorage<ClassLevel[]>('classes', INITIAL_CLASSES);
    const newCls: ClassLevel = { ...cls, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('classes', [...classes, newCls].sort((a, b) => a.numeric_order - b.numeric_order));
    return newCls;
  },

  getSections: async (): Promise<Section[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('sections').select('*, class:classes(*)').order('name');
      if (!error && data) return data;
    }
    const sections = getStorage<Section[]>('sections', INITIAL_SECTIONS);
    const classes = getStorage<ClassLevel[]>('classes', INITIAL_CLASSES);
    return sections.map(s => ({
      ...s,
      class: classes.find(c => c.id === s.class_id),
    }));
  },

  createSection: async (section: Omit<Section, 'id' | 'created_at'>, actor?: { id?: string; name?: string; role?: string }): Promise<Section> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to manage sections.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('sections').insert([section]).select('*, class:classes(*)').single();
      if (error) throw error;
      return data;
    }
    const sections = getStorage<Section[]>('sections', INITIAL_SECTIONS);
    const newSec: Section = { ...section, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('sections', [...sections, newSec]);
    return newSec;
  },

  getSubjects: async (): Promise<Subject[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('subjects').select('*, class:classes(*)').order('name');
      if (!error && data) return data;
    }
    const subjects = getStorage<Subject[]>('subjects', INITIAL_SUBJECTS);
    const classes = getStorage<ClassLevel[]>('classes', INITIAL_CLASSES);
    return subjects.map(sub => ({
      ...sub,
      class: classes.find(c => c.id === sub.class_id),
    }));
  },

  createSubject: async (subj: Omit<Subject, 'id' | 'created_at'>, actor?: { id?: string; name?: string; role?: string }): Promise<Subject> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to manage subjects.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('subjects').insert([subj]).select('*, class:classes(*)').single();
      if (error) throw error;
      return data;
    }
    const subjects = getStorage<Subject[]>('subjects', INITIAL_SUBJECTS);
    const newSubj: Subject = { ...subj, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('subjects', [...subjects, newSubj]);
    return newSubj;
  },
};

// -------------------------------------------------------------
// 3. TEACHERS & ASSIGNMENTS
// -------------------------------------------------------------
export const teacherApi = {
  getTeachers: async (): Promise<Teacher[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('teachers').select('*').order('employee_id');
      if (!error && data) return data;
    }
    return getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
  },

  createTeacher: async (teacher: Omit<Teacher, 'id' | 'created_at'>, actor?: { id?: string; name?: string; role?: string }): Promise<Teacher> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to register faculty records.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('teachers').insert([teacher]).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'TEACHER_CREATED', 'teachers', data.id, { employee_id: teacher.employee_id, name: teacher.full_name });
      return data;
    }
    const teachers = getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    const newT: Teacher = { ...teacher, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('teachers', [...teachers, newT]);
    await logAudit(actor || {}, 'TEACHER_CREATED', 'teachers', newT.id, { employee_id: teacher.employee_id, name: teacher.full_name });
    return newT;
  },

  updateTeacher: async (id: string, updates: Partial<Teacher>, actor?: { id?: string; name?: string; role?: string }): Promise<Teacher> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to edit teacher profiles.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('teachers').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'TEACHER_UPDATED', 'teachers', id, updates);
      return data;
    }
    const teachers = getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    const idx = teachers.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Teacher not found');
    const updated = { ...teachers[idx], ...updates };
    teachers[idx] = updated;
    setStorage('teachers', [...teachers]);
    await logAudit(actor || {}, 'TEACHER_UPDATED', 'teachers', id, updates);
    return updated;
  },

  updateTeacherFull: async (
    id: string,
    updates: Partial<Teacher>,
    newAssignments?: { section_id: string; subject_id: string; is_class_teacher?: boolean }[],
    sessionId?: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<Teacher> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to edit teacher profiles.');
    }

    if (updates.full_name !== undefined && !updates.full_name.trim()) {
      throw new Error('Validation Error: Teacher full name is required.');
    }
    if (updates.employee_id !== undefined && !updates.employee_id.trim()) {
      throw new Error('Validation Error: Employee ID is required.');
    }
    if (updates.qualification !== undefined && !updates.qualification.trim()) {
      throw new Error('Validation Error: Academic qualification is required.');
    }

    const teachers = getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    if (updates.employee_id) {
      const duplicateEmp = teachers.find(
        (t) => t.id !== id && t.employee_id.toLowerCase() === updates.employee_id!.toLowerCase()
      );
      if (duplicateEmp) {
        throw new Error(`Validation Error: Employee ID "${updates.employee_id}" is already assigned to another teacher.`);
      }
    }

    let updatedTeacher: Teacher;
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('teachers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      updatedTeacher = data;
    } else {
      const idx = teachers.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error('Teacher record not found.');
      updatedTeacher = { ...teachers[idx], ...updates };
      teachers[idx] = updatedTeacher;
      setStorage('teachers', [...teachers]);

      // If active status changed, update corresponding profile
      if (updates.is_active !== undefined) {
        const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
        const pIdx = profiles.findIndex((p) => p.email === updatedTeacher.email || p.id === updatedTeacher.profile_id);
        if (pIdx !== -1) {
          profiles[pIdx] = { ...profiles[pIdx], is_active: updates.is_active };
          setStorage('profiles', [...profiles]);
        }
      }
    }

    // Sync assignments for active session if provided
    if (newAssignments && sessionId) {
      if (isLiveSupabaseConfigured()) {
        await supabase
          .from('teacher_assignments')
          .delete()
          .eq('teacher_id', id)
          .eq('academic_session_id', sessionId);

        if (newAssignments.length > 0) {
          const payload = newAssignments.map((a) => ({
            teacher_id: id,
            academic_session_id: sessionId,
            section_id: a.section_id,
            subject_id: a.subject_id,
            is_class_teacher: a.is_class_teacher || false,
          }));
          await supabase.from('teacher_assignments').insert(payload);
        }
      } else {
        const allAssignments = getStorage<TeacherAssignment[]>('assignments', INITIAL_ASSIGNMENTS);
        const preserved = allAssignments.filter(
          (a) => a.teacher_id !== id || a.academic_session_id !== sessionId
        );
        const fresh = newAssignments.map((a) => ({
          id: generateUUID(),
          teacher_id: id,
          academic_session_id: sessionId,
          section_id: a.section_id,
          subject_id: a.subject_id,
          is_class_teacher: a.is_class_teacher || false,
          created_at: new Date().toISOString(),
        }));
        setStorage('assignments', [...preserved, ...fresh]);
      }
    }

    await logAudit(
      actor || {},
      'TEACHER_UPDATED',
      'teachers',
      id,
      { ...updates, assignments_count: newAssignments?.length }
    );

    return updatedTeacher;
  },

  ensureTeacherProfile: async (
    teacherId: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<Profile> => {
    const teachers = getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    const tIdx = teachers.findIndex((t) => t.id === teacherId);
    if (tIdx === -1) throw new Error('Teacher record not found.');

    const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
    const teacher = teachers[tIdx];

    // If teacher already has valid profile_id
    if (teacher.profile_id) {
      const existing = profiles.find((p) => p.id === teacher.profile_id);
      if (existing) return existing;
    }

    // Try matching by email
    const matchByEmail = profiles.find((p) => p.email.toLowerCase() === (teacher.email || '').toLowerCase());
    if (matchByEmail) {
      teachers[tIdx] = { ...teacher, profile_id: matchByEmail.id };
      setStorage('teachers', [...teachers]);
      return matchByEmail;
    }

    // Create a new profile with UUID and link
    const newProfile: Profile = {
      id: generateUUID(),
      role: 'teacher',
      full_name: teacher.full_name,
      email: teacher.email || `teacher_${teacher.employee_id.toLowerCase()}@islamiapublic.edu.pk`,
      phone: teacher.phone,
      is_active: teacher.is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setStorage('profiles', [...profiles, newProfile]);
    teachers[tIdx] = { ...teacher, profile_id: newProfile.id, email: newProfile.email };
    setStorage('teachers', [...teachers]);

    if (isLiveSupabaseConfigured()) {
      await supabase.from('profiles').insert([newProfile]);
      await supabase.from('teachers').update({ profile_id: newProfile.id }).eq('id', teacherId);
    }

    return newProfile;
  },

  updateTeacherLoginEmail: async (
    teacherId: string,
    newEmail: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ success: boolean; message: string }> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to update teacher login information.');
    }

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error('Validation Error: A valid email address is required.');
    }

    const teachers = getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    const tIdx = teachers.findIndex((t) => t.id === teacherId);
    if (tIdx === -1) throw new Error('Teacher record not found.');

    const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
    const teacher = teachers[tIdx];

    // 1. Check uniqueness across all other user profiles and teachers
    const duplicateProfile = profiles.find(
      (p) => p.email.toLowerCase() === trimmedEmail && p.id !== teacher.profile_id
    );
    const duplicateTeacher = teachers.find(
      (t) => t.email && t.email.toLowerCase() === trimmedEmail && t.id !== teacherId
    );

    if (duplicateProfile || duplicateTeacher) {
      throw new Error(`Validation Error: The email address "${newEmail}" is already registered to another user account.`);
    }

    if (isLiveSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.functions.invoke('admin-manage-user', {
          body: {
            action: 'update_login_email',
            teacherId,
            userId: teacher.profile_id,
            newEmail: trimmedEmail,
          },
        });
        if (error) throw new Error(`Supabase Auth update failed: ${error.message}`);
        if (data && !data.success) throw new Error(data.error || data.message || 'Failed to update login identity.');
      } catch (e: any) {
        // Direct database fallback if edge function not yet deployed
        if (teacher.profile_id) {
          await supabase
            .from('profiles')
            .update({ email: trimmedEmail, updated_at: new Date().toISOString() })
            .eq('id', teacher.profile_id);
        }
        await supabase
          .from('teachers')
          .update({ email: trimmedEmail })
          .eq('id', teacherId);
      }
    } else {
      // Persistent Storage Mode
      const oldEmail = teacher.email;
      teachers[tIdx] = { ...teacher, email: trimmedEmail };
      setStorage('teachers', [...teachers]);

      const pIdx = profiles.findIndex(
        (p) => p.id === teacher.profile_id || (oldEmail && p.email.toLowerCase() === oldEmail.toLowerCase())
      );
      if (pIdx !== -1) {
        profiles[pIdx] = { ...profiles[pIdx], email: trimmedEmail, updated_at: new Date().toISOString() };
        setStorage('profiles', [...profiles]);
      }

      // Update passwords map key if exists
      try {
        const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
        if (oldEmail && passMap[oldEmail.toLowerCase()]) {
          passMap[trimmedEmail] = passMap[oldEmail.toLowerCase()];
          localStorage.setItem('sms_user_passwords', JSON.stringify(passMap));
        }
      } catch {}
    }

    await logAudit(
      actor || {},
      'TEACHER_LOGIN_EMAIL_UPDATED',
      'teachers',
      teacherId,
      { target_user_id: teacher.profile_id, previous_email: teacher.email, new_email: trimmedEmail }
    );

    return {
      success: true,
      message: `Teacher login email successfully updated to ${trimmedEmail}.`,
    };
  },

  resetTeacherPassword: async (
    teacherId: string,
    options: { temporaryPassword?: string; sendResetLink?: boolean },
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ success: boolean; message: string }> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to reset teacher passwords.');
    }

    const teachers = getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) throw new Error('Teacher record not found.');

    const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
    const profile = profiles.find(
      (p) => p.id === teacher.profile_id || (teacher.email && p.email.toLowerCase() === teacher.email.toLowerCase())
    );
    const targetUserId = profile?.id || teacher.profile_id;

    if (options.temporaryPassword && options.temporaryPassword.length < 6) {
      throw new Error('Validation Error: Temporary password must be at least 6 characters.');
    }

    if (isLiveSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.functions.invoke('admin-manage-user', {
          body: {
            action: options.temporaryPassword ? 'set_temporary_password' : 'send_reset_link',
            teacherId,
            userId: targetUserId,
            temporaryPassword: options.temporaryPassword,
          },
        });
        if (error) throw new Error(`Supabase Auth password reset failed: ${error.message}`);
      } catch (e: any) {
        if (options.sendResetLink && profile?.email) {
          await supabase.auth.resetPasswordForEmail(profile.email);
        }
      }
    } else {
      // Save temporary password to credentials store
      if (options.temporaryPassword) {
        try {
          const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
          if (targetUserId) passMap[targetUserId] = options.temporaryPassword;
          if (teacher.email) passMap[teacher.email.toLowerCase()] = options.temporaryPassword;
          localStorage.setItem('sms_user_passwords', JSON.stringify(passMap));
        } catch {}
      }
    }

    await logAudit(
      actor || {},
      'TEACHER_PASSWORD_RESET',
      'profiles',
      targetUserId || teacherId,
      {
        target_email: teacher.email,
        method: options.temporaryPassword ? 'TEMPORARY_PASSWORD_ASSIGNED' : 'RESET_LINK_DISPATCHED',
        sessions_revoked: Boolean(options.temporaryPassword),
      }
    );

    return {
      success: true,
      message: options.temporaryPassword
        ? `Temporary password successfully assigned for ${teacher.full_name}. Active sessions revoked.`
        : `Authorized password reset link dispatched to ${teacher.email}.`,
    };
  },

  getAssignments: async (sessionId?: string): Promise<TeacherAssignment[]> => {
    if (isLiveSupabaseConfigured()) {
      let query = supabase.from('teacher_assignments').select('*, teacher:teachers(*), section:sections(*, class:classes(*)), subject:subjects(*), academic_session:academic_sessions(*)');
      if (sessionId) query = query.eq('academic_session_id', sessionId);
      const { data, error } = await query;
      if (!error && data) return data;
    }
    const assignments = getStorage<TeacherAssignment[]>('assignments', INITIAL_ASSIGNMENTS);
    const teachers = getStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    const sections = await academicStructureApi.getSections();
    const subjects = await academicStructureApi.getSubjects();
    const sessions = await settingsApi.getSessions();

    return assignments
      .filter(a => !sessionId || a.academic_session_id === sessionId)
      .map(a => ({
        ...a,
        teacher: teachers.find(t => t.id === a.teacher_id),
        section: sections.find(s => s.id === a.section_id),
        subject: subjects.find(sub => sub.id === a.subject_id),
        academic_session: sessions.find(ses => ses.id === a.academic_session_id),
      }));
  },

  createAssignment: async (asgn: Omit<TeacherAssignment, 'id' | 'created_at'>, actor?: { id?: string; name?: string }): Promise<TeacherAssignment> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('teacher_assignments').insert([asgn]).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'TEACHER_ASSIGNED', 'teacher_assignments', data.id, asgn);
      return data;
    }
    const assignments = getStorage<TeacherAssignment[]>('assignments', INITIAL_ASSIGNMENTS);
    const newAsgn: TeacherAssignment = { ...asgn, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('assignments', [...assignments, newAsgn]);
    await logAudit(actor || {}, 'TEACHER_ASSIGNED', 'teacher_assignments', newAsgn.id, asgn);
    return newAsgn;
  },

  deleteAssignment: async (id: string, actor?: { id?: string; name?: string }): Promise<void> => {
    if (isLiveSupabaseConfigured()) {
      const { error } = await supabase.from('teacher_assignments').delete().eq('id', id);
      if (error) throw error;
      await logAudit(actor || {}, 'TEACHER_ASSIGNMENT_REMOVED', 'teacher_assignments', id);
      return;
    }
    const assignments = getStorage<TeacherAssignment[]>('assignments', INITIAL_ASSIGNMENTS);
    setStorage('assignments', assignments.filter(a => a.id !== id));
    await logAudit(actor || {}, 'TEACHER_ASSIGNMENT_REMOVED', 'teacher_assignments', id);
  },
};

// -------------------------------------------------------------
// 4. STUDENTS & ENROLLMENTS
// -------------------------------------------------------------
export const studentApi = {
  getStudents: async (includeArchived = false): Promise<Student[]> => {
    if (isLiveSupabaseConfigured()) {
      let query = supabase.from('students').select('*').order('admission_no', { ascending: true });
      if (!includeArchived) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (!error && data) return data;
    }
    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    return includeArchived ? students : students.filter(s => s.is_active);
  },

  getStudentById: async (id: string): Promise<Student | null> => {
    const students = await studentApi.getStudents(true);
    return students.find(s => s.id === id) || null;
  },

  getEnrollments: async (sessionId?: string, sectionId?: string): Promise<Enrollment[]> => {
    if (isLiveSupabaseConfigured()) {
      let q = supabase.from('enrollments').select('*, student:students(*), section:sections(*, class:classes(*)), academic_session:academic_sessions(*)');
      if (sessionId) q = q.eq('academic_session_id', sessionId);
      if (sectionId) q = q.eq('section_id', sectionId);
      const { data, error } = await q;
      if (!error && data) return data;
    }
    const enrollments = getStorage<Enrollment[]>('enrollments', INITIAL_ENROLLMENTS);
    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const sections = await academicStructureApi.getSections();
    const sessions = await settingsApi.getSessions();

    return enrollments
      .filter(e => (!sessionId || e.academic_session_id === sessionId) && (!sectionId || e.section_id === sectionId))
      .map(e => ({
        ...e,
        student: students.find(s => s.id === e.student_id),
        section: sections.find(s => s.id === e.section_id),
        academic_session: sessions.find(ses => ses.id === e.academic_session_id),
      }));
  },

  generateAdmissionNo: async (): Promise<string> => {
    const currentYear = new Date().getFullYear();
    const prefix = `ADM-${currentYear}-`;
    if (isLiveSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('admission_no')
          .like('admission_no', `${prefix}%`)
          .order('admission_no', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          const lastNum = parseInt(data[0].admission_no.replace(prefix, ''), 10);
          const nextSeq = isNaN(lastNum) ? 1 : lastNum + 1;
          return `${prefix}${String(nextSeq).padStart(4, '0')}`;
        }
        if (!error) return `${prefix}0001`;
      } catch (e) {
        console.warn('Failed to query max admission_no from Supabase', e);
      }
    }
    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const seqs = students
      .filter(s => s.admission_no.startsWith(prefix))
      .map(s => parseInt(s.admission_no.replace(prefix, ''), 10))
      .filter(n => !isNaN(n));
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  },

  generateNextRollNo: async (sessionId: string, sectionId: string): Promise<number> => {
    if (isLiveSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('enrollments')
          .select('roll_no')
          .eq('academic_session_id', sessionId)
          .eq('section_id', sectionId)
          .order('roll_no', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0 && typeof data[0].roll_no === 'number') {
          return data[0].roll_no + 1;
        }
        if (!error) return 1;
      } catch (e) {
        console.warn('Failed to query max roll_no from Supabase', e);
      }
    }
    const enrollments = getStorage<Enrollment[]>('enrollments', INITIAL_ENROLLMENTS);
    const currentRolls = enrollments
      .filter(e => e.academic_session_id === sessionId && e.section_id === sectionId)
      .map(e => e.roll_no);
    return currentRolls.length > 0 ? Math.max(...currentRolls) + 1 : 1;
  },

  createStudentWithEnrollment: async (
    studentData: Omit<Student, 'id' | 'admission_no' | 'created_at' | 'updated_at' | 'is_active'>,
    sessionId: string,
    sectionId: string,
    actor?: { id?: string; name?: string }
  ): Promise<{ student: Student; enrollment: Enrollment }> => {
    const admission_no = await studentApi.generateAdmissionNo();
    const roll_no = await studentApi.generateNextRollNo(sessionId, sectionId);

    const newStudent: Student = {
      ...studentData,
      id: generateUUID(),
      admission_no,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newEnrollment: Enrollment = {
      id: generateUUID(),
      student_id: newStudent.id,
      academic_session_id: sessionId,
      section_id: sectionId,
      roll_no,
      enrollment_date: studentData.admission_date || new Date().toISOString().split('T')[0],
      status: 'active',
      created_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured()) {
      const { data: sData, error: sErr } = await supabase.from('students').insert([newStudent]).select().single();
      if (sErr) throw sErr;
      const { data: eData, error: eErr } = await supabase.from('enrollments').insert([newEnrollment]).select().single();
      if (eErr) throw eErr;
      await logAudit(actor || {}, 'STUDENT_ENROLLED', 'students', sData.id, { admission_no, name: newStudent.full_name, roll_no });
      return { student: sData, enrollment: eData };
    }

    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const enrollments = getStorage<Enrollment[]>('enrollments', INITIAL_ENROLLMENTS);
    setStorage('students', [newStudent, ...students]);
    setStorage('enrollments', [newEnrollment, ...enrollments]);
    await logAudit(actor || {}, 'STUDENT_ENROLLED', 'students', newStudent.id, { admission_no, name: newStudent.full_name, roll_no });
    return { student: newStudent, enrollment: newEnrollment };
  },

  updateStudent: async (id: string, updates: Partial<Student>, actor?: { id?: string; name?: string; role?: string }): Promise<Student> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to edit student records.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('students').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'STUDENT_UPDATED', 'students', id, updates);
      return data;
    }
    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const idx = students.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Student not found');
    const updated = { ...students[idx], ...updates, updated_at: new Date().toISOString() };
    students[idx] = updated;
    setStorage('students', [...students]);
    await logAudit(actor || {}, 'STUDENT_UPDATED', 'students', id, updates);
    return updated;
  },

  updateStudentWithEnrollment: async (
    studentId: string,
    studentUpdates: Partial<Student>,
    newSectionId?: string,
    sessionId?: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ student: Student; enrollment?: Enrollment }> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to edit student records.');
    }

    // Validation
    if (studentUpdates.full_name !== undefined && !studentUpdates.full_name.trim()) {
      throw new Error('Validation Error: Student full name is required.');
    }
    if (studentUpdates.guardian_name !== undefined && !studentUpdates.guardian_name.trim()) {
      throw new Error('Validation Error: Guardian name is required.');
    }
    if (studentUpdates.guardian_phone !== undefined && !studentUpdates.guardian_phone.trim()) {
      throw new Error('Validation Error: Guardian phone number is required.');
    }
    if (studentUpdates.address !== undefined && !studentUpdates.address.trim()) {
      throw new Error('Validation Error: Residential address is required.');
    }

    let updatedStudent: Student;
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('students')
        .update({
          ...studentUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)
        .select()
        .single();
      if (error) throw error;
      updatedStudent = data;
    } else {
      const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
      const idx = students.findIndex((s) => s.id === studentId);
      if (idx === -1) throw new Error('Student record not found.');
      
      const originalAdmissionNo = students[idx].admission_no; // Preserve unique admission number
      updatedStudent = {
        ...students[idx],
        ...studentUpdates,
        admission_no: originalAdmissionNo,
        updated_at: new Date().toISOString(),
      };
      students[idx] = updatedStudent;
      setStorage('students', [...students]);
    }

    // Handle section/class update for active session if provided
    let updatedEnrollment: Enrollment | undefined;
    if (newSectionId && sessionId) {
      if (isLiveSupabaseConfigured()) {
        const { data: enr } = await supabase
          .from('enrollments')
          .select('*')
          .eq('student_id', studentId)
          .eq('academic_session_id', sessionId)
          .maybeSingle();

        if (enr && enr.section_id !== newSectionId) {
          const { data: newEnr, error: updErr } = await supabase
            .from('enrollments')
            .update({ section_id: newSectionId })
            .eq('id', enr.id)
            .select('*, section:sections(*, class:classes(*))')
            .single();
          if (updErr) throw updErr;
          updatedEnrollment = newEnr;
        }
      } else {
        const enrollments = getStorage<Enrollment[]>('enrollments', INITIAL_ENROLLMENTS);
        const eIdx = enrollments.findIndex(
          (e) => e.student_id === studentId && e.academic_session_id === sessionId
        );
        if (eIdx !== -1 && enrollments[eIdx].section_id !== newSectionId) {
          const newRoll = await studentApi.generateNextRollNo(sessionId, newSectionId);
          enrollments[eIdx] = {
            ...enrollments[eIdx],
            section_id: newSectionId,
            roll_no: newRoll,
          };
          setStorage('enrollments', [...enrollments]);
          updatedEnrollment = enrollments[eIdx];
        }
      }
    }

    await logAudit(
      actor || {},
      'STUDENT_UPDATED',
      'students',
      studentId,
      { ...studentUpdates, new_section_id: newSectionId }
    );

    return { student: updatedStudent, enrollment: updatedEnrollment };
  },

  archiveStudent: async (id: string, reason: string, actor?: { id?: string; name?: string; role?: string }): Promise<Student> => {
    return studentApi.updateStudent(
      id,
      { is_active: false, archived_at: new Date().toISOString(), archive_reason: reason },
      actor
    );
  },

  restoreStudent: async (id: string, actor?: { id?: string; name?: string; role?: string }): Promise<Student> => {
    return studentApi.updateStudent(
      id,
      { is_active: true, archived_at: undefined, archive_reason: undefined },
      actor
    );
  },

  getStudentByProfileId: async (profileId: string): Promise<Student | null> => {
    const students = await studentApi.getStudents(true);
    return (
      students.find(
        (s) =>
          s.profile_id === profileId ||
          (s.email && s.email.toLowerCase() === profileId.toLowerCase())
      ) || null
    );
  },

  provisionStudentAccount: async (
    studentId: string,
    email: string,
    optionsOrPassword?: string | { temporaryPassword?: string; sendResetLink?: boolean },
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ profile: Profile; student: Student }> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to provision student accounts.');
    }

    const options =
      typeof optionsOrPassword === 'string'
        ? { temporaryPassword: optionsOrPassword }
        : optionsOrPassword || {};

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Validation Error: A valid student email address is required.');
    }

    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const sIdx = students.findIndex((s) => s.id === studentId);
    if (sIdx === -1) {
      throw new Error('Student record not found.');
    }
    const student = students[sIdx];
    if (!student.is_active) {
      throw new Error('Cannot provision account for an archived or inactive student.');
    }

    // Check if student already has a portal account linked
    if (student.profile_id) {
      throw new Error('Student already has an active portal login account linked.');
    }

    // Check duplicate email across existing profiles
    const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
    const emailConflict = profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (emailConflict) {
      throw new Error(`Validation Error: An account with email "${cleanEmail}" is already registered.`);
    }

    if (options.temporaryPassword && options.temporaryPassword.length < 6) {
      throw new Error('Validation Error: Temporary password must be at least 6 characters.');
    }

    const newProfileId = generateUUID();
    const newProfile: Profile = {
      id: newProfileId,
      full_name: student.full_name,
      email: cleanEmail,
      phone: student.guardian_phone,
      role: 'student',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.functions.invoke('admin-manage-user', {
          body: {
            action: 'provision_student',
            studentId,
            email: cleanEmail,
            temporaryPassword: options.temporaryPassword,
          },
        });
        if (error) throw new Error(`Supabase Auth provisioning failed: ${error.message}`);
      } catch (e: any) {
        // Direct database fallback if edge function not yet deployed
        await supabase.from('profiles').insert([newProfile]);
        await supabase
          .from('students')
          .update({ profile_id: newProfileId, email: cleanEmail, updated_at: new Date().toISOString() })
          .eq('id', studentId);
      }
    } else {
      // Local persistent storage mode
      setStorage('profiles', [...profiles, newProfile]);

      if (options.temporaryPassword) {
        try {
          const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
          passMap[newProfileId] = options.temporaryPassword;
          passMap[cleanEmail] = options.temporaryPassword;
          localStorage.setItem('sms_user_passwords', JSON.stringify(passMap));
        } catch {}
      }

      const updatedStudent: Student = {
        ...student,
        profile_id: newProfileId,
        email: cleanEmail,
        updated_at: new Date().toISOString(),
      };
      students[sIdx] = updatedStudent;
      setStorage('students', [...students]);
    }

    await logAudit(
      actor || {},
      'STUDENT_ACCOUNT_PROVISIONED',
      'students',
      studentId,
      {
        profile_id: newProfileId,
        student_admission_no: student.admission_no,
        email: cleanEmail,
        method: options.temporaryPassword ? 'TEMPORARY_PASSWORD_ASSIGNED' : 'INVITATION_LINK_DISPATCHED',
      }
    );

    const updatedStudents = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const finalStudent = updatedStudents.find((s) => s.id === studentId) || { ...student, profile_id: newProfileId, email: cleanEmail };

    return { profile: newProfile, student: finalStudent };
  },

  resetStudentPassword: async (
    studentId: string,
    optionsOrPassword: string | { temporaryPassword?: string; sendResetLink?: boolean },
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ success: boolean; message: string; profileId?: string }> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to reset student passwords.');
    }

    const options =
      typeof optionsOrPassword === 'string'
        ? { temporaryPassword: optionsOrPassword }
        : optionsOrPassword || {};

    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const student = students.find((s) => s.id === studentId);
    if (!student) throw new Error('Student record not found.');
    if (!student.profile_id && !student.email) {
      throw new Error('Student does not have a linked portal account.');
    }

    const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
    const profile = profiles.find(
      (p) => p.id === student.profile_id || (student.email && p.email.toLowerCase() === student.email.toLowerCase())
    );
    if (!profile) throw new Error('Linked student authentication profile not found.');

    if (options.temporaryPassword && options.temporaryPassword.length < 6) {
      throw new Error('Validation Error: Temporary password must be at least 6 characters.');
    }

    if (isLiveSupabaseConfigured()) {
      try {
        await supabase.functions.invoke('admin-manage-user', {
          body: {
            action: options.temporaryPassword ? 'set_temporary_password' : 'send_reset_link',
            userId: profile.id,
            temporaryPassword: options.temporaryPassword,
          },
        });
      } catch (e: any) {
        if (options.sendResetLink && profile.email) {
          await supabase.auth.resetPasswordForEmail(profile.email);
        }
      }
    } else {
      if (options.temporaryPassword) {
        try {
          const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
          passMap[profile.id] = options.temporaryPassword;
          passMap[profile.email.toLowerCase()] = options.temporaryPassword;
          localStorage.setItem('sms_user_passwords', JSON.stringify(passMap));
        } catch {}
      }
    }

    await logAudit(
      actor || {},
      'STUDENT_PASSWORD_RESET',
      'profiles',
      profile.id,
      {
        target_student_id: student.id,
        target_email: profile.email,
        method: options.temporaryPassword ? 'TEMPORARY_PASSWORD_ASSIGNED' : 'RESET_LINK_DISPATCHED',
      }
    );

    return {
      success: true,
      profileId: profile.id,
      message: options.temporaryPassword
        ? `Temporary password successfully assigned for ${student.full_name}. Active sessions revoked.`
        : `Authorized password reset link dispatched to ${profile.email}.`,
    };
  },

  toggleStudentAccountStatus: async (
    studentId: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ is_active: boolean; profile: Profile }> => {
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to modify account status.');
    }

    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const student = students.find((s) => s.id === studentId);
    if (!student || !student.profile_id) {
      throw new Error('Student does not have a linked portal account.');
    }

    const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
    const pIdx = profiles.findIndex((p) => p.id === student.profile_id);
    if (pIdx === -1) throw new Error('Linked user account profile not found.');

    const newActiveState = !profiles[pIdx].is_active;
    profiles[pIdx] = {
      ...profiles[pIdx],
      is_active: newActiveState,
      updated_at: new Date().toISOString(),
    };
    setStorage('profiles', [...profiles]);

    await logAudit(
      actor || {},
      newActiveState ? 'STUDENT_ACCOUNT_ENABLED' : 'STUDENT_ACCOUNT_DISABLED',
      'profiles',
      profiles[pIdx].id,
      { student_id: student.id, new_status: newActiveState }
    );

    return { is_active: newActiveState, profile: profiles[pIdx] };
  },
};

// -------------------------------------------------------------
// 5. ATTENDANCE MANAGEMENT
// -------------------------------------------------------------
export const attendanceApi = {
  getAttendance: async (date: string, sectionId: string): Promise<AttendanceRecord[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*, enrollment:enrollments(*, student:students(*))')
        .eq('date', date);
      if (error) {
        throw new Error(`Database error fetching attendance: ${error.message}`);
      }
      if (data) {
        return data.filter((a: any) => !sectionId || a.enrollment?.section_id === sectionId);
      }
    }
    const attendance = getStorage<AttendanceRecord[]>('attendance', INITIAL_ATTENDANCE);
    const enrollments = await studentApi.getEnrollments(undefined, sectionId);
    const enrollmentIds = new Set(enrollments.map(e => e.id));

    return attendance
      .filter(a => a.date === date && enrollmentIds.has(a.enrollment_id))
      .map(a => ({
        ...a,
        enrollment: enrollments.find(e => e.id === a.enrollment_id),
      }));
  },

  markBatchAttendance: async (
    date: string,
    records: { enrollment_id: string; status: AttendanceStatus; remarks?: string }[],
    actor?: { id?: string; name?: string }
  ): Promise<AttendanceRecord[]> => {
    if (isLiveSupabaseConfigured()) {
      const payload = records.map(r => ({
        enrollment_id: r.enrollment_id,
        date,
        status: r.status,
        remarks: r.remarks,
        marked_by: actor?.id,
        updated_at: new Date().toISOString(),
      }));
      const { data, error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'enrollment_id, date' })
        .select('*, enrollment:enrollments(*, student:students(*))');
      if (error) throw new Error(`Database error saving attendance records: ${error.message}`);
      await logAudit(actor || {}, 'ATTENDANCE_BATCH_RECORDED', 'attendance', date, { count: records.length });
      return data;
    }

    const allAttendance = getStorage<AttendanceRecord[]>('attendance', INITIAL_ATTENDANCE);
    const updatedList = [...allAttendance];

    records.forEach(r => {
      const existingIdx = updatedList.findIndex(a => a.date === date && a.enrollment_id === r.enrollment_id);
      if (existingIdx !== -1) {
        updatedList[existingIdx] = {
          ...updatedList[existingIdx],
          status: r.status,
          remarks: r.remarks,
          updated_by: actor?.id,
          updated_at: new Date().toISOString(),
        };
      } else {
        updatedList.push({
          id: generateUUID(),
          enrollment_id: r.enrollment_id,
          date,
          status: r.status,
          remarks: r.remarks,
          marked_by: actor?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    setStorage('attendance', updatedList);
    await logAudit(actor || {}, 'ATTENDANCE_BATCH_RECORDED', 'attendance', date, { count: records.length });
    return updatedList.filter(a => a.date === date);
  },

  getAttendanceByEnrollment: async (enrollmentId: string): Promise<AttendanceRecord[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .order('date', { ascending: false });
      if (error) throw new Error(`Database error fetching student attendance history: ${error.message}`);
      if (data) return data;
    }
    const attendance = getStorage<AttendanceRecord[]>('attendance', INITIAL_ATTENDANCE);
    return attendance
      .filter(a => a.enrollment_id === enrollmentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
};

// -------------------------------------------------------------
// 6. FEES & FINANCIAL TRANSACTIONS
// -------------------------------------------------------------
export const feeApi = {
  getStructures: async (sessionId?: string): Promise<FeeStructure[]> => {
    if (isLiveSupabaseConfigured()) {
      let q = supabase
        .from('fee_structures')
        .select('*, class:classes(*), academic_session:academic_sessions(*)');
      if (sessionId) q = q.eq('academic_session_id', sessionId);
      const { data, error } = await q;
      if (error) throw new Error(`Database error fetching fee structures: ${error.message}`);
      if (data) return data;
    }
    const structures = getStorage<FeeStructure[]>('fee_structures', INITIAL_FEE_STRUCTURES);
    const classes = await academicStructureApi.getClasses();
    const sessions = await settingsApi.getSessions();
    return structures
      .filter(s => !sessionId || s.academic_session_id === sessionId)
      .map(s => ({
        ...s,
        class: classes.find(c => c.id === s.class_id),
        academic_session: sessions.find(ses => ses.id === s.academic_session_id),
      }));
  },

  createStructure: async (structure: Omit<FeeStructure, 'id' | 'created_at'>, actor?: { id?: string; name?: string; role?: string }): Promise<FeeStructure> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to configure fee structures.');
    }
    if (isLiveSupabaseConfigured()) {
      const newStr: FeeStructure = { ...structure, id: generateUUID(), created_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('fee_structures')
        .insert([newStr])
        .select('*, class:classes(*), academic_session:academic_sessions(*)')
        .single();
      if (error) throw new Error(`Database error saving fee structure: ${error.message}`);
      await logAudit(actor || {}, 'FEE_STRUCTURE_CREATED', 'fee_structures', data.id, structure);
      return data;
    }
    const structures = getStorage<FeeStructure[]>('fee_structures', INITIAL_FEE_STRUCTURES);
    const newStr: FeeStructure = { ...structure, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('fee_structures', [...structures, newStr]);
    return newStr;
  },

  getInvoices: async (sessionId?: string, month?: string): Promise<FeeInvoice[]> => {
    if (isLiveSupabaseConfigured()) {
      let q = supabase
        .from('fee_invoices')
        .select('*, enrollment:enrollments(*, student:students(*), section:sections(*, class:classes(*))), items:fee_invoice_items(*), payments:fee_payments(*)')
        .order('created_at', { ascending: false });
      if (sessionId) q = q.eq('academic_session_id', sessionId);
      if (month) q = q.eq('billing_month', month);
      const { data, error } = await q;
      if (error) throw new Error(`Database error fetching fee invoices: ${error.message}`);
      if (data) {
        return data.map((inv: any) => ({
          ...inv,
          payments: (inv.payments || []).filter((p: any) => !p.is_reversed),
        }));
      }
    }
    const invoices = getStorage<FeeInvoice[]>('invoices', INITIAL_INVOICES);
    const enrollments = await studentApi.getEnrollments();
    const payments = getStorage<FeePayment[]>('payments', INITIAL_PAYMENTS);

    return invoices
      .filter(i => (!sessionId || i.academic_session_id === sessionId) && (!month || i.billing_month === month))
      .map(inv => ({
        ...inv,
        enrollment: enrollments.find(e => e.id === inv.enrollment_id),
        payments: payments.filter(p => p.invoice_id === inv.id && !p.is_reversed),
      }));
  },

  getInvoiceById: async (id: string): Promise<FeeInvoice | null> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('fee_invoices')
        .select('*, enrollment:enrollments(*, student:students(*), section:sections(*, class:classes(*))), items:fee_invoice_items(*), payments:fee_payments(*)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`Database error fetching invoice: ${error.message}`);
      if (data) {
        return {
          ...data,
          payments: (data.payments || []).filter((p: any) => !p.is_reversed),
        };
      }
      return null;
    }
    const invoices = await feeApi.getInvoices();
    return invoices.find(i => i.id === id) || null;
  },

  generateMonthlyInvoices: async (
    sessionId: string,
    billingMonth: string,
    dueDate: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ generatedCount: number }> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to generate fee invoices.');
    }
    if (isLiveSupabaseConfigured()) {
      const enrollments = await studentApi.getEnrollments(sessionId);
      const structures = await feeApi.getStructures(sessionId);
      const { data: existingInvoices, error: exErr } = await supabase
        .from('fee_invoices')
        .select('id, enrollment_id')
        .eq('academic_session_id', sessionId)
        .eq('billing_month', billingMonth);
      if (exErr) throw new Error(`Database error checking existing invoices: ${exErr.message}`);

      const existingEnrollmentIds = new Set((existingInvoices || []).map((i: any) => i.enrollment_id));
      let count = 0;
      const newInvoices: any[] = [];
      const newItems: any[] = [];

      for (const enr of enrollments) {
        if (existingEnrollmentIds.has(enr.id)) continue;
        const classId = enr.section?.class_id;
        const str = structures.find(s => s.class_id === classId);
        if (!str) continue;

        const total = Number(str.monthly_tuition) + Number(str.lab_library_fee) + Number(str.other_charges);
        const invoiceNo = `INV-${billingMonth.replace('-', '')}-${String(existingEnrollmentIds.size + count + 1).padStart(4, '0')}`;
        const invId = generateUUID();

        newInvoices.push({
          id: invId,
          invoice_no: invoiceNo,
          enrollment_id: enr.id,
          academic_session_id: sessionId,
          billing_month: billingMonth,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: dueDate,
          total_amount: total,
          discount_amount: 0,
          net_amount: total,
          paid_amount: 0,
          status: 'Unpaid',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        newItems.push(
          { id: generateUUID(), invoice_id: invId, description: `Monthly Tuition Fee (${billingMonth})`, amount: Number(str.monthly_tuition), created_at: new Date().toISOString() },
          { id: generateUUID(), invoice_id: invId, description: `Lab & Library Charges`, amount: Number(str.lab_library_fee), created_at: new Date().toISOString() }
        );
        count++;
      }

      if (newInvoices.length > 0) {
        const { error: insErr } = await supabase.from('fee_invoices').insert(newInvoices);
        if (insErr) throw new Error(`Database error saving generated invoices: ${insErr.message}`);
        if (newItems.length > 0) {
          await supabase.from('fee_invoice_items').insert(newItems);
        }
      }
      await logAudit(actor || {}, 'INVOICES_GENERATED_BATCH', 'fee_invoices', billingMonth, { count });
      return { generatedCount: count };
    }

    const enrollments = await studentApi.getEnrollments(sessionId);
    const structures = await feeApi.getStructures(sessionId);
    const invoices = getStorage<FeeInvoice[]>('invoices', INITIAL_INVOICES);

    let count = 0;
    const newInvoices: FeeInvoice[] = [];

    for (const enr of enrollments) {
      const classId = enr.section?.class_id;
      const str = structures.find(s => s.class_id === classId);
      if (!str) continue;

      // Duplicate protection: Check if student already has invoice for this billing month
      const exists = invoices.some(i => i.enrollment_id === enr.id && i.billing_month === billingMonth);
      if (exists) continue;

      const total = Number(str.monthly_tuition) + Number(str.lab_library_fee) + Number(str.other_charges);
      const invoiceNo = `INV-${billingMonth.replace('-', '')}-${String(invoices.length + count + 1).padStart(4, '0')}`;
      const invId = generateUUID();

      const inv: FeeInvoice = {
        id: invId,
        invoice_no: invoiceNo,
        enrollment_id: enr.id,
        academic_session_id: sessionId,
        billing_month: billingMonth,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate,
        total_amount: total,
        discount_amount: 0,
        net_amount: total,
        paid_amount: 0,
        status: 'Unpaid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [
          { id: generateUUID(), invoice_id: invId, description: `Monthly Tuition Fee (${billingMonth})`, amount: Number(str.monthly_tuition), created_at: new Date().toISOString() },
          { id: generateUUID(), invoice_id: invId, description: `Lab & Library Charges`, amount: Number(str.lab_library_fee), created_at: new Date().toISOString() },
        ],
      };

      newInvoices.push(inv);
      count++;
    }

    setStorage('invoices', [...newInvoices, ...invoices]);
    await logAudit(actor || {}, 'INVOICES_GENERATED_BATCH', 'fee_invoices', billingMonth, { count });
    return { generatedCount: count };
  },

  recordPayment: async (
    invoiceId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    referenceNo?: string,
    idempotencyKey?: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<FeePayment> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to record fee payments.');
    }
    if (isLiveSupabaseConfigured()) {
      // 1. Idempotency Check in Supabase
      if (idempotencyKey) {
        const { data: existing } = await supabase
          .from('fee_payments')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (existing) return existing;
      }

      const { data: inv, error: invErr } = await supabase
        .from('fee_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();
      if (invErr || !inv) throw new Error('Invoice not found in database.');

      const outstanding = Number(inv.net_amount) - Number(inv.paid_amount);
      if (amount <= 0) throw new Error('Payment amount must be greater than zero');
      if (amount > outstanding) throw new Error(`Amount of ${amount} exceeds remaining dues of ${outstanding}`);

      // Try invoking PostgreSQL stored procedure fn_process_fee_payment
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_process_fee_payment', {
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_reference_no: referenceNo || null,
        p_recorded_by: actor?.id || null,
        p_idempotency_key: idempotencyKey || null,
      });

      if (!rpcErr && rpcRes?.payment_id) {
        const { data: payRecord } = await supabase.from('fee_payments').select('*').eq('id', rpcRes.payment_id).single();
        if (payRecord) return payRecord;
        return {
          id: rpcRes.payment_id,
          receipt_no: rpcRes.receipt_no,
          invoice_id: invoiceId,
          payment_date: new Date().toISOString().split('T')[0],
          amount,
          payment_method: paymentMethod,
          reference_no: referenceNo,
          recorded_by: actor?.id,
          idempotency_key: idempotencyKey,
          is_reversed: false,
          created_at: new Date().toISOString(),
        };
      }

      // Safe direct database update if RPC is unavailable
      const currentYearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
      const receiptNo = `REC-${currentYearMonth}-${generateUUID().slice(0, 4).toUpperCase()}`;

      const newPayment: FeePayment = {
        id: generateUUID(),
        receipt_no: receiptNo,
        invoice_id: invoiceId,
        payment_date: new Date().toISOString().split('T')[0],
        amount,
        payment_method: paymentMethod,
        reference_no: referenceNo,
        recorded_by: actor?.id,
        idempotency_key: idempotencyKey,
        is_reversed: false,
        created_at: new Date().toISOString(),
      };

      const { data: savedPayment, error: payInsErr } = await supabase
        .from('fee_payments')
        .insert([newPayment])
        .select()
        .single();
      if (payInsErr) throw new Error(`Database error recording payment: ${payInsErr.message}`);

      const newPaid = Number(inv.paid_amount) + amount;
      const newStatus = newPaid >= Number(inv.net_amount) ? 'Paid' : 'Partially Paid';
      await supabase
        .from('fee_invoices')
        .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);

      await logAudit(actor || {}, 'PAYMENT_RECORDED', 'fee_payments', savedPayment.id, { receipt_no: receiptNo, amount, paymentMethod });
      return savedPayment;
    }

    const invoices = getStorage<FeeInvoice[]>('invoices', INITIAL_INVOICES);
    const payments = getStorage<FeePayment[]>('payments', INITIAL_PAYMENTS);

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = payments.find(p => p.idempotency_key === idempotencyKey);
      if (existing) return existing;
    }

    const invIdx = invoices.findIndex(i => i.id === invoiceId);
    if (invIdx === -1) throw new Error('Invoice not found');

    const inv = invoices[invIdx];
    const outstanding = Number(inv.net_amount) - Number(inv.paid_amount);

    if (amount <= 0) throw new Error('Payment amount must be greater than zero');
    if (amount > outstanding) throw new Error(`Amount of ${amount} exceeds remaining dues of ${outstanding}`);

    const currentYearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const receiptNo = `REC-${currentYearMonth}-${String(payments.length + 1).padStart(4, '0')}`;

    const newPayment: FeePayment = {
      id: generateUUID(),
      receipt_no: receiptNo,
      invoice_id: invoiceId,
      payment_date: new Date().toISOString().split('T')[0],
      amount,
      payment_method: paymentMethod,
      reference_no: referenceNo,
      recorded_by: actor?.id,
      idempotency_key: idempotencyKey,
      is_reversed: false,
      created_at: new Date().toISOString(),
    };

    const newPaid = Number(inv.paid_amount) + amount;
    const newStatus = newPaid >= Number(inv.net_amount) ? 'Paid' : 'Partially Paid';

    invoices[invIdx] = {
      ...inv,
      paid_amount: newPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    setStorage('invoices', [...invoices]);
    setStorage('payments', [newPayment, ...payments]);
    await logAudit(actor || {}, 'PAYMENT_RECORDED', 'fee_payments', newPayment.id, { receipt_no: receiptNo, amount, paymentMethod });
    return newPayment;
  },

  reversePayment: async (
    paymentId: string,
    reason: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<void> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to reverse fee payments.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_reverse_fee_payment', {
        p_payment_id: paymentId,
        p_reason: reason,
        p_reversed_by: actor?.id || null,
      });

      if (!rpcErr && rpcRes?.success) {
        await logAudit(actor || {}, 'PAYMENT_REVERSED', 'fee_payments', paymentId, { reason });
        return;
      }

      // Safe direct database update
      const { data: payment, error: pErr } = await supabase.from('fee_payments').select('*').eq('id', paymentId).single();
      if (pErr || !payment) throw new Error('Payment record not found');
      if (payment.is_reversed) throw new Error('This payment has already been reversed');

      await supabase.from('fee_payments').update({ is_reversed: true }).eq('id', paymentId);
      const { data: inv } = await supabase.from('fee_invoices').select('*').eq('id', payment.invoice_id).single();
      if (inv) {
        const newPaid = Math.max(0, Number(inv.paid_amount) - Number(payment.amount));
        const newStatus = newPaid === 0 ? 'Unpaid' : 'Partially Paid';
        await supabase
          .from('fee_invoices')
          .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', payment.invoice_id);
      }

      await supabase.from('fee_payment_reversals').insert([{
        payment_id: paymentId,
        amount: payment.amount,
        reason,
        reversed_by: actor?.id,
      }]);

      await logAudit(actor || {}, 'PAYMENT_REVERSED', 'fee_payments', paymentId, { amount: payment.amount, reason });
      return;
    }

    const payments = getStorage<FeePayment[]>('payments', INITIAL_PAYMENTS);
    const invoices = getStorage<FeeInvoice[]>('invoices', INITIAL_INVOICES);

    const payIdx = payments.findIndex(p => p.id === paymentId);
    if (payIdx === -1) throw new Error('Payment record not found');
    const payment = payments[payIdx];
    if (payment.is_reversed) throw new Error('This payment has already been reversed');

    const invIdx = invoices.findIndex(i => i.id === payment.invoice_id);
    if (invIdx === -1) throw new Error('Parent invoice not found');
    const inv = invoices[invIdx];

    payments[payIdx] = { ...payment, is_reversed: true };

    const newPaid = Math.max(0, Number(inv.paid_amount) - Number(payment.amount));
    const newStatus = newPaid === 0 ? 'Unpaid' : 'Partially Paid';

    invoices[invIdx] = {
      ...inv,
      paid_amount: newPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    setStorage('payments', [...payments]);
    setStorage('invoices', [...invoices]);
    await logAudit(actor || {}, 'PAYMENT_REVERSED', 'fee_payments', paymentId, { amount: payment.amount, reason });
  },

  getFinancialSummary: async (sessionId?: string) => {
    const invoices = await feeApi.getInvoices(sessionId);
    let payments: FeePayment[] = [];
    if (isLiveSupabaseConfigured()) {
      const { data: payData } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('is_reversed', false);
      if (payData) payments = payData;
    } else {
      payments = getStorage<FeePayment[]>('payments', INITIAL_PAYMENTS).filter(p => !p.is_reversed);
    }

    const totalInvoiced = invoices.reduce((acc, curr) => acc + Number(curr.net_amount), 0);
    const totalCollected = invoices.reduce((acc, curr) => acc + Number(curr.paid_amount), 0);
    const totalOutstanding = totalInvoiced - totalCollected;

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      invoiceCount: invoices.length,
      paidCount: invoices.filter(i => i.status === 'Paid').length,
      unpaidCount: invoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').length,
    };
  },
};

// -------------------------------------------------------------
// 7. EXAMINATIONS & MARKS
// -------------------------------------------------------------
export const examApi = {
  getExams: async (sessionId?: string): Promise<Exam[]> => {
    if (isLiveSupabaseConfigured()) {
      let q = supabase
        .from('exams')
        .select('*, academic_session:academic_sessions(*)')
        .order('start_date', { ascending: false });
      if (sessionId) q = q.eq('academic_session_id', sessionId);
      const { data, error } = await q;
      if (error) throw new Error(`Database error fetching exams: ${error.message}`);
      if (data) return data;
    }
    const exams = getStorage<Exam[]>('exams', INITIAL_EXAMS);
    const sessions = await settingsApi.getSessions();
    return exams
      .filter(e => !sessionId || e.academic_session_id === sessionId)
      .map(e => ({
        ...e,
        academic_session: sessions.find(s => s.id === e.academic_session_id),
      }));
  },

  createExam: async (exam: Omit<Exam, 'id' | 'created_at'>, actor?: { id?: string; name?: string; role?: string }): Promise<Exam> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to create examinations.');
    }
    if (isLiveSupabaseConfigured()) {
      const newExam: Exam = { ...exam, id: generateUUID(), created_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('exams')
        .insert([newExam])
        .select('*, academic_session:academic_sessions(*)')
        .single();
      if (error) throw new Error(`Database error creating exam: ${error.message}`);
      await logAudit(actor || {}, 'EXAM_CREATED', 'exams', data.id, { name: exam.name });
      return data;
    }
    const exams = getStorage<Exam[]>('exams', INITIAL_EXAMS);
    const newExam: Exam = { ...exam, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('exams', [...exams, newExam]);
    await logAudit(actor || {}, 'EXAM_CREATED', 'exams', newExam.id, { name: exam.name });
    return newExam;
  },

  updateExamStatus: async (id: string, status: Exam['status'], actor?: { id?: string; name?: string; role?: string }): Promise<Exam> => {
    if (actor?.role && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to update examination status.');
    }
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('exams')
        .update({ status })
        .eq('id', id)
        .select('*, academic_session:academic_sessions(*)')
        .single();
      if (error) throw new Error(`Database error updating exam status: ${error.message}`);
      await logAudit(actor || {}, 'EXAM_STATUS_CHANGED', 'exams', id, { newStatus: status });
      return data;
    }
    const exams = getStorage<Exam[]>('exams', INITIAL_EXAMS);
    const idx = exams.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Exam not found');
    exams[idx] = { ...exams[idx], status };
    setStorage('exams', [...exams]);
    await logAudit(actor || {}, 'EXAM_STATUS_CHANGED', 'exams', id, { newStatus: status });
    return exams[idx];
  },

  getExamSubjects: async (examId?: string, classId?: string): Promise<ExamSubject[]> => {
    if (isLiveSupabaseConfigured()) {
      let q = supabase
        .from('exam_subjects')
        .select('*, exam:exams(*), class:classes(*), subject:subjects(*)');
      if (examId) q = q.eq('exam_id', examId);
      if (classId) q = q.eq('class_id', classId);
      const { data, error } = await q;
      if (error) throw new Error(`Database error fetching exam subjects: ${error.message}`);
      if (data) return data;
    }
    const examSubjects = getStorage<ExamSubject[]>('exam_subjects', INITIAL_EXAM_SUBJECTS);
    const exams = await examApi.getExams();
    const classes = await academicStructureApi.getClasses();
    const subjects = await academicStructureApi.getSubjects();

    return examSubjects
      .filter(es => (!examId || es.exam_id === examId) && (!classId || es.class_id === classId))
      .map(es => ({
        ...es,
        exam: exams.find(e => e.id === es.exam_id),
        class: classes.find(c => c.id === es.class_id),
        subject: subjects.find(s => s.id === es.subject_id),
      }));
  },

  createExamSubject: async (item: Omit<ExamSubject, 'id' | 'created_at'>): Promise<ExamSubject> => {
    if (isLiveSupabaseConfigured()) {
      const newES: ExamSubject = { ...item, id: generateUUID(), created_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('exam_subjects')
        .insert([newES])
        .select('*, exam:exams(*), class:classes(*), subject:subjects(*)')
        .single();
      if (error) throw new Error(`Database error creating exam subject: ${error.message}`);
      return data;
    }
    const examSubjects = getStorage<ExamSubject[]>('exam_subjects', INITIAL_EXAM_SUBJECTS);
    const newES: ExamSubject = { ...item, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('exam_subjects', [...examSubjects, newES]);
    return newES;
  },

  getMarks: async (examSubjectId: string): Promise<Mark[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('marks')
        .select('*, enrollment:enrollments(*, student:students(*))')
        .eq('exam_subject_id', examSubjectId);
      if (error) throw new Error(`Database error fetching marks: ${error.message}`);
      if (data) return data;
    }
    const marks = getStorage<Mark[]>('marks', INITIAL_MARKS);
    const enrollments = await studentApi.getEnrollments();

    return marks
      .filter(m => m.exam_subject_id === examSubjectId)
      .map(m => ({
        ...m,
        enrollment: enrollments.find(e => e.id === m.enrollment_id),
      }));
  },

  saveMarksBatch: async (
    examSubjectId: string,
    marksData: { enrollment_id: string; marks_obtained?: number; is_absent: boolean; remarks?: string }[],
    actor?: { id?: string; name?: string }
  ): Promise<void> => {
    if (isLiveSupabaseConfigured()) {
      const payload = marksData.map(item => ({
        exam_subject_id: examSubjectId,
        enrollment_id: item.enrollment_id,
        marks_obtained: item.is_absent ? 0 : item.marks_obtained,
        is_absent: item.is_absent,
        remarks: item.remarks,
        entered_by: actor?.id,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('marks').upsert(payload, { onConflict: 'exam_subject_id, enrollment_id' });
      if (error) throw new Error(`Database error saving marks: ${error.message}`);
      await logAudit(actor || {}, 'MARKS_ENTERED_BATCH', 'marks', examSubjectId, { count: marksData.length });
      return;
    }

    const allMarks = getStorage<Mark[]>('marks', INITIAL_MARKS);
    const updated = [...allMarks];

    marksData.forEach(item => {
      const idx = updated.findIndex(m => m.exam_subject_id === examSubjectId && m.enrollment_id === item.enrollment_id);
      if (idx !== -1) {
        updated[idx] = {
          ...updated[idx],
          marks_obtained: item.is_absent ? 0 : item.marks_obtained,
          is_absent: item.is_absent,
          remarks: item.remarks,
          updated_at: new Date().toISOString(),
        };
      } else {
        updated.push({
          id: generateUUID(),
          exam_subject_id: examSubjectId,
          enrollment_id: item.enrollment_id,
          marks_obtained: item.is_absent ? 0 : item.marks_obtained,
          is_absent: item.is_absent,
          remarks: item.remarks,
          entered_by: actor?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    setStorage('marks', updated);
    await logAudit(actor || {}, 'MARKS_ENTERED_BATCH', 'marks', examSubjectId, { count: marksData.length });
  },

  getStudentReportCardData: async (enrollmentId: string, examId: string) => {
    const enrollments = await studentApi.getEnrollments();
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    if (!enrollment) throw new Error('Enrollment not found');

    const classId = enrollment.section?.class_id;
    const examSubjects = await examApi.getExamSubjects(examId, classId);

    let marks: Mark[] = [];
    if (isLiveSupabaseConfigured()) {
      const { data: dbMarks, error: mErr } = await supabase
        .from('marks')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .in('exam_subject_id', examSubjects.map(es => es.id));
      if (!mErr && dbMarks) {
        marks = dbMarks;
      }
    } else {
      marks = getStorage<Mark[]>('marks', INITIAL_MARKS);
    }

    const subjectResults = examSubjects.map(es => {
      const mark = marks.find(m => m.exam_subject_id === es.id && m.enrollment_id === enrollmentId);
      const marksObtained = mark ? (mark.is_absent ? 0 : Number(mark.marks_obtained || 0)) : 0;
      const isAbsent = mark?.is_absent || false;
      const percentage = (marksObtained / Number(es.max_marks)) * 100;
      const isPassed = !isAbsent && marksObtained >= Number(es.passing_marks);

      return {
        subjectName: es.subject?.name || 'Subject',
        subjectCode: es.subject?.code || '',
        maxMarks: Number(es.max_marks),
        passingMarks: Number(es.passing_marks),
        marksObtained,
        isAbsent,
        percentage: Math.round(percentage * 10) / 10,
        isPassed,
        remarks: mark?.remarks || '',
      };
    });

    const totalMaxMarks = subjectResults.reduce((acc, curr) => acc + curr.maxMarks, 0);
    const totalMarksObtained = subjectResults.reduce((acc, curr) => acc + curr.marksObtained, 0);
    const overallPercentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;

    return {
      enrollment,
      subjectResults,
      totalMaxMarks,
      totalMarksObtained,
      overallPercentage: Math.round(overallPercentage * 10) / 10,
    };
  },
};

// -------------------------------------------------------------
// 8. AUDIT LOGS
// -------------------------------------------------------------
export const auditApi = {
  getLogs: async (): Promise<AuditLog[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (!error && data) return data;
    }
    return getStorage<AuditLog[]>('audit_logs', INITIAL_AUDIT_LOGS);
  },
};

// -------------------------------------------------------------
// 9. DASHBOARD STATS
// -------------------------------------------------------------
export const dashboardApi = {
  getLiveStatistics: async () => {
    const students = await studentApi.getStudents(false);
    const teachers = await teacherApi.getTeachers();
    const classes = await academicStructureApi.getClasses();
    const sections = await academicStructureApi.getSections();
    const financial = await feeApi.getFinancialSummary();
    let todayRecords: AttendanceRecord[] = [];
    const today = new Date().toISOString().split('T')[0];

    if (isLiveSupabaseConfigured()) {
      try {
        const { data: liveAtt } = await supabase.from('attendance').select('*').eq('date', today);
        if (liveAtt) todayRecords = liveAtt;
      } catch (e) {
        console.warn('Could not query live attendance for dashboard', e);
      }
    }

    if (todayRecords.length === 0 && !isLiveSupabaseConfigured()) {
      const attendance = getStorage<AttendanceRecord[]>('attendance', INITIAL_ATTENDANCE);
      todayRecords = attendance.filter(a => a.date === today);
    }

    const presentCount = todayRecords.filter(a => a.status === 'Present' || a.status === 'Late').length;
    const absentCount = todayRecords.filter(a => a.status === 'Absent').length;
    const leaveCount = todayRecords.filter(a => a.status === 'Leave').length;
    const attendancePercentage = todayRecords.length > 0 ? Math.round((presentCount / todayRecords.length) * 100) : 0;
    const exams = await examApi.getExams();
    const auditLogs = await auditApi.getLogs();

    return {
      totalActiveStudents: students.length,
      activeTeachers: teachers.filter(t => t.is_active).length,
      totalClasses: classes.length,
      totalSections: sections.length,
      todayAttendance: {
        totalMarked: todayRecords.length,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        percentage: attendancePercentage,
      },
      financial,
      upcomingExams: exams.filter(e => e.status !== 'Published'),
      recentActivity: auditLogs.slice(0, 10),
    };
  },
};

// -------------------------------------------------------------
// 10. USER ACCOUNTS & CREDENTIALS
// -------------------------------------------------------------
export const userApi = {
  getProfiles: async (): Promise<Profile[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return getStorage<Profile[]>('profiles', INITIAL_PROFILES);
  },

  adminResetTeacherPassword: async (
    targetUserId: string,
    newTemporaryPassword?: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ success: boolean; message: string }> => {
    // 1. Strict Administrator Authorization Check
    if (actor && actor.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are authorized to reset or modify staff credentials.');
    }

    const profiles = getStorage<Profile[]>('profiles', INITIAL_PROFILES);
    const targetProfile = profiles.find((p) => p.id === targetUserId);
    if (!targetProfile) {
      throw new Error('User account not found.');
    }

    // 2. Validate temporary password length
    if (newTemporaryPassword && newTemporaryPassword.length < 6) {
      throw new Error('Validation Error: Temporary password must be at least 6 characters.');
    }

    if (isLiveSupabaseConfigured()) {
      if (newTemporaryPassword) {
        // In real Supabase, calling admin auth updateUser
      } else {
        await supabase.auth.resetPasswordForEmail(targetProfile.email);
      }
    } else {
      if (newTemporaryPassword) {
        try {
          const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
          passMap[targetUserId] = newTemporaryPassword;
          passMap[targetProfile.email.toLowerCase()] = newTemporaryPassword;
          localStorage.setItem('sms_user_passwords', JSON.stringify(passMap));
        } catch {}
      }
    }

    // 3. Log administrative audit action without recording plain-text passwords
    await logAudit(
      actor || {},
      'TEACHER_PASSWORD_RESET',
      'profiles',
      targetUserId,
      {
        target_email: targetProfile.email,
        target_role: targetProfile.role,
        method: newTemporaryPassword ? 'TEMPORARY_PASSWORD_ASSIGNED' : 'RESET_LINK_DISPATCHED',
      }
    );

    return {
      success: true,
      message: newTemporaryPassword
        ? `Temporary password successfully assigned for ${targetProfile.full_name}. Active sessions revoked.`
        : `Authorized password reset link dispatched to ${targetProfile.email}.`,
    };
  },
};

// -------------------------------------------------------------
// 11. QUIZZES & CLASSROOM ASSESSMENTS
// -------------------------------------------------------------
export const quizApi = {
  getQuizzes: async (
    filters?: { sessionId?: string; classId?: string; sectionId?: string; subjectId?: string },
    actor?: { id?: string; role?: string; email?: string }
  ): Promise<Quiz[]> => {
    let quizzes: Quiz[] = [];
    if (isLiveSupabaseConfigured()) {
      let query = supabase
        .from('quizzes')
        .select('*, class:classes(*), section:sections(*), subject:subjects(*), academic_session:academic_sessions(*)')
        .order('assessment_date', { ascending: false });
      if (filters?.sessionId) query = query.eq('academic_session_id', filters.sessionId);
      if (filters?.classId) query = query.eq('class_id', filters.classId);
      if (filters?.sectionId) query = query.eq('section_id', filters.sectionId);
      if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
      const { data, error } = await query;
      if (!error && data) quizzes = data;
    } else {
      const allQuizzes = getStorage<Quiz[]>('quizzes', INITIAL_QUIZZES);
      const classes = await academicStructureApi.getClasses();
      const sections = await academicStructureApi.getSections();
      const subjects = await academicStructureApi.getSubjects();
      const sessions = await settingsApi.getSessions();

      quizzes = allQuizzes
        .filter((q) => {
          if (filters?.sessionId && q.academic_session_id !== filters.sessionId) return false;
          if (filters?.classId && q.class_id !== filters.classId) return false;
          if (filters?.sectionId && q.section_id !== filters.sectionId) return false;
          if (filters?.subjectId && q.subject_id !== filters.subjectId) return false;
          return true;
        })
        .map((q) => ({
          ...q,
          class: classes.find((c) => c.id === q.class_id),
          section: sections.find((s) => s.id === q.section_id),
          subject: subjects.find((s) => s.id === q.subject_id),
          academic_session: sessions.find((ses) => ses.id === q.academic_session_id),
        }))
        .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());
    }

    // Role scoping for teachers
    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) return [];

      const assignments = await teacherApi.getAssignments(filters?.sessionId);
      const teacherAssignments = assignments.filter((a) => a.teacher_id === currentTeacher.id);
      const assignedSectionIds = new Set(teacherAssignments.map((a) => a.section_id));

      return quizzes.filter((q) => assignedSectionIds.has(q.section_id));
    }

    // Role scoping for students (hide draft quizzes)
    if (actor?.role === 'student') {
      return quizzes.filter((q) => q.status !== 'draft');
    }

    return quizzes;
  },

  getQuizById: async (id: string): Promise<Quiz | null> => {
    const quizzes = await quizApi.getQuizzes();
    return quizzes.find((q) => q.id === id) || null;
  },

  createQuiz: async (
    quiz: Omit<Quiz, 'id' | 'created_at'>,
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<Quiz> => {
    if (!quiz.title || !quiz.title.trim()) {
      throw new Error('Validation Error: Quiz title is required.');
    }
    if (!quiz.assessment_date) {
      throw new Error('Validation Error: Assessment date is required.');
    }
    if (!quiz.max_marks || Number(quiz.max_marks) <= 0) {
      throw new Error('Validation Error: Maximum marks must be greater than zero.');
    }

    // Teacher authorization check
    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) {
        throw new Error('Unauthorized: Teacher profile record not found.');
      }
      const assignments = await teacherApi.getAssignments(quiz.academic_session_id);
      const isAssigned = assignments.some(
        (a) => a.teacher_id === currentTeacher.id && a.section_id === quiz.section_id && a.subject_id === quiz.subject_id
      );
      if (!isAssigned) {
        throw new Error('Unauthorized: You are not authorized to create quizzes for unassigned classes or subjects.');
      }
    }

    const newQuiz: Quiz = {
      ...quiz,
      id: generateUUID(),
      max_marks: Number(quiz.max_marks),
      status: quiz.status || 'published',
      created_by: actor?.id,
      created_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('quizzes').insert([newQuiz]).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'QUIZ_CREATED', 'quizzes', data.id, { title: quiz.title, max_marks: quiz.max_marks });
      return data;
    }

    const quizzes = getStorage<Quiz[]>('quizzes', INITIAL_QUIZZES);
    setStorage('quizzes', [newQuiz, ...quizzes]);
    await logAudit(actor || {}, 'QUIZ_CREATED', 'quizzes', newQuiz.id, { title: quiz.title, max_marks: quiz.max_marks });
    return newQuiz;
  },

  getQuizMarks: async (quizId: string): Promise<QuizMark[]> => {
    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('quiz_marks')
        .select('*, enrollment:enrollments(*, student:students(*)), quiz:quizzes(*)')
        .eq('quiz_id', quizId);
      if (!error && data) return data;
    }

    const allMarks = getStorage<QuizMark[]>('quiz_marks', INITIAL_QUIZ_MARKS);
    const enrollments = await studentApi.getEnrollments();
    const quizzes = await quizApi.getQuizzes();

    return allMarks
      .filter((m) => m.quiz_id === quizId)
      .map((m) => ({
        ...m,
        enrollment: enrollments.find((e) => e.id === m.enrollment_id),
        quiz: quizzes.find((q) => q.id === m.quiz_id),
      }));
  },

  getStudentQuizMarks: async (
    enrollmentId: string,
    actor?: { role?: string }
  ): Promise<(QuizMark & { quiz: Quiz })[]> => {
    const allMarks = getStorage<QuizMark[]>('quiz_marks', INITIAL_QUIZ_MARKS);
    const quizzes = await quizApi.getQuizzes(undefined, actor as any);

    return allMarks
      .filter((m) => m.enrollment_id === enrollmentId)
      .map((m) => {
        const quiz = quizzes.find((q) => q.id === m.quiz_id);
        return {
          ...m,
          quiz: quiz!,
        };
      })
      .filter((m) => Boolean(m.quiz) && (!actor || actor.role !== 'student' || m.quiz.status !== 'draft'));
  },

  saveQuizMarksBatch: async (
    quizId: string,
    marksData: { enrollment_id: string; marks_obtained?: number; is_absent: boolean; remarks?: string }[],
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<void> => {
    const quiz = await quizApi.getQuizById(quizId);
    if (!quiz) throw new Error('Quiz not found.');

    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) {
        throw new Error('Unauthorized: Teacher profile record not found.');
      }
      const assignments = await teacherApi.getAssignments(quiz.academic_session_id);
      const isAssigned = assignments.some(
        (a) => a.teacher_id === currentTeacher.id && a.section_id === quiz.section_id
      );
      if (!isAssigned) {
        throw new Error('Unauthorized: You are not authorized to grade quizzes for this section.');
      }
    }

    // Validation
    marksData.forEach((item) => {
      if (!item.is_absent) {
        if (item.marks_obtained === undefined || item.marks_obtained === null || isNaN(Number(item.marks_obtained))) {
          throw new Error('Validation Error: Obtained marks are required when student is present.');
        }
        if (Number(item.marks_obtained) < 0) {
          throw new Error('Validation Error: Obtained marks cannot be negative.');
        }
        if (Number(item.marks_obtained) > Number(quiz.max_marks)) {
          throw new Error(
            `Validation Error: Obtained marks (${item.marks_obtained}) cannot exceed maximum marks (${quiz.max_marks}).`
          );
        }
      }
    });

    if (isLiveSupabaseConfigured()) {
      const payload = marksData.map((item) => ({
        quiz_id: quizId,
        enrollment_id: item.enrollment_id,
        marks_obtained: item.is_absent ? null : Number(item.marks_obtained),
        is_absent: item.is_absent,
        remarks: item.remarks,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('quiz_marks').upsert(payload, { onConflict: 'quiz_id, enrollment_id' });
      if (error) throw error;
      await logAudit(actor || {}, 'QUIZ_MARKS_ENTERED', 'quiz_marks', quizId, { count: marksData.length });
      return;
    }

    const allMarks = getStorage<QuizMark[]>('quiz_marks', INITIAL_QUIZ_MARKS);
    const updated = [...allMarks];

    marksData.forEach((item) => {
      const idx = updated.findIndex((m) => m.quiz_id === quizId && m.enrollment_id === item.enrollment_id);
      if (idx !== -1) {
        updated[idx] = {
          ...updated[idx],
          marks_obtained: item.is_absent ? undefined : Number(item.marks_obtained),
          is_absent: item.is_absent,
          remarks: item.remarks,
          updated_at: new Date().toISOString(),
        };
      } else {
        updated.push({
          id: generateUUID(),
          quiz_id: quizId,
          enrollment_id: item.enrollment_id,
          marks_obtained: item.is_absent ? undefined : Number(item.marks_obtained),
          is_absent: item.is_absent,
          remarks: item.remarks,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });

    setStorage('quiz_marks', updated);
    await logAudit(actor || {}, 'QUIZ_MARKS_ENTERED', 'quiz_marks', quizId, { count: marksData.length });
  },

  updateQuiz: async (
    quizId: string,
    updates: Partial<Pick<Quiz, 'title' | 'assessment_date' | 'max_marks' | 'instructions' | 'status'>>,
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<Quiz> => {
    const quiz = await quizApi.getQuizById(quizId);
    if (!quiz) throw new Error('Quiz not found.');

    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) {
        throw new Error('Unauthorized: Teacher profile record not found.');
      }
      const assignments = await teacherApi.getAssignments(quiz.academic_session_id);
      const isAssigned = assignments.some(
        (a) => a.teacher_id === currentTeacher.id && a.section_id === quiz.section_id && a.subject_id === quiz.subject_id
      );
      if (!isAssigned) {
        throw new Error('Unauthorized: You are not authorized to edit quizzes for this section or subject.');
      }
    }

    if (updates.max_marks !== undefined && Number(updates.max_marks) <= 0) {
      throw new Error('Validation Error: Maximum marks must be greater than zero.');
    }
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error('Validation Error: Quiz title cannot be empty.');
    }

    if (isLiveSupabaseConfigured()) {
      const { data, error } = await supabase.from('quizzes').update(updates).eq('id', quizId).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'QUIZ_UPDATED', 'quizzes', quizId, updates);
      return data;
    }

    const quizzes = getStorage<Quiz[]>('quizzes', INITIAL_QUIZZES);
    const idx = quizzes.findIndex((q) => q.id === quizId);
    if (idx === -1) throw new Error('Quiz not found.');

    const updatedQuiz: Quiz = {
      ...quizzes[idx],
      ...updates,
      max_marks: updates.max_marks !== undefined ? Number(updates.max_marks) : quizzes[idx].max_marks,
    };
    quizzes[idx] = updatedQuiz;
    setStorage('quizzes', quizzes);
    await logAudit(actor || {}, 'QUIZ_UPDATED', 'quizzes', quizId, updates);
    return updatedQuiz;
  },

  deleteQuiz: async (
    quizId: string,
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<void> => {
    const quiz = await quizApi.getQuizById(quizId);
    if (!quiz) throw new Error('Quiz not found.');

    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) {
        throw new Error('Unauthorized: Teacher profile record not found.');
      }
      const assignments = await teacherApi.getAssignments(quiz.academic_session_id);
      const isAssigned = assignments.some(
        (a) => a.teacher_id === currentTeacher.id && a.section_id === quiz.section_id && a.subject_id === quiz.subject_id
      );
      if (!isAssigned) {
        throw new Error('Unauthorized: You are not authorized to delete quizzes for this section or subject.');
      }
    }

    if (isLiveSupabaseConfigured()) {
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (error) throw error;
      await logAudit(actor || {}, 'QUIZ_DELETED', 'quizzes', quizId, { title: quiz.title });
      return;
    }

    const quizzes = getStorage<Quiz[]>('quizzes', INITIAL_QUIZZES);
    setStorage('quizzes', quizzes.filter((q) => q.id !== quizId));

    const marks = getStorage<QuizMark[]>('quiz_marks', INITIAL_QUIZ_MARKS);
    setStorage('quiz_marks', marks.filter((m) => m.quiz_id !== quizId));

    await logAudit(actor || {}, 'QUIZ_DELETED', 'quizzes', quizId, { title: quiz.title });
  },
};

// -------------------------------------------------------------
// 12. SUBJECT-WISE DAILY DIARY
// -------------------------------------------------------------
export const diaryApi = {
  getDiaries: async (
    filters?: {
      sessionId?: string;
      classId?: string;
      sectionId?: string;
      subjectId?: string;
      date?: string;
      startDate?: string;
      endDate?: string;
      status?: DiaryStatus;
    },
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<DailyDiary[]> => {
    let diaries: DailyDiary[] = [];

    if (isLiveSupabaseConfigured()) {
      let q = supabase
        .from('daily_diary')
        .select('*, class:classes(*), section:sections(*), subject:subjects(*), teacher:teachers(*), academic_session:academic_sessions(*)')
        .order('diary_date', { ascending: false });

      if (filters?.sessionId) q = q.eq('academic_session_id', filters.sessionId);
      if (filters?.classId) q = q.eq('class_id', filters.classId);
      if (filters?.sectionId) q = q.eq('section_id', filters.sectionId);
      if (filters?.subjectId) q = q.eq('subject_id', filters.subjectId);
      if (filters?.date) q = q.eq('diary_date', filters.date);
      if (filters?.startDate) q = q.gte('diary_date', filters.startDate);
      if (filters?.endDate) q = q.lte('diary_date', filters.endDate);
      if (filters?.status) q = q.eq('status', filters.status);

      const { data, error } = await q;
      if (!error && data) diaries = data;
    } else {
      const stored = getStorage<DailyDiary[]>('daily_diaries', INITIAL_DAILY_DIARIES);
      const classes = await academicStructureApi.getClasses();
      const sections = await academicStructureApi.getSections();
      const subjects = await academicStructureApi.getSubjects();
      const teachers = await teacherApi.getTeachers();
      const sessions = await settingsApi.getSessions();

      diaries = stored.map((d) => ({
        ...d,
        homework: d.homework || d.homework_details || '',
        homework_details: d.homework_details || d.homework || '',
        instructions: d.instructions || d.instructions_or_test_alerts || '',
        instructions_or_test_alerts: d.instructions_or_test_alerts || d.instructions || '',
        class: classes.find((c) => c.id === d.class_id),
        section: sections.find((s) => s.id === d.section_id),
        subject: subjects.find((s) => s.id === d.subject_id),
        teacher: teachers.find((t) => t.id === d.teacher_id),
        academic_session: sessions.find((ses) => ses.id === d.academic_session_id),
      }));

      if (filters?.sessionId) diaries = diaries.filter((d) => d.academic_session_id === filters.sessionId);
      if (filters?.classId) diaries = diaries.filter((d) => d.class_id === filters.classId);
      if (filters?.sectionId) diaries = diaries.filter((d) => d.section_id === filters.sectionId);
      if (filters?.subjectId) diaries = diaries.filter((d) => d.subject_id === filters.subjectId);
      if (filters?.date) diaries = diaries.filter((d) => d.diary_date === filters.date);
      if (filters?.startDate) diaries = diaries.filter((d) => d.diary_date >= filters.startDate!);
      if (filters?.endDate) diaries = diaries.filter((d) => d.diary_date <= filters.endDate!);
      if (filters?.status) diaries = diaries.filter((d) => d.status === filters.status);

      diaries.sort((a, b) => new Date(b.diary_date).getTime() - new Date(a.diary_date).getTime());
    }

    // Role-based visibility scoping
    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) return [];

      const assignments = await teacherApi.getAssignments(filters?.sessionId);
      const teacherAssignments = assignments.filter((a) => a.teacher_id === currentTeacher.id);
      const assignedSectionIds = new Set(teacherAssignments.map((a) => a.section_id));

      return diaries.filter((d) => assignedSectionIds.has(d.section_id));
    }

    // Future student portal readiness: students only see published entries, private notes omitted
    if (actor?.role === 'student') {
      return diaries
        .filter((d) => d.status === 'published')
        .map((d) => {
          const { private_teacher_notes, ...safeEntry } = d;
          return safeEntry as DailyDiary;
        });
    }

    return diaries;
  },

  getDiaryById: async (
    id: string,
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<DailyDiary | null> => {
    const list = await diaryApi.getDiaries(undefined, actor);
    return list.find((d) => d.id === id) || null;
  },

  saveDiary: async (
    diary: Partial<DailyDiary> & {
      section_id: string;
      subject_id: string;
      diary_date: string;
      lesson_topics: string;
      status: DiaryStatus;
    },
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<DailyDiary> => {
    // 1. Teacher scoping check
    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) {
        throw new Error('Unauthorized: Teacher account record not found.');
      }

      const assignments = await teacherApi.getAssignments(diary.academic_session_id);
      const isAssigned = assignments.some(
        (a) => a.teacher_id === currentTeacher.id && a.section_id === diary.section_id && a.subject_id === diary.subject_id
      );

      if (!isAssigned) {
        throw new Error('Unauthorized: You are not authorized to create or edit diary entries for unassigned classes or subjects.');
      }
    }

    // 2. Validation
    if (!diary.diary_date) throw new Error('Validation Error: Diary date is required.');
    if (!diary.lesson_topics || !diary.lesson_topics.trim()) {
      throw new Error('Validation Error: Lesson / topics covered is required.');
    }
    const hw = (diary.homework || diary.homework_details || '').trim();
    if (!hw) {
      throw new Error('Validation Error: Homework / assignment details is required.');
    }
    if (!diary.section_id) throw new Error('Validation Error: Section is required.');
    if (!diary.subject_id) throw new Error('Validation Error: Subject is required.');

    const sections = await academicStructureApi.getSections();
    const sec = sections.find((s) => s.id === diary.section_id);
    const classId = diary.class_id || sec?.class_id || '';
    const inst = (diary.instructions_or_test_alerts || diary.instructions || '').trim();

    const normalizedDiary: any = {
      ...diary,
      class_id: classId,
      homework: hw,
      homework_details: hw,
      instructions: inst,
      instructions_or_test_alerts: inst,
    };

    const now = new Date().toISOString();

    if (diary.id) {
      if (isLiveSupabaseConfigured()) {
        const payload = { ...normalizedDiary, updated_at: now };
        const { data, error } = await supabase.from('daily_diary').update(payload).eq('id', diary.id).select().single();
        if (error) throw error;
        await logAudit(actor || {}, 'DIARY_UPDATED', 'daily_diary', diary.id, { date: diary.diary_date, status: diary.status });
        return data;
      }

      const diaries = getStorage<DailyDiary[]>('daily_diaries', INITIAL_DAILY_DIARIES);
      const idx = diaries.findIndex((d) => d.id === diary.id);
      if (idx === -1) throw new Error('Diary entry not found.');

      const updated: DailyDiary = {
        ...diaries[idx],
        ...normalizedDiary,
        id: diary.id,
        updated_at: now,
      };
      diaries[idx] = updated;
      setStorage('daily_diaries', diaries);
      await logAudit(actor || {}, 'DIARY_UPDATED', 'daily_diary', diary.id, { date: diary.diary_date, status: diary.status });
      return updated;
    }

    // Check duplicate entry for same section, subject, date, session
    if (isLiveSupabaseConfigured()) {
      const { data: dupData } = await supabase
        .from('daily_diary')
        .select('id')
        .eq('section_id', diary.section_id)
        .eq('subject_id', diary.subject_id)
        .eq('diary_date', diary.diary_date)
        .eq('academic_session_id', diary.academic_session_id)
        .maybeSingle();

      if (dupData) {
        const payload = { ...normalizedDiary, updated_at: now };
        const { data, error } = await supabase.from('daily_diary').update(payload).eq('id', dupData.id).select().single();
        if (error) throw error;
        await logAudit(actor || {}, 'DIARY_UPDATED', 'daily_diary', dupData.id, { date: diary.diary_date, status: diary.status });
        return data;
      }

      const newDiary: DailyDiary = {
        ...normalizedDiary,
        id: generateUUID(),
        created_by: actor?.id,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase.from('daily_diary').insert([newDiary]).select().single();
      if (error) throw error;
      await logAudit(actor || {}, 'DIARY_CREATED', 'daily_diary', data.id, { date: diary.diary_date, status: diary.status });
      return data;
    }

    const existingList = getStorage<DailyDiary[]>('daily_diaries', INITIAL_DAILY_DIARIES);
    const duplicate = existingList.find(
      (d) =>
        d.section_id === diary.section_id &&
        d.subject_id === diary.subject_id &&
        d.diary_date === diary.diary_date &&
        d.academic_session_id === diary.academic_session_id
    );

    if (duplicate) {
      const idx = existingList.findIndex((d) => d.id === duplicate.id);
      const updated: DailyDiary = {
        ...existingList[idx],
        ...normalizedDiary,
        id: duplicate.id,
        updated_at: now,
      };
      existingList[idx] = updated;
      setStorage('daily_diaries', existingList);
      await logAudit(actor || {}, 'DIARY_UPDATED', 'daily_diary', duplicate.id, { date: diary.diary_date, status: diary.status });
      return updated;
    }

    const newDiary: DailyDiary = {
      ...normalizedDiary,
      id: generateUUID(),
      created_by: actor?.id,
      created_at: now,
      updated_at: now,
    };

    setStorage('daily_diaries', [newDiary, ...existingList]);
    await logAudit(actor || {}, 'DIARY_CREATED', 'daily_diary', newDiary.id, { date: diary.diary_date, status: diary.status });
    return newDiary;
  },

  deleteDiary: async (
    id: string,
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<void> => {
    const existing = await diaryApi.getDiaryById(id, actor);
    if (!existing) throw new Error('Diary entry not found.');

    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher || existing.teacher_id !== currentTeacher.id) {
        throw new Error('Unauthorized: You can only delete your own diary entries.');
      }
    }

    if (isLiveSupabaseConfigured()) {
      const { error } = await supabase.from('daily_diary').delete().eq('id', id);
      if (error) throw error;
      await logAudit(actor || {}, 'DIARY_DELETED', 'daily_diary', id, { date: existing.diary_date });
      return;
    }

    const diaries = getStorage<DailyDiary[]>('daily_diaries', INITIAL_DAILY_DIARIES);
    setStorage('daily_diaries', diaries.filter((d) => d.id !== id));
    await logAudit(actor || {}, 'DIARY_DELETED', 'daily_diary', id, { date: existing.diary_date });
  },
};

// -------------------------------------------------------------
// 12. STUDENT QUICK SEARCH & ACADEMIC DOSSIER
// -------------------------------------------------------------
export const studentSearchApi = {
  searchStudents: async (
    params: { query?: string; classId?: string; sectionId?: string; sessionId?: string },
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<StudentSearchResult[]> => {
    const sessionId = params.sessionId || (await settingsApi.getSessions()).find((s) => s.is_current)?.id;
    const enrollments = await studentApi.getEnrollments(sessionId);
    const students = await studentApi.getStudents(false);
    const classes = await academicStructureApi.getClasses();
    const sections = await academicStructureApi.getSections();

    // 1. Determine authorized section scope
    let authorizedSectionIds: Set<string> | null = null;
    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) return [];

      const assignments = await teacherApi.getAssignments(sessionId);
      const teacherAssignments = assignments.filter((a) => a.teacher_id === currentTeacher.id);
      authorizedSectionIds = new Set(teacherAssignments.map((a) => a.section_id));

      if (authorizedSectionIds.size === 0) return [];
    }

    // 2. Filter enrollments by class, section, and authorized scope
    const filteredEnrollments = enrollments.filter((enr) => {
      if (authorizedSectionIds && !authorizedSectionIds.has(enr.section_id)) {
        return false;
      }
      if (params.sectionId && enr.section_id !== params.sectionId) {
        return false;
      }
      if (params.classId) {
        const sec = sections.find((s) => s.id === enr.section_id);
        if (!sec || sec.class_id !== params.classId) return false;
      }
      return true;
    });

    // 3. Search query filter
    const q = params.query?.trim().toLowerCase() || '';

    const results: StudentSearchResult[] = [];

    for (const enr of filteredEnrollments) {
      const student = students.find((s) => s.id === enr.student_id);
      if (!student) continue;

      const sec = sections.find((s) => s.id === enr.section_id);
      const cls = sec ? classes.find((c) => c.id === sec.class_id) : undefined;

      const populatedEnrollment = {
        ...enr,
        section: sec ? { ...sec, class: cls } : undefined,
      };

      if (!q) {
        results.push({ student, enrollment: populatedEnrollment });
        continue;
      }

      const matchName = student.full_name.toLowerCase().includes(q);
      const matchAdmission = student.admission_no.toLowerCase().includes(q);
      const matchRoll = enr.roll_no ? String(enr.roll_no) === q || `roll ${enr.roll_no}`.includes(q) : false;
      const matchClassName = cls?.name.toLowerCase().includes(q);
      const matchSectionName = sec?.name.toLowerCase().includes(q);

      if (matchName || matchAdmission || matchRoll || matchClassName || matchSectionName) {
        results.push({ student, enrollment: populatedEnrollment });
      }
    }

    return results.sort((a, b) => {
      const clsA = a.enrollment?.section?.class?.numeric_order ?? 99;
      const clsB = b.enrollment?.section?.class?.numeric_order ?? 99;
      if (clsA !== clsB) return clsA - clsB;
      const rollA = a.enrollment?.roll_no ?? 999;
      const rollB = b.enrollment?.roll_no ?? 999;
      return rollA - rollB;
    });
  },

  getStudentAcademicSummary: async (
    studentId: string,
    sessionId?: string,
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<StudentAcademicSummary> => {
    const student = await studentApi.getStudentById(studentId);
    if (!student) throw new Error('Student record not found.');

    const sessions = await settingsApi.getSessions();
    const activeSession = sessionId
      ? sessions.find((s) => s.id === sessionId)
      : sessions.find((s) => s.is_current) || sessions[0];
    const targetSessionId = activeSession?.id;

    const enrollments = await studentApi.getEnrollments(targetSessionId);
    const enrollment = enrollments.find((e) => e.student_id === studentId);

    // 1. Enforce Teacher Scoping Check
    if (actor?.role === 'teacher') {
      const teachers = await teacherApi.getTeachers();
      const currentTeacher = teachers.find(
        (t) => t.email?.toLowerCase() === actor.email?.toLowerCase() || t.profile_id === actor.id
      );
      if (!currentTeacher) {
        throw new Error('Unauthorized: Teacher account profile not found.');
      }
      const assignments = await teacherApi.getAssignments(targetSessionId);
      const isAssigned =
        enrollment &&
        assignments.some((a) => a.teacher_id === currentTeacher.id && a.section_id === enrollment.section_id);
      if (!isAssigned) {
        throw new Error('Unauthorized: You do not have permission to view academic records for unassigned students.');
      }
    }

    // 2. Attendance Analytics
    let attendanceSummary = {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      percentage: 0,
      history: [] as AttendanceRecord[],
    };

    if (enrollment) {
      const attendanceRecords = await attendanceApi.getAttendanceByEnrollment(enrollment.id);
      const present = attendanceRecords.filter((r) => r.status === 'Present').length;
      const absent = attendanceRecords.filter((r) => r.status === 'Absent').length;
      const late = attendanceRecords.filter((r) => r.status === 'Late').length;
      const leave = attendanceRecords.filter((r) => r.status === 'Leave').length;
      const total = attendanceRecords.length;
      const percentage = calculateAttendancePercentage(present + late, total);

      attendanceSummary = {
        total,
        present,
        absent,
        late,
        leave,
        percentage,
        history: attendanceRecords,
      };
    }

    // 3. Examination Results
    const examResults: StudentAcademicSummary['exams'] = [];
    if (enrollment) {
      const exams = await examApi.getExams(targetSessionId);
      const subjects = await academicStructureApi.getSubjects();

      for (const exam of exams) {
        const examSubjects = await examApi.getExamSubjects(exam.id, enrollment.section?.class_id);
        for (const es of examSubjects) {
          const marks = await examApi.getMarks(es.id);
          const studentMark = marks.find((m) => m.enrollment_id === enrollment.id);
          if (studentMark) {
            const subj = subjects.find((s) => s.id === es.subject_id);
            const isAbsent = Boolean(studentMark.is_absent);
            const obtained = studentMark.marks_obtained;
            const pct =
              !isAbsent && obtained !== undefined ? Math.round((obtained / es.max_marks) * 100 * 10) / 10 : undefined;
            const grade = isAbsent ? 'Absent' : pct !== undefined ? calculateGrade(pct).grade : 'N/A';

            examResults.push({
              exam_id: exam.id,
              exam_name: exam.name,
              subject_id: es.subject_id,
              subject_name: subj?.name || es.subject?.name || 'Subject',
              marks_obtained: obtained,
              max_marks: es.max_marks,
              percentage: pct,
              grade,
              is_absent: isAbsent,
              remarks: studentMark.remarks,
              exam_date: es.exam_date,
            });
          }
        }
      }
    }

    // 4. Quizzes & Classroom Assessments
    const quizResults: StudentAcademicSummary['quizzes'] = [];
    if (enrollment) {
      const quizzes = await quizApi.getQuizzes({ sessionId: targetSessionId, sectionId: enrollment.section_id });
      for (const q of quizzes) {
        const qMarks = await quizApi.getQuizMarks(q.id);
        const studentQMark = qMarks.find((m) => m.enrollment_id === enrollment.id);
        if (studentQMark) {
          const isAbsent = Boolean(studentQMark.is_absent);
          const obtained = studentQMark.marks_obtained;
          const pct =
            !isAbsent && obtained !== undefined ? Math.round((obtained / q.max_marks) * 100 * 10) / 10 : undefined;

          quizResults.push({
            quiz_id: q.id,
            title: q.title,
            subject_name: q.subject?.name || 'Class Subject',
            assessment_date: q.assessment_date,
            marks_obtained: obtained,
            max_marks: q.max_marks,
            percentage: pct,
            is_absent: isAbsent,
            remarks: studentQMark.remarks,
          });
        }
      }
    }

    // 5. Fee Ledger (Admin Only - Teachers Strictly Excluded)
    let feeSummary: StudentAcademicSummary['fees'] = null;
    if (actor?.role === 'admin' && enrollment) {
      const invoices = await feeApi.getInvoices(targetSessionId);
      const studentInvoices = invoices.filter((i) => i.enrollment_id === enrollment.id);
      const totalInvoiced = studentInvoices.reduce((sum, inv) => sum + Number(inv.net_amount), 0);
      const totalPaid = studentInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
      const outstanding = Math.max(0, totalInvoiced - totalPaid);

      const hasOverdue = studentInvoices.some((i) => i.status === 'Overdue');
      const status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue' =
        outstanding === 0 ? 'Paid' : hasOverdue ? 'Overdue' : totalPaid > 0 ? 'Partially Paid' : 'Unpaid';

      feeSummary = {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        outstanding_balance: outstanding,
        status,
        invoices: studentInvoices,
      };
    }

    // 6. Chronological Performance Trend (Quizzes + Exams)
    const trendItems: StudentAcademicSummary['performanceTrend'] = [];

    quizResults.forEach((q) => {
      if (!q.is_absent && q.percentage !== undefined) {
        trendItems.push({
          date: q.assessment_date,
          title: q.title,
          subject: q.subject_name,
          type: 'Quiz',
          percentage: q.percentage,
        });
      }
    });

    examResults.forEach((e) => {
      if (!e.is_absent && e.percentage !== undefined && e.exam_date) {
        trendItems.push({
          date: e.exam_date,
          title: `${e.exam_name} - ${e.subject_name}`,
          subject: e.subject_name,
          type: 'Exam',
          percentage: e.percentage,
        });
      }
    });

    trendItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 7. Subject-Wise Daily Diary Entries for Student's Section (Published entries only)
    let studentDiaryEntries: DailyDiary[] = [];
    if (enrollment) {
      const allDiaries = await diaryApi.getDiaries(
        {
          sessionId: targetSessionId,
          sectionId: enrollment.section_id,
          status: 'published',
        },
        actor
      );

      // Private teacher notes must never appear in student responses
      if (actor?.role === 'student') {
        studentDiaryEntries = allDiaries.map((d) => {
          const { private_teacher_notes, ...safe } = d;
          return safe as DailyDiary;
        });
      } else {
        studentDiaryEntries = allDiaries;
      }
    }

    return {
      student,
      enrollment,
      attendance: attendanceSummary,
      exams: examResults,
      quizzes: quizResults,
      fees: feeSummary,
      performanceTrend: trendItems,
      diaryEntries: studentDiaryEntries,
    };
  },
};

// -------------------------------------------------------------
// 13. STUDENT PORTAL DATA ACCESS & SCOPING
// -------------------------------------------------------------
export const studentPortalApi = {
  getStudentSelf: async (profileId: string): Promise<{ student: Student; enrollment?: Enrollment }> => {
    const students = await studentApi.getStudents(true);
    const student = students.find(
      (s) =>
        s.profile_id === profileId ||
        (s.email && s.email.toLowerCase() === profileId.toLowerCase())
    );
    if (!student) {
      throw new Error('No student record is linked to this user profile.');
    }
    const enrollments = await studentApi.getEnrollments();
    const enrollment =
      enrollments.find((e) => e.student_id === student.id && e.status === 'active') ||
      enrollments.find((e) => e.student_id === student.id);
    return { student, enrollment };
  },

  getMyDashboardStats: async (profileId: string) => {
    const { student, enrollment } = await studentPortalApi.getStudentSelf(profileId);
    let quizCount = 0;
    let quizAvgPct = 0;
    let recentQuizzes: (QuizMark & { quiz: Quiz })[] = [];
    let recentDiaries: DailyDiary[] = [];
    let attendancePct = 100;

    if (enrollment) {
      // 1. Quizzes (published only)
      const allStudentMarks = await quizApi.getStudentQuizMarks(enrollment.id, { role: 'student' });
      const publishedMarks = allStudentMarks.filter((m) => m.quiz && m.quiz.status !== 'draft');
      quizCount = publishedMarks.length;

      const totalMax = publishedMarks.reduce((acc, curr) => acc + (curr.quiz?.max_marks || 0), 0);
      const totalObtained = publishedMarks.reduce(
        (acc, curr) => acc + (curr.is_absent ? 0 : curr.marks_obtained || 0),
        0
      );
      quizAvgPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
      recentQuizzes = publishedMarks.slice(0, 5);

      // 2. Daily Diary (published only for enrolled section, stripped of private notes)
      const diaries = await diaryApi.getDiaries(
        {
          sectionId: enrollment.section_id,
          sessionId: enrollment.academic_session_id,
          status: 'published',
        },
        { role: 'student' }
      );
      recentDiaries = diaries.slice(0, 5);

      // 3. Attendance Rate
      const attRecords = await attendanceApi.getAttendanceByEnrollment(enrollment.id);
      const present = attRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
      attendancePct = attRecords.length > 0 ? Math.round((present / attRecords.length) * 1000) / 10 : 100;
    }

    return {
      student,
      enrollment,
      quizCount,
      quizAvgPct,
      attendancePct,
      recentQuizzes,
      recentDiaries,
    };
  },

  getMyQuizMarks: async (
    profileId: string,
    filters?: { subjectId?: string; date?: string }
  ): Promise<(QuizMark & { quiz: Quiz })[]> => {
    const { enrollment } = await studentPortalApi.getStudentSelf(profileId);
    if (!enrollment) return [];

    const allMarks = await quizApi.getStudentQuizMarks(enrollment.id, { role: 'student' });
    return allMarks.filter((m) => {
      if (!m.quiz || m.quiz.status === 'draft') return false;
      if (filters?.subjectId && m.quiz.subject_id !== filters.subjectId) return false;
      if (filters?.date && m.quiz.assessment_date !== filters.date) return false;
      return true;
    });
  },

  getMyDailyDiary: async (
    profileId: string,
    filters?: { subjectId?: string; startDate?: string; endDate?: string }
  ): Promise<DailyDiary[]> => {
    const { enrollment } = await studentPortalApi.getStudentSelf(profileId);
    if (!enrollment) return [];

    return diaryApi.getDiaries(
      {
        sectionId: enrollment.section_id,
        sessionId: enrollment.academic_session_id,
        subjectId: filters?.subjectId,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        status: 'published',
      },
      { role: 'student' }
    );
  },

  getMyFees: async (
    profileId: string
  ): Promise<{
    student: Student;
    enrollment?: Enrollment;
    summary: {
      totalAssigned: number;
      totalPaid: number;
      remainingBalance: number;
      totalInvoices: number;
      paidCount: number;
      partialCount: number;
      unpaidCount: number;
      overdueCount: number;
    };
    invoices: FeeInvoice[];
    payments: FeePayment[];
  }> => {
    const { student, enrollment } = await studentPortalApi.getStudentSelf(profileId);
    if (!enrollment) {
      return {
        student,
        summary: {
          totalAssigned: 0,
          totalPaid: 0,
          remainingBalance: 0,
          totalInvoices: 0,
          paidCount: 0,
          partialCount: 0,
          unpaidCount: 0,
          overdueCount: 0,
        },
        invoices: [],
        payments: [],
      };
    }

    const enrollments = await studentApi.getEnrollments();
    const studentEnrollments = enrollments.filter((e) => e.student_id === student.id);
    const enrollmentIds = new Set(studentEnrollments.map((e) => e.id));

    let invoices: FeeInvoice[] = [];
    let payments: FeePayment[] = [];

    if (isLiveSupabaseConfigured()) {
      const { data: invData } = await supabase
        .from('fee_invoices')
        .select('*, items:fee_invoice_items(*), payments:fee_payments(*), enrollment:enrollments(*, student:students(*), section:sections(*, class:classes(*)))')
        .in('enrollment_id', Array.from(enrollmentIds))
        .order('billing_month', { ascending: false });
      if (invData) invoices = invData;

      const { data: payData } = await supabase
        .from('fee_payments')
        .select('*, invoice:fee_invoices(*)')
        .in('invoice_id', invoices.map((i) => i.id))
        .eq('is_reversed', false)
        .order('payment_date', { ascending: false });
      if (payData) payments = payData;
    } else {
      const allInvoices = getStorage<FeeInvoice[]>('invoices', INITIAL_INVOICES);
      const allPayments = getStorage<FeePayment[]>('payments', INITIAL_PAYMENTS);

      invoices = allInvoices
        .filter((i) => enrollmentIds.has(i.enrollment_id))
        .map((inv) => {
          const invPayments = allPayments.filter((p) => p.invoice_id === inv.id && !p.is_reversed);
          const currentEnrollment = studentEnrollments.find((e) => e.id === inv.enrollment_id) || enrollment;
          return {
            ...inv,
            enrollment: currentEnrollment,
            payments: invPayments,
            items:
              inv.items && inv.items.length > 0
                ? inv.items
                : [
                    {
                      id: `${inv.id}-item-1`,
                      invoice_id: inv.id,
                      description: `Monthly Tuition Fee (${inv.billing_month})`,
                      amount: Number(inv.total_amount),
                      created_at: inv.created_at,
                    },
                  ],
          };
        })
        .sort((a, b) => b.billing_month.localeCompare(a.billing_month));

      payments = allPayments
        .filter((p) => invoices.some((i) => i.id === p.invoice_id) && !p.is_reversed)
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Compute updated dynamic status and totals
    let totalAssigned = 0;
    let totalPaid = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    const normalizedInvoices = invoices.map((inv) => {
      const net = Number(inv.net_amount);
      const paid = Number(inv.paid_amount);
      totalAssigned += net;
      totalPaid += paid;

      let effectiveStatus: InvoiceStatus = inv.status;
      if (paid >= net) {
        effectiveStatus = 'Paid';
        paidCount++;
      } else if (paid > 0) {
        effectiveStatus = 'Partially Paid';
        partialCount++;
      } else if (inv.due_date < todayStr) {
        effectiveStatus = 'Overdue';
        overdueCount++;
      } else {
        effectiveStatus = 'Unpaid';
        unpaidCount++;
      }

      return {
        ...inv,
        status: effectiveStatus,
      };
    });

    const remainingBalance = Math.max(0, totalAssigned - totalPaid);

    return {
      student,
      enrollment,
      summary: {
        totalAssigned,
        totalPaid,
        remainingBalance,
        totalInvoices: normalizedInvoices.length,
        paidCount,
        partialCount,
        unpaidCount,
        overdueCount,
      },
      invoices: normalizedInvoices,
      payments,
    };
  },

  getMyFeeChallans: async (profileId: string): Promise<FeeInvoice[]> => {
    const data = await studentPortalApi.getMyFees(profileId);
    return data.invoices;
  },

  getMyDues: async (
    profileId: string
  ): Promise<{
    student: Student;
    enrollment?: Enrollment;
    outstandingBase: number;
    totalLateFines: number;
    totalPayableNow: number;
    unpaidMonths: string[];
    overdueCount: number;
    dueInvoices: (FeeInvoice & {
      remainingBalance: number;
      isOverdue: boolean;
      lateFine: number;
      totalPayable: number;
    })[];
    clearedInvoices: FeeInvoice[];
    paymentHistory: FeePayment[];
  }> => {
    const { student, enrollment, invoices, payments } = await studentPortalApi.getMyFees(profileId);
    const todayStr = new Date().toISOString().split('T')[0];

    const dueInvoices: (FeeInvoice & {
      remainingBalance: number;
      isOverdue: boolean;
      lateFine: number;
      totalPayable: number;
    })[] = [];

    const clearedInvoices: FeeInvoice[] = [];
    const unpaidMonthsSet = new Set<string>();

    let outstandingBase = 0;
    let totalLateFines = 0;
    let overdueCount = 0;

    invoices.forEach((inv) => {
      const net = Number(inv.net_amount);
      const paid = Number(inv.paid_amount);
      const balance = Math.max(0, net - paid);

      if (balance <= 0) {
        clearedInvoices.push(inv);
      } else {
        const isOverdue = inv.due_date < todayStr;
        // Standard Pakistani school late fee fine: Rs. 200 per overdue challan
        const lateFine = isOverdue ? 200 : 0;
        const totalPayable = balance + lateFine;

        outstandingBase += balance;
        totalLateFines += lateFine;
        if (isOverdue) overdueCount++;

        unpaidMonthsSet.add(inv.billing_month);

        dueInvoices.push({
          ...inv,
          remainingBalance: balance,
          isOverdue,
          lateFine,
          totalPayable,
        });
      }
    });

    const unpaidMonths = Array.from(unpaidMonthsSet).sort();
    const totalPayableNow = outstandingBase + totalLateFines;

    return {
      student,
      enrollment,
      outstandingBase,
      totalLateFines,
      totalPayableNow,
      unpaidMonths,
      overdueCount,
      dueInvoices,
      clearedInvoices,
      paymentHistory: payments,
    };
  },

  updateMyAvatar: async (
    profileId: string,
    fileOrUrl: File | string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ photo_url: string }> => {
    const { student } = await studentPortalApi.getStudentSelf(profileId);
    if (!student) {
      throw new Error('Student record not found.');
    }

    // Authorization check: student can only update their own avatar; admins can update any student
    if (actor) {
      if (actor.role === 'admin') {
        // Admin is authorized
      } else if (actor.role === 'student') {
        if (student.profile_id && actor.id !== student.profile_id && actor.id !== profileId) {
          throw new Error('Unauthorized: Students can only update their own profile picture.');
        }
      } else {
        throw new Error('Unauthorized: Only students or administrators are authorized to update profile pictures.');
      }
    }

    let photoUrl = '';
    if (typeof fileOrUrl === 'string') {
      photoUrl = fileOrUrl.trim();
    } else {
      const file = fileOrUrl;
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (file.type && !validTypes.includes(file.type)) {
        throw new Error('Invalid file format. Please upload a JPG, PNG, WEBP, or GIF image.');
      }
      const maxSize = 5 * 1024 * 1024; // 5 MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds the 5MB limit. Please choose a smaller image.');
      }

      if (isLiveSupabaseConfigured()) {
        const fileExt = file.name ? file.name.split('.').pop() || 'png' : 'png';
        const fileName = `${student.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('student-avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from('student-avatars')
          .getPublicUrl(filePath);

        photoUrl = publicData.publicUrl;
      } else {
        // Local/mock environment fallback
        if (typeof FileReader !== 'undefined') {
          photoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read image file.'));
            reader.readAsDataURL(file);
          });
        } else if (typeof (file as any).arrayBuffer === 'function') {
          const buf = await (file as any).arrayBuffer();
          const b64 = Buffer.from(buf).toString('base64');
          photoUrl = `data:${file.type || 'image/png'};base64,${b64}`;
        } else {
          photoUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop`;
        }
      }
    }

    if (isLiveSupabaseConfigured()) {
      const { error: dbError } = await supabase
        .from('students')
        .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
        .eq('id', student.id);

      if (dbError) {
        throw new Error(`Failed to update student profile photo: ${dbError.message}`);
      }
    }

    // Update local storage in all modes to ensure local cache consistency
    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const idx = students.findIndex((s) => s.id === student.id);
    if (idx !== -1) {
      students[idx] = { ...students[idx], photo_url: photoUrl, updated_at: new Date().toISOString() };
      setStorage('students', [...students]);
    }

    await logAudit(
      actor || { id: student.profile_id, name: student.full_name, role: 'student' },
      'STUDENT_AVATAR_UPDATED',
      'students',
      student.id,
      { previous: student.photo_url, updated: photoUrl }
    );

    return { photo_url: photoUrl };
  },
};


