import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

// ── Section title: gold pixel text with outline ──
export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3 mt-6 first:mt-0">
      <div className="min-w-0">
        <h2 className="font-display text-[11px] leading-relaxed uppercase pixel-title">
          {children}
        </h2>
        <div className="divider-rune mt-1.5 w-24" />
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ── Circular progress ring (SVG) ──
// over-target overflow is shown by switching the arc color, never by wrapping.
export function Ring({ size = 120, stroke = 9, value = 0, target = 1, color = '#FFD76E', overColor = '#D43D3D', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? value / target : 0;
  const shown = Math.min(1, pct);
  const over = pct > 1.02;
  // segmented arc — reads like a game meter
  const seg = c / 48;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#0D0F26"
          strokeWidth={stroke}
          strokeDasharray={`${seg * 0.72} ${seg * 0.28}`}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - shown) }}
          transition={{ type: 'spring', stiffness: 60, damping: 15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// ── Chunky game-style progress bar with segment stripes ──
export function StatBar({ value = 0, target = 1, color = '#FFD76E', height = 12, className = '' }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const over = target > 0 && value / target > 1.02;
  return (
    <div
      className={`w-full bg-abyss/70 overflow-hidden border-2 border-rune pixel-corners ${className}`}
      style={{ height: height + 4 }}
    >
      <motion.div
        className="h-full bar-stripes"
        style={{ background: over ? '#D43D3D' : color, backgroundImage: undefined }}
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: 'spring', stiffness: 70, damping: 18 }}
      >
        <div className="h-full w-full bar-stripes" />
      </motion.div>
    </div>
  );
}

// ── Modal sheet ──
export function Sheet({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto
              bg-surface border-2 border-rune shadow-card pixel-corners`}
            initial={{ y: 60, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-surface/95 backdrop-blur border-b-2 border-rune">
              <h3 className="font-display text-[11px] leading-relaxed uppercase pixel-title">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-blood text-xl leading-none px-1">
                ×
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Segmented control ──
export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex border-2 border-rune bg-abyss/50 p-0.5 pixel-corners ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs transition-colors font-semibold ${
            value === o.value ? 'bg-gold/25 text-gold-bright' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-3 mt-1">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon = '✦', title, children }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-2xl text-gold-dim mb-2">{icon}</div>
      <p className="font-body font-semibold text-sm text-ink-2 tracking-wide">{title}</p>
      {children && <div className="text-xs text-ink-3 mt-2">{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-ink-2 text-sm py-4 justify-center">
      <motion.span
        className="inline-block w-4 h-4 border-2 border-gold-dim border-t-gold rounded-full"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      />
      {label}
    </div>
  );
}

export const fmt = {
  int: (v) => (v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString()),
  g: (v) => (v == null || isNaN(v) ? '—' : `${Math.round(v)}g`),
  kcal: (v) => (v == null || isNaN(v) ? '—' : `${Math.round(v).toLocaleString()}`),
};
