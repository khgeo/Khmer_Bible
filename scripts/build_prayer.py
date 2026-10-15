#!/usr/bin/env python3
"""Validate scripts/prayer_source.py and write data/prayers.json (every reference is checked against meta.json)."""
import json, os, re, sys, importlib.util
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
spec = importlib.util.spec_from_file_location("prayer_source", os.path.join(here, "prayer_source.py"))
src = importlib.util.module_from_spec(spec); spec.loader.exec_module(src)
meta = json.load(open(os.path.join(root, "data", "meta.json"), encoding="utf-8"))
books = {b["osis"]: b for b in meta["books"]}
errs = []
def refs(where, s):
    rs = s.split()
    if not rs: errs.append(f"{where}: no refs")
    for r in rs:
        m = re.fullmatch(r"([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?", r)
        if not m: errs.append(f"{where}: bad ref {r}"); continue
        b, ch, v, v2 = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        if b not in books: errs.append(f"{where}: unknown book {r}"); continue
        chs = books[b]["ch"]
        if not 1 <= ch <= len(chs): errs.append(f"{where}: bad chapter {r}"); continue
        if not 1 <= v <= chs[ch - 1]: errs.append(f"{where}: bad verse {r} (max {chs[ch-1]})")
        if v2 and not v < int(v2) <= chs[ch - 1]: errs.append(f"{where}: bad range {r} (max {chs[ch-1]})")
    return rs
def uniq(name, ids):
    d = {i for i in ids if ids.count(i) > 1}
    if d: errs.append(f"{name}: duplicate ids {d}")
out = {
  "acts": [{"id": i, "km": km, "en": en, "x": x, "r": refs(f"acts {i}", r), "p": p} for i, km, en, x, r, p in src.ACTS],
  "lords": [{"r": refs(f"lords {r}", r)[0], "x": x} for r, x in src.LORDS],
  "bible": [{"id": i, "t": t, "en": en, "w": w, "r": refs(f"bible {i}", r)} for i, t, en, w, r in src.BIBLE],
  "topics": [{"id": i, "i": ic, "t": t, "en": en, "r": refs(f"topic {i}", r), "p": p} for i, ic, t, en, r, p in src.TOPICS],
  "tips": [{"t": t, "en": en, "x": x, "r": refs(f"tip {t}", r)} for t, en, x, r in src.TIPS],
}
uniq("bible", [x["id"] for x in out["bible"]]); uniq("topics", [x["id"] for x in out["topics"]])
if errs: print("\n".join(errs)); sys.exit(1)
json.dump(out, open(os.path.join(root, "data", "prayers.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"prayers.json: {len(out['acts'])} ACTS steps, {len(out['lords'])} Lord's-prayer lines, {len(out['bible'])} Bible prayers, {len(out['topics'])} topics, {len(out['tips'])} tips")
