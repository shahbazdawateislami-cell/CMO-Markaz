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
  Notice,
  PayrollRecord,
  Student,
  StudentAttendance,
  SystemConfig,
  TimetableEntry,
  UserProfile,
} from '../types';
import { makeSafeId } from '../utils/validation';

// Toggle to true whenever the Sign-In lock screen should be re-enabled
export const AUTH_LOCK_ENABLED = false;

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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  // Role helpers
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

  const isBootstrappedOwner =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email === BOOTSTRAPPED_SUPER_ADMIN_EMAIL;

  const effectiveRole = isBootstrappedOwner
    ? 'super_admin'
    : userProfile?.role || 'pending';

  const isSuperAdmin = effectiveRole === 'super_admin' && (isBootstrappedOwner || userProfile?.status === 'active');
  const isHR = isSuperAdmin || (effectiveRole === 'hr' && userProfile?.status === 'active');
  const isPrincipal = isSuperAdmin || (effectiveRole === 'principal' && userProfile?.status === 'active');
  const isTeacher = effectiveRole === 'teacher' && userProfile?.status === 'active';
  const isDeptSupervisor = effectiveRole === 'department_supervisor' && userProfile?.status === 'active';
  const isActiveStaff =
    isSuperAdmin ||
    (Boolean(userProfile) &&
      userProfile?.status === 'active' &&
      ['super_admin', 'hr', 'principal', 'teacher', 'department_supervisor', 'staff'].includes(
        userProfile.role
      ));

  // 2. Real-time Firestore Subscriptions (Strictly gated on authReady & active staff role)
  useEffect(() => {
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
    subscribe<DepartmentCase>('department_cases', setDepartmentCases, [
      where('moduleType', 'in', [
        'darul_ifta',
        'darul_qaza',
        'darul_iqama',
        'tahreek_bedari',
        'digital_library',
        'online_courses',
        'project_existing',
        'project_upcoming',
      ]),
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
  }, [authReady, firebaseUser, isActiveStaff, isHR, isPrincipal, userProfile?.employeeId]);

  const logAudit = useCallback(
    async (
      action: string,
      module: string,
      entityType: string,
      entityId: string,
      details: string
    ) => {
      if (!firebaseUser) return;
      const logId = makeSafeId('log');
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
    [firebaseUser, effectiveRole]
  );

  const createRecord = useCallback(
    async <T extends Record<string, unknown>>(
      collectionName: string,
      id: string,
      payload: T,
      auditMeta?: { action: string; module: string; details: string }
    ) => {
      if (!firebaseUser) {
        notify('Click Sign In in the top bar to save records to Firebase.', 'info');
        return;
      }
      const clean = stripUndefined(payload);
      const path = `${collectionName}/${id}`;
      try {
        await setDoc(doc(db, collectionName, id), {
          ...clean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (auditMeta) {
          await logAudit(auditMeta.action, auditMeta.module, collectionName, id, auditMeta.details);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [firebaseUser, logAudit, notify]
  );

  const updateRecord = useCallback(
    async (
      collectionName: string,
      id: string,
      payload: Record<string, unknown>,
      auditMeta?: { action: string; module: string; details: string }
    ) => {
      if (!firebaseUser) {
        notify('Click Sign In in the top bar to save updates to Firebase.', 'info');
        return;
      }
      const clean = stripUndefined(payload);
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
    [firebaseUser, logAudit, notify]
  );

  const deleteRecord = useCallback(
    async (
      collectionName: string,
      id: string,
      auditMeta?: { action: string; module: string; details: string }
    ) => {
      if (!firebaseUser) {
        notify('Click Sign In in the top bar to manage records in Firebase.', 'info');
        return;
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
    [firebaseUser, logAudit, notify]
  );

  const approveAdmissionFinal = useCallback(
    async (admission: Admission, selectedClass: AcademicClass, rollNo: string) => {
      if (!firebaseUser) {
        throw new Error('Click Sign In in the top bar to approve admissions in Firebase.');
      }
      if (!isSuperAdmin) {
        throw new Error('Only Super Admin can grant final admission approval.');
      }
      const batch = writeBatch(db);
      const admRef = doc(db, 'admissions', admission.id);
      const studentId = makeSafeId('stu');
      const stuRef = doc(db, 'students', studentId);

      batch.update(admRef, {
        workflowStatus: 'active',
        classId: selectedClass.id,
        superAdminApprovedBy: firebaseUser.uid,
        superAdminApprovedAt: new Date().toISOString(),
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
    [firebaseUser, isSuperAdmin, logAudit]
  );

  const uploadPhoto = useCallback(async (file: File, folder: string): Promise<string> => {
    if (!firebaseUser) {
      throw new Error('Click Sign In in the top bar to upload photos to Firebase.');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are permitted for profile photos.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Photo file size must be 2 MB or smaller.');
    }
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(storage, `markazi_cmo/${folder}/${Date.now()}_${cleanName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }, [firebaseUser]);

  return (
    <CMOContext.Provider
      value={{
        firebaseUser,
        userProfile,
        authReady,
        loadingData,
        signInWithGoogle,
        signOut,
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
