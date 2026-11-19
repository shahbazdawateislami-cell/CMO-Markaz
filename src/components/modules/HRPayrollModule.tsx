import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import {
  Employee,
  EmployeeAttendance,
  EmployeeModuleAccess,
  formatCounter,
  formatCurrency,
} from '../../types';
import { hashCredential } from '../../utils/authHash';
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

const DEFAULT_MODULE_ACCESS: EmployeeModuleAccess = {
  ess: true,
  erp: false,
  e_raseed: false,
  teacher_management: true,
  madrasas: true,
  qadri_40: true,
  online_admission: true,
  notice_board: true,
  reports_analytics: false,
};

export function HRPayrollModule() {
  const {
    actorUid,
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
    deleteRecord,
    uploadPhoto,
    notify,
  } = useCMO();

  const [tab, setTab] = useState<HRTab>('records');

  // Edit mode state
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmDeleteEmpId, setConfirmDeleteEmpId] = useState<string>('');
  const [confirmDeletePayId, setConfirmDeletePayId] = useState<string>('');

  // Employee registration / edit form state
  const [empCode, setEmpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [joiningDate, setJoiningDate] = useState(getTodayStr());
  const [employmentStatus, setEmploymentStatus] = useState<Employee['employmentStatus']>('active');
  const [basicSalary, setBasicSalary] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [docInput, setDocInput] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);

  // Credentials & Portal Permissions (ESS, ERP, E-Raseed, etc.)
  const [staffRole, setStaffRole] = useState<NonNullable<Employee['staffRole']>>('teacher');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(true);
  const [moduleAccess, setModuleAccess] = useState<EmployeeModuleAccess>(DEFAULT_MODULE_ACCESS);

  // Payroll month selection
  const [payrollMonth, setPayrollMonth] = useState(getCurrentMonthStr());

  // Performance & Achievement state
  const [achEmployeeId, setAchEmployeeId] = useState('');
  const [achText, setAchText] = useState('');

  // Selected employee profile drawer
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const pendingAttCount = useMemo(
    () => employeeAttendance.filter((a) => a.approvalStatus === 'pending_principal').length,
    [employeeAttendance]
  );

  // STRICT ISOLATION GUARD: Teachers & general staff can NEVER access HR & Payroll
  if (!isHR && !isSuperAdmin) {
    return (
      <EmptyState
        title="HR & Payroll Access Restricted"
        description="Only authorized HR Administrators or Super Admin can access HR & Payroll. Teachers and staff should use ESS for personal attendance, leaves, and payslips."
      />
    );
  }

  const resetForm = () => {
    setEditingEmployee(null);
    setEmpCode('');
    setFullName('');
    setEmail('');
    setPhone('');
    setCnic('');
    setDesignation('');
    setDepartmentId('');
    setBranchId('');
    setJoiningDate(getTodayStr());
    setEmploymentStatus('active');
    setBasicSalary('');
    setAllowances('');
    setDeductions('');
    setPhotoUrl('');
    setDocInput('');
    setDocuments([]);
    setStaffRole('teacher');
    setLoginId('');
    setPassword('');
    setShowPassword(false);
    setPasswordProtected(true);
    setModuleAccess(DEFAULT_MODULE_ACCESS);
  };

  const startEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpCode(emp.employeeCode);
    setFullName(emp.fullName);
    setEmail(emp.email);
    setPhone(emp.phone || '');
    setCnic(emp.cnic || '');
    setDesignation(emp.designation);
    setDepartmentId(emp.departmentId);
    setBranchId(emp.branchId);
    setJoiningDate(emp.joiningDate || getTodayStr());
    setEmploymentStatus(emp.employmentStatus || 'active');
    setBasicSalary(String(emp.basicSalary ?? 0));
    setAllowances(String(emp.allowances ?? 0));
    setDeductions(String(emp.deductions ?? 0));
    setPhotoUrl(emp.photoUrl || '');
    setDocuments(emp.documents || []);
    setStaffRole(emp.staffRole || 'teacher');
    setLoginId(emp.loginId || emp.employeeCode);
    setPassword('');
    setShowPassword(false);
    setPasswordProtected(emp.passwordProtected !== false);
    setModuleAccess({
      ...DEFAULT_MODULE_ACCESS,
      ...(emp.moduleAccess || {}),
    });
    setSelectedEmp(null);
    setTab('registration');
  };

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

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid || (!isHR && !isSuperAdmin)) {
      notify('Only HR or Super Admin can save employee records.', 'error');
      return;
    }
    if (!branchId || !departmentId) {
      notify('Select Branch and Department.', 'error');
      return;
    }

    const cleanCode = sanitizeStr(empCode, 40);
    const cleanName = sanitizeStr(fullName, 120);
    const cleanEmail = sanitizeStr(email, 254);
    const cleanLoginId = sanitizeStr(loginId || cleanCode, 60);

    if (!cleanCode || !cleanName || !cleanEmail) {
      notify('Employee Code, Full Name, and Official Email are required.', 'error');
      return;
    }

    // Duplicate Employee Code check
    const duplicateCode = employees.find(
      (emp) =>
        emp.id !== editingEmployee?.id &&
        emp.employeeCode.trim().toLowerCase() === cleanCode.toLowerCase()
    );
    if (duplicateCode) {
      notify(`Employee Code "${cleanCode}" is already assigned to ${duplicateCode.fullName}.`, 'error');
      return;
    }

    // Duplicate Login ID check
    const duplicateLogin = employees.find(
      (emp) =>
        emp.id !== editingEmployee?.id &&
        (emp.loginId || emp.employeeCode).trim().toLowerCase() === cleanLoginId.toLowerCase()
    );
    if (duplicateLogin) {
      notify(`Login ID "${cleanLoginId}" is already used by ${duplicateLogin.fullName}.`, 'error');
      return;
    }

    const trimmedPw = password.trim();
    if (passwordProtected) {
      if (!editingEmployee && trimmedPw.length < 4) {
        notify('Set a Login Password (minimum 4 characters) when ID & Password protection is enabled.', 'error');
        return;
      }
      if (editingEmployee && !editingEmployee.passwordHash && trimmedPw.length < 4) {
        notify('Enter a Login Password (minimum 4 characters) to enable protection on this profile.', 'error');
        return;
      }
      if (trimmedPw.length > 0 && trimmedPw.length < 4) {
        notify('New password must be at least 4 characters.', 'error');
        return;
      }
    }

    const resolvedPasswordHash = trimmedPw
      ? hashCredential(trimmedPw)
      : editingEmployee?.passwordHash || '';

    const normalizedAccess: EmployeeModuleAccess = {
      ess: Boolean(moduleAccess.ess),
      erp: Boolean(moduleAccess.erp),
      e_raseed: Boolean(moduleAccess.e_raseed),
      teacher_management: Boolean(moduleAccess.teacher_management),
      madrasas: Boolean(moduleAccess.madrasas),
      qadri_40: Boolean(moduleAccess.qadri_40),
      online_admission: Boolean(moduleAccess.online_admission),
      notice_board: Boolean(moduleAccess.notice_board),
      reports_analytics: Boolean(moduleAccess.reports_analytics),
    };

    try {
      if (editingEmployee) {
        await updateRecord(
          'employees',
          editingEmployee.id,
          {
            employeeCode: cleanCode,
            fullName: cleanName,
            email: cleanEmail,
            phone: sanitizeStr(phone, 40),
            cnic: sanitizeStr(cnic, 40),
            designation: sanitizeStr(designation, 120),
            departmentId,
            branchId,
            joiningDate,
            employmentStatus,
            basicSalary: Math.max(0, Number(basicSalary) || 0),
            allowances: Math.max(0, Number(allowances) || 0),
            deductions: Math.max(0, Number(deductions) || 0),
            photoUrl: photoUrl || '',
            documents,
            staffRole,
            loginId: cleanLoginId,
            passwordHash: resolvedPasswordHash,
            passwordProtected,
            moduleAccess: normalizedAccess,
          },
          {
            action: 'Updated Employee & Access Credentials',
            module: 'HR & Payroll',
            details: `Updated ${cleanName} (${cleanCode}), Login ID: ${cleanLoginId}, ESS:${normalizedAccess.ess} ERP:${normalizedAccess.erp} E-Raseed:${normalizedAccess.e_raseed}`,
          }
        );
        notify(`Employee "${cleanName}" updated successfully.`, 'success');
      } else {
        const id = makeSafeId('emp');
        await createRecord(
          'employees',
          id,
          {
            employeeCode: cleanCode,
            fullName: cleanName,
            email: cleanEmail,
            phone: sanitizeStr(phone, 40),
            cnic: sanitizeStr(cnic, 40),
            designation: sanitizeStr(designation, 120),
            departmentId,
            branchId,
            joiningDate,
            employmentStatus,
            onboardingStatus: 'recruitment',
            basicSalary: Math.max(0, Number(basicSalary) || 0),
            allowances: Math.max(0, Number(allowances) || 0),
            deductions: Math.max(0, Number(deductions) || 0),
            photoUrl: photoUrl || '',
            documents,
            achievements: [],
            staffRole,
            loginId: cleanLoginId,
            passwordHash: resolvedPasswordHash,
            passwordProtected,
            moduleAccess: normalizedAccess,
            createdBy: actorUid,
          },
          {
            action: 'Registered Employee & Set Credentials',
            module: 'HR & Payroll',
            details: `Registered ${cleanName} (${cleanCode}), Login ID: ${cleanLoginId}`,
          }
        );
        notify(`Employee "${cleanName}" registered with ID & portal permissions.`, 'success');
      }
      resetForm();
      setTab('records');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save employee record.', 'error');
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!isSuperAdmin) {
      notify('Only Super Admin can permanently delete employee records.', 'error');
      return;
    }
    try {
      await deleteRecord('employees', emp.id, {
        action: 'Deleted Employee Record',
        module: 'HR & Payroll',
        details: `Removed ${emp.fullName} (${emp.employeeCode})`,
      });
      setConfirmDeleteEmpId('');
      if (selectedEmp?.id === emp.id) setSelectedEmp(null);
      if (editingEmployee?.id === emp.id) resetForm();
      notify(`Removed employee record for ${emp.fullName}.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete employee.', 'error');
    }
  };

  // Principal approves or rejects employee/teacher attendance
  const handleAttendanceDecision = async (rec: EmployeeAttendance, approve: boolean) => {
    if (!actorUid || !(isPrincipal || isSuperAdmin)) {
      notify('Only Principal or Super Admin can approve/reject teacher attendance.', 'error');
      return;
    }
    try {
      await updateRecord(
        'employee_attendance',
        rec.id,
        {
          approvalStatus: approve ? 'approved' : 'rejected',
          approvedBy: actorUid,
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
    if (!actorUid || (!isHR && !isSuperAdmin)) return;
    if (employees.length === 0) {
      notify('No employees registered to generate payroll.', 'info');
      return;
    }
    let count = 0;
    try {
      for (const emp of employees) {
        if (emp.employmentStatus === 'terminated' || emp.employmentStatus === 'resigned') {
          continue;
        }
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
            generatedBy: actorUid,
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
          : `Payroll already exists for all active employees in ${payrollMonth}.`,
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Payroll generation failed.', 'error');
    }
  };

  const handleMarkPayrollPaid = async (payId: string, name: string) => {
    try {
      await updateRecord(
        'payroll_records',
        payId,
        { status: 'paid' },
        { action: 'Marked Payroll Paid', module: 'HR & Payroll', details: `Paid salary for ${name}` }
      );
      notify(`Salary marked paid for ${name}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update payroll status.', 'error');
    }
  };

  const handleDeletePayroll = async (payId: string) => {
    if (!isSuperAdmin) return;
    try {
      await deleteRecord('payroll_records', payId, {
        action: 'Deleted Payroll Record',
        module: 'HR & Payroll',
        details: `Deleted payroll ${payId}`,
      });
      setConfirmDeletePayId('');
      notify('Payroll record removed.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete payroll record.', 'error');
    }
  };

  const handleAdvanceOnboarding = async (
    emp: Employee,
    nextStage: 'onboarding' | 'completed'
  ) => {
    try {
      await updateRecord(
        'employees',
        emp.id,
        { onboardingStatus: nextStage },
        {
          action: 'Updated Onboarding Stage',
          module: 'HR & Payroll',
          details: `${emp.fullName} -> ${nextStage}`,
        }
      );
      notify(`${emp.fullName} moved to ${nextStage}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update onboarding stage.', 'error');
    }
  };

  const handleLeaveDecision = async (leaveId: string, name: string, status: 'approved' | 'rejected') => {
    try {
      await updateRecord(
        'leave_requests',
        leaveId,
        {
          status,
          reviewedBy: actorUid,
          reviewedAt: new Date().toISOString(),
        },
        {
          action: `Leave Request ${status}`,
          module: 'HR & Payroll',
          details: `${name} leave marked ${status}`,
        }
      );
      notify(`Leave request for ${name} ${status}.`, status === 'approved' ? 'success' : 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update leave request.', 'error');
    }
  };

  const handleClaimDecision = async (
    claimId: string,
    name: string,
    status: 'approved' | 'rejected' | 'paid'
  ) => {
    try {
      await updateRecord(
        'expense_claims',
        claimId,
        {
          status,
          ...(status !== 'paid' ? { reviewedBy: actorUid } : {}),
        },
        {
          action: `Expense Claim ${status}`,
          module: 'HR & Payroll',
          details: `${name} claim marked ${status}`,
        }
      );
      notify(`Expense claim for ${name} marked ${status}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update expense claim.', 'error');
    }
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

  return (
    <div className="space-y-6">
      <SectionHeader
        title="HR & Payroll Management"
        subtitle="Employee & Teacher Registration, Edit Profiles, Portal ID & Password Access (ESS/ERP/E-Raseed), Principal Attendance Gate, Payroll & Claims"
        action={
          <button
            onClick={() => {
              resetForm();
              setTab('registration');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Add Teacher / Employee
          </button>
        }
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
            ['records', 'Employee & Teacher Records'],
            ['registration', editingEmployee ? 'Edit Profile & Credentials' : 'Add Employee / Teacher & Password'],
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
              title="No Employee or Teacher Records Yet"
              description="Register teachers and staff with Login ID, Password, ESS/ERP/E-Raseed permissions, Department, Branch, Salary, and Documents."
              actionLabel="Add Teacher / Employee"
              onAction={() => {
                resetForm();
                setTab('registration');
              }}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">ID / Login</th>
                      <th className="py-2.5 px-4">Employee / Teacher</th>
                      <th className="py-2.5 px-4">Branch &amp; Dept</th>
                      <th className="py-2.5 px-4">Portal Access</th>
                      <th className="py-2.5 px-4 text-right">Basic Salary</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {employees.map((emp) => {
                      const ma = emp.moduleAccess;
                      const grantedLabels = [
                        (ma ? ma.ess : true) ? 'ESS' : null,
                        ma?.erp ? 'ERP' : null,
                        ma?.e_raseed ? 'E-Raseed' : null,
                      ].filter(Boolean) as string[];
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedEmp(emp)}
                          className="hover:bg-slate-50 cursor-pointer"
                        >
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-700">
                            <div>{emp.employeeCode}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <KeyRound className="w-3 h-3 text-emerald-700" />
                              {emp.loginId || emp.employeeCode}
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-3">
                              <AvatarFrame photoUrl={emp.photoUrl} alt={emp.fullName} size="sm" />
                              <div>
                                <div className="font-medium text-slate-900">{emp.fullName}</div>
                                <div className="text-xs text-slate-500">
                                  {emp.designation} · {(emp.staffRole || 'teacher').replace(/_/g, ' ')}
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
                          <td className="py-2.5 px-4 text-xs">
                            <div className="flex flex-wrap gap-1">
                              {grantedLabels.map((lbl) => (
                                <span
                                  key={lbl}
                                  className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[11px] font-medium"
                                >
                                  {lbl}
                                </span>
                              ))}
                              {emp.passwordHash ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                                  <Lock className="w-2.5 h-2.5" /> Protected
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[11px]">
                                  No Password
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                            {formatCurrency(emp.basicSalary)}
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusTag status={emp.employmentStatus} />
                          </td>
                          <td
                            className="py-2.5 px-4 text-right whitespace-nowrap space-x-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => startEditEmployee(emp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-emerald-700 hover:text-emerald-800 rounded-md"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            {isSuperAdmin &&
                              (confirmDeleteEmpId === emp.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEmployee(emp)}
                                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                                  >
                                    Confirm Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteEmpId('')}
                                    className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-md"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteEmpId(emp.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REGISTRATION / EDIT & PORTAL CREDENTIALS */}
      {tab === 'registration' && (
        <form
          onSubmit={handleSaveEmployee}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 max-w-4xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {editingEmployee
                  ? `Edit Profile & Credentials: ${editingEmployee.fullName}`
                  : 'Add Employee / Teacher & Portal Login Credentials'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign ID, Password, Role, and module access for ESS, ERP, and E-Raseed directly here.
              </p>
            </div>
            {editingEmployee && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                Cancel Edit (Switch to Add New)
              </button>
            )}
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
                placeholder="TCH-101 or EMP-001"
                value={empCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmpCode(val);
                  if (!editingEmployee && (!loginId || loginId === empCode)) {
                    setLoginId(val);
                  }
                }}
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
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Aadhaar / PAN / National ID
              </label>
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
                placeholder="e.g. Senior Teacher, Accountant, Clerk"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {(branches.length === 0 || departments.length === 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
              Setup required first: create at least one{' '}
              <span className="font-semibold">Branch</span> and{' '}
              <span className="font-semibold">Department</span> in{' '}
              <span className="font-semibold">Super Admin Control</span> before saving employees.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Employment Status</label>
              <select
                value={employmentStatus}
                onChange={(e) =>
                  setEmploymentStatus(e.target.value as Employee['employmentStatus'])
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="on_leave">On Leave</option>
                <option value="resigned">Resigned (Blocks Login)</option>
                <option value="terminated">Terminated (Blocks Login)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Basic Salary (INR)</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Allowances (INR)</label>
              <input
                type="number"
                min={0}
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Standard Deductions (INR)</label>
              <input
                type="number"
                min={0}
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* PORTAL CREDENTIALS & ESS / ERP / E-RASEED ACCESS CONTROL */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-800" />
                <h4 className="text-sm font-semibold text-slate-900">
                  Teacher / Employee Login ID, Password &amp; Portal Access Protection
                </h4>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passwordProtected}
                  onChange={(e) => setPasswordProtected(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-800"
                />
                Protect ESS, ERP &amp; E-Raseed with ID &amp; Password
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Institutional Role (Teachers Cannot Open HR)
                </label>
                <select
                  value={staffRole}
                  onChange={(e) =>
                    setStaffRole(e.target.value as NonNullable<Employee['staffRole']>)
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="employee">Employee</option>
                  <option value="teacher">Teacher</option>
                  <option value="principal">Principal</option>
                  <option value="hr">HR</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Portal Login ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TCH-101"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {editingEmployee?.passwordHash
                    ? 'Reset Password (leave blank to keep existing)'
                    : 'Portal Login Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={passwordProtected && !editingEmployee?.passwordHash}
                    placeholder={editingEmployee?.passwordHash ? '••••••••' : 'Min 4 characters'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 text-sm border border-slate-200 rounded-lg font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-700 mb-2">
                Granted Protected Sections &amp; Modules for this ID:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {(
                  [
                    ['ess', 'ESS (Self Service)'],
                    ['erp', 'ERP (Finance)'],
                    ['e_raseed', 'E-Raseed (Receipts)'],
                    ['teacher_management', 'Teacher Workspace'],
                    ['madrasas', 'Madrasas'],
                    ['qadri_40', 'QADRI 40'],
                    ['online_admission', 'Online Admission'],
                    ['notice_board', 'Notice Board'],
                    ['reports_analytics', 'Reports & Analytics'],
                  ] as [keyof EmployeeModuleAccess, string][]
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      moduleAccess[key]
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(moduleAccess[key])}
                      onChange={(e) =>
                        setModuleAccess((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-emerald-800"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  HR &amp; Payroll, HR Control Panel, and Super Admin Authority are permanently isolated from Teachers and Staff.
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Documents Checklist / References
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Aadhaar Card Verified, PAN Copy, Alimiyyah Degree"
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
                    <button
                      type="button"
                      onClick={() =>
                        setDocuments((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove document"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              {editingEmployee ? 'Update Employee & Credentials' : 'Save Employee & Credentials'}
            </button>
            {editingEmployee && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
            )}
          </div>
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
                      {(isHR || isSuperAdmin) && emp.onboardingStatus === 'recruitment' && (
                        <button
                          onClick={() => handleAdvanceOnboarding(emp, 'onboarding')}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                        >
                          Move to Onboarding
                        </button>
                      )}
                      {(isHR || isSuperAdmin) && emp.onboardingStatus === 'onboarding' && (
                        <button
                          onClick={() => handleAdvanceOnboarding(emp, 'completed')}
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
            {(isHR || isSuperAdmin) && (
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
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {(isHR || isSuperAdmin) && p.status !== 'paid' && (
                            <button
                              onClick={() => handleMarkPayrollPaid(p.id, p.employeeName)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                            >
                              Mark Paid
                            </button>
                          )}
                          {isSuperAdmin && p.status !== 'paid' &&
                            (confirmDeletePayId === p.id ? (
                              <>
                                <button
                                  onClick={() => handleDeletePayroll(p.id)}
                                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded-md"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDeletePayId('')}
                                  className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-md"
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDeletePayId(p.id)}
                                className="px-2 py-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md"
                              >
                                Delete
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
                        {(isHR || isPrincipal || isSuperAdmin) && l.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleLeaveDecision(l.id, l.employeeName, 'approved')}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleLeaveDecision(l.id, l.employeeName, 'rejected')}
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
                        {(isHR || isSuperAdmin) && c.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleClaimDecision(c.id, c.employeeName, 'approved')}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleClaimDecision(c.id, c.employeeName, 'rejected')}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {(isHR || isSuperAdmin) && c.status === 'approved' && (
                          <button
                            onClick={() => handleClaimDecision(c.id, c.employeeName, 'paid')}
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
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEditEmployee(selectedEmp)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setSelectedEmp(null)}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Email:</span> <span className="font-medium">{selectedEmp.email}</span></div>
              <div><span className="text-slate-500">Phone:</span> <span className="font-mono">{selectedEmp.phone || '-'}</span></div>
              <div><span className="text-slate-500">Aadhaar / ID:</span> <span className="font-mono">{selectedEmp.cnic || '-'}</span></div>
              <div><span className="text-slate-500">Joined:</span> <span className="font-mono">{selectedEmp.joiningDate}</span></div>
              <div><span className="text-slate-500">Login ID:</span> <span className="font-mono font-semibold">{selectedEmp.loginId || selectedEmp.employeeCode}</span></div>
              <div><span className="text-slate-500">Role:</span> <span className="uppercase font-medium">{(selectedEmp.staffRole || 'teacher').replace(/_/g, ' ')}</span></div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-1.5">Granted Module Access</h4>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(['ess', 'erp', 'e_raseed', 'teacher_management', 'madrasas', 'qadri_40', 'online_admission', 'notice_board', 'reports_analytics'] as (keyof EmployeeModuleAccess)[]).map((k) => {
                  const granted = selectedEmp.moduleAccess ? Boolean(selectedEmp.moduleAccess[k]) : k === 'ess' || k === 'notice_board';
                  if (!granted) return null;
                  return (
                    <span key={k} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                      {k.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  );
                })}
              </div>
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
