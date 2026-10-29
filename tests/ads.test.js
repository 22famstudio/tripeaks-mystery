// 광고 규칙 (js/ad-manager.js TP.interstitialDecision): 초반 5판 보호 · 그 뒤 클리어 3판마다 1번 + 광고 사이 5분 · 광고 제거면 영구 생략 · 실패 화면엔 없음
// 실행: node tests/ads.test.js   (AdMob 호출은 휴대폰에서만 — 여기서는 노출 규칙만)
require('../js/store.js');
require('../js/ad-manager.js');

const { TP } = globalThis;
const assert = require('assert');

// 누적 클리어 1~30판을 차례로 하며 전면 광고가 뜨는 판을 모은다
//   minPerStage: 한 판에 걸리는 시간(분) — 광고 사이 5분 규칙 확인용
const MIN = 60 * 1000;
function simulate({ noAds = false, upto = 30, minPerStage = 2 } = {}) {
  let state = { totalStagesCleared: 0, adClearCounter: 0, lastAdAt: 0, noAdsActive: noAds };
  const shownAt = [];
  let now = Date.UTC(2026, 9, 30, 3, 0, 0);
  for (let n = 1; n <= upto; n++) {
    now += minPerStage * MIN;
    state = { ...state, totalStagesCleared: n };
    const d = TP.interstitialDecision(state, 'clear', TP.INTERSTITIAL_RULES, now);
    state.adClearCounter = d.counter;
    if (d.show) { shownAt.push(n); state.lastAdAt = now; }
  }
  return shownAt;
}

// 1) 1~5판은 절대 없음, 한 판 2분이면 3판마다 1번 (8 · 11 · 14 …)
const shown = simulate();
assert(shown.every(n => n > 5), '1~5판은 전면 광고 없음');
assert.deepEqual(shown.slice(0, 5), [8, 11, 14, 17, 20]);
for (let i = 1; i < shown.length; i++) assert.equal(shown[i] - shown[i - 1], 3, '3판마다 1번');

// 1-2) 빨리 깨면 (한 판 1분) 5분 간격 때문에 5판마다
const fast = simulate({ minPerStage: 1 });
for (let i = 1; i < fast.length; i++) assert.equal(fast[i] - fast[i - 1], 5, '빨리 깨면 5판마다');

// 1-3) 방금 보상형을 끝까지 봤으면 (lastAdAt) 3판이 차도 5분까지 미룸 → 다음 클리어에
const R = TP.INTERSTITIAL_RULES, t = Date.UTC(2026, 9, 30, 3, 0, 0);
const base = { totalStagesCleared: 20, adClearCounter: 2, noAdsActive: false };
assert.deepEqual(TP.interstitialDecision({ ...base, lastAdAt: t - 2 * MIN }, 'clear', R, t), { show: false, counter: 3 });
assert.deepEqual(TP.interstitialDecision({ ...base, adClearCounter: 3, lastAdAt: t - 6 * MIN }, 'clear', R, t), { show: true, counter: 0 });
// 기기 시계를 되돌렸으면 (lastAdAt 이 미래) 간격은 지난 것으로
assert.equal(TP.interstitialDecision({ ...base, lastAdAt: t + 60 * MIN }, 'clear', R, t).show, true);

// 2) 광고 제거를 샀으면 영구히 없음
assert.deepEqual(simulate({ noAds: true }), []);

// 3) 실패 화면에는 띄우지 않고 카운터도 안 셈
const st = { totalStagesCleared: 20, adClearCounter: 2, noAdsActive: false };
assert.deepEqual(TP.interstitialDecision(st, 'fail'), { show: false, counter: 2 });
assert.deepEqual(TP.interstitialDecision(st, 'clear'), { show: true, counter: 0 });

// 4) 세이브 필드 기본값 · 범위
TP.store.reset();
assert.equal(TP.store.state.adClearCounter, 0);
assert.equal(TP.store.state.lastAdAt, 0);
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

console.log('광고 규칙 (초반 5판 보호 · 3판마다 · 5분 간격 · 광고 제거 생략 · 실패 화면 없음) 통과');
