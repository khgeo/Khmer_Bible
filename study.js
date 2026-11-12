/* Study — daily Bible study lessons (data/study.json), one lesson a day, for personal study and small groups.
   Everyone sees the same lesson on a given date (the same one that is posted to Facebook / Telegram).
   Answers and "done" ticks are stored only in this browser (kb-study). */
'use strict';

let B, S, TEXT = null, LS = [];
const KM_MONTH = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const KM_DAY = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
const ST = { idx: 0, picked: false, hide: false };

// ---------- saved in this browser ----------
const Store = {
  all() { try { return JSON.parse(localStorage.getItem('kb-study') || '{}') || {}; } catch (e) { return {}; } },
  save(a) { try { localStorage.setItem('kb-study', JSON.stringify(a)); } catch (e) {} },
  done(id) { return !!(Store.all().done || {})[id]; },
  toggle(id) { const a = Store.all(); a.done = a.done || {}; if (a.done[id]) delete a.done[id]; else a.done[id] = Date.now(); Store.save(a); return !!a.done[id]; },
  ans(id, k) { return ((Store.all().ans || {})[id] || {})[k] || ''; },
  setAns(id, k, v) { const a = Store.all(); a.ans = a.ans || {}; a.ans[id] = a.ans[id] || {}; if (v.trim()) a.ans[id][k] = v; else delete a.ans[id][k];
    if (!Object.keys(a.ans[id]).length) delete a.ans[id]; Store.save(a); },
};

(async function init() {
  [B, S] = await Promise.all([Bible.load(), fetch('data/study.json').then(r => r.json())]);
  LS = S.series.flatMap(s => s.lessons.map((l, k) => ({ ...l, s, k })));
  ST.idx = todayIdx(); fromHash(false);
  render();
  window.addEventListener('hashchange', () => { if (fromHash(true)) { renderLesson(); $('#lesson').scrollIntoView({ block: 'start' }); } });
  if (ST.picked) setTimeout(() => $('#lesson').scrollIntoView({ block: 'start' }), 60);
  KhmerText.load(B.meta).then(t => { TEXT = t; renderLesson(); }).catch(() => {});
})().catch(e => { console.error(e); setStatus('err', e.message); });

// ---------- dates ----------
function dayNum(d = new Date()) {
  const s = S.start.split('-').map(Number);
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(s[0], s[1] - 1, s[2])) / 864e5);
}
const wrap = n => ((n % LS.length) + LS.length) % LS.length;
const todayIdx = () => wrap(Math.max(0, dayNum()));
function startDate() { const s = S.start.split('-').map(Number); return new Date(s[0], s[1] - 1, s[2]); }
const kmDate = d => `ថ្ងៃ${KM_DAY[d.getDay()]} ទី${kmNum(d.getDate())} ខែ${KM_MONTH[d.getMonth()]}`;

// ---------- verses ----------
function span(r) {   // "Mark.2.23-3.6" / "Mark.1.1-13" / "Mark.1.15" → [first, last] global verse numbers
  const m = r.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$/); if (!m) return null;
  const a = B.parse(`${m[1]}.${m[2]}.${m[3]}`); if (!a) return null;
  if (!m[5]) return [a.g, a.g];
  const b = B.parse(`${m[1]}.${m[4] || m[2]}.${m[5]}`); return [a.g, b ? b.g : a.g];
}
function label(r) {
  const [a, b] = span(r); if (b === a) return B.label(a);
  return B.label(a) + '–' + (B.verseCh[b] === B.verseCh[a] ? kmNum(B.vNum(b)) : `${kmNum(B.chNum[B.verseCh[b]])}:${kmNum(B.vNum(b))}`);
}
const readHref = r => { const [a] = span(r), c = B.verseCh[a]; return `read.html#${B.ref(c, a)}`; };
function plain(r) { const [a, b] = span(r); if (!TEXT) return ''; let t = ''; for (let g = a; g <= b; g++) t += (TEXT[g] || '').replace(/^៙\s*/, '').replace(/​/g, '') + ' '; return t.trim(); }
function passage(r) {
  if (!TEXT) return '<p class="muted">កំពុងផ្ទុកអត្ថបទ ពគប…</p>';
  const [a, b] = span(r); let out = '', ch = -1;
  for (let g = a; g <= b; g++) {
    if (B.verseCh[g] !== ch) { if (ch >= 0) out += '</p>'; ch = B.verseCh[g]; out += (g > a ? `<h4 class="chh">${esc(B.chLabel(ch))}</h4>` : '') + '<p class="pas">'; }
    out += `<sup>${kmNum(B.vNum(g))}</sup>${esc((TEXT[g] || '').replace(/^៙\s*/, ''))} `;
  }
  return out + '</p>';
}
const vbox = r => `<div class="vs"><a href="${readHref(r)}">${esc(label(r))}</a><p>${TEXT ? esc(plain(r)) : '…'}</p></div>`;

// ---------- page ----------
function render() { renderHero(); renderLesson(); renderAbout(); renderHow(); renderAll(); }

function renderHero() {
  const s = LS[0].s, done = LS.filter(l => Store.done(l.id)).length, n = dayNum();
  const when = n < 0 ? `<p class="soon">📅 មេរៀនទី ១ ចាប់ផ្ដើម${esc(kmDate(startDate()))} — អ្នកអាចអានមុនបាន។</p>` : '';
  $('#hero').innerHTML = `<div class="kick">សិក្សាព្រះបន្ទូលប្រចាំថ្ងៃ</div>
    <h2>${esc(s.t)}</h2><p class="sub">${esc(s.sub)} · ${kmNum(s.lessons.length)} មេរៀន មួយថ្ងៃ មួយមេរៀន</p>${when}
    <div class="prog"><div style="width:${(100 * done / LS.length).toFixed(1)}%"></div></div>
    <p class="muted small">បានសិក្សារួច ${kmNum(done)} / ${kmNum(LS.length)} មេរៀន</p>`;
}

function renderLesson() {
  const L = LS[ST.idx], isToday = ST.idx === todayIdx() && dayNum() >= 0, id = L.id, done = Store.done(id);
  const qs = [['o', 'សង្កេត', 'តើបទគម្ពីរនិយាយអ្វី?'], ['i', 'បកស្រាយ', 'តើវាមានន័យយ៉ាងណា?'], ['a', 'អនុវត្ត', 'តើខ្ញុំត្រូវជឿ ឬធ្វើអ្វី?']];
  let qn = 0;
  const qhtml = qs.map(([k, h, en]) => `<div class="qg qg-${k}"><h4>${h} <small>${en}</small></h4>${L[k].map((q, j) => {
    qn++; const key = k + j, v = Store.ans(id, key);
    return `<div class="q"><p><b>${kmNum(qn)}.</b> ${esc(q)}</p><textarea data-k="${key}" rows="${v ? 3 : 2}" placeholder="សរសេរចម្លើយរបស់អ្នក…">${esc(v)}</textarea></div>`;
  }).join('')}</div>`).join('');
  const mv = TEXT ? plain(L.mv) : '';
  const mvShown = ST.hide && mv ? esc(mv).split(' ').map((w, i) => i % 2 ? `<span class="blank">${w}</span>` : w).join(' ') : esc(mv);
  $('#lesson').innerHTML = `
    <div class="lnav"><button data-go="-1" type="button" aria-label="មេរៀនមុន">‹</button>
      <span><b>មេរៀនទី ${kmNum(L.k + 1)}</b> / ${kmNum(L.s.lessons.length)}${isToday ? ' · <em>ថ្ងៃនេះ</em>' : ''}</span>
      <button data-go="1" type="button" aria-label="មេរៀនបន្ទាប់">›</button>
      ${!isToday ? '<button class="ltoday" data-go="0" type="button">មេរៀនថ្ងៃនេះ</button>' : ''}</div>
    <div class="lhead"><div class="kick">${esc(L.s.t)} · <a href="${readHref(L.r)}">${esc(label(L.r))}</a></div>
      <h2>${esc(L.t)}</h2></div>
    <section class="blk"><h3>🧭 ផ្ទៃរឿង</h3><p class="tx">${esc(L.bg)}</p></section>
    <section class="blk"><h3>📖 អានបទគម្ពីរ <small>${esc(label(L.r))}</small></h3>
      <p class="hint">អានយឺតៗ ពីរដង។ ដងទីពីរ ចូរគូសចំណាំពាក្យ ឬឃ្លាដែលប៉ះចិត្តអ្នក។</p>
      <div class="pasbox">${passage(L.r)}</div><a class="more" href="${readHref(L.r)}">អានក្នុងទំព័រអាន ›</a></section>
    <section class="blk"><h3>💡 ការពន្យល់</h3>${L.n.map(([v, h, t]) => `<div class="note"><span class="vtag">ខ ${esc(v)}</span><h4>${esc(h)}</h4><p class="tx">${esc(t)}</p></div>`).join('')}</section>
    <section class="blk"><h3>🔑 ពាក្យគន្លឹះ</h3><dl class="words">${L.w.map(([w, d]) => `<dt>${esc(w)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></section>
    <section class="blk"><h3>❓ សំណួរសិក្សា</h3><p class="hint">ចម្លើយរបស់អ្នក រក្សាទុកតែក្នុងទូរស័ព្ទ ឬកុំព្យូទ័រនេះប៉ុណ្ណោះ។</p>${qhtml}</section>
    <section class="blk grp"><h3>👥 សំរាប់ក្រុមតូច</h3><ul>${L.g.map(q => `<li>${esc(q)}</li>`).join('')}</ul><a class="more" href="#group">របៀបដឹកនាំក្រុម ›</a></section>
    <section class="blk"><h3>📌 ខទន្ទេញ</h3><blockquote class="mv">${mv ? mvShown : '…'}<cite>${esc(label(L.mv))}</cite></blockquote>
      <button class="sbtn" data-hide type="button">${ST.hide ? 'បង្ហាញពាក្យទាំងអស់' : 'លាក់ពាក្យខ្លះ ដើម្បីហាត់ទន្ទេញ'}</button></section>
    <section class="blk"><h3>🔗 ខគម្ពីរពាក់ព័ន្ធ</h3>${L.x.map(vbox).join('')}</section>
    <section class="blk"><h3>🙏 អធិស្ឋាន</h3><p class="tx pray">${esc(L.p)}</p></section>
    <div class="lacts"><button class="go${done ? ' on' : ''}" data-done type="button">${done ? '✓ បានសិក្សារួច' : 'សម្គាល់ថា បានសិក្សារួច'}</button>
      <button class="sbtn" data-share type="button">ចែករំលែក</button><button class="sbtn" data-print type="button">បោះពុម្ព (សំរាប់ក្រុម)</button></div>`;
  const el = $('#lesson');
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const v = +b.dataset.go; ST.idx = v === 0 ? todayIdx() : wrap(ST.idx + v); ST.hide = false;
    history.replaceState(null, '', v === 0 ? '#lesson' : '#' + LS[ST.idx].id); renderLesson(); el.scrollIntoView({ block: 'start' }); });
  el.querySelectorAll('textarea').forEach(t => t.oninput = () => Store.setAns(id, t.dataset.k, t.value));
  el.querySelector('[data-hide]').onclick = () => { ST.hide = !ST.hide; renderLesson(); };
  el.querySelector('[data-done]').onclick = () => { const on = Store.toggle(id); if (on) track('study-done'); renderLesson(); renderHero(); renderAll(); };
  el.querySelector('[data-print]').onclick = () => { track('study-print'); print(); };
  el.querySelector('[data-share]').onclick = e => share(e.target, L);
}

function share(btn, L) {
  const url = location.href.split('#')[0] + '#' + L.id;
  const text = `📚 ${L.s.t} · មេរៀនទី ${kmNum(L.k + 1)}\n${L.t}\n📖 ${label(L.r)}\n\n${L.o.concat(L.i, L.a).map((q, i) => `${kmNum(i + 1)}. ${q}`).join('\n')}`;
  const done = () => { const o = btn.textContent; btn.textContent = 'រួចរាល់ ✓'; setTimeout(() => btn.textContent = o, 1600); };
  if (!navigator.share) navigator.clipboard.writeText(text + '\n\n' + url).then(done, () => {});
  else navigator.share({ title: L.t, text, url }).then(done, () => {});
}

function renderAbout() {
  const s = LS[0].s;
  $('#about').innerHTML = `<div class="kick">About</div><h2>អំពី${esc(s.t)}</h2>${s.intro.map(p => `<p class="tx">${esc(p)}</p>`).join('')}`;
}
function renderHow() {
  const s = LS[0].s;
  $('#how').innerHTML = `<div class="kick">How to study</div><h2>របៀបសិក្សា</h2>
    <ol class="steps">${s.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
  $('#group').innerHTML = `<div class="kick">Small groups</div><h2>សំរាប់អ្នកដឹកនាំក្រុមតូច</h2>
    <p class="tx">ក្រុមតូច ៤–១២ នាក់ អាចប្រើមេរៀនណាមួយ ក្នុងពេលប្រហែល ៥០ នាទី។ ចុច «បោះពុម្ព» ដើម្បីបានក្រដាសចែកឲ្យសមាជិក (មានកន្លែងទំនេរសំរាប់សរសេរ)។ បើក្រុមជួបគ្នាម្ដងក្នុងមួយសប្ដាហ៍ ចូរជ្រើសមេរៀនមួយ ក្នុងចំណោមមេរៀនទាំងប្រាំពីរនៃសប្ដាហ៍នោះ ឬសិក្សាតាមលំដាប់ពីមេរៀនទី ១។</p>
    <ol class="steps">${s.group.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
}
function renderAll() {
  const ti = todayIdx(), started = dayNum() >= 0;
  $('#all').innerHTML = `<div class="kick">All lessons</div><h2>មេរៀនទាំងអស់</h2><ol class="alist">${LS.map((l, i) => `<li class="${Store.done(l.id) ? 'done' : ''}${i === ti && started ? ' today' : ''}${i === ST.idx ? ' cur' : ''}">
    <a href="#${l.id}"><span class="no">${kmNum(i + 1)}</span><span class="lt">${esc(l.t)}</span><small>${esc(label(l.r))}${i === ti && started ? ' · ថ្ងៃនេះ' : ''}</small><b>${Store.done(l.id) ? '✓' : ''}</b></a></li>`).join('')}</ol>`;
}

function fromHash(isNav) {
  const h = decodeURIComponent(location.hash.slice(1)), i = LS.findIndex(l => l.id === h);
  if (i >= 0) { ST.idx = i; ST.picked = true; ST.hide = false; if (isNav) renderAll(); track('study-open'); return true; }
  if (isNav && h === 'lesson') { ST.idx = todayIdx(); renderAll(); return true; }
  return false;
}
