/* Prayer — how to pray, the Lord's Prayer, prayers in the Bible, topics and a private prayer list.
   Verses are loaded live from ពគប; the list is stored only in this browser (kb-prayers). */
'use strict';

let B, P, EV = null, TEXT = null;
const MAXV = 12;

// ---------- private prayer list ----------
// kb-prayers = { "<id>": { x: text, w: for whom, c: created ms, t: modified ms, a: answered ms|0, n: answer note, k: days prayed, d: last day prayed, del: 1 } }
const PrayerList = {
  all() { try { return JSON.parse(localStorage.getItem('kb-prayers') || '{}') || {}; } catch (e) { return {}; } },
  save(a) { try { localStorage.setItem('kb-prayers', JSON.stringify(a)); } catch (e) {} },
  add(x, w) { const a = PrayerList.all(), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5), now = Date.now();
    a[id] = { x, w, c: now, t: now, a: 0, n: '', k: 0, d: '' }; PrayerList.save(a); return id; },
  patch(id, p) { const a = PrayerList.all(); if (!a[id]) return; Object.assign(a[id], p, { t: Date.now() }); PrayerList.save(a); },
  // deletions are kept as a tombstone so a backup restore doesn't bring the item back
  remove(id) { PrayerList.patch(id, { del: 1, x: '', w: '', n: '' }); },
  items() { return Object.entries(PrayerList.all()).filter(([, v]) => !v.del).map(([id, v]) => ({ id, ...v })); },
};
const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const kmDate = ms => { const d = new Date(ms); return `${kmNum(d.getDate())}/${kmNum(d.getMonth() + 1)}/${kmNum(d.getFullYear())}`; };

(async function init() {
  [B, P, EV] = await Promise.all([Bible.load(), fetch('data/prayers.json').then(r => r.json()),
    fetch('data/evening.json').then(r => r.json()).catch(() => null)]);
  renderStatic(); renderList();
  $('#startGuided').onclick = () => Guided.open();
  $('#addForm').onsubmit = e => {
    e.preventDefault(); const x = $('#addTxt').value.trim(); if (!x) return;
    PrayerList.add(x, $('#addWho').value.trim()); $('#addTxt').value = ''; $('#addWho').value = '';
    LIST.tab = 'open'; renderList(); track('prayer-add');
  };
  window.addEventListener('hashchange', () => fromHash()); fromHash();
  KhmerText.load(B.meta).then(t => { TEXT = t; const y = scrollY; renderStatic(); fromHash({ track: false, scroll: y < 200 }); }).catch(() => {});
})().catch(e => { console.error(e); setStatus('err', e.message); });

// ---------- verse helpers ----------
function span(r) {
  const m = r.match(/^(.+\.\d+)\.(\d+)(?:-(\d+))?$/); if (!m) return null;
  const a = B.parse(`${m[1]}.${m[2]}`); if (!a) return null;
  return [a.g, m[3] ? a.g + (+m[3] - +m[2]) : a.g];
}
function vlabel(r) { const [a, b] = span(r); return B.label(a) + (b > a ? '–' + kmNum(B.vNum(b)) : ''); }
function vtext(r, max = MAXV) {
  const [a, b] = span(r), last = Math.min(b, a + max - 1);
  if (!TEXT) return '<span class="muted">កំពុងផ្ទុក…</span>';
  let t = ''; for (let g = a; g <= last; g++) t += (b > a ? `<sup>${kmNum(B.vNum(g))}</sup>` : '') + esc((TEXT[g] || '').replace(/^៙\s*/, '')) + ' ';
  return t + (b > last ? '…' : '');
}
function plain(r) { const [a, b] = span(r); if (!TEXT) return ''; let t = ''; for (let g = a; g <= b; g++) t += (TEXT[g] || '').replace(/^៙\s*/, '').replace(/​/g, '') + ' '; return t.trim(); }
function verse(r, max) {
  const [a] = span(r), c = B.verseCh[a];
  return `<div class="vs"><div class="vl"><a href="read.html#${B.ref(c, a)}">${esc(vlabel(r))}</a><a class="sm" href="./#${B.ref(c, a)}">ធ្នូ ›</a></div><p>${vtext(r, max)}</p></div>`;
}
const sample = p => esc(p).replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>');
function share(btn, title, text) {
  const url = location.href.split('#')[0] + (btn.dataset.hash ? '#' + btn.dataset.hash : '');
  const done = () => { const o = btn.textContent; btn.textContent = 'រួចរាល់ ✓'; setTimeout(() => btn.textContent = o, 1600); };
  if (btn.dataset.mode === 'copy' || !navigator.share) navigator.clipboard.writeText(text + '\n\n' + url).then(done, () => {});
  else navigator.share({ title, text, url }).then(done, () => {});
}

// ---------- static sections ----------
function renderStatic() {
  $('#heroV').innerHTML = `${TEXT ? esc(plain('Phil.4.6')) : '<span class="muted">កំពុងផ្ទុក…</span>'}<cite>${esc(vlabel('Phil.4.6'))}</cite>`;
  $('#acts').innerHTML = P.acts.map((s, i) => `<article class="act act-${s.id}">
    <div class="abig">${s.en[0]}</div><h3>${esc(s.km)} <small>${esc(s.en)}</small></h3>
    <p>${esc(s.x)}</p>${s.r.map(r => verse(r, 3)).join('')}
    <details><summary>គំរូសេចក្ដីអធិស្ឋាន</summary><p class="sp">${sample(s.p)}</p></details></article>`).join('');
  $('#tips').innerHTML = P.tips.map(t => `<details class="tip"><summary><b>${esc(t.t)}</b> <small>${esc(t.en)}</small></summary>
    <p>${esc(t.x)}</p>${t.r.map(r => verse(r, 3)).join('')}</details>`).join('');
  $('#lordsList').innerHTML = P.lords.map(l => `<li><p class="lv">${vtext(l.r)}</p><small class="lr">${esc(vlabel(l.r))}</small><p class="lx">${esc(l.x)}</p></li>`).join('');
  $('#tgrid').innerHTML = P.topics.map(t => `<a class="tcard${TOPIC === t.id ? ' on' : ''}" href="#topic-${t.id}" data-t="${t.id}"><span class="ti">${t.i}</span><b>${esc(t.t)}</b><small>${esc(t.en)}</small></a>`).join('');
  renderTopic(); renderBible(); renderTonight();
}

let TOPIC = null;
function renderTopic() {
  document.querySelectorAll('.tcard').forEach(a => a.classList.toggle('on', a.dataset.t === TOPIC));
  const t = P.topics.find(x => x.id === TOPIC), el = $('#tdetail');
  if (!t) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="tdet" id="td-${t.id}"><button class="x" data-close type="button" aria-label="Close">✕</button>
    <h3><span>${t.i}</span> ${esc(t.t)} <small>${esc(t.en)}</small></h3>
    <h4>ខគម្ពីរសំរាប់អធិស្ឋាន</h4>${t.r.map(r => verse(r, 4)).join('')}
    <h4>គំរូសេចក្ដីអធិស្ឋាន</h4><p class="sp big">${sample(t.p)}</p>
    <div class="acts2"><button data-share data-hash="topic-${t.id}" type="button">ចែករំលែក</button><button data-share data-mode="copy" data-hash="topic-${t.id}" type="button">ចម្លងសេចក្ដីអធិស្ឋាន</button><button data-addlist type="button">+ បញ្ចូលក្នុងបញ្ជីរបស់ខ្ញុំ</button></div></div>`;
  el.querySelector('[data-close]').onclick = () => { TOPIC = null; history.replaceState(null, '', '#topics'); renderTopic(); };
  el.querySelectorAll('[data-share]').forEach(b => b.onclick = () => share(b, t.t, `${t.t}\n\n${t.p}\n\n${t.r.map(r => vlabel(r) + ' ' + plain(r)).join('\n')}`));
  el.querySelector('[data-addlist]').onclick = e => { PrayerList.add(t.t + ' — ' + t.en, ''); renderList(); e.target.textContent = 'បានបញ្ចូល ✓'; track('prayer-add'); };
}

// ---------- tonight: pray the Scriptures (same plan as the evening post — data/evening.json) ----------
const TN = { off: 0 };
function evIndex(off = 0) {
  const s = EV.start.split('-').map(Number), d = new Date();
  const day = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + off) - Date.UTC(s[0], s[1] - 1, s[2])) / 864e5);
  return day;
}
function renderTonight() {
  const el = $('#tonightBox'); if (!el) return;
  if (!EV) { el.innerHTML = ''; return; }
  const n = evIndex(TN.off), N = EV.items.length, it = EV.items[((n % N) + N) % N], pr = EV.prompts[((n % EV.prompts.length) + EV.prompts.length) % EV.prompts.length];
  const d = new Date(); d.setDate(d.getDate() + TN.off);
  const when = TN.off === 0 ? 'យប់នេះ' : TN.off === -1 ? 'ម្សិលមិញ' : TN.off === 1 ? 'ស្អែក' : `${kmNum(d.getDate())}/${kmNum(d.getMonth() + 1)}/${kmNum(d.getFullYear())}`;
  const head = it.t || it.r.map(vlabel).join(' · ');
  el.innerHTML = `<div class="tn">
    <div class="tn-nav"><button data-d="-1" type="button" aria-label="Previous">‹</button><b>${esc(when)}</b><button data-d="1" type="button" aria-label="Next">›</button>
      ${TN.off ? '<button class="tn-today" data-d="0" type="button">យប់នេះ</button>' : ''}<small>${kmNum(((n % N) + N) % N + 1)} / ${kmNum(N)}</small></div>
    ${it.t ? `<h3>${esc(it.t)}</h3>` : ''}
    ${it.r.map(r => verse(r, 12)).join('')}
    <p class="tn-pr">🙏 ${esc(pr)}</p>
    <div class="acts2"><button data-share data-hash="tonight" type="button">ចែករំលែក</button><button data-guided type="button">អធិស្ឋានជាមួយការណែនាំ</button></div></div>`;
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const v = +b.dataset.d; TN.off = v === 0 ? 0 : TN.off + v; renderTonight(); });
  el.querySelector('[data-share]').onclick = e => share(e.target, head, `🌙 ${head}\n\n${it.r.map(r => vlabel(r) + '\n' + plain(r)).join('\n\n')}\n\n🙏 ${pr}`);
  el.querySelector('[data-guided]').onclick = () => Guided.open();
}

const BOPEN = new Set();
function renderBible() {
  $('#blist').innerHTML = P.bible.map(p => {
    const open = BOPEN.has(p.id);
    return `<article class="bp${open ? ' open' : ''}" id="bible-${p.id}">
      <button class="bq" data-id="${p.id}" aria-expanded="${open}"><span class="bt">${esc(p.t)}</span><small>${esc(p.en)} · ${esc(p.w)}</small><span class="br">${p.r.map(r => esc(vlabel(r))).join(' · ')}</span><b class="chev">⌄</b></button>
      ${open ? `<div class="bb">${p.r.map(r => verse(r)).join('')}<div class="acts2"><button data-share data-hash="bible-${p.id}" type="button">ចែករំលែក</button><a href="read.html#${(s => B.ref(B.verseCh[s[0]], s[0]))(span(p.r[0]))}">អានជំពូកពេញ ›</a></div></div>` : ''}
    </article>`;
  }).join('');
  $('#blist').querySelectorAll('.bq').forEach(b => b.onclick = () => {
    const id = b.dataset.id; BOPEN.has(id) ? BOPEN.delete(id) : (BOPEN.add(id), track('prayer-bible'));
    history.replaceState(null, '', BOPEN.has(id) ? '#bible-' + id : '#bible'); renderBible();
  });
  $('#blist').querySelectorAll('[data-share]').forEach(b => { const p = P.bible.find(x => 'bible-' + x.id === b.dataset.hash);
    b.onclick = () => share(b, p.t, `${p.t}\n\n${p.r.map(r => vlabel(r) + '\n' + plain(r)).join('\n\n')}`); });
}

function fromHash({ track: tr = true, scroll = true } = {}) {
  const h = decodeURIComponent(location.hash.slice(1));
  let target = null;
  if (h.startsWith('topic-') && P.topics.some(t => 'topic-' + t.id === h)) { TOPIC = h.slice(6); renderTopic(); target = '#tdetail'; if (tr) track('prayer-topic'); }
  else if (h.startsWith('bible-') && P.bible.some(t => 'bible-' + t.id === h)) { BOPEN.add(h.slice(6)); renderBible(); target = '#' + h; }
  else if (h === 'tonight') { target = '#tonight'; }
  else if (h === 'guided') { if (tr && $('#guided').hidden) Guided.open(); return; }
  if (target && scroll) { const el = $(target); if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30); }
}

// ---------- my prayer list ----------
const LIST = { tab: 'open', confirm: null, answering: null };
function renderList() {
  const items = PrayerList.items(), open = items.filter(x => !x.a).sort((a, b) => b.c - a.c), ans = items.filter(x => x.a).sort((a, b) => b.a - a.a);
  $('#ltabs').innerHTML = `<button data-tab="open" class="${LIST.tab === 'open' ? 'on' : ''}">កំពុងអធិស្ឋាន <small>${kmNum(open.length)}</small></button><button data-tab="ans" class="${LIST.tab === 'ans' ? 'on' : ''}">ព្រះបានឆ្លើយ <small>${kmNum(ans.length)}</small></button>`;
  $('#ltabs').querySelectorAll('button').forEach(b => b.onclick = () => { LIST.tab = b.dataset.tab; renderList(); });
  const list = LIST.tab === 'open' ? open : ans, td = today();
  let h = '';
  if (!list.length) h = LIST.tab === 'open'
    ? '<p class="muted empty">មិនទាន់មានសំណូមនៅឡើយ។ សរសេរអ្វីមួយខាងលើ ឬចុច «+ បញ្ចូលក្នុងបញ្ជីរបស់ខ្ញុំ» ពីប្រធានបទណាមួយ។</p>'
    : '<p class="muted empty">ពេលព្រះឆ្លើយសំណូមណាមួយ ចុច «✓ ព្រះបានឆ្លើយ» ដើម្បីកត់ត្រាទុកជាការចងចាំពីភាពស្មោះត្រង់របស់ទ្រង់ (ទំនុកដំកើង ១០៣:២)។</p>';
  for (const it of list) {
    const prayed = it.d === td;
    h += `<div class="pi${it.a ? ' done' : ''}" data-id="${it.id}">
      <div class="pt">${esc(it.x)}${it.w ? ` <span class="who">· ${esc(it.w)}</span>` : ''}</div>
      <div class="pm">ចាប់ផ្ដើម ${kmDate(it.c)}${it.k ? ` · បានអធិស្ឋាន ${kmNum(it.k)} ថ្ងៃ` : ''}${it.a ? ` · <b>ឆ្លើយនៅ ${kmDate(it.a)}</b>` : ''}</div>
      ${it.a && it.n ? `<p class="pn">${esc(it.n)}</p>` : ''}
      ${LIST.answering === it.id ? `<div class="ansf"><textarea rows="2" placeholder="តើព្រះបានឆ្លើយយ៉ាងដូចម្ដេច? (មិនចាំបាច់)"></textarea><div><button data-act="saveans" class="primary">រក្សាទុក</button><button data-act="cancel">បោះបង់</button></div></div>` : `
      <div class="pa">
        ${it.a ? `<button data-act="reopen">↺ បន្តអធិស្ឋាន</button>` : `<button data-act="pray" class="${prayed ? 'on' : ''}" ${prayed ? 'disabled' : ''}>${prayed ? '🙏 បានអធិស្ឋានថ្ងៃនេះ' : '🙏 ខ្ញុំបានអធិស្ឋាន'}</button><button data-act="answer">✓ ព្រះបានឆ្លើយ</button>`}
        <button data-act="del" class="del">${LIST.confirm === it.id ? 'ចុចម្ដងទៀតដើម្បីលុប' : 'លុប'}</button>
      </div>`}
    </div>`;
  }
  $('#mylist').innerHTML = h;
  $('#mylist').querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const id = b.closest('.pi').dataset.id, it = PrayerList.all()[id], act = b.dataset.act;
    if (act !== 'del') LIST.confirm = null;
    if (act === 'pray') PrayerList.patch(id, { k: (it.k || 0) + 1, d: today() });
    if (act === 'answer') LIST.answering = id;
    if (act === 'cancel') LIST.answering = null;
    if (act === 'saveans') { PrayerList.patch(id, { a: Date.now(), n: b.closest('.ansf').querySelector('textarea').value.trim() }); LIST.answering = null; track('prayer-answered'); }
    if (act === 'reopen') PrayerList.patch(id, { a: 0 });
    if (act === 'del') { if (LIST.confirm === id) { PrayerList.remove(id); LIST.confirm = null; } else LIST.confirm = id; }
    renderList();
    if (act === 'answer') { const t = $('#mylist .ansf textarea'); if (t) t.focus(); }
  });
}

// ---------- guided prayer (A·C·T·S with a gentle timer) ----------
const Guided = (() => {
  let step = 0, per = 120, left = 0, timer = null, steps = [];
  function build() {
    steps = [
      { k: 'start', h: 'ស្ងប់ចិត្តនៅចំពោះព្រះ', x: 'អង្គុយឲ្យស្រួល ដកដង្ហើមវែងៗ ហើយនឹកចាំថា ព្រះគង់នៅជាមួយអ្នក ហើយទ្រង់ស្ដាប់អ្នក។', r: ['Ps.46.10'] },
      ...P.acts.map(a => ({ k: a.id, h: `${a.km} · ${a.en}`, x: a.x, r: a.r.slice(0, 2), p: a.p })),
      { k: 'end', h: 'បញ្ចប់ដោយសេចក្ដីអធិស្ឋានរបស់ព្រះអម្ចាស់', x: 'អធិស្ឋានជាមួយគ្នានូវពាក្យដែលព្រះយេស៊ូវបានបង្រៀន ហើយបញ្ចប់ថា «អាម៉ែន»។', r: ['Matt.6.9-13'] },
    ];
  }
  function open() {
    if (!P) return; build(); step = -1; $('#guided').hidden = false; document.body.style.overflow = 'hidden';
    if (location.hash !== '#guided') history.replaceState(null, '', '#guided');
    show(); track('prayer-guided');
  }
  function close() { stop(); $('#guided').hidden = true; document.body.style.overflow = ''; history.replaceState(null, '', location.pathname); }
  function stop() { clearInterval(timer); timer = null; $('#gTimer').textContent = ''; }
  function tick() {
    left--; const m = Math.floor(Math.max(left, 0) / 60), s = Math.max(left, 0) % 60;
    $('#gTimer').textContent = left > 0 ? `${kmNum(m)}:${kmNum(String(s).padStart(2, '0'))}` : 'ពេលវេលាគ្រប់ហើយ — ចុច «បន្ទាប់» ពេលអ្នករួចរាល់';
    $('#gTimer').classList.toggle('up', left <= 0);
    if (left <= 0) { clearInterval(timer); timer = null; }
  }
  function show() {
    stop();
    const n = steps.length;
    $('#gProg').innerHTML = step < 0 ? '' : steps.map((s, i) => `<i class="${i < step ? 'd' : i === step ? 'c' : ''}"></i>`).join('');
    $('#gBack').style.visibility = step <= 0 ? 'hidden' : 'visible';
    if (step < 0) {
      $('#gBody').innerHTML = `<div class="gk">GUIDED PRAYER</div><h2>អធិស្ឋានជាមួយការណែនាំ</h2>
        <p>យើងនឹងដើរតាមជំហាន A·C·T·S ម្ដងមួយៗ៖ ស្ងប់ចិត្ត → សរសើរ → លន់តួ → អរព្រះគុណ → ទូលសូម → សេចក្ដីអធិស្ឋានរបស់ព្រះអម្ចាស់។ ក្នុងជំហាននីមួយៗ អានខគម្ពីរ ហើយអធិស្ឋានដោយពាក្យរបស់អ្នក។</p>
        <p class="gq">តើអ្នកចង់ចំណាយពេលប៉ុន្មានក្នុងមួយជំហាន?</p>
        <div class="gper">${[[60, '១ នាទី'], [120, '២ នាទី'], [180, '៣ នាទី'], [0, 'គ្មានម៉ោង']].map(([v, l]) => `<button data-per="${v}" class="${per === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      $('#gBody').querySelectorAll('[data-per]').forEach(b => b.onclick = () => { per = +b.dataset.per; show(); });
      $('#gNext').textContent = 'ចាប់ផ្ដើម ›'; return;
    }
    if (step >= n) {
      $('#gBody').innerHTML = `<div class="gdone">🙏</div><h2>អាម៉ែន</h2><p>«ព្រះនៃសេចក្ដីសុខសាន្ត ទ្រង់គង់នៅជាមួយអ្នក»។ អ្នកអាចកត់ត្រាសំណូមរបស់អ្នក ក្នុង <a href="#list" data-close>បញ្ជីអធិស្ឋានរបស់ខ្ញុំ</a>។</p>`;
      $('#gBody').querySelector('[data-close]').onclick = () => { close(); setTimeout(() => $('#list').scrollIntoView({ behavior: 'smooth' }), 30); };
      $('#gNext').textContent = 'បិទ'; $('#gProg').innerHTML = steps.map(() => '<i class="d"></i>').join(''); return;
    }
    const s = steps[step];
    $('#gBody').innerHTML = `<div class="gk">ជំហាន ${kmNum(step + 1)} / ${kmNum(n)}</div><h2>${esc(s.h)}</h2><p>${esc(s.x)}</p>
      ${s.r.map(r => verse(r, 6)).join('')}
      ${s.p ? `<details><summary>ត្រូវការជំនួយ? មើលគំរូសេចក្ដីអធិស្ឋាន</summary><p class="sp">${sample(s.p)}</p></details>` : ''}`;
    $('#gNext').textContent = step === n - 1 ? 'អាម៉ែន ✓' : 'បន្ទាប់ ›';
    if (per && s.k !== 'end') { left = per + 1; tick(); timer = setInterval(tick, 1000); }
  }
  $('#gNext').onclick = () => { if (step >= steps.length) { close(); return; } step++; show(); $('#gBody').scrollTop = 0; };
  $('#gBack').onclick = () => { if (step > 0) { step--; show(); } };
  $('#gClose').onclick = close;
  $('#guided').onclick = e => { if (e.target.id === 'guided') close(); };
  document.addEventListener('keydown', e => { if (!$('#guided').hidden && e.key === 'Escape') close(); });
  return { open, close };
})();
