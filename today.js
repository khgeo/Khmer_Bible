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
  renderAll();
  KhmerText.load(B.meta).then(t => { TEXT = t; renderAll(); }).catch(() => {});
  if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ block: 'start' }), 300);
})().catch(e => { console.error(e); setStatus('err', e.message); });

function renderAll() { renderDevo(); renderPlan(); renderHighlights(); }
const vt = g => TEXT ? esc(TEXT[g] || '') : '…';

// ---------- devotional ----------
// If data/devotionals.json has an entry for today (date "MM-DD" or "YYYY-MM-DD"), show it.
// Otherwise: the verse of the day with its context, and a guided S.O.A.P. journal.
function todaysDevo() {
  const k = Stats.dayKey();
  return DEVOS.find(x => x.date === k) || DEVOS.find(x => x.date === k.slice(5)) || null;
}
function renderDevo() {
  const dv = todaysDevo(), ref = dv && dv.ref ? dv.ref : votdRef(), r = B.parse(ref);
  const k = Stats.dayKey(), j = Journal.get(k);
  let ctx = '';
  if (r) {
    const c = r.c, a = Math.max(B.chFirst[c], r.g - 2), b = Math.min(B.chFirst[c + 1] - 1, r.g + 2);
    for (let g = a; g <= b; g++) ctx += `<span class="${g === r.g ? 'key' : ''}"><sup>${kmNum(B.vNum(g))}</sup>${vt(g)} </span>`;
  }
  const prompts = [
    ['o', 'ការសង្កេត', 'តើខនេះប្រាប់អ្វីខ្លះ អំពីព្រះ និងអំពីមនុស្ស?'],
    ['a', 'ការអនុវត្ត', 'តើខ្ញុំអាចរស់នៅតាមខនេះ នៅថ្ងៃនេះ យ៉ាងដូចម្ដេច?'],
    ['p', 'ការអធិស្ឋាន', 'សរសេរការអធិស្ឋានខ្លីមួយ…'],
  ];
  $('#devo').innerHTML = `<div class="kicker">ការតាំងចិត្តប្រចាំថ្ងៃ · DAILY DEVOTIONAL</div>
    ${dv && dv.title ? `<h2>${esc(dv.title)}</h2>` : '<h2>ខគម្ពីរប្រចាំថ្ងៃ</h2>'}
    ${r ? `<blockquote>${vt(r.g)}<cite>— ${esc(B.label(r.g))}</cite></blockquote>` : ''}
    ${dv && dv.body ? `<div class="body">${esc(dv.body).replace(/\n+/g, '</p><p>').replace(/^/, '<p>')}</p></div>` : ''}
    ${dv && dv.prayer ? `<div class="prayer"><b>ការអធិស្ឋាន</b><p>${esc(dv.prayer)}</p></div>` : ''}
    ${dv && dv.author ? `<div class="muted tiny">— ${esc(dv.author)}</div>` : ''}
    ${r ? `<details class="ctx"><summary>បរិបទ · ${esc(B.chLabel(r.c))}</summary><p>${ctx}</p>
      <a href="read.html#${B.ref(r.c, r.g)}">អានជំពូកទាំងមូល ›</a> · <a href="./#${B.ref(r.c, r.g)}">ខ្សែសម្ពន្ធ ›</a></details>` : ''}
    <h3>កំណត់ហេតុរបស់ខ្ញុំ <small class="muted">· រក្សាទុកដោយស្វ័យប្រវត្តិ</small></h3>
    ${prompts.map(([f, t, ph]) => `<label class="jq"><span>${t}</span><textarea data-f="${f}" rows="2" placeholder="${ph}">${esc(j[f] || '')}</textarea></label>`).join('')}
    <div class="jfoot"><span class="muted tiny" id="saved"></span>${pastJournal()}</div>
    ${prayBox()}`;
  $('#devo').querySelectorAll('textarea').forEach(ta => ta.oninput = () => {
    Journal.set(k, ta.dataset.f, ta.value); Journal.set(k, 'ref', ref); Journal.set(k, 't', Date.now());
    $('#saved').textContent = 'បានរក្សាទុក ✓';
  });
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
