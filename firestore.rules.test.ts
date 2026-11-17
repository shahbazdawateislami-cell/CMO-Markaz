/**
 * Markazi CMO – Security Specification Payload Test Suite (Phase 0)
 * Documents the 12 adversarial payloads ("Dirty Dozen") verified against firestore.rules.
 */

export interface SecurityPayloadTestCase {
  id: string;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  actorRole: string;
  expectedResult: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
  invariantViolated: string;
}

export const DIRTY_DOZEN_PAYLOADS: SecurityPayloadTestCase[] = [
  {
    id: 'DD-01',
    name: 'Self-Role Escalation on Registration',
    collectionPath: '/users/attacker_uid',
    operation: 'create',
    actorRole: 'unassigned',
    expectedResult: 'PERMISSION_DENIED',
    payload: { uid: 'attacker_uid', email: 'attacker@example.com', role: 'super_admin', status: 'active' },
    invariantViolated: 'Prevent Self-Assigned Roles',
  },
  {
    id: 'DD-02',
    name: 'Shadow Update Ghost Field on Admission',
    collectionPath: '/admissions/adm_001',
    operation: 'update',
    actorRole: 'teacher',
    expectedResult: 'PERMISSION_DENIED',
    payload: { workflowStatus: 'teacher_verified', superAdminApprovedBy: 'fake_admin', ghostField: true },
    invariantViolated: 'Strict affectedKeys().hasOnly() & Blueprint Schema',
  },
  {
    id: 'DD-03',
    name: 'Admission Final Approval Shortcutting by HR',
    collectionPath: '/admissions/adm_001',
    operation: 'update',
    actorRole: 'hr',
    expectedResult: 'PERMISSION_DENIED',
    payload: { workflowStatus: 'active', hrVerifiedBy: 'hr_uid' },
    invariantViolated: 'No admission becomes active before Super Admin approval',
  },
  {
    id: 'DD-04',
    name: 'Teacher Self-Approval on Employee Attendance',
    collectionPath: '/employee_attendance/att_001',
    operation: 'update',
    actorRole: 'teacher',
    expectedResult: 'PERMISSION_DENIED',
    payload: { approvalStatus: 'approved', approvedBy: 'teacher_uid' },
    invariantViolated: 'Principal must approve teacher attendance',
  },
  {
    id: 'DD-05',
    name: 'Reopening Locked Attendance Without Super Admin',
    collectionPath: '/employee_attendance/att_001',
    operation: 'update',
    actorRole: 'hr',
    expectedResult: 'PERMISSION_DENIED',
    payload: { isLocked: false, reopenedByAdmin: true },
    invariantViolated: 'Only Super Admin can reopen locked attendance',
  },
  {
    id: 'DD-06',
    name: 'Historical Student Attendance Deletion',
    collectionPath: '/student_attendance/stu_att_001',
    operation: 'delete',
    actorRole: 'teacher',
    expectedResult: 'PERMISSION_DENIED',
    invariantViolated: 'Never delete previous attendance records',
  },
  {
    id: 'DD-07',
    name: 'Audit Log Modification Attempt',
    collectionPath: '/audit_logs/log_001',
    operation: 'update',
    actorRole: 'super_admin',
    expectedResult: 'PERMISSION_DENIED',
    payload: { details: 'Tampered entry' },
    invariantViolated: 'Audit logs are strictly immutable',
  },
  {
    id: 'DD-08',
    name: 'Audit Log Actor Spoofing',
    collectionPath: '/audit_logs/log_002',
    operation: 'create',
    actorRole: 'teacher',
    expectedResult: 'PERMISSION_DENIED',
    payload: { actorUid: 'victim_uid', action: 'approve', module: 'Admissions' },
    invariantViolated: 'Identity Integrity (actorUid == request.auth.uid)',
  },
  {
    id: 'DD-09',
    name: 'Unverified Email Token Write',
    collectionPath: '/employees/emp_001',
    operation: 'create',
    actorRole: 'hr_unverified_email',
    expectedResult: 'PERMISSION_DENIED',
    invariantViolated: 'Email verification mandatory',
  },
  {
    id: 'DD-10',
    name: 'Document ID Poisoning',
    collectionPath: '/branches/invalid$id!with*bad#chars',
    operation: 'create',
    actorRole: 'super_admin',
    expectedResult: 'PERMISSION_DENIED',
    invariantViolated: 'Path Variable Hardening (isValidId)',
  },
  {
    id: 'DD-11',
    name: 'Pending User Reading Payroll PII',
    collectionPath: '/payroll_records',
    operation: 'list',
    actorRole: 'pending',
    expectedResult: 'PERMISSION_DENIED',
    invariantViolated: 'PII Isolation & Role-Gated Queries',
  },
  {
    id: 'DD-12',
    name: 'Client-Forged Timestamp on E-Raseed',
    collectionPath: '/eraseed_receipts/rec_001',
    operation: 'create',
    actorRole: 'staff',
    expectedResult: 'PERMISSION_DENIED',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    invariantViolated: 'Temporal Integrity (createdAt == request.time)',
  },
];
