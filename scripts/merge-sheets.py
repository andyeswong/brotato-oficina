#!/usr/bin/env python3
"""Junta dos hojas (PNG + JSON hash con frameTags, de pxl o de Aseprite) en una: la segunda va debajo.

El motor carga UNA hoja por módulo, y los temas del generador traen dos (suelo y muros).
Los nombres de frame y de tag tienen que ser distintos entre las dos hojas.

Uso: python3 scripts/merge-sheets.py <a.png> <b.png> <salida.png>   (los .json van al lado de cada .png)
"""
import json
import sys
from pathlib import Path

from PIL import Image


def load(png: Path):
    return Image.open(png).convert('RGBA'), json.loads(png.with_suffix('.json').read_text())


def main() -> None:
    a_png, b_png, out_png = (Path(p) for p in sys.argv[1:4])
    (a, ja), (b, jb) = load(a_png), load(b_png)
    clash = set(ja['frames']) & set(jb['frames'])
    tags_a = {t['name'] for t in ja['meta']['frameTags']}
    clash |= tags_a & {t['name'] for t in jb['meta']['frameTags']}
    if clash:
        sys.exit(f'nombres repetidos entre las dos hojas: {sorted(clash)}')

    sheet = Image.new('RGBA', (max(a.width, b.width), a.height + b.height))
    sheet.paste(a, (0, 0))
    sheet.paste(b, (0, a.height))

    frames = dict(ja['frames'])
    for name, f in jb['frames'].items():
        f = json.loads(json.dumps(f))
        f['frame']['y'] += a.height
        frames[name] = f
    offset = len(ja['frames'])
    tags = list(ja['meta']['frameTags']) + [
        {**t, 'from': t['from'] + offset, 'to': t['to'] + offset} for t in jb['meta']['frameTags']
    ]
    meta = {**ja['meta'], 'image': out_png.name, 'size': {'w': sheet.width, 'h': sheet.height}, 'frameTags': tags}

    sheet.save(out_png)
    out_png.with_suffix('.json').write_text(json.dumps({'frames': frames, 'meta': meta}, indent=1, ensure_ascii=False) + '\n')
    print(f'{out_png}: {sheet.width}x{sheet.height}, {len(frames)} frames, {len(tags)} tags')


if __name__ == '__main__':
    main()
