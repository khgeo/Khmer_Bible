# Music for the Khmer_Bible site

Put your songs here and they appear in the music player at the bottom of every page (and on `music.html`).

```
music/
  worship/                ← one folder = one playlist
    info.json             ← optional: {"km": "ចម្រៀងថ្វាយបង្គំ", "en": "Worship", "order": 1, "note": "…"}
    cover.jpg             ← optional playlist picture
    01 ព្រះគុណដ៏អស្ចារ្យ.mp3
    01 ព្រះគុណដ៏អស្ចារ្យ.lrc  ← optional lyrics (same name as the song): .lrc = timed, .txt = plain
  instrumental/
    …
```

* **Title, artist, album, length and cover picture** are read from the MP3's own tags (set them in any tag editor, e.g. Mp3tag). Without tags, the file name is used (`01 ` at the start is removed and sets the order).
* **On GitHub** you don't need to run anything: upload the files (Add file → Upload files) and the workflow *Music playlist* rebuilds `music/playlist.json` by itself within a minute.
* **On your computer:** `pip install mutagen` then `python3 scripts/build_playlist.py`.
* `.lrc` lyrics look like `[00:12.50]ព្រះគុណដ៏អស្ចារ្យ` — one line per sung line; tapping a line jumps there.

**Size:** 128 kbps MP3 ≈ 1 MB per minute. GitHub refuses files over 100 MB, the web upload over 25 MB, and a Pages site should stay under 1 GB in total (about 150–200 songs). For more, host the files elsewhere and put full `https://` URLs in `playlist.json`.

**Copyright:** only upload songs you wrote, recorded yourself, or have written permission to share (many worship songs are copyrighted even when they are free to sing in church). Public-domain hymns and music released under Creative Commons are fine — keep the credit in the artist tag.
