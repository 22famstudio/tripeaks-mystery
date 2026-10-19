// =====================================================================
// 오디오 형식 · 위치 고르기 — 안드로이드는 OGG(Vorbis), iOS(Safari · WKWebView)처럼 OGG 를 못 트는 곳은 MP3
// =====================================================================
//   settings.js 바로 뒤에 읽혀, TP.AUDIO_FILES 의 모든 경로를 한 번에 바꿔 둔다.
//     1) 확장자: ① Capacitor 플랫폼이 'ios' → .mp3   ② 브라우저가 OGG Vorbis 를 못 튼다고 답함 → .mp3   ③ 그 밖 → .ogg
//     2) 위치:   CDN 에셋(js/asset-manager.js)이 켜져 있고 사운드를 받아 두었으면 기기 저장소 주소로.
//                CDN 버킷에는 사운드 묶음이 기기별로 따로 있다 — 안드로이드 = OGG 묶음, iOS = 백업의 MP3 묶음
//                (tools/build_cdn_pack.py). 매니저가 기기에 맞는 묶음만 받으므로, 여기서 고른 확장자의 파일이 늘 있다.
//   CDN 을 쓰지 않는 iOS 빌드는 tools/build_www.py --platform ios 가 백업의 MP3 를 앱 안에 같은 경로로 넣는다.
//   웹 개발 서버를 Safari 로 열면 MP3 가 프로젝트에 없어 소리만 안 난다 (게임은 정상).
//
//   새 사운드도 TP.AUDIO_FILES 에 넣기만 하면 따라온다. 코드에서 경로를 직접 쓸 때는 TP.audioHelper.url(경로) 로 감싼다.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const cap = globalThis.Capacitor;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';     // 'android' | 'ios' | 'web'
  let canOgg = true;
  try { canOgg = !!document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'); } catch { /* 판단 불가 → OGG */ }

  const ext = platform === 'ios' || !canOgg ? 'mp3' : 'ogg';
  const url = path => {
    if (typeof path !== 'string') return path;
    const local = path.replace(/\.(ogg|mp3)$/i, `.${ext}`);
    return TP.AssetManager ? TP.AssetManager.url(local) : local;          // CDN 으로 받아 둔 사운드면 기기 저장소 주소
  };

  // 객체 · 배열 안의 모든 경로를 바꾼다 (TP.AUDIO_FILES = { bgm, shopBgm: [...], sfx: { ... } })
  function remap(v) {
    if (Array.isArray(v)) return v.map(remap);
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = remap(v[k]); return v; }
    return url(v);
  }

  TP.audioHelper = { platform, ext, url, remap };
  if (TP.AUDIO_FILES) remap(TP.AUDIO_FILES);
})();
