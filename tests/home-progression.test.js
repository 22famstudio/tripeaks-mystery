// 홈·성장 모듈(js/core/home_progression_system.js) + 기존 저장소 연결(js/home-bridge.js) 검증
//  A) 20분 하트 자동 충전 타이머
//  B) 레벨업 → 칭호·코스튬·입장료·보상 구간 상승, 배수 해금 (Lv.20 ×2, Lv.40 ×4)
//  C) 3 · 5 · 10 · 15 · 20연승 보상 지급
//  D) 게임 루프 연결: startStageWithBet / recordStageResult 가 TP.store(골드·하트·EXP·단서·연승)에 반영
// 실행: node tests/home-progression.test.js
require('../js/store.js');
require('../js/energy.js');
require('../js/economy.js');
require('../js/streak.js');
require('../js/data/episodes.js');
require('../js/mystery.js');
require('../js/card-backs.js');
require('../js/home-bridge.js');

const { TP } = globalThis;
const assert = require('assert');
const HP = require('../js/core/home_progression_system.js');
const MIN = 60 * 1000;
const T0 = new Date(2026, 9, 14, 9, 0, 0).getTime();
const log = (...a) => console.log('  ', ...a);

// 모듈 단독 인스턴스 (시간 주입, localStorage 없음)
function fresh(initialState = {}) {
  const clock = { t: T0 };
  const home = new HP.HomeGameManager({ nowFn: () => clock.t, initialState: { lastLifeRegenAt: T0, ...initialState } });
  return { home, clock };
}
const win = (home, extra = {}) => home.recordStageResult({ won: true, remainingStockCards: 4, maxStreak: 5, multiplier: 1, ...extra });

// ---------------------------------------------------------------------
console.log('A) 20분 하트 자동 충전');
{
  const { home, clock } = fresh();
  assert.equal(home.syncTimers().formattedTimer, 'MAX');
  for (let i = 0; i < 3; i++) assert(home.startStageWithBet(1).ok);          // 5 → 2
  let life = home.syncTimers();
  assert.equal(life.lives, 2);
  assert.equal(life.formattedTimer, '20:00', '꽉 찬 상태에서 처음 쓴 순간부터 20분');

  clock.t += 19 * MIN + 59e3;
  life = home.syncTimers();
  assert.deepEqual([life.lives, life.formattedTimer], [2, '00:01'], '19분 59초: 아직 충전 전');

  clock.t += 1e3;
  life = home.syncTimers();
  assert.deepEqual([life.lives, life.formattedTimer], [3, '20:00'], '20분: +1, 다음 타이머 다시 20분');

  clock.t += 50 * MIN;                                                        // 50분 더 → +2, 10분 이월
  life = home.syncTimers();
  assert.deepEqual([life.lives, life.formattedTimer], [5, 'MAX'], '최대 5개에서 멈춤');

  for (let i = 0; i < 5; i++) assert(home.startStageWithBet(1).ok);
  assert.equal(home.startStageWithBet(1).reason, 'NO_LIFE_REMAINING');
  clock.t += 45 * MIN;
  life = home.syncTimers();
  assert.deepEqual([life.lives, life.formattedTimer], [2, '15:00'], '45분: +2, 남은 5분은 다음 칸에 이월');
  assert.equal(home.getHomeUIModel().rightControls.lifeWidget.heartsDisplay, '♥♥♡♡♡');
  log('5→0개 소진 후 45분: ♥♥♡♡♡, 다음 충전 15:00 / 20분 경계 · 최대치 · 이월 정상');
}

// ---------------------------------------------------------------------
console.log('B) 레벨업 → 칭호 · 코스튬 · 입장료 상승, 배수 해금');
{
  const rows = [];
  for (const tier of HP.LEVEL_TIERS) {
    const { home } = fresh({ level: tier.minLv, gold: 1e6 });
    const bet = home.startStageWithBet(1);
    const ui = home.getHomeUIModel();
    assert.equal(bet.entryCostPaid, tier.baseEntryFee);
    assert.equal(ui.profileWidget.title, tier.title);
    assert.equal(ui.profileWidget.costumeName, tier.costumeName);
    assert.equal(ui.rightControls.playButton.multiplierOptions[0].rewardMin, tier.baseRewardMin);
    rows.push(`Lv.${tier.minLv} ${tier.title} (${tier.costumeName}) 입장료 ${tier.baseEntryFee}G 보상 ${tier.baseRewardMin}~${tier.baseRewardMax}G`);
  }
  rows.forEach(r => log(r));
  const fees = HP.LEVEL_TIERS.map(t => t.baseEntryFee);
  assert(fees.every((f, i) => i === 0 || f > fees[i - 1]), '구간이 오를수록 입장료 상승');

  // 실제 레벨업으로 구간 경계(13 → 14)를 넘는 경우
  const { home } = fresh({ level: 13, exp: HP.getRequiredExpForLevel(13) - 1, gold: 5000 });
  assert.equal(home.startStageWithBet(1).entryCostPaid, 100);
  const r = win(home);
  assert.deepEqual([r.levelUp.leveledUp, r.levelUp.newLevel, r.levelUp.costumeChanged], [true, 14, true]);
  assert.equal(r.levelUp.newTitle, '흥신소 수습 인턴');
  assert.equal(home.startStageWithBet(1).entryCostPaid, 150, '레벨업 직후 입장료 150G');
  log(`Lv.13 → 14 레벨업: 새 칭호 '${r.levelUp.newTitle}', 코스튬 '${r.levelUp.newCostumeName}', 입장료 100 → 150G`);

  // 배수 해금
  for (const [lv, x, ok] of [[19, 2, false], [20, 2, true], [39, 4, false], [40, 4, true]]) {
    const { home: h } = fresh({ level: lv, gold: 1e6 });
    const res = h.startStageWithBet(x);
    assert.equal(res.ok, ok, `Lv.${lv} ×${x}`);
    if (ok) assert.equal(res.entryCostPaid, HP.getTierForLevel(lv).baseEntryFee * x);
    else assert.equal(res.reason, 'LEVEL_TOO_LOW');
  }
  log('배수 해금: ×2 Lv.20 · ×4 Lv.40 (입장료 = 구간 입장료 × 배수)');
}

// ---------------------------------------------------------------------
console.log('C) 3 · 7 · 10 · 20 · 30연승 보상 (하트 포함) · 50연승 프레스티지 후 0으로 · 중복 플레이는 연승 제외');
{
  const { home } = fresh({ gold: 0, lives: 5, inventory: { undo: 0, wild: 0 } });
  const paid = [];
  let stageGold = 0;
  for (let i = 1; i <= 50; i++) {
    if (home.state.cluesCollectedInEpisode >= 20) home.state.cluesCollectedInEpisode = 0;   // 단서 20개 → 다음 에피소드 (단서를 얻는 판만 연승)
    const r = win(home);
    stageGold += r.goldEarned;
    if (r.streakRewardClaimed) paid.push(r.streakRewardClaimed);
  }
  assert.deepEqual(paid.map(m => m.streak), [3, 7, 10, 20, 30, 50]);
  const [m3, m7, m10, m20, m30, m50] = paid;
  assert(m50.prestige && !m50.gold, '50연승 = 프레스티지 (카드 뒷면은 바깥 — js/card-backs.js 에서 지급)');
  assert.deepEqual([m3.gold, m3.undo, m3.wild, m3.life], [0, 0, 0, 1], '3연승: 하트 +1');
  assert(m7.gold >= 100 && m7.gold <= 200 && m7.life === 1 && !m7.undo && !m7.wild, '7연승: 100~200G + 하트 1');
  assert(m10.gold >= 100 && m10.gold <= 200 && m10.life === 2, '10연승: 100~200G + 하트 2');
  assert(m20.gold >= 200 && m20.gold <= 500 && m20.undo >= 1 && m20.undo <= 2 && !m20.life, '20연승: 200~500G + 되돌리기 1~2');
  assert.deepEqual([m30.gold, m30.undo, m30.wild, m30.life], [500, 1, 1, 0], '30연승: 500G + 되돌리기 1 + 와일드 1');
  const sum = paid.reduce((t, m) => ({ gold: t.gold + m.gold, undo: t.undo + m.undo, wild: t.wild + m.wild, life: t.life + m.life }),
    { gold: 0, undo: 0, wild: 0, life: 0 });
  assert.equal(home.state.gold, stageGold + sum.gold, '연승 보상 골드가 실제로 지급됨');
  assert.deepEqual(home.state.inventory, { undo: sum.undo, wild: sum.wild });
  assert.equal(home.state.lives, 5 + sum.life, '하트 보상은 최대치(5)를 넘어 쌓임');
  assert.equal(home.syncTimers().lives, 5 + sum.life, '시간 동기화가 넘친 하트를 깎지 않음');
  assert.equal(home.state.winStreak, 0, '50연승 프레스티지 후 0으로 리셋');
  assert.deepEqual(home.state.claimedStreakMilestones, []);
  paid.forEach(m => log(`${m.streak}연승: ${TP.describeStreakReward(m)}`));
  log(`누적 ${sum.gold}G · 되돌리기 ${sum.undo} · 와일드 ${sum.wild} · 하트 ${sum.life} (예전 20연승 누적 2,500G · 5 · 2)`);

  // 중복 플레이(단서를 얻지 못한 승리)는 연승을 올리지 않고 유지
  const { home: h3 } = fresh();
  win(h3); win(h3);
  const replay = h3.recordStageResult({ won: true, remainingStockCards: 4, maxStreak: 5, multiplier: 1, clueEligible: false });
  assert.deepEqual([replay.newClueUnlocked, replay.streakCounted, replay.winStreak], [false, false, 2], '중복 플레이: 연승 2 유지');
  assert(replay.goldEarned > 0, '골드·EXP는 그대로 받음');
  assert.equal(win(h3).streakRewardClaimed.streak, 3, '다음 첫 클리어에서 3연승');

  // 패배 시 초기화 → 다시 3연승하면 다시 지급
  const { home: h2 } = fresh();
  win(h2); win(h2);
  h2.recordStageResult({ won: false });
  assert.equal(h2.state.winStreak, 0);
  assert.equal(win(h2).winStreak, 1);
  assert.equal(win(h2).streakRewardClaimed, null);
  assert.equal(win(h2).streakRewardClaimed.streak, 3, '패배 후 다시 3연승하면 다시 지급');

  // 에피소드 해결 기본 보상 1,000G · 되돌리기 1 · 와일드 1
  const { home: h4 } = fresh({ gold: 0, cluesCollectedInEpisode: 20, inventory: { undo: 0, wild: 0 } });
  const done = h4.completeCurrentEpisode();
  assert(done.ok);
  assert.deepEqual([h4.state.gold, h4.state.inventory.undo, h4.state.inventory.wild], [1000, 1, 1]);
}

// ---------------------------------------------------------------------
console.log('D) 게임 루프 연결 (TP.home ↔ TP.store)');
{
  let now = T0;
  TP.now = () => now;
  const store = TP.store;
  const home = TP.home;
  store.reset();

  // 입장: 하트 1 + 입장료
  const bet = home.startStageWithBet(1);
  assert(bet.ok);
  assert.deepEqual([store.state.gold, store.state.energy, store.state.lastEnergyTime], [1400, 4, T0]);
  assert.equal(TP.energy.status().nextInMs, 20 * MIN, '기존 에너지 시스템과 같은 타이머');

  // 클리어: 골드 · EXP · 단서 1(다음 스테이지) · 연승
  const r = home.recordStageResult({ won: true, remainingStockCards: 6, maxStreak: 8, multiplier: 1, stage: 1 });
  assert.equal(store.state.gold, 1400 + r.goldEarned);
  assert.equal(store.state.exp, r.expEarned);
  assert.deepEqual([store.state.episode.cleared, store.state.episode.unread, store.state.winStreak], [1, 1, 1]);
  assert.equal(r.clue, TP.mystery.episode.clues[0], '단서 #1 해금');
  log(`클리어: +${r.goldEarned}G · +${r.expEarned} EXP · 단서 #1 해금 · 1연승`);

  // 재도전(이미 받은 스테이지)은 단서 없음 · 연승도 오르지 않고 유지
  home.startStageWithBet(1);
  const again = home.recordStageResult({ won: true, remainingStockCards: 0, maxStreak: 0, multiplier: 1, stage: 1 });
  assert.equal(again.clue, null);
  assert.equal(store.state.episode.cleared, 1, '재도전은 골드·EXP만');
  assert.equal(store.state.winStreak, 1, '재도전은 연승 +0 (초기화도 안 됨)');
  home.startStageWithBet(1);
  home.recordStageResult({ won: true, remainingStockCards: 0, maxStreak: 0, multiplier: 1, stage: 2 });
  assert.equal(store.state.winStreak, 2, '다음 스테이지 첫 클리어는 연승 +1');

  // 상점 구매 등 다른 시스템의 변경이 모듈에 바로 보임 (저장소 하나)
  store.grant({ gold: 1000, undo: 2 });
  const ui = home.uiModel();
  assert.equal(ui.topBar.gold, store.state.gold);
  assert.equal(ui.inventory.undo, store.state.undoCount);
  assert.equal(ui.centerStage.clueText, 'CLUE : 02/20');
  assert.equal(ui.centerStage.episodeTitle, TP.mystery.episode.title);
  assert.equal(ui.profileWidget.title, '오지랖 넓은 시민 I');
  assert(ui.topBar.specialOffer.available && ui.topBar.specialOffer.timerText === '24:00:00');

  // 무한 하트 중에는 하트를 쓰지 않음
  store.update(s => { s.energy = 0; s.infiniteEnergyUntil = now + 30 * MIN; });
  const free = home.startStageWithBet(1);
  assert(free.ok && free.lifeSpent === 0 && store.state.energy === 0);
  store.update(s => { s.infiniteEnergyUntil = 0; s.energy = 5; });

  // 패배: 연승 초기화 + 500G 세이브 대기 + 위로 EXP 15 저장
  const exp0 = store.state.exp;
  const lose = home.recordStageResult({ won: false, multiplier: 1 });
  assert.deepEqual([store.state.winStreak, store.state.lostStreak, lose.lostStreak], [0, 2, 2]);
  assert.equal(store.state.exp, exp0 + 15, '패배 위로 EXP 15가 저장됨 (모듈 원본은 저장 누락)');
  assert.deepEqual(TP.streak.save(), { ok: true, streak: 2 });

  // 50연승: 보상은 한 번씩 (하트는 저장소 energy 로), 50연승 프레스티지 = 카드 뒷면 해제 후 0으로 리셋
  store.reset();
  store.update(s => { s.gold = 0; s.episode.cleared = 0; });
  const claimed = [];
  for (let i = 1; i <= 50; i++) {
    store.update(s => { s.episode.cleared = (i - 1) % 20; });      // 매 판 '다음 스테이지' 첫 클리어 (단서 20개 넘지 않게)
    const w = home.recordStageResult({ won: true, remainingStockCards: 0, maxStreak: 0, multiplier: 1, stage: ((i - 1) % 20) + 1 });
    if (w.streakRewardClaimed) claimed.push(w.streakRewardClaimed);
  }
  assert.deepEqual(claimed.map(m => m.streak), [3, 7, 10, 20, 30, 50]);
  const prestige = claimed[5].prestigeResult;
  assert.equal(prestige.type, 'cardBack', '게임 루프에서 50연승 → 카드 뒷면 해제');
  assert(store.state.ownedCardBacks.includes(prestige.back.id) && store.state.equippedCardBack === prestige.back.id);
  assert.equal(store.state.energy, 5 + 1 + 1 + 2, '하트 보상 4개가 생명력으로 (최대치 초과 허용)');
  assert.equal(store.state.winStreak, 0, '50연승 프레스티지 후 0으로');
  assert.equal(store.state.bestStreak, 50);

  // 레벨 구간 상승이 입장 모달 가격에 반영
  store.update(s => { s.playerLevel = 14; s.gold = 5000; });
  const opts = home.uiModel().rightControls.playButton.multiplierOptions;
  assert.deepEqual(opts.map(o => [o.multiplier, o.cost, o.unlocked]), [[1, 150, true], [2, 300, false], [4, 600, false]]);
  assert.equal(home.startStageWithBet(1).entryCostPaid, 150);
  log('입장료·하트 차감, 정산(골드·EXP·단서·연승), 재도전 단서 없음, 무한 하트, 500G 세이브, 재도전 연승 제외, 50연승 프레스티지 · 리셋 정상');
}

console.log('E) 베팅 배수 · 판돈 차감 · 정산 (기본 보상 × 배수)');
{
  // Lv.1~13 구간: ×1 100G · ×2 200G · ×4 400G (×2는 Lv.20, ×4는 Lv.40 해금)
  const lv = level => fresh({ level, gold: 5000 }).home;
  assert.equal(lv(1).startStageWithBet(2).reason, 'LEVEL_TOO_LOW');
  assert.equal(lv(19).startStageWithBet(4).requiredLevel, 40);
  assert.equal(lv(1).startStageWithBet(1).entryCostPaid, 100);
  const opts = lv(1).getHomeUIModel().rightControls.playButton.multiplierOptions;
  assert.deepEqual(opts.map(o => [o.multiplier, o.unlocked]), [[1, true], [2, false], [4, false]], '잠긴 배수 = 자물쇠');
  // 판돈은 입장 즉시 차감, 골드가 모자라면 시작 불가 (하트도 그대로)
  const poor = fresh({ gold: 99 }).home;
  const r0 = poor.startStageWithBet(1);
  assert.equal(r0.reason, 'INSUFFICIENT_GOLD');
  assert.equal(poor.state.lives, 5);
  assert.equal(poor.state.gold, 99);
  // 기본 보상 150~220 (남은 덱 · 콤보 비례) × 배수
  for (const x of [1, 2, 4]) {
    const h = fresh({ level: 1, gold: 9999 }).home;     // 1구간 보상표로 비교 (해금 검사는 위에서)
    const lo = h.recordStageResult({ won: true, remainingStockCards: 0, maxStreak: 0, multiplier: x, clueEligible: false });
    const hi = h.recordStageResult({ won: true, remainingStockCards: 12, maxStreak: 10, multiplier: x, clueEligible: false });
    assert.equal(lo.baseReward, 150);
    assert.equal(hi.baseReward, 220);
    assert.equal(lo.goldEarned, 150 * x);
    assert.equal(hi.goldEarned, 220 * x);
  }
  // 실패: 골드 보상 0, 판돈은 돌려주지 않음
  const f = fresh({ gold: 1000 }).home;
  f.startStageWithBet(1);
  assert.equal(f.recordStageResult({ won: false, multiplier: 1 }).goldEarned, 0);
  assert.equal(f.state.gold, 900);
  log('×1 100G / ×2 200G(Lv.20) / ×4 400G(Lv.40), 골드 부족 시작 불가, 보상 150~220 × 배수, 실패 0G');
}

console.log('홈·성장 시스템 테스트 통과');
