// 알림 예약 계획 (js/notifications.js TP.planNotifications): 하트 충전 · 아침 08:30 · 3일 복귀, 조용한 시간 20:30~08:30
// 실행: node tests/notifications.test.js   (실제 예약은 휴대폰에서만 — 여기서는 '언제 무엇을 보낼지'만)
require('../js/store.js');
require('../js/energy.js');
require('../js/daily-bonus.js');
require('../js/notifications.js');

const { TP } = globalThis;
const assert = require('assert');

const at = (d, h, m) => new Date(2026, 9, d, h, m, 0, 0).getTime();          // 2026-10-d h:m (기기 시간대)
const hm = t => { const x = new Date(t); return `${x.getDate()}일 ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
const REGEN = TP.ENERGY.REGEN_MS;
const state = (over = {}) => ({
  energy: 5, lastEnergyTime: 0, infiniteEnergyUntil: 0,
  dailyBonus: { installDay: '2026-10-01', claimed: 7, lastClaimDay: '2026-10-07' },   // 출석 보상 끝난 유저
  ...over,
});
const kinds = list => list.map(n => n.kind);

// 1) 하트 가득: 알림 없음 · 아침 7번 · 복귀 1번
{
  const now = at(24, 10, 0);
  const list = TP.planNotifications(state(), now);
  assert.deepEqual(kinds(list).filter(k => k === 'heart'), []);
  const mornings = list.filter(n => n.kind === 'morning');
  assert.equal(mornings.length, 7);
  assert.ok(mornings.every(n => new Date(n.at).getHours() === 8 && new Date(n.at).getMinutes() === 30), '아침 알림은 08:30');
  assert.equal(hm(mornings[0].at), '25일 08:30', '오늘 08:30 이 지났으면 내일부터');
  assert.equal(new Set(list.map(n => n.id)).size, list.length, '알림 ID 겹치지 않음');
}

// 2) 낮에 하트 1개 남김 → 가득 차는 시각에 하트 알림
{
  const now = at(24, 14, 0);
  const list = TP.planNotifications(state({ energy: 1, lastEnergyTime: now }), now);
  const heart = list.find(n => n.kind === 'heart');
  assert.ok(heart, '하트 알림 있음');
  assert.equal(heart.at, now + 4 * REGEN, '4칸 × 20분 뒤');
  assert.ok(!TP.isQuietTime(heart.at));
}

// 3) 밤에 하트가 차면 하트 알림은 없고, 다음 날 아침 08:30 문구가 '밤사이 하트'
{
  const now = at(24, 20, 0);                                  // 20:00 + 80분 = 21:20 (조용한 시간)
  const list = TP.planNotifications(state({ energy: 1, lastEnergyTime: now }), now);
  assert.ok(!list.some(n => n.kind === 'heart'), '조용한 시간에는 하트 알림 없음');
  const first = list.filter(n => n.kind === 'morning')[0];
  assert.equal(hm(first.at), '25일 08:30');
  assert.equal(first.title, '밤사이 하트가 가득 찼어요 ❤');
}

// 4) 08:30 직전에 차는 경우도 조용한 시간 → 그날 아침 문구로
{
  const now = at(25, 7, 0);                                   // 07:00 + 80분 = 08:20
  const list = TP.planNotifications(state({ energy: 1, lastEnergyTime: now }), now);
  assert.ok(!list.some(n => n.kind === 'heart'));
  assert.equal(list.filter(n => n.kind === 'morning')[0].title, '밤사이 하트가 가득 찼어요 ❤');
}

// 5) 무한 하트 중에는 하트 알림 없음
{
  const now = at(24, 14, 0);
  const list = TP.planNotifications(state({ energy: 1, lastEnergyTime: now, infiniteEnergyUntil: now + 3600e3 }), now);
  assert.ok(!list.some(n => n.kind === 'heart'));
}

// 6) 복귀 알림: 3일 뒤 1번, 조용한 시간이면 12:30 으로
{
  let list = TP.planNotifications(state(), at(24, 15, 0));
  assert.equal(list.filter(n => n.kind === 'comeback').length, 1);
  assert.equal(hm(list.find(n => n.kind === 'comeback').at), '27일 15:00');
  list = TP.planNotifications(state(), at(24, 22, 0));       // 3일 뒤 22:00 → 다음 날 12:30
  assert.equal(hm(list.find(n => n.kind === 'comeback').at), '28일 12:30');
  list = TP.planNotifications(state(), at(24, 6, 0));        // 3일 뒤 06:00 → 그날 12:30
  assert.equal(hm(list.find(n => n.kind === 'comeback').at), '27일 12:30');
}

// 7) 모든 알림은 조용한 시간(20:30~08:30)을 피한다
for (let h = 0; h < 24; h++) {
  const now = at(24, h, 15);
  for (const e of [0, 1, 4]) {
    const list = TP.planNotifications(state({ energy: e, lastEnergyTime: now }), now);
    for (const n of list) assert.ok(!TP.isQuietTime(n.at), `${n.kind} ${hm(n.at)} 이 조용한 시간 (현재 ${h}:15)`);
    assert.ok(list.every(n => n.at > now), '과거 시각 예약 없음');
  }
}

// 8) 출석 보상: 받을 수 있는 날 아침에만 '출석 보상' 문구
{
  const now = at(24, 10, 0);
  // 설치 3일째 · 오늘 이미 받음(3개) → 내일(4일째) ~ 28일(7일째)까지 4번, 그 뒤는 일반 문구
  const list = TP.planNotifications(state({ dailyBonus: { installDay: '2026-10-22', claimed: 3, lastClaimDay: '2026-10-24' } }), now);
  const titles = list.filter(n => n.kind === 'morning').map(n => n.title === '출석 보상이 도착했어요 🎁');
  assert.deepEqual(titles, [true, true, true, true, false, false, false]);
  // 오늘 아직 안 받음(2개) · 08:30 전 → 오늘 아침부터 보상 문구
  const early = TP.planNotifications(state({ dailyBonus: { installDay: '2026-10-22', claimed: 2, lastClaimDay: '2026-10-23' } }), at(24, 7, 0));
  const first = early.filter(n => n.kind === 'morning')[0];
  assert.equal(hm(first.at), '24일 08:30');
  assert.equal(first.title, '출석 보상이 도착했어요 🎁');
}

console.log('알림 예약 테스트 통과 (하트 · 아침 08:30 · 3일 복귀 · 조용한 시간 20:30~08:30 · 출석 보상 문구)');
