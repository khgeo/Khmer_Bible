/* Music player — plays the site's songs (music/playlist.json) and your own, while you read.
   • A bar at the bottom of every page (or a small pill), a "Now playing" panel with queue, playlists, search, lyrics
   • Shuffle / repeat / sleep timer, lock-screen controls (Media Session), continues when you change page
   • ♥ Favourites and your own playlists (saved on this device, included in the reading-data backup)
   • Save site songs for offline listening (Cache API) and add songs from your own phone/computer (IndexedDB) */
'use strict';

const Music = (() => {
  const KEY = 'kb-music', MYKEY = 'kb-myplaylists', AC = 'kb-music-audio', TAB = Math.random().toString(36).slice(2);
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('kb-music') : null;
  const POP = new URLSearchParams(location.search).has('pop');
  const audio = new Audio(); audio.preload = 'metadata';
  let PLS = [], SITE = [], LOCAL = [], ALL = [], BY = {}, OFF = new Set(), DL = {}, listeners = [], readyRes;
  const ready = new Promise(r => readyRes = r);
  let S = Object.assign({ id: null, t: 0, v: 0.8, mute: false, sh: false, rp: 'all', pl: '__all', q: [], playing: false, mode: 'fab', ts: 0 }, read());
  let wantResume = false, owner = false, seeking = false, sheetTab = 'now', search = '', listPl = null, lyr = null, lyrFor = null;
  let sleep = { at: 0, end: false, timer: 0, sel: '0' }, errors = 0, ui = { confirm: null, rename: null, newList: false };

  // ---------- player state ----------
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  // only the tab that is actually playing writes the position; settings are merged in with patch()
  function save() {
    if (!owner || silent) return;
    S.t = audio.currentTime || S.t || 0; S.ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  function patch(o) {
    Object.assign(S, o); const st = read(); Object.assign(st, o);
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }
  const cur = () => BY[S.id] || null;
  const url = s => /^(https?:|blob:|data:)/.test(s) || s.startsWith('//') ? s : encodeURI(s);
  const abs = s => new URL(url(s), location.href).href;
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${kmNum(Math.floor(s / 60))}:${kmNum(String(s % 60).padStart(2, '0'))}`; };
  const mb = n => kmNum((n / 1048576).toFixed(n > 1e8 ? 0 : 1)) + ' MB';
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const emit = () => listeners.forEach(f => { try { f(S, cur()); } catch (e) {} });
  const persist = () => { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} };

  // ---------- my playlists & favourites (localStorage; deleted lists stay as tombstones so a backup restore can't revive them) ----------
  const My = {
    all() { try { return JSON.parse(localStorage.getItem(MYKEY) || '{}') || {}; } catch (e) { return {}; } },
    save(a) { try { localStorage.setItem(MYKEY, JSON.stringify(a)); } catch (e) {} },
    get(id) { const l = My.all()[id]; return l && !l.del ? l : (id === 'u_fav' ? { id: 'u_fav', km: 'ចូលចិត្ត', tracks: [], ct: 0 } : null); },
    put(l) { const a = My.all(); a[l.id] = Object.assign({}, l, { t: Date.now() }); My.save(a); changed(); },
    lists() { const a = My.all(); const out = Object.values(a).filter(x => !x.del && x.id !== 'u_fav').sort((x, y) => (x.ct || 0) - (y.ct || 0)); return [My.get('u_fav'), ...out]; },
    create(name) { const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); My.put({ id, km: name.trim() || 'បញ្ជីថ្មី', tracks: [], ct: Date.now() }); return id; },
    rename(id, name) { const l = My.get(id); if (l && name.trim()) My.put(Object.assign(l, { km: name.trim() })); },
    remove(id) { if (id === 'u_fav') return; My.put({ id, del: 1 }); if (S.pl === id) S.pl = '__all'; if (listPl === id) listPl = null; },
    add(id, tid) { const l = My.get(id); if (!l) return; if (!l.tracks.includes(tid)) l.tracks.push(tid); My.put(l); },
    drop(id, tid) { const l = My.get(id); if (!l) return; l.tracks = l.tracks.filter(x => x !== tid); My.put(l); },
    move(id, tid, d) { const l = My.get(id); if (!l) return; const i = l.tracks.indexOf(tid), j = i + d; if (i < 0 || j < 0 || j >= l.tracks.length) return; [l.tracks[i], l.tracks[j]] = [l.tracks[j], l.tracks[i]]; My.put(l); },
  };
  const isFav = id => My.get('u_fav').tracks.includes(id);
  function toggleFav(id) { if (isFav(id)) { My.drop('u_fav', id); toast('បានដកចេញពីចូលចិត្ត'); } else { My.add('u_fav', id); toast('♥ បានបញ្ចូលក្នុងចូលចិត្ត'); } }

  // all lists the UI can show, in order
  function lists() {
    const L = [{ id: '__all', km: 'ចម្រៀងទាំងអស់', en: 'All songs', kind: 'all', tracks: ALL }];
    for (const l of My.lists()) L.push({ id: l.id, km: l.km, en: l.id === 'u_fav' ? 'Favourites' : 'My playlist', kind: l.id === 'u_fav' ? 'fav' : 'mine', tracks: l.tracks.map(i => BY[i]).filter(Boolean) });
    L.push({ id: '__local', km: 'ចម្រៀងនៅលើឧបករណ៍', en: 'On this device', kind: 'local', tracks: LOCAL });
    if (OFF.size) L.push({ id: '__off', km: 'ទាញយករួច', en: 'Saved for offline', kind: 'off', tracks: SITE.filter(t => OFF.has(t.id)) });
    for (const p of PLS) L.push(Object.assign({ kind: 'site' }, p));
    return L;
  }
  const listOf = id => lists().find(l => l.id === id);
  const tracksOf = id => (listOf(id) || {}).tracks || [];
  const plName = id => (listOf(id) || {}).km || '';

  // ---------- songs from your own device (IndexedDB) ----------
  const DB = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('kb-music', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('meta', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const run = (stores, mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction(stores, mode); const req = fn(t);
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
    return {
      metas: () => run('meta', 'readonly', t => t.objectStore('meta').getAll()),
      file: id => run('files', 'readonly', t => t.objectStore('files').get(id)),
      put: (m, blob) => run(['meta', 'files'], 'readwrite', t => { t.objectStore('meta').put(m); t.objectStore('files').put(blob, m.id); }),
      del: id => run(['meta', 'files'], 'readwrite', t => { t.objectStore('meta').delete(id); t.objectStore('files').delete(id); }),
    };
  })();
  const localTrack = m => ({ id: m.id, local: true, t: m.t, a: m.a, al: m.al, d: m.d, size: m.size, c: m.cover ? URL.createObjectURL(m.cover) : null });
  const nice = f => f.replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]+/, '').replace(/_/g, ' ').trim();

  // tiny ID3v2 reader: title, artist, album, cover picture
  async function readTags(file) {
    const out = {};
    try {
      const h = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33) return out;
      const ver = h[3], ss = (b, i) => (b[i] & 127) << 21 | (b[i + 1] & 127) << 14 | (b[i + 2] & 127) << 7 | (b[i + 3] & 127);
      const be = (b, i) => (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
      const size = ss(h, 6), buf = new Uint8Array(await file.slice(10, 10 + Math.min(size, 8e6)).arrayBuffer());
      const dec = (enc, b) => {
        let s;
        if (enc === 0) s = new TextDecoder('iso-8859-1').decode(b);
        else if (enc === 3) s = new TextDecoder('utf-8').decode(b);
        else { let le = enc === 1; if (b[0] === 0xFF && b[1] === 0xFE) { le = true; b = b.subarray(2); } else if (b[0] === 0xFE && b[1] === 0xFF) { le = false; b = b.subarray(2); } s = new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(b); }
        return s.replace(/\u0000.*$/s, '').trim();
      };
      let i = (h[5] & 0x40) ? (ver === 4 ? ss(buf, 0) : be(buf, 0) + 4) : 0;
      if (ver < 3) return out;
      while (i + 10 < buf.length) {
        const id = String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]); if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const fs = ver === 4 ? ss(buf, i + 4) : be(buf, i + 4), body = buf.subarray(i + 10, i + 10 + fs); i += 10 + fs;
        if (!fs) continue;
        if (id === 'TIT2') out.t = dec(body[0], body.subarray(1));
        else if (id === 'TPE1') out.a = dec(body[0], body.subarray(1));
        else if (id === 'TALB') out.al = dec(body[0], body.subarray(1));
        else if (id === 'APIC' && !out.cover) {
          const enc = body[0]; let k = 1; while (k < body.length && body[k]) k++;
          const mime = new TextDecoder('iso-8859-1').decode(body.subarray(1, k)) || 'image/jpeg'; k += 2; // skip \0 + picture type
          if (enc === 1 || enc === 2) { while (k + 1 < body.length && (body[k] || body[k + 1])) k += 2; k += 2; } else { while (k < body.length && body[k]) k++; k++; }
          out.cover = new Blob([body.slice(k)], { type: mime.includes('/') ? mime : 'image/' + mime.toLowerCase() });
        }
      }
    } catch (e) {}
    return out;
  }
  function durationOf(file) {
    return new Promise(res => {
      const a = new Audio(), u = URL.createObjectURL(file), done = d => { URL.revokeObjectURL(u); res(isFinite(d) ? Math.round(d) : 0); };
      a.preload = 'metadata'; a.onloadedmetadata = () => done(a.duration); a.onerror = () => done(0); setTimeout(() => done(0), 8000); a.src = u;
    });
  }
  async function importFiles(files) {
    persist();
    const list = [...files].filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(f.name));
    if (!list.length) { toast('សូមជ្រើសរើសឯកសារចម្រៀង (.mp3 …)'); return 0; }
    let n = 0;
    for (const f of list) {
      toast(`កំពុងបញ្ចូល ${kmNum(n + 1)}/${kmNum(list.length)} · ${f.name}`, 60000);
      try {
        const tg = await readTags(f), d = await durationOf(f);
        const m = { id: 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: tg.t || nice(f.name), a: tg.a || '', al: tg.al || '', d, size: f.size, type: f.type || 'audio/mpeg', cover: tg.cover || null, added: Date.now() };
        await DB.put(m, f); LOCAL.push(localTrack(m)); n++;
      } catch (e) { console.warn(e); toast('មិនអាចរក្សាទុក ' + f.name + ' (ទំហំផ្ទុកពេញ?)'); }
    }
    index(); changed(); toast(`បានបញ្ចូល ${kmNum(n)} បទ — ស្ដាប់បានពេលគ្មានអ៊ីនធឺណិត`);
    return n;
  }
  async function deleteLocal(id) {
    await DB.del(id).catch(() => {});
    const t = BY[id]; if (t && t.c) URL.revokeObjectURL(t.c);
    LOCAL = LOCAL.filter(x => x.id !== id);
    if (S.id === id) stop();
    index(); changed();
  }

  // ---------- save site songs for offline listening (Cache API) ----------
  async function scanOffline() {
    try { const ks = await (await caches.open(AC)).keys(), u = new Set(ks.map(r => r.url)); OFF = new Set(SITE.filter(t => u.has(abs(t.src))).map(t => t.id)); } catch (e) {}
  }
  let dlTick = 0;
  async function download(id) {
    const t = BY[id]; if (!t || t.local || OFF.has(id) || DL[id] != null || !self.caches) return;
    persist(); DL[id] = 0; changed();
    try {
      const r = await fetch(url(t.src)); if (!r.ok) throw new Error(r.status);
      const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; DL[id] = total ? got / total : 0; if (Date.now() - dlTick > 300) { dlTick = Date.now(); changed(); } }
      const blob = new Blob(parts, { type: r.headers.get('content-type') || 'audio/mpeg' }), c = await caches.open(AC);
      await c.put(abs(t.src), new Response(blob, { headers: { 'Content-Type': blob.type, 'Content-Length': String(blob.size) } }));
      const cov = coverOf(t); if (cov) c.add(abs(cov)).catch(() => {}); if (t.lyr) c.add(abs(t.lyr)).catch(() => {});
      OFF.add(id);
    } catch (e) { toast(`ទាញយក «${t.t}» មិនបាន`); }
    delete DL[id]; changed();
  }
  async function downloadMany(ids) { for (const id of ids) if (!OFF.has(id) && BY[id] && !BY[id].local) await download(id); toast('ទាញយករួចរាល់ ✓'); }
  async function removeOffline(id) { const t = BY[id]; if (!t) return; try { await (await caches.open(AC)).delete(abs(t.src)); } catch (e) {} OFF.delete(id); changed(); }
  async function storage() {
    let used = 0, quota = 0, local = LOCAL.reduce((a, t) => a + (t.size || 0), 0);
    try { const e = await navigator.storage.estimate(); used = e.usage || 0; quota = e.quota || 0; } catch (e) {}
    return { used, quota, local };
  }

  // ---------- queue & playback ----------
  function buildQueue(pl, firstId) {
    let ids = tracksOf(pl).map(t => t.id);
    if (S.sh) { ids = shuffle(ids); if (firstId) ids = [firstId, ...ids.filter(x => x !== firstId)]; }
    S.pl = pl; S.q = ids;
  }
  // a short silent sound, played straight from a tap, so the browser lets us start songs that load a moment later
  const SILENT = (() => { const n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, s) => [...s].forEach((c, i) => b[o + i] = c.charCodeAt(0));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
    let s = ''; b.forEach(x => s += String.fromCharCode(x)); return 'data:audio/wav;base64,' + btoa(s); })();
  let silent = false, unlocked = false, loadP = null, loadSeq = 0, blobURL = null;
  function setSrc(u) { if (blobURL && blobURL !== u) { URL.revokeObjectURL(blobURL); blobURL = null; } if (u.startsWith('blob:')) blobURL = u; silent = false; audio.src = u; }
  function srcFor(t) {   // a URL now, or a promise of a blob URL (on-device / offline songs)
    if (t.local) return DB.file(t.id).then(b => { if (!b) throw new Error('missing'); return URL.createObjectURL(b); });
    if (OFF.has(t.id)) return caches.open(AC).then(c => c.match(abs(t.src))).then(r => r ? r.blob().then(b => URL.createObjectURL(b)) : url(t.src)).catch(() => url(t.src));
    return url(t.src);
  }
  function load(id, at = 0) {
    const t = BY[id]; if (!t) return false;
    S.id = id; S.t = at;
    const seekTo = () => { if (at && Math.abs(audio.currentTime - at) > 1) try { audio.currentTime = at; } catch (e) {} };
    if (audio.dataset.id !== id) {
      audio.dataset.id = id; const my = ++loadSeq, s = srcFor(t);
      if (typeof s === 'string') { setSrc(s); loadP = null; }
      else loadP = s.then(u => { if (my === loadSeq) setSrc(u); }).catch(() => { if (my === loadSeq) { toast(`មិនអាចបើក «${t.t}» បានទេ`); loadP = null; } });
    }
    const whenSrc = () => audio.readyState >= 1 ? seekTo() : audio.addEventListener('loadedmetadata', seekTo, { once: true });
    loadP ? loadP.then(whenSrc) : whenSrc();
    mediaMeta(); render(); emit(); return true;
  }
  function play() {
    if (!S.id) { if (!S.q.length) buildQueue(tracksOf(S.pl).length ? S.pl : '__all'); if (!load(S.q[0])) return; }
    wantResume = false;
    if (loadP && !unlocked) { silent = true; audio.src = SILENT; audio.play().catch(() => {}); }
    const go = () => {
      const p = audio.play(); unlocked = true;
      if (p) p.then(() => { owner = true; S.playing = true; errors = 0; bc && bc.postMessage({ type: 'play', tab: TAB }); save(); render(); emit(); },
        e => { if (e.name === 'NotAllowedError') { wantResume = true; render(); } });
    };
    loadP ? loadP.then(go) : go();
    if (S.mode === 'fab') setMode('bar');
    track('music-play');
  }
  function pause(keepIntent) { audio.pause(); if (!keepIntent) S.playing = false; save(); render(); emit(); }
  function toggle() { audio.paused ? play() : pause(); }
  function step(dir, auto) {
    if (!S.q.length) buildQueue(S.pl);
    let i = S.q.indexOf(S.id);
    if (auto && S.rp === 'one') { audio.currentTime = 0; return play(); }
    if (dir < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
    i += dir;
    if (i >= S.q.length) {
      if (S.rp === 'off' && auto) { load(S.q[0]); pause(); return; }
      if (S.sh) { const last = S.id; buildQueue(S.pl); if (S.q[0] === last && S.q.length > 1) S.q.push(S.q.shift()); }
      i = 0;
    }
    if (i < 0) i = S.q.length - 1;
    if (!S.q.length) return;
    load(S.q[i]); play();
  }
  function playTrack(id, pl) {
    pl = pl || S.pl || '__all';
    if (S.pl !== pl || !S.q.includes(id)) buildQueue(pl, id);
    if (!S.q.includes(id)) S.q.unshift(id);
    load(id); play();
  }
  function playList(pl, shuffleOn) {
    if (shuffleOn != null) patch({ sh: shuffleOn });
    buildQueue(pl); if (!S.q.length) { toast('បញ្ជីនេះមិនទាន់មានបទចម្រៀងទេ'); return; }
    load(S.q[0]); play();
  }
  function playNext(id) {
    if (!S.id) return playTrack(id);
    S.q = S.q.filter(x => x !== id); S.q.splice(S.q.indexOf(S.id) + 1, 0, id); save(); toast('នឹងចាក់បន្ទាប់'); render();
  }
  function setMode(m) { patch({ mode: m }); render(); }
  function stop() { owner = true; pause(); S.id = null; audio.removeAttribute('src'); delete audio.dataset.id; audio.load(); setMode('fab'); closeSheet(); }

  // ---------- sleep timer (fades out over 8 s) ----------
  function setSleep(min) {
    clearInterval(sleep.timer); sleep = { at: 0, end: false, timer: 0, sel: String(min || 0) };
    if (min === 'end') sleep.end = true;
    else if (min) { sleep.at = Date.now() + min * 60e3; sleep.timer = setInterval(sleepTick, 1000); }
    render();
  }
  function sleepTick() {
    const left = sleep.at - Date.now();
    if (left <= 0) { clearInterval(sleep.timer); fadeOut(); sleep.at = 0; sleep.sel = '0'; }
    document.querySelectorAll('.kbm-sleepleft').forEach(x => x.textContent = sleep.at ? fmt(left / 1000) : '');
  }
  function fadeOut() {
    const v0 = audio.volume; let k = 0;
    const iv = setInterval(() => { k++; audio.volume = Math.max(0, v0 * (1 - k / 32)); if (k >= 32) { clearInterval(iv); pause(); audio.volume = v0; render(); } }, 250);
  }

  // ---------- media session (lock screen, headphones, media keys) ----------
  function mediaMeta() {
    if (!('mediaSession' in navigator)) return;
    const t = cur(); if (!t) return;
    const art = coverOf(t);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.t, artist: t.a || '', album: t.al || plName(S.pl),
        artwork: [{ src: art ? (art.startsWith('blob:') ? art : abs(art)) : abs('assets/icon-512.png'), sizes: '512x512' }] });
    } catch (e) {}
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession, h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
    h('play', play); h('pause', () => pause()); h('previoustrack', () => step(-1)); h('nexttrack', () => step(1));
    h('seekto', d => { audio.currentTime = d.seekTime; }); h('seekbackward', d => { audio.currentTime -= d.seekOffset || 10; }); h('seekforward', d => { audio.currentTime += d.seekOffset || 10; });
  }

  // ---------- audio events ----------
  let lastSave = 0;
  audio.addEventListener('timeupdate', () => {
    if (silent) return;
    if (!seeking) progress();
    if (Date.now() - lastSave > 1500) { lastSave = Date.now(); save(); }
    if (lyr && lyr.timed && sheetTab === 'lyrics') lyricTick();
    if ('mediaSession' in navigator && audio.duration && navigator.mediaSession.setPositionState)
      try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: 1 }); } catch (e) {}
  });
  audio.addEventListener('ended', () => { if (silent) return; if (sleep.end) { setSleep(0); pause(); load(S.id, 0); return; } step(1, true); });
  audio.addEventListener('play', () => { if (!silent) render(); });
  audio.addEventListener('pause', () => { if (!silent) render(); });
  audio.addEventListener('loadedmetadata', () => { if (!silent) progress(); });
  audio.addEventListener('error', () => {
    if (silent || !audio.getAttribute('src')) return;
    errors++; toast(navigator.onLine === false && !(cur() || {}).local && !OFF.has(S.id) ? 'គ្មានអ៊ីនធឺណិត — ចាក់បានតែបទដែលបានទាញយក' : `មិនអាចចាក់ «${(cur() || {}).t || ''}» បានទេ`);
    if (errors < Math.min(5, S.q.length)) setTimeout(() => step(1), 1200); else pause();
  });
  audio.volume = S.v; audio.muted = S.mute;
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  if (bc) bc.onmessage = e => {
    if (!e.data || e.data.tab === TAB) return;
    if (e.data.type === 'play') { owner = false; wantResume = false; if (!audio.paused) audio.pause(); render(); }
    if (e.data.type === 'lib') reloadLibrary();
  };
  addEventListener('storage', e => { if (e.key === MYKEY) changed(true); });
  // one tap anywhere resumes music that the browser didn't allow to start by itself
  const resumeOnGesture = e => { if (!wantResume || (e.target.closest && e.target.closest('#kbm'))) return; play(); };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, resumeOnGesture, true));

  // ---------- UI ----------
  const I = {
    play: '<path d="M8 5.5v13l11-6.5z"/>', pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
    prev: '<path d="M6 5h2v14H6zM9.5 12 19 5.5v13z"/>', next: '<path d="M16 5h2v14h-2zM14.5 12 5 18.5v-13z"/>',
    shuffle: '<path d="M16 4h4v4M4 18 20 4M20 16v4h-4M14 14l6 6M4 6l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    repeat: '<path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    vol: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    list: '<path d="M4 6h11M4 12h11M4 18h7M17 14v6l4-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    up: '<path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    x: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    min: '<path d="M5 19h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    pop: '<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    note: '<path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    lyr: '<path d="M4 5h16M4 10h10M4 15h16M4 20h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    heart: '<path d="M12 20s-7-4.4-9.2-8.8C1.4 8.3 3.2 5 6.6 5c2 0 3.4 1.2 4.4 2.6h2C14 6.2 15.4 5 17.4 5c3.4 0 5.2 3.3 3.8 6.2C19 15.6 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    heartf: '<path d="M12 20s-7-4.4-9.2-8.8C1.4 8.3 3.2 5 6.6 5c2 0 3.4 1.2 4.4 2.6h2C14 6.2 15.4 5 17.4 5c3.4 0 5.2 3.3 3.8 6.2C19 15.6 12 20 12 20z"/>',
    more: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
    dl: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    ok: '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 18.5h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    next1: '<path d="M4 6h10M4 12h10M4 18h6M16 12l5 3.5-5 3.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const ic = (n, cls = '') => `<svg class="kbi ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const btn = (act, icon, label, cls = '', extra = '') => `<button type="button" class="kbm-b ${cls}" data-a="${act}" title="${label}" aria-label="${label}" ${extra}>${ic(icon)}</button>`;
  const coverOf = t => t && (t.c || (PLS.find(p => p.tracks.includes(t)) || {}).c);
  const coverHTML = (t, cls = '') => { const c = coverOf(t); return `<span class="kbm-cov ${cls}">${c ? `<img src="${url(c)}" alt="" loading="lazy">` : ic(t && t.local ? 'phone' : 'note')}</span>`; };
  const eq = () => '<span class="kbm-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  const rpLabel = () => ({ off: 'មិនចាក់ឡើងវិញ', all: 'ចាក់បញ្ជីឡើងវិញ', one: 'ចាក់បទនេះឡើងវិញ' })[S.rp];
  // small status badge for a song: on this device / saved offline / downloading
  function badge(t) {
    if (t.local) return `<i class="kbm-badge" title="នៅលើឧបករណ៍">${ic('phone')}</i>`;
    if (DL[t.id] != null) return `<i class="kbm-badge dl" title="កំពុងទាញយក">${kmNum(Math.round(DL[t.id] * 100))}%</i>`;
    if (OFF.has(t.id)) return `<i class="kbm-badge ok" title="ស្ដាប់បានពេលគ្មានអ៊ីនធឺណិត">${ic('ok')}</i>`;
    return '';
  }

  let root;
  function mount() {
    root = document.createElement('div'); root.id = 'kbm'; if (POP) root.className = 'pop';
    root.innerHTML = `<button class="kbm-fab" data-a="open" type="button" title="ស្ដាប់ចម្រៀង · Music" aria-label="ស្ដាប់ចម្រៀង">${ic('note')}</button>
      <div class="kbm-pill" role="group" aria-label="Music"></div>
      <div class="kbm-bar" role="region" aria-label="Music player"></div>
      <div class="kbm-sheet" role="dialog" aria-label="ចម្រៀង · Now playing" hidden></div>
      <div class="kbm-menu" role="menu" hidden></div>
      <input class="kbm-file" type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" multiple hidden>
      <div class="kbm-toast" hidden></div>`;
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.kbm-name')) { e.preventDefault(); root.querySelector('[data-a="savename"]').click(); } });
    document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!menuEl().hidden) closeMenu(); else if (!sheetEl().hidden && !POP) closeSheet(); });
    document.addEventListener('pointerdown', e => { if (!menuEl().hidden && !e.target.closest('.kbm-menu') && !e.target.closest('[data-more]')) closeMenu(); }, true);
  }
  const sheetEl = () => root.querySelector('.kbm-sheet');
  const menuEl = () => root.querySelector('.kbm-menu');

  function render() {
    if (!root) return;
    const t = cur(), playing = !audio.paused && !silent, has = ALL.length > 0;
    document.body.classList.toggle('kbm-on', has && S.mode === 'bar' && !POP);
    root.dataset.mode = has || POP ? (POP ? 'pop' : S.mode) : 'none';
    root.classList.toggle('playing', playing);
    root.classList.toggle('resume', wantResume);
    const title = t ? esc(t.t) : 'ជ្រើសរើសបទចម្រៀង', sub = t ? esc([t.a, plName(S.pl)].filter(Boolean).join(' · ')) : `${kmNum(ALL.length)} បទ`;
    const pp = wantResume ? btn('play', 'play', 'បន្តស្ដាប់', 'kbm-pp big pulse') : btn(playing ? 'pause' : 'play', playing ? 'pause' : 'play', playing ? 'ផ្អាក' : 'ចាក់', 'kbm-pp big');
    const fav = t && isFav(t.id);
    root.querySelector('.kbm-bar').innerHTML = `
      <div class="kbm-line"><i></i></div>
      <div class="kbm-nowwrap"><button class="kbm-now" data-a="sheet" type="button" title="បើកផ្ទាំងចម្រៀង">${coverHTML(t)}<span class="kbm-meta"><b>${title}</b><small>${wantResume ? 'ចុចកន្លែងណាមួយ ដើម្បីបន្តស្ដាប់' : sub}</small></span>${playing ? eq() : ''}</button>
        ${t ? btn('fav', fav ? 'heartf' : 'heart', fav ? 'ដកចេញពីចូលចិត្ត' : 'ចូលចិត្ត', 'kbm-heart' + (fav ? ' on' : '')) : ''}</div>
      <div class="kbm-mid">
        <div class="kbm-ctl">${btn('sh', 'shuffle', S.sh ? 'ចាក់ចៃដន្យ៖ បើក' : 'ចាក់ចៃដន្យ៖ បិទ', 'kbm-sh' + (S.sh ? ' on' : ''))}${btn('prev', 'prev', 'បទមុន')}${pp}${btn('next', 'next', 'បទបន្ទាប់')}${btn('rp', 'repeat', rpLabel(), 'kbm-rp ' + S.rp + (S.rp !== 'off' ? ' on' : ''))}</div>
        <div class="kbm-seekrow"><span class="kbm-tc">0:00</span><input class="kbm-seek" type="range" min="0" max="1000" value="0" aria-label="ទីតាំងក្នុងបទ"><span class="kbm-td">${fmt(t && t.d)}</span></div>
      </div>
      <div class="kbm-right">
        ${btn('lyrics', 'lyr', 'ទំនុកច្រៀង', 'kbm-lyrb' + (t && t.lyr ? '' : ' dis'))}${btn('queue', 'list', 'បញ្ជីចាក់ និងបញ្ជីរបស់ខ្ញុំ')}
        <span class="kbm-sleepw">${btn('sleepmenu', 'moon', 'ម៉ោងបិទដោយស្វ័យប្រវត្តិ', sleep.at || sleep.end ? 'on' : '')}<small class="kbm-sleepleft">${sleep.end ? 'ចប់បទ' : ''}</small></span>
        <span class="kbm-volw">${btn('mute', S.mute || S.v === 0 ? 'mute' : 'vol', S.mute ? 'បើកសំឡេង' : 'បិទសំឡេង')}<input class="kbm-vol" type="range" min="0" max="100" value="${Math.round(S.v * 100)}" style="--p:${Math.round(S.v * 100)}%" aria-label="កំរិតសំឡេង"></span>
        ${btn('popout', 'pop', 'បើកក្នុងបង្អួចតូច (ស្ដាប់បន្តពេលប្ដូរទំព័រ)', 'kbm-popb')}${btn('pill', 'min', 'បង្រួម')}${btn('close', 'x', 'បិទចម្រៀង')}
      </div>
      <div class="kbm-mob">${pp}${btn('next', 'next', 'បទបន្ទាប់')}${btn('sheet', 'up', 'បើកផ្ទាំងចម្រៀង')}</div>`;
    root.querySelector('.kbm-pill').innerHTML = `<button class="kbm-pillopen" data-a="bar" type="button" title="${title}">${coverHTML(t)}${playing ? eq() : ''}</button>${pp}`;
    if (!sheetEl().hidden) renderSheet();
    progress();
  }

  function progress() {
    if (!root || silent) return;
    const d = audio.duration || (cur() && cur().d) || 0, c = (audio.readyState >= 1 ? audio.currentTime : S.t) || 0, r = d && isFinite(d) ? Math.min(1, c / d) : 0;
    root.querySelectorAll('.kbm-seek').forEach(s => { if (!seeking) { s.value = Math.round(r * 1000); s.style.setProperty('--p', (r * 100) + '%'); } });
    root.querySelectorAll('.kbm-tc').forEach(x => x.textContent = fmt(c));
    root.querySelectorAll('.kbm-td').forEach(x => x.textContent = fmt(d));
    root.querySelectorAll('.kbm-line i').forEach(x => x.style.width = (r * 100) + '%');
  }

  function openSheet(tab, pl) {
    sheetTab = tab || sheetTab; if (pl) { listPl = pl; search = ''; }
    const s = sheetEl(); s.hidden = false; root.classList.add('sheet-open'); if (S.mode === 'pill' || S.mode === 'fab') setMode('bar'); renderSheet();
    if (sheetTab === 'list') setTimeout(() => { const el = s.querySelector('.kbm-row.cur'); el && el.scrollIntoView({ block: 'center' }); }, 30);
  }
  function closeSheet() { const s = sheetEl(); if (!s) return; s.hidden = true; root.classList.remove('sheet-open'); closeMenu(); }

  function row(x, i, from, ctx) {
    const playing = !audio.paused && !silent, fav = isFav(x.id);
    return `<li class="kbm-row${x.id === S.id ? ' cur' : ''}"><button type="button" class="kbm-tr" data-tr="${esc(x.id)}" data-from="${esc(from)}">
      <span class="kbm-n">${x.id === S.id && playing ? eq() : kmNum(i + 1)}</span>${coverHTML(x, 'sm')}<span class="kbm-meta"><b>${esc(x.t)}</b><small>${badge(x)}${esc(x.a || '')}</small></span><span class="kbm-dur">${x.d ? fmt(x.d) : ''}</span></button>
      <button type="button" class="kbm-b kbm-heart sm${fav ? ' on' : ''}" data-favid="${esc(x.id)}" title="${fav ? 'ដកចេញពីចូលចិត្ត' : 'ចូលចិត្ត'}" aria-label="ចូលចិត្ត">${ic(fav ? 'heartf' : 'heart')}</button>
      <button type="button" class="kbm-b sm" data-more="${esc(x.id)}" data-ctx="${esc(ctx || '')}" title="ជម្រើសផ្សេងទៀត" aria-label="ជម្រើស">${ic('more')}</button></li>`;
  }

  function listHead(L) {
    if (!L) return '';
    const ids = L.tracks.map(t => t.id), siteIds = L.tracks.filter(t => !t.local).map(t => t.id), need = siteIds.filter(id => !OFF.has(id) && DL[id] == null).length;
    let h = `<div class="kbm-lhead"><div class="kbm-ltitle">`;
    if (ui.rename === L.id) h += `<input class="kbm-name" value="${esc(L.km)}" aria-label="ឈ្មោះបញ្ជី">${btn('savename', 'ok', 'រក្សាទុក', 'kbm-chipbtn', `data-for="${esc(L.id)}"`)}`;
    else h += `<b>${L.kind === 'fav' ? '♥ ' : ''}${esc(L.km)}</b><small>${kmNum(L.tracks.length)} បទ</small>`;
    h += `</div><div class="kbm-lacts">`;
    if (L.tracks.length) h += btn('playpl', 'play', 'ចាក់ទាំងអស់', 'kbm-chipbtn') + btn('shufpl', 'shuffle', 'ចាក់ចៃដន្យ', 'kbm-chipbtn');
    if (siteIds.length && need) h += btn('dlpl', 'dl', `ទាញយកទុកស្ដាប់ពេលគ្មានអ៊ីនធឺណិត (${kmNum(need)} បទ)`, 'kbm-chipbtn');
    if (L.kind === 'local') h += `<button type="button" class="kbm-addbtn" data-a="import">${ic('plus')} បញ្ចូលពីឧបករណ៍</button>`;
    if (L.kind === 'mine' && ui.rename !== L.id) h += btn('rename', 'edit', 'ប្ដូរឈ្មោះ', 'kbm-chipbtn') + (ui.confirm === 'pl:' + L.id ? `<button type="button" class="kbm-addbtn warn" data-a="delpl">ចុចម្ដងទៀតដើម្បីលុប</button>` : btn('delpl', 'trash', 'លុបបញ្ជីនេះ', 'kbm-chipbtn'));
    h += `</div></div>`;
    if (L.kind === 'local') h += `<p class="kbm-note">បញ្ចូលចម្រៀងពីទូរស័ព្ទ ឬកុំព្យូទ័ររបស់អ្នក — រក្សាទុកតែនៅលើឧបករណ៍នេះប៉ុណ្ណោះ ស្ដាប់បានពេលគ្មានអ៊ីនធឺណិត ហើយមិនបញ្ជូនទៅណាឡើយ។ <span class="kbm-storage"></span></p>`;
    else if (L.kind === 'fav' && !L.tracks.length) h += `<p class="kbm-note">ចុច ${ic('heart')} លើបទណាមួយ ដើម្បីបញ្ចូលទីនេះ។</p>`;
    else if (L.kind === 'mine' && !L.tracks.length) h += `<p class="kbm-note">ចុច ${ic('more')} លើបទណាមួយ → «បញ្ចូលក្នុងបញ្ជី» ដើម្បីបន្ថែមបទចម្រៀង។</p>`;
    else if (L.kind === 'off') h += `<p class="kbm-note">បទទាំងនេះស្ដាប់បាន ទោះគ្មានអ៊ីនធឺណិតក៏ដោយ។ <span class="kbm-storage"></span></p>`;
    return h;
  }

  function renderSheet() {
    const t = cur(), playing = !audio.paused && !silent, s = sheetEl();
    const tabs = [['now', 'ចាក់ឥឡូវ'], ['list', 'បញ្ជីចាក់'], ['lyrics', 'ទំនុកច្រៀង']];
    let body = '';
    if (sheetTab === 'now') {
      const fav = t && isFav(t.id);
      body = `<div class="kbm-big">${coverHTML(t, 'xl')}</div>
        <div class="kbm-bigmeta"><b>${t ? esc(t.t) : 'ជ្រើសរើសបទចម្រៀង'}</b><small>${t ? esc([t.a, t.al].filter(Boolean).join(' · ')) : ''}</small><small class="kbm-from">${t ? 'ពីបញ្ជី ' + esc(plName(S.pl)) : ''}</small></div>
        ${t ? `<div class="kbm-nowacts">${btn('fav', fav ? 'heartf' : 'heart', fav ? 'ដកចេញពីចូលចិត្ត' : 'ចូលចិត្ត', 'kbm-heart' + (fav ? ' on' : ''))}<button type="button" class="kbm-b" data-more="${esc(t.id)}" data-ctx="" title="បញ្ចូលក្នុងបញ្ជី ទាញយក …">${ic('more')}</button></div>` : ''}
        <div class="kbm-seekrow lg"><span class="kbm-tc">0:00</span><input class="kbm-seek" type="range" min="0" max="1000" value="0" aria-label="ទីតាំងក្នុងបទ"><span class="kbm-td">0:00</span></div>
        <div class="kbm-ctl lg">${btn('sh', 'shuffle', 'ចាក់ចៃដន្យ', 'kbm-sh' + (S.sh ? ' on' : ''))}${btn('prev', 'prev', 'បទមុន')}${btn(playing ? 'pause' : 'play', playing ? 'pause' : 'play', playing ? 'ផ្អាក' : 'ចាក់', 'kbm-pp huge')}${btn('next', 'next', 'បទបន្ទាប់')}${btn('rp', 'repeat', rpLabel(), 'kbm-rp ' + S.rp + (S.rp !== 'off' ? ' on' : ''))}</div>
        <div class="kbm-opts">
          <span class="kbm-volw lg">${btn('mute', S.mute || S.v === 0 ? 'mute' : 'vol', 'សំឡេង')}<input class="kbm-vol" type="range" min="0" max="100" value="${Math.round(S.v * 100)}" style="--p:${Math.round(S.v * 100)}%" aria-label="កំរិតសំឡេង"></span>
        </div>
        <div class="kbm-sleep"><span>${ic('moon')} ឈប់ដោយស្វ័យប្រវត្តិ</span>${[[0, 'បិទ'], [15, '១៥ នាទី'], [30, '៣០ នាទី'], [60, '១ ម៉ោង'], ['end', 'ចប់បទនេះ']].map(([v, l]) =>
          `<button type="button" data-sleep="${v}" class="${String(v) === sleep.sel && (v === 0 || sleep.at || sleep.end) ? 'on' : ''}">${l}</button>`).join('')}<small class="kbm-sleepleft"></small></div>
        <p class="kbm-hint">${POP ? 'បង្អួចនេះចាក់ចម្រៀងបន្ត ពេលអ្នកអាន ឬប្ដូរទំព័រក្នុងបង្អួចមួយទៀត។' : 'គន្លឹះ៖ ចុច ' + ic('pop') + ' ដើម្បីបើកចម្រៀងក្នុងបង្អួចតូចមួយ — ចម្រៀងនឹងមិនឈប់ ពេលអ្នកប្ដូរទំព័រទេ។'}</p>`;
    } else if (sheetTab === 'list') {
      const q = search.trim().toLowerCase(), all = lists();
      let pl = listPl || S.pl || '__all'; if (pl !== '__queue' && !all.some(l => l.id === pl)) pl = '__all';
      const L = pl === '__queue' ? null : all.find(l => l.id === pl);
      let rows = pl === '__queue' ? S.q.map(id => BY[id]).filter(Boolean) : L.tracks;
      if (q) rows = ALL.filter(x => [x.t, x.a, x.al].filter(Boolean).join(' ').toLowerCase().includes(q));
      const chip = (id, l, cls = '') => `<button type="button" data-pl="${esc(id)}" class="${cls}${!q && id === pl ? ' on' : ''}">${l}</button>`;
      body = `<div class="kbm-chips">${chip('__queue', 'កំពុងចាក់')}${all.map(l => chip(l.id, (l.kind === 'fav' ? '♥ ' : l.kind === 'local' ? '📱 ' : l.kind === 'off' ? '⬇ ' : '') + esc(l.km), l.kind === 'mine' || l.kind === 'fav' ? 'mine' : '')).join('')}
          <button type="button" class="kbm-newchip" data-a="newlist" title="បង្កើតបញ្ជីថ្មី">${ic('plus')} បញ្ជីថ្មី</button></div>
        ${ui.newList ? `<div class="kbm-newform"><input class="kbm-name" placeholder="ឈ្មោះបញ្ជីថ្មី ឧ. ចម្រៀងពេលព្រឹក" aria-label="ឈ្មោះបញ្ជីថ្មី">${btn('savename', 'ok', 'បង្កើត', 'kbm-chipbtn', 'data-for="__new"')}${btn('cancelname', 'x', 'បោះបង់', 'kbm-chipbtn')}</div>` : ''}
        <input class="kbm-search" type="search" placeholder="ស្វែងរកបទចម្រៀង ឬអ្នកច្រៀង…" value="${esc(search)}" aria-label="ស្វែងរកបទចម្រៀង">
        ${!q && L ? listHead(L) : ''}
        <ol class="kbm-list">${rows.map((x, i) => row(x, i, q ? '__all' : pl === '__queue' ? S.pl : pl, !q && L && L.kind === 'mine' || (!q && L && L.kind === 'fav') ? L.id : '')).join('') || (q || pl === '__queue' ? '<li class="kbm-empty">រកមិនឃើញ</li>' : '')}</ol>`;
    } else {
      body = `<div class="kbm-lyrics">${!t ? '' : !t.lyr ? '<p class="kbm-empty">បទនេះមិនទាន់មានទំនុកច្រៀងទេ។<br><small>ដាក់ឯកសារ .lrc ឬ .txt ឈ្មោះដូចឯកសារចម្រៀង ក្នុងថតដដែល។</small></p>' : lyr && lyrFor === t.id ? lyr.html : '<p class="kbm-empty">កំពុងផ្ទុក…</p>'}</div>`;
      if (t && t.lyr && lyrFor !== t.id) loadLyrics(t);
    }
    const sb = s.querySelector('.kbm-sbody'), keep = sb && sheetTab === s.dataset.tab ? sb.scrollTop : 0;
    s.dataset.tab = sheetTab;
    s.innerHTML = `<div class="kbm-shead"><div class="kbm-tabs">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === sheetTab ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${POP ? '' : btn('closesheet', 'down', 'បិទផ្ទាំង', 'kbm-sx')}</div><div class="kbm-sbody">${body}</div>`;
    s.querySelector('.kbm-sbody').scrollTop = keep;
    s.querySelectorAll('.kbm-storage').forEach(el => storage().then(st => { el.textContent = st.quota ? `ប្រើ ${mb(st.used)} ក្នុងចំណោម ${mb(st.quota)}` : ''; }));
    const nm = s.querySelector('.kbm-name'); if (nm && document.activeElement !== nm) { nm.focus(); nm.select(); }
    progress(); if (sheetTab === 'lyrics') lyricTick(true);
  }

  // ---------- song menu (♥, add to playlist, play next, offline, move, remove) ----------
  let menuFor = null;
  function menu(id, anchor, ctx, sub) {
    const t = BY[id], m = menuEl(); if (!t) return;
    menuFor = { id, anchor, ctx: ctx || '' };
    const fav = isFav(id), mine = My.lists().filter(l => l.id !== 'u_fav'), L = ctx ? My.get(ctx) : null;
    const item = (a, icon, label, cls = '') => `<button type="button" role="menuitem" class="${cls}" data-m="${a}">${ic(icon)}<span>${label}</span></button>`;
    let h = `<div class="kbm-mhead">${coverHTML(t, 'sm')}<span class="kbm-meta"><b>${esc(t.t)}</b><small>${esc(t.a || '')}</small></span></div>`;
    if (sub === 'add') {
      h += `<div class="kbm-msub">បញ្ចូលក្នុងបញ្ជី</div>` + mine.map(l => `<button type="button" role="menuitem" data-m="addto" data-l="${esc(l.id)}">${ic(l.tracks.includes(id) ? 'ok' : 'list')}<span>${esc(l.km)}</span></button>`).join('')
        + `<div class="kbm-newform in"><input class="kbm-mname" placeholder="បញ្ជីថ្មី…" aria-label="ឈ្មោះបញ្ជីថ្មី"><button type="button" class="kbm-b kbm-chipbtn" data-m="newadd" title="បង្កើត ហើយបញ្ចូល">${ic('plus')}</button></div>`
        + item('back', 'up', 'ថយក្រោយ', 'muted');
    } else {
      h += item('play', 'play', 'ចាក់ឥឡូវ') + item('next', 'next1', 'ចាក់បន្ទាប់')
        + item('fav', fav ? 'heartf' : 'heart', fav ? 'ដកចេញពីចូលចិត្ត' : 'បញ្ចូលក្នុងចូលចិត្ត', fav ? 'on' : '')
        + item('add', 'plus', 'បញ្ចូលក្នុងបញ្ជី…');
      if (L && L.id !== 'u_fav') h += item('up', 'up', 'ផ្លាស់ទីឡើង') + item('down', 'down', 'ផ្លាស់ទីចុះ') + item('drop', 'x', 'ដកចេញពីបញ្ជីនេះ');
      if (L && L.id === 'u_fav') h += item('up', 'up', 'ផ្លាស់ទីឡើង') + item('down', 'down', 'ផ្លាស់ទីចុះ');
      if (t.local) h += item('dellocal', 'trash', ui.confirm === 'loc:' + id ? 'ចុចម្ដងទៀត ដើម្បីលុបពីឧបករណ៍' : 'លុបចេញពីឧបករណ៍', 'warn');
      else if (DL[id] != null) h += item('noop', 'dl', `កំពុងទាញយក ${kmNum(Math.round(DL[id] * 100))}%`, 'muted');
      else if (OFF.has(id)) h += item('unsave', 'trash', 'លុបច្បាប់ចម្លងពេលគ្មានអ៊ីនធឺណិត');
      else h += item('save', 'dl', 'ទាញយកទុកស្ដាប់ពេលគ្មានអ៊ីនធឺណិត');
    }
    m.innerHTML = h; m.hidden = false; m.dataset.sub = sub || '';
    const r = anchor.getBoundingClientRect(), mw = Math.min(280, innerWidth - 16);
    m.style.width = mw + 'px'; const mh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8)) + 'px';
    m.style.top = (r.bottom + 6 + mh > innerHeight - 8 ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
    if (sub === 'add') m.querySelector('.kbm-mname').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); m.querySelector('[data-m="newadd"]').click(); } });
  }
  function closeMenu() { const m = menuEl(); if (m) { m.hidden = true; menuFor = null; if (ui.confirm && ui.confirm.startsWith('loc:')) ui.confirm = null; } }
  function onMenu(b) {
    const { id, anchor, ctx } = menuFor, a = b.dataset.m, keep = () => menu(id, anchor, ctx);
    if (a === 'play') { closeMenu(); playTrack(id, ctx || S.pl); }
    else if (a === 'next') { closeMenu(); playNext(id); }
    else if (a === 'fav') { toggleFav(id); closeMenu(); }
    else if (a === 'add') menu(id, anchor, ctx, 'add');
    else if (a === 'back') keep();
    else if (a === 'addto') { const L = My.get(b.dataset.l); if (L.tracks.includes(id)) { My.drop(L.id, id); toast(`បានដកចេញពី «${L.km}»`); } else { My.add(L.id, id); toast(`បានបញ្ចូលក្នុង «${L.km}»`); } menu(id, anchor, ctx, 'add'); }
    else if (a === 'newadd') { const n = menuEl().querySelector('.kbm-mname').value.trim(); if (!n) return; const lid = My.create(n); My.add(lid, id); toast(`បានបង្កើត «${n}»`); closeMenu(); }
    else if (a === 'up' || a === 'down') { My.move(ctx, id, a === 'up' ? -1 : 1); closeMenu(); }
    else if (a === 'drop') { My.drop(ctx, id); closeMenu(); toast('បានដកចេញពីបញ្ជី'); }
    else if (a === 'save') { closeMenu(); download(id); }
    else if (a === 'unsave') { closeMenu(); removeOffline(id); }
    else if (a === 'dellocal') { if (ui.confirm === 'loc:' + id) { ui.confirm = null; closeMenu(); deleteLocal(id); } else { ui.confirm = 'loc:' + id; keep(); } }
  }

  // ---------- lyrics (.lrc timed, or plain .txt) ----------
  async function loadLyrics(t) {
    lyrFor = t.id; lyr = null;
    try {
      let r = await fetch(url(t.lyr)).catch(() => null);
      if (!r || !r.ok) r = await caches.open(AC).then(c => c.match(abs(t.lyr)));
      if (!r) throw 0;
      const txt = await r.text(), lines = [];
      for (const ln of txt.split(/\r?\n/)) {
        const tags = [...ln.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)], words = ln.replace(/\[[^\]]*\]/g, '').trim();
        if (tags.length) tags.forEach(m => lines.push({ s: +m[1] * 60 + +m[2], w: words }));
        else if (!/^\[\w+:/.test(ln)) lines.push({ s: null, w: ln.trim() });
      }
      const timed = lines.some(l => l.s != null);
      if (timed) lines.sort((a, b) => (a.s ?? 1e9) - (b.s ?? 1e9));
      lyr = { timed, lines, html: lines.map((l, i) => l.w ? `<p data-i="${i}"${l.s != null ? ` data-s="${l.s}"` : ''}>${esc(l.w)}</p>` : '<br>').join('') };
    } catch (e) { lyr = { timed: false, lines: [], html: '<p class="kbm-empty">មិនអាចផ្ទុកទំនុកច្រៀងបានទេ</p>' }; }
    if (cur() && cur().id === t.id && sheetTab === 'lyrics' && !sheetEl().hidden) renderSheet();
  }
  let lastLine = -1;
  function lyricTick(force) {
    if (!lyr || !lyr.timed) return;
    const c = audio.currentTime + 0.25; let k = -1;
    lyr.lines.forEach((l, i) => { if (l.s != null && l.s <= c) k = i; });
    if (k === lastLine && !force) return; lastLine = k;
    const box = root.querySelector('.kbm-lyrics'); if (!box) return;
    box.querySelectorAll('p.on').forEach(p => p.classList.remove('on'));
    const p = box.querySelector(`p[data-i="${k}"]`); if (p) { p.classList.add('on'); p.scrollIntoView({ block: 'center', behavior: force ? 'auto' : 'smooth' }); }
  }

  // ---------- events ----------
  function onClick(e) {
    const mb_ = e.target.closest('.kbm-menu [data-m]'); if (mb_) { onMenu(mb_); return; }
    const b = e.target.closest('[data-a],[data-tab],[data-pl],[data-tr],[data-sleep],[data-favid],[data-more],.kbm-lyrics p[data-s]'); if (!b) return;
    if (b.matches('.kbm-lyrics p[data-s]')) { audio.currentTime = +b.dataset.s; if (audio.paused) play(); return; }
    if (b.dataset.more) { if (!menuEl().hidden && menuFor && menuFor.anchor === b) closeMenu(); else menu(b.dataset.more, b, b.dataset.ctx); return; }
    if (b.dataset.favid) { toggleFav(b.dataset.favid); return; }
    if (b.dataset.tab) { sheetTab = b.dataset.tab; renderSheet(); return; }
    if (b.dataset.pl) { listPl = b.dataset.pl; search = ''; ui.rename = null; ui.confirm = null; renderSheet(); return; }
    if (b.dataset.tr) { playTrack(b.dataset.tr, b.dataset.from); return; }
    if (b.dataset.sleep != null) { const v = b.dataset.sleep; setSleep(v === 'end' ? 'end' : +v); renderSheet(); return; }
    const a = b.dataset.a, Lid = listPl || S.pl || '__all';
    if (a === 'play') play(); else if (a === 'pause') pause(); else if (a === 'next') step(1); else if (a === 'prev') step(-1);
    else if (a === 'sh') { patch({ sh: !S.sh }); buildQueue(S.pl, S.id); if (owner) save(); render(); }
    else if (a === 'rp') { patch({ rp: { off: 'all', all: 'one', one: 'off' }[S.rp] }); render(); toast(rpLabel()); }
    else if (a === 'mute') { patch({ mute: !S.mute, v: S.mute && S.v === 0 ? 0.6 : S.v }); audio.muted = S.mute; audio.volume = S.v; render(); }
    else if (a === 'fav') { const t = cur(); if (t) toggleFav(t.id); }
    else if (a === 'open') { setMode('bar'); openSheet(S.id ? 'now' : 'list'); }
    else if (a === 'sheet') openSheet(sheetTab === 'lyrics' && !(cur() && cur().lyr) ? 'now' : sheetTab);
    else if (a === 'queue') sheetEl().hidden || sheetTab !== 'list' ? (listPl = null, openSheet('list')) : closeSheet();
    else if (a === 'lyrics') sheetEl().hidden || sheetTab !== 'lyrics' ? openSheet('lyrics') : closeSheet();
    else if (a === 'closesheet') closeSheet();
    else if (a === 'pill') { closeSheet(); setMode('pill'); }
    else if (a === 'bar') setMode('bar');
    else if (a === 'close') stop();
    else if (a === 'sleepmenu') openSheet('now');
    else if (a === 'popout') popout();
    else if (a === 'playpl') playList(Lid, false);
    else if (a === 'shufpl') playList(Lid, true);
    else if (a === 'dlpl') downloadMany(tracksOf(Lid).filter(t => !t.local).map(t => t.id));
    else if (a === 'import') pickFiles();
    else if (a === 'newlist') { ui.newList = !ui.newList; renderSheet(); }
    else if (a === 'cancelname') { ui.newList = false; ui.rename = null; renderSheet(); }
    else if (a === 'rename') { ui.rename = Lid; renderSheet(); }
    else if (a === 'savename') {
      const v = (root.querySelector('.kbm-name') || {}).value || '';
      if (b.dataset.for === '__new') { if (!v.trim()) return; listPl = My.create(v); ui.newList = false; toast(`បានបង្កើត «${v.trim()}»`); }
      else { My.rename(b.dataset.for, v); ui.rename = null; }
      renderSheet();
    }
    else if (a === 'delpl') { if (ui.confirm === 'pl:' + Lid) { ui.confirm = null; const n = plName(Lid); My.remove(Lid); listPl = '__all'; toast(`បានលុប «${n}»`); } else ui.confirm = 'pl:' + Lid; renderSheet(); }
  }
  let pickResolve = null;
  function pickFiles() {
    const f = root.querySelector('.kbm-file'); f.value = '';
    return new Promise(res => { pickResolve = res; f.click(); });
  }
  function onInput(e) {
    const el = e.target;
    if (el.classList.contains('kbm-seek')) { seeking = true; el.style.setProperty('--p', (el.value / 10) + '%'); const d = audio.duration || (cur() && cur().d) || 0; root.querySelectorAll('.kbm-tc').forEach(x => x.textContent = fmt(el.value / 1000 * d)); }
    else if (el.classList.contains('kbm-vol')) { patch({ v: el.value / 100, mute: false }); audio.muted = false; audio.volume = S.v; el.style.setProperty('--p', el.value + '%'); root.querySelectorAll('.kbm-vol').forEach(x => { if (x !== el) x.value = el.value; }); }
    else if (el.classList.contains('kbm-search')) { search = el.value; const pos = el.selectionStart; renderSheet(); const n = root.querySelector('.kbm-search'); n.focus(); n.setSelectionRange(pos, pos); }
  }
  function onChange(e) {
    const el = e.target;
    if (el.classList.contains('kbm-seek')) { const d = audio.duration; if (d) audio.currentTime = el.value / 1000 * d; seeking = false; progress(); save(); }
    else if (el.classList.contains('kbm-vol')) render();
    else if (el.classList.contains('kbm-file')) { const fs = el.files; importFiles(fs).then(n => { if (pickResolve) { pickResolve(n); pickResolve = null; } if (n) { listPl = '__local'; if (!sheetEl().hidden) renderSheet(); } }); }
  }
  function popout() {
    save();
    const w = window.open('music.html?pop=1', 'kbmusic', 'width=420,height=760,menubar=no,toolbar=no');
    if (w) { pause(); toast('ចម្រៀងកំពុងចាក់ក្នុងបង្អួចតូច'); } else toast('សូមអនុញ្ញាតឲ្យបើកបង្អួចថ្មី (pop-up)');
  }
  let toastT = 0;
  function toast(msg, ms = 2200) { const t = root && root.querySelector('.kbm-toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }

  // library changed (favourites, playlists, downloads, device songs): redraw and tell other tabs
  let chT = 0;
  function changed(fromOtherTab) {
    if (!fromOtherTab && bc) { clearTimeout(chT); chT = setTimeout(() => bc.postMessage({ type: 'lib', tab: TAB }), 400); }
    render(); emit();
  }
  function index() {
    ALL = [...SITE, ...LOCAL]; BY = Object.fromEntries(ALL.map(t => [t.id, t]));
  }
  async function reloadLibrary() {
    try { LOCAL.forEach(t => t.c && URL.revokeObjectURL(t.c)); LOCAL = (await DB.metas()).sort((a, b) => a.added - b.added).map(localTrack); } catch (e) {}
    await scanOffline(); index(); changed(true);
  }

  // ---------- start ----------
  async function init() {
    mount();
    const d = await fetch('music/playlist.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { playlists: [] }).catch(() => ({ playlists: [] }));
    PLS = (d.playlists || []).filter(p => p.tracks && p.tracks.length);
    SITE = PLS.flatMap(p => p.tracks);
    try { LOCAL = (await DB.metas()).sort((a, b) => a.added - b.added).map(localTrack); } catch (e) { LOCAL = []; }
    await scanOffline();
    index();
    S.q = (S.q || []).filter(id => BY[id]);
    if (S.id && !BY[S.id]) { S.id = null; S.playing = false; }
    if (!S.q.length && ALL.length) buildQueue(tracksOf(S.pl).length ? S.pl : '__all');
    if (S.mode === 'fab' && S.id && S.playing) S.mode = 'bar';
    if (S.id) load(S.id, S.t || 0);
    render(); emit();
    // keep playing across pages: resume if it was playing in the last few hours
    if (S.id && S.playing && Date.now() - (S.ts || 0) < 6 * 3600e3 && !POP) play();
    if (POP) { openSheet(S.id ? 'now' : 'list'); if (S.id) play(); document.title = 'ចម្រៀង — Khmer Bible'; }
    readyRes(d);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

  return {
    ready, get playlists() { return PLS; }, get all() { return ALL; }, get site() { return SITE; }, get local() { return LOCAL; }, get state() { return S; },
    get current() { return cur(); }, get playing() { return !audio.paused && !silent; },
    play, pause, toggle, next: () => step(1), prev: () => step(-1), playTrack, playList, playNext, openSheet, fmt, mb,
    lists, isFav, toggleFav, my: My, menu, download, downloadMany, removeOffline, isOffline: id => OFF.has(id), progressOf: id => DL[id],
    importFiles, pickFiles, deleteLocal, storage, badge, on(f) { listeners.push(f); }, coverHTML, eq, toast,
  };
})();
