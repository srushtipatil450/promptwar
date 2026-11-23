import React from 'react';
import { BadgeCheck, CheckCircle2, Clock, Lock, ShieldCheck, XCircle } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { canManageLab } from '../services/permissionService';
import { safetyService } from '../services/safetyService';
import { StatusBadge } from '../components/shared/StatusBadge';

export const LabPassportView: React.FC = () => {
  const { db, currentUser, verifyCertification, setActiveView } = useLabLink();

  const isAdmin = currentUser.role === 'lab_admin' || currentUser.role === 'system_admin';
  const dept = db.departments.find((d) => d.id === currentUser.departmentId);

  const pendingApprovals = db.trainingRecords.filter(
    (r) => r.status === 'quiz_passed_pending_verification'
  );

  return (
    <div className="space-y-6">
      {/* Passport Identity Card */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF2FF] text-lg font-bold text-[#3978E8]">
              {currentUser.avatarInitials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#202B3C]">{currentUser.name}</h2>
                <StatusBadge
                  label={currentUser.role.replace('_', ' ').toUpperCase()}
                  tone="info"
                />
              </div>
              <p className="mt-0.5 text-xs text-[#718096]">
                {currentUser.email} · {dept?.name}
                {currentUser.studentId ? ` · ID ${currentUser.studentId}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('safety-readiness')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3978E8] px-4 py-2 text-xs font-medium text-white hover:bg-[#2E67CE] shrink-0"
          >
            <BadgeCheck className="h-4 w-4" />
            <span>Take Safety Training Quiz</span>
          </button>
        </div>
      </section>

      {/* Lab Access Matrix */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-[#202B3C]">
            Campus Laboratory Access & Certification Status
          </h3>
          <p className="text-xs text-[#718096]">
            Students cannot self-issue supervised or restricted certifications — Lab Administrator
            verification is enforced after quiz completion
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {db.certifications.map((cert) => {
            const lab = db.laboratories.find((l) => l.id === cert.laboratoryId);
            const record = db.trainingRecords.find(
              (r) => r.userId === currentUser.id && r.certificationId === cert.id
            );

            const status =
              currentUser.role !== 'student'
                ? 'verified'
                : (record?.status ?? 'not_started');

            return (
              <div
                key={cert.id}
                className="flex flex-col justify-between rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#3978E8]">
                      {cert.code}
                    </span>
                    <StatusBadge
                      label={
                        status === 'verified'
                          ? 'Verified'
                          : status === 'quiz_passed_pending_verification'
                            ? 'Pending Admin Sign-Off'
                            : status === 'expired'
                              ? 'Expired'
                              : 'Not Started'
                      }
                      tone={
                        status === 'verified'
                          ? 'success'
                          : status === 'quiz_passed_pending_verification'
                            ? 'info'
                            : status === 'expired'
                              ? 'error'
                              : 'neutral'
                      }
                    />
                  </div>
                  <h4 className="mt-1.5 text-sm font-semibold text-[#202B3C]">{cert.title}</h4>
                  <p className="mt-1 text-xs text-[#718096]">
                    Lab: {lab?.code} — {lab?.name}
                  </p>
                </div>

                <div className="mt-3 border-t border-[#E6EAF0] pt-2.5 text-[11px] text-[#526075]">
                  {status === 'verified' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {record?.expiresAt
                        ? `Valid until ${record.expiresAt.slice(0, 10)}`
                        : 'Active Admin Clearance'}
                    </span>
                  ) : status === 'quiz_passed_pending_verification' ? (
                    <span className="inline-flex items-center gap-1 text-[#285EC7]">
                      <Clock className="h-3.5 w-3.5" />
                      Quiz passed ({record?.quizScore}%) · Awaiting Lab Admin sign-off
                    </span>
                  ) : status === 'expired' ? (
                    <button
                      type="button"
                      onClick={() => setActiveView('safety-readiness')}
                      className="inline-flex items-center gap-1 font-medium text-rose-700 hover:underline"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Expired — Renew Training</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveView('safety-readiness')}
                      className="inline-flex items-center gap-1 font-medium text-[#3978E8] hover:underline"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Complete Module & Quiz</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Equipment Eligibility Summary */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <h3 className="mb-3 text-base font-semibold text-[#202B3C]">
          Equipment Booking Eligibility
        </h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {db.equipment.map((eq) => {
            const lab = db.laboratories.find((l) => l.id === eq.laboratoryId);
            const readiness = safetyService.evaluateUserReadiness(db, currentUser.id, eq, lab);
            return (
              <div
                key={eq.id}
                className="flex items-center justify-between rounded-xl border border-[#E6EAF0] px-3.5 py-2.5 text-xs"
              >
                <span className="font-medium text-[#202B3C] truncate pr-2">{eq.name}</span>
                <StatusBadge
                  label={readiness.statusLabel}
                  tone={
                    readiness.eligible
                      ? 'success'
                      : readiness.statusLabel === 'Pending Admin Verification'
                        ? 'info'
                        : 'warning'
                  }
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Lab Administrator Verification Queue */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#202B3C]">
              Pending Practical Certification Verifications ({pendingApprovals.length})
            </h3>
            <p className="text-xs text-[#718096]">
              Only authorised Lab Administrators or System Administrators may verify supervised
              certifications
            </p>
          </div>
          {!isAdmin && (
            <StatusBadge label="Admin Action Locked" tone="neutral" icon="lock" />
          )}
        </div>

        {pendingApprovals.length === 0 ? (
          <p className="text-xs text-[#718096]">No pending verification requests.</p>
        ) : (
          <div className="space-y-2.5">
            {pendingApprovals.map((rec) => {
              const student = db.users.find((u) => u.id === rec.userId);
              const cert = db.certifications.find((c) => c.id === rec.certificationId);
              const mod = db.trainingModules.find((m) => m.id === rec.moduleId);
              const labId = cert?.laboratoryId ?? mod?.laboratoryId ?? 'lab-ece-signals';
              const canVerify = isAdmin && canManageLab(currentUser, labId);
              return (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#202B3C]">
                      {student?.name} — {cert?.title ?? mod?.title}
                    </p>
                    <p className="mt-0.5 text-[#718096]">
                      Module {mod?.code} · Quiz Score:{' '}
                      <strong className="font-mono text-emerald-700">{rec.quizScore}%</strong>
                    </p>
                  </div>

                  {canVerify ? (
                    <button
                      type="button"
                      onClick={() => verifyCertification(rec.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verify & Issue Certification</span>
                    </button>
                  ) : (
                    <StatusBadge
                      label={isAdmin ? 'Host Lab / SysAdmin Only' : 'Awaiting Lab Admin'}
                      tone="info"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
