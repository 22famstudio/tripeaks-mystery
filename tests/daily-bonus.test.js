// 데일리 로그인 보너스 (js/daily-bonus.js): 설치 후 7일 · 하루 1회 · 건너뛰면 다음 접속에 다음 날 보상 · 7일 지나면 사라짐
// 실행: node tests/daily-bonus.test.js
require('../js/store.js');
require('../js/daily-bonus.js');
const { TP } = globalThis;
const assert = require('assert');
const store = TP.store;
const DAY = 864e5;
const T0 = new Date(2026, 9, 18, 10, 0, 0).getTime();   // 설치: 2026-10-18 10:00
let now = T0;
TP.now = () => now;
const at = (dayIndex, hour = 10) => { now = T0 + (dayIndex - 1) * DAY + (hour - 10) * 3600e3; };

store.reset();
let st = TP.dailyBonus.status();
assert.equal(st.dayOfWindow, 1); assert(st.canClaim); assert.equal(st.nextDay, 1);
const g0 = store.state.gold;
assert.equal(TP.dailyBonus.claim().day, 1);
assert.equal(store.state.gold - g0, 500, 'Day 1 = 500G');
assert.equal(TP.dailyBonus.claim().reason, 'claimedToday', '같은 날 두 번 못 받음');
at(1, 23.9); assert(!TP.dailyBonus.canClaim(), '자정 전까지는 같은 날');
at(2, 0.1); st = TP.dailyBonus.status(); assert(st.canClaim && st.nextDay === 2, '다음 날 자정 지나면 Day 2');
assert.equal(TP.dailyBonus.claim().day, 2);
at(5);                                                    // 3 · 4일 접속 안 함 → 5일에 Day 3 보상 (건너뛴 날은 밀린다)
st = TP.dailyBonus.status(); assert.equal(st.nextDay, 3); assert.equal(st.dayOfWindow, 5);
const u0 = store.state.undoCount; assert.equal(TP.dailyBonus.claim().day, 3); assert.equal(store.state.undoCount - u0, 1);
at(6); const h0 = store.state.hintCount; assert.equal(TP.dailyBonus.claim().day, 4); assert.equal(store.state.hintCount - h0, 1);
at(7); st = TP.dailyBonus.status(); assert(st.active && st.canClaim && st.daysLeft === 1, '설치 7일째가 마지막 날');
assert.equal(TP.dailyBonus.claim().day, 5);
at(8); st = TP.dailyBonus.status();
assert(st.expired && !st.active && !st.canClaim, '설치 후 7일이 지나면 남은 보상(Day 6 · 7)과 함께 사라짐');
assert.equal(TP.dailyBonus.claim().reason, 'expired');

// 매일 접속하면 7일 안에 7개 다 받고 끝
store.reset(); at(1);
TP.dailyBonus.status();
const e0 = store.state.energy;
for (let d = 1; d <= 7; d++) { at(d); const r = TP.dailyBonus.claim(); assert(r.ok && r.day === d, `Day ${d}`); }
assert(store.state.energy >= e0, 'Day 6 하트');
st = TP.dailyBonus.status(); assert(st.finished && !st.canClaim && !st.expired);
assert.equal(TP.dailyBonus.claim().reason, 'finished');
const total = TP.DAILY_BONUS.reduce((a, r) => a + (r.gold || 0), 0);
assert.equal(total, 4800, '7일 골드 합계 4,800');

// 저장 데이터 정리: 이상한 값은 초기화
store.update(s => { s.dailyBonus = { installDay: 'bad', claimed: 99, lastClaimDay: 5 }; });
assert.deepEqual(store.state.dailyBonus, { installDay: '', claimed: 7, lastClaimDay: '' });
console.log('데일리 로그인 보너스 통과 (7일 창 · 하루 1회 · 건너뛰기 밀림 · 만료 · 완료)');
