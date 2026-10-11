import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { SECURITY_ROLES, WORKER_ROLES } from './lib/auth/roles'
import { RoleRedirect } from './components/auth/RoleRedirect'
import { AdminPortal, ClientPortal, SecurityPortal, SupervisorPortal, WorkerPortal } from './pages/portals'
import { LoginPage } from './pages/auth/Login'
import { SignupPage } from './pages/auth/Signup'
import { PendingAccessPage } from './pages/auth/PendingAccess'
import { ForgotPasswordPage } from './pages/auth/ForgotPassword'
import { ResetPasswordPage } from './pages/auth/ResetPassword'
import { AdminDashboardPage } from './pages/admin/Dashboard'
import { AdminClientsPage } from './pages/admin/Clients'
import { AdminSitesPage } from './pages/admin/Sites'
import { AdminEmployeesPage } from './pages/admin/Employees'
import { AdminShiftsPage } from './pages/admin/Shifts'
import { AdminRosterPage } from './pages/admin/Roster'
import { AdminAttendancePage } from './pages/admin/Attendance'
import { AdminTasksPage } from './pages/admin/Tasks'
import { AdminChecklistsPage } from './pages/admin/Checklists'
import { AdminInspectionsPage } from './pages/admin/Inspections'
import { AdminLeavesPage } from './pages/admin/Leaves'
import { AdminComplaintsPage } from './pages/admin/Complaints'
import { AdminSecurityPage } from './pages/admin/Security'
import { AdminInventoryPage } from './pages/admin/Inventory'
import { AdminAssetsPage } from './pages/admin/Assets'
import { AdminMonthlyReportsPage } from './pages/admin/MonthlyReports'
import { AdminContractsPage } from './pages/admin/Contracts'
import { AdminRevenuePage } from './pages/admin/Revenue'
import { AdminAnnouncementsPage } from './pages/admin/Announcements'
import { AdminPayrollPage } from './pages/admin/Payroll'
import { AdminOrganizationsPage } from './pages/admin/Organizations'
import { AdminSettingsPage } from './pages/admin/Settings'
import { AdminAccessRequestsPage } from './pages/admin/AccessRequests'
import { SupervisorDashboardPage } from './pages/supervisor/Dashboard'
import { SupervisorSitesPage } from './pages/supervisor/MySites'
import { SupervisorAttendancePage } from './pages/supervisor/Attendance'
import { SupervisorTasksPage } from './pages/supervisor/Tasks'
import { SupervisorInspectionsPage } from './pages/supervisor/Inspections'
import { SupervisorIssuesPage } from './pages/supervisor/Issues'
import { SupervisorSecurityPage } from './pages/supervisor/Security'
import { SupervisorInventoryPage } from './pages/supervisor/Inventory'
import { SupervisorLeavePage } from './pages/supervisor/Leave'
import { SupervisorHandoverPage } from './pages/supervisor/Handover'
import { WorkerCheckInPage } from './pages/worker/CheckIn'
import { WorkerTasksPage } from './pages/worker/Tasks'
import { WorkerLeavePage } from './pages/worker/Leave'
import { WorkerAttendanceHistoryPage } from './pages/worker/Attendance'
import { WorkerAnnouncementsPage } from './pages/worker/Announcements'
import { SecurityPatrolsPage } from './pages/security/Patrols'
import { SecurityIncidentsPage } from './pages/security/Incidents'
import { SecurityVisitorsPage } from './pages/security/Visitors'
import { ClientOverviewPage } from './pages/client/Overview'
import { ClientLocationsPage } from './pages/client/Locations'
import { ClientStaffPage } from './pages/client/Staff'
import { ClientAttendancePage } from './pages/client/Attendance'
import { ClientInspectionsPage } from './pages/client/Inspections'
import { ClientComplaintsPage } from './pages/client/Complaints'
import { ClientReportsPage } from './pages/client/Reports'
import { ClientContractsPage } from './pages/client/Contracts'
import { ClientInvoicesPage } from './pages/client/Invoices'
import { ClientPaymentsPage } from './pages/client/Payments'
import { ClientSecurityPage } from './pages/client/Security'
import { HowItWorksPage } from './pages/HowItWorks'
import { InstallAppBanner } from './components/InstallAppBanner'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <InstallAppBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pending" element={<PendingAccessPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />

          <Route element={<ProtectedRoute roles={['super_admin', 'admin', 'operations_manager']} />}>
            <Route path="/admin" element={<AdminPortal />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="clients" element={<AdminClientsPage />} />
              <Route path="sites" element={<AdminSitesPage />} />
              <Route path="employees" element={<AdminEmployeesPage />} />
              <Route path="access" element={<AdminAccessRequestsPage />} />
              <Route path="shifts" element={<AdminShiftsPage />} />
              <Route path="roster" element={<AdminRosterPage />} />
              <Route path="attendance" element={<AdminAttendancePage />} />
              <Route path="tasks" element={<AdminTasksPage />} />
              <Route path="checklists" element={<AdminChecklistsPage />} />
              <Route path="inspections" element={<AdminInspectionsPage />} />
              <Route path="leaves" element={<AdminLeavesPage />} />
              <Route path="complaints" element={<AdminComplaintsPage />} />
              <Route path="security" element={<AdminSecurityPage />} />
              <Route path="inventory" element={<AdminInventoryPage />} />
              <Route path="assets" element={<AdminAssetsPage />} />
              <Route path="reports" element={<AdminMonthlyReportsPage />} />
              <Route path="contracts" element={<AdminContractsPage />} />
              <Route path="revenue" element={<AdminRevenuePage />} />
              <Route path="announcements" element={<AdminAnnouncementsPage />} />
              <Route path="organizations" element={<AdminOrganizationsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="payroll" element={<AdminPayrollPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['client', 'client_admin', 'client_user']} />}>
            <Route path="/client" element={<ClientPortal />}>
              <Route index element={<ClientOverviewPage />} />
              <Route path="locations" element={<ClientLocationsPage />} />
              <Route path="staff" element={<ClientStaffPage />} />
              <Route path="attendance" element={<ClientAttendancePage />} />
              <Route path="inspections" element={<ClientInspectionsPage />} />
              <Route path="complaints" element={<ClientComplaintsPage />} />
              <Route path="security" element={<ClientSecurityPage />} />
              <Route path="reports" element={<ClientReportsPage />} />
              <Route path="contracts" element={<ClientContractsPage />} />
              <Route path="invoices" element={<ClientInvoicesPage />} />
              <Route path="payments" element={<ClientPaymentsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['supervisor']} />}>
            <Route path="/supervisor" element={<SupervisorPortal />}>
              <Route index element={<SupervisorDashboardPage />} />
              <Route path="sites" element={<SupervisorSitesPage />} />
              <Route path="attendance" element={<SupervisorAttendancePage />} />
              <Route path="tasks" element={<SupervisorTasksPage />} />
              <Route path="inspections" element={<SupervisorInspectionsPage />} />
              <Route path="issues" element={<SupervisorIssuesPage />} />
              <Route path="security" element={<SupervisorSecurityPage />} />
              <Route path="inventory" element={<SupervisorInventoryPage />} />
              <Route path="leave" element={<SupervisorLeavePage />} />
              <Route path="handover" element={<SupervisorHandoverPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={WORKER_ROLES} />}>
            <Route path="/worker" element={<WorkerPortal />}>
              <Route index element={<WorkerCheckInPage />} />
              <Route path="tasks" element={<WorkerTasksPage />} />
              <Route path="leave" element={<WorkerLeavePage />} />
              <Route path="attendance" element={<WorkerAttendanceHistoryPage />} />
              <Route path="announcements" element={<WorkerAnnouncementsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={SECURITY_ROLES} />}>
            <Route path="/security" element={<SecurityPortal />}>
              <Route index element={<WorkerCheckInPage variant="security" />} />
              <Route path="patrols" element={<SecurityPatrolsPage />} />
              <Route path="incidents" element={<SecurityIncidentsPage />} />
              <Route path="visitors" element={<SecurityVisitorsPage />} />
              <Route path="attendance" element={<WorkerAttendanceHistoryPage />} />
            </Route>
          </Route>

          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
