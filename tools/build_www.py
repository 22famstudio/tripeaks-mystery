"""
안드로이드 앱(Capacitor)용 웹 파일 묶기 → mobile/www/

    python tools/build_www.py

  - tripeaks.html → www/index.html (앱은 index.html 로 시작)
  - js/ · css/ · game_assets/ 복사. 게임이 읽지 않는 큰 폴더는 뺀다:
      game_assets/characters_background (생성 원본 2.9GB — 웹용 변환본은 game_assets/episodes)
      game_assets/_replaced (교체 전 원본) · game_assets/sheets (시트 원본)
      game_assets/background (에피소드 배경 원본 295MB — 게임은 압축본 game_assets/episodes/ep_bg 사용)
  - canvas-confetti 를 CDN 대신 앱 안에 넣는다 (오프라인에서도 동작)
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'mobile', 'www')
# 하위 경로 단위로 빼는 것: episodes/bg = 예전 도시별 공용 배경 (300화 모두 전용 배경 episodes/ep_bg 를 써서 미사용)
SKIP_ASSET_PATHS = {'episodes/bg', 'episodes/suspect', 'sounds/bgm'}   # 안 쓰는 예전 공용 배경·초상화 풀 / BGM 원본 WAV (게임은 sounds/bgm_mp3)
SKIP_ASSET_DIRS = {'characters_background', '_replaced', 'sheets', 'background', 'characters'}   # characters = 용의자 초상화 원본 777MB (압축본은 episodes/portraits)   # background = 에피소드 배경 원본 (압축본은 episodes/ep_bg)
CONFETTI_CDN = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
CONFETTI_LOCAL = os.path.join(ROOT, 'mobile', 'node_modules', 'canvas-confetti', 'dist', 'confetti.browser.js')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    for d in ('js', 'css'):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))
    def ignore(src, names):
        rel = os.path.relpath(src, os.path.join(ROOT, 'game_assets')).replace(os.sep, '/')
        return [n for n in names if (rel == '.' and n in SKIP_ASSET_DIRS) or f'{rel}/{n}' in SKIP_ASSET_PATHS]
    shutil.copytree(os.path.join(ROOT, 'game_assets'), os.path.join(OUT, 'game_assets'), ignore=ignore)

    html = open(os.path.join(ROOT, 'tripeaks.html'), encoding='utf-8').read()
    if os.path.exists(CONFETTI_LOCAL):
        os.makedirs(os.path.join(OUT, 'vendor'), exist_ok=True)
        shutil.copy(CONFETTI_LOCAL, os.path.join(OUT, 'vendor', 'confetti.browser.js'))
        assert CONFETTI_CDN in html, 'tripeaks.html 의 canvas-confetti 주소가 바뀌었습니다'
        html = html.replace(CONFETTI_CDN, 'vendor/confetti.browser.js')
    else:
        print('경고: canvas-confetti 로컬 파일이 없어 CDN을 그대로 씀 (mobile 폴더에서 npm install 먼저)')
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8', newline='\n').write(html)

    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    count = sum(len(fs) for _, _, fs in os.walk(OUT))
    print(f'mobile/www: 파일 {count}개 · {total / 1e6:.1f}MB')


if __name__ == '__main__':
    main()
