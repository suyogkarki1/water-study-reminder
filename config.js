// Shared settings + schedule helpers (used by background, popup, options, reminder pages).

export const TYPES = ['water', 'study', 'github'];

export const EMOJI = { water: '💧', study: '📚', github: '🚀' };

// Each reminder has one or more rules: between `start` and `end` (inclusive, 24h "HH:MM"),
// fire every `every` minutes, counting from `start`.
export const DEFAULTS = {
  enabled: true,        // master switch
  popupWindow: true,    // open a popup window in addition to the system notification
  sound: true,
  snoozeMinutes: 10,
  reminders: {
    water: {
      enabled: true,
      title: 'Drink water',
      message: 'Time to drink a glass of water!',
      rules: [
        { start: '08:00', end: '20:00', every: 30 },   // every 30 min during the day
        { start: '20:00', end: '23:59', every: 120 }   // every 2 h after 8 PM
      ]
    },
    study: {
      enabled: true,
      title: 'Study time',
      message: 'Time to study! Focus for the next 30 minutes.',
      rules: [{ start: '13:00', end: '23:00', every: 30 }]
    },
    github: {
      enabled: true,
      title: 'Push your code to GitHub',
      message: 'Commit and push your work: git add . && git commit && git push',
      rules: [{ start: '09:00', end: '23:00', every: 120 }]
    }
  }
};

export async function getSettings() {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = { ...structuredClone(DEFAULTS), ...(settings || {}) };
  s.reminders = { ...structuredClone(DEFAULTS.reminders), ...(settings?.reminders || {}) };
  return s;
}

export function saveSettings(settings) {
  return chrome.storage.sync.set({ settings });
}

export function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

export function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtTime(min) {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function slotKey(d, min) {
  return `${dateKey(d)} ${String(min).padStart(4, '0')}`;
}

// Most recent scheduled minute <= nowMin across all rules (or null).
export function latestSlot(rules, nowMin) {
  let best = null;
  for (const r of rules) {
    const start = toMin(r.start), end = toMin(r.end), every = Number(r.every);
    if (!every || nowMin < start) continue;
    const slot = start + Math.floor((Math.min(nowMin, end) - start) / every) * every;
    if (slot <= end && (best === null || slot > best)) best = slot;
  }
  return best;
}

// Next scheduled minute > nowMin today across all rules (or null).
export function nextSlot(rules, nowMin) {
  let best = null;
  for (const r of rules) {
    const start = toMin(r.start), end = toMin(r.end), every = Number(r.every);
    if (!every) continue;
    const n = nowMin < start ? start : start + Math.ceil((nowMin + 1 - start) / every) * every;
    if (n <= end && (best === null || n < best)) best = n;
  }
  return best;
}

export function firstSlot(rules) {
  const starts = rules.filter(r => Number(r.every)).map(r => toMin(r.start));
  return starts.length ? Math.min(...starts) : null;
}

export async function getStats() {
  const { stats } = await chrome.storage.local.get('stats');
  const today = dateKey();
  if (!stats || stats.date !== today) return { date: today, water: 0, study: 0, github: 0 };
  return stats;
}
