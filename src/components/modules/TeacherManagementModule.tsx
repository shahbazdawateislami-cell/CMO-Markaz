import React, { useMemo, useState } from 'react';
import { useCMO } from '../../context/CMOContext';
import { formatCounter, ModuleKey } from '../../types';
import { getTodayStr, makeSafeId, sanitizeStr } from '../../utils/validation';
import { AvatarFrame, CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

type TeacherTab =
  | 'profile'
  | 'attendance'
  | 'classes'
  | 'timetable'
  | 'students'
  | 'admissions'
  | 'homework'
  | 'exams_marks'
  | 'progress'
  | 'communication';

export function TeacherManagementModule({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const {
    firebaseUser,
    userProfile,
    employees,
    classes,
    timetables,
    students,
    admissions,
    academics,
    notices,
    employeeAttendance,
    branches,
    createRecord,
    updateRecord,
    notify,
  } = useCMO();

  const [tab, setTab] = useState<TeacherTab>('profile');

  // Academic form state (Homework, Exam, Mark, Progress)
  const [recordType, setRecordType] = useState<'homework' | 'exam' | 'mark' | 'progress'>('homework');
  const [branchId, setBranchId] = useState('');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [maxMarks, setMaxMarks] = useState('100');
  const [obtainedMarks, setObtainedMarks] = useState('');
  const [grade, setGrade] = useState('');
  const [remarks, setRemarks] = useState('');

  // Timetable creation form
  const [ttClassId, setTtClassId] = useState('');
  const [ttDay, setTtDay] = useState<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'>('Monday');
  const [ttStart, setTtStart] = useState('08:00');
  const [ttEnd, setTtEnd] = useState('09:00');
  const [ttSubject, setTtSubject] = useState('');
  const [ttRoom, setTtRoom] = useState('');

  const teacherEmp = useMemo(
    () =>
      employees.find((e) => e.uid === firebaseUser?.uid) ||
      employees.find((e) => e.id === userProfile?.employeeId),
    [employees, firebaseUser, userProfile]
  );

  const myClasses = useMemo(
    () =>
      classes.filter(
        (c) => !c.teacherUid || c.teacherUid === firebaseUser?.uid
      ),
    [classes, firebaseUser]
  );

  const myTimetables = useMemo(
    () =>
      timetables.filter(
        (t) => !t.teacherUid || t.teacherUid === firebaseUser?.uid
      ),
    [timetables, firebaseUser]
  );

  const myAttendance = useMemo(
    () => employeeAttendance.filter((a) => a.uid === firebaseUser?.uid),
    [employeeAttendance, firebaseUser]
  );

  const handleSaveAcademic = async (e: React.FormEvent, forcedType?: 'homework' | 'exam' | 'mark' | 'progress') => {
    e.preventDefault();
    if (!firebaseUser) return;
    const type = forcedType || recordType;
    const targetBranch = branchId || teacherEmp?.branchId || branches[0]?.id || '';
    if (!targetBranch) {
      notify('Select a Branch first.', 'error');
      return;
    }
    const stu = students.find((s) => s.id === studentId);
    const id = makeSafeId('acad');
    try {
      await createRecord(
        'academics',
        id,
        {
          recordType: type,
          branchId: targetBranch,
          classId: classId || '',
          studentId: studentId || '',
          studentName: stu?.studentName || '',
          title: sanitizeStr(title, 160),
          subject: sanitizeStr(subject, 120),
          dueDate,
          ...(maxMarks ? { maxMarks: Math.max(0, Number(maxMarks) || 0) } : {}),
          ...(obtainedMarks ? { obtainedMarks: Math.max(0, Number(obtainedMarks) || 0) } : {}),
          grade: sanitizeStr(grade, 20),
          remarks: sanitizeStr(remarks, 500),
          teacherUid: firebaseUser.uid,
          teacherName: userProfile?.displayName || firebaseUser.email || 'Teacher',
        },
        {
          action: `Created Academic ${type}`,
          module: 'Teacher Management',
          details: `${type}: ${sanitizeStr(title, 100)} (${sanitizeStr(subject, 60)})`,
        }
      );
      setTitle('');
      setSubject('');
      setObtainedMarks('');
      setGrade('');
      setRemarks('');
      notify(`${type.toUpperCase()} record saved.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save academic record.', 'error');
    }
  };

  const handleCreateTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !ttClassId) {
      notify('Select a class for timetable entry.', 'error');
      return;
    }
    const cls = classes.find((c) => c.id === ttClassId);
    if (!cls) return;
    const id = makeSafeId('tt');
    try {
      await createRecord(
        'timetables',
        id,
        {
          classId: cls.id,
          branchId: cls.branchId,
          teacherUid: firebaseUser.uid,
          dayOfWeek: ttDay,
          startTime: ttStart,
          endTime: ttEnd,
          subject: sanitizeStr(ttSubject, 120),
          room: sanitizeStr(ttRoom, 60),
          createdBy: firebaseUser.uid,
        },
        {
          action: 'Added Timetable Slot',
          module: 'Teacher Management',
          details: `${ttDay} ${ttStart}-${ttEnd} ${ttSubject}`,
        }
      );
      setTtSubject('');
      setTtRoom('');
      notify('Timetable slot added.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add timetable slot.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Teacher Management Workspace"
        subtitle="Teacher Profile, Attendance, Class Allocation, Timetable, Student Records, Admission Verification, Homework, Exams, Marks & Progress"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('madrasas')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap"
            >
              Mark Student Attendance (Madrasas)
            </button>
            <button
              onClick={() => onNavigate('qadri_40')}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              QADRI 40 Attendance
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            ['profile', 'Teacher Profile'],
            ['attendance', 'My Attendance'],
            ['classes', 'Class Allocation'],
            ['timetable', 'Timetable'],
            ['students', 'Student Records'],
            ['admissions', 'Admission Verification'],
            ['homework', 'Homework'],
            ['exams_marks', 'Exams, Marks & Results'],
            ['progress', 'Student Progress'],
            ['communication', 'Communication'],
          ] as [TeacherTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              tab === k
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row items-start gap-5">
          <AvatarFrame
            photoUrl={teacherEmp?.photoUrl || userProfile?.photoUrl}
            alt={userProfile?.displayName || 'Teacher'}
            size="lg"
          />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {teacherEmp?.fullName || userProfile?.displayName}
            </h3>
            <p className="text-sm text-slate-600">
              {teacherEmp?.designation || 'Faculty Member'} · {userProfile?.email}
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-600">
              <span>Employee ID: <strong className="font-mono">{teacherEmp?.employeeCode || 'Unlinked'}</strong></span>
              <span>Allocated Classes: <strong className="font-mono">{formatCounter(myClasses.length)}</strong></span>
              <span>Timetable Slots: <strong className="font-mono">{formatCounter(myTimetables.length)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Teachers mark personal manual attendance inside ESS; Principal approves before it reaches HR Records.
            </div>
            <button
              onClick={() => onNavigate('ess')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg"
            >
              Open ESS Manual Attendance
            </button>
          </div>
          {myAttendance.length === 0 ? (
            <EmptyState
              title="No Teacher Attendance Logs"
              description="Mark manual attendance in ESS to view your attendance history and Principal approval status."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Time</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Principal Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {myAttendance.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 px-4 font-mono text-xs">{a.date}</td>
                      <td className="py-2.5 px-4 font-mono text-xs">{a.markedTime}</td>
                      <td className="py-2.5 px-4"><StatusTag status={a.status} /></td>
                      <td className="py-2.5 px-4"><StatusTag status={a.approvalStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myClasses.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                title="No Classes Allocated"
                description="Classes assigned to you in Madrasas or QADRI 40 will appear here."
              />
            </div>
          ) : (
            myClasses.map((c) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400">{c.programType}</span>
                  <StatusTag status={c.status} />
                </div>
                <h4 className="text-base font-semibold text-slate-900">
                  {c.className} {c.sectionName ? `– Sec ${c.sectionName}` : ''}
                </h4>
                <p className="text-xs text-slate-500">
                  {branches.find((b) => b.id === c.branchId)?.name || c.branchId}
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs font-mono text-slate-600">
                  Enrolled Students: {formatCounter(students.filter((s) => s.classId === c.id).length)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'timetable' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateTimetable}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">Add Timetable Slot</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
              <select
                required
                value={ttClassId}
                onChange={(e) => setTtClassId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} {c.sectionName ? `(${c.sectionName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
              <select
                value={ttDay}
                onChange={(e) => setTtDay(e.target.value as typeof ttDay)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start</label>
                <input type="time" required value={ttStart} onChange={(e) => setTtStart(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End</label>
                <input type="time" required value={ttEnd} onChange={(e) => setTtEnd(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input type="text" required value={ttSubject} onChange={(e) => setTtSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Room</label>
                <input type="text" value={ttRoom} onChange={(e) => setTtRoom(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
            </div>
            <button type="submit" className="w-full py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg">
              Save Timetable Slot
            </button>
          </form>

          <div className="lg:col-span-2">
            {myTimetables.length === 0 ? (
              <EmptyState title="No Timetable Slots" description="Add timetable periods using the form on the left." />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Day</th>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Class</th>
                      <th className="py-2.5 px-4">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {myTimetables.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-4 font-medium">{t.dayOfWeek}</td>
                        <td className="py-2.5 px-4 font-mono text-xs">{t.startTime} – {t.endTime}</td>
                        <td className="py-2.5 px-4">{t.subject}</td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">{classes.find((c) => c.id === t.classId)?.className || t.classId}</td>
                        <td className="py-2.5 px-4 text-xs font-mono">{t.room || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'students' && (
        <div>
          {students.length === 0 ? (
            <EmptyState title="No Active Students" description="Active students appear after Super Admin final admission approval." />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Roll No</th>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Program &amp; Class</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-4 font-mono text-xs">{s.rollNo}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{s.studentName} (S/D/o {s.fatherName})</td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">{s.programType} · {s.className}</td>
                      <td className="py-2.5 px-4"><StatusTag status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'admissions' && (
        <div className="space-y-3">
          {admissions.filter((a) => a.workflowStatus === 'pending_teacher').length === 0 ? (
            <EmptyState title="No Admissions Pending Teacher Verification" description="Submitted applications awaiting Stage 1 verification appear here." />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">App No</th>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Program</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {admissions
                    .filter((a) => a.workflowStatus === 'pending_teacher')
                    .map((adm) => (
                      <tr key={adm.id}>
                        <td className="py-2.5 px-4 font-mono text-xs">{adm.applicationNo}</td>
                        <td className="py-2.5 px-4 font-medium">{adm.studentName}</td>
                        <td className="py-2.5 px-4 text-xs uppercase">{adm.programType}</td>
                        <td className="py-2.5 px-4 text-right space-x-2">
                          <button
                            onClick={() =>
                              updateRecord('admissions', adm.id, {
                                workflowStatus: 'teacher_verified',
                                teacherVerifiedBy: firebaseUser?.uid,
                                teacherVerifiedAt: new Date().toISOString(),
                              })
                            }
                            className="px-3 py-1 text-xs font-medium text-white bg-emerald-800 rounded-md"
                          >
                            Verify &amp; Forward to HR
                          </button>
                          <button
                            onClick={() =>
                              updateRecord('admissions', adm.id, {
                                workflowStatus: 'rejected',
                                teacherVerifiedBy: firebaseUser?.uid,
                                teacherVerifiedAt: new Date().toISOString(),
                              })
                            }
                            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(tab === 'homework' || tab === 'exams_marks' || tab === 'progress') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) =>
              handleSaveAcademic(
                e,
                tab === 'homework'
                  ? 'homework'
                  : tab === 'progress'
                    ? 'progress'
                    : recordType === 'exam' || recordType === 'mark'
                      ? recordType
                      : 'exam'
              )
            }
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">
              {tab === 'homework'
                ? 'Assign Homework'
                : tab === 'progress'
                  ? 'Record Student Progress'
                  : 'Create Exam / Enter Marks & Results'}
            </h3>

            {tab === 'exams_marks' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Entry Type</label>
                <select
                  value={recordType === 'exam' || recordType === 'mark' ? recordType : 'exam'}
                  onChange={(e) => setRecordType(e.target.value as 'exam' | 'mark')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="exam">Exam / Test Schedule</option>
                  <option value="mark">Student Marks &amp; Result</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
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
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.className}</option>
                  ))}
                </select>
              </div>
            </div>

            {(tab === 'progress' || (tab === 'exams_marks' && recordType === 'mark')) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Student</label>
                <select
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.rollNo} – {s.studentName}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
            </div>

            {tab === 'exams_marks' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max Marks</label>
                  <input type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Obtained</label>
                  <input type="number" value={obtainedMarks} onChange={(e) => setObtainedMarks(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Grade</label>
                  <input type="text" placeholder="A+" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
              <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>

            <button type="submit" className="w-full py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg">
              Save Record
            </button>
          </form>

          <div className="lg:col-span-2">
            {academics.filter((a) =>
              tab === 'homework'
                ? a.recordType === 'homework'
                : tab === 'progress'
                  ? a.recordType === 'progress'
                  : a.recordType === 'exam' || a.recordType === 'mark'
            ).length === 0 ? (
              <EmptyState title="No Academic Entries Yet" description="Entries recorded by teachers appear here." />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Title &amp; Subject</th>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4 text-right">Score / Grade</th>
                      <th className="py-2.5 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {academics
                      .filter((a) =>
                        tab === 'homework'
                          ? a.recordType === 'homework'
                          : tab === 'progress'
                            ? a.recordType === 'progress'
                            : a.recordType === 'exam' || a.recordType === 'mark'
                      )
                      .map((a) => (
                        <tr key={a.id}>
                          <td className="py-2.5 px-4"><StatusTag status={a.recordType} /></td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900">{a.title}</div>
                            <div className="text-xs text-slate-500">{a.subject}</div>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">{a.studentName || 'Class-Wide'}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs">
                            {a.obtainedMarks !== undefined
                              ? `${a.obtainedMarks}/${a.maxMarks || 100} (${a.grade || '-'})`
                              : a.maxMarks
                                ? `Max ${a.maxMarks}`
                                : '-'}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{a.dueDate || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'communication' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-slate-600">Institutional &amp; Teacher Notices</span>
            <button onClick={() => onNavigate('notice_board')} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg">
              Open Notice Board
            </button>
          </div>
          {notices.map((n) => (
            <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="font-semibold text-slate-900">{n.title}</div>
              <p className="text-sm text-slate-600 mt-1">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
