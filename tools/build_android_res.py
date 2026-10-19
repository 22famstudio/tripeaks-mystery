"""
안드로이드 앱 아이콘 · 스플래시 생성 → mobile/android/app/src/main/res/

    python tools/build_android_res.py

  아이콘   : design/app-icon/ios/AppIcon.appiconset/icon-1024.png (앱 아이콘 원본, app-icons.zip — 탐정 · 카드 · 고양이 그림)
             mipmap-*/ic_launcher.png        (48~192px, 정사각 그대로 — Android 7.x 런처)
             mipmap-*/ic_launcher_round.png  (원형으로 잘라 냄)
             적응형 아이콘(Android 8.0+, mipmap-anydpi-v26/*.xml) — 대부분의 기기는 이것을 쓴다
               ic_launcher_foreground.png : 108dp 레이어 가운데 84dp 에 그림 (원 · 둥근 사각 마스크에서 그림이 거의 다 보임)
               ic_launcher_background.png : 같은 그림을 108dp 로 크게 · 흐리게 · 살짝 어둡게 (마스크 가장자리 · 기울임 효과용)
             Play 스토어 등록용 512px 은 design/app-icon/android/playstore-icon.png 를 그대로 올린다.
  스플래시 : game_assets/ui_loading.webp (로딩 화면) — 가로 화면용 drawable-land-*/splash.png, drawable/splash.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res')
ICON_SRC = os.path.join(ROOT, 'design', 'app-icon', 'ios', 'AppIcon.appiconset', 'icon-1024.png')
SPLASH_SRC = os.path.join(ROOT, 'game_assets', 'ui_loading.webp')
DENSITY = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
ART_IN_LAYER = 84 / 108            # 적응형 레이어(108dp) 중 그림이 차지하는 비율 (보이는 영역은 가운데 72dp)

ADAPTIVE_XML = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''


def art():
    return Image.open(ICON_SRC).convert('RGBA')


def icon(size, round_mask):
    canvas = art().resize((size, size), Image.LANCZOS)
    if round_mask:
        mask = Image.new('L', (size * 4, size * 4), 0)       # 4배로 그려 줄여서 가장자리를 부드럽게
        ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        canvas.putalpha(mask.resize((size, size), Image.LANCZOS))
    return canvas


def foreground(size):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = round(size * ART_IN_LAYER)
    canvas.alpha_composite(art().resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    return canvas


def background(size):
    bg = art().convert('RGB').resize((size, size), Image.LANCZOS)
    bg = bg.filter(ImageFilter.GaussianBlur(size / 24))
    return ImageEnhance.Brightness(bg).enhance(0.75)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    made = 0
    for name, k in DENSITY.items():
        d = os.path.join(RES, f'mipmap-{name}')
        os.makedirs(d, exist_ok=True)
        icon(round(48 * k), False).save(os.path.join(d, 'ic_launcher.png'), optimize=True)
        icon(round(48 * k), True).save(os.path.join(d, 'ic_launcher_round.png'), optimize=True)
        foreground(round(108 * k)).save(os.path.join(d, 'ic_launcher_foreground.png'), optimize=True)
        background(round(108 * k)).save(os.path.join(d, 'ic_launcher_background.png'), optimize=True)
        made += 4
    anydpi = os.path.join(RES, 'mipmap-anydpi-v26')
    os.makedirs(anydpi, exist_ok=True)
    for f in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        open(os.path.join(anydpi, f), 'w', encoding='utf-8', newline='\n').write(ADAPTIVE_XML)

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
    print(f'아이콘 · 스플래시 {made}개 생성 (아이콘 원본 {os.path.relpath(ICON_SRC, ROOT)})')


if __name__ == '__main__':
    main()
