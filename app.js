const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = __dirname;
const sessions = new Map();
const AVATARS = ['🦁', '🐯', '🦊', '🐺', '🦉', '🐢', '🐉', '🦅', '🐻', '🦈'];

function freshSession(lockedPlayers) {
  return {
    duration: 2 * 60 * 60,
    remaining: 2 * 60 * 60,
    running: false,
    hasStarted: false,
    countdownUntil: null,
    pausedBy: null,
    players: lockedPlayers || [
      { name: 'Player 1', points: 0, joined: false, memberId: null, emoji: null },
      { name: 'Player 2', points: 0, joined: false, memberId: null, emoji: null }
    ],
    tasks: [[], []],
    pauses: [],
    spotifyUrl: null,
    spotifySetBy: null,
    note: '',
    noteSetBy: null,
    version: 0,
    lastTick: Date.now()
  };
}

function session(room) {
  if (!sessions.has(room)) sessions.set(room, freshSession());
  const s = sessions.get(room);
  const now = Date.now();
  if (s.countdownUntil && now >= s.countdownUntil) {
    s.countdownUntil = null;
    s.running = true;
    s.hasStarted = true;
    s.lastTick = now;
    s.version++;
  }
  if (s.running) {
    const elapsed = Math.floor((now - s.lastTick) / 1000);
    if (elapsed) {
      s.remaining = Math.max(0, s.remaining - elapsed);
      s.lastTick += elapsed * 1000;
      if (!s.remaining) s.running = false;
    }
  }
  return s;
}

function publicState(s) {
  return {
    duration: s.duration, remaining: s.remaining, running: s.running,
    hasStarted: s.hasStarted, countdownUntil: s.countdownUntil, pausedBy: s.pausedBy,
    players: s.players.map(({ name, points, joined, emoji }) => ({ name, points, joined, emoji })),
    tasks: s.tasks, pauses: s.pauses,
    spotifyUrl: s.spotifyUrl, spotifySetBy: s.spotifySetBy,
    note: s.note, noteSetBy: s.noteSetBy,
    version: s.version
  };
}

function assertMember(s, player, memberId) {
  if (!memberId || s.players[player].memberId !== memberId) {
    throw Error('This seat belongs to someone else. Join an available team first.');
  }
}

function respond(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/state' && req.method === 'GET') {
    return respond(res, 200, publicState(session(url.searchParams.get('room') || 'demo')));
  }
  if (url.pathname === '/api/action' && req.method === 'POST') {
    let raw = '';
    req.on('data', d => raw += d);
    return req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}');
        const room = String(body.room || 'demo').slice(0, 60);
        const s = session(room);
        const player = Number(body.player);
        const action = body.action;
        const memberId = String(body.memberId || '').slice(0, 80);
        if (![0, 1].includes(player)) throw Error('Choose Player 1 or Player 2 first.');
        if (body.version !== s.version) throw Error('This session changed - please try again.');

        if (action === 'join') {
          if (!memberId) throw Error('Could not identify this browser. Refresh and try again.');
          const alreadySeated = s.players.findIndex(p => p.memberId === memberId);
          if (alreadySeated !== -1 && alreadySeated !== player) {
            throw Error('This browser already joined the other team in this room. Each browser can only be on one team — open the link on a different browser or device to join the other team.');
          }
          if (s.players[player].joined && s.players[player].memberId !== memberId) {
            throw Error(`${s.players[player].name} already claimed this team here. Join the other team, or pick a new room name.`);
          }
          s.players[player].name = String(body.name || `Player ${player + 1}`).trim().slice(0, 24) || `Player ${player + 1}`;
          s.players[player].joined = true;
          s.players[player].memberId = memberId;
          s.players[player].emoji = AVATARS.includes(body.emoji) ? body.emoji : AVATARS[player];
        } else {
          assertMember(s, player, memberId);
          if (action === 'setDuration') {
            if (s.hasStarted || s.running || s.countdownUntil) throw Error('The session time is locked after the timer begins. Reset to choose a new time.');
            const hours = Number(body.hours || 0);
            const minutes = Number(body.minutes || 0);
            if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
              throw Error('Enter whole hours and minutes.');
            }
            const seconds = hours * 3600 + minutes * 60;
            if (seconds < 60 || seconds > 12 * 3600) throw Error('Choose a time between 1 minute and 12 hours.');
            s.duration = seconds;
            s.remaining = seconds;
          } else if (action === 'start') {
            if (!s.players.every(p => p.joined)) throw Error('Both rivals need to join before the timer can start.');
            if (s.running || s.countdownUntil) throw Error('The timer is already starting or running.');
            if (!s.remaining) throw Error('Choose a new session time, then start again.');
            if (s.pausedBy !== null && s.pausedBy !== player) throw Error(`Only ${s.players[s.pausedBy].name} can resume after their pause.`);
            if (!s.hasStarted) {
              s.countdownUntil = Date.now() + 3900;
            } else {
              s.running = true;
              s.lastTick = Date.now();
            }
          } else if (action === 'pause') {
            if (!s.running) throw Error('The timer is not running.');
            const reason = String(body.reason || '').trim();
            if (!reason) throw Error('Please log why you paused before stopping the timer.');
            s.running = false;
            s.pausedBy = player;
            s.players[player].points += 5;
            s.pauses.unshift({ by: s.players[player].name, reason: reason.slice(0, 180), at: new Date().toISOString(), elapsedAtPause: s.duration - s.remaining });
          } else if (action === 'task') {
            const text = String(body.text || '').trim().slice(0, 100);
            if (!text) throw Error('Write a task first.');
            s.tasks[player].push({ id: `${Date.now()}${Math.random()}`, text, done: false });
          } else if (action === 'setPlaylist') {
            const raw = String(body.url || '').trim().slice(0, 300);
            if (!raw) {
              s.spotifyUrl = null;
              s.spotifySetBy = null;
            } else {
              if (!/^https:\/\/(open\.spotify\.com|spotify\.link)\//i.test(raw)) {
                throw Error('Paste a link that starts with open.spotify.com or spotify.link.');
              }
              s.spotifyUrl = raw;
              s.spotifySetBy = s.players[player].name;
            }
          } else if (action === 'setNote') {
            s.note = String(body.text || '').trim().slice(0, 240);
            s.noteSetBy = s.note ? s.players[player].name : null;
          } else if (action === 'toggleTask') {
            const task = s.tasks[player].find(t => t.id === body.id);
            if (!task) throw Error('You can only update your own tasks.');
            task.done = !task.done;
          } else if (action === 'reset') {
            if (body.confirm !== 'RESET') throw Error('Reset confirmation required.');
            const lockedPlayers = s.players.map(p => ({ ...p, points: 0 }));
            sessions.set(room, freshSession(lockedPlayers));
            return respond(res, 200, publicState(session(room)));
          } else throw Error('Unknown action.');
        }
        s.version++;
        respond(res, 200, publicState(s));
      } catch (err) { respond(res, 400, { error: err.message }); }
    });
  }
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
  const file = path.resolve(root, requested);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(process.env.PORT || 3000, () => console.log('Study Rival ready at http://localhost:3000'));
