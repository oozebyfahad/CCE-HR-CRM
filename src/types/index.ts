// ── Auth & User ───────────────────────────────────────────────────────
export type UserRole = 'admin' | 'hr' | 'team_lead' | 'employee'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  avatar?: string
}

// ── Employee ──────────────────────────────────────────────────────────
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'agency'
export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'resigned' | 'terminated'
export type ContractType  = 'permanent' | 'fixed_term' | 'zero_hours'
export type ProbationStatus = 'in_probation' | 'passed' | 'extended' | 'failed'
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

export interface KinContact {
  name: string
  relationship: string
  contact: string
  contactType: 'Mobile' | 'Landline'
}

export interface Employee {
  id: string
  employeeId: string
  name: string
  email: string
  phone: string
  department: string
  jobTitle: string
  project?: string
  employmentType: EmploymentType
  status: EmployeeStatus
  startDate: string
  salary: number
  manager: string
  avatar?: string
  dob?: string
  gender?: 'Male' | 'Female' | 'Other'
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed'
  religion?: string
  bloodGroup?: BloodGroup
  // Pakistan-specific
  cnicNumber?: string
  ntnNumber?: string
  eobi?: string
  bankAccountNo?: string
  // Address
  hometown?: string
  currentCity?: string
  temporaryAddress?: string
  permanentAddress?: string
  address?: string
  // Compliance
  characterCertExpiry?: string
  referredBy?: string
  motherName?: string
  // Kin
  kin?: KinContact[]
  emergencyContact?: EmergencyContact
  // Employment
  probationStatus?: ProbationStatus
  probationEndDate?: string
  contractType?: ContractType
  contractEndDate?: string
  niNumber?: string
  licenceNumber?: string
  pcoLicence?: string
  vehicleAssigned?: string
}

// ── Shift Management ──────────────────────────────────────────────────
export type ShiftName = 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Rotating'

export interface Shift {
  id: string
  name: ShiftName | string
  startTime: string
  endTime: string
  project: string
  days: string[]
  color?: string
}

export interface ShiftAssignment {
  id: string
  employeeId: string
  employeeName: string
  jobTitle: string
  shiftId: string
  shiftName: string
  project: string
  startDate: string
  endDate?: string
  isActive: boolean
}

// ── Compliance Documents ──────────────────────────────────────────────
export type ComplianceDocType =
  | 'character_certificate'
  | 'police_verification'
  | 'cnic'
  | 'ntn'
  | 'eobi'
  | 'education'
  | 'experience_letter'
  | 'medical'
  | 'offer_letter'
  | 'contract'

export type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing'

export interface ComplianceDocument {
  id: string
  employeeId: string
  employeeName: string
  department: string
  type: ComplianceDocType
  issueDate?: string
  expiryDate?: string
  status: ComplianceStatus
  documentUrl?: string
  notes?: string
}

// ── Attendance ────────────────────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'on_leave' | 'early_departure'

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  department: string
  date: string
  clockIn?: string
  clockOut?: string
  status: AttendanceStatus
  hoursWorked: number
  overtime: number
  notes?: string
}

// ── Leave ─────────────────────────────────────────────────────────────
export type LeaveType   = 'annual' | 'sick' | 'casual' | 'unpaid' | 'maternity' | 'paternity' | 'compassionate' | 'toil' | 'public_holiday'
export type LeaveStatus = 'pending' | 'approved' | 'declined' | 'cancelled'

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  department: string
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  status: LeaveStatus
  reason?: string
  approvedBy?: string
  approvedDate?: string
}

export interface LeaveBalance {
  employeeId: string
  annual: { total: number; used: number; remaining: number }
  sick:   { total: number; used: number; remaining: number }
  toil:   { total: number; used: number; remaining: number }
}

// ── Performance ───────────────────────────────────────────────────────
export type ReviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue'
export type GoalStatus   = 'not_started' | 'in_progress' | 'completed' | 'overdue'

export interface Goal {
  id: string
  title: string
  description: string
  dueDate: string
  progress: number
  status: GoalStatus
}

export interface PerformanceReview {
  id: string
  employeeId: string
  employeeName: string
  reviewPeriod: string
  reviewDate: string
  score: number
  status: ReviewStatus
  reviewerId: string
  reviewerName: string
  goals: Goal[]
  notes?: string
}

// ── Recruitment ───────────────────────────────────────────────────────
export type ApplicationStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

export interface JobVacancy {
  id: string
  title: string
  department: string
  type: EmploymentType
  salary: string
  postedDate: string
  closingDate: string
  applications: number
  stage: 'open' | 'closed' | 'draft'
}

export interface Applicant {
  id: string
  vacancyId: string
  name: string
  email: string
  phone: string
  appliedDate: string
  stage: ApplicationStage
  score?: number
  notes?: string
}

// ── Training ──────────────────────────────────────────────────────────
export type TrainingStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue'

export interface TrainingCourse {
  id: string
  title: string
  category: string
  mandatory: boolean
  duration: string
  provider: string
}

export interface TrainingEnrolment {
  id: string
  employeeId: string
  employeeName: string
  courseId: string
  courseTitle: string
  status: TrainingStatus
  enrolledDate: string
  completedDate?: string
  expiryDate?: string
  score?: number
}

// ── Disciplinary ──────────────────────────────────────────────────────
export type DisciplinaryType = 'verbal_warning' | 'written_warning' | 'final_warning' | 'suspension' | 'dismissal'

export interface DisciplinaryCase {
  id: string
  employeeId: string
  employeeName: string
  department: string
  type: DisciplinaryType
  date: string
  reason: string
  outcome?: string
  status: 'open' | 'resolved' | 'appealed'
  issuedBy: string
}

// ── Notifications ─────────────────────────────────────────────────────
export type NotificationType = 'info' | 'warning' | 'error' | 'success'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
}

// ── Dashboard KPI ─────────────────────────────────────────────────────
export interface KPIData {
  label: string
  value: string | number
  sub: string
  subColor?: string
  accentColor: string
}
