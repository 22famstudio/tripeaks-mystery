"""
용의자 초상화 (game_assets/characters/S001-01.jpg … 2114명, 1024×1024) → 게임용 압축본

    python tools/build_character_portraits.py

  원본: game_assets/characters/<용의자 ID>.jpg  (파일명 = 용의자 ID, 에피소드 데이터의 suspects[].id 와 같음 — 읽기만 함)
  결과: game_assets/episodes/portraits/<용의자 ID>.jpg  (256×256, JPG 품질 80, 장당 약 13KB)
  원본 폴더는 앱(APK)에 넣지 않는다 (tools/build_www.py) · 연결은 tools/import_episodes_v6.py (파일이 있으면 그 초상화)
  이미 만든 파일은 원본이 더 새것일 때만 다시 만든다.
"""
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game_assets', 'characters')
OUT = os.path.join(ROOT, 'game_assets', 'episodes', 'portraits')
SIZE = (256, 256)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(OUT, exist_ok=True)
    made = skipped = 0
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            continue
        src = os.path.join(SRC, f)
        dst = os.path.join(OUT, os.path.splitext(f)[0] + '.jpg')
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            skipped += 1
            continue
        ImageOps.fit(Image.open(src).convert('RGB'), SIZE, Image.LANCZOS).save(dst, quality=80, optimize=True)
        made += 1
    total = sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT))
    print(f'초상화 {made}장 생성 · {skipped}장 그대로 → {OUT} ({total / 1e6:.0f}MB)')


if __name__ == '__main__':
    main()
