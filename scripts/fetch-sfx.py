#!/usr/bin/env python3
# Los sonidos del juego (app/public/sfx): efectos y música CC0 de la búsqueda pública de Freesound. Sale del
# tools/fetch-sfx.py de NARUTO (el corto de VoxPix), con dos cambios que pidió MAIA (2026-10-25):
#   - la licencia se comprueba en la PÁGINA de cada sonido (el campo de la búsqueda fallaba y daba cc0 = false); lo que
#     no diga CC0 allí no se baja
#   - cada sonido queda en credits.json, junto a los sonidos, con su autor y su página
# Se bajan las vistas previas MP3 (~128 kbps): no hay cuenta de Freesound para los originales.
#
#   python3 scripts/fetch-sfx.py              baja todo lo que falte
#   python3 scripts/fetch-sfx.py golpe paso   vuelve a bajar esos (con --skip N toma el resultado N+1)
import html, json, os, re, sys, time, urllib.parse, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "public", "sfx")
UA = {"User-Agent": "Mozilla/5.0"}
# (nombre, búsqueda, duración mínima y máxima en segundos): para qué suena cada uno, en app/src/juego/audio.ts
CUES = [
    ("disparo", "laser shot retro", 0.05, 0.6),       # un arma de MAIA dispara
    ("golpe", "hit impact 8bit", 0.03, 0.5),          # un disparo o un golpe da a un enemigo
    ("muerte", "enemy death 8bit", 0.1, 1.0),         # muere un enemigo
    ("dano", "hurt retro", 0.1, 0.8),           # golpean a MAIA
    ("recoger", "coin pickup 8bit", 0.05, 0.6),       # MAIA recoge material
    ("paso", "footstep stone", 0.05, 0.5),            # un paso de MAIA
    ("limpia", "level up 8bit", 0.3, 3.5),  # la oleada queda limpia (brilla la entrada a la tienda)
    ("tienda", "door bell shop", 0.2, 2.5),           # se entra en la tienda
    ("compra", "cash register", 0.2, 1.5),            # se compra algo
    ("derrota", "game over retro", 0.5, 4.0),          # MAIA cae
    ("victoria", "victory 8bit", 0.8, 6.0),  # la última oleada
    ("musica", "chiptune loop", 20, 400),             # la música de las oleadas
]

def get(url, timeout=40):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()

def search(q):
    url = "https://freesound.org/search/?" + urllib.parse.urlencode({"q": q, "f": 'license:"Creative Commons 0"'})
    page = get(url).decode("utf8", "replace")
    out = []
    for blk in page.split('data-sound-id="')[1:]:
        sid = blk.split('"', 1)[0]
        mp3 = re.search(r'data-mp3="([^"]+)"', blk); dur = re.search(r'data-duration="([0-9.]+)"', blk)
        title = re.search(r'title="([^"]+\.(?:wav|mp3|ogg|flac|aif|aiff|m4a))"', blk, re.I) or re.search(r'data-title="([^"]+)"', blk)
        user = re.search(r'/people/([^/"]+)/', blk)
        if mp3 and dur and user:
            out.append({"id": sid, "mp3": mp3.group(1).replace("-lq.mp3", "-hq.mp3"), "dur": float(dur.group(1)),
                        "title": html.unescape(title.group(1)) if title else "?", "user": user.group(1)})
    return out

# La licencia de verdad: la de la página del sonido
def is_cc0(page_url):
    page = get(page_url).decode("utf8", "replace")
    return "creativecommons.org/publicdomain/zero/1.0" in page

def main():
    args = sys.argv[1:]
    skip = 0
    if "--skip" in args:
        i = args.index("--skip"); skip = int(args[i + 1]); del args[i:i + 2]
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "credits.json")
    credits = {c["name"]: c for c in json.load(open(path))} if os.path.exists(path) else {}
    for name, q, lo, hi in CUES:
        if args and name not in args: continue
        if not args and name in credits and os.path.exists(os.path.join(OUT, f"{name}.mp3")): continue
        try:
            res = [r for r in search(q) if lo <= r["dur"] <= hi]
        except Exception as e:
            print("FALLA", name, e); continue
        picked = None
        for r in res[skip:]:
            page = f"https://freesound.org/people/{r['user']}/sounds/{r['id']}/"
            time.sleep(1)
            if is_cc0(page):
                picked = {**r, "page": page}; break
            print(f"  {name}: {r['title']} de {r['user']} no es CC0 en su página, siguiente")
        if not picked: print("NADA", name); continue
        open(os.path.join(OUT, f"{name}.mp3"), "wb").write(get(picked["mp3"], 60))
        credits[name] = {"name": name, "search": q, "title": picked["title"], "author": picked["user"], "page": picked["page"],
                         "license": "CC0 1.0 (creativecommons.org/publicdomain/zero/1.0), comprobada en la página", "duration": picked["dur"]}
        print(f"{name:9} {picked['dur']:7.2f}s  {picked['title'][:44]:44} de {picked['user']}")
        time.sleep(1)
    json.dump(sorted(credits.values(), key=lambda c: c["name"]), open(path, "w"), ensure_ascii=False, indent=1)

main()
