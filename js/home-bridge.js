// =====================================================================
// 홈·성장 브리지 — js/core/home_progression_system.js 의 HomeGameManager 를 기존 저장소(TP.store)에 연결
// =====================================================================
//   모듈은 원래 자기 localStorage 키(tripeaks_mystery_profile_v2)에 따로 저장하지만,
//   여기서는 상태를 TP.store 에서 읽고 TP.store 에 쓴다 → 골드·하트·레벨을 상점·추리·에너지와 한 곳에서 관리.
//   (모듈 파일은 고치지 않고, 상속해서 불러오기/저장만 바꾼다)
//
//   필드 대응 (모듈 ↔ TP.store)
//     level ↔ playerLevel · exp ↔ exp · gold ↔ gold
//     lives ↔ energy · lastLifeRegenAt ↔ lastEnergyTime        (양쪽 모두 20분 충전 · '잔량 + 기준 시각' 방식)
//     winStreak · claimedStreakMilestones · selectedMultiplier · totalStagesCleared · specialOfferExpiresAt ↔ 같은 이름
//     cluesCollectedInEpisode ↔ episode.cleared · currentEpisodeId ↔ 현재 에피소드 번호
//     inventory.undo/wild ↔ undoCount/wildcardCount · adsRemoved ↔ noAdsActive
//     purchasedOneTimePacks ↔ purchasedOnce  (상점의 'starter_novice' = 모듈의 'starter_detective_pack')
//
//   모듈 규칙 위에 기존 기능을 유지하는 부분
//     startStageWithBet : 무한 하트 중이면 하트를 쓰지 않음 · 끊긴 연승 세이브 기회 소멸
//     recordStageResult : 단서는 '다음 스테이지'를 처음 깼을 때만 (재도전은 골드·EXP만, 연승도 오르지 않고 유지) + 수첩 새 단서 표시
//                         패배 시 끊긴 연승을 500G 세이브용으로 기억
//                         연승 보상 3 · 7 · 10 · 20 · 30연승 (하트 포함), 50연승 프레스티지(카드 뒷면) 후 0으로 리셋
//                         연승 버프 '콤보 배율 +N'은 최고 콤보를 (1+N)배로 쳐서 반영
//     uiModel()         : 칭호·코스튬은 사건 해결 승급 규칙 반영, 에피소드 배경 폴백
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const HP = TP.HP || globalThis.HomeProgressionSystem
    || (typeof require === 'function' ? require('./core/home_progression_system.js') : null);

  const STARTER = { module: 'starter_detective_pack', shop: 'starter_novice' };
  const OFFER_MS = HP.SHOP_CATALOG.find(p => p.id === STARTER.module).offerDurationMs;

  // 에피소드 테마 배경 30종 (themeIndex 1~30 → 이미지 경로). 아직 제작 전이라 비어 있다.
  // 채워 넣으면 전용 배경이 없는 에피소드가 (번호-1) % 30 + 1 번 테마를 쓴다.
  TP.EPISODE_THEME_BACKGROUNDS = {};

  function fromStore(s) {
    const ep = TP.mystery && TP.mystery.episode;
    return {
      level: s.playerLevel, exp: s.exp, gold: s.gold,
      lives: s.energy, lastLifeRegenAt: s.lastEnergyTime,
      selectedMultiplier: s.selectedMultiplier,
      currentEpisodeId: ep ? ep.no : s.episode.index + 1,
      cluesCollectedInEpisode: s.episode.cleared,
      totalStagesCleared: s.totalStagesCleared,
      winStreak: s.winStreak,
      claimedStreakMilestones: s.claimedStreakMilestones.slice(),
      inventory: { undo: s.undoCount, wild: s.wildcardCount },
      adsRemoved: s.noAdsActive,
      purchasedOneTimePacks: s.purchasedOnce.includes(STARTER.shop) ? [STARTER.module] : [],
      specialOfferExpiresAt: s.specialOfferExpiresAt,
    };
  }

  function toStore(m, s) {
    Object.assign(s, {
      playerLevel: m.level, exp: m.exp, gold: m.gold,
      energy: m.lives, lastEnergyTime: m.lastLifeRegenAt,
      selectedMultiplier: m.selectedMultiplier,
      totalStagesCleared: m.totalStagesCleared,
      winStreak: m.winStreak,
      claimedStreakMilestones: m.claimedStreakMilestones.slice(),
      undoCount: m.inventory.undo, wildcardCount: m.inventory.wild,
      specialOfferExpiresAt: m.specialOfferExpiresAt,
    });
    s.episode.cleared = m.cluesCollectedInEpisode;
    if (m.adsRemoved) s.noAdsActive = true;
  }

  class StoreBackedHomeManager extends HP.HomeGameManager {
    constructor() {
      super({ nowFn: () => TP.now() });
    }

    // ---- 저장소 연결 ----
    _loadInitialState() { return fromStore(TP.store.state); }

    _pull() {
      this.state = fromStore(TP.store.state);
      if (!this.state.specialOfferExpiresAt) {           // 첫 실행: 한정 특가 24시간 시작
        this.state.specialOfferExpiresAt = this.nowFn() + OFFER_MS;
        this._push();
      }
    }

    _push() { TP.store.update(s => toStore(this.state, s)); }

    save() { if (!this._mute) this._push(); }   // 화면 갱신은 store.subscribe 가 담당

    // 바깥에서 부르는 동작은 항상 저장소의 최신 상태에서 시작 (상점 구매·에너지 충전 등이 저장소를 바꾸므로)
    _op(fn) {
      if (!this._depth) this._pull();
      this._depth = (this._depth || 0) + 1;
      try { return fn(); } finally { this._depth--; }
    }

    syncTimers() { return this._op(() => super.syncTimers()); }
    refillLife(method) { return this._op(() => super.refillLife(method)); }
    selectMultiplier(x) { return this._op(() => super.selectMultiplier(x)); }
    completeCurrentEpisode(reward) { return this._op(() => super.completeCurrentEpisode(reward)); }
    purchasePack(id) { return this._op(() => super.purchasePack(id)); }
    getHomeUIModel(meta) { return this._op(() => super.getHomeUIModel(meta)); }

    // ---- 스테이지 입장: 하트 1 + (레벨 구간 입장료 × 배수) ----
    startStageWithBet(multiplier) {
      return this._op(() => {
        const t = this.nowFn();
        const infinite = !!(TP.energy && TP.energy.isInfinite(t));
        super.syncTimers();
        const livesBefore = this.state.lives;
        if (infinite && livesBefore <= 0) this.state.lives = 1;   // 무한 하트: 하트가 0이어도 입장
        const r = super.startStageWithBet(multiplier);
        if (!r.ok) {
          this.state.lives = livesBefore;
          return r;
        }
        if (infinite) {                                           // 무한 하트 중에는 하트를 쓰지 않음
          this.state.lives = livesBefore;
          this.save();
        }
        if (TP.streak) TP.streak.forfeitSave();                   // 세이브하지 않은 끊긴 연승은 소멸
        return { ...r, lifeSpent: infinite ? 0 : 1, remainingLives: this.state.lives };
      });
    }

    // ---- 스테이지 결과 ----
    //   { won, remainingStockCards, maxStreak, multiplier, comboBoost?, stage? }
    //   반환: 모듈 결과 + { clue, lostStreak }
    recordStageResult(result = {}) {
      return this._op(() => {
        const { won, comboBoost = 0, stage, ...rest } = result;

        if (!won) {
          const lost = this.state.winStreak;
          const r = super.recordStageResult({ ...rest, won: false });
          // 모듈은 패배 처리에서 save() 를 먼저 하고 위로 EXP(15)를 나중에 더해서 EXP가 저장되지 않는다 → 다시 저장
          this._push();
          TP.store.update(s => { s.lostStreak = lost; });      // 500G 연승 세이브 (streak.js)
          return { ...r, clue: null, lostStreak: lost };
        }

        const prevStreak = this.state.winStreak;
        const cleared = this.state.cluesCollectedInEpisode;
        const ep = TP.mystery && TP.mystery.episode;
        // 재도전(이미 단서를 받은 스테이지)·자유 플레이는 단서 없음 → 모듈이 연승도 올리지 않는다 (유지)
        const clueEligible = !!ep && stage === cleared + 1 && cleared < ep.clues.length;

        this._mute = true;
        let r;
        try {
          r = super.recordStageResult({ ...rest, won: true, clueEligible, maxStreak: (rest.maxStreak || 0) * (1 + comboBoost) });
        } finally {
          this._mute = false;
        }
        // 실제로 도달한 연승 (30연승 달성 시 모듈이 0으로 리셋하므로 그 전 값 기준)
        const streak = r.streakCounted ? prevStreak + 1 : prevStreak;
        this._push();
        TP.store.update(s => {
          s.bestStreak = Math.max(s.bestStreak, streak);
          if (r.streakCounted) s.lostStreak = 0;
          if (r.newClueUnlocked) s.episode.unread += 1;
          if (r.streakRewardClaimed?.hint) s.hintCount += r.streakRewardClaimed.hint;   // 힌트권은 모듈 밖 재화
        });
        // 50연승 프레스티지: 아직 없는 카드 뒷면 1종 (모두 모았으면 대체 보상) — 연승은 모듈이 이미 0으로 리셋
        if (r.streakRewardClaimed && r.streakRewardClaimed.prestige && TP.cardBacks) {
          r = { ...r, streakRewardClaimed: { ...r.streakRewardClaimed, prestigeResult: TP.cardBacks.grantPrestige(this.rng) } };
        }
        return { ...r, clue: r.newClueUnlocked ? ep.clues[stage - 1] : null, lostStreak: 0 };
      });
    }

    // ---- 홈 화면 뷰 모델 (getHomeUIModel + 기존 규칙 보정) ----
    uiModel() {
      const s = TP.store.state;
      const ep = TP.mystery && TP.mystery.episode;
      const no = ep ? ep.no : s.episode.index + 1;
      const themeIndex = ((Math.max(1, no) - 1) % 30) + 1;
      const art = (ep && ep.background) || TP.EPISODE_THEME_BACKGROUNDS[themeIndex] || null;
      const m = this.getHomeUIModel(ep ? { title: ep.title, background: art || undefined } : { title: '모든 사건 해결!' });

      // 배경: 전용/테마 배경 → 없으면 기본 배경 위에 테마 색(30종 순환)을 반투명으로 덮는다
      const bg = m.centerStage.background;
      const tint = bg.fallbackGradient.replace(/hsl\(([^)]+)\)/g, 'hsla($1, 0.55)');
      bg.hasArt = !!art;
      bg.css = art ? `url('${art}')` : `${tint}, url('${(TP.ASSETS && TP.ASSETS.defaultEpisodeBg) || ''}')`;

      // 칭호·코스튬: 레벨 구간 + 사건 해결 승급 (economy.js) · 아바타 일러스트
      Object.assign(m.profileWidget, {
        title: TP.titleOf(s),
        costumeName: TP.costumeNameOf(s),
        avatarUrl: TP.avatarOf(s),
      });
      // 한정 특가 가격은 실제 상점 상품(초보 탐정 스타터팩) 기준
      const starter = TP.SHOP_PRODUCTS && TP.SHOP_PRODUCTS.find(p => p.id === STARTER.shop);
      if (starter) m.topBar.specialOffer.priceText = `$${starter.price} / ${starter.priceKRW.toLocaleString()}원`;
      // 단서 총개수는 에피소드 데이터 기준
      if (ep) {
        const total = ep.clues.length;
        Object.assign(m.centerStage, {
          maxClues: total,
          clueText: `CLUE : ${String(s.episode.cleared).padStart(2, '0')}/${total}`,
          readyForAccusation: s.episode.cleared >= total,
        });
      }
      // 무한 하트 표시
      if (TP.energy && TP.energy.isInfinite()) {
        const st = TP.energy.status();
        Object.assign(m.rightControls.lifeWidget, { infinite: true, timerText: TP.formatDuration(st.infiniteLeftMs) });
      }
      return m;
    }
  }

  TP.HomeGameManager = StoreBackedHomeManager;
  TP.home = new StoreBackedHomeManager();
})();
