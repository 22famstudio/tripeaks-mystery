// CDN 에셋 매니저 · 오디오 형식 고르기 — 네이티브 환경을 흉내 내 경로 바꿔 끼우기만 검사 (다운로드는 실기기에서 확인)
// 실행: node tests/asset-manager.test.js
const assert = require('assert');
const path = require('path');
const load = f => { delete require.cache[require.resolve(f)]; require(f); };
const reset = () => { globalThis.TP = {}; load(path.join(__dirname, '../js/data/episodes.js')); };

// 1) 기본(꺼짐) · 브라우저: 경로 그대로
reset();
globalThis.localStorage = { getItem: () => JSON.stringify({ version: 'v1', webBase: 'X/' }), setItem() {} };
load(path.join(__dirname, '../js/cdn-config.js'));
load(path.join(__dirname, '../js/asset-manager.js'));
assert(TP.EPISODES[0].background.startsWith('game_assets/episodes/ep_bg/'), '꺼져 있으면 그대로');
assert.equal(TP.AssetManager.isEnabled(), false);

// 2) 켜짐 + 네이티브 + 받아 둔 버전 → 에피소드 그림 경로가 기기 저장소 주소로
reset();
const BASE = 'https://localhost/_capacitor_file_/data/user/0/com.tripeaks.mystery/files/cdn_assets/v1/';
globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { Filesystem: {} } };
globalThis.localStorage = { getItem: () => JSON.stringify({ version: 'v1', dir: 'cdn_assets/v1', webBase: BASE }), setItem() {} };
TP.CDN_CONFIG = { enabled: true, versionUrl: 'https://storage.googleapis.com/b/version.json' };
load(path.join(__dirname, '../js/asset-manager.js'));
const ep = TP.EPISODES[0];
assert.equal(ep.background, BASE + 'ep_bg/ep001.jpg');
assert.equal(ep.thumb, BASE + 'ep_thumb/ep001.jpg');
assert(ep.suspects.every(s => s.portrait.startsWith(BASE + 'portraits/')));
assert(ep.clues.filter(c => c.prop).every(c => c.prop.startsWith(BASE + 'clue/')));
assert(TP.EPISODES.every(e => !JSON.stringify(e).includes('game_assets/episodes/')), '300화 모두 바뀜');

// 3) 오디오: iOS → mp3, 안드로이드 → ogg
for (const [platform, ext] of [['ios', 'mp3'], ['android', 'ogg']]) {
  globalThis.TP = { AUDIO_FILES: { bgm: null, shopBgm: ['a/x.ogg'], sfx: { click: 'a/click.ogg' } } };
  globalThis.Capacitor = { getPlatform: () => platform };
  globalThis.document = { createElement: () => ({ canPlayType: () => 'probably' }) };
  load(path.join(__dirname, '../js/audio-helper.js'));
  assert.equal(TP.AUDIO_FILES.sfx.click, `a/click.${ext}`);
  assert.equal(TP.AUDIO_FILES.shopBgm[0], `a/x.${ext}`);
  assert.equal(TP.audioHelper.ext, ext);
}
// 웹 Safari 처럼 OGG 를 못 튼다고 답하면 mp3
globalThis.TP = { AUDIO_FILES: { sfx: { a: 's.ogg' } } };
globalThis.Capacitor = undefined;
globalThis.document = { createElement: () => ({ canPlayType: () => '' }) };
load(path.join(__dirname, '../js/audio-helper.js'));
assert.equal(TP.AUDIO_FILES.sfx.a, 's.mp3');

console.log('CDN 에셋 경로 바꿔 끼우기 · 오디오 형식 고르기 통과');
