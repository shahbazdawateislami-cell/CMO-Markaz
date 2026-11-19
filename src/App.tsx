import React, { useState } from 'react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AcademicDepartmentModule } from './components/modules/AcademicDepartmentModules';
import { ERPFinanceModule } from './components/modules/ERPFinanceModule';
import { ERaseedModule } from './components/modules/ERaseedModule';
import { ESSModule } from './components/modules/ESSModule';
import { HomeOverview } from './components/modules/HomeOverview';
import { HRControlPanel } from './components/modules/HRControlPanel';
import { HRPayrollModule } from './components/modules/HRPayrollModule';
import {
  NoticeBoardModule,
  ReportsAnalyticsModule,
} from './components/modules/NoticeAndReportsModules';
import { OnlineAdmissionModule } from './components/modules/OnlineAdmissionModule';
import { SuperAdminModule } from './components/modules/SuperAdminModule';
import { TeacherManagementModule } from './components/modules/TeacherManagementModule';
import { AvatarFrame, EmptyState } from './components/SharedUI';
import { AUTH_LOCK_ENABLED, CMOProvider, useCMO } from './context/CMOContext';
import { CMO_MODULES, ModuleKey } from './types';

function ToastStack() {
  const { toasts, dismissToast } = useCMO();
  if (toasts.length === 0) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-medium bg-white shadow-sm ${
            t.type === 'error'
              ? 'border-red-200 text-red-800'
              : t.type === 'success'
                ? 'border-emerald-200 text-emerald-900'
                : 'border-slate-200 text-slate-800'
          }`}
        >
          <span>{t.text}</span>
          <button onClick={() => dismissToast(t.id)} className="text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ModuleCredentialGate({
  moduleKey,
  onReturnHome,
}: {
  moduleKey: ModuleKey;
  onReturnHome: () => void;
}) {
  const {
    loginWithStaffCredentials,
    unlockAdminWithPin,
    hasAdminPin,
    notify,
  } = useCMO();

  const [loginIdInput, setLoginIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('teacher');
  const [showPw, setShowPw] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const modLabel =
    CMO_MODULES.find((m) => m.key === moduleKey)?.label || moduleKey.toUpperCase();

  const handleStaffVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = loginWithStaffCredentials(loginIdInput, passwordInput);
    if (!res.ok) {
      setErrorMsg(res.error || 'Invalid credentials.');
      return;
    }
    notify(`Signed in as ${res.employee?.fullName} (${res.employee?.loginId || res.employee?.employeeCode}).`, 'success');
  };

  const handleAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = unlockAdminWithPin(adminPinInput);
    if (!res.ok) {
      setErrorMsg(res.error || 'Invalid Admin Security PIN.');
      return;
    }
    setAdminPinInput('');
    notify('Admin Security session unlocked.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Secure Login &amp; Authentication
              </h2>
              <p className="text-xs text-slate-500">
                Accessing <strong className="text-emerald-800">{modLabel}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onReturnHome}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleStaffVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-900"
            >
              <option value="employee">Employee</option>
              <option value="teacher">Teacher</option>
              <option value="principal">Principal</option>
              <option value="hr">HR Administrator</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              User ID / Employee Code
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Shahbaz or TCH-101"
              value={loginIdInput}
              onChange={(e) => setLoginIdInput(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl font-mono bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                placeholder="Enter password assigned by HR"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-3 pr-9 py-2.5 text-xs border border-slate-200 rounded-xl font-mono bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-700"
                aria-label="Toggle password visibility"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-md transition-all"
            >
              <KeyRound className="w-4 h-4" /> Sign In &amp; Open {modLabel}
            </button>
          </div>
        </form>

        {hasAdminPin && (
          <form onSubmit={handleAdminUnlock} className="pt-4 border-t border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-700">
              Master Admin PIN Unlock
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                required
                placeholder="Enter Admin PIN"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono bg-slate-50/50"
              />
              <button
                type="submit"
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl"
              >
                Unlock
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CMOWorkspace() {
  const {
    firebaseUser,
    userProfile,
    authReady,
    signInWithGoogle,
    signOut,
    staffSessionEmployee,
    isStaffSessionActive,
    hasAdminPin,
    isAdminUnlocked,
    loginWithStaffCredentials,
    logoutStaffSession,
    unlockAdminWithPin,
    lockAdminSession,
    hasModuleAccess,
    needsModuleCredentialGate,
    isActiveStaff,
    notify,
  } = useCMO();

  const [activeModule, setActiveModule] = useState<ModuleKey>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Staff Login Modal & Admin PIN Modal state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffIdInput, setStaffIdInput] = useState('');
  const [staffPwInput, setStaffPwInput] = useState('');
  const [showStaffPw, setShowStaffPw] = useState(false);
  const [staffModalError, setStaffModalError] = useState('');

  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  if (AUTH_LOCK_ENABLED) {
    if (!authReady) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="text-sm text-slate-500">Connecting to Markazi CMO Firebase workspace...</div>
        </div>
      );
    }

    if (!firebaseUser) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Markazi CMO</h1>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Centralized multi-branch institutional management system for ESS, ERP, HR &amp; Payroll, E-Raseed, Online Admissions, and Departments.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <button
                onClick={signInWithGoogle}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In with Google
              </button>
              <p className="text-xs text-slate-500 text-center">
                Role-based access enforced for Super Admin, HR, Principals, Teachers, and Department Staff. No Student or Parent portal is provided.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (!isActiveStaff) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="text-lg font-semibold text-slate-900">Account Awaiting Institutional Activation</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your Google account (<span className="font-mono">{firebaseUser.email}</span>) is registered with status <strong className="uppercase">{userProfile?.status || 'pending'}</strong>. Contact Super Admin or HR Control Panel to assign your institutional role, branch, and department permissions.
            </p>
            <div className="pt-2">
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  const showTeacherNav = hasModuleAccess('teacher_management');
  const showHRNav = hasModuleAccess('hr_control_panel');
  const showAdminNav = hasModuleAccess('super_admin_panel');

  const navigate = (mod: ModuleKey) => {
    setActiveModule(mod);
    setMobileMenuOpen(false);
  };

  const handleStaffModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffModalError('');
    const res = loginWithStaffCredentials(staffIdInput, staffPwInput);
    if (!res.ok) {
      setStaffModalError(res.error || 'Login failed.');
      return;
    }
    setShowStaffModal(false);
    setStaffIdInput('');
    setStaffPwInput('');
    notify(
      `Welcome ${res.employee?.fullName} (${(res.employee?.staffRole || 'teacher').replace(/_/g, ' ')})`,
      'success'
    );
    // If currently on an HR/Admin page, redirect cleanly to home or ESS
    if (
      activeModule === 'hr_payroll' ||
      activeModule === 'hr_control_panel' ||
      activeModule === 'super_admin_panel'
    ) {
      setActiveModule(res.employee?.moduleAccess?.ess !== false ? 'ess' : 'home');
    }
  };

  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPinError('');
    const res = unlockAdminWithPin(adminPinInput);
    if (!res.ok) {
      setAdminPinError(res.error || 'Incorrect Admin PIN.');
      return;
    }
    setShowAdminPinModal(false);
    setAdminPinInput('');
    notify('Super Admin / HR terminal unlocked.', 'success');
  };

  const renderModule = () => {
    if (activeModule !== 'home' && !hasModuleAccess(activeModule)) {
      return (
        <EmptyState
          title="Module Access Restricted"
          description={
            isStaffSessionActive
              ? `Your Teacher/Employee profile (${staffSessionEmployee?.fullName}) does not have access to this section. HR & Payroll and Super Admin sections are restricted from Teachers.`
              : 'You do not have permission to open this module. Contact HR or Super Admin.'
          }
          actionLabel="Return to Homepage"
          onAction={() => navigate('home')}
        />
      );
    }

    if (needsModuleCredentialGate(activeModule)) {
      return (
        <ModuleCredentialGate
          moduleKey={activeModule}
          onReturnHome={() => navigate('home')}
        />
      );
    }

    switch (activeModule) {
      case 'home':
        return <HomeOverview onNavigate={navigate} />;
      case 'ess':
        return <ESSModule onNavigate={navigate} />;
      case 'erp':
        return <ERPFinanceModule />;
      case 'qadri_40':
        return <AcademicDepartmentModule key={activeModule} programType="qadri40" />;
      case 'madrasas':
        return <AcademicDepartmentModule key={activeModule} programType="madrasa" />;
      case 'online_admission':
        return <OnlineAdmissionModule />;
      case 'e_raseed':
        return <ERaseedModule />;
      case 'hr_payroll':
        return <HRPayrollModule />;
      case 'notice_board':
        return <NoticeBoardModule />;
      case 'reports_analytics':
        return <ReportsAnalyticsModule />;
      case 'hr_control_panel':
        return <HRControlPanel onNavigate={navigate} />;
      case 'teacher_management':
        return <TeacherManagementModule onNavigate={navigate} />;
      case 'super_admin_panel':
        return <SuperAdminModule onNavigate={navigate} />;
      default:
        return <HomeOverview onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: 3 zones (Wordmark — Nav Links — Session Controls) */}
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md"
            aria-label="Toggle module navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('home')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Markazi CMO
          </button>
        </div>

        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
          <button
            onClick={() => navigate('home')}
            className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
              activeModule === 'home' ? 'text-emerald-800 font-semibold' : ''
            }`}
          >
            CMO Directory
          </button>
          {hasModuleAccess('ess') && (
            <button
              onClick={() => navigate('ess')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                activeModule === 'ess' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              ESS
            </button>
          )}
          {showTeacherNav && (
            <button
              onClick={() => navigate('teacher_management')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                activeModule === 'teacher_management' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              Teacher Workspace
            </button>
          )}
          {showHRNav && (
            <button
              onClick={() => navigate('hr_control_panel')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                activeModule === 'hr_control_panel' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              HR Control
            </button>
          )}
          {showAdminNav && (
            <button
              onClick={() => navigate('super_admin_panel')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                activeModule === 'super_admin_panel' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              Super Admin
            </button>
          )}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isStaffSessionActive && staffSessionEmployee && (
            <div className="flex items-center gap-3 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
              <AvatarFrame photoUrl={staffSessionEmployee.photoUrl} alt={staffSessionEmployee.fullName} size="sm" />
              <div className="text-left leading-tight">
                <div className="text-xs font-bold text-slate-900">{staffSessionEmployee.fullName}</div>
                <div className="text-[10px] text-emerald-800 font-mono">
                  ID: {staffSessionEmployee.loginId || staffSessionEmployee.employeeCode} · {(staffSessionEmployee.staffRole || 'teacher').replace(/_/g, ' ')}
                </div>
              </div>
              <button
                onClick={() => {
                  logoutStaffSession();
                  navigate('home');
                  notify('Staff session signed out.', 'info');
                }}
                className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg whitespace-nowrap"
                title="Staff Logout"
              >
                <LogOut className="w-3 h-3" />
                Logout
              </button>
            </div>
          )}

        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar Navigation */}
        <aside
          className={`no-print fixed inset-y-0 left-0 top-14 z-20 w-64 bg-white border-r border-slate-200 overflow-y-auto transition-transform lg:static lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-3 space-y-5">
            <div>
              <button
                onClick={() => navigate('home')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  activeModule === 'home'
                    ? 'bg-emerald-800 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>CMO Homepage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400">
                Institutional Modules (01–09)
              </div>
              <div className="space-y-0.5">
                {CMO_MODULES.map((mod) => {
                  const allowed = hasModuleAccess(mod.key);
                  if (!allowed) return null;
                  const gated = needsModuleCredentialGate(mod.key);
                  const active = activeModule === mod.key;
                  return (
                    <button
                      key={mod.key}
                      onClick={() => navigate(mod.key)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors text-left ${
                        active
                          ? 'bg-emerald-800 text-white font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`font-mono tabular-nums text-[11px] w-5 shrink-0 ${
                            active ? 'text-emerald-200' : 'text-slate-400'
                          }`}
                        >
                          {String(mod.order).padStart(2, '0')}
                        </span>
                        <span className="truncate">{mod.label}</span>
                      </span>
                      {gated && (
                        <Lock
                          className={`w-3 h-3 shrink-0 ${
                            active ? 'text-emerald-200' : 'text-amber-600'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {(showTeacherNav || showHRNav || showAdminNav) && (
              <div className="pt-2 border-t border-slate-200">
                <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400">
                  Authority &amp; Control
                </div>
                <div className="space-y-0.5">
                  {showTeacherNav && (
                    <button
                      onClick={() => navigate('teacher_management')}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        activeModule === 'teacher_management'
                          ? 'bg-emerald-800 text-white font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Teacher Management
                    </button>
                  )}
                  {showHRNav && (
                    <button
                      onClick={() => navigate('hr_control_panel')}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        activeModule === 'hr_control_panel'
                          ? 'bg-emerald-800 text-white font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      HR Control Panel
                    </button>
                  )}
                  {showAdminNav && (
                    <button
                      onClick={() => navigate('super_admin_panel')}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        activeModule === 'super_admin_panel'
                          ? 'bg-emerald-800 text-white font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Super Admin Authority
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1440px]">
          {renderModule()}
        </main>
      </div>

      {/* Staff / Teacher ID & Password Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleStaffModalSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-800" />
                <h3 className="text-base font-semibold text-slate-900">
                  Teacher / Employee ID Login
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Sign in with the Login ID and Password configured in HR &amp; Payroll to access your permitted ESS, ERP, E-Raseed, and Teacher workspaces.
            </p>
            {staffModalError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                {staffModalError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Employee / Teacher Login ID
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. TCH-101"
                value={staffIdInput}
                onChange={(e) => setStaffIdInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showStaffPw ? 'text' : 'password'}
                  required
                  value={staffPwInput}
                  onChange={(e) => setStaffPwInput(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPw((v) => !v)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                >
                  {showStaffPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
              >
                Sign In to Workspace
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin PIN Unlock Modal */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAdminPinSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-800" />
                <h3 className="text-base font-semibold text-slate-900">Admin Security PIN</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminPinModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {adminPinError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                {adminPinError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Enter Master Admin Security PIN
              </label>
              <input
                type="password"
                required
                autoFocus
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdminPinModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
              >
                Unlock Admin
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CMOProvider>
        <CMOWorkspace />
        <ToastStack />
      </CMOProvider>
    </ErrorBoundary>
  );
}
