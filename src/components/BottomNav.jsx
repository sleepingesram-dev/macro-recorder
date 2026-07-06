import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Chronicle', icon: ChronicleIcon },
  { to: '/log', label: 'Log', icon: QuillIcon },
  { to: '/progress', label: 'Progress', icon: ScalesIcon },
  { to: '/analytics', label: 'Codex', icon: TomeIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-abyss/90 backdrop-blur border-t border-rune"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] tracking-wide transition-colors ${
                isActive ? 'text-gold' : 'text-ink-3 hover:text-ink-2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-5 h-5" active={isActive} />
                <span className={isActive ? 'font-medium' : ''}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

function ChronicleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5c-.8 0-1.5-.7-1.5-1.5v-13Z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5v-13Z" />
      <path d="M7 8h2.5M14.5 8H17M7 11.5h2.5M14.5 11.5H17" />
    </svg>
  );
}
function QuillIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M19.5 4.5c-5.5.5-9.5 2.5-11.6 6.2-1.3 2.2-1.7 4.8-1.9 7.3 2.5-.2 5.1-.6 7.3-1.9 3.7-2.1 5.7-6.1 6.2-11.6Z" />
      <path d="M4.5 19.5 13 11" />
    </svg>
  );
}
function ScalesIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 4v16M5 7l14-2M5 7l-2.5 5.5a3 3 0 0 0 5 0L5 7ZM19 5l-2.5 5.5a3 3 0 0 0 5 0L19 5ZM8.5 20h7" />
    </svg>
  );
}
function TomeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M5 4h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 18.5V5a1 1 0 0 1 1-1Z" />
      <path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H19M12 7.5v5M9.5 10h5" />
    </svg>
  );
}
function GearIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
  );
}
