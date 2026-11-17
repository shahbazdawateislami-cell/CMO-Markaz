# Markazi CMO – Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & Bootstrapped Authority**: Every write requires `request.auth != null && request.auth.token.email_verified == true`. Users cannot self-assign privileged roles (`super_admin`, `hr`, `principal`, `teacher`, `department_supervisor`, `staff`) on profile creation unless their verified email is the bootstrapped owner (`shahbazdawateislami@gmail.com`).
2. **Admission 3-Stage Workflow**: Admissions start at `pending_teacher` -> `teacher_verified` (Teacher) -> `hr_verified` (HR) -> `active` (Super Admin ONLY). Active `students` records can only be activated by Super Admin approval.
3. **Teacher Attendance & Payroll Integrity**: Employee attendance records can only be marked for `request.auth.uid` (unless Super Admin/HR), cannot bypass `isLocked` unless reopened by Super Admin, and can only be `approved` or `rejected` by `principal` or `super_admin`.
4. **Student Attendance Immutability**: Student attendance records are separate from ESS, preserve historical dates/months/sessions, cannot be deleted by teachers/staff, and are approved by `department_supervisor`, `hr`, or `super_admin`.
5. **Audit Log Immutability**: `audit_logs` are append-only (`allow update, delete: if false`) and must record `actorUid == request.auth.uid`.
6. **PII Isolation**: User profiles (`/users/{userId}`), employee records (`/employees/{employeeId}`), and claims/payroll are never readable via blanket `isSignedIn()` rules; access is restricted to the record owner (`uid == request.auth.uid`), HR, Principal (for branch/attendance context), or Super Admin.
7. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on Firestore writes are validated against `request.time`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Role Escalation**: Unprivileged user creates `/users/{uid}` with `role: "super_admin"`. -> `PERMISSION_DENIED`.
2. **Ghost Field Injection (Shadow Update)**: Teacher updates `/admissions/{id}` adding `isApproved: true` or `superAdminApprovedBy`. -> `PERMISSION_DENIED`.
3. **Admission Shortcutting**: Teacher or HR attempts to update `/admissions/{id}` directly to `workflowStatus: "active"`. -> `PERMISSION_DENIED`.
4. **Teacher Self-Approval**: Teacher attempts to update `/employee_attendance/{id}` setting `approvalStatus: "approved"`. -> `PERMISSION_DENIED`.
5. **Locked Attendance Bypass**: Employee attempts to create/update `/employee_attendance/{id}` with `isLocked: false` when policy is locked or changing `isLocked` directly. -> `PERMISSION_DENIED`.
6. **Historical Student Attendance Deletion**: Staff/Teacher attempts `delete` on `/student_attendance/{id}` to erase previous month history. -> `PERMISSION_DENIED`.
7. **Audit Log Tampering**: Any user attempts `update` or `delete` on `/audit_logs/{id}`. -> `PERMISSION_DENIED`.
8. **Spoofed Actor on Audit Log**: User creates `/audit_logs/{id}` with `actorUid: "another_uid"`. -> `PERMISSION_DENIED`.
9. **Unverified Email Access**: Request with `email_verified: false` tries to read/write `/employees/{id}`. -> `PERMISSION_DENIED`.
10. **ID Poisoning**: Write to `/branches/{1500_char_invalid_id}` with invalid characters or length > 128. -> `PERMISSION_DENIED`.
11. **PII Cross-Read**: Pending/unassigned user attempts `get` or `list` on `/employees` or `/payroll_records`. -> `PERMISSION_DENIED`.
12. **Client-Forged Timestamp**: User creates `/eraseed_receipts/{id}` with backdated `createdAt` != `request.time`. -> `PERMISSION_DENIED`.
