#!/usr/bin/env python3
"""Build data/places.json for the Bible places map.

Inputs
  --geo    OpenBible.info Bible-Geocoding-Data folder (CC-BY 4.0)
           https://github.com/openbibleinfo/Bible-Geocoding-Data
  --bible  KhmerBFBSBible.xml — used only to find each place's Khmer name
  --meta   data/meta.json
Khmer names: verified overrides in scripts/km_place_names.json, otherwise the
word that best co-occurs with the place's verses (only for places with 3+ verses
and a clear match). Places without a confident Khmer name keep the English one.
"""
import argparse, json, os, re, collections, ast

ap = argparse.ArgumentParser()
ap.add_argument("--geo", required=True); ap.add_argument("--bible", required=True)
ap.add_argument("--meta", default="data/meta.json"); ap.add_argument("--out", default="data/places.json")
a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__))

meta = json.load(open(a.meta, encoding="utf-8"))
osis = {b["osis"]: i for i, b in enumerate(meta["books"])}
base = {}; g = 0
for bi, b in enumerate(meta["books"]):
    for c, n in enumerate(b["ch"], 1): base[(bi, c)] = g; g += n
NV = g

def gi(o):
    b, c, v = o.split(".")
    if b not in osis: return None
    k = (osis[b], int(c))
    if k not in base or int(v) > meta["books"][k[0]]["ch"][k[1] - 1]: return None
    return base[k] + int(v) - 1

# --- Khmer text, split into word segments (zero-width space separated) ---
xml = open(a.bible, encoding="utf-8").read()
txt = [""] * NV
for bm in re.finditer(r'<book number="(\d+)">(.*?)</book>', xml, re.S):
    bi = int(bm.group(1)) - 1
    for cm in re.finditer(r'<chapter number="(\d+)">(.*?)</chapter>', bm.group(2), re.S):
        c = int(cm.group(1))
        for vm in re.finditer(r'<verse number="(\d+)">(.*?)</verse>', cm.group(2), re.S):
            v = int(vm.group(1))
            if (bi, c) in base and v <= meta["books"][bi]["ch"][c - 1]: txt[base[(bi, c)] + v - 1] = vm.group(2)
SEP = r'[​\s។៕៖,.!?;:«»"“”()\[\]\-]+'
def grams(t):
    s = [x for x in re.split(SEP, t.replace("‌", "")) if x]; out = set()
    for n in (1, 2, 3):
        for i in range(len(s) - n + 1): out.add("".join(s[i:i + n]))
    return out
G = [grams(t) for t in txt]
df = collections.Counter()
for s in G: df.update(s)
norm = lambda s: s.replace("​", "").replace("‌", "").replace("្ត", "្ដ")
ntxt = [norm(t) for t in txt]
STOP = set("ព្រះ ទ្រង់ នោះ ហើយ គេ ដែល នៅ ក្នុង ពី ទៅ មក ជា និង នឹង ឲ្យ បាន មាន ក៏ ស្រុក ក្រុង ភ្នំ ទន្លេ សមុទ្រ ពួក រាល់ គ្នា ឯ វាល".split())
PREFIX = ("នៅ", "ពី", "ដល់", "ទៅ", "ក្នុង", "ឯ", "និង", "នឹង")

def auto_name(vs):
    if len(vs) < 3: return None
    c = collections.Counter()
    for v in vs: c.update(G[v])
    cands = [(k / len(vs), k / df[w], w) for w, k in c.items()
             if len(w) >= 2 and w not in STOP and not w.startswith(PREFIX)]
    cands = [x for x in cands if x[0] >= 0.6 and x[1] >= 0.6]
    if not cands: return None
    top = max(x[0] for x in cands)
    cands = [x for x in cands if x[0] >= top - 0.03]
    return max(cands, key=lambda x: (x[1], len(x[2])))[2]

overrides = json.load(open(os.path.join(here, "km_place_names.json"), encoding="utf-8"))
modern = {}
for line in open(os.path.join(a.geo, "data", "modern.jsonl"), encoding="utf-8"):
    m = json.loads(line)
    if m.get("lonlat"): modern[m["id"]] = m

def parse(v):
    if isinstance(v, (dict, list)): return v
    try: return json.loads(v)
    except Exception:
        try: return ast.literal_eval(v)
        except Exception: return {}

out = []; named = auto = 0
for line in open(os.path.join(a.geo, "data", "ancient.jsonl"), encoding="utf-8"):
    p = json.loads(line)
    vs = sorted({x for x in (gi(q["osis"]) for q in p.get("verses", [])) if x is not None})
    if not vs: continue
    assoc = parse(p.get("modern_associations", {})) or {}
    best = max(((mid, d.get("score", 0)) for mid, d in assoc.items() if mid in modern), key=lambda t: t[1], default=None)
    if not best: continue
    lon, lat = map(float, modern[best[0]]["lonlat"].split(","))
    km = None
    for cand in overrides.get(p["friendly_id"], []):
        if sum(norm(cand) in ntxt[v] for v in vs) / len(vs) >= 0.6: km = cand.replace("‌", ""); break
    if not km:
        km = auto_name(vs)
        if km: auto += 1
    if km: named += 1
    en = re.sub(r"\s+\d+$", "", p["friendly_id"])
    out.append({"en": en, "km": km, "_auto": bool(km) and not any(km == c.replace("\u200c", "") for c in overrides.get(p["friendly_id"], [])), "t": (p.get("types") or ["place"])[0], "lat": round(lat, 4), "lon": round(lon, 4),
                "c": best[1], "modern": assoc[best[0]].get("name", ""), "v": vs})
# an auto-detected name shared by different places is ambiguous (e.g. Tubal/Meshech) — drop it
cnt = collections.Counter(r["km"] for r in out if r["km"])
fixed = {r["km"] for r in out if r["km"] and not r["_auto"]}
for r in out:
    if r["_auto"] and (cnt[r["km"]] > 1 or r["km"] in fixed and r["_auto"]): r["km"] = None; auto -= 1; named -= 1
    del r["_auto"]
out.sort(key=lambda r: -len(r["v"]))
json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"places={len(out)} with Khmer name={named} (auto={auto}) verse links={sum(len(r['v']) for r in out)}")
