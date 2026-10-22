import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SchoolProvider } from '@/context/SchoolContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';

// 15 Modules
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { StudentsPage } from '@/pages/Students/StudentsPage';
import { TeachersPage } from '@/pages/Teachers/TeachersPage';
import { AcademicSessionsPage } from '@/pages/AcademicSessions/AcademicSessionsPage';
import { ClassesSectionsPage } from '@/pages/ClassesSections/ClassesSectionsPage';
import { SubjectsPage } from '@/pages/Subjects/SubjectsPage';
import { TeacherAssignmentsPage } from '@/pages/TeacherAssignments/TeacherAssignmentsPage';
import { AttendancePage } from '@/pages/Attendance/AttendancePage';
import { FeesAccountsPage } from '@/pages/FeesAccounts/FeesAccountsPage';
import { ExaminationsPage } from '@/pages/Examinations/ExaminationsPage';
import { ResultsPage } from '@/pages/Results/ResultsPage';
import { ReportsPage } from '@/pages/Reports/ReportsPage';
import { AuditLogsPage } from '@/pages/AuditLogs/AuditLogsPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';
import { UsersRolesPage } from '@/pages/UsersRoles/UsersRolesPage';
import { LoginPage } from '@/pages/Auth/LoginPage';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SchoolProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Auth Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected 15 Application Routes */}
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/teachers" element={<TeachersPage />} />
                <Route path="/academic-sessions" element={<AcademicSessionsPage />} />
                <Route path="/classes-sections" element={<ClassesSectionsPage />} />
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route path="/teacher-assignments" element={<TeacherAssignmentsPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/fees-accounts" element={<FeesAccountsPage />} />
                <Route path="/examinations" element={<ExaminationsPage />} />
                <Route path="/results-report-cards" element={<ResultsPage />} />
                <Route path="/reports-exports" element={<ReportsPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/school-settings" element={<SettingsPage />} />
                <Route path="/users-roles" element={<UsersRolesPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </SchoolProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
