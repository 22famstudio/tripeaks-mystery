// 첫 실행 튜토리얼 (js/tutorial.js): 자동 시작 조건 · 예전 세이브 처리 · 완료 보상 500G 는 한 번만
// 실행: node tests/tutorial.test.js   (화면 없이 상태 · 보상만 검사, 화면 흐름은 브라우저에서 확인)
require('../js/store.js');
require('../js/tutorial.js');

const { TP } = globalThis;
const assert = require('assert');
const store = TP.store;

// 1) 새 세이브: 튜토리얼 자동 시작
store.reset();
assert.equal(store.state.tutorialDone, false);
assert.equal(store.state.tutorialRewarded, false);
assert.equal(TP.tutorial.shouldAutoStart(), true);

// 2) 튜토리얼이 생기기 전 세이브: 이미 플레이한 사람에게는 자동으로 띄우지 않음, 처음 막 깐 사람에게는 띄움
const { tutorialDone, tutorialRewarded, ...old } = store.state;
store.replace({ ...old, totalStagesCleared: 12, playerLevel: 4 });
assert.equal(store.state.tutorialDone, true, '예전 세이브 + 진행 있음 → 자동 시작 안 함');
assert.equal(TP.tutorial.shouldAutoStart(), false);
store.replace({ ...old, totalStagesCleared: 0, playerLevel: 1 });
assert.equal(store.state.tutorialDone, false, '예전 세이브지만 진행 없음 → 자동 시작');

// 3) 진행 중인 판이 있으면 (튕긴 뒤 이어하기) 자동 시작 안 함
assert.equal(TP.tutorial.shouldAutoStart({ ...store.state, activeRun: { seed: 1 } }), false);

// 4) 완료 보상: 500G 한 번만 (다시 보기로 또 받을 수 없음)
store.reset();
const g0 = store.state.gold;
assert.deepEqual(TP.tutorial.claimReward(), { ok: true, gold: 500 });
assert.equal(store.state.gold, g0 + 500);
assert.equal(store.state.tutorialDone, true);
assert.equal(store.state.tutorialRewarded, true);
assert.deepEqual(TP.tutorial.claimReward(), { ok: false, gold: 0 });
assert.equal(store.state.gold, g0 + 500, '두 번째는 지급 안 함');

console.log('튜토리얼 (자동 시작 조건 · 예전 세이브 · 완료 보상 500G 1회) 통과');
