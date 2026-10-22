-- ==============================================================================
-- 004_seed_data.sql
-- Comprehensive Synthetic Seed Data for a Pakistani School (300-1500 students)
-- ==============================================================================

-- 1. SCHOOL SETTINGS
INSERT INTO public.school_settings (
    id, school_name, registration_number, affiliation, phone, email, address, principal_name, currency_symbol
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Islamia Public High School',
    'SED-LHR-2018-9412',
    'Board of Intermediate and Secondary Education (BISE) Lahore',
    '+92 42 35881234',
    'admin@islamiapublic.edu.pk',
    'Plot 42-B, Model Town Link Road, Lahore, Punjab, Pakistan',
    'Prof. Abdul Rehman Malik (M.Sc., M.Ed)',
    'Rs.'
) ON CONFLICT (id) DO NOTHING;

-- 2. ACADEMIC SESSIONS
INSERT INTO public.academic_sessions (id, name, start_date, end_date, is_current) VALUES
('b0000000-0000-0000-0000-000000000001', '2024-2025', '2024-04-01', '2025-03-31', FALSE),
('b0000000-0000-0000-0000-000000000002', '2025-2026', '2025-04-01', '2026-03-31', TRUE)
ON CONFLICT (name) DO NOTHING;

UPDATE public.school_settings 
SET current_session_id = 'b0000000-0000-0000-0000-000000000002'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 3. CLASSES
INSERT INTO public.classes (id, name, numeric_order, description) VALUES
('c0000000-0000-0000-0000-000000000001', 'Class 6', 6, 'Middle School - Grade 6'),
('c0000000-0000-0000-0000-000000000002', 'Class 7', 7, 'Middle School - Grade 7'),
('c0000000-0000-0000-0000-000000000003', 'Class 8', 8, 'Middle School - Grade 8'),
('c0000000-0000-0000-0000-000000000004', 'Class 9', 9, 'Secondary School Certificate (Matric Part 1)'),
('c0000000-0000-0000-0000-000000000005', 'Class 10', 10, 'Secondary School Certificate (Matric Part 2)')
ON CONFLICT (name) DO NOTHING;

-- 4. SECTIONS
INSERT INTO public.sections (id, class_id, name, capacity, room_no) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'A', 40, 'Room 101'),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'B', 40, 'Room 102'),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'A', 40, 'Room 201'),
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005', 'B', 40, 'Room 202')
ON CONFLICT (class_id, name) DO NOTHING;

-- 5. SUBJECTS
INSERT INTO public.subjects (id, name, code, class_id, is_elective, credit_hours) VALUES
('e0000000-0000-0000-0000-000000000001', 'English Compulsory', 'ENG-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 6),
('e0000000-0000-0000-0000-000000000002', 'Urdu Compulsory', 'URD-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 6),
('e0000000-0000-0000-0000-000000000003', 'Islamiyat Compulsory', 'ISL-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 3),
('e0000000-0000-0000-0000-000000000004', 'Mathematics Science', 'MTH-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 6),
('e0000000-0000-0000-0000-000000000005', 'Physics Theory & Practical', 'PHY-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 5),
('e0000000-0000-0000-0000-000000000006', 'Chemistry', 'CHM-09', 'c0000000-0000-0000-0000-000000000004', FALSE, 5),
('e0000000-0000-0000-0000-000000000007', 'Biology', 'BIO-09', 'c0000000-0000-0000-0000-000000000004', TRUE, 5),
('e0000000-0000-0000-0000-000000000008', 'Computer Science', 'CSC-09', 'c0000000-0000-0000-0000-000000000004', TRUE, 5)
ON CONFLICT (code) DO NOTHING;

-- 6. TEACHERS
INSERT INTO public.teachers (id, employee_id, full_name, phone, email, qualification, joining_date, designation) VALUES
('f0000000-0000-0000-0000-000000000001', 'T-101', 'Muhammad Tariq', '+92 300 4567891', 'tariq.math@islamiapublic.edu.pk', 'M.Sc. Mathematics, B.Ed', '2019-08-15', 'Senior Mathematics Master'),
('f0000000-0000-0000-0000-000000000002', 'T-102', 'Ayesha Siddiqui', '+92 301 7891234', 'ayesha.eng@islamiapublic.edu.pk', 'M.A. English Literature, B.Ed', '2020-09-01', 'Head of English Dept'),
('f0000000-0000-0000-0000-000000000003', 'T-103', 'Dr. Imran Qureshi', '+92 321 9876543', 'imran.phy@islamiapublic.edu.pk', 'M.Sc., Ph.D Physics', '2018-03-10', 'Senior Science Master'),
('f0000000-0000-0000-0000-000000000004', 'T-104', 'Bushra Noreen', '+92 333 1122334', 'bushra.urd@islamiapublic.edu.pk', 'M.A. Urdu, B.Ed', '2021-02-01', 'Senior Urdu Teacher'),
('f0000000-0000-0000-0000-000000000005', 'T-105', 'Asif Mehmood', '+92 345 5566778', 'asif.cs@islamiapublic.edu.pk', 'MS Computer Science', '2022-01-15', 'IT & Computer Instructor')
ON CONFLICT (employee_id) DO NOTHING;

-- 7. TEACHER ASSIGNMENTS
INSERT INTO public.teacher_assignments (id, teacher_id, academic_session_id, section_id, subject_id, is_class_teacher) VALUES
('fa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', TRUE),
('fa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', FALSE),
('fa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', FALSE),
('fa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000008', FALSE)
ON CONFLICT (teacher_id, academic_session_id, section_id, subject_id) DO NOTHING;

-- 8. STUDENTS (Synthetic Sample of Students)
INSERT INTO public.students (
    id, admission_no, full_name, date_of_birth, gender, b_form_or_cnic,
    admission_date, guardian_name, guardian_relation, guardian_cnic,
    guardian_phone, address, blood_group
) VALUES
('10000000-0000-0000-0000-000000000001', 'ADM-2025-0001', 'Muhammad Hamza Khan', '2010-05-14', 'Male', '35201-1234567-1', '2025-04-05', 'Javed Iqbal Khan', 'Father', '35201-9876543-1', '+92 300 1234567', 'House 14, Street 3, Gulberg III, Lahore', 'B+'),
('10000000-0000-0000-0000-000000000002', 'ADM-2025-0002', 'Fatima Zahra', '2010-09-20', 'Female', '35202-2345678-2', '2025-04-06', 'Tariq Mehmood', 'Father', '35202-8765432-1', '+92 321 2345678', 'Flat 4B, Eden Heights, Jail Road, Lahore', 'O+'),
('10000000-0000-0000-0000-000000000003', 'ADM-2025-0003', 'Ali Hassan Raza', '2010-03-11', 'Male', '35201-3456789-3', '2025-04-07', 'Syed Raza Abbas', 'Father', '35201-7654321-1', '+92 333 3456789', 'House 88, Block C, Faisal Town, Lahore', 'A+'),
('10000000-0000-0000-0000-000000000004', 'ADM-2025-0004', 'Zainab Bibi', '2010-11-28', 'Female', '35202-4567890-4', '2025-04-08', 'Rashid Minhas', 'Father', '35202-6543210-1', '+92 345 4567890', 'House 22, Shadman Colony, Lahore', 'AB+'),
('10000000-0000-0000-0000-000000000005', 'ADM-2025-0005', 'Bilal Ahmed Sheikh', '2010-07-04', 'Male', '35201-5678901-5', '2025-04-10', 'Sheikh Niaz Ahmed', 'Father', '35201-5432109-1', '+92 302 5678901', 'House 112, Sector B, DHA Phase 5, Lahore', 'O-')
ON CONFLICT (admission_no) DO NOTHING;

-- 9. ENROLLMENTS
INSERT INTO public.enrollments (id, student_id, academic_session_id, section_id, roll_no, enrollment_date, status) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 1, '2025-04-05', 'active'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 2, '2025-04-06', 'active'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 3, '2025-04-07', 'active'),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 4, '2025-04-08', 'active'),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 5, '2025-04-10', 'active')
ON CONFLICT (student_id, academic_session_id) DO NOTHING;

-- 10. FEE STRUCTURES
INSERT INTO public.fee_structures (
    id, academic_session_id, class_id, name, monthly_tuition, admission_fee, exam_fee, lab_library_fee, other_charges
) VALUES (
    '30000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000004',
    'Class 9 Science Fee Structure 2025-2026',
    4500.00,
    5000.00,
    1500.00,
    800.00,
    200.00
) ON CONFLICT (academic_session_id, class_id) DO NOTHING;

-- 11. INVOICES
INSERT INTO public.fee_invoices (
    id, invoice_no, enrollment_id, academic_session_id, billing_month, issue_date, due_date,
    total_amount, discount_amount, net_amount, paid_amount, status
) VALUES
('40000000-0000-0000-0000-000000000001', 'INV-202610-0001', '20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '2026-10', '2026-10-01', '2026-10-15', 5500.00, 500.00, 5000.00, 5000.00, 'Paid'),
('40000000-0000-0000-0000-000000000002', 'INV-202610-0002', '20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '2026-10', '2026-10-01', '2026-10-15', 5500.00, 0.00, 5500.00, 3000.00, 'Partially Paid'),
('40000000-0000-0000-0000-000000000003', 'INV-202610-0003', '20000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', '2026-10', '2026-10-01', '2026-10-15', 5500.00, 0.00, 5500.00, 0.00, 'Unpaid')
ON CONFLICT (invoice_no) DO NOTHING;

-- 12. PAYMENTS
INSERT INTO public.fee_payments (
    id, receipt_no, invoice_id, payment_date, amount, payment_method, reference_no
) VALUES
('50000000-0000-0000-0000-000000000001', 'REC-202610-0001', '40000000-0000-0000-0000-000000000001', '2026-10-08', 5000.00, 'Bank Transfer', 'HBL-FT-984128'),
('50000000-0000-0000-0000-000000000002', 'REC-202610-0002', '40000000-0000-0000-0000-000000000002', '2026-10-10', 3000.00, 'Cash', 'Counter Voucher #44')
ON CONFLICT (receipt_no) DO NOTHING;

-- 13. EXAMS
INSERT INTO public.exams (id, academic_session_id, name, start_date, end_date, status) VALUES
('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Mid-Term Examinations 2025-26', '2025-10-15', '2025-10-25', 'Published'),
('60000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Annual Final Examination 2026', '2026-03-01', '2026-03-15', 'Draft')
ON CONFLICT DO NOTHING;

-- 14. EXAM SUBJECTS
INSERT INTO public.exam_subjects (id, exam_id, class_id, subject_id, max_marks, passing_marks, exam_date) VALUES
('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 100.00, 33.00, '2025-10-16'),
('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 100.00, 33.00, '2025-10-18'),
('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000005', 75.00, 25.00, '2025-10-20')
ON CONFLICT (exam_id, class_id, subject_id) DO NOTHING;

-- 15. MARKS
INSERT INTO public.marks (id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks) VALUES
('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 94.00, FALSE, 'Outstanding performance'),
('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 88.50, FALSE, 'Excellent conceptual clarity'),
('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 72.00, FALSE, 'Good effort, needs algebra practice'),
('80000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 64.00, FALSE, 'Fair attempt'),
('80000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 0.00, TRUE, 'Medical leave on exam day')
ON CONFLICT (exam_subject_id, enrollment_id) DO NOTHING;
