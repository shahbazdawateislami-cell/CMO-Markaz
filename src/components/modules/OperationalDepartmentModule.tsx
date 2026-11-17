import React, { useMemo, useState } from 'react';
import { useCMO } from '../../context/CMOContext';
import { DepartmentCase, DepartmentCaseModule, formatCounter, formatCurrency } from '../../types';
import { exportToCsv, getTodayStr, makeSafeId, sanitizeStr } from '../../utils/validation';
import { CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

interface ModuleMeta {
  title: string;
  subtitle: string;
  codePrefix: string;
  categories: string[];
  statuses: string[];
  personLabel: string;
  showBudget?: boolean;
  deptType?: string;
}

const MODULE_META: Record<DepartmentCaseModule, ModuleMeta> = {
  darul_ifta: {
    title: 'Darul Ifta',
    subtitle: 'Fatwa inquiries, Mufti assignment, Shariah rulings, department users & reports',
    codePrefix: 'FTW',
    categories: ['Aqaid', 'Ibadat', 'Muamalat', 'Nikah & Talaq', 'Wirasat', 'Other'],
    statuses: ['Received', 'Under Research', 'Ruling Issued', 'Archived'],
    personLabel: 'Mustafti / Applicant',
    deptType: 'darul_ifta',
  },
  darul_qaza: {
    title: 'Dar-ul-Qaza',
    subtitle: 'Shariah arbitration cases, hearing schedules, Qazi decisions & department reports',
    codePrefix: 'QAZ',
    categories: ['Family Dispute', 'Financial Arbitration', 'Property', 'Nikah Dissolution', 'Other'],
    statuses: ['Filed', 'Hearing Scheduled', 'Mediation', 'Decided', 'Closed'],
    personLabel: 'Parties / Petitioner',
    deptType: 'darul_qaza',
  },
  darul_iqama: {
    title: 'Darul Iqama',
    subtitle: 'Hostel rooms, boarding residents, mess allocation, warden oversight & reports',
    codePrefix: 'IQM',
    categories: ['Room Allocation', 'Resident Check-In', 'Warden Inspection', 'Leave Pass', 'Maintenance'],
    statuses: ['Active Resident', 'Pending Check-In', 'Vacated', 'Maintenance'],
    personLabel: 'Resident / Room No',
    deptType: 'darul_iqama',
  },
  tahreek_bedari: {
    title: 'Tahreek-e-Bedari',
    subtitle: 'Awareness drives, outreach campaigns, speaker schedules & regional reports',
    codePrefix: 'TKB',
    categories: ['Ijtima / Seminar', 'Community Outreach', 'Youth Session', 'Literature Drive'],
    statuses: ['Planned', 'Active Campaign', 'Completed', 'Reported'],
    personLabel: 'Lead Coordinator',
    deptType: 'tahreek_bedari',
  },
  digital_library: {
    title: 'Digital Library',
    subtitle: 'Institutional book catalog, manuscripts, ISBN registry & branch distribution',
    codePrefix: 'LIB',
    categories: ['Tafsir', 'Hadith', 'Fiqh', 'Seerah', 'Tarbiyah', 'Reference'],
    statuses: ['Available', 'Cataloged', 'Reserved', 'Digitized'],
    personLabel: 'Author / Compiler',
  },
  online_courses: {
    title: 'Online Courses',
    subtitle: 'Virtual courses, instructors, curriculum modules & enrollment cohorts',
    codePrefix: 'CRS',
    categories: ['Dars-e-Nizami', 'Tajweed', 'Fiqh Essentials', 'Arabic Grammar', 'Teacher Training'],
    statuses: ['Open for Enrollment', 'In Progress', 'Completed', 'Draft'],
    personLabel: 'Lead Instructor',
  },
  project_existing: {
    title: 'Projects Existing',
    subtitle: 'Active institutional construction, expansion, and operational projects',
    codePrefix: 'PRJ',
    categories: ['Campus Expansion', 'Madrasa Operations', 'IT & Systems', 'Welfare'],
    statuses: ['In Progress', 'Phase Review', 'Operational', 'On Hold'],
    personLabel: 'Project Lead',
    showBudget: true,
  },
  project_upcoming: {
    title: 'Upcoming Project',
    subtitle: 'Planned institutional initiatives, feasibility approvals & target timelines',
    codePrefix: 'UPJ',
    categories: ['New Branch', 'Hostel Wing', 'Library Expansion', 'Digital Infrastructure'],
    statuses: ['Proposed', 'Feasibility Review', 'Approved for Launch', 'Deferred'],
    personLabel: 'Sponsor / Lead',
    showBudget: true,
  },
};

export function OperationalDepartmentModule({ moduleType }: { moduleType: DepartmentCaseModule }) {
  const {
    firebaseUser,
    branches,
    departments,
    users,
    departmentCases,
    isHR,
    isSuperAdmin,
    isDeptSupervisor,
    createRecord,
    updateRecord,
    notify,
  } = useCMO();

  const meta = MODULE_META[moduleType];
  const [subTab, setSubTab] = useState<'records' | 'users'>('records');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(meta.categories[0]);
  const [branchId, setBranchId] = useState('');
  const [personName, setPersonName] = useState('');
  const [status, setStatus] = useState(meta.statuses[0]);
  const [targetDate, setTargetDate] = useState(getTodayStr());
  const [budgetAmount, setBudgetAmount] = useState('');
  const [details, setDetails] = useState('');

  const records = useMemo(
    () => departmentCases.filter((c) => c.moduleType === moduleType),
    [departmentCases, moduleType]
  );

  const deptUsers = useMemo(() => {
    if (!meta.deptType) return [];
    const matchingDepts = new Set(
      departments.filter((d) => d.type === meta.deptType).map((d) => d.id)
    );
    return users.filter((u) => u.departmentId && matchingDepts.has(u.departmentId));
  }, [departments, users, meta.deptType]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const id = makeSafeId(meta.codePrefix.toLowerCase());
    const refCode = `${meta.codePrefix}-${String(records.length + 1).padStart(4, '0')}`;
    try {
      await createRecord(
        'department_cases',
        id,
        {
          moduleType,
          referenceCode: refCode,
          title: sanitizeStr(title, 160),
          category: sanitizeStr(category, 100),
          branchId: branchId || '',
          personName: sanitizeStr(personName, 120),
          details: sanitizeStr(details, 1500),
          status,
          targetDate,
          ...(meta.showBudget ? { budgetAmount: Math.max(0, Number(budgetAmount) || 0) } : {}),
          createdBy: firebaseUser.uid,
        },
        {
          action: `Created ${meta.title} Record`,
          module: meta.title,
          details: `${refCode}: ${sanitizeStr(title, 100)}`,
        }
      );
      setTitle('');
      setPersonName('');
      setDetails('');
      setBudgetAmount('');
      notify(`${meta.title} record ${refCode} saved.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save record.', 'error');
    }
  };

  const handleStatusChange = async (rec: DepartmentCase, nextStatus: string) => {
    try {
      await updateRecord(
        'department_cases',
        rec.id,
        { status: nextStatus },
        {
          action: `Updated ${meta.title} Status`,
          module: meta.title,
          details: `${rec.referenceCode} -> ${nextStatus}`,
        }
      );
      notify(`Updated ${rec.referenceCode} to ${nextStatus}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const totalBudget = useMemo(
    () => records.reduce((acc, r) => acc + (r.budgetAmount || 0), 0),
    [records]
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={meta.title}
        subtitle={meta.subtitle}
        action={
          <button
            onClick={() =>
              exportToCsv(
                `${moduleType}_report.csv`,
                ['Reference', 'Title', 'Category', meta.personLabel, 'Branch', 'Date', 'Status'],
                records.map((r) => [
                  r.referenceCode,
                  r.title,
                  r.category,
                  r.personName || '',
                  branches.find((b) => b.id === r.branchId)?.name || r.branchId || 'Central',
                  r.targetDate || '',
                  r.status,
                ])
              )
            }
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            Export Report CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CounterStat label="Total Records" value={records.length} />
        <CounterStat
          label={meta.statuses[0]}
          value={records.filter((r) => r.status === meta.statuses[0]).length}
        />
        <CounterStat
          label={meta.statuses[meta.statuses.length - 1]}
          value={records.filter((r) => r.status === meta.statuses[meta.statuses.length - 1]).length}
        />
        {meta.showBudget ? (
          <CounterStat label="Total Budget" value={formatCurrency(totalBudget)} />
        ) : (
          <CounterStat label="Department Staff" value={deptUsers.length} />
        )}
      </div>

      {meta.deptType && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setSubTab('records')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
              subTab === 'records'
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            Department Records
          </button>
          <button
            onClick={() => setSubTab('users')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
              subTab === 'users'
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            Department Users &amp; Permissions ({formatCounter(deptUsers.length)})
          </button>
        </div>
      )}

      {subTab === 'users' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          {deptUsers.length === 0 ? (
            <p className="text-sm text-slate-500">
              No users assigned specifically to {meta.title}. Assign users in HR Control Panel → User &amp; Access Control.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {deptUsers.map((u) => (
                <div key={u.uid} className="py-3 flex items-center justify-between">
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
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreate}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">Add {meta.title} Entry</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Title / Subject</label>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {meta.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Central CMO</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{meta.personLabel}</label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {meta.statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {meta.showBudget && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Budget Amount</label>
                  <input
                    type="number"
                    min={0}
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Details / Notes</label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              Save {meta.title} Entry
            </button>
          </form>

          <div className="xl:col-span-2">
            {records.length === 0 ? (
              <EmptyState
                title={`No ${meta.title} Records`}
                description={`Add your first ${meta.title} record using the form on the left.`}
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-4">Ref</th>
                        <th className="py-2.5 px-4">Title &amp; Category</th>
                        <th className="py-2.5 px-4">{meta.personLabel}</th>
                        {meta.showBudget && <th className="py-2.5 px-4 text-right">Budget</th>}
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{r.referenceCode}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900">{r.title}</div>
                            <div className="text-xs text-slate-500">
                              {r.category} · {r.targetDate || '-'}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">{r.personName || '-'}</td>
                          {meta.showBudget && (
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                              {formatCurrency(r.budgetAmount || 0)}
                            </td>
                          )}
                          <td className="py-2.5 px-4">
                            {isHR || isSuperAdmin || isDeptSupervisor || r.createdBy === firebaseUser?.uid ? (
                              <select
                                value={r.status}
                                onChange={(e) => handleStatusChange(r, e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                              >
                                {meta.statuses.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <StatusTag status={r.status} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
