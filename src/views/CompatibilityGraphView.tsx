import React, { useMemo, useRef, useState } from 'react';
import { BookmarkPlus, GitBranch, RotateCcw, Route, ZoomIn, ZoomOut } from 'lucide-react';
import {
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import { useLabLink } from '../context/LabLinkContext';
import { recommendationService } from '../services/recommendationService';
import { CompatibilityLevel, CompatibilityRelationship } from '../types/lablink';
import {
  MagneticButton,
  usePointerCapability,
} from '../components/shared/MotionPrimitives';
import { StatusBadge } from '../components/shared/StatusBadge';

const EDGE_COLORS: Record<CompatibilityLevel, string> = {
  verified: '#16A34A',
  conditional: '#D97706',
  uncertain: '#64748B',
  incompatible: '#DC2626',
};

// Fixed clean radial coordinates for our 12 instruments inside an 820x460 SVG viewport
const NODE_POSITIONS: Record<string, { x: number; y: number; short: string }> = {
  'eq-oscilloscope': { x: 250, y: 150, short: 'Oscilloscope' },
  'eq-logic-vna': { x: 110, y: 80, short: 'VNA 6GHz' },
  'eq-dc-array': { x: 130, y: 260, short: 'DC Power Array' },
  'eq-thermal-cam': { x: 110, y: 390, short: 'Thermal Cam' },
  'eq-robot-arm': { x: 480, y: 220, short: 'UR5e Robot Arm' },
  'eq-mocap-rig': { x: 560, y: 80, short: 'OptiTrack Rig' },
  'eq-sla-printer': { x: 390, y: 360, short: 'SLA Printer' },
  'eq-cnc-mill': { x: 640, y: 220, short: '5-Axis CNC' },
  'eq-laser-cutter': { x: 570, y: 400, short: 'CO2 Laser' },
  'eq-potentiostat': { x: 360, y: 75, short: 'Potentiostat' },
  'eq-pcr-cycler': { x: 720, y: 390, short: 'PCR Cycler' },
  'eq-tensile-tester': { x: 700, y: 100, short: 'Tensile Frame' },
};

/**
 * Interactive graph node that subtly reacts to cursor proximity without React re-renders.
 */
const GraphNode: React.FC<{
  pos: { x: number; y: number; short: string };
  isSelected: boolean;
  isHovered: boolean;
  inPath: boolean;
  cursorSvgX: MotionValue<number>;
  cursorSvgY: MotionValue<number>;
  canHoverFine: boolean;
  onSelect: () => void;
  onHoverChange: (hover: boolean) => void;
}> = ({
  pos,
  isSelected,
  isHovered,
  inPath,
  cursorSvgX,
  cursorSvgY,
  canHoverFine,
  onSelect,
  onHoverChange,
}) => {
  const proximityOffsetX = useTransform([cursorSvgX, cursorSvgY], ([cx, cy]: number[]) => {
    if (!canHoverFine || cx < 0) return 0;
    const dx = cx - pos.x;
    const dy = cy - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 135 || dist < 1) return 0;
    return (dx / dist) * (1 - dist / 135) * 4.5;
  });

  const proximityOffsetY = useTransform([cursorSvgX, cursorSvgY], ([cx, cy]: number[]) => {
    if (!canHoverFine || cy < 0) return 0;
    const dx = cx - pos.x;
    const dy = cy - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 135 || dist < 1) return 0;
    return (dy / dist) * (1 - dist / 135) * 4.5;
  });

  const proximityScale = useTransform([cursorSvgX, cursorSvgY], ([cx, cy]: number[]) => {
    if (isSelected) return 1.07;
    if (isHovered) return 1.05;
    if (!canHoverFine || cx < 0) return 1;
    const dist = Math.hypot(cx - pos.x, cy - pos.y);
    if (dist > 125) return 1;
    return 1 + (1 - dist / 125) * 0.04;
  });

  const smoothX = useSpring(proximityOffsetX, { stiffness: 260, damping: 24 });
  const smoothY = useSpring(proximityOffsetY, { stiffness: 260, damping: 24 });
  const smoothScale = useSpring(proximityScale, { stiffness: 260, damping: 24 });

  return (
    <motion.g
      data-node-interactive="true"
      onClick={onSelect}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
        x: canHoverFine ? smoothX : 0,
        y: canHoverFine ? smoothY : 0,
        scale: smoothScale,
        transformOrigin: `${pos.x}px ${pos.y}px`,
      }}
      className="cursor-pointer"
    >
      {/* Selected / Hover soft glow halo */}
      {(isSelected || isHovered) && (
        <rect
          x={pos.x - 68}
          y={pos.y - 26}
          width="136"
          height="52"
          rx="14"
          fill={isSelected ? 'rgba(57, 120, 232, 0.16)' : 'rgba(238, 234, 254, 0.85)'}
          stroke={isSelected ? 'rgba(57, 120, 232, 0.35)' : 'rgba(91, 71, 199, 0.25)'}
          strokeWidth="1"
        />
      )}
      <rect
        x={pos.x - 62}
        y={pos.y - 20}
        width="124"
        height="40"
        rx="10"
        fill={isSelected ? '#3978E8' : inPath ? '#EAF2FF' : '#FFFFFF'}
        stroke={isSelected ? '#285EC7' : isHovered || inPath ? '#3978E8' : '#D6DCE6'}
        strokeWidth={isSelected || inPath || isHovered ? 2 : 1.25}
      />
      <text
        x={pos.x}
        y={pos.y + 4}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill={isSelected ? '#FFFFFF' : '#202B3C'}
      >
        {pos.short}
      </text>
    </motion.g>
  );
};

export const CompatibilityGraphView: React.FC = () => {
  const { db, currentUser, focusedEquipmentId, attachSetupToProject } = useLabLink();
  const { canHoverFine } = usePointerCapability();

  const [selectedEqId, setSelectedEqId] = useState(
    focusedEquipmentId ?? db.equipment[0]?.id ?? 'eq-oscilloscope'
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(
    db.compatibilityEdges[0]?.id ?? null
  );
  const [hoveredEqId, setHoveredEqId] = useState<string | null>(null);
  const [hoveredEdgeInfo, setHoveredEdgeInfo] = useState<{
    edge: CompatibilityRelationship;
    x: number;
    y: number;
  } | null>(null);

  const [pathSourceId, setPathSourceId] = useState('eq-oscilloscope');
  const [pathTargetId, setPathTargetId] = useState('eq-cnc-mill');
  const [targetProjectId, setTargetProjectId] = useState(
    db.projects.find((p) => p.ownerId === currentUser.id)?.id ?? db.projects[0]?.id ?? ''
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragOrigin = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(
    null
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cursorSvgX = useMotionValue(-999);
  const cursorSvgY = useMotionValue(-999);

  const editableProjects = useMemo(
    () =>
      currentUser.role === 'student'
        ? db.projects.filter((p) => p.ownerId === currentUser.id)
        : db.projects,
    [db.projects, currentUser]
  );

  const selectedEdges = useMemo(
    () =>
      db.compatibilityEdges.filter(
        (e) => e.sourceEquipmentId === selectedEqId || e.targetEquipmentId === selectedEqId
      ),
    [db.compatibilityEdges, selectedEqId]
  );

  const inspectedEdge = useMemo(
    () =>
      db.compatibilityEdges.find((e) => e.id === selectedEdgeId) ??
      selectedEdges[0] ??
      db.compatibilityEdges[0],
    [db.compatibilityEdges, selectedEdgeId, selectedEdges]
  );

  const pathResult = useMemo(
    () => recommendationService.findCompatibilityPath(db, pathSourceId, pathTargetId),
    [db, pathSourceId, pathTargetId]
  );

  const handleSaveSetup = () => {
    if (!targetProjectId) return;
    const ids = pathResult
      ? pathResult.path.map((p) => p.id)
      : [
          selectedEqId,
          ...selectedEdges
            .filter((e) => e.level === 'verified' || e.level === 'conditional')
            .map((e) =>
              e.sourceEquipmentId === selectedEqId ? e.targetEquipmentId : e.sourceEquipmentId
            ),
        ];
    attachSetupToProject(targetProjectId, ids);
  };

  return (
    <div className="space-y-6">
      {/* Legend & Path Discovery */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6EAF0] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-[#202B3C]">Relationship Legend:</span>
          <StatusBadge label="Verified" tone="success" />
          <StatusBadge label="Conditional (Adapter)" tone="warning" />
          <StatusBadge label="Uncertain" tone="neutral" />
          <StatusBadge label="Incompatible" tone="error" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Route className="h-4 w-4 text-[#3978E8]" />
          <select
            value={pathSourceId}
            onChange={(e) => setPathSourceId(e.target.value)}
            className="rounded-xl border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
          >
            {db.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                From: {eq.name}
              </option>
            ))}
          </select>
          <select
            value={pathTargetId}
            onChange={(e) => setPathTargetId(e.target.value)}
            className="rounded-xl border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-xs"
          >
            {db.equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                To: {eq.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Interactive Graph SVG */}
        <section className="rounded-2xl border border-[#E6EAF0] bg-white p-5 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#202B3C]">
                Hardware Interface & Voltage Compatibility Graph
              </h2>
              <p className="text-xs text-[#718096]">
                Hover or click any instrument node or relationship line to inspect technical adapters
                and constraints
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pathSourceId === pathTargetId ? (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-[#718096]">
                  Select two different instruments to trace path
                </span>
              ) : pathResult ? (
                <span className="rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-xs font-medium text-[#285EC7]">
                  Path: {pathResult.path.map((p) => NODE_POSITIONS[p.id]?.short ?? p.name).join(' → ')}
                </span>
              ) : (
                <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                  No compatible path without incompatible hardware links
                </span>
              )}

              <div className="flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] p-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
                  className="rounded-lg p-1.5 text-[#526075] transition-colors hover:bg-white hover:text-[#3978E8]"
                  aria-label="Zoom out graph"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[11px] tabular-nums text-[#202B3C]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.15).toFixed(2))))}
                  className="rounded-lg p-1.5 text-[#526075] transition-colors hover:bg-white hover:text-[#3978E8]"
                  aria-label="Zoom in graph"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="group/reset rounded-lg p-1.5 text-[#526075] transition-colors hover:bg-white hover:text-[#3978E8]"
                  aria-label="Reset zoom and pan"
                >
                  <RotateCcw className="h-3.5 w-3.5 transition-transform duration-200 group-hover/reset:-rotate-45" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={viewportRef}
            className="relative overflow-hidden rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('[data-node-interactive="true"]')) return;
              dragOrigin.current = {
                x: e.clientX,
                y: e.clientY,
                startPanX: pan.x,
                startPanY: pan.y,
              };
            }}
            onPointerMove={(e) => {
              if (svgRef.current && e.pointerType !== 'touch') {
                const svgRect = svgRef.current.getBoundingClientRect();
                if (svgRect.width > 0 && svgRect.height > 0) {
                  cursorSvgX.set(((e.clientX - svgRect.left) / svgRect.width) * 820);
                  cursorSvgY.set(((e.clientY - svgRect.top) / svgRect.height) * 460);
                }
              }
              if (!dragOrigin.current) return;
              setPan({
                x: dragOrigin.current.startPanX + (e.clientX - dragOrigin.current.x),
                y: dragOrigin.current.startPanY + (e.clientY - dragOrigin.current.y),
              });
            }}
            onPointerUp={() => {
              dragOrigin.current = null;
            }}
            onPointerLeave={() => {
              dragOrigin.current = null;
              cursorSvgX.set(-999);
              cursorSvgY.set(-999);
              setHoveredEdgeInfo(null);
            }}
          >
            <motion.svg
              ref={svgRef}
              viewBox="0 0 820 460"
              className="min-w-[680px] w-full select-none"
              animate={{
                scale: zoom,
                x: pan.x,
                y: pan.y,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              style={{ transformOrigin: 'center center' }}
            >
              {/* Edges */}
              {db.compatibilityEdges.map((edge) => {
                const p1 = NODE_POSITIONS[edge.sourceEquipmentId];
                const p2 = NODE_POSITIONS[edge.targetEquipmentId];
                if (!p1 || !p2) return null;

                const isHovered = hoveredEdgeInfo?.edge.id === edge.id;
                const isHighlighted =
                  isHovered ||
                  edge.id === inspectedEdge?.id ||
                  edge.sourceEquipmentId === selectedEqId ||
                  edge.targetEquipmentId === selectedEqId;
                const inPath = pathResult?.edges.some((pe) => pe.id === edge.id);

                return (
                  <g
                    key={edge.id}
                    data-node-interactive="true"
                    onClick={() => setSelectedEdgeId(edge.id)}
                    onMouseEnter={(e) => {
                      const rect = viewportRef.current?.getBoundingClientRect();
                      if (rect) {
                        setHoveredEdgeInfo({
                          edge,
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredEdgeInfo(null)}
                    className="cursor-pointer"
                  >
                    {/* Generous invisible hit stroke for smooth line hovering */}
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="transparent"
                      strokeWidth="16"
                    />
                    {isHovered && (
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={EDGE_COLORS[edge.level]}
                        strokeOpacity="0.22"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                    )}
                    <motion.line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={EDGE_COLORS[edge.level]}
                      strokeWidth={isHovered ? 4.4 : inPath ? 4.2 : isHighlighted ? 3 : 1.75}
                      strokeDasharray={
                        edge.level === 'uncertain' || edge.level === 'incompatible'
                          ? '6 4'
                          : undefined
                      }
                      initial={{ pathLength: 0.4, opacity: 0.25 }}
                      animate={{
                        pathLength: 1,
                        opacity: isHovered || isHighlighted || inPath ? 1 : 0.42,
                      }}
                      transition={{ duration: 0.22 }}
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {db.equipment.map((eq, idx) => {
                const pos = NODE_POSITIONS[eq.id] ?? {
                  x: 80 + (idx % 4) * 180,
                  y: 80 + Math.floor(idx / 4) * 120,
                  short: eq.name.slice(0, 14),
                };
                const isSelected = eq.id === selectedEqId;
                const isHovered = eq.id === hoveredEqId;
                const inPath = Boolean(pathResult?.path.some((p) => p.id === eq.id));
                return (
                  <GraphNode
                    key={eq.id}
                    pos={pos}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    inPath={inPath}
                    cursorSvgX={cursorSvgX}
                    cursorSvgY={cursorSvgY}
                    canHoverFine={canHoverFine}
                    onSelect={() => {
                      setSelectedEqId(eq.id);
                      setSelectedEdgeId(null);
                    }}
                    onHoverChange={(hover) => setHoveredEqId(hover ? eq.id : null)}
                  />
                );
              })}
            </motion.svg>

            {/* Floating Compatibility Edge Tooltip */}
            {hoveredEdgeInfo && (
              <div
                className="pointer-events-none absolute z-20 w-64 rounded-xl border border-[#C9DDFE] bg-white px-3.5 py-2.5 shadow-md"
                style={{
                  left: Math.min(Math.max(hoveredEdgeInfo.x + 14, 12), 450),
                  top: Math.max(hoveredEdgeInfo.y - 84, 12),
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#202B3C] truncate">
                    {NODE_POSITIONS[hoveredEdgeInfo.edge.sourceEquipmentId]?.short} ↔{' '}
                    {NODE_POSITIONS[hoveredEdgeInfo.edge.targetEquipmentId]?.short}
                  </span>
                  <StatusBadge
                    label={hoveredEdgeInfo.edge.level.toUpperCase()}
                    tone={
                      hoveredEdgeInfo.edge.level === 'verified'
                        ? 'success'
                        : hoveredEdgeInfo.edge.level === 'conditional'
                          ? 'warning'
                          : hoveredEdgeInfo.edge.level === 'incompatible'
                            ? 'error'
                            : 'neutral'
                    }
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#526075]">
                  {hoveredEdgeInfo.edge.interfaceDetails}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-[#718096]">
                  {hoveredEdgeInfo.edge.voltageMatch}
                  {hoveredEdgeInfo.edge.adapterRequired
                    ? ` · Adapter: ${hoveredEdgeInfo.edge.adapterRequired}`
                    : ''}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Inspector Panel */}
        <section className="space-y-4 lg:col-span-4">
          {inspectedEdge && (
            <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5">
              <div className="flex items-center justify-between gap-2 border-b border-[#E6EAF0] pb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#202B3C]">
                  <GitBranch className="h-4 w-4 text-[#3978E8]" />
                  <span>Edge Specification</span>
                </span>
                <StatusBadge
                  label={inspectedEdge.level.toUpperCase()}
                  tone={
                    inspectedEdge.level === 'verified'
                      ? 'success'
                      : inspectedEdge.level === 'conditional'
                        ? 'warning'
                        : inspectedEdge.level === 'incompatible'
                          ? 'error'
                          : 'neutral'
                  }
                />
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                <p className="font-semibold text-[#202B3C]">
                  {db.equipment.find((e) => e.id === inspectedEdge.sourceEquipmentId)?.name} ↔{' '}
                  {db.equipment.find((e) => e.id === inspectedEdge.targetEquipmentId)?.name}
                </p>
                <div className="rounded-xl bg-[#F7F9FC] p-3 space-y-1.5">
                  <p>
                    <strong className="text-[#202B3C]">Interface:</strong>{' '}
                    <span className="text-[#526075]">{inspectedEdge.interfaceDetails}</span>
                  </p>
                  <p>
                    <strong className="text-[#202B3C]">Voltage / Domain:</strong>{' '}
                    <span className="text-[#526075]">{inspectedEdge.voltageMatch}</span>
                  </p>
                  <p>
                    <strong className="text-[#202B3C]">Adapter Required:</strong>{' '}
                    <span className="text-[#526075]">
                      {inspectedEdge.adapterRequired ?? 'None'}
                    </span>
                  </p>
                </div>
                <p className="text-[#526075]">
                  <strong className="text-[#202B3C]">Limitations:</strong>{' '}
                  {inspectedEdge.limitations}
                </p>
                <p className="text-[11px] text-[#718096]">
                  Verified by: {inspectedEdge.verifiedBy}
                </p>
              </div>
            </div>
          )}

          {/* Save Setup to Project */}
          <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#202B3C]">
              Save Compatible Setup to Project
            </h3>
            <p className="text-xs text-[#718096]">
              Attach {pathResult ? 'discovered path' : 'selected compatible hardware'} to a student
              project plan for feasibility scoring.
            </p>
            <select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              className="w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-xs"
            >
              {editableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <MagneticButton
              disabled={!targetProjectId}
              onClick={handleSaveSetup}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#3978E8] px-4 py-2 text-xs font-medium text-white hover:bg-[#2E67CE] disabled:opacity-45"
            >
              <BookmarkPlus className="h-3.5 w-3.5 transition-transform duration-150 group-hover/magbtn:scale-110" />
              <span>Save Compatible Setup to Project</span>
            </MagneticButton>
          </div>
        </section>
      </div>
    </div>
  );
};
