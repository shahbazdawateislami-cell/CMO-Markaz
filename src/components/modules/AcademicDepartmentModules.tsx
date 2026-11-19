import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { AcademicClass, formatCounter } from '../../types';
import { exportToCsv, makeSafeId, sanitizeStr } from '../../utils/validation';
import { AvatarFrame, CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';
import { StudentAttendanceWorkspace } from './StudentAttendanceWorkspace';

type DeptTab = 'dashboard' | 'attendance' | 'structure' | 'students' | 'users_reports';

export function AcademicDepartmentModule({
  programType,
}: {
  programType: 'madrasa' | 'qadri40';
}) {
  const {
    actorUid,
    divisions,
    branches,
    departments,
    sessions,
    classes,
    students,
    studentAttendance,
    users,
    employees,
    isHR,
    isPrincipal,
    isSuperAdmin,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
  } = useCMO();

  const [tab, setTab] = useState<DeptTab>('attendance');
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState('');

  // Class / Section / Course / Batch builder state
  const [divisionId, setDivisionId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [className, setClassName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [teacherUid, setTeacherUid] = useState('');

  const deptSlug = programType === 'madrasa' ? 'madrasas' : 'qadri40';
  const deptTitle = programType === 'madrasa' ? 'Madrasas Department' : 'QADRI 40 Department';
  const deptSubtitle =
    programType === 'madrasa'
      ? 'Division → Branch → Class → Section → Students · Dedicated Student Attendance & Supervisor Records'
      : 'Course → Batch → Class → Students · Dedicated Student Attendance & Supervisor Records';

  const deptClasses = useMemo(
    () => classes.filter((c) => c.programType === programType),
    [classes, programType]
  );

  const deptStudents = useMemo(
    () => students.filter((s) => s.programType === programType),
    [students, programType]
  );

  const deptAttendance = useMemo(
    () => studentAttendance.filter((a) => a.programType === programType),
    [studentAttendance, programType]
  );

  const deptRecords = useMemo(
    () => departments.filter((d) => d.type === deptSlug),
    [departments, deptSlug]
  );

  const deptUsers = useMemo(() => {
    const deptIds = new Set(deptRecords.map((d) => d.id));
    return users.filter((u) => u.departmentId && deptIds.has(u.departmentId));
  }, [users, deptRecords]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid || !(isHR || isPrincipal || isSuperAdmin)) {
      notify('HR, Principal, or Super Admin required to create academic classes.', 'error');
      return;
    }
    if (!branchId || !sessionId) {
      notify('Select Branch and Academic Session.', 'error');
      return;
    }
    const id = makeSafeId('cls');
    try {
      await createRecord(
        'classes',
        id,
        {
          programType,
          divisionId: divisionId || '',
          branchId,
          courseName: sanitizeStr(courseName, 120),
          batchName: sanitizeStr(batchName, 120),
          className: sanitizeStr(className, 120),
          sectionName: sanitizeStr(sectionName, 60),
          sessionId,
          teacherUid: teacherUid || '',
          status: 'active',
          createdBy: actorUid,
        },
        {
          action: `Created ${deptTitle} Class`,
          module: deptTitle,
          details: `${sanitizeStr(className, 80)} ${sectionName ? `Sec ${sectionName}` : ''}`,
        }
      );
      setCourseName('');
      setBatchName('');
      setClassName('');
      setSectionName('');
      notify('Class structure saved to central database.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create class.', 'error');
    }
  };

  const handleToggleClassStatus = async (c: AcademicClass) => {
    if (!(isHR || isPrincipal || isSuperAdmin)) return;
    const next = c.status === 'active' ? 'inactive' : 'active';
    try {
      await updateRecord('classes', c.id, { status: next }, {
        action: `Toggled ${deptTitle} Class Status`,
        module: deptTitle,
        details: `${c.className} -> ${next}`,
      });
      notify(`${c.className} marked ${next}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update class status.', 'error');
    }
  };

  const handleDeleteClass = async (c: AcademicClass) => {
    if (!isSuperAdmin) return;
    try {
      await deleteRecord('classes', c.id, {
        action: `Deleted ${deptTitle} Class`,
        module: deptTitle,
        details: `Deleted ${c.className}`,
      });
      setConfirmDeleteClassId('');
      notify(`Deleted class ${c.className}.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete class.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={deptTitle}
        subtitle={deptSubtitle}
        action={
          <button
            onClick={() =>
              exportToCsv(
                `${deptSlug}_attendance_report.csv`,
                ['Date', 'Roll No', 'Student', 'Status', 'Approval'],
                deptAttendance.map((r) => [r.date, r.rollNo, r.studentName, r.status, r.approvalStatus])
              )
            }
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            Export Department Report
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CounterStat label="Classes / Batches" value={deptClasses.length} />
        <CounterStat label="Active Students" value={deptStudents.length} />
        <CounterStat label="Attendance Logs" value={deptAttendance.length} />
        <CounterStat
          label="Pending Supervisor Approval"
          value={deptAttendance.filter((a) => a.approvalStatus === 'pending_supervisor').length}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            ['attendance', 'Student Attendance System'],
            ['dashboard', 'Department Dashboard'],
            ['structure', programType === 'madrasa' ? 'Classes & Sections' : 'Courses, Batches & Classes'],
            ['students', 'Enrolled Student Records'],
            ['users_reports', 'Department Users, Permissions & Reports'],
          ] as [DeptTab, string][]
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

      {tab === 'attendance' && <StudentAttendanceWorkspace programType={programType} />}

      {tab === 'dashboard' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            {deptTitle} – Connected to Central Markazi CMO
          </h3>
          <p className="text-sm text-slate-600">
            {programType === 'madrasa'
              ? 'Operates through Division → Branch → Class → Section → Students hierarchy. Admissions become active only after Super Admin final approval.'
              : 'Operates through Course → Batch → Class → Students hierarchy. Daily student attendance flows to Department Supervisor approval and permanent session history.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="text-xs text-slate-500">Approved Attendance Records</div>
              <div className="mt-1 font-mono text-xl font-semibold">
                {formatCounter(deptAttendance.filter((a) => a.approvalStatus === 'approved').length)}
              </div>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="text-xs text-slate-500">Assigned Teachers / Staff</div>
              <div className="mt-1 font-mono text-xl font-semibold">{formatCounter(deptUsers.length)}</div>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="text-xs text-slate-500">Linked Branches</div>
              <div className="mt-1 font-mono text-xl font-semibold">
                {formatCounter(new Set(deptClasses.map((c) => c.branchId)).size)}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'structure' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateClass}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">
              {programType === 'madrasa' ? 'Create Madrasa Class / Section' : 'Create QADRI 40 Course / Batch / Class'}
            </h3>

            {(branches.length === 0 || sessions.length === 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
                Setup required first: create a <span className="font-semibold">Branch</span> and{' '}
                <span className="font-semibold">Academic Session</span> in{' '}
                <span className="font-semibold">Super Admin Control</span> first.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                <select
                  required
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Session</label>
                <select
                  required
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {programType === 'madrasa' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Division</label>
                <select
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Optional Division</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Course Name</label>
                  <input
                    type="text"
                    required
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g. Qadri 40 Leadership"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Batch</label>
                  <input
                    type="text"
                    required
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="Batch-01"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Class Name</label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Darja Oola / Class A"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="e.g. A"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assigned Teacher</label>
              <select
                value={teacherUid}
                onChange={(e) => setTeacherUid(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Assign later</option>
                {users
                  .filter((u) => u.role === 'teacher' || u.role === 'principal')
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.role})
                    </option>
                  ))}
                {employees
                  .filter((emp) => !users.some((u) => u.uid === emp.uid || u.employeeId === emp.id))
                  .map((emp) => (
                    <option key={emp.id} value={emp.uid || emp.id}>
                      {emp.fullName} ({emp.designation || emp.employeeCode})
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!(isHR || isPrincipal || isSuperAdmin)}
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg"
            >
              Save Class
            </button>
          </form>

          <div className="lg:col-span-2">
            {deptClasses.length === 0 ? (
              <EmptyState
                title="No Classes Configured"
                description="Create classes/sections (Madrasas) or courses/batches (QADRI 40) on the left."
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Class</th>
                      <th className="py-2.5 px-4">Branch / Course</th>
                      <th className="py-2.5 px-4">Session</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {deptClasses.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {c.className} {c.sectionName ? `· Sec ${c.sectionName}` : ''}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">
                          {programType === 'madrasa'
                            ? branches.find((b) => b.id === c.branchId)?.name || c.branchId
                            : `${c.courseName || ''} / ${c.batchName || ''}`}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono text-slate-600">
                          {sessions.find((s) => s.id === c.sessionId)?.name || c.sessionId}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={c.status} />
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {(isHR || isPrincipal || isSuperAdmin) && (
                            <button
                              onClick={() => handleToggleClassStatus(c)}
                              className="px-2 py-0.5 text-xs border border-slate-200 rounded hover:bg-slate-50"
                            >
                              {c.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          {isSuperAdmin &&
                            (confirmDeleteClassId === c.id ? (
                              <>
                                <button onClick={() => handleDeleteClass(c)} className="px-2 py-0.5 text-xs bg-red-600 text-white rounded">Confirm</button>
                                <button onClick={() => setConfirmDeleteClassId('')} className="px-2 py-0.5 text-xs border border-slate-200 rounded">No</button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteClassId(c.id)}
                                className="p-1 text-red-700 hover:bg-red-50 rounded"
                                aria-label="Delete class"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ))}
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

      {tab === 'students' && (
        <div>
          {deptStudents.length === 0 ? (
            <EmptyState
              title="No Enrolled Students"
              description="Students appear here once their Online Admission receives Super Admin Final Approval."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Roll No</th>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Class / Batch</th>
                    <th className="py-2.5 px-4">Guardian Phone</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {deptStudents.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-4 font-mono text-xs">{s.rollNo}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <AvatarFrame photoUrl={s.photoUrl} alt={s.studentName} size="sm" />
                          <div>
                            <div className="font-medium text-slate-900">{s.studentName}</div>
                            <div className="text-xs text-slate-500">S/D/o {s.fatherName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        {s.className} {s.sectionName ? `Sec ${s.sectionName}` : ''} {s.batchName || ''}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs">{s.guardianPhone || '-'}</td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'users_reports' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-900">Department Assigned Users &amp; Permissions</h4>
          {deptUsers.length === 0 ? (
            <p className="text-xs text-slate-500">
              No users explicitly scoped to {deptTitle} yet. Assign users under HR Control Panel → User &amp; Access Control.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {deptUsers.map((u) => (
                <div key={u.uid} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{u.displayName}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>
                  <StatusTag status={u.role} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
