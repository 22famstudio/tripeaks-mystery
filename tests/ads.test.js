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
assert.equal(TP.ADS_CONFIG.USE_TEST_ADS, true, '출시 전에는 테스트 ID');

console.log('광고 규칙 (초반 5판 보호 · 2판마다 · 광고 제거 생략 · 실패 화면 없음) 통과');
