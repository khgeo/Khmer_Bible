/* Shared Bible-places helpers (map page + reader mini-map).
 * Places: OpenBible.info Bible Geocoding Data (CC-BY 4.0); Khmer names matched to the ពគប text. */
'use strict';

const PLACE_TYPES = [
  ['settlement', 'ទីក្រុង · ភូមិ', '#c2370f', ['settlement', 'structure', 'gate', 'campsite', 'tower', 'fortification', 'pool', 'well', 'garden']],
  ['region', 'តំបន់ · ប្រទេស', '#6b4fd6', ['region', 'people group', 'territory', 'district', 'special']],
  ['water', 'ទន្លេ · សមុទ្រ', '#1b7fd0', ['river', 'body of water', 'spring', 'wadi', 'sea', 'stream']],
  ['land', 'ភ្នំ · វាល', '#4f8a1f', ['mountain', 'hill', 'valley', 'natural area', 'island', 'mountain range', 'plain', 'cave', 'rock', 'ridge', 'field']],
];
// regex source matching a Khmer word whatever zero-width spaces sit inside it; ្ដ ≡ ្ត
function kmPattern(term) {
  const ch = [...term.replace(/[\s​‌]/g, '')], parts = [];
  for (let i = 0; i < ch.length; i++) {
    if (ch[i] === '្' && (ch[i + 1] === 'ដ' || ch[i + 1] === 'ត')) { parts.push('្[ដត]'); i++; }
    else parts.push(ch[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
  return parts.join('[\\u200B\\u200C]?');
}
const typeGroup = t => (PLACE_TYPES.find(g => g[3].includes(t)) || PLACE_TYPES[0]);

const Places = (() => {
  let p = null;
  function load(B) {
    if (p) return p;
    p = fetch('data/places.json').then(r => r.json()).then(list => {
      const byCh = Array.from({ length: B.NC }, () => []);   // chapter → [{i, g}] first mention per place
      list.forEach((pl, i) => {
        pl.i = i; pl.g = typeGroup(pl.t);
        pl.name = pl.km || pl.en;
        pl.re = pl.km ? new RegExp(kmPattern(pl.km), 'g') : null;
        const seen = new Set();
        for (const g of pl.v) { const c = B.verseCh[g]; if (!seen.has(c)) { seen.add(c); byCh[c].push({ i, g }); } }
      });
      byCh.forEach(a => a.sort((x, y) => x.g - y.g));
      return { list, byCh };
    });
    return p;
  }
  // wrap the place's Khmer name in <mark> (text is escaped first)
  function highlight(text, pl) {
    const t = esc(text || '');
    return pl && pl.re ? t.replace(pl.re, m => `<mark>${m}</mark>`) : t;
  }
  // Base maps — all keyless (no API key needed on GitHub Pages).
  // "Map" follows the page theme: Esri light/dark grey canvas with a place-name overlay.
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const esri = (svc, opt = {}) => L.tileLayer(ESRI + svc + '/MapServer/tile/{z}/{y}/{x}', Object.assign({ maxZoom: 16, attribution: 'Tiles © <a href="https://www.esri.com/">Esri</a>' }, opt));
  function labelsPane(map) {
    if (!map.getPane('labels')) { const p = map.createPane('labels'); p.style.zIndex = 350; p.style.pointerEvents = 'none'; }
    return 'labels';
  }
  function baseLayers(map) {
    const pane = labelsPane(map);
    const dark = () => document.documentElement.dataset.theme === 'dark';
    return {
      themed: () => dark()
        ? L.layerGroup([esri('Canvas/World_Dark_Gray_Base'), esri('Canvas/World_Dark_Gray_Reference', { pane })])
        : L.layerGroup([esri('Canvas/World_Light_Gray_Base'), esri('Canvas/World_Light_Gray_Reference', { pane })]),
      'ផែនទីផ្លូវ · Streets': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }),
      'ផ្កាយរណប · Satellite': L.layerGroup([esri('World_Imagery', { maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }),
        esri('Reference/World_Boundaries_and_Places', { pane })]),
      'ភូមិសាស្ត្រ · Terrain': L.layerGroup([esri('World_Shaded_Relief', { maxZoom: 13 }), esri('Canvas/World_Light_Gray_Reference', { pane, maxZoom: 13 })]),
    };
  }
  return { load, highlight, baseLayers };
})();
