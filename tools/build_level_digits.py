"""
레벨 숫자 그림 자르기: game_assets/level_numbers.png (1~0 두 줄, 투명 배경) → game_assets/derived/level_digits/0.png ~ 9.png

    python tools/build_level_digits.py

홈 화면 레벨 표시(level_frame.png 방패 안)에서 숫자를 이 그림들로 이어 붙인다 (js/assets.js TP.levelDigitsHtml).
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game_assets', 'level_numbers.png')
OUT = os.path.join(ROOT, 'game_assets', 'derived', 'level_digits')
ORDER = '1234567890'   # 그림 속 순서: 윗줄 1~5, 아랫줄 6~0


def spans(has, n, min_len):
    out, start = [], None
    for i in range(n):
        if has(i) and start is None:
            start = i
        elif not has(i) and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, n))
    return [s for s in out if s[1] - s[0] > min_len]


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(SRC).convert('RGBA')
    w, h = im.size
    a = im.split()[-1]
    k = 0
    for y0, y1 in spans(lambda y: any(a.getpixel((x, y)) > 30 for x in range(0, w, 3)), h, 20):
        band = a.crop((0, y0, w, y1))
        for x0, x1 in spans(lambda x: any(band.getpixel((x, y)) > 30 for y in range(0, y1 - y0, 2)), w, 15):
            d = im.crop((x0, y0, x1, y1))
            d.crop(d.getbbox()).save(os.path.join(OUT, f'{ORDER[k]}.png'))
            k += 1
    print(f'레벨 숫자 {k}개 → {OUT}')


if __name__ == '__main__':
    main()
