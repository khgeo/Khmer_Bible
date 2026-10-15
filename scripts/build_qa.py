#!/usr/bin/env python3
"""Validate scripts/qa_source.py and write data/qa.json (every reference is checked against meta.json)."""
import json, os, re, sys, importlib.util
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
spec = importlib.util.spec_from_file_location("qa_source", os.path.join(here, "qa_source.py"))
src = importlib.util.module_from_spec(spec); spec.loader.exec_module(src)
meta = json.load(open(os.path.join(root, "data", "meta.json"), encoding="utf-8"))
books = {b["osis"]: b for b in meta["books"]}
cats = [c[0] for c in src.CATEGORIES]
errs, items, seen = [], [], set()
for i, (c, q, en, a, refs, flags) in enumerate(src.QA):
    if c not in cats: errs.append(f"#{i} bad category {c}")
    if q in seen: errs.append(f"#{i} duplicate question {q}")
    seen.add(q)
    rs = refs.split()
    if not rs: errs.append(f"#{i} no refs")
    for r in rs:
        m = re.fullmatch(r"([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?", r)
        if not m: errs.append(f"#{i} bad ref {r}"); continue
        b, ch, v, v2 = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        if b not in books: errs.append(f"#{i} unknown book {r}"); continue
        chs = books[b]["ch"]
        if not 1 <= ch <= len(chs): errs.append(f"#{i} bad chapter {r}"); continue
        if not 1 <= v <= chs[ch - 1]: errs.append(f"#{i} bad verse {r} (max {chs[ch-1]})")
        if v2 and not v < int(v2) <= chs[ch - 1]: errs.append(f"#{i} bad range {r} (max {chs[ch-1]})")
    items.append({"id": f"{c}-{sum(1 for x in items if x['c'] == c) + 1}", "c": c, "q": q, "en": en, "a": a, "r": rs, **({"d": 1} if "d" in flags else {})})
if errs: print("\n".join(errs)); sys.exit(1)

# ---------- "Bible facts": answers computed from the data itself ----------
import argparse, glob, collections
ap = argparse.ArgumentParser(); ap.add_argument("--bible", help="KhmerBFBSBible.xml (optional, for text-based facts)")
args = ap.parse_args()
KD = "០១២៣៤៥៦៧៨៩"; km = lambda n: (f"{n:,}" if isinstance(n, int) else str(n)).translate(str.maketrans("0123456789", KD))
B = meta["books"]; NB = len(B)
chs = [(bi, c + 1, n) for bi, b in enumerate(B) for c, n in enumerate(b["ch"])]
ref = lambda bi, c, v=None: f"{B[bi]['osis']}.{c}.{v or 1}"
lab = lambda bi, c, v=None: f"{B[bi]['km']} {km(c)}" + (f":{km(v)}" if v else "")
g2 = []  # global verse index -> (book, chapter, verse)
for bi, c, n in chs: g2 += [(bi, c, v) for v in range(1, n + 1)]
OT = sum(len(b["ch"]) for b in B[:39]); NT = len(chs) - OT
vOT = sum(sum(b["ch"]) for b in B[:39]); NV = len(g2)
longest = max(chs, key=lambda x: x[2]); shortest = min(chs, key=lambda x: x[2])
mid = chs[len(chs) // 2]
bv = [(bi, sum(b["ch"])) for bi, b in enumerate(B)]
mostv = max(bv, key=lambda x: x[1]); leastv = min(bv, key=lambda x: x[1])
facts = [
 ("តើព្រះគម្ពីរមានប៉ុន្មានជំពូក និងប៉ុន្មានខ?", "How many chapters and verses are in the Bible?",
  f"ក្នុង ពគប មាន {km(len(chs))} ជំពូក — សញ្ញាចាស់ {km(OT)} និងសញ្ញាថ្មី {km(NT)} — ហើយ {km(NV)} ខ (សញ្ញាចាស់ {km(vOT)} និងសញ្ញាថ្មី {km(NV - vOT)})។ ការបែងចែកជាជំពូក និងខ ត្រូវបានបន្ថែមនៅយុគកណ្ដាល ដើម្បីងាយស្រួលរកមើល ហើយចំនួនខអាចខុសគ្នាបន្តិចបន្តួចតាមការបកប្រែ។",
  [ref(0, 1), ref(65, 22, 21)]),
 ("តើជំពូកណាវែងជាងគេ?", "What is the longest chapter?",
  f"{lab(longest[0], longest[1])} មាន {km(longest[2])} ខ — ជាជំពូកវែងបំផុត។ វាជាបទចំរៀងដ៏វែងអំពីព្រះបន្ទូលរបស់ព្រះ ដែលចែកជា ២២ ផ្នែក តាមអក្សរហេព្រើរ។",
  [f"{B[longest[0]]['osis']}.{longest[1]}.105"]),
 ("តើជំពូកណាខ្លីជាងគេ?", "What is the shortest chapter?",
  f"{lab(shortest[0], shortest[1])} មានតែ {km(shortest[2])} ខ ប៉ុណ្ណោះ — ជាជំពូកខ្លីបំផុត ដែលអំពាវនាវឲ្យគ្រប់ទាំងសាសន៍សរសើរព្រះយេហូវ៉ា។",
  [f"{B[shortest[0]]['osis']}.{shortest[1]}.1-{shortest[2]}"]),
 ("តើជំពូកណានៅចំកណ្ដាលព្រះគម្ពីរ?", "What is the middle chapter of the Bible?",
  f"ក្នុងចំណោម {km(len(chs))} ជំពូក ជំពូកទី {km(len(chs) // 2 + 1)} គឺ {lab(mid[0], mid[1])}។",
  [f"{B[mid[0]]['osis']}.{mid[1]}.1"]),
 ("តើសៀវភៅណាមានខច្រើនជាងគេ ហើយតិចជាងគេ?", "Which books have the most and fewest verses?",
  f"{B[mostv[0]]['km']} មានខច្រើនជាងគេ ({km(mostv[1])} ខ) ហើយ {B[leastv[0]]['km']} មានខតិចជាងគេ ({km(leastv[1])} ខ)។",
  [ref(mostv[0], 1), ref(leastv[0], 1)]),
]
# cross-references: most-referenced verse, verse with most references, busiest chapter pair
inc = collections.Counter(); out_ = collections.Counter()
for f in glob.glob(os.path.join(root, "data", "xref", "*.json")):
    a = json.load(open(f))
    for i in range(0, len(a), 4): out_[a[i]] += 1; inc[a[i + 1]] += 1
if inc:
    gi, n = inc.most_common(1)[0]; bi, c, v = g2[gi]
    go, no = out_.most_common(1)[0]; bo, co, vo = g2[go]
    facts += [
     ("តើខណាដែលត្រូវបានយោងច្រើនជាងគេ?", "Which verse is cross-referenced most often?",
      f"{lab(bi, c, v)} ត្រូវបានខផ្សេងៗយោងមកដល់ {km(n)} ដង — ច្រើនជាងខណាទាំងអស់ ក្នុងទិន្នន័យសម្ពន្ធរបស់ OpenBible.info។ មើលធ្នូរបស់វានៅទំព័រ «ធ្នូសម្ពន្ធ»។",
      [ref(bi, c, v)]),
     ("តើខណាមានខយោងច្រើនជាងគេ?", "Which verse has the most cross-references?",
      f"{lab(bo, co, vo)} មានខយោងទៅកាន់ខផ្សេងទៀតចំនួន {km(no)}។",
      [ref(bo, co, vo)]),
     ("តើព្រះគម្ពីរមានខយោងប៉ុន្មាន?", "How many cross-references are there?",
      f"ទិន្នន័យរបស់ OpenBible.info មានខយោងចំនួន {km(sum(out_.values()))} ដែលភ្ជាប់ខទាំង {km(NV)} ទៅវិញទៅមក — បង្ហាញជាធ្នូ {km(len(json.load(open(os.path.join(root, 'data', 'chapter_links.json')))))} នៅទំព័រ «ធ្នូសម្ពន្ធ»។",
      [ref(0, 1)]),
    ]
pl = os.path.join(root, "data", "places.json")
if os.path.exists(pl):
    P = json.load(open(pl, encoding="utf-8"))
    top = P[0]; bi, c, v = g2[top["v"][0]]
    facts.append(("តើទីកន្លែងណាដែលព្រះគម្ពីររៀបរាប់ច្រើនជាងគេ?", "Which place is mentioned most in the Bible?",
      f"{top['km'] or top['en']} ត្រូវបានរៀបរាប់ក្នុង {km(len(top['v']))} ខ — ច្រើនជាងទីកន្លែងណាទាំងអស់។ បន្ទាប់មកគឺ " +
      "، ".join(f"{x['km'] or x['en']} ({km(len(x['v']))})" for x in P[1:4]).replace("، ", " ") + "។ មើលនៅទំព័រ «ផែនទី»។",
      [ref(bi, c, v)]))
if args.bible:
    xml = open(args.bible, encoding="utf-8").read(); T = {}
    for bm in re.finditer(r'<book number="(\d+)">(.*?)</book>', xml, re.S):
        bi = int(bm.group(1)) - 1
        for cm in re.finditer(r'<chapter number="(\d+)">(.*?)</chapter>', bm.group(2), re.S):
            for vm in re.finditer(r'<verse number="(\d+)">(.*?)</verse>', cm.group(2), re.S):
                t = re.sub(r"[\u200b\u200c]", "", vm.group(2)).strip()
                if t: T[(bi, int(cm.group(1)), int(vm.group(1)))] = t
    L = lambda k: len(re.sub(r"\s", "", T[k]))
    sh = min(T, key=L); lo = max(T, key=L)
    word = lambda w: sum(t.count(w) for t in T.values())
    facts += [
     ("តើខណាខ្លីជាងគេ ក្នុង ពគប?", "What is the shortest verse in the Khmer Bible?",
      f"ក្នុង ពគប ខខ្លីបំផុត (រាប់តាមតួអក្សរ) គឺ {lab(*sh)}។ ជាបញ្ជីឈ្មោះសត្វស្លាប។ ខខ្លីដ៏ល្បីបំផុតគឺ «ព្រះយេស៊ូវក៏ទ្រង់ព្រះកន្សែង» (យ៉ូហាន ១១:៣៥)។",
      [ref(*sh), "John.11.35"]),
     ("តើខណាវែងជាងគេ ក្នុង ពគប?", "What is the longest verse in the Khmer Bible?",
      f"ខវែងបំផុត (រាប់តាមតួអក្សរ) គឺ {lab(*lo)} ដែលមាន {km(L(lo))} តួអក្សរ។",
      [ref(*lo)]),
     ("តើព្រះនាម «ព្រះយេហូវ៉ា» មានប៉ុន្មានដងក្នុង ពគប?", "How often does 'ព្រះយេហូវ៉ា' appear?",
      f"ពាក្យ «ព្រះយេហូវ៉ា» មាន {km(word('ព្រះយេហូវ៉ា'))} ដង ក្នុង ពគប ហើយ «ព្រះយេស៊ូវ» មាន {km(word('ព្រះយេស៊ូវ'))} ដង។ សាកល្បងរាប់ពាក្យផ្សេងទៀត នៅទំព័រ «ប្រេកង់ពាក្យ»។",
      ["Exod.6.3", "Matt.1.21"]),
    ]
for q, en, a, rs in facts:
    items.append({"id": f"facts-{sum(1 for x in items if x['c'] == 'facts') + 1}", "c": "facts", "q": q, "en": en, "a": a, "r": rs, "auto": 1})
src.CATEGORIES.append(("facts", "ការពិតអំពីព្រះគម្ពីរ", "Bible facts (computed)"))
out = {"cats": [{"id": k, "km": km, "en": en, "n": sum(1 for x in items if x["c"] == k)} for k, km, en in src.CATEGORIES], "items": items}
json.dump(out, open(os.path.join(root, "data", "qa.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(items)} questions, {sum(len(x['r']) for x in items)} references — all valid")
for c in out["cats"]: print(f"  {c['id']:10} {c['n']}")
