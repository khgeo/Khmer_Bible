/* Music player — plays the songs in music/playlist.json while you read.
   A bar at the bottom of every page (it can shrink to a small pill), a "Now playing" panel with the
   queue, playlists, search and lyrics, shuffle / repeat / sleep timer, lock-screen controls
   (Media Session), and it picks up where it left off when you open another page. */
'use strict';

const Music = (() => {
  const KEY = 'kb-music', TAB = Math.random().toString(36).slice(2);
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('kb-music') : null;
  const POP = new URLSearchParams(location.search).has('pop');
  const audio = new Audio(); audio.preload = 'metadata';
  let PLS = [], ALL = [], BY = {}, listeners = [], readyRes;
  const ready = new Promise(r => readyRes = r);
  let S = Object.assign({ id: null, t: 0, v: 0.8, mute: false, sh: false, rp: 'all', pl: '__all', q: [], playing: false, mode: 'fab', ts: 0 }, read());
  let wantResume = false, owner = false, seeking = false, sheetTab = 'now', search = '', listPl = null, lyr = null, lyrFor = null;
  let sleep = { at: 0, end: false, timer: 0, sel: '0' }, errors = 0;

  // ---------- state ----------
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  // only the tab that is actually playing writes the position; settings are merged in with patch()
  function save() {
    if (!owner) return;
    S.t = audio.currentTime || S.t || 0; S.ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  function patch(o) {
    Object.assign(S, o); const st = read(); Object.assign(st, o);
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }
  const cur = () => BY[S.id] || null;
  const url = s => /^(https?:)?\/\//.test(s) ? s : encodeURI(s);
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${kmNum(Math.floor(s / 60))}:${kmNum(String(s % 60).padStart(2, '0'))}`; };
  const plName = id => id === '__all' ? 'ចម្រៀងទាំងអស់' : (PLS.find(p => p.id === id) || {}).km || '';
  const tracksOf = id => id === '__all' ? ALL : ((PLS.find(p => p.id === id) || {}).tracks || []);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const emit = () => listeners.forEach(f => { try { f(S, cur()); } catch (e) {} });

  // ---------- queue & playback ----------
  function buildQueue(pl, firstId) {
    let ids = tracksOf(pl).map(t => t.id);
    if (S.sh) { ids = shuffle(ids); if (firstId) ids = [firstId, ...ids.filter(x => x !== firstId)]; }
    S.pl = pl; S.q = ids;
  }
  function load(id, at = 0) {
    const t = BY[id]; if (!t) return false;
    S.id = id; S.t = at;
    if (audio.dataset.id !== id) { audio.src = url(t.src); audio.dataset.id = id; }
    const seekTo = () => { if (at && Math.abs(audio.currentTime - at) > 1) try { audio.currentTime = at; } catch (e) {} };
    audio.readyState >= 1 ? seekTo() : audio.addEventListener('loadedmetadata', seekTo, { once: true });
    mediaMeta(); render(); emit(); return true;
  }
  function play() {
    if (!S.id) { if (!S.q.length) buildQueue(tracksOf(S.pl).length ? S.pl : '__all'); if (!load(S.q[0])) return; }
    wantResume = false;
    const p = audio.play();
    if (p) p.then(() => { owner = true; S.playing = true; errors = 0; bc && bc.postMessage({ type: 'play', tab: TAB }); save(); render(); emit(); },
      e => { if (e.name === 'NotAllowedError') { wantResume = true; render(); } });
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
    load(S.q[i]); play();
  }
  function playTrack(id, pl) {
    pl = pl || S.pl || '__all';
    if (S.pl !== pl || !S.q.includes(id)) buildQueue(pl, id);
    load(id); play();
  }
  function playList(pl, shuffleOn) {
    if (shuffleOn != null) S.sh = shuffleOn;
    buildQueue(pl); load(S.q[0]); play();
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
    const b = document.querySelectorAll('.kbm-sleepleft'); b.forEach(x => x.textContent = sleep.at ? fmt(left / 1000) : '');
  }
  function fadeOut() {
    const v0 = audio.volume; let k = 0;
    const iv = setInterval(() => { k++; audio.volume = Math.max(0, v0 * (1 - k / 32)); if (k >= 32) { clearInterval(iv); pause(); audio.volume = v0; render(); } }, 250);
  }

  // ---------- media session (lock screen, headphones, media keys) ----------
  function mediaMeta() {
    if (!('mediaSession' in navigator)) return;
    const t = cur(); if (!t) return;
    const art = t.c || (PLS.find(p => p.tracks.includes(t)) || {}).c;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.t, artist: t.a || '', album: t.al || plName(S.pl),
        artwork: [{ src: new URL(art ? url(art) : 'assets/icon.svg', location.href).href, sizes: '512x512' }] });
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
    if (!seeking) progress();
    if (Date.now() - lastSave > 1500) { lastSave = Date.now(); save(); }
    if (lyr && lyr.timed && sheetTab === 'lyrics') lyricTick();
    if ('mediaSession' in navigator && audio.duration && navigator.mediaSession.setPositionState)
      try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: 1 }); } catch (e) {}
  });
  audio.addEventListener('ended', () => { if (sleep.end) { setSleep(0); pause(); load(S.id, 0); return; } step(1, true); });
  audio.addEventListener('play', () => { render(); });
  audio.addEventListener('pause', () => render());
  audio.addEventListener('loadedmetadata', () => progress());
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    errors++; toast(`មិនអាចចាក់ «${(cur() || {}).t || ''}» បានទេ`);
    if (errors < Math.min(5, S.q.length)) setTimeout(() => step(1), 1200); else pause();
  });
  audio.volume = S.v; audio.muted = S.mute;
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  if (bc) bc.onmessage = e => { if (e.data && e.data.type === 'play' && e.data.tab !== TAB) { owner = false; wantResume = false; if (!audio.paused) audio.pause(); render(); } };
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
  };
  const ic = (n, cls = '') => `<svg class="kbi ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const btn = (act, icon, label, cls = '') => `<button type="button" class="kbm-b ${cls}" data-a="${act}" title="${label}" aria-label="${label}">${ic(icon)}</button>`;
  const coverOf = t => t && (t.c || (PLS.find(p => p.tracks.includes(t)) || {}).c);
  const coverHTML = (t, cls = '') => { const c = coverOf(t); return `<span class="kbm-cov ${cls}">${c ? `<img src="${url(c)}" alt="" loading="lazy">` : ic('note')}</span>`; };
  const eq = () => '<span class="kbm-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  const rpLabel = () => ({ off: 'មិនចាក់ឡើងវិញ', all: 'ចាក់បញ្ជីឡើងវិញ', one: 'ចាក់បទនេះឡើងវិញ' })[S.rp];

  let root;
  function mount() {
    root = document.createElement('div'); root.id = 'kbm'; if (POP) root.className = 'pop';
    root.innerHTML = `<button class="kbm-fab" data-a="open" type="button" title="ស្ដាប់ចម្រៀង · Music" aria-label="ស្ដាប់ចម្រៀង">${ic('note')}</button>
      <div class="kbm-pill" role="group" aria-label="Music"></div>
      <div class="kbm-bar" role="region" aria-label="Music player"></div>
      <div class="kbm-sheet" role="dialog" aria-label="ចម្រៀង · Now playing" hidden></div>
      <div class="kbm-toast" hidden></div>`;
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheetEl().hidden && !POP) closeSheet(); });
  }
  const sheetEl = () => root.querySelector('.kbm-sheet');

  function render() {
    if (!root) return;
    const t = cur(), playing = !audio.paused, has = ALL.length > 0;
    document.body.classList.toggle('kbm-on', has && S.mode === 'bar' && !POP);
    root.dataset.mode = has ? (POP ? 'pop' : S.mode) : 'none';
    root.classList.toggle('playing', playing);
    root.classList.toggle('resume', wantResume);
    const title = t ? esc(t.t) : 'ជ្រើសរើសបទចម្រៀង', sub = t ? esc([t.a, plName(S.pl)].filter(Boolean).join(' · ')) : `${kmNum(ALL.length)} បទ`;
    const pp = wantResume ? btn('play', 'play', 'បន្តស្ដាប់', 'kbm-pp big pulse') : btn(playing ? 'pause' : 'play', playing ? 'pause' : 'play', playing ? 'ផ្អាក' : 'ចាក់', 'kbm-pp big');
    root.querySelector('.kbm-bar').innerHTML = `
      <div class="kbm-line"><i></i></div>
      <button class="kbm-now" data-a="sheet" type="button" title="បើកផ្ទាំងចម្រៀង">${coverHTML(t)}<span class="kbm-meta"><b>${title}</b><small>${wantResume ? 'ចុចកន្លែងណាមួយ ដើម្បីបន្តស្ដាប់' : sub}</small></span>${playing ? eq() : ''}</button>
      <div class="kbm-mid">
        <div class="kbm-ctl">${btn('sh', 'shuffle', S.sh ? 'ចាក់ចៃដន្យ៖ បើក' : 'ចាក់ចៃដន្យ៖ បិទ', 'kbm-sh' + (S.sh ? ' on' : ''))}${btn('prev', 'prev', 'បទមុន')}${pp}${btn('next', 'next', 'បទបន្ទាប់')}${btn('rp', 'repeat', rpLabel(), 'kbm-rp ' + S.rp + (S.rp !== 'off' ? ' on' : ''))}</div>
        <div class="kbm-seekrow"><span class="kbm-tc">0:00</span><input class="kbm-seek" type="range" min="0" max="1000" value="0" aria-label="ទីតាំងក្នុងបទ"><span class="kbm-td">${fmt(t && t.d)}</span></div>
      </div>
      <div class="kbm-right">
        ${btn('lyrics', 'lyr', 'ទំនុកច្រៀង', 'kbm-lyrb' + (t && t.lyr ? '' : ' dis'))}${btn('queue', 'list', 'បញ្ជីចាក់')}
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
    if (!root) return;
    const d = audio.duration || (cur() && cur().d) || 0, c = (audio.readyState >= 1 ? audio.currentTime : S.t) || 0, r = d ? Math.min(1, c / d) : 0;
    root.querySelectorAll('.kbm-seek').forEach(s => { if (!seeking) { s.value = Math.round(r * 1000); s.style.setProperty('--p', (r * 100) + '%'); } });
    root.querySelectorAll('.kbm-tc').forEach(x => x.textContent = fmt(c));
    root.querySelectorAll('.kbm-td').forEach(x => x.textContent = fmt(d));
    root.querySelectorAll('.kbm-line i').forEach(x => x.style.width = (r * 100) + '%');
  }

  function openSheet(tab) { sheetTab = tab || sheetTab; const s = sheetEl(); s.hidden = false; root.classList.add('sheet-open'); if (S.mode === 'pill' || S.mode === 'fab') setMode('bar'); renderSheet(); if (sheetTab === 'list') setTimeout(() => { const el = s.querySelector('.kbm-tr.cur'); el && el.scrollIntoView({ block: 'center' }); }, 30); }
  function closeSheet() { const s = sheetEl(); if (!s) return; s.hidden = true; root.classList.remove('sheet-open'); }

  function renderSheet() {
    const t = cur(), playing = !audio.paused, s = sheetEl();
    const tabs = [['now', 'ចាក់ឥឡូវ'], ['list', 'បញ្ជីចាក់'], ['lyrics', 'ទំនុកច្រៀង']];
    let body = '';
    if (sheetTab === 'now') {
      body = `<div class="kbm-big">${coverHTML(t, 'xl')}</div>
        <div class="kbm-bigmeta"><b>${t ? esc(t.t) : 'ជ្រើសរើសបទចម្រៀង'}</b><small>${t ? esc([t.a, t.al].filter(Boolean).join(' · ')) : ''}</small><small class="kbm-from">${t ? 'ពីបញ្ជី ' + esc(plName(S.pl)) : ''}</small></div>
        <div class="kbm-seekrow lg"><span class="kbm-tc">0:00</span><input class="kbm-seek" type="range" min="0" max="1000" value="0" aria-label="ទីតាំងក្នុងបទ"><span class="kbm-td">0:00</span></div>
        <div class="kbm-ctl lg">${btn('sh', 'shuffle', 'ចាក់ចៃដន្យ', 'kbm-sh' + (S.sh ? ' on' : ''))}${btn('prev', 'prev', 'បទមុន')}${btn(playing ? 'pause' : 'play', playing ? 'pause' : 'play', playing ? 'ផ្អាក' : 'ចាក់', 'kbm-pp huge')}${btn('next', 'next', 'បទបន្ទាប់')}${btn('rp', 'repeat', rpLabel(), 'kbm-rp ' + S.rp + (S.rp !== 'off' ? ' on' : ''))}</div>
        <div class="kbm-opts">
          <span class="kbm-volw lg">${btn('mute', S.mute || S.v === 0 ? 'mute' : 'vol', 'សំឡេង')}<input class="kbm-vol" type="range" min="0" max="100" value="${Math.round(S.v * 100)}" style="--p:${Math.round(S.v * 100)}%" aria-label="កំរិតសំឡេង"></span>
        </div>
        <div class="kbm-sleep"><span>${ic('moon')} ឈប់ដោយស្វ័យប្រវត្តិ</span>${[[0, 'បិទ'], [15, '១៥ នាទី'], [30, '៣០ នាទី'], [60, '១ ម៉ោង'], ['end', 'ចប់បទនេះ']].map(([v, l]) =>
          `<button type="button" data-sleep="${v}" class="${String(v) === sleep.sel && (v === 0 || sleep.at || sleep.end) ? 'on' : ''}">${l}</button>`).join('')}<small class="kbm-sleepleft"></small></div>
        <p class="kbm-hint">${POP ? 'បង្អួចនេះចាក់ចម្រៀងបន្ត ពេលអ្នកអាន ឬប្ដូរទំព័រក្នុងបង្អួចមួយទៀត។' : 'គន្លឹះ៖ ចុច ' + ic('pop') + ' ដើម្បីបើកចម្រៀងក្នុងបង្អួចតូចមួយ — ចម្រៀងនឹងមិនឈប់ ពេលអ្នកប្ដូរទំព័រទេ។'}</p>`;
    } else if (sheetTab === 'list') {
      const pl = listPl || S.pl || '__all', q = search.trim().toLowerCase();
      let rows = pl === '__queue' ? S.q.map(id => BY[id]).filter(Boolean) : tracksOf(pl);
      if (q) rows = ALL.filter(x => [x.t, x.a, x.al].filter(Boolean).join(' ').toLowerCase().includes(q));
      body = `<div class="kbm-chips">${[['__queue', 'កំពុងចាក់'], ['__all', 'ទាំងអស់']].concat(PLS.map(p => [p.id, p.km])).map(([id, l]) => `<button type="button" data-pl="${esc(id)}" class="${!q && id === pl ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
        <input class="kbm-search" type="search" placeholder="ស្វែងរកបទចម្រៀង ឬអ្នកច្រៀង…" value="${esc(search)}" aria-label="ស្វែងរកបទចម្រៀង">
        ${!q && pl !== '__queue' ? `<div class="kbm-plhead">${btn('playpl', 'play', 'ចាក់ទាំងអស់', 'kbm-chipbtn')}<span>ចាក់ទាំងអស់</span>${btn('shufpl', 'shuffle', 'ចាក់ចៃដន្យ', 'kbm-chipbtn')}<span>ចាក់ចៃដន្យ</span></div>` : ''}
        <ol class="kbm-list">${rows.map((x, i) => `<li><button type="button" class="kbm-tr${x.id === S.id ? ' cur' : ''}" data-tr="${esc(x.id)}" data-from="${esc(q ? '__all' : pl === '__queue' ? S.pl : pl)}">
          <span class="kbm-n">${x.id === S.id && playing ? eq() : kmNum(i + 1)}</span>${coverHTML(x, 'sm')}<span class="kbm-meta"><b>${esc(x.t)}</b><small>${esc(x.a || '')}</small></span><span class="kbm-dur">${x.d ? fmt(x.d) : ''}</span></button></li>`).join('') || '<li class="kbm-empty">រកមិនឃើញ</li>'}</ol>`;
    } else {
      body = `<div class="kbm-lyrics">${!t ? '' : !t.lyr ? '<p class="kbm-empty">បទនេះមិនទាន់មានទំនុកច្រៀងទេ។<br><small>ដាក់ឯកសារ .lrc ឬ .txt ឈ្មោះដូចឯកសារចម្រៀង ក្នុងថតដដែល។</small></p>' : lyr && lyrFor === t.id ? lyr.html : '<p class="kbm-empty">កំពុងផ្ទុក…</p>'}</div>`;
      if (t && t.lyr && lyrFor !== t.id) loadLyrics(t);
    }
    s.innerHTML = `<div class="kbm-shead"><div class="kbm-tabs">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === sheetTab ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${POP ? '' : btn('closesheet', 'down', 'បិទផ្ទាំង', 'kbm-sx')}</div><div class="kbm-sbody">${body}</div>`;
    progress(); if (sheetTab === 'lyrics') lyricTick(true);
  }

  // ---------- lyrics (.lrc timed, or plain .txt) ----------
  async function loadLyrics(t) {
    lyrFor = t.id; lyr = null;
    try {
      const txt = await fetch(url(t.lyr)).then(r => r.ok ? r.text() : Promise.reject());
      const lines = [];
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
    const b = e.target.closest('[data-a],[data-tab],[data-pl],[data-tr],[data-sleep],.kbm-lyrics p[data-s]'); if (!b) return;
    if (b.matches('.kbm-lyrics p[data-s]')) { audio.currentTime = +b.dataset.s; if (audio.paused) play(); return; }
    if (b.dataset.tab) { sheetTab = b.dataset.tab; renderSheet(); return; }
    if (b.dataset.pl) { listPl = b.dataset.pl; search = ''; renderSheet(); return; }
    if (b.dataset.tr) { playTrack(b.dataset.tr, b.dataset.from); return; }
    if (b.dataset.sleep != null) { const v = b.dataset.sleep; setSleep(v === 'end' ? 'end' : +v); renderSheet(); return; }
    const a = b.dataset.a;
    if (a === 'play') play(); else if (a === 'pause') pause(); else if (a === 'next') step(1); else if (a === 'prev') step(-1);
    else if (a === 'sh') { patch({ sh: !S.sh }); buildQueue(S.pl, S.id); if (owner) save(); render(); }
    else if (a === 'rp') { patch({ rp: { off: 'all', all: 'one', one: 'off' }[S.rp] }); render(); toast(rpLabel()); }
    else if (a === 'mute') { patch({ mute: !S.mute, v: S.mute && S.v === 0 ? 0.6 : S.v }); audio.muted = S.mute; audio.volume = S.v; render(); }
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
    else if (a === 'playpl') playList(listPl || S.pl || '__all', false);
    else if (a === 'shufpl') playList(listPl || S.pl || '__all', true);
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
  }
  function popout() {
    save();
    const w = window.open('music.html?pop=1', 'kbmusic', 'width=420,height=760,menubar=no,toolbar=no');
    if (w) { pause(); toast('ចម្រៀងកំពុងចាក់ក្នុងបង្អួចតូច'); } else toast('សូមអនុញ្ញាតឲ្យបើកបង្អួចថ្មី (pop-up)');
  }
  let toastT = 0;
  function toast(msg) { const t = root && root.querySelector('.kbm-toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }

  // ---------- start ----------
  function init() {
    mount();
    fetch('music/playlist.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { playlists: [] }).catch(() => ({ playlists: [] })).then(d => {
      PLS = (d.playlists || []).filter(p => p.tracks && p.tracks.length);
      ALL = PLS.flatMap(p => p.tracks); BY = Object.fromEntries(ALL.map(t => [t.id, t]));
      S.q = (S.q || []).filter(id => BY[id]);
      if (S.id && !BY[S.id]) { S.id = null; S.playing = false; }
      if (!S.q.length && ALL.length) buildQueue(tracksOf(S.pl).length ? S.pl : '__all');
      if (S.mode === 'fab' && S.id && S.playing) S.mode = 'bar';
      if (S.id) load(S.id, S.t || 0);
      // until songs are added, hide the Music link from the menu (the page itself explains how to add them)
      if (!ALL.length && document.body.dataset.page !== 'music') document.querySelectorAll('nav a[href="music.html"]').forEach(a => a.hidden = true);
      render(); emit();
      // keep playing across pages: resume if it was playing in the last few hours
      if (S.id && S.playing && Date.now() - (S.ts || 0) < 6 * 3600e3 && !POP) play();
      if (POP) { openSheet(S.id ? 'now' : 'list'); if (S.id) play(); document.title = 'ចម្រៀង — Khmer Bible'; }
      readyRes(d);
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

  return {
    ready, get playlists() { return PLS; }, get all() { return ALL; }, get state() { return S; },
    get current() { return cur(); }, get playing() { return !audio.paused; },
    play, pause, toggle, next: () => step(1), prev: () => step(-1), playTrack, playList, openSheet, fmt,
    on(f) { listeners.push(f); }, coverHTML, eq,
  };
})();
