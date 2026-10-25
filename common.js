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
const VOTD = ['John.3.16', 'Ps.23.1', 'Rom.8.28', 'Phil.4.13', 'Jer.29.11', 'Isa.40.31', 'Prov.3.5', 'Matt.11.28', 'Josh.1.9', 'Ps.46.1',
  'Rom.12.2', '1Cor.13.4', 'Gal.5.22', 'Eph.2.8', 'Heb.11.1', 'Ps.119.105', 'Matt.6.33', 'John.14.6', '2Tim.3.16', 'Isa.41.10',
  'Ps.27.1', 'Rom.5.8', 'John.1.1', 'Gen.1.1', 'Mic.6.8', 'Lam.3.22', 'Ps.121.1', '1John.4.19', 'Matt.5.9', 'Col.3.23',
  'Ps.37.4', 'Prov.16.3', 'Isa.53.5', 'John.11.25', 'Rom.6.23', '2Cor.5.17', 'Heb.13.8', 'Jas.1.5', '1Pet.5.7', 'Rev.21.4',
  'Ps.34.8', 'Deut.31.6', 'Matt.28.19', 'John.8.32', 'Rom.10.9', 'Eph.6.10', 'Phil.4.6', '1Thess.5.16', 'Heb.4.12', 'Ps.139.14',
  'Eccl.3.1', 'Isa.9.6', 'Luke.2.11', 'John.15.13', 'Acts.1.8', 'Rom.15.13', 'Gal.2.20', 'Ps.91.1', 'Prov.18.10', 'Matt.22.37'];
function votdRef(d = new Date()) {
  const day = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  return VOTD[day % VOTD.length];
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
