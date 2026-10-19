"""
에셋 다이어트: game_assets/ 의 이미지 · 사운드를 가볍게 바꾸고, 원본은 프로젝트 바깥으로 옮긴다.

    python tools/optimize_assets.py                 # 미리보기(dry run) — 아무것도 바꾸지 않고 할 일 · 예상만 출력
    python tools/optimize_assets.py --apply         # 실제 실행
    python tools/optimize_assets.py --apply --include-jpg   # JPG 도 (WebP 가 10% 이상 작아질 때만) 변환

하는 일
  1) 앱에 들어가지 않는 원본 폴더(UNSHIPPED — 캐릭터 · 배경 생성 원본, WAV BGM 등 약 1.2GB)를
     통째로 백업 폴더로 옮긴다. APK 크기와는 무관하지만 Git 저장소를 가볍게 만든다.
  2) PNG → WebP (투명도 유지, 품질 82, 긴 변 최대 2048px). 큰 일러스트 PNG 는 보통 80~90% 줄어든다.
  3) JPG 는 기본으로 그대로 둔다 — 이미 손실 압축이라 WebP 품질 80~85 로 바꾸면 오히려 커진다
     (측정: 에피소드 배경 20장 4.18MB → 4.50MB). --include-jpg 를 주면 10% 이상 작아지는 파일만 바꾼다.
  4) MP3 · WAV → OGG Vorbis (ffmpeg, 품질 3 ≈ 112kbps). 안드로이드 WebView 는 OGG 를 재생한다.
     ※ iOS(Safari · WKWebView) 는 OGG Vorbis 지원이 불완전 — iOS 버전을 낼 때는 MP3/AAC 를 다시 써야 한다.
  5) 바뀐 원본은 지우지 않고 BACKUP 폴더(기본 ../assets_original_backup/)로 같은 상대 경로 그대로 옮긴다.
  6) 코드(js · css · html · tests)의 확장자 참조를 바꾼다. 고치기 전 코드 파일도 BACKUP/_code/ 에 복사해 둔다.
       .png → .webp , .mp3/.wav → .ogg : 앱에 들어가는 PNG · MP3 는 전부 바뀌므로 확장자째 일괄 치환
                                         (`${DIR}pack_coin_${n}.png` 같은 템플릿 경로도 함께 맞춰진다)
       .jpg → .webp                    : 실제로 바뀐 파일의 경로만 정확히 치환
  7) 코드에 적힌 'game_assets/…' 경로가 모두 실제 파일을 가리키는지 검사하고, 코드 어디에도 이름이
     안 나오는 에셋(미사용 후보)을 목록으로 보여 준다. 미사용 후보는 자동으로 지우지 않는다
     (avatar_${n} 처럼 이름을 조합해 쓰는 파일이 섞여 있어 사람이 확인해야 한다).

필요한 것: Pillow (pip install Pillow) · ffmpeg 실행 파일 (winget install Gyan.FFmpeg)
되돌리기: BACKUP/manifest.json 에 옮긴 파일 목록, BACKUP/_code/ 에 고치기 전 코드가 있다.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = 'game_assets'
# 앱(APK)에 들어가지 않는 원본 폴더 — tools/build_www.py 의 SKIP 목록과 같다
UNSHIPPED = ['characters_background', 'characters', 'background', 'sheets', '_replaced',
             'episodes/bg', 'episodes/suspect', 'sounds/bgm']
IMAGE_EXT = {'.png', '.jpg', '.jpeg'}
AUDIO_EXT = {'.mp3', '.wav'}
CODE_GLOBS = [('js', '.js'), ('css', '.css'), ('tests', '.js')]
CODE_FILES = ['tripeaks.html', 'index.html']


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, '/')


def human(n):
    return f'{n / 1e6:.1f}MB'


def code_files():
    out = [os.path.join(ROOT, f) for f in CODE_FILES if os.path.exists(os.path.join(ROOT, f))]
    for d, ext in CODE_GLOBS:
        for base, _, files in os.walk(os.path.join(ROOT, d)):
            out += [os.path.join(base, f) for f in files if f.endswith(ext)]
    return out


def is_unshipped(r):
    sub = r[len(ASSETS) + 1:]
    return any(sub == u or sub.startswith(u + '/') for u in UNSHIPPED)


def move_to_backup(src, backup, manifest, dry):
    dst = os.path.join(backup, rel(src))
    manifest.append({'from': rel(src), 'to': os.path.relpath(dst, ROOT).replace(os.sep, '/')})
    if not dry:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.move(src, dst)


def convert_image(src, dst, quality, max_side, dry):
    """PNG/JPG → WebP. 투명도(RGBA · 팔레트 투명색)는 유지. 반환: 새 파일 크기 (dry 면 None)"""
    from PIL import Image
    with Image.open(src) as im:
        has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
        im = im.convert('RGBA' if has_alpha else 'RGB')
        if max_side and max(im.size) > max_side:
            k = max_side / max(im.size)
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        if dry:
            return None
        im.save(dst, 'WEBP', quality=quality, method=6, exact=False)
    return os.path.getsize(dst)


PROBE = os.path.join(tempfile.gettempdir(), '_optimize_probe.webp')


def webp_size_probe(src, quality, max_side):
    """실제로 한 번 변환해 크기만 재고 버린다 (미리보기 · JPG 판단용)"""
    return convert_image(src, PROBE, quality, max_side, dry=False)


def convert_audio(src, dst, q, dry):
    if dry:
        return None
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-c:a', 'libvorbis', '-q:a', str(q), dst], check=True)
    return os.path.getsize(dst)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--apply', action='store_true', help='실제로 변환 · 이동 · 코드 치환 (없으면 미리보기만)')
    ap.add_argument('--backup', default=os.path.join(os.path.dirname(ROOT), 'assets_original_backup'))
    ap.add_argument('--quality', type=int, default=82, help='WebP 품질 (80~85 권장)')
    ap.add_argument('--max-side', type=int, default=2048, help='이미지 긴 변 최대 px (0 = 줄이지 않음)')
    ap.add_argument('--audio-q', type=int, default=3, help='OGG Vorbis 품질 (0~10, 3 ≈ 112kbps)')
    ap.add_argument('--include-jpg', action='store_true', help='JPG 도 WebP 로 (min-saving 이상 작아질 때만)')
    ap.add_argument('--jpg-quality', type=int, default=75)
    ap.add_argument('--min-saving', type=float, default=0.10)
    ap.add_argument('--keep-unshipped', action='store_true', help='앱에 안 들어가는 원본 폴더를 옮기지 않음')
    a = ap.parse_args()
    dry = not a.apply
    sys.stdout.reconfigure(encoding='utf-8')

    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit('Pillow 가 없습니다:  python -m pip install Pillow')
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg 가 PATH 에 없습니다:  winget install Gyan.FFmpeg  (설치 후 터미널을 다시 여세요)')
    backup = os.path.abspath(a.backup)
    if backup == ROOT or backup.startswith(ROOT + os.sep):
        sys.exit('백업 폴더는 프로젝트 바깥이어야 합니다 (Git · 앱 빌드에 섞이지 않게)')
    print(f"{'[미리보기] ' if dry else ''}프로젝트 {ROOT}\n백업 폴더 {backup}\n")

    manifest, converted = [], {}          # converted: 'game_assets/a.png' → 'game_assets/a.webp'
    stats = {'unshipped': 0, 'img_before': 0, 'img_after': 0, 'aud_before': 0, 'aud_after': 0, 'jpg_kept': 0}
    asset_root = os.path.join(ROOT, ASSETS)

    # 1) 앱에 안 들어가는 원본 폴더 통째로 옮기기
    if not a.keep_unshipped:
        for u in UNSHIPPED:
            p = os.path.join(asset_root, *u.split('/'))
            if os.path.isdir(p):
                size = sum(os.path.getsize(os.path.join(b, f)) for b, _, fs in os.walk(p) for f in fs)
                stats['unshipped'] += size
                print(f'  원본 폴더 이동 {rel(p)}/  ({human(size)})')
                move_to_backup(p, backup, manifest, dry)

    # 2~4) 앱에 들어가는 파일 변환
    files = []
    for b, dirs, fs in os.walk(asset_root):
        dirs[:] = [d for d in dirs if not is_unshipped(rel(os.path.join(b, d)))]
        files += [os.path.join(b, f) for f in fs]
    t0 = time.time()
    for i, src in enumerate(sorted(files)):
        r = rel(src)
        stem, ext = os.path.splitext(src)
        ext = ext.lower()
        size = os.path.getsize(src)
        if ext in IMAGE_EXT:
            dst = stem + '.webp'
            if os.path.exists(dst):
                print(f'  ! 건너뜀 (같은 이름 .webp 가 이미 있음): {r}')
                continue
            if ext in ('.jpg', '.jpeg'):
                if not a.include_jpg:
                    stats['jpg_kept'] += 1
                    continue
                new = webp_size_probe(src, a.jpg_quality, a.max_side)
                if new > size * (1 - a.min_saving):
                    stats['jpg_kept'] += 1
                    continue
                if not dry:
                    convert_image(src, dst, a.jpg_quality, a.max_side, dry=False)
            else:
                new = webp_size_probe(src, a.quality, a.max_side) if dry else convert_image(src, dst, a.quality, a.max_side, dry=False)
            stats['img_before'] += size
            stats['img_after'] += new
            converted[r] = rel(dst)
            move_to_backup(src, backup, manifest, dry)
        elif ext in AUDIO_EXT:
            dst = stem + '.ogg'
            new = convert_audio(src, dst, a.audio_q, dry)
            if dry:
                new = size * 0.83                        # 측정치: 34개 MP3 12.8MB → OGG q3 10.7MB
            stats['aud_before'] += size
            stats['aud_after'] += new
            converted[r] = rel(dst)
            move_to_backup(src, backup, manifest, dry)
        if (i + 1) % 300 == 0:
            print(f'  … {i + 1}/{len(files)} 파일 ({time.time() - t0:.0f}초)')
    if os.path.exists(PROBE):
        os.remove(PROBE)

    # 6) 코드 치환
    jpg_map = {k: v for k, v in converted.items() if k.lower().endswith(('.jpg', '.jpeg'))}
    png_done = any(k.lower().endswith('.png') for k in converted)
    aud_done = any(k.lower().endswith(('.mp3', '.wav')) for k in converted)
    ext_re = re.compile(r'\.png\b', re.I)
    aud_re = re.compile(r'\.(mp3|wav)\b', re.I)
    changed_files = 0
    new_texts = {}
    for f in code_files():
        s0 = open(f, encoding='utf-8').read()
        n = s0
        if png_done:
            n = ext_re.sub('.webp', n)
        if aud_done:
            n = aud_re.sub('.ogg', n)
        for old, new in jpg_map.items():
            n = n.replace(old, new)
        new_texts[f] = n
        if n != s0:
            changed_files += 1
            if not dry:
                keep = os.path.join(backup, '_code', rel(f))
                os.makedirs(os.path.dirname(keep), exist_ok=True)
                shutil.copy2(f, keep)
                open(f, 'w', encoding='utf-8', newline='').write(n)

    # 7) 검사 (치환 뒤 코드 기준): 'game_assets/…' 경로가 실제로 있는지 · 미사용 후보
    after = set(converted.values())
    gone = set(converted)
    exists = lambda p: p in after or (p not in gone and os.path.exists(os.path.join(ROOT, p)))
    texts = '\n'.join(new_texts.values())
    missing = sorted({m.group(0) for m in re.finditer(r"game_assets/[\w./-]+\.(?:webp|png|jpe?g|ogg|mp3|wav|ttf|woff2?)", texts)
                      if not exists(m.group(0))})
    names = set(re.findall(r'[\w-]+(?=\.(?:webp|png|jpe?g|ogg|mp3|wav)\b)', texts))
    unused = sorted(r for r in (converted.get(rel(f), rel(f)) for f in files)
                    if os.path.splitext(r)[1] in ('.webp', '.png', '.jpg', '.ogg', '.mp3')
                    and os.path.splitext(os.path.basename(r))[0] not in names)

    # 결과
    if not dry:
        with open(os.path.join(backup, 'manifest.json'), 'w', encoding='utf-8') as fp:
            json.dump({'moved': manifest, 'converted': converted}, fp, ensure_ascii=False, indent=1)
    print('\n==== 결과' + (' (미리보기 — 아무것도 바뀌지 않음)' if dry else '') + ' ====')
    print(f"앱 밖 원본 폴더 이동   {human(stats['unshipped'])}  (Git 저장소에서 빠짐)")
    print(f"이미지 → WebP          {human(stats['img_before'])} → {human(stats['img_after'])}  ({len([k for k in converted if not k.endswith(('.mp3', '.wav'))])}개)")
    print(f"JPG 유지               {stats['jpg_kept']}개 (WebP 로 바꿔도 충분히 작아지지 않음)")
    print(f"사운드 → OGG           {human(stats['aud_before'])} → {human(stats['aud_after'])}" + (' (예상치)' if dry else ''))
    print(f"코드 파일 치환         {changed_files}개" + ('' if dry else f"  (고치기 전 사본: {os.path.join(backup, '_code')})"))
    print(f"없는 파일을 가리키는 경로 {len(missing)}개" + (':' if missing else ''))
    for p in missing[:30]:
        print('   -', p)
    print(f"코드에 이름이 안 나오는 에셋(미사용 후보) {len(unused)}개 — 자동 삭제하지 않음, 확인 후 직접 정리:")
    for p in unused[:60]:
        print('   -', p)
    if len(unused) > 60:
        print(f'   … 외 {len(unused) - 60}개')
    if dry:
        print('\n실제로 하려면:  python tools/optimize_assets.py --apply')


if __name__ == '__main__':
    main()
