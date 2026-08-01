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
let me = Number(storageGet(`study-rival-seat-${room}`));
var timeEditing = false;
let soundOn = storageGet('study-rival-sound') !== 'off';
let audioContext = null;
let lastCountdownCue = '';
let finishedSoundPlayed = false;
let prevPoints = [null, null];

function spawnDamage(i, amount) {
  const badge = $(`p${i + 1}badge`);
  if (badge) {
    const el = document.createElement('div');
    el.className = 'damage-pop';
    el.textContent = `+${amount}`;
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
}
function toggleSound() { soundOn = !soundOn; storageSet('study-rival-sound', soundOn ? 'on' : 'off'); if (soundOn) { getAudio(); arcadeSound('fight'); } if (state) render(); }

let welcomeChecked = false;
async function load() {
  try {
    const r = await fetch(`/api/state?room=${encodeURIComponent(room)}`);
    state = await r.json();
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
  render();
}
function join(player) {
  if (me !== null && me !== player) return toast('Your team is locked for this session.');
  const name = $('name').value.trim() || `Player ${player + 1}`;
  fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room, player, memberId, action: 'join', name, version: state.version }) })
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
    if (cue !== lastCountdownCue) arcadeSound(cue === 'FIGHT!' ? 'fight' : 'count');
    lastCountdownCue = cue;
  } else {
    countdown.classList.remove('show');
    lastCountdownCue = '';
  }
  if (state.hasStarted && !state.running && !state.countdownUntil && state.remaining === 0 && !finishedSoundPlayed) { arcadeSound('finish'); finishedSoundPlayed = true; showCompleteRecap(); }
  if (state.remaining > 0) { finishedSoundPlayed = false; recapShown = false; }
}
let recapShown = false;
function showCompleteRecap() {
  if (recapShown) return;
  recapShown = true;
  $('recapDuration').textContent = fmtLength(state.duration);
  $('recapPauses').textContent = state.pauses.length;
  state.players.forEach((p, i) => {
    $(`recapP${i + 1}Name`).textContent = p.name;
    $(`recapP${i + 1}Points`).textContent = p.points;
    const done = state.tasks[i].filter(t => t.done).length;
    $(`recapP${i + 1}Tasks`).textContent = `${done}/${state.tasks[i].length}`;
  });
  $('completeDialog').showModal();
}
function closeComplete() { $('completeDialog').close(); recapShown = false; resetSession(); }
function render() {
  if (!state) return;
  updateLive();
  const isCounting = Boolean(state.countdownUntil);
  $('status').textContent = isCounting ? 'GET READY' : state.running ? 'FOCUS IN PROGRESS' : state.pausedBy !== null ? 'TIMER PAUSED' : 'READY TO FOCUS';
  $('substatus').textContent = isCounting ? '3 - 2 - 1 - FIGHT!' : state.running ? 'Pure-focus time only' : `Shared timer - ${fmtLength(state.duration)}`;
  if (!timeEditing) { $('hours').value = Math.floor(state.duration / 3600); $('minutes').value = Math.floor(state.duration % 3600 / 60); }
  const timeLocked = state.hasStarted || state.running || isCounting || me === null;
  ['hours', 'minutes', 'setTime'].forEach(id => $(id).disabled = timeLocked);
  $('timeNote').textContent = state.hasStarted ? 'Time is locked while this session is active.' : me === null ? 'Join a team to set the shared time.' : 'Either rival can choose the time before starting.';
  state.players.forEach((p, i) => {
    $(`p${i + 1}name`).textContent = p.name;
    if (prevPoints[i] !== null && p.points > prevPoints[i]) spawnDamage(i, p.points - prevPoints[i]);
    prevPoints[i] = p.points;
    $(`p${i + 1}points`).textContent = p.points;
    const done = state.tasks[i].filter(t => t.done).length;
    $(`p${i + 1}done`).textContent = done;
    $(`p${i + 1}total`).textContent = state.tasks[i].length;
    const canEdit = me === i;
    $(`task${i}`).disabled = !canEdit;
    $(`add${i}`).disabled = !canEdit;
    $(`tasks${i}`).innerHTML = state.tasks[i].map(t => `<li class="task ${t.done ? 'done' : ''}"><input type="checkbox" ${t.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'} onchange="toggleTask(${i},'${t.id}')"><span>${escapeHtml(t.text)}</span></li>`).join('') || '<li class="task"><span>No tasks yet.</span></li>';
  });
  $('owner').textContent = state.pausedBy !== null && !state.running ? `Paused by ${state.players[state.pausedBy].name}. Only they can resume.` : '';
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
