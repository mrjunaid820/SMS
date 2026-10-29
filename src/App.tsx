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
import { EventsAnnouncementsPage } from '@/pages/EventsAnnouncements/EventsAnnouncementsPage';
import { LoginPage } from '@/pages/Auth/LoginPage';

// Student Portal Modules
import { StudentDashboardPage } from '@/pages/StudentPortal/StudentDashboardPage';
import { MyQuizMarksPage } from '@/pages/StudentPortal/MyQuizMarksPage';
import { MyDailyDiaryPage } from '@/pages/StudentPortal/MyDailyDiaryPage';
import { MyProfilePage } from '@/pages/StudentPortal/MyProfilePage';
import { MyFeesPage } from '@/pages/StudentPortal/MyFeesPage';
import { MyFeeChallansPage } from '@/pages/StudentPortal/MyFeeChallansPage';
import { MyDuesPage } from '@/pages/StudentPortal/MyDuesPage';
import { MyAnnouncementsPage } from '@/pages/StudentPortal/MyAnnouncementsPage';

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
    return <Navigate to={role === 'student' ? '/student-dashboard' : '/teacher-dashboard'} replace />;
  }
  return <>{children}</>;
};

const TeacherRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  if (role !== 'teacher') {
    return <Navigate to={role === 'student' ? '/student-dashboard' : '/admin-dashboard'} replace />;
  }
  return <>{children}</>;
};

const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  if (role !== 'student') {
    return <Navigate to={role === 'teacher' ? '/teacher-dashboard' : '/admin-dashboard'} replace />;
  }
  return <>{children}</>;
};

const StaffRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  if (role === 'student') {
    return <Navigate to="/student-dashboard" replace />;
  }
  return <>{children}</>;
};

const DashboardRedirect: React.FC = () => {
  const { role } = useAuth();
  if (role === 'student') {
    return <Navigate to="/student-dashboard" replace />;
  }
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

                {/* Student Portal Routes */}
                <Route
                  path="/student-dashboard"
                  element={
                    <StudentRoute>
                      <StudentDashboardPage />
                    </StudentRoute>
                  }
                />
                <Route
                  path="/my-fees"
                  element={
                    <StudentRoute>
                      <MyFeesPage />
                    </StudentRoute>
                  }
                />
                <Route
                  path="/my-fee-challans"
                  element={
                    <StudentRoute>
                      <MyFeeChallansPage />
                    </StudentRoute>
                  }
                />
                <Route
                  path="/my-dues"
                  element={
                    <StudentRoute>
                      <MyDuesPage />
                    </StudentRoute>
                  }
                />
                <Route
                  path="/my-announcements"
                  element={
                    <StudentRoute>
                      <MyAnnouncementsPage />
                    </StudentRoute>
                  }
                />
                <Route
                  path="/my-quiz-marks"
                  element={
                    <StudentRoute>
                      <MyQuizMarksPage />
                    </StudentRoute>
                  }
                />
                <Route
                  path="/my-daily-diary"
                  element={
                    <StudentRoute>
                      <MyDailyDiaryPage />
                    </StudentRoute>
                  }
                />
                <Route
                  path="/my-profile"
                  element={
                    <StudentRoute>
                      <MyProfilePage />
                    </StudentRoute>
                  }
                />

                {/* Staff / Faculty Protected Routes */}
                <Route path="/students" element={<StaffRoute><StudentsPage /></StaffRoute>} />
                <Route path="/quick-search" element={<StaffRoute><StudentQuickSearchPage /></StaffRoute>} />
                <Route path="/quiz-marks" element={<StaffRoute><QuizMarksPage /></StaffRoute>} />
                <Route path="/daily-diary" element={<StaffRoute><DailyDiaryPage /></StaffRoute>} />
                <Route path="/events-announcements" element={<StaffRoute><EventsAnnouncementsPage /></StaffRoute>} />
                
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
                <Route path="/classes-sections" element={<StaffRoute><ClassesSectionsPage /></StaffRoute>} />
                <Route path="/subjects" element={<StaffRoute><SubjectsPage /></StaffRoute>} />
                <Route
                  path="/teacher-assignments"
                  element={
                    <AdminRoute>
                      <TeacherAssignmentsPage />
                    </AdminRoute>
                  }
                />
                <Route path="/attendance" element={<StaffRoute><AttendancePage /></StaffRoute>} />
                <Route
                  path="/fees-accounts"
                  element={
                    <AdminRoute>
                      <FeesAccountsPage />
                    </AdminRoute>
                  }
                />
                <Route path="/examinations" element={<StaffRoute><ExaminationsPage /></StaffRoute>} />
                <Route path="/results-report-cards" element={<StaffRoute><ResultsPage /></StaffRoute>} />
                <Route path="/reports-exports" element={<StaffRoute><ReportsPage /></StaffRoute>} />
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
                  path="/server-database"
                  element={
                    <AdminRoute>
                      <SettingsPage defaultTab="server" />
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
