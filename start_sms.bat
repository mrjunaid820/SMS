@echo off
title School Management System (SMS) - Development Server
color 0B
cls
echo ==============================================================================
echo       ISLAMIA PUBLIC HIGH SCHOOL - SCHOOL MANAGEMENT SYSTEM (SMS)
echo ==============================================================================
echo.
echo [Repository Status]
cd /d C:\Users\User\Desktop\SMS
git log -1 --pretty=format:"Latest Commit: %%h - %%s (%%cr)"
echo.
echo Remote URL: https://github.com/mrjunaid820/SMS
echo.
echo ==============================================================================
echo [Active Modules Overview]
echo   1. Dashboard (Live KPIs, Financial Flow, Attendance Ratio)
echo   2. Students (Admissions ADM-YYYY-XXXX, Roll Numbers, ID Cards, CSV Import)
echo   3. Teachers (Faculty Registry EMP-T101, Scoped Permissions)
echo   4. Academic Sessions (Operational Years, Term Boundary Dates)
echo   5. Classes and Sections (Nursery through Class 10, Capacities)
echo   6. Curriculum and Subjects (Core and Elective Subject Codes)
echo   7. Teacher Assignments (Class In-charge and Paper Allocation)
echo   8. Daily Attendance (Class Register, Bulk Marking, Pakistani Holidays)
echo   9. Fees and Accounts (3-Copy Bank Challan Vouchers, Receipts, Reversals)
echo  10. Examinations (Term Papers, Passing Marks, Approval Workflows)
echo  11. Results and Report Cards (BISE Pakistani Grading Scale, Transcripts)
echo  12. Reports and Exports (Enrollment Registers, Aging Ledgers)
echo  13. Audit Trail (Immutable Security Logs, JSON Inspector)
echo  14. Institutional Settings (School Identity, Board Affiliation)
echo  15. User and Role Management (Admin-controlled Staff Provisioning)
echo ==============================================================================
echo.
echo Starting Vite Development Server at http://localhost:3000 ...
echo Press Ctrl+C anytime to stop the server.
echo.
npm run dev
pause
