#!/usr/bin/env python3
"""Turn a short-lived Facebook *user* token into a Page token that does not expire,
for the FB_PAGE_TOKEN secret. Run it once on your own computer:

  python3 scripts/fb_page_token.py APP_ID APP_SECRET SHORT_USER_TOKEN PAGE_ID

APP_ID / APP_SECRET: your app at developers.facebook.com → App settings → Basic.
SHORT_USER_TOKEN: from the Graph API Explorer with pages_show_list, pages_manage_posts,
pages_read_engagement selected (you must be an admin of the Page).
Never commit the token or share it — put it only in the GitHub secret."""
import json, sys, urllib.parse, urllib.request
G = "https://graph.facebook.com/v25.0"
def get(path, **q):
    with urllib.request.urlopen(f"{G}/{path}?{urllib.parse.urlencode(q)}", timeout=30) as r: return json.loads(r.read())
if len(sys.argv) != 5: sys.exit(__doc__)
app_id, secret, short, page = sys.argv[1:]
long_user = get("oauth/access_token", grant_type="fb_exchange_token", client_id=app_id, client_secret=secret, fb_exchange_token=short)["access_token"]
pg = get(page, fields="name,access_token", access_token=long_user)
info = get("debug_token", input_token=pg["access_token"], access_token=f"{app_id}|{secret}")["data"]
exp = info.get("expires_at", 0)
print(f"Page: {pg['name']}\nExpires: {'never' if not exp else exp}\nScopes: {', '.join(info.get('scopes', []))}\n")
print("FB_PAGE_ID    =", page)
print("FB_PAGE_TOKEN =", pg["access_token"])
