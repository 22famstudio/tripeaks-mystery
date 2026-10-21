"""
배경음악 원본 → 게임용 OGG(안드로이드) + MP3(iOS) (ffmpeg 필요)

    python tools/build_bgm.py home          # home_bgm_* 만 (홈 · 게임 화면 배경음악)
    python tools/build_bgm.py shop          # shop_bgm_* 만 (상점)
    python tools/build_bgm.py               # 전부

  원본: ../assets_original_backup/game_assets/sounds/bgm/<이름>.wav|.mp3   (곡당 수~수십 MB — 읽기만 함, 앱에 넣지 않음)
  결과: game_assets/sounds/bgm_mp3/<이름>.ogg                               (Vorbis 48kHz 스테레오 112kbps — 앱에 들어감)
        ../assets_original_backup/game_assets/sounds/bgm_mp3/<이름>.mp3      (iOS 빌드용 — tools/build_www.py --platform ios)
  홈 곡은 크기를 맞춘다 (loudnorm −16 LUFS, 최대 −1.5 dBTP): 원본마다 소리 크기가 달라 어떤 곡만 갑자기 크게 들리지 않게.
  재생 목록은 js/settings.js TP.AUDIO_FILES.homeBgm · shopBgm (파일 이름 번호 그대로)
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP = os.path.join(os.path.dirname(ROOT), 'assets_original_backup', 'game_assets', 'sounds')
SRC = os.path.join(BACKUP, 'bgm')
OUT_OGG = os.path.join(ROOT, 'game_assets', 'sounds', 'bgm_mp3')
OUT_MP3 = os.path.join(BACKUP, 'bgm_mp3')
LOUDNORM = {'home': 'loudnorm=I=-16:TP=-1.5:LRA=11'}   # 곡 묶음별 크기 맞추기 (상점 곡은 예전 그대로)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        sys.exit('ffmpeg 가 필요합니다')
    os.makedirs(OUT_OGG, exist_ok=True)
    os.makedirs(OUT_MP3, exist_ok=True)
    for f in sorted(os.listdir(SRC), key=lambda n: (n.split('_bgm_')[0], int(''.join(c for c in n.split('_bgm_')[-1] if c.isdigit()) or 0))):
        name, ext = os.path.splitext(f)
        if ext.lower() not in ('.wav', '.flac', '.aiff', '.mp3', '.ogg') or not name.startswith(only):
            continue
        group = name.split('_bgm_')[0]
        af = ['-af', LOUDNORM[group]] if group in LOUDNORM else []
        src = os.path.join(SRC, f)
        ogg = os.path.join(OUT_OGG, name + '.ogg')
        mp3 = os.path.join(OUT_MP3, name + '.mp3')
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', src, *af, '-ar', '48000', '-ac', '2',
                        '-codec:a', 'libvorbis', '-b:a', '112k', ogg], check=True)
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', src, *af, '-ar', '44100', '-ac', '2',
                        '-codec:a', 'libmp3lame', '-b:a', '112k', mp3], check=True)
        print(f'{f} → {name}.ogg ({os.path.getsize(ogg) / 1e6:.1f}MB) · iOS {name}.mp3 ({os.path.getsize(mp3) / 1e6:.1f}MB)')


if __name__ == '__main__':
    main()
