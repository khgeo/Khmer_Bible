/* Shared helpers + live loader for the Khmer Old Version 1954 (ពគប) text. */
'use strict';

const $ = s => document.querySelector(s);
const KD = '០១២៣៤៥៦៧៨៩';
const kmNum = n => String(n).replace(/\d/g, d => KD[d]);
const toAscii = s => s.replace(/[០-៩]/g, d => KD.indexOf(d));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// ---------- page colour themes (dark / light / paper), remembered per browser ----------
const THEMES = [['light', 'ភ្លឺ', '#ffffff'], ['paper', 'ក្រដាស', '#f3ecdc'], ['dark', 'ងងឹត', '#050507']];
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('kb-theme', t); } catch (e) {}
  document.querySelectorAll('.theme button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  window.dispatchEvent(new Event('themechange'));
}
function mountThemeSwitch() {
  const host = document.querySelector('.hdr-right'); if (!host) return;
  const cur = document.documentElement.dataset.theme || 'light';
  const div = document.createElement('div'); div.className = 'theme'; div.setAttribute('role', 'group'); div.setAttribute('aria-label', 'ពណ៌ទំព័រ · Page colour');
  div.innerHTML = THEMES.map(([k, l, sw]) => `<button type="button" data-t="${k}" class="${k === cur ? 'on' : ''}" title="${k}"><i style="background:${sw}"></i>${l}</button>`).join('');
  div.onclick = e => { const b = e.target.closest('button'); if (b) setTheme(b.dataset.t); };
  host.prepend(div);
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mountThemeSwitch) : mountThemeSwitch();

function setStatus(cls, msg) { const s = $('#status'); if (!s) return; s.className = cls; $('#statusText').textContent = msg; }

const KhmerText = (() => {
  // first source that works wins; ?text=URL overrides (same Beblia XML format)
  const SOURCES = [
    'https://cdn.jsdelivr.net/gh/Beblia/Holy-Bible-XML-Format@master/KhmerBFBSBible.xml',
    'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/KhmerBFBSBible.xml',
  ];
  const CACHE = 'pkb1954-v1';
  const WORKER = `
self.onmessage = async ({data:{urls, cacheName, chapters}}) => {
  const bases = []; let g = 0;
  for (const chs of chapters) { const b = []; for (const n of chs) { b.push(g); g += n; } bases.push(b); }
  const out = new Array(g).fill('');
  let xml = null, from = '';
  try { if (self.caches) { const c = await caches.open(cacheName);
    for (const u of urls) { const r = await c.match(u); if (r) { xml = await r.text(); from = 'cache'; break; } } } } catch (e) {}
  if (!xml) for (const u of urls) {
    try {
      const r = await fetch(u, {mode:'cors'}); if (!r.ok) throw new Error(r.status);
      const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const {done, value} = await reader.read(); if (done) break; parts.push(value); got += value.length;
        self.postMessage({progress: got, total}); }
      const blob = new Blob(parts); xml = await blob.text(); from = new URL(u).host;
      try { if (self.caches) (await caches.open(cacheName)).put(u, new Response(blob, {headers:{'content-type':'application/xml'}})); } catch (e) {}
      break;
    } catch (e) { self.postMessage({warn: u + ' → ' + e.message}); }
  }
  if (!xml) { self.postMessage({error: 'all sources failed'}); return; }
  const re = /<book number="(\\d+)"|<chapter number="(\\d+)"|<verse number="(\\d+)"[^>]*>([\\s\\S]*?)<\\/verse>/g;
  const ent = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'"};
  let b = -1, c = 0, m, n = 0;
  while ((m = re.exec(xml))) {
    if (m[1]) { b = +m[1] - 1; c = 0; }
    else if (m[2]) c = +m[2];
    else if (b >= 0 && b < bases.length && c >= 1 && c <= chapters[b].length) {
      const v = +m[3]; if (v < 1 || v > chapters[b][c-1]) continue;
      out[bases[b][c-1] + v - 1] = m[4].replace(/&(#?\\w+);/g, (s, e) => e[0] === '#' ? String.fromCodePoint(+('0' + e.slice(1))) : (ent[e] || s)).trim();
      n++;
    }
  }
  self.postMessage({text: out, count: n, from});
};`;
  let promise = null;
  function load(meta, status = setStatus) {
    if (promise) return promise;
    const qs = new URLSearchParams(location.search).get('text');
    const urls = qs ? [new URL(qs, location.href).href] : SOURCES;
    promise = new Promise((resolve, reject) => {
      const w = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })));
      const mb = x => kmNum((x / 1048576).toFixed(1));
      w.onmessage = ({ data: d }) => {
        if (d.progress) status('', `កំពុងទាញយកអត្ថបទ ពគប… ${mb(d.progress)} MB` + (d.total ? ` / ${mb(d.total)} MB` : ''));
        else if (d.warn) console.warn(d.warn);
        else if (d.error) { status('err', 'មិនអាចភ្ជាប់ទៅអត្ថបទ ពគប បានទេ'); w.terminate(); reject(new Error(d.error)); }
        else if (d.text) {
          status('ok', `ភ្ជាប់ផ្ទាល់ទៅ ពគប ១៩៥៤ · ${kmNum(d.count.toLocaleString('en'))} ខ` + (d.from === 'cache' ? ' (ឃ្លាំងសម្ងាត់)' : ` (${d.from})`));
          w.terminate(); resolve(d.text);
        }
      };
      w.postMessage({ urls, cacheName: CACHE, chapters: meta.books.map(b => b.ch) });
    });
    return promise;
  }
  return { load };
})();

// ---------- Bible structure (books → chapters → global verse index) ----------
const Bible = (() => {
  let p = null;
  function load() {
    if (p) return p;
    p = fetch('data/meta.json').then(r => r.json()).then(meta => {
      const NB = meta.books.length, NC = meta.chapters, NV = meta.verses;
      const chBook = new Int16Array(NC), chNum = new Int16Array(NC), chFirst = new Int32Array(NC + 1),
        bookFirstCh = new Int32Array(NB + 1), verseCh = new Int16Array(NV);
      let c = 0, v = 0;
      meta.books.forEach((b, bi) => {
        bookFirstCh[bi] = c;
        b.ch.forEach((n, k) => { chBook[c] = bi; chNum[c] = k + 1; chFirst[c] = v; verseCh.fill(c, v, v + n); v += n; c++; });
      });
      chFirst[NC] = v; bookFirstCh[NB] = c;
      const B = { meta, NB, NC, NV, chBook, chNum, chFirst, bookFirstCh, verseCh, OT_CH: bookFirstCh[39], OT_V: chFirst[bookFirstCh[39]] };
      B.vNum = g => g - chFirst[verseCh[g]] + 1;
      B.book = c => meta.books[chBook[c]];
      B.chLabel = c => `${B.book(c).km} ${kmNum(chNum[c])}`;
      B.label = g => `${B.chLabel(verseCh[g])}:${kmNum(B.vNum(g))}`;
      B.ref = (c, g) => `${B.book(c).osis}.${chNum[c]}` + (g >= 0 ? `.${g - chFirst[c] + 1}` : '');
      B.parse = s => { // "John.3.16" → {c, g}
        const m = decodeURIComponent(s || '').match(/^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/); if (!m) return null;
        const bi = meta.books.findIndex(b => b.osis === m[1]); if (bi < 0) return null;
        const c = bookFirstCh[bi] + Math.min(Math.max(+m[2], 1), meta.books[bi].ch.length) - 1;
        const g = m[3] ? chFirst[c] + Math.min(Math.max(+m[3], 1), chFirst[c + 1] - chFirst[c]) - 1 : -1;
        return { c, g };
      };
      return B;
    });
    return p;
  }
  return { load };
})();

// ---------- reading progress: last position + chapters read (per browser) ----------
const Reading = {
  last() { try { return JSON.parse(localStorage.getItem('kb-last') || 'null'); } catch (e) { return null; } },
  setLast(ref, label) { try { localStorage.setItem('kb-last', JSON.stringify({ ref, label, t: Date.now() })); } catch (e) {} },
  read() { try { return new Set(JSON.parse(localStorage.getItem('kb-read') || '[]')); } catch (e) { return new Set(); } },
  markRead(c) {
    const s = Reading.read();
    Stats.finished(c);                       // counts toward today, even when re-reading
    track('finished-chapter');
    if (s.has(c)) return s; s.add(c);
    try { localStorage.setItem('kb-read', JSON.stringify([...s])); } catch (e) {}
    return s;
  },
};

// ---------- personal reading statistics (stored only in this browser) ----------
// kb-days = { "YYYY-MM-DD": { s: seconds read, l: [chapters finished that day] } }  (local dates)
const Stats = (() => {
  const KEY = 'kb-days', GOAL = 'kb-goal';
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const day = (o, k) => (o[k] = o[k] || { s: 0, l: [] });
  const active = d => !!d && (d.s >= 60 || (d.l && d.l.length > 0)); // a "reading day": ≥1 min or a finished chapter

  function addTime(sec) { const o = load(); day(o, dayKey()).s += sec; save(o); }
  function finished(c) { const o = load(), d = day(o, dayKey()); if (!d.l.includes(c)) d.l.push(c); save(o); }
  function goal() { try { return +localStorage.getItem(GOAL) || 10; } catch (e) { return 10; } }
  function setGoal(m) { try { localStorage.setItem(GOAL, m); } catch (e) {} }

  function summary() {
    const o = load(), today = new Date(), tk = dayKey(today);
    // current streak: consecutive reading days ending today (or yesterday, if today not started yet)
    let streak = 0, d = active(o[tk]) ? today : addDays(today, -1);
    while (active(o[dayKey(d)])) { streak++; d = addDays(d, -1); }
    // longest streak ever
    const keys = Object.keys(o).filter(k => active(o[k])).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const t = new Date(k + 'T00:00:00');
      run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    }
    // this week (Mon–Sun) and the last 28 days
    const dow = (today.getDay() + 6) % 7; let week = 0, weekDays = 0, last28 = 0;
    for (let i = 0; i <= dow; i++) { const x = o[dayKey(addDays(today, -i))]; if (x) week += x.s; if (active(x)) weekDays++; }
    for (let i = 0; i < 28; i++) if (active(o[dayKey(addDays(today, -i))])) last28++;
    const totalSec = Object.values(o).reduce((a, x) => a + (x.s || 0), 0);
    const totalCh = Object.values(o).reduce((a, x) => a + ((x.l && x.l.length) || 0), 0);
    return { o, today: o[tk] || { s: 0, l: [] }, streak, best, week, weekDays, perWeek: last28 / 4, totalSec, totalCh, days: keys.length, goal: goal() };
  }

  // backup / restore everything this site keeps about your reading
  const KEYS = ['kb-days', 'kb-read', 'kb-last', 'kb-goal', 'kb-fs', 'kb-theme', 'kb-hl', 'kb-plan', 'kb-journal', 'kb-prayers', 'kb-devo', 'kb-myplaylists'];
  function exportJSON() {
    const out = { app: 'khmer-bible', v: 1, at: new Date().toISOString() };
    for (const k of KEYS) { try { const v = localStorage.getItem(k); if (v != null) out[k] = v; } catch (e) {} }
    return JSON.stringify(out, null, 1);
  }
  function importJSON(text) {
    const inc = JSON.parse(text); if (inc.app !== 'khmer-bible') throw new Error('not a backup file');
    // merge days and read chapters so a restore never loses what is already here
    const days = load(); let incDays = {}; try { incDays = JSON.parse(inc['kb-days'] || '{}'); } catch (e) {}
    for (const [k, v] of Object.entries(incDays)) { const d = day(days, k); d.s = Math.max(d.s, v.s || 0); d.l = [...new Set([...d.l, ...(v.l || [])])]; }
    save(days);
    let rd = []; try { rd = JSON.parse(inc['kb-read'] || '[]'); } catch (e) {}
    try { localStorage.setItem('kb-read', JSON.stringify([...new Set([...Reading.read(), ...rd])])); } catch (e) {}
    // highlights and journal: merge, keeping the newer entry for the same verse/day
    for (const k of ['kb-hl', 'kb-journal', 'kb-prayers', 'kb-devo', 'kb-myplaylists']) {
      let cur = {}, add = {}; try { cur = JSON.parse(localStorage.getItem(k) || '{}'); add = JSON.parse(inc[k] || '{}'); } catch (e) {}
      for (const [id, v] of Object.entries(add)) if (!cur[id] || (v.t || 0) >= (cur[id].t || 0)) cur[id] = v;
      try { localStorage.setItem(k, JSON.stringify(cur)); } catch (e) {}
    }
    if (inc['kb-plan'] && !localStorage.getItem('kb-plan')) try { localStorage.setItem('kb-plan', inc['kb-plan']); } catch (e) {}
    for (const k of ['kb-last', 'kb-goal', 'kb-fs']) if (inc[k] != null) try { localStorage.setItem(k, inc[k]); } catch (e) {}
  }
  function reset() { for (const k of ['kb-days', 'kb-read', 'kb-last', 'kb-plan']) try { localStorage.removeItem(k); } catch (e) {} }
  return { dayKey, addDays, addTime, finished, goal, setGoal, summary, exportJSON, importJSON, reset, active };
})();

// Active reading timer: counts only while the tab is visible AND the reader has
// scrolled, tapped or pressed a key within the last 90 s — an idle open tab adds nothing.
function startReadingTimer() {
  const STEP = 15, IDLE = 90e3; let lastAct = Date.now();
  const bump = () => { lastAct = Date.now(); };
  ['scroll', 'keydown', 'pointerdown', 'pointermove', 'touchstart', 'wheel'].forEach(e => addEventListener(e, bump, { passive: true }));
  document.addEventListener('visibilitychange', bump);
  setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - lastAct > IDLE) return;
    Stats.addTime(STEP);
    dispatchEvent(new Event('statsupdate'));
  }, STEP * 1000);
}
const fmtMin = sec => { const m = Math.floor(sec / 60); return m < 60 ? `${kmNum(m)} នាទី` : `${kmNum(Math.floor(m / 60))} ម៉ោង ${kmNum(m % 60)} នាទី`; };
function mountContinue() {
  const host = document.querySelector('.hdr-right'), L = Reading.last();
  if (!host || !L || document.body.dataset.page === 'read') return;
  const a = document.createElement('a'); a.className = 'continue'; a.href = 'read.html#' + L.ref;
  const st = Stats.summary().streak;
  a.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 5.5C6.5 4 9.5 4 12 5.5v14c-2.5-1.5-5.5-1.5-8 0zM12 5.5c2.5-1.5 5.5-1.5 8 0v14c-2.5-1.5-5.5-1.5-8 0z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>បន្តអាន <b>${esc(L.label)}</b>` +
    (st ? `<span class="streak" title="អានជាប់គ្នា ${st} ថ្ងៃ">🔥 ${kmNum(st)}</span>` : '');
  host.prepend(a);
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mountContinue) : mountContinue();

// Sticky header: keep its height in --hdr (for other sticky bits and jump-to offsets) and
// shrink it once the page is scrolled. Two thresholds so it doesn't flicker at the edge.
function mountStickyHeader() {
  const h = document.querySelector('body > header'); if (!h) return;
  const setH = () => document.documentElement.style.setProperty('--hdr', h.offsetHeight + 'px');
  setH(); if (window.ResizeObserver) new ResizeObserver(setH).observe(h); else addEventListener('resize', setH);
  let on = false, raf = 0;
  const check = () => { raf = 0; const y = scrollY; const want = on ? y > 8 : y > 90; if (want !== on) { on = want; document.body.classList.toggle('compact', on);
      // on phones the menu becomes one scrolling row: keep the current page's tab in view
      const nav = h.querySelector('nav'), a = nav && nav.querySelector('a.on');
      if (on && a && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - nav.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2; } };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(check); }, { passive: true });
  check();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mountStickyHeader) : mountStickyHeader();

// ---------- verse of the day (same verse for everyone on a given date) ----------
// 1945 hand-checked verses (about 5 years) — no verse repeats until the list has been used up.
// Day 0 is VOTD_START; scripts/daily_post.py reads this same list, so the site and the posts always match.
const VOTD_START = '2026-11-01';
const VOTD = [
  'Lam.3.25', 'Isa.42.1', 'Ps.91.1', 'Heb.13.8', 'Mark.16.15', 'Luke.21.36', 'Rom.10.11', 'Isa.40.29', 'Eph.2.5', 'Rom.8.1',
  '2Cor.5.21', '1Cor.15.58', 'Matt.6.33', 'Isa.48.17', '1Pet.2.9', 'Jer.24.7', 'Ps.32.8', 'Isa.53.5', 'Jer.17.7', 'Ps.37.4',
  'Col.3.1', 'John.8.32', 'Rev.22.1', 'Phil.4.19', 'Isa.28.16', 'John.16.33', 'Luke.11.9', 'Jer.29.11', '2Cor.10.4', 'Prov.3.6',
  'Isa.55.7', '1Pet.5.7', 'John.4.10', 'Ps.1.1', 'Lam.3.22', '1John.3.1', 'Prov.28.13', 'Mic.7.18', '1Tim.1.15', 'Prov.29.23',
  'Rom.8.29', '2Cor.5.10', 'John.15.5', 'Eph.5.8', '1Cor.4.5', '1Pet.2.24', '2Cor.7.1', 'John.3.3', 'Isa.53.6', 'Gen.15.1',
  'Jas.5.16', 'Rev.5.9', 'Col.3.10', 'Matt.16.27', 'Phil.4.7', 'John.1.14', 'Ps.40.5', 'Gal.5.22', 'Heb.10.16', '2Cor.3.17',
  'Luke.12.31', 'Hos.6.6', 'Ps.62.8', '1John.1.7', 'Jas.1.19', 'John.10.27', 'Prov.3.5', '1Pet.5.8', 'John.4.14', 'Prov.21.3',
  'Isa.26.4', 'Rom.8.2', 'Phil.2.13', 'John.15.13', 'Col.4.6', 'Eph.2.8', 'Ezek.36.27', 'John.14.27', 'Isa.44.22', '1Cor.3.16',
  '1Pet.2.11', 'Ps.50.15', 'Matt.5.16', 'Isa.65.24', 'Ps.34.15', 'Luke.11.28', 'Eccl.3.1', 'Ps.37.3', '2Cor.5.7', 'Isa.12.2',
  'Heb.12.1', 'Luke.1.37', '2Tim.2.19', 'Isa.41.10', 'Josh.1.9', 'Matt.11.27', 'Rom.5.1', 'Luke.2.11', 'Ps.46.7', '1Cor.16.13',
  'Jas.3.17', 'Prov.19.21', 'Rom.8.13', 'Ps.118.6', 'John.15.7', '1John.4.19', 'Eph.4.32', 'Ezek.36.26', 'Prov.13.3', 'Eph.5.14',
  '1Pet.1.22', 'Isa.43.2', 'Eph.6.12', '1Pet.3.18', 'Isa.58.11', 'Acts.1.8', 'Heb.11.1', 'Eph.2.10', 'Ps.37.5', '1Thess.5.24',
  'Rev.22.17', 'Ps.145.18', '1Cor.13.4', 'Isa.64.4', 'Jer.33.3', 'Deut.6.5', '1John.2.15', 'Prov.28.26', 'John.14.23',
  '2Cor.5.17', 'Heb.13.15', 'Jer.15.16', 'Ps.16.11', 'Rom.8.37', 'Col.3.12', 'Isa.44.3', 'Exod.15.11', 'Matt.24.35', 'Rom.15.4',
  'Deut.3.22', 'John.11.25', 'Rev.21.6', 'Isa.40.8', 'Prov.16.3', 'Heb.7.25', 'Isa.60.19', '1John.4.4', 'Mal.4.2', 'Eph.2.18',
  'Matt.28.19', '1Thess.5.23', 'Ps.84.11', 'John.7.37', 'Gen.18.14', 'Luke.19.10', 'Rom.12.1', '2Cor.12.9', 'Isa.57.15',
  'Ps.31.19', 'John.14.21', 'Isa.61.1', 'Heb.13.5', 'Ps.25.3', 'John.3.16', 'Rom.1.16', 'Ps.37.7', '1Pet.3.9', 'Heb.4.12',
  'Ps.27.1', 'John.15.16', 'Acts.2.17', 'Ps.34.8', 'John.1.12', 'Isa.40.31', 'Rev.21.4', 'Heb.6.10', 'Isa.45.24', '2Cor.4.18',
  'Zech.9.9', 'Isa.41.14', 'Eph.1.3', 'Exod.14.14', 'Phil.4.13', 'John.6.27', 'Isa.9.6', 'Ps.121.1', '1John.5.3', 'Isa.46.10',
  'Eph.6.10', 'Matt.6.25', 'John.14.26', 'Eph.2.4', '2Cor.6.16', 'Isa.44.2', 'John.3.5', 'Jer.6.16', 'Matt.19.26', 'Rom.5.10',
  'Deut.20.4', 'Matt.1.23', 'Josh.1.8', 'John.12.46', 'Matt.11.29', 'Ps.139.14', '1Pet.2.25', 'Gal.3.13', 'Ps.55.22',
  'Heb.12.14', 'John.5.24', 'Isa.55.3', 'Heb.13.6', 'John.10.28', 'Rev.2.10', 'Phil.4.8', 'Prov.16.9', 'Ps.91.15', 'Heb.10.36',
  '1John.5.14', 'Rom.14.17', '1Cor.1.30', 'Eph.1.5', 'John.14.6', 'Heb.8.10', 'Ps.86.15', 'Mark.11.24', 'Col.3.16', 'Ps.23.4',
  'Isa.66.2', '1Pet.5.10', 'Ps.119.11', '1Thess.5.16', 'John.8.12', 'Ps.29.11', 'Eph.4.29', 'Gal.6.9', 'Ps.51.10', 'Jas.1.17',
  '1Pet.1.3', 'Rom.8.15', 'Deut.4.9', 'Matt.5.9', 'Jas.4.8', 'Jer.17.8', 'Gal.2.20', 'Prov.1.23', 'Heb.13.16', 'Exod.34.6',
  'Rev.21.3', 'Mic.6.8', 'John.13.17', '1Pet.4.7', 'Prov.4.18', '2Cor.12.10', '1Tim.3.16', 'Phil.1.6', '2Cor.4.16', 'Col.4.2',
  'John.1.1', '1John.1.9', 'Matt.9.13', 'Isa.45.17', 'Ps.100.3', 'Joel.2.28', 'Josh.23.10', 'Ps.18.2', 'Rom.12.2', 'Matt.11.28',
  'Isa.40.11', 'Job.23.12', 'Rom.8.31', 'Matt.22.37', 'Ps.34.18', 'Jas.2.5', 'Isa.1.18', 'Prov.18.10', 'Jas.1.5', 'Lam.3.26',
  'Rom.15.13', 'Deut.30.6', '1Sam.16.7', 'Heb.11.6', 'John.14.15', 'Rom.6.23', 'Gal.5.6', 'Col.1.17', '2Pet.3.18', '2Cor.4.17',
  'Prov.4.23', 'Jer.17.10', '1John.4.10', 'Col.3.23', 'Mark.16.16', 'John.10.9', 'Jer.1.5', 'Prov.21.30', 'Ps.27.14', 'Rom.5.8',
  '1Cor.6.19', 'Isa.44.6', 'Job.23.13', '1John.3.2', 'Isa.55.6', 'John.1.18', 'Matt.20.28', 'Isa.43.19', 'Ps.46.11',
  '1Cor.10.13', 'Rom.10.9', 'Rev.4.11', 'John.7.38', 'Phil.4.6', 'Ps.145.19', 'Heb.4.16', '1Cor.2.9', '2Tim.3.16', 'John.6.40',
  'Matt.10.28', '2Cor.4.6', 'Luke.10.19', 'Gal.5.13', '1John.4.9', '1Sam.15.22', 'Deut.8.3', 'John.10.30', 'Rom.8.28',
  'Matt.7.7', '1Thess.5.18', 'Deut.31.6', 'John.17.3', 'Jas.1.12', 'Isa.60.1', 'Rev.1.8', 'Acts.3.19', 'John.1.29', 'Rev.11.15',
  'Isa.7.14', 'Ps.46.1', 'Rev.12.11', 'Gen.1.1', 'Ps.147.3', 'Acts.2.38', '2Thess.3.3', 'Ps.23.1', 'Matt.5.6', '2Tim.1.7',
  'Rom.12.12', 'Ps.33.10', 'Rev.7.17', 'Isa.59.21', 'Ps.1.3', 'Gal.5.1', '1John.5.20', 'Ps.119.105', 'Jer.32.27', '2Cor.5.15',
  'Heb.4.13', 'Col.1.13', 'John.10.11', 'Rev.3.19', 'Isa.43.1', '1John.2.16', '2Tim.4.18', 'Acts.2.39', 'Matt.5.3', 'Jer.32.17',
  'Mal.3.1', '2Cor.9.6', 'Rom.15.1', '2Pet.1.17', 'John.12.26', 'Rom.8.9', 'Isa.55.12', 'John.15.4', '1Pet.1.6', '1Tim.1.5',
  'Rev.15.4', 'Heb.3.14', 'Ps.57.5', 'Prov.1.7', 'Titus.2.11', '2Cor.6.17', 'Isa.44.24', 'Titus.3.4', '2Pet.2.9', '1John.1.8',
  'Jas.1.3', '2Pet.1.3', 'Eccl.7.20', 'Amos.3.7', 'Rom.10.17', 'Mal.3.6', 'Isa.61.10', 'Gen.3.15', 'Jas.5.11', 'John.7.39',
  'Gen.17.1', 'Prov.20.22', 'Gal.6.7', 'Ps.63.8', 'Gal.6.10', 'John.20.17', 'Ps.84.12', 'Eph.4.1', '1Cor.13.13', 'John.16.13',
  'Isa.6.3', 'Ps.37.34', '1Cor.14.20', 'Heb.10.23', 'Ps.27.5', 'Isa.50.4', '2Cor.13.5', 'Eccl.11.6', 'Rev.21.23', '1John.4.1',
  'Eccl.12.13', 'Heb.12.3', 'Heb.1.14', 'Isa.54.5', 'Acts.20.24', 'Isa.40.28', '1Pet.1.13', 'Jas.1.25', 'John.1.3', 'Exod.20.12',
  'Deut.7.6', 'Luke.21.34', 'Isa.45.22', 'Ps.72.19', 'Jas.1.26', 'John.6.45', 'Heb.10.38', 'Isa.35.5', 'John.6.37', 'Isa.30.18',
  'Rev.2.7', 'Hos.10.12', 'Mal.3.10', 'Isa.49.10', '1Pet.2.6', '1Pet.4.8', 'Ps.36.7', 'Rom.11.33', 'Prov.6.23', 'Isa.11.2',
  'Luke.21.15', 'Ps.63.1', 'John.6.51', 'Eph.3.8', 'Ps.36.8', 'Ps.28.7', 'Ps.112.1', 'Isa.55.10', 'Rom.8.6', 'John.15.2',
  'Isa.3.10', '2Chr.15.7', '1John.4.12', 'Isa.55.9', 'Isa.45.18', 'Ps.138.8', 'Deut.33.29', '1Pet.4.14', 'Mark.2.17',
  'Phil.1.27', 'Prov.3.7', 'Prov.19.17', 'John.16.24', 'John.17.26', '2Tim.2.1', 'Rom.7.22', 'Luke.6.35', 'Ps.34.19',
  '1Pet.1.25', 'Luke.2.14', 'Gal.3.28', 'Ps.125.1', 'Acts.20.28', 'Ps.3.3', 'Isa.8.10', '1Pet.1.15', 'Gal.4.4', '1Pet.3.8',
  'Isa.1.19', 'Rev.1.7', '1Cor.2.14', 'Isa.51.6', '1Thess.5.15', 'Rev.2.17', 'Ps.139.23', 'Jas.3.18', 'Isa.40.3', 'Rom.8.25',
  'Jas.1.2', 'Isa.58.8', 'Gen.50.20', 'Rom.9.33', 'John.17.24', 'Ps.17.8', '1Cor.10.31', 'Jas.1.22', '1John.4.16', '1John.3.16',
  'Gal.1.10', 'Ps.37.24', 'Heb.3.6', 'Isa.55.8', 'Phil.2.12', 'Rev.22.14', 'Isa.49.8', 'Jas.2.13', '1Pet.4.13', 'Zech.10.12',
  'Luke.12.32', 'Phil.2.3', '1Pet.3.15', 'Mic.7.19', 'Ps.2.7', '1Tim.1.17', 'Isa.53.10', 'Job.42.2', 'Col.3.4', 'Prov.3.9',
  'John.16.23', 'Eph.4.30', 'Jude.1.20', 'Ps.32.7', 'Col.3.2', 'Rom.5.20', 'Isa.51.12', 'Luke.14.26', 'Ezek.37.27', 'Jas.3.13',
  'Prov.18.21', '1Pet.4.11', '1John.3.18', 'Deut.10.12', 'Eph.5.17', 'Rom.1.17', 'Prov.30.5', 'Ps.103.17', '1Tim.1.16',
  'Ps.139.24', '1Tim.6.12', '2Cor.3.5', '2Tim.2.25', '1Sam.30.6', 'Hab.2.3', 'Rev.22.13', 'Rom.5.3', 'Isa.53.12', '1Pet.1.23',
  'John.7.17', 'Phil.4.4', 'Rev.17.14', 'Heb.1.2', '1Tim.4.12', '2Cor.6.14', 'Eccl.12.14', 'Ps.127.1', 'Phil.3.3', 'Hos.6.1',
  'Ps.27.4', 'Phil.1.9', 'Hos.1.10', '1Pet.3.12', '2Tim.2.22', 'Isa.55.1', 'Deut.4.29', '2Thess.2.13', '1Pet.2.23', '1Cor.15.33',
  'Luke.10.27', 'Ezek.39.29', 'Lam.3.40', 'John.20.31', 'Ps.34.9', '1Pet.2.10', 'Deut.6.7', 'Rom.3.23', 'Jas.1.21', '1Thess.4.1',
  'Col.3.3', 'Ps.27.13', 'Ps.110.1', 'Prov.10.22', 'John.17.5', 'Isa.41.13', 'Ps.19.14', 'Ps.19.10', '2Chr.32.8', 'Ps.102.13',
  '2Pet.3.10', 'Heb.9.15', '1Thess.5.11', 'Rom.8.34', 'Exod.19.5', 'Gal.3.26', 'Isa.25.9', 'Prov.2.6', '2Pet.3.9', 'Rom.11.36',
  '1Thess.2.13', '2Cor.8.9', '1Tim.6.17', 'Jas.5.7', '1John.3.3', 'Jas.1.18', 'Ezek.34.23', 'John.14.1', 'Deut.32.4', 'John.1.4',
  'Dan.7.13', 'Rom.13.12', 'Isa.42.16', 'Zeph.3.17', 'Heb.9.28', 'Rom.8.17', 'Jas.4.10', 'John.1.2', '1Cor.8.6', '1Pet.5.6',
  '2Pet.1.10', '2Cor.6.18', 'Ps.34.4', 'Mark.10.27', 'Zeph.3.19', 'Luke.18.14', 'John.15.14', '1John.4.15', 'Rev.15.3',
  '1Cor.15.49', 'John.3.34', 'Heb.8.12', 'Eccl.9.10', 'Luke.14.11', 'Ps.35.1', 'John.1.17', 'Isa.41.17', 'Mal.1.11', 'Gal.6.8',
  'John.13.34', 'Ps.86.5', 'Prov.3.1', 'Jas.4.6', '1Pet.1.18', 'John.3.17', 'Isa.52.7', 'Col.3.15', 'Gen.12.2', 'Prov.13.20',
  'Ps.22.27', 'Rev.1.17', '1John.3.17', 'Ps.25.9', 'Ps.36.9', 'Ps.56.4', 'Gen.28.15', '1Cor.1.10', '1Cor.15.10', '1Chr.29.11',
  'Gal.6.1', 'Isa.35.4', 'Gen.17.7', 'Ezek.18.31', '1Cor.3.19', 'Rev.1.18', 'Heb.11.7', 'Matt.17.5', 'Ps.1.2', 'Col.1.18',
  'Jer.10.23', 'Ps.23.5', 'Ps.46.10', 'Jer.9.23', '2Tim.4.7', 'Matt.7.24', 'Ps.33.6', 'Matt.1.21', 'Jer.32.40', 'Ps.119.97',
  'Rom.12.10', 'Matt.16.18', 'Jer.1.19', 'Matt.11.25', 'Matt.4.4', 'Matt.10.37', '2Tim.4.8', 'Matt.12.50', 'Rev.3.20',
  'Gal.5.16', 'Matt.25.21', '1John.2.6', 'Jer.23.6', 'Rev.3.5', 'Rom.12.16', 'Matt.7.8', 'Matt.5.12', '2Tim.4.2', 'Matt.23.12',
  '1John.5.1', 'Matt.7.11', '1John.5.4', 'Rom.12.19', 'Col.1.27', 'Rom.12.9', 'Ps.1.6', 'Matt.12.35', '1John.5.15', 'John.10.29',
  'Matt.5.11', 'Matt.6.13', '1John.5.11', 'Col.1.16', 'Matt.7.21', 'Jer.33.6', 'Ps.119.103', 'Acts.2.33', 'Jer.23.5', 'Heb.4.15',
  '2Cor.5.20', '2Tim.4.17', 'Jer.32.39', 'Isa.43.5', 'Matt.3.2', 'Ps.23.3', 'Matt.5.18', 'Matt.5.8', 'Jer.20.11', '2Thess.3.16',
  'Matt.26.41', 'Gen.2.24', 'Ps.25.12', 'Rom.5.4', 'Ps.20.7', 'Phil.3.13', 'Ezek.37.26', 'John.3.27', 'Isa.38.17', '1Cor.6.20',
  'Acts.9.15', 'Eph.6.6', '2Cor.1.22', 'Luke.8.15', 'Ps.142.5', 'Gal.6.15', 'Rev.14.13', 'Ps.146.5', 'John.12.49', '2Cor.9.11',
  'John.5.39', 'Ps.71.18', '1Sam.2.9', 'Rom.6.14', '2Tim.3.5', 'Gal.6.2', 'Matt.10.16', 'Rom.8.24', '2Cor.4.2', 'Mark.14.38',
  'Prov.8.17', 'John.14.3', 'Rom.5.12', 'Phil.2.9', '1Sam.2.8', 'Hos.6.3', '1John.2.4', 'Isa.60.20', 'Ps.25.7', 'Matt.18.19',
  '2Tim.1.8', 'John.8.36', 'Ps.32.5', 'Isa.55.2', 'John.5.25', 'Hos.3.5', 'Col.4.5', '1John.2.20', 'Zech.8.8', 'Col.2.15',
  'John.13.1', 'John.8.42', 'Prov.3.10', 'Deut.4.7', 'John.17.1', 'Luke.7.50', '1Thess.2.4', 'Acts.13.47', 'Rev.3.18', 'Jas.1.4',
  'Matt.10.38', 'John.9.31', 'Isa.1.16', 'Ps.10.17', '2Cor.9.10', 'John.17.8', 'Ps.91.4', '1Thess.5.6', '1John.1.5', 'Col.3.8',
  'John.6.68', '1Thess.4.16', 'Isa.58.14', 'Rom.8.26', '1Tim.6.11', 'Jas.5.9', 'Rev.7.16', 'Luke.1.50', '2Tim.2.15', 'Luke.5.32',
  'Isa.49.1', 'Ps.40.2', 'Ps.37.17', '1Cor.3.9', 'Luke.15.10', 'Hos.14.9', '2Cor.1.10', 'Ps.18.28', 'Isa.66.1', 'Dan.4.37',
  'Ps.40.1', '2Pet.1.21', 'Rom.6.6', 'Mal.3.2', 'Gal.5.14', '1John.3.24', '1Cor.9.24', 'Heb.13.9', 'Isa.65.17', 'Ps.31.20',
  'John.14.10', 'Isa.60.21', 'Ps.149.4', 'Rev.22.16', '1Pet.3.11', 'Acts.13.39', 'Gal.1.15', 'Rom.5.6', 'Luke.6.38', 'Ps.107.9',
  'Ps.133.1', 'Lam.3.23', 'Ps.112.9', 'Isa.11.1', 'Rom.6.22', 'Luke.6.46', 'Ps.33.20', 'John.6.38', 'Eph.5.11', 'Heb.13.17',
  'Luke.22.32', 'Eph.5.9', '1Pet.4.12', 'Luke.18.7', 'Isa.52.10', 'Ps.91.11', 'Prov.23.19', '2John.1.6', 'Acts.17.31',
  'Ps.143.10', 'John.15.10', 'Eph.6.17', 'Ps.19.8', 'Luke.11.13', 'Ps.34.14', 'Deut.8.2', '1Cor.1.18', 'Deut.12.32', 'Rom.13.11',
  'John.16.22', 'Heb.2.9', 'Eph.6.4', 'Isa.11.10', 'Luke.13.24', 'Heb.3.13', 'John.15.15', 'Exod.14.13', 'Jas.1.6', 'Isa.51.16',
  'Ps.128.1', '1Tim.4.16', 'Heb.10.25', 'Exod.20.11', 'Ps.34.7', 'Ps.25.5', 'Ps.57.1', 'John.17.17', 'Matt.18.10', 'Luke.18.27',
  'Matt.21.21', 'Deut.7.9', 'Rev.3.8', 'Matt.26.28', 'Mark.11.23', 'Isa.58.9', 'Phil.1.23', 'Prov.2.7', 'Isa.35.3', 'Eph.5.1',
  'Deut.11.19', '2Cor.4.1', 'Ps.27.8', '1Pet.5.9', 'Rev.4.8', 'Jas.1.14', '1John.2.3', 'Exod.20.2', '1Pet.4.1', 'Exod.20.6',
  'Ezek.34.26', 'Heb.10.39', 'Isa.54.10', 'Prov.15.3', 'Rev.19.1', 'Rev.19.16', '1Tim.2.5', 'Heb.6.11', 'Matt.16.16', 'Jas.5.8',
  'John.19.30', '1Cor.12.13', 'Rev.2.11', 'Hab.2.14', '1Tim.6.18', 'Acts.11.23', 'Acts.10.43', 'Prov.16.1', 'Luke.6.37',
  'Rev.22.12', 'Deut.31.7', 'Ps.2.6', 'John.15.26', 'Ps.107.35', '1Tim.4.8', 'Heb.13.1', '1Pet.1.24', 'Ps.37.25', '1Cor.15.57',
  'John.3.6', 'Matt.18.20', 'Isa.12.6', 'Isa.2.11', 'Rom.3.24', '1Cor.3.18', '1Pet.1.16', 'Col.3.14', 'Prov.14.29', '2Tim.2.12',
  'Heb.2.1', 'Heb.11.8', 'Rev.14.7', '1Thess.5.21', '1John.2.1', '1Pet.2.21', 'Phil.4.18', 'Col.2.9', 'Luke.12.22', 'John.14.20',
  '1Tim.1.14', 'Rom.6.4', 'Exod.15.2', 'Isa.25.4', 'Acts.17.24', '2Pet.3.14', 'Rom.8.18', '1Pet.2.15', '1Cor.3.11', 'John.6.29',
  'Heb.12.28', 'Isa.64.8', 'Ps.145.14', 'Isa.50.10', 'Mic.7.8', 'Ps.56.11', 'Isa.42.6', 'Isa.44.23', 'Ps.33.9', 'Heb.11.3',
  'John.11.40', '1John.2.5', 'Ps.73.24', 'Ps.143.8', 'Isa.60.3', 'Eph.4.26', 'Matt.25.31', 'Ps.104.34', 'Gal.5.17', 'Luke.1.13',
  'Ps.84.10', 'Isa.53.3', 'Gen.22.18', '1Sam.14.6', '1Pet.2.1', 'Rev.19.13', 'Ps.139.2', 'Ps.138.3', 'Gen.2.7', 'Matt.24.13',
  'Heb.11.13', 'Heb.9.24', 'Ps.56.3', 'Zech.2.11', '2Cor.4.7', 'Ezek.34.13', 'Heb.11.16', 'John.14.9', 'Matt.17.20', 'Rev.5.12',
  '1Pet.4.19', 'Ps.25.14', 'Prov.16.18', 'Eccl.5.1', 'Heb.7.26', '3John.1.11', 'Acts.16.31', 'Zeph.3.15', '1Tim.6.10',
  'Eph.6.13', 'Gen.1.26', 'John.6.35', 'Exod.34.7', '1Thess.5.8', 'Col.2.8', '1Thess.5.14', '1Cor.13.12', 'Rev.3.11', 'Luke.1.6',
  'Ps.62.5', 'John.5.21', 'Matt.26.64', 'Prov.15.29', 'John.15.8', '1John.3.5', 'Rom.13.13', 'Heb.10.35', 'Jas.3.2', 'Ps.104.24',
  'Matt.16.26', 'Prov.28.1', 'Acts.17.30', 'Acts.20.35', 'Hab.2.4', 'Ps.91.14', '1John.2.29', '1Pet.3.14', 'Isa.64.6',
  'Isa.54.4', 'Ps.33.18', '2Cor.1.12', 'Phil.2.5', '1Sam.12.22', 'Isa.12.3', 'Ps.46.2', 'Ps.119.2', '2Thess.2.14', 'John.10.16',
  'Ps.119.111', 'Matt.5.5', 'Ps.119.72', 'Col.1.9', '2Thess.1.11', 'Matt.6.6', 'Matt.5.7', 'John.10.15', 'Col.1.28', 'Jer.23.29',
  'Matt.6.10', 'Ps.119.9', 'Matt.7.12', '2Thess.1.3', 'Matt.5.4', '2Tim.4.3', 'Col.1.14', 'Matt.12.7', 'Jer.31.31', 'Col.1.22',
  'Ps.119.130', 'Ps.119.1', 'Matt.7.14', 'Matt.7.13', '1John.5.5', 'Ps.119.10', 'Matt.6.9', 'Jer.4.14', 'Jer.1.8', 'Rom.12.18',
  'Acts.2.42', '1John.5.2', '2Thess.3.13', '2Cor.5.14', 'Jer.31.3', 'Jer.23.24', 'Matt.7.2', 'Jer.2.13', 'Matt.5.48',
  'Deut.14.2', 'Ps.72.17', 'Gen.22.14', 'Luke.9.26', '1Cor.13.5', 'Mal.4.5', 'Acts.13.38', 'Rev.7.10', 'Gen.26.4', 'Ps.63.7',
  'Hab.3.18', 'Deut.5.16', 'Josh.1.6', 'Ps.100.5', 'Prov.23.17', 'Acts.16.25', '2Pet.2.18', '2Kgs.20.5', 'Ps.19.11', '2Cor.2.14',
  'Job.1.21', 'Isa.1.17', '1Tim.2.6', 'Prov.17.22', 'Prov.27.9', 'Ps.79.9', '1Tim.4.6', 'Ps.118.8', 'Deut.8.18', 'Prov.27.17',
  'Isa.62.11', 'John.20.29', 'Prov.23.23', 'Gen.49.18', 'Ps.123.2', 'Rom.10.15', '1Chr.28.10', 'Acts.4.20', 'Ps.42.5',
  'Eccl.11.9', 'Zech.8.23', 'Gen.1.28', 'Rom.1.20', 'Deut.13.4', '1Kgs.8.27', 'Ps.138.6', 'Zech.2.5', '1Chr.16.34', 'Rev.20.6',
  'Ps.121.7', 'Hag.2.9', 'Ps.103.13', 'Isa.61.6', 'Rev.1.16', 'Dan.12.10', 'Phil.3.12', 'Ps.100.4', 'Ps.107.22', '1Tim.5.17',
  'Prov.13.22', 'Acts.22.16', 'Eph.4.15', 'Deut.6.4', 'Ps.143.2', '2Cor.6.2', '1Cor.11.1', 'Ps.17.3', 'Prov.16.32', 'Ps.46.5',
  'John.17.25', 'Deut.10.20', 'Prov.22.6', 'Gen.28.14', 'Ps.37.31', 'Ps.121.5', '1Cor.13.2', 'Ps.8.3', 'Acts.5.41', '2John.1.8',
  'Ps.11.4', 'Col.2.6', 'Acts.20.27', 'Acts.5.29', 'Isa.42.9', 'Isa.30.15', 'Prov.5.21', 'Prov.9.6', 'Luke.12.5', '2Cor.13.14',
  'Ps.14.2', 'Ps.123.1', 'Rom.4.16', 'Prov.11.30', 'Ps.58.11', 'Gen.12.7', 'Zech.2.13', '1John.4.21', 'Mark.9.50', 'Ps.121.3',
  'John.6.56', 'Ps.130.5', 'Prov.16.7', 'Deut.18.18', 'Heb.1.12', 'Rom.4.5', 'Ps.42.11', 'Isa.2.2', 'Ps.16.10', '1Cor.9.26',
  '2Cor.9.7', 'Ps.43.3', 'John.6.33', 'Isa.30.19', 'Eph.5.18', 'Rev.7.9', '1John.1.3', 'Deut.5.32', 'Heb.2.17', 'Ps.65.5',
  'Ruth.2.12', 'Eph.4.31', 'Ps.62.7', 'Rev.3.12', '1Sam.15.29', 'Prov.10.19', '1John.4.7', 'Isa.48.21', 'Ps.32.6', 'Acts.9.31',
  'Ps.89.34', 'Prov.17.3', 'Luke.2.10', 'Ps.126.2', 'Mark.1.15', 'Gen.1.27', 'Jas.2.8', 'Rom.13.8', 'Hos.14.2', 'Hag.2.8',
  'Prov.12.18', 'Prov.4.7', 'Mark.9.23', 'Ps.115.3', 'Ps.102.25', 'Titus.3.1', 'Isa.8.20', 'Ps.146.8', 'Joel.2.12', 'Rom.3.20',
  '1Cor.2.10', 'Ps.107.20', 'Ps.90.1', 'Mic.4.1', 'Luke.15.32', 'Isa.61.9', 'Eph.2.19', 'Ps.95.7', 'Ps.23.6', 'Acts.4.31',
  'Ps.50.14', '1Cor.12.12', 'Rev.19.11', 'Prov.20.24', 'John.21.15', 'Lam.3.37', 'Rom.7.4', 'Ps.106.45', 'Acts.15.9', '2Cor.1.3',
  '2Cor.4.11', 'Job.23.10', 'Rom.14.19', 'Prov.15.18', 'Rom.6.16', 'Prov.21.23', 'Isa.59.17', 'Acts.11.18', 'Deut.10.17',
  'Eccl.12.1', 'Acts.1.7', 'Acts.3.26', 'Ps.40.3', 'Isa.26.9', 'Ps.92.5', 'Isa.35.6', '1Thess.4.7', 'Ps.61.2', 'Jas.4.14',
  'Ps.105.3', 'Ps.98.3', 'Ps.86.9', '1Sam.2.2', 'Prov.3.21', 'John.17.4', 'Ps.97.11', 'Gal.3.27', 'Ps.21.13', 'Ps.105.4',
  'Rom.10.4', 'Ps.72.18', 'Job.1.1', 'Luke.23.43', '1Thess.4.14', '1Thess.1.5', 'Ps.110.4', 'Deut.33.26', 'Rom.14.9',
  'Acts.18.9', 'Ps.22.1', 'John.9.4', '1Pet.2.22', 'Deut.4.2', 'Zech.9.12', 'Rom.9.26', 'Mal.3.16', 'Isa.53.2', 'John.13.35',
  'Ps.69.9', '2Cor.4.10', 'Ps.25.8', 'John.18.37', 'Ps.16.8', 'Prov.11.18', 'Acts.21.13', 'Ps.93.1', 'Luke.8.48', 'Ps.54.4',
  'Mark.10.29', 'Prov.18.12', 'Ps.51.12', '1Cor.11.32', 'Rom.7.6', 'Ps.71.17', 'Hos.1.7', 'Ps.92.14', 'Rev.5.8', 'Heb.2.10',
  'Ps.92.10', 'Isa.52.1', 'Dan.6.22', 'Isa.60.2', 'Ps.12.5', 'Ps.106.1', 'Isa.48.18', '1Thess.1.6', 'Acts.17.11', 'Ps.24.1',
  'Ps.84.7', 'John.5.26', 'Luke.4.4', 'Ps.44.3', 'Ps.42.1', 'Ps.61.4', 'Isa.59.20', 'John.5.30', 'Joel.2.23', 'Ps.65.4',
  'Isa.65.23', 'Rom.5.19', 'Deut.16.19', 'Ps.146.3', 'Ps.9.9', 'Eph.4.17', '2Cor.12.8', 'Prov.23.4', 'Deut.11.27', '1Thess.3.12',
  'Ps.55.17', 'Luke.9.62', 'Amos.9.11', 'Isa.14.24', 'Ps.13.5', 'Ps.112.7', '1Thess.4.9', 'Isa.50.6', 'Heb.12.12', 'Isa.53.7',
  'Rom.14.8', 'Acts.4.11', 'Prov.22.9', 'Ps.92.13', 'Isa.25.1', 'Ps.95.6', '1John.2.25', 'Ps.139.1', '2Cor.8.21', '1Cor.4.7',
  'Ps.62.12', 'Acts.14.15', 'Deut.28.1', 'Mark.8.34', 'Mark.16.19', 'Rom.2.29', 'Ps.80.1', 'Luke.10.42', 'Ps.50.23', 'Heb.12.29',
  'Isa.41.4', 'Titus.3.8', 'Exod.3.14', '2Tim.1.14', 'Heb.12.11', 'Ps.16.5', 'Ps.51.15', 'Deut.5.29', 'Prov.15.33', 'John.9.5',
  'Heb.12.10', '2Cor.8.12', 'Prov.11.25', 'Zech.13.1', 'Prov.14.31', 'Prov.11.2', 'Eph.3.7', 'Prov.29.1', 'Ps.45.6', 'Eph.6.14',
  'Ps.51.16', 'Prov.16.25', 'Deut.6.13', 'Isa.46.9', 'Prov.21.1', '2Cor.7.10', 'Ps.130.7', 'Luke.15.7', 'Deut.18.15', 'Dan.3.17',
  'Acts.18.10', 'Ps.98.1', 'Mark.14.62', 'Hos.6.2', 'Isa.29.18', 'Matt.24.42', 'Jer.16.19', 'Matt.26.39', 'Matt.10.39',
  'Matt.2.6', 'Matt.4.23', 'Matt.21.42', '1John.5.18', 'Rom.12.17', 'Matt.13.44', 'Jer.17.13', 'Rom.12.3', 'Jer.22.3',
  'Matt.6.32', 'Jer.32.19', 'Matt.4.17', 'Ps.119.15', 'Jer.33.16', 'Matt.15.8', 'Matt.6.34', 'Matt.8.26', 'Matt.21.5',
  'Matt.6.26', 'Rom.12.14', 'Matt.25.35', 'Jer.10.12', 'Matt.25.13', 'Matt.10.42', 'Jer.32.41', 'Jer.30.17', 'Matt.9.36',
  'Acts.2.24', 'Matt.3.16', 'Ps.44.4', 'Heb.7.27', 'Exod.34.14', 'Ps.65.2', '1Cor.8.2', 'Ps.148.14', 'Prov.31.30', 'Ps.26.4',
  'Eccl.8.12', '1Cor.12.26', 'Dan.2.22', 'Amos.9.15', '1Chr.22.13', '1Cor.5.6', 'Prov.28.27', 'Joel.3.16', 'Ps.66.18', 'Dan.9.4',
  'Ps.86.11', 'Ps.134.3', 'Prov.8.34', '1Sam.2.1', 'Exod.32.32', 'Ps.39.1', 'Heb.5.5', 'Ezek.18.23', 'Gen.32.10', 'Rom.9.20',
  'Ps.111.9', 'Ps.43.5', 'Ps.103.11', 'Ps.8.2', 'Hos.11.1', 'Mark.12.29', 'John.2.5', '1Tim.2.1', 'Amos.5.6', 'Ps.39.6',
  'Luke.21.19', '1Cor.8.13', 'Gen.21.1', '1Cor.16.14', 'Ps.94.12', 'Ps.78.15', 'Ps.122.1', 'Job.2.10', 'Ps.56.13', '1Cor.2.11',
  'Prov.24.16', 'Ps.147.9', 'Exod.13.21', 'Mark.1.35', 'Neh.1.5', 'Ps.104.30', 'Ps.17.5', 'Luke.10.2', 'Isa.26.12', 'Exod.4.31',
  'Jer.26.13', 'Prov.17.27', 'Ps.5.3', 'Jer.14.22', 'Exod.23.20', 'John.19.28', 'Ps.127.3', 'Ps.73.23', 'Ps.31.5', 'Prov.14.32',
  'Prov.9.10', 'Jer.24.6', 'Ps.4.8', 'Mark.8.35', 'Gen.2.18', 'Isa.25.6', 'Ps.89.14', 'Hos.11.8', 'Ps.85.9', 'Zech.1.16',
  'Ps.21.1', 'Jer.3.22', '1Sam.12.23', 'Exod.4.12', 'Isa.62.12', 'Ps.90.12', 'Mic.3.8', 'Prov.22.19', 'Ps.143.6', '1Cor.11.28',
  'Ps.94.18', 'Jer.29.10', 'Ps.66.10', 'Ps.21.4', 'Exod.3.12', '2Cor.7.6', 'Luke.16.11', 'Luke.3.6', 'Ps.7.9', 'Isa.33.22',
  'Ps.116.12', 'Titus.2.15', 'Prov.10.1', 'Exod.23.25', 'Ps.78.4', 'Gen.12.1', 'Ps.106.47', '1Cor.5.8', '1Cor.5.7', '1Cor.9.19',
  'Deut.10.14', 'Ps.31.24', 'Ps.36.5', 'Ps.68.35', 'Ps.103.2', 'Ps.3.6', 'Ps.28.8', 'Ps.128.3', 'Luke.8.18', 'Ps.132.14',
  '2Kgs.6.16', 'Ps.116.2', 'Eccl.11.1', 'Luke.7.47', 'Isa.62.5', '1Cor.9.22', 'Neh.9.30', 'Deut.1.30', 'Rev.14.6', 'Prov.20.9',
  '1Cor.4.12', 'Mark.10.52', 'Isa.37.16', 'Ps.41.1', '2Cor.2.16', 'Ps.48.14', 'Exod.3.6', 'Prov.19.14', 'Titus.3.2', '1Tim.3.2',
  '1Sam.17.45', 'Ps.138.2', '2Sam.10.12', 'Eccl.3.11', 'Luke.24.46', 'Ezek.37.4', 'Deut.11.18', 'Isa.27.6', 'Isa.66.12',
  'Job.19.25', 'Gen.7.1', '2Sam.23.2', 'Ps.128.2', '2Cor.10.18', 'Jer.20.9', 'John.4.23', 'Heb.8.1', 'Isa.5.16', 'Isa.63.16',
  'Isa.56.5', 'Zeph.3.14', 'Titus.2.2', 'Ps.41.13', 'Prov.8.20', '2Chr.32.7', 'Prov.30.4', 'Ps.71.3', 'Ps.4.4', 'Jonah.3.10',
  'Ps.50.3', 'Luke.3.5', 'Ps.4.1', 'Isa.50.7', 'Deut.15.10', 'Ps.18.1', 'Ps.3.5', 'Prov.10.21', '2Chr.19.7', 'Ps.99.1',
  'Hos.14.4', 'Eccl.3.17', 'Ps.72.11', 'Isa.29.19', 'Ps.141.2', 'Ps.126.5', 'Isa.33.16', 'Hos.14.1', 'Ps.90.8', '1Tim.5.8',
  'Ezek.36.24', '1Tim.5.22', 'Ps.111.2', 'Isa.59.1', '2Tim.1.6', 'Rom.4.20', '1Chr.29.14', 'Prov.22.4', '1Thess.1.9', '1Tim.2.8',
  'Ps.147.5', 'Luke.18.22', 'Mark.4.24', 'Isa.2.5', 'Prov.14.26', 'Neh.8.10', 'Isa.37.20', 'Ps.149.2', 'Ps.42.8', 'Gal.2.21',
  'Exod.2.24', 'Exod.23.22', 'Ps.4.6', 'Zech.8.13', 'Ezek.18.4', '1Chr.22.19', '1Kgs.3.9', 'Ps.89.11', 'Zech.8.3', 'Ps.11.7',
  'Mark.14.24', 'Isa.57.18', 'Ps.85.13', 'Eccl.7.29', 'Gal.2.19', 'Ps.39.12', 'Ps.145.1', 'Job.42.10', 'Mark.12.10', 'Ps.5.8',
  'Prov.25.12', 'Zech.10.6', 'John.11.4', '2Sam.22.3', 'Jer.1.7', 'Ps.113.9', 'Isa.54.15', '1Kgs.18.36', '1Cor.4.2',
  'Luke.14.33', 'Ps.22.24', 'Luke.22.20', 'Ps.130.4', 'Exod.23.2', 'Prov.13.4', 'Ps.71.15', 'Eph.3.13', 'Ps.57.11', 'Luke.17.6',
  'Dan.2.47', 'Ps.79.8', 'Ps.26.2', 'Luke.22.46', 'Mark.4.19', 'Hos.13.4', '1Kgs.8.61', 'Gen.15.6', 'Luke.16.10', 'Ps.85.8',
  'Amos.5.24', 'Jer.46.28', 'Isa.65.1', 'Prov.29.15', 'Ps.148.13', 'Prov.30.12', 'Ps.112.4', 'Ps.8.1', 'Luke.14.14', 'Jer.3.23',
  'Luke.15.24', 'Deut.31.23', 'Luke.11.10', 'Ps.2.8', 'Gen.39.21', 'Gen.6.9', '2Sam.7.22', '1Kgs.3.12', 'Ps.94.17', 'Zech.1.3',
  'Ps.109.31', 'Ps.90.17', 'Isa.6.1', 'Ps.48.1', 'Prov.24.29', '2Chr.6.18', 'Prov.12.4', '1Thess.2.9', 'Prov.18.22', '1Cor.16.9',
  'Exod.18.11', 'Jer.16.17', '1Kgs.8.23', 'Rom.2.11', 'Eccl.7.9', 'Luke.24.48', 'Jer.15.20', 'Dan.9.18', 'Isa.14.27',
  'Deut.28.4', 'Gal.4.19', 'Josh.24.14', 'Gen.39.2', 'Ps.97.2', 'Prov.27.1', 'Ps.113.7', 'Ezek.11.16', 'Hab.3.19', 'Ps.100.1',
  'Ps.110.2', 'Ps.130.3', 'Ps.116.1', 'Prov.4.27', 'Job.38.4', 'Exod.9.16', 'Ps.95.1', 'Ps.43.1', 'Amos.5.4', '1Thess.2.19',
  'Ps.141.5', 'Prov.19.11', 'Ps.96.8', 'Rom.2.1', 'Ezek.18.32', 'Ps.118.9', 'Ps.8.6', 'Mark.8.36', 'Ps.35.10', 'Ps.66.3',
  '1Chr.29.15', 'Luke.24.26', 'Mark.13.33', 'Mark.13.31', 'Ps.73.1', 'Prov.1.8', 'Deut.7.7', 'Job.42.6', 'Ps.144.2', 'Ps.85.10',
  'Ps.66.12', 'Gal.4.7', 'Matt.2.2', 'Jer.33.15', 'Matt.18.4', 'Matt.19.4', 'Matt.27.46', 'Matt.8.8', 'Matt.22.14', 'Acts.7.59',
  'Acts.23.11', 'Acts.5.32', 'Acts.6.10', 'Acts.28.28', 'Acts.24.16', 'Jer.10.6', 'Jer.22.29', 'Acts.14.17', 'Matt.22.40',
  'Matt.8.11', 'Matt.19.19', 'Matt.4.7', 'Acts.10.42', 'Acts.9.16', 'Acts.1.11', 'Jer.22.16', 'Acts.14.3', 'Acts.27.24',
  'Acts.10.34', 'Matt.1.20', 'Ps.41.2', '1Sam.12.24', 'Ps.105.41', 'Eccl.7.8', 'John.2.24', '2Cor.2.15', 'Ps.111.1', 'Ps.75.10',
  'Luke.22.42', 'Ps.118.14', 'Ps.101.2', '1Cor.7.23', 'Ps.115.13', 'Luke.17.33', 'Prov.12.15', 'Ps.77.19', 'Ps.61.3', 'Ps.69.13',
  '1Cor.14.1', 'Neh.9.20', 'Ps.125.2', 'Deut.33.25', 'Ps.47.2', 'Ps.44.1', 'Ps.63.3', 'Gen.5.24', 'Ps.24.7', 'Ps.115.1',
  'John.18.36', 'Jer.30.11', 'Prov.9.9', 'Prov.25.21', 'Ps.5.12', 'Gen.14.19', 'Luke.9.25', 'Ps.30.2', 'Ps.74.16', 'Gen.39.23',
  'Prov.29.17', 'Ps.67.1', 'Ps.96.10', '2Chr.1.10', 'John.4.36', 'Isa.32.8', '1Thess.3.8', 'Ps.35.27', 'Ps.11.1', 'Ps.106.3',
  'Ps.135.6', 'Mic.4.3', 'Deut.30.15', '2Kgs.19.19', 'Luke.5.8', '2Chr.20.6', 'Luke.9.24', 'Prov.5.22', 'Prov.17.9', 'Ps.49.15',
  'Ps.101.3', 'Ps.98.2', 'Ps.113.5', 'Deut.5.10', 'Exod.6.7', 'Prov.12.25', 'Ruth.1.16', 'Exod.15.6', 'Ps.137.7', 'Isa.27.3',
  'Ps.81.10', 'Ps.96.4', '1Sam.17.37', '1Cor.7.19', 'Ps.111.4', 'Ps.20.6', 'Ps.45.2', 'Prov.25.11', 'Mark.14.36', 'Ps.126.3',
  'John.2.11', 'Eccl.5.2', 'Ps.135.4', 'Ps.127.2', '2Chr.20.12', 'Ps.68.4', 'Ps.68.20', 'Prov.8.14', '1Tim.3.3', 'Ps.108.4',
  'Ps.131.1', 'Ps.98.4', 'Ps.147.19', 'Ps.116.7', 'Isa.66.22', 'Ps.26.8', '1Chr.29.12', 'Ps.26.1', 'Ps.29.2', 'Deut.3.24',
  'Ps.3.4', 'Ps.95.2', 'Ps.65.7', 'Ps.117.1', 'Ps.144.15', 'Dan.3.18', 'Ps.141.3', 'Eccl.3.14', 'Ps.94.14', 'Jer.20.12',
  'Prov.20.7', 'Gen.32.26', 'Ps.13.1', 'Ps.109.4', 'Isa.63.15', 'Matt.14.31', 'Acts.8.22', 'Acts.11.21', 'Matt.9.37',
  'Matt.14.27', 'Acts.12.5', 'Acts.6.7'];
function votdRef(d = new Date()) {
  const s = VOTD_START.split('-').map(Number);
  const day = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(s[0], s[1] - 1, s[2])) / 864e5);
  return VOTD[((day % VOTD.length) + VOTD.length) % VOTD.length];
}

// ---------- anonymous site analytics (GoatCounter: no cookies, no personal data) ----------
// Only counts *how often* something happens site-wide — never who did it.
function track(name, title) {
  try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: title || name, event: true }); } catch (e) {}
}

// ---------- verse highlights & notes (this browser only) ----------
// kb-hl = { "<global verse index>": { c: "y|g|b|p", n: "note", t: timestamp } }
const HL_COLORS = [['y', 'លឿង'], ['g', 'បៃតង'], ['b', 'ខៀវ'], ['p', 'ផ្កាឈូក']];
const Highlights = {
  all() { try { return JSON.parse(localStorage.getItem('kb-hl') || '{}') || {}; } catch (e) { return {}; } },
  get(g) { return Highlights.all()[g] || null; },
  set(g, patch) {
    const a = Highlights.all(), cur = a[g] || {}, nx = Object.assign({}, cur, patch, { t: Date.now() });
    if (!nx.c && !(nx.n && nx.n.trim())) delete a[g]; else a[g] = nx;
    try { localStorage.setItem('kb-hl', JSON.stringify(a)); } catch (e) {}
  },
  remove(g) { const a = Highlights.all(); delete a[g]; try { localStorage.setItem('kb-hl', JSON.stringify(a)); } catch (e) {} },
};

// ---------- reading plans ----------
// Each plan is one or more "tracks" (a list of chapters spread over N days). Chapters are
// assigned to days by verse count, so long chapters (Ps 119) don't make one day huge.
const PLAN_DEFS = [
  { id: 'bible1y', km: 'ព្រះគម្ពីរទាំងមូល ក្នុងមួយឆ្នាំ', en: 'Whole Bible in a year', days: 365, d: 'សញ្ញាចាស់ និងសញ្ញាថ្មី អានស្របគ្នារាល់ថ្ងៃ (~១៥ នាទី)',
    tracks: B => [[range(0, B.OT_CH)], [range(B.OT_CH, B.NC)]] },
  { id: 'nt90', km: 'គម្ពីរសញ្ញាថ្មី ក្នុង ៩០ ថ្ងៃ', en: 'New Testament in 90 days', days: 90, d: 'ម៉ាថាយ ដល់ វិវរណៈ · ប្រហែល ៣ ជំពូកក្នុងមួយថ្ងៃ',
    tracks: B => [[range(B.OT_CH, B.NC)]] },
  { id: 'gospels30', km: 'ដំណឹងល្អទាំងបួន ក្នុង ៣០ ថ្ងៃ', en: 'The four Gospels in 30 days', days: 30, d: 'ម៉ាថាយ ម៉ាកុស លូកា យ៉ូហាន',
    tracks: B => [[range(B.bookFirstCh[39], B.bookFirstCh[43])]] },
  { id: 'wisdom60', km: 'ទំនុកដំកើង និង សុភាសិត ក្នុង ៦០ ថ្ងៃ', en: 'Psalms & Proverbs in 60 days', days: 60, d: 'ទំនុកដំកើង ២–៣ ជំពូក និង សុភាសិត ១ ជំពូក រាល់ថ្ងៃ',
    tracks: B => [[range(B.bookFirstCh[18], B.bookFirstCh[19])], [range(B.bookFirstCh[19], B.bookFirstCh[20]), 31]] },
];
function range(a, b) { return Array.from({ length: b - a }, (_, i) => a + i); }
const Plans = {
  defs: PLAN_DEFS,
  build(B, id) {
    const def = PLAN_DEFS.find(p => p.id === id); if (!def) return null;
    const days = Array.from({ length: def.days }, () => []);
    for (const [chs, nd = def.days] of def.tracks(B)) {
      const w = chs.map(c => B.chFirst[c + 1] - B.chFirst[c]), tot = w.reduce((a, b) => a + b, 0);
      let cum = 0;
      chs.forEach((c, i) => { const d = Math.min(nd - 1, Math.floor((cum + w[i] / 2) / tot * nd)); days[d].push(c); cum += w[i]; });
    }
    return Object.assign({}, def, { portions: days });
  },
  state() { try { return JSON.parse(localStorage.getItem('kb-plan') || 'null'); } catch (e) { return null; } },
  start(id) { try { localStorage.setItem('kb-plan', JSON.stringify({ id, start: Stats.dayKey(), ticks: [] })); } catch (e) {} track('plan-start'); },
  stop() { try { localStorage.removeItem('kb-plan'); } catch (e) {} },
  tick(day, on) {
    const s = Plans.state(); if (!s) return; const t = new Set(s.ticks || []); on ? t.add(day) : t.delete(day); s.ticks = [...t];
    try { localStorage.setItem('kb-plan', JSON.stringify(s)); } catch (e) {}
  },
  // chapters finished since the plan started (from the daily reading log)
  finishedSince(start) {
    const o = Stats.summary().o, set = new Set();
    for (const [k, v] of Object.entries(o)) if (k >= start && v.l) v.l.forEach(c => set.add(c));
    return set;
  },
  // full status: which day is "today", which days are done, what to read next
  status(B) {
    const s = Plans.state(); if (!s) return null;
    const plan = Plans.build(B, s.id); if (!plan) return null;
    const fin = Plans.finishedSince(s.start), ticks = new Set(s.ticks || []);
    const done = plan.portions.map((p, i) => ticks.has(i) || (p.length > 0 && p.every(c => fin.has(c))));
    const today = Math.min(plan.days - 1, Math.max(0, Math.round((new Date(Stats.dayKey() + 'T00:00:00') - new Date(s.start + 'T00:00:00')) / 864e5)));
    const next = done.findIndex(d => !d);
    const doneN = done.filter(Boolean).length;
    const behind = today - done.slice(0, today).filter(Boolean).length; // unfinished days before today
    return { s, plan, fin, done, today, next, doneN, behind, finished: next < 0 };
  },
};

// ---------- devotional journal (per day, this browser only) ----------
const Journal = {
  all() { try { return JSON.parse(localStorage.getItem('kb-journal') || '{}') || {}; } catch (e) { return {}; } },
  get(k) { return Journal.all()[k] || {}; },
  set(k, field, val) { const a = Journal.all(); a[k] = Object.assign({}, a[k], { [field]: val }); if (!['o', 'a', 'p'].some(f => a[k][f] && String(a[k][f]).trim())) delete a[k];
    try { localStorage.setItem('kb-journal', JSON.stringify(a)); } catch (e) {} },
};

// ---------- BibleProject Khmer videos (embedded from their YouTube channel, with credit) ----------
const Videos = (() => {
  let p = null;
  const load = () => p || (p = fetch('data/videos.json').then(r => r.json()).catch(() => ({ videos: [] })));
  const thumb = v => v.yt ? `https://i.ytimg.com/vi/${v.yt}/mqdefault.jpg` : v.mux ? `https://image.mux.com/${v.mux}/thumbnail.jpg?width=480` : 'assets/icon.svg';
  // overviews covering a chapter (global chapter index → book index + chapter number)
  async function forChapter(B, c) {
    const d = await load(), bi = B.chBook[c], n = B.chNum[c];
    return d.videos.filter(v => v.s && v.s.some(([b, a, z]) => b === bi && n >= a && n <= z));
  }
  async function forQuestion(id) { const d = await load(); return d.videos.filter(v => v.q && v.q.includes(id)); }
  function card(v, i) {
    return `<button class="vcard" data-vi="${i}" type="button"><span class="vth"><img loading="lazy" src="${thumb(v)}" alt="" onerror="this.style.visibility='hidden'"><b>▶</b></span>
      <span class="vt">${esc(v.t)}</span><small>BibleProject</small></button>`;
  }
  // click-to-play modal; youtube-nocookie keeps YouTube from setting cookies until play
  function play(v) {
    track('video-play');
    if (!v.yt && !v.mux) { window.open('https://bibleproject.com/km/', '_blank', 'noopener'); return; }
    let m = document.getElementById('vmodal');
    if (!m) {
      m = document.createElement('div'); m.id = 'vmodal';
      m.innerHTML = `<div class="vbox" role="dialog" aria-modal="true"><div class="vhead"><b></b><button class="vx" aria-label="បិទ">✕</button></div>
        <div class="vframe"></div><div class="vcredit">BibleProject is the author and owner of this content. ·
        <a href="https://bibleproject.com/km/" target="_blank" rel="noopener">bibleproject.com/km</a> ·
        <a class="vyt" target="_blank" rel="noopener">YouTube ›</a></div></div>`;
      document.body.appendChild(m);
      const close = () => { m.classList.remove('on'); m.querySelector('.vframe').innerHTML = ''; };
      m.onclick = e => { if (e.target === m || e.target.closest('.vx')) close(); };
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    }
    m.querySelector('.vhead b').textContent = v.t;
    const yt = m.querySelector('.vyt'); yt.style.display = v.yt ? '' : 'none'; if (v.yt) yt.href = `https://www.youtube.com/watch?v=${v.yt}`;
    // BibleProject's own video file (Mux) when their YouTube link is broken
    if (!v.yt) { muxPlay(m, v); m.classList.add('on'); return; }
    m.querySelector('.vframe').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v.yt}?autoplay=1&rel=0" title="${esc(v.t)}"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    m.classList.add('on');
  }
  // Mux: HLS stream (native on Safari/iOS/Android, hls.js elsewhere) → MP4 rendition → BibleProject's site
  let hlsLib = null;
  function muxPlay(m, v) {
    const fr = m.querySelector('.vframe'), hls = `https://stream.mux.com/${v.mux}.m3u8`, mp4 = `https://stream.mux.com/${v.mux}/high.mp4`;
    fr.innerHTML = `<video poster="${thumb(v)}" controls autoplay playsinline title="${esc(v.t)}"></video>`;
    const vid = fr.querySelector('video');
    const fail = () => { fr.innerHTML = `<div class="vfail"><p>មិនអាចចាក់វីដេអូនេះនៅទីនេះបានទេ។</p><a href="https://bibleproject.com/km/" target="_blank" rel="noopener">មើលនៅ bibleproject.com/km ›</a></div>`; };
    const toMp4 = () => { if (!vid.isConnected) return; vid.onerror = fail; vid.src = mp4; vid.play().catch(() => {}); };
    if (vid.canPlayType('application/vnd.apple.mpegurl')) { vid.onerror = toMp4; vid.src = hls; return; }
    hlsLib = hlsLib || new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js'; sc.onload = () => ok(window.Hls); sc.onerror = no; document.head.appendChild(sc); });
    hlsLib.then(Hls => {
      if (!vid.isConnected) return;
      if (!Hls || !Hls.isSupported()) return toMp4();
      const h = new Hls(); h.loadSource(hls); h.attachMedia(vid);
      h.on(Hls.Events.MANIFEST_PARSED, () => vid.play().catch(() => {}));
      h.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) { h.destroy(); toMp4(); } });
      new MutationObserver((_, o) => { if (!vid.isConnected) { h.destroy(); o.disconnect(); } }).observe(fr, { childList: true });
    }, toMp4);
  }
  function bind(root, list) { root.querySelectorAll('.vcard').forEach(b => b.onclick = () => play(list[+b.dataset.vi])); }
  return { load, forChapter, forQuestion, card, play, bind, thumb };
})();

// ---------- offline: a service worker keeps a copy of the site so it opens without internet ----------
if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
  addEventListener('load', () => { try { navigator.serviceWorker && navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} });
}
