import React, { useEffect, useState } from 'react';
import { Clock, Database, KeyRound, LockOpen, ShieldCheck, Trash2 } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
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
    actorUid,
    divisions,
    branches,
    departments,
    sessions,
    classes,
    employees,
    admissions,
    attendanceTimings,
    employeeAttendance,
    students,
    studentAttendance,
    financeLedger,
    eraseedReceipts,
    auditLogs,
    systemConfigs,
    isSuperAdmin,
    hasAdminPin,
    saveAdminPin,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
  } = useCMO();

  const [tab, setTab] = useState<AdminTab>('org_setup');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState('');

  // Admin PIN setup state
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Division form
  const [divName, setDivName] = useState('');
  const [divCode, setDivCode] = useState('');

  // Branch form
  const masterCfg = systemConfigs.find((c) => c.configType === 'master');
  const [brName, setBrName] = useState('');
  const [brCode, setBrCode] = useState('');
  const [brCity, setBrCity] = useState('');
  const [brInst, setBrInst] = useState(masterCfg?.institutionName || 'Markazi CMO');
  const [brDivId, setBrDivId] = useState('');

  useEffect(() => {
    if (masterCfg?.institutionName) setBrInst(masterCfg.institutionName);
  }, [masterCfg?.institutionName]);

  // Department form
  const [deptName, setDeptName] = useState('');
  const [deptType, setDeptType] = useState<'madrasas' | 'qadri40' | 'other'>('madrasas');

  // Session form
  const [sessName, setSessName] = useState('');
  const [sessStart, setSessStart] = useState('2026-04-01');
  const [sessEnd, setSessEnd] = useState('2027-03-31');

  // Class form in Super Admin
  const [clsProgram, setClsProgram] = useState<'madrasa' | 'qadri40'>('madrasa');
  const [clsBranchId, setClsBranchId] = useState('');
  const [clsSessionId, setClsSessionId] = useState('');
  const [clsDivId, setClsDivId] = useState('');
  const [clsName, setClsName] = useState('');
  const [clsSection, setClsSection] = useState('');

  // Attendance Timing Policy form (Branch, Department, Employee-wise)
  const [scopeType, setScopeType] = useState<'global' | 'branch' | 'department' | 'employee'>('global');
  const [scopeId, setScopeId] = useState('global');
  const [startTime, setStartTime] = useState('08:00');
  const [lateTime, setLateTime] = useState('08:30');
  const [closingTime, setClosingTime] = useState('17:00');
  const [graceMinutes, setGraceMinutes] = useState('15');

  if (!isSuperAdmin) {
    return (
      <EmptyState
        title="Super Admin Final Authority Required"
        description="Only the Super Admin can configure institutional branches, attendance locks, and final admission approvals."
      />
    );
  }

  const handleToggleStatus = async (
    col: string,
    id: string,
    currentStatus: string,
    nextActive: string,
    nextInactive: string,
    label: string
  ) => {
    const next = currentStatus === nextActive ? nextInactive : nextActive;
    try {
      await updateRecord(col, id, { status: next }, {
        action: `Toggled ${col} Status`,
        module: 'Super Admin',
        details: `${label} -> ${next}`,
      });
      notify(`${label} marked ${next}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const handleDeleteMaster = async (col: string, id: string, label: string) => {
    try {
      await deleteRecord(col, id, {
        action: `Deleted ${col} Record`,
        module: 'Super Admin',
        details: `Deleted ${label} (${id})`,
      });
      setConfirmDeleteKey('');
      notify(`Deleted ${label}.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    const cleanName = sanitizeStr(divName, 120);
    const cleanCode = sanitizeStr(divCode, 40);
    if (!cleanName || !cleanCode) {
      notify('Enter both Division Name and Code.', 'error');
      return;
    }
    const id = makeSafeId('div');
    try {
      await createRecord(
        'divisions',
        id,
        {
          name: cleanName,
          code: cleanCode,
          status: 'active',
          createdBy: actorUid,
        },
        { action: 'Created Division', module: 'Super Admin', details: cleanName }
      );
      setDivName('');
      setDivCode('');
      notify('Division created.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create division.', 'error');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    const cleanName = sanitizeStr(brName, 120);
    const cleanCode = sanitizeStr(brCode, 40);
    const cleanCity = sanitizeStr(brCity, 100);
    const cleanInst = sanitizeStr(brInst, 120) || 'Markazi CMO';
    if (!cleanName || !cleanCode || !cleanCity) {
      notify('Enter Branch Name, Code, and City.', 'error');
      return;
    }
    const id = makeSafeId('br');
    try {
      await createRecord(
        'branches',
        id,
        {
          name: cleanName,
          code: cleanCode,
          divisionId: brDivId || '',
          institutionName: cleanInst,
          city: cleanCity,
          status: 'active',
          createdBy: actorUid,
        },
        { action: 'Created Branch', module: 'Super Admin', details: `${cleanName} (${cleanCity})` }
      );
      setBrName('');
      setBrCode('');
      setBrCity('');
      notify('Branch created.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create branch.', 'error');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    const cleanName = sanitizeStr(deptName, 120);
    if (!cleanName) {
      notify('Enter Department Name.', 'error');
      return;
    }
    const id = makeSafeId('dept');
    try {
      await createRecord(
        'departments',
        id,
        {
          name: cleanName,
          slug: deptType,
          type: deptType,
          status: 'active',
          permissions: ['read', 'write', 'report'],
          createdBy: actorUid,
        },
        { action: 'Created Department', module: 'Super Admin', details: `${cleanName} (${deptType})` }
      );
      setDeptName('');
      notify('Department created and connected to central CMO.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create department.', 'error');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    const cleanName = sanitizeStr(sessName, 100);
    if (!cleanName) {
      notify('Enter Academic Session Name.', 'error');
      return;
    }
    const id = makeSafeId('sess');
    try {
      await createRecord(
        'academic_sessions',
        id,
        {
          name: cleanName,
          startDate: sessStart,
          endDate: sessEnd,
          isCurrent: true,
          status: 'active',
          createdBy: actorUid,
        },
        { action: 'Created Academic Session', module: 'Super Admin', details: cleanName }
      );
      setSessName('');
      notify('Academic Session created.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create session.', 'error');
    }
  };

  const handleCreateClassAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    const cleanClassName = sanitizeStr(clsName, 120);
    if (!cleanClassName || !clsBranchId || !clsSessionId) {
      notify('Enter Class Name, Branch, and Academic Session.', 'error');
      return;
    }
    const id = makeSafeId('cls');
    try {
      await createRecord(
        'classes',
        id,
        {
          programType: clsProgram,
          branchId: clsBranchId,
          sessionId: clsSessionId,
          divisionId: clsDivId || '',
          className: cleanClassName,
          sectionName: sanitizeStr(clsSection, 60),
          status: 'active',
          createdBy: actorUid,
        },
        { action: 'Created Class in Super Admin', module: 'Super Admin', details: cleanClassName }
      );
      setClsName('');
      setClsSection('');
      notify('Class created successfully.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create class.', 'error');
    }
  };

  const handleSaveTimingPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
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
    try {
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
          updatedBy: actorUid,
        },
        {
          action: 'Configured Attendance Timing',
          module: 'Super Admin',
          details: `${label}: ${startTime}–${closingTime} (Late ${lateTime}, Grace ${graceMinutes}m)`,
        }
      );
      notify(`Timing policy saved for ${label}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save timing policy.', 'error');
    }
  };

  const handleReopenAttendancePolicy = async (timingId: string) => {
    if (!actorUid) return;
    const reopenEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    try {
      await updateRecord(
        'attendance_timings',
        timingId,
        {
          isLocked: false,
          reopenedUntil: reopenEnd,
          updatedBy: actorUid,
        },
        {
          action: 'Super Admin Reopened Locked Attendance',
          module: 'Super Admin',
          details: `Reopened policy ${timingId} for 2 hours`,
        }
      );
      notify('Attendance window reopened for 2 hours.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reopen policy.', 'error');
    }
  };

  const handleToggleLockPolicy = async (timingId: string, locked: boolean) => {
    if (!actorUid) return;
    try {
      await updateRecord(
        'attendance_timings',
        timingId,
        {
          isLocked: locked,
          reopenedUntil: '',
          updatedBy: actorUid,
        },
        {
          action: locked ? 'Locked Attendance Policy' : 'Unlocked Attendance Policy',
          module: 'Super Admin',
          details: `Policy ${timingId} isLocked=${locked}`,
        }
      );
      notify(`Policy ${locked ? 'locked' : 'unlocked'}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update lock.', 'error');
    }
  };

  const handleReopenAttendanceRecord = async (recordId: string) => {
    try {
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
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reopen record.', 'error');
    }
  };

  const handleFullBackup = () => {
    const safeEmployees = employees.map(({ passwordHash: _pw, ...rest }) => rest);
    const backup = {
      exportedAt: new Date().toISOString(),
      divisions,
      branches,
      departments,
      sessions,
      classes,
      employees: safeEmployees,
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
    notify('Complete Super Admin JSON backup downloaded (password hashes excluded).', 'success');
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
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                {divisions.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 py-1">
                    <span>
                      <strong className="font-medium">{d.name}</strong>{' '}
                      <span className="font-mono text-slate-500">({d.code})</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('divisions', d.id, d.status, 'active', 'inactive', d.name)}
                        className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50"
                      >
                        {d.status}
                      </button>
                      {confirmDeleteKey === `div:${d.id}` ? (
                        <>
                          <button type="button" onClick={() => handleDeleteMaster('divisions', d.id, d.name)} className="px-2 py-0.5 bg-red-600 text-white rounded">Confirm</button>
                          <button type="button" onClick={() => setConfirmDeleteKey('')} className="px-2 py-0.5 border border-slate-200 rounded">No</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteKey(`div:${d.id}`)} className="p-1 text-red-700 hover:bg-red-50 rounded" aria-label="Delete division">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                {branches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 py-1">
                    <span>
                      <strong className="font-medium">{b.name} ({b.city})</strong>{' '}
                      <span className="font-mono text-slate-500">{b.code}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('branches', b.id, b.status, 'active', 'inactive', b.name)}
                        className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50"
                      >
                        {b.status}
                      </button>
                      {confirmDeleteKey === `br:${b.id}` ? (
                        <>
                          <button type="button" onClick={() => handleDeleteMaster('branches', b.id, b.name)} className="px-2 py-0.5 bg-red-600 text-white rounded">Confirm</button>
                          <button type="button" onClick={() => setConfirmDeleteKey('')} className="px-2 py-0.5 border border-slate-200 rounded">No</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteKey(`br:${b.id}`)} className="p-1 text-red-700 hover:bg-red-50 rounded" aria-label="Delete branch">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
                <option value="other">Other</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">Add Department</button>
            {departments.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                {departments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="font-medium">{d.name} <span className="text-slate-400 font-mono">({d.type})</span></span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('departments', d.id, d.status, 'active', 'inactive', d.name)}
                        className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50"
                      >
                        {d.status}
                      </button>
                      {confirmDeleteKey === `dept:${d.id}` ? (
                        <>
                          <button type="button" onClick={() => handleDeleteMaster('departments', d.id, d.name)} className="px-2 py-0.5 bg-red-600 text-white rounded">Confirm</button>
                          <button type="button" onClick={() => setConfirmDeleteKey('')} className="px-2 py-0.5 border border-slate-200 rounded">No</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteKey(`dept:${d.id}`)} className="p-1 text-red-700 hover:bg-red-50 rounded" aria-label="Delete department">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-1">
                    <span>
                      <strong className="font-medium">{s.name}</strong>{' '}
                      <span className="font-mono text-slate-500">({s.startDate} to {s.endDate})</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('academic_sessions', s.id, s.status, 'active', 'archived', s.name)}
                        className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50"
                      >
                        {s.status}
                      </button>
                      {confirmDeleteKey === `sess:${s.id}` ? (
                        <>
                          <button type="button" onClick={() => handleDeleteMaster('academic_sessions', s.id, s.name)} className="px-2 py-0.5 bg-red-600 text-white rounded">Confirm</button>
                          <button type="button" onClick={() => setConfirmDeleteKey('')} className="px-2 py-0.5 border border-slate-200 rounded">No</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteKey(`sess:${s.id}`)} className="p-1 text-red-700 hover:bg-red-50 rounded" aria-label="Delete session">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Classes & Sections */}
          <form onSubmit={handleCreateClassAdmin} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">5. Institutional Classes &amp; Sections</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Program</label>
                <select value={clsProgram} onChange={(e) => setClsProgram(e.target.value as 'madrasa' | 'qadri40')} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
                  <option value="madrasa">Madrasa</option>
                  <option value="qadri40">QADRI 40</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                <select required value={clsBranchId} onChange={(e) => setClsBranchId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
                  <option value="">Select Branch</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Academic Session</label>
                <select required value={clsSessionId} onChange={(e) => setClsSessionId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
                  <option value="">Select Session</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Division (Optional)</label>
                <select value={clsDivId} onChange={(e) => setClsDivId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
                  <option value="">Optional Division</option>
                  {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Class Name</label>
                <input type="text" required placeholder="e.g. Darja Oola / Class A" value={clsName} onChange={(e) => setClsName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Section (Optional)</label>
                <input type="text" placeholder="e.g. Section A" value={clsSection} onChange={(e) => setClsSection(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
            </div>
            <button type="submit" className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">Add Class / Section</button>
            {classes.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                {classes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                    <span>
                      <strong className="font-medium">{c.className} {c.sectionName ? `(${c.sectionName})` : ''}</strong> ·{' '}
                      <span className="uppercase text-slate-500">{c.programType}</span> ·{' '}
                      <span className="font-mono text-slate-500">{branches.find((b) => b.id === c.branchId)?.name || 'Branch'}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('classes', c.id, c.status, 'active', 'inactive', c.className)}
                        className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50"
                      >
                        {c.status}
                      </button>
                      {confirmDeleteKey === `cls:${c.id}` ? (
                        <>
                          <button type="button" onClick={() => handleDeleteMaster('classes', c.id, c.className)} className="px-2 py-0.5 bg-red-600 text-white rounded">Confirm</button>
                          <button type="button" onClick={() => setConfirmDeleteKey('')} className="px-2 py-0.5 border border-slate-200 rounded">No</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteKey(`cls:${c.id}`)} className="p-1 text-red-700 hover:bg-red-50 rounded" aria-label="Delete class">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
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
                          {confirmDeleteKey === `tim:${t.id}` ? (
                            <>
                              <button onClick={() => handleDeleteMaster('attendance_timings', t.id, t.scopeLabel || t.scopeId)} className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded-md">Confirm</button>
                              <button onClick={() => setConfirmDeleteKey('')} className="px-2 py-1 text-xs border border-slate-200 rounded-md">No</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDeleteKey(`tim:${t.id}`)} className="p-1 text-red-700 hover:bg-red-50 rounded-md" aria-label="Delete policy">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await saveAdminPin(newPin, hasAdminPin ? curPin : undefined);
              if (!res.ok) {
                notify(res.error || 'Failed to save Admin Security PIN.', 'error');
                return;
              }
              setCurPin('');
              setNewPin('');
              notify(
                newPin.trim()
                  ? 'Master Admin Security PIN saved.'
                  : 'Master Admin Security PIN cleared.',
                'success'
              );
            }}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-800" />
              <h3 className="text-base font-semibold text-slate-900">
                Admin Terminal Security PIN ({hasAdminPin ? 'Enabled' : 'Not Set'})
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Set a Master Admin PIN to lock Super Admin &amp; HR modules on shared client terminals.
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
        </div>
      )}
    </div>
  );
}
