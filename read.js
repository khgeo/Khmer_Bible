/* Reader: chapter by chapter, with cross-references, places and reading progress. */
'use strict';

let B, P, TEXT = null, mini = null, miniLayer = null;
const XREF = new Map(), QAIDX = {};
const S = { c: 0, g: -1, open: -1, tool: -1, at: Date.now() };
let fs = 18; try { fs = +localStorage.getItem('kb-fs') || 18; } catch (e) {}

(async function init() {
  B = await Bible.load();
  const bs = $('#book');
  B.meta.books.forEach((b, i) => bs.add(new Option(b.km, i)));
  bs.onchange = () => go(B.bookFirstCh[+bs.value], -1);
  $('#chap').onchange = e => go(+e.target.value, -1);
  $('#prev').onclick = () => go(Math.max(0, S.c - 1), -1);
  $('#next').onclick = () => go(Math.min(B.NC - 1, S.c + 1), -1);
  $('#fsm').onclick = () => setFs(fs - 1); $('#fsp').onclick = () => setFs(fs + 1);
  $('#xrshow').onchange = e => document.body.classList.toggle('noxr', !e.target.checked);
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') $('#prev').click(); if (e.key === 'ArrowRight') $('#next').click();
  });
  setFs(fs);
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', throttle(saveScroll, 400), { passive: true });
  window.addEventListener('themechange', () => { if (mini) { mini.removeLayer(mini._base); mini._base = Places.baseLayers(mini).themed().addTo(mini); renderMini(); } });
  // a chapter counts as read once its end has been on screen and it has been open for a few seconds
  let endTimer = 0;
  new IntersectionObserver(es => es.forEach(e => {
    clearTimeout(endTimer);
    if (!e.isIntersecting || !TEXT) return;
    const c = S.c, wait = Math.max(0, 6000 - (Date.now() - S.at));
    endTimer = setTimeout(() => { if (c === S.c) { Reading.markRead(c); renderProgress(); renderStats(); renderPlan(); renderPlanNext(); } }, wait);
  }), { threshold: 1 }).observe($('#end'));
  startReadingTimer();
  addEventListener('statsupdate', renderStats);
  renderStats();
  renderPlan();
  Places.load(B).then(p => { P = p; render(); });
  fetch('data/qa.json').then(x => x.json()).then(q => {
    for (const it of q.items) for (const ref of it.r) {
      const m = ref.match(/^(.+\.\d+)\.(\d+)(?:-(\d+))?$/), a = m && B.parse(`${m[1]}.${m[2]}`); if (!a) continue;
      for (let g = a.g; g <= a.g + (m[3] ? +m[3] - +m[2] : 0); g++) (QAIDX[g] = QAIDX[g] || []).push(it);
    }
    render(false);
  }).catch(() => {});
  route();
  KhmerText.load(B.meta).then(t => { TEXT = t; render(true); renderVotd(); }).catch(() => {});
  renderVotd();
})().catch(e => { console.error(e); setStatus('err', e.message); });

function throttle(f, ms) { let t = 0; return () => { const n = Date.now(); if (n - t > ms) { t = n; f(); } }; }
function setFs(n) { fs = Math.max(14, Math.min(28, n)); document.documentElement.style.setProperty('--read-fs', fs + 'px'); try { localStorage.setItem('kb-fs', fs); } catch (e) {} }
function go(c, g) { location.hash = B.ref(c, g); }

function route() {
  let r = B.parse(location.hash.slice(1));
  if (!r) { const L = Reading.last(); r = L && B.parse(L.ref); }
  if (!r) r = { c: 0, g: -1 };
  if (r.c !== S.c) S.at = Date.now();
  S.c = r.c; S.g = r.g; S.open = -1; S.tool = -1;
  syncBar();
  render(true);
}
function syncBar() {
  const bi = B.chBook[S.c], cs = $('#chap');
  $('#book').value = bi;
  cs.innerHTML = '';
  for (let c = B.bookFirstCh[bi]; c < B.bookFirstCh[bi + 1]; c++) cs.add(new Option('ជំពូក ' + kmNum(B.chNum[c]), c));
  cs.value = S.c;
  const pv = $('#prev2'), nx = $('#next2');
  pv.style.visibility = S.c > 0 ? '' : 'hidden'; nx.style.visibility = S.c < B.NC - 1 ? '' : 'hidden';
  if (S.c > 0) { pv.href = '#' + B.ref(S.c - 1, -1); pv.querySelector('span').textContent = B.chLabel(S.c - 1); }
  if (S.c < B.NC - 1) { nx.href = '#' + B.ref(S.c + 1, -1); nx.querySelector('span').textContent = B.chLabel(S.c + 1); }
  renderPlanNext();
  document.title = `${B.chLabel(S.c)} — អានព្រះគម្ពីរ ពគប`;
}

async function loadXref(bi) {
  const o = B.meta.books[bi].osis;
  if (!XREF.has(o)) XREF.set(o, Int32Array.from(await fetch(`data/xref/${o}.json`).then(r => r.json()).catch(() => [])));
  return XREF.get(o);
}

// ---------- chapter text ----------
async function render(scroll) {
  const c = S.c, v0 = B.chFirst[c], v1 = B.chFirst[c + 1];
  const arr = await loadXref(B.chBook[c]);
  if (c !== S.c) return;
  const cnt = new Map(); for (let i = 0; i < arr.length; i += 4) if (arr[i] >= v0 && arr[i] < v1) cnt.set(arr[i], (cnt.get(arr[i]) || 0) + 1);
  const pls = P ? P.byCh[c].map(x => P.list[x.i]) : [], HL = Highlights.all();
  let h = `<h2 class="chtitle"><small>${esc(B.book(c).en)} ${B.chNum[c]}</small>${esc(B.book(c).km)} <span>${kmNum(B.chNum[c])}</span></h2>`;
  if (!TEXT) h += '<p class="muted loading">កំពុងទាញយកអត្ថបទ ពគប…</p>';
  else {
    h += '<div class="verses">';
    for (let g = v0; g < v1; g++) {
      let t = esc(TEXT[g] || '');
      for (const pl of pls) if (pl.re && pl.v.includes(g)) t = t.replace(pl.re, m => `<a class="place" href="maps.html#${B.ref(c, -1)}" data-p="${pl.i}" title="${esc(pl.en)} — មើលលើផែនទី">${m}</a>`);
      const n = cnt.get(g) || 0, hl = HL[g];
      h += `<span class="v${g === S.g ? ' sel' : ''}${hl && hl.c ? ' hl-' + hl.c : ''}${g === S.tool ? ' tooling' : ''}" id="g${g}" data-g="${g}"><sup>${kmNum(g - v0 + 1)}</sup>${t}` +
        (hl && hl.n ? `<button class="nt" data-t="${g}" title="${esc(hl.n)}">✎</button>` : '') +
        (QAIDX[g] ? `<a class="qam" href="qa.html#${QAIDX[g][0].id}" title="${esc(QAIDX[g].map(x => x.q).join(' · '))}">?</a>` : '') +
        `${n ? `<button class="xr" data-x="${g}" title="${n} cross-references">${kmNum(n)}</button>` : ''} </span>`;
      if (g === S.tool) h += toolbox(g, hl);
      if (g === S.open) h += xbox(g, arr);
    }
    h += '</div>';
  }
  $('#text').innerHTML = h;
  $('#text').querySelectorAll('.xr').forEach(b => b.onclick = e => { e.stopPropagation(); const g = +b.dataset.x; S.open = S.open === g ? -1 : g; render(false); });
  $('#text').querySelectorAll('.place').forEach(a => a.onclick = e => { e.stopPropagation(); });
  $('#text').querySelectorAll('.xbox [data-go]').forEach(a => a.onclick = () => go(B.verseCh[+a.dataset.go], +a.dataset.go));
  $('#text').querySelectorAll('.xbox [data-copy]').forEach(b => b.onclick = () => copyVerse(+b.dataset.copy, b));
  // tap a verse → highlight / note / copy / share toolbar
  $('#text').querySelectorAll('.v').forEach(el => el.onclick = e => {
    if (e.target.closest('a,button') || String(getSelection()).length > 2) return;
    const g = +el.dataset.g; S.tool = S.tool === g ? -1 : g; S.open = -1; render(false);
  });
  $('#text').querySelectorAll('.nt').forEach(b => b.onclick = e => { e.stopPropagation(); const g = +b.dataset.t; S.tool = g; S.open = -1; render(false); });
  bindToolbox();
  if (scroll) {
    if (S.g >= 0 && TEXT) { const el = document.getElementById('g' + S.g); el && el.scrollIntoView({ block: 'center' }); el && el.classList.add('flash'); }
    else window.scrollTo({ top: 0 });
    Reading.setLast(B.ref(c, S.g >= 0 ? S.g : -1), S.g >= 0 ? B.label(S.g) : B.chLabel(c));
  }
  renderPlaces(pls); renderProgress();
}
function xbox(g, arr) {
  const refs = [];
  for (let i = 0; i < arr.length; i += 4) if (arr[i] === g) refs.push([arr[i + 1], arr[i + 2], arr[i + 3]]);
  refs.sort((a, b) => b[2] - a[2]);
  return `<div class="xbox"><div class="xhead"><b>ខយោង ${esc(B.label(g))}</b>
    <span><button data-copy="${g}">ចម្លង</button><a href="./#${B.ref(B.verseCh[g], g)}">ធ្នូ ›</a></span></div>` +
    refs.slice(0, 12).map(([t, e, v]) => {
      let tx = ''; for (let k = t; k <= Math.min(e, t + 2); k++) tx += (k > t ? ' ' : '') + esc(TEXT[k] || '');
      return `<div class="xr-item" data-go="${t}"><span class="lbl">${esc(B.label(t))}${e > t ? '–' + kmNum(B.vNum(e)) : ''}<i>▲ ${kmNum(v)}</i></span><span class="tx">${tx}${e > t + 2 ? ' …' : ''}</span></div>`;
    }).join('') + (refs.length > 12 ? `<a class="sm" href="./#${B.ref(B.verseCh[g], g)}">+ ${kmNum(refs.length - 12)} ទៀត ក្នុងទំព័រធ្នូ ›</a>` : '') + '</div>';
}
function toolbox(g, hl) {
  return `<div class="tbox" data-g="${g}"><div class="trow"><b>${esc(B.label(g))}</b>
    <span class="sw">${HL_COLORS.map(([k, l]) => `<button class="c-${k}${hl && hl.c === k ? ' on' : ''}" data-c="${k}" title="${l}" aria-label="គូស${l}"></button>`).join('')}
    ${hl && hl.c ? '<button class="clr" data-c="" title="លុបពណ៌">✕</button>' : ''}</span>
    <span class="acts"><button data-copy="${g}">ចម្លង</button><button data-share="${g}">តំណ</button><a href="./#${B.ref(B.verseCh[g], g)}">ធ្នូ ›</a></span></div>
    <textarea placeholder="កំណត់ចំណាំរបស់អ្នក…" rows="2">${esc(hl && hl.n || '')}</textarea>
    ${QAIDX[g] ? `<div class="tqa"><b>សំណួរដែលប្រើខនេះ</b>${QAIDX[g].slice(0, 4).map(it => `<a href="qa.html#${it.id}">${esc(it.q)}</a>`).join('')}</div>` : ''}
    <div class="muted tiny">រក្សាទុកក្នុងកម្មវិធីរុករករបស់អ្នក · មើលទាំងអស់នៅទំព័រ <a href="today.html#highlights">ថ្ងៃនេះ</a></div></div>`;
}
function bindToolbox() {
  const box = document.querySelector('.tbox'); if (!box) return;
  const g = +box.dataset.g;
  box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { Highlights.set(g, { c: b.dataset.c || undefined }); if (b.dataset.c) track('highlight'); render(false); });
  box.querySelector('[data-copy]').onclick = e => copyVerse(g, e.target);
  box.querySelector('[data-share]').onclick = e => {
    const url = location.href.split('#')[0] + '#' + B.ref(B.verseCh[g], g);
    (navigator.share ? navigator.share({ title: B.label(g), text: TEXT[g], url }) : navigator.clipboard.writeText(url)).then(() => { e.target.textContent = 'រួចរាល់ ✓'; }, () => {});
  };
  const ta = box.querySelector('textarea');
  ta.oninput = () => Highlights.set(g, { n: ta.value });
  ta.onblur = () => render(false);
}
function copyVerse(g, btn) {
  track('copy-verse');
  const s = `${TEXT[g]}\n— ${B.label(g)} (ពគប ១៩៥៤)`;
  (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => { btn.textContent = 'បានចម្លង ✓'; }, () => { btn.textContent = 'មិនអាចចម្លង'; });
}
function saveScroll() {
  if (!TEXT) return;
  const vs = document.querySelectorAll('.v');
  for (const el of vs) if (el.getBoundingClientRect().bottom > 90) { const g = +el.dataset.g; Reading.setLast(B.ref(S.c, g), B.label(g)); return; }
}

// ---------- side: verse of the day, places, progress ----------
function renderVotd() {
  const r = B.parse(votdRef()); if (!r) return;
  $('#votd').innerHTML = `<div class="votd"><div class="k">ខគម្ពីរប្រចាំថ្ងៃ · VERSE OF THE DAY</div>
    <p>${TEXT ? esc(TEXT[r.g]) : '…'}</p><div class="acts"><a href="#${B.ref(r.c, r.g)}">${esc(B.label(r.g))} ›</a><a href="./#${B.ref(r.c, r.g)}">ធ្នូសម្ពន្ធ ›</a></div></div>`;
}
function renderPlaces(pls) {
  const box = $('#placesbox');
  box.hidden = !pls.length || typeof L === 'undefined';
  if (box.hidden) return;
  $('#bigmap').href = 'maps.html#' + B.ref(S.c, -1);
  if (!mini) {
    mini = L.map('minimap', { zoomControl: false, attributionControl: true, scrollWheelZoom: false, preferCanvas: true });
    mini._base = Places.baseLayers(mini).themed().addTo(mini);
    miniLayer = L.layerGroup().addTo(mini);
  }
  renderMini(pls);
}
function renderMini(pls = P ? P.byCh[S.c].map(x => P.list[x.i]) : []) {
  if (!mini || !pls.length) return;
  miniLayer.clearLayers();
  const pts = pls.map(pl => [pl.lat, pl.lon]);
  if (pts.length > 1) L.polyline(pts, { color: cssVar('--accent'), weight: 2, dashArray: '5 5' }).addTo(miniLayer);
  pls.forEach((pl, k) => L.circleMarker([pl.lat, pl.lon], { radius: 6, color: cssVar('--bg'), weight: 1, fillColor: pl.g[2], fillOpacity: .85 })
    .bindTooltip(`<b class="ord">${kmNum(k + 1)}</b> ${esc(pl.name)}`, { permanent: pls.length <= 6, direction: 'right', className: 'plabel' }).addTo(miniLayer));
  setTimeout(() => { mini.invalidateSize(); pts.length === 1 ? mini.setView(pts[0], 8) : mini.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 9 }); }, 0);
}
function renderProgress() {
  const read = Reading.read(), bi = B.chBook[S.c], a = B.bookFirstCh[bi], b = B.bookFirstCh[bi + 1];
  let inBook = 0; for (let c = a; c < b; c++) if (read.has(c)) inBook++;
  const pct = read.size / B.NC * 100;
  $('#progress').innerHTML = `<h3>ការអានរបស់អ្នក</h3>
    <div class="bigpct"><b>${kmNum(pct < 10 ? pct.toFixed(1) : Math.round(pct))}%</b><span>${kmNum(read.size.toLocaleString('en'))} / ${kmNum('1,189')} ជំពូក នៃព្រះគម្ពីរទាំងមូល</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="bk"><span>${esc(B.meta.books[bi].km)}</span><span class="muted">${kmNum(inBook)} / ${kmNum(b - a)}</span></div>
    <div class="grid">${Array.from({ length: b - a }, (_, k) => `<a href="#${B.ref(a + k, -1)}" class="${read.has(a + k) ? 'r' : ''}${a + k === S.c ? ' cur' : ''}" title="ជំពូក ${kmNum(k + 1)}">${kmNum(k + 1)}</a>`).join('')}</div>
    <p class="muted tiny">ជំពូកមួយត្រូវបានរាប់ថា «បានអាន» នៅពេលអ្នកអានដល់ចុងជំពូក។ ទិន្នន័យរក្សាទុកតែក្នុងកម្មវិធីរុករករបស់អ្នក។</p>`;
}

// ---------- personal reading statistics ----------
const KM_MONTH = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const KM_DOW = ['ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស', 'អា']; // Mon → Sun
function renderStats() {
  const st = Stats.summary(), box = $('#stats');
  const todayMin = st.today.s / 60, pct = Math.min(1, todayMin / st.goal), R = 30, C = 2 * Math.PI * R;
  // heat-map: 26 weeks (Mon-first columns), today in the last column
  const WEEKS = 26, today = new Date(), dow = (today.getDay() + 6) % 7;
  const start = Stats.addDays(today, -(WEEKS - 1) * 7 - dow);
  let cells = '', months = '', lastM = -1, lastW = -9;
  for (let w = 0; w < WEEKS; w++) {
    const colStart = Stats.addDays(start, w * 7);
    if (colStart.getMonth() !== lastM) {
      // a label needs ~4 weeks of room; skip it if the previous one is too close or it would run off the end
      if (w - lastW >= 4 && w <= WEEKS - 3) { months += `<span style="left:${w / WEEKS * 100}%">${KM_MONTH[colStart.getMonth()]}</span>`; lastW = w; }
      lastM = colStart.getMonth();
    }
    for (let d = 0; d < 7; d++) {
      const x = Stats.addDays(start, w * 7 + d), k = Stats.dayKey(x), v = st.o[k];
      if (x > today) { cells += '<i class="fut"></i>'; continue; }
      const m = v ? v.s / 60 : 0, ch = v && v.l ? v.l.length : 0;
      const lv = !Stats.active(v) ? 0 : m >= st.goal * 2 ? 4 : m >= st.goal ? 3 : m >= st.goal / 2 ? 2 : 1;
      cells += `<i class="l${lv}${k === Stats.dayKey() ? ' td' : ''}" title="${x.getDate()} ${KM_MONTH[x.getMonth()]} · ${Math.round(m)} នាទី · ${ch} ជំពូក"></i>`;
    }
  }
  box.innerHTML = `<h3>ស្ថិតិការអានរបស់អ្នក</h3>
    <div class="today">
      <svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true"><circle cx="38" cy="38" r="${R}" class="trk"/><circle cx="38" cy="38" r="${R}" class="val"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 38 38)"/><text x="38" y="36" text-anchor="middle">${kmNum(Math.floor(todayMin))}</text><text x="38" y="51" text-anchor="middle" class="u">នាទី</text></svg>
      <div><b>ថ្ងៃនេះ</b><span>${pct >= 1 ? 'សម្រេចគោលដៅហើយ ✓' : `នៅសល់ ${kmNum(Math.ceil(st.goal - todayMin))} នាទីទៀត`} · ${kmNum(st.today.l.length)} ជំពូក</span>
        <label class="goal">គោលដៅ <select id="goal">${[5, 10, 15, 20, 30, 60].map(g => `<option value="${g}"${g === st.goal ? ' selected' : ''}>${kmNum(g)} នាទី</option>`).join('')}</select></label></div>
    </div>
    <div class="kpis">
      <div><b>🔥 ${kmNum(st.streak)}</b><span>ថ្ងៃជាប់គ្នា</span></div>
      <div><b>${kmNum(st.best)}</b><span>ជាប់គ្នាយូរបំផុត</span></div>
      <div><b>${kmNum(st.weekDays)}/៧</b><span>ថ្ងៃ សប្ដាហ៍នេះ</span></div>
      <div><b>${fmtMin(st.week)}</b><span>សប្ដាហ៍នេះ</span></div>
      <div><b>${kmNum(st.perWeek.toFixed(1))}</b><span>ថ្ងៃ/សប្ដាហ៍ (៤ សប្ដាហ៍)</span></div>
      <div><b>${fmtMin(st.totalSec)}</b><span>សរុប · ${kmNum(st.days)} ថ្ងៃ</span></div>
    </div>
    <div class="heat"><div class="months">${months}</div><div class="hm"><div class="dows">${KM_DOW.map((d, i) => `<span>${i % 2 ? '' : d}</span>`).join('')}</div><div class="cells">${cells}</div></div>
      <div class="lg">តិច <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> ច្រើន</div></div>
    <div class="dataacts"><button id="bk">⬇ រក្សាទុកច្បាប់ចម្លង</button><label class="btn">⬆ ស្ដារ<input id="rs" type="file" accept=".json,application/json" hidden></label><button id="rz" class="danger">លុប</button></div>
    <p class="muted tiny">រាប់តែពេលអ្នកកំពុងអានពិតប្រាកដ (ទំព័របើក និងមានការរំកិល/ចុចក្នុង ៩០ វិនាទី)។ ទិន្នន័យទាំងអស់នៅតែក្នុងកម្មវិធីរុករករបស់អ្នក — មិនផ្ញើទៅកន្លែងណាទេ។ ប្រើ «រក្សាទុកច្បាប់ចម្លង» ដើម្បីផ្ទេរទៅឧបករណ៍ផ្សេង។</p>`;
  $('#goal').onchange = e => { Stats.setGoal(+e.target.value); renderStats(); };
  $('#bk').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Stats.exportJSON()], { type: 'application/json' }));
    a.download = `khmer-bible-reading-${Stats.dayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#rs').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { Stats.importJSON(await f.text()); renderStats(); renderProgress(); flash('បានស្ដារទិន្នន័យ ✓'); } catch (err) { flash('ឯកសារមិនត្រឹមត្រូវ'); }
  };
  const rz = $('#rz');
  rz.onclick = () => {
    if (rz.dataset.arm) { Stats.reset(); renderStats(); renderProgress(); flash('បានលុបទិន្នន័យការអាន'); return; }
    rz.dataset.arm = 1; rz.textContent = 'ចុចម្ដងទៀត ដើម្បីលុប'; setTimeout(() => { if (rz.isConnected) { delete rz.dataset.arm; rz.textContent = 'លុប'; } }, 4000);
  };
}
function flash(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------- reading plan (side box + "next in plan" at chapter end) ----------
function planChips(st, day) {
  return st.plan.portions[day].map(c => `<a href="#${B.ref(c, -1)}" class="${st.fin.has(c) ? 'r' : ''}${c === S.c ? ' cur' : ''}">${esc(B.chLabel(c))}</a>`).join('');
}
function renderPlan() {
  const box = $('#planbox'), st = Plans.status(B);
  if (!st) { box.innerHTML = `<div class="plancta"><b>ផែនការអាន</b><span>អានព្រះគម្ពីរមួយឆ្នាំ សញ្ញាថ្មី ៩០ ថ្ងៃ និងច្រើនទៀត</span><a href="today.html#plan">ជ្រើសរើសផែនការ ›</a></div>`; return; }
  // today's portion, or the earliest unfinished day if the reader has fallen behind
  const day = st.finished ? st.plan.days - 1 : (st.next >= 0 && st.next < st.today ? st.next : st.today);
  const pct = st.doneN / st.plan.days * 100;
  box.innerHTML = `<h3>${esc(st.plan.km)}</h3>
    <div class="bk"><span>ថ្ងៃទី ${kmNum(day + 1)} / ${kmNum(st.plan.days)}${st.done[day] ? ' ✓' : ''}</span><span class="muted">${st.finished ? 'បានបញ្ចប់ 🎉' : st.behind > 0 ? `យឺត ${kmNum(st.behind)} ថ្ងៃ` : 'តាមកាលវិភាគ'}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="pchips">${planChips(st, day)}</div>
    <a class="sm" href="today.html#plan">មើលផែនការទាំងមូល ›</a>`;
}
function renderPlanNext() {
  const el = $('#plannext'); if (!el) return;
  const st = Plans.status(B); el.innerHTML = ''; if (!st || st.finished) return;
  // is this chapter part of an unfinished plan day? → offer the next unread chapter of that day
  const day = st.plan.portions.findIndex((p, i) => !st.done[i] && p.includes(S.c));
  if (day < 0) return;
  const nxt = st.plan.portions[day].find(c => c !== S.c && !st.fin.has(c));
  el.innerHTML = nxt !== undefined
    ? `<a href="#${B.ref(nxt, -1)}"><small>ផែនការ · ថ្ងៃទី ${kmNum(day + 1)} · បន្ទាប់</small><b>${esc(B.chLabel(nxt))} ›</b></a>`
    : `<a href="today.html#plan"><small>ផែនការ · ថ្ងៃទី ${kmNum(day + 1)}</small><b>ជំពូកចុងក្រោយនៃថ្ងៃនេះ — អានដល់ចុង ដើម្បីបញ្ចប់ ✓</b></a>`;
}
