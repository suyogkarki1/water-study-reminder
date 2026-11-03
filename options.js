import { TYPES, EMOJI, DEFAULTS, getSettings, saveSettings } from './config.js';

let s = await getSettings();
const $ = (id) => document.getElementById(id);

function render() {
  $('enabled').checked = s.enabled;
  $('popupWindow').checked = s.popupWindow;
  $('sound').checked = s.sound;
  $('snoozeMinutes').value = s.snoozeMinutes;

  const box = $('reminders');
  box.innerHTML = '';
  for (const type of TYPES) {
    const r = s.reminders[type];
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.type = type;
    card.innerHTML = `
      <div class="row spread">
        <h2>${EMOJI[type]} <span class="t"></span></h2>
        <label class="row"><input type="checkbox" class="en"> Enabled</label>
      </div>
      <label class="field">Title <input type="text" class="title"></label>
      <label class="field">Message <input type="text" class="message"></label>
      <div class="muted">Schedule (times are inclusive, 24-hour):</div>
      <div class="rules" style="display:flex;flex-direction:column;gap:6px"></div>
      <div><button class="add">+ Add time range</button></div>`;
    card.querySelector('.t').textContent = r.title;
    card.querySelector('.en').checked = r.enabled;
    card.querySelector('.title').value = r.title;
    card.querySelector('.message').value = r.message;

    const rulesBox = card.querySelector('.rules');
    const addRule = (rule) => {
      const row = document.createElement('div');
      row.className = 'row rule';
      row.innerHTML = `
        From <input type="time" class="start"> to <input type="time" class="end">
        every <input type="number" class="every" min="1"> min
        <button class="remove" title="Remove">✕</button>`;
      row.querySelector('.start').value = rule.start;
      row.querySelector('.end').value = rule.end;
      row.querySelector('.every').value = rule.every;
      row.querySelector('.remove').onclick = () => row.remove();
      rulesBox.appendChild(row);
    };
    r.rules.forEach(addRule);
    card.querySelector('.add').onclick = () => addRule({ start: '09:00', end: '17:00', every: 60 });
    box.appendChild(card);
  }
}

function collect() {
  const out = {
    enabled: $('enabled').checked,
    popupWindow: $('popupWindow').checked,
    sound: $('sound').checked,
    snoozeMinutes: Math.max(1, Number($('snoozeMinutes').value) || 10),
    reminders: {}
  };
  for (const card of document.querySelectorAll('#reminders .card')) {
    const rules = [...card.querySelectorAll('.rule')].map((row) => ({
      start: row.querySelector('.start').value || '00:00',
      end: row.querySelector('.end').value || '23:59',
      every: Math.max(1, Number(row.querySelector('.every').value) || 30)
    }));
    out.reminders[card.dataset.type] = {
      enabled: card.querySelector('.en').checked,
      title: card.querySelector('.title').value.trim() || 'Reminder',
      message: card.querySelector('.message').value.trim(),
      rules
    };
  }
  return out;
}

$('save').onclick = async () => {
  s = collect();
  await saveSettings(s);
  render();
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 2000);
};

$('reset').onclick = async () => {
  s = structuredClone(DEFAULTS);
  await saveSettings(s);
  render();
  $('saved').textContent = 'Defaults restored';
  setTimeout(() => ($('saved').textContent = ''), 2000);
};

render();
