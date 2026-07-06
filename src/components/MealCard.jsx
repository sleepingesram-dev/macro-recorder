import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { fmt } from './ui';
import { MACRO_COLORS } from './charts';

export default function MealCard({ meal, entries, date, onEdit }) {
  const [open, setOpen] = useState(true);
  const nav = useNavigate();
  const kcal = entries.reduce((a, e) => a + (e.kcal || 0), 0);

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-gold-dim transition-transform text-[10px] ${open ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className="font-display text-[13px] tracking-[0.1em] uppercase text-ink">
            {meal.label}
          </span>
        </div>
        <span className="font-mono text-xs text-ink-2">{fmt.kcal(kcal)} kcal</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="border-t border-rune">
              {entries.length === 0 && (
                <p className="px-4 py-3 text-xs text-ink-3 italic">Nothing inscribed.</p>
              )}
              {entries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onEdit(e)}
                  className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left
                    hover:bg-surface-2/60 transition-colors border-b border-rune/40 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">
                      {e.name}
                      {e.viaScan && <span className="text-arcane-bright text-[10px] ml-1.5">◈</span>}
                    </p>
                    <p className="text-[11px] text-ink-3 font-mono mt-0.5">
                      {e.amountDesc || '—'}
                      {' · '}
                      <span style={{ color: MACRO_COLORS.protein }}>P {fmt.g(e.protein)}</span>{' '}
                      <span style={{ color: MACRO_COLORS.carbs }}>C {fmt.g(e.carbs)}</span>{' '}
                      <span style={{ color: MACRO_COLORS.fat }}>F {fmt.g(e.fat)}</span>
                    </p>
                  </div>
                  <span className="font-mono text-xs text-ink-2 shrink-0">{fmt.kcal(e.kcal)}</span>
                </button>
              ))}
              <button
                className="w-full px-4 py-2.5 text-left text-xs text-gold-dim hover:text-gold transition-colors flex items-center gap-1.5"
                onClick={() => nav(`/log?meal=${meal.key}&date=${date}`)}
              >
                <span className="text-sm leading-none">✦</span> Add to {meal.label}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
