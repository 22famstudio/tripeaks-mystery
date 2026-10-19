// =====================================================================
// 게임 규칙 엔진 (DOM 없음). UI·정산·상점은 이벤트를 구독해서 붙인다.
// =====================================================================
// 보드 카드 종류
//   일반 카드        : 액티브 카드와 ±1(K↔A)이면 낼 수 있음
//   { special:'wild' }  : 앞면이면 언제든 획득 → 액티브 카드가 WILD(다음에 아무 숫자나 붙일 수 있음)
//   { special:'bonus' } : 앞면이면 언제든 획득 → 드로우 덱 +1장, 버림더미는 그대로
//
// 드로우 덱 모델
//   pile      : 뽑히는 순서가 고정된 카드 목록 (pile[0]부터 뽑힘)
//   allowance : 지금까지 "열린" 장수 = 시작 장수 + 보너스 카드 + 콤보 상자
//   purchased : 이어하기(+5)로 산 장수. 되돌리기로 사라지지 않도록 따로 보관
//   남은 덱 = allowance + purchased - drawn
//   → 보너스로 늘어나는 카드도 순서가 미리 정해져 있어서, 생성기가 정답 수순을 보장할 수 있다.
//
// 콤보 목표 보상 (콤보 상자)
//   콤보가 0이 될 때마다(판 시작 · 덱 뽑기) 새 목표 currentComboGoal 이 [5, 7, 10, 15] 중 하나로 정해진다.
//   보드 카드를 덱을 뽑지 않고 연속으로 치워 콤보가 목표와 같아지는 순간 즉시 보상 (콤보가 끊길 때까지 1번):
//     목표 5 · 7   : 100% 덱 +1 · +2 · +3장 (무작위)
//     목표 10 · 15 : 95% 덱 +5장 / 5% 와일드 1개 또는 되돌리기 1개
//   목표와 보상은 판마다 고정된 순서(deal.chests, 생성기가 시드로 미리 굴림)라서 생성기가 정답 수순을 보장할 수 있다.
//   시스템이 준 카드(+1 보너스 카드, 콤보 보상으로 늘어난 덱 카드)는 콤보를 올리지 않는다:
//     +1 보너스 카드는 콤보·게이지를 올리지도 끊지도 않고, 덱 카드는 뽑는 순간 콤보가 0이 된다.
//
// events: 'play' {slot, card, kind, revealed, combo, chest}
//         'comboReward' {type: 'plus_cards' | 'wild' | 'undo', value, target, index}  — 콤보 목표 달성 즉시
//         'draw' {card} / 'wild' {} / 'stock' {added} / 'undo' {move}
//         'end'  {status, remaining, stockLeft, bestCombo}
// status가 'lost'여도 되돌리기·와일드·이어하기로 다시 'playing'이 될 수 있다.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});

  // 액티브 카드 자리에 놓이는 만능 카드 (52장 밖)
  TP.WILD_CARD = Object.freeze({ rank: 0, suit: '★', id: 'wild', wild: true });

  class TriPeaksGame {
    constructor(layout, deal) {
      this.layout = layout;
      this.deal = deal;
      this.board = deal.board.map(card => ({ card, removed: false }));
      this.pile = deal.pile.slice();
      this.extraRng = TP.mulberry32((deal.seed ^ 0x5bd1e995) >>> 0);
      this.drawn = 0;
      this.allowance = deal.initialStock;
      this.purchased = 0;
      this.waste = [deal.startCard];
      this.chests = deal.chests;
      this.chestIndex = 0;                // 지금 콤보 목표 번호 (콤보가 0이 될 때마다 +1)
      this.gauge = 0;                     // 목표를 향한 진행 (= 이번 콤보, 목표 달성 후에는 목표에서 멈춤)
      this.goalReached = false;           // 이번 콤보에서 목표를 이미 달성했는지 (콤보가 끊길 때까지 보상 1번)
      this.combo = 0;
      this.bestCombo = 0;
      this.moves = 0;
      this.claimedItemChests = new Set(); // 아이템 보상은 판마다 상자당 1번만 (되돌리기 파밍 방지)
      this.adReviveUsed = false;          // 광고 +3장은 판당 1번
      this.history = [];
      this.listeners = {};
    }

    on(type, fn) { (this.listeners[type] ??= []).push(fn); }
    emit(type, data) { (this.listeners[type] || []).forEach(fn => fn(data)); }

    get activeCard() { return this.waste[this.waste.length - 1]; }
    get remaining() { return this.board.filter(s => !s.removed).length; }
    get stockCount() { return Math.max(0, this.allowance + this.purchased - this.drawn); }
    get currentChest() { return this.chests[this.chestIndex % this.chests.length]; }
    get currentComboGoal() { return this.currentChest.target; }
    get solution() { return this.deal.solution; }

    isFaceUp(i) {
      return this.layout.nodes[i].parents.every(p => this.board[p].removed);
    }

    canPlay(i) {
      const slot = this.board[i];
      if (slot.removed || !this.isFaceUp(i)) return false;
      if (slot.card.special) return true;
      return this.activeCard.wild || TP.isAdjacent(slot.card.rank, this.activeCard.rank);
    }

    hasPlayableCard() {
      return this.board.some((_, i) => this.canPlay(i));
    }

    get status() {
      if (this.remaining === 0) return 'won';
      if (this.stockCount === 0 && !this.hasPlayableCard()) return 'lost';
      return 'playing';
    }

    // ---------- 되돌리기용 스냅샷 ----------
    snapshot() {
      return {
        removed: this.board.map(s => s.removed),
        waste: this.waste.slice(),
        drawn: this.drawn, allowance: this.allowance,
        chestIndex: this.chestIndex, gauge: this.gauge, goalReached: this.goalReached,
        combo: this.combo, bestCombo: this.bestCombo, moves: this.moves,
      };
    }

    restore(s) {
      s.removed.forEach((r, i) => { this.board[i].removed = r; });
      Object.assign(this, {
        waste: s.waste.slice(), drawn: s.drawn, allowance: s.allowance,
        chestIndex: s.chestIndex, gauge: s.gauge, goalReached: s.goalReached,
        combo: s.combo, bestCombo: s.bestCombo, moves: s.moves,
      });
    }

    record(type, extra) {
      this.history.push({ type, snap: this.snapshot(), ...extra });
      this.moves++;
    }

    // ---------- 행동 ----------
    play(i) {
      if (this.status !== 'playing' || !this.canPlay(i)) return false;
      this.record('play', { slot: i });
      const slot = this.board[i];
      slot.removed = true;
      const kind = slot.card.special || 'card';
      if (kind === 'card') this.waste.push(slot.card);
      else if (kind === 'wild') this.waste.push(TP.WILD_CARD);
      else if (kind === 'bonus') this.allowance += 1;

      // 콤보는 보드 카드를 연속으로 맞출 때만. +1 보너스 카드는 보상이라 콤보·게이지를 건드리지 않는다
      let chest = null;
      if (kind !== 'bonus') {
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        chest = this.advanceGauge();
      }
      const revealed = this.layout.nodes[i].children.filter(j => !this.board[j].removed && this.isFaceUp(j));
      this.emit('play', { slot: i, card: slot.card, kind, revealed, combo: this.combo, chest });
      if (chest) this.emit('comboReward', TP.comboRewardEvent(chest));
      this.checkEnd();
      return true;
    }

    // 콤보 +1 → 이번 콤보가 목표(currentComboGoal)와 같아지는 순간 보상. 반환: { index, target, reward } | null
    advanceGauge() {
      if (this.goalReached) return null;
      const chest = this.currentChest;
      this.gauge = Math.min(this.combo, chest.target);
      if (this.combo !== chest.target) return null;
      this.goalReached = true;
      const index = this.chestIndex;
      const reward = { cards: chest.reward.cards || 0, wildItem: 0, undoItem: 0 };
      this.allowance += reward.cards;
      // 아이템 보상은 판마다 목표당 1번만 (되돌리기로 같은 목표를 다시 달성해 파밍하는 것 방지)
      if ((chest.reward.wildItem || chest.reward.undoItem) && !this.claimedItemChests.has(index)) {
        this.claimedItemChests.add(index);
        reward.wildItem = chest.reward.wildItem || 0;
        reward.undoItem = chest.reward.undoItem || 0;
      }
      return { index, target: chest.target, reward };
    }

    draw() {
      if (this.status !== 'playing' || this.stockCount === 0) return false;
      this.record('draw');
      while (this.drawn >= this.pile.length) this.extendPile();
      const card = this.pile[this.drawn++];
      this.waste.push(card);
      this.combo = 0;                     // 콤보가 0이 되면 새 콤보 목표
      this.gauge = 0;
      this.goalReached = false;
      this.chestIndex++;
      this.emit('draw', { card });
      this.checkEnd();
      return true;
    }

    // 생성된 덱을 다 쓴 뒤 이어하기로 더 뽑으면 새 덱 한 벌을 섞어 이어 붙인다
    extendPile() {
      this.pile.push(...TP.shuffle(TP.createDeck(), this.extraRng));
    }

    // 와일드카드 아이템(인벤토리) 사용
    canUseWild() {
      return this.remaining > 0 && !this.activeCard.wild;
    }

    useWild() {
      if (!this.canUseWild()) return false;
      this.record('wild');
      this.waste.push(TP.WILD_CARD);
      this.emit('wild', {});
      return true;
    }

    // 덱 장수만 늘린다 (연승 버프 등). 되돌리기 대상이 아니다.
    addCards(n) {
      this.purchased += n;
      this.emit('stock', { added: n });
    }

    // 다음에 뽑힐 자리에 '구조 카드'를 끼운다: 지금 앞면인 보드 카드와 ±1 → 뽑자마자 이어서 낼 수 있다
    //   (광고 +3장 · 골드 이어하기 +5장 공통. 앞면 일반 카드가 없으면 끼우지 않음)
    insertRescueCard() {
      const open = this.board
        .map((s, i) => (!s.removed && !s.card.special && this.isFaceUp(i) ? s.card : null))
        .filter(Boolean);
      if (!open.length) return null;
      const base = TP.pick(open, this.extraRng);
      const rank = ((base.rank - 1 + (this.extraRng() < 0.5 ? 1 : -1) + 13) % 13) + 1;
      const suit = TP.pick(['♠', '♥', '♦', '♣'], this.extraRng);
      while (this.drawn > this.pile.length) this.extendPile();
      const card = { rank, suit, id: `rescue-${rank}${suit}-${this.drawn}` };
      this.pile.splice(this.drawn, 0, card);
      return card;
    }

    // 골드 이어하기(+n장 구매): 첫 장은 반드시 바로 낼 수 있는 카드 (사도 소용없는 5장 방지)
    buyCards(n) {
      this.insertRescueCard();
      this.addCards(n);
    }

    // 보상형 광고 부활 (코어 엔진 grantAdExtraCards 규칙): 판당 1번, 덱 +n장.
    // 첫 장은 지금 앞면인 보드 카드와 ±1인 '구조 카드'라 바로 이어서 낼 수 있다. 되돌리기 대상이 아니다.
    canGrantAdCards() {
      return !this.adReviveUsed && this.remaining > 0;
    }

    grantAdExtraCards(n = 3) {
      if (!this.canGrantAdCards()) return false;
      this.adReviveUsed = true;
      this.insertRescueCard();
      this.addCards(n);
      return true;
    }

    // ---------- 판 저장 · 이어하기 (앱이 튕기거나 강제 종료돼도 같은 판을 그대로 이어서) ----------
    //   덱 순서는 시드로 다시 만들 수 있지만, 구조 카드가 끼워졌을 수 있으므로 pile 도 통째로 저장한다.
    //   되돌리기 기록(history)은 저장하지 않는다 (이어한 뒤에는 그 이전 수로 되돌릴 수 없음).
    serialize() {
      return {
        v: 1,
        snap: this.snapshot(),
        purchased: this.purchased,
        pile: this.pile.map(c => ({ rank: c.rank, suit: c.suit, id: c.id })),
        adReviveUsed: this.adReviveUsed,
        claimedItemChests: [...this.claimedItemChests],
      };
    }

    load(saved) {
      const ok = saved && saved.v === 1 && saved.snap && Array.isArray(saved.snap.removed)
        && saved.snap.removed.length === this.board.length && Array.isArray(saved.pile) && Array.isArray(saved.snap.waste);
      if (!ok) throw new Error('저장된 판 상태가 이 판과 맞지 않습니다');
      const revive = c => (c && c.wild ? TP.WILD_CARD : c);
      this.restore({ ...saved.snap, waste: saved.snap.waste.map(revive) });
      this.pile = saved.pile.slice();
      this.purchased = saved.purchased | 0;
      this.adReviveUsed = !!saved.adReviveUsed;
      this.claimedItemChests = new Set(saved.claimedItemChests || []);
      this.history = [];
    }

    canUndo() {
      return this.history.length > 0 && this.remaining > 0;
    }

    undo() {
      if (!this.canUndo()) return null;
      const move = this.history.pop();
      this.restore(move.snap);
      this.emit('undo', { move });
      return move;
    }

    checkEnd() {
      const status = this.status;
      if (status === 'playing') return;
      this.emit('end', {
        status,
        remaining: this.remaining,
        stockLeft: this.stockCount,
        bestCombo: this.bestCombo,
      });
    }
  }

  // 콤보 보상 → 이벤트 형식 { type, value } (app.js · 코어 엔진과 같은 이름)
  TP.comboRewardEvent = ({ index, target, reward }) => (
    reward.wildItem ? { type: 'wild', value: reward.wildItem, target, index }
      : reward.undoItem ? { type: 'undo', value: reward.undoItem, target, index }
        : { type: 'plus_cards', value: reward.cards, target, index });

  TP.TriPeaksGame = TriPeaksGame;

  // ---------- 스테이지 별 등급 (1~3개) ----------
  // 정답 수순(생성기)을 그대로 따라갔을 때 남는 덱 장수 — 판마다 다르므로 별 3개 기준으로 쓴다
  TP.solutionLeftover = deal => {
    const game = new TriPeaksGame(TP.getLayout(deal.layoutId), deal);
    for (const m of deal.solution || []) {
      if (m.type === 'play') game.play(m.slot); else game.draw();
    }
    return game.remaining === 0 ? game.stockCount : 0;
  };
  //   ★     클리어
  //   ★★    이어하기(골드 +5장 · 광고 +3장) 없이 클리어
  //   ★★★   ★★ + 남은 덱이 정답 수순만큼 (최소 1장) — 정답만큼 알뜰하게 깼다
  const targetCache = new WeakMap();
  TP.starTarget = deal => {
    if (!targetCache.has(deal)) targetCache.set(deal, Math.max(1, TP.solutionLeftover(deal)));
    return targetCache.get(deal);
  };
  TP.stageStars = ({ stockLeft = 0, continued = false, target = 1 }) =>
    continued ? 1 : stockLeft >= target ? 3 : 2;
})();
