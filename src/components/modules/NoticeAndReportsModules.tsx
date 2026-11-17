import React, { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { formatCounter, formatCurrency } from '../../types';
import { exportToCsv, makeSafeId, sanitizeStr } from '../../utils/validation';
import { CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

export function NoticeBoardModule() {
  const {
    firebaseUser,
    userProfile,
    branches,
    departments,
    notices,
    isHR,
    isPrincipal,
    isTeacher,
    isDeptSupervisor,
    isSuperAdmin,
    createRecord,
    updateRecord,
    notify,
  } = useCMO();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'All Staff' | 'Teachers' | 'HR & Principals' | 'Department Specific'>('All Staff');
  const [priority, setPriority] = useState<'Normal' | 'Important' | 'Urgent'>('Normal');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const canPublish = isHR || isPrincipal || isTeacher || isDeptSupervisor || isSuperAdmin;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !canPublish) return;
    const id = makeSafeId('not');
    try {
      await createRecord(
        'notices',
        id,
        {
          title: sanitizeStr(title, 160),
          body: sanitizeStr(body, 2000),
          audience,
          branchId: branchId || '',
          departmentId: departmentId || '',
          priority,
          publishedBy: firebaseUser.uid,
          publishedByName: userProfile?.displayName || firebaseUser.email || 'Admin',
          status: 'published',
        },
        {
          action: 'Published Notice',
          module: 'Notice Board',
          details: `${sanitizeStr(title, 100)} (${audience})`,
        }
      );
      setTitle('');
      setBody('');
      notify('Notice published to institutional board.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to publish notice.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Institutional Notice Board"
        subtitle="Central CMO circulars, branch announcements, and department communications"
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {canPublish && (
          <form
            onSubmit={handlePublish}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Megaphone className="w-4 h-4 text-emerald-800" />
              <h3 className="text-base font-semibold text-slate-900">Publish Notice</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notice Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as typeof audience)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="All Staff">All Staff</option>
                  <option value="Teachers">Teachers</option>
                  <option value="HR & Principals">HR &amp; Principals</option>
                  <option value="Department Specific">Department Specific</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Normal">Normal</option>
                  <option value="Important">Important</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch Scope</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Department Scope</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Circular Content</label>
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              Publish Circular
            </button>
          </form>
        )}

        <div className={canPublish ? 'xl:col-span-2 space-y-3' : 'xl:col-span-3 space-y-3'}>
          {notices.length === 0 ? (
            <EmptyState
              title="Notice Board is Empty"
              description="Official institutional circulars and announcements will appear here once published."
            />
          ) : (
            notices.map((n) => (
              <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">{n.title}</h4>
                    <div className="mt-1 text-xs text-slate-500">
                      Audience: {n.audience} · By {n.publishedByName || 'Administration'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusTag
                      status={n.priority}
                      tone={n.priority === 'Urgent' ? 'red' : n.priority === 'Important' ? 'amber' : 'slate'}
                    />
                    <StatusTag status={n.status} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{n.body}</p>
                {(isHR || isSuperAdmin) && n.status === 'published' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-right">
                    <button
                      onClick={() => updateRecord('notices', n.id, { status: 'archived' })}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Archive Notice
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function ReportsAnalyticsModule() {
  const {
    branches,
    departments,
    employees,
    students,
    admissions,
    employeeAttendance,
    studentAttendance,
    payrollRecords,
    eraseedReceipts,
    financeLedger,
    departmentCases,
  } = useCMO();

  const totalERaseed = eraseedReceipts
    .filter((r) => r.status === 'active')
    .reduce((a, b) => a + b.amount, 0);
  const totalPayroll = payrollRecords.reduce((a, b) => a + b.netPayable, 0);
  const totalIncome = financeLedger
    .filter((f) => (f.entryType === 'income' || f.entryType === 'fee') && f.status !== 'cancelled')
    .reduce((a, b) => a + b.amount, 0);
  const totalExpense = financeLedger
    .filter((f) => f.entryType === 'expense' && f.status !== 'cancelled')
    .reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reports & Institutional Analytics"
        subtitle="Cross-branch, multi-department consolidated intelligence connected to live Firestore data"
        action={
          <button
            onClick={() =>
              exportToCsv(
                'markazi_cmo_branch_summary.csv',
                ['Branch', 'City', 'Employees', 'Students', 'Admissions', 'E-Raseed Total'],
                branches.map((b) => [
                  b.name,
                  b.city,
                  employees.filter((e) => e.branchId === b.id).length,
                  students.filter((s) => s.branchId === b.id).length,
                  admissions.filter((a) => a.branchId === b.id).length,
                  eraseedReceipts
                    .filter((r) => r.branchId === b.id && r.status === 'active')
                    .reduce((acc, r) => acc + r.amount, 0),
                ])
              )
            }
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            Export Consolidated CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <CounterStat label="Branches" value={branches.length} />
        <CounterStat label="Departments" value={departments.length} />
        <CounterStat label="Employees" value={employees.length} />
        <CounterStat label="Active Students" value={students.length} />
        <CounterStat label="Student Att. Logs" value={studentAttendance.length} />
        <CounterStat label="Employee Att. Logs" value={employeeAttendance.length} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CounterStat label="E-Raseed Active Total" value={formatCurrency(totalERaseed)} />
        <CounterStat label="ERP Income & Fees" value={formatCurrency(totalIncome)} />
        <CounterStat label="ERP Expenses" value={formatCurrency(totalExpense)} />
        <CounterStat label="Total Payroll Run" value={formatCurrency(totalPayroll)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
          Branch-Wise Operational Matrix
        </div>
        {branches.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No branches registered yet. Create branches in Super Admin Authority or HR Control Panel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Branch</th>
                  <th className="py-2.5 px-4">City</th>
                  <th className="py-2.5 px-4 text-right">Employees</th>
                  <th className="py-2.5 px-4 text-right">Students</th>
                  <th className="py-2.5 px-4 text-right">Admissions</th>
                  <th className="py-2.5 px-4 text-right">Dept Cases</th>
                  <th className="py-2.5 px-4 text-right">E-Raseed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{b.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{b.city}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatCounter(employees.filter((e) => e.branchId === b.id).length)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatCounter(students.filter((s) => s.branchId === b.id).length)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatCounter(admissions.filter((a) => a.branchId === b.id).length)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatCounter(departmentCases.filter((c) => c.branchId === b.id).length)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(
                        eraseedReceipts
                          .filter((r) => r.branchId === b.id && r.status === 'active')
                          .reduce((acc, r) => acc + r.amount, 0)
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
  );
}
