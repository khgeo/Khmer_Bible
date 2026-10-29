#!/usr/bin/env python3
"""Build data/evening.json — the evening "pray the Scriptures" plan (about 6 years, nothing repeats).

Each evening is a short passage to read slowly and turn into prayer, plus one prayer prompt:
  • the whole book of Psalms, in short parts (about 4 verses; Psalm 119 in half-stanzas of 4)
  • the New Testament, in parts of about 5 verses, ending at a full stop where possible
    (order: John, Philippians, Ephesians, Colossians, 1 John, Mark, Acts, Romans, James, 1 Peter,
     Luke, Galatians, 1–2 Thessalonians, Hebrews, Matthew, 1–2 Corinthians, 1–2 Timothy, Titus,
     Philemon, 2 Peter, 2–3 John, Jude, Revelation; long genealogies and greeting lists are left out)
  • the Old Testament prayers from data/prayers.json (Hannah, Solomon, Nehemiah, Daniel, Jonah …)
The Psalms are spread evenly between the New Testament parts (about 1 Psalm evening in 4), so the
plan never runs out of Psalms early. Day 0 is START; after the last item the plan starts again.

The card on each post shows the best-known verse of that evening's passage (OpenBible.info
cross-reference votes), so the picture always carries a complete, recognisable verse.

Usage:  python3 scripts/build_evening.py --bible KhmerBFBSBible.xml
"""
import argparse, json, os, re, xml.etree.ElementTree as ET
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START = "2026-11-01"

NT_ORDER = ["John", "Phil", "Eph", "Col", "1John", "Mark", "Acts", "Rom", "Jas", "1Pet", "Luke", "Gal",
            "1Thess", "2Thess", "Heb", "Matt", "1Cor", "2Cor", "1Tim", "2Tim", "Titus", "Phlm", "2Pet",
            "2John", "3John", "Jude", "Rev"]
SKIP = {("Matt", 1): range(2, 18), ("Luke", 3): range(23, 39), ("Rom", 16): list(range(3, 17)) + list(range(21, 25))}

# One prompt per evening, in turn. Written to suit any passage (a psalm, a gospel story, a letter).
PROMPTS = [
    "អានខទាំងនេះម្ដងទៀតយឺតៗ។ តើពាក្យ ឬឃ្លាណាដែលប៉ះចិត្តអ្នកជាងគេ? ចូរយកពាក្យនោះមកអធិស្ឋានទៅកាន់ព្រះ។",
    "តើខទាំងនេះបង្ហាញអ្វីខ្លះអំពីព្រះ? ចូរសរសើរទ្រង់ចំពោះលក្ខណៈនោះ។",
    "ចូរអរព្រះគុណព្រះសំរាប់រឿង ៣ យ៉ាងដែលទ្រង់បានធ្វើនៅថ្ងៃនេះ ទាំងរឿងធំ និងរឿងតូច។",
    "តើព្រះបន្ទូលនេះបង្ហាញអ្វីមួយក្នុងជីវិតអ្នក ដែលត្រូវកែប្រែទេ? ចូរលន់តួដោយស្មោះត្រង់ ហើយទទួលការអត់ទោសរបស់ទ្រង់។",
    "ចូរអធិស្ឋានខទាំងនេះ សំរាប់មនុស្សម្នាក់ដែលអ្នកស្រឡាញ់ ដោយដាក់ឈ្មោះគាត់ចូលក្នុងសេចក្ដីអធិស្ឋាន។",
    "តើព្រះកំពុងហៅអ្នកឲ្យធ្វើអ្វីមួយនៅថ្ងៃស្អែក? ចូរសូមទ្រង់ប្រទានកំឡាំងឲ្យអ្នកស្ដាប់បង្គាប់។",
    "មុនពេលចូលដេក ចូរប្រគល់កង្វល់ទាំងប៉ុន្មានរបស់អ្នក ទៅក្នុងព្រះហស្តនៃព្រះ។",
    "ចូរអធិស្ឋានសំរាប់ពួកជំនុំ គ្រួសាររបស់អ្នក និងប្រទេសកម្ពុជា ដោយផ្អែកលើព្រះបន្ទូលនេះ។",
    "ចូរនៅស្ងៀមមួយសន្ទុះនៅចំពោះព្រះ។ បន្ទាប់មក សរសេរមួយឃ្លា ពីអ្វីដែលអ្នកបានរៀននៅថ្ងៃនេះ។",
    "បើខទាំងនេះមានសេចក្ដីសន្យា ចូរកាន់ខ្ជាប់សេចក្ដីសន្យានោះ ហើយអរព្រះគុណទ្រង់ ដែលទ្រង់ស្មោះត្រង់។",
    "តើខទាំងនេះបង្រៀនអ្វីខ្លះអំពីព្រះយេស៊ូវ ឬអំពីការដើរតាមទ្រង់? ចូរថ្វាយបង្គំទ្រង់ ដោយពាក្យរបស់អ្នកផ្ទាល់។",
    "តើមាននរណាម្នាក់ដែលអ្នកត្រូវអត់ទោសឲ្យទេ? ចូរសូមព្រះជួយឲ្យអ្នកអត់ទោសឲ្យគេ ដូចជាទ្រង់បានអត់ទោសឲ្យអ្នក។",
    "ចូរអធិស្ឋានសំរាប់មនុស្សម្នាក់ ដែលមិនទាន់ស្គាល់ព្រះយេស៊ូវ សូមឲ្យគាត់បានឮ និងជឿដំណឹងល្អ។",
    "ចូរសូមព្រះវិញ្ញាណបរិសុទ្ធជួយឲ្យអ្នកយល់ និងរស់នៅតាមព្រះបន្ទូលនេះ នៅថ្ងៃស្អែក។",
]
NEG = "សំលាប់ សំឡាប់ បណ្តាសា បណ្ដាសា វេទនា ក្រោធ ខ្ញាល់ សាតាំង អារក្ស កំផិត ផិត ស្អប់ ប្រហារ បំផ្លាញ ខ្មាំង ទាស់នឹង មនុស្សអាក្រក់ ទុច្ចរិត".split()
END = tuple("។?!»៕")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--bible", required=True); a = ap.parse_args()
    meta = json.load(open(os.path.join(ROOT, "data", "meta.json"), encoding="utf-8"))
    prayers = json.load(open(os.path.join(ROOT, "data", "prayers.json"), encoding="utf-8"))
    osis = [b["osis"] for b in meta["books"]]
    text = {}
    for bk in ET.parse(a.bible).getroot().iter("book"):
        o = osis[int(bk.get("number")) - 1]
        for ch in bk.iter("chapter"):
            for v in ch.iter("verse"):
                text[(o, int(ch.get("number")), int(v.get("number")))] = re.sub(r"^៙\s*", "", (v.text or "").strip())
    # cross-reference votes → how well known each verse is
    refs = [(b["osis"], c, v) for b in meta["books"] for c, n in enumerate(b["ch"], 1) for v in range(1, n + 1)]
    gi = {r: i for i, r in enumerate(refs)}
    score = Counter()
    for f in os.listdir(os.path.join(ROOT, "data", "xref")):
        arr = json.load(open(os.path.join(ROOT, "data", "xref", f)))
        for i in range(0, len(arr), 4):
            s, t0, t1, vo = arr[i:i + 4]; score[s] += vo / 4
            for t in range(t0, t1 + 1): score[t] += vo / (t1 - t0 + 1)
    plain = lambda r: text.get(r, "").replace("​", "").replace("‌", "")
    chap = lambda b, c: next(x for x in meta["books"] if x["osis"] == b)["ch"][c - 1]

    def key_verse(b, c, vs):
        good = [v for v in vs if len(plain((b, c, v))) <= 260 and not any(w in plain((b, c, v)) for w in NEG)]
        return max(good or vs, key=lambda v: score[gi[(b, c, v)]])

    def chunks(b, c, size):
        """Split a chapter into parts of about `size` verses, moving each cut by one verse
        when that lets the part end at a full stop."""
        vs = [v for v in range(1, chap(b, c) + 1) if v not in SKIP.get((b, c), ()) and (b, c, v) in text]
        k = 1 if len(vs) <= size + 2 else round(len(vs) / size)   # short psalms / chapters stay whole
        cuts = [round(i * len(vs) / k) for i in range(k + 1)]
        for i in range(1, k):
            ends = lambda j: plain((b, c, vs[j - 1])).endswith(END)
            if not ends(cuts[i]):
                for j in (cuts[i] + 1, cuts[i] - 1):
                    if cuts[i - 1] + 2 <= j <= cuts[i + 1] - 2 and ends(j): cuts[i] = j; break
        out = []
        for p in (vs[cuts[i]:cuts[i + 1]] for i in range(k)):
            run = [p[0]]                       # a skipped list splits a part in two
            for v in p[1:]:
                if v == run[-1] + 1: run.append(v)
                else: out.append(run); run = [v]
            out.append(run)
        return out

    def item(b, c, vs, title=None):
        k = key_verse(b, c, vs)
        return {"r": [f"{b}.{c}.{vs[0]}" + (f"-{vs[-1]}" if vs[-1] != vs[0] else "")], "k": f"{b}.{c}.{k}", **({"t": title} if title else {})}

    psalms = []
    for c in range(1, 151):
        if c == 119:
            for s in range(0, 176, 4): psalms.append(item("Ps", 119, list(range(s + 1, s + 5))))
            continue
        for p in chunks("Ps", c, 4): psalms.append(item("Ps", c, p))
    nt = []
    for b in NT_ORDER:
        for c in range(1, len(next(x for x in meta["books"] if x["osis"] == b)["ch"]) + 1):
            for p in chunks(b, c, 5): nt.append(item(b, c, p))
    # Old Testament prayers from prayers.json (those not already inside the Psalms or the New Testament)
    otp = []
    for p in prayers["bible"]:
        if all(r.split(".")[0] not in ("Ps",) + tuple(NT_ORDER) for r in p["r"]):
            m = re.fullmatch(r"([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?", p["r"][0])
            b, c, v1, v2 = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4) or m.group(3))
            otp.append({"r": p["r"], "k": f"{b}.{c}.{key_verse(b, c, list(range(v1, v2 + 1)))}", "t": p["t"]})
    # spread the OT prayers through the Psalm track, then spread the Psalm track through the NT track
    step = len(psalms) // (len(otp) + 1)
    for i, p in enumerate(otp): psalms.insert((i + 1) * step + i, p)
    plan, a_, b_ = [], 0, 0
    while a_ < len(psalms) or b_ < len(nt):
        if b_ >= len(nt) or (a_ < len(psalms) and a_ / len(psalms) <= b_ / len(nt)): plan.append(psalms[a_]); a_ += 1
        else: plan.append(nt[b_]); b_ += 1
    out = {"start": START, "note": "Evening 'pray the Scriptures' plan — built by scripts/build_evening.py. Day 0 = start; the plan repeats after the last item.",
           "prompts": PROMPTS, "items": plan}
    json.dump(out, open(os.path.join(ROOT, "data", "evening.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"evening plan: {len(plan)} evenings (~{len(plan) / 365.25:.1f} years) — psalm parts {len(psalms) - len(otp)}, "
          f"NT parts {len(nt)}, OT prayers {len(otp)}")


if __name__ == "__main__":
    main()
