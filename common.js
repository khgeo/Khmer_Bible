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
  const KEYS = ['kb-days', 'kb-read', 'kb-last', 'kb-goal', 'kb-fs', 'kb-theme'];
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
    for (const k of ['kb-last', 'kb-goal', 'kb-fs']) if (inc[k] != null) try { localStorage.setItem(k, inc[k]); } catch (e) {}
  }
  function reset() { for (const k of ['kb-days', 'kb-read', 'kb-last']) try { localStorage.removeItem(k); } catch (e) {} }
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
