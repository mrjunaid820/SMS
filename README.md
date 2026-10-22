# Professional School Management System (Pakistan)

> **Enterprise-grade School Management System engineered for private and public schools in Pakistan (300 to 1,500 students).**

Built with **React 19, TypeScript, Vite, Tailwind CSS, Supabase (PostgreSQL 15+), and Vitest**.

---

## 1. Executive Overview

This application is a production-oriented School Management System tailored to the administrative, academic, and financial standards of schools in Pakistan.

### Core Highlights:
- **Restrained Navy & Blue Theme**: Accessible, distraction-free aesthetic with high contrast, responsive desktop/mobile layouts, and dark mode.
- **Pakistan Board Grading Standard**: BISE-compliant grading scale (`A+`, `A`, `B`, `C`, `D`, `E`, `F`) with customizable grade percentages, GPAs, and remarks.
- **Authentic Print Formats**:
  - Pakistani 3-copy Bank Challan Vouchers (**Bank Copy**, **School Copy**, **Student Copy**) with late surcharges and cash receipt stamps.
  - Official Payment Receipts with receipt numbers (`REC-YYYYMM-XXXX`).
  - Student Identity Cards with photos, roll numbers, and emergency helplines.
  - Examination Progress Report Cards with subject breakdowns, attendance percentage, class rank, and official signature blocks.
- **Financial Precision**: Uses PostgreSQL `NUMERIC(12,2)` types for all monetary calculations, preventing floating-point inaccuracies. Includes payment idempotency keys to prevent duplicate submissions, and atomic payment reversals.
- **Strict Role-Based Security (RLS)**: Scoped access for **Administrators** (full operational control) and **Teachers** (scoped strictly to assigned classes, sections, and authorized examination subjects).
- **Anti-Formula Injection**: Protects CSV exports and imports from formula injection attacks (`=`, `+`, `-`, `@`, `\t`, `\r`).

---

## 2. Technology Stack

| Layer | Technologies |
|:---|:---|
| **Frontend Framework** | React 18 / 19, TypeScript 5.7, Vite 6 |
| **Styling & Design** | Tailwind CSS 3.4, Custom Navy/Blue Palette, Lucide Icons |
| **Backend & Database** | Supabase Platform, PostgreSQL 15+ |
| **Authentication** | Supabase Auth (JWT with admin-provisioned staff accounts) |
| **Data Validation** | Zod, PapaParse (with custom formula-injection sanitizer) |
| **Visual Charts** | Recharts (Responsive bar, pie, and trend charts) |
| **Testing** | Vitest 3, JSDOM, React Testing Library |
| **Deployment Target** | Vercel (Frontend SPA) + Supabase Cloud (PostgreSQL & Storage) |

---

## 3. The 15 Core Modules

1. **Dashboard**: Live institutional aggregates (active students, faculty strength, class rosters, today's attendance ratio, realized fee collections vs outstanding dues, upcoming examinations, and recent audit trail).
2. **Students**: Student lifecycle management, automatic admission number generator (`ADM-YYYY-XXXX`), roll number generation within sections, guardian profiles, B-Form/CNICs, CSV bulk import with error reporting, soft archiving, and printable ID cards.
3. **Teachers**: Faculty employee registry (`EMP-T101`), qualifications, contact details, designations, and account deactivation.
4. **Academic Sessions**: Annual academic terms (e.g., `2024-2025`, `2025-2026`) with start/end dates and active session selector.
5. **Classes & Sections**: Class hierarchies (Nursery through Class 10 Matriculation), sections (`A`, `B`, `C`), student capacities, and room assignments.
6. **Subjects**: Core compulsory and elective curriculum subjects (Urdu, English, Mathematics, Physics, Chemistry, Biology, Computer Science, Pakistan Studies, Islamiyat) with weekly credit hours.
7. **Teacher Assignments**: Faculty mapping to session, class, section, and subject. Sets the database RLS permissions and designates class in-charges.
8. **Attendance**: Daily class register with statuses: `Present`, `Absent`, `Late`, `Leave`. Includes "Mark All Present" bulk actions, duplicate date protections (`UNIQUE(enrollment_id, date)`), and CSV/print export.
9. **Fees & Accounts**: Class fee schedules (tuition, admission, lab/library, exams), monthly invoice generation (`INV-YYYYMM-XXXX`), partial payments, payment receipts, Pakistani 3-copy bank challans, idempotency tokens, and payment reversals.
10. **Examinations**: Exam schedules (Mid-Term, Annual Final) with draft, under review, and published workflow states.
11. **Results & Report Cards**: Marks entry with explicit absence flags, maximum marks validation (`0 <= marks <= max`), BISE grade calculation, class result sheets, and printable report cards.
12. **Reports & Exports**: Institutional enrollment registers, fee aging ledgers, attendance summaries, and archived student reports with safe CSV downloads.
13. **Audit Logs**: Immutable security trail recording actor, action, entity type, entity ID, IP address, timestamp, and metadata payload.
14. **School Settings**: Institutional profile, board affiliations, registration number, currency symbol (`Rs.`), and editable BISE grading rules.
15. **User & Role Management**: Administrator-controlled user account provisioning (Admin and Teacher roles) and password reset triggers.

---

## 4. Local Installation & Development Setup

### Prerequisites
- Node.js `v18+` or `v20+` (tested on Node v24)
- npm `v9+` or `v11+`
- Git

### Steps
1. Navigate to the project directory:
   ```bash
   cd C:\Users\User\Desktop\SMS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

   Configure your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_APP_NAME="Islamia Public High School"
   VITE_APP_REGISTRATION_NO="SED-LHR-2018-9412"
   VITE_APP_CURRENCY="PKR"
   VITE_APP_CURRENCY_SYMBOL="Rs."
   VITE_ENABLE_OFFLINE_FALLBACK=true
   ```

4. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## 5. Supabase Database Migrations & RLS Setup

All SQL migrations are organized in `supabase/migrations/`:

| Migration File | Description |
|:---|:---|
| [`001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) | 20 core tables, foreign keys, indexes, check constraints |
| [`002_rls_and_policies.sql`](supabase/migrations/002_rls_and_policies.sql) | Row Level Security policies for Admins and Teachers |
| [`003_functions_and_triggers.sql`](supabase/migrations/003_functions_and_triggers.sql) | Sequential generators, atomic payment procedures, reversals |
| [`004_seed_data.sql`](supabase/migrations/004_seed_data.sql) | Comprehensive Pakistani school synthetic seed dataset |

### Applying to Supabase Cloud:
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Go to **SQL Editor** in the left sidebar.
3. Execute the migrations in order: `001_initial_schema.sql` -> `002_rls_and_policies.sql` -> `003_functions_and_triggers.sql` -> `004_seed_data.sql`.
4. Copy the Project URL and Public Anon Key from **Project Settings > API** into your `.env` file.

---

## 6. Testing & Quality Assurance

Run the automated test suite with Vitest:
```bash
npm run test
```

### Verified Test Suites:
- `tests/calculations.test.ts`: BISE grading boundary verification (`A+` down to `F`), GPA weights, attendance percentages, currency formatting.
- `tests/csv-sanitizer.test.ts`: Formula injection protection (`=`, `+`, `-`, `@`, `\t`, `\r`) and CSV bulk validation.
- `tests/financial-transactions.test.ts`: Idempotency keys, partial payments, overpayment rejection, payment reversals.
- `tests/security-scoping.test.ts`: Teacher navigation scoping, admission number formats, roll number generation, attendance duplicate prevention.

---

## 7. CSV Import / Export Specifications

### Student Bulk Import Format
CSV files must use UTF-8 encoding. The header row must include:
```csv
Full Name,Gender,Date of Birth,Guardian Name,Guardian Phone,Address,Guardian CNIC,Blood Group
Muhammad Bilal,Male,2010-06-15,Niaz Ahmed,+92 300 1234567,House 44 Street 2 Lahore,35201-1234567-1,B+
Amina Noor,Female,2010-08-20,Noor Alam,+92 321 7654321,Gulberg III Lahore,35202-7654321-2,O+
```

### Formula Injection Security
Any exported cell whose value starts with `= `, `+`, `-`, `@`, tab, or carriage return is automatically prefixed with a single quote `'` in `exportToSafeCSV` to prevent Microsoft Excel and Google Sheets from executing arbitrary commands (DDE).

---

## 8. Backup and Restore Runbook

### Taking a Database Backup
Using PostgreSQL `pg_dump`:
```bash
pg_dump -h db.your-project.supabase.co -U postgres -d postgres -F c -b -v -f school_backup_$(date +%Y%m%d).dump
```

### Restoring from Backup
```bash
pg_restore -h db.your-project.supabase.co -U postgres -d postgres -v -c school_backup_20261022.dump
```

---

## 9. Vercel & Supabase Deployment Checklist

- [x] Configure production environment variables in Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.).
- [x] Run `npm run build` and ensure zero TypeScript or bundling errors.
- [x] Execute all 4 migration scripts in Supabase SQL editor.
- [x] Create the private storage bucket `student-documents` in Supabase Storage.
- [x] Verify Admin credentials and confirm Teacher RLS isolation.
- [x] Test CSV export and verification with formula sanitization.

---

## 10. Known Limitations & Roadmap

- **Initial Release Scope**: Exclusively for School Administrators and Faculty Teachers.
- **Future Parent & Student Portal**: Database schema (`students`, `enrollments`, `marks`, `fee_invoices`) is fully decoupled and ready for a read-only parent/student portal in Version 2.0.
- **SMS / WhatsApp Gateway**: Architecture is ready for integration with Pakistani SMS gateways (e.g. Jazz / Telenor / Zong bulk SMS APIs) for automated attendance and fee alerts.
