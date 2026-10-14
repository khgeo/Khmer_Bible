/* Bible places map — every place mentioned in the Bible, linked to the Khmer ពគប text. */
'use strict';

let B, P, TEXT = null, map, layer, routeLayer, baseThemed, baseCtl, playing = null;
const S = { book: -1, chap: -1, sel: -1, q: '' };
const MAXV = 60;

(async function init() {
  B = await Bible.load();
  P = await Places.load(B);
  buildMap();
  const bs = $('#book');
  B.meta.books.forEach((b, i) => bs.add(new Option(`${b.km} · ${b.en}`, i)));
  bs.onchange = () => { stopPlay(); setHash(bs.value === '' ? '' : 'b=' + B.meta.books[+bs.value].osis); };
  $('#chap').onchange = e => { stopPlay(); const v = e.target.value; setHash(v === '' ? (S.book >= 0 ? 'b=' + B.meta.books[S.book].osis : '') : B.ref(+v, -1)); };
  $('#play').onclick = () => playing ? stopPlay() : startPlay();
  $('#pq').addEventListener('input', e => { S.q = e.target.value.trim(); if (S.q) renderSearch(); else renderPanel(); });
  $('#pq').addEventListener('keydown', e => { if (e.key === 'Enter') { const r = searchPlaces(S.q)[0]; if (r) selectPlace(r.i, true); } });
  window.addEventListener('hashchange', route);
  window.addEventListener('themechange', swapThemedBase);
  legend();
  route();
  KhmerText.load(B.meta).then(t => { TEXT = t; renderPanel(); }).catch(() => {});
})().catch(e => { console.error(e); setStatus('err', e.message); });

// ---------- map ----------
function buildMap() {
  map = L.map('map', { zoomControl: true, preferCanvas: true, worldCopyJump: true }).setView([31.6, 35.4], innerWidth < 700 ? 6 : 7);
  const bl = Places.baseLayers();
  baseThemed = bl.themed().addTo(map);
  baseCtl = L.control.layers({ 'ផែនទី · Map': baseThemed, 'ផ្កាយរណប · Satellite': bl['ផ្កាយរណប · Satellite'], 'ភូមិសាស្ត្រ · Terrain': bl['ភូមិសាស្ត្រ · Terrain'] }, null, { position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
  layer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  map.on('click', () => { if (S.sel >= 0 && S.chap < 0) { S.sel = -1; draw(); renderPanel(); } });
}
function swapThemedBase() {
  const on = map.hasLayer(baseThemed);
  baseCtl.removeLayer(baseThemed); if (on) map.removeLayer(baseThemed);
  baseThemed = Places.baseLayers().themed();
  baseCtl.addBaseLayer(baseThemed, 'ផែនទី · Map');
  if (on) baseThemed.addTo(map).bringToBack();
  draw();
}
function legend() {
  $('#legend').innerHTML = PLACE_TYPES.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('') +
    '<span class="unc"><i></i>ទីតាំងមិនច្បាស់</span>';
}

// which places are visible, and how many verses each has in the current filter
function visiblePlaces() {
  if (S.chap >= 0) return P.byCh[S.chap].map(({ i }, k) => ({ pl: P.list[i], n: P.list[i].v.filter(g => B.verseCh[g] === S.chap).length, order: k + 1 }));
  if (S.book >= 0) {
    const a = B.chFirst[B.bookFirstCh[S.book]], b = B.chFirst[B.bookFirstCh[S.book + 1]];
    return P.list.map(pl => ({ pl, n: pl.v.filter(g => g >= a && g < b).length })).filter(x => x.n);
  }
  return P.list.map(pl => ({ pl, n: pl.v.length }));
}

function draw(fit) {
  layer.clearLayers(); routeLayer.clearLayers();
  const vis = visiblePlaces(), stroke = cssVar('--bg') || '#fff';
  const top = new Set([...vis].sort((x, y) => y.n - x.n).slice(0, S.chap >= 0 ? 99 : 14).map(x => x.pl.i));
  vis.sort((x, y) => y.n - x.n); // big circles first, small ones on top
  for (const { pl, n, order } of vis) {
    const unsure = pl.c < 500, sel = pl.i === S.sel;
    const m = L.circleMarker([pl.lat, pl.lon], {
      radius: Math.min(28, 3.5 + Math.sqrt(n) * (S.chap >= 0 ? 2.4 : 1.5)) + (sel ? 3 : 0),
      color: sel ? cssVar('--accent') : (unsure ? pl.g[2] : stroke), weight: sel ? 3 : (unsure ? 1.5 : 1), dashArray: unsure ? '3 3' : null,
      fillColor: pl.g[2], fillOpacity: unsure ? 0.25 : 0.62,
    }).addTo(layer);
    m.on('click', e => { L.DomEvent.stopPropagation(e); selectPlace(pl.i, false); });
    const tip = (order ? `<b class="ord">${kmNum(order)}</b> ` : '') + esc(pl.name) + (pl.km ? ` <small>${esc(pl.en)}</small>` : '');
    if (top.has(pl.i)) m.bindTooltip(tip, { permanent: true, direction: 'right', offset: [6, 0], className: 'plabel' });
    else m.bindTooltip(tip + ` <small>· ${kmNum(n)} ខ</small>`, { direction: 'top', className: 'plabel hover' });
  }
  // chapter mode: connect places in the order the text mentions them
  if (S.chap >= 0 && vis.length > 1) {
    const pts = vis.slice().sort((a, b) => a.order - b.order).map(x => [x.pl.lat, x.pl.lon]);
    L.polyline(pts, { color: cssVar('--accent'), weight: 2.5, opacity: .85, dashArray: '6 6' }).addTo(routeLayer);
  }
  $('#pstats').textContent = `${kmNum(vis.length.toLocaleString('en'))} ទីកន្លែង`;
  if (fit && vis.length) {
    const pts = vis.map(x => [x.pl.lat, x.pl.lon]);
    if (pts.length === 1) map.flyTo(pts[0], 8, { duration: .8 });
    else map.flyToBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 9, duration: .8 });
  }
}

// ---------- routing ----------
function setHash(h) { if (location.hash.slice(1) !== h) location.hash = h; else route(); }
function route() {
  const h = decodeURIComponent(location.hash.slice(1)), prm = new URLSearchParams(h);
  S.chap = -1; S.book = -1;
  const r = B.parse(h);
  if (r) { S.chap = r.c; S.book = B.chBook[r.c]; S.sel = -1; }
  else if (prm.get('b')) S.book = B.meta.books.findIndex(b => b.osis === prm.get('b'));
  if (prm.get('p')) { const i = P.list.findIndex(pl => pl.en === prm.get('p')); if (i >= 0) S.sel = i; }
  syncSelects();
  draw(true);
  if (S.sel >= 0 && !r) { const pl = P.list[S.sel]; map.flyTo([pl.lat, pl.lon], Math.max(map.getZoom(), 8), { duration: .8 }); }
  renderPanel();
}
function syncSelects() {
  $('#book').value = S.book >= 0 ? S.book : '';
  const cs = $('#chap'); cs.innerHTML = '<option value="">— ទាំងអស់ —</option>';
  cs.disabled = S.book < 0;
  if (S.book >= 0) for (let c = B.bookFirstCh[S.book]; c < B.bookFirstCh[S.book + 1]; c++) {
    const n = P.byCh[c].length; cs.add(new Option(`${kmNum(B.chNum[c])}` + (n ? ` · ${kmNum(n)} ទីកន្លែង` : ''), c));
  }
  cs.value = S.chap >= 0 ? S.chap : '';
}
function selectPlace(i, fly) {
  placeHTML.lim = 0;
  S.sel = i; S.q = ''; $('#pq').value = '';
  if (S.chap < 0) {
    const h = new URLSearchParams(); if (S.book >= 0) h.set('b', B.meta.books[S.book].osis); h.set('p', P.list[i].en);
    history.replaceState(null, '', '#' + h.toString());
  }
  draw(false);
  if (fly) { const pl = P.list[i]; map.flyTo([pl.lat, pl.lon], Math.max(map.getZoom(), 8), { duration: .8 }); }
  renderPanel();
}

// ---------- play through the Bible ----------
function startPlay() {
  let bi = S.book >= 0 && S.chap < 0 ? S.book : 0;
  $('#play').textContent = '■ ឈប់'; $('#play').classList.add('on');
  const step = () => {
    if (bi >= B.NB) return stopPlay();
    S.book = bi; S.chap = -1; S.sel = -1; syncSelects(); draw(true); renderPanel();
    history.replaceState(null, '', '#b=' + B.meta.books[bi].osis);
    const np = $('#nowplaying'); np.hidden = false;
    np.innerHTML = `<b>${esc(B.meta.books[bi].km)}</b><span>${esc(B.meta.books[bi].en)} · ${kmNum(bi + 1)}/៦៦</span>`;
    bi++; playing = setTimeout(step, 2200);
  };
  step();
}
function stopPlay() {
  if (!playing) return; clearTimeout(playing); playing = null;
  $('#play').textContent = '▶ ដំណើររឿងតាមសៀវភៅ'; $('#play').classList.remove('on'); $('#nowplaying').hidden = true;
}

// ---------- side panel ----------
const vtext = (g, pl) => TEXT ? Places.highlight(TEXT[g], pl) : '<span class="muted">កំពុងផ្ទុក…</span>';
const conf = c => c >= 900 ? 'ទីតាំងប្រាកដ' : c >= 500 ? 'ទីតាំងទំនងជាត្រូវ' : 'ទីតាំងមិនទាន់ច្បាស់';
const norm = s => toAscii(s).toLowerCase().replace(/[\s​‌\-]/g, '').replace(/្ត/g, '្ដ');
function searchPlaces(q) {
  const k = norm(q); if (!k) return [];
  return P.list.filter(pl => norm(pl.en).includes(k) || (pl.km && norm(pl.km).includes(k))).slice(0, 12);
}
function renderSearch() {
  const r = searchPlaces(S.q);
  $('#detail').innerHTML = `<h2>ស្វែងរក «${esc(S.q)}»</h2>` + (r.length ? '<div class="plist">' + r.map(pl => placeRow(pl, pl.v.length)).join('') + '</div>' : '<p class="muted">រកមិនឃើញ</p>');
  bindRows();
}
function placeRow(pl, n, order) {
  return `<div class="prow" data-i="${pl.i}">${order ? `<b class="ord">${kmNum(order)}</b>` : `<i style="background:${pl.g[2]}"></i>`}
    <span>${esc(pl.name)}${pl.km ? ` <small>${esc(pl.en)}</small>` : ''}</span><em>${kmNum(n)} ខ</em></div>`;
}
function bindRows() { document.querySelectorAll('.prow').forEach(el => el.onclick = () => selectPlace(+el.dataset.i, true)); }

function renderPanel() {
  if (S.q) return renderSearch();
  const d = $('#detail');
  if (S.sel >= 0) { d.innerHTML = placeHTML(P.list[S.sel]); bindPanel(); return; }
  if (S.chap >= 0) {
    const c = S.chap, list = P.byCh[c];
    d.innerHTML = `<h2>${esc(B.chLabel(c))}</h2><div class="muted sub">${esc(B.book(c).en)} ${B.chNum[c]} · ${kmNum(list.length)} ទីកន្លែង តាមលំដាប់ដែលបានរៀបរាប់</div>
      <div class="acts"><a href="read.html#${B.ref(c, -1)}">អានជំពូកនេះ ›</a><a href="./#${B.ref(c, -1)}">ខ្សែសម្ពន្ធ ›</a>
      <span class="nav"><button data-nav="-1" title="ជំពូកមុន">‹</button><button data-nav="1" title="ជំពូកបន្ទាប់">›</button></span></div>` +
      (list.length ? list.map(({ i, g }, k) => {
        const pl = P.list[i];
        return `<div class="stop" data-i="${i}"><b class="ord">${kmNum(k + 1)}</b><div><div class="nm">${esc(pl.name)}${pl.km ? ` <small>${esc(pl.en)}</small>` : ''}
          <a class="vref" href="read.html#${B.ref(c, g)}">${esc(B.label(g))}</a></div><p>${vtext(g, pl)}</p></div></div>`;
      }).join('') : '<p class="muted">ជំពូកនេះមិនមានការរៀបរាប់ទីកន្លែងទេ។</p>');
    d.querySelectorAll('.stop').forEach(el => el.onclick = e => { if (!e.target.closest('a')) selectPlace(+el.dataset.i, true); });
    d.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => {
      // jump to the nearest chapter in that direction that mentions a place
      let n = c + +el.dataset.nav; while (n >= 0 && n < B.NC && !P.byCh[n].length) n += +el.dataset.nav;
      if (n >= 0 && n < B.NC) setHash(B.ref(n, -1));
    });
    return;
  }
  const vis = visiblePlaces().sort((a, b) => b.n - a.n).slice(0, 18);
  d.innerHTML = `<h2>${S.book >= 0 ? esc(B.meta.books[S.book].km) : 'ទីកន្លែងក្នុងព្រះគម្ពីរ'}</h2>
    <p class="muted">${S.book >= 0 ? 'ទីកន្លែងដែលបានរៀបរាប់ក្នុងសៀវភៅនេះ។ ជ្រើសរើសជំពូក ដើម្បីមើលផ្លូវដំណើរតាមលំដាប់អត្ថបទ។'
      : 'រង្វង់នីមួយៗជាទីកន្លែងមួយ — ទំហំបង្ហាញចំនួនខដែលរៀបរាប់។ ចុចលើរង្វង់ ដើម្បីអានខគម្ពីរ។ សាកល្បង <a href="#Acts.27">កិច្ចការ ២៧</a> (ដំណើររបស់ប៉ុល ទៅក្រុងរ៉ូម) ឬ <a href="#Exod.14">និក្ខមនំ ១៤</a>។'}</p>
    <h3>ច្រើនជាងគេ</h3><div class="plist">${vis.map(x => placeRow(x.pl, x.n)).join('')}</div>`;
  bindRows();
}
function placeHTML(pl) {
  let vs = pl.v;
  if (S.book >= 0) { const a = B.chFirst[B.bookFirstCh[S.book]], b = B.chFirst[B.bookFirstCh[S.book + 1]]; vs = vs.filter(g => g >= a && g < b); }
  if (S.chap >= 0) vs = vs.filter(g => B.verseCh[g] === S.chap);
  const lim = vs.slice(0, placeHTML.lim || MAXV);
  return `<button class="back" data-back>‹ ត្រឡប់</button>
    <h2>${esc(pl.name)}</h2>
    <div class="muted sub">${pl.km ? esc(pl.en) + ' · ' : ''}<span class="tag" style="--c:${pl.g[2]}">${esc(pl.g[1])}</span></div>
    <div class="facts"><div><b>${kmNum(pl.v.length)}</b><span>ខសរុប</span></div><div><b>${kmNum(new Set(pl.v.map(g => B.chBook[B.verseCh[g]])).size)}</b><span>សៀវភៅ</span></div>
      <div><b class="${pl.c < 500 ? 'warn' : ''}">${esc(conf(pl.c))}</b><span>${pl.modern ? esc('សព្វថ្ងៃ៖ ' + pl.modern) : ''}</span></div></div>
    ${vs.length !== pl.v.length ? `<p class="muted sub">បង្ហាញ ${kmNum(vs.length)} ខ ក្នុង${S.chap >= 0 ? 'ជំពូក' : 'សៀវភៅ'}នេះ</p>` : ''}
    ${lim.map(g => `<div class="ref"><div class="lbl"><a href="read.html#${B.ref(B.verseCh[g], g)}">${esc(B.label(g))}</a><a class="sm" href="#${B.ref(B.verseCh[g], -1)}">ផែនទីជំពូក ›</a></div><div class="txt">${vtext(g, pl)}</div></div>`).join('')}
    ${vs.length > lim.length ? `<button class="more" data-more>+ ${kmNum(vs.length - lim.length)} ខទៀត</button>` : ''}`;
}
function bindPanel() {
  const d = $('#detail');
  d.querySelector('[data-back]').onclick = () => { S.sel = -1; placeHTML.lim = 0; if (S.chap < 0) history.replaceState(null, '', S.book >= 0 ? '#b=' + B.meta.books[S.book].osis : '#'); draw(false); renderPanel(); };
  const m = d.querySelector('[data-more]'); if (m) m.onclick = () => { placeHTML.lim = (placeHTML.lim || MAXV) + 200; renderPanel(); };
  $('#panel').scrollTop = 0;
}
