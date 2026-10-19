"""
CDN 에셋 묶음 만들기 → dist/cdn/ (Google Cloud Storage 버킷에 그대로 올린다)

    python tools/build_cdn_pack.py                       # 버전 = 오늘 날짜-1 (예: 20261020-1)
    python tools/build_cdn_pack.py --version 20261020-2  # 같은 날 다시 올릴 때

  - game_assets/episodes/{ep_bg, portraits, ep_thumb, clue} 를 zip 으로 묶는다 (약 100MB).
    JPG 는 이미 압축돼 있어 무압축(STORED) — 기기에서 풀 때 CPU 를 거의 안 쓴다.
  - 한 묶음 최대 --part-mb (기본 40MB). 받다가 끊겨도 그 묶음만 다시 받는다.
  - zip 안의 경로는 'episodes/' 아래 기준 (예: ep_bg/ep001.jpg) — js/asset-manager.js 가 그대로 풀어 쓴다.
  - 파일 이름에 버전이 들어가 캐시가 섞이지 않는다. version.json 만 캐시하지 않게 올리면 된다.

결과: dist/cdn/version.json, dist/cdn/game_assets-<버전>-<n>.zip
"""
import argparse
import datetime
import json
import os
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game_assets', 'episodes')
DIRS = ['ep_bg', 'portraits', 'ep_thumb', 'clue']           # js/asset-manager.js 의 PREFIX 아래 · build_www.py --cdn 이 APK 에서 빼는 폴더
OUT = os.path.join(ROOT, 'dist', 'cdn')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default=datetime.date.today().strftime('%Y%m%d') + '-1')
    ap.add_argument('--part-mb', type=int, default=40)
    a = ap.parse_args()

    files = []
    for d in DIRS:
        for base, _, fs in os.walk(os.path.join(SRC, d)):
            files += [os.path.join(base, f) for f in sorted(fs)]
    if not files:
        sys.exit(f'묶을 파일이 없습니다: {SRC}')
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    packs, part, size, z = [], 0, 0, None
    limit = a.part_mb * 1024 * 1024
    for f in files:
        n = os.path.getsize(f)
        if z is None or size + n > limit:
            if z:
                z.close()
            part += 1
            name = f'game_assets-{a.version}-{part}.zip'
            z = zipfile.ZipFile(os.path.join(OUT, name), 'w', zipfile.ZIP_STORED)
            packs.append({'url': name, 'files': 0})
            size = 0
        z.write(f, os.path.relpath(f, SRC).replace(os.sep, '/'))
        packs[-1]['files'] += 1
        size += n
    z.close()
    for p in packs:
        p['size'] = os.path.getsize(os.path.join(OUT, p['url']))

    manifest = {'version': a.version, 'createdAt': datetime.datetime.now().isoformat(timespec='seconds'), 'packs': packs}
    with open(os.path.join(OUT, 'version.json'), 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=1)
    total = sum(p['size'] for p in packs)
    print(f'dist/cdn: 버전 {a.version} · 파일 {len(files)}개 · 묶음 {len(packs)}개 · {total / 1e6:.1f}MB')
    for p in packs:
        print(f"  {p['url']}  {p['size'] / 1e6:.1f}MB  ({p['files']}개)")


if __name__ == '__main__':
    main()
