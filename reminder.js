import { EMOJI, getSettings, fmtTime, nowMinutes } from './config.js';
import { playQuacks } from './sound.js';

const type = new URLSearchParams(location.search).get('type') || 'water';
const s = await getSettings();
const r = s.reminders[type];
const $ = (id) => document.getElementById(id);

document.body.classList.add(type);
document.title = r.title;
$('emoji').textContent = EMOJI[type];
$('message').textContent = r.message;
$('time').textContent = fmtTime(nowMinutes());
$('snooze').textContent = `Snooze ${s.snoozeMinutes}m`;

// Title letters pop in one by one
[...r.title].forEach((ch, i) => {
  const span = document.createElement('span');
  span.textContent = ch === ' ' ? ' ' : ch;
  span.style.animationDelay = `${0.35 + i * 0.035}s`;
  $('title').appendChild(span);
});

/* ---------- particle background ---------- */
const canvas = $('fx');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let W, H;
function resize() {
  const dpr = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

const rand = (a, b) => a + Math.random() * (b - a);
const ambient = [];
const bursts = [];

// water: rising bubbles · study: twinkling sparkles · github: falling stars
function spawnAmbient(initial) {
  if (type === 'water') {
    return { x: rand(0, W), y: initial ? rand(0, H) : H + 10, r: rand(2, 7), vy: rand(-0.4, -1.2), phase: rand(0, 6) };
  }
  if (type === 'study') {
    return { x: rand(0, W), y: rand(0, H), r: rand(1, 3), life: initial ? rand(0, 1) : 0, speed: rand(0.004, 0.012) };
  }
  return { x: rand(-W * 0.2, W), y: initial ? rand(0, H) : -10, len: rand(8, 22), v: rand(1.5, 4) };
}
for (let i = 0; i < 45; i++) ambient.push(spawnAmbient(true));

function drawAmbient(p, i) {
  if (type === 'water') {
    p.y += p.vy; p.phase += 0.03;
    const x = p.x + Math.sin(p.phase) * 6;
    ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - p.r * .35, p.y - p.r * .35, p.r * .25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
    if (p.y < -10) ambient[i] = spawnAmbient(false);
  } else if (type === 'study') {
    p.life += p.speed;
    const a = Math.sin(p.life * Math.PI);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 2);
    ctx.fillStyle = `rgba(255,230,255,${a})`;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { // 4-point star
      ctx.rotate(Math.PI / 2);
      ctx.lineTo(0, -p.r * 3); ctx.lineTo(p.r * .6, -p.r * .6);
    }
    ctx.fill(); ctx.restore();
    if (p.life >= 1) ambient[i] = spawnAmbient(false);
  } else {
    p.x += p.v * .6; p.y += p.v;
    const g = ctx.createLinearGradient(p.x, p.y, p.x - p.len * .6, p.y - p.len);
    g.addColorStop(0, 'rgba(180,255,200,.9)'); g.addColorStop(1, 'rgba(180,255,200,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * .6, p.y - p.len); ctx.stroke();
    if (p.y > H + 20) ambient[i] = spawnAmbient(false);
  }
}

const CONFETTI = {
  water: ['#ffffff', '#4fc3f7', '#81d4fa', '#b3e5fc'],
  study: ['#ffffff', '#f4b8ff', '#ffd54f', '#ce93d8'],
  github: ['#ffffff', '#4ade80', '#facc15', '#fb923c']
}[type];

function burst(x, y) {
  for (let i = 0; i < 90; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(2, 8);
    bursts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
      w: rand(4, 8), h: rand(6, 12), rot: rand(0, 6), vr: rand(-.3, .3),
      color: CONFETTI[i % CONFETTI.length], life: 1
    });
  }
}

function frame() {
  ctx.clearRect(0, 0, W, H);
  if (!reduceMotion) ambient.forEach(drawAmbient);
  for (let i = bursts.length - 1; i >= 0; i--) {
    const p = bursts[i];
    p.vy += 0.25; p.vx *= .98; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.012;
    if (p.life <= 0) { bursts.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
  }
  requestAnimationFrame(frame);
}
frame();

/* ---------- buttons ---------- */
let busy = false;
$('done').onclick = async (e) => {
  if (busy) return; busy = true;
  const b = e.currentTarget.getBoundingClientRect();
  burst(b.left + b.width / 2, b.top);
  $('emoji').classList.add('launch');
  if (s.sound) playQuacks(1, { pitch: 1.35, dur: 0.18 }); // happy little quack
  await new Promise((res) => setTimeout(res, 1100));
  $('card').classList.add('leave');
  await new Promise((res) => setTimeout(res, 400));
  chrome.runtime.sendMessage({ action: 'done', type });
  window.close();
};
$('snooze').onclick = async () => {
  if (busy) return; busy = true;
  $('card').classList.add('leave');
  await new Promise((res) => setTimeout(res, 450));
  chrome.runtime.sendMessage({ action: 'snooze', type });
  window.close();
};

// The "quack quack" on open is played by the background worker, so it works
// even when the popup window is disabled.
