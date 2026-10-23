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
import { StudentQuickSearchPage } from '@/pages/QuickSearch/StudentQuickSearchPage';
import { QuizMarksPage } from '@/pages/QuizMarks/QuizMarksPage';
import { DailyDiaryPage } from '@/pages/DailyDiary/DailyDiaryPage';
import { LoginPage } from '@/pages/Auth/LoginPage';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  if (role !== 'admin') {
    return <Navigate to="/teacher-dashboard" replace />;
  }
  return <>{children}</>;
};

const TeacherRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  if (role !== 'teacher') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  return <>{children}</>;
};

const DashboardRedirect: React.FC = () => {
  const { role } = useAuth();
  return <Navigate to={role === 'teacher' ? '/teacher-dashboard' : '/admin-dashboard'} replace />;
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
                <Route path="/" element={<DashboardRedirect />} />
                <Route path="/dashboard" element={<DashboardRedirect />} />
                <Route
                  path="/admin-dashboard"
                  element={
                    <AdminRoute>
                      <DashboardPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/teacher-dashboard"
                  element={
                    <TeacherRoute>
                      <DashboardPage />
                    </TeacherRoute>
                  }
                />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/quick-search" element={<StudentQuickSearchPage />} />
                <Route path="/quiz-marks" element={<QuizMarksPage />} />
                <Route path="/daily-diary" element={<DailyDiaryPage />} />
                
                {/* Admin Only Protected Routes */}
                <Route
                  path="/teachers"
                  element={
                    <AdminRoute>
                      <TeachersPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/academic-sessions"
                  element={
                    <AdminRoute>
                      <AcademicSessionsPage />
                    </AdminRoute>
                  }
                />
                <Route path="/classes-sections" element={<ClassesSectionsPage />} />
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route
                  path="/teacher-assignments"
                  element={
                    <AdminRoute>
                      <TeacherAssignmentsPage />
                    </AdminRoute>
                  }
                />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route
                  path="/fees-accounts"
                  element={
                    <AdminRoute>
                      <FeesAccountsPage />
                    </AdminRoute>
                  }
                />
                <Route path="/examinations" element={<ExaminationsPage />} />
                <Route path="/results-report-cards" element={<ResultsPage />} />
                <Route path="/reports-exports" element={<ReportsPage />} />
                <Route
                  path="/audit-logs"
                  element={
                    <AdminRoute>
                      <AuditLogsPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/school-settings"
                  element={
                    <AdminRoute>
                      <SettingsPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/users-roles"
                  element={
                    <AdminRoute>
                      <UsersRolesPage />
                    </AdminRoute>
                  }
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<DashboardRedirect />} />
            </Routes>
          </BrowserRouter>
        </SchoolProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
