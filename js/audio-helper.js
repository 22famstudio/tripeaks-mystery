// =====================================================================
// 오디오 형식 고르기 — 안드로이드는 OGG(Vorbis), iOS(Safari · WKWebView)처럼 OGG 를 못 트는 곳은 MP3
// =====================================================================
//   tools/optimize_assets.py 가 사운드를 .ogg 로 바꿨고, 원본 .mp3 는 ../assets_original_backup/ 에 있다.
//   iOS 용 빌드(tools/build_www.py --platform ios)는 백업의 .mp3 를 mobile/www 에 같은 경로로 넣는다.
//   이 파일은 settings.js 바로 뒤에 읽혀, TP.AUDIO_FILES 의 경로를 기기가 재생할 수 있는 확장자로 바꿔 둔다.
//
//   판단 순서: ① Capacitor 플랫폼이 'ios' → MP3   ② 브라우저가 OGG Vorbis 를 못 튼다고 답함 → MP3   ③ 그 밖에는 OGG
//   (② 는 웹으로 연 Safari 대비. 웹 개발 서버에는 MP3 가 없으므로 그때는 소리만 안 난다)
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const cap = globalThis.Capacitor;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';     // 'android' | 'ios' | 'web'
  let canOgg = true;
  try { canOgg = !!document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'); } catch { /* 판단 불가 → OGG */ }

  const ext = platform === 'ios' || !canOgg ? 'mp3' : 'ogg';
  const pick = path => (typeof path === 'string' ? path.replace(/\.(ogg|mp3)$/i, `.${ext}`) : path);

  // 객체 · 배열 안의 모든 경로를 바꾼다 (TP.AUDIO_FILES = { bgm, shopBgm: [...], sfx: { ... } })
  function remap(v) {
    if (Array.isArray(v)) return v.map(remap);
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = remap(v[k]); return v; }
    return pick(v);
  }

  TP.audioHelper = { platform, ext, url: pick, remap };
  if (TP.AUDIO_FILES) remap(TP.AUDIO_FILES);
})();
