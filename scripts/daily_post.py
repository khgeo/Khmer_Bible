#!/usr/bin/env python3
"""Post the verse of the day and the daily devotional to a Telegram channel and/or a Facebook Page.

Picks exactly what the website shows on that date (same verse list as common.js, same devotional
cycle as today.js, same evening plan as prayer.html), takes the verse text from ពគប, draws a
1080x1350 card and posts. Three posts a day (--slot):
  morning  verse of the day (about 5 years of different verses) + the devotional
  noon     question of the day (data/qa.json)
  evening  pray the Scriptures: a short passage + a prayer prompt (data/evening.json, about 6 years)


  Telegram:  the card (caption = the verse) and then the devotional as a text message
  Facebook:  one photo post — the card, with the verse and the devotional as the caption

Settings come from environment variables (GitHub Actions secrets). A channel without its
settings is skipped, so you can use only Telegram or only Facebook:
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   (e.g. @my_channel — the bot must be a channel admin)
  FB_PAGE_ID, FB_PAGE_TOKEN              (a Page access token with pages_manage_posts)
  SITE_URL                               (default https://khgeo.github.io/Khmer_Bible/)

Usage:
  python3 scripts/daily_post.py --bible KhmerBFBSBible.xml --dry-run       # preview only
  python3 scripts/daily_post.py --bible KhmerBFBSBible.xml                 # post
  python3 scripts/daily_post.py --bible ... --date 2026-12-25 --dry-run    # preview another day
"""
import argparse, datetime as dt, json, os, re, sys, textwrap, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TZ = dt.timezone(dt.timedelta(hours=7))  # Asia/Phnom_Penh
KD = "០១២៣៤៥៦៧៨៩"
km = lambda n: str(n).translate(str.maketrans("0123456789", KD))
KM_MONTH = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"]
KM_DAY = ["ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍", "អាទិត្យ"]  # Python weekday(): Monday = 0
GRAPH = "https://graph.facebook.com/v25.0"


# ---------- data: the same choices the website makes ----------
def load_data(bible_path):
    meta = json.load(open(os.path.join(ROOT, "data", "meta.json"), encoding="utf-8"))
    devos = json.load(open(os.path.join(ROOT, "data", "devotionals.json"), encoding="utf-8"))
    # translated classics (Spurgeon) are used only for approved months, same as today.js
    devos["dated"] = [x for x in devos.get("dated", []) if not x.get("by") or x["date"][:2] in devos.get("approved", [])]
    js = open(os.path.join(ROOT, "common.js"), encoding="utf-8").read()
    votd = re.findall(r"'([1-3]?[A-Za-z]+\.\d+\.\d+)'", re.search(r"const VOTD = \[(.*?)\];", js, re.S).group(1))
    m = re.search(r"const VOTD_START = '(\d{4}-\d\d-\d\d)'", js)
    votd = (votd, dt.date.fromisoformat(m.group(1)) if m else dt.date(1970, 1, 1))
    osis = [b["osis"] for b in meta["books"]]
    text = {}
    for bk in ET.parse(bible_path).getroot().iter("book"):
        o = osis[int(bk.get("number")) - 1]
        for ch in bk.iter("chapter"):
            for v in ch.iter("verse"):
                text[(o, int(ch.get("number")), int(v.get("number")))] = re.sub(r"^៙\s*", "", (v.text or "").strip())
    return meta, devos, votd, text


def day_utc(d):  # days since 1970-01-01 for a calendar date (matches Date.UTC(...)/864e5 in JS)
    return (d - dt.date(1970, 1, 1)).days


def pick(d, devos, votd):
    lst, start = votd
    vref = lst[(d - start).days % len(lst)]                   # same as votdRef() in common.js
    mmdd = d.strftime("%m-%d")
    dv = next((x for x in devos.get("dated", []) if x["date"] == mmdd), None)
    if not dv and devos.get("items"):
        n = len(devos["items"]); dv = devos["items"][(day_utc(d) - day_utc(dt.date(2026, 1, 1))) % n]
    return vref, dv


def label(meta, ref):
    m = re.fullmatch(r"([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?", ref)
    b = next(x for x in meta["books"] if x["osis"] == m.group(1))
    return f"{b['km']} {km(m.group(2))}:{km(m.group(3))}" + (f"–{km(m.group(4))}" if m.group(4) else "")


def clean(t):  # drop the psalm "Selah" mark and the end-of-book sign for posting
    return re.sub(r"\s*[–-]?\s*បង្អង់\s*$", "", t.replace(":៚", "").replace("៕", "។")).strip()


def verse(text, ref, numbered=False):
    m = re.fullmatch(r"([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?", ref)
    b, c, v = m.group(1), int(m.group(2)), int(m.group(3)); v2 = int(m.group(4) or v)
    return " ".join((f"{km(x)} " if numbered else "") + clean(text[(b, c, x)]) for x in range(v, v2 + 1) if (b, c, x) in text)


# ---------- the verse card ----------
# One look per post: morning = warm sunrise, noon = fresh sky with a "?" mark, evening = night sky with moon and stars.
THEMES = {
    "morning": {"top": (253, 246, 230), "bot": (246, 222, 190), "accent": "#a8801a", "bar": "#e2c87e", "text": "#1b1d22",
                "muted": "#6b6f78", "rule": "#dfd3b4", "link": "#1b5fb8"},
    "noon":    {"top": (244, 250, 252), "bot": (203, 233, 238), "accent": "#0f6b78", "bar": "#7cc4cc", "text": "#13262b",
                "muted": "#55707a", "rule": "#b5d8de", "link": "#0f5fa8"},
    "evening": {"top": (14, 24, 56), "bot": (40, 46, 96), "accent": "#e9c46a", "bar": "#b99a4a", "text": "#f4efe2",
                "muted": "#aab3cf", "rule": "#3c4780", "link": "#9cc3ff"},
}


def backdrop(img, style, F):
    from PIL import Image, ImageDraw, ImageFilter
    import random
    W, H = img.size; T = THEMES[style]; d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H; d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(T["top"], T["bot"])))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    if style == "morning":      # rising sun glow with soft rays, top right
        cx, cy = W - 150, 120
        for i in range(14):
            import math
            a = math.radians(100 + i * 11)
            g.polygon([(cx, cy), (cx + 1500 * math.cos(a - .025), cy + 1500 * math.sin(a - .025)),
                       (cx + 1500 * math.cos(a + .025), cy + 1500 * math.sin(a + .025))], fill=(255, 214, 140, 26))
        g.ellipse([cx - 230, cy - 230, cx + 230, cy + 230], fill=(255, 200, 110, 90))
        g.ellipse([cx - 120, cy - 120, cx + 120, cy + 120], fill=(255, 226, 160, 150))
        glow = glow.filter(ImageFilter.GaussianBlur(28))
    elif style == "noon":       # big faint question mark and soft circles
        g.ellipse([-260, H - 520, 300, H + 40], fill=(255, 255, 255, 70))
        g.ellipse([W - 330, -160, W + 170, 340], fill=(150, 210, 220, 60))
        glow = glow.filter(ImageFilter.GaussianBlur(45))
        q = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(q).text((W - 400, H - 1010), "?", font=F("Bold", 700), fill=(15, 107, 120, 26))
        glow = Image.alpha_composite(glow, q)
    else:                        # stars (same pattern each day) and a crescent moon
        rnd = random.Random(1954)
        for _ in range(140):
            x, y, r = rnd.randrange(W), rnd.randrange(int(H * .82)), rnd.choice((1, 1, 1, 2, 2, 3))
            g.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 240, rnd.randrange(70, 200)))
        halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse([W - 330, 40, W - 90, 280], fill=(255, 236, 170, 70))
        glow = Image.alpha_composite(glow, halo.filter(ImageFilter.GaussianBlur(40)))
        m = Image.new("L", (W, H), 0); md = ImageDraw.Draw(m)
        md.ellipse([W - 280, 90, W - 140, 230], fill=255); md.ellipse([W - 245, 70, W - 115, 200], fill=0)
        moon = Image.new("RGBA", (W, H), (250, 230, 170, 255)); moon.putalpha(m)
        glow = Image.alpha_composite(glow, moon)
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB"))


def card(path, vtext, vlabel, dlabel, site, title="ខគម្ពីរប្រចាំថ្ងៃ", style="morning"):
    from PIL import Image, ImageDraw, ImageFont, features
    W, H, M = 1080, 1350, 96
    T = THEMES[style]
    layout = ImageFont.Layout.RAQM if features.check("raqm") else ImageFont.Layout.BASIC
    if layout != ImageFont.Layout.RAQM: print("warning: Pillow has no libraqm — Khmer may not render correctly", file=sys.stderr)
    F = lambda w, s: ImageFont.truetype(os.path.join(ROOT, "assets", "fonts", f"Battambang-{w}.ttf"), s, layout_engine=layout)
    img = Image.new("RGB", (W, H)); backdrop(img, style, F); d = ImageDraw.Draw(img)
    d.rectangle([M, 150, M + 90, 156], fill=T["accent"])
    # Battambang lacks a few punctuation glyphs; use plain ones on the picture
    fix = lambda t: t.replace("–", "-").replace("—", "-").replace("·", "-")
    vtext, vlabel, title = fix(vtext), fix(vlabel), fix(title)
    ts = next(z for z in (40, 36, 32, 29, 26) if d.textlength(title, font=F("Bold", z)) <= W - 2 * M or z == 26)
    d.text((M, 175 + (40 - ts) // 2), title, font=F("Bold", ts), fill=T["accent"])
    d.text((M, 232), dlabel, font=F("Regular", 30), fill=T["muted"])
    # words in ពគប are separated by zero-width spaces, so wrap on those and on spaces
    def clusters(w):   # split a long Khmer run into letter clusters (a consonant + its marks / subscripts)
        out = []
        for ch in w:
            if out and not ("\u1780" <= ch <= "\u17B3" and not out[-1].endswith("\u17D2")):
                out[-1] += ch
            else:
                out.append(ch)
        return out
    words = [w for w in re.split(r"(\u200b| )", vtext) if w]
    for size in (64, 58, 52, 47, 42, 38, 34):
        f = F("Regular", size); lines, cur = [], ""
        seq = []
        for w in words:
            seq += clusters(w) if d.textlength(w, font=f) > W - 2 * M - 8 else [w]
        for w in seq:
            tryl = cur + w
            if d.textlength(tryl.replace("\u200b", ""), font=f) > W - 2 * M - 8 and cur.strip():
                lines.append(cur.strip(" \u200b")); cur = w.lstrip(" \u200b")
            else: cur = tryl
        if cur.strip(" \u200b"): lines.append(cur.strip(" \u200b"))
        lh = int(size * 1.95)
        if len(lines) * lh <= 760: break
    # (Battambang has no curly quotes or dashes, so the quote bar and the rule are drawn)
    y0 = y = 330 + (760 - len(lines) * lh) // 2
    for ln in lines:
        d.text((M + 8, y), ln.replace("\u200b", ""), font=f, fill=T["text"]); y += lh
    d.rounded_rectangle([M - 34, y0 + int(size * .35), M - 26, y - int(size * .2)], radius=4, fill=T["bar"])
    d.line([(M + 8, y + 52), (M + 58, y + 52)], fill=T["accent"], width=4)
    d.text((M + 76, y + 24), vlabel, font=F("Bold", 40), fill=T["accent"])
    d.line([(M, H - 150), (W - M, H - 150)], fill=T["rule"], width=2)
    d.text((M, H - 125), "ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤ (ពគប)", font=F("Regular", 28), fill=T["muted"])
    d.text((M, H - 82), site.replace("https://", "").rstrip("/"), font=F("Regular", 28), fill=T["link"])
    img.save(path, optimize=True)


# ---------- message text ----------
def messages(d, meta, text, vref, dv, site):
    dlabel = f"ថ្ងៃ{KM_DAY[d.weekday()]} ទី{km(d.day)} ខែ{KM_MONTH[d.month - 1]} ឆ្នាំ{km(d.year)}"
    vt, vl = verse(text, vref), label(meta, vref)
    read_url = f"{site}read.html#{vref}"
    verse_msg = f"📖 ខគម្ពីរប្រចាំថ្ងៃ · {dlabel}\n\n«{vt}»\n— {vl}\n\nអានជំពូកពេញ៖ {read_url}"
    devo_msg = None
    if dv:
        kt, kl = verse(text, dv["r"]), label(meta, dv["r"])
        parts = [f"🕊️ ការតាំងចិត្តប្រចាំថ្ងៃ\n{dv['t']}",
                 f"«{kt}»\n— {kl}",
                 f"📖 អាន៖ {label(meta, dv['read'])}",
                 dv["b"],
                 f"💭 សំណួរពិចារណា\n{dv['q']}",
                 f"🙏 ការអធិស្ឋាន\n{dv['p']}",
                 *([f"✍️ {dv['by']}"] if dv.get("by") else []),
                 f"អានបន្ថែម និងសរសេរកំណត់ហេតុ៖ {site}today.html#devo-{dv['id']}"]
        devo_msg = "\n\n".join(parts)
    return dlabel, vt, vl, verse_msg, devo_msg


# ---------- extra posts: question of the day (noon) and prayer of the day (evening) ----------
def day_index(d, n, salt=0):
    return (day_utc(d) - day_utc(dt.date(2026, 1, 1)) + salt) % n


def segment(s, text):
    """Put zero-width spaces between Khmer words (using the words of the Bible itself), so the card
    can wrap a question written without word breaks at word ends instead of inside a word."""
    vocab = {w for t in text.values() for w in re.split(r"[\u200b\s]+", t) if w}
    def run(r):
        n = len(r); best = [(0, [])] + [None] * n          # fewest pieces; unknown letters cost extra
        for i in range(n):
            if best[i] is None: continue
            for j in range(i + 1, min(n, i + 20) + 1):
                cost = best[i][0] + (1 if r[i:j] in vocab else 3 * (j - i))
                if best[j] is None or cost < best[j][0]: best[j] = (cost, best[i][1] + [r[i:j]])
        return "\u200b".join(best[n][1])
    return re.sub(r"[\u1780-\u17FF]+", lambda m: run(m.group()), s)


def noon_post(d, meta, text, site, dlabel):
    qa = json.load(open(os.path.join(ROOT, "data", "qa.json"), encoding="utf-8"))
    items = [x for x in qa["items"] if not x.get("d") and not x.get("auto")]   # skip debated and number-fact questions
    # spread the categories: walk the list with a stride so neighbouring days get different topics
    it = items[(day_index(d, len(items)) * 37) % len(items)]
    vrefs = it["r"][:2]
    vlines = "\n\n".join(f"«{verse(text, r)}»\n— {label(meta, r)}" for r in vrefs)
    caption = f"❓ សំណួរប្រចាំថ្ងៃ · {dlabel}\n\n{it['q']}\n\nចម្លើយ និងខគម្ពីរទាំងអស់៖ {site}qa.html#{it['id']}"
    body = "\n\n".join([f"❓ {it['q']}", it["a"], f"📖 ព្រះគម្ពីរចែងថា\n{vlines}",
                         f"សំណួរ និងចម្លើយជិត ៣០០ ទៀត៖ {site}qa.html#{it['id']}"])
    return {"card": (segment(it["q"], text), "សំណួរ និងចម្លើយ", "សំណួរប្រចាំថ្ងៃ"), "caption": caption, "body": body, "tag": it["id"]}


def evening_post(d, meta, text, site, dlabel):
    """Pray the Scriptures: one short passage a day from data/evening.json (Psalms + New Testament + OT prayers)."""
    ev = json.load(open(os.path.join(ROOT, "data", "evening.json"), encoding="utf-8"))
    n = (d - dt.date.fromisoformat(ev["start"])).days
    it = ev["items"][n % len(ev["items"])]
    prompt = ev["prompts"][n % len(ev["prompts"])]
    plabel = " · ".join(label(meta, r) for r in it["r"])
    head = it.get("t") or plabel
    passage = "\n\n".join(f"📖 {label(meta, r)}\n{verse(text, r, numbered=True)}" for r in it["r"])
    k = it["k"]
    caption = f"🌙 អធិស្ឋានតាមព្រះបន្ទូល · {head}\n\n«{verse(text, k)}»\n— {label(meta, k)}"
    body = "\n\n".join([f"🌙 អធិស្ឋានពេលល្ងាច · {head}", "ចូរអានព្រះបន្ទូលនេះយឺតៗ ហើយយកវាមកអធិស្ឋាន៖", passage,
                          f"🙏 {prompt}", "សរសេរ «អាម៉ែន» ឬសំណូមអធិស្ឋានរបស់អ្នក នៅក្នុង comment — យើងនឹងអធិស្ឋានជាមួយគ្នា។",
                          f"អានជំពូកពេញ៖ {site}read.html#{it['r'][0].split('-')[0]}\nរបៀបអធិស្ឋាន៖ {site}prayer.html#tonight"])
    return {"card": (verse(text, k), label(meta, k), "អធិស្ឋានពេលល្ងាច៖ " + head), "caption": caption, "body": body,
            "tag": f"evening#{n % len(ev['items']) + 1}/{len(ev['items'])} {plabel}"}


# ---------- senders ----------
def http(url, fields=None, files=None):
    """POST form fields (and optional files) and return parsed JSON."""
    if files:
        bnd = "----kb" + str(int(time.time() * 1000)); body = b""
        for k, v in (fields or {}).items():
            body += f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for k, p in files.items():
            body += (f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"; filename="{os.path.basename(p)}"\r\n'
                     f"Content-Type: image/png\r\n\r\n").encode() + open(p, "rb").read() + b"\r\n"
        body += f"--{bnd}--\r\n".encode(); ctype = f"multipart/form-data; boundary={bnd}"
    else:
        body = urllib.parse.urlencode(fields or {}).encode(); ctype = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers={"Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {e.read().decode(errors='replace')[:500]}")


def telegram(token, chat, img, verse_msg, devo_msg, site):
    api = f"https://api.telegram.org/bot{token}"
    cap = verse_msg if len(verse_msg) <= 1024 else verse_msg[:1000] + "…"
    r = http(f"{api}/sendPhoto", {"chat_id": chat, "caption": cap}, {"photo": img})
    print("telegram photo:", r.get("ok"), r.get("description", ""))
    if devo_msg:
        kb = json.dumps({"inline_keyboard": [[{"text": "📖 អាននៅលើគេហទំព័រ", "url": site + "today.html"}]]})
        for i, chunk in enumerate(split(devo_msg, 4000)):
            r = http(f"{api}/sendMessage", {"chat_id": chat, "text": chunk, "disable_web_page_preview": "true",
                                             **({"reply_markup": kb} if i == len(split(devo_msg, 4000)) - 1 else {})})
            print("telegram devotional:", r.get("ok"), r.get("description", ""))


def facebook(page, token, img, verse_msg, devo_msg):
    msg = verse_msg + ("\n\n━━━━━━━━━━\n\n" + devo_msg if devo_msg else "")
    r = http(f"{GRAPH}/{page}/photos", {"message": msg, "access_token": token}, {"source": img})
    print("facebook:", r)


def split(s, n):
    out = []
    while len(s) > n:
        cut = s.rfind("\n\n", 0, n); cut = cut if cut > 0 else n
        out.append(s[:cut]); s = s[cut:].lstrip()
    return out + [s]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bible", required=True, help="KhmerBFBSBible.xml")
    ap.add_argument("--date", help="YYYY-MM-DD (default: today in Cambodia)")
    ap.add_argument("--dry-run", action="store_true", help="only print the messages and save the card")
    ap.add_argument("--out", default="daily_card.png")
    ap.add_argument("--only", choices=["telegram", "facebook"], help="post to one channel only")
    ap.add_argument("--slot", choices=["morning", "noon", "evening"], default="morning", help="morning = verse + devotional, noon = question of the day, evening = prayer")
    a = ap.parse_args()
    site = os.environ.get("SITE_URL", "https://khgeo.github.io/Khmer_Bible/").rstrip("/") + "/"
    d = dt.date.fromisoformat(a.date) if a.date else dt.datetime.now(TZ).date()
    meta, devos, votd, text = load_data(a.bible)
    vref, dv = pick(d, devos, votd)
    dlabel, vt, vl, verse_msg, devo_msg = messages(d, meta, text, vref, dv, site)
    if a.slot == "morning":
        card(a.out, vt, vl, dlabel, site)
        print(f"== {d} · morning · verse {vref} · devotional {dv and dv['id']} · card {a.out}\n")
    else:
        P = (noon_post if a.slot == "noon" else evening_post)(d, meta, text, site, dlabel)
        ctext, clabel, ctitle = P["card"]
        card(a.out, ctext, clabel, dlabel, site, title=ctitle, style=a.slot)
        verse_msg, devo_msg = P["caption"], P["body"]
        print(f"== {d} · {a.slot} · {P['tag']} · card {a.out}\n")
    print(verse_msg, "\n\n----------\n\n", devo_msg or "(no devotional)", sep="")
    if a.dry_run: return
    sent, failed = 0, []
    tg_t, tg_c = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    fb_p, fb_t = os.environ.get("FB_PAGE_ID"), os.environ.get("FB_PAGE_TOKEN")
    if a.only != "facebook":
        if tg_t and tg_c:
            try: telegram(tg_t, tg_c, a.out, verse_msg, devo_msg, site); sent += 1
            except Exception as e: failed.append(f"Telegram: {e}")
        else: print("Telegram: not configured, skipped")
    if a.only != "telegram":
        if fb_p and fb_t:
            try: facebook(fb_p, fb_t, a.out, verse_msg, devo_msg); sent += 1
            except Exception as e: failed.append(f"Facebook: {e}")
        else: print("Facebook: not configured, skipped")
    hints = {"#190": "the Page token is expired or was cancelled - make a new extended token and update FB_PAGE_TOKEN",
             "#200": "the token may not post to this Page - redo the token step, tick the Page and allow pages_manage_posts",
             "#10": "the app lacks permission - add pages_manage_posts to the app's use case and make a new token",
             "#100": "check FB_PAGE_ID (it must be the Page's number)",
             "Unauthorized": "check TELEGRAM_BOT_TOKEN", "chat not found": "check TELEGRAM_CHAT_ID and add the bot as channel admin"}
    print("\n========== RESULT ==========")
    for f in failed:
        print("FAILED", f)
        for k, h in hints.items():
            if k in f: print("  -> hint:", h)
    if not sent and not failed: print("Nothing was posted: no Telegram or Facebook secrets were found (check the secret names).")
    if sent: print(f"OK: posted to {sent} channel(s)")
    sys.stdout.flush()
    if failed or not sent: sys.exit(1)


if __name__ == "__main__":
    main()
