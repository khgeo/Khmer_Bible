/* Word frequency: Old vs New Testament in the Khmer Old Version 1954 (ពគប).
 * Every chapter is a row and every verse a cell; verses containing the word light up. */
'use strict';

const CHIPS = [['អត់ទោស', 'forgive'], ['ស្រឡាញ់', 'love'], ['ជំនឿ', 'faith'], ['សង្ឃឹម', 'hope'], ['សេចក្ដីសុខ', 'peace'],
  ['មេត្តាករុណា', 'mercy'], ['ព្រលឹង', 'soul'], ['អធិស្ឋាន', 'pray'], ['ប្រែចិត្ត', 'repent'], ['សេចក្ដីសង្គ្រោះ', 'salvation'], ['ពន្លឺ', 'light'], ['ឈើឆ្កាង', 'cross']];
const SEP = '\\s\\u200B\\u200C។៕៖,.!?;:«»"“”()\\[\\]\\-';
const MAXLIST = 150;

let META, TEXT, NV, OT_V;               // OT_V = first NT verse index
let vBook, vCh, vNum, chRow, bookFirstV; // lookups
let G = {}, R = { hits: new Map(), q: '', mode: 'word', regs: [] }, shown = MAXLIST;

(async function init() {
  META = await fetch('data/meta.json').then(r => r.json());
  NV = META.verses;
  vBook = new Int8Array(NV); vCh = new Int16Array(NV); vNum = new Int16Array(NV); chRow = new Int16Array(NV);
  bookFirstV = new Int32Array(67);
  let g = 0, row = 0;
  META.books.forEach((b, bi) => {
    bookFirstV[bi] = g; if (bi === 39) { OT_V = g; row = 0; }
    b.ch.forEach((n, k) => { for (let v = 1; v <= n; v++, g++) { vBook[g] = bi; vCh[g] = k + 1; vNum[g] = v; chRow[g] = row; } row++; });
  });
  bookFirstV[66] = g;
  $('#chips').innerHTML = CHIPS.map(([k, e]) => `<button data-w="${k}">${k} <small>${e}</small></button>`).join('');
  $('#chips').onclick = e => { const b = e.target.closest('button'); if (b) { $('#w').value = b.dataset.w; submit(); } };
  $('#wform').onsubmit = e => { e.preventDefault(); submit(); };
  document.querySelectorAll('[name=mode]').forEach(r => r.onchange = submit);
  window.addEventListener('resize', debounce(layout, 150));
  window.addEventListener('themechange', draw);
  window.addEventListener('hashchange', fromHash);
  bindHover();
  layout();
  fromHash(true);
  TEXT = await KhmerText.load(META);
  run();
})().catch(e => { console.error(e); setStatus('err', e.message); });

function debounce(f, ms) { let t; return () => { clearTimeout(t); t = setTimeout(f, ms); }; }

// ---------- query ----------
function fromHash(initial) {
  const p = new URLSearchParams(location.hash.slice(1));
  $('#w').value = p.get('q') || (initial === true && !$('#w').value ? 'អត់ទោស' : $('#w').value);
  const m = p.get('m') === 'part' ? 'part' : 'word';
  document.querySelector(`[name=mode][value=${m}]`).checked = true;
  if (TEXT) run();
}
function submit() {
  const m = document.querySelector('[name=mode]:checked').value;
  const h = '#' + new URLSearchParams({ q: $('#w').value.trim(), m });
  if (location.hash !== h) location.hash = h; else run();
}

// Khmer-aware pattern: ignore zero-width spaces/joiners inside the word, and treat
// subscript ដ / ត (្ដ ↔ ្ត) as the same letter, since both spellings are common.
function makeRegex(term, mode) {
  const chars = [...term.replace(/[\s​‌]/g, '')];
  if (!chars.length) return null;
  const parts = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '្' && (chars[i + 1] === 'ដ' || chars[i + 1] === 'ត')) { parts.push('្[ដត]'); i++; }
    else parts.push(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
  let src = parts.join('[\\u200B\\u200C]?');
  if (mode === 'word') src = `(?<=^|[${SEP}])${src}(?=$|[${SEP}])`;
  return new RegExp(src, 'gu');
}

function run() {
  const q = $('#w').value.trim(), mode = document.querySelector('[name=mode]:checked').value;
  R = { q, mode, regs: q.split(/[,،、]/).map(t => makeRegex(t.trim(), mode)).filter(Boolean), hits: new Map() };
  shown = MAXLIST;
  if (TEXT && R.regs.length) for (let g = 0; g < NV; g++) {
    const t = TEXT[g]; if (!t) continue;
    let n = 0; for (const re of R.regs) { re.lastIndex = 0; const m = t.match(re); if (m) n += m.length; }
    if (n) R.hits.set(g, n);
  }
  document.title = (q ? q + ' — ' : '') + 'ប្រេកង់ពាក្យ · Khmer Bible';
  renderSummary(); draw(); renderBooks(); renderList();
}

// ---------- summary ----------
function tally(from, to) {
  let occ = 0, vs = 0; for (const [g, n] of R.hits) if (g >= from && g < to) { occ += n; vs++; }
  return { occ, vs, total: to - from, pct: vs / (to - from) * 100 };
}
const pct = p => kmNum(p < 1 ? p.toFixed(2) : p.toFixed(1)) + '%';
const fmt = n => kmNum(n.toLocaleString('en'));
function renderSummary() {
  const o = tally(0, OT_V), n = tally(OT_V, NV);
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  const col = (t, cls) => `<div class="col ${cls}">${stat(fmt(t.occ), 'ដង · occurrences')}${stat(fmt(t.vs), 'ខ · verses')}${stat(fmt(t.total), 'ខសរុប · total verses')}</div>`;
  let mid = '<span class="muted">—</span>';
  if (o.vs || n.vs) {
    const a = o.pct, b = n.pct, w = a / (a + b) * 100;
    const ratio = a && b ? (b > a ? `ញឹកញាប់ជាង <b>×${kmNum((b / a).toFixed(1))}</b> ក្នុងសញ្ញាថ្មី` : `ញឹកញាប់ជាង <b>×${kmNum((a / b).toFixed(1))}</b> ក្នុងសញ្ញាចាស់`)
      : (a ? 'មានតែក្នុង<b>សញ្ញាចាស់</b>' : 'មានតែក្នុង<b>សញ្ញាថ្មី</b>');
    mid = `<div>${ratio}</div><div class="meter"><i style="width:${w}%;background:var(--ot)"></i><i style="width:${100 - w}%;background:var(--nt)"></i></div>
      <div style="font-size:11.5px">ភាគរយនៃខ (ធៀបតាមទំហំ) · share of verses, size-adjusted</div>`;
  }
  $('#summary').innerHTML = col(o, 'ot') + `<div class="ratio">${TEXT ? mid : 'កំពុងផ្ទុកអត្ថបទ…'}</div>` + col(n, 'nt');
  $('#otPct').textContent = TEXT ? `${pct(o.pct)} នៃខ` : '';
  $('#ntPct').textContent = TEXT ? `${pct(n.pct)} នៃខ` : '';
}

// ---------- verse grids ----------
function layout() {
  const ot = $('#otc'), nt = $('#ntc'), dpr = Math.min(devicePixelRatio || 1, 2);
  const wo = ot.parentElement.clientWidth, wn = nt.parentElement.clientWidth;
  const cw = Math.min(wo / 176, wn / 80);                 // Ps 119 = 176 verses, Luke 1 = 80
  const rh = Math.max(0.9, Math.min(1.6, cw * 0.32));
  G = { dpr, cw, rh, pad: 4 };
  const size = (cv, rows, w) => { const h = Math.ceil(rows * rh + 2 * G.pad); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; };
  size(ot, 929, wo); size(nt, 260, wn);
  draw();
}
function draw() {
  if (!G.cw) return;
  for (const [id, from, to, col] of [['#otc', 0, OT_V, [212, 173, 60]], ['#ntc', OT_V, NV, [232, 97, 58]]]) {
    const cv = $(id), ctx = cv.getContext('2d'), { cw, rh, pad, dpr } = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    // faint row per chapter, alternating per book so book boundaries read
    for (let g = from; g < to;) {
      const row = chRow[g], b = vBook[g]; let e = g; while (e < to && chRow[e] === row) e++;
      ctx.fillStyle = `rgba(${col},${b % 2 ? 0.2 : 0.34})`;
      ctx.fillRect(pad, pad + row * rh, (e - g) * cw - 0.6, Math.max(rh * 0.6, 0.6));
      g = e;
    }
    // hits: bright blocks, at least 3px so single verses stay visible
    const hw = Math.max(cw, 3), hh = Math.max(rh * 2.4, 3);
    ctx.fillStyle = cssVar(id === '#otc' ? '--hit-ot' : '--hit-nt');
    for (const g of R.hits.keys()) if (g >= from && g < to) {
      const x = pad + (vNum[g] - 1) * cw, y = pad + chRow[g] * rh;
      ctx.fillRect(x - (hw - cw) / 2, y - (hh - rh) / 2, hw, hh);
    }
  }
}
function verseAt(id, x, y) {
  const { cw, rh, pad } = G, row = Math.floor((y - pad) / rh), col = Math.floor((x - pad) / cw);
  const [from, to] = id === 'otc' ? [0, OT_V] : [OT_V, NV];
  // find chapter row via binary search over chRow (monotonic inside a testament)
  let lo = from, hi = to - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (chRow[m] < row) lo = m + 1; else hi = m; }
  if (chRow[lo] !== row) return -1;
  // snap to a nearby hit (±2 rows) so tiny cells are easy to hover
  for (const dr of [0, -1, 1, -2, 2]) {
    let s = from, h = to - 1, r = row + dr; while (s < h) { const m = (s + h) >> 1; if (chRow[m] < r) s = m + 1; else h = m; }
    if (chRow[s] !== r) continue;
    for (const dc of [0, -1, 1]) { const g = s + col + dc; if (g >= s && g < to && chRow[g] === r && R.hits.has(g)) return g; }
  }
  const g = lo + col; return g < to && chRow[g] === row && col >= 0 ? g : -1;
}
function bindHover() {
  const tip = $('#wtip'), grids = $('.grids');
  for (const id of ['otc', 'ntc']) {
    const cv = $('#' + id);
    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect(), g = verseAt(id, e.clientX - r.left, e.clientY - r.top);
      if (g < 0) { tip.hidden = true; cv.style.cursor = ''; return; }
      cv.style.cursor = R.hits.has(g) ? 'pointer' : '';
      tip.innerHTML = `<b>${esc(label(g))}</b> <small class="muted">${esc(META.books[vBook[g]].en)} ${vCh[g]}:${vNum[g]}</small>` +
        (TEXT ? `<div class="t">${highlight(TEXT[g])}</div>` : '');
      tip.hidden = false;
      const gr = grids.getBoundingClientRect();
      let left = e.clientX - gr.left + 16; if (left + 340 > gr.width) left = e.clientX - gr.left - 356;
      tip.style.left = Math.max(4, left) + 'px'; tip.style.top = (e.clientY - gr.top + 14) + 'px';
    });
    cv.addEventListener('mouseleave', () => tip.hidden = true);
    cv.addEventListener('click', e => {
      const r = cv.getBoundingClientRect(), g = verseAt(id, e.clientX - r.left, e.clientY - r.top);
      if (g >= 0) location.href = arcLink(g);
    });
  }
}

// ---------- per-book bars ----------
function renderBooks() {
  const rows = META.books.map((b, bi) => {
    let vs = 0; for (const g of R.hits.keys()) if (vBook[g] === bi) vs++;
    return { bi, vs, p: vs / (bookFirstV[bi + 1] - bookFirstV[bi]) * 100 };
  });
  const max = Math.max(...rows.map(r => r.p), 0.0001);
  $('#books').innerHTML = rows.map(r => `<div class="${r.vs ? (r.bi < 39 ? 'o' : 'n') : 'z'}" data-b="${r.bi}" style="height:${r.vs ? Math.max(3, r.p / max * 100) : 1}%"
      title="${esc(META.books[r.bi].km)} · ${esc(META.books[r.bi].en)} — ${r.vs} verses (${r.p.toFixed(2)}%)"></div>`).join('');
  $('#books').onclick = e => { const d = e.target.closest('[data-b]'); if (!d) return; const bi = +d.dataset.b;
    const keys = [...R.hits.keys()].sort((a, b) => a - b), k = keys.findIndex(g => vBook[g] === bi); if (k < 0) return;
    if (k >= shown) { shown = k + 60; renderList(); } const first = keys[k]; document.getElementById('h' + first)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
}

// ---------- verse list ----------
const label = g => `${META.books[vBook[g]].km} ${kmNum(vCh[g])}:${kmNum(vNum[g])}`;
const arcLink = g => `./#${META.books[vBook[g]].osis}.${vCh[g]}.${vNum[g]}`;
function highlight(t) {
  if (!R.regs.length) return esc(t);
  const marks = [];
  for (const re of R.regs) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { marks.push([m.index, m.index + m[0].length]); if (!m[0].length) re.lastIndex++; } }
  marks.sort((a, b) => a[0] - b[0]);
  let out = '', i = 0;
  for (const [a, b] of marks) { if (a < i) continue; out += esc(t.slice(i, a)) + '<mark>' + esc(t.slice(a, b)) + '</mark>'; i = b; }
  return out + esc(t.slice(i));
}
function renderList() {
  const keys = [...R.hits.keys()].sort((a, b) => a - b);
  $('#hitsTitle').innerHTML = !TEXT ? '' : keys.length
    ? `ខដែលមាន «${esc(R.q)}» · ${fmt(keys.length)} ខ <span class="muted" style="font-weight:400;font-size:12px">— ចុចលើខ ដើម្បីមើលខ្សែសម្ពន្ធ</span>`
    : (R.q ? `រកមិនឃើញ «${esc(R.q)}»` + (R.mode === 'word' ? ' — សាកល្បង «មានផ្ទុក»' : '') : '');
  const list = keys.slice(0, shown).map(g => `<div class="hit ${g < OT_V ? 'o' : 'n'}" id="h${g}"><a href="${arcLink(g)}">${esc(label(g))}${R.hits.get(g) > 1 ? ' · ' + kmNum(R.hits.get(g)) + ' ដង' : ''}</a><p>${highlight(TEXT[g])}</p></div>`).join('');
  $('#hitlist').innerHTML = list + (keys.length > shown ? `<button class="more" id="more">+ ${fmt(keys.length - shown)} ខទៀត</button>` : '');
  const mb = $('#more'); if (mb) mb.onclick = () => { shown += 300; renderList(); };
}
