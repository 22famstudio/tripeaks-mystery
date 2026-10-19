"""
카드 뒷면 스킨 (game_assets/card_back_2.png ~ card_back_19.png, 18종) → 게임 카드 규격에 맞춘 파생본

    python tools/build_card_backs.py

  원본 18종은 크기·비율이 제각각(113×156 ~ 153×187)이라, 앞면 카드(card_2.png 등 180×260 캔버스 안 166×260)와
  같은 자리에 꼭 맞도록 166×260 으로 맞춘 뒤 180×260 투명 캔버스 가운데에 놓는다.
  결과: game_assets/derived/card_backs/card_back_N.png  (기본 뒷면 card_back.png 는 그대로 사용)
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game_assets')
OUT = os.path.join(ROOT, 'game_assets', 'derived', 'card_backs')
CANVAS = (180, 260)
CARD = (166, 260)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(OUT, exist_ok=True)
    made = 0
    for n in range(2, 20):
        src = os.path.join(SRC, f'card_back_{n}.png')
        if not os.path.exists(src):
            print('없음:', src)
            continue
        im = Image.open(src).convert('RGBA')
        im = im.crop(im.getbbox()).resize(CARD, Image.LANCZOS)
        canvas = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        canvas.alpha_composite(im, ((CANVAS[0] - CARD[0]) // 2, 0))
        canvas.save(os.path.join(OUT, f'card_back_{n}.png'), optimize=True)
        made += 1
    print(f'카드 뒷면 {made}종 → {OUT}')


if __name__ == '__main__':
    main()
