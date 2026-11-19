import React, { useState } from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  Coins,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Landmark,
  Layers,
  Lock,
  LogOut,
  Megaphone,
  Receipt,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { CMO_MODULES, formatCounter, ModuleKey } from '../../types';
import { CounterStat } from '../SharedUI';

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
    loginWithStaffCredentials,
    logoutStaffSession,
    notify,
  } = useCMO();

  // Secure Login Card local state
  const [userIdInput, setUserIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleSecureLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const res = loginWithStaffCredentials(userIdInput, passwordInput);
    if (!res.ok) {
      setLoginError(res.error || 'Invalid User ID or Password.');
      notify(res.error || 'Login failed.', 'error');
      return;
    }
    setUserIdInput('');
    setPasswordInput('');
    notify(`Successfully signed in as ${res.employee?.fullName} (${(res.employee?.staffRole || 'teacher').replace(/_/g, ' ')})`, 'success');
  };

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
    <div className="space-y-8 pb-12">
      {/* Top Hero Arch Banner matching Screenshot branding */}
      <div className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl overflow-hidden border border-emerald-900/50">
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
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
            <span>Active Branches: <strong className="text-white font-mono">{branches.length}</strong></span>
            <span>·</span>
            <span>Departments: <strong className="text-white font-mono">{departments.length}</strong></span>
            <span>·</span>
            <span>Employees: <strong className="text-white font-mono">{employees.length}</strong></span>
            <span>·</span>
            <span>Students: <strong className="text-white font-mono">{students.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left side Modules & Directory, Right side Secure Login Card (as shown in screenshot) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Institutional Modules Grid (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Institutional Modules</h2>
              <p className="text-xs text-slate-500">
                Click any module to access operational workspaces or sign in with your Teacher/Staff ID.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CMO_MODULES.map((mod) => {
              const Icon = MODULE_ICONS[mod.key] || Coins;
              const count = moduleCount(mod.key);
              const allowed = hasModuleAccess(mod.key);
              const gated = needsModuleCredentialGate(mod.key);
              return (
                <button
                  key={mod.key}
                  onClick={() => {
                    if (gated && !isStaffSessionActive) {
                      // scroll to login card or prompt
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      notify('Please sign in using the Secure Login portal on the right to access ' + mod.label, 'info');
                      return;
                    }
                    if (allowed) onNavigate(mod.key);
                  }}
                  className={`group text-left bg-white border rounded-2xl p-4 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                    allowed
                      ? 'border-slate-200 hover:border-emerald-700'
                      : 'border-slate-200 opacity-60 bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 font-semibold uppercase tracking-wider">
                        Module {String(mod.order).padStart(2, '0')}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-emerald-800 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors">
                        {gated || !allowed ? (
                          <Lock className="w-4 h-4 text-amber-700" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                      {mod.label}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                      {mod.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-600">
                      Records: <strong className="text-slate-900">{formatCounter(count)}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                      {!allowed ? 'Restricted' : gated ? 'Sign-In Required' : 'Open Access'}
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Admin & HR Access Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div>
              <div className="text-xs font-bold text-slate-900">Governance &amp; Control Panels</div>
              <div className="text-[11px] text-slate-500">Super Admin, HR Payroll, and Teacher Management consoles</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasModuleAccess('teacher_management') && (
                <button
                  onClick={() => onNavigate('teacher_management')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Teacher Workspace
                </button>
              )}
              {hasModuleAccess('hr_control_panel') && (
                <button
                  onClick={() => onNavigate('hr_control_panel')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  HR Control
                </button>
              )}
              {hasModuleAccess('super_admin_panel') && (
                <button
                  onClick={() => onNavigate('super_admin_panel')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Exact Secure Login Card matching Screenshot (5 cols on lg) */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0 opacity-50 pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-700 p-0.5 shadow-md flex items-center justify-center text-white">
                  <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-emerald-800">
                    <ShieldCheck className="w-7 h-7 text-emerald-800" />
                  </div>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Secure Login
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Access Markazi CMO Portal &amp; Authorized Employee Services
                </p>
              </div>

              {isStaffSessionActive && staffSessionEmployee ? (
                <div className="space-y-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {staffSessionEmployee.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {staffSessionEmployee.fullName}
                      </div>
                      <div className="text-[11px] text-emerald-800 font-mono">
                        {staffSessionEmployee.loginId || staffSessionEmployee.employeeCode} · {(staffSessionEmployee.staffRole || 'teacher').replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    You are signed in with institutional employee credentials. You have direct access to your ESS, assigned classes, and authorized modules.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onNavigate('ess')}
                      className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl text-center shadow-sm"
                    >
                      Open ESS Portal
                    </button>
                    <button
                      onClick={() => {
                        logoutStaffSession();
                        notify('Staff session signed out.', 'info');
                      }}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-xl"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSecureLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-800">
                      {loginError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      User ID / Employee Code
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Users className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. TCH-101 or EMP-001"
                        value={userIdInput}
                        onChange={(e) => setUserIdInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter HR-assigned password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-white bg-gradient-to-r from-emerald-800 to-slate-900 hover:from-emerald-900 hover:to-slate-950 rounded-xl shadow-md transition-all"
                  >
                    <KeyRound className="w-4 h-4" /> Sign In to Portal <ArrowRight className="w-4 h-4 ml-1" />
                  </button>

                  <div className="pt-2 text-center">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Teacher and Employee credentials are configured directly by HR inside the <strong>HR &amp; Payroll</strong> module.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Live Approval Queues Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Live Institutional Pipeline
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[11px] text-slate-500">Admissions</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{formatCounter(pendingAdmissions)}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[11px] text-slate-500">Teacher Att.</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{formatCounter(pendingTeacherAtt)}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[11px] text-slate-500">Student Att.</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{formatCounter(pendingStudentAtt)}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[11px] text-slate-500">Leave Requests</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{formatCounter(pendingLeaves)}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
