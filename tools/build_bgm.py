"""
배경음악 원본(WAV) → 게임용 MP3 (ffmpeg 필요)

    python tools/build_bgm.py

  원본: game_assets/sounds/bgm/*.wav  (곡당 20~50MB — 읽기만 함, 앱에는 넣지 않음)
  결과: game_assets/sounds/bgm_mp3/<같은 이름>.mp3  (스테레오 112kbps, 곡당 약 2~4MB)
  재생 목록은 js/settings.js TP.AUDIO_FILES.shopBgm (파일명이 shop 으로 시작하는 곡 = 상점 배경음악)
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game_assets', 'sounds', 'bgm')
OUT = os.path.join(ROOT, 'game_assets', 'sounds', 'bgm_mp3')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        sys.exit('ffmpeg 가 필요합니다')
    os.makedirs(OUT, exist_ok=True)
    names = []
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith(('.wav', '.flac', '.aiff', '.mp3', '.ogg')):
            continue
        dst = os.path.join(OUT, os.path.splitext(f)[0] + '.mp3')
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', os.path.join(SRC, f),
                        '-codec:a', 'libmp3lame', '-b:a', '112k', '-ac', '2', dst], check=True)
        names.append(os.path.basename(dst))
        print(f'{f} → {os.path.basename(dst)} ({os.path.getsize(dst) / 1e6:.1f}MB)')
    print('상점 곡:', [n for n in names if n.lower().startswith('shop')])


if __name__ == '__main__':
    main()
