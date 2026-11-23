import React from 'react';
import { Database, RotateCcw, Shield, Users } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { UserRole } from '../types/lablink';
import { StatusBadge } from '../components/shared/StatusBadge';

export const SettingsView: React.FC = () => {
  const { db, currentUser, switchUser, updateUserRole, resetDemoData } = useLabLink();

  const isSysAdmin = currentUser.role === 'system_admin';

  return (
    <div className="space-y-6">
      {/* Persistence & Client-Side Demo Notice */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 text-[#3978E8]" />
            <div>
              <h2 className="text-base font-semibold text-[#202B3C]">
                Shared Repository & Demo Persistence
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#526075]">
                LabLink persists all 21 shared entities inside a versioned{' '}
                <code className="font-mono">localStorage</code> repository layer so changes survive
                page refreshes. Note: In this client-side demo, role checks are enforced inside the
                shared TypeScript service layer; a production deployment should pair these services
                with server-side authentication and database access rules.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo Seed</span>
          </button>
        </div>
      </section>

      {/* Role & Access Management */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#3978E8]" />
            <div>
              <h3 className="text-base font-semibold text-[#202B3C]">
                Campus Users & Role Governance
              </h3>
              <p className="text-xs text-[#718096]">
                Switch active demo persona or (as System Admin) adjust user roles
              </p>
            </div>
          </div>
          {!isSysAdmin && <StatusBadge label="Role Edits: System Admin Only" tone="neutral" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E6EAF0] text-[#718096]">
              <tr>
                <th className="pb-2.5 font-medium">User</th>
                <th className="pb-2.5 font-medium">Department</th>
                <th className="pb-2.5 font-medium">Prior Usage</th>
                <th className="pb-2.5 font-medium">Role</th>
                <th className="pb-2.5 font-medium text-right">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF0]">
              {db.users.map((u) => {
                const dept = db.departments.find((d) => d.id === u.departmentId);
                const isCurrent = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-[#F7F9FC]">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-[#202B3C]">{u.name}</p>
                      <p className="text-[11px] text-[#718096]">{u.email}</p>
                    </td>
                    <td className="py-3 pr-3 text-[#526075]">{dept?.code}</td>
                    <td className="py-3 pr-3 font-mono tabular-nums text-[#526075]">
                      {u.previousUsageHours}h
                    </td>
                    <td className="py-3 pr-3">
                      {isSysAdmin ? (
                        <select
                          value={u.role}
                          onChange={(e) => updateUserRole(u.id, e.target.value as UserRole)}
                          className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1 text-xs"
                        >
                          <option value="student">Student</option>
                          <option value="lab_admin">Lab Administrator</option>
                          <option value="system_admin">System Administrator</option>
                        </select>
                      ) : (
                        <StatusBadge label={u.role.replace('_', ' ')} tone="info" />
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {isCurrent ? (
                        <StatusBadge label="Active Session" tone="success" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => switchUser(u.id)}
                          className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#3978E8] hover:bg-[#EAF2FF]"
                        >
                          Switch To
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Departments & Laboratories Overview */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#3978E8]" />
          <h3 className="text-base font-semibold text-[#202B3C]">
            Registered Departments & Laboratories
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {db.laboratories.map((lab) => {
            const dept = db.departments.find((d) => d.id === lab.departmentId);
            const admin = db.users.find((u) => u.id === lab.leadAdminId);
            return (
              <div
                key={lab.id}
                className="flex items-center justify-between rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-3.5 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#202B3C]">
                    {lab.code} — {lab.name}
                  </p>
                  <p className="mt-0.5 text-[#718096]">
                    {dept?.code} · Lead: {admin?.name} · {lab.operatingHours.openHour}:00–
                    {lab.operatingHours.closeHour}:00
                  </p>
                </div>
                <StatusBadge label={lab.safetyTier} tone="info" />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
