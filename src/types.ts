export type UserRole =
  | 'super_admin'
  | 'hr'
  | 'principal'
  | 'teacher'
  | 'department_supervisor'
  | 'staff'
  | 'pending';

export type ModuleKey =
  | 'ess'
  | 'erp'
  | 'qadri_40'
  | 'darul_ifta'
  | 'darul_qaza'
  | 'darul_iqama'
  | 'madrasas'
  | 'online_admission'
  | 'tahreek_bedari'
  | 'e_raseed'
  | 'hr_payroll'
  | 'digital_library'
  | 'online_courses'
  | 'notice_board'
  | 'projects_existing'
  | 'upcoming_project'
  | 'reports_analytics'
  | 'hr_control_panel'
  | 'teacher_management'
  | 'super_admin_panel'
  | 'home';

export interface ModuleDefinition {
  order: number;
  key: ModuleKey;
  label: string;
  description: string;
  category: 'Core' | 'Department' | 'Finance' | 'Operations' | 'Intelligence';
}

// Exact 1-17 order required by Markazi CMO specification
export const CMO_MODULES: ModuleDefinition[] = [
  { order: 1, key: 'ess', label: 'ESS', description: 'Employee Self Service', category: 'Core' },
  { order: 2, key: 'erp', label: 'ERP', description: 'Enterprise Finance & Accounts', category: 'Finance' },
  { order: 3, key: 'qadri_40', label: 'QADRI 40', description: 'Course, Batch & Student Attendance', category: 'Department' },
  { order: 4, key: 'madrasas', label: 'Madrasas', description: 'Division, Branch & Class Operations', category: 'Department' },
  { order: 5, key: 'online_admission', label: 'Online Admission', description: '3-Stage Admission Verification', category: 'Operations' },
  { order: 6, key: 'e_raseed', label: 'E-Raseed', description: 'Receipts, Donations & Deposits', category: 'Finance' },
  { order: 7, key: 'hr_payroll', label: 'HR & Payroll', description: 'Employees, Attendance & Salaries', category: 'Core' },
  { order: 8, key: 'notice_board', label: 'Notice Board', description: 'Central & Branch Announcements', category: 'Operations' },
  { order: 9, key: 'reports_analytics', label: 'Reports & Analytics', description: 'Consolidated Institutional Reports', category: 'Intelligence' },
];

export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: UserRole;
  branchId?: string;
  departmentId?: string;
  employeeId?: string;
  status: 'active' | 'pending' | 'suspended';
  permissions?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Division {
  id: string;
  name: string;
  code: string;
  headName?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  divisionId?: string;
  institutionName: string;
  city: string;
  address?: string;
  phone?: string;
  principalUid?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  type: 'madrasas' | 'qadri40' | 'darul_ifta' | 'darul_qaza' | 'darul_iqama' | 'tahreek_bedari' | 'other';
  branchId?: string;
  headUid?: string;
  supervisorUid?: string;
  status: 'active' | 'inactive';
  permissions?: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademicSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademicClass {
  id: string;
  programType: 'madrasa' | 'qadri40';
  divisionId?: string;
  branchId: string;
  courseName?: string;
  batchName?: string;
  className: string;
  sectionName?: string;
  sessionId: string;
  teacherUid?: string;
  supervisorUid?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TimetableEntry {
  id: string;
  classId: string;
  branchId: string;
  teacherUid?: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string;
  endTime: string;
  subject: string;
  room?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EmployeeModuleAccess {
  ess: boolean;
  erp: boolean;
  e_raseed: boolean;
  teacher_management?: boolean;
  madrasas?: boolean;
  qadri_40?: boolean;
  online_admission?: boolean;
  notice_board?: boolean;
  reports_analytics?: boolean;
}

export interface Employee {
  id: string;
  employeeCode: string;
  uid?: string;
  fullName: string;
  email: string;
  phone?: string;
  cnic?: string;
  designation: string;
  departmentId: string;
  branchId: string;
  joiningDate: string;
  employmentStatus: 'active' | 'probation' | 'on_leave' | 'resigned' | 'terminated';
  onboardingStatus: 'recruitment' | 'onboarding' | 'completed';
  basicSalary: number;
  allowances?: number;
  deductions?: number;
  photoUrl?: string;
  documents?: string[];
  achievements?: string[];
  staffRole?: 'employee' | 'teacher' | 'principal' | 'hr' | 'super_admin' | 'staff' | 'department_supervisor';
  loginId?: string;
  passwordHash?: string;
  passwordProtected?: boolean;
  moduleAccess?: EmployeeModuleAccess;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceTiming {
  id: string;
  scopeType: 'global' | 'branch' | 'department' | 'employee';
  scopeId: string;
  scopeLabel?: string;
  startTime: string;
  lateTime: string;
  closingTime: string;
  graceMinutes: number;
  isLocked: boolean;
  reopenedUntil?: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EmployeeAttendance {
  id: string;
  employeeId: string;
  uid: string;
  employeeName: string;
  branchId: string;
  departmentId: string;
  date: string;
  monthKey: string;
  markedTime: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave' | 'Half Day';
  approvalStatus: 'pending_principal' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  isLocked: boolean;
  reopenedByAdmin?: boolean;
  correctionRequested?: boolean;
  correctionReason?: string;
  correctionStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  uid: string;
  employeeName: string;
  branchId?: string;
  departmentId?: string;
  leaveType: 'Casual' | 'Sick' | 'Earned' | 'Emergency' | 'Unpaid';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId?: string;
  departmentId?: string;
  monthKey: string;
  basicSalary: number;
  allowances?: number;
  deductions?: number;
  approvedDays: number;
  lateDays?: number;
  halfDays?: number;
  absentDays?: number;
  netPayable: number;
  status: 'draft' | 'processed' | 'paid';
  generatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  uid: string;
  employeeName: string;
  claimType: 'Medical' | 'Travel' | 'Other';
  amount: number;
  description: string;
  claimDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Admission {
  id: string;
  applicationNo: string;
  studentName: string;
  fatherName: string;
  guardianPhone: string;
  cnicOrBForm?: string;
  programType: 'madrasa' | 'qadri40' | 'online_course';
  departmentId?: string;
  branchId: string;
  divisionId?: string;
  classId?: string;
  sessionId: string;
  photoUrl?: string;
  notes?: string;
  workflowStatus: 'pending_teacher' | 'teacher_verified' | 'hr_verified' | 'active' | 'rejected';
  teacherVerifiedBy?: string;
  teacherVerifiedAt?: string;
  hrVerifiedBy?: string;
  hrVerifiedAt?: string;
  superAdminApprovedBy?: string;
  superAdminApprovedAt?: string;
  rejectionReason?: string;
  submittedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Student {
  id: string;
  admissionId: string;
  rollNo: string;
  studentName: string;
  fatherName: string;
  guardianPhone?: string;
  programType: 'madrasa' | 'qadri40' | 'online_course';
  divisionId?: string;
  branchId: string;
  departmentId?: string;
  classId: string;
  courseName?: string;
  batchName?: string;
  className?: string;
  sectionName?: string;
  sessionId: string;
  photoUrl?: string;
  status: 'active' | 'inactive' | 'graduated';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentAttendance {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  programType: 'madrasa' | 'qadri40';
  branchId: string;
  divisionId?: string;
  classId: string;
  sessionId: string;
  date: string;
  monthKey: string;
  status: 'Present' | 'Absent' | 'Leave' | 'Sick';
  markedBy: string;
  markedByName?: string;
  approvalStatus: 'pending_supervisor' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademicRecord {
  id: string;
  recordType: 'homework' | 'exam' | 'mark' | 'progress';
  programType?: string;
  branchId: string;
  departmentId?: string;
  classId?: string;
  studentId?: string;
  studentName?: string;
  title: string;
  subject: string;
  dueDate?: string;
  maxMarks?: number;
  obtainedMarks?: number;
  grade?: string;
  remarks?: string;
  teacherUid: string;
  teacherName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DepartmentCaseModule =
  | 'darul_ifta'
  | 'darul_qaza'
  | 'darul_iqama'
  | 'tahreek_bedari'
  | 'digital_library'
  | 'online_courses'
  | 'project_existing'
  | 'project_upcoming';

export interface DepartmentCase {
  id: string;
  moduleType: DepartmentCaseModule;
  referenceCode: string;
  title: string;
  category: string;
  branchId?: string;
  departmentId?: string;
  assignedUid?: string;
  personName?: string;
  details?: string;
  status: string;
  targetDate?: string;
  budgetAmount?: number;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ERaseedReceipt {
  id: string;
  receiptNo: string;
  receiptType: 'Receipt' | 'Donation' | 'Deposit';
  institutionName: string;
  branchId: string;
  donorName: string;
  donorPhone?: string;
  niyyat: string;
  category?: string;
  paymentMode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online';
  amount: number;
  receiptDate: string;
  monthKey: string;
  status: 'active' | 'refunded' | 'cancelled';
  refundReason?: string;
  issuedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FinanceEntry {
  id: string;
  entryType: 'account' | 'income' | 'expense' | 'budget' | 'fee' | 'asset';
  institutionName: string;
  branchId: string;
  departmentId?: string;
  title: string;
  accountCode?: string;
  category: string;
  amount: number;
  fiscalMonth: string;
  entryDate: string;
  status: 'posted' | 'pending' | 'cancelled';
  notes?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: 'All Staff' | 'Teachers' | 'HR & Principals' | 'Department Specific';
  branchId?: string;
  departmentId?: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  publishedBy: string;
  publishedByName?: string;
  status: 'published' | 'archived';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  details: string;
  createdAt?: unknown;
}

export interface SystemConfig {
  id: string;
  configType: 'master' | 'eraseed' | 'backup';
  institutionName?: string;
  receiptPrefix?: string;
  defaultCurrency?: string;
  academicYear?: string;
  lastBackupAt?: string;
  adminPinHash?: string;
  updatedBy: string;
  updatedAt?: unknown;
}

export function formatCounter(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return String(safe).padStart(2, '0');
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${safe.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
