"""
에피소드별 배경 (game_assets/background/background_epNNN.jpg) → 게임용 압축본

    python tools/build_episode_backgrounds.py

  원본: game_assets/background/background_ep001.jpg ~ background_ep300.jpg  (1376×768, 장당 약 1MB — 읽기만 함)
  결과: game_assets/episodes/ep_bg/ep001.jpg     홈 · 수사 보드 · 고백 장면 배경 (1152×643, JPG 품질 76)
        game_assets/episodes/ep_thumb/ep001.jpg  에피소드 메뉴 카드 썸네일 (320×180)
  원본 폴더는 앱(APK)에 넣지 않는다 (tools/build_www.py SKIP_ASSET_DIRS) → 앱 용량 절약
  배경 연결은 tools/import_episodes_v6.py (이 결과 파일이 있으면 그 에피소드 배경으로 사용)
"""
import os
import re
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game_assets', 'background')
OUT_BG = os.path.join(ROOT, 'game_assets', 'episodes', 'ep_bg')
OUT_TH = os.path.join(ROOT, 'game_assets', 'episodes', 'ep_thumb')
BG_SIZE = (1152, 643)   # 원본 1376×768 과 같은 비율로 축소 (앱 용량 절약, 장당 약 170KB)
NAME = re.compile(r'(\d+)\.(jpe?g|png|webp)$', re.I)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(OUT_BG, exist_ok=True)
    os.makedirs(OUT_TH, exist_ok=True)
    made, before, after = 0, 0, 0
    for f in sorted(os.listdir(SRC)):
        m = NAME.search(f)
        if not m:
            continue
        no = int(m.group(1))
        src = os.path.join(SRC, f)
        im = Image.open(src).convert('RGB')
        bg = os.path.join(OUT_BG, f'ep{no:03d}.jpg')
        ImageOps.fit(im, BG_SIZE, Image.LANCZOS).save(bg, quality=76, optimize=True, progressive=True)
        ImageOps.fit(im, (320, 180), Image.LANCZOS).save(os.path.join(OUT_TH, f'ep{no:03d}.jpg'), quality=78, optimize=True)
        before += os.path.getsize(src)
        after += os.path.getsize(bg) + os.path.getsize(os.path.join(OUT_TH, f'ep{no:03d}.jpg'))
        made += 1
    print(f'에피소드 배경 {made}장: 원본 {before / 1e6:.0f}MB → 게임용 {after / 1e6:.0f}MB (배경 + 썸네일)')


if __name__ == '__main__':
    main()
