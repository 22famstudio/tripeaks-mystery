// 연승 사다리 검증: 누적 · 마일스톤 보상(3·7·10·20·30, 하트 포함) · 50연승 프레스티지(카드 뒷면) 후 리셋 · 버프 · 패배 초기화 · 500G 세이브 · 배수 보상
// 실행: node tests/streak.test.js
require('../js/store.js');
require('../js/energy.js');
require('../js/economy.js');
require('../js/streak.js');
require('../js/card-backs.js');

const { TP } = globalThis;
const assert = require('assert');
const store = TP.store;
const T0 = new Date(2026, 9, 14, 9, 0, 0).getTime();
TP.now = () => T0;

const winTimes = n => Array.from({ length: n }, () => TP.streak.recordWin());

// 1) 마일스톤 보상 (home_progression_system WIN_STREAK_MILESTONES): 3 · 7 · 10 · 20 · 30연승에 정확히 도달한 순간 1번
{
  store.reset();
  const { gold: g0, undoCount: u0, wildcardCount: w0, energy: e0 } = store.state;
  const results = winTimes(29);
  assert.deepEqual(results.map(r => r.streak), Array.from({ length: 29 }, (_, i) => i + 1));
  assert.deepEqual(results.filter(r => r.reward).map(r => r.streak), [3, 7, 10, 20]);
  const paid = results.filter(r => r.reward).map(r => r.reward);
  const gold = paid.reduce((t, r) => t + r.gold, 0);
  assert(gold >= 100 + 100 + 200 && gold <= 200 + 200 + 500, `골드 합계 범위 (${gold})`);
  assert.equal(store.state.gold - g0, gold);
  assert.equal(store.state.energy - e0, 1 + 1 + 2, '하트 3연승 1 · 7연승 1 · 10연승 2');
  assert.equal(store.state.wildcardCount - w0, 0);
  assert(store.state.undoCount - u0 >= 1 && store.state.undoCount - u0 <= 2, '20연승 되돌리기 1~2');
  assert.deepEqual(store.state.claimedStreakMilestones, [3, 7, 10, 20]);
  assert.equal(TP.describeStreakReward(TP.streakReward(7)), '🪙 100~200 + ❤️ +1 + 🎟 힌트권 1');
}

// 2) 30연승: 500G + 되돌리기 1 + 와일드 1 (리셋 없이 계속) → 50연승 프레스티지: 카드 뒷면 1종 해제 · 장착 후 연승 0
{
  store.reset();
  winTimes(29);
  const { gold: g, undoCount: u, wildcardCount: w } = store.state;
  const r30 = TP.streak.recordWin();
  assert.equal(r30.streak, 30);
  assert.deepEqual([r30.reward.gold, r30.reward.undo, r30.reward.wild], [500, 1, 1]);
  assert.deepEqual([store.state.gold - g, store.state.undoCount - u, store.state.wildcardCount - w], [500, 1, 1]);
  assert.equal(store.state.winStreak, 30, '30연승은 보상만, 리셋 없음');
  const rest = winTimes(20);
  assert(rest.slice(0, 19).every(r => !r.reward), '31~49연승 보상 없음');
  const r50 = rest[19];
  assert.equal(r50.streak, 50);
  assert(r50.reward.prestige, '50연승 = 프레스티지');
  assert.equal(r50.reward.prestigeResult.type, 'cardBack');
  const back = r50.reward.prestigeResult.back;
  assert.deepEqual(store.state.ownedCardBacks, ['default', back.id], '새 카드 뒷면 1종 보유');
  assert.equal(store.state.equippedCardBack, back.id, '새 스킨 바로 장착');
  assert.equal(store.state.winStreak, 0, '50연승 프레스티지 후 0으로');
  assert.equal(store.state.bestStreak, 50);
  assert.deepEqual(store.state.claimedStreakMilestones, []);
  const again = winTimes(3);
  assert.equal(again[2].reward.streak, 3, '리셋 후 3연승 보상 다시');
}

// 2-1) 카드 뒷면 수집: 18종을 겹치지 않게 모으고, 다 모은 뒤 50연승은 대체 보상 · 장착은 보유한 것만
{
  store.reset();
  assert.deepEqual([store.state.ownedCardBacks, store.state.equippedCardBack], [['default'], 'default'], '기본 뒷면은 처음부터');
  assert.equal(TP.CARD_BACKS.length, 19, '기본 + 18종');
  assert.equal(TP.cardBacks.equip('back_2'), false, '없는 스킨은 장착 불가');
  const got = Array.from({ length: 18 }, () => TP.cardBacks.grantPrestige());
  assert(got.every(r => r.type === 'cardBack'));
  assert.equal(new Set(got.map(r => r.back.id)).size, 18, '18종 모두 다른 스킨');
  assert.equal(store.state.ownedCardBacks.length, 19);
  assert(got.every(r => /card_back_(\d+)\.webp$/.test(r.back.src)), 'card_back_2 ~ 19 그림');
  const g0 = store.state.gold;
  const fb = TP.cardBacks.grantPrestige();
  assert.equal(fb.type, 'fallback', '다 모았으면 대체 보상');
  assert.equal(store.state.gold - g0, TP.PRESTIGE_FALLBACK.gold);
  assert(TP.cardBacks.equip('default') && store.state.equippedCardBack === 'default');
  // 저장 데이터 정리: 모르는 값 · 없는 스킨 장착은 기본으로
  store.update(s => { s.ownedCardBacks = ['back_3', 7]; s.equippedCardBack = 'back_9'; });
  assert.deepEqual(store.state.ownedCardBacks, ['default', 'back_3']);
  assert.equal(store.state.equippedCardBack, 'default');
}

// 3) 버프는 50연승 직전까지 20연승 단계 유지
{
  assert.deepEqual(TP.streakBuffs(49), TP.streakBuffs(20));
  assert.equal(TP.nextStreakTier(30).at, 50);
  assert.equal(TP.STREAK.CAP, 50);
}

// 4) 연승별 버프 (가장 높은 달성 단계)
{
  const b = TP.streakBuffs;
  assert.deepEqual(b(0), { extraCards: 0, freeUndo: 0, freeWild: 0, comboBoost: 0 });
  assert.deepEqual(b(2), b(0));
  assert.deepEqual(b(3), { extraCards: 2, freeUndo: 0, freeWild: 0, comboBoost: 0 });
  assert.deepEqual(b(6), { extraCards: 3, freeUndo: 1, freeWild: 0, comboBoost: 0 }, '5연승 단계');
  assert.deepEqual(b(7), { extraCards: 4, freeUndo: 0, freeWild: 1, comboBoost: 0 });
  assert.deepEqual(b(12), { extraCards: 5, freeUndo: 0, freeWild: 1, comboBoost: 1 }, '10연승 단계');
  assert.deepEqual(b(15), { extraCards: 5, freeUndo: 0, freeWild: 2, comboBoost: 2 });
  assert.deepEqual(b(20), { extraCards: 6, freeUndo: 0, freeWild: 2, comboBoost: 2 });
  assert.equal(TP.nextStreakTier(4).at, 5);
  assert.equal(TP.describeBuffs(b(10)), '덱 +5 · 무료 와일드 1 · 콤보 배율 +1');
}

// 5) 패배 → 0으로 초기화, 끊긴 연승은 세이브 대기
{
  store.reset();
  winTimes(6);
  assert.equal(TP.streak.recordLoss(), 6);
  assert.equal(store.state.winStreak, 0);
  assert.equal(TP.streak.canSave(), true);
  assert.equal(TP.streak.recordWin().streak, 1, '세이브 안 하고 이기면 1부터');
  assert.equal(TP.streak.canSave(), false, '이기면 세이브 기회 소멸');
}

// 6) 500G 세이브: 골드 차감 후 연승 복구, 1번만, 골드 부족 시 실패
{
  store.reset();
  store.update(s => { s.gold = 1200; });
  winTimes(4);                               // 3연승 보상: 하트 +1 (골드 없음)
  TP.streak.recordLoss();
  assert.deepEqual(TP.streak.save(), { ok: true, streak: 4 });
  assert.equal(store.state.gold, 700);
  assert.deepEqual(store.state.claimedStreakMilestones, [3], '복구한 연승의 받은 보상은 다시 주지 않음');
  assert.equal(store.state.winStreak, 4);
  assert.equal(TP.streak.save().reason, 'none', '세이브는 끊긴 연승 1번에 1회');
  assert.equal(TP.streak.recordWin().streak, 5, '복구한 연승에서 이어짐');

  TP.streak.recordLoss();
  store.update(s => { s.gold = 499; });
  assert.equal(TP.streak.save().reason, 'gold');
  assert.equal(store.state.winStreak, 0);
  TP.streak.forfeitSave();                   // 다음 판 입장
  assert.equal(TP.streak.canSave(), false);
}

// 7) 배수: 판돈·보상만 1x/2x/4x, 콤보 배율 버프는 콤보 보너스에만
{
  const e = { stockLeft: 1, bestCombo: 10 };
  // GDD 정산(코어 엔진 calculateSettlement): 150 + 남은 덱×5 + min(25, 최고 콤보×2)
  const totals = [1, 2, 4].map(x => TP.calcReward(e, x).total);
  assert.deepEqual(totals, [175, 350, 700], '(150 + 5 + 20) × 배수');
  assert.deepEqual(TP.MULTIPLIERS.map(m => m.fee), [100, 200, 400]);
  assert.equal(TP.calcReward({ stockLeft: 1, bestCombo: 5 }, 1, 1).bonus, 5 + 20, '콤보 배율 +1 → 콤보 보너스 2배');
  assert.equal(TP.calcReward(e, 1, 1).bonus, 5 + 25, '콤보 보너스 상한 25');
  assert.equal(TP.calcReward({ stockLeft: 20, bestCombo: 30 }, 1, 2).total, 220, '보너스는 최대 70');
  const s = TP.settleStage({ won: true, stockLeft: 1, bestCombo: 10 }, 2);
  assert.deepEqual([s.entryCost, s.grossReward, s.netProfit, s.clueEarned], [200, 350, 150, true], '판돈 100×배수, 순이익, 단서 획득');
  const lost = TP.settleStage({ won: false, stockLeft: 0, bestCombo: 3, remaining: 4 }, 4);
  assert.deepEqual([lost.grossReward, lost.netProfit, lost.clueEarned, lost.remainingBoardCards], [0, -400, false, 4], '패배 정산');
}

console.log('연승 사다리 테스트 통과');

// 연승 보상 힌트권: 7연승 +1 · 20연승 +1 · 30연승 +2
{
  const assert = require('assert');
  const HP = require('../js/core/home_progression_system.js');
  const by = Object.fromEntries(HP.WIN_STREAK_MILESTONES.map(m => [m.streak, m.hint || 0]));
  assert.deepEqual([by[3], by[7], by[10], by[20], by[30], by[50]], [0, 1, 0, 1, 2, 0]);
  assert.equal(HP.rollStreakReward(HP.WIN_STREAK_MILESTONES[1]).hint, 1);
  assert(TP.describeStreakReward(TP.streakReward(7)).includes('힌트권 1'));
  console.log('연승 힌트권 보상 통과');
}
