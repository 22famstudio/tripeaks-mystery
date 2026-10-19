// 수사 에너지 검증: 자연 충전 · 입장 시 소모(환급 없음) · 무한 에너지 · 골드/광고 충전 · 저장 데이터
// 실행: node tests/energy.test.js
require('../js/store.js');
require('../js/energy.js');

const { TP } = globalThis;
const assert = require('assert');
const store = TP.store;
const energy = TP.energy;
const MIN = 60 * 1000;
const T0 = new Date(2026, 9, 13, 9, 0, 0).getTime(); // 로컬 시각 기준 (광고 일일 제한이 날짜로 끊기므로)

let clock = T0;
TP.now = () => clock;
const at = minutes => { clock = T0 + minutes * MIN; };

function fresh(patch = {}) {
  at(0);
  store.reset();
  store.update(s => Object.assign(s, patch));
}

// 1) 순수 계산: 20분마다 1칸, 남은 시간은 이월, 최대 5칸
{
  const base = { energy: 0, lastEnergyTime: T0 };
  const e = m => TP.computeEnergy(base, T0 + m * MIN);
  assert.equal(e(19.99).energy, 0);
  assert.equal(e(20).energy, 1);
  assert.deepEqual(e(45), { energy: 2, lastEnergyTime: T0 + 40 * MIN }, '45분: 2칸 + 5분 이월');
  assert.equal(e(100).energy, 5, '100분이면 완충');
  assert.equal(e(10000).energy, 5, '최대 5칸');
  assert.deepEqual(TP.computeEnergy({ energy: 5, lastEnergyTime: 0 }, T0), { energy: 5, lastEnergyTime: 0 }, '가득 차 있으면 그대로');
  assert.equal(TP.computeEnergy({ energy: 1, lastEnergyTime: T0 }, T0 - 5 * MIN).lastEnergyTime, T0 - 5 * MIN, '시계 되돌림 대응');
}

// 2) 꽉 찬 상태에서 쓰면 그때부터 충전 시작 → 20분 뒤 다시 5칸
{
  fresh();
  assert.deepEqual(energy.consume(), { ok: true, spent: 1 });
  assert.equal(store.state.energy, 4);
  assert.equal(store.state.lastEnergyTime, T0);
  at(19);
  assert.equal(energy.status().energy, 4);
  assert.equal(TP.formatDuration(energy.status().nextInMs), '1:00');
  at(20);
  assert.equal(energy.status().energy, 5);
}

// 3) 앱을 껐다 켠 상황: 저장된 값만으로 경과 시간만큼 충전
{
  fresh({ energy: 1, lastEnergyTime: T0 - 50 * MIN }); // 50분 전에 1칸이었음
  const s = energy.status();
  assert.equal(s.energy, 3);
  assert.equal(Math.round(s.nextInMs / MIN), 10, '다음 1칸까지 10분');
  assert.equal(Math.round(s.fullInMs / MIN), 30, '완충까지 10 + 20 = 30분');
}

// 4) 입장 시 1칸 소모 — 성공 여부와 상관없이 환급 없음
{
  fresh();
  assert.deepEqual(energy.consume(), { ok: true, spent: 1 });
  assert.deepEqual(energy.consume(), { ok: true, spent: 1 });
  assert.equal(store.state.energy, 3, '두 판 입장 → 2칸 소모');
  assert.equal(energy.refund, undefined, '클리어 환급(수사 보호 룰) 없음');
}

// 5) 에너지 0이면 입장 불가
{
  fresh({ energy: 0, lastEnergyTime: T0 });
  assert.equal(energy.canPlay(), false);
  assert.deepEqual(energy.consume(), { ok: false, spent: 0 });
}

// 6) 무한 에너지: 켜져 있는 동안 차감 0 (환급도 0), 끝나면 다시 차감, 연장은 이어 붙음
{
  fresh({ energy: 0, lastEnergyTime: T0 });
  energy.addInfinite(30);
  assert.equal(energy.canPlay(), true, '0칸이어도 무한 에너지면 입장 가능');
  assert.deepEqual(energy.consume(), { ok: true, spent: 0 });
  assert.equal(store.state.energy, 0, '무한 에너지 중에는 잔량 그대로');
  at(10);
  energy.addInfinite(30);
  assert.equal(store.state.infiniteEnergyUntil, T0 + 60 * MIN, '남은 시간 뒤에 연장');
  at(61);
  assert.equal(energy.isInfinite(), false);
  assert.equal(energy.status().energy, 3, '무한 에너지와 별개로 자연 충전은 계속');
  assert.deepEqual(energy.consume(), { ok: true, spent: 1 });
}

// 7) 골드 300 → 즉시 완충
{
  fresh({ energy: 1, lastEnergyTime: T0, gold: 1000 });
  assert.deepEqual(TP.refillEnergyWithGold(), { ok: true, cost: 300 });
  assert.equal(store.state.energy, 5);
  assert.equal(store.state.gold, 700);
  assert.equal(energy.refillWithGold().reason, 'full', '가득 차 있으면 골드를 쓰지 않음');
  store.update(s => { s.energy = 2; s.gold = 299; });
  assert.equal(energy.refillWithGold().reason, 'gold');
  assert.equal(store.state.gold, 299);
}

// 8) 광고 충전: 1회당 +1칸, 하루 5회, 다음 날 초기화, 최대치 제한
{
  fresh({ energy: 0, lastEnergyTime: T0 });
  for (let i = 1; i <= 4; i++) assert.equal(energy.refillWithAd().energy, i, `광고 ${i}회 → ${i}칸`);
  store.update(s => { s.energy = 0; });
  assert.equal(energy.refillWithAd().energy, 1, '5회째');
  assert.equal(energy.status().adsLeftToday, 0);
  assert.equal(energy.canRefillWithAd().reason, 'limit');
  assert.equal(energy.refillWithAd().reason, 'limit', '하루 5회 초과 불가');
  at(24 * 60);                              // 다음 날
  assert.equal(energy.status().adsLeftToday, 5, '날짜가 바뀌면 다시 5회');
  store.update(s => { s.energy = 4; });
  assert.equal(energy.refillWithAd().energy, 5, '최대 5칸까지만');
  assert.equal(energy.canRefillWithAd().reason, 'full');
}

// 9) 손상된 저장 데이터는 안전한 값으로
{
  store.update(s => { s.energy = -3; s.lastEnergyTime = 'x'; s.infiniteEnergyUntil = null; s.energyAdCount = 'a'; });
  const s = store.state;
  assert.deepEqual([s.energy, s.lastEnergyTime, s.infiniteEnergyUntil, s.energyAdCount], [0, 0, 0, 0]);
}

console.log('수사 에너지 테스트 통과');
