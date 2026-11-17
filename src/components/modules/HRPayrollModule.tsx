import React, { useMemo, useState } from 'react';
import { Award, Check, FileText, Plus, UserCheck, Users, Wallet, X } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { Employee, EmployeeAttendance, formatCounter, formatCurrency } from '../../types';
import { getCurrentMonthStr, getTodayStr, makeSafeId, sanitizeStr } from '../../utils/validation';
import { AvatarFrame, CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

type HRTab =
  | 'registration'
  | 'onboarding'
  | 'payroll'
  | 'attendance'
  | 'leaves'
  | 'claims'
  | 'performance'
  | 'records';

export function HRPayrollModule() {
  const {
    firebaseUser,
    branches,
    departments,
    employees,
    employeeAttendance,
    leaveRequests,
    payrollRecords,
    expenseClaims,
    isHR,
    isPrincipal,
    isSuperAdmin,
    createRecord,
    updateRecord,
    uploadPhoto,
    notify,
  } = useCMO();

  const [tab, setTab] = useState<HRTab>('records');

  // Employee registration state
  const [empCode, setEmpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [joiningDate, setJoiningDate] = useState(getTodayStr());
  const [basicSalary, setBasicSalary] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [docInput, setDocInput] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);

  // Payroll month selection
  const [payrollMonth, setPayrollMonth] = useState(getCurrentMonthStr());

  // Performance & Achievement state
  const [achEmployeeId, setAchEmployeeId] = useState('');
  const [achText, setAchText] = useState('');

  // Selected employee profile drawer
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const url = await uploadPhoto(file, 'employees');
      setPhotoUrl(url);
      notify('Employee photo uploaded.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Photo upload failed.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRegisterEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !isHR) {
      notify('Only HR or Super Admin can register employees.', 'error');
      return;
    }
    if (!branchId || !departmentId) {
      notify('Select Branch and Department.', 'error');
      return;
    }
    const id = makeSafeId('emp');
    try {
      await createRecord(
        'employees',
        id,
        {
          employeeCode: sanitizeStr(empCode, 40),
          fullName: sanitizeStr(fullName, 120),
          email: sanitizeStr(email, 254),
          phone: sanitizeStr(phone, 40),
          cnic: sanitizeStr(cnic, 40),
          designation: sanitizeStr(designation, 120),
          departmentId,
          branchId,
          joiningDate,
          employmentStatus: 'active',
          onboardingStatus: 'recruitment',
          basicSalary: Math.max(0, Number(basicSalary) || 0),
          allowances: Math.max(0, Number(allowances) || 0),
          deductions: Math.max(0, Number(deductions) || 0),
          photoUrl: photoUrl || '',
          documents,
          achievements: [],
          createdBy: firebaseUser.uid,
        },
        {
          action: 'Registered Employee',
          module: 'HR & Payroll',
          details: `Registered ${sanitizeStr(fullName, 120)} (${sanitizeStr(empCode, 40)})`,
        }
      );
      setEmpCode('');
      setFullName('');
      setEmail('');
      setPhone('');
      setCnic('');
      setDesignation('');
      setBasicSalary('');
      setAllowances('');
      setDeductions('');
      setPhotoUrl('');
      setDocuments([]);
      notify('Employee registered successfully.', 'success');
      setTab('records');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Employee registration failed.', 'error');
    }
  };

  // Principal approves or rejects employee/teacher attendance
  const handleAttendanceDecision = async (rec: EmployeeAttendance, approve: boolean) => {
    if (!firebaseUser || !(isPrincipal || isSuperAdmin)) {
      notify('Only Principal or Super Admin can approve/reject teacher attendance.', 'error');
      return;
    }
    try {
      await updateRecord(
        'employee_attendance',
        rec.id,
        {
          approvalStatus: approve ? 'approved' : 'rejected',
          approvedBy: firebaseUser.uid,
          approvedAt: new Date().toISOString(),
          ...(approve ? {} : { rejectionReason: 'Rejected by Principal review' }),
          ...(rec.correctionRequested
            ? { correctionStatus: approve ? 'approved' : 'rejected' }
            : {}),
        },
        {
          action: approve ? 'Principal Approved Attendance' : 'Principal Rejected Attendance',
          module: 'HR & Payroll',
          details: `${rec.employeeName} (${rec.date}) -> ${approve ? 'approved' : 'rejected'}`,
        }
      );
      notify(
        approve
          ? 'Attendance approved and connected to HR & Payroll.'
          : 'Attendance rejected (excluded from payroll).',
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Approval update failed.', 'error');
    }
  };

  // Generate Payroll from Principal-Approved Attendance ONLY
  const handleGeneratePayroll = async () => {
    if (!firebaseUser || !isHR) return;
    if (employees.length === 0) {
      notify('No employees registered to generate payroll.', 'info');
      return;
    }
    let count = 0;
    for (const emp of employees) {
      const exists = payrollRecords.find(
        (p) => p.employeeId === emp.id && p.monthKey === payrollMonth
      );
      if (exists) continue;

      // STRICT RULE: Only count Principal-APPROVED attendance; rejected/pending never count as approved!
      const approvedLogs = employeeAttendance.filter(
        (a) =>
          a.employeeId === emp.id &&
          a.monthKey === payrollMonth &&
          a.approvalStatus === 'approved'
      );
      const approvedPresent = approvedLogs.filter(
        (a) => a.status === 'Present' || a.status === 'Leave'
      ).length;
      const lateDays = approvedLogs.filter((a) => a.status === 'Late').length;
      const halfDays = approvedLogs.filter((a) => a.status === 'Half Day').length;
      const absentDays = approvedLogs.filter((a) => a.status === 'Absent').length;

      const effectivePaidDays = approvedPresent + lateDays + halfDays * 0.5;
      const dailyRate = emp.basicSalary / 30;
      const earnedBasic =
        approvedLogs.length > 0 ? Math.round(dailyRate * effectivePaidDays) : emp.basicSalary;
      const net = Math.max(0, earnedBasic + (emp.allowances || 0) - (emp.deductions || 0));

      const id = makeSafeId('pay');
      await createRecord(
        'payroll_records',
        id,
        {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.fullName,
          branchId: emp.branchId,
          departmentId: emp.departmentId,
          monthKey: payrollMonth,
          basicSalary: emp.basicSalary,
          allowances: emp.allowances || 0,
          deductions: emp.deductions || 0,
          approvedDays: effectivePaidDays,
          lateDays,
          halfDays,
          absentDays,
          netPayable: net,
          status: 'processed',
          generatedBy: firebaseUser.uid,
        },
        {
          action: 'Generated Monthly Payroll',
          module: 'HR & Payroll',
          details: `Payroll ${payrollMonth} for ${emp.fullName} (Approved days: ${effectivePaidDays})`,
        }
      );
      count += 1;
    }
    notify(
      count > 0
        ? `Generated ${formatCounter(count)} payroll records for ${payrollMonth} using approved attendance.`
        : `Payroll already exists for all employees in ${payrollMonth}.`,
      'success'
    );
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === achEmployeeId);
    if (!emp || !achText.trim()) return;
    try {
      const updated = [...(emp.achievements || []), sanitizeStr(achText, 200)];
      await updateRecord(
        'employees',
        emp.id,
        { achievements: updated },
        {
          action: 'Added Employee Achievement',
          module: 'HR & Payroll',
          details: `${emp.fullName}: ${sanitizeStr(achText, 100)}`,
        }
      );
      setAchText('');
      notify('Performance achievement recorded.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save achievement.', 'error');
    }
  };

  const pendingAttCount = useMemo(
    () => employeeAttendance.filter((a) => a.approvalStatus === 'pending_principal').length,
    [employeeAttendance]
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="HR & Payroll Management"
        subtitle="Complete Employee Registration, Documents, Onboarding, Principal-Approved Attendance, Payroll, Leaves & Claims"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CounterStat label="Total Employees" value={employees.length} />
        <CounterStat label="Pending Attendance Approval" value={pendingAttCount} />
        <CounterStat label="Pending Leaves" value={leaveRequests.filter((l) => l.status === 'pending').length} />
        <CounterStat label="Pending Claims" value={expenseClaims.filter((c) => c.status === 'pending').length} />
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            ['records', 'Employee Records'],
            ['registration', 'Registration & Documents'],
            ['onboarding', 'Recruitment & Onboarding'],
            ['attendance', 'Employee Attendance (Principal Gate)'],
            ['payroll', 'Salary & Payroll'],
            ['leaves', 'Leave Management'],
            ['claims', 'Medical, Travel & Claims'],
            ['performance', 'Performance & Achievements'],
          ] as [HRTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              tab === k
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* EMPLOYEE RECORDS */}
      {tab === 'records' && (
        <div className="space-y-4">
          {employees.length === 0 ? (
            <EmptyState
              title="No Employee Records Yet"
              description="Register employees with Employee ID, Department, Branch, Salary, and Documents to begin."
              actionLabel={isHR ? 'Register Employee' : undefined}
              onAction={isHR ? () => setTab('registration') : undefined}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-4">Branch &amp; Department</th>
                      <th className="py-2.5 px-4">Onboarding</th>
                      <th className="py-2.5 px-4 text-right">Basic Salary</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {employees.map((emp) => (
                      <tr
                        key={emp.id}
                        onClick={() => setSelectedEmp(emp)}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{emp.employeeCode}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-3">
                            <AvatarFrame photoUrl={emp.photoUrl} alt={emp.fullName} size="sm" />
                            <div>
                              <div className="font-medium text-slate-900">{emp.fullName}</div>
                              <div className="text-xs text-slate-500">
                                {emp.designation} · {emp.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">
                          <div>{branches.find((b) => b.id === emp.branchId)?.name || emp.branchId}</div>
                          <div className="text-slate-400">
                            {departments.find((d) => d.id === emp.departmentId)?.name || emp.departmentId}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={emp.onboardingStatus} />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                          {formatCurrency(emp.basicSalary)}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={emp.employmentStatus} />
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

      {/* REGISTRATION & DOCUMENTS */}
      {tab === 'registration' && (
        <form
          onSubmit={handleRegisterEmployee}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 max-w-4xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-900">
              Employee Registration, Profile &amp; Documents
            </h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Employee Photo (Empty until uploaded)
            </label>
            <AvatarFrame
              photoUrl={photoUrl}
              alt="Employee photo"
              size="lg"
              onUpload={handlePhotoUpload}
              uploading={uploadingPhoto}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Employee ID / Code</label>
              <input
                type="text"
                required
                placeholder="EMP-001"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Official Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CNIC / National ID</label>
              <input
                type="text"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Designation</label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Teacher, Mufti, Clerk"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Joining Date</label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Basic Salary</label>
              <input
                type="number"
                min={0}
                required
                value={basicSalary}
                onChange={(e) => setBasicSalary(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Allowances</label>
              <input
                type="number"
                min={0}
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Standard Deductions</label>
              <input
                type="number"
                min={0}
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Documents Checklist / References
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. CNIC Copy Verified, Shahadah Alimiyyah Degree"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  if (docInput.trim()) {
                    setDocuments((prev) => [...prev, sanitizeStr(docInput, 120)]);
                    setDocInput('');
                  }
                }}
                className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {documents.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {documents.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-700"
                  >
                    <FileText className="w-3 h-3" /> {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!isHR}
            className="px-5 py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg"
          >
            Save Employee Record
          </button>
        </form>
      )}

      {/* RECRUITMENT & ONBOARDING */}
      {tab === 'onboarding' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {employees.length === 0 ? (
            <EmptyState
              title="No Onboarding Candidates"
              description="Registered employees start in Recruitment and advance through Onboarding to Completed."
            />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Designation</th>
                  <th className="py-2.5 px-4">Stage</th>
                  <th className="py-2.5 px-4 text-right">Advance Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="py-2.5 px-4 font-mono text-xs">{emp.employeeCode}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{emp.fullName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{emp.designation}</td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={emp.onboardingStatus} />
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      {isHR && emp.onboardingStatus === 'recruitment' && (
                        <button
                          onClick={() =>
                            updateRecord('employees', emp.id, { onboardingStatus: 'onboarding' })
                          }
                          className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                        >
                          Move to Onboarding
                        </button>
                      )}
                      {isHR && emp.onboardingStatus === 'onboarding' && (
                        <button
                          onClick={() =>
                            updateRecord('employees', emp.id, { onboardingStatus: 'completed' })
                          }
                          className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                        >
                          Mark Completed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* EMPLOYEE ATTENDANCE & PRINCIPAL APPROVAL */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
            Teacher &amp; Employee Attendance Workflow: Staff mark manual attendance in ESS → Principal approves or rejects → Rejected attendance does NOT count toward Payroll.
          </div>
          {employeeAttendance.length === 0 ? (
            <EmptyState
              title="No Employee Attendance Logs"
              description="Manual attendance marked by teachers and staff in ESS will appear here for Principal approval."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Date &amp; Time</th>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Approval Status</th>
                      <th className="py-2.5 px-4">Correction</th>
                      <th className="py-2.5 px-4 text-right">Principal Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {employeeAttendance.map((rec) => (
                      <tr key={rec.id}>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-700">
                          {rec.date} · {rec.markedTime}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{rec.employeeName}</td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={rec.status} />
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={rec.approvalStatus} />
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">
                          {rec.correctionRequested ? rec.correctionReason : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {(isPrincipal || isSuperAdmin) && (
                            <>
                              <button
                                onClick={() => handleAttendanceDecision(rec, true)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-md"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleAttendanceDecision(rec, false)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                              >
                                <X className="w-3 h-3" /> Reject
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

      {/* SALARY & PAYROLL */}
      {tab === 'payroll' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Wallet className="w-4 h-4 text-emerald-800" />
              <label className="text-xs font-medium text-slate-600">Payroll Month:</label>
              <input
                type="month"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            {isHR && (
              <button
                onClick={handleGeneratePayroll}
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
              >
                Generate Payroll from Approved Attendance
              </button>
            )}
          </div>

          {payrollRecords.length === 0 ? (
            <EmptyState
              title="No Payroll Records Generated"
              description="Click 'Generate Payroll from Approved Attendance' to compute salaries strictly from Principal-approved attendance."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Month</th>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-4 text-right">Approved Days</th>
                      <th className="py-2.5 px-4 text-right">Basic</th>
                      <th className="py-2.5 px-4 text-right">Net Payable</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {payrollRecords.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-4 font-mono text-xs">{p.monthKey}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {p.employeeName} <span className="font-mono text-xs text-slate-400">({p.employeeCode})</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {formatCounter(p.approvedDays)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {formatCurrency(p.basicSalary)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatCurrency(p.netPayable)}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={p.status} />
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {isHR && p.status !== 'paid' && (
                            <button
                              onClick={() => updateRecord('payroll_records', p.id, { status: 'paid' })}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                            >
                              Mark Paid
                            </button>
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

      {/* LEAVE MANAGEMENT */}
      {tab === 'leaves' && (
        <div>
          {leaveRequests.length === 0 ? (
            <EmptyState
              title="No Leave Requests"
              description="Leave applications submitted by employees in ESS appear here for HR/Principal approval."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Dates</th>
                    <th className="py-2.5 px-4">Reason</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {leaveRequests.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{l.employeeName}</td>
                      <td className="py-2.5 px-4">{l.leaveType}</td>
                      <td className="py-2.5 px-4 font-mono text-xs">{l.startDate} to {l.endDate}</td>
                      <td className="py-2.5 px-4 text-slate-600">{l.reason}</td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={l.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5">
                        {(isHR || isPrincipal) && l.status === 'pending' && (
                          <>
                            <button
                              onClick={() =>
                                updateRecord('leave_requests', l.id, {
                                  status: 'approved',
                                  reviewedBy: firebaseUser?.uid,
                                  reviewedAt: new Date().toISOString(),
                                })
                              }
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                updateRecord('leave_requests', l.id, {
                                  status: 'rejected',
                                  reviewedBy: firebaseUser?.uid,
                                  reviewedAt: new Date().toISOString(),
                                })
                              }
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CLAIMS */}
      {tab === 'claims' && (
        <div>
          {expenseClaims.length === 0 ? (
            <EmptyState
              title="No Expense Claims"
              description="Medical, Travel, and Other claims submitted in ESS appear here."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {expenseClaims.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 px-4 font-mono text-xs">{c.claimDate}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{c.employeeName}</td>
                      <td className="py-2.5 px-4">{c.claimType}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatCurrency(c.amount)}</td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={c.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5">
                        {isHR && c.status === 'pending' && (
                          <>
                            <button
                              onClick={() =>
                                updateRecord('expense_claims', c.id, {
                                  status: 'approved',
                                  reviewedBy: firebaseUser?.uid,
                                })
                              }
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                updateRecord('expense_claims', c.id, {
                                  status: 'rejected',
                                  reviewedBy: firebaseUser?.uid,
                                })
                              }
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isHR && c.status === 'approved' && (
                          <button
                            onClick={() => updateRecord('expense_claims', c.id, { status: 'paid' })}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md"
                          >
                            Mark Paid
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
      )}

      {/* PERFORMANCE & ACHIEVEMENTS */}
      {tab === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleAddAchievement}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-800" />
              <h3 className="text-base font-semibold text-slate-900">Log Performance Achievement</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Employee</label>
              <select
                required
                value={achEmployeeId}
                onChange={(e) => setAchEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Choose Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} – {e.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Achievement / Milestone</label>
              <textarea
                required
                rows={3}
                value={achText}
                onChange={(e) => setAchText(e.target.value)}
                placeholder="e.g. 100% Punctuality Award Q4, Exemplary Class Results"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={!isHR}
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg"
            >
              Record Achievement
            </button>
          </form>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {employees.filter((e) => (e.achievements || []).length > 0).length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No employee achievements logged yet.
              </div>
            ) : (
              employees
                .filter((e) => (e.achievements || []).length > 0)
                .map((emp) => (
                  <div key={emp.id} className="p-4">
                    <div className="font-medium text-sm text-slate-900">
                      {emp.fullName} <span className="font-mono text-xs text-slate-400">({emp.employeeCode})</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
                      {(emp.achievements || []).map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Employee Profile Detail Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                <AvatarFrame photoUrl={selectedEmp.photoUrl} alt={selectedEmp.fullName} size="lg" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedEmp.fullName}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedEmp.employeeCode} · {selectedEmp.designation}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmp(null)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Email:</span> <span className="font-medium">{selectedEmp.email}</span></div>
              <div><span className="text-slate-500">Phone:</span> <span className="font-mono">{selectedEmp.phone || '-'}</span></div>
              <div><span className="text-slate-500">CNIC:</span> <span className="font-mono">{selectedEmp.cnic || '-'}</span></div>
              <div><span className="text-slate-500">Joined:</span> <span className="font-mono">{selectedEmp.joiningDate}</span></div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-1">Documents</h4>
              {(selectedEmp.documents || []).length === 0 ? (
                <p className="text-xs text-slate-400">No documents attached.</p>
              ) : (
                <ul className="text-xs text-slate-600 space-y-1">
                  {selectedEmp.documents?.map((d, i) => <li key={i}>• {d}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
