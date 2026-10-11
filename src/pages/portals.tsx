import {
  Bell,
  Building2,
  CalendarCheck,
  CalendarOff,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Receipt,
  Shield,
  ShieldAlert,
  UserPlus,
  Users,
  Wallet,
  Package,
  Wrench,
  Camera,
  Clock3,
  CircleAlert,
  LogIn,
  Settings,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { canManageOrganizations } from '../lib/permissions'
import { DesktopSidebarLayout, type NavItem } from '../components/layout/DesktopSidebarLayout'
import { MobilePortalLayout } from '../components/layout/MobilePortalLayout'
import { AutoAttendanceProvider } from '../contexts/AutoAttendanceContext'

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/clients', label: 'Clients', icon: Building2 },
  { to: '/admin/sites', label: 'Sites', icon: MapPin },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/access', label: 'Access requests', icon: UserPlus },
  { to: '/admin/shifts', label: 'Shifts', icon: Clock3 },
  { to: '/admin/roster', label: 'Roster', icon: CalendarRange },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/admin/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/admin/checklists', label: 'Checklists', icon: ClipboardCheck },
  { to: '/admin/inspections', label: 'Inspections', icon: Camera },
  { to: '/admin/leaves', label: 'Leave', icon: CalendarOff },
  { to: '/admin/complaints', label: 'Complaints', icon: ShieldAlert },
  { to: '/admin/security', label: 'Security', icon: Shield },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/assets', label: 'Assets', icon: Wrench },
  { to: '/admin/reports', label: 'Reports', icon: ClipboardList },
  { to: '/admin/contracts', label: 'Contracts', icon: FileText },
  { to: '/admin/revenue', label: 'Revenue', icon: Receipt },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/payroll', label: 'Payroll', icon: Wallet },
]

const clientNav: NavItem[] = [
  { to: '/client', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/client/locations', label: 'Locations', icon: MapPin },
  { to: '/client/staff', label: 'Staff', icon: Users },
  { to: '/client/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/client/inspections', label: 'Inspections', icon: ClipboardCheck },
  { to: '/client/complaints', label: 'Complaints', icon: ShieldAlert },
  { to: '/client/security', label: 'Security', icon: Shield },
  { to: '/client/reports', label: 'Reports', icon: ClipboardList },
  { to: '/client/contracts', label: 'Contracts', icon: FileText },
  { to: '/client/invoices', label: 'Invoices', icon: Receipt },
  { to: '/client/payments', label: 'Payments', icon: Wallet },
]

const supervisorNav: NavItem[] = [
  { to: '/supervisor', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/supervisor/attendance', label: 'Attend', icon: CalendarCheck },
  { to: '/supervisor/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/supervisor/inspections', label: 'Inspect', icon: Camera },
  { to: '/supervisor/issues', label: 'Issues', icon: CircleAlert },
  { to: '/supervisor/security', label: 'Security', icon: Shield },
  { to: '/supervisor/inventory', label: 'Stock', icon: Package },
]

const workerNav: NavItem[] = [
  { to: '/worker', label: 'Check-in', icon: LogIn, end: true },
  { to: '/worker/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/worker/leave', label: 'Leave', icon: Clock3 },
  { to: '/worker/attendance', label: 'History', icon: CalendarCheck },
  { to: '/worker/announcements', label: 'News', icon: Bell },
]

const securityNav: NavItem[] = [
  { to: '/security', label: 'Check-in', icon: LogIn, end: true },
  { to: '/security/patrols', label: 'Patrol', icon: Shield },
  { to: '/security/incidents', label: 'Incidents', icon: ShieldAlert },
  { to: '/security/visitors', label: 'Visitors', icon: Users },
  { to: '/security/attendance', label: 'History', icon: CalendarCheck },
]

export function AdminPortal() {
  const { role, organization } = useAuth()
  const items = adminNav.filter((item) => item.to !== '/admin/organizations' || canManageOrganizations(role))
  return <DesktopSidebarLayout items={items} eyebrow={organization?.name ?? 'Admin console'} />
}

export function ClientPortal() {
  const { organization } = useAuth()
  return <DesktopSidebarLayout items={clientNav} eyebrow={organization?.name ?? 'Client portal'} />
}

export function SupervisorPortal() {
  return <MobilePortalLayout items={supervisorNav} />
}

export function WorkerPortal() {
  return (
    <AutoAttendanceProvider>
      <MobilePortalLayout items={workerNav} />
    </AutoAttendanceProvider>
  )
}

export function SecurityPortal() {
  return (
    <AutoAttendanceProvider>
      <MobilePortalLayout items={securityNav} />
    </AutoAttendanceProvider>
  )
}
