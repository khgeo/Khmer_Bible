#!/usr/bin/env python3
"""Build data/study.json — the daily Bible study (one lesson a day, book by book).

Lessons are written in scripts/study_<book>.py (for now: Mark, 45 lessons). Day 0 is START;
lesson n is shown on the website (study.html) and posted on Facebook / Telegram (slot "study").
After the last lesson the plan starts again, until the next book is added to BOOKS below.

Every reference is checked against the ពគប text, so a typing mistake stops the build.

Usage:  python3 scripts/build_study.py --bible KhmerBFBSBible.xml
"""
import argparse, importlib, json, os, re, sys, xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START = "2026-11-16"          # a Monday — lesson 1 of Mark
BOOKS = ["study_mark"]        # add "study_john" etc. here when they are written
REF = re.compile(r"^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--bible", required=True); a = ap.parse_args()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    meta = json.load(open(os.path.join(ROOT, "data", "meta.json"), encoding="utf-8"))
    osis = [b["osis"] for b in meta["books"]]
    have = set()
    for bk in ET.parse(a.bible).getroot().iter("book"):
        o = osis[int(bk.get("number")) - 1]
        for ch in bk.iter("chapter"):
            for v in ch.iter("verse"): have.add((o, int(ch.get("number")), int(v.get("number"))))
    bad = []

    def check(r, where):
        m = REF.match(r)
        if not m: bad.append(f"{where}: bad reference {r}"); return
        b, c, v, c2, v2 = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4), m.group(5)
        c2 = int(c2) if c2 else c; v2 = int(v2) if v2 else v
        for x in ((b, c, v), (b, c2, v2)):
            if x not in have: bad.append(f"{where}: {r} — verse {x} is not in ពគប")
        if (c2, v2) < (c, v): bad.append(f"{where}: {r} runs backwards")

    series, ids = [], set()
    for mod in BOOKS:
        M = importlib.import_module(mod)
        for L in M.LESSONS:
            w = L["id"]
            if w in ids: bad.append(f"duplicate id {w}")
            ids.add(w)
            for r in [L["r"], L["mv"], *L["x"]]: check(r, w)
            for k in ("t", "bg", "p"):
                if not L[k].strip(): bad.append(f"{w}: empty {k}")
            for k in ("o", "i", "a", "g"):
                if not L[k]: bad.append(f"{w}: no questions in {k}")
        series.append({**M.SERIES, "lessons": M.LESSONS})
    if bad:
        print("\n".join(bad)); sys.exit(1)
    out = {"start": START,
           "note": "Daily Bible study — built by scripts/build_study.py from scripts/study_*.py. Day 0 = start; one lesson a day; repeats after the last lesson.",
           "series": series}
    json.dump(out, open(os.path.join(ROOT, "data", "study.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    n = sum(len(s["lessons"]) for s in series)
    print(f"study plan: {n} lessons in {len(series)} book(s), starting {START}")


if __name__ == "__main__":
    main()
