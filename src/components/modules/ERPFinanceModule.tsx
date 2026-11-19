import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Landmark, Trash2 } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { FinanceEntry, formatCounter, formatCurrency } from '../../types';
import { exportToCsv, getTodayStr, makeSafeId, sanitizeStr } from '../../utils/validation';
import { CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

type ERPTab =
  | 'all'
  | 'account'
  | 'income'
  | 'expense'
  | 'budget'
  | 'fee'
  | 'asset'
  | 'consolidated';

export function ERPFinanceModule() {
  const {
    actorUid,
    branches,
    departments,
    financeLedger,
    eraseedReceipts,
    payrollRecords,
    systemConfigs,
    staffSessionEmployee,
    isHR,
    isPrincipal,
    isSuperAdmin,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
  } = useCMO();

  const masterCfg = systemConfigs.find((c) => c.configType === 'master');

  const [tab, setTab] = useState<ERPTab>('all');
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  const [entryType, setEntryType] = useState<FinanceEntry['entryType']>('income');
  const [institutionName, setInstitutionName] = useState(
    masterCfg?.institutionName || 'Markazi CMO'
  );
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [title, setTitle] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(getTodayStr());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!editingEntry && masterCfg?.institutionName) {
      setInstitutionName(masterCfg.institutionName);
    }
  }, [masterCfg?.institutionName, editingEntry]);

  const canWrite =
    isHR ||
    isPrincipal ||
    isSuperAdmin ||
    Boolean(staffSessionEmployee?.moduleAccess?.erp);

  const resetForm = () => {
    setEditingEntry(null);
    setEntryType('income');
    setInstitutionName(masterCfg?.institutionName || 'Markazi CMO');
    setBranchId('');
    setDepartmentId('');
    setTitle('');
    setAccountCode('');
    setCategory('');
    setAmount('');
    setEntryDate(getTodayStr());
    setNotes('');
  };

  const startEdit = (f: FinanceEntry) => {
    setEditingEntry(f);
    setEntryType(f.entryType);
    setInstitutionName(f.institutionName);
    setBranchId(f.branchId);
    setDepartmentId(f.departmentId || '');
    setTitle(f.title);
    setAccountCode(f.accountCode || '');
    setCategory(f.category);
    setAmount(String(f.amount));
    setEntryDate(f.entryDate);
    setNotes(f.notes || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid || !canWrite) return;
    if (!branchId) {
      notify('Select a branch.', 'error');
      return;
    }
    const cleanTitle = sanitizeStr(title, 160);
    const numAmt = Math.max(0, Number(amount) || 0);
    try {
      if (editingEntry) {
        await updateRecord(
          'finance_ledger',
          editingEntry.id,
          {
            entryType,
            institutionName: sanitizeStr(institutionName, 120),
            branchId,
            departmentId: departmentId || '',
            title: cleanTitle,
            accountCode: sanitizeStr(accountCode, 40),
            category: sanitizeStr(category, 100),
            amount: numAmt,
            fiscalMonth: entryDate.slice(0, 7),
            entryDate,
            notes: sanitizeStr(notes, 500),
          },
          {
            action: `Updated ERP ${entryType}`,
            module: 'ERP & Finance',
            details: `${cleanTitle} · ${numAmt}`,
          }
        );
        notify('Financial ledger entry updated.', 'success');
      } else {
        const id = makeSafeId('fin');
        await createRecord(
          'finance_ledger',
          id,
          {
            entryType,
            institutionName: sanitizeStr(institutionName, 120),
            branchId,
            departmentId: departmentId || '',
            title: cleanTitle,
            accountCode: sanitizeStr(accountCode, 40),
            category: sanitizeStr(category, 100),
            amount: numAmt,
            fiscalMonth: entryDate.slice(0, 7),
            entryDate,
            status: 'posted',
            notes: sanitizeStr(notes, 500),
            createdBy: actorUid,
          },
          {
            action: `Posted ERP ${entryType}`,
            module: 'ERP & Finance',
            details: `${cleanTitle} · ${numAmt}`,
          }
        );
        notify('Financial ledger entry posted.', 'success');
      }
      resetForm();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save entry.', 'error');
    }
  };

  const handleVoidEntry = async (f: FinanceEntry) => {
    try {
      await updateRecord(
        'finance_ledger',
        f.id,
        { status: 'cancelled' },
        { action: 'Voided ERP Entry', module: 'ERP & Finance', details: `${f.title} (${f.amount})` }
      );
      notify(`Entry "${f.title}" voided.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to void entry.', 'error');
    }
  };

  const handleDeleteEntry = async (f: FinanceEntry) => {
    if (!isSuperAdmin) return;
    try {
      await deleteRecord('finance_ledger', f.id, {
        action: 'Deleted ERP Entry',
        module: 'ERP & Finance',
        details: `Deleted ${f.title}`,
      });
      setConfirmDeleteId('');
      if (editingEntry?.id === f.id) resetForm();
      notify(`Entry "${f.title}" deleted.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const totals = useMemo(() => {
    const active = financeLedger.filter((f) => f.status !== 'cancelled');
    const sum = (t: FinanceEntry['entryType']) =>
      active.filter((f) => f.entryType === t).reduce((a, b) => a + b.amount, 0);
    const eraseedInflow = eraseedReceipts
      .filter((r) => r.status === 'active')
      .reduce((a, b) => a + b.amount, 0);
    const payrollOutflow = payrollRecords
      .filter((p) => p.status === 'paid')
      .reduce((a, b) => a + b.netPayable, 0);

    return {
      income: sum('income'),
      expense: sum('expense'),
      budget: sum('budget'),
      fees: sum('fee'),
      assets: sum('asset'),
      accounts: active.filter((f) => f.entryType === 'account').length,
      eraseedInflow,
      payrollOutflow,
    };
  }, [financeLedger, eraseedReceipts, payrollRecords]);

  const filteredEntries = useMemo(() => {
    if (tab === 'all' || tab === 'consolidated') return financeLedger;
    return financeLedger.filter((f) => f.entryType === tab);
  }, [financeLedger, tab]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="ERP & Institutional Finance"
        subtitle="Institution, Branch, Department, Accounts, Income, Expenses, Budget, Fees, Assets & Consolidated Reports"
        action={
          <button
            onClick={() =>
              exportToCsv(
                'markazi_cmo_finance.csv',
                ['Date', 'Type', 'Institution', 'Branch', 'Title', 'Category', 'Amount', 'Status'],
                financeLedger.map((f) => [
                  f.entryDate,
                  f.entryType,
                  f.institutionName,
                  branches.find((b) => b.id === f.branchId)?.name || f.branchId,
                  f.title,
                  f.category,
                  f.amount,
                  f.status,
                ])
              )
            }
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            Export Financial CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <CounterStat label="Ledger Income" value={formatCurrency(totals.income)} />
        <CounterStat label="Fees Collected" value={formatCurrency(totals.fees)} />
        <CounterStat label="Expenses" value={formatCurrency(totals.expense)} />
        <CounterStat label="Allocated Budget" value={formatCurrency(totals.budget)} />
        <CounterStat label="Asset Valuation" value={formatCurrency(totals.assets)} />
        <CounterStat label="Chart Accounts" value={totals.accounts} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            ['all', 'All Financial Records'],
            ['account', 'Accounts'],
            ['income', 'Income'],
            ['expense', 'Expenses'],
            ['budget', 'Budget'],
            ['fee', 'Fees'],
            ['asset', 'Assets'],
            ['consolidated', 'Consolidated Reports'],
          ] as [ERPTab, string][]
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

      {tab === 'consolidated' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Consolidated Institutional Financial Statement
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="p-3 bg-slate-50 font-semibold text-slate-800">Inflows</div>
              <div className="p-3 flex justify-between">
                <span>ERP Income</span>
                <span className="font-mono">{formatCurrency(totals.income)}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span>Student &amp; Institutional Fees</span>
                <span className="font-mono">{formatCurrency(totals.fees)}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span>E-Raseed Active Collections</span>
                <span className="font-mono">{formatCurrency(totals.eraseedInflow)}</span>
              </div>
              <div className="p-3 flex justify-between font-semibold bg-emerald-50/40">
                <span>Total Combined Inflows</span>
                <span className="font-mono">
                  {formatCurrency(totals.income + totals.fees + totals.eraseedInflow)}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="p-3 bg-slate-50 font-semibold text-slate-800">Outflows &amp; Budgets</div>
              <div className="p-3 flex justify-between">
                <span>ERP Recorded Expenses</span>
                <span className="font-mono">{formatCurrency(totals.expense)}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span>Paid HR Payroll</span>
                <span className="font-mono">{formatCurrency(totals.payrollOutflow)}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span>Allocated Budgets</span>
                <span className="font-mono">{formatCurrency(totals.budget)}</span>
              </div>
              <div className="p-3 flex justify-between font-semibold bg-slate-50">
                <span>Total Outflows</span>
                <span className="font-mono">{formatCurrency(totals.expense + totals.payrollOutflow)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form
            onSubmit={handleSave}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-800" />
                <h3 className="text-base font-semibold text-slate-900">
                  {editingEntry ? 'Edit ERP Entry' : 'Record ERP Entry'}
                </h3>
              </div>
              {editingEntry && (
                <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-900">
                  Cancel
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Entry Type</label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as FinanceEntry['entryType'])}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="account">Account</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="budget">Budget</option>
                  <option value="fee">Fee</option>
                  <option value="asset">Asset</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Institution</label>
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            {branches.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
                Setup required first: create at least one{' '}
                <span className="font-semibold">Branch</span> in{' '}
                <span className="font-semibold">Super Admin Control</span> before posting entries.
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All / Central</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Title / Particulars</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Acct Code</label>
                <input
                  type="text"
                  placeholder="ACC-101"
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <input
                  type="text"
                  required
                  placeholder="Tuition / Utilities"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={!canWrite}
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg"
            >
              {editingEntry ? 'Update Financial Entry' : 'Post Financial Entry'}
            </button>
          </form>

          <div className="xl:col-span-2">
            {filteredEntries.length === 0 ? (
              <EmptyState
                title="No Financial Records Posted"
                description="Use the form on the left to record accounts, income, expenses, budgets, fees, or institutional assets."
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Title &amp; Branch</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredEntries.map((f) => (
                        <tr key={f.id}>
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{f.entryDate}</td>
                          <td className="py-2.5 px-4 uppercase font-mono text-xs text-slate-600">{f.entryType}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900">{f.title}</div>
                            <div className="text-xs text-slate-500">
                              {branches.find((b) => b.id === f.branchId)?.name || f.branchId} · {f.category}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                            {formatCurrency(f.amount)}
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusTag status={f.status} />
                          </td>
                          <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                            {canWrite && f.status !== 'cancelled' && (
                              <button
                                onClick={() => startEdit(f)}
                                className="inline-flex items-center gap-1 text-xs text-emerald-800 hover:underline"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                            )}
                            {(isHR || isSuperAdmin) && f.status !== 'cancelled' && (
                              <button
                                onClick={() => handleVoidEntry(f)}
                                className="text-xs text-amber-700 hover:underline"
                              >
                                Void
                              </button>
                            )}
                            {isSuperAdmin &&
                              (confirmDeleteId === f.id ? (
                                <>
                                  <button
                                    onClick={() => handleDeleteEntry(f)}
                                    className="px-2 py-0.5 text-xs text-white bg-red-600 rounded"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId('')}
                                    className="px-2 py-0.5 text-xs border border-slate-200 rounded"
                                  >
                                    No
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(f.id)}
                                  className="inline-flex items-center text-xs text-red-700 hover:underline"
                                  aria-label="Delete entry"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              ))}
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
