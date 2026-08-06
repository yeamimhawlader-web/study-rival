const room = new URLSearchParams(location.search).get('room') || 'focus-room';
const $ = id => document.getElementById(id);
const memoryStore = {};
function storageGet(key) { try { return localStorage.getItem(key); } catch { return memoryStore[key] ?? null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { memoryStore[key] = value; } }
const memberKey = 'study-rival-member-id';
let memberId = storageGet(memberKey);
if (!memberId) {
  memberId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  storageSet(memberKey, memberId);
}
let state = null;
const storedSeat = storageGet(`study-rival-seat-${room}`);
let me = (storedSeat === '0' || storedSeat === '1') ? Number(storedSeat) : null;
var timeEditing = false;
var noteEditing = false;
let soundOn = storageGet('study-rival-sound') !== 'off';
let audioContext = null;
let lastCountdownCue = '';
let finishedSoundPlayed = false;
let prevPoints = [null, null];
let prevPausedBy = undefined;
const AVATARS = ['strategist', 'bookworm', 'hacker', 'fox', 'angel', 'shrine', 'bard', 'scientist'];
const AVATAR_ICONS = {
  strategist: { label: 'Strategist', file: 'avatars/strategist.png' },
  bookworm:   { label: 'Bookworm',   file: 'avatars/bookworm.png' },
  hacker:     { label: 'Hacker',     file: 'avatars/hacker.png' },
  fox:        { label: 'Fox Spirit', file: 'avatars/fox.png' },
  angel:      { label: 'Angel',      file: 'avatars/angel.png' },
  shrine:     { label: 'Shrine Maiden', file: 'avatars/shrine.png' },
  bard:       { label: 'Bard',       file: 'avatars/bard.png' },
  scientist:  { label: 'Scientist',  file: 'avatars/scientist.png' },
};
let selectedAvatar = storageGet('study-rival-avatar') || AVATARS[0];
const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "You don't have to be great to start, but you have to start to be great.",
  "Small daily improvements are the key to staggering long-term results.",
  "The pain of discipline weighs ounces; the pain of regret weighs tons.",
  "Focus on being productive instead of busy.",
  "Your future self is watching you right now through memories.",
  "Motivation gets you going, discipline keeps you growing.",
  "One hour of focused work beats four hours of distracted effort.",
  "Do it now. Sometimes 'later' becomes 'never'.",
  "You are one focused session away from a completely different mindset."
];

function spawnDamage(i, amount) {
  const badge = $(`p${i + 1}badge`);
  if (badge) {
    const el = document.createElement('div');
    el.className = 'damage-pop';
    el.textContent = `-${amount}`;
    badge.appendChild(el);
    badge.classList.remove('shake'); void badge.offsetWidth; badge.classList.add('shake');
    setTimeout(() => el.remove(), 1000);
    setTimeout(() => badge.classList.remove('shake'), 500);
  }
  const pointsEl = $(`p${i + 1}points`);
  if (pointsEl) {
    pointsEl.classList.remove('points-hit'); void pointsEl.offsetWidth; pointsEl.classList.add('points-hit');
    setTimeout(() => pointsEl.classList.remove('points-hit'), 600);
  }
  arcadeSound('hit');
  vibrate(60);
}
if (![0, 1].includes(me)) me = null;
const fmt = s => [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(x => String(x).padStart(2, '0')).join(':');
const fmtLength = s => `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`;
function toast(t) { $('toast').textContent = t; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 2800); }
function getAudio() { if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); return audioContext; }
function beep(freq, duration = .09, type = 'square', delay = 0, volume = .06) { if (!soundOn) return; const ctx = getAudio(), osc = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + delay; osc.type = type; osc.frequency.setValueAtTime(freq, start); gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + duration); osc.connect(gain).connect(ctx.destination); osc.start(start); osc.stop(start + duration + .02); }
function arcadeSound(kind) {
  if (!soundOn) return;
  if (kind === 'click') return beep(460, .045, 'square', 0, .035);
  if (kind === 'count') { beep(530, .13, 'square', 0, .06); return beep(790, .06, 'square', .07, .04); }
  if (kind === 'fight') { beep(310, .11, 'sawtooth', 0, .075); beep(520, .11, 'sawtooth', .1, .075); return beep(830, .22, 'square', .2, .08); }
  if (kind === 'finish') { beep(740, .14, 'square', 0, .07); beep(940, .14, 'square', .15, .07); beep(1240, .3, 'square', .3, .08); }
  if (kind === 'hit') { beep(180, .12, 'sawtooth', 0, .08); return beep(90, .18, 'square', .05, .07); }
  if (kind === 'join') { beep(420, .08, 'square', 0, .05); return beep(680, .1, 'square', .08, .05); }
  if (kind === 'set') return beep(560, .07, 'triangle', 0, .05);
  if (kind === 'task') return beep(880, .06, 'square', 0, .04);
  if (kind === 'check') { beep(700, .05, 'square', 0, .045); return beep(1050, .08, 'square', .05, .045); }
  if (kind === 'reset') { beep(500, .09, 'sawtooth', 0, .06); return beep(260, .16, 'sawtooth', .08, .06); }
  if (kind === 'copy') return beep(950, .07, 'triangle', 0, .045);
  if (kind === 'music') { beep(392, .09, 'triangle', 0, .05); beep(494, .09, 'triangle', .07, .05); return beep(587, .12, 'triangle', .14, .05); }
  if (kind === 'welcome') { beep(392, .12, 'triangle', 0, .06); beep(523, .12, 'triangle', .1, .06); return beep(659, .2, 'triangle', .2, .07); }
  if (kind === 'victory') { beep(523, .12, 'square', 0, .07); beep(659, .12, 'square', .1, .07); beep(784, .12, 'square', .2, .07); return beep(1047, .3, 'square', .3, .08); }
  if (kind === 'reminder') { beep(660, .16, 'sine', 0, .05); return beep(880, .22, 'sine', .18, .05); }
}
let notifyOn = storageGet('study-rival-notify') === 'on';
function updateNotifyButton() { $('notifyToggle').textContent = notifyOn ? '🔔 Notify: On' : '🔔 Notify: Off'; }
async function toggleNotify() {
  if (!('Notification' in window)) { toast('Notifications are not supported in this browser.'); return; }
  if (!notifyOn) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications were blocked - enable them in your browser settings to use this.'); return; }
    notifyOn = true;
    toast('Notifications on - you\'ll get alerts even if you switch tabs.');
  } else {
    notifyOn = false;
    toast('Notifications off.');
  }
  storageSet('study-rival-notify', notifyOn ? 'on' : 'off');
  updateNotifyButton();
}
function notify(title, body) {
  if (!notifyOn || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!document.hidden) return; // don't duplicate what's already visible on-screen
  try { new Notification(title, { body, icon: 'icon-192.png' }); } catch { /* ignore */ }
}
function vibrate(pattern) { if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } } }
function toggleSound() { soundOn = !soundOn; storageSet('study-rival-sound', soundOn ? 'on' : 'off'); if (soundOn) { getAudio(); arcadeSound('fight'); } if (state) render(); }

let welcomeChecked = false;
let appliedVersion = -1;
async function load() {
  try {
    const r = await fetch(`/api/state?room=${encodeURIComponent(room)}`);
    const data = await r.json();
    if (data.version !== 0 && data.version < appliedVersion) return; // a newer response already landed; ignore this stale one (version 0 always means a fresh reset, so let that through)
    appliedVersion = data.version;
    state = data;
    render();
    if (!welcomeChecked) { welcomeChecked = true; maybeShowWelcome(); }
  } catch { toast('Could not reach the shared timer server.'); }
}
async function act(action, extra = {}) {
  if (me === null) return toast('Join a team first.');
  const r = await fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room, player: me, memberId, action, version: state.version, ...extra }) });
  const out = await r.json();
  if (!r.ok) {
    if (out.error && out.error.startsWith('This seat belongs to someone else')) {
      me = null;
      storageSet(`study-rival-seat-${room}`, '');
      toast('Your session was reset (the server restarted). Please rejoin your team below.');
      return load();
    }
    return toast(out.error);
  }
  state = out;
  appliedVersion = out.version;
  render();
}
function buildAvatarRow() {
  $('avatarRow').innerHTML = AVATARS.map(a => `<button type="button" class="avatar-btn ${a === selectedAvatar ? 'selected' : ''}" ${me !== null ? 'disabled' : ''} onclick="pickAvatar('${a}')" title="${AVATAR_ICONS[a].label}"><img src="${AVATAR_ICONS[a].file}" alt="${AVATAR_ICONS[a].label}" loading="lazy"></button>`).join('');
}
function pickAvatar(a) {
  selectedAvatar = a;
  storageSet('study-rival-avatar', a);
  arcadeSound('click');
  buildAvatarRow();
}
function join(player) {
  if (me !== null && me !== player) return toast('Your team is locked for this session.');
  const name = $('name').value.trim() || `Player ${player + 1}`;
  fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room, player, memberId, action: 'join', name, emoji: selectedAvatar, version: state.version }) })
    .then(r => r.json().then(x => ({ r, x }))).then(({ r, x }) => {
      if (!r.ok) return toast(x.error);
      me = player;
      storageSet(`study-rival-seat-${room}`, player);
      state = x;
      arcadeSound('join');
      render();
      toast(`You joined Team ${player + 1}. Your team is now locked.`);
      maybeShowWelcome();
    });
}
function setPreset(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  $('hours').value = h; $('minutes').value = m;
  arcadeSound('set');
  act('setDuration', { hours: h, minutes: m });
}
function setTime() {
  const hours = Number($('hours').value || 0);
  const minutes = Number($('minutes').value || 0);
  arcadeSound('set');
  act('setDuration', { hours, minutes });
}
function askPause() { if (me === null) return toast('Join first.'); $('pauseDialog').showModal(); }
function confirmPause(e) { const reason = $('reason').value; if (!reason.trim()) { e.preventDefault(); return toast('Please describe the pause.'); } act('pause', { reason }); $('reason').value = ''; }
function addTask(player) { if (player !== me) return toast('You can only add tasks to your own team.'); const box = $(`task${player}`); arcadeSound('task'); act('task', { text: box.value }); box.value = ''; }
function toggleTask(player, id) { if (player !== me) return toast('You can only update your own tasks.'); arcadeSound('check'); act('toggleTask', { id }); }
function resetSession() { if (confirm('Reset the timer, penalties, tasks, and log for everyone? Teams will remain locked.')) { arcadeSound('reset'); act('reset', { confirm: 'RESET' }); } }

function updateLive() {
  if (!state) return;
  $('clock').textContent = fmt(state.remaining);
  $('progress').style.width = `${100 - (state.remaining / state.duration * 100)}%`;
  const countdown = $('countdown');
  if (state.countdownUntil) {
    const left = state.countdownUntil - Date.now();
    const cue = left > 900 ? String(Math.max(1, Math.ceil((left - 900) / 1000))) : 'FIGHT!';
    countdown.textContent = cue;
    countdown.classList.add('show');
    if (cue !== lastCountdownCue) {
      arcadeSound(cue === 'FIGHT!' ? 'fight' : 'count');
      if (cue === 'FIGHT!') { notify('Focus time! 🥊', 'The session just started.'); vibrate([80, 40, 80]); }
    }
    lastCountdownCue = cue;
  } else {
    countdown.classList.remove('show');
    lastCountdownCue = '';
  }
  if (state.hasStarted && !state.running && !state.countdownUntil && state.remaining === 0 && !finishedSoundPlayed) { arcadeSound('finish'); finishedSoundPlayed = true; showCompleteRecap(); }
  if (state.remaining > 0) { finishedSoundPlayed = false; recapShown = false; }
  updateCombo();
  checkWellnessReminder();
}
const WELLNESS_TIPS = [
  { icon: '💧', text: "Drink some water — you've earned it." },
  { icon: '🧍', text: 'Stand up and stretch for a few seconds.' },
  { icon: '👀', text: 'Look at something 20 feet away for 20 seconds — rest your eyes.' },
  { icon: '🌬️', text: 'Take three slow, deep breaths.' },
  { icon: '🪑', text: 'Check your posture and roll your shoulders back.' },
  { icon: '🙌', text: "Nice focus streak — shake out your hands and wrists." },
];
let reminderTimeout = null;
function showReminder(tip) {
  $('reminderIcon').textContent = tip.icon;
  $('reminderText').textContent = tip.text;
  $('reminderOverlay').classList.add('show');
  arcadeSound('reminder');
  notify(`${tip.icon} Quick break`, tip.text);
  vibrate([50, 40, 50, 40, 90]);
  clearTimeout(reminderTimeout);
  reminderTimeout = setTimeout(dismissReminder, 9000);
}
function dismissReminder() {
  $('reminderOverlay').classList.remove('show');
  clearTimeout(reminderTimeout);
}
let lastReminderMark = 0;
function checkWellnessReminder() {
  if (!state.hasStarted) { lastReminderMark = 0; return; }
  const totalElapsed = state.duration - state.remaining;
  const mark = Math.floor(totalElapsed / 1800); // every 30 minutes of actual focus time
  if (mark > lastReminderMark) {
    lastReminderMark = mark;
    showReminder(WELLNESS_TIPS[Math.floor(Math.random() * WELLNESS_TIPS.length)]);
  }
}
function updateCombo() {
  const totalElapsed = state.duration - state.remaining;
  const lastPauseElapsed = state.pauses.length ? state.pauses[0].elapsedAtPause : 0;
  const comboSeconds = Math.max(0, totalElapsed - lastPauseElapsed);
  const target = Math.min(state.duration, 900); // bar reads "full" at 15 clean minutes
  const pct = target ? Math.min(100, (comboSeconds / target) * 100) : 0;
  $('comboTime').textContent = `${fmt(comboSeconds).replace(/^00:/, '')} clean`;
  $('comboFill').style.width = `${pct}%`;
  $('comboBar').classList.toggle('maxed', pct >= 100 && state.running);
}
const WIN_BONUS = 20;
function updateCareerBadge() {
  const total = Number(storageGet('study-rival-total-score') || 0);
  const el = $('careerScore');
  if (el) el.textContent = `🏅 Your career score: ${total}`;
  const sessions = Number(storageGet('study-rival-sessions-completed') || 0);
  const sEl = $('sessionsBadge');
  if (sEl) sEl.textContent = `🔥 ${sessions} session${sessions === 1 ? '' : 's'} completed`;
}
function spawnConfetti() {
  const layer = $('confettiLayer');
  if (!layer) return;
  layer.innerHTML = '';
  const colors = ['#6f4e37', '#c97b52', '#7a8f4c', '#e8b94f', '#c9634f'];
  for (let n = 0; n < 32; n++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = colors[n % colors.length];
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(el);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 2200);
}
let recapShown = false;
const ACHIEVEMENTS = [
  { id: 'first', icon: '🎯', label: 'First Focus', check: (p, dur, isFirstEver) => isFirstEver },
  { id: 'clean', icon: '🧘', label: 'Clean Sweep', check: p => p.points === 0 },
  { id: 'tasks', icon: '✅', label: 'Task Master', check: (p, dur, first, tasks) => tasks.length > 0 && tasks.every(t => t.done) },
  { id: 'marathon', icon: '🏃', label: 'Marathon', check: (p, dur) => dur >= 7200 },
  { id: 'veteran', icon: '🏆', label: 'Veteran (5+ sessions)', check: (p, dur, first, tasks, totalCompleted) => totalCompleted >= 5 },
];
function showCompleteRecap() {
  if (recapShown) return;
  recapShown = true;
  $('recapDuration').textContent = fmtLength(state.duration);
  $('recapPauses').textContent = state.pauses.length;
  state.players.forEach((p, i) => {
    $(`recapP${i + 1}Name`).textContent = p.name;
    $(`recapP${i + 1}Points`).textContent = p.points ? -p.points : 0;
    const done = state.tasks[i].filter(t => t.done).length;
    $(`recapP${i + 1}Tasks`).textContent = `${done}/${state.tasks[i].length}`;
  });
  // MVP: fewer pauses (points) wins; tie-break on task completion ratio
  const ratio = i => state.tasks[i].length ? state.tasks[i].filter(t => t.done).length / state.tasks[i].length : 0;
  $('recapTeam1').classList.remove('mvp'); $('recapTeam2').classList.remove('mvp');
  document.querySelectorAll('.mvp-tag').forEach(el => el.remove());
  let mvp = null;
  if (state.players[0].points !== state.players[1].points) mvp = state.players[0].points < state.players[1].points ? 0 : 1;
  else if (ratio(0) !== ratio(1)) mvp = ratio(0) > ratio(1) ? 0 : 1;
  if (mvp !== null) {
    $(`recapTeam${mvp + 1}`).classList.add('mvp');
    $(`recapP${mvp + 1}Name`).insertAdjacentHTML('afterend', '<span class="mvp-tag">👑 MVP</span>');
  }
  const winBanner = $('winBanner');
  if (mvp !== null) {
    winBanner.hidden = false;
    const icon = AVATAR_ICONS[state.players[mvp].emoji];
    winBanner.innerHTML = `🏆 ${icon ? `<span class="win-avatar"><img src="${icon.file}" alt=""></span>` : ''} ${escapeHtml(state.players[mvp].name)} WINS!`;
    arcadeSound('victory');
    spawnConfetti();
    vibrate([100, 60, 100, 60, 200]);
    notify('🏆 Session complete!', `${state.players[mvp].name} wins this round.`);
  } else {
    winBanner.hidden = false;
    winBanner.textContent = "🤝 Dead even — no clear winner!";
    vibrate(150);
    notify('Session complete!', 'Dead even — no clear winner this round.');
  }
  // Persistent career score: +WIN_BONUS if you were MVP, minus your pauses this session
  if (me !== null) {
    const delta = (mvp === me ? WIN_BONUS : 0) - state.players[me].points;
    const prevTotal = Number(storageGet('study-rival-total-score') || 0);
    const newTotal = prevTotal + delta;
    storageSet('study-rival-total-score', newTotal);
    $('careerDelta').textContent = `${delta >= 0 ? '+' : ''}${delta} this session → 🏅 Career score: ${newTotal}`;
    updateCareerBadge();
  } else {
    $('careerDelta').textContent = '';
  }
  // Achievements, evaluated for "me" (the viewer) and persisted per-browser
  if (me !== null) {
    const totalCompleted = Number(storageGet('study-rival-sessions-completed') || 0) + 1;
    storageSet('study-rival-sessions-completed', totalCompleted);
    const isFirstEver = totalCompleted === 1;
    const unlockedBefore = JSON.parse(storageGet('study-rival-achievements') || '[]');
    const earnedNow = ACHIEVEMENTS.filter(a => a.check(state.players[me], state.duration, isFirstEver, state.tasks[me], totalCompleted));
    const unlockedAfter = Array.from(new Set([...unlockedBefore, ...earnedNow.map(a => a.id)]));
    storageSet('study-rival-achievements', JSON.stringify(unlockedAfter));
    if (earnedNow.length) {
      $('achievementsBox').hidden = false;
      $('achievementsList').innerHTML = earnedNow.map(a => {
        const isNew = !unlockedBefore.includes(a.id);
        return `<div class="ach-chip ${isNew ? 'new' : ''}"><span class="ach-icon">${a.icon}</span>${a.label}${isNew ? '<span class="new-tag">NEW</span>' : ''}</div>`;
      }).join('');
    } else {
      $('achievementsBox').hidden = true;
    }
  } else {
    $('achievementsBox').hidden = true;
  }
  $('completeDialog').showModal();
}
function closeComplete() { $('completeDialog').close(); recapShown = false; resetSession(); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
async function loadImg(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function drawCircleImg(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else { ctx.fillStyle = '#e4d6c3'; ctx.fill(); }
  ctx.restore();
}
async function downloadRecapImage() {
  try { await document.fonts.ready; } catch { /* ignore */ }
  const W = 700, H = 480;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#faf3e8'); grad.addColorStop(1, '#f6ece0');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e4d6c3'; ctx.lineWidth = 2; roundRect(ctx, 8, 8, W - 16, H - 16, 16); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#3b2a1e';
  ctx.font = "700 32px Fraunces, Georgia, serif";
  ctx.fillText('Study Rival', W / 2, 54);
  ctx.font = "700 11px Inter, sans-serif";
  ctx.fillStyle = '#9c8873';
  ctx.fillText('SESSION COMPLETE', W / 2, 74);

  const ratio = i => state.tasks[i].length ? state.tasks[i].filter(t => t.done).length / state.tasks[i].length : 0;
  let mvp = null;
  if (state.players[0].points !== state.players[1].points) mvp = state.players[0].points < state.players[1].points ? 0 : 1;
  else if (ratio(0) !== ratio(1)) mvp = ratio(0) > ratio(1) ? 0 : 1;

  ctx.font = "italic 700 23px Fraunces, Georgia, serif";
  ctx.fillStyle = '#3b2a1e';
  ctx.fillText(mvp !== null ? `\uD83C\uDFC6 ${state.players[mvp].name} wins!` : '\uD83E\uDD1D Dead even!', W / 2, 108);

  ctx.font = "700 11px Inter, sans-serif"; ctx.fillStyle = '#9c8873';
  ctx.fillText('FOCUSED FOR', W / 2 - 110, 138);
  ctx.fillText('TOTAL PAUSES', W / 2 + 110, 138);
  ctx.font = "700 22px Fraunces, Georgia, serif"; ctx.fillStyle = '#3b2a1e';
  ctx.fillText(fmtLength(state.duration), W / 2 - 110, 162);
  ctx.fillText(String(state.pauses.length), W / 2 + 110, 162);

  const [img0, img1] = await Promise.all([
    state.players[0].emoji && AVATAR_ICONS[state.players[0].emoji] ? loadImg(AVATAR_ICONS[state.players[0].emoji].file) : null,
    state.players[1].emoji && AVATAR_ICONS[state.players[1].emoji] ? loadImg(AVATAR_ICONS[state.players[1].emoji].file) : null,
  ]);

  [0, 1].forEach((i, idx) => {
    const x = idx === 0 ? 30 : W / 2 + 10;
    const cardW = W / 2 - 40;
    const isMvp = i === mvp;
    ctx.fillStyle = isMvp ? '#fff6e0' : '#faf3e8';
    ctx.strokeStyle = isMvp ? '#e8b94f' : '#e4d6c3';
    ctx.lineWidth = isMvp ? 2 : 1;
    roundRect(ctx, x, 190, cardW, 220, 14); ctx.fill(); ctx.stroke();
    const cx = x + cardW / 2;
    drawCircleImg(ctx, idx === 0 ? img0 : img1, cx, 250, 34);
    ctx.strokeStyle = isMvp ? '#e8b94f' : (idx === 0 ? '#6f4e37' : '#c97b52');
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, 250, 36, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3b2a1e';
    ctx.font = "700 17px Fraunces, Georgia, serif";
    ctx.fillText(state.players[i].name + (isMvp ? ' \uD83D\uDC51' : ''), cx, 310);
    ctx.font = "700 22px Inter, sans-serif"; ctx.fillStyle = '#c97b52';
    ctx.fillText(`${state.players[i].points ? -state.players[i].points : 0} pts`, cx, 340);
    const done = state.tasks[i].filter(t => t.done).length;
    ctx.font = "600 12px Inter, sans-serif"; ctx.fillStyle = '#8a7361';
    ctx.fillText(`${done}/${state.tasks[i].length} tasks completed`, cx, 362);
  });

  ctx.font = "500 11px Inter, sans-serif"; ctx.fillStyle = '#a8927c';
  ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), W / 2, H - 22);

  const link = document.createElement('a');
  link.download = `study-rival-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  arcadeSound('copy');
}
function render() {
  if (!state) return;
  updateLive();
  const isCounting = Boolean(state.countdownUntil);
  $('status').textContent = isCounting ? 'GET READY' : state.running ? 'FOCUS IN PROGRESS' : state.pausedBy !== null ? 'TIMER PAUSED' : 'READY TO FOCUS';
  $('substatus').textContent = isCounting ? '3 - 2 - 1 - FIGHT!' : state.running ? 'Pure-focus time only' : `Shared timer - ${fmtLength(state.duration)}`;
  if (!timeEditing) { $('hours').value = Math.floor(state.duration / 3600); $('minutes').value = Math.floor(state.duration % 3600 / 60); }
  const timeLocked = state.hasStarted || state.running || isCounting || me === null;
  ['hours', 'minutes', 'setTime', 'preset25', 'preset50', 'preset90', 'preset120'].forEach(id => $(id).disabled = timeLocked);
  $('timeNote').textContent = state.hasStarted ? 'Time is locked while this session is active.' : me === null ? 'Join a team to set the shared time.' : 'Either rival can choose the time before starting.';
  state.players.forEach((p, i) => {
    $(`p${i + 1}name`).textContent = p.name;
    $(`p${i + 1}emoji`).innerHTML = (p.emoji && AVATAR_ICONS[p.emoji]) ? `<img src="${AVATAR_ICONS[p.emoji].file}" alt="">` : (i === 0 ? 'P1' : 'P2');
    if (prevPoints[i] !== null && p.points > prevPoints[i]) spawnDamage(i, p.points - prevPoints[i]);
    prevPoints[i] = p.points;
    $(`p${i + 1}points`).textContent = p.points ? -p.points : 0;
    const done = state.tasks[i].filter(t => t.done).length;
    $(`p${i + 1}done`).textContent = done;
    $(`p${i + 1}total`).textContent = state.tasks[i].length;
    const canEdit = me === i;
    $(`task${i}`).disabled = !canEdit;
    $(`add${i}`).disabled = !canEdit;
    $(`tasks${i}`).innerHTML = state.tasks[i].map(t => `<li class="task ${t.done ? 'done' : ''}"><input type="checkbox" ${t.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'} onchange="toggleTask(${i},'${t.id}')"><span>${escapeHtml(t.text)}</span></li>`).join('') || '<li class="task"><span>No tasks yet.</span></li>';
  });
  $('owner').textContent = state.pausedBy !== null && !state.running ? `Paused by ${state.players[state.pausedBy].name}. Only they can resume.` : '';
  if (state.pausedBy !== null && state.pausedBy !== prevPausedBy && state.pausedBy !== me) {
    notify('⏸️ Timer paused', `${state.players[state.pausedBy].name} paused the session.`);
  }
  prevPausedBy = state.pausedBy;
  $('start').textContent = isCounting ? 'Get ready...' : state.running ? 'Focusing...' : state.pausedBy !== null ? 'Resume focus' : 'Start focus';
  $('start').disabled = state.running || isCounting || me === null || (state.pausedBy !== null && state.pausedBy !== me);
  $('pause').disabled = !state.running || me === null;
  $('soundToggle').textContent = soundOn ? 'Sound: On' : 'Sound: Off';
  $('pauseLog').innerHTML = state.pauses.map(p => `<li><b>${escapeHtml(p.by)}</b> - ${escapeHtml(p.reason)} <small>(${new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</small></li>`).join('') || '<li>No pauses yet. Keep the protocol clean.</li>';
  $('joinP1').disabled = me !== null || state.players[0].joined;
  $('joinP2').disabled = me !== null || state.players[1].joined;
  $('name').disabled = me !== null;
  $('joinHelp').textContent = me !== null ? `You are locked into Team ${me + 1} for this session.` : 'Choose your team carefully - it stays locked for the session.';
  renderSpotify();
  renderNote();
  buildAvatarRow();
  updateCareerBadge();
  updateNotifyButton();
  document.body.classList.toggle('focus-mode', state.running);
}
function escapeHtml(x) { const d = document.createElement('div'); d.textContent = x; return d.innerHTML; }
function setPlaylist() {
  const raw = $('spotifyUrl').value.trim();
  if (raw && !/^https:\/\/(open\.spotify\.com|spotify\.link)\//i.test(raw)) {
    return toast('Paste a link that starts with open.spotify.com or spotify.link.');
  }
  arcadeSound('music');
  act('setPlaylist', { url: raw });
}
let lastRenderedSpotifyUrl = undefined;
function renderSpotify() {
  const url = state.spotifyUrl;
  if (url === lastRenderedSpotifyUrl) return;
  lastRenderedSpotifyUrl = url;
  $('spotifyUrl').value = url || '';
  if (!url) {
    $('spotifyFrame').hidden = true;
    $('spotifyFrame').removeAttribute('src');
    $('spotifyOpenRow').hidden = true;
    $('playlistNote').textContent = 'For real synced audio: start a Jam in the Spotify app on your phone, then paste the invite link here so your rival can tap in.';
    return;
  }
  const match = url.match(/spotify\.com\/(playlist|album|track|episode|show)\/([A-Za-z0-9]+)/);
  $('spotifyOpenLink').href = url;
  if (match) {
    $('spotifyFrame').src = `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`;
    $('spotifyFrame').hidden = false;
    $('spotifyOpenRow').hidden = true;
    $('playlistNote').textContent = `Set by ${escapeHtml(state.spotifySetBy || 'a rival')} - both browsers preview this below.`;
  } else {
    $('spotifyFrame').hidden = true;
    $('spotifyFrame').removeAttribute('src');
    $('spotifyOpenRow').hidden = false;
    $('playlistNote').textContent = `${escapeHtml(state.spotifySetBy || 'A rival')} shared a Jam link - tap "Open in Spotify" on both phones to join the same live session.`;
  }
}
function renderNote() {
  if (!noteEditing) $('noteText').value = state.note || '';
  if (state.note) {
    $('quoteText').textContent = state.note;
    $('quoteDisplay').querySelector('.quote-attr')?.remove();
    if (state.noteSetBy) $('quoteDisplay').insertAdjacentHTML('beforeend', `<span class="quote-attr">— ${escapeHtml(state.noteSetBy)}</span>`);
  } else {
    $('quoteText').textContent = me === null ? 'Join a team, then write something here for both of you to see.' : 'No note yet — write one below, or roll a random quote.';
    $('quoteDisplay').querySelector('.quote-attr')?.remove();
  }
  $('noteMeta').textContent = state.noteSetBy ? `Last set by ${state.noteSetBy}` : me === null ? 'Join a team to write a shared note.' : 'Write something for both of you to see.';
}
function saveNote() {
  if (me === null) return toast('Join a team first.');
  arcadeSound('music');
  act('setNote', { text: $('noteText').value });
}
function randomQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  $('noteText').value = q;
  $('noteText').focus();
  noteEditing = true;
  arcadeSound('click');
  toast('Rolled a quote - click "Save for both" to share it.');
}
function maybeShowWelcome() {
  const key = `study-rival-welcomed-${room}`;
  if (storageGet(key)) return;
  $('welcomeDialog').showModal();
  arcadeSound('welcome');
  storageSet(key, '1');
}
function closeWelcome() { $('welcomeDialog').close(); arcadeSound('click'); }
function copyLog() { const text = state.pauses.length ? state.pauses.slice().reverse().map(p => `${new Date(p.at).toLocaleString()} - ${p.by}: ${p.reason}`).join('\n') : 'No pauses logged.'; navigator.clipboard.writeText(`Study Rival pause log\n${text}`); toast('Pause log copied.'); }
function copyInviteLink() { navigator.clipboard.writeText(location.href); arcadeSound('copy'); toast('Invite link copied - send it to your rival.'); }
document.addEventListener('click', e => { if (e.target.closest('button') && e.target.id !== 'soundToggle') arcadeSound('click'); });
setInterval(load, 1200);
setInterval(updateLive, 150);
load();
