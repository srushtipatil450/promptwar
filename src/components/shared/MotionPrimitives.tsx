import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  MotionValue,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';

export function usePointerCapability(): {
  canHoverFine: boolean;
  prefersReduced: boolean;
} {
  const prefersReduced = Boolean(useReducedMotion());
  const [canHoverFine, setCanHoverFine] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHoverFine(mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return { canHoverFine: canHoverFine && !prefersReduced, prefersReduced };
}

export const AnimatedNumber: React.FC<{
  value: number;
  suffix?: string;
  className?: string;
}> = ({ value, suffix = '', className = '' }) => {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const startVal = display;
    const delta = value - startVal;
    if (delta === 0) return;

    const duration = 320;
    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startVal + delta * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReduced]);

  return (
    <span className={`tabular-nums ${className}`}>
      {display}
      {suffix}
    </span>
  );
};

export const ProgressRing: React.FC<{
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
}> = ({
  percent,
  size = 52,
  strokeWidth = 5,
  color = '#3978E8',
  trackColor = '#E6EAF0',
  label,
}) => {
  const prefersReduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={
            prefersReduced
              ? { strokeDashoffset: targetOffset }
              : { strokeDashoffset: circumference }
          }
          animate={{ strokeDashoffset: targetOffset }}
          transition={{
            duration: prefersReduced ? 0 : 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </svg>
      {label !== undefined && (
        <span className="absolute text-[10px] font-bold tabular-nums text-[#202B3C]">
          {label}
        </span>
      )}
    </div>
  );
};

export const StaggerCard: React.FC<{
  children: React.ReactNode;
  index?: number;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}> = ({
  children,
  index = 0,
  className = '',
  interactive = false,
  onClick,
}) => {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReduced ? 0 : 0.24,
        delay: prefersReduced ? 0 : Math.min(index * 0.035, 0.24),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        interactive && !prefersReduced
          ? { y: -2, transition: { duration: 0.18 } }
          : undefined
      }
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * 1. Global / Section Cursor Spotlight
 * Soft blue & lavender radial glow following pointer with gentle spring delay.
 * Zero React state updates per mousemove; disabled on touch & reduced motion.
 */
export const CursorSpotlightSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  spotlightRadius?: number;
  intensity?: 'subtle' | 'medium';
}> = ({
  children,
  className = '',
  spotlightRadius = 380,
  intensity = 'subtle',
}) => {
  const { canHoverFine } = usePointerCapability();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerX = useMotionValue(-999);
  const pointerY = useMotionValue(-999);
  const activeAlpha = useMotionValue(0);

  const springX = useSpring(pointerX, { stiffness: 170, damping: 26, mass: 0.5 });
  const springY = useSpring(pointerY, { stiffness: 170, damping: 26, mass: 0.5 });
  const springAlpha = useSpring(activeAlpha, { stiffness: 200, damping: 28 });

  const blueAlpha = intensity === 'medium' ? 0.11 : 0.075;
  const lavenderAlpha = intensity === 'medium' ? 0.45 : 0.32;

  const background = useMotionTemplate`radial-gradient(${spotlightRadius}px circle at ${springX}px ${springY}px, rgba(57, 120, 232, ${blueAlpha}), rgba(238, 234, 254, ${lavenderAlpha}) 42%, rgba(255, 255, 255, 0) 74%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canHoverFine || e.pointerType === 'touch' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    pointerX.set(e.clientX - rect.left);
    pointerY.set(e.clientY - rect.top);
    activeAlpha.set(1);
  };

  const handlePointerLeave = () => {
    activeAlpha.set(0);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative overflow-hidden ${className}`}
    >
      {canHoverFine && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background,
            opacity: springAlpha,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

interface MagneticContextValue {
  normX: MotionValue<number>;
  normY: MotionValue<number>;
  enabled: boolean;
}

const MagneticCardContext = createContext<MagneticContextValue | null>(null);

/**
 * 2. Magnetic Card Interaction
 * Subtle 3D tilt (~2-4 deg max), gentle elevation, soft dynamic shadow,
 * blue/lavender border highlight, and smooth return on leave.
 */
export const MagneticTiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  index?: number;
  maxTilt?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}> = ({
  children,
  className = '',
  index = 0,
  maxTilt = 3.2,
  onClick,
  style,
}) => {
  const { canHoverFine, prefersReduced } = usePointerCapability();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const normX = useMotionValue(0);
  const normY = useMotionValue(0);
  const hoverState = useMotionValue(0);

  const smoothX = useSpring(normX, { stiffness: 260, damping: 24, mass: 0.45 });
  const smoothY = useSpring(normY, { stiffness: 260, damping: 24, mass: 0.45 });
  const smoothHover = useSpring(hoverState, { stiffness: 280, damping: 26 });

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-maxTilt, maxTilt]);
  const liftY = useTransform(smoothHover, [0, 1], [0, -3]);
  const glowOpacity = useTransform(smoothHover, [0, 1], [0, 1]);

  const spotX = useTransform(smoothX, [-0.5, 0.5], ['15%', '85%']);
  const spotY = useTransform(smoothY, [-0.5, 0.5], ['15%', '85%']);
  const cardSheen = useMotionTemplate`radial-gradient(260px circle at ${spotX} ${spotY}, rgba(57, 120, 232, 0.07), rgba(238, 234, 254, 0.24) 48%, rgba(255, 255, 255, 0) 76%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canHoverFine || e.pointerType === 'touch' || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const nx = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
    const ny = Math.max(-0.5, Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5));
    normX.set(nx);
    normY.set(ny);
    hoverState.set(1);
  };

  const handlePointerLeave = () => {
    normX.set(0);
    normY.set(0);
    hoverState.set(0);
  };

  return (
    <MagneticCardContext.Provider
      value={{ normX: smoothX, normY: smoothY, enabled: canHoverFine }}
    >
      <motion.div
        ref={cardRef}
        onClick={onClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: prefersReduced ? 0 : 0.24,
          delay: prefersReduced ? 0 : Math.min(index * 0.035, 0.22),
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          ...style,
          transformPerspective: canHoverFine ? 920 : undefined,
          rotateX: canHoverFine ? rotateX : 0,
          rotateY: canHoverFine ? rotateY : 0,
          y: canHoverFine ? liftY : 0,
          willChange: canHoverFine ? 'transform' : undefined,
        }}
        className={`group/tilt relative transition-[border-color,box-shadow] duration-200 hover:border-[#C9DDFE] hover:shadow-[0_12px_28px_-14px_rgba(57,120,232,0.22),0_4px_12px_-4px_rgba(32,43,60,0.06)] ${className}`}
      >
        {canHoverFine && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              background: cardSheen,
              opacity: glowOpacity,
            }}
          />
        )}
        {children}
      </motion.div>
    </MagneticCardContext.Provider>
  );
};

/**
 * Inner parallax helper for icons, progress rings, or decorative illustrations inside MagneticTiltCard.
 */
export const MagneticParallaxLayer: React.FC<{
  children: React.ReactNode;
  depth?: number;
  className?: string;
}> = ({ children, depth = 8, className = '' }) => {
  const ctx = useContext(MagneticCardContext);
  const fallbackX = useMotionValue(0);
  const fallbackY = useMotionValue(0);
  const x = useTransform(ctx?.normX ?? fallbackX, [-0.5, 0.5], [-depth, depth]);
  const y = useTransform(ctx?.normY ?? fallbackY, [-0.5, 0.5], [-depth, depth]);

  if (!ctx?.enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div style={{ x, y }} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * 3. Magnetic CTA Button
 * Subtle magnetic pull capped tightly (±4px) so hitboxes never shift unpredictably,
 * paired with crisp tap scale and group-hover icon translation support.
 */
export interface MagneticButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'
  > {
  strength?: number;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = '',
  strength = 4,
  disabled,
  type = 'button',
  ...rest
}) => {
  const { canHoverFine, prefersReduced } = usePointerCapability();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const pullX = useMotionValue(0);
  const pullY = useMotionValue(0);

  const springX = useSpring(pullX, { stiffness: 320, damping: 22, mass: 0.35 });
  const springY = useSpring(pullY, { stiffness: 320, damping: 22, mass: 0.35 });

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canHoverFine || disabled || e.pointerType === 'touch' || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    pullX.set(Math.max(-strength, Math.min(strength, relX * strength * 2)));
    pullY.set(Math.max(-strength, Math.min(strength, relY * strength * 2)));
  };

  const handlePointerLeave = () => {
    pullX.set(0);
    pullY.set(0);
  };

  return (
    <motion.button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      whileTap={!disabled && !prefersReduced ? { scale: 0.97 } : undefined}
      style={{
        x: canHoverFine && !disabled ? springX : 0,
        y: canHoverFine && !disabled ? springY : 0,
      }}
      className={`group/magbtn transition-colors duration-150 ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
};
