import React from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  Coins,
  GraduationCap,
  Landmark,
  Layers,
  Lock,
  Megaphone,
  Receipt,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { CMO_MODULES, formatCounter, ModuleKey } from '../../types';
import { CounterStat, SectionHeader } from '../SharedUI';

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ess: UserCheck,
  erp: Landmark,
  qadri_40: GraduationCap,
  madrasas: Layers,
  online_admission: ClipboardCheck,
  e_raseed: Receipt,
  hr_payroll: Users,
  notice_board: Megaphone,
  reports_analytics: TrendingUp,
};

export function HomeOverview({ onNavigate }: { onNavigate: (mod: ModuleKey) => void }) {
  const {
    firebaseUser,
    userProfile,
    staffSessionEmployee,
    isStaffSessionActive,
    hasModuleAccess,
    needsModuleCredentialGate,
    effectiveRole,
    branches,
    departments,
    employees,
    students,
    admissions,
    employeeAttendance,
    studentAttendance,
    eraseedReceipts,
    notices,
    financeLedger,
    academics,
    leaveRequests,
    expenseClaims,
  } = useCMO();

  const moduleCount = (key: ModuleKey): number => {
    switch (key) {
      case 'ess':
        return employeeAttendance.length + leaveRequests.length + expenseClaims.length;
      case 'erp':
        return financeLedger.length;
      case 'qadri_40':
        return students.filter((s) => s.programType === 'qadri40').length;
      case 'madrasas':
        return students.filter((s) => s.programType === 'madrasa').length;
      case 'online_admission':
        return admissions.length;
      case 'e_raseed':
        return eraseedReceipts.length;
      case 'hr_payroll':
        return employees.length;
      case 'notice_board':
        return notices.length;
      case 'reports_analytics':
        return academics.length + studentAttendance.length;
      default:
        return 0;
    }
  };

  const pendingAdmissions = admissions.filter(
    (a) => a.workflowStatus !== 'active' && a.workflowStatus !== 'rejected'
  ).length;
  const pendingTeacherAtt = employeeAttendance.filter(
    (a) => a.approvalStatus === 'pending_principal'
  ).length;
  const pendingStudentAtt = studentAttendance.filter(
    (a) => a.approvalStatus === 'pending_supervisor'
  ).length;
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending').length;

  const showTeacherQuick = hasModuleAccess('teacher_management');
  const showHRQuick = hasModuleAccess('hr_control_panel');
  const showAdminQuick = hasModuleAccess('super_admin_panel');
  const canOpenHRPayroll = hasModuleAccess('hr_payroll');

  const subtitle = isStaffSessionActive && staffSessionEmployee
    ? `Signed in as ${staffSessionEmployee.fullName} (${effectiveRole.replace(/_/g, ' ')}) · ID: ${staffSessionEmployee.loginId || staffSessionEmployee.employeeCode}`
    : firebaseUser
      ? `Centralized Multi-Branch Operations · Signed in as ${userProfile?.displayName || 'Staff'} (${effectiveRole.replace(/_/g, ' ')})`
      : 'Centralized Multi-Branch Operations · Markazi CMO Institutional Directory';

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Markazi CMO Institutional Directory"
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {showTeacherQuick && (
              <button
                onClick={() => onNavigate('teacher_management')}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Teacher Management
              </button>
            )}
            {showHRQuick && (
              <button
                onClick={() => onNavigate('hr_control_panel')}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                HR Control Panel
              </button>
            )}
            {showAdminQuick && (
              <button
                onClick={() => onNavigate('super_admin_panel')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Super Admin Authority
              </button>
            )}
          </div>
        }
      />

      {/* Institutional Counters (strictly 00 when empty) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <CounterStat label="Active Branches" value={branches.length} />
        <CounterStat label="Departments" value={departments.length} />
        <CounterStat label="Employees" value={employees.length} />
        <CounterStat label="Active Students" value={students.length} />
        <CounterStat label="Pending Approvals" value={pendingAdmissions + pendingTeacherAtt + pendingStudentAtt + pendingLeaves} />
        <CounterStat label="E-Raseed Issued" value={eraseedReceipts.length} />
      </div>

      {/* Live Approval Queues Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Live Approval Queues</h3>
          <span className="text-xs text-slate-500">
            Teacher Verification · Principal Attendance · Department Supervisor · Super Admin Final Gate
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('online_admission')}
            className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-700 transition-colors"
          >
            <div className="text-xs text-slate-500">Admissions in Pipeline</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-semibold font-mono tabular-nums text-slate-900">
                {formatCounter(pendingAdmissions)}
              </span>
              <span className="text-xs font-medium text-emerald-800">Open Queue</span>
            </div>
          </button>

          <button
            onClick={() => canOpenHRPayroll && onNavigate('hr_payroll')}
            disabled={!canOpenHRPayroll}
            className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <div className="text-xs text-slate-500">Teacher Attendance (Principal)</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-semibold font-mono tabular-nums text-slate-900">
                {formatCounter(pendingTeacherAtt)}
              </span>
              <span className="text-xs font-medium text-emerald-800">
                {canOpenHRPayroll ? 'Review' : 'HR Restricted'}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('madrasas')}
            className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-700 transition-colors"
          >
            <div className="text-xs text-slate-500">Student Attendance (Supervisor)</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-semibold font-mono tabular-nums text-slate-900">
                {formatCounter(pendingStudentAtt)}
              </span>
              <span className="text-xs font-medium text-emerald-800">Verify</span>
            </div>
          </button>

          <button
            onClick={() => canOpenHRPayroll && onNavigate('hr_payroll')}
            disabled={!canOpenHRPayroll}
            className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <div className="text-xs text-slate-500">Employee Leave Requests</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-semibold font-mono tabular-nums text-slate-900">
                {formatCounter(pendingLeaves)}
              </span>
              <span className="text-xs font-medium text-emerald-800">
                {canOpenHRPayroll ? 'Inspect' : 'HR Restricted'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Institutional Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Institutional Modules (01 – 09)
          </h3>
          <span className="text-xs text-slate-500">
            Centralized Firebase Firestore · Real-Time Synchronization
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {CMO_MODULES.map((mod) => {
            const Icon = MODULE_ICONS[mod.key] || Coins;
            const count = moduleCount(mod.key);
            const allowed = hasModuleAccess(mod.key);
            const gated = needsModuleCredentialGate(mod.key);
            return (
              <button
                key={mod.key}
                onClick={() => allowed && onNavigate(mod.key)}
                disabled={!allowed}
                className={`group text-left bg-white border rounded-xl p-4 transition-colors flex flex-col justify-between ${
                  allowed
                    ? 'border-slate-200 hover:border-emerald-700'
                    : 'border-slate-200 opacity-55 cursor-not-allowed bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono tabular-nums text-slate-400 font-medium">
                      {String(mod.order).padStart(2, '0')} · {mod.category}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-emerald-800 group-hover:border-emerald-200">
                      {gated || !allowed ? (
                        <Lock className="w-4 h-4 text-amber-700" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 group-hover:text-emerald-900">
                    {mod.label}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono tabular-nums text-slate-600">
                    Records: <strong className="text-slate-900">{formatCounter(count)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                    {!allowed ? 'Restricted' : gated ? 'ID & Password' : 'Open'}
                    {allowed && (
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
