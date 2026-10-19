// =====================================================================
// 클리어 보장 덱 생성기 v2 (정답 수순 선행 + 역산 카드 배정 + 난이도 측정)
// =====================================================================
//
// [1단계] 정답 수순의 "골격"을 먼저 만든다 (카드 숫자는 아직 없음)
//   - 보드에서 앞면이 된 자리 중 하나를 치우기(P) 또는 덱 뽑기(D)를 무작위로 이어 붙인다.
//   - 이 과정에서 콤보 게이지 / 상자 / +1 보너스 카드로 덱이 "언제 몇 장 늘어나는지"를
//     엔진과 똑같은 규칙으로 시뮬레이션한다. 숫자와 무관한 규칙이라 골격만으로 계산된다.
//   - 그 결과 "정답 수순이 막히지 않으려면 처음 덱이 최소 몇 장 필요한가"(minStock)가 나온다.
//     시작 덱 = minStock + 여유(난이도별). 전문가 난이도는 여유 0장이고,
//     콤보 상자 없이는 덱이 모자라도록(=상자를 열어야만 클리어) 골격을 고른다.
//
// [2단계] 카드 숫자를 마지막 수부터 거꾸로 역산해 채운다
//   - 버림더미 맨 위를 바꾸는 수(시작 카드, 일반 카드 P, 덱 D, 와일드 P)를 순서대로 늘어놓으면
//     "일반 카드 P는 직전 맨 위 카드와 ±1"이라는 사슬 조건만 남는다 (직전이 와일드면 조건 없음).
//   - 마지막 카드부터 거꾸로, 다음 카드와 ±1인 카드를 남은 52장에서 골라 붙인다.
//   - 모든 단계가 규칙을 만족하므로, 정답 수순을 그대로 따라가면 반드시 클리어된다.
//   - ±1 카드가 바닥나 막히면 그 후보는 버리고 다시 만든다.
//
// [3단계] 난이도 측정 (무작위 플레이 시뮬레이션)
//   - "클리어 경로의 정확한 개수"는 수 순서만 바꾼 경로까지 세면 천문학적이라 의미 있는 지표가 아니다.
//     대신 "아무 낼 수 있는 카드나 무작위로 내는 플레이어"를 여러 번 돌려 승률을 잰다.
//     승률이 높다 = 정답으로 가는 길이 넓다 / 승률이 0에 가깝다 = 정답 경로가 좁다.
//   - 후보를 여러 개 만들어 난이도 등급의 목표 승률 구간에 드는 판을 고른다.
//
// [기본 빌더 = 하이브리드] TP.DEAL_ALGORITHM = 'core'
//   1·2단계의 골격과 숫자 배정은 js/core/tripeaks_core_engine.js 의 generateSolvableDeal
//   (제거 순서 → 콤보 런 분할 → 런마다 브릿지 카드 + ±1 워크, 숫자별 4장 재고 추적, 여유 카드 끼워 넣기)을
//   하트·섬 레이아웃과 보드 특수 카드에 맞게 확장해서 쓰고, 콤보 상자 덱 시뮬레이션과 3단계 난이도 측정은 그대로 둔다.
//   아래 tryBuild 는 이전 빌더('legacy') — generateDeal({ algorithm: 'legacy' }) 로 비교용 사용 가능.
//
// 같은 (seed, 난이도, 레이아웃)이면 항상 같은 판이 나온다 → 스테이지 고정·재도전에 사용.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});

  // 난이도 등급 (플레이어 레벨로 결정)
  //   wild/bonus : 보드에 깔리는 특수 카드 수   draws : 정답 수순의 덱 뽑기 횟수
  //   spare      : 정답에 필요한 최소 장수 위에 얹어 주는 여유 덱
  //   comboBias  : 정답 수순에 긴 콤보 구간이 나오는 정도
  //   winRate    : 목표 무작위 플레이 승률 구간
  TP.DIFFICULTY_TIERS = [
    { id: 'easy', name: '쉬움', minLevel: 1, wild: [1, 2], bonus: [2, 3], draws: [10, 14], spare: [7, 9], comboBias: 0.35, winRate: [0.5, 1] },
    { id: 'normal', name: '보통', minLevel: 10, wild: [1, 1], bonus: [1, 2], draws: [12, 16], spare: [3, 4], comboBias: 0.3, winRate: [0.2, 0.6] },
    { id: 'hard', name: '어려움', minLevel: 25, wild: [0, 1], bonus: [1, 2], draws: [14, 18], spare: [1, 1], comboBias: 0.35, winRate: [0.03, 0.25], candidates: 40 },
    { id: 'expert', name: '전문가', minLevel: 40, wild: [0, 0], bonus: [1, 1], draws: [15, 20], spare: [0, 0], comboBias: 0.5, requireChest: true, winRate: [0, 0.05], candidates: 90 },
  ];

  TP.getTier = id => TP.DIFFICULTY_TIERS.find(t => t.id === id) || TP.DIFFICULTY_TIERS[0];
  TP.tierForLevel = level => TP.DIFFICULTY_TIERS.filter(t => level >= t.minLevel).pop();

  const CANDIDATES = 10;   // 난이도 맞추기용 후보 판 수 (등급별 candidates로 덮어쓸 수 있음)
  const PLAYOUTS = 60;     // 후보 하나당 무작위 플레이 횟수
  const MAX_ATTEMPTS = 3000;

  const randIn = (rng, [a, b]) => a + Math.floor(rng() * (b - a + 1));

  // 콤보 목표 목록 (콤보가 0이 될 때마다 다음 목표): 목표는 [5, 7, 10, 15] 중 무작위
  //   5 · 7   → 100% 덱 +1~3장 (무작위)
  //   10 · 15 → 95% 덱 +5장, 5% 와일드 1개 또는 되돌리기 1개
  // 판 시드로 미리 굴려 두므로 같은 판은 늘 같은 목표·보상 → 생성기가 덱이 언제 늘어나는지 정확히 계산한다.
  TP.COMBO_GOALS = [5, 7, 10, 15];
  function makeChests(rng, count = 80) {
    return Array.from({ length: count }, () => {
      const target = TP.COMBO_GOALS[Math.floor(rng() * TP.COMBO_GOALS.length)];
      let reward;
      if (target <= 7) reward = { cards: 1 + Math.floor(rng() * 3) };
      else if (rng() < 0.95) reward = { cards: 5 };
      else reward = rng() < 0.5 ? { wildItem: 1 } : { undoItem: 1 };
      return { target, reward };
    });
  }

  // 정답 수순을 엔진과 같은 콤보 목표 규칙으로 따라가며 덱이 언제 늘어나는지 계산 → 필요한 최소 시작 덱
  //   콤보(보너스 카드 제외)가 목표와 같아지는 순간 보상 1번, 덱을 뽑으면 콤보 0 · 다음 목표
  function simulateStock(moves, specials, chests) {
    let combo = 0, goal = 0, reached = false, opened = 0;
    let gain = 0, gainNoChest = 0, drawsUsed = 0, minStock = 0, minStockNoChest = 0;
    for (const m of moves) {
      if (m.type === 'play') {
        if (specials[m.slot] === 'bonus') { gain++; gainNoChest++; continue; }   // +1 카드는 콤보를 올리지 않음
        combo++;
        const chest = chests[goal % chests.length];
        if (!reached && combo === chest.target) { reached = true; opened++; gain += chest.reward.cards || 0; }
      } else {
        drawsUsed++;
        combo = 0;
        reached = false;
        goal++;
        minStock = Math.max(minStock, drawsUsed - gain);
        minStockNoChest = Math.max(minStockNoChest, drawsUsed - gainNoChest);
      }
    }
    return { drawsUsed, minStock, minStockNoChest, opened };
  }

  // algorithm: 'core'   → js/core/tripeaks_core_engine.js 의 generateSolvableDeal (런 기반 ±1 워크) 로 골격·숫자 배정
  //            'legacy' → 아래 tryBuild (무작위 P/D 골격 + 마지막 수부터 역산)
  // 어느 쪽이든 콤보 상자·보너스 카드 덱 시뮬레이션과 난이도 측정(무작위 플레이 승률)은 공통.
  TP.generateDeal = function ({ seed, tierId = 'easy', layoutId, algorithm } = {}) {
    const tier = TP.getTier(tierId);
    // 기본: 20종 템플릿 중 시드로 고른 것을 그 시드로 변형 (js/layout-engine.js). 같은 시드 = 같은 배치 (재도전 · 이어하기)
    //   잘라내기 양(= 카드 수)은 난이도 등급으로: 쉬움 ≈ 20~22장 … 전문가 = 템플릿 그대로. 시드로 ±0.15 흔든다
    const tierDifficulty = { easy: 0.1, normal: 0.4, hard: 0.7, expert: 1 }[tier.id] ?? 0.5;
    const layoutDifficulty = Math.max(0, Math.min(1, tierDifficulty + (TP.mulberry32(seed ^ 0x27d4eb2f)() - 0.5) * 0.3));
    const layout = TP.getLayout(layoutId || (TP.layoutIdForSeed ? TP.layoutIdForSeed(seed, layoutDifficulty) : TP.LAYOUT_IDS[seed % TP.LAYOUT_IDS.length]));
    const rng = TP.mulberry32(seed);
    const useCore = (algorithm || TP.DEAL_ALGORITHM) === 'core' && globalThis.TriPeaksEngine;
    const build = useCore ? tryBuildCore : tryBuild;

    let best = null;
    let found = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && found < (tier.candidates || CANDIDATES); attempt++) {
      const deal = build(layout, tier, rng);
      if (!deal) continue;
      found++;
      Object.assign(deal, { seed, tierId: tier.id, layoutId: layout.id });
      deal.winRate = estimateWinRate(layout, deal, rng);
      const [lo, hi] = tier.winRate;
      deal.bandDistance = deal.winRate < lo ? lo - deal.winRate : deal.winRate > hi ? deal.winRate - hi : 0;
      if (!best || deal.bandDistance < best.bandDistance) best = deal;
      if (best.bandDistance === 0) break;
    }
    if (!best) throw new Error('클리어 보장 덱 생성에 실패했습니다.');
    return best;
  };

  function tryBuild(layout, tier, rng) {
    const nodes = layout.nodes;
    const n = nodes.length;

    // ---- 특수 카드 위치 ----
    const specials = {};
    const shuffled = TP.shuffle(nodes.map(nd => nd.id), rng);
    const nWild = randIn(rng, tier.wild);
    const nBonus = randIn(rng, tier.bonus);
    shuffled.slice(0, nWild).forEach(i => { specials[i] = 'wild'; });
    shuffled.slice(nWild, nWild + nBonus).forEach(i => { specials[i] = 'bonus'; });

    const chests = makeChests(rng);
    const regularCount = n - nWild - nBonus;
    const pileSize = 52 - regularCount - 1;

    // ---- [1단계] 정답 수순 골격 ----
    const removed = new Array(n).fill(false);
    const moves = [];
    let remaining = n;
    let drawsLeft = Math.min(randIn(rng, tier.draws), pileSize);
    let drawsUsed = 0;
    let lastWasPlay = null;

    while (remaining > 0) {
      let doPlay = true;
      if (drawsLeft > 0) {
        let p = remaining / (remaining + drawsLeft);
        if (lastWasPlay) p = Math.min(0.95, p + tier.comboBias);
        doPlay = rng() < p;
      }

      if (doPlay) {
        const open = nodes.filter(nd => !removed[nd.id] && nd.parents.every(p => removed[p])).map(nd => nd.id);
        const slot = TP.pick(open, rng);
        removed[slot] = true;
        remaining--;
        moves.push({ type: 'play', slot });
      } else {
        drawsLeft--;
        drawsUsed++;
        moves.push({ type: 'draw' });
      }
      lastWasPlay = doPlay;
    }
    const { minStock, minStockNoChest, opened: chestIdx } = simulateStock(moves, specials, chests);

    const initialStock = Math.max(1, minStock + randIn(rng, tier.spare));
    // 전문가: 콤보 상자 카드 없이는 덱이 모자라야 한다
    if (tier.requireChest && minStockNoChest <= initialStock) return null;

    // ---- [2단계] 카드 숫자 역산 ----
    // 버림더미 맨 위를 바꾸는 수만 순서대로 (보너스 카드는 맨 위를 바꾸지 않음)
    const setters = [{ type: 'start' }];
    let drawIdx = 0;
    for (const m of moves) {
      if (m.type === 'draw') setters.push({ type: 'draw', k: drawIdx++ });
      else if (specials[m.slot] === 'wild') setters.push({ type: 'wild' });
      else if (!specials[m.slot]) setters.push({ type: 'card', slot: m.slot });
    }

    const pool = TP.shuffle(TP.createDeck(), rng);
    const cards = new Array(setters.length);
    for (let j = setters.length - 1; j >= 0; j--) {
      if (setters[j].type === 'wild') continue;
      const next = setters[j + 1];
      let idx;
      if (next && next.type === 'card') {
        // 다음 수가 일반 카드면, 그 카드와 ±1인 카드여야 한다
        const adjacent = [];
        pool.forEach((c, k) => { if (TP.isAdjacent(c.rank, cards[j + 1].rank)) adjacent.push(k); });
        if (!adjacent.length) return null;
        idx = TP.pick(adjacent, rng);
      } else {
        idx = Math.floor(rng() * pool.length);
      }
      cards[j] = pool.splice(idx, 1)[0];
    }

    const board = new Array(n);
    const solutionDraws = [];
    setters.forEach((s, j) => {
      if (s.type === 'card') board[s.slot] = cards[j];
      else if (s.type === 'draw') solutionDraws[s.k] = cards[j];
    });
    for (const [slot, kind] of Object.entries(specials)) board[slot] = { special: kind, id: `${kind}-${slot}` };

    return {
      board,
      pile: [...solutionDraws, ...pool],   // 정답에 쓰이는 덱 카드 → 나머지(여분)
      initialStock,
      startCard: cards[0],
      chests,
      solution: moves,
      stats: { draws: drawsUsed, minStock, minStockNoChest, chestsOpened: chestIdx, wild: nWild, bonus: nBonus },
    };
  }

  // ---------------------------------------------------------------------
  // 하이브리드 빌더: 코어 엔진의 클리어 보장 역산 알고리즘 + 기존 엔진 규칙
  //   1) 특수 카드 위치를 정하고, 레이아웃(parents = 이 카드를 덮는 카드)을 코어 형식(coveredBy)으로 넘김
  //   2) 코어가 제거 순서 → 콤보 런 분할 → 런마다 브릿지 카드 + ±1 워크로 숫자 배정 → 여유 카드를 덱 사이에 섞음
  //   3) 코어의 덱 순서(stockOrder)를 그대로 pile 로 쓰고, 정답 수순에 여유 카드 드로우까지 펼쳐 넣음
  //   4) 그 수순을 콤보 상자·보너스 카드 규칙으로 시뮬레이션해 필요한 최소 시작 덱(minStock)을 구함
  // ---------------------------------------------------------------------
  TP.DEAL_ALGORITHM = 'core';
  const CORE_DIFFICULTY = { easy: 'easy', normal: 'normal', hard: 'hard', expert: 'expert' };
  const CORE_SUIT = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const fromCore = c => ({ rank: c.rank, suit: CORE_SUIT[c.suit], id: `${c.rank}${CORE_SUIT[c.suit]}` });

  function tryBuildCore(layout, tier, rng) {
    const nodes = layout.nodes;
    const specials = {};
    const shuffled = TP.shuffle(nodes.map(nd => nd.id), rng);
    const nWild = randIn(rng, tier.wild);
    const nBonus = randIn(rng, tier.bonus);
    shuffled.slice(0, nWild).forEach(i => { specials[i] = 'wild'; });
    shuffled.slice(nWild, nWild + nBonus).forEach(i => { specials[i] = 'bonus'; });

    let core;
    try {
      core = globalThis.TriPeaksEngine.generateSolvableDeal({
        rng, specials,
        difficulty: CORE_DIFFICULTY[tier.id] || 'normal',
        layout: nodes.map(nd => ({ id: nd.id, coveredBy: nd.parents })),
      });
    } catch (e) {
      return null;  // 브릿지 카드가 바닥난 드문 경우 → 다른 후보로
    }

    // 정답 수순 펼치기: 코어의 'draw' 단계 앞에 끼워진 여유 카드도 실제 드로우로 넣는다
    // 코어가 버린 여유 카드(약 40%)는 정답 수순에서 빠지고 덱 맨 뒤로 → 시작 덱이 줄고,
    // 이어하기(+5장) 등으로 정답 수순보다 더 뽑을 때만 나온다 (52장 한 벌 유지)
    const pile = [...core.stockOrder, ...(core.discardedCards || [])].map(fromCore);
    const moves = [];
    let ptr = 0;
    for (const step of core.solutionSteps) {
      if (step.type === 'play') { moves.push({ type: 'play', slot: step.slotId }); continue; }
      while (core.stockOrder[ptr].id !== step.cardId) { moves.push({ type: 'draw' }); ptr++; }
      moves.push({ type: 'draw' });
      ptr++;
    }

    // 콤보 목표 보상·보너스 카드로 덱이 언제 늘어나는지 시뮬레이션 → 최소 시작 덱
    const chests = makeChests(rng);
    const { drawsUsed, minStock, minStockNoChest, opened: chestIdx } = simulateStock(moves, specials, chests);
    const initialStock = Math.max(1, minStock + randIn(rng, tier.spare));
    if (tier.requireChest && minStockNoChest <= initialStock) return null;

    const board = nodes.map(nd => {
      const c = core.boardAssignment[nd.id];
      return c.special ? { special: c.special, id: c.id } : fromCore(c);
    });
    return {
      board,
      pile,
      initialStock,
      startCard: fromCore(core.initialActiveCard),
      chests,
      solution: moves,
      stats: { draws: drawsUsed, minStock, minStockNoChest, chestsOpened: chestIdx, wild: nWild, bonus: nBonus, algorithm: 'core' },
    };
  }

  // 무작위 플레이어: 낼 수 있는 보드 카드 중 아무거나, 없으면 덱 뽑기. 아이템은 쓰지 않는다.
  function estimateWinRate(layout, deal, rng) {
    let wins = 0;
    for (let k = 0; k < PLAYOUTS; k++) {
      const game = new TP.TriPeaksGame(layout, deal);
      for (;;) {
        const playable = [];
        for (let i = 0; i < game.board.length; i++) if (game.canPlay(i)) playable.push(i);
        if (playable.length) game.play(TP.pick(playable, rng));
        else if (!game.draw()) break;
      }
      if (game.remaining === 0) wins++;
    }
    return wins / PLAYOUTS;
  }
})();
