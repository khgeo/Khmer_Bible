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
- **Daily devotional** — 60 short devotionals in Khmer, in 6 ten-day series (Who is God? · Knowing Jesus · Salvation and grace · The Word and prayer · Living as God's children · Hope in hard times), plus special ones for New Year, Christmas Eve, Christmas and New Year's Eve. Everyone sees the same devotional on a given date; the cycle repeats every 60 days. Each has a key verse and a passage to read (shown live from ពគប), a short reflection, a question to think about and a prayer.
- Browse earlier or later days (‹ ›), open any devotional from the full list (link: `today.html#devo-hope-peace`), mark it as read (progress is shown), share it, or go straight to the guided prayer.
- **Journal** — observation (pre-filled with the day's question), application and prayer, saved per day; earlier entries stay readable below.
- **Editing the devotionals:** `scripts/devo_source.py` → `python3 scripts/build_devos.py` (checks every reference against the Khmer versification). Add or change series freely; add `DATED` entries (`MM-DD`) for special days. The texts never quote the verses themselves — the verses are always loaded from ពគប. **Please have a pastor review them before wide publication.**
- **Reading plans:** Whole Bible in a year (OT + NT each day), New Testament in 90 days, the four Gospels in 30 days, Psalms & Proverbs in 60 days. Chapters are spread by verse count so days are even. A day ticks itself off when you finish its chapters in the reader (or tick it by hand); a calendar shows done, missed and today, and you see how many days you are behind. The reader shows the plan's next chapter at the end of each chapter.
- **Highlights & notes:** tap any verse in the reader to colour it (yellow, green, blue, pink), write a note, copy it or share a link. All highlights are listed on this page, filterable by colour or notes.
- Journal, devotionals read, highlights and plan are included in the reading-data backup file.

## Questions & answers (`qa.html`)
- **299 questions** in 18 categories — the Bible, God, Jesus, the Holy Spirit, salvation, prayer, Christian life, sin, family, work & money, suffering, the church, death & eternity, angels, the last days, people & events, **faith & Khmer culture** (ancestors, family ceremonies, amulets, lucky days, Khmer New Year…), and **Bible facts**.
- Each answer is a short summary; **the verses themselves are the answer** — every cited passage (1,000+ references) is shown in full, loaded live from ពគប, with links to read it or see its arcs.
- Topics where sincere Christians disagree (baptism, end times, spiritual gifts…) are marked **មានការយល់ខុសគ្នា** and present the passages instead of one denomination's view.
- **Bible facts** are computed from the data at build time: chapter and verse counts, longest/shortest chapter and verse in ពគប, most cross-referenced verse, most-mentioned place, word counts.
- Search in Khmer or English, filter by category, 🎲 random question, shareable links (`qa.html#salvation-1`).
- In the reader, verses used by an answer show a small **?** and the verse toolbar lists those questions.
- Source: `scripts/qa_source.py` (easy to edit and extend). Rebuild with `python3 scripts/build_qa.py --bible KhmerBFBSBible.xml` — every reference is validated against the Khmer versification (e.g. Micah 5:2 in English = មីកា ៥:១ in ពគប). **Please have a pastor or Bible teacher review the answers before wide publication;** readers can suggest questions or corrections through GitHub Issues.

## Prayer (`prayer.html`)

- **How to pray** — the A·C·T·S pattern (Adoration, Confession, Thanksgiving, Supplication) with verses and short sample prayers, plus 8 short tips.
- **Guided prayer** — a step-by-step overlay (be still → A → C → T → S → the Lord's Prayer) with an optional 1/2/3-minute gentle timer per step. Link: `prayer.html#guided`.
- **The Lord's Prayer** line by line (ម៉ាថាយ ៦:៩–១៣), with a short explanation of each line.
- **Pray for…** — 24 topics (morning, anxiety, the sick, grief, family, students, work, Cambodia and its leaders, friends who don't know God, …), each with verses to pray and a sample prayer that can be copied, shared or added to your list. Link: `prayer.html#topic-anxiety`.
- **Prayers in the Bible** — 25 prayers (Hannah, Solomon, Nehemiah, Daniel, Jonah, Mary, Gethsemane, John 17, Paul's prayers…) shown live from ពគប.
- **My prayer list** — private requests (stored only in this browser, key `kb-prayers`): mark “I prayed today”, record when and how God answered. Included in the reader's backup/restore.
- Source: `scripts/prayer_source.py`; rebuild with `python3 scripts/build_prayer.py` (validates every reference against the Khmer versification, e.g. Jonah's prayer is យ៉ូណាស ២:២–១០ in ពគប). Sample prayers are simple starting points — please have a pastor review them.

## Videos (`videos.html`)
- All **85 Khmer videos from [BibleProject](https://bibleproject.com/km/)** — 41 Old Testament and 32 New Testament book overviews and 12 themes — in a searchable gallery.
- Each book overview is mapped to the chapters it explains, so the **reader shows the right video beside every chapter** (e.g. លោកុប្បត្តិ ១២–៥០ for Genesis 15, រ៉ូម ៥–១៦ for Romans 8). Theme videos appear under related **Q&A answers** (Holy Spirit, holiness, covenants, sacrifice and atonement, justice…).
- Videos are **embedded from BibleProject's own YouTube channel** (privacy-enhanced `youtube-nocookie.com`, click-to-play), never re-uploaded or edited, with the credit BibleProject asks for — *"BibleProject is the author and owner of this content"* — and a link back to bibleproject.com/km. This follows their [sharing guidelines](https://help.bibleproject.com/hc/en-us/articles/4479161296151-What-are-the-basic-guidelines-when-sharing-BibleProject-content); the site must stay free (no profit from their content).
- The Genesis 12–50 video's link on BibleProject's Khmer page is malformed (10-character YouTube id), so that card opens bibleproject.com/km instead. Rebuild the index with `python3 scripts/build_videos.py` when they add videos.

- A few videos have no working YouTube ID on BibleProject's site (e.g. Genesis 12–50); those play in the same pop-up from BibleProject's own video server (Mux), set in `MUX` in `scripts/build_videos.py`.
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

## Music (`music.html` + a player on every page)

Worship songs or quiet music to listen to while reading. A player bar sits at the bottom of every page and keeps playing when you move to another page (it continues from the same second; if the browser asks for a tap first, the bar shows «ចុចកន្លែងណាមួយ ដើម្បីបន្តស្ដាប់» and any tap resumes it).

- **Controls:** play/pause, previous/next, seek, volume/mute, shuffle, repeat (all / one / off), sleep timer (15 / 30 / 60 min or end of song, with a gentle fade-out).
- **Now playing panel:** big cover, the queue, all playlists, search by title or singer, and **lyrics** — timed `.lrc` lyrics highlight the line being sung (tap a line to jump there).
- **Stays out of the way:** shrink the bar to a small round button (⎯), or close it (✕). On phones it is a slim bar that opens a full-screen player.
- **Lock screen & headphones:** title, artist and cover show on the phone's lock screen; media keys and headphone buttons work.
- **Pop-out window (⧉):** plays in a small separate window, so music never stops while you browse the site.
- Only one tab plays at a time. The last song, position, volume and settings are remembered on the device.
- **♥ Favourites and my own playlists:** each listener can tap ♥ on any song, create playlists (✎ rename, 🗑 delete), add songs with ⋯ → «បញ្ចូលក្នុងបញ្ជី…», reorder them, and use «ចាក់បន្ទាប់» (play next). Saved on the listener's device and included in the reading-data backup file.
- **Listen offline:** ⋯ → «ទាញយកទុកស្ដាប់ពេលគ្មានអ៊ីនធឺណិត» (or ⬇ for a whole playlist) keeps a copy of the song on the device; saved songs show ✓ and are collected in «ទាញយករួច».
- **Songs from the listener's own phone/computer:** «ចម្រៀងនៅលើឧបករណ៍» → «បញ្ចូលពីឧបករណ៍» adds their own MP3s (title, singer and cover are read from the file). They stay only on that device, play offline, and can go into playlists too. Nothing is uploaded.
- The player button appears once there are songs on the site or on the device.

**Adding songs:** put `.mp3` files in `music/` — each sub-folder is a playlist (e.g. `music/worship/`). Upload them on GitHub (*Add file → Upload files*) and the workflow `.github/workflows/music-playlist.yml` rebuilds `music/playlist.json` from the files' tags (title, artist, album, cover, length) automatically. Locally: `pip install mutagen && python3 scripts/build_playlist.py`. Details, lyrics format and size limits: `music/README.md`.
**Copyright:** only add songs you have the right to share (your own recordings, public-domain hymns, Creative Commons music, or with written permission).

## Works offline & installs like an app

A service worker (`sw.js`) keeps a copy of every page you open, so the site opens without internet: reading (the ពគប text is cached after the first visit), devotionals, prayers, Q&A, and any songs you saved or added from your device. `manifest.json` lets people **add the site to their home screen** (Chrome: menu → *Install app* / *Add to Home screen*; iPhone Safari: Share → *Add to Home Screen*). On iPhone, installing it to the home screen also protects saved songs from being cleared after weeks without visits.

## Daily posts to Telegram / Facebook

Every morning at about 6:00 (Cambodia time) a GitHub Action (`.github/workflows/daily-post.yml`) posts **the same verse of the day and daily devotional the website shows**:

- **Telegram channel:** a verse picture (1080×1350, Khmer text from ពគប) with the verse as caption, then the devotional as a message with a «អាននៅលើគេហទំព័រ» button.
- **Facebook Page:** one photo post — the verse picture, with the verse and the devotional as the text.

It runs on GitHub's servers for free; your computer doesn't need to be on. Set up only the channels you want — a channel without its secrets is skipped.

**Telegram (5 minutes)**
1. In Telegram, open **@BotFather** → `/newbot` → choose a name → copy the **bot token**.
2. Create your channel (or use an existing one), open its settings → **Administrators → Add admin** → add your bot, allow **Post messages**.
3. Public channel: the chat id is `@your_channel_name`. Private channel: forward a channel post to **@getidsbot** (or similar) to get an id like `-100…`.

**Facebook Page (15 minutes, once)**
1. At [developers.facebook.com](https://developers.facebook.com/) → **Create app** (type *Business*), and add the *Facebook Login for Business* / Pages use case.
2. Open **Graph API Explorer**, pick your app, add the permissions `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, click **Generate Access Token** and allow your Page.
3. On your computer run `python3 scripts/fb_page_token.py APP_ID APP_SECRET THAT_TOKEN PAGE_ID` — it prints a Page token that **does not expire** (check that it says *Expires: never*).
4. If posts are only visible to you, switch the app from *Development* to *Live* (it needs a privacy-policy URL — a page on this site is enough).

**Add the secrets in GitHub:** repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Example |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `7712345678:AAH…` |
| `TELEGRAM_CHAT_ID` | `@khmer_bible_daily` |
| `FB_PAGE_ID` | `1234567890` |
| `FB_PAGE_TOKEN` | `EAAG…` |

**Test it:** **Actions → Daily verse & devotional → Run workflow**. With *Preview only* ticked it posts nothing — open the run to read the messages and download the picture (artifact *daily-card*). Untick it to post for real. You can also preview any date (e.g. `2026-12-25`) or post to one channel only.

Notes: change the time in the `cron:` line (it is in UTC: Cambodia = UTC+7). GitHub turns scheduled workflows off after 60 days without any commit to the repository — you'll get an email; click *Enable workflow* (or make any small commit). Keep tokens only in GitHub secrets, never in files. Each post credits ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤ (ពគប) and links back to the site; the ពគប text is © BFBS/UBS 1954, 1962, so check with the Bible Society of Cambodia if you plan large-scale or commercial use.

## “Live connection” to ពគប
The Khmer text is **not stored in this repo**. On first visit the browser fetches it in a Web Worker from the [Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format) GitHub repository (`KhmerBFBSBible.xml`, via jsDelivr with raw.githubusercontent as fallback), then keeps it in the browser cache so later visits are instant. The arcs work immediately even before the text arrives.

To use another source, open the page with `?text=<url-to-xml>` (same Beblia XML format), or edit `TEXT_SOURCES` at the top of `app.js`.

## Visitor statistics (owner)
Anonymous site-wide counts via [GoatCounter](https://khgeo.goatcounter.com) — no cookies, no personal data, no consent banner needed. Dashboard: https://khgeo.goatcounter.com
- Page views, unique visitors, returning visits, countries, devices and referrers per page.
- Events: `finished-chapter`, `word-search`, `map-play`, `copy-verse`, `highlight`, `plan-start`, `qa-open`, `video-play` — counts only; no chapter, search word or reader identity is sent.
- Visits from `localhost` are not counted. To remove tracking, delete the `gc.zgo.at` script line at the bottom of each `.html` page.

## Publish on GitHub Pages
1. Create a repository (e.g. `khgeo/Khmer_Bible`) and push these files to `main`.
2. Settings → Pages → *Deploy from a branch* → `main` / root.
3. Visit `https://khgeo.github.io/Khmer_Bible/`.

Run locally: `python3 -m http.server` then open http://localhost:8000.

## Rebuilding the data
```bash
# cross_references.txt: https://www.openbible.info/labs/cross-references/
# KhmerBFBSBible.xml:   https://github.com/Beblia/Holy-Bible-XML-Format
python3 scripts/build_data.py --xref cross_references.txt --bible KhmerBFBSBible.xml --out data
# Bible-Geocoding-Data: https://github.com/openbibleinfo/Bible-Geocoding-Data
python3 scripts/build_places.py --geo Bible-Geocoding-Data --bible KhmerBFBSBible.xml
python3 scripts/build_qa.py --bible KhmerBFBSBible.xml
python3 scripts/build_prayer.py
python3 scripts/build_devos.py
```
The XML is used only for chapter/verse structure. References with zero or negative votes are dropped; 218 that point outside the Khmer versification are skipped.

## Files
| Path | Content |
|---|---|
| `index.html`, `app.js` | Arc diagram page |
| `words.html`, `words.js`, `words.css` | Word frequency page |
| `read.html`, `read.js`, `read.css` | Reader |
| `today.html`, `today.js`, `today.css` | Devotional, reading plans, highlights |
| `qa.html`, `qa.js`, `qa.css` | Questions & answers |
| `prayer.html`, `prayer.js`, `prayer.css` | Prayer guide, topics, Bible prayers, private prayer list |
| `videos.html`, `data/videos.json` | BibleProject Khmer videos, mapped to chapters and questions |
| `data/qa.json` | Built Q&A (from `scripts/qa_source.py`) |
| `data/prayers.json` | Built prayer data (from `scripts/prayer_source.py`) |
| `data/devotionals.json` | Built devotionals (from `scripts/devo_source.py`) |
| `sw.js`, `manifest.json`, `assets/icon-*.png` | Offline copy of the site, install to home screen |
| `music.html`, `music.js`, `music.css`, `music/`, `scripts/build_playlist.py`, `.github/workflows/music-playlist.yml` | Music player and playlists |
| `.github/workflows/daily-post.yml`, `scripts/daily_post.py`, `scripts/fb_page_token.py` | Daily Telegram / Facebook posts |
| `assets/fonts/` | Battambang font (SIL OFL) for the verse pictures |
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
