/* Today: daily devotional (verse of the day + guided journal), reading plans, highlights. */
'use strict';

let B, TEXT = null, DEVOS = [];
const KM_MONTH = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const KM_DAY = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
const UI = { planDay: -1, hlFilter: '', hlSort: 'book', confirmStop: false };

(async function init() {
  B = await Bible.load();
  const d = new Date();
  $('#dateline').textContent = `ថ្ងៃ${KM_DAY[d.getDay()]} ទី${kmNum(d.getDate())} ខែ${KM_MONTH[d.getMonth()]} ឆ្នាំ${kmNum(d.getFullYear())} · ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤ (ពគប)`;
  DEVOS = await fetch('data/devotionals.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const picked = fromHashDevo();
  renderAll();
  if (picked) setTimeout(() => $('#devo').scrollIntoView({ block: 'start' }), 50);
  KhmerText.load(B.meta).then(t => { TEXT = t; renderAll(); }).catch(() => {});
  if (location.hash && !location.hash.startsWith('#devo-')) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ block: 'start' }), 300);
})().catch(e => { console.error(e); setStatus('err', e.message); });

function renderAll() { renderDevo(); renderPlan(); renderHighlights(); }
const vt = g => TEXT ? esc(TEXT[g] || '') : '…';

// ---------- devotional ----------
// data/devotionals.json = { series, items, dated }. Everyone sees the same devotional on a given
// date: a dated entry ("MM-DD") if there is one, otherwise the series cycle by day number.
// (An older plain array of {date, ref, title, body, prayer} entries still works.)
const DV = { off: 0, pick: null };
const DONE_KEY = 'kb-devo';
const Done = {
  all() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') || {}; } catch (e) { return {}; } },
  toggle(id) { const a = Done.all(); if (a[id]) delete a[id]; else a[id] = { t: Date.now(), d: Stats.dayKey() }; try { localStorage.setItem(DONE_KEY, JSON.stringify(a)); } catch (e) {} return !!a[id]; },
};
const dayNo = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) - Math.floor(Date.UTC(2026, 0, 1) / 864e5);
function devoFor(d) {
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, k = Stats.dayKey(d);
  if (Array.isArray(DEVOS)) { const x = DEVOS.find(x => x.date === k) || DEVOS.find(x => x.date === mmdd); return x ? { t: x.title, r: x.ref, b: x.body, p: x.prayer, a: x.author } : null; }
  if (!DEVOS.items || !DEVOS.items.length) return null;
  const dt = (DEVOS.dated || []).find(x => x.date === mmdd); if (dt) return dt;
  const n = DEVOS.items.length; return DEVOS.items[((dayNo(d) % n) + n) % n];
}
const allDevos = () => Array.isArray(DEVOS) ? [] : [...(DEVOS.items || []), ...(DEVOS.dated || [])];
function spanOf(r) {
  const m = r && r.match(/^(.+\.\d+)\.(\d+)(?:-(\d+))?$/); if (!m) return null;
  const a = B.parse(`${m[1]}.${m[2]}`); if (!a) return null;
  return [a.g, m[3] ? a.g + (+m[3] - +m[2]) : a.g];
}
const spanLabel = r => { const s = spanOf(r); return s ? B.label(s[0]) + (s[1] > s[0] ? '–' + kmNum(B.vNum(s[1])) : '') : r; };
function fromHashDevo() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('devo-') && allDevos().some(x => x.id === h.slice(5))) { DV.pick = h.slice(5); DV.off = 0; return true; }
  return false;
}
function renderDevo() {
  const now = new Date(), date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DV.off);
  const picked = DV.pick && allDevos().find(x => x.id === DV.pick);
  const dv = picked || devoFor(date), isToday = !picked && DV.off === 0;
  const ref = dv && dv.r ? dv.r : votdRef(), r = B.parse(ref);
  const k = Stats.dayKey(), j = Journal.get(k);
  const ser = dv && dv.s && DEVOS.series ? DEVOS.series.find(x => x.id === dv.s) : null;
  const done = Done.all(), total = allDevos().length, nDone = allDevos().filter(x => done[x.id]).length;
  // passage: the devotional's reading, or five verses around the verse of the day
  let passage = '', plabel = '';
  const sp = dv && dv.read ? spanOf(dv.read) : r ? [Math.max(B.chFirst[r.c], r.g - 2), Math.min(B.chFirst[r.c + 1] - 1, r.g + 2)] : null;
  if (sp) {
    for (let g = sp[0]; g <= sp[1]; g++) passage += `<span class="${r && g === r.g ? 'key' : ''}"><sup>${kmNum(B.vNum(g))}</sup>${vt(g)} </span>`;
    plabel = dv && dv.read ? spanLabel(dv.read) : B.chLabel(r.c);
  }
  const dateLbl = picked ? '' : `ថ្ងៃ${KM_DAY[date.getDay()]} ${kmNum(date.getDate())} ${KM_MONTH[date.getMonth()]}`;
  const prompts = [
    ['o', 'ការសង្កេត', dv && dv.q ? dv.q : 'តើខនេះប្រាប់អ្វីខ្លះ អំពីព្រះ និងអំពីមនុស្ស?'],
    ['a', 'ការអនុវត្ត', 'តើខ្ញុំអាចរស់នៅតាមខនេះ នៅថ្ងៃនេះ យ៉ាងដូចម្ដេច?'],
    ['p', 'ការអធិស្ឋាន', 'សរសេរការអធិស្ឋានខ្លីមួយ…'],
  ];
  const sr = sp ? B.ref(B.verseCh[sp[0]], sp[0]) : '';
  $('#devo').innerHTML = `<div class="kicker">ការតាំងចិត្តប្រចាំថ្ងៃ · DAILY DEVOTIONAL</div>
    <div class="dnav">${picked ? `<button data-dv="today" class="dtoday">‹ ត្រឡប់ទៅថ្ងៃនេះ</button>` :
      `<button data-dv="-1" aria-label="ថ្ងៃមុន">‹</button><span>${isToday ? '<b>ថ្ងៃនេះ</b> · ' : ''}${dateLbl}</span><button data-dv="1" aria-label="ថ្ងៃបន្ទាប់">›</button>${isToday ? '' : '<button data-dv="today" class="dtoday">ថ្ងៃនេះ</button>'}`}</div>
    ${ser ? `<div class="dser">ស៊េរី៖ <b>${esc(ser.km)}</b> · ${kmNum(dv.n)}/${kmNum(ser.n)}</div>` : dv && dv.date ? '<div class="dser">ការតាំងចិត្តពិសេស</div>' : ''}
    <h2>${dv && dv.t ? esc(dv.t) : 'ខគម្ពីរប្រចាំថ្ងៃ'}</h2>
    ${r ? `<blockquote>${vt(r.g)}<cite>— ${esc(B.label(r.g))}</cite></blockquote>` : ''}
    ${sp ? `<details class="ctx"${dv && dv.read ? '' : ''}><summary>📖 អាន៖ ${esc(plabel)}</summary><p>${passage}</p>
      <a href="read.html#${sr}">អានជំពូកទាំងមូល ›</a> · <a href="./#${r ? B.ref(r.c, r.g) : sr}">ខ្សែសម្ពន្ធ ›</a></details>` : ''}
    ${dv && dv.b ? `<div class="body">${esc(dv.b).replace(/\n+/g, '</p><p>').replace(/^/, '<p>')}</p></div>` : ''}
    ${dv && dv.q ? `<div class="dq"><b>សំណួរពិចារណា</b><p>${esc(dv.q)}</p></div>` : ''}
    ${dv && dv.p ? `<div class="prayer"><b>ការអធិស្ឋាន</b><p>${esc(dv.p).replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>')}</p></div>` : ''}
    ${dv && dv.a ? `<div class="muted tiny">— ${esc(dv.a)}</div>` : ''}
    ${dv && dv.id ? `<div class="dacts"><button data-done class="${done[dv.id] ? 'on' : ''}">${done[dv.id] ? '✓ បានអានរួច' : '○ សម្គាល់ថាបានអាន'}</button><button data-dshare>ចែករំលែក</button><a href="prayer.html#guided">🙏 អធិស្ឋាន</a></div>` : ''}
    ${isToday ? `<h3>កំណត់ហេតុរបស់ខ្ញុំ <small class="muted">· រក្សាទុកដោយស្វ័យប្រវត្តិ</small></h3>
    ${prompts.map(([f, t, ph]) => `<label class="jq"><span>${t}</span><textarea data-f="${f}" rows="2" placeholder="${esc(ph)}">${esc(j[f] || '')}</textarea></label>`).join('')}
    <div class="jfoot"><span class="muted tiny" id="saved"></span>${pastJournal()}</div>` : `<p class="muted tiny">កំណត់ហេតុប្រចាំថ្ងៃ មាននៅថ្ងៃនេះ — <a href="#" data-dv="today">ត្រឡប់ទៅថ្ងៃនេះ</a></p>`}
    ${total ? seriesList(done, nDone, total, dv) : ''}
    ${prayBox()}`;
  $('#devo').querySelectorAll('[data-dv]').forEach(b => b.onclick = e => {
    e.preventDefault(); const v = b.dataset.dv;
    if (v === 'today') { DV.off = 0; DV.pick = null; } else { DV.pick = null; DV.off += +v; }
    history.replaceState(null, '', location.pathname + location.search); renderDevo();
    $('#devo').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  $('#devo').querySelectorAll('[data-pick]').forEach(a => a.onclick = e => {
    e.preventDefault(); DV.pick = a.dataset.pick; history.replaceState(null, '', '#devo-' + DV.pick); renderDevo();
    $('#devo').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  const db = $('#devo [data-done]'); if (db) db.onclick = () => { if (Done.toggle(dv.id)) track('devo-done'); renderDevo(); };
  const sb = $('#devo [data-dshare]'); if (sb) sb.onclick = () => {
    const url = location.href.split('#')[0] + '#devo-' + dv.id, text = `${dv.t}\n${r ? TEXT ? TEXT[r.g] + '\n— ' + B.label(r.g) : B.label(r.g) : ''}\n\n${dv.b}`;
    const ok = () => { sb.textContent = 'រួចរាល់ ✓'; };
    (navigator.share ? navigator.share({ title: dv.t, text, url }) : navigator.clipboard.writeText(text + '\n\n' + url)).then(ok, () => {});
    track('devo-share');
  };
  $('#devo').querySelectorAll('textarea').forEach(ta => ta.oninput = () => {
    Journal.set(k, ta.dataset.f, ta.value); Journal.set(k, 'ref', ref); Journal.set(k, 't', Date.now());
    $('#saved').textContent = 'បានរក្សាទុក ✓';
  });
}
function seriesList(done, nDone, total, cur) {
  const pct = Math.round(nDone / total * 100);
  return `<details class="dall"><summary>ការតាំងចិត្តទាំងអស់ · បានអាន ${kmNum(nDone)}/${kmNum(total)}</summary>
    <div class="dbar"><i style="width:${pct}%"></i></div>
    ${DEVOS.series.map(s => `<h4>${esc(s.km)} <small>${esc(s.en)}</small></h4><ol>${DEVOS.items.filter(x => x.s === s.id).map(x =>
      `<li class="${done[x.id] ? 'done' : ''}${cur && cur.id === x.id ? ' cur' : ''}"><a href="#devo-${x.id}" data-pick="${x.id}">${esc(x.t)}</a> <small>${esc(spanLabel(x.r))}</small></li>`).join('')}</ol>`).join('')}
    ${DEVOS.dated && DEVOS.dated.length ? `<h4>ថ្ងៃពិសេស</h4><ol>${DEVOS.dated.map(x => `<li class="${done[x.id] ? 'done' : ''}"><a href="#devo-${x.id}" data-pick="${x.id}">${esc(x.t)}</a> <small>${kmNum(+x.date.slice(3))}/${kmNum(+x.date.slice(0, 2))}</small></li>`).join('')}</ol>` : ''}
  </details>`;
}
function prayBox() {
  let n = 0; try { n = Object.values(JSON.parse(localStorage.getItem('kb-prayers') || '{}')).filter(x => !x.del && !x.a).length; } catch (e) {}
  return `<div class="praybox"><a class="pgo" href="prayer.html#guided">🙏 អធិស្ឋានជាមួយការណែនាំ <small>A·C·T·S</small></a>
    <a href="prayer.html#list">${n ? `សំណូម ${kmNum(n)} កំពុងរង់ចាំ ›` : 'បញ្ជីអធិស្ឋានរបស់ខ្ញុំ ›'}</a> · <a href="prayer.html#topics">អធិស្ឋានសំរាប់… ›</a></div>`;
}
function pastJournal() {
  const all = Journal.all(), keys = Object.keys(all).filter(k => k !== Stats.dayKey()).sort().reverse();
  if (!keys.length) return '';
  return `<details class="past"><summary>កំណត់ហេតុមុនៗ (${kmNum(keys.length)})</summary>${keys.slice(0, 60).map(k => {
    const e = all[k], r = e.ref && B.parse(e.ref), d = new Date(k + 'T00:00:00');
    return `<div class="pj"><b>${kmNum(d.getDate())} ${KM_MONTH[d.getMonth()]} ${kmNum(d.getFullYear())}</b>${r ? ` · <a href="read.html#${e.ref}">${esc(B.label(r.g))}</a>` : ''}
      ${['o', 'a', 'p'].filter(f => e[f]).map(f => `<p>${esc(e[f])}</p>`).join('')}</div>`;
  }).join('')}</details>`;
}

// ---------- reading plans ----------
function renderPlan() {
  const st = Plans.status(B), el = $('#plan');
  if (!st) {
    el.innerHTML = `<div class="kicker">ផែនការអាន · READING PLANS</div><h2>ជ្រើសរើសផែនការ</h2>
      <p class="muted">ផែនការនីមួយៗបែងចែកជំពូកតាមចំនួនខ ដូច្នេះថ្ងៃនីមួយៗមានរយៈពេលអានប្រហាក់ប្រហែលគ្នា។ ការអានរបស់អ្នកត្រូវបានគូសធីកដោយស្វ័យប្រវត្តិ នៅពេលអ្នកអានដល់ចុងជំពូក។</p>
      <div class="plans">${Plans.defs.map(p => {
        const pl = Plans.build(B, p.id), n = pl.portions.reduce((a, x) => a + x.length, 0);
        return `<button class="pcard" data-id="${p.id}"><b>${esc(p.km)}</b><small>${esc(p.en)}</small><span>${esc(p.d)}</span>
          <em>${kmNum(p.days)} ថ្ងៃ · ${kmNum(n.toLocaleString('en'))} ជំពូក</em></button>`;
      }).join('')}</div>`;
    el.querySelectorAll('.pcard').forEach(b => b.onclick = () => { Plans.start(b.dataset.id); UI.planDay = -1; renderPlan(); });
    return;
  }
  const { plan, done, today, doneN, behind, finished, fin } = st;
  const focus = finished ? plan.days - 1 : (st.next >= 0 && st.next < today ? st.next : today);
  const day = UI.planDay >= 0 ? UI.planDay : focus;
  const startD = new Date(st.s.start + 'T00:00:00'), dDate = Stats.addDays(startD, day);
  const first = plan.portions[day].find(c => !fin.has(c)) ?? plan.portions[day][0];
  el.innerHTML = `<div class="kicker">ផែនការអាន · READING PLAN</div><h2>${esc(plan.km)}</h2>
    <div class="pstat"><div><b>${kmNum(doneN)}/${kmNum(plan.days)}</b><span>ថ្ងៃបានបញ្ចប់</span></div>
      <div><b>${kmNum(Math.round(doneN / plan.days * 100))}%</b><span>វឌ្ឍនភាព</span></div>
      <div><b class="${behind > 0 ? 'warn' : 'ok'}">${finished ? '🎉' : behind > 0 ? kmNum(behind) : '✓'}</b><span>${finished ? 'បានបញ្ចប់!' : behind > 0 ? 'ថ្ងៃយឺត' : 'តាមកាលវិភាគ'}</span></div></div>
    <div class="bar"><i style="width:${doneN / plan.days * 100}%"></i></div>
    <div class="dayhead"><b>ថ្ងៃទី ${kmNum(day + 1)}</b><span class="muted">${kmNum(dDate.getDate())} ${KM_MONTH[dDate.getMonth()]}${day === today ? ' · ថ្ងៃនេះ' : ''}</span>
      <label class="tick"><input type="checkbox" ${done[day] ? 'checked' : ''}> បានអានរួច</label></div>
    <div class="pchips">${plan.portions[day].map(c => `<a href="read.html#${B.ref(c, -1)}" class="${fin.has(c) ? 'r' : ''}">${esc(B.chLabel(c))}</a>`).join('') || '<span class="muted">ថ្ងៃសម្រាក</span>'}</div>
    ${plan.portions[day].length ? `<a class="go" href="read.html#${B.ref(first, -1)}">${done[day] ? 'អានម្ដងទៀត' : 'ចាប់ផ្ដើមអាន'} ›</a>` : ''}
    <div class="cal">${plan.portions.map((_, i) => `<button data-d="${i}" class="${done[i] ? 'd' : ''}${i === today ? ' t' : ''}${i === day ? ' s' : ''}${i < today && !done[i] ? ' late' : ''}" title="ថ្ងៃទី ${i + 1}">${kmNum(i + 1)}</button>`).join('')}</div>
    <div class="legend"><i class="d"></i> បានអាន <i class="late"></i> ខកខាន <i class="t"></i> ថ្ងៃនេះ</div>
    <button class="stop">${UI.confirmStop ? 'ចុចម្ដងទៀត ដើម្បីបញ្ឈប់ផែនការ' : 'បញ្ឈប់ / ប្ដូរផែនការ'}</button>`;
  el.querySelector('.tick input').onchange = e => { Plans.tick(day, e.target.checked); renderPlan(); };
  el.querySelectorAll('.cal button').forEach(b => b.onclick = () => { UI.planDay = +b.dataset.d; renderPlan(); });
  el.querySelector('.stop').onclick = () => {
    if (UI.confirmStop) { Plans.stop(); UI.confirmStop = false; UI.planDay = -1; renderPlan(); return; }
    UI.confirmStop = true; renderPlan(); setTimeout(() => { UI.confirmStop = false; renderPlan(); }, 4000);
  };
}

// ---------- highlights & notes ----------
function renderHighlights() {
  const all = Highlights.all(), keys = Object.keys(all).map(Number);
  const counts = Object.fromEntries(HL_COLORS.map(([k]) => [k, keys.filter(g => all[g].c === k).length]));
  const notes = keys.filter(g => all[g].n && all[g].n.trim()).length;
  let list = keys.filter(g => !UI.hlFilter || (UI.hlFilter === 'n' ? all[g].n && all[g].n.trim() : all[g].c === UI.hlFilter));
  list.sort(UI.hlSort === 'book' ? (a, b) => a - b : (a, b) => (all[b].t || 0) - (all[a].t || 0));
  $('#highlights').innerHTML = `<div class="kicker">ការគូសពណ៌ និងកំណត់ចំណាំ · HIGHLIGHTS</div>
    <h2>ខដែលអ្នកបានគូស <small class="muted">${kmNum(keys.length)}</small></h2>
    ${keys.length ? `<div class="hlbar"><button data-f="" class="${UI.hlFilter === '' ? 'on' : ''}">ទាំងអស់</button>
      ${HL_COLORS.map(([k, l]) => `<button data-f="${k}" class="${UI.hlFilter === k ? 'on' : ''}"><i class="c-${k}"></i>${l} ${kmNum(counts[k])}</button>`).join('')}
      <button data-f="n" class="${UI.hlFilter === 'n' ? 'on' : ''}">✎ កំណត់ចំណាំ ${kmNum(notes)}</button>
      <select id="hlsort"><option value="book"${UI.hlSort === 'book' ? ' selected' : ''}>តាមលំដាប់គម្ពីរ</option><option value="new"${UI.hlSort === 'new' ? ' selected' : ''}>ថ្មីៗបំផុត</option></select></div>
      <div class="hllist">${list.map(g => `<div class="hli hl-${all[g].c || 'none'}"><div class="hh"><a href="read.html#${B.ref(B.verseCh[g], g)}">${esc(B.label(g))}</a>
        <button data-rm="${g}" title="លុប">✕</button></div><p>${vt(g)}</p>${all[g].n ? `<div class="note">✎ ${esc(all[g].n)}</div>` : ''}</div>`).join('')}</div>`
    : `<p class="muted">មិនទាន់មានទេ។ នៅទំព័រ <a href="read.html">អាន</a> ចុចលើខណាមួយ ដើម្បីគូសពណ៌ ឬសរសេរកំណត់ចំណាំ។</p>`}`;
  $('#highlights').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { UI.hlFilter = b.dataset.f; renderHighlights(); });
  $('#highlights').querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { Highlights.remove(+b.dataset.rm); renderHighlights(); });
  const so = $('#hlsort'); if (so) so.onchange = () => { UI.hlSort = so.value; renderHighlights(); };
}
