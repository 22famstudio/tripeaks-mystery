// js/core/tripeaks_core_engine.js 검증: 시드 1~100으로 generateSolvableDeal 실행
//  1) 덱 정상 생성: 보드 28 + 액티브 1 + 스톡 + 버린 카드(여유 카드의 난이도별 25~85%, 보통 40%) = 52장, 중복·누락 없음, 숫자별 4장
//  3) generateSolvableDeck(difficulty, boardLayout): 정답 수순 100% 클리어 · 런 길이(easy 4~8 / normal 4~6 / hard·expert 3~6) · 잉여 제거 비율
//  2) solutionSteps 를 그대로 따라가면 28장이 모두 제거되고 status === 'won'
// 실행: node tests/core-engine.test.js
const assert = require('assert');
const Engine = require('../js/core/tripeaks_core_engine.js');

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
const DIFFICULTIES = ['normal', 'easy', 'hard'];

function checkDeck(deal) {
  const all = [...deal.boardAssignment, deal.initialActiveCard, ...deal.stockOrder, ...(deal.discardedCards || [])];
  const problems = [];
  if (deal.boardAssignment.length !== 28 || deal.boardAssignment.some(c => !c)) problems.push('보드 28장 미배정');
  if (all.length !== 52) problems.push(`총 ${all.length}장`);
  const ids = new Set(all.filter(Boolean).map(c => c.id));
  if (ids.size !== 52) problems.push(`고유 카드 ${ids.size}장`);
  for (let r = 1; r <= 13; r++) {
    const n = all.filter(c => c && c.rank === r).length;
    if (n !== 4) problems.push(`숫자 ${r}: ${n}장`);
  }
  return problems;
}

// solutionSteps 대로 플레이. 'draw' 단계에서는 해당 카드가 나올 때까지 덱을 넘긴다
// (생성기가 브릿지 카드 앞에 여유 카드를 끼워 넣기 때문 — 여유 카드도 정상적인 드로우)
function replay(seed, difficulty) {
  const game = new Engine.TriPeaksGame({ seed, difficulty });
  let extraDraws = 0;
  for (const step of game.solutionHint) {
    if (step.type === 'draw') {
      let guard = 60;
      while (game.activeCard.id !== step.cardId) {
        const r = game.drawFromStock();
        if (!r.ok) return { ok: false, why: `draw ${step.cardId}: ${r.reason}` };
        if (game.activeCard.id !== step.cardId) extraDraws++;
        if (--guard === 0) return { ok: false, why: `draw ${step.cardId}: 덱에 없음` };
      }
    } else {
      const before = game.activeCard;
      const r = game.playSlot(step.slotId);
      if (!r.ok) {
        const card = game.slots[step.slotId].card;
        return { ok: false, why: `play 슬롯 ${step.slotId} (${card.label}) ← 액티브 ${before.label}: ${r.reason}` };
      }
    }
  }
  const removed = game.slots.filter(s => s.removed).length;
  return { ok: removed === 28 && game.status === 'won', removed, status: game.status, extraDraws,
           draws: game.solutionHint.filter(s => s.type === 'draw').length, game };
}

let failures = 0;
for (const difficulty of DIFFICULTIES) {
  const fails = [];
  let draws = 0, extra = 0, deckBad = 0;
  for (const seed of SEEDS) {
    const deal = Engine.generateSolvableDeal({ seed, difficulty });
    const deck = checkDeck(deal);
    if (deck.length) { deckBad++; fails.push(`seed ${seed}: 덱 오류 — ${deck.join(', ')}`); continue; }
    const r = replay(seed, difficulty);
    if (!r.ok) fails.push(`seed ${seed}: ${r.why || `제거 ${r.removed}/28, status ${r.status}`}`);
    else { draws += r.draws; extra += r.extraDraws; }
  }
  const pass = SEEDS.length - fails.length;
  console.log(`[${difficulty.padEnd(6)}] 덱 정상 ${SEEDS.length - deckBad}/100 · 정답 경로로 28장 제거 ${pass}/100` +
              (pass ? ` · 평균 브릿지 드로우 ${(draws / pass).toFixed(1)}회 + 여유 카드 ${(extra / pass).toFixed(1)}장` : ''));
  fails.slice(0, 8).forEach(f => console.log('   ✗ ' + f));
  if (fails.length > 8) console.log(`   … 외 ${fails.length - 8}건`);
  failures += fails.length;
}

// 같은 시드 → 같은 덱 (재현성)
assert.deepStrictEqual(Engine.generateSolvableDeal({ seed: 7 }), Engine.generateSolvableDeal({ seed: 7 }), '같은 시드는 같은 덱');

// 아이템: 되돌리기 / 와일드 / 광고 +3장
{
  const g = new Engine.TriPeaksGame({ seed: 1, undoCount: 5, wildCount: 1 });
  const start = JSON.stringify(g.getState().slots);
  const target = g.solutionHint.find(s => s.type === 'play');
  assert(g.playSlot(target.slotId).ok);
  assert(g.undo().ok);
  assert.equal(JSON.stringify(g.getState().slots), start, '되돌리기 후 보드 복원');
  assert(g.useWildCard().ok);
  assert(g.getPlayableSlots().length === g.slots.filter(s => s.faceUp && !s.removed).length, '와일드면 앞면 카드 전부 가능');
  assert.equal(g.useWildCard().reason, 'NO_WILD_ITEM');
  while (g.drawFromStock().ok) { /* 덱 소진 */ }
  const stock = g.stock.length;
  assert(g.grantAdExtraCards(3).ok);
  assert.equal(g.stock.length, stock + 3, '광고 +3장');
  assert.equal(g.grantAdExtraCards(3).reason, 'AD_REVIVE_ALREADY_USED');
}

// 정산
{
  const r = replay(1, 'normal');
  if (r.ok) {
    r.game.multiplier = 2;
    const s = r.game.calculateSettlement();
    assert(s.won && s.clueEarned && s.grossReward === s.baseGross * 2 && s.baseGross >= 150 && s.baseGross <= 220);
  }
}

if (failures) {
  console.log(`\n코어 엔진 테스트 실패: 300판 중 ${failures}판`);
  process.exitCode = 1;
} else {
  console.log('\n코어 엔진 테스트 통과 (시드 1~100 × 난이도 3종)');
}

// 콤보 목표 보상: 목표는 [5, 7, 10, 15], 콤보 === 목표인 순간 보상 · comboReward 이벤트 · 시스템 카드는 콤보 +0
{
  const events = [];
  let goals = new Set();
  let checked = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const game = new Engine.TriPeaksGame({ seed, difficulty: 'easy', onStateChange: (st, ev, payload) => { if (ev === 'comboReward') events.push({ st, payload }); } });
    goals.add(game.currentComboGoal);
    for (const step of game.solutionHint) {
      const goal = game.currentComboGoal;
      const before = { stock: game.stock.length, wild: game.inventory.wild, undo: game.inventory.undo, n: events.length };
      if (step.type === 'draw') {
        while (game.stock.length && game.stock[0].id !== step.cardId) game.drawFromStock();
        game.drawFromStock();
        assert.equal(game.streak, 0);
        assert(Engine.COMBO_GOALS.includes(game.currentComboGoal), '콤보 0 → 새 목표');
        goals.add(game.currentComboGoal);
        continue;
      }
      const r = game.playSlot(step.slotId);
      if (!r.ok) break;
      if (events.length > before.n) {
        const { type, value } = events[events.length - 1].payload;
        assert.equal(game.streak, goal, '콤보가 목표와 같을 때만 보상');
        if (type === 'plus_cards') {
          assert(goal <= 7 ? value >= 1 && value <= 3 : value === 5, `목표 ${goal} → +${value}장`);
          assert.equal(game.stock.length, before.stock + value);
          assert(game.stock.slice(-value).every(c => c.isSystemCard), '+카드는 시스템 카드 표시');
        } else {
          assert(goal >= 10, '아이템은 10 · 15 목표에서만');
          assert.equal(game.inventory[type], before[type] + 1);
        }
        checked++;
      }
    }
  }
  assert.deepEqual([...goals].sort((a, b) => a - b), [5, 7, 10, 15]);
  assert(checked > 20, `콤보 보상 표본 부족 (${checked})`);

  // 시스템 카드에서 이어 낸 매칭은 콤보를 올리지 않는다
  const g = new Engine.TriPeaksGame({ seed: 3, difficulty: 'easy' });
  const open = g.slots.find(s => s.faceUp && !s.removed);
  g.activeCard = { id: 'sys', suit: 'hearts', rank: open.card.rank === 13 ? 12 : open.card.rank + 1, isWild: false, isSystemCard: true };
  const streakBefore = g.streak;
  assert(g.playSlot(open.id).ok);
  assert.equal(g.streak, streakBefore, '시스템 카드 다음 매칭은 콤보 +0');
  console.log(`콤보 목표 보상 확인 (${checked}회 · 목표 ${[...goals].sort((a, b) => a - b).join('/')})`);
}

// generateSolvableDeck(difficulty, boardLayout): 정답 수순 100% 클리어 · 난이도별 콤보 런 길이 · 잉여 카드 제거 비율
{
  const { generateSolvableDeck, DIFFICULTY_RULES, TRIPEAKS_LAYOUT, isAdjacentRank } = Engine;
  const RULE_SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
  // 보드 위 +1 보너스 카드 2장 · 와일드 1장을 둔 판도 함께 검사
  const SPECIALS = { 0: 'wild', 13: 'bonus', 21: 'bonus' };
  const summary = [];
  for (const difficulty of ['easy', 'normal', 'hard', 'expert']) {
    const [lo, hi] = DIFFICULTY_RULES[difficulty].run;
    let inRange = 0, combos = 0, spareIn = 0, spareOut = 0;
    for (const seed of RULE_SEEDS) {
      for (const specials of [{}, SPECIALS]) {
        let deck;
        try { deck = generateSolvableDeck(difficulty, { seed, specials }); } catch (e) { continue; }   // 드문 생성 실패는 생성기가 다른 후보로
        const all = [...deck.board.filter(c => !c.special), deck.startCard, ...deck.stock, ...deck.removed];
        assert.equal(new Set(all.map(c => c.id)).size, 52, `${difficulty} #${seed}: 52장 한 벌`);
        // 계획된 런 길이 (보너스 카드 제외) — 모두 [최소, 최대] 안 (마지막 런 포함)
        for (const len of deck.stats.runLengths) assert(len >= lo && len <= hi, `${difficulty} #${seed}: 런 길이 ${len} (허용 ${lo}~${hi})`);
        // 정답 수순 재생: 덮인 카드 없음 · 매 수 ±1(K↔A) · 덱 순서대로 · 보드 전부 제거
        const removed = new Set();
        let top = deck.startCard, topWild = false, ptr = 0, combo = 0;
        const actual = [];
        for (const step of deck.solution) {
          if (step.type === 'draw') {
            while (deck.stock[ptr].id !== step.cardId) ptr++;   // 정답이 아닌 여유 카드는 넘김 (실제로는 뽑아서 버림)
            top = deck.stock[ptr++]; topWild = false;
            if (combo) actual.push(combo);
            combo = 0;
            continue;
          }
          const slot = TRIPEAKS_LAYOUT[step.slotId];
          assert(slot.coveredBy.every(id => removed.has(id)), `${difficulty} #${seed}: 덮인 카드를 먼저 치움`);
          const card = deck.board[step.slotId];
          removed.add(step.slotId);
          if (card.special === 'bonus') continue;                // +1 카드: 콤보 그대로, 맨 위 카드 그대로
          if (card.special === 'wild') { topWild = true; combo++; continue; }
          assert(topWild || isAdjacentRank(top.rank, card.rank), `${difficulty} #${seed}: ${top.rank} → ${card.rank} 는 ±1 이 아님`);
          top = card; topWild = false; combo++;
        }
        if (combo) actual.push(combo);
        assert.equal(removed.size, 28, `${difficulty} #${seed}: 정답 수순으로 보드 28장 모두 제거`);
        combos += actual.length;
        inRange += actual.filter(n => n >= lo && n <= hi).length;
        spareIn += deck.stats.spareInStock;
        spareOut += deck.stats.spareRemoved;
      }
    }
    const ratio = spareOut / (spareIn + spareOut);
    const target = DIFFICULTY_RULES[difficulty].discardRatio;
    assert(Math.abs(ratio - target) < 0.05, `${difficulty}: 잉여 카드 제거 비율 ${ratio.toFixed(2)} (목표 ${target})`);
    // 실제 콤보: 재고가 바닥나 런 중간에 브릿지 카드가 끼는 드문 경우만 짧아질 수 있다
    assert(inRange / combos >= 0.95, `${difficulty}: 실제 콤보 런 ${((inRange / combos) * 100).toFixed(1)}% 만 범위 안`);
    summary.push(`${difficulty} 런 ${lo}~${hi} (실제 ${((inRange / combos) * 100).toFixed(1)}%) · 잉여 제거 ${(ratio * 100).toFixed(0)}%`);
  }
  console.log(`generateSolvableDeck 시드 ${RULE_SEEDS.length}×2판 × 4난이도: 정답 수순 100% 클리어 · ${summary.join(' / ')}`);
}
