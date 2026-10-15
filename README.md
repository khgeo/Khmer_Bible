# ខ្សែសម្ពន្ធព្រះគម្ពីរ · Khmer Bible Explorer

An interactive arc diagram of **341,167 Bible cross-references**, linked live to the Khmer Old Version 1954 — **ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤ (ពគប)**. Inspired by Chris Harrison & Christoph Römhild's famous cross-reference visualization.

ដ្យាក្រាមធ្នូអន្តរកម្មនៃខគម្ពីរយោង ៣៤១,១៦៧ ភ្ជាប់ផ្ទាល់ទៅអត្ថបទ ពគប ១៩៥៤។

![screenshot](assets/screenshot.png)

## What it does
- **1,189 chapters** along the axis (Genesis → Revelation); bars below show verses per chapter.
- **140,934 arcs** — one per chapter pair that shares a reference. Colour = distance (magenta = near, green/yellow = far).
- **Hover** a chapter to light up its arcs; **click** to open its references with the Khmer text of both verses.
- **Click a verse** to draw its individual verse-level arcs.
- **Search** in Khmer or English: `យ៉ូហាន ៣:១៦`, `John 3:16`, `រ៉ូម ៨`, `Gen 1`.
- Filters: minimum votes, one book only, Old ↔ New Testament links only.
- Deep links: `…/#John.3.16`, `…/#Ps.23`.
- **Page colour** switch in the header — ភ្លឺ (light, default), ក្រដាស (paper), ងងឹត (dark). The choice is remembered and shared by both pages.

## Reader (`read.html`)
- Chapter-by-chapter reading with adjustable text size, ←/→ keys, and a small number after each verse showing its cross-references — tap it to open them inline, copy the verse, or jump to its arcs.
- Place names are underlined and open the map; a mini-map shows the chapter's places in the order they are mentioned.
- **Continue reading:** your last position is remembered, and every page shows a «បន្តអាន» button to go straight back.
- **Reading progress:** a chapter counts as read once you reach its end; see your % of the whole Bible and a chapter grid per book.
- **Personal reading statistics** — minutes read today (with a daily goal ring), reading streak 🔥 and longest streak, days read this week and per week, total time, and a 26-week calendar heat-map. Time counts only while the reader page is visible *and* you have scrolled, tapped or typed within the last 90 seconds, so an idle tab adds nothing. The streak also shows on the «បន្តអាន» button on every page.
- **Private by design:** all of this stays in the reader's own browser (localStorage) and is never sent anywhere. «រក្សាទុកច្បាប់ចម្លង» downloads a backup file that can be restored («ស្ដារ») on another phone or computer; restoring merges with existing data.
- **Verse of the day** (also on the arcs page).

## Today (`today.html`)
- **Daily devotional** — the verse of the day with its surrounding verses, plus a guided journal (ការសង្កេត · ការអនុវត្ត · ការអធិស្ឋាន — observation, application, prayer) saved per day; earlier entries stay readable below.
- **Your own devotional texts:** add entries to `data/devotionals.json` and they replace the default on that date:
  ```json
  [{ "date": "12-25", "ref": "Luke.2.11", "title": "…", "body": "…", "prayer": "…", "author": "…" }]
  ```
  `date` is `MM-DD` (every year) or `YYYY-MM-DD` (one day). Only include texts you wrote or have permission to publish.
- **Reading plans:** Whole Bible in a year (OT + NT each day), New Testament in 90 days, the four Gospels in 30 days, Psalms & Proverbs in 60 days. Chapters are spread by verse count so days are even. A day ticks itself off when you finish its chapters in the reader (or tick it by hand); a calendar shows done, missed and today, and you see how many days you are behind. The reader shows the plan's next chapter at the end of each chapter.
- **Highlights & notes:** tap any verse in the reader to colour it (yellow, green, blue, pink), write a note, copy it or share a link. All highlights are listed on this page, filterable by colour or notes.
- Journal, highlights and plan are included in the reading-data backup file.

## Map (`maps.html`)
- 1,278 Bible places from OpenBible.info's geocoding data, sized by how many verses mention them and coloured by type; dashed circles mark uncertain locations.
- 352 places carry their **Khmer ពគប name**, matched against the text (verified list in `scripts/km_place_names.json` plus automatic matching).
- Pick a book to see its places, or a chapter to see them **numbered in the order the text mentions them, joined by a route** — try `maps.html#Acts.27` (Paul's voyage to Rome) or `#Exod.14`.
- **▶ Play** steps through all 66 books on the map.
- Click a place for every verse that mentions it, in Khmer with the name highlighted. Base maps, all keyless: map (Esri grey canvas, follows the page theme), OpenStreetMap streets, satellite, terrain.

## Word frequency page (`words.html`)
Inspired by Pitch Interactive's Bible/Quran word comparison. Type any Khmer word and see where it appears:
- Every chapter is a row and every verse a cell (Old Testament gold, New Testament orange); verses containing the word light up.
- Occurrences, verses, and the size-adjusted ratio between the testaments, plus a per-book bar chart.
- **Exact word** (ពាក្យពេញ) or **contains** (មានផ្ទុក); several words at once with commas: `អត់ទោស, អភ័យទោស`.
- Khmer-aware matching: zero-width spaces are ignored and `្ដ` / `្ត` count as the same letter, so `សេចក្ដី` and `សេចក្តី` both match.
- Hover a cell to read the verse; click to jump to its cross-reference arcs. Share links like `words.html#q=ស្រឡាញ់&m=word`.

## “Live connection” to ពគប
The Khmer text is **not stored in this repo**. On first visit the browser fetches it in a Web Worker from the [Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format) GitHub repository (`KhmerBFBSBible.xml`, via jsDelivr with raw.githubusercontent as fallback), then keeps it in the browser cache so later visits are instant. The arcs work immediately even before the text arrives.

To use another source, open the page with `?text=<url-to-xml>` (same Beblia XML format), or edit `TEXT_SOURCES` at the top of `app.js`.

## Visitor statistics (owner)
Anonymous site-wide counts via [GoatCounter](https://khgeo.goatcounter.com) — no cookies, no personal data, no consent banner needed. Dashboard: https://khgeo.goatcounter.com
- Page views, unique visitors, returning visits, countries, devices and referrers per page.
- Events: `finished-chapter`, `word-search`, `map-play`, `copy-verse`, `highlight`, `plan-start` — counts only; no chapter, search word or reader identity is sent.
- Visits from `localhost` are not counted. To remove tracking, delete the `gc.zgo.at` script line at the bottom of each `.html` page.

## Publish on GitHub Pages
1. Create a repository (e.g. `khgeo/khmer-bible-arcs`) and push these files to `main`.
2. Settings → Pages → *Deploy from a branch* → `main` / root.
3. Visit `https://khgeo.github.io/khmer-bible-arcs/`.

Run locally: `python3 -m http.server` then open http://localhost:8000.

## Rebuilding the data
```bash
# cross_references.txt: https://www.openbible.info/labs/cross-references/
# KhmerBFBSBible.xml:   https://github.com/Beblia/Holy-Bible-XML-Format
python3 scripts/build_data.py --xref cross_references.txt --bible KhmerBFBSBible.xml --out data
# Bible-Geocoding-Data: https://github.com/openbibleinfo/Bible-Geocoding-Data
python3 scripts/build_places.py --geo Bible-Geocoding-Data --bible KhmerBFBSBible.xml
```
The XML is used only for chapter/verse structure. References with zero or negative votes are dropped; 218 that point outside the Khmer versification are skipped.

## Files
| Path | Content |
|---|---|
| `index.html`, `app.js` | Arc diagram page |
| `words.html`, `words.js`, `words.css` | Word frequency page |
| `read.html`, `read.js`, `read.css` | Reader |
| `today.html`, `today.js`, `today.css` | Devotional, reading plans, highlights |
| `data/devotionals.json` | Optional devotional texts by date (empty by default) |
| `maps.html`, `maps.js`, `maps.css`, `places.js` | Places map (Leaflet) |
| `common.js`, `style.css` | Shared live text loader, themes, reading progress, helpers |
| `data/places.json` | Places: names (Khmer/English), type, coordinates, confidence, verse indices |
| `data/meta.json` | Books (Khmer + English names), verses per chapter |
| `data/chapter_links.json` | `[chapterA, chapterB, refCount, maxVotes]` |
| `data/xref/<Book>.json` | Verse-level refs, flat `[from, toStart, toEnd, votes, …]` (global verse indices) |

## Credits & licences
- Cross-references: [OpenBible.info](https://www.openbible.info/labs/cross-references/), **CC-BY**.
- Places: [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data), **CC-BY 4.0**. Base maps (no API key needed): Esri Light/Dark Gray Canvas, World Imagery and Shaded Relief; © OpenStreetMap contributors.
- Khmer text: ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤ (ពគប), Bible Society in Cambodia. The Beblia file marks it © BFBS/UBS 1954, 1962 — the text is loaded from that third-party source, not redistributed here. For a public or institutional deployment, check permission with the Bible Society in Cambodia.
- Code: MIT — YAM Sarath ([@khgeo](https://github.com/khgeo)).
