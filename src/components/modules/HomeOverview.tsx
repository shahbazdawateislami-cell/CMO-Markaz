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
    hasModuleAccess,
    needsModuleCredentialGate,
    isStaffSessionActive,
    isHR,
    isSuperAdmin,
    notify,
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

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto w-full px-4 sm:px-6">
      {/* Top Hero Arch Banner */}
      <div className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-12 shadow-xl overflow-hidden border border-emerald-900/50">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            Central Management Office
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-serif">
            Markazi CMO
          </h1>
          <p className="text-sm sm:text-base text-emerald-100 font-medium">
            Institutional Management System · Centralized · Multi-Branch · Secure · Integrated
          </p>
          {isHR || isSuperAdmin ? (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
              <span>Active Branches: <strong className="text-white font-mono">{branches.length}</strong></span>
              <span>·</span>
              <span>Departments: <strong className="text-white font-mono">{departments.length}</strong></span>
              <span>·</span>
              <span>Employees: <strong className="text-white font-mono">{employees.length}</strong></span>
              <span>·</span>
              <span>Students: <strong className="text-white font-mono">{students.length}</strong></span>
            </div>
          ) : (
            <div className="pt-1 text-xs text-emerald-300/80">
              Authorized Institutional Portal · Sign in with HR or Super Admin credentials to view administrative metrics
            </div>
          )}
        </div>
      </div>

      {/* Full-width Institutional Modules Grid */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Institutional Modules</h2>
            <p className="text-xs text-slate-500">
              Click any module card below to open its operational workspace and authenticate with your assigned credentials.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CMO_MODULES.map((mod) => {
            const Icon = MODULE_ICONS[mod.key] || Coins;
            const count = moduleCount(mod.key);
            const allowed = hasModuleAccess(mod.key);
            const gated = needsModuleCredentialGate(mod.key);
            return (
              <button
                key={mod.key}
                onClick={() => {
                  if (allowed) onNavigate(mod.key);
                }}
                className={`group text-left bg-white border rounded-2xl p-5 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                  allowed
                    ? 'border-slate-200 hover:border-emerald-700'
                    : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono tabular-nums text-slate-400 font-semibold uppercase tracking-wider">
                      Module {String(mod.order).padStart(2, '0')} · {mod.category}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-emerald-800 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors">
                      {gated || !allowed ? (
                        <Lock className="w-4 h-4 text-amber-700" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-900">
                    {mod.label}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {mod.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-600">
                    Records: <strong className="text-slate-900">{formatCounter(count)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                    {!allowed ? 'Restricted' : gated ? 'Secure Login' : 'Open Access'}
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Governance & Control Panels Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="text-sm font-bold text-slate-900">Governance &amp; Administrative Controls</div>
            <div className="text-xs text-slate-500">Teacher Workspace, HR Control, and Super Admin Authority</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasModuleAccess('teacher_management') && (
              <button
                onClick={() => onNavigate('teacher_management')}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Teacher Workspace
              </button>
            )}
            {hasModuleAccess('hr_control_panel') && (
              <button
                onClick={() => onNavigate('hr_control_panel')}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                HR Control
              </button>
            )}
            {hasModuleAccess('super_admin_panel') && (
              <button
                onClick={() => onNavigate('super_admin_panel')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl transition-colors shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" /> Super Admin Authority
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
