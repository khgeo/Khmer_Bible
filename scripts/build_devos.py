#!/usr/bin/env python3
"""Validate scripts/devo_source.py and write data/devotionals.json (references checked against meta.json)."""
import json, os, re, sys, importlib.util
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
spec = importlib.util.spec_from_file_location("devo_source", os.path.join(here, "devo_source.py"))
src = importlib.util.module_from_spec(spec); spec.loader.exec_module(src)
meta = json.load(open(os.path.join(root, "data", "meta.json"), encoding="utf-8"))
books = {b["osis"]: b for b in meta["books"]}
errs = []
def ref(where, r, rng):
    m = re.fullmatch(r"([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)" + (r"(?:-(\d+))?" if rng else ""), r)
    if not m: errs.append(f"{where}: bad ref {r}"); return r
    b, ch, v = m.group(1), int(m.group(2)), int(m.group(3)); v2 = m.group(4) if rng else None
    if b not in books: errs.append(f"{where}: unknown book {r}"); return r
    chs = books[b]["ch"]
    if not 1 <= ch <= len(chs): errs.append(f"{where}: bad chapter {r}")
    elif not 1 <= v <= chs[ch - 1]: errs.append(f"{where}: bad verse {r}")
    elif v2 and not v < int(v2) <= chs[ch - 1]: errs.append(f"{where}: bad range {r}")
    return r
def item(i, t, r, rd, b, q, p, **extra):
    return {"id": i, "t": t, "r": ref(i, r, False), "read": ref(i, rd, True), "b": b, "q": q, "p": p, **extra}
items, ids = [], set()
for s, km, en in src.SERIES:
    for k, row in enumerate(src.DEVOS[s]):
        it = item(f"{s}-{row[0]}", *row[1:], s=s, n=k + 1)
        if it["id"] in ids: errs.append("duplicate " + it["id"])
        ids.add(it["id"]); items.append(it)
dated = []
for d, i, *rest in src.DATED:
    if not re.fullmatch(r"\d\d-\d\d", d): errs.append(f"bad date {d}")
    dated.append(item(i, *rest, date=d))
# Spurgeon, "Morning and Evening" (public domain), adapted into Khmer — used only for months in "approved"
spec2 = importlib.util.spec_from_file_location("spurgeon_source", os.path.join(here, "spurgeon_source.py"))
sp = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(sp)
taken = {x["date"] for x in dated}
for d, i, *rest in sp.MORNING:
    if d in taken: errs.append(f"{d}: date already used by a special-day devotional"); continue
    it = item(i, *rest, date=d, by=sp.CREDIT)
    if it["id"] in ids: errs.append("duplicate " + it["id"])
    ids.add(it["id"]); dated.append(it)
old = os.path.join(root, "data", "devotionals.json")
try: approved = json.load(open(old, encoding="utf-8")).get("approved", [])   # keep the months already approved
except Exception: approved = []
if errs: print("\n".join(errs)); sys.exit(1)
out = {"approved": approved, "series": [{"id": s, "km": km, "en": en, "n": len(src.DEVOS[s])} for s, km, en in src.SERIES], "items": items, "dated": dated}
json.dump(out, open(os.path.join(root, "data", "devotionals.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"devotionals.json: {len(items)} devotionals in {len(src.SERIES)} series + {len(dated)} dated (Spurgeon: {len(sp.MORNING)}; approved months: {approved or 'none yet'})")
