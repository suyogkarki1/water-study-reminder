import {
  TYPES, EMOJI, getSettings, getStats, latestSlot, nowMinutes, slotKey
} from './config.js';

const GRACE_MIN = 5; // fire a missed slot if we're at most this many minutes late

async function ensureAlarm() {
  const existing = await chrome.alarms.get('tick');
  if (!existing) {
    chrome.alarms.create('tick', {
      periodInMinutes: 1,
      when: Math.ceil(Date.now() / 60000) * 60000 + 500 // align to the start of a minute
    });
  }
}

// On install, mark current slots as already fired so you don't get 3 popups instantly.
chrome.runtime.onInstalled.addListener(async () => {
  const s = await getSettings();
  const now = new Date();
  const lastFired = {};
  for (const t of TYPES) {
    const slot = latestSlot(s.reminders[t].rules, nowMinutes(now));
    if (slot !== null) lastFired[t] = slotKey(now, slot);
  }
  await chrome.storage.local.set({ lastFired });
  await ensureAlarm();
});

chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tick') return check();
  if (alarm.name.startsWith('snooze:')) {
    const type = alarm.name.split(':')[1];
    return fire(type, await getSettings());
  }
});

async function check() {
  const s = await getSettings();
  if (!s.enabled) return;
  const now = new Date();
  const nowMin = nowMinutes(now);
  const { lastFired = {} } = await chrome.storage.local.get('lastFired');
  const due = [];

  for (const type of TYPES) {
    const r = s.reminders[type];
    if (!r?.enabled) continue;
    const slot = latestSlot(r.rules, nowMin);
    if (slot === null || nowMin - slot > GRACE_MIN) continue;
    const key = slotKey(now, slot);
    if ((lastFired[type] || '') >= key) continue;
    lastFired[type] = key;
    due.push(type);
  }

  if (due.length) {
    await chrome.storage.local.set({ lastFired });
    for (const type of due) await fire(type, s);
  }
}

async function fire(type, s) {
  const r = s.reminders[type];
  if (!r) return;
  chrome.notifications.create(`rem|${type}|${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `${EMOJI[type]} ${r.title}`,
    message: r.message,
    priority: 2,
    requireInteraction: true,
    buttons: [{ title: 'Done ✓' }, { title: `Snooze ${s.snoozeMinutes} min` }]
  });
  if (s.popupWindow) await openWindow(type);
}

async function openWindow(type) {
  const { windows = {} } = await chrome.storage.session.get('windows');
  if (windows[type]) {
    try { await chrome.windows.remove(windows[type]); } catch { /* already closed */ }
  }
  const width = 400, height = 440;
  let left, top;
  try {
    const w = await chrome.windows.getLastFocused();
    left = Math.max(0, w.left + w.width - width - 20);
    top = w.top + 80;
  } catch { /* no browser window open */ }

  const win = await chrome.windows.create({
    url: `reminder.html?type=${type}`,
    type: 'popup', width, height, left, top, focused: true
  });
  windows[type] = win.id;
  await chrome.storage.session.set({ windows });
}

async function closeReminder(type) {
  const all = await chrome.notifications.getAll();
  for (const id of Object.keys(all)) {
    if (id.startsWith(`rem|${type}|`)) chrome.notifications.clear(id);
  }
  const { windows = {} } = await chrome.storage.session.get('windows');
  if (windows[type]) {
    try { await chrome.windows.remove(windows[type]); } catch { /* already closed */ }
    delete windows[type];
    await chrome.storage.session.set({ windows });
  }
}

async function markDone(type) {
  const stats = await getStats();
  stats[type] = (stats[type] || 0) + 1;
  await chrome.storage.local.set({ stats });
  await closeReminder(type);
}

async function snooze(type) {
  const s = await getSettings();
  chrome.alarms.create(`snooze:${type}`, { delayInMinutes: s.snoozeMinutes });
  await closeReminder(type);
}

chrome.notifications.onButtonClicked.addListener((id, index) => {
  const type = id.split('|')[1];
  if (index === 0) markDone(type); else snooze(type);
});

chrome.notifications.onClicked.addListener((id) => {
  const type = id.split('|')[1];
  chrome.notifications.clear(id);
  openWindow(type);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.action === 'done') await markDone(msg.type);
    else if (msg.action === 'snooze') await snooze(msg.type);
    else if (msg.action === 'test') await fire(msg.type, await getSettings());
    sendResponse({ ok: true });
  })();
  return true;
});
