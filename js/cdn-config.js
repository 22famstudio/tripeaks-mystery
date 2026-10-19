// CDN 에셋 다운로드 설정 (js/asset-manager.js). 기본은 꺼짐 — 앱에 들어 있는 에피소드 그림을 그대로 쓴다.
//   tools/build_www.py --cdn <version.json 주소> 로 빌드하면 mobile/www 안의 이 파일이 enabled: true 로 바뀐다.
(globalThis.TP ??= {}).CDN_CONFIG = { enabled: false, versionUrl: '' };
