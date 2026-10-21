"""
일본어 글꼴 만들기 — M PLUS Rounded 1c (SIL OFL 1.1) 를 필요한 글자만 남겨 game_assets/fonts/ 에 넣는다.

    python tools/build_jp_font.py

  원본: design/fonts-src/MPLUSRounded1c-Bold.ttf · -ExtraBold.ttf (각 약 3.5MB, 라이선스 MPLUSRounded1c-OFL.txt)
  남기는 글자: ASCII · 가나 · 기호 · JIS X 0208 1·2수준 한자 전부(약 6,300자) + js/lang/ja.js 와
              js/data/*.ja.js(에피소드 번역, 3단계)에 실제로 쓰인 모든 글자
  → game_assets/fonts/MPLUSRounded1c-Bold.woff2 · -ExtraBold.woff2
  일본어 번역을 고치거나 에피소드를 더 번역한 뒤 다시 실행한다 (빠진 글자는 시스템 글꼴로 보임).
"""
import glob
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'fonts-src')
OUT = os.path.join(ROOT, 'game_assets', 'fonts')


def jis_chars():
    chars = set()
    for b1 in range(0xA1, 0xFF):                       # EUC-JP 2바이트 = JIS X 0208 전체
        for b2 in range(0xA1, 0xFF):
            try:
                chars.add(bytes([b1, b2]).decode('euc_jp'))
            except UnicodeDecodeError:
                pass
    return chars


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars |= set(chr(c) for c in range(0x3000, 0x30FF + 1))     # CJK 기호 · 히라가나 · 가타카나
    chars |= set(chr(c) for c in range(0xFF01, 0xFF9F + 1))     # 전각 영숫자 · 반각 가타카나
    chars |= set('・…‥―─→←↑↓〜～×÷±°′″℃々〆〇♪★☆○●◎◇◆□■△▲▽▼※〒')
    chars |= jis_chars()
    used = ''
    for f in [os.path.join(ROOT, 'js', 'lang', 'ja.js')] + glob.glob(os.path.join(ROOT, 'js', 'data', '*.ja.js')):
        if os.path.exists(f):
            used += open(f, encoding='utf-8').read()
    chars |= set(used)
    text = ''.join(sorted(chars))
    os.makedirs(OUT, exist_ok=True)
    for weight in ('Bold', 'ExtraBold'):
        src = os.path.join(SRC, f'MPLUSRounded1c-{weight}.ttf')
        font = TTFont(src)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        dst = os.path.join(OUT, f'MPLUSRounded1c-{weight}.woff2')
        font.flavor = 'woff2'
        font.save(dst)
        print(f'{os.path.basename(dst)}: {os.path.getsize(dst) / 1e6:.2f}MB  (글자 {len(text)}개 · 원본 {os.path.getsize(src) / 1e6:.1f}MB)')


if __name__ == '__main__':
    main()
