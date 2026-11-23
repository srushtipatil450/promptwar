import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { SafetyIncident } from '../types/lablink';
import { StatusBadge } from '../components/shared/StatusBadge';

export const SafetyReadinessView: React.FC = () => {
  const {
    db,
    currentUser,
    submitTrainingQuiz,
    reportSafetyIncident,
    reviewSafetyIncident,
  } = useLabLink();

  const [activeModuleId, setActiveModuleId] = useState(db.trainingModules[0]?.id ?? '');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizFeedback, setQuizFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [incLabId, setIncLabId] = useState(db.laboratories[0]?.id ?? '');
  const [incUnitId, setIncUnitId] = useState<string>('');
  const [incSeverity, setIncSeverity] = useState<SafetyIncident['severity']>('moderate');
  const [incTitle, setIncTitle] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers({});
    setQuizFeedback(null);
  }, [currentUser.id]);

  const activeModule =
    db.trainingModules.find((m) => m.id === activeModuleId) ?? db.trainingModules[0];
  const isAdmin = currentUser.role === 'lab_admin' || currentUser.role === 'system_admin';

  const handleQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule) return;
    const res = submitTrainingQuiz(activeModule.id, answers);
    setQuizFeedback({ ok: res.ok, text: res.message });
  };

  const handleIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = reportSafetyIncident({
      laboratoryId: incLabId,
      unitId: incUnitId || null,
      severity: incSeverity,
      title: incTitle,
      description: incDesc,
    });
    if (res.ok) {
      setIncTitle('');
      setIncDesc('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Training Modules & Interactive Quiz */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-4 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#3978E8]" />
            <h2 className="text-base font-semibold text-[#202B3C]">Safety Training Modules</h2>
          </div>
          <div className="space-y-2">
            {db.trainingModules.map((mod) => {
              const rec = db.trainingRecords.find(
                (r) => r.userId === currentUser.id && r.moduleId === mod.id
              );
              const isSelected = mod.id === activeModule?.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setActiveModuleId(mod.id);
                    setAnswers({});
                    setQuizFeedback(null);
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-[#3978E8] bg-[#EAF2FF]'
                      : 'border-[#E6EAF0] bg-[#F7F9FC] hover:border-[#3978E8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#3978E8]">
                      {mod.code}
                    </span>
                    <StatusBadge
                      label={
                        rec?.status === 'verified'
                          ? 'Verified'
                          : rec?.status === 'quiz_passed_pending_verification'
                            ? 'Pending Sign-Off'
                            : rec?.status === 'expired'
                              ? 'Expired'
                              : `${mod.estimatedMinutes} min`
                      }
                      tone={
                        rec?.status === 'verified'
                          ? 'success'
                          : rec?.status === 'quiz_passed_pending_verification'
                            ? 'info'
                            : rec?.status === 'expired'
                              ? 'error'
                              : 'neutral'
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#202B3C]">{mod.title}</p>
                </button>
              );
            })}
          </div>
        </section>

        {activeModule && (
          <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-8 space-y-5">
            <div className="border-b border-[#E6EAF0] pb-4">
              <p className="font-mono text-xs font-semibold text-[#3978E8]">
                {activeModule.code} · Est. {activeModule.estimatedMinutes} minutes
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#202B3C]">{activeModule.title}</h3>
              <p className="mt-1 text-xs text-[#526075]">{activeModule.summary}</p>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold text-[#202B3C]">Mandatory Lab Rules</h4>
              <ul className="space-y-1.5 text-xs text-[#526075]">
                {activeModule.keyRules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleQuizSubmit} className="space-y-4 border-t border-[#E6EAF0] pt-4">
              <h4 className="text-sm font-semibold text-[#202B3C]">
                Safety Competency Quiz (80% required to pass)
              </h4>

              {activeModule.questions.map((q, qIdx) => (
                <div key={q.id} className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4">
                  <p className="text-xs font-semibold text-[#202B3C]">
                    {qIdx + 1}. {q.prompt}
                  </p>
                  <div className="mt-2.5 space-y-2">
                    {q.options.map((opt, optIdx) => (
                      <label
                        key={optIdx}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-xs text-[#202B3C] hover:border-[#3978E8]"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === optIdx}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                          className="accent-[#3978E8]"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {quizFeedback && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                    quizFeedback.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {quizFeedback.text}
                </div>
              )}

              <button
                type="submit"
                className="rounded-xl bg-[#3978E8] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
              >
                Submit Safety Assessment
              </button>
            </form>
          </section>
        )}
      </div>

      {/* Safety Incident Reporting & Admin Review */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <h3 className="text-base font-semibold text-[#202B3C]">Report Safety Incident</h3>
          </div>
          <form onSubmit={handleIncidentSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">Laboratory</label>
                <select
                  value={incLabId}
                  onChange={(e) => setIncLabId(e.target.value)}
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2.5 py-2 text-xs"
                >
                  {db.laboratories.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} — {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#202B3C]">Severity</label>
                <select
                  value={incSeverity}
                  onChange={(e) => setIncSeverity(e.target.value as SafetyIncident['severity'])}
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white px-2.5 py-2 text-xs"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#202B3C]">
                Involved Unit (Optional)
              </label>
              <select
                value={incUnitId}
                onChange={(e) => setIncUnitId(e.target.value)}
                className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
              >
                <option value="">General Lab Environment</option>
                {db.physicalUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitCode}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Incident headline..."
              value={incTitle}
              onChange={(e) => setIncTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs"
            />
            <textarea
              rows={2}
              placeholder="Describe what occurred and any E-Stop / containment action taken..."
              value={incDesc}
              onChange={(e) => setIncDesc(e.target.value)}
              required
              className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700"
            >
              Log Safety Incident
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 lg:col-span-7 space-y-3">
          <h3 className="text-base font-semibold text-[#202B3C]">
            Incident Log & Safety Review ({db.safetyIncidents.length})
          </h3>
          {db.safetyIncidents.map((inc) => {
            const lab = db.laboratories.find((l) => l.id === inc.laboratoryId);
            const reporter = db.users.find((u) => u.id === inc.reporterId);
            const canReview =
              isAdmin &&
              (currentUser.role === 'system_admin' ||
                currentUser.assignedLabIds.includes(inc.laboratoryId));

            return (
              <div
                key={inc.id}
                className="rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-sm font-semibold text-[#202B3C]">{inc.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#526075]">
                      {lab?.code} · Reported by {reporter?.name} · {inc.description}
                    </p>
                  </div>
                  <StatusBadge
                    label={inc.status.replace('_', ' ').toUpperCase()}
                    tone={
                      inc.status === 'resolved'
                        ? 'success'
                        : inc.status === 'under_review'
                          ? 'info'
                          : 'error'
                    }
                  />
                </div>

                {inc.resolutionNotes && (
                  <p className="text-[11px] text-emerald-700">
                    Resolution: {inc.resolutionNotes}
                  </p>
                )}

                {canReview && inc.status !== 'resolved' && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#E6EAF0] pt-2.5">
                    <input
                      type="text"
                      placeholder="Review / corrective action notes..."
                      value={resolutionNotes[inc.id] ?? ''}
                      onChange={(e) =>
                        setResolutionNotes((prev) => ({ ...prev, [inc.id]: e.target.value }))
                      }
                      className="flex-1 min-w-[180px] rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        reviewSafetyIncident(inc.id, 'resolved', resolutionNotes[inc.id] ?? '')
                      }
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};
