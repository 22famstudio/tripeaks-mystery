/**
 * TriPeaks Mystery Solitaire - Core Engine & Guaranteed Solvable Deck Generator
 * =============================================================================
 * GDD 3장(솔리테어 코어 게임플레이 규칙) 및 4장(재화 경제 & 배수 시스템) 완벽 구현 모듈:
 * 1. 트라이픽스(TriPeaks) 28장 표준 3-피라미드 배치 및 상하위 카드 블로킹(겹침) 판정
 * 2. ±1 숫자 연결 및 K(13) <-> A(1) 순환 연결 (Wrap-around) 규칙
 * 3. 클리어 보장 덱 생성 알고리즘 (Reverse-Constructed Solvable Deck Algorithm)
 *    - 보드가 비어있는 '클리어 상태'에서 역순으로 카드를 회수/배치하는 경로를 먼저 설계하여
 *      플레이어가 올바른 선택을 하면 수학적으로 100% 클리어 가능함을 보장합니다.
 * 4. 특수 아이템 시스템:
 *    - 되돌리기 (Undo): 직전 행동(보드 카드 제거, 덱 드로우, 와일드카드 사용) 완벽 복원
 *    - 와일드 카드 (Wild Card / Joker): 현재 활성 카드와 무관하게 어떤 카드든 즉시 매칭 가능
 * 5. 보상형 광고 부활: 실패 시 덱에 카드 3장 추가 드로우 제공
 * 6. 배수(1x, 2x, 4x) 및 남은 카드/콤보 기반 골드 정산 시스템
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TriPeaksEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];
  const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const RANK_LABELS = {
    1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
    8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 0: 'JOKER'
  };

  /**
   * 표준 트라이픽스 28장 슬롯 레이아웃 정의
   * - Row 0 (3장): 봉우리 3개 (0, 1, 2)
   * - Row 1 (6장): (3, 4), (5, 6), (7, 8)
   * - Row 2 (9장): (9, 10, 11), (12, 13, 14), (15, 16, 17)
   * - Row 3 (10장, 최하단 오픈 카드): 18 ~ 27
   * coveredBy: 이 슬롯을 덮고 있는(블로킹하는) 아래 줄 슬롯 ID 배열
   */
  const TRIPEAKS_LAYOUT = [
    // Row 0 (Peaks)
    { id: 0, row: 0, col: 1.5, coveredBy: [3, 4] },
    { id: 1, row: 0, col: 4.5, coveredBy: [5, 6] },
    { id: 2, row: 0, col: 7.5, coveredBy: [7, 8] },

    // Row 1
    { id: 3, row: 1, col: 1.0, coveredBy: [9, 10] },
    { id: 4, row: 1, col: 2.0, coveredBy: [10, 11] },
    { id: 5, row: 1, col: 4.0, coveredBy: [12, 13] },
    { id: 6, row: 1, col: 5.0, coveredBy: [13, 14] },
    { id: 7, row: 1, col: 7.0, coveredBy: [15, 16] },
    { id: 8, row: 1, col: 8.0, coveredBy: [16, 17] },

    // Row 2
    { id: 9,  row: 2, col: 0.5, coveredBy: [18, 19] },
    { id: 10, row: 2, col: 1.5, coveredBy: [19, 20] },
    { id: 11, row: 2, col: 2.5, coveredBy: [20, 21] },
    { id: 12, row: 2, col: 3.5, coveredBy: [21, 22] },
    { id: 13, row: 2, col: 4.5, coveredBy: [22, 23] },
    { id: 14, row: 2, col: 5.5, coveredBy: [23, 24] },
    { id: 15, row: 2, col: 6.5, coveredBy: [24, 25] },
    { id: 16, row: 2, col: 7.5, coveredBy: [25, 26] },
    { id: 17, row: 2, col: 8.5, coveredBy: [26, 27] },

    // Row 3 (Bottom Row - Initially Face Up)
    { id: 18, row: 3, col: 0.0, coveredBy: [] },
    { id: 19, row: 3, col: 1.0, coveredBy: [] },
    { id: 20, row: 3, col: 2.0, coveredBy: [] },
    { id: 21, row: 3, col: 3.0, coveredBy: [] },
    { id: 22, row: 3, col: 4.0, coveredBy: [] },
    { id: 23, row: 3, col: 5.0, coveredBy: [] },
    { id: 24, row: 3, col: 6.0, coveredBy: [] },
    { id: 25, row: 3, col: 7.0, coveredBy: [] },
    { id: 26, row: 3, col: 8.0, coveredBy: [] },
    { id: 27, row: 3, col: 9.0, coveredBy: [] }
  ];

  /**
   * 난이도별 정답 수순 규칙
   *   run          : 정답 수순의 콤보 런 길이 [최소, 최대] — 덱을 한 번 뽑은 뒤 보드 카드를 몇 장 연속으로 치우는가
   *                  (+1 보너스 카드는 콤보를 올리지도 끊지도 않으므로 이 길이에 세지 않는다)
   *   discardRatio : 정답에 필요 없는 잉여 덱 카드 중 판에서 빼는 비율 — 높을수록 여유 드로우가 적다
   *                  (빠진 카드는 덱 맨 뒤로 가서 이어하기 등으로 정답보다 더 뽑을 때만 나온다)
   */
  const DIFFICULTY_RULES = {
    easy:   { run: [4, 8], discardRatio: 0.25 },   // 콤보 길게 · 여유 카드 많이
    normal: { run: [4, 6], discardRatio: 0.4 },
    hard:   { run: [3, 6], discardRatio: 0.55 },
    expert: { run: [3, 6], discardRatio: 0.85 },   // 여유 카드 거의 없음 (콤보 상자 보상이 필요)
  };

  /**
   * 시드 기반 난수 생성기 (Mulberry32)
   * 동일한 스테이지/시드에서는 재현 가능한 덱 생성 지원
   */
  function createRNG(seed) {
    let s = (typeof seed === 'number' && !isNaN(seed)) ? seed >>> 0 : (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 두 숫자가 ±1 관계(K-A 순환 포함)인지 확인
   * 와일드카드(rank === 0 또는 isWild === true)는 항상 매칭 성공
   */
  function isAdjacentRank(rankA, rankB, isWildA = false, isWildB = false) {
    if (isWildA || isWildB || rankA === 0 || rankB === 0) return true;
    const diff = Math.abs(rankA - rankB);
    return diff === 1 || diff === 12; // 13(K)과 1(A)의 차이는 12
  }

  /**
   * 특정 숫자에서 ±1로 연결되는 이웃 숫자 반환
   */
  function getAdjacentRank(rank, delta) {
    // delta: +1 or -1
    return ((rank - 1 + delta + 13) % 13) + 1;
  }

  /**
   * =========================================================================
   * 핵심: 클리어 보장 덱 생성 알고리즘 (Reverse-Constructed Solvable Deck)
   * =========================================================================
   * 원리:
   * 1. 28장의 피라미드 슬롯이 제거되는 유효한 위상 정렬 순서(Topological Removal Order)를 시뮬레이션합니다.
   *    (즉, 아래 줄 카드가 먼저 제거되어야 윗줄 카드가 노출되어 제거될 수 있음)
   * 2. 총 28장의 보드 카드를 몇 번의 스트릭(연속 콤보 구간, 예: 1~6장씩 끊어서)으로 클리어할지 분할합니다.
   *    스트릭 사이에는 덱(Stock)에서 드로우한 카드가 다리(Bridge) 역할을 합니다.
   * 3. 각 스트릭 구간마다 시작 카드 숫자를 정하고, 연속으로 제거될 보드 슬롯들에 ±1(K-A 순환 포함)로
   *    이어지는 숫자를 배정합니다.
   * 4. 표준 52장 카드 풀(각 숫자 4장씩)의 재고를 추적하며, 만약 특정 숫자의 재고(4장)가 소진되면
   *    반대 방향(±1)으로 꺾거나 덱 드로우(Stock)로 세션을 전환하여 실제 52장 트럼프 덱 구성을 유지합니다.
   * 5. 남는 스톡 카드들은 드로우 순서 중간중간에 자연스러운 '함정/여유 드로우 카드'로 배치하여
   *    100% 클리어 가능하면서도 긴장감 있는 퍼즐을 완성합니다.
   */
  //
  // (확장 옵션 — 기존 게임 엔진의 다른 레이아웃과 특수 카드에 그대로 쓰기 위함. 생략하면 원래 동작과 같다)
  //   layout   : [{ id, coveredBy: [id...] }]  임의 배치 (하트·섬 등). 기본 TRIPEAKS_LAYOUT 28장
  //   specials : { [slotId]: 'wild' | 'bonus' }  보드 위 특수 카드 자리
  //              wild  → 획득하면 액티브 카드가 만능이 되므로 다음 카드는 아무 숫자나 가능
  //              bonus → 덱 +1장, 액티브 카드는 그대로이므로 ±1 사슬이 끊기지 않고 이어진다
  //   rng      : 외부 난수 함수 (지정 시 seed 대신 사용)
  function generateSolvableDeal(options = {}) {
    const rng = typeof options.rng === 'function' ? options.rng : createRNG(options.seed);
    const difficulty = DIFFICULTY_RULES[options.difficulty] ? options.difficulty : 'normal'; // 'easy' | 'normal' | 'hard' | 'expert'
    const rules = DIFFICULTY_RULES[difficulty];
    const layout = options.layout || TRIPEAKS_LAYOUT;
    const specials = options.specials || {};
    const slotCount = layout.length;

    // 1. 52장 표준 카드 풀 생성 및 셔플
    const cardPoolByRank = {};
    for (let r = 1; r <= 13; r++) {
      cardPoolByRank[r] = SUITS.map(suit => ({
        id: `${suit}_${r}`,
        suit,
        rank: r,
        label: RANK_LABELS[r],
        isWild: false
      }));
      // 무늬 순서 셔플
      for (let i = cardPoolByRank[r].length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = cardPoolByRank[r][i];
        cardPoolByRank[r][i] = cardPoolByRank[r][j];
        cardPoolByRank[r][j] = tmp;
      }
    }

    function takeCardOfRank(preferredRank) {
      if (cardPoolByRank[preferredRank] && cardPoolByRank[preferredRank].length > 0) {
        return cardPoolByRank[preferredRank].pop();
      }
      return null;
    }

    function takeAnyAvailableCard() {
      const availableRanks = RANKS.filter(r => cardPoolByRank[r].length > 0);
      if (availableRanks.length === 0) return null;
      const chosenRank = availableRanks[Math.floor(rng() * availableRanks.length)];
      return cardPoolByRank[chosenRank].pop();
    }

    // 2. 유효한 피라미드 카드 제거 순서(28개 슬롯) 생성
    const removedSet = new Set();
    const removalOrder = [];
    while (removalOrder.length < slotCount) {
      // 현재 시점에 아래에 덮인 카드가 모두 제거되어 노출된 슬롯들 추출
      const exposedSlots = layout.filter(
        slot => !removedSet.has(slot.id) && slot.coveredBy.every(cid => removedSet.has(cid))
      );
      // 난이도에 따라 윗줄 해금을 우선할지 무작위로 할지 가중치 부여
      const pickedSlot = exposedSlots[Math.floor(rng() * exposedSlots.length)];
      removedSet.add(pickedSlot.id);
      removalOrder.push(pickedSlot.id);
    }

    // 3. 28장의 제거 순서를 여러 개의 연속 콤보(Run/Streak)로 분할
    //    총 52장 중 보드 28장 + 초기 액티브 1장 + 스톡 23장 = 52장
    //    스톡 23장 중에서 약 8~14장은 스트릭 시작점(Launcher)으로 쓰이고, 나머지는 여유 드로우 카드로 배정
    // (난이도 상향) 런 길이를 1씩 늘려 콤보를 길게 요구한다 → 브릿지(덱 뽑기) 횟수가 줄어 시작 덱도 줄어든다
    //   easy 4~8 · normal 4~6 · hard 3~6   (예전: easy 3~7 · normal 3~5 · hard 2~5)
    const [minRun, maxRun] = rules.run;

    // 런 길이는 '콤보를 올리는 카드'(일반 카드 · 와일드)만 센다.
    //   +1 보너스 카드: 덱 +1장만 주고 콤보를 올리지도 끊지도 않는다 → 런 안에 끼어 있어도 길이에 넣지 않음
    //   콤보 상자 보상 카드: 덱에 추가될 뿐 콤보와 무관 → 정답 수순의 런 구조에 영향 없음 (덱 장수만 js/deal-generator.js 가 계산)
    const comboCount = removalOrder.filter(id => specials[id] !== 'bonus').length;
    // 남은 장수 r 을 [minRun, maxRun] 런 몇 개로 정확히 나눌 수 있는가 (k개면 k·min ~ k·max 장)
    const canSplit = r => r === 0 || Array.from({ length: Math.ceil(r / minRun) }, (_, k) => k + 1)
      .some(k => k * minRun <= r && r <= k * maxRun);
    const runLens = [];
    for (let left = comboCount; left > 0;) {
      // 이번 런 길이 후보 = 남은 카드도 규칙대로 나눌 수 있는 길이만 (짧은 꼬리 런 방지)
      const choices = [];
      for (let len = minRun; len <= Math.min(maxRun, left); len++) if (canSplit(left - len)) choices.push(len);
      const len = choices.length ? choices[Math.floor(rng() * choices.length)] : left;   // (보드가 최소 길이보다 작을 때만 남은 전부)
      runLens.push(len);
      left -= len;
    }
    const runs = [];
    let cursor = 0;
    for (const len of runLens) {
      const run = [];
      let counted = 0;
      while (cursor < slotCount && counted < len) {
        const id = removalOrder[cursor++];
        run.push(id);
        if (specials[id] !== 'bonus') counted++;
      }
      // 런 끝에 바로 이어지는 보너스 카드는 같은 런에 붙인다 (콤보를 끊지 않으므로)
      while (cursor < slotCount && specials[removalOrder[cursor]] === 'bonus') run.push(removalOrder[cursor++]);
      runs.push(run);
    }
    if (cursor < slotCount) runs.push(removalOrder.slice(cursor));   // (보드가 전부 보너스 카드인 경우만)

    // 4. 각 Run마다 시작 카드(Launcher) 1장과 보드 슬롯 카드들을 ±1 워크로 배정
    const boardAssignment = new Array(slotCount);
    const launcherCards = []; // 첫 번째 원소는 초기 액티브 카드, 이후 원소는 스톡에서 나오는 브릿지 카드
    const solutionSteps = [];

    for (let rIdx = 0; rIdx < runs.length; rIdx++) {
      const slotIds = runs[rIdx];
      let launcherCard = takeAnyAvailableCard();
      launcherCards.push(launcherCard);

      if (rIdx > 0) {
        solutionSteps.push({ type: 'draw', cardId: launcherCard.id, rank: launcherCard.rank });
      }

      let currentRank = launcherCard.rank;
      let direction = rng() < 0.5 ? 1 : -1;

      for (let i = 0; i < slotIds.length; i++) {
        const slotId = slotIds[i];
        const special = specials[slotId];
        if (special) {
          // 특수 카드는 52장 밖의 카드. 와일드는 다음 카드의 숫자 제약을 없앤다(currentRank = 0)
          boardAssignment[slotId] = { id: `${special}-${slotId}`, special, isWild: special === 'wild' };
          solutionSteps.push({ type: 'play', slotId, cardId: boardAssignment[slotId].id, special });
          if (special === 'wild') currentRank = 0;
          continue;
        }

        // 방향 유지 확률 70%, 방향 전환 확률 30% (단조로운 1-2-3-4 방지)
        if (rng() < 0.3) direction = -direction;

        let nextRank = getAdjacentRank(currentRank, direction);
        let picked = currentRank === 0 ? takeAnyAvailableCard() : takeCardOfRank(nextRank);

        if (!picked) {
          // 반대 방향 시도
          direction = -direction;
          nextRank = getAdjacentRank(currentRank, direction);
          picked = takeCardOfRank(nextRank);
        }

        if (!picked) {
          // 만약 양쪽 숫자 모두 52장 풀에서 소진되었을 경우, 새 브릿지 카드를 런 중간에 삽입
          // (수정) 브릿지 카드는 이웃 숫자(±1)가 풀에 아직 남아 있는 숫자 중에서만 고른다.
          //  예전에는 아무 카드나 뽑은 뒤 이웃이 없으면 takeAnyAvailableCard()로 '연결되지 않는 카드'를
          //  보드에 놓아 정답 경로가 끊겼다 (시드 1~100 기준 300판 중 5판).
          const hasNeighbor = r => cardPoolByRank[getAdjacentRank(r, 1)].length > 0 || cardPoolByRank[getAdjacentRank(r, -1)].length > 0;
          const usableRanks = RANKS.filter(r => cardPoolByRank[r].length > 0 && hasNeighbor(r));
          if (usableRanks.length === 0) throw new Error('generateSolvableDeal: 브릿지로 쓸 카드가 없습니다');
          const extraLauncher = cardPoolByRank[usableRanks[Math.floor(rng() * usableRanks.length)]].pop();
          launcherCards.push(extraLauncher);
          solutionSteps.push({ type: 'draw', cardId: extraLauncher.id, rank: extraLauncher.rank });
          currentRank = extraLauncher.rank;

          nextRank = getAdjacentRank(currentRank, direction);
          picked = takeCardOfRank(nextRank);
          if (!picked) {
            direction = -direction;
            picked = takeCardOfRank(getAdjacentRank(currentRank, direction));
          }
        }

        boardAssignment[slotId] = picked;
        currentRank = picked.rank;
        solutionSteps.push({ type: 'play', slotId, cardId: picked.id, rank: picked.rank });
      }
    }

    // 5. 남은 카드들을 스톡(Stock) 사이에 여유 드로우(Decoy/Extra Stock)로 배분
    //    (난이도 상향) 남은 카드를 전부 넣지 않고 약 40%는 무작위로 버린다(Discard) → 스톡 총량 감소
    //    버린 카드는 discardedCards 로 돌려준다 (보드 + 액티브 + 스톡 + 버린 카드 = 52장)
    const DISCARD_RATIO = options.discardRatio ?? rules.discardRatio;   // 기본: 보통 40% (쉬움 25% · 어려움 55% · 전문가 85%)
    const leftoverCards = [];
    const discardedCards = [];
    let rem = takeAnyAvailableCard();
    while (rem) {
      leftoverCards.push(rem);
      rem = takeAnyAvailableCard();
    }
    for (let i = leftoverCards.length - 1; i > 0; i--) {         // 버릴 카드를 무작위로 고르기 위해 섞음
      const j = Math.floor(rng() * (i + 1));
      [leftoverCards[i], leftoverCards[j]] = [leftoverCards[j], leftoverCards[i]];
    }
    discardedCards.push(...leftoverCards.splice(0, Math.round(leftoverCards.length * DISCARD_RATIO)));

    // 초기 액티브 카드 분리
    const initialActiveCard = launcherCards[0];
    const bridgeLaunchers = launcherCards.slice(1);

    // 스톡 배열 구성 (플레이어가 드로우할 순서대로 앞->뒤 정렬)
    // 난이도가 쉬울수록 여유 카드를 뒤쪽(나중)에 배치하거나 브릿지 바로 직전에 배치
    const stockOrder = [];
    const totalBridges = bridgeLaunchers.length;
    for (let i = 0; i < totalBridges; i++) {
      // 일정 확률로 여유 드로우 카드를 브릿지 앞에 삽입
      while (leftoverCards.length > 0 && rng() < (1 / (totalBridges - i + 1))) {
        stockOrder.push(leftoverCards.pop());
      }
      stockOrder.push(bridgeLaunchers[i]);
    }
    while (leftoverCards.length > 0) {
      stockOrder.push(leftoverCards.pop());
    }

    return {
      boardAssignment,
      initialActiveCard,
      stockOrder,
      discardedCards,
      solutionSteps,
      runs,
      difficulty
    };
  }

  /**
   * =========================================================================
   * generateSolvableDeck(difficulty, boardLayout) — 클리어 보장 덱 생성 진입점
   * =========================================================================
   * difficulty  : 'easy' | 'normal' | 'hard' | 'expert'
   * boardLayout : [{ id, coveredBy: [id...] }] (생략 시 표준 트라이픽스 28장 TRIPEAKS_LAYOUT)
   *               또는 { layout, specials: { [slotId]: 'wild' | 'bonus' }, seed | rng, discardRatio }
   *
   * 단계
   *   ① 빈 슬롯 준비      : boardLayout 의 coveredBy(이 카드를 덮는 카드)로 '열린 슬롯'을 판단
   *   ② 정답 제거 순서     : 열린 슬롯 중 하나씩 골라 치우는 위상 정렬 순서를 먼저 만든다 (숫자는 아직 없음)
   *   ③ 콤보 런 분할       : 순서를 난이도별 길이 [easy 4~8 · normal 4~6 · hard/expert 3~6] 의 런으로 자른다.
   *                          런과 런 사이 = 덱 1장 뽑기 (브릿지 카드). 마지막 런도 최소 길이 이상.
   *   ④ 숫자 역산 배정     : 런마다 브릿지 카드 숫자에서 출발해 ±1(K↔A 순환 포함)로 이어지는 숫자를
   *                          52장 재고(숫자별 4장)에서 꺼내 슬롯에 덮어씌운다. 한쪽 이웃이 바닥나면 방향을 꺾고,
   *                          양쪽 다 없으면 런 중간에 브릿지 카드를 한 장 더 끼운다.
   *                          → 정답 수순의 모든 '치우기'가 직전 맨 위 카드와 ±1 이므로 반드시 클리어된다.
   *   ⑤ 잉여 카드 정리     : 정답에 안 쓰인 카드 중 난이도별 비율(기본 40%)을 덱 맨 뒤로 빼고,
   *                          나머지는 브릿지 카드들 사이에 '여유 드로우'로 끼운다.
   *
   * 반환: { board[slotId] = card, startCard, stock(드로우 순서), removed(맨 뒤로 뺀 잉여), solution, runs, stats }
   */
  function generateSolvableDeck(difficulty = 'normal', boardLayout) {
    const opts = Array.isArray(boardLayout) || !boardLayout ? { layout: boardLayout } : boardLayout;
    const deal = generateSolvableDeal({ ...opts, difficulty });
    const runLengths = deal.runs.map(run => run.filter(id => (opts.specials || {})[id] !== 'bonus').length);
    const usedInSolution = deal.solutionSteps.filter(s => s.type === 'draw').length;
    return {
      board: deal.boardAssignment,
      startCard: deal.initialActiveCard,
      stock: deal.stockOrder,
      removed: deal.discardedCards,
      solution: deal.solutionSteps,
      runs: deal.runs,
      stats: {
        difficulty: deal.difficulty,
        runLengths,
        bridgeDraws: usedInSolution,
        spareInStock: deal.stockOrder.length - usedInSolution,
        spareRemoved: deal.discardedCards.length,
      },
    };
  }

  /**
   * =========================================================================
   * TriPeaksGame 클래스: 게임 상태, 액션, 아이템, 정산 관리
   * =========================================================================
   */
  // 콤보 목표 후보 (콤보가 0이 될 때마다 하나를 무작위로)
  const COMBO_GOALS = [5, 7, 10, 15];

  class TriPeaksGame {
    constructor(options = {}) {
      this.baseEntryFee = options.baseEntryFee || 100; // GDD 기본 입장료 100골드
      this.multiplier = options.multiplier || 1;       // GDD 배수 시스템 (1x, 2x, 4x)
      this.difficulty = options.difficulty || 'normal';
      this.seed = options.seed;

      // 플레이어 보유 아이템 수량 (외부 프로필과 연동 가능)
      this.inventory = {
        undo: options.undoCount !== undefined ? options.undoCount : 3,
        wild: options.wildCount !== undefined ? options.wildCount : 2
      };

      this.onStateChange = options.onStateChange || null;
      this.rng = options.rng || Math.random;           // 콤보 목표·보상 굴림 (테스트에서 고정 가능)
      this.initNewGame(this.seed);
    }

    /**
     * 새 스테이지 초기화 (100% 클리어 보장 덱 생성)
     */
    initNewGame(seed) {
      const deal = generateSolvableDeal({ seed, difficulty: this.difficulty });

      this.slots = TRIPEAKS_LAYOUT.map(layoutSlot => {
        const card = deal.boardAssignment[layoutSlot.id];
        const isBottomRow = layoutSlot.coveredBy.length === 0;
        return {
          id: layoutSlot.id,
          row: layoutSlot.row,
          col: layoutSlot.col,
          coveredBy: [...layoutSlot.coveredBy],
          card: { ...card },
          removed: false,
          faceUp: isBottomRow
        };
      });

      this.activeCard = { ...deal.initialActiveCard };
      // stock 배열: shift()로 맨 앞부터 한 장씩 드로우
      this.stock = deal.stockOrder.map(c => ({ ...c }));
      this.wasteHistory = [];
      this.history = []; // Undo 스택
      this.solutionHint = deal.solutionSteps;

      this.streak = 0;
      this.maxStreak = 0;
      this.moveCount = 0;
      this.adReviveUsed = false;
      this._resetComboGoal();                          // 콤보 0 → 새 콤보 목표
      this.status = 'playing'; // 'playing' | 'won' | 'lost'

      this._refreshExposedStates();
      this._emitChange('init');
      return this.getState();
    }

    /**
     * 덮고 있는 하위 카드가 모두 제거된 슬롯의 앞면(faceUp)을 자동으로 오픈
     */
    _refreshExposedStates() {
      for (const slot of this.slots) {
        if (!slot.removed) {
          const isExposed = slot.coveredBy.every(childId => this.slots[childId].removed);
          slot.faceUp = isExposed;
        }
      }
    }

    /**
     * 현재 터치/클릭해서 제거할 수 있는 보드 위의 유효한 슬롯 목록 반환
     */
    getPlayableSlots() {
      if (this.status !== 'playing') return [];
      return this.slots.filter(slot => {
        if (slot.removed || !slot.faceUp) return false;
        return isAdjacentRank(
          this.activeCard.rank,
          slot.card.rank,
          this.activeCard.isWild,
          slot.card.isWild
        );
      });
    }

    /**
     * 특정 슬롯 카드를 클릭하여 하단 액티브 카드로 이동
     */
    playSlot(slotId) {
      if (this.status !== 'playing') {
        return { ok: false, reason: 'GAME_NOT_ACTIVE' };
      }

      const slot = this.slots[slotId];
      if (!slot || slot.removed) {
        return { ok: false, reason: 'SLOT_ALREADY_REMOVED' };
      }
      if (!slot.faceUp) {
        return { ok: false, reason: 'SLOT_COVERED' };
      }

      const canPlay = isAdjacentRank(
        this.activeCard.rank,
        slot.card.rank,
        this.activeCard.isWild,
        slot.card.isWild
      );

      if (!canPlay) {
        return { ok: false, reason: 'RANK_NOT_ADJACENT' };
      }

      // Undo를 위해 현재 상태 스냅샷 저장
      this._pushHistory('playSlot', { slotId });

      // 카드 이동 처리
      this.wasteHistory.push(this.activeCard);
      this.activeCard = { ...slot.card };
      slot.removed = true;
      slot.faceUp = false;

      // 콤보(Streak) 갱신 — 시스템이 준 카드(콤보 보상 +카드)에서 이어 낸 매칭은 콤보를 올리지 않는다
      const fromSystemCard = !!(this.wasteHistory[this.wasteHistory.length - 1] || {}).isSystemCard;
      if (!fromSystemCard) this.streak += 1;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      this.moveCount += 1;

      this._refreshExposedStates();
      // 콤보가 목표와 같아지는 순간 즉시 보상 (콤보가 끊길 때까지 1번)
      if (!this.comboGoalReached && this.streak === this.currentComboGoal) this._grantComboReward();
      this._checkGameEndState();
      this._emitChange('playSlot');

      return {
        ok: true,
        activeCard: this.activeCard,
        streak: this.streak,
        status: this.status,
        settlement: this.status !== 'playing' ? this.calculateSettlement() : null
      };
    }

    /**
     * 더 이상 없앨 카드가 없거나 전략적으로 필요할 때 덱에서 새 카드 1장 뽑기
     */
    drawFromStock() {
      if (this.status !== 'playing') {
        return { ok: false, reason: 'GAME_NOT_ACTIVE' };
      }
      if (this.stock.length === 0) {
        return { ok: false, reason: 'STOCK_EMPTY' };
      }

      this._pushHistory('drawFromStock', {});

      const nextCard = this.stock.shift();
      this.wasteHistory.push(this.activeCard);
      this.activeCard = nextCard;
      this.streak = 0; // 덱에서 뽑으면 연속 콤보 초기화
      this._resetComboGoal();                          // 콤보가 0이 되면 새 목표
      this.moveCount += 1;

      this._checkGameEndState();
      this._emitChange('drawFromStock');

      return {
        ok: true,
        drawnCard: nextCard,
        remainingStock: this.stock.length,
        status: this.status,
        settlement: this.status !== 'playing' ? this.calculateSettlement() : null
      };
    }

    /**
     * 특수 아이템 1: 와일드 카드(Wild Card / Joker) 사용
     * - 현재 액티브 카드 위에 만능 와일드 카드를 덮어, 보드의 앞면 카드 중 아무 카드나 이어서 제거할 수 있게 함
     */
    useWildCard() {
      if (this.status !== 'playing') {
        return { ok: false, reason: 'GAME_NOT_ACTIVE' };
      }
      if (this.inventory.wild <= 0) {
        return { ok: false, reason: 'NO_WILD_ITEM' };
      }
      if (this.activeCard && this.activeCard.isWild) {
        return { ok: false, reason: 'ALREADY_WILD_ACTIVE' };
      }

      this._pushHistory('useWildCard', {});

      this.inventory.wild -= 1;
      this.wasteHistory.push(this.activeCard);
      this.activeCard = {
        id: `wild_${Date.now()}_${this.moveCount}`,
        suit: 'joker',
        rank: 0,
        label: RANK_LABELS[0],
        isWild: true
      };
      this.moveCount += 1;

      this._emitChange('useWildCard');
      return {
        ok: true,
        activeCard: this.activeCard,
        remainingWild: this.inventory.wild
      };
    }

    /**
     * 특수 아이템 2: 되돌리기(Undo) 사용
     * - 직전 행동 1회를 완벽히 취소 (보드 제거, 덱 드로우, 와일드카드 사용 모두 복구)
     */
    undo() {
      if (this.history.length === 0) {
        return { ok: false, reason: 'NOTHING_TO_UNDO' };
      }
      if (this.inventory.undo <= 0) {
        return { ok: false, reason: 'NO_UNDO_ITEM' };
      }

      const snapshot = this.history.pop();
      this.inventory.undo -= 1;

      // 상태 복원
      this.slots = snapshot.slots.map(s => ({
        ...s,
        coveredBy: [...s.coveredBy],
        card: { ...s.card }
      }));
      this.activeCard = { ...snapshot.activeCard };
      this.stock = snapshot.stock.map(c => ({ ...c }));
      this.wasteHistory = snapshot.wasteHistory.map(c => ({ ...c }));
      this.streak = snapshot.streak;
      this.maxStreak = snapshot.maxStreak;
      this.currentComboGoal = snapshot.currentComboGoal;
      this.comboGoalReached = snapshot.comboGoalReached;
      this.status = 'playing';

      // 만약 직전 행동이 와일드카드 사용이었다면 와일드카드 수량도 복구할지 여부 (기본: 소모 유지하되 옵션 지원)
      if (snapshot.actionType === 'useWildCard') {
        this.inventory.wild += 1;
      }

      this._refreshExposedStates();
      this._emitChange('undo');

      return {
        ok: true,
        restoredAction: snapshot.actionType,
        remainingUndo: this.inventory.undo,
        state: this.getState()
      };
    }

    /**
     * 보상형 광고(Rewarded Ad) 시청 시: 스테이지 실패 상태에서 카드 3장 추가 드로우 부여 (GDD 6장 반영)
     */
    grantAdExtraCards(count = 3) {
      if (this.adReviveUsed) {
        return { ok: false, reason: 'AD_REVIVE_ALREADY_USED' };
      }

      // 현재 보드에 남아있는 노출된 카드들과 매칭될 수 있는 구조용 카드를 우선 1장 포함하여 생성
      const exposedRanks = this.slots
        .filter(s => !s.removed && s.faceUp)
        .map(s => s.card.rank);

      const newCards = [];
      for (let i = 0; i < count; i++) {
        let targetRank;
        if (i === 0 && exposedRanks.length > 0) {
          const baseRank = exposedRanks[0];
          targetRank = getAdjacentRank(baseRank, 1);
        } else {
          targetRank = Math.floor(Math.random() * 13) + 1;
        }
        const suit = SUITS[i % SUITS.length];
        newCards.push({
          id: `ad_bonus_${Date.now()}_${i}`,
          suit,
          rank: targetRank,
          label: RANK_LABELS[targetRank],
          isWild: false
        });
      }

      this.stock.push(...newCards);
      this.adReviveUsed = true;
      this.status = 'playing';

      this._emitChange('grantAdExtraCards');
      return {
        ok: true,
        addedCount: count,
        remainingStock: this.stock.length
      };
    }

    /**
     * 클리어 / 패배 판정
     */
    _checkGameEndState() {
      const remainingBoardCards = this.slots.filter(s => !s.removed).length;
      if (remainingBoardCards === 0) {
        this.status = 'won';
        return;
      }

      // 덱도 비어있고, 보드에서 더 이상 매칭 가능한 카드도 없으면 패배(막힘) 상태
      const playable = this.getPlayableSlots();
      if (this.stock.length === 0 && playable.length === 0) {
        this.status = 'lost';
      }
    }

    /**
     * GDD 4장(재화 경제 & 배수 시스템)에 따른 스테이지 정산 계산
     * - 기본 입장료: 100 골드 * 배수(1x, 2x, 4x)
     * - 클리어 기본 보상: 150 ~ 220 골드 (남은 스톡 카드 수 및 최대 콤보에 따라 산정) * 배수
     */
    calculateSettlement() {
      const entryCost = this.baseEntryFee * this.multiplier;
      const remainingBoard = this.slots.filter(s => !s.removed).length;
      const remainingStock = this.stock.length;

      if (this.status !== 'won') {
        return {
          won: false,
          multiplier: this.multiplier,
          entryCost,
          grossReward: 0,
          netProfit: -entryCost,
          clueEarned: false,
          remainingBoardCards: remainingBoard
        };
      }

      // 기본 클리어 보상 150G + 남은 스톡 카드당 5G + 최대 콤보 보너스 (상한 220G 기준 * 배수)
      const stockBonus = remainingStock * 5;
      const streakBonus = Math.min(25, this.maxStreak * 2);
      const baseGross = Math.min(220, 150 + stockBonus + streakBonus);
      const grossReward = baseGross * this.multiplier;

      return {
        won: true,
        multiplier: this.multiplier,
        entryCost,
        baseGross,
        grossReward,
        netProfit: grossReward - entryCost,
        clueEarned: true, // 스테이지 1개 클리어 시 단서 1개 획득
        remainingStockCards: remainingStock,
        maxStreak: this.maxStreak
      };
    }

    _pushHistory(actionType, meta) {
      this.history.push({
        actionType,
        meta,
        slots: this.slots.map(s => ({
          ...s,
          coveredBy: [...s.coveredBy],
          card: { ...s.card }
        })),
        activeCard: { ...this.activeCard },
        stock: this.stock.map(c => ({ ...c })),
        wasteHistory: this.wasteHistory.map(c => ({ ...c })),
        streak: this.streak,
        maxStreak: this.maxStreak,
        currentComboGoal: this.currentComboGoal,
        comboGoalReached: this.comboGoalReached
      });
    }

    /**
     * 콤보 목표: 콤보가 0이 될 때마다 [5, 7, 10, 15] 중 하나를 무작위로 목표로 정한다
     */
    _resetComboGoal() {
      this.currentComboGoal = COMBO_GOALS[Math.floor(this.rng() * COMBO_GOALS.length)];
      this.comboGoalReached = false;
    }

    /**
     * 콤보 목표 달성 보상 (this.streak === this.currentComboGoal 인 순간)
     *  - 목표 5 · 7   : 100% 덱 +1 · +2 · +3장 (plus_cards, 무작위)
     *  - 목표 10 · 15 : 95% 덱 +5장 / 5% 와일드 1개 또는 되돌리기 1개
     *  덱에 넣는 카드는 isSystemCard 표시 → 그 카드에서 이어 낸 매칭은 콤보를 올리지 않는다
     */
    _grantComboReward() {
      this.comboGoalReached = true;
      let rewardType;
      let rewardValue;
      if (this.currentComboGoal <= 7) {
        rewardType = 'plus_cards';
        rewardValue = 1 + Math.floor(this.rng() * 3);
      } else if (this.rng() < 0.95) {
        rewardType = 'plus_cards';
        rewardValue = 5;
      } else {
        rewardType = this.rng() < 0.5 ? 'wild' : 'undo';
        rewardValue = 1;
      }

      if (rewardType === 'plus_cards') {
        for (let i = 0; i < rewardValue; i++) {
          const rank = Math.floor(this.rng() * 13) + 1;
          this.stock.push({
            id: `combo_bonus_${this.moveCount}_${i}`,
            suit: SUITS[Math.floor(this.rng() * SUITS.length)],
            rank,
            label: RANK_LABELS[rank],
            isWild: false,
            isSystemCard: true
          });
        }
      } else {
        this.inventory[rewardType] += rewardValue;
      }
      this._emitChange('comboReward', { type: rewardType, value: rewardValue, goal: this.currentComboGoal });
      return { type: rewardType, value: rewardValue };
    }

    _emitChange(event, payload) {
      if (typeof this.onStateChange === 'function') {
        this.onStateChange(this.getState(), event, payload);
      }
    }

    getState() {
      const playableIds = new Set(this.getPlayableSlots().map(s => s.id));
      return {
        status: this.status,
        multiplier: this.multiplier,
        activeCard: { ...this.activeCard },
        stockCount: this.stock.length,
        streak: this.streak,
        maxStreak: this.maxStreak,
        currentComboGoal: this.currentComboGoal,
        comboGoalReached: this.comboGoalReached,
        moveCount: this.moveCount,
        inventory: { ...this.inventory },
        canUndo: this.history.length > 0 && this.inventory.undo > 0,
        canUseWild: this.status === 'playing' && this.inventory.wild > 0 && !this.activeCard.isWild,
        canReviveWithAd: this.status === 'lost' && !this.adReviveUsed,
        slots: this.slots.map(s => ({
          id: s.id,
          row: s.row,
          col: s.col,
          removed: s.removed,
          faceUp: s.faceUp,
          playable: playableIds.has(s.id),
          card: s.faceUp ? { ...s.card } : null
        }))
      };
    }
  }

  return {
    SUITS,
    RANKS,
    RANK_LABELS,
    TRIPEAKS_LAYOUT,
    isAdjacentRank,
    getAdjacentRank,
    generateSolvableDeal,
    generateSolvableDeck,
    DIFFICULTY_RULES,
    COMBO_GOALS,
    TriPeaksGame
  };
});
