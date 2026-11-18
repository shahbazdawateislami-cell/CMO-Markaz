import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileBarChart,
  Lock,
  Megaphone,
  Receipt,
  Wallet,
} from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import {
  AttendanceTiming,
  EmployeeAttendance,
  formatCounter,
  formatCurrency,
  ModuleKey,
} from '../../types';
import {
  getCurrentMonthStr,
  getCurrentTimeStr,
  getTodayStr,
  makeSafeId,
  sanitizeStr,
  timeToMinutes,
} from '../../utils/validation';
import { CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

type ESSTab =
  | 'attendance'
  | 'leave'
  | 'salary'
  | 'student_approval'
  | 'notice_board'
  | 'reports'
  | 'expenses_claims'
  | 'achievement'
  | 'exam_test';

// Exact 9 ESS buttons specified (ESS is strictly for employee services only; NEVER student attendance)
const ESS_BUTTONS: {
  id: ESSTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'attendance', label: 'Attendance', icon: CalendarClock },
  { id: 'leave', label: 'Leave Application', icon: Clock },
  { id: 'salary', label: 'My Salary & Payslip', icon: Wallet },
  { id: 'student_approval', label: 'Student Approval', icon: ClipboardCheck },
  { id: 'notice_board', label: 'Notice Board', icon: Megaphone },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'expenses_claims', label: 'Expenses/Claims', icon: Receipt },
  { id: 'achievement', label: 'Achievement', icon: Award },
  { id: 'exam_test', label: 'Exam & Test', icon: BookOpenCheck },
];

export function ESSModule({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const {
    firebaseUser,
    actorUid,
    isOpenMode,
    userProfile,
    employees,
    branches,
    departments,
    attendanceTimings,
    employeeAttendance,
    leaveRequests,
    payrollRecords,
    expenseClaims,
    admissions,
    notices,
    academics,
    isTeacher,
    isPrincipal,
    isSuperAdmin,
    createRecord,
    updateRecord,
    notify,
  } = useCMO();

  const [activeTab, setActiveTab] = useState<ESSTab>('attendance');
  const [selectedOpenEmployeeId, setSelectedOpenEmployeeId] = useState('');

  // Identify current user's Employee record (or selected employee in Open Mode)
  const myEmployee = useMemo(() => {
    if (isOpenMode) {
      return (
        employees.find((e) => e.id === selectedOpenEmployeeId) ||
        employees[0]
      );
    }
    if (!firebaseUser) return undefined;
    return (
      employees.find((e) => e.uid === firebaseUser.uid) ||
      employees.find((e) => e.id === userProfile?.employeeId) ||
      employees.find((e) => e.email.toLowerCase() === (firebaseUser.email || '').toLowerCase())
    );
  }, [employees, firebaseUser, userProfile, isOpenMode, selectedOpenEmployeeId]);

  const myAttendance = useMemo(() => {
    if (isOpenMode) {
      if (!myEmployee) return [];
      return employeeAttendance
        .filter((a) => a.employeeId === myEmployee.id)
        .sort((a, b) => b.date.localeCompare(a.date));
    }
    if (!firebaseUser) return [];
    return employeeAttendance
      .filter((a) => a.uid === firebaseUser.uid)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [employeeAttendance, firebaseUser, isOpenMode, myEmployee]);

  const myLeaves = useMemo(() => {
    if (isOpenMode) {
      if (!myEmployee) return [];
      return leaveRequests
        .filter((l) => l.employeeId === myEmployee.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
    if (!firebaseUser) return [];
    return leaveRequests
      .filter((l) => l.uid === firebaseUser.uid)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [leaveRequests, firebaseUser, isOpenMode, myEmployee]);

  const myClaims = useMemo(() => {
    if (isOpenMode) {
      if (!myEmployee) return [];
      return expenseClaims
        .filter((c) => c.employeeId === myEmployee.id)
        .sort((a, b) => b.claimDate.localeCompare(a.claimDate));
    }
    if (!firebaseUser) return [];
    return expenseClaims
      .filter((c) => c.uid === firebaseUser.uid)
      .sort((a, b) => b.claimDate.localeCompare(a.claimDate));
  }, [expenseClaims, firebaseUser, isOpenMode, myEmployee]);

  const myPayrolls = useMemo(() => {
    if (!myEmployee) return [];
    return payrollRecords
      .filter((p) => p.employeeId === myEmployee.id)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [payrollRecords, myEmployee]);

  // Resolve applicable attendance timing policy: employee -> department -> branch -> global
  const effectivePolicy: AttendanceTiming | undefined = useMemo(() => {
    if (!myEmployee) return attendanceTimings.find((t) => t.scopeType === 'global');
    return (
      attendanceTimings.find((t) => t.scopeType === 'employee' && t.scopeId === myEmployee.id) ||
      attendanceTimings.find(
        (t) => t.scopeType === 'department' && t.scopeId === myEmployee.departmentId
      ) ||
      attendanceTimings.find((t) => t.scopeType === 'branch' && t.scopeId === myEmployee.branchId) ||
      attendanceTimings.find((t) => t.scopeType === 'global')
    );
  }, [attendanceTimings, myEmployee]);

  const today = getTodayStr();
  const currentMonth = getCurrentMonthStr();
  const todayRecord = myAttendance.find((a) => a.date === today);

  // Check if attendance is currently locked by closing time unless reopened by Super Admin
  const lockEvaluation = useMemo(() => {
    if (!effectivePolicy) {
      return { isClosed: false, reason: 'No timing policy restriction set; manual mark open.' };
    }
    const nowTime = getCurrentTimeStr();
    const nowMin = timeToMinutes(nowTime);
    const closeMin = timeToMinutes(effectivePolicy.closingTime);
    const reopenedActive =
      effectivePolicy.reopenedUntil && new Date(effectivePolicy.reopenedUntil) > new Date();

    if (reopenedActive) {
      return {
        isClosed: false,
        reason: `Reopened by Super Admin until ${new Date(effectivePolicy.reopenedUntil!).toLocaleString()}.`,
      };
    }
    if (effectivePolicy.isLocked || nowMin > closeMin) {
      return {
        isClosed: true,
        reason: `Attendance locked after closing time (${effectivePolicy.closingTime}). Only Super Admin can reopen.`,
      };
    }
    return {
      isClosed: false,
      reason: `Open (${effectivePolicy.startTime} – ${effectivePolicy.closingTime} · Late after ${effectivePolicy.lateTime} + ${effectivePolicy.graceMinutes}m grace).`,
    };
  }, [effectivePolicy]);

  // Leave form state
  const [leaveType, setLeaveType] = useState<'Casual' | 'Sick' | 'Earned' | 'Emergency' | 'Unpaid'>('Casual');
  const [leaveStart, setLeaveStart] = useState(today);
  const [leaveEnd, setLeaveEnd] = useState(today);
  const [leaveReason, setLeaveReason] = useState('');

  // Claim form state
  const [claimType, setClaimType] = useState<'Medical' | 'Travel' | 'Other'>('Medical');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDate, setClaimDate] = useState(today);
  const [claimDesc, setClaimDesc] = useState('');

  // Correction modal state
  const [correctionTarget, setCorrectionTarget] = useState<EmployeeAttendance | null>(null);
  const [correctionText, setCorrectionText] = useState('');

  // Printable payslip selection
  const [selectedPayslipId, setSelectedPayslipId] = useState<string>('');

  const handleMarkManualAttendance = async () => {
    if (!actorUid || !myEmployee) {
      notify('Register an Employee in HR & Payroll first to mark ESS attendance.', 'error');
      return;
    }
    if (todayRecord) {
      notify('Attendance has already been recorded for today.', 'info');
      return;
    }
    if (lockEvaluation.isClosed) {
      notify(lockEvaluation.reason, 'error');
      return;
    }

    const nowTime = getCurrentTimeStr();
    let computedStatus: EmployeeAttendance['status'] = 'Present';
    if (effectivePolicy) {
      const nowMin = timeToMinutes(nowTime);
      const lateCutoff = timeToMinutes(effectivePolicy.lateTime) + (effectivePolicy.graceMinutes || 0);
      const startMin = timeToMinutes(effectivePolicy.startTime);
      if (nowMin < startMin) {
        notify(`Attendance window opens at ${effectivePolicy.startTime}.`, 'error');
        return;
      }
      if (nowMin > lateCutoff) {
        computedStatus = 'Late';
      }
    }

    const id = makeSafeId('empatt');
    try {
      await createRecord(
        'employee_attendance',
        id,
        {
          employeeId: myEmployee.id,
          uid: myEmployee.uid || actorUid,
          employeeName: myEmployee.fullName,
          branchId: myEmployee.branchId,
          departmentId: myEmployee.departmentId,
          date: today,
          monthKey: currentMonth,
          markedTime: nowTime,
          status: computedStatus,
          approvalStatus: 'pending_principal',
          isLocked: false,
          reopenedByAdmin: false,
          correctionRequested: false,
          correctionStatus: 'none',
        },
        {
          action: 'Marked Manual Attendance',
          module: 'ESS',
          details: `${myEmployee.fullName} marked ${computedStatus} at ${nowTime} on ${today}`,
        }
      );
      notify(`Attendance marked as ${computedStatus} at ${nowTime}. Sent for Principal approval.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to mark attendance.', 'error');
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget || !correctionText.trim()) return;
    try {
      await updateRecord(
        'employee_attendance',
        correctionTarget.id,
        {
          correctionRequested: true,
          correctionReason: sanitizeStr(correctionText, 300),
          correctionStatus: 'pending',
        },
        {
          action: 'Requested Attendance Correction',
          module: 'ESS',
          details: `Correction requested for ${correctionTarget.date}: ${sanitizeStr(correctionText, 120)}`,
        }
      );
      setCorrectionTarget(null);
      setCorrectionText('');
      notify('Correction request submitted to Principal.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to submit correction request.', 'error');
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid || !myEmployee) {
      notify('Employee profile required before submitting leave.', 'error');
      return;
    }
    if (!leaveReason.trim()) return;
    const id = makeSafeId('leave');
    try {
      await createRecord(
        'leave_requests',
        id,
        {
          employeeId: myEmployee.id,
          uid: myEmployee.uid || actorUid,
          employeeName: myEmployee.fullName,
          branchId: myEmployee.branchId,
          departmentId: myEmployee.departmentId,
          leaveType,
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: sanitizeStr(leaveReason, 500),
          status: 'pending',
        },
        {
          action: 'Submitted Leave Application',
          module: 'ESS',
          details: `${leaveType} leave from ${leaveStart} to ${leaveEnd}`,
        }
      );
      setLeaveReason('');
      notify('Leave application submitted to HR/Principal.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to submit leave application.', 'error');
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid || !myEmployee) {
      notify('Employee profile required before submitting claims.', 'error');
      return;
    }
    const amt = Number(claimAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !claimDesc.trim()) {
      notify('Provide a valid positive amount and description.', 'error');
      return;
    }
    const id = makeSafeId('claim');
    try {
      await createRecord(
        'expense_claims',
        id,
        {
          employeeId: myEmployee.id,
          uid: myEmployee.uid || actorUid,
          employeeName: myEmployee.fullName,
          claimType,
          amount: amt,
          description: sanitizeStr(claimDesc, 500),
          claimDate,
          status: 'pending',
        },
        {
          action: 'Submitted Expense Claim',
          module: 'ESS',
          details: `${claimType} claim for ${amt} on ${claimDate}`,
        }
      );
      setClaimAmount('');
      setClaimDesc('');
      notify('Expense claim submitted for HR approval.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to submit expense claim.', 'error');
    }
  };

  const handleTeacherVerifyAdmission = async (admId: string, approve: boolean) => {
    if (!actorUid) return;
    try {
      await updateRecord(
        'admissions',
        admId,
        {
          workflowStatus: approve ? 'teacher_verified' : 'rejected',
          teacherVerifiedBy: actorUid,
          teacherVerifiedAt: new Date().toISOString(),
          ...(approve ? {} : { rejectionReason: 'Rejected during Teacher verification stage' }),
        },
        {
          action: approve ? 'Teacher Verified Admission' : 'Teacher Rejected Admission',
          module: 'ESS - Student Approval',
          details: `Admission ${admId} ${approve ? 'forwarded to HR Verification' : 'rejected'}`,
        }
      );
      notify(
        approve
          ? 'Admission verified and forwarded to HR Verification.'
          : 'Admission application marked rejected.',
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Verification failed.', 'error');
    }
  };

  const approvedCount = myAttendance.filter((a) => a.approvalStatus === 'approved').length;
  const pendingCount = myAttendance.filter((a) => a.approvalStatus === 'pending_principal').length;
  const rejectedCount = myAttendance.filter((a) => a.approvalStatus === 'rejected').length;

  const pendingAdmissionsForTeacher = admissions.filter(
    (a) => a.workflowStatus === 'pending_teacher'
  );

  const selectedPayslip = myPayrolls.find((p) => p.id === selectedPayslipId) || myPayrolls[0];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="ESS – Employee Self Service"
        subtitle="Personal employee attendance, leaves, payslips, claims, achievements, and admission verification (Employee Services Only)"
      />

      {/* Exact 9 ESS Navigation Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2">
        {ESS_BUTTONS.map((btn) => {
          const Icon = btn.icon;
          const active = activeTab === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => setActiveTab(btn.id)}
              className={`flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border text-center transition-colors ${
                active
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-600'}`} />
              <span className="text-xs font-medium leading-tight">{btn.label}</span>
            </button>
          );
        })}
      </div>

      {isOpenMode && employees.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-slate-600">
            Active Employee in ESS Open Workspace:
          </div>
          <select
            value={myEmployee?.id || ''}
            onChange={(e) => setSelectedOpenEmployeeId(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employeeCode} – {emp.fullName} ({emp.designation})
              </option>
            ))}
          </select>
        </div>
      )}

      {!myEmployee && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
          <span>
            {isOpenMode
              ? 'No Employees registered yet. Register an Employee in HR & Payroll first to enable ESS attendance, leave, and payroll actions.'
              : `Your account is not yet linked to an Employee record in HR & Payroll. Ask HR or Super Admin to register your Employee ID with email ${firebaseUser?.email || ''}.`}
          </span>
          <button
            onClick={() => onNavigate('hr_payroll')}
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap"
          >
            Open HR &amp; Payroll
          </button>
        </div>
      )}

      {/* 1. ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    Manual Attendance Check-In
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {today} · {getCurrentTimeStr()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Manual date &amp; time attendance only (no biometric or facial recognition). Requires Principal approval before syncing to HR &amp; Payroll.
                </p>

                <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
                  {lockEvaluation.isClosed ? (
                    <Lock className="w-4 h-4 text-red-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  )}
                  <span>{lockEvaluation.reason}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  {myEmployee
                    ? `${myEmployee.employeeCode} · ${branches.find((b) => b.id === myEmployee.branchId)?.name || 'Branch'} · ${departments.find((d) => d.id === myEmployee.departmentId)?.name || 'Department'}`
                    : 'Employee profile pending linkage'}
                </div>
                <button
                  onClick={handleMarkManualAttendance}
                  disabled={!myEmployee || Boolean(todayRecord) || lockEvaluation.isClosed}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  {todayRecord
                    ? `Marked Today (${todayRecord.status} at ${todayRecord.markedTime})`
                    : lockEvaluation.isClosed
                      ? 'Attendance Locked'
                      : 'Mark Attendance Now'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
              <CounterStat label="Principal Approved" value={approvedCount} />
              <CounterStat label="Pending Principal" value={pendingCount} />
              <CounterStat label="Rejected (Excluded)" value={rejectedCount} />
            </div>
          </div>

          {/* Correction Form Modal Inline */}
          {correctionTarget && (
            <form
              onSubmit={handleCorrectionSubmit}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">
                  Request Correction for {correctionTarget.date}
                </h4>
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
              <textarea
                required
                rows={2}
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                placeholder="Explain the attendance correction reason for Principal review..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
              >
                Submit Correction Request
              </button>
            </form>
          )}

          {/* History Table */}
          {myAttendance.length === 0 ? (
            <EmptyState
              title="No Employee Attendance History"
              description="Use the Manual Attendance button above to record your attendance for today."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Principal Approval</th>
                      <th className="py-2.5 px-4">Correction</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {myAttendance.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-900">{rec.date}</td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">{rec.markedTime}</td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={rec.status} />
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={rec.approvalStatus} />
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">
                          {rec.correctionRequested
                            ? `${rec.correctionStatus || 'pending'} · ${rec.correctionReason || ''}`
                            : 'None'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {!rec.correctionRequested && (
                            <button
                              onClick={() => setCorrectionTarget(rec)}
                              className="text-xs font-medium text-emerald-800 hover:underline"
                            >
                              Request Correction
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

      {/* 2. LEAVE APPLICATION */}
      {activeTab === 'leave' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleLeaveSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">Apply for Leave</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as typeof leaveType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Casual">Casual</option>
                <option value="Sick">Sick</option>
                <option value="Earned">Earned</option>
                <option value="Emergency">Emergency</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
              <textarea
                required
                rows={3}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="State reason for leave..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={!myEmployee}
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg"
            >
              Submit Leave Application
            </button>
          </form>

          <div className="lg:col-span-2">
            {myLeaves.length === 0 ? (
              <EmptyState
                title="No Leave Applications"
                description="Submitted leave requests and their approval status will appear here."
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Period</th>
                      <th className="py-2.5 px-4">Reason</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {myLeaves.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{l.leaveType}</td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                          {l.startDate} to {l.endDate}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{l.reason}</td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={l.status} />
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

      {/* 3. MY SALARY & PAYSLIP */}
      {activeTab === 'salary' && (
        <div className="space-y-4">
          {myPayrolls.length === 0 ? (
            <EmptyState
              title="No Payslips Generated Yet"
              description="Once HR generates monthly payroll from your Principal-approved attendance records, your payslips appear here."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {myPayrolls.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPayslipId(p.id)}
                    className={`w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 ${
                      selectedPayslip?.id === p.id ? 'bg-emerald-50/50' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold font-mono text-slate-900">{p.monthKey}</div>
                      <div className="text-xs text-slate-500">
                        Approved Days: {formatCounter(p.approvedDays)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                        {formatCurrency(p.netPayable)}
                      </div>
                      <StatusTag status={p.status} />
                    </div>
                  </button>
                ))}
              </div>

              {selectedPayslip && (
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Markazi CMO Official Payslip
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        Month: {selectedPayslip.monthKey} · Code: {selectedPayslip.employeeCode}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="no-print px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Print Payslip
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <CounterStat label="Approved Days" value={selectedPayslip.approvedDays} />
                    <CounterStat label="Late Days" value={selectedPayslip.lateDays || 0} />
                    <CounterStat label="Half Days" value={selectedPayslip.halfDays || 0} />
                    <CounterStat label="Absent Days" value={selectedPayslip.absentDays || 0} />
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between p-3">
                      <span className="text-slate-600">Basic Salary</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatCurrency(selectedPayslip.basicSalary)}
                      </span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-slate-600">Allowances</span>
                      <span className="font-mono tabular-nums text-emerald-700">
                        +{formatCurrency(selectedPayslip.allowances || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-slate-600">Deductions</span>
                      <span className="font-mono tabular-nums text-red-700">
                        -{formatCurrency(selectedPayslip.deductions || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 font-semibold">
                      <span className="text-slate-900">Net Payable</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatCurrency(selectedPayslip.netPayable)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. STUDENT APPROVAL (Admission Teacher Verification Stage) */}
      {activeTab === 'student_approval' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
            Stage 1 Admission Verification: Teachers verify incoming online admission applications before forwarding to HR Verification and Super Admin Final Approval.
          </div>
          {pendingAdmissionsForTeacher.length === 0 ? (
            <EmptyState
              title="No Admissions Awaiting Teacher Verification"
              description="New applications submitted in Online Admission appear here for Stage 1 verification."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">App No</th>
                    <th className="py-2.5 px-4">Applicant</th>
                    <th className="py-2.5 px-4">Program</th>
                    <th className="py-2.5 px-4">Guardian Contact</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pendingAdmissionsForTeacher.map((adm) => (
                    <tr key={adm.id}>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{adm.applicationNo}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{adm.studentName}</div>
                        <div className="text-xs text-slate-500">S/D/o {adm.fatherName}</div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-700 uppercase">{adm.programType}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{adm.guardianPhone}</td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {(isTeacher || isPrincipal || isSuperAdmin) && (
                          <>
                            <button
                              onClick={() => handleTeacherVerifyAdmission(adm.id, true)}
                              className="px-3 py-1 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-md"
                            >
                              Verify &amp; Forward
                            </button>
                            <button
                              onClick={() => handleTeacherVerifyAdmission(adm.id, false)}
                              className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
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

      {/* 5. NOTICE BOARD */}
      {activeTab === 'notice_board' && (
        <div className="space-y-3">
          {notices.filter((n) => n.status === 'published').length === 0 ? (
            <EmptyState
              title="No Published Notices"
              description="Institutional circulars and branch notices published on the Notice Board will appear here."
            />
          ) : (
            notices
              .filter((n) => n.status === 'published')
              .map((n) => (
                <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-base font-semibold text-slate-900">{n.title}</h4>
                    <StatusTag
                      status={n.priority}
                      tone={n.priority === 'Urgent' ? 'red' : n.priority === 'Important' ? 'amber' : 'slate'}
                    />
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-3 text-xs text-slate-400">
                    Audience: {n.audience} · Published by {n.publishedByName || 'Administration'}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* 6. REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CounterStat label="Total Attendance Logs" value={myAttendance.length} />
            <CounterStat label="Approved Attendance" value={approvedCount} />
            <CounterStat label="Leaves Approved" value={myLeaves.filter((l) => l.status === 'approved').length} />
            <CounterStat label="Claims Approved" value={myClaims.filter((c) => c.status === 'approved' || c.status === 'paid').length} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-600">
            Employee self-service reports consolidate only Principal-approved attendance, approved leaves, and settled claims. Rejected attendance logs are excluded from HR &amp; Payroll calculations.
          </div>
        </div>
      )}

      {/* 7. EXPENSES / CLAIMS */}
      {activeTab === 'expenses_claims' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleClaimSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">Submit Expense Claim</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Claim Type</label>
              <select
                value={claimType}
                onChange={(e) => setClaimType(e.target.value as typeof claimType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Medical">Medical</option>
                <option value="Travel">Travel</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Claim Date</label>
                <input
                  type="date"
                  required
                  value={claimDate}
                  onChange={(e) => setClaimDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea
                required
                rows={3}
                value={claimDesc}
                onChange={(e) => setClaimDesc(e.target.value)}
                placeholder="Receipt details or purpose..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={!myEmployee}
              className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 rounded-lg"
            >
              Submit Claim
            </button>
          </form>

          <div className="lg:col-span-2">
            {myClaims.length === 0 ? (
              <EmptyState
                title="No Expense Claims"
                description="Medical, Travel, and Other claims submitted for reimbursement appear here."
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {myClaims.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{c.claimDate}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{c.claimType}</td>
                        <td className="py-2.5 px-4 text-slate-600">{c.description}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={c.status} />
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

      {/* 8. ACHIEVEMENT */}
      {activeTab === 'achievement' && (
        <div>
          {!myEmployee?.achievements || myEmployee.achievements.length === 0 ? (
            <EmptyState
              title="No Performance Achievements Recorded"
              description="Performance milestones and awards logged by HR on your employee record will appear here."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {myEmployee.achievements.map((ach, idx) => (
                <div key={idx} className="p-4 flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">{formatCounter(idx + 1)}</span>
                  <span className="text-sm font-medium text-slate-900">{ach}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. EXAM & TEST */}
      {activeTab === 'exam_test' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm text-slate-600">
              Scheduled institutional exams and assessments assigned to teachers.
            </div>
            {(isTeacher || isPrincipal || isSuperAdmin) && (
              <button
                onClick={() => onNavigate('teacher_management')}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap"
              >
                Manage Exams &amp; Marks
              </button>
            )}
          </div>

          {academics.filter((a) => a.recordType === 'exam').length === 0 ? (
            <EmptyState
              title="No Scheduled Exams or Tests"
              description="Exams created under Teacher Management or HR Academic Control appear here."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Title</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-right">Max Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {academics
                    .filter((a) => a.recordType === 'exam')
                    .map((ex) => (
                      <tr key={ex.id}>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{ex.title}</td>
                        <td className="py-2.5 px-4 text-slate-600">{ex.subject}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{ex.dueDate || '-'}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                          {formatCounter(ex.maxMarks || 0)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
