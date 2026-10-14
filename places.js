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
  // base maps that follow the page theme; satellite + terrain for the curious
  function baseLayers() {
    const dark = () => (document.documentElement.dataset.theme === 'dark');
    const carto = s => L.tileLayer(`https://{s}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}{r}.png`, {
      subdomains: 'abcd', maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>' });
    return {
      themed: () => carto(dark() ? 'dark_all' : 'light_all'),
      'ផែនទី · Map': null,
      'ផ្កាយរណប · Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }),
      'ភូមិសាស្ត្រ · Terrain': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 13, attribution: 'Relief © Esri' }),
    };
  }
  return { load, highlight, baseLayers };
})();
