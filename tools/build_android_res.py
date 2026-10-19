"""
안드로이드 앱 아이콘 · 스플래시 생성 → mobile/android/app/src/main/res/

    python tools/build_android_res.py

  아이콘   : game_assets/mascot_cat.png (탐정 조수 고양이) — 파란 배경 위
             mipmap-*/ic_launcher.png · ic_launcher_round.png (48~192px), ic_launcher_foreground.png (108dp 적응형, 안전 영역 66%)
  스플래시 : game_assets/ui_loading.png (로딩 화면) — 가로 화면용 drawable-land-*/splash.png, drawable/splash.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res')
ICON_SRC = os.path.join(ROOT, 'game_assets', 'mascot_cat.png')
SPLASH_SRC = os.path.join(ROOT, 'game_assets', 'ui_loading.png')
BG = (42, 111, 201, 255)          # 설정 창 · 팝업과 같은 파랑
DENSITY = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def icon(size, round_mask):
    canvas = Image.new('RGBA', (size, size), BG)
    cat = Image.open(ICON_SRC).convert('RGBA')
    cat.thumbnail((int(size * 0.86), int(size * 0.86)), Image.LANCZOS)
    canvas.alpha_composite(cat, ((size - cat.width) // 2, (size - cat.height) // 2 + int(size * 0.03)))
    if round_mask:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        canvas.putalpha(mask)
    return canvas


def foreground(size):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cat = Image.open(ICON_SRC).convert('RGBA')
    safe = int(size * 0.62)        # 적응형 아이콘 안전 영역 (66%) 안쪽
    cat.thumbnail((safe, safe), Image.LANCZOS)
    canvas.alpha_composite(cat, ((size - cat.width) // 2, (size - cat.height) // 2))
    return canvas


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    made = 0
    for name, k in DENSITY.items():
        d = os.path.join(RES, f'mipmap-{name}')
        os.makedirs(d, exist_ok=True)
        icon(round(48 * k), False).save(os.path.join(d, 'ic_launcher.png'))
        icon(round(48 * k), True).save(os.path.join(d, 'ic_launcher_round.png'))
        foreground(round(108 * k)).save(os.path.join(d, 'ic_launcher_foreground.png'))
        made += 3

    splash = Image.open(SPLASH_SRC).convert('RGB')
    for d in os.listdir(RES):
        p = os.path.join(RES, d, 'splash.png')
        if not os.path.exists(p):
            continue
        w, h = Image.open(p).size
        if d.startswith('drawable-port'):
            w, h = max(w, h), min(w, h)   # 앱은 가로 고정이라 세로 폴더도 가로 그림으로
        ImageOps.fit(splash, (w, h), Image.LANCZOS).save(p, optimize=True)
        made += 1

    values = os.path.join(RES, 'values', 'ic_launcher_background.xml')
    open(values, 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#2A6FC9</color>\n</resources>\n')
    print(f'아이콘 · 스플래시 {made}개 생성')


if __name__ == '__main__':
    main()
