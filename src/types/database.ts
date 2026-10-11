export const USER_ROLES = [
  'super_admin',
  'admin',
  'operations_manager',
  'supervisor',
  'worker',
  'security_guard',
  'client_admin',
  'client_user',
  'client',
] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ORG_STATUSES = ['active', 'inactive'] as const
export type OrgStatus = (typeof ORG_STATUSES)[number]

export const SITE_TYPES = [
  'corporate',
  'residential',
  'hospital',
  'hotel',
  'retail',
  'school',
  'factory',
  'warehouse',
  'commercial',
] as const
export type SiteType = (typeof SITE_TYPES)[number]

export const DESIGNATIONS = ['worker', 'supervisor', 'security_guard'] as const
export type Designation = (typeof DESIGNATIONS)[number]

export const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'] as const
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

export const DIRECTORY_STATUSES = ['active', 'inactive'] as const
export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number]

export const DEPARTMENTS = [
  'Housekeeping',
  'Security',
  'Pantry',
  'Technical',
  'Horticulture',
  'Administration',
] as const

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const SHIFT_KINDS = ['morning', 'afternoon', 'evening', 'night', 'custom'] as const
export type ShiftKind = (typeof SHIFT_KINDS)[number]

export const SHIFT_STATUSES = ['active', 'inactive'] as const
export type ShiftStatus = (typeof SHIFT_STATUSES)[number]

export const ROSTER_STATUSES = ['active', 'inactive'] as const
export type RosterStatus = (typeof ROSTER_STATUSES)[number]

export const TASK_STATUSES = ['todo', 'in_progress', 'completed', 'overdue', 'pending'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_RECURRENCES = ['none', 'daily', 'weekly'] as const
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number]

export const COMPLAINT_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'client_confirmed',
  'closed',
] as const
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number]

export const COMPLAINT_CATEGORIES = [
  'cleanliness',
  'washroom',
  'pest',
  'waste',
  'safety',
  'staff',
  'general',
] as const
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]

export const INSPECTION_STATUSES = ['draft', 'submitted', 'reviewed'] as const
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number]

export const INSPECTION_ITEM_STATUSES = ['pending', 'pass', 'fail', 'needs_attention'] as const
export type InspectionItemStatus = (typeof INSPECTION_ITEM_STATUSES)[number]

export const INSPECTION_CATEGORIES = ['Cleanliness', 'Washroom', 'Floor', 'Pantry', 'Waste'] as const

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

export const BILLING_TYPES = ['per_sqft', 'per_head', 'fixed'] as const
export type BillingType = (typeof BILLING_TYPES)[number]

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const CONTRACT_STATUSES = ['active', 'pending', 'expired'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export const INVENTORY_CATEGORIES = ['chemical', 'gloves', 'mop', 'bags', 'tissue', 'ppe', 'equipment'] as const
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]

export const INVENTORY_TX_KINDS = ['in', 'out', 'adjust'] as const
export type InventoryTxKind = (typeof INVENTORY_TX_KINDS)[number]

export const ASSET_CONDITIONS = ['good', 'fair', 'needs_repair', 'retired'] as const
export type AssetCondition = (typeof ASSET_CONDITIONS)[number]

export const PATROL_STATUSES = ['scheduled', 'in_progress', 'completed', 'missed'] as const
export type PatrolStatus = (typeof PATROL_STATUSES)[number]

export const PATROL_CHECK_STATUSES = ['pending', 'verified', 'skipped', 'missed'] as const
export type PatrolCheckStatus = (typeof PATROL_CHECK_STATUSES)[number]

export const INCIDENT_TYPES = [
  'trespass',
  'theft',
  'fire',
  'medical',
  'vandalism',
  'disturbance',
  'other',
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]

export const INCIDENT_STATUSES = ['open', 'investigating', 'resolved', 'closed'] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const VISITOR_STATUSES = ['on_site', 'exited'] as const
export type VisitorStatus = (typeof VISITOR_STATUSES)[number]

export type ChecklistItem = {
  id: string
  label: string
  done: boolean
}

export type DocumentItem = {
  name: string
  url: string
}

export type Organization = {
  id: string
  name: string
  logo_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  tagline: string | null
  status: OrgStatus
  created_at: string
  updated_at: string
}

export type OrganizationSettings = {
  organization_id: string
  timezone: string
  currency: string
  default_geofence_meters: number
  updated_at: string
}

export type AuditLog = {
  id: string
  organization_id: string | null
  profile_id: string | null
  action: string
  module: string | null
  record_table: string | null
  record_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export const ACCESS_STATUSES = ['pending', 'active', 'rejected'] as const
export type AccessStatus = (typeof ACCESS_STATUSES)[number]

export const SIGNUP_ROLES = ['worker', 'supervisor', 'security_guard', 'client'] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]

export type Profile = {
  id: string
  full_name: string
  role: UserRole
  phone: string | null
  photo_url: string | null
  email: string | null
  organization_id: string | null
  access_status?: AccessStatus | null
  requested_role: UserRole | null
  reviewed_at: string | null
  reviewed_by: string | null
  access_note: string | null
  created_at: string
  organizations?: Organization | null
}

export type Company = {
  id: string
  name: string
  created_at: string
}

export type Client = {
  id: string
  company_id: string | null
  profile_id: string | null
  business_name: string
  contact_email: string | null
  contact_phone: string | null
  contact_person: string | null
  address: string | null
  gst_number: string | null
  status: DirectoryStatus
  organization_id: string | null
  created_at: string
}

export type Site = {
  id: string
  client_id: string | null
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  site_type: SiteType | null
  area_sqft: number | null
  services: string[]
  city: string | null
  shift_timings: string | null
  geofence_radius: number | null
  supervisor_id: string | null
  status: DirectoryStatus
  organization_id: string | null
  created_at: string
}

export type Employee = {
  id: string
  profile_id: string | null
  site_id: string | null
  employee_code: string | null
  designation: Designation | null
  job_title: string | null
  department: string | null
  emergency_contact: string | null
  supervisor_id: string | null
  employment_status: EmploymentStatus
  joining_date: string | null
  documents: DocumentItem[]
  organization_id: string | null
  created_at: string
}

export type Shift = {
  id: string
  organization_id: string | null
  site_id: string | null
  name: string
  kind: ShiftKind
  start_time: string
  end_time: string
  grace_minutes: number
  status: ShiftStatus
  created_at: string
}

export type Roster = {
  id: string
  organization_id: string | null
  employee_id: string
  shift_id: string
  site_id: string | null
  weekday: number | null
  effective_from: string | null
  effective_to: string | null
  status: RosterStatus
  created_at: string
}

export type Attendance = {
  id: string
  employee_id: string | null
  site_id: string | null
  shift_id: string | null
  check_in_time: string | null
  check_out_time: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_out_lat: number | null
  check_out_lng: number | null
  location_verified: boolean | null
  status: AttendanceStatus | null
  organization_id: string | null
  created_at: string
}

export type ChecklistTemplate = {
  id: string
  organization_id: string | null
  name: string
  site_type: SiteType | null
  site_id: string | null
  status: DirectoryStatus
  created_at: string
}

export type ChecklistTemplateItem = {
  id: string
  template_id: string
  organization_id: string | null
  label: string
  sort_order: number
}

export type Task = {
  id: string
  site_id: string | null
  assigned_to: string | null
  title: string | null
  description: string | null
  checklist: ChecklistItem[]
  due_date: string | null
  status: TaskStatus
  priority: TaskPriority | null
  created_by: string | null
  recurrence: TaskRecurrence | null
  checklist_template_id: string | null
  organization_id: string | null
  created_at: string
}

export type InspectionReport = {
  id: string
  site_id: string | null
  supervisor_id: string | null
  photo_url: string | null
  ai_score: number | null
  ai_feedback: InspectionFeedback | null
  notes: string | null
  status: InspectionStatus
  overall_score: number | null
  category: string | null
  organization_id: string | null
  created_at: string
}

export type InspectionItem = {
  id: string
  inspection_id: string
  organization_id: string | null
  category: string
  score: number | null
  remarks: string | null
  status: InspectionItemStatus
  sort_order: number
  created_at: string
}

export type InspectionPhoto = {
  id: string
  inspection_id: string
  inspection_item_id: string | null
  organization_id: string | null
  photo_url: string
  storage_path: string | null
  caption: string | null
  created_at: string
}

export type InspectionFeedback = {
  floor_cleanliness: 'pass' | 'fail'
  dust_detected: boolean
  bin_status: 'ok' | 'needs_attention'
  supplies_status: 'ok' | 'low'
  overall_score: number
  issues?: string[]
  recommended_actions?: string[]
  provider?: string
  model?: string | null
  ai_generated?: boolean
}

export type Complaint = {
  id: string
  client_id: string | null
  site_id: string | null
  title: string | null
  description: string | null
  category: string | null
  priority: TaskPriority | null
  assigned_to: string | null
  created_by: string | null
  photos: DocumentItem[]
  status: ComplaintStatus
  raised_at: string
  resolved_at: string | null
  organization_id: string | null
}

export type ComplaintComment = {
  id: string
  complaint_id: string
  organization_id: string | null
  profile_id: string | null
  body: string
  created_at: string
}

export type LeaveRequest = {
  id: string
  employee_id: string | null
  from_date: string | null
  to_date: string | null
  reason: string | null
  status: LeaveStatus
  created_at: string
}

export type Contract = {
  id: string
  client_id: string | null
  site_id: string | null
  start_date: string | null
  end_date: string | null
  sla_terms: string | null
  billing_type: BillingType | null
  rate: number | null
  monthly_value: number | null
  services: string[] | null
  manpower: number | null
  renewal_date: string | null
  status: ContractStatus | null
  created_at: string
}

export type SecurityCheckpoint = {
  id: string
  organization_id: string | null
  site_id: string
  name: string
  location_hint: string | null
  sort_order: number
  status: DirectoryStatus
  created_at: string
}

export type SecurityPatrol = {
  id: string
  organization_id: string | null
  site_id: string
  guard_id: string | null
  status: PatrolStatus
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
}

export type SecurityPatrolCheck = {
  id: string
  organization_id: string | null
  patrol_id: string
  checkpoint_id: string
  checked_at: string | null
  status: PatrolCheckStatus
  latitude: number | null
  longitude: number | null
  notes: string | null
  created_at: string
}

export type SecurityIncident = {
  id: string
  organization_id: string | null
  site_id: string
  guard_id: string | null
  incident_type: IncidentType
  description: string | null
  photo_url: string | null
  photos: string[]
  severity: IncidentSeverity
  status: IncidentStatus
  created_at: string
}

export type Visitor = {
  id: string
  organization_id: string | null
  site_id: string
  visitor_name: string
  phone: string | null
  purpose: string | null
  host: string | null
  vehicle_number: string | null
  entry_time: string
  exit_time: string | null
  logged_by: string | null
  status: VisitorStatus
  created_at: string
}

export type MonthlyReport = {
  id: string
  organization_id: string | null
  client_id: string
  site_id: string | null
  period_start: string
  period_end: string
  workers_deployed: number
  attendance_present: number
  attendance_expected: number
  attendance_pct: number | null
  tasks_completed: number
  tasks_pending: number
  complaints_total: number
  complaints_resolved: number
  avg_inspection_score: number | null
  sla_compliance_pct: number | null
  photo_urls: string[]
  generated_at: string
  created_at: string
}

export type Invoice = {
  id: string
  client_id: string | null
  contract_id: string | null
  site_id: string | null
  period: string | null
  invoice_number: string | null
  amount: number | null
  tax: number | null
  discount: number | null
  total: number | null
  due_date: string | null
  status: InvoiceStatus
  created_at: string
}

export type InventoryItem = {
  id: string
  organization_id: string | null
  site_id: string
  name: string
  category: InventoryCategory
  quantity: number
  minimum_quantity: number
  unit: string
  status: DirectoryStatus
  created_at: string
}

export type InventoryTransaction = {
  id: string
  organization_id: string | null
  item_id: string
  site_id: string | null
  kind: InventoryTxKind
  quantity: number
  note: string | null
  created_by: string | null
  created_at: string
}

export type Asset = {
  id: string
  organization_id: string | null
  site_id: string
  asset_code: string | null
  name: string
  serial_number: string | null
  purchase_date: string | null
  warranty_end: string | null
  last_service: string | null
  next_service: string | null
  condition: AssetCondition
  status: DirectoryStatus
  notes: string | null
  created_at: string
}

export type AssetMaintenance = {
  id: string
  organization_id: string | null
  asset_id: string
  service_date: string
  next_service: string | null
  cost: number | null
  notes: string | null
  created_at: string
}

export type Announcement = {
  id: string
  title: string | null
  body: string | null
  target_role: string | null
  created_at: string
}

export type Notification = {
  id: string
  profile_id: string | null
  message: string | null
  is_read: boolean | null
  created_at: string
}

export type ClientWithCompany = Client & {
  companies: Company | null
}

export type EmployeeWithRelations = Employee & {
  profiles: Profile | null
  sites: Site | null
}

export type ShiftWithRelations = Shift & {
  sites: Site | null
}

export type RosterWithRelations = Roster & {
  employees: (Employee & { profiles: Profile | null }) | null
  shifts: Shift | null
  sites: Site | null
}

export type AttendanceWithRelations = Attendance & {
  employees: (Employee & { profiles: Profile | null }) | null
  sites: Site | null
  shifts: Shift | null
}

export type ChecklistTemplateWithRelations = ChecklistTemplate & {
  sites: Site | null
  checklist_template_items: ChecklistTemplateItem[]
}

export type TaskWithRelations = Task & {
  sites: Site | null
  employees: (Employee & { profiles: Profile | null }) | null
}

export type InspectionWithRelations = InspectionReport & {
  sites: Site | null
  employees: (Employee & { profiles: Profile | null }) | null
  inspection_items?: InspectionItem[]
  inspection_photos?: InspectionPhoto[]
}

export type ComplaintCommentWithProfile = ComplaintComment & {
  profiles: Profile | null
}

export type ComplaintWithRelations = Complaint & {
  clients: Client | null
  sites: Site | null
  employees?: (Employee & { profiles: Profile | null }) | null
  complaint_comments?: ComplaintCommentWithProfile[]
}

export type MonthlyReportWithRelations = MonthlyReport & {
  clients: Client | null
  sites: Site | null
}

export type SecurityCheckpointWithSite = SecurityCheckpoint & {
  sites: Site | null
}

export type SecurityPatrolCheckWithCheckpoint = SecurityPatrolCheck & {
  security_checkpoints: SecurityCheckpoint | null
}

export type SecurityPatrolWithRelations = SecurityPatrol & {
  sites: Site | null
  employees: (Employee & { profiles: Profile | null }) | null
  security_patrol_checks?: SecurityPatrolCheckWithCheckpoint[]
}

export type SecurityIncidentWithRelations = SecurityIncident & {
  sites: Site | null
  employees?: (Employee & { profiles: Profile | null }) | null
}

export type VisitorWithRelations = Visitor & {
  sites: Site | null
}

export type InventoryItemWithSite = InventoryItem & {
  sites: Site | null
}

export type AssetWithRelations = Asset & {
  sites: Site | null
  asset_maintenance?: AssetMaintenance[]
}

type Fk = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Partial<Organization> & Pick<Organization, 'name'>
        Update: Partial<Organization>
        Relationships: []
      }
      organization_settings: {
        Row: OrganizationSettings
        Insert: Partial<OrganizationSettings> & Pick<OrganizationSettings, 'organization_id'>
        Update: Partial<OrganizationSettings>
        Relationships: [Fk & { referencedRelation: 'organizations' }]
      }
      audit_logs: {
        Row: AuditLog
        Insert: Partial<AuditLog> & Pick<AuditLog, 'action'>
        Update: Partial<AuditLog>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & Pick<Profile, 'id' | 'full_name' | 'role'>
        Update: Partial<Profile>
        Relationships: [Fk & { referencedRelation: 'organizations' }]
      }
      companies: {
        Row: Company
        Insert: Partial<Company> & Pick<Company, 'name'>
        Update: Partial<Company>
        Relationships: []
      }
      clients: {
        Row: Client
        Insert: Partial<Client> & Pick<Client, 'business_name'>
        Update: Partial<Client>
        Relationships: [
          Fk & { referencedRelation: 'companies' },
          Fk & { referencedRelation: 'profiles' },
          Fk & { referencedRelation: 'organizations' },
        ]
      }
      sites: {
        Row: Site
        Insert: Partial<Site> & Pick<Site, 'name'>
        Update: Partial<Site>
        Relationships: [
          {
            foreignKeyName: 'sites_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sites_supervisor_id_fkey'
            columns: ['supervisor_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sites_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      employees: {
        Row: Employee
        Insert: Partial<Employee>
        Update: Partial<Employee>
        Relationships: [
          {
            foreignKeyName: 'employees_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'employees_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'employees_supervisor_id_fkey'
            columns: ['supervisor_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'employees_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      shifts: {
        Row: Shift
        Insert: Partial<Shift> & Pick<Shift, 'name' | 'start_time' | 'end_time'>
        Update: Partial<Shift>
        Relationships: [Fk & { referencedRelation: 'organizations' }, Fk & { referencedRelation: 'sites' }]
      }
      rosters: {
        Row: Roster
        Insert: Partial<Roster> & Pick<Roster, 'employee_id' | 'shift_id'>
        Update: Partial<Roster>
        Relationships: [
          Fk & { referencedRelation: 'organizations' },
          Fk & { referencedRelation: 'employees' },
          Fk & { referencedRelation: 'shifts' },
          Fk & { referencedRelation: 'sites' },
        ]
      }
      attendance: {
        Row: Attendance
        Insert: Partial<Attendance>
        Update: Partial<Attendance>
        Relationships: [
          Fk & { referencedRelation: 'employees' },
          Fk & { referencedRelation: 'sites' },
          Fk & { referencedRelation: 'shifts' },
          Fk & { referencedRelation: 'organizations' },
        ]
      }
      checklist_templates: {
        Row: ChecklistTemplate
        Insert: Partial<ChecklistTemplate> & Pick<ChecklistTemplate, 'name'>
        Update: Partial<ChecklistTemplate>
        Relationships: [
          Fk & { referencedRelation: 'organizations' },
          Fk & { referencedRelation: 'sites' },
          Fk & { referencedRelation: 'checklist_template_items' },
        ]
      }
      checklist_template_items: {
        Row: ChecklistTemplateItem
        Insert: Partial<ChecklistTemplateItem> & Pick<ChecklistTemplateItem, 'template_id' | 'label'>
        Update: Partial<ChecklistTemplateItem>
        Relationships: [
          Fk & { referencedRelation: 'checklist_templates' },
          Fk & { referencedRelation: 'organizations' },
        ]
      }
      tasks: {
        Row: Task
        Insert: Partial<Task>
        Update: Partial<Task>
        Relationships: [
          Fk & { referencedRelation: 'sites' },
          Fk & { referencedRelation: 'employees' },
          Fk & { referencedRelation: 'profiles' },
          Fk & { referencedRelation: 'checklist_templates' },
          Fk & { referencedRelation: 'organizations' },
        ]
      }
      inspection_reports: {
        Row: InspectionReport
        Insert: Partial<InspectionReport>
        Update: Partial<InspectionReport>
        Relationships: [
          Fk & { referencedRelation: 'sites' },
          Fk & { referencedRelation: 'employees' },
          Fk & { referencedRelation: 'inspection_items' },
          Fk & { referencedRelation: 'inspection_photos' },
        ]
      }
      inspection_items: {
        Row: InspectionItem
        Insert: Partial<InspectionItem> & Pick<InspectionItem, 'inspection_id' | 'category'>
        Update: Partial<InspectionItem>
        Relationships: [Fk & { referencedRelation: 'inspection_reports' }]
      }
      inspection_photos: {
        Row: InspectionPhoto
        Insert: Partial<InspectionPhoto> & Pick<InspectionPhoto, 'inspection_id' | 'photo_url'>
        Update: Partial<InspectionPhoto>
        Relationships: [Fk & { referencedRelation: 'inspection_reports' }, Fk & { referencedRelation: 'inspection_items' }]
      }
      complaints: {
        Row: Complaint
        Insert: Partial<Complaint>
        Update: Partial<Complaint>
        Relationships: [
          Fk & { referencedRelation: 'clients' },
          Fk & { referencedRelation: 'sites' },
          Fk & { referencedRelation: 'employees' },
          Fk & { referencedRelation: 'profiles' },
          Fk & { referencedRelation: 'complaint_comments' },
        ]
      }
      complaint_comments: {
        Row: ComplaintComment
        Insert: Partial<ComplaintComment> & Pick<ComplaintComment, 'complaint_id' | 'body'>
        Update: Partial<ComplaintComment>
        Relationships: [Fk & { referencedRelation: 'complaints' }, Fk & { referencedRelation: 'profiles' }]
      }
      leave_requests: {
        Row: LeaveRequest
        Insert: Partial<LeaveRequest>
        Update: Partial<LeaveRequest>
        Relationships: [Fk & { referencedRelation: 'employees' }]
      }
      contracts: {
        Row: Contract
        Insert: Partial<Contract>
        Update: Partial<Contract>
        Relationships: [Fk & { referencedRelation: 'clients' }]
      }
      invoices: {
        Row: Invoice
        Insert: Partial<Invoice>
        Update: Partial<Invoice>
        Relationships: [Fk & { referencedRelation: 'clients' }, Fk & { referencedRelation: 'contracts' }]
      }
      monthly_reports: {
        Row: MonthlyReport
        Insert: Partial<MonthlyReport> & Pick<MonthlyReport, 'client_id' | 'period_start' | 'period_end'>
        Update: Partial<MonthlyReport>
        Relationships: [Fk & { referencedRelation: 'clients' }, Fk & { referencedRelation: 'sites' }, Fk & { referencedRelation: 'organizations' }]
      }
      security_checkpoints: {
        Row: SecurityCheckpoint
        Insert: Partial<SecurityCheckpoint> & Pick<SecurityCheckpoint, 'site_id' | 'name'>
        Update: Partial<SecurityCheckpoint>
        Relationships: [Fk & { referencedRelation: 'sites' }, Fk & { referencedRelation: 'organizations' }]
      }
      security_patrols: {
        Row: SecurityPatrol
        Insert: Partial<SecurityPatrol> & Pick<SecurityPatrol, 'site_id'>
        Update: Partial<SecurityPatrol>
        Relationships: [
          Fk & { referencedRelation: 'sites' },
          Fk & { referencedRelation: 'employees' },
          Fk & { referencedRelation: 'security_patrol_checks' },
          Fk & { referencedRelation: 'organizations' },
        ]
      }
      security_patrol_checks: {
        Row: SecurityPatrolCheck
        Insert: Partial<SecurityPatrolCheck> & Pick<SecurityPatrolCheck, 'patrol_id' | 'checkpoint_id'>
        Update: Partial<SecurityPatrolCheck>
        Relationships: [Fk & { referencedRelation: 'security_patrols' }, Fk & { referencedRelation: 'security_checkpoints' }]
      }
      security_incidents: {
        Row: SecurityIncident
        Insert: Partial<SecurityIncident> & Pick<SecurityIncident, 'site_id'>
        Update: Partial<SecurityIncident>
        Relationships: [Fk & { referencedRelation: 'sites' }, Fk & { referencedRelation: 'employees' }]
      }
      visitors: {
        Row: Visitor
        Insert: Partial<Visitor> & Pick<Visitor, 'site_id' | 'visitor_name'>
        Update: Partial<Visitor>
        Relationships: [Fk & { referencedRelation: 'sites' }, Fk & { referencedRelation: 'employees' }]
      }
      inventory_items: {
        Row: InventoryItem
        Insert: Partial<InventoryItem> & Pick<InventoryItem, 'site_id' | 'name'>
        Update: Partial<InventoryItem>
        Relationships: [Fk & { referencedRelation: 'sites' }, Fk & { referencedRelation: 'organizations' }]
      }
      inventory_transactions: {
        Row: InventoryTransaction
        Insert: Partial<InventoryTransaction> & Pick<InventoryTransaction, 'item_id' | 'kind' | 'quantity'>
        Update: Partial<InventoryTransaction>
        Relationships: [Fk & { referencedRelation: 'inventory_items' }, Fk & { referencedRelation: 'sites' }]
      }
      assets: {
        Row: Asset
        Insert: Partial<Asset> & Pick<Asset, 'site_id' | 'name'>
        Update: Partial<Asset>
        Relationships: [Fk & { referencedRelation: 'sites' }, Fk & { referencedRelation: 'asset_maintenance' }]
      }
      asset_maintenance: {
        Row: AssetMaintenance
        Insert: Partial<AssetMaintenance> & Pick<AssetMaintenance, 'asset_id' | 'service_date'>
        Update: Partial<AssetMaintenance>
        Relationships: [Fk & { referencedRelation: 'assets' }]
      }
      announcements: {
        Row: Announcement
        Insert: Partial<Announcement>
        Update: Partial<Announcement>
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: Partial<Notification>
        Update: Partial<Notification>
        Relationships: [Fk & { referencedRelation: 'profiles' }]
      }
    }
    Views: Record<string, never>
    Functions: {
      spawn_recurring_task: {
        Args: { p_task_id: string }
        Returns: string | null
      }
      review_access_request: {
        Args: {
          p_profile_id: string
          p_decision: string
          p_role?: string | null
          p_site_id?: string | null
          p_note?: string | null
        }
        Returns: Profile
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
