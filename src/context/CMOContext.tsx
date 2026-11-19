import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  QueryConstraint,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  auth,
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  storage,
} from '../firebase';
import {
  AcademicClass,
  AcademicRecord,
  AcademicSession,
  Admission,
  AttendanceTiming,
  AuditLog,
  Branch,
  Department,
  DepartmentCase,
  Division,
  Employee,
  EmployeeAttendance,
  ERaseedReceipt,
  ExpenseClaim,
  FinanceEntry,
  LeaveRequest,
  ModuleKey,
  Notice,
  PayrollRecord,
  Student,
  StudentAttendance,
  SystemConfig,
  TimetableEntry,
  UserProfile,
} from '../types';
import { hashCredential, verifyCredential } from '../utils/authHash';
import { makeSafeId } from '../utils/validation';

// Toggle to true whenever the Sign-In lock screen should be re-enabled
export const AUTH_LOCK_ENABLED = false;

const OPEN_STORAGE_PREFIX = 'markazi_cmo_open_v1_';
const STAFF_SESSION_KEY = 'markazi_cmo_staff_session_v1';
const ADMIN_UNLOCK_KEY = 'markazi_cmo_admin_unlock_v1';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface CMOContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  authReady: boolean;
  loadingData: boolean;
  isOpenMode: boolean;
  actorUid: string;
  actorName: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  // Staff / Teacher ID & Password Session + Admin PIN Lock
  staffSessionEmployee: Employee | null;
  isStaffSessionActive: boolean;
  hasAdminPin: boolean;
  isAdminUnlocked: boolean;
  hasProtectedEmployees: boolean;
  loginWithStaffCredentials: (
    loginId: string,
    password: string
  ) => { ok: boolean; error?: string; employee?: Employee };
  logoutStaffSession: () => void;
  unlockAdminWithPin: (pin: string) => { ok: boolean; error?: string };
  lockAdminSession: () => void;
  saveAdminPin: (newPin: string, currentPin?: string) => Promise<{ ok: boolean; error?: string }>;
  hasModuleAccess: (mod: ModuleKey) => boolean;
  needsModuleCredentialGate: (mod: ModuleKey) => boolean;

  // Role helpers
  effectiveRole: string;
  isSuperAdmin: boolean;
  isHR: boolean;
  isPrincipal: boolean;
  isTeacher: boolean;
  isDeptSupervisor: boolean;
  isActiveStaff: boolean;

  // Collections
  users: UserProfile[];
  divisions: Division[];
  branches: Branch[];
  departments: Department[];
  sessions: AcademicSession[];
  classes: AcademicClass[];
  timetables: TimetableEntry[];
  employees: Employee[];
  attendanceTimings: AttendanceTiming[];
  employeeAttendance: EmployeeAttendance[];
  leaveRequests: LeaveRequest[];
  payrollRecords: PayrollRecord[];
  expenseClaims: ExpenseClaim[];
  admissions: Admission[];
  students: Student[];
  studentAttendance: StudentAttendance[];
  academics: AcademicRecord[];
  departmentCases: DepartmentCase[];
  eraseedReceipts: ERaseedReceipt[];
  financeLedger: FinanceEntry[];
  notices: Notice[];
  auditLogs: AuditLog[];
  systemConfigs: SystemConfig[];

  // Actions
  createRecord: <T extends Record<string, unknown>>(
    collectionName: string,
    id: string,
    payload: T,
    auditMeta?: { action: string; module: string; details: string }
  ) => Promise<void>;
  updateRecord: (
    collectionName: string,
    id: string,
    payload: Record<string, unknown>,
    auditMeta?: { action: string; module: string; details: string }
  ) => Promise<void>;
  deleteRecord: (
    collectionName: string,
    id: string,
    auditMeta?: { action: string; module: string; details: string }
  ) => Promise<void>;
  approveAdmissionFinal: (
    admission: Admission,
    selectedClass: AcademicClass,
    rollNo: string
  ) => Promise<void>;
  logAudit: (
    action: string,
    module: string,
    entityType: string,
    entityId: string,
    details: string
  ) => Promise<void>;
  uploadPhoto: (file: File, folder: string) => Promise<string>;

  // Notifications / Toasts
  toasts: ToastMessage[];
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const CMOContext = createContext<CMOContextValue | null>(null);

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function readOpenCollection<T>(colName: string): T[] {
  try {
    const raw = localStorage.getItem(`${OPEN_STORAGE_PREFIX}${colName}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeOpenCollection<T>(colName: string, items: T[]): void {
  try {
    localStorage.setItem(`${OPEN_STORAGE_PREFIX}${colName}`, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function fileToCompactDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Invalid image file.'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        const maxDim = 320;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function CMOProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Collection state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceTimings, setAttendanceTimings] = useState<AttendanceTiming[]>([]);
  const [employeeAttendance, setEmployeeAttendance] = useState<EmployeeAttendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<StudentAttendance[]>([]);
  const [academics, setAcademics] = useState<AcademicRecord[]>([]);
  const [departmentCases, setDepartmentCases] = useState<DepartmentCase[]>([]);
  const [eraseedReceipts, setEraseedReceipts] = useState<ERaseedReceipt[]>([]);
  const [financeLedger, setFinanceLedger] = useState<FinanceEntry[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);

  const [staffSessionEmployeeId, setStaffSessionEmployeeId] = useState<string>(() => {
    try {
      return sessionStorage.getItem(STAFF_SESSION_KEY) || localStorage.getItem(STAFF_SESSION_KEY) || '';
    } catch {
      return '';
    }
  });
  const [adminPinUnlocked, setAdminPinUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const notify = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = makeSafeId('toast');
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Google Sign-In failed.', 'error');
    }
  }, [notify]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  }, []);

  // 1. Auth & Own Profile Listener
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!user) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      unsubProfile = onSnapshot(
        userRef,
        async (snap) => {
          if (!snap.exists()) {
            const isOwner =
              user.email === BOOTSTRAPPED_SUPER_ADMIN_EMAIL && user.emailVerified;
            const initialProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: (user.displayName || user.email || 'User').slice(0, 120),
              role: isOwner ? 'super_admin' : 'pending',
              status: isOwner ? 'active' : 'pending',
              permissions: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            try {
              await setDoc(userRef, initialProfile);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
            }
          } else {
            const data = snap.data() as UserProfile;
            setUserProfile({ ...data, id: snap.id });
            setAuthReady(true);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const isOpenMode = !firebaseUser && !AUTH_LOCK_ENABLED;

  const isBootstrappedOwner =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email === BOOTSTRAPPED_SUPER_ADMIN_EMAIL;

  const staffSessionEmployee = React.useMemo(
    () => employees.find((e) => e.id === staffSessionEmployeeId) || null,
    [employees, staffSessionEmployeeId]
  );

  // Auto-clear terminated/resigned/missing staff session once employees list has loaded
  useEffect(() => {
    if (!staffSessionEmployeeId) return;
    if (employees.length === 0) return;
    const found = employees.find((e) => e.id === staffSessionEmployeeId);
    if (!found || found.employmentStatus === 'terminated' || found.employmentStatus === 'resigned') {
      setStaffSessionEmployeeId('');
      try {
        sessionStorage.removeItem(STAFF_SESSION_KEY);
        localStorage.removeItem(STAFF_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }, [employees, staffSessionEmployeeId]);

  const masterConfig = systemConfigs.find((c) => c.configType === 'master');
  const adminPinHash = masterConfig?.adminPinHash || '';
  const hasAdminPin = Boolean(adminPinHash);

  // Admin unlock state: true if Firebase SuperAdmin/HR, or unlocked with Admin PIN, or Open Mode with no PIN & no active Staff Session
  const isAdminUnlocked =
    Boolean(staffSessionEmployee)
      ? false
      : firebaseUser
        ? isBootstrappedOwner || userProfile?.role === 'super_admin' || userProfile?.role === 'hr'
        : !hasAdminPin || adminPinUnlocked;

  const hasProtectedEmployees = React.useMemo(
    () =>
      employees.some(
        (e) =>
          e.passwordProtected !== false &&
          Boolean(e.passwordHash) &&
          e.employmentStatus !== 'terminated' &&
          e.employmentStatus !== 'resigned'
      ),
    [employees]
  );

  const isStaffSessionActive = Boolean(staffSessionEmployee);

  // STRICT ROLE RESOLUTION: Staff/Teacher credential session ALWAYS overrides Open Mode privileges!
  const effectiveRole = staffSessionEmployee
    ? staffSessionEmployee.staffRole || 'teacher'
    : firebaseUser
      ? isBootstrappedOwner
        ? 'super_admin'
        : userProfile?.role || 'pending'
      : isOpenMode
        ? hasAdminPin && !adminPinUnlocked
          ? 'teacher'
          : 'super_admin'
        : 'pending';

  const isSuperAdmin =
    !isStaffSessionActive &&
    (firebaseUser
      ? effectiveRole === 'super_admin' && (isBootstrappedOwner || userProfile?.status === 'active')
      : isOpenMode && (!hasAdminPin || adminPinUnlocked));

  const isHR =
    isSuperAdmin ||
    (staffSessionEmployee
      ? effectiveRole === 'hr'
      : Boolean(firebaseUser && effectiveRole === 'hr' && userProfile?.status === 'active'));

  const isPrincipal =
    isSuperAdmin ||
    (staffSessionEmployee
      ? effectiveRole === 'principal'
      : Boolean(firebaseUser && effectiveRole === 'principal' && userProfile?.status === 'active'));

  const isTeacher =
    staffSessionEmployee
      ? effectiveRole === 'teacher'
      : firebaseUser
        ? effectiveRole === 'teacher' && userProfile?.status === 'active'
        : isSuperAdmin || effectiveRole === 'teacher';

  const isDeptSupervisor =
    staffSessionEmployee
      ? effectiveRole === 'department_supervisor'
      : firebaseUser
        ? effectiveRole === 'department_supervisor' && userProfile?.status === 'active'
        : isSuperAdmin;

  const isActiveStaff =
    isStaffSessionActive ||
    isOpenMode ||
    isSuperAdmin ||
    (Boolean(userProfile) &&
      userProfile?.status === 'active' &&
      ['super_admin', 'hr', 'principal', 'teacher', 'department_supervisor', 'staff'].includes(
        userProfile.role
      ));

  const actorUid =
    staffSessionEmployee?.uid ||
    staffSessionEmployee?.id ||
    firebaseUser?.uid ||
    (isOpenMode ? 'open_admin' : '');
  const actorName =
    staffSessionEmployee?.fullName ||
    userProfile?.displayName ||
    firebaseUser?.email ||
    (isOpenMode ? 'Super Admin (Open Workspace)' : 'Staff');

  const getOpenSetter = useCallback(
    (colName: string): React.Dispatch<React.SetStateAction<any[]>> | null => {
      switch (colName) {
        case 'users':
          return setUsers;
        case 'divisions':
          return setDivisions;
        case 'branches':
          return setBranches;
        case 'departments':
          return setDepartments;
        case 'academic_sessions':
          return setSessions;
        case 'classes':
          return setClasses;
        case 'timetables':
          return setTimetables;
        case 'employees':
          return setEmployees;
        case 'attendance_timings':
          return setAttendanceTimings;
        case 'employee_attendance':
          return setEmployeeAttendance;
        case 'leave_requests':
          return setLeaveRequests;
        case 'payroll_records':
          return setPayrollRecords;
        case 'expense_claims':
          return setExpenseClaims;
        case 'admissions':
          return setAdmissions;
        case 'students':
          return setStudents;
        case 'student_attendance':
          return setStudentAttendance;
        case 'academics':
          return setAcademics;
        case 'department_cases':
          return setDepartmentCases;
        case 'eraseed_receipts':
          return setEraseedReceipts;
        case 'finance_ledger':
          return setFinanceLedger;
        case 'notices':
          return setNotices;
        case 'audit_logs':
          return setAuditLogs;
        case 'system_config':
          return setSystemConfigs;
        default:
          return null;
      }
    },
    []
  );

  // 2. Real-time Firestore Subscriptions OR Open-Mode Local Persistence
  useEffect(() => {
    if (isOpenMode) {
      setUsers(readOpenCollection<UserProfile>('users'));
      setDivisions(readOpenCollection<Division>('divisions'));
      setBranches(readOpenCollection<Branch>('branches'));
      setDepartments(readOpenCollection<Department>('departments'));
      setSessions(readOpenCollection<AcademicSession>('academic_sessions'));
      setClasses(readOpenCollection<AcademicClass>('classes'));
      setTimetables(readOpenCollection<TimetableEntry>('timetables'));
      setEmployees(readOpenCollection<Employee>('employees'));
      setAttendanceTimings(readOpenCollection<AttendanceTiming>('attendance_timings'));
      setEmployeeAttendance(readOpenCollection<EmployeeAttendance>('employee_attendance'));
      setLeaveRequests(readOpenCollection<LeaveRequest>('leave_requests'));
      setPayrollRecords(readOpenCollection<PayrollRecord>('payroll_records'));
      setExpenseClaims(readOpenCollection<ExpenseClaim>('expense_claims'));
      setAdmissions(readOpenCollection<Admission>('admissions'));
      setStudents(readOpenCollection<Student>('students'));
      setStudentAttendance(readOpenCollection<StudentAttendance>('student_attendance'));
      setAcademics(readOpenCollection<AcademicRecord>('academics'));
      setDepartmentCases(readOpenCollection<DepartmentCase>('department_cases'));
      setEraseedReceipts(readOpenCollection<ERaseedReceipt>('eraseed_receipts'));
      setFinanceLedger(readOpenCollection<FinanceEntry>('finance_ledger'));
      setNotices(readOpenCollection<Notice>('notices'));
      setAuditLogs(readOpenCollection<AuditLog>('audit_logs'));
      setSystemConfigs(readOpenCollection<SystemConfig>('system_config'));
      setLoadingData(false);
      return;
    }

    if (!authReady || !firebaseUser || !isActiveStaff) {
      setUsers([]);
      setDivisions([]);
      setBranches([]);
      setDepartments([]);
      setSessions([]);
      setClasses([]);
      setTimetables([]);
      setEmployees([]);
      setAttendanceTimings([]);
      setEmployeeAttendance([]);
      setLeaveRequests([]);
      setPayrollRecords([]);
      setExpenseClaims([]);
      setAdmissions([]);
      setStudents([]);
      setStudentAttendance([]);
      setAcademics([]);
      setDepartmentCases([]);
      setEraseedReceipts([]);
      setFinanceLedger([]);
      setNotices([]);
      setAuditLogs([]);
      setSystemConfigs([]);
      return;
    }

    setLoadingData(true);
    const unsubs: (() => void)[] = [];

    const subscribe = <T,>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      constraints: QueryConstraint[] = []
    ) => {
      const q = constraints.length
        ? query(collection(db, colName), ...constraints)
        : collection(db, colName);
      const unsub = onSnapshot(
        q,
        (snap) => {
          setter(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as T));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      );
      unsubs.push(unsub);
    };

    // Shared institutional collections (with rule-aligned constraints)
    subscribe<Division>('divisions', setDivisions, [
      where('status', 'in', ['active', 'inactive']),
    ]);
    subscribe<Branch>('branches', setBranches, [
      where('status', 'in', ['active', 'inactive']),
    ]);
    subscribe<Department>('departments', setDepartments, [
      where('status', 'in', ['active', 'inactive']),
    ]);
    subscribe<AcademicSession>('academic_sessions', setSessions, [
      where('status', 'in', ['active', 'archived']),
    ]);
    subscribe<AcademicClass>('classes', setClasses, [
      where('status', 'in', ['active', 'inactive']),
    ]);
    subscribe<TimetableEntry>('timetables', setTimetables, [
      where('dayOfWeek', 'in', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    ]);
    subscribe<AttendanceTiming>('attendance_timings', setAttendanceTimings, [
      where('scopeType', 'in', ['global', 'branch', 'department', 'employee']),
    ]);
    subscribe<Admission>('admissions', setAdmissions, [
      where('workflowStatus', 'in', ['pending_teacher', 'teacher_verified', 'hr_verified', 'active', 'rejected']),
    ]);
    subscribe<Student>('students', setStudents, [
      where('status', 'in', ['active', 'inactive', 'graduated']),
    ]);
    subscribe<StudentAttendance>('student_attendance', setStudentAttendance, [
      where('programType', 'in', ['madrasa', 'qadri40']),
    ]);
    subscribe<AcademicRecord>('academics', setAcademics, [
      where('recordType', 'in', ['homework', 'exam', 'mark', 'progress']),
    ]);
    subscribe<ERaseedReceipt>('eraseed_receipts', setEraseedReceipts, [
      where('receiptType', 'in', ['Receipt', 'Donation', 'Deposit']),
    ]);
    subscribe<FinanceEntry>('finance_ledger', setFinanceLedger, [
      where('entryType', 'in', ['account', 'income', 'expense', 'budget', 'fee', 'asset']),
    ]);
    subscribe<Notice>('notices', setNotices, [
      where('status', 'in', ['published', 'archived']),
    ]);
    subscribe<SystemConfig>('system_config', setSystemConfigs, [
      where('configType', 'in', ['master', 'eraseed', 'backup']),
    ]);

    // PII & Role-Scoped collections
    if (isHR || isPrincipal) {
      subscribe<UserProfile>('users', setUsers, [
        where('status', 'in', ['active', 'pending', 'suspended']),
      ]);
      subscribe<Employee>('employees', setEmployees);
      subscribe<EmployeeAttendance>('employee_attendance', setEmployeeAttendance);
      subscribe<LeaveRequest>('leave_requests', setLeaveRequests);
    } else {
      if (userProfile) setUsers([userProfile]);
      subscribe<Employee>('employees', setEmployees, [where('uid', '==', firebaseUser.uid)]);
      subscribe<EmployeeAttendance>('employee_attendance', setEmployeeAttendance, [
        where('uid', '==', firebaseUser.uid),
      ]);
      subscribe<LeaveRequest>('leave_requests', setLeaveRequests, [
        where('uid', '==', firebaseUser.uid),
      ]);
    }

    if (isHR) {
      subscribe<ExpenseClaim>('expense_claims', setExpenseClaims);
      subscribe<PayrollRecord>('payroll_records', setPayrollRecords);
      subscribe<AuditLog>('audit_logs', setAuditLogs);
    } else {
      subscribe<ExpenseClaim>('expense_claims', setExpenseClaims, [
        where('uid', '==', firebaseUser.uid),
      ]);
      if (userProfile?.employeeId) {
        subscribe<PayrollRecord>('payroll_records', setPayrollRecords, [
          where('employeeId', '==', userProfile.employeeId),
        ]);
      } else {
        setPayrollRecords([]);
      }
      subscribe<AuditLog>('audit_logs', setAuditLogs, [
        where('actorUid', '==', firebaseUser.uid),
      ]);
    }

    setLoadingData(false);
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser, isOpenMode, isActiveStaff, isHR, isPrincipal, userProfile?.employeeId]);

  const logAudit = useCallback(
    async (
      action: string,
      module: string,
      entityType: string,
      entityId: string,
      details: string
    ) => {
      const logId = makeSafeId('log');
      if (isOpenMode) {
        const entry: AuditLog = {
          id: logId,
          action: action.slice(0, 120),
          module: module.slice(0, 80),
          entityType: entityType.slice(0, 80),
          entityId: entityId.slice(0, 128),
          actorUid: 'open_admin',
          actorEmail: 'open-workspace@markazi-cmo.local',
          actorRole: 'super_admin',
          details: details.slice(0, 1000),
          createdAt: new Date().toISOString(),
        };
        setAuditLogs((prev) => {
          const next = [entry, ...prev].slice(0, 300);
          writeOpenCollection('audit_logs', next);
          return next;
        });
        return;
      }
      if (!firebaseUser) return;
      const path = `audit_logs/${logId}`;
      try {
        await setDoc(doc(db, 'audit_logs', logId), {
          action: action.slice(0, 120),
          module: module.slice(0, 80),
          entityType: entityType.slice(0, 80),
          entityId: entityId.slice(0, 128),
          actorUid: firebaseUser.uid,
          actorEmail: (firebaseUser.email || 'unknown').slice(0, 254),
          actorRole: effectiveRole.slice(0, 60),
          details: details.slice(0, 1000),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [firebaseUser, isOpenMode, effectiveRole]
  );

  const createRecord = useCallback(
    async <T extends Record<string, unknown>>(
      collectionName: string,
      id: string,
      payload: T,
      auditMeta?: { action: string; module: string; details: string }
    ) => {
      const clean = stripUndefined(payload);
      if (isOpenMode) {
        const setter = getOpenSetter(collectionName);
        if (!setter) throw new Error(`Unknown collection: ${collectionName}`);
        const nowIso = new Date().toISOString();
        const record = {
          id,
          ...clean,
          ...(collectionName === 'system_config' ? {} : { createdAt: nowIso }),
          updatedAt: nowIso,
        };
        setter((prev) => {
          const filtered = prev.filter((item) => item.id !== id);
          const next = [...filtered, record];
          writeOpenCollection(collectionName, next);
          return next;
        });
        if (auditMeta) {
          await logAudit(auditMeta.action, auditMeta.module, collectionName, id, auditMeta.details);
        }
        return;
      }
      if (!firebaseUser) {
        throw new Error('Click Sign In in the top bar to save records to Firebase.');
      }
      const path = `${collectionName}/${id}`;
      try {
        await setDoc(doc(db, collectionName, id), {
          ...clean,
          ...(collectionName === 'system_config' ? {} : { createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        });
        if (auditMeta) {
          await logAudit(auditMeta.action, auditMeta.module, collectionName, id, auditMeta.details);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [firebaseUser, isOpenMode, getOpenSetter, logAudit]
  );

  const updateRecord = useCallback(
    async (
      collectionName: string,
      id: string,
      payload: Record<string, unknown>,
      auditMeta?: { action: string; module: string; details: string }
    ) => {
      const clean = stripUndefined(payload);
      if (isOpenMode) {
        const setter = getOpenSetter(collectionName);
        if (!setter) throw new Error(`Unknown collection: ${collectionName}`);
        const nowIso = new Date().toISOString();
        setter((prev) => {
          const next = prev.map((item) =>
            item.id === id ? { ...item, ...clean, updatedAt: nowIso } : item
          );
          writeOpenCollection(collectionName, next);
          return next;
        });
        if (auditMeta) {
          await logAudit(auditMeta.action, auditMeta.module, collectionName, id, auditMeta.details);
        }
        return;
      }
      if (!firebaseUser) {
        throw new Error('Click Sign In in the top bar to update records in Firebase.');
      }
      const path = `${collectionName}/${id}`;
      try {
        await updateDoc(doc(db, collectionName, id), {
          ...clean,
          updatedAt: serverTimestamp(),
        });
        if (auditMeta) {
          await logAudit(auditMeta.action, auditMeta.module, collectionName, id, auditMeta.details);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [firebaseUser, isOpenMode, getOpenSetter, logAudit]
  );

  const deleteRecord = useCallback(
    async (
      collectionName: string,
      id: string,
      auditMeta?: { action: string; module: string; details: string }
    ) => {
      if (isOpenMode) {
        const setter = getOpenSetter(collectionName);
        if (!setter) throw new Error(`Unknown collection: ${collectionName}`);
        setter((prev) => {
          const next = prev.filter((item) => item.id !== id);
          writeOpenCollection(collectionName, next);
          return next;
        });
        if (auditMeta) {
          await logAudit(auditMeta.action, auditMeta.module, collectionName, id, auditMeta.details);
        }
        return;
      }
      if (!firebaseUser) {
        throw new Error('Click Sign In in the top bar to delete records in Firebase.');
      }
      const path = `${collectionName}/${id}`;
      try {
        await deleteDoc(doc(db, collectionName, id));
        if (auditMeta) {
          await logAudit(auditMeta.action, auditMeta.module, collectionName, id, auditMeta.details);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [firebaseUser, isOpenMode, getOpenSetter, logAudit]
  );

  const approveAdmissionFinal = useCallback(
    async (admission: Admission, selectedClass: AcademicClass, rollNo: string) => {
      const studentId = makeSafeId('stu');
      const nowIso = new Date().toISOString();

      if (isOpenMode) {
        setAdmissions((prev) => {
          const next = prev.map((a) =>
            a.id === admission.id
              ? {
                  ...a,
                  workflowStatus: 'active' as const,
                  classId: selectedClass.id,
                  superAdminApprovedBy: 'open_admin',
                  superAdminApprovedAt: nowIso,
                  updatedAt: nowIso,
                }
              : a
          );
          writeOpenCollection('admissions', next);
          return next;
        });

        const newStudent: Student = {
          id: studentId,
          admissionId: admission.id,
          rollNo: rollNo.trim().slice(0, 40),
          studentName: admission.studentName,
          fatherName: admission.fatherName,
          guardianPhone: admission.guardianPhone,
          programType: admission.programType,
          divisionId: admission.divisionId || selectedClass.divisionId || '',
          branchId: admission.branchId,
          departmentId: admission.departmentId || '',
          classId: selectedClass.id,
          courseName: selectedClass.courseName || '',
          batchName: selectedClass.batchName || '',
          className: selectedClass.className,
          sectionName: selectedClass.sectionName || '',
          sessionId: admission.sessionId,
          photoUrl: admission.photoUrl || '',
          status: 'active',
          createdBy: 'open_admin',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        setStudents((prev) => {
          const next = [...prev, newStudent];
          writeOpenCollection('students', next);
          return next;
        });

        await logAudit(
          'Super Admin Approved Admission',
          'Online Admission',
          'admissions',
          admission.id,
          `Activated admission ${admission.applicationNo} for ${admission.studentName} (Roll ${rollNo})`
        );
        return;
      }

      if (!firebaseUser) {
        throw new Error('Click Sign In in the top bar to approve admissions in Firebase.');
      }
      if (!isSuperAdmin) {
        throw new Error('Only Super Admin can grant final admission approval.');
      }
      const batch = writeBatch(db);
      const admRef = doc(db, 'admissions', admission.id);
      const stuRef = doc(db, 'students', studentId);

      batch.update(admRef, {
        workflowStatus: 'active',
        classId: selectedClass.id,
        superAdminApprovedBy: firebaseUser.uid,
        superAdminApprovedAt: nowIso,
        updatedAt: serverTimestamp(),
      });

      const stuPayload = stripUndefined({
        admissionId: admission.id,
        rollNo: rollNo.trim().slice(0, 40),
        studentName: admission.studentName,
        fatherName: admission.fatherName,
        guardianPhone: admission.guardianPhone,
        programType: admission.programType,
        divisionId: admission.divisionId || selectedClass.divisionId || '',
        branchId: admission.branchId,
        departmentId: admission.departmentId || '',
        classId: selectedClass.id,
        courseName: selectedClass.courseName || '',
        batchName: selectedClass.batchName || '',
        className: selectedClass.className,
        sectionName: selectedClass.sectionName || '',
        sessionId: admission.sessionId,
        photoUrl: admission.photoUrl || '',
        status: 'active',
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(stuRef, stuPayload);

      try {
        await batch.commit();
        await logAudit(
          'Super Admin Approved Admission',
          'Online Admission',
          'admissions',
          admission.id,
          `Activated admission ${admission.applicationNo} for ${admission.studentName} (Roll ${rollNo})`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `admissions/${admission.id}`);
      }
    },
    [firebaseUser, isOpenMode, isSuperAdmin, logAudit]
  );

  const uploadPhoto = useCallback(
    async (file: File, folder: string): Promise<string> => {
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are permitted for profile photos.');
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Photo file size must be 2 MB or smaller.');
      }
      if (isOpenMode) {
        return fileToCompactDataUrl(file);
      }
      if (!firebaseUser) {
        throw new Error('Click Sign In in the top bar to upload photos to Firebase.');
      }
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = ref(storage, `markazi_cmo/${folder}/${Date.now()}_${cleanName}`);
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    },
    [firebaseUser, isOpenMode]
  );

  const loginWithStaffCredentials = useCallback(
    (loginIdInput: string, passwordInput: string) => {
      const normalized = loginIdInput.trim().toLowerCase();
      if (!normalized || !passwordInput.trim()) {
        return { ok: false, error: 'Enter both Login ID and Password.' };
      }
      const match = employees.find(
        (e) =>
          (e.loginId || '').trim().toLowerCase() === normalized ||
          e.employeeCode.trim().toLowerCase() === normalized
      );
      if (!match) {
        return { ok: false, error: 'No Employee or Teacher found with that Login ID.' };
      }
      if (match.employmentStatus === 'terminated' || match.employmentStatus === 'resigned') {
        return { ok: false, error: `Account is marked ${match.employmentStatus}. Contact HR.` };
      }
      if (!match.passwordHash) {
        return {
          ok: false,
          error: 'No login password has been set for this ID yet. Contact HR to set a password.',
        };
      }
      if (!verifyCredential(passwordInput, match.passwordHash)) {
        return { ok: false, error: 'Incorrect Password for this Employee/Teacher ID.' };
      }
      setStaffSessionEmployeeId(match.id);
      setAdminPinUnlocked(false);
      try {
        sessionStorage.setItem(STAFF_SESSION_KEY, match.id);
        localStorage.setItem(STAFF_SESSION_KEY, match.id);
        sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
      } catch {
        // ignore storage errors
      }
      return { ok: true, employee: match };
    },
    [employees]
  );

  const logoutStaffSession = useCallback(() => {
    setStaffSessionEmployeeId('');
    try {
      sessionStorage.removeItem(STAFF_SESSION_KEY);
      localStorage.removeItem(STAFF_SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const unlockAdminWithPin = useCallback(
    (pin: string) => {
      if (!adminPinHash) {
        setAdminPinUnlocked(true);
        logoutStaffSession();
        return { ok: true };
      }
      if (!verifyCredential(pin, adminPinHash)) {
        return { ok: false, error: 'Invalid Admin Security PIN.' };
      }
      logoutStaffSession();
      setAdminPinUnlocked(true);
      try {
        sessionStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
      } catch {
        // ignore
      }
      return { ok: true };
    },
    [adminPinHash, logoutStaffSession]
  );

  const lockAdminSession = useCallback(() => {
    setAdminPinUnlocked(false);
    try {
      sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    } catch {
      // ignore
    }
  }, []);

  const saveAdminPin = useCallback(
    async (newPin: string, currentPin?: string) => {
      if (adminPinHash && currentPin !== undefined && !verifyCredential(currentPin, adminPinHash)) {
        return { ok: false, error: 'Current Admin PIN is incorrect.' };
      }
      const trimmed = newPin.trim();
      if (trimmed && trimmed.length < 4) {
        return { ok: false, error: 'Admin PIN must be at least 4 characters.' };
      }
      const updater = actorUid || 'open_admin';
      try {
        await createRecord('system_config', 'master_config', {
          configType: 'master',
          institutionName: masterConfig?.institutionName || 'Markazi CMO',
          academicYear: masterConfig?.academicYear || '2026-2027',
          adminPinHash: trimmed ? hashCredential(trimmed) : '',
          updatedBy: updater,
        });
        if (trimmed) {
          setAdminPinUnlocked(true);
          try {
            sessionStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
          } catch {
            // ignore
          }
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to save Admin Security PIN.',
        };
      }
    },
    [adminPinHash, actorUid, createRecord, masterConfig]
  );

  const hasModuleAccess = useCallback(
    (mod: ModuleKey): boolean => {
      if (mod === 'home') return true;
      // Strict HR & Admin governance guard: NEVER accessible to teachers, clerks, or locked terminals
      if (mod === 'super_admin_panel') return isSuperAdmin;
      if (mod === 'hr_control_panel' || mod === 'hr_payroll') return isHR || isSuperAdmin;

      // Active Staff/Teacher Credential Session checks explicit moduleAccess permissions
      if (staffSessionEmployee) {
        const ma = staffSessionEmployee.moduleAccess;
        if (!ma) {
          // Safe default if HR has not configured moduleAccess yet: ESS only
          return (
            mod === 'ess' ||
            mod === 'notice_board' ||
            (staffSessionEmployee.staffRole === 'teacher' && mod === 'teacher_management')
          );
        }
        switch (mod) {
          case 'ess':
            return Boolean(ma.ess);
          case 'erp':
            return Boolean(ma.erp);
          case 'e_raseed':
            return Boolean(ma.e_raseed);
          case 'teacher_management':
            return ma.teacher_management ?? (staffSessionEmployee.staffRole === 'teacher');
          case 'madrasas':
            return ma.madrasas ?? true;
          case 'qadri_40':
            return ma.qadri_40 ?? true;
          case 'online_admission':
            return ma.online_admission ?? true;
          case 'notice_board':
            return ma.notice_board ?? true;
          case 'reports_analytics':
            return ma.reports_analytics ?? false;
          default:
            return false;
        }
      }

      if (mod === 'teacher_management') {
        return isTeacher || isPrincipal || isHR || isSuperAdmin;
      }

      return true;
    },
    [isSuperAdmin, isHR, isPrincipal, isTeacher, staffSessionEmployee]
  );

  const needsModuleCredentialGate = useCallback(
    (mod: ModuleKey): boolean => {
      if (!['ess', 'erp', 'e_raseed'].includes(mod)) return false;
      // If a staff/teacher session is already logged in, credential gate is satisfied
      if (staffSessionEmployee) return false;
      // If Firebase Auth user is signed in AND their linked employee record has password protection, require verification once
      if (hasProtectedEmployees && !adminPinUnlocked) {
        return true;
      }
      return false;
    },
    [staffSessionEmployee, hasProtectedEmployees, adminPinUnlocked]
  );

  return (
    <CMOContext.Provider
      value={{
        firebaseUser,
        userProfile,
        authReady,
        loadingData,
        isOpenMode,
        actorUid,
        actorName,
        signInWithGoogle,
        signOut,
        staffSessionEmployee,
        isStaffSessionActive,
        hasAdminPin,
        isAdminUnlocked,
        hasProtectedEmployees,
        loginWithStaffCredentials,
        logoutStaffSession,
        unlockAdminWithPin,
        lockAdminSession,
        saveAdminPin,
        hasModuleAccess,
        needsModuleCredentialGate,
        effectiveRole,
        isSuperAdmin,
        isHR,
        isPrincipal,
        isTeacher,
        isDeptSupervisor,
        isActiveStaff,
        users,
        divisions,
        branches,
        departments,
        sessions,
        classes,
        timetables,
        employees,
        attendanceTimings,
        employeeAttendance,
        leaveRequests,
        payrollRecords,
        expenseClaims,
        admissions,
        students,
        studentAttendance,
        academics,
        departmentCases,
        eraseedReceipts,
        financeLedger,
        notices,
        auditLogs,
        systemConfigs,
        createRecord,
        updateRecord,
        deleteRecord,
        approveAdmissionFinal,
        logAudit,
        uploadPhoto,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </CMOContext.Provider>
  );
}

export function useCMO(): CMOContextValue {
  const ctx = useContext(CMOContext);
  if (!ctx) throw new Error('useCMO must be used within CMOProvider');
  return ctx;
}
