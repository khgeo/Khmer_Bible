/* Questions & answers — short summaries, with the verses themselves loaded live from ពគប. */
'use strict';

let B, QA, TEXT = null;
const UI = { cat: '', q: '', open: new Set(), shown: 40 };
const MAXV = 6; // verses shown per reference range

(async function init() {
  [B, QA] = await Promise.all([Bible.load(), fetch('data/qa.json').then(r => r.json())]);
  const total = QA.items.length;
  $('#cats').innerHTML = `<button data-c="" class="on">ទាំងអស់ <small>${kmNum(total)}</small></button>` +
    QA.cats.map(c => `<button data-c="${c.id}">${esc(c.km)} <small>${kmNum(c.n)}</small></button>`).join('');
  $('#cats').onclick = e => { const b = e.target.closest('button'); if (!b) return; UI.cat = b.dataset.c; UI.shown = 40; setHash(); render(); };
  $('#qs').addEventListener('input', e => { UI.q = e.target.value.trim(); UI.shown = 40; render(); });
  $('#qform').onsubmit = e => e.preventDefault();
  $('#rand').onclick = () => { const it = QA.items[Math.floor(Math.random() * total)]; UI.cat = ''; UI.q = ''; $('#qs').value = ''; openOnly(it.id); };
  window.addEventListener('hashchange', fromHash);
  fromHash();
  KhmerText.load(B.meta).then(t => { TEXT = t; render(); }).catch(() => {});
})().catch(e => { console.error(e); setStatus('err', e.message); });

function fromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (QA.items.some(x => x.id === h)) { openOnly(h, true); return; }
  if (QA.cats.some(c => c.id === h)) UI.cat = h;
  render();
}
function setHash() { history.replaceState(null, '', UI.cat ? '#' + UI.cat : location.pathname); }
function openOnly(id, fromhash) {
  UI.open = new Set([id]); const it = QA.items.find(x => x.id === id);
  if (UI.cat && it.c !== UI.cat) UI.cat = '';
  // make sure the question is within the rendered part of the list
  const idx = QA.items.filter(x => !UI.cat || x.c === UI.cat).indexOf(it);
  UI.shown = Math.max(UI.shown, idx + 20);
  if (!fromhash) history.replaceState(null, '', '#' + id);
  render();
  const el = document.getElementById('q-' + id); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  track('qa-open');
}

// "John.3.16" or "Rom.8.38-39" → [first, last] global verse indices
function span(r) {
  const m = r.match(/^(.+\.\d+)\.(\d+)(?:-(\d+))?$/); if (!m) return null;
  const a = B.parse(`${m[1]}.${m[2]}`); if (!a) return null;
  return [a.g, m[3] ? a.g + (+m[3] - +m[2]) : a.g];
}
const norm = s => toAscii(s).toLowerCase().replace(/[\s​‌?!.,«»"']/g, '').replace(/្ត/g, '្ដ');
function matches(it, q) {
  if (!q) return true;
  const k = norm(q);
  return norm(it.q).includes(k) || norm(it.en).includes(k) || norm(it.a).includes(k);
}

function render() {
  document.querySelectorAll('#cats button').forEach(b => b.classList.toggle('on', b.dataset.c === UI.cat));
  const list = QA.items.filter(it => (!UI.cat || it.c === UI.cat) && matches(it, UI.q));
  const cat = c => QA.cats.find(x => x.id === c);
  let h = `<div class="count">${kmNum(list.length)} សំណួរ${UI.q ? ` សំរាប់ «${esc(UI.q)}»` : ''}${UI.cat ? ` · ${esc(cat(UI.cat).km)}` : ''}</div>`;
  if (UI.cat === 'prayer') h += `<a class="pbanner" href="prayer.html">🙏 <b>ទំព័រអធិស្ឋាន</b> — របៀបអធិស្ឋាន · សេចក្ដីអធិស្ឋានក្នុងព្រះគម្ពីរ · អធិស្ឋានសំរាប់សេចក្ដីត្រូវការផ្សេងៗ ›</a>`;
  if (!list.length) h += `<p class="muted">រកមិនឃើញ។ <a href="https://github.com/khgeo/Khmer_Bible/issues/new" target="_blank" rel="noopener">ស្នើសំណួរនេះ ›</a></p>`;
  for (const it of list.slice(0, UI.shown)) {
    const open = UI.open.has(it.id);
    h += `<article class="qa${open ? ' open' : ''}" id="q-${it.id}">
      <button class="qq" data-id="${it.id}" aria-expanded="${open}"><span class="qt">${esc(it.q)}</span><small>${esc(it.en)}</small>
        <span class="meta"><i class="ctag">${esc(cat(it.c).km)}</i>${it.d ? '<i class="dbadge">មានការយល់ខុសគ្នា</i>' : ''}${it.auto ? '<i class="abadge">គណនាពីទិន្នន័យ</i>' : ''}</span><b class="chev">⌄</b></button>
      ${open ? body(it) : ''}</article>`;
  }
  if (list.length > UI.shown) h += `<button class="more" id="more">+ ${kmNum(list.length - UI.shown)} សំណួរទៀត</button>`;
  $('#list').innerHTML = h;
  $('#list').querySelectorAll('.qq').forEach(b => b.onclick = () => {
    const id = b.dataset.id; UI.open.has(id) ? UI.open.delete(id) : (UI.open.add(id), track('qa-open'));
    history.replaceState(null, '', UI.open.has(id) ? '#' + id : (UI.cat ? '#' + UI.cat : location.pathname)); render();
  });
  $('#list').querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
    const url = location.href.split('#')[0] + '#' + b.dataset.copy;
    (navigator.share ? navigator.share({ title: QA.items.find(x => x.id === b.dataset.copy).q, url }) : navigator.clipboard.writeText(url)).then(() => { b.textContent = 'រួចរាល់ ✓'; }, () => {});
  });
  const mb = $('#more'); if (mb) mb.onclick = () => { UI.shown += 60; render(); };
  // related BibleProject videos for opened questions
  $('#list').querySelectorAll('.qvids').forEach(async el => {
    const vs = await Videos.forQuestion(el.dataset.for); if (!vs.length) return;
    el.innerHTML = `<h4>វីដេអូពន្យល់</h4><div class="qvgrid">${vs.map((v, i) => Videos.card(v, i)).join('')}</div>`;
    Videos.bind(el, vs);
  });
}
function body(it) {
  const verses = it.r.map(r => {
    const s = span(r); if (!s) return '';
    const [a, b] = s, c = B.verseCh[a], last = Math.min(b, a + MAXV - 1);
    let t = '';
    if (TEXT) for (let g = a; g <= last; g++) t += (b > a ? `<sup>${kmNum(B.vNum(g))}</sup>` : '') + esc(TEXT[g] || '') + ' ';
    else t = '<span class="muted">កំពុងផ្ទុក…</span>';
    if (b > last) t += '…';
    const lbl = B.label(a) + (b > a ? '–' + kmNum(B.vNum(b)) : '');
    return `<div class="vs"><div class="vl"><a href="read.html#${B.ref(c, a)}">${esc(lbl)}</a><a class="sm" href="./#${B.ref(c, a)}">ធ្នូ ›</a></div><p>${t}</p></div>`;
  }).join('');
  const related = QA.items.filter(x => x.id !== it.id && x.r.some(r => it.r.includes(r))).slice(0, 4);
  return `<div class="qb"><p class="ans">${esc(it.a)}</p>
    ${it.d ? '<p class="dnote">គ្រីស្ទានស្មោះត្រង់មានការយល់ខុសគ្នាលើប្រធានបទនេះ។ សូមអានខគម្ពីរទាំងនេះ ហើយពិភាក្សាជាមួយពួកជំនុំរបស់អ្នក។</p>' : ''}
    <h4>ព្រះគម្ពីរចែងថា</h4>${verses}
    ${related.length ? `<h4>សំណួរទាក់ទង</h4><div class="rel">${related.map(x => `<a href="#${x.id}">${esc(x.q)}</a>`).join('')}</div>` : ''}
    <div class="qvids" data-for="${it.id}"></div>
    <div class="qacts"><button data-copy="${it.id}">ចែករំលែក</button></div></div>`;
}
