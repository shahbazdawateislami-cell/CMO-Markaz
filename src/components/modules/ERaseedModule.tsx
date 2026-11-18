import React, { useMemo, useState } from 'react';
import { Printer, Receipt, Search } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { ERaseedReceipt, formatCounter, formatCurrency } from '../../types';
import { exportToCsv, getCurrentMonthStr, getTodayStr, makeSafeId, sanitizeStr } from '../../utils/validation';
import { CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

type ERaseedTab =
  | 'new_receipt'
  | 'recent'
  | 'search'
  | 'reports'
  | 'institutions'
  | 'settings';

export function ERaseedModule() {
  const {
    actorUid,
    branches,
    eraseedReceipts,
    systemConfigs,
    isHR,
    isSuperAdmin,
    createRecord,
    updateRecord,
    notify,
  } = useCMO();

  const [tab, setTab] = useState<ERaseedTab>('new_receipt');

  const eraseedConfig = systemConfigs.find((c) => c.configType === 'eraseed');
  const [receiptType, setReceiptType] = useState<'Receipt' | 'Donation' | 'Deposit'>('Donation');
  const [institutionName, setInstitutionName] = useState(
    eraseedConfig?.institutionName || 'Markazi CMO'
  );
  const [branchId, setBranchId] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [niyyat, setNiyyat] = useState('');
  const [category, setCategory] = useState('Zakat / Sadaqah / Madarsa Fund');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'Online'>('Cash');
  const [amount, setAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(getTodayStr());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  const [printTarget, setPrintTarget] = useState<ERaseedReceipt | null>(null);

  // Settings form
  const [cfgPrefix, setCfgPrefix] = useState(eraseedConfig?.receiptPrefix || 'ERS');
  const [cfgInstitution, setCfgInstitution] = useState(
    eraseedConfig?.institutionName || 'Markazi CMO'
  );
  const [cfgCurrency, setCfgCurrency] = useState(eraseedConfig?.defaultCurrency || 'INR');

  const handleIssueReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    const amt = Number(amount);
    if (!branchId || !Number.isFinite(amt) || amt <= 0) {
      notify('Select a branch and enter a valid positive amount.', 'error');
      return;
    }

    const prefix = eraseedConfig?.receiptPrefix || 'ERS';
    const receiptNo = `${prefix}-${receiptDate.replace(/-/g, '')}-${String(eraseedReceipts.length + 1).padStart(4, '0')}`;
    const id = makeSafeId('ers');

    try {
      await createRecord(
        'eraseed_receipts',
        id,
        {
          receiptNo,
          receiptType,
          institutionName: sanitizeStr(institutionName, 120),
          branchId,
          donorName: sanitizeStr(donorName, 120),
          donorPhone: sanitizeStr(donorPhone, 40),
          niyyat: sanitizeStr(niyyat, 120),
          category: sanitizeStr(category, 100),
          paymentMode,
          amount: amt,
          receiptDate,
          monthKey: receiptDate.slice(0, 7),
          status: 'active',
          issuedBy: actorUid,
        },
        {
          action: 'Issued E-Raseed Receipt',
          module: 'E-Raseed',
          details: `${receiptNo} · ${receiptType} · ${donorName} · ${amt}`,
        }
      );
      setDonorName('');
      setDonorPhone('');
      setNiyyat('');
      setAmount('');
      notify(`E-Raseed ${receiptNo} issued successfully.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to issue receipt.', 'error');
    }
  };

  const handleRefundCancel = async (rec: ERaseedReceipt, status: 'refunded' | 'cancelled') => {
    const reason = status === 'refunded' ? 'Refund processed by authority' : 'Receipt cancelled';
    try {
      await updateRecord(
        'eraseed_receipts',
        rec.id,
        { status, refundReason: reason },
        {
          action: `E-Raseed ${status}`,
          module: 'E-Raseed',
          details: `${rec.receiptNo} marked ${status}`,
        }
      );
      notify(`${rec.receiptNo} marked ${status}.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    try {
      await createRecord('system_config', 'eraseed_default', {
        configType: 'eraseed',
        institutionName: sanitizeStr(cfgInstitution, 120),
        receiptPrefix: sanitizeStr(cfgPrefix, 20),
        defaultCurrency: sanitizeStr(cfgCurrency, 12),
        updatedBy: actorUid,
      });
      notify('E-Raseed settings saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    }
  };

  const activeReceipts = useMemo(
    () => eraseedReceipts.filter((r) => r.status === 'active'),
    [eraseedReceipts]
  );

  const monthlyTotal = useMemo(
    () =>
      activeReceipts
        .filter((r) => r.monthKey === selectedMonth)
        .reduce((acc, r) => acc + r.amount, 0),
    [activeReceipts, selectedMonth]
  );

  const donationTotal = useMemo(
    () =>
      activeReceipts
        .filter((r) => r.receiptType === 'Donation')
        .reduce((acc, r) => acc + r.amount, 0),
    [activeReceipts]
  );

  const filteredSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return eraseedReceipts
      .filter(
        (r) =>
          !q ||
          r.receiptNo.toLowerCase().includes(q) ||
          r.donorName.toLowerCase().includes(q) ||
          r.niyyat.toLowerCase().includes(q) ||
          r.institutionName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
  }, [eraseedReceipts, searchQuery]);

  const byInstitution = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const r of activeReceipts) {
      const cur = map.get(r.institutionName) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.amount;
      map.set(r.institutionName, cur);
    }
    return Array.from(map.entries());
  }, [activeReceipts]);

  const byNiyyat = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const r of activeReceipts) {
      const cur = map.get(r.niyyat) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.amount;
      map.set(r.niyyat, cur);
    }
    return Array.from(map.entries());
  }, [activeReceipts]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="E-Raseed – Digital Receipts, Donations & Deposits"
        subtitle="Donor management, Niyyat tracking, receipt search, printing, refunds, and institutional collection reports"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CounterStat label="Total Active Receipts" value={activeReceipts.length} />
        <CounterStat
          label="Monthly Collection"
          value={formatCurrency(monthlyTotal, cfgCurrency)}
          subtext={`Month ${selectedMonth}`}
        />
        <CounterStat label="Total Donations" value={formatCurrency(donationTotal, cfgCurrency)} />
        <CounterStat label="Institutions Active" value={byInstitution.length} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            ['new_receipt', 'New Receipt / Donation / Deposit'],
            ['recent', 'Recent Receipts & Refund/Cancel'],
            ['search', 'Search & Print Receipt'],
            ['reports', 'Monthly, Donation & Niyyat Reports'],
            ['institutions', 'Institutions Report'],
            ['settings', 'E-Raseed Settings'],
          ] as [ERaseedTab, string][]
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

      {tab === 'new_receipt' && (
        <form
          onSubmit={handleIssueReceipt}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-3xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Receipt className="w-4 h-4 text-emerald-800" />
            <h3 className="text-base font-semibold text-slate-900">Issue New E-Raseed</h3>
          </div>

          {branches.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
              Setup required first: create at least one{' '}
              <span className="font-semibold">Branch</span> in{' '}
              <span className="font-semibold">Super Admin Control</span> before issuing receipts.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Entry Type</label>
              <select
                value={receiptType}
                onChange={(e) => setReceiptType(e.target.value as typeof receiptType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Receipt">New Receipt</option>
                <option value="Donation">Donation</option>
                <option value="Deposit">Deposit</option>
              </select>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Donor Name</label>
              <input
                type="text"
                required
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Donor Phone</label>
              <input
                type="text"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Niyyat</label>
              <input
                type="text"
                required
                placeholder="e.g. Zakat, Lillah, Sadqah, Construction"
                value={niyyat}
                onChange={(e) => setNiyyat(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Online">Online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                type="date"
                required
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            Issue E-Raseed
          </button>
        </form>
      )}

      {(tab === 'recent' || tab === 'search') && (
        <div className="space-y-4">
          {tab === 'search' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Receipt No, Donor Name, Niyyat, or Institution..."
                className="flex-1 text-sm focus:outline-none"
              />
            </div>
          )}

          {filteredSearch.length === 0 ? (
            <EmptyState
              title="No E-Raseed Receipts Found"
              description="Issued receipts, donations, and deposits appear here with print and refund controls."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Receipt No</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Donor &amp; Niyyat</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredSearch.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-800">{r.receiptNo}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{r.receiptDate}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{r.donorName}</div>
                          <div className="text-xs text-slate-500">Niyyat: {r.niyyat} · {r.institutionName}</div>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-700">{r.receiptType}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                          {formatCurrency(r.amount, cfgCurrency)}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={r.status} />
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => setPrintTarget(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                          >
                            <Printer className="w-3 h-3" /> Print
                          </button>
                          {(isHR || isSuperAdmin) && r.status === 'active' && (
                            <>
                              <button
                                onClick={() => handleRefundCancel(r, 'refunded')}
                                className="px-2 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md"
                              >
                                Refund
                              </button>
                              <button
                                onClick={() => handleRefundCancel(r, 'cancelled')}
                                className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                              >
                                Cancel
                              </button>
                            </>
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
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Monthly Collection Filter:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <button
              onClick={() =>
                exportToCsv(
                  `eraseed_${selectedMonth}.csv`,
                  ['Receipt No', 'Date', 'Type', 'Donor', 'Niyyat', 'Institution', 'Amount', 'Status'],
                  activeReceipts.map((r) => [
                    r.receiptNo,
                    r.receiptDate,
                    r.receiptType,
                    r.donorName,
                    r.niyyat,
                    r.institutionName,
                    r.amount,
                    r.status,
                  ])
                )
              }
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg"
            >
              Export Donation Report CSV
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Niyyat Breakdown</h4>
              {byNiyyat.length === 0 ? (
                <p className="text-xs text-slate-500">No active receipts recorded.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {byNiyyat.map(([niy, data]) => (
                    <div key={niy} className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-medium text-slate-800">{niy} ({formatCounter(data.count)})</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {formatCurrency(data.total, cfgCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Monthly Collection Summary</h4>
              <div className="text-2xl font-mono font-semibold text-slate-900">
                {formatCurrency(monthlyTotal, cfgCurrency)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Active receipts for {selectedMonth} ({formatCounter(activeReceipts.filter((r) => r.monthKey === selectedMonth).length)} entries)
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'institutions' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Institution Collection Report</h4>
          {byInstitution.length === 0 ? (
            <p className="text-xs text-slate-500">No institutional collections recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {byInstitution.map(([inst, info]) => (
                <div key={inst} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{inst}</div>
                    <div className="text-xs text-slate-500">{formatCounter(info.count)} active receipts</div>
                  </div>
                  <div className="font-mono font-semibold text-slate-900">
                    {formatCurrency(info.total, cfgCurrency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-xl"
        >
          <h3 className="text-base font-semibold text-slate-900">E-Raseed Configuration</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Institution Name</label>
            <input
              type="text"
              required
              value={cfgInstitution}
              onChange={(e) => setCfgInstitution(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Receipt Prefix</label>
              <input
                type="text"
                required
                value={cfgPrefix}
                onChange={(e) => setCfgPrefix(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Currency</label>
              <input
                type="text"
                required
                value={cfgCurrency}
                onChange={(e) => setCfgCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!(isHR || isSuperAdmin)}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg"
          >
            Save Settings
          </button>
        </form>
      )}

      {/* Printable Receipt Modal */}
      {printTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{printTarget.institutionName}</h3>
                <p className="text-xs text-slate-500 font-mono">Official E-Raseed · {printTarget.receiptNo}</p>
              </div>
              <StatusTag status={printTarget.status} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Date:</span><span className="font-mono">{printTarget.receiptDate}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Type:</span><span>{printTarget.receiptType}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Donor:</span><span className="font-medium">{printTarget.donorName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Niyyat:</span><span>{printTarget.niyyat}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Mode:</span><span>{printTarget.paymentMode}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-base font-semibold">
                <span>Total Amount</span>
                <span className="font-mono">{formatCurrency(printTarget.amount, cfgCurrency)}</span>
              </div>
            </div>
            <div className="no-print flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPrintTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
