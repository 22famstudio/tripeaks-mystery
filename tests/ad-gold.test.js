// 홈 [광고 보고 골드] (js/ad-gold.js): 1회 200골드 · 첫 시청부터 24시간에 3번 · 24시간 뒤 다시 3번
// 실행: node tests/ad-gold.test.js
require('../js/store.js');
require('../js/ad-gold.js');

const { TP } = globalThis;
const assert = require('assert');
const H = 3600 * 1000;

TP.store.reset();
const t0 = Date.UTC(2026, 9, 24, 3, 0, 0);
const gold0 = TP.store.state.gold;

assert.deepEqual(TP.adGold.status(t0), { left: 3, max: 3, used: 0, resetInMs: 0 }, '처음엔 3번');
assert.equal(TP.adGold.claim(t0).gold, 200);
assert.equal(TP.adGold.status(t0 + H).left, 2);
assert.equal(TP.adGold.status(t0 + H).resetInMs, 23 * H, '첫 시청부터 24시간');
TP.adGold.claim(t0 + 2 * H);
const last = TP.adGold.claim(t0 + 3 * H);
assert.equal(last.ok, true);
assert.equal(last.left, 0);
assert.equal(TP.store.state.gold, gold0 + 600, '3번 × 200골드');

// 다 쓴 뒤: 더 못 받음 (남은 시간 안내)
const no = TP.adGold.claim(t0 + 10 * H);
assert.equal(no.ok, false);
assert.equal(no.reason, 'limit');
assert.equal(no.resetInMs, 14 * H);
assert.equal(TP.store.state.gold, gold0 + 600);

// 24시간 지나면 다시 3번, 새 주기는 그때 첫 시청부터
assert.equal(TP.adGold.status(t0 + 24 * H).left, 3);
TP.adGold.claim(t0 + 30 * H);
assert.equal(TP.adGold.status(t0 + 31 * H).resetInMs, 23 * H);

// 기기 시계를 되돌리면 새 주기 (잠기지 않게)
assert.equal(TP.adGold.status(t0).left, 3);

// 저장 데이터 정리: 이상한 값은 기본값으로
TP.store.update(s => { s.adGoldCount = -5; s.adGoldStart = 'x'; });
TP.store.load?.();
console.log('광고 골드 테스트 통과 (200골드 · 24시간에 3번 · 리셋)');
