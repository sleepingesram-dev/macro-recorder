import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from './state/SettingsContext';
import BottomNav from './components/BottomNav';
import Dashboard from './screens/Dashboard';
import LogFood from './screens/LogFood';
import Progress from './screens/Progress';
import Analytics from './screens/Analytics';
import Settings from './screens/Settings';
import Onboarding from './screens/Onboarding';
import { useLogReminder } from './state/useLogReminder';

export default function App() {
  const { settings } = useSettings();
  const location = useLocation();
  useLogReminder(settings.notifications.logReminder);

  if (!settings.onboarded) return <Onboarding />;

  return (
    <div className="min-h-dvh max-w-2xl mx-auto pb-24">
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="px-4 pt-4"
        >
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/log" element={<LogFood />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
      <BottomNav />
    </div>
  );
}
