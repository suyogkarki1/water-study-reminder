import {
  TYPES, EMOJI, getSettings, saveSettings, getStats, nextSlot, firstSlot, fmtTime, nowMinutes
} from './config.js';

const COUNT_LABEL = { water: 'glasses', study: 'sessions', github: 'pushes' };

const s = await getSettings();
const stats = await getStats();
const list = document.getElementById('list');
const enabled = document.getElementById('enabled');

enabled.checked = s.enabled;
enabled.onchange = async () => {
  s.enabled = enabled.checked;
  await saveSettings(s);
  render();
};
document.getElementById('settings').onclick = (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
};

function render() {
  list.innerHTML = '';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';
  const now = nowMinutes();

  for (const type of TYPES) {
    const r = s.reminders[type];
    let next;
    if (!s.enabled || !r.enabled) next = 'Off';
    else {
      const n = nextSlot(r.rules, now);
      const f = firstSlot(r.rules);
      next = n !== null ? `Next: ${fmtTime(n)}` : f !== null ? `Next: tomorrow ${fmtTime(f)}` : 'No schedule';
    }

    const el = document.createElement('div');
    el.className = 'card row item' + (!s.enabled || !r.enabled ? ' off' : '');
    el.innerHTML = `
      <div class="emoji">${EMOJI[type]}</div>
      <div class="info">
        <div class="name"></div>
        <small class="muted next"></small>
        <small class="muted">Today: ${stats[type] || 0} ${COUNT_LABEL[type]}</small>
      </div>
      <button title="Show this reminder now">Test</button>`;
    el.querySelector('.name').textContent = r.title;
    el.querySelector('.next').textContent = next;
    el.querySelector('button').onclick = () => chrome.runtime.sendMessage({ action: 'test', type });
    list.appendChild(el);
  }
  document.getElementById('status').textContent = s.enabled ? 'Running' : 'Paused';
}

render();
