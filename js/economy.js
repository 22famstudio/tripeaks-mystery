// 재화 경제 규칙: 배수(판돈), 입장료, 클리어 보상, 이어하기, 레벨 칭호
(function () {
  const TP = (globalThis.TP ??= {});

  // 홈·성장 규칙 원본: js/core/home_progression_system.js (레벨 구간 칭호·코스튬·입장료·보상, EXP 곡선, 연승 마일스톤)
  TP.HP = globalThis.HomeProgressionSystem
    || (typeof require === 'function' ? require('./core/home_progression_system.js') : null);

  // x · 해금 레벨. fee 는 1구간(Lv.1~13) 기준값 — 실제 입장료는 레벨 구간에 따라 오른다 (TP.entryFee)
  TP.MULTIPLIERS = [
    { x: 1, fee: 100, minLevel: 1 },
    { x: 2, fee: 200, minLevel: 20 },
    { x: 4, fee: 400, minLevel: 40 },
  ];

  TP.BASE_REWARD = { min: 150, max: 220 };

  // GDD 4장 정산 — js/core/tripeaks_core_engine.js 의 calculateSettlement 를 그대로 사용한다.
  //   기본 150 + 남은 덱 1장당 5 + 최고 콤보 1당 2(최대 25) → 최대 220, 여기에 배수를 곱한다
  //   연승 버프 '콤보 배율 +N'은 최고 콤보를 (1+N)배로 쳐서 콤보 보너스에만 반영 (상한 25는 그대로)
  // 배수(1x/2x/4x)는 입장 판돈과 승리 골드에만 적용된다. 생명력 소모는 배수와 상관없이 1칸.
  const coreEngine = () => globalThis.TriPeaksEngine
    || (typeof require === 'function' ? require('./core/tripeaks_core_engine.js') : null);

  // 기존 엔진의 판 결과({stockLeft, bestCombo, remaining}) → 코어 엔진 정산 결과
  //   { won, multiplier, entryCost, baseGross, grossReward, netProfit, clueEarned, ... }
  TP.settleStage = function ({ won = true, stockLeft = 0, bestCombo = 0, remaining = 0 }, x = 1, comboBoost = 0) {
    const view = {
      status: won ? 'won' : 'lost',
      multiplier: x,
      baseEntryFee: TP.MULTIPLIERS[0].fee,
      slots: Array.from({ length: won ? 0 : remaining }, () => ({ removed: false })),
      stock: { length: stockLeft },
      maxStreak: bestCombo * (1 + comboBoost),
    };
    return coreEngine().TriPeaksGame.prototype.calculateSettlement.call(view);
  };

  TP.calcReward = function ({ stockLeft, bestCombo }, x, comboBoost = 0) {
    const settlement = TP.settleStage({ won: true, stockLeft, bestCombo }, x, comboBoost);
    return { base: TP.BASE_REWARD.min, bonus: settlement.baseGross - TP.BASE_REWARD.min, total: settlement.grossReward, settlement };
  };

  // 덱 소진 시 이어하기
  TP.CONTINUE_OFFER = { cost: 900, cards: 5 };
  // 보상형 광고 부활 (코어 엔진 grantAdExtraCards): 판당 1번, 덱 +3장
  TP.AD_REVIVE_CARDS = 3;

  // 연승 사다리(마일스톤 보상 · 인게임 버프 · 세이브)는 js/streak.js

  // ---------- 레벨 구간별 입장료 · 보상 (home_progression_system LEVEL_TIERS) ----------
  //   Lv.1~13 100G · 14~33 150G · 34~53 250G · 54~103 400G · 104~153 600G · 154~199 850G · 200+ 1,200G (× 배수)
  TP.levelTier = level => TP.HP.getTierForLevel(level);
  TP.entryFee = (level, x = 1) => TP.levelTier(level).baseEntryFee * x;
  TP.rewardRange = (level, x = 1) => {
    const t = TP.levelTier(level);
    return { min: t.baseRewardMin * x, max: t.baseRewardMax * x };
  };

  // ---------- 레벨 · 경험치 (home_progression_system 곡선) ----------
  //   필요 EXP = 100 + 20(L-1) + 4(L-1)^1.55  →  Lv1→2: 100 · Lv10→11: 400 · Lv20→21: 863 · Lv50→51: 2,746 · Lv100→101: 7,037
  TP.LEVELING = { MAX_LEVEL: 999, LOSS_EXP: 15 };
  TP.expToNext = level => TP.HP.getRequiredExpForLevel(level);
  // 승리 EXP: (45 + 최고 콤보×2) × (1 + (배수-1)×0.25)  — recordStageResult 와 같은 식
  TP.winExp = ({ bestCombo = 0 } = {}, x = 1) => Math.round((45 + bestCombo * 2) * (1 + (x - 1) * 0.25));

  // 상태(level, exp)에 EXP를 더해 레벨업까지 처리한 결과 (순수 함수)
  TP.applyExp = function ({ level, exp }, amount) {
    let lv = level;
    let e = exp + amount;
    while (lv < TP.LEVELING.MAX_LEVEL && e >= TP.expToNext(lv)) {
      e -= TP.expToNext(lv);
      lv++;
    }
    if (lv >= TP.LEVELING.MAX_LEVEL) e = 0;
    return { level: lv, exp: e, levelsGained: lv - level };
  };

  // ---------- 칭호 · 아바타 코스튬 ----------
  // 7단계 칭호·의상 이름은 home_progression_system LEVEL_TIERS 를 그대로 쓴다.
  // 단계 = max(레벨로 오른 단계, 해결한 에피소드 수) → 레벨이 낮아도 사건을 풀면 승급 (기존 규칙 유지)
  // costume: 아바타 일러스트 (단계마다 1장)
  const COSTUME_ART = ['casual', 'trench', 'tweed', 'cape', 'agent', 'master', 'legend'];
  TP.TITLE_TIERS = TP.HP.LEVEL_TIERS.map((t, i) => ({
    min: t.minLv, name: t.title, costumeName: t.costumeName, costumeId: t.costumeId,
    numerals: i === 0,                     // 첫 구간: I~V (2레벨마다)
    costume: COSTUME_ART[i],
  }));
  // 홈 좌측 하단 캐릭터: game_assets/avatar_(레벨).webp — 파일명의 숫자 = 그 그림이 나오기 시작하는 레벨
  //   플레이어 레벨 이하 중 가장 큰 숫자의 그림을 쓴다 (예: Lv.11~15 → avatar_11.webp, Lv.16 → avatar_16.webp)
  //   새 그림을 넣으면 이 목록에 숫자만 추가 (file:// 실행이라 폴더를 직접 읽을 수 없음)
  TP.AVATAR_LEVELS = [1, 6, 11, 16, 21, 26, 31, 41, 51, 61, 71, 81, 91, 101, 111, 131, 151, 181, 201, 251, 301, 401, 501, 511, 531, 701, 801, 811];
  TP.avatarForLevel = level => {
    const at = TP.AVATAR_LEVELS.filter(n => n <= Math.max(1, level)).pop() || TP.AVATAR_LEVELS[0];
    return `game_assets/avatar_${at}.webp`;
  };
  const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

  TP.titleTier = function (level, solvedCount = 0) {
    const levelRank = TP.TITLE_TIERS.filter(t => level >= t.min).length - 1;
    const rank = Math.min(TP.TITLE_TIERS.length - 1, Math.max(levelRank, solvedCount));
    return { rank, levelRank, ...TP.TITLE_TIERS[rank] };
  };

  TP.playerTitle = function (level, solvedCount = 0) {
    const t = TP.titleTier(level, solvedCount);
    // 레벨로 그 단계에 있을 때만 I~V 표기 (사건 해결로 승급한 경우는 단계명만)
    if (t.numerals && t.rank === t.levelRank) return `${t.name} ${NUMERALS[Math.min(4, Math.ceil(level / 2) - 1)]}`;
    return t.name;
  };
  TP.titleOf = state => TP.playerTitle(state.playerLevel, state.solvedEpisodes.length);
  TP.costumeNameOf = state => TP.titleTier(state.playerLevel, state.solvedEpisodes.length).costumeName;
  TP.avatarOf = state => TP.avatarForLevel(state.playerLevel);   // 레벨별 캐릭터 (avatar_N.webp)

  // ---------- 특별 할인 타이머 ----------
  // 로컬 시각 기준 3시간 단위로 오퍼가 교체된다고 보고, 현재 창이 끝날 때까지 남은 시간을 돌려준다.
  TP.OFFER_WINDOW_MS = 3 * 60 * 60 * 1000;
  TP.offerTimeLeft = function (t = TP.now ? TP.now() : Date.now()) {
    const d = new Date(t);
    const sinceMidnight = t - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return TP.OFFER_WINDOW_MS - (sinceMidnight % TP.OFFER_WINDOW_MS);
  };
})();
