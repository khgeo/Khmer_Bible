#!/usr/bin/env python3
"""Build data/videos.json — BibleProject Khmer videos (https://bibleproject.com/km/).
Videos are only *embedded* from BibleProject's YouTube channel (never re-hosted or edited),
with the credit BibleProject asks for. Each overview is mapped to the chapters it covers;
each theme to related Q&A categories and key passages."""
import json, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(root, "data", "meta.json"), encoding="utf-8"))
osis = [b["osis"] for b in meta["books"]]
nch = {b["osis"]: len(b["ch"]) for b in meta["books"]}

# (YouTube id, title as published, [(book, firstCh, lastCh), ...])
OT = [
 ("K5WZZz1ej6I", "ទិដ្ឋភាពទូទៅ៖ ព្រះគម្ពីរសញ្ញាចាស់/ថាណាក់", []),
 ("egUi6ZQ6oyg", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរលោកុប្បត្តិ ១-១១", [("Gen", 1, 11)]),
 ("JA3W3CfyHM",  "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរលោកុប្បត្តិ ១២-៥០", [("Gen", 12, 50)]),
 ("aU529UQwjgk", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីនិក្ខមនំ ១-១៨", [("Exod", 1, 18)]),
 ("G4Opls4UQaA", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីនិក្ខមនំ ១៩-៤០", [("Exod", 19, 40)]),
 ("5IKVfpy_vKg", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរលេវីវិន័យ", [("Lev", 1, 27)]),
 ("ddVyicWO6Ow", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរជនគណនា", [("Num", 1, 36)]),
 ("MeEYyi_a1-U", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរចោទិយកថា", [("Deut", 1, 34)]),
 ("ntm2OSVvrhE", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយ៉ូស្វេ", [("Josh", 1, 24)]),
 ("eXCpX3xJfvU", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរពួកចៅហ្វាយ", [("Judg", 1, 21)]),
 ("iCEqknCxmug", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរនាងរស់", [("Ruth", 1, 4)]),
 ("woH5DzPC2_s", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ១ សាំយូអែល", [("1Sam", 1, 31)]),
 ("J93pA59ZKbA", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ២ សាំយូអែល", [("2Sam", 1, 24)]),
 ("Qwwwmew9MrM", "ទិដ្ឋភាពទូទៅ៖ ១-២ ពង្សាវតារក្សត្រ", [("1Kgs", 1, 22), ("2Kgs", 1, 25)]),
 ("HXbFXIOyVOo", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ១-២ របាក្សត្រ", [("1Chr", 1, 29), ("2Chr", 1, 36)]),
 ("NHT5PBdnfmU", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអែសរ៉ា-នេហេមា", [("Ezra", 1, 10), ("Neh", 1, 13)]),
 ("ZPyeKAECUt8", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរនាងអេសធើរ", [("Esth", 1, 10)]),
 ("kOc12JwPSTU", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយ៉ូប", [("Job", 1, 42)]),
 ("_f4YkjvY7PM", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរទំនុកដំកើង", [("Ps", 1, 150)]),
 ("tcmptgUm8jQ", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរសុភាសិត", [("Prov", 1, 31)]),
 ("CT7FJ1dhDRU", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរសាស្ដា", [("Eccl", 1, 12)]),
 ("RB5sL35i2MI", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរបទចម្រៀង", [("Song", 1, 8)]),
 ("GjLvq1p7BSk", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអេសាយ ១-៣៩", [("Isa", 1, 39)]),
 ("x6jr8XqMMQ8", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអេសាយ ៤០-៦៦", [("Isa", 40, 66)]),
 ("3iGNJlXbtxQ", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយេរេមា", [("Jer", 1, 52)]),
 ("88n9TBIE8GI", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរបរិទេវ", [("Lam", 1, 5)]),
 ("CyY_LgKYJ20", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអេសេគាល ១-៣៣", [("Ezek", 1, 33)]),
 ("9B59tlcywDg", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអេសេគាល ៣៤-៤៨", [("Ezek", 34, 48)]),
 ("V_a-lvUjYx4", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរដានីយ៉ែល", [("Dan", 1, 12)]),
 ("AdwPqOgot0c", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរហូសេ", [("Hos", 1, 14)]),
 ("_NFZarOQrew", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយ៉ូអែល", [("Joel", 1, 3)]),
 ("RWKatPVGevo", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអេម៉ុស", [("Amos", 1, 9)]),
 ("OXlSBx9UY7Y", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអូបាឌា", [("Obad", 1, 1)]),
 ("nkDH2HNm7xE", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយ៉ូណាស", [("Jonah", 1, 4)]),
 ("z0-gjmakP64", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរមីកា", [("Mic", 1, 7)]),
 ("8P-dRLKcRqI", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរណាហ៊ូម", [("Nah", 1, 3)]),
 ("ffBSy21DwI8", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរហាបាគុក", [("Hab", 1, 3)]),
 ("Ux-oCsdHaEA", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរសេផានា", [("Zeph", 1, 3)]),
 ("D5VkbIC7Owo", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរហាកាយ", [("Hag", 1, 2)]),
 ("00oIXeKauv4", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរសាការី", [("Zech", 1, 14)]),
 ("2CLod2MwQiA", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរម៉ាឡាគី", [("Mal", 1, 4)]),
]
NT = [
 ("LbCqgiiuHLA", "ទិដ្ឋភាពទូទៅ៖ ព្រះគម្ពីរសញ្ញាថ្មី", []),
 ("ClXtI0BM0Mk", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរម៉ាថាយ ១-១៣", [("Matt", 1, 13)]),
 ("pI7co0i-3TE", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរម៉ាថាយ ១៤-២៨", [("Matt", 14, 28)]),
 ("0KYxHqcews4", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរម៉ាកុស", [("Mark", 1, 16)]),
 ("my_rB41Slxo", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរលូកា ១-៩", [("Luke", 1, 9)]),
 ("o2EpiW_u-KI", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរលូកា ១០-២៤", [("Luke", 10, 24)]),
 ("5--lTi-sdoE", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយ៉ូហាន ១-១២", [("John", 1, 12)]),
 ("eAgZrB-E5Uk", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយ៉ូហាន ១៣-២១", [("John", 13, 21)]),
 ("74I2GTKkF-E", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរកិច្ចការ ១-១២", [("Acts", 1, 12)]),
 ("6t2F9lWBm0Q", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរកិច្ចការ ១៣-២៨", [("Acts", 13, 28)]),
 ("zy65BXLm9eU", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីររ៉ូម ១-៤", [("Rom", 1, 4)]),
 ("hkuLQ2Qeik0", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីររ៉ូម ៥-១៦", [("Rom", 5, 16)]),
 ("rFQsK2mT6y8", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ១ កូរិនថូស", [("1Cor", 1, 16)]),
 ("Rf34n8EVbfo", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ២ កូរិនថូស", [("2Cor", 1, 13)]),
 ("DJmTYbm3Atc", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរកាឡាទី", [("Gal", 1, 6)]),
 ("nsyMQ2af3J0", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរអេភេសូរ", [("Eph", 1, 6)]),
 ("eA9KIDAdJOg", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរភីលីព", [("Phil", 1, 4)]),
 ("D8RuRN1uouA", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរកូល៉ុស", [("Col", 1, 4)]),
 ("s_HlZdMR0Qs", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ១ ថែស្សាឡូនីច", [("1Thess", 1, 5)]),
 ("4SKVI5qZdtk", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ២ ថែស្សាឡូនីច", [("2Thess", 1, 3)]),
 ("DAMPn3eN9x0", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ១ ធីម៉ូថេ", [("1Tim", 1, 6)]),
 ("PKoBRmo8uuY", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ២ ធីម៉ូថេ", [("2Tim", 1, 4)]),
 ("v1qj_HbvWSY", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរទីតុស", [("Titus", 1, 3)]),
 ("Kp4fhJbNK1I", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរភីលេម៉ូន", [("Phlm", 1, 1)]),
 ("dLAgeQLleaI", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរហេព្រើរ", [("Heb", 1, 13)]),
 ("C5UQrFueOrg", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយ៉ាកុប", [("Jas", 1, 5)]),
 ("kp_Es5wpUTo", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ១ ពេត្រុស", [("1Pet", 1, 5)]),
 ("uQPlV_MTNEQ", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ២ ពេត្រុស", [("2Pet", 1, 3)]),
 ("bK3DFUSv79A", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរ ១-៣ យ៉ូហាន", [("1John", 1, 5), ("2John", 1, 1), ("3John", 1, 1)]),
 ("PXVgqxbLFZI", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរយូដាស", [("Jude", 1, 1)]),
 ("Ky9XABoj7aA", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរវិវរណៈ ១-១១", [("Rev", 1, 11)]),
 ("f_AL87eB2jY", "ទិដ្ឋភាពទូទៅ៖ កណ្ឌគម្ពីរវិវរណៈ ១២-២២", [("Rev", 12, 22)]),
]
# (id, title, related Q&A categories, related question topics (matched by English text), key passages)
THEMES = [
 ("hXsN_E71KU4", "សប្បុរស", ["work", "life"], ["generosity", "wealth", "poor"], ["2Cor.9.7", "Acts.20.35"]),
 ("iPYoU7aXD28", "ផ្លូវនៃការនិរទេស", ["people"], ["Exodus", "Babel"], ["Gen.3.23-24", "Ps.137.1"]),
 ("B-vzLd8s4wg", "យុត្តិធម៌", ["culture", "god"], ["just", "corruption", "poor"], ["Mic.6.8", "Amos.5.24"]),
 ("diPSKt9wDVA", "ការអានអត្ថបទព្រះគម្ពីរជាសាធារណៈ", ["bible"], ["read the Bible", "study the Bible", "start reading"], ["Neh.8.8", "1Tim.4.13"]),
 ("c7oW4SsxbMM", "ព្រះវិញ្ញាណបរិសុទ្ធ", ["spirit"], ["Holy Spirit"], ["Gen.1.2", "Acts.2.1-4"]),
 ("7Ff0ER_IUNw", "ថ្ងៃនៃព្រះអម្ចាស់", ["end"], ["come back", "end times", "judgment"], ["Joel.2.31", "2Pet.3.10"]),
 ("pFQUC5U1z3o", "រូបអង្គនៃព្រះ", ["god"], ["create people", "women"], ["Gen.1.26-28", "Col.1.15"]),
 ("xrl6THmdLYY", "ដំណឹងល្អអំពីព្រះរាជ្យនៃព្រះ", ["jesus", "salvation"], ["kingdom of God", "gospel"], ["Mark.1.14-15", "Matt.6.33"]),
 ("tp3pt12LG80", "ក្រឹត្យវិន័យ", ["bible", "sin"], ["laws", "Ten Commandments"], ["Exod.20.1-3", "Matt.5.17"]),
 ("NFtI6frRbQk", "យញ្ញបូជា និងការលោះបាប", ["salvation", "jesus"], ["have to die", "in our place", "redemption"], ["Lev.17.11", "Heb.10.10"]),
 ("rX6XwwEQ1bg", "ភាពបរិសុទ្ធ", ["god"], ["holy"], ["Isa.6.3", "1Pet.1.15-16"]),
 ("wcfmXnC9YlQ", "សេចក្ដីសញ្ញា (Covenants)", ["bible"], ["Old Testament and New Testament", "Abraham", "Noah"], ["Gen.9.13", "Jer.31.31", "Luke.22.20"]),
]
qa = json.load(open(os.path.join(root, "data", "qa.json"), encoding="utf-8"))["items"]
out, bad = [], []
def check_id(v):
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", v): bad.append(v); return False
    return True
for grp, rows in (("ot", OT), ("nt", NT)):
    for yt, title, spans in rows:
        for b, a, z in spans: assert b in nch and 1 <= a <= z <= nch[b], (title, b, a, z)
        ok = check_id(yt)
        out.append({"yt": yt if ok else None, "t": title, "g": grp, "s": [[osis.index(b), a, z] for b, a, z in spans]})
for yt, title, cats, topics, refs in THEMES:
    ok = check_id(yt)
    qs = [x["id"] for x in qa if x["c"] in cats and any(t.lower() in x["en"].lower() for t in topics)]
    out.append({"yt": yt if ok else None, "t": title, "g": "theme", "c": cats, "q": qs, "r": refs})
json.dump({"source": "https://bibleproject.com/km/", "credit": "BibleProject is the author and owner of this content.", "videos": out},
          open(os.path.join(root, "data", "videos.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(out)} videos ({sum(v['g']=='ot' for v in out)} OT, {sum(v['g']=='nt' for v in out)} NT, {sum(v['g']=='theme' for v in out)} themes)")
print("invalid YouTube ids (linked to bibleproject.com instead):", bad)
covered = set()
for v in out:
    for bi, a, z in v.get("s", []): covered.add(bi)
print("books without an overview video:", [osis[i] for i in range(66) if i not in covered])
for v in out:
    if v["g"] == "theme": print(" ", v["t"], "→", len(v["q"]), "questions")
