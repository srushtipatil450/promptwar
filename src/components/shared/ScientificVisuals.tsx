import React, { useEffect, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import { EquipmentCategory } from '../../types/lablink';
import { usePointerCapability } from './MotionPrimitives';

/**
 * Clean, precision-styled procedural SVG illustration matched to each EquipmentCategory.
 * Scales smoothly with a subtle blue/lavender radial halo when hovered inside EquipmentCard.
 */
export const EquipmentIllustration: React.FC<{
  category: EquipmentCategory;
  className?: string;
}> = ({ category, className = '' }) => {
  const renderIcon = () => {
    switch (category) {
      case 'Electronics & Signal':
        return (
          <svg viewBox="0 0 64 48" className="h-9 w-12" fill="none" aria-hidden="true">
            <rect
              x="6"
              y="8"
              width="52"
              height="32"
              rx="6"
              fill="#FFFFFF"
              stroke="#C9DDFE"
              strokeWidth="1.6"
            />
            <rect x="11" y="13" width="28" height="22" rx="3" fill="#EAF2FF" />
            <path
              d="M13 24 C16 16, 19 16, 22 24 C25 32, 28 32, 31 24 C34 17, 36 17, 37 24"
              stroke="#3978E8"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="47" cy="18" r="3" fill="#EEEAFE" stroke="#5B47C7" strokeWidth="1.4" />
            <circle cx="47" cy="28" r="3" fill="#EAF2FF" stroke="#3978E8" strokeWidth="1.4" />
            <line x1="44" y1="34" x2="50" y2="34" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      case 'Robotics & Automation':
        return (
          <svg viewBox="0 0 64 48" className="h-9 w-12" fill="none" aria-hidden="true">
            <rect x="14" y="36" width="26" height="5" rx="2.5" fill="#C9DDFE" />
            <path
              d="M24 36 L20 22 L38 14 L46 21"
              stroke="#3978E8"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="22" r="3.2" fill="#FFFFFF" stroke="#5B47C7" strokeWidth="1.8" />
            <circle cx="38" cy="14" r="3.2" fill="#FFFFFF" stroke="#3978E8" strokeWidth="1.8" />
            <path
              d="M44 20 L49 18 M44 23 L49 25"
              stroke="#5B47C7"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'Fabrication & CNC':
        return (
          <svg viewBox="0 0 64 48" className="h-9 w-12" fill="none" aria-hidden="true">
            <rect
              x="10"
              y="10"
              width="44"
              height="28"
              rx="5"
              fill="#FFFFFF"
              stroke="#C9DDFE"
              strokeWidth="1.6"
            />
            <line x1="16" y1="18" x2="48" y2="18" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="27" y="14" width="10" height="8" rx="2" fill="#3978E8" />
            <path d="M32 22 L32 30" stroke="#5B47C7" strokeWidth="2" strokeLinecap="round" />
            <rect x="20" y="31" width="24" height="4" rx="1.5" fill="#EEEAFE" />
          </svg>
        );
      case 'Bioengineering':
        return (
          <svg viewBox="0 0 64 48" className="h-9 w-12" fill="none" aria-hidden="true">
            <path
              d="M21 10 C21 20, 43 20, 43 30 C43 35, 38 38, 32 38"
              stroke="#3978E8"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M43 10 C43 20, 21 20, 21 30 C21 35, 26 38, 32 38"
              stroke="#5B47C7"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <line x1="25" y1="14" x2="39" y2="14" stroke="#C9DDFE" strokeWidth="1.6" />
            <line x1="25" y1="24" x2="39" y2="24" stroke="#C9DDFE" strokeWidth="1.6" />
            <line x1="25" y1="33" x2="39" y2="33" stroke="#C9DDFE" strokeWidth="1.6" />
          </svg>
        );
      case 'Materials & Metrology':
        return (
          <svg viewBox="0 0 64 48" className="h-9 w-12" fill="none" aria-hidden="true">
            <rect x="14" y="35" width="36" height="5" rx="2" fill="#C9DDFE" />
            <line x1="20" y1="11" x2="20" y2="35" stroke="#3978E8" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="44" y1="11" x2="44" y2="35" stroke="#3978E8" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="16" y="18" width="32" height="6" rx="2" fill="#FFFFFF" stroke="#5B47C7" strokeWidth="1.6" />
            <line x1="32" y1="24" x2="32" y2="32" stroke="#3978E8" strokeWidth="2" strokeDasharray="2 2" />
          </svg>
        );
      case 'Optics & Thermal':
      default:
        return (
          <svg viewBox="0 0 64 48" className="h-9 w-12" fill="none" aria-hidden="true">
            <circle cx="32" cy="24" r="13" fill="#EAF2FF" stroke="#3978E8" strokeWidth="1.8" />
            <circle cx="32" cy="24" r="7" fill="#EEEAFE" stroke="#5B47C7" strokeWidth="1.6" />
            <circle cx="32" cy="24" r="2.5" fill="#3978E8" />
            <path d="M10 24 H16 M48 24 H54 M32 7 V10 M32 38 V41" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative flex h-12 w-14 shrink-0 items-center justify-center rounded-xl border border-[#E6EAF0] bg-[#F7F9FC] transition-all duration-200 group-hover/tilt:border-[#C9DDFE] group-hover/tilt:bg-white ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover/tilt:opacity-100"
        style={{
          background:
            'radial-gradient(circle at center, rgba(57,120,232,0.14), rgba(238,234,254,0.38) 58%, transparent 78%)',
        }}
      />
      <div className="relative z-10 transition-transform duration-200 group-hover/tilt:scale-105">
        {renderIcon()}
      </div>
    </div>
  );
};

/**
 * 5. Cursor-Responsive Scientific Illustration
 * Precision orbital rings, connected lab nodes, and subtle trajectory trails
 * that respond smoothly to pointer coordinates inside hero sections.
 */
export const ScientificOrbitalIllustration: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { canHoverFine } = usePointerCapability();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const sx = useSpring(mx, { stiffness: 120, damping: 20 });
  const sy = useSpring(my, { stiffness: 120, damping: 20 });

  const outerRotate = useTransform(sx, [-1, 1], [-12, 12]);
  const innerRotate = useTransform(sy, [-1, 1], [16, -16]);
  const nodeShiftX = useTransform(sx, [-1, 1], [-8, 8]);
  const nodeShiftY = useTransform(sy, [-1, 1], [-8, 8]);
  const subShiftX = useTransform(sx, [-1, 1], [5, -5]);
  const subShiftY = useTransform(sy, [-1, 1], [5, -5]);

  useEffect(() => {
    if (!canHoverFine) return;
    const onMove = (e: PointerEvent) => {
      if (!svgRef.current || e.pointerType === 'touch') return;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / 360));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / 260));
      mx.set(nx);
      my.set(ny);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [canHoverFine, mx, my]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 220 140"
      className={`select-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="lablink-hero-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3978E8" stopOpacity="0.16" />
          <stop offset="55%" stopColor="#EEEAFE" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="110" cy="70" r="64" fill="url(#lablink-hero-halo)" />

      {/* Outer Tilted Orbital Path */}
      <motion.g
        style={{
          rotate: canHoverFine ? outerRotate : 0,
          transformOrigin: '110px 70px',
        }}
      >
        <ellipse
          cx="110"
          cy="70"
          rx="84"
          ry="34"
          transform="rotate(-14 110 70)"
          stroke="#C9DDFE"
          strokeWidth="1.4"
          strokeDasharray="5 4"
        />
        <circle cx="34" cy="87" r="4" fill="#3978E8" />
        <circle cx="186" cy="53" r="3.2" fill="#5B47C7" />
      </motion.g>

      {/* Counter-rotating Inner Orbital Path */}
      <motion.g
        style={{
          rotate: canHoverFine ? innerRotate : 0,
          transformOrigin: '110px 70px',
        }}
      >
        <ellipse
          cx="110"
          cy="70"
          rx="58"
          ry="24"
          transform="rotate(18 110 70)"
          stroke="#D7CEFD"
          strokeWidth="1.4"
        />
        <circle cx="156" cy="88" r="3" fill="#16A34A" />
      </motion.g>

      {/* Connected Calibration Nodes */}
      <motion.g style={{ x: canHoverFine ? subShiftX : 0, y: canHoverFine ? subShiftY : 0 }}>
        <line x1="64" y1="44" x2="110" y2="70" stroke="#93C5FD" strokeWidth="1.3" />
        <line x1="158" y1="42" x2="110" y2="70" stroke="#C4B5FD" strokeWidth="1.3" />
        <line x1="76" y1="106" x2="110" y2="70" stroke="#93C5FD" strokeWidth="1.3" />
        <circle cx="64" cy="44" r="5" fill="#FFFFFF" stroke="#3978E8" strokeWidth="1.8" />
        <circle cx="158" cy="42" r="4.5" fill="#FFFFFF" stroke="#5B47C7" strokeWidth="1.8" />
        <circle cx="76" cy="106" r="4.2" fill="#FFFFFF" stroke="#3978E8" strokeWidth="1.8" />
      </motion.g>

      {/* Core Ecosystem Node */}
      <motion.g style={{ x: canHoverFine ? nodeShiftX : 0, y: canHoverFine ? nodeShiftY : 0 }}>
        <circle cx="110" cy="70" r="14" fill="#EAF2FF" stroke="#3978E8" strokeWidth="1.8" />
        <circle cx="110" cy="70" r="5.5" fill="#3978E8" />
      </motion.g>
    </svg>
  );
};

/**
 * 9. Subtle Cursor Particle Field (Hero & Campus Map backdrop only)
 * Low particle count (~16), responds gently to pointer proximity, pointer-events-none,
 * automatically skipped on touch devices & reduced-motion preference.
 */
interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  phase: number;
}

export const CursorParticleField: React.FC<{
  particleCount?: number;
  className?: string;
}> = ({ particleCount = 16, className = '' }) => {
  const { canHoverFine } = usePointerCapability();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canHoverFine) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = Math.max(200, parent.clientWidth);
    let height = Math.max(120, parent.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = Math.max(200, parent.clientWidth);
      height = Math.max(120, parent.clientHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const palette = [
      'rgba(57, 120, 232, 0.36)',
      'rgba(91, 71, 199, 0.28)',
      'rgba(147, 197, 253, 0.45)',
    ];

    const particles: Particle[] = Array.from({ length: particleCount }, (_, idx) => {
      const bx = ((idx * 137.5) % 92 + 4) * 0.01 * width;
      const by = ((idx * 73.1) % 84 + 8) * 0.01 * height;
      return {
        x: bx,
        y: by,
        baseX: bx,
        baseY: by,
        vx: 0,
        vy: 0,
        radius: 1.8 + (idx % 3) * 0.7,
        color: palette[idx % palette.length],
        phase: idx * 0.7,
      };
    });

    const pointer = { x: -9999, y: -9999, active: false };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const rect = parent.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
        pointer.active = true;
      } else {
        pointer.active = false;
      }
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    parent.addEventListener('pointerleave', onPointerLeave);

    const ro = new ResizeObserver(() => {
      resize();
      particles.forEach((p, idx) => {
        p.baseX = ((idx * 137.5) % 92 + 4) * 0.01 * width;
        p.baseY = ((idx * 73.1) % 84 + 8) * 0.01 * height;
      });
    });
    ro.observe(parent);

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const t = (now - startTime) * 0.001;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const driftX = p.baseX + Math.sin(t * 0.8 + p.phase) * 7;
        const driftY = p.baseY + Math.cos(t * 0.7 + p.phase) * 6;

        let targetX = driftX;
        let targetY = driftY;

        if (pointer.active) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130 && dist > 1) {
            const force = (1 - dist / 130) * 14;
            targetX += (dx / dist) * force;
            targetY += (dy / dist) * force;
          }
        }

        p.vx = (p.vx + (targetX - p.x) * 0.06) * 0.82;
        p.vy = (p.vy + (targetY - p.y) * 0.06) * 0.82;
        p.x += p.vx;
        p.y += p.vy;
      }

      // Subtle thread links near pointer or nearby particles
      ctx.lineWidth = 0.85;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        if (pointer.active) {
          const dp = Math.hypot(pointer.x - a.x, pointer.y - a.y);
          if (dp < 120) {
            ctx.strokeStyle = `rgba(57, 120, 232, ${(1 - dp / 120) * 0.22})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 85) {
            ctx.strokeStyle = `rgba(148, 163, 184, ${(1 - dist / 85) * 0.14})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      parent.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [canHoverFine, particleCount]);

  if (!canHoverFine) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
    />
  );
};
