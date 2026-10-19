"""
characters_background 의 생성 이미지 풀 → 웹용 에셋 (game_assets/episodes/)

    python tools/build_episode_art.py

  원본: game_assets/characters_background/_gen_cache/proc  (워터마크 정리·크기 맞춤이 끝난 PNG)
  결과: game_assets/episodes/bg/bgNN.jpg          1600×900  (원본 1920×1080 PNG 3~4MB → JPG 약 0.3MB)
        game_assets/episodes/clue/clueNN.jpg      320×320
        game_assets/episodes/suspect/<대륙>_NN.jpg  256×256
  파일명에 진범 여부가 들어가지 않는다 (원본 Ep.N 폴더는 '용의자_01_진범_…' 이라 경로만 봐도 정답이 보임).
  원본 폴더는 읽기만 한다.
"""
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game_assets', 'characters_background', '_gen_cache', 'proc')
OUT = os.path.join(ROOT, 'game_assets', 'episodes')
SPECS = [
    ('bg', lambda n: n.startswith('bg'), (1600, 900), 82),
    ('clue', lambda n: n.startswith('clue'), (320, 320), 86),
    ('suspect', lambda n: n.startswith('s_'), (256, 256), 86),
]


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if not os.path.isdir(SRC):
        sys.exit(f'원본 폴더가 없습니다: {SRC}')
    total = 0
    for sub, match, size, q in SPECS:
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
        names = sorted(f for f in os.listdir(SRC) if f.endswith('.png') and match(f))
        for f in names:
            key = f[:-4]
            if sub == 'suspect':
                key = key[2:]                      # s_asia_08 → asia_08
            im = ImageOps.fit(Image.open(os.path.join(SRC, f)).convert('RGB'), size, Image.LANCZOS)
            dst = os.path.join(OUT, sub, key + '.jpg')
            im.save(dst, quality=q, optimize=True, progressive=True)
            total += os.path.getsize(dst)
        print(f'{sub:8} {len(names):3}개')
    print(f'합계 {total / 1e6:.1f}MB → {OUT}')


if __name__ == '__main__':
    main()
