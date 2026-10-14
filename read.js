/* Reader: chapter by chapter, with cross-references, places and reading progress. */
'use strict';

let B, P, TEXT = null, mini = null, miniLayer = null;
const XREF = new Map();
const S = { c: 0, g: -1, open: -1, at: Date.now() };
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
    endTimer = setTimeout(() => { if (c === S.c) { Reading.markRead(c); renderProgress(); } }, wait);
  }), { threshold: 1 }).observe($('#end'));
  Places.load(B).then(p => { P = p; render(); });
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
  S.c = r.c; S.g = r.g; S.open = -1;
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
  const pls = P ? P.byCh[c].map(x => P.list[x.i]) : [];
  let h = `<h2 class="chtitle"><small>${esc(B.book(c).en)} ${B.chNum[c]}</small>${esc(B.book(c).km)} <span>${kmNum(B.chNum[c])}</span></h2>`;
  if (!TEXT) h += '<p class="muted loading">កំពុងទាញយកអត្ថបទ ពគប…</p>';
  else {
    h += '<div class="verses">';
    for (let g = v0; g < v1; g++) {
      let t = esc(TEXT[g] || '');
      for (const pl of pls) if (pl.re && pl.v.includes(g)) t = t.replace(pl.re, m => `<a class="place" href="maps.html#${B.ref(c, -1)}" data-p="${pl.i}" title="${esc(pl.en)} — មើលលើផែនទី">${m}</a>`);
      const n = cnt.get(g) || 0;
      h += `<span class="v${g === S.g ? ' sel' : ''}" id="g${g}" data-g="${g}"><sup>${kmNum(g - v0 + 1)}</sup>${t}${n ? `<button class="xr" data-x="${g}" title="${n} cross-references">${kmNum(n)}</button>` : ''} </span>`;
      if (g === S.open) h += xbox(g, arr);
    }
    h += '</div>';
  }
  $('#text').innerHTML = h;
  $('#text').querySelectorAll('.xr').forEach(b => b.onclick = e => { e.stopPropagation(); const g = +b.dataset.x; S.open = S.open === g ? -1 : g; render(false); });
  $('#text').querySelectorAll('.place').forEach(a => a.onclick = e => { e.stopPropagation(); });
  $('#text').querySelectorAll('.xbox [data-go]').forEach(a => a.onclick = () => go(B.verseCh[+a.dataset.go], +a.dataset.go));
  $('#text').querySelectorAll('.xbox [data-copy]').forEach(b => b.onclick = () => copyVerse(+b.dataset.copy, b));
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
function copyVerse(g, btn) {
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
