import React, { useState } from 'react';
import { CheckCircle2, FileCheck2, ShieldCheck, UserPlus, XCircle } from 'lucide-react';
import { useCMO } from '../../context/CMOContext';
import { Admission, formatCounter } from '../../types';
import { makeSafeId, sanitizeStr } from '../../utils/validation';
import { AvatarFrame, CounterStat, EmptyState, SectionHeader, StatusTag } from '../SharedUI';

export function OnlineAdmissionModule() {
  const {
    actorUid,
    branches,
    divisions,
    departments,
    classes,
    sessions,
    admissions,
    isTeacher,
    isPrincipal,
    isHR,
    isSuperAdmin,
    createRecord,
    updateRecord,
    approveAdmissionFinal,
    uploadPhoto,
    notify,
  } = useCMO();

  const [studentName, setStudentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [cnicOrBForm, setCnicOrBForm] = useState('');
  const [programType, setProgramType] = useState<'madrasa' | 'qadri40' | 'online_course'>('madrasa');
  const [divisionId, setDivisionId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [classId, setClassId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notes, setNotes] = useState('');

  // Final Approval Modal state
  const [approvingAdmission, setApprovingAdmission] = useState<Admission | null>(null);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignRollNo, setAssignRollNo] = useState('');

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const url = await uploadPhoto(file, 'admissions');
      setPhotoUrl(url);
      notify('Applicant photo uploaded.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Photo upload failed.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorUid) return;
    if (!branchId || !sessionId) {
      notify('Select a Branch and Academic Session before submitting.', 'error');
      return;
    }

    const id = makeSafeId('adm');
    const appNo = `ADM-${new Date().getFullYear()}-${String(admissions.length + 1).padStart(4, '0')}`;
    try {
      await createRecord(
        'admissions',
        id,
        {
          applicationNo: appNo,
          studentName: sanitizeStr(studentName, 120),
          fatherName: sanitizeStr(fatherName, 120),
          guardianPhone: sanitizeStr(guardianPhone, 40),
          cnicOrBForm: sanitizeStr(cnicOrBForm, 40),
          programType,
          divisionId: divisionId || '',
          branchId,
          departmentId: departmentId || '',
          classId: classId || '',
          sessionId,
          photoUrl: photoUrl || '',
          notes: sanitizeStr(notes, 500),
          workflowStatus: 'pending_teacher',
          submittedBy: actorUid,
        },
        {
          action: 'Submitted Online Admission',
          module: 'Online Admission',
          details: `Submitted ${appNo} for ${sanitizeStr(studentName, 120)}`,
        }
      );
      setStudentName('');
      setFatherName('');
      setGuardianPhone('');
      setCnicOrBForm('');
      setPhotoUrl('');
      setNotes('');
      notify(`Application ${appNo} submitted. Awaiting Stage 1: Teacher Verification.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to submit admission.', 'error');
    }
  };

  const handleTeacherStage = async (adm: Admission, approve: boolean) => {
    if (!actorUid) return;
    try {
      await updateRecord(
        'admissions',
        adm.id,
        {
          workflowStatus: approve ? 'teacher_verified' : 'rejected',
          teacherVerifiedBy: actorUid,
          teacherVerifiedAt: new Date().toISOString(),
          ...(approve ? {} : { rejectionReason: 'Rejected at Teacher verification stage' }),
        },
        {
          action: approve ? 'Teacher Verified Admission' : 'Teacher Rejected Admission',
          module: 'Online Admission',
          details: `${adm.applicationNo} (${adm.studentName})`,
        }
      );
      notify(approve ? 'Forwarded to HR Verification.' : 'Application rejected.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  const handleHRStage = async (adm: Admission, approve: boolean) => {
    if (!actorUid) return;
    try {
      await updateRecord(
        'admissions',
        adm.id,
        {
          workflowStatus: approve ? 'hr_verified' : 'rejected',
          hrVerifiedBy: actorUid,
          hrVerifiedAt: new Date().toISOString(),
          ...(approve ? {} : { rejectionReason: 'Rejected at HR verification stage' }),
        },
        {
          action: approve ? 'HR Verified Admission' : 'HR Rejected Admission',
          module: 'Online Admission',
          details: `${adm.applicationNo} (${adm.studentName})`,
        }
      );
      notify(
        approve
          ? 'HR verified. Awaiting Super Admin Final Approval to activate student.'
          : 'Application rejected by HR.',
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'HR update failed.', 'error');
    }
  };

  const handleSuperAdminConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingAdmission) return;
    const chosenClass = classes.find((c) => c.id === assignClassId);
    if (!chosenClass || !assignRollNo.trim()) {
      notify('Select an enrolled class and assign a Roll No to activate the admission.', 'error');
      return;
    }
    try {
      await approveAdmissionFinal(approvingAdmission, chosenClass, assignRollNo);
      notify(
        `Admission ${approvingAdmission.applicationNo} is now ACTIVE and enrolled as Roll ${assignRollNo}.`,
        'success'
      );
      setApprovingAdmission(null);
      setAssignClassId('');
      setAssignRollNo('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Final approval failed.', 'error');
    }
  };

  const handleSuperAdminReject = async (adm: Admission) => {
    if (!actorUid || !isSuperAdmin) return;
    try {
      await updateRecord(
        'admissions',
        adm.id,
        {
          workflowStatus: 'rejected',
          superAdminApprovedBy: actorUid,
          superAdminApprovedAt: new Date().toISOString(),
          rejectionReason: 'Rejected by Super Admin',
        },
        {
          action: 'Super Admin Rejected Admission',
          module: 'Online Admission',
          details: `${adm.applicationNo} rejected`,
        }
      );
      notify(`Admission ${adm.applicationNo} rejected.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Reject failed.', 'error');
    }
  };

  const counts = {
    pendingTeacher: admissions.filter((a) => a.workflowStatus === 'pending_teacher').length,
    teacherVerified: admissions.filter((a) => a.workflowStatus === 'teacher_verified').length,
    hrVerified: admissions.filter((a) => a.workflowStatus === 'hr_verified').length,
    active: admissions.filter((a) => a.workflowStatus === 'active').length,
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Online Admission & 3-Stage Approval Pipeline"
        subtitle="Teacher Verification → HR Verification → Super Admin Final Approval → Active Admission"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CounterStat label="Stage 1: Pending Teacher" value={counts.pendingTeacher} />
        <CounterStat label="Stage 2: Pending HR" value={counts.teacherVerified} />
        <CounterStat label="Stage 3: Pending Super Admin" value={counts.hrVerified} />
        <CounterStat label="Active Admissions" value={counts.active} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Admission Application Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserPlus className="w-4 h-4 text-emerald-800" />
            <h3 className="text-base font-semibold text-slate-900">New Admission Application</h3>
          </div>

          {(branches.length === 0 || sessions.length === 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
              Setup required first: create at least one{' '}
              <span className="font-semibold">Branch</span> and{' '}
              <span className="font-semibold">Academic Session</span> in{' '}
              <span className="font-semibold">Super Admin Control</span> before submitting admissions.
            </div>
          )}

          <div className="pt-1">
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Applicant Photo (Empty until uploaded)
            </label>
            <AvatarFrame
              photoUrl={photoUrl}
              alt="Applicant photo"
              size="lg"
              onUpload={handlePhotoUpload}
              uploading={uploadingPhoto}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Student Full Name</label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Father / Guardian Name</label>
              <input
                type="text"
                required
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Guardian Phone</label>
              <input
                type="text"
                required
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">B-Form / CNIC</label>
              <input
                type="text"
                value={cnicOrBForm}
                onChange={(e) => setCnicOrBForm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Program</label>
              <select
                value={programType}
                onChange={(e) => setProgramType(e.target.value as typeof programType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="madrasa">Madrasa</option>
                <option value="qadri40">QADRI 40</option>
                <option value="online_course">Online Course</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Academic Session</label>
              <select
                required
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Division</label>
              <select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Optional</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
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
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Class</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select Class</option>
                {classes
                  .filter((c) => !branchId || c.branchId === branchId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} {c.sectionName ? `(${c.sectionName})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
          >
            Submit Admission Application
          </button>
        </form>

        {/* Pipeline List */}
        <div className="xl:col-span-2 space-y-4">
          {admissions.length === 0 ? (
            <EmptyState
              title="No Admission Applications"
              description="Submit an application on the left. No admission becomes active before completing Teacher verification, HR verification, and Super Admin final approval."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Admission Pipeline ({formatCounter(admissions.length)})
                </span>
                <span className="text-xs text-slate-500">
                  Strict Gate: Super Admin Final Approval required to activate
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Application</th>
                      <th className="py-2.5 px-4">Applicant</th>
                      <th className="py-2.5 px-4">Branch &amp; Program</th>
                      <th className="py-2.5 px-4">Workflow Stage</th>
                      <th className="py-2.5 px-4 text-right">Authorized Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {admissions.map((adm) => {
                      const branchName =
                        branches.find((b) => b.id === adm.branchId)?.name || adm.branchId;
                      return (
                        <tr key={adm.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-700">
                            {adm.applicationNo}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <AvatarFrame photoUrl={adm.photoUrl} alt={adm.studentName} size="sm" />
                              <div>
                                <div className="font-medium text-slate-900">{adm.studentName}</div>
                                <div className="text-xs text-slate-500">S/D/o {adm.fatherName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">
                            <div>{branchName}</div>
                            <div className="uppercase font-mono text-slate-400">{adm.programType}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusTag status={adm.workflowStatus} />
                          </td>
                          <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {adm.workflowStatus === 'pending_teacher' &&
                              (isTeacher || isPrincipal || isSuperAdmin) && (
                                <>
                                  <button
                                    onClick={() => handleTeacherStage(adm, true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-md"
                                  >
                                    <FileCheck2 className="w-3 h-3" /> Teacher Verify
                                  </button>
                                  <button
                                    onClick={() => handleTeacherStage(adm, false)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </button>
                                </>
                              )}

                            {adm.workflowStatus === 'teacher_verified' &&
                              (isHR || isSuperAdmin) && (
                                <>
                                  <button
                                    onClick={() => handleHRStage(adm, true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-md"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> HR Verify
                                  </button>
                                  <button
                                    onClick={() => handleHRStage(adm, false)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </button>
                                </>
                              )}

                            {adm.workflowStatus === 'hr_verified' && isSuperAdmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setApprovingAdmission(adm);
                                    setAssignClassId(adm.classId || '');
                                    setAssignRollNo(`R-${String(admissions.length).padStart(3, '0')}`);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-md"
                                >
                                  <ShieldCheck className="w-3 h-3" /> Final Approve
                                </button>
                                <button
                                  onClick={() => handleSuperAdminReject(adm)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
                                >
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Super Admin Final Approval Modal */}
      {approvingAdmission && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSuperAdminConfirm}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Super Admin Final Admission Approval
            </h3>
            <p className="text-xs text-slate-500">
              Activating {approvingAdmission.studentName} ({approvingAdmission.applicationNo}) creates the official Student record.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Assign Class / Section
              </label>
              <select
                required
                value={assignClassId}
                onChange={(e) => setAssignClassId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select Enrolled Class</option>
                {classes
                  .filter((c) => c.branchId === approvingAdmission.branchId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} {c.sectionName ? `– Sec ${c.sectionName}` : ''}{' '}
                      {c.batchName ? `(${c.batchName})` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Assign Official Roll Number
              </label>
              <input
                type="text"
                required
                value={assignRollNo}
                onChange={(e) => setAssignRollNo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovingAdmission(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
              >
                Approve &amp; Activate Student
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
