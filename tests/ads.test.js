// 광고 규칙 (js/ad-manager.js TP.interstitialDecision): 초반 5판 보호 · 그 뒤 클리어 2판마다 1번 · 광고 제거면 영구 생략 · 실패 화면엔 없음
// 실행: node tests/ads.test.js   (AdMob 호출은 휴대폰에서만 — 여기서는 노출 규칙만)
require('../js/store.js');
require('../js/ad-manager.js');

const { TP } = globalThis;
const assert = require('assert');

// 누적 클리어 1~30판을 차례로 하며 전면 광고가 뜨는 판을 모은다
function simulate({ noAds = false, upto = 30 } = {}) {
  let state = { totalStagesCleared: 0, adClearCounter: 0, noAdsActive: noAds };
  const shownAt = [];
  for (let n = 1; n <= upto; n++) {
    state = { ...state, totalStagesCleared: n };
    const d = TP.interstitialDecision(state, 'clear');
    state.adClearCounter = d.counter;
    if (d.show) shownAt.push(n);
  }
  return shownAt;
}

// 1) 1~5판은 절대 없음, 6판째부터 2판마다 1번 (7 · 9 · 11 …)
const shown = simulate();
assert(shown.every(n => n > 5), '1~5판은 전면 광고 없음');
assert.deepEqual(shown.slice(0, 5), [7, 9, 11, 13, 15]);
for (let i = 1; i < shown.length; i++) assert.equal(shown[i] - shown[i - 1], 2, '2판마다 1번');

// 2) 광고 제거를 샀으면 영구히 없음
assert.deepEqual(simulate({ noAds: true }), []);

// 3) 실패 화면에는 띄우지 않고 카운터도 안 셈
const st = { totalStagesCleared: 20, adClearCounter: 1, noAdsActive: false };
assert.deepEqual(TP.interstitialDecision(st, 'fail'), { show: false, counter: 1 });
assert.deepEqual(TP.interstitialDecision(st, 'clear'), { show: true, counter: 0 });

// 4) 세이브 필드 기본값 · 범위
TP.store.reset();
assert.equal(TP.store.state.adClearCounter, 0);
TP.store.update(s => { s.adClearCounter = -3; });
assert.equal(TP.store.state.adClearCounter, 0);

// 5) 웹(브라우저 · Node)에는 AdMob 이 없다 → available false (보상형은 미리보기용 바로 지급, 전면은 생략)
assert.equal(TP.ads.available, false);
// 실제 ID 를 쓸 때는 앱 ID · 광고 단위가 모두 같은 퍼블리셔(pub-…)여야 한다 (strings.xml 의 admob_app_id 와도 같게)
const cfg = TP.ADS_CONFIG;
if (!cfg.USE_TEST_ADS) {
  const pub = id => (id.match(/^ca-app-pub-(\d+)[~/]\d+$/) || [])[1];
  assert.ok(pub(cfg.LIVE.APP_ID) && pub(cfg.LIVE.APP_ID) === pub(cfg.LIVE.REWARDED) && pub(cfg.LIVE.APP_ID) === pub(cfg.LIVE.INTERSTITIAL), '실제 광고 ID 형식');
  assert.ok(cfg.LIVE.APP_ID.includes('~') && cfg.LIVE.REWARDED.includes('/') && cfg.LIVE.INTERSTITIAL.includes('/'), '앱 ID 는 ~, 광고 단위는 /');
  const xml = require('fs').readFileSync(require('path').join(__dirname, '../mobile/android/app/src/main/res/values/strings.xml'), 'utf8');
  assert.ok(xml.includes(cfg.LIVE.APP_ID), 'strings.xml admob_app_id = LIVE.APP_ID');
}

console.log('광고 규칙 (초반 5판 보호 · 2판마다 · 광고 제거 생략 · 실패 화면 없음) 통과');
