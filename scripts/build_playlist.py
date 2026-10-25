#!/usr/bin/env python3
"""Scan music/ and write music/playlist.json for the site's music player.

  music/
    worship/                 ← each folder is one playlist
      info.json              ← optional: {"km": "ចម្រៀងថ្វាយបង្គំ", "en": "Worship", "order": 1}
      cover.jpg              ← optional playlist picture (else the first song's embedded art)
      01 Song name.mp3       ← tags (title, artist, album, cover) are read from the file
      01 Song name.lrc       ← optional lyrics: .lrc (timed, highlighted while playing) or .txt
    other.mp3                ← files directly in music/ go into "ចម្រៀងផ្សេងៗ"

Run:  pip install mutagen   then   python3 scripts/build_playlist.py
(On GitHub this runs by itself whenever you upload .mp3 files — see .github/workflows/music-playlist.yml.)
Other formats that browsers play (.m4a, .aac, .ogg, .opus, .wav, .flac) work too."""
import hashlib, json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC = os.path.join(ROOT, "music")
EXT = (".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac")
try:
    import mutagen
    from mutagen.id3 import ID3
except ImportError:
    mutagen = None
    print("note: `pip install mutagen` to read song titles, artists, length and cover art from the files", file=sys.stderr)

rel = lambda p: os.path.relpath(p, ROOT).replace(os.sep, "/")
cap = lambda s: s[:1].upper() + s[1:]
nice = lambda f: re.sub(r"^\d+[\s._-]+", "", os.path.splitext(f)[0]).replace("_", " ").strip()


def tags(path):
    """→ (title, artist, album, seconds, cover bytes or None, track number)"""
    if not mutagen: return None, None, None, 0, None, None
    try:
        m = mutagen.File(path)
    except Exception as e:
        print(f"  ! cannot read {rel(path)}: {e}", file=sys.stderr); return None, None, None, 0, None, None
    if m is None: return None, None, None, 0, None, None
    secs = int(round(getattr(m.info, "length", 0) or 0))
    t = a = al = cov = n = None
    def g(k):
        try: v = m.tags.get(k) if m.tags is not None else None
        except Exception: v = None
        if v is None: return None
        if hasattr(v, "text"): v = v.text  # ID3 frame
        if isinstance(v, (list, tuple)): v = v[0] if v else None
        return str(v).strip() or None if v is not None else None
    if m.tags is not None:
        if isinstance(m.tags, ID3) or hasattr(m.tags, "getall"):
            t, a, al = g("TIT2"), g("TPE1"), g("TALB"); n = g("TRCK")
            pics = m.tags.getall("APIC") if hasattr(m.tags, "getall") else []
            cov = pics[0].data if pics else None
        else:  # mp4 / vorbis style tags
            t = g("\xa9nam") or g("title"); a = g("\xa9ART") or g("artist"); al = g("\xa9alb") or g("album")
            n = g("tracknumber")
            if "covr" in m.tags and m.tags["covr"]: cov = bytes(m.tags["covr"][0])
            if getattr(m, "pictures", None): cov = m.pictures[0].data
    try: n = int(str(n).split("/")[0]) if n else None
    except ValueError: n = None
    return t, a, al, secs, cov, n


def save_cover(data):
    os.makedirs(os.path.join(MUSIC, "covers"), exist_ok=True)
    ext = ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".jpg"
    p = os.path.join(MUSIC, "covers", hashlib.sha1(data).hexdigest()[:12] + ext)
    if not os.path.exists(p): open(p, "wb").write(data)
    return rel(p)


def folder_cover(d):
    for f in ("cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "cover.webp"):
        if os.path.exists(os.path.join(d, f)): return rel(os.path.join(d, f))
    return None


def main():
    if not os.path.isdir(MUSIC): sys.exit("no music/ folder")
    groups = {}
    for dp, dns, fns in os.walk(MUSIC):
        dns[:] = sorted(x for x in dns if x != "covers" and not x.startswith("."))
        songs = sorted(f for f in fns if f.lower().endswith(EXT))
        if songs: groups[dp] = songs
    playlists, ids = [], set()
    for d, songs in sorted(groups.items()):
        top = d == MUSIC
        pid = "other" if top else rel(d)[len("music/"):].replace("/", "-")
        info = {}
        ip = os.path.join(d, "info.json")
        if os.path.exists(ip):
            try: info = json.load(open(ip, encoding="utf-8"))
            except Exception as e: print(f"  ! {rel(ip)}: {e}", file=sys.stderr)
        tracks = []
        for f in songs:
            p = os.path.join(d, f)
            t, a, al, secs, cov, n = tags(p)
            base = os.path.splitext(p)[0]
            lyr = next((rel(base + e) for e in (".lrc", ".txt") if os.path.exists(base + e)), None)
            tid = re.sub(r"[\s/\\?#%&\"'<>.,;:!*()\[\]{}=+]+", "-", unicodedata.normalize("NFC", os.path.splitext(rel(p))[0][6:])).strip("-_")
            while tid in ids: tid += "-2"
            ids.add(tid)
            tr = {"id": tid, "src": rel(p), "t": t or nice(f)}
            if a: tr["a"] = a
            if al: tr["al"] = al
            if secs: tr["d"] = secs
            if cov: tr["c"] = save_cover(cov)
            if lyr: tr["lyr"] = lyr
            tr["_n"] = n
            tracks.append(tr)
        # tag track numbers first, then file names (files usually start with 01, 02 …)
        tracks.sort(key=lambda x: (x["_n"] is None, x["_n"] or 0, x["src"]))
        for x in tracks: x.pop("_n")
        name = os.path.basename(d)
        playlists.append({
            "id": pid,
            "km": info.get("km") or ("ចម្រៀងផ្សេងៗ" if top else cap(nice(name))),
            "en": info.get("en") or ("Other songs" if top else cap(nice(name))),
            **({"note": info["note"]} if info.get("note") else {}),
            "c": folder_cover(d) or next((x["c"] for x in tracks if x.get("c")), None),
            "order": info.get("order", 999 if top else 500),
            "tracks": tracks,
        })
    playlists.sort(key=lambda p: (p["order"], p["km"]))
    for p in playlists: p.pop("order")
    out = {"playlists": playlists}
    json.dump(out, open(os.path.join(MUSIC, "playlist.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n = sum(len(p["tracks"]) for p in playlists)
    print(f"music/playlist.json: {n} songs in {len(playlists)} playlist(s)")
    for p in playlists: print(f"  {p['km']} ({p['en']}): {len(p['tracks'])}")


if __name__ == "__main__":
    main()
