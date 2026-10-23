"""
안드로이드 앱(Capacitor)용 웹 파일 묶기 → mobile/www/

    python tools/build_www.py

  - tripeaks.html → www/index.html (앱은 index.html 로 시작)
  - js/ · css/ · game_assets/ 복사. 게임이 읽지 않는 큰 폴더는 뺀다:
      game_assets/characters_background (생성 원본 2.9GB — 웹용 변환본은 game_assets/episodes)
      game_assets/_replaced (교체 전 원본) · game_assets/sheets (시트 원본)
      game_assets/background (에피소드 배경 원본 295MB — 게임은 압축본 game_assets/episodes/ep_bg 사용)

  옵션 (환경 변수로도 줄 수 있음 — npm run sync 가 그대로 넘겨받는다)
    --cdn <version.json 주소>   (TP_CDN_URL)  에피소드 그림(약 98MB)과 사운드(sounds/sfx · bgm_mp3)를 APK 에서 빼고
                                첫 실행 때 받게 한다: www/js/cdn-config.js 를 켜고 vendor/fflate.js 를 넣는다.
                                묶음 · version.json 은 tools/build_cdn_pack.py 로 만들어 버킷에 올린다
                                (사운드는 기기별 묶음: 안드로이드 OGG / iOS MP3).
    --cdn-no-audio              (TP_CDN_NO_AUDIO=1)  사운드는 APK 에 그대로 두고 그림만 CDN 으로
                                (build_cdn_pack.py --no-audio 로 묶었을 때)
    --platform ios              (TP_PLATFORM)  OGG 대신 백업(../assets_original_backup)의 MP3 를 같은 경로에 넣는다
                                (iOS WebKit 은 OGG Vorbis 재생이 불완전 — js/audio-helper.js 가 .mp3 를 고른다)

  Firebase 로그인 플러그인(@capacitor-firebase/authentication)은 mobile/android/app/google-services.json 이 있을 때만
  안드로이드 빌드에 넣는다 (mobile/capacitor.config.json 의 android.includePlugins 를 여기서 맞춤).
  파일 없이 넣으면 앱이 켜질 때 Firebase 초기화 오류로 꺼진다. 빠진 빌드에서는 js/account.js 가 기기 ID 로 대신 식별한다.
"""
import argparse
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'mobile', 'www')
# 하위 경로 단위로 빼는 것: episodes/bg = 예전 도시별 공용 배경 (300화 모두 전용 배경 episodes/ep_bg 를 써서 미사용)
SKIP_ASSET_PATHS = {'episodes/bg', 'episodes/suspect', 'sounds/bgm'}   # 안 쓰는 예전 공용 배경·초상화 풀 / BGM 원본 WAV (게임은 sounds/bgm_mp3)
SKIP_ASSET_DIRS = {'characters_background', '_replaced', 'sheets', 'background', 'characters'}   # characters = 용의자 초상화 원본 777MB (압축본은 episodes/portraits)   # background = 에피소드 배경 원본 (압축본은 episodes/ep_bg)
FFLATE_LOCAL = os.path.join(ROOT, 'mobile', 'node_modules', 'fflate', 'umd', 'index.js')
CDN_IMAGE_PATHS = {'episodes/ep_bg', 'episodes/portraits', 'episodes/ep_thumb', 'episodes/clue'}   # tools/build_cdn_pack.py 의 IMAGE_DIRS
CDN_AUDIO_PATHS = {'sounds/sfx', 'sounds/bgm_mp3'}                                                  # tools/build_cdn_pack.py 의 AUDIO_DIRS
BACKUP = os.path.join(os.path.dirname(ROOT), 'assets_original_backup')
CAP_CONFIG = os.path.join(ROOT, 'mobile', 'capacitor.config.json')
GOOGLE_SERVICES = os.path.join(ROOT, 'mobile', 'android', 'app', 'google-services.json')
BASE_PLUGINS = ['@capacitor/filesystem', '@capacitor/app', '@revenuecat/purchases-capacitor', '@capacitor-community/admob']  # 늘 넣는 네이티브 플러그인 (세이브 파일 · 백그라운드 감지 · 결제 · 광고)
FIREBASE_PLUGINS = ['@capacitor-firebase/authentication']  # google-services.json 이 있을 때만


def sync_plugin_allowlist():
    """capacitor.config.json 의 android.includePlugins 를 google-services.json 유무에 맞춘다"""
    cfg = json.load(open(CAP_CONFIG, encoding='utf-8'))
    has_firebase = os.path.exists(GOOGLE_SERVICES)
    want = BASE_PLUGINS + (FIREBASE_PLUGINS if has_firebase else [])
    if cfg.setdefault('android', {}).get('includePlugins') != want:
        cfg['android']['includePlugins'] = want
        with open(CAP_CONFIG, 'w', encoding='utf-8', newline='\n') as fp:
            json.dump(cfg, fp, ensure_ascii=False, indent=2)
    print('Firebase 로그인: ' + ('켜짐 (google-services.json 있음)' if has_firebase
                                 else '꺼짐 — mobile/android/app/google-services.json 을 넣으면 켜짐'))
    billing = open(os.path.join(ROOT, 'js', 'billing-config.js'), encoding='utf-8').read()
    has_key = re.search(r"revenuecatGoogleApiKey:\s*'goog_\w+'", billing)
    print('결제(RevenueCat): ' + ('켜짐 (Public SDK key 있음)' if has_key
                                 else '꺼짐 — js/billing-config.js 에 키를 넣기 전에는 휴대폰에서 결제가 막힘 (docs/REVENUECAT_GUIDE.md)'))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--cdn', default=os.environ.get('TP_CDN_URL', ''))
    ap.add_argument('--platform', default=os.environ.get('TP_PLATFORM', 'android'), choices=['android', 'ios'])
    ap.add_argument('--cdn-no-audio', action='store_true', default=os.environ.get('TP_CDN_NO_AUDIO') == '1')
    a = ap.parse_args()
    cdn_paths = CDN_IMAGE_PATHS | (set() if a.cdn_no_audio else CDN_AUDIO_PATHS)
    if a.cdn and not os.path.exists(FFLATE_LOCAL):
        sys.exit('--cdn 에는 fflate 가 필요합니다:  cd mobile && npm install fflate')
    skip_paths = SKIP_ASSET_PATHS | (cdn_paths if a.cdn else set())
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    for d in ('js', 'css'):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))
    def ignore(src, names):
        rel = os.path.relpath(src, os.path.join(ROOT, 'game_assets')).replace(os.sep, '/')
        # .wav 는 어디에 있든 앱에 넣지 않는다 (게임은 OGG · MP3 만 씀 — 작업 중인 원본 WAV 가 APK 를 수백 MB 키우지 않게)
        return [n for n in names if (rel == '.' and n in SKIP_ASSET_DIRS) or f'{rel}/{n}' in skip_paths or n.lower().endswith('.wav')]
    shutil.copytree(os.path.join(ROOT, 'game_assets'), os.path.join(OUT, 'game_assets'), ignore=ignore)

    html = open(os.path.join(ROOT, 'tripeaks.html'), encoding='utf-8').read()
    # 꽃가루는 js/ui-kit.js 가 직접 그린다 (canvas-confetti 는 일부 WebView 에서 화면을 하얗게 덮어 뺐다)
    if a.cdn:                                     # CDN 에셋 켜기: fflate 를 넣고 설정을 켠다
        os.makedirs(os.path.join(OUT, 'vendor'), exist_ok=True)
        shutil.copy(FFLATE_LOCAL, os.path.join(OUT, 'vendor', 'fflate.js'))
        assert '<!-- CDN_VENDOR -->' in html, 'tripeaks.html 에 <!-- CDN_VENDOR --> 자리가 없습니다'
        html = html.replace('<!-- CDN_VENDOR -->', '<script src="vendor/fflate.js"></script>')
        with open(os.path.join(OUT, 'js', 'cdn-config.js'), 'w', encoding='utf-8', newline='\n') as fp:
            fp.write(f"(globalThis.TP ??= {{}}).CDN_CONFIG = {{ enabled: true, versionUrl: {a.cdn!r} }};\n")
        print(f'CDN 에셋: 켜짐 ({a.cdn}) — {", ".join(sorted(cdn_paths))} 는 APK 에서 뺌')
    if a.platform == 'ios':                       # OGG → 백업의 MP3 (js/audio-helper.js 가 iOS 에서 .mp3 를 고름)
        n = 0
        for base, _, fs in os.walk(os.path.join(OUT, 'game_assets')):
            for f in fs:
                if not f.endswith('.ogg'):
                    continue
                rel = os.path.relpath(os.path.join(base, f[:-4] + '.mp3'), OUT)
                mp3 = os.path.join(BACKUP, rel)
                if not os.path.exists(mp3):
                    sys.exit(f'iOS 빌드: 백업에 MP3 가 없습니다 → {mp3}')
                shutil.copy(mp3, os.path.join(base, f[:-4] + '.mp3'))
                os.remove(os.path.join(base, f))
                n += 1
        print(f'iOS: OGG {n}개 → 백업의 MP3 로 교체')
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8', newline='\n').write(html)
    sync_plugin_allowlist()

    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    count = sum(len(fs) for _, _, fs in os.walk(OUT))
    print(f'mobile/www: 파일 {count}개 · {total / 1e6:.1f}MB')


if __name__ == '__main__':
    main()
