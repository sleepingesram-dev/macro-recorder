import { useEffect } from 'react';
import { db } from '../db/db';
import { todayStr } from '../lib/dates';

// Gentle supper-time nudge if nothing has been logged today. Browser-local:
// only fires while the app is open (no push server — nothing leaves the device).
export function useLogReminder(enabled) {
  useEffect(() => {
    if (!enabled || !('Notification' in window)) return;
    const KEY = 'chronicle.lastReminder';
    const check = async () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      if (now.getHours() < 19) return;
      if (localStorage.getItem(KEY) === todayStr()) return;
      const count = await db.entries.where('date').equals(todayStr()).count();
      if (count === 0) {
        new Notification("Don't lose your streak!", {
          body: 'Nothing logged today. Quick add before bed?',
          icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
        });
        localStorage.setItem(KEY, todayStr());
      }
    };
    check();
    const id = setInterval(check, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [enabled]);
}
