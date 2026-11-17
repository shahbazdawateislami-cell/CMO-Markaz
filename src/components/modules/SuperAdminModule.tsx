import React, { useState } from 'react';
import { Clock, Database, LockOpen, ShieldCheck } from 'lucide-react';
import { AUTH_LOCK_ENABLED, useCMO } from '../../context/CMOContext';
import { formatCounter, ModuleKey } from '../../types';
import { makeSafeId, sanitizeStr } from '../../utils/validation';
import { CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

type AdminTab =
  | 'org_setup'
  | 'attendance_timings'
  | 'reopen_locks'
  | 'admissions_gate'
  | 'backup_recovery';

export function SuperAdminModule({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const {
    firebaseUser,
    divisions,
    branches,
    departments,
    sessions,
    employees,
    admissions,
    attendanceTimings,
    employeeAttendance,
    students,
    studentAttendance,
    financeLedger,
    eraseedReceipts,
    auditLogs,
    isSuperAdmin,
    createRecord,
    updateRecord,
    notify,
  } = useCMO();

  const [tab, setTab] = useState<AdminTab>('org_setup');

  // Division form
  const [divName, setDivName] = useState('');
  const [divCode, setDivCode] = useState('');

  // Branch form
  const [brName, setBrName] = useState('');
  const [brCode, setBrCode] = useState('');
  const [brCity, setBrCity] = useState('');
  const [brInst, setBrInst] = useState('Markazi CMO');
  const [brDivId, setBrDivId] = useState('');

  // Department form
  const [deptName, setDeptName] = useState('');
  const [deptType, setDeptType] = useState<
    'madrasas' | 'qadri40' | 'darul_ifta' | 'darul_qaza' | 'darul_iqama' | 'tahreek_bedari' | 'other'
  >('madrasas');

  // Session form
  const [sessName, setSessName] = useState('');
  const [sessStart, setSessStart] = useState('2026-04-01');
  const [sessEnd, setSessEnd] = useState('2027-03-31');

  // Attendance Timing Policy form (Branch, Department, Employee-wise)
  const [scopeType, setScopeType] = useState<'global' | 'branch' | 'department' | 'employee'>('global');
  const [scopeId, setScopeId] = useState('global');
  const [startTime, setStartTime] = useState('08:00');
  const [lateTime, setLateTime] = useState('08:30');
  const [closingTime, setClosingTime] = useState('17:00');
  const [graceMinutes, setGraceMinutes] = useState('15');

  if ((AUTH_LOCK_ENABLED || firebaseUser) && !isSuperAdmin) {
    return (
      <EmptyState
        title="Super Admin Final Authority Required"
        description="Only the Super Admin can configure institutional branches, attendance locks, and final admission approvals."
      />
    );
  }

  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const id = makeSafeId('div');
    await createRecord(
      'divisions',
      id,
      {
        name: sanitizeStr(divName, 120),
        code: sanitizeStr(divCode, 40),
        status: 'active',
        createdBy: firebaseUser.uid,
      },
      { action: 'Created Division', module: 'Super Admin', details: divName }
    );
    setDivName('');
    setDivCode('');
    notify('Division created.', 'success');
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const id = makeSafeId('br');
    await createRecord(
      'branches',
      id,
      {
        name: sanitizeStr(brName, 120),
        code: sanitizeStr(brCode, 40),
        divisionId: brDivId || '',
        institutionName: sanitizeStr(brInst, 120),
        city: sanitizeStr(brCity, 100),
        status: 'active',
        createdBy: firebaseUser.uid,
      },
      { action: 'Created Branch', module: 'Super Admin', details: `${brName} (${brCity})` }
    );
    setBrName('');
    setBrCode('');
    setBrCity('');
    notify('Branch created.', 'success');
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const id = makeSafeId('dept');
    await createRecord(
      'departments',
      id,
      {
        name: sanitizeStr(deptName, 120),
        slug: deptType,
        type: deptType,
        status: 'active',
        permissions: ['read', 'write', 'report'],
        createdBy: firebaseUser.uid,
      },
      { action: 'Created Department', module: 'Super Admin', details: `${deptName} (${deptType})` }
    );
    setDeptName('');
    notify('Department created and connected to central CMO.', 'success');
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const id = makeSafeId('sess');
    await createRecord(
      'academic_sessions',
      id,
      {
        name: sanitizeStr(sessName, 100),
        startDate: sessStart,
        endDate: sessEnd,
        isCurrent: true,
        status: 'active',
        createdBy: firebaseUser.uid,
      },
      { action: 'Created Academic Session', module: 'Super Admin', details: sessName }
    );
    setSessName('');
    notify('Academic Session created.', 'success');
  };

  const handleSaveTimingPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const resolvedScopeId = scopeType === 'global' ? 'global' : scopeId;
    if (!resolvedScopeId) {
      notify('Select a Branch, Department, or Employee target.', 'error');
      return;
    }
    const label =
      scopeType === 'global'
        ? 'Global Default Policy'
        : scopeType === 'branch'
          ? branches.find((b) => b.id === resolvedScopeId)?.name || resolvedScopeId
          : scopeType === 'department'
            ? departments.find((d) => d.id === resolvedScopeId)?.name || resolvedScopeId
            : employees.find((emp) => emp.id === resolvedScopeId)?.fullName || resolvedScopeId;

    const id = makeSafeId('tim');
    await createRecord(
      'attendance_timings',
      id,
      {
        scopeType,
        scopeId: resolvedScopeId,
        scopeLabel: label,
        startTime,
        lateTime,
        closingTime,
        graceMinutes: Math.max(0, Number(graceMinutes) || 0),
        isLocked: false,
        updatedBy: firebaseUser.uid,
      },
      {
        action: 'Configured Attendance Timing',
        module: 'Super Admin',
        details: `${label}: ${startTime}–${closingTime} (Late ${lateTime}, Grace ${graceMinutes}m)`,
      }
    );
    notify(`Timing policy saved for ${label}.`, 'success');
  };

  const handleReopenAttendancePolicy = async (timingId: string) => {
    if (!firebaseUser) return;
    const reopenEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await updateRecord(
      'attendance_timings',
      timingId,
      {
        isLocked: false,
        reopenedUntil: reopenEnd,
        updatedBy: firebaseUser.uid,
      },
      {
        action: 'Super Admin Reopened Locked Attendance',
        module: 'Super Admin',
        details: `Reopened policy ${timingId} for 2 hours`,
      }
    );
    notify('Attendance window reopened for 2 hours.', 'success');
  };

  const handleToggleLockPolicy = async (timingId: string, locked: boolean) => {
    if (!firebaseUser) return;
    await updateRecord(
      'attendance_timings',
      timingId,
      {
        isLocked: locked,
        reopenedUntil: '',
        updatedBy: firebaseUser.uid,
      },
      {
        action: locked ? 'Locked Attendance Policy' : 'Unlocked Attendance Policy',
        module: 'Super Admin',
        details: `Policy ${timingId} isLocked=${locked}`,
      }
    );
    notify(`Policy ${locked ? 'locked' : 'unlocked'}.`, 'success');
  };

  const handleReopenAttendanceRecord = async (recordId: string) => {
    await updateRecord(
      'employee_attendance',
      recordId,
      {
        isLocked: false,
        reopenedByAdmin: true,
      },
      {
        action: 'Super Admin Reopened Attendance Record',
        module: 'Super Admin',
        details: `Reopened employee attendance ${recordId}`,
      }
    );
    notify('Employee attendance record reopened.', 'success');
  };

  const handleFullBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      divisions,
      branches,
      departments,
      sessions,
      employees,
      students,
      admissions,
      employeeAttendance,
      studentAttendance,
      eraseedReceipts,
      financeLedger,
      auditLogs,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `markazi_cmo_super_admin_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Complete Super Admin JSON backup downloaded.', 'success');
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Super Admin – Final Institutional Authority"
        subtitle="Master governance over Divisions, Branches, Departments, Academic Sessions, Attendance Timings & Locks, Final Admissions, and Backups"
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <CounterStat label="Divisions" value={divisions.length} />
        <CounterStat label="Branches" value={branches.length} />
        <CounterStat label="Departments" value={departments.length} />
        <CounterStat label="Academic Sessions" value={sessions.length} />
        <CounterStat label="Timing Policies" value={attendanceTimings.length} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            ['org_setup', 'Divisions, Branches, Departments & Sessions'],
            ['attendance_timings', 'Attendance Timings & Locks'],
            ['reopen_locks', 'Reopen Locked Attendance'],
            ['admissions_gate', 'Final Admission Authority'],
            ['backup_recovery', 'Backup & Recovery'],
          ] as [AdminTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              tab === k
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'org_setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Divisions */}
          <form onSubmit={handleCreateDivision} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">1. Madrasa Divisions</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" required placeholder="Division Name (e.g. Sindh)" value={divName} onChange={(e) => setDivName(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              <input type="text" required placeholder="Code (DIV-01)" value={divCode} onChange={(e) => setDivCode(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
            </div>
            <button type="submit" className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">Add Division</button>
            {divisions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                {divisions.map((d) => (
                  <div key={d.id} className="flex justify-between py-1">
                    <span className="font-medium">{d.name}</span>
                    <span className="font-mono text-slate-500">{d.code}</span>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Branches */}
          <form onSubmit={handleCreateBranch} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">2. Institutional Branches</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" required placeholder="Branch Name" value={brName} onChange={(e) => setBrName(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              <input type="text" required placeholder="Code (BR-01)" value={brCode} onChange={(e) => setBrCode(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              <input type="text" required placeholder="City" value={brCity} onChange={(e) => setBrCity(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              <input type="text" required placeholder="Institution Name" value={brInst} onChange={(e) => setBrInst(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
            <select value={brDivId} onChange={(e) => setBrDivId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Optional Division</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">Add Branch</button>
            {branches.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                {branches.map((b) => (
                  <div key={b.id} className="flex justify-between py-1">
                    <span className="font-medium">{b.name} ({b.city})</span>
                    <span className="font-mono text-slate-500">{b.code}</span>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Departments */}
          <form onSubmit={handleCreateDepartment} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">3. Institutional Departments</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" required placeholder="Department Name" value={deptName} onChange={(e) => setDeptName(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              <select value={deptType} onChange={(e) => setDeptType(e.target.value as typeof deptType)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
                <option value="madrasas">Madrasas</option>
                <option value="qadri40">QADRI 40</option>
                <option value="darul_ifta">Darul Ifta</option>
                <option value="darul_qaza">Dar-ul-Qaza</option>
                <option value="darul_iqama">Darul Iqama</option>
                <option value="tahreek_bedari">Tahreek-e-Bedari</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">Add Department</button>
            {departments.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                {departments.map((d) => (
                  <div key={d.id} className="flex justify-between py-1">
                    <span className="font-medium">{d.name}</span>
                    <StatusTag status={d.type} />
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Academic Sessions */}
          <form onSubmit={handleCreateSession} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">4. Academic Sessions</h3>
            <input type="text" required placeholder="Session Name (e.g. 2026-2027 / 1447-48 AH)" value={sessName} onChange={(e) => setSessName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" required value={sessStart} onChange={(e) => setSessStart(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              <input type="date" required value={sessEnd} onChange={(e) => setSessEnd(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
            </div>
            <button type="submit" className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">Add Session</button>
            {sessions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                {sessions.map((s) => (
                  <div key={s.id} className="flex justify-between py-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="font-mono text-slate-500">{s.startDate} to {s.endDate}</span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {tab === 'attendance_timings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSaveTimingPolicy} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-800" />
              <h3 className="text-base font-semibold text-slate-900">Configure Attendance Timings</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Policy Scope</label>
              <select
                value={scopeType}
                onChange={(e) => {
                  setScopeType(e.target.value as typeof scopeType);
                  setScopeId(e.target.value === 'global' ? 'global' : '');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="global">Global Institution Default</option>
                <option value="branch">Branch-Wise</option>
                <option value="department">Department-Wise</option>
                <option value="employee">Employee-Wise</option>
              </select>
            </div>

            {scopeType !== 'global' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target {scopeType}</label>
                <select
                  required
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select {scopeType}</option>
                  {scopeType === 'branch' && branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  {scopeType === 'department' && departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  {scopeType === 'employee' && employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.employeeCode} – {emp.fullName}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
                <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Late Time</label>
                <input type="time" required value={lateTime} onChange={(e) => setLateTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Closing Time (Auto-Lock)</label>
                <input type="time" required value={closingTime} onChange={(e) => setClosingTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grace Period (Min)</label>
                <input type="number" min={0} max={180} required value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              </div>
            </div>
            <button type="submit" className="w-full py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg">
              Save Timing Policy
            </button>
          </form>

          <div className="lg:col-span-2">
            {attendanceTimings.length === 0 ? (
              <EmptyState title="No Timing Policies Set" description="Create Global, Branch, Department, or Employee-wise attendance timings on the left." />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Scope</th>
                      <th className="py-2.5 px-4">Start / Late / Close</th>
                      <th className="py-2.5 px-4">Grace</th>
                      <th className="py-2.5 px-4">Lock State</th>
                      <th className="py-2.5 px-4 text-right">Admin Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {attendanceTimings.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{t.scopeLabel || t.scopeId}</div>
                          <div className="text-xs uppercase font-mono text-slate-400">{t.scopeType}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs">{t.startTime} · {t.lateTime} · {t.closingTime}</td>
                        <td className="py-2.5 px-4 font-mono text-xs">{t.graceMinutes}m</td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={t.isLocked ? 'Locked' : 'Open'} tone={t.isLocked ? 'red' : 'emerald'} />
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleReopenAttendancePolicy(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                          >
                            <LockOpen className="w-3 h-3" /> Reopen 2h
                          </button>
                          <button
                            onClick={() => handleToggleLockPolicy(t.id, !t.isLocked)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md"
                          >
                            {t.isLocked ? 'Unlock' : 'Lock'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'reopen_locks' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Reopen Locked Attendance Records</h3>
          {employeeAttendance.filter((a) => a.isLocked).length === 0 ? (
            <p className="text-sm text-slate-500">No individually locked employee attendance records found.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {employeeAttendance
                .filter((a) => a.isLocked)
                .map((rec) => (
                  <div key={rec.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{rec.employeeName}</div>
                      <div className="text-xs font-mono text-slate-500">{rec.date} · {rec.status}</div>
                    </div>
                    <button
                      onClick={() => handleReopenAttendanceRecord(rec.id)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg"
                    >
                      Reopen Attendance
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {tab === 'admissions_gate' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Final Admission Approval Queue</h3>
            <p className="text-sm text-slate-500">
              HR-verified admissions awaiting Super Admin Final Activation: {formatCounter(admissions.filter((a) => a.workflowStatus === 'hr_verified').length)}
            </p>
          </div>
          <button
            onClick={() => onNavigate('online_admission')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg"
          >
            <ShieldCheck className="w-4 h-4" /> Open Final Admission Queue
          </button>
        </div>
      )}

      {tab === 'backup_recovery' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-800" />
            <h3 className="text-base font-semibold text-slate-900">Full Institutional Backup &amp; Recovery</h3>
          </div>
          <p className="text-sm text-slate-600">
            Export an authoritative JSON archive of every Markazi CMO Firestore collection including historical attendance, admissions, finance, E-Raseed, and audit logs.
          </p>
          <button
            onClick={handleFullBackup}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            Download Complete CMO Backup
          </button>
        </div>
      )}
    </div>
  );
}
