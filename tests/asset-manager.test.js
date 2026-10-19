// CDN 에셋 매니저 · 오디오 형식/위치 고르기 — 네이티브 환경을 흉내 내 경로 바꿔 끼우기만 검사 (다운로드는 실기기에서 확인)
// 실행: node tests/asset-manager.test.js
const assert = require('assert');
const path = require('path');
const load = f => { delete require.cache[require.resolve(f)]; require(f); };
const J = f => path.join(__dirname, '..', f);
const reset = () => { globalThis.TP = {}; load(J('js/data/episodes.js')); };
const ls = state => ({ getItem: () => JSON.stringify(state), setItem() {} });
const PREFIXES = ['episodes/ep_bg', 'episodes/portraits', 'episodes/ep_thumb', 'episodes/clue', 'sounds/sfx', 'sounds/bgm_mp3'];
const BASE = 'https://localhost/_capacitor_file_/data/user/0/com.twotwofam.mystery/files/cdn_assets/v1/';

// 1) 기본(꺼짐) · 브라우저: 경로 그대로
reset();
globalThis.Capacitor = undefined;
globalThis.localStorage = ls({ version: 'v1', webBase: 'X/', prefixes: PREFIXES });
load(J('js/cdn-config.js'));
load(J('js/asset-manager.js'));
assert(TP.EPISODES[0].background.startsWith('game_assets/episodes/ep_bg/'), '꺼져 있으면 그대로');
assert.equal(TP.AssetManager.isEnabled(), false);
assert.equal(TP.AssetManager.url('game_assets/sounds/sfx/click.ogg'), 'game_assets/sounds/sfx/click.ogg');

// 2) 켜짐 + 안드로이드 + 받아 둔 버전 → 에피소드 그림 · 사운드 경로가 기기 저장소 주소로
reset();
globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { Filesystem: {} } };
globalThis.localStorage = ls({ version: 'v1', dir: 'cdn_assets/v1', webBase: BASE, platform: 'android', prefixes: PREFIXES });
TP.CDN_CONFIG = { enabled: true, versionUrl: 'https://storage.googleapis.com/b/version.json' };
load(J('js/asset-manager.js'));
const ep = TP.EPISODES[0];
assert.equal(ep.background, BASE + 'episodes/ep_bg/ep001.jpg');
assert.equal(ep.thumb, BASE + 'episodes/ep_thumb/ep001.jpg');
assert(ep.suspects.every(s => s.portrait.startsWith(BASE + 'episodes/portraits/')));
assert(ep.clues.filter(c => c.prop).every(c => c.prop.startsWith(BASE + 'episodes/clue/')));
assert(TP.EPISODES.every(e => !JSON.stringify(e).includes('game_assets/episodes/')), '300화 모두 바뀜');
assert.equal(TP.AssetManager.url('game_assets/icon_gold.webp'), 'game_assets/icon_gold.webp', 'CDN 폴더가 아니면 그대로');

// 3) 오디오: 안드로이드 + CDN → OGG 를 기기 저장소에서
TP.AUDIO_FILES = { bgm: null, shopBgm: ['game_assets/sounds/bgm_mp3/shop_bgm_1.ogg'], sfx: { click: 'game_assets/sounds/sfx/click.ogg' } };
globalThis.document = { createElement: () => ({ canPlayType: () => 'probably' }) };
load(J('js/audio-helper.js'));
assert.equal(TP.AUDIO_FILES.sfx.click, BASE + 'sounds/sfx/click.ogg');
assert.equal(TP.AUDIO_FILES.shopBgm[0], BASE + 'sounds/bgm_mp3/shop_bgm_1.ogg');
assert.equal(TP.AUDIO_FILES.bgm, null);

// 4) iOS + CDN → 같은 자리의 MP3 (iOS 묶음에서 받은 파일)
reset();
globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Filesystem: {} } };
globalThis.localStorage = ls({ version: 'v1', dir: 'cdn_assets/v1', webBase: BASE, platform: 'ios', prefixes: PREFIXES });
TP.CDN_CONFIG = { enabled: true, versionUrl: 'x' };
load(J('js/asset-manager.js'));
TP.AUDIO_FILES = { sfx: { click: 'game_assets/sounds/sfx/click.ogg' } };
load(J('js/audio-helper.js'));
assert.equal(TP.audioHelper.ext, 'mp3');
assert.equal(TP.AUDIO_FILES.sfx.click, BASE + 'sounds/sfx/click.mp3');

// 5) CDN 없이: iOS → 앱 안의 mp3 경로, 웹 Safari(OGG 못 틈) → mp3, 크롬 → ogg
for (const [plat, canOgg, ext] of [['ios', 'probably', 'mp3'], [null, '', 'mp3'], [null, 'probably', 'ogg']]) {
  globalThis.TP = { AUDIO_FILES: { sfx: { a: 'game_assets/sounds/sfx/a.ogg' } } };
  globalThis.Capacitor = plat ? { getPlatform: () => plat } : undefined;
  globalThis.document = { createElement: () => ({ canPlayType: () => canOgg }) };
  load(J('js/audio-helper.js'));
  assert.equal(TP.AUDIO_FILES.sfx.a, `game_assets/sounds/sfx/a.${ext}`);
}

console.log('CDN 에셋 경로 바꿔 끼우기 · 오디오 형식/위치 고르기 통과');
