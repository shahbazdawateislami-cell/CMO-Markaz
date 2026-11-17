import React, { useState } from 'react';
import {
  ChevronRight,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
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
import { OperationalDepartmentModule } from './components/modules/OperationalDepartmentModule';
import { SuperAdminModule } from './components/modules/SuperAdminModule';
import { TeacherManagementModule } from './components/modules/TeacherManagementModule';
import { CMOProvider, useCMO } from './context/CMOContext';
import { CMO_MODULES, ModuleKey } from './types';

function ToastStack() {
  const { toasts, dismissToast } = useCMO();
  if (toasts.length === 0) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-medium bg-white ${
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

function CMOWorkspace() {
  const {
    firebaseUser,
    userProfile,
    authReady,
    signInWithGoogle,
    signOut,
    isSuperAdmin,
    isHR,
    isPrincipal,
    isTeacher,
    isActiveStaff,
  } = useCMO();

  const [activeModule, setActiveModule] = useState<ModuleKey>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navigate = (mod: ModuleKey) => {
    setActiveModule(mod);
    setMobileMenuOpen(false);
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return <HomeOverview onNavigate={navigate} />;
      case 'ess':
        return <ESSModule onNavigate={navigate} />;
      case 'erp':
        return <ERPFinanceModule />;
      case 'qadri_40':
        return <AcademicDepartmentModule programType="qadri40" />;
      case 'darul_ifta':
        return <OperationalDepartmentModule moduleType="darul_ifta" />;
      case 'darul_qaza':
        return <OperationalDepartmentModule moduleType="darul_qaza" />;
      case 'darul_iqama':
        return <OperationalDepartmentModule moduleType="darul_iqama" />;
      case 'madrasas':
        return <AcademicDepartmentModule programType="madrasa" />;
      case 'online_admission':
        return <OnlineAdmissionModule />;
      case 'tahreek_bedari':
        return <OperationalDepartmentModule moduleType="tahreek_bedari" />;
      case 'e_raseed':
        return <ERaseedModule />;
      case 'hr_payroll':
        return <HRPayrollModule />;
      case 'digital_library':
        return <OperationalDepartmentModule moduleType="digital_library" />;
      case 'online_courses':
        return <OperationalDepartmentModule moduleType="online_courses" />;
      case 'notice_board':
        return <NoticeBoardModule />;
      case 'projects_existing':
        return <OperationalDepartmentModule moduleType="project_existing" />;
      case 'upcoming_project':
        return <OperationalDepartmentModule moduleType="project_upcoming" />;
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
      {/* Top Bar Contract: 3 zones (Wordmark — Nav Links — Primary Action) */}
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between gap-8">
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

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => navigate('home')}
            className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
              activeModule === 'home' ? 'text-emerald-800 font-semibold' : ''
            }`}
          >
            17 Modules
          </button>
          <button
            onClick={() => navigate('ess')}
            className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
              activeModule === 'ess' ? 'text-emerald-800 font-semibold' : ''
            }`}
          >
            ESS
          </button>
          {(isTeacher || isPrincipal || isHR) && (
            <button
              onClick={() => navigate('teacher_management')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                activeModule === 'teacher_management' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              Teacher Workspace
            </button>
          )}
          {isHR && (
            <button
              onClick={() => navigate('hr_control_panel')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                activeModule === 'hr_control_panel' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              HR Control
            </button>
          )}
          {isSuperAdmin && (
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

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar Navigation: Exact 1-17 ordered modules + Governance consoles */}
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
                Core &amp; Department Modules (01–17)
              </div>
              <div className="space-y-0.5">
                {CMO_MODULES.map((mod) => {
                  const active = activeModule === mod.key;
                  return (
                    <button
                      key={mod.key}
                      onClick={() => navigate(mod.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-lg transition-colors text-left ${
                        active
                          ? 'bg-emerald-800 text-white font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`font-mono tabular-nums text-[11px] w-5 shrink-0 ${
                          active ? 'text-emerald-200' : 'text-slate-400'
                        }`}
                      >
                        {String(mod.order).padStart(2, '0')}
                      </span>
                      <span className="truncate">{mod.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(isTeacher || isPrincipal || isHR || isSuperAdmin) && (
              <div className="pt-2 border-t border-slate-200">
                <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400">
                  Authority &amp; Control
                </div>
                <div className="space-y-0.5">
                  {(isTeacher || isPrincipal || isHR) && (
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
                  {isHR && (
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
                  {isSuperAdmin && (
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
