import React, { useMemo, useState } from 'react';
import { Calendar, Download, Eye, Check, Trash2, X } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { formatCounter, Student, StudentAttendance } from '../../types';
import {
  exportToCsv,
  getCurrentMonthStr,
  getPreviousMonthStr,
  getTodayStr,
  getWeekBounds,
  getYesterdayStr,
  makeSafeId,
} from '../../utils/validation';
import { AvatarFrame, CounterStat, EmptyState, StatusTag } from '../SharedUI';

type DateFilterMode =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'previous_month'
  | 'select_month'
  | 'custom_range';

export function StudentAttendanceWorkspace({
  programType,
}: {
  programType: 'madrasa' | 'qadri40';
}) {
  const {
    actorUid,
    actorName,
    divisions,
    branches,
    classes,
    sessions,
    students,
    studentAttendance,
    isTeacher,
    isDeptSupervisor,
    isHR,
    isPrincipal,
    isSuperAdmin,
    createRecord,
    updateRecord,
    deleteRecord,
    notify,
  } = useCMO();

  // Hierarchy selectors
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [markDate, setMarkDate] = useState(getTodayStr());

  // Attendance history filters (All 7 required filters)
  const [filterMode, setFilterMode] = useState<DateFilterMode>('this_month');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  const [rangeStart, setRangeStart] = useState(getTodayStr());
  const [rangeEnd, setRangeEnd] = useState(getTodayStr());

  // Individual Student Profile Modal
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [confirmDeleteAttId, setConfirmDeleteAttId] = useState('');

  const programClasses = useMemo(
    () => classes.filter((c) => c.programType === programType),
    [classes, programType]
  );

  const filteredClasses = useMemo(() => {
    return programClasses.filter((c) => {
      if (programType === 'madrasa') {
        if (selectedDivisionId && c.divisionId !== selectedDivisionId) return false;
        if (selectedBranchId && c.branchId !== selectedBranchId) return false;
      } else {
        if (selectedCourseName && c.courseName !== selectedCourseName) return false;
        if (selectedBatchName && c.batchName !== selectedBatchName) return false;
      }
      return true;
    });
  }, [
    programClasses,
    programType,
    selectedDivisionId,
    selectedBranchId,
    selectedCourseName,
    selectedBatchName,
  ]);

  const activeClass = useMemo(
    () => programClasses.find((c) => c.id === selectedClassId),
    [programClasses, selectedClassId]
  );

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter((s) => s.classId === selectedClassId && s.status === 'active');
  }, [students, selectedClassId]);

  const courseOptions = useMemo(
    () => Array.from(new Set(programClasses.map((c) => c.courseName).filter(Boolean) as string[])),
    [programClasses]
  );

  const batchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          programClasses
            .filter((c) => !selectedCourseName || c.courseName === selectedCourseName)
            .map((c) => c.batchName)
            .filter(Boolean) as string[]
        )
      ),
    [programClasses, selectedCourseName]
  );

  const canMark = isTeacher || isDeptSupervisor || isPrincipal || isHR || isSuperAdmin;
  const canApprove = isDeptSupervisor || isHR || isSuperAdmin;

  const handleMarkStudent = async (
    student: Student,
    status: 'Present' | 'Absent' | 'Leave' | 'Sick'
  ) => {
    if (!actorUid || !canMark) {
      notify('You do not have permission to mark student attendance.', 'error');
      return;
    }
    const existing = studentAttendance.find(
      (r) => r.studentId === student.id && r.date === markDate
    );
    const monthKey = markDate.slice(0, 7);

    try {
      if (existing) {
        if (!canApprove && existing.approvalStatus === 'approved') {
          notify('Approved historical records can only be edited by Department Supervisor or Super Admin.', 'error');
          return;
        }
        await updateRecord(
          'student_attendance',
          existing.id,
          {
            status,
            approvalStatus: canApprove ? 'approved' : 'pending_supervisor',
            ...(canApprove
              ? { approvedBy: actorUid, approvedAt: new Date().toISOString() }
              : {}),
          },
          {
            action: 'Updated Student Attendance',
            module: programType === 'madrasa' ? 'Madrasas' : 'QADRI 40',
            details: `${student.studentName} on ${markDate}: ${status}`,
          }
        );
      } else {
        const id = makeSafeId('stuatt');
        await createRecord(
          'student_attendance',
          id,
          {
            studentId: student.id,
            studentName: student.studentName,
            rollNo: student.rollNo,
            programType,
            branchId: student.branchId,
            divisionId: student.divisionId || '',
            classId: student.classId,
            sessionId: student.sessionId,
            date: markDate,
            monthKey,
            status,
            markedBy: actorUid,
            markedByName: actorName,
            approvalStatus: canApprove ? 'approved' : 'pending_supervisor',
            ...(canApprove
              ? { approvedBy: actorUid, approvedAt: new Date().toISOString() }
              : {}),
          },
          {
            action: 'Marked Student Attendance',
            module: programType === 'madrasa' ? 'Madrasas' : 'QADRI 40',
            details: `${student.studentName} (${markDate}) marked ${status}`,
          }
        );
      }
      notify(`${student.studentName} marked ${status} for ${markDate}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save student attendance.', 'error');
    }
  };

  const handleSupervisorApprove = async (rec: StudentAttendance, approve: boolean) => {
    if (!actorUid || !canApprove) return;
    try {
      await updateRecord(
        'student_attendance',
        rec.id,
        {
          approvalStatus: approve ? 'approved' : 'rejected',
          approvedBy: actorUid,
          approvedAt: new Date().toISOString(),
        },
        {
          action: approve ? 'Approved Student Attendance' : 'Rejected Student Attendance',
          module: programType === 'madrasa' ? 'Madrasas' : 'QADRI 40',
          details: `${rec.studentName} (${rec.date}) -> ${approve ? 'approved' : 'rejected'}`,
        }
      );
      notify(`Attendance record ${approve ? 'approved' : 'rejected'}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Approval update failed.', 'error');
    }
  };

  const handleDeleteAttendance = async (rec: StudentAttendance) => {
    if (!isSuperAdmin) return;
    try {
      await deleteRecord('student_attendance', rec.id, {
        action: 'Deleted Student Attendance Log',
        module: programType === 'madrasa' ? 'Madrasas' : 'QADRI 40',
        details: `Deleted ${rec.studentName} (${rec.date})`,
      });
      setConfirmDeleteAttId('');
      notify(`Deleted attendance record for ${rec.studentName}.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  // Filtered historical attendance records (never deleted on new month)
  const dateFilteredAttendance = useMemo(() => {
    const today = getTodayStr();
    const yesterday = getYesterdayStr();
    const thisMonth = getCurrentMonthStr();
    const prevMonth = getPreviousMonthStr();
    const week = getWeekBounds();

    return studentAttendance
      .filter((r) => r.programType === programType)
      .filter((r) => {
        if (selectedClassId && r.classId !== selectedClassId) return false;
        switch (filterMode) {
          case 'today':
            return r.date === today;
          case 'yesterday':
            return r.date === yesterday;
          case 'this_week':
            return r.date >= week.start && r.date <= week.end;
          case 'this_month':
            return r.monthKey === thisMonth;
          case 'previous_month':
            return r.monthKey === prevMonth;
          case 'select_month':
            return r.monthKey === selectedMonth;
          case 'custom_range':
            return (!rangeStart || r.date >= rangeStart) && (!rangeEnd || r.date <= rangeEnd);
          default:
            return true;
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    studentAttendance,
    programType,
    selectedClassId,
    filterMode,
    selectedMonth,
    rangeStart,
    rangeEnd,
  ]);

  const pendingSupervisorQueue = useMemo(
    () =>
      studentAttendance.filter(
        (r) => r.programType === programType && r.approvalStatus === 'pending_supervisor'
      ),
    [studentAttendance, programType]
  );

  // Student Individual Profile Stats
  const profileStats = useMemo(() => {
    if (!profileStudent) return null;
    const allRecs = studentAttendance
      .filter((r) => r.studentId === profileStudent.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const prevMonthKey = getPreviousMonthStr();
    const currMonthKey = getCurrentMonthStr();

    const present = allRecs.filter((r) => r.status === 'Present').length;
    const absent = allRecs.filter((r) => r.status === 'Absent').length;
    const leave = allRecs.filter((r) => r.status === 'Leave').length;
    const sick = allRecs.filter((r) => r.status === 'Sick').length;
    const total = allRecs.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    // Group by month
    const byMonth = new Map<string, { present: number; absent: number; leave: number; sick: number; total: number }>();
    for (const r of allRecs) {
      const m = byMonth.get(r.monthKey) || { present: 0, absent: 0, leave: 0, sick: 0, total: 0 };
      m.total += 1;
      if (r.status === 'Present') m.present += 1;
      if (r.status === 'Absent') m.absent += 1;
      if (r.status === 'Leave') m.leave += 1;
      if (r.status === 'Sick') m.sick += 1;
      byMonth.set(r.monthKey, m);
    }

    // Group by session
    const bySession = new Map<string, number>();
    for (const r of allRecs) {
      bySession.set(r.sessionId, (bySession.get(r.sessionId) || 0) + 1);
    }

    return {
      allRecs,
      present,
      absent,
      leave,
      sick,
      total,
      pct,
      currMonthRecs: allRecs.filter((r) => r.monthKey === currMonthKey),
      prevMonthRecs: allRecs.filter((r) => r.monthKey === prevMonthKey),
      monthlySummary: Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0])),
      sessionSummary: Array.from(bySession.entries()),
    };
  }, [profileStudent, studentAttendance]);

  return (
    <div className="space-y-6">
      {/* Hierarchy & Date Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {programType === 'madrasa'
                ? 'Madrasas Student Attendance (Division → Branch → Class → Section → Students)'
                : 'QADRI 40 Student Attendance (Course → Batch → Class → Students)'}
            </h3>
            <p className="text-xs text-slate-500">
              Separate from ESS · Historical monthly and academic session records are permanently preserved
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={markDate}
              onChange={(e) => setMarkDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {programType === 'madrasa' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">1. Division</label>
                <select
                  value={selectedDivisionId}
                  onChange={(e) => {
                    setSelectedDivisionId(e.target.value);
                    setSelectedClassId('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All Divisions</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">2. Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setSelectedClassId('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter((b) => !selectedDivisionId || b.divisionId === selectedDivisionId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  3. Class &amp; Section
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Class &amp; Section</option>
                  {filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} {c.sectionName ? `– Sec ${c.sectionName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">1. Course</label>
                <select
                  value={selectedCourseName}
                  onChange={(e) => {
                    setSelectedCourseName(e.target.value);
                    setSelectedBatchName('');
                    setSelectedClassId('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All Courses</option>
                  {courseOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">2. Batch</label>
                <select
                  value={selectedBatchName}
                  onChange={(e) => {
                    setSelectedBatchName(e.target.value);
                    setSelectedClassId('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All Batches</option>
                  {batchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">3. Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Class</option>
                  {filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} {c.batchName ? `(${c.batchName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Daily Attendance Marking Grid */}
      {!selectedClassId ? (
        <EmptyState
          title="Select a Class / Section to Mark Attendance"
          description="Choose from the hierarchy above to load enrolled active students and mark Present, Absent, Leave, or Sick."
        />
      ) : classStudents.length === 0 ? (
        <EmptyState
          title="No Active Students in This Class"
          description="Students become active here only after Online Admission completes Teacher, HR, and Super Admin approval."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              {activeClass?.className} {activeClass?.sectionName ? `· Sec ${activeClass.sectionName}` : ''} · {formatCounter(classStudents.length)} Students · Date {markDate}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Roll No</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Marked Status</th>
                  <th className="py-2.5 px-4">Supervisor Approval</th>
                  <th className="py-2.5 px-4 text-right">Mark Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {classStudents.map((stu) => {
                  const rec = studentAttendance.find(
                    (r) => r.studentId === stu.id && r.date === markDate
                  );
                  return (
                    <tr key={stu.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{stu.rollNo}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <AvatarFrame photoUrl={stu.photoUrl} alt={stu.studentName} size="sm" />
                          <div>
                            <button
                              onClick={() => setProfileStudent(stu)}
                              className="font-medium text-slate-900 hover:text-emerald-800 inline-flex items-center gap-1"
                            >
                              {stu.studentName}
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <div className="text-xs text-slate-500">S/D/o {stu.fatherName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {rec ? <StatusTag status={rec.status} /> : <span className="text-xs text-slate-400">Unmarked</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        {rec ? <StatusTag status={rec.approvalStatus} /> : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {(['Present', 'Absent', 'Leave', 'Sick'] as const).map((st) => (
                            <button
                              key={st}
                              disabled={!canMark}
                              onClick={() => handleMarkStudent(stu, st)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                                rec?.status === st
                                  ? 'bg-emerald-800 text-white border-emerald-800'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supervisor Approval Queue */}
      {canApprove && pendingSupervisorQueue.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-amber-50/70 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              Department Supervisor Approval Queue ({formatCounter(pendingSupervisorQueue.length)})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Marked By</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pendingSupervisorQueue.map((rec) => (
                  <tr key={rec.id}>
                    <td className="py-2.5 px-4 font-mono text-xs">{rec.date}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {rec.studentName} ({rec.rollNo})
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{rec.markedByName || rec.markedBy}</td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={rec.status} />
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleSupervisorApprove(rec, true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-md"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleSupervisorApprove(rec, false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Records & All 7 Date Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold text-slate-900">
              Attendance History &amp; Session Ledger ({formatCounter(dateFilteredAttendance.length)})
            </h4>
            {dateFilteredAttendance.length > 0 && (
              <button
                onClick={() =>
                  exportToCsv(
                    `${programType}_attendance_${filterMode}.csv`,
                    ['Date', 'Roll No', 'Student', 'Status', 'Approval'],
                    dateFilteredAttendance.map((r) => [
                      r.date,
                      r.rollNo,
                      r.studentName,
                      r.status,
                      r.approvalStatus,
                    ])
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100"
              >
                <Download className="w-3 h-3" /> Export Filtered CSV
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['today', 'Today'],
                ['yesterday', 'Yesterday'],
                ['this_week', 'This Week'],
                ['this_month', 'This Month'],
                ['previous_month', 'Previous Month'],
                ['select_month', 'Select Month'],
                ['custom_range', 'Custom Date Range'],
              ] as [DateFilterMode, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  filterMode === key
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filterMode === 'select_month' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Select Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
            />
          </div>
        )}

        {filterMode === 'custom_range' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">From:</label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">To:</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>
        )}

        {dateFilteredAttendance.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">
            No attendance records match the selected date filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Roll No</th>
                  <th className="py-2 px-3">Student</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Approval</th>
                  {isSuperAdmin && <th className="py-2 px-3 text-right">Admin</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {dateFilteredAttendance.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">{r.date}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-600">{r.rollNo}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{r.studentName}</td>
                    <td className="py-2 px-3">
                      <StatusTag status={r.status} />
                    </td>
                    <td className="py-2 px-3">
                      <StatusTag status={r.approvalStatus} />
                    </td>
                    {isSuperAdmin && (
                      <td className="py-2 px-3 text-right space-x-1 whitespace-nowrap">
                        {confirmDeleteAttId === r.id ? (
                          <>
                            <button onClick={() => handleDeleteAttendance(r)} className="px-2 py-0.5 text-xs bg-red-600 text-white rounded">Confirm</button>
                            <button onClick={() => setConfirmDeleteAttId('')} className="px-2 py-0.5 text-xs border border-slate-200 rounded">No</button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteAttId(r.id)}
                            className="p-1 text-red-700 hover:bg-red-50 rounded"
                            aria-label="Delete attendance"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual Student Attendance Profile Modal */}
      {profileStudent && profileStats && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                <AvatarFrame photoUrl={profileStudent.photoUrl} alt={profileStudent.studentName} size="lg" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {profileStudent.studentName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Roll {profileStudent.rollNo} · S/D/o {profileStudent.fatherName} · {profileStudent.className || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProfileStudent(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <CounterStat label="Working Days" value={profileStats.total} />
              <CounterStat label="Present" value={profileStats.present} />
              <CounterStat label="Absent" value={profileStats.absent} />
              <CounterStat label="Leave" value={profileStats.leave} />
              <CounterStat label="Sick" value={profileStats.sick} />
              <CounterStat label="Percentage" value={`${formatCounter(profileStats.pct)}%`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                  Monthly Attendance &amp; Previous Month Summary
                </h4>
                {profileStats.monthlySummary.length === 0 ? (
                  <p className="text-xs text-slate-500">No monthly records yet.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {profileStats.monthlySummary.map(([m, stats]) => (
                      <div key={m} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="font-mono font-medium text-slate-800">{m}</span>
                        <span className="font-mono text-slate-600">
                          P:{formatCounter(stats.present)} · A:{formatCounter(stats.absent)} · L:{formatCounter(stats.leave)} · S:{formatCounter(stats.sick)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                  Academic Session History
                </h4>
                {profileStats.sessionSummary.length === 0 ? (
                  <p className="text-xs text-slate-500">No session history recorded yet.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {profileStats.sessionSummary.map(([sessId, count]) => {
                      const sess = sessions.find((s) => s.id === sessId);
                      return (
                        <div key={sessId} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-medium text-slate-800">{sess?.name || sessId}</span>
                          <span className="font-mono text-slate-600">{formatCounter(count)} days logged</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                Daily &amp; Previous Month Records
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                {profileStats.allRecs.length === 0 ? (
                  <div className="p-4 text-slate-500">No daily attendance entries yet.</div>
                ) : (
                  profileStats.allRecs.map((r) => (
                    <div key={r.id} className="px-4 py-2 flex items-center justify-between">
                      <span className="font-mono text-slate-700">{r.date}</span>
                      <div className="flex items-center gap-2">
                        <StatusTag status={r.status} />
                        <StatusTag status={r.approvalStatus} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
