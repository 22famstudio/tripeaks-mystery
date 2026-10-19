"""
CDN 에셋 묶음 만들기 → dist/cdn/ (Google Cloud Storage 버킷에 그대로 올린다)

    python tools/build_cdn_pack.py                       # 버전 = 오늘 날짜-1 (예: 20261020-1)
    python tools/build_cdn_pack.py --version 20261020-2  # 같은 날 다시 올릴 때
    python tools/build_cdn_pack.py --no-audio            # 그림만 (사운드는 앱에 그대로 둘 때)

묶음 (version.json 의 packs[].platform 으로 구분 — js/asset-manager.js 가 기기에 맞는 것만 받는다)
  all      에피소드 그림  game_assets/episodes/{ep_bg, portraits, ep_thumb, clue}          약 98MB
  android  사운드 OGG     game_assets/sounds/{sfx, bgm_mp3}/*.ogg                          약 10MB
  ios      사운드 MP3     ../assets_original_backup/game_assets/sounds/{sfx, bgm_mp3}/*.mp3 약 13MB
           (iOS WebKit 은 OGG Vorbis 재생이 불완전 — js/audio-helper.js 가 iOS 에서 .mp3 경로를 고른다)

  - zip 안의 경로는 game_assets/ 아래 기준 (예: episodes/ep_bg/ep001.jpg, sounds/sfx/click.mp3)
  - 모두 무압축(STORED): JPG · OGG · MP3 는 이미 압축돼 있어 기기에서 풀 때 CPU 를 거의 안 쓴다
  - 한 묶음 최대 --part-mb (기본 40MB). 받다가 끊겨도 그 묶음만 다시 받는다
  - 파일 이름에 버전이 들어가 캐시가 섞이지 않는다. version.json 만 캐시하지 않게 올리면 된다

결과: dist/cdn/version.json, dist/cdn/game_assets-<버전>-<묶음>-<n>.zip
"""
import argparse
import datetime
import json
import os
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'game_assets')
BACKUP_ASSETS = os.path.join(os.path.dirname(ROOT), 'assets_original_backup', 'game_assets')
OUT = os.path.join(ROOT, 'dist', 'cdn')
IMAGE_DIRS = ['episodes/ep_bg', 'episodes/portraits', 'episodes/ep_thumb', 'episodes/clue']
AUDIO_DIRS = ['sounds/sfx', 'sounds/bgm_mp3']
# 앱에서 빼고 CDN 에서 받는 경로 — tools/build_www.py --cdn 이 같은 목록을 쓴다
CDN_PREFIXES = IMAGE_DIRS + AUDIO_DIRS


def collect(base, dirs, ext=None):
    out = []
    for d in dirs:
        for b, _, fs in os.walk(os.path.join(base, *d.split('/'))):
            out += [os.path.join(b, f) for f in sorted(fs) if ext is None or f.lower().endswith(ext)]
    return [(f, os.path.relpath(f, base).replace(os.sep, '/')) for f in out]


def write_packs(group, platform, items, version, limit):
    packs, z, size = [], None, 0
    for src, arc in items:
        n = os.path.getsize(src)
        if z is None or size + n > limit:
            if z:
                z.close()
            name = f'game_assets-{version}-{group}-{len(packs) + 1}.zip'
            z = zipfile.ZipFile(os.path.join(OUT, name), 'w', zipfile.ZIP_STORED)
            packs.append({'url': name, 'platform': platform, 'files': 0})
            size = 0
        z.write(src, arc)
        packs[-1]['files'] += 1
        size += n
    if z:
        z.close()
    for p in packs:
        p['size'] = os.path.getsize(os.path.join(OUT, p['url']))
    return packs


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default=datetime.date.today().strftime('%Y%m%d') + '-1')
    ap.add_argument('--part-mb', type=int, default=40)
    ap.add_argument('--no-audio', action='store_true', help='사운드 묶음을 만들지 않음 (사운드는 앱에 그대로)')
    a = ap.parse_args()
    limit = a.part_mb * 1024 * 1024

    images = collect(ASSETS, IMAGE_DIRS)
    if not images:
        sys.exit(f'묶을 그림이 없습니다: {ASSETS}/episodes')
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    packs = write_packs('img', 'all', images, a.version, limit)
    prefixes = list(IMAGE_DIRS)
    if not a.no_audio:
        ogg = collect(ASSETS, AUDIO_DIRS, '.ogg')
        mp3 = collect(BACKUP_ASSETS, AUDIO_DIRS, '.mp3')
        # 두 묶음은 같은 소리를 확장자만 달리 담아야 한다 (빠진 파일이 있으면 iOS 에서 그 소리만 안 남)
        stems = lambda xs: {os.path.splitext(arc)[0] for _, arc in xs}
        if not mp3:
            sys.exit(f'iOS 용 MP3 가 없습니다: {BACKUP_ASSETS}/sounds — --no-audio 로 그림만 묶거나 백업을 되돌려 놓으세요')
        if stems(ogg) != stems(mp3):
            missing = sorted(stems(ogg) ^ stems(mp3))
            sys.exit('OGG 와 MP3 목록이 다릅니다: ' + ', '.join(missing[:10]))
        packs += write_packs('snd-android', 'android', ogg, a.version, limit)
        packs += write_packs('snd-ios', 'ios', mp3, a.version, limit)
        prefixes += AUDIO_DIRS

    manifest = {'version': a.version, 'createdAt': datetime.datetime.now().isoformat(timespec='seconds'),
                'prefixes': prefixes, 'packs': packs}
    with open(os.path.join(OUT, 'version.json'), 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=1)
    for plat in ('android', 'ios'):
        mine = [p for p in packs if p['platform'] in ('all', plat)]
        print(f"{plat}: 묶음 {len(mine)}개 · {sum(p['size'] for p in mine) / 1e6:.1f}MB 받음")
    for p in packs:
        print(f"  [{p['platform']:7}] {p['url']}  {p['size'] / 1e6:.1f}MB  ({p['files']}개)")
    print(f'dist/cdn/version.json  (버전 {a.version} · CDN 경로 {", ".join(prefixes)})')


if __name__ == '__main__':
    main()
