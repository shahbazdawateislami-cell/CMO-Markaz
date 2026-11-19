import React, { useEffect, useState } from 'react';
import { Download, KeyRound, Shield } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { formatCounter, ModuleKey, UserRole } from '../../types';
import { exportToCsv, sanitizeStr } from '../../utils/validation';
import { CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

type HRControlArea =
  | 'user_access'
  | 'teacher_mgmt'
  | 'student_parent'
  | 'activities_attendance'
  | 'academic_control'
  | 'homework_assignment'
  | 'exam_test'
  | 'fees_finance'
  | 'notice_comm'
  | 'approval_mgmt'
  | 'reports_analytics'
  | 'settings_master'
  | 'system_logs'
  | 'system_config'
  | 'profile_records'
  | 'data_backup';

const HR_CONTROL_ITEMS: { id: HRControlArea; label: string }[] = [
  { id: 'user_access', label: 'User & Access Control' },
  { id: 'teacher_mgmt', label: 'Teacher Management' },
  { id: 'student_parent', label: 'Student & Parent Records' },
  { id: 'activities_attendance', label: 'Activities & Attendance Control' },
  { id: 'academic_control', label: 'Academic Control' },
  { id: 'homework_assignment', label: 'Homework & Assignment' },
  { id: 'exam_test', label: 'Exam & Test' },
  { id: 'fees_finance', label: 'Fees & Finance' },
  { id: 'notice_comm', label: 'Notice & Communication' },
  { id: 'approval_mgmt', label: 'Approval Management' },
  { id: 'reports_analytics', label: 'Reports & Analytics' },
  { id: 'settings_master', label: 'Settings & Master' },
  { id: 'system_logs', label: 'System Logs & Audit' },
  { id: 'system_config', label: 'System Configuration' },
  { id: 'profile_records', label: 'Profile & Records' },
  { id: 'data_backup', label: 'Data & Backup' },
];

export function HRControlPanel({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const {
    actorUid,
    users,
    branches,
    departments,
    employees,
    students,
    admissions,
    academics,
    employeeAttendance,
    studentAttendance,
    financeLedger,
    notices,
    auditLogs,
    systemConfigs,
    isHR,
    isSuperAdmin,
    hasAdminPin,
    saveAdminPin,
    createRecord,
    updateRecord,
    notify,
  } = useCMO();

  const [area, setArea] = useState<HRControlArea>('user_access');
  const masterCfg = systemConfigs.find((c) => c.configType === 'master');
  const [institutionName, setInstitutionName] = useState(
    masterCfg?.institutionName || 'Markazi CMO'
  );
  const [academicYear, setAcademicYear] = useState(
    masterCfg?.academicYear || '2026-2027'
  );
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    if (masterCfg?.institutionName) setInstitutionName(masterCfg.institutionName);
    if (masterCfg?.academicYear) setAcademicYear(masterCfg.academicYear);
  }, [masterCfg?.institutionName, masterCfg?.academicYear]);

  if (!isHR && !isSuperAdmin) {
    return (
      <EmptyState
        title="Restricted to HR & Super Admin"
        description="Only authorized HR Administrators or Super Admin can access the HR Control Panel."
      />
    );
  }

  const handleAssignUser = async (
    uid: string,
    updates: {
      role?: UserRole;
      status?: 'active' | 'pending' | 'suspended';
      branchId?: string;
      departmentId?: string;
      employeeId?: string;
    }
  ) => {
    try {
      await updateRecord('users', uid, updates, {
        action: 'Updated User Access & Role',
        module: 'HR Control Panel',
        details: `Updated user ${uid}: ${JSON.stringify(updates)}`,
      });
      notify('User access permissions updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update user access.', 'error');
    }
  };

  const handleExportBackup = async () => {
    const safeEmployees = employees.map(({ passwordHash: _pw, ...rest }) => rest);
    const payload = {
      exportedAt: new Date().toISOString(),
      branches,
      departments,
      employees: safeEmployees,
      students,
      admissions,
      employeeAttendance,
      studentAttendance,
      financeLedger,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `markazi_cmo_hr_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (actorUid) {
      try {
        await createRecord('system_config', 'backup_meta', {
          configType: 'backup',
          lastBackupAt: new Date().toISOString(),
          updatedBy: actorUid,
        });
      } catch {
        // Backup download already completed; ignore optional metadata error
      }
    }
    notify('Institutional JSON backup downloaded (password hashes excluded).', 'success');
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="HR Control Panel"
        subtitle="Central HR governance over Users, Teachers, Student/Parent Records, Academics, Approvals, Audit Logs & Data Backups"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CounterStat label="System Users" value={users.length} />
        <CounterStat label="Employees" value={employees.length} />
        <CounterStat label="Student Records" value={students.length} />
        <CounterStat label="Audit Trail Events" value={auditLogs.length} />
      </div>

      {/* 16 HR Control Navigation Pills -> clean rectangular buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {HR_CONTROL_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setArea(item.id)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
              area === item.id
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {area === 'user_access' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              User &amp; Access Control ({formatCounter(users.length)})
            </span>
            <span className="text-xs text-slate-500">
              HR manages roles below Super Admin; Super Admin holds final authority
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Branch</th>
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-4">Employee Link</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => {
                  const lockedSuperAdmin = u.role === 'super_admin' && !isSuperAdmin;
                  return (
                    <tr key={u.uid}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{u.displayName}</div>
                        <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={lockedSuperAdmin}
                          value={u.role}
                          onChange={(e) =>
                            handleAssignUser(u.uid, {
                              role: e.target.value as UserRole,
                              status: e.target.value === 'pending' ? 'pending' : 'active',
                            })
                          }
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white disabled:bg-slate-100"
                        >
                          <option value="pending">pending</option>
                          <option value="staff">staff</option>
                          <option value="teacher">teacher</option>
                          <option value="department_supervisor">department_supervisor</option>
                          <option value="principal">principal</option>
                          <option value="hr">hr</option>
                          {isSuperAdmin && <option value="super_admin">super_admin</option>}
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={lockedSuperAdmin}
                          value={u.branchId || ''}
                          onChange={(e) => handleAssignUser(u.uid, { branchId: e.target.value })}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                        >
                          <option value="">Central</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={lockedSuperAdmin}
                          value={u.departmentId || ''}
                          onChange={(e) => handleAssignUser(u.uid, { departmentId: e.target.value })}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                        >
                          <option value="">All / None</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={lockedSuperAdmin}
                          value={u.employeeId || ''}
                          onChange={(e) => handleAssignUser(u.uid, { employeeId: e.target.value })}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                        >
                          <option value="">Unlinked</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.employeeCode} – {emp.fullName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={lockedSuperAdmin}
                          value={u.status}
                          onChange={(e) =>
                            handleAssignUser(u.uid, {
                              status: e.target.value as 'active' | 'pending' | 'suspended',
                            })
                          }
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                        >
                          <option value="active">active</option>
                          <option value="pending">pending</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {area === 'teacher_mgmt' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Teacher Management Overview</h3>
            <button
              onClick={() => onNavigate('teacher_management')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg"
            >
              Open Full Teacher Workspace
            </button>
          </div>
          <p className="text-sm text-slate-600">
            Active teachers registered in user access: {formatCounter(users.filter((u) => u.role === 'teacher').length)}
          </p>
        </div>
      )}

      {area === 'student_parent' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Student &amp; Parent / Guardian Records ({formatCounter(students.length)}) · No Personal Student/Parent Portal
            </span>
          </div>
          {students.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No active student records yet. Students are created upon Super Admin final admission approval.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Roll No</th>
                  <th className="py-2.5 px-4">Student Name</th>
                  <th className="py-2.5 px-4">Parent / Father</th>
                  <th className="py-2.5 px-4">Guardian Contact</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-4 font-mono text-xs">{s.rollNo}</td>
                    <td className="py-2.5 px-4 font-medium">{s.studentName}</td>
                    <td className="py-2.5 px-4">{s.fatherName}</td>
                    <td className="py-2.5 px-4 font-mono text-xs">{s.guardianPhone || '-'}</td>
                    <td className="py-2.5 px-4"><StatusTag status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {area === 'activities_attendance' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Activities &amp; Attendance Control</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CounterStat label="Employee Attendance Logs" value={employeeAttendance.length} />
            <CounterStat label="Student Attendance Logs" value={studentAttendance.length} />
            <CounterStat label="Pending Principal Approval" value={employeeAttendance.filter((a) => a.approvalStatus === 'pending_principal').length} />
            <CounterStat label="Pending Supervisor Approval" value={studentAttendance.filter((a) => a.approvalStatus === 'pending_supervisor').length} />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => onNavigate('hr_payroll')} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">
              Review Employee Attendance
            </button>
            <button onClick={() => onNavigate('madrasas')} className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg">
              Inspect Madrasas Student Attendance
            </button>
            <button onClick={() => onNavigate('qadri_40')} className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg">
              Inspect QADRI 40 Attendance
            </button>
          </div>
        </div>
      )}

      {(area === 'academic_control' || area === 'homework_assignment' || area === 'exam_test') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {HR_CONTROL_ITEMS.find((i) => i.id === area)?.label}
            </h3>
            <button onClick={() => onNavigate('teacher_management')} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">
              Open Academic Records
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CounterStat label="Homework" value={academics.filter((a) => a.recordType === 'homework').length} />
            <CounterStat label="Exams & Tests" value={academics.filter((a) => a.recordType === 'exam').length} />
            <CounterStat label="Marks & Results" value={academics.filter((a) => a.recordType === 'mark').length} />
            <CounterStat label="Progress Notes" value={academics.filter((a) => a.recordType === 'progress').length} />
          </div>
        </div>
      )}

      {area === 'fees_finance' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Fees &amp; Finance Control</h3>
            <p className="text-sm text-slate-500">Total financial ledger entries: {formatCounter(financeLedger.length)}</p>
          </div>
          <button onClick={() => onNavigate('erp')} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">
            Open ERP &amp; Finance
          </button>
        </div>
      )}

      {area === 'notice_comm' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Notice &amp; Communication Control</h3>
            <p className="text-sm text-slate-500">Published circulars: {formatCounter(notices.length)}</p>
          </div>
          <button onClick={() => onNavigate('notice_board')} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">
            Open Notice Board
          </button>
        </div>
      )}

      {area === 'approval_mgmt' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Central Approval Management</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => onNavigate('online_admission')} className="p-4 text-left border border-slate-200 rounded-lg hover:border-emerald-700">
              <div className="text-xs text-slate-500">Admissions Awaiting HR Verification</div>
              <div className="mt-1 font-mono text-xl font-semibold">
                {formatCounter(admissions.filter((a) => a.workflowStatus === 'teacher_verified').length)}
              </div>
            </button>
            <button onClick={() => onNavigate('hr_payroll')} className="p-4 text-left border border-slate-200 rounded-lg hover:border-emerald-700">
              <div className="text-xs text-slate-500">Teacher Attendance Awaiting Principal</div>
              <div className="mt-1 font-mono text-xl font-semibold">
                {formatCounter(employeeAttendance.filter((a) => a.approvalStatus === 'pending_principal').length)}
              </div>
            </button>
            <button onClick={() => onNavigate('madrasas')} className="p-4 text-left border border-slate-200 rounded-lg hover:border-emerald-700">
              <div className="text-xs text-slate-500">Student Attendance Awaiting Supervisor</div>
              <div className="mt-1 font-mono text-xl font-semibold">
                {formatCounter(studentAttendance.filter((a) => a.approvalStatus === 'pending_supervisor').length)}
              </div>
            </button>
          </div>
        </div>
      )}

      {area === 'reports_analytics' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">HR &amp; Institutional Analytics</h3>
            <p className="text-sm text-slate-500">View consolidated cross-branch metrics and export reports.</p>
          </div>
          <button onClick={() => onNavigate('reports_analytics')} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">
            Open Reports &amp; Analytics
          </button>
        </div>
      )}

      {(area === 'settings_master' || area === 'system_config') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!actorUid) return;
              try {
                await createRecord('system_config', 'master_config', {
                  configType: 'master',
                  institutionName: sanitizeStr(institutionName, 120),
                  academicYear: sanitizeStr(academicYear, 40),
                  ...(masterCfg?.adminPinHash ? { adminPinHash: masterCfg.adminPinHash } : {}),
                  updatedBy: actorUid,
                });
                notify('Master system configuration updated.', 'success');
              } catch (err) {
                notify(err instanceof Error ? err.message : 'Failed to save configuration.', 'error');
              }
            }}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-800" />
              <h3 className="text-base font-semibold text-slate-900">Settings &amp; Master Configuration</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Central Institution Name</label>
              <input type="text" required value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Active Academic Year</label>
              <input type="text" required value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg">
              Save Configuration
            </button>
          </form>

          {isSuperAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await saveAdminPin(newPin, hasAdminPin ? curPin : undefined);
                if (!res.ok) {
                  notify(res.error || 'Failed to update Admin PIN.', 'error');
                  return;
                }
                setCurPin('');
                setNewPin('');
                notify(
                  newPin.trim()
                    ? 'Master Admin Security PIN saved. You can lock the terminal anytime from the top bar.'
                    : 'Master Admin Security PIN cleared.',
                  'success'
                );
              }}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-800" />
                <h3 className="text-base font-semibold text-slate-900">
                  Admin Terminal Security PIN ({hasAdminPin ? 'Active' : 'Not Set'})
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Protect HR &amp; Payroll, HR Control Panel, and Super Admin Authority on shared terminals. Leave New PIN blank to remove lock.
              </p>
              {hasAdminPin && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Current Admin PIN</label>
                  <input type="password" required value={curPin} onChange={(e) => setCurPin(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">New Admin PIN (min 4 chars)</label>
                <input type="password" placeholder={hasAdminPin ? 'New PIN or blank to remove' : 'Min 4 characters'} value={newPin} onChange={(e) => setNewPin(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              </div>
              <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg">
                {hasAdminPin ? 'Update Admin PIN' : 'Enable Admin PIN Lock'}
              </button>
            </form>
          )}
        </div>
      )}

      {area === 'system_logs' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Immutable System Logs &amp; Audit Trail</span>
            <button
              onClick={() =>
                exportToCsv(
                  'markazi_cmo_audit_logs.csv',
                  ['Action', 'Module', 'Actor Email', 'Role', 'Details'],
                  auditLogs.map((l) => [l.action, l.module, l.actorEmail, l.actorRole, l.details])
                )
              }
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              Export Audit CSV
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No audit log events recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Module</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{l.action}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">{l.module}</td>
                      <td className="py-2.5 px-4 text-xs font-mono text-slate-600">{l.actorEmail} ({l.actorRole})</td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {area === 'profile_records' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Employee Profiles &amp; Records</h3>
            <p className="text-sm text-slate-500">Registered employee dossiers: {formatCounter(employees.length)}</p>
          </div>
          <button onClick={() => onNavigate('hr_payroll')} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">
            Open HR &amp; Payroll
          </button>
        </div>
      )}

      {area === 'data_backup' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Data Export &amp; Institutional Backup</h3>
          <p className="text-sm text-slate-600">
            Download a complete JSON snapshot of branches, departments, employees, students, admissions, historical attendance, and financial records.
          </p>
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            <Download className="w-4 h-4" />
            Download Institutional Backup JSON
          </button>
        </div>
      )}
    </div>
  );
}
