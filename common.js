/* Shared helpers + live loader for the Khmer Old Version 1954 (ពគប) text. */
'use strict';

const $ = s => document.querySelector(s);
const KD = '០១២៣៤៥៦៧៨៩';
const kmNum = n => String(n).replace(/\d/g, d => KD[d]);
const toAscii = s => s.replace(/[០-៩]/g, d => KD.indexOf(d));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
