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
  FeePayment,
  FeePaymentReversal,
  PaymentMethod,
  Exam,
  ExamSubject,
  Mark,
  SchoolSettings,
  AuditLog,
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
} from './mockData';
import { generateUUID } from '@/lib/utils';

// Helper to get or initialize persistent local state
function getStorage<T>(key: string, initial: T): T {
  try {
    const val = localStorage.getItem(`sms_${key}`);
    if (val) return JSON.parse(val);
  } catch (e) {
    console.warn(`Failed to read sms_${key} from storage`, e);
  }
  return initial;
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
  actor: { id?: string; name?: string },
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

  updateSettings: async (settings: Partial<SchoolSettings>, actor?: { id?: string; name?: string }): Promise<SchoolSettings> => {
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

  createSession: async (session: Omit<AcademicSession, 'id' | 'created_at'>, actor?: { id?: string; name?: string }): Promise<AcademicSession> => {
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

  createClass: async (cls: Omit<ClassLevel, 'id' | 'created_at'>): Promise<ClassLevel> => {
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

  createSection: async (section: Omit<Section, 'id' | 'created_at'>): Promise<Section> => {
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

  createSubject: async (subj: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> => {
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

  createTeacher: async (teacher: Omit<Teacher, 'id' | 'created_at'>, actor?: { id?: string; name?: string }): Promise<Teacher> => {
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

  updateTeacher: async (id: string, updates: Partial<Teacher>, actor?: { id?: string; name?: string }): Promise<Teacher> => {
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
    const students = getStorage<Student[]>('students', INITIAL_STUDENTS);
    const prefix = `ADM-${currentYear}-`;
    const seqs = students
      .filter(s => s.admission_no.startsWith(prefix))
      .map(s => parseInt(s.admission_no.replace(prefix, ''), 10))
      .filter(n => !isNaN(n));
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  },

  generateNextRollNo: async (sessionId: string, sectionId: string): Promise<number> => {
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

  updateStudent: async (id: string, updates: Partial<Student>, actor?: { id?: string; name?: string }): Promise<Student> => {
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

  archiveStudent: async (id: string, reason: string, actor?: { id?: string; name?: string }): Promise<Student> => {
    return studentApi.updateStudent(
      id,
      { is_active: false, archived_at: new Date().toISOString(), archive_reason: reason },
      actor
    );
  },

  restoreStudent: async (id: string, actor?: { id?: string; name?: string }): Promise<Student> => {
    return studentApi.updateStudent(
      id,
      { is_active: true, archived_at: undefined, archive_reason: undefined },
      actor
    );
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
      if (!error && data) {
        return data.filter((a: any) => a.enrollment?.section_id === sectionId);
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
      const { data, error } = await supabase.from('attendance').upsert(payload, { onConflict: 'enrollment_id, date' }).select();
      if (error) throw error;
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
};

// -------------------------------------------------------------
// 6. FEES & FINANCIAL TRANSACTIONS
// -------------------------------------------------------------
export const feeApi = {
  getStructures: async (sessionId?: string): Promise<FeeStructure[]> => {
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

  createStructure: async (structure: Omit<FeeStructure, 'id' | 'created_at'>): Promise<FeeStructure> => {
    const structures = getStorage<FeeStructure[]>('fee_structures', INITIAL_FEE_STRUCTURES);
    const newStr: FeeStructure = { ...structure, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('fee_structures', [...structures, newStr]);
    return newStr;
  },

  getInvoices: async (sessionId?: string, month?: string): Promise<FeeInvoice[]> => {
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
    const invoices = await feeApi.getInvoices();
    return invoices.find(i => i.id === id) || null;
  },

  generateMonthlyInvoices: async (
    sessionId: string,
    billingMonth: string,
    dueDate: string,
    actor?: { id?: string; name?: string }
  ): Promise<{ generatedCount: number }> => {
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
    actor?: { id?: string; name?: string }
  ): Promise<FeePayment> => {
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
    actor?: { id?: string; name?: string }
  ): Promise<void> => {
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
    const payments = getStorage<FeePayment[]>('payments', INITIAL_PAYMENTS).filter(p => !p.is_reversed);

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
    const exams = getStorage<Exam[]>('exams', INITIAL_EXAMS);
    const sessions = await settingsApi.getSessions();
    return exams
      .filter(e => !sessionId || e.academic_session_id === sessionId)
      .map(e => ({
        ...e,
        academic_session: sessions.find(s => s.id === e.academic_session_id),
      }));
  },

  createExam: async (exam: Omit<Exam, 'id' | 'created_at'>, actor?: { id?: string; name?: string }): Promise<Exam> => {
    const exams = getStorage<Exam[]>('exams', INITIAL_EXAMS);
    const newExam: Exam = { ...exam, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('exams', [...exams, newExam]);
    await logAudit(actor || {}, 'EXAM_CREATED', 'exams', newExam.id, { name: exam.name });
    return newExam;
  },

  updateExamStatus: async (id: string, status: Exam['status'], actor?: { id?: string; name?: string }): Promise<Exam> => {
    const exams = getStorage<Exam[]>('exams', INITIAL_EXAMS);
    const idx = exams.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Exam not found');
    exams[idx] = { ...exams[idx], status };
    setStorage('exams', [...exams]);
    await logAudit(actor || {}, 'EXAM_STATUS_CHANGED', 'exams', id, { newStatus: status });
    return exams[idx];
  },

  getExamSubjects: async (examId?: string, classId?: string): Promise<ExamSubject[]> => {
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
    const examSubjects = getStorage<ExamSubject[]>('exam_subjects', INITIAL_EXAM_SUBJECTS);
    const newES: ExamSubject = { ...item, id: generateUUID(), created_at: new Date().toISOString() };
    setStorage('exam_subjects', [...examSubjects, newES]);
    return newES;
  },

  getMarks: async (examSubjectId: string): Promise<Mark[]> => {
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
    const marks = getStorage<Mark[]>('marks', INITIAL_MARKS);

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
    const attendance = getStorage<AttendanceRecord[]>('attendance', INITIAL_ATTENDANCE);
    const exams = await examApi.getExams();
    const auditLogs = await auditApi.getLogs();

    // Today's attendance
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendance.filter(a => a.date === today);
    const presentCount = todayRecords.filter(a => a.status === 'Present' || a.status === 'Late').length;
    const absentCount = todayRecords.filter(a => a.status === 'Absent').length;
    const leaveCount = todayRecords.filter(a => a.status === 'Leave').length;
    const attendancePercentage = todayRecords.length > 0 ? Math.round((presentCount / todayRecords.length) * 100) : 0;

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
