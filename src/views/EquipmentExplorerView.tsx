import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Plus } from 'lucide-react';
import { useLabLink } from '../context/LabLinkContext';
import { EquipmentCategory } from '../types/lablink';
import { EquipmentCard } from '../components/shared/EquipmentCard';

export const EquipmentExplorerView: React.FC = () => {
  const { db, currentUser, globalSearch, setGlobalSearch, addEquipmentItem, addPhysicalUnit } =
    useLabLink();

  const [deptFilter, setDeptFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityOnly, setAvailabilityOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'available'>('name');

  const isAdmin = currentUser.role === 'lab_admin' || currentUser.role === 'system_admin';
  const managedLabs = useMemo(
    () =>
      currentUser.role === 'system_admin'
        ? db.laboratories
        : db.laboratories.filter((l) => currentUser.assignedLabIds.includes(l.id)),
    [db.laboratories, currentUser.role, currentUser.assignedLabIds]
  );
  const managedEquipment = useMemo(
    () =>
      currentUser.role === 'system_admin'
        ? db.equipment
        : db.equipment.filter((eq) => currentUser.assignedLabIds.includes(eq.laboratoryId)),
    [db.equipment, currentUser.role, currentUser.assignedLabIds]
  );

  const [showAdminAdd, setShowAdminAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newMfg, setNewMfg] = useState('');
  const [newCat, setNewCat] = useState<EquipmentCategory>('Electronics & Signal');
  const [newLabId, setNewLabId] = useState(managedLabs[0]?.id ?? db.laboratories[0]?.id ?? '');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [commissionEqId, setCommissionEqId] = useState(
    managedEquipment[0]?.id ?? db.equipment[0]?.id ?? ''
  );
  const [commissionCode, setCommissionCode] = useState('');
  const [commissionSerial, setCommissionSerial] = useState('');

  useEffect(() => {
    if (managedLabs.length > 0 && !managedLabs.some((l) => l.id === newLabId)) {
      setNewLabId(managedLabs[0].id);
    }
    if (managedEquipment.length > 0 && !managedEquipment.some((eq) => eq.id === commissionEqId)) {
      setCommissionEqId(managedEquipment[0].id);
    }
  }, [managedLabs, managedEquipment, newLabId, commissionEqId]);

  const filtered = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return db.equipment
      .filter((eq) => {
        if (deptFilter !== 'all' && eq.departmentId !== deptFilter) return false;
        if (categoryFilter !== 'all' && eq.category !== categoryFilter) return false;
        const units = db.physicalUnits.filter((u) => u.equipmentId === eq.id);
        if (availabilityOnly && !units.some((u) => u.status === 'available')) return false;
        if (q) {
          const unitMatches = units.some(
            (u) =>
              u.unitCode.toLowerCase().includes(q) || u.serialNumber.toLowerCase().includes(q)
          );
          const textMatch = `${eq.name} ${eq.model} ${eq.description} ${eq.keywords.join(' ')}`
            .toLowerCase()
            .includes(q);
          return unitMatches || textMatch;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'available') {
          const aOpen = db.physicalUnits.filter(
            (u) => u.equipmentId === a.id && u.status === 'available'
          ).length;
          const bOpen = db.physicalUnits.filter(
            (u) => u.equipmentId === b.id && u.status === 'available'
          ).length;
          return bOpen - aOpen;
        }
        return a.name.localeCompare(b.name);
      });
  }, [db.equipment, db.physicalUnits, deptFilter, categoryFilter, availabilityOnly, globalSearch, sortBy]);

  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addEquipmentItem({
      name: newName,
      model: newModel,
      manufacturer: newMfg,
      category: newCat,
      laboratoryId: newLabId,
      description: newDesc,
      initialUnitCode: newUnitCode,
      serialNumber: newSerial,
    });
    if (res.ok) {
      setNewName('');
      setNewModel('');
      setNewMfg('');
      setNewUnitCode('');
      setNewSerial('');
      setNewDesc('');
      setShowAdminAdd(false);
    }
  };

  const handleCommissionUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addPhysicalUnit({
      equipmentId: commissionEqId,
      unitCode: commissionCode,
      serialNumber: commissionSerial,
      notes: 'Commissioned via Inventory Manager',
    });
    if (res.ok) {
      setCommissionCode('');
      setCommissionSerial('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <section className="rounded-2xl border border-[#E6EAF0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#718096]">
              <Filter className="h-3.5 w-3.5" />
              <span>Filters:</span>
            </div>

            <input
              type="search"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Keyword or unit code (e.g. OSC-001)"
              className="w-56 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] px-3 py-1.5 text-xs text-[#202B3C] focus:border-[#3978E8] focus:bg-white focus:outline-none"
            />

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs text-[#202B3C]"
            >
              <option value="all">All Departments</option>
              {db.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs text-[#202B3C]"
            >
              <option value="all">All Categories</option>
              <option value="Electronics & Signal">Electronics & Signal</option>
              <option value="Robotics & Automation">Robotics & Automation</option>
              <option value="Fabrication & CNC">Fabrication & CNC</option>
              <option value="Bioengineering">Bioengineering</option>
              <option value="Materials & Metrology">Materials & Metrology</option>
              <option value="Optics & Thermal">Optics & Thermal</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'available')}
              className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-1.5 text-xs text-[#202B3C]"
            >
              <option value="name">Sort: Alphabetical</option>
              <option value="available">Sort: Open Units</option>
            </select>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6EAF0] px-3 py-1.5 text-xs text-[#202B3C]">
              <input
                type="checkbox"
                checked={availabilityOnly}
                onChange={(e) => setAvailabilityOnly(e.target.checked)}
                className="accent-[#3978E8]"
              />
              <span>Open units only</span>
            </label>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminAdd((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#EAF2FF] px-3.5 py-2 text-xs font-medium text-[#285EC7] hover:bg-[#DCE9FF]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Admin Inventory Controls</span>
            </button>
          )}
        </div>

        {/* Lab Admin / System Admin Inventory Panel */}
        {isAdmin && showAdminAdd && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#E6EAF0] pt-4 lg:grid-cols-2">
            <form onSubmit={handleAddEquipment} className="space-y-3 rounded-xl bg-[#F7F9FC] p-4">
              <h3 className="text-xs font-semibold text-[#202B3C]">
                Add New Equipment Catalog Model
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Equipment Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. Keysight E36312A)"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                />
                <select
                  value={newLabId}
                  onChange={(e) => setNewLabId(e.target.value)}
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                >
                  {(managedLabs.length > 0 ? managedLabs : db.laboratories).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} — {l.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as EquipmentCategory)}
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="Electronics & Signal">Electronics & Signal</option>
                  <option value="Robotics & Automation">Robotics & Automation</option>
                  <option value="Fabrication & CNC">Fabrication & CNC</option>
                  <option value="Bioengineering">Bioengineering</option>
                  <option value="Materials & Metrology">Materials & Metrology</option>
                  <option value="Optics & Thermal">Optics & Thermal</option>
                </select>
                <input
                  type="text"
                  placeholder="Initial Unit Code (e.g. SIG-001)"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  required
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="Serial Number"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <input
                type="text"
                placeholder="Technical description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#3978E8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
              >
                Register Catalog & Unit
              </button>
            </form>

            <form onSubmit={handleCommissionUnit} className="space-y-3 rounded-xl bg-[#F7F9FC] p-4">
              <h3 className="text-xs font-semibold text-[#202B3C]">
                Commission Additional Physical Unit
              </h3>
              <select
                value={commissionEqId}
                onChange={(e) => setCommissionEqId(e.target.value)}
                className="w-full rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
              >
                {(managedEquipment.length > 0 ? managedEquipment : db.equipment).map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="New Unit Code (e.g. OSC-004)"
                  value={commissionCode}
                  onChange={(e) => setCommissionCode(e.target.value)}
                  required
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="Serial Number"
                  value={commissionSerial}
                  onChange={(e) => setCommissionSerial(e.target.value)}
                  required
                  className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-[#3978E8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2E67CE]"
              >
                Commission Physical Unit
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-white p-12 text-center">
          <p className="text-sm font-semibold text-[#202B3C]">No matching equipment found</p>
          <p className="mt-1 text-xs text-[#718096]">
            Clear your search query or department filter to browse all campus instruments.
          </p>
          <button
            type="button"
            onClick={() => {
              setGlobalSearch('');
              setDeptFilter('all');
              setCategoryFilter('all');
              setAvailabilityOnly(false);
            }}
            className="mt-4 rounded-xl border border-[#E6EAF0] bg-white px-4 py-2 text-xs font-medium text-[#202B3C] hover:bg-[#F7F9FC]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((eq) => (
            <EquipmentCard key={eq.id} equipment={eq} />
          ))}
        </div>
      )}
    </div>
  );
};
