// 플레이어 상태 (골드·아이템·레벨) + localStorage 저장
//   TP.store.state       : 현재 상태 (읽기 전용으로 사용)
//   TP.store.update(fn)  : fn(state)로 수정 → 자동 저장 + 구독자 알림
//   TP.store.spend(key, n) / grant(rewards) / subscribe(fn) / reset()
//   보관 항목: gold, undoCount, wildcardCount, hintCount, adPassCount, playerLevel, noAdsActive, purchasedOnce,
//             winStreak, bestStreak, claimedStreakMilestones, selectedMultiplier, totalStagesCleared,
//             specialOfferExpiresAt, activeRun, episode(추리 진행), solvedEpisodes, settings(오디오·닉네임), settings(오디오·닉네임),
//             energy, lastEnergyTime, infiniteEnergyUntil, energyAdDay, energyAdCount (수사 에너지, energy.js)
// ※ 기획서의 "로컬 세이브 데이터 암호화"는 출시 단계에서 이 load/save만 교체하면 된다.
(function () {
  const TP = (globalThis.TP ??= {});

  // 시간은 전부 여기서 읽는다 (테스트에서 TP.now를 바꿔 시간 경과를 흉내 낸다)
  TP.now ??= () => Date.now();

  const STORAGE_KEY = 'tripeaks-mystery.player.v1';
  const MAX_LEVEL = 999;
  const DEFAULTS = Object.freeze({
    gold: 1500,
    undoCount: 2,
    wildcardCount: 1,
    hintCount: 0,        // 힌트권 (스페셜 오퍼 등으로 획득, 지목 단계에서 광고 대신 사용)
    adPassCount: 0,      // 보상형 광고 패스권 (광고 시청 없이 바로 보상)
    playerLevel: 1,
    exp: 0,              // 현재 레벨에서 모은 경험치 (economy.js TP.applyExp)
    noAdsActive: false,  // 광고 제거 구매 → 전면·배너 광고 스킵
    energy: 5,           // 수사 에너지 (energy.js)
    lastEnergyTime: 0,
    infiniteEnergyUntil: 0,
    energyAdDay: '',
    energyAdCount: 0,
    purchasedOnce: [],   // 1회 한정 상품 구매 기록
    offerPurchased: false, // 스페셜 오퍼(스타터팩 · 특가 팩)를 한 번이라도 샀는지 → 홈의 SPECIAL OFFER 버튼 숨김
    ownedCardBacks: ['default'], // 보유한 카드 뒷면 스킨 (js/card-backs.js · 50연승 프레스티지 보상)
    equippedCardBack: 'default', // 장착 중인 카드 뒷면
    gridGuideSeen: false,        // 논리 그리드 사용법 안내를 봤는지 (처음 한 번 자동으로 띄움)
    winStreak: 0,        // 실패 없이 연속 클리어한 횟수 (streak.js)
    lostStreak: 0,       // 방금 끊긴 연승 — 500G로 되살릴 수 있음 (다음 입장 전까지)
    bestStreak: 0,
    claimedStreakMilestones: [],  // 이번 연승 사이클에서 받은 마일스톤 (home_progression_system)
    selectedMultiplier: 1,        // 마지막으로 고른 배수
    totalStagesCleared: 0,
    homeOfferRound: 0,            // 홈 SPECIAL OFFER 가 끝난 회차 수 (닫거나 사면 +1, 2회차 끝나면 영영 없음)
    homeOfferNextAt: 0,           // 홈 SPECIAL OFFER 가 다시 뜰 수 있는 시각 (회차가 끝나면 10일 뒤)
    specialOfferExpiresAt: 0,     // 초보 탐정 스타터팩 한정 특가 마감 시각 (0 = 아직 시작 안 함)
    activeRun: null,     // 진행 중인 판 { seed, tierId, stage, mult, fee, buffs, state } — 튕기면 이 상태로 이어하기 (state = game.serialize())
    episode: {
      index: 0, cleared: 0, marks: {}, canAccuse: true, wrongAccusations: 0, hintsShown: 0, unread: 0,
      reaccuseAdWatchCount: 0,   // 재지목 할인 광고 시청 횟수 (에피소드 단위)
      hasFreeReaccuse: false,    // 무료 재지목권 보유
      freeReaccuseGranted: false, // 힌트 3종 완성 보상을 이미 받았는지 (에피소드당 1회)
      stamped: [],               // 수사 보드에서 ✕ 도장 연출을 이미 보여 준 용의자 (새로 소거된 사람만 쾅 찍힘)
    },
    solvedEpisodes: [],  // 해결한 에피소드 id (칭호 승급에 반영)
    stageStars: {},      // 스테이지 최고 별 { [episodeId]: { [stage]: 1~3 } }
    dailyBonus: { installDay: '', claimed: 0, lastClaimDay: '' },   // 설치 후 7일 로그인 보너스 (js/daily-bonus.js)
    settings: { bgmOn: true, bgmVol: 70, sfxOn: true, sfxVol: 80, nickname: '탐정님' },   // 플레이어 설정 (settings.js)
  });

  // 닉네임: 앞뒤 공백 제거, 제어문자·꺾쇠 제거, 최대 12자, 비면 기본값
  TP.NICKNAME_MAX = 12;
  TP.sanitizeNickname = name => {
    const s = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, TP.NICKNAME_MAX);
    return s || DEFAULTS.settings.nickname;
  };

  const LOGIC_VER = 2;   // tools/logic_gen.py v2 단서 (2026-10-18)
  const listeners = [];
  let state = load();

  function sanitizeStars(v) {
    const out = {};
    if (!v || typeof v !== 'object') return out;
    for (const [ep, stages] of Object.entries(v)) {
      if (!stages || typeof stages !== 'object') continue;
      const clean = {};
      for (const [st, n] of Object.entries(stages)) {
        if (/^\d{1,3}$/.test(st) && [1, 2, 3].includes(n)) clean[st] = n;
      }
      if (Object.keys(clean).length) out[ep] = clean;
    }
    return out;
  }

  function sanitize(s) {
    const int = (v, min, max, d) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : d);
    return {
      gold: int(s.gold, 0, 1e9, DEFAULTS.gold),
      undoCount: int(s.undoCount, 0, 9999, DEFAULTS.undoCount),
      wildcardCount: int(s.wildcardCount, 0, 9999, DEFAULTS.wildcardCount),
      hintCount: int(s.hintCount, 0, 9999, 0),
      adPassCount: int(s.adPassCount, 0, 9999, 0),
      playerLevel: int(s.playerLevel, 1, MAX_LEVEL, DEFAULTS.playerLevel),
      exp: int(s.exp, 0, 1e9, 0),
      noAdsActive: s.noAdsActive === true || s.hasAdsRemoved === true, // 예전 저장 필드(hasAdsRemoved) 이전
      energy: int(s.energy, 0, 99, DEFAULTS.energy),
      lastEnergyTime: int(s.lastEnergyTime, 0, 8.64e15, 0),
      infiniteEnergyUntil: int(s.infiniteEnergyUntil, 0, 8.64e15, 0),
      energyAdDay: typeof s.energyAdDay === 'string' ? s.energyAdDay : '',
      energyAdCount: int(s.energyAdCount, 0, 99, 0),
      purchasedOnce: Array.isArray(s.purchasedOnce) ? s.purchasedOnce.filter(x => typeof x === 'string') : [],
      offerPurchased: s.offerPurchased === true,
      gridGuideSeen: s.gridGuideSeen === true,
      ownedCardBacks: [...new Set(['default', ...(Array.isArray(s.ownedCardBacks) ? s.ownedCardBacks.filter(x => typeof x === 'string') : [])])],
      equippedCardBack: typeof s.equippedCardBack === 'string' && (s.ownedCardBacks || ['default']).includes(s.equippedCardBack)
        ? s.equippedCardBack : 'default',
      winStreak: int(s.winStreak, 0, 1e6, 0),
      lostStreak: int(s.lostStreak, 0, 1e6, 0),
      bestStreak: int(s.bestStreak, 0, 1e6, 0),
      claimedStreakMilestones: Array.isArray(s.claimedStreakMilestones)
        ? [...new Set(s.claimedStreakMilestones.filter(Number.isInteger))] : [],
      selectedMultiplier: [1, 2, 4].includes(s.selectedMultiplier) ? s.selectedMultiplier : 1,
      totalStagesCleared: int(s.totalStagesCleared, 0, 1e9, 0),
      specialOfferExpiresAt: int(s.specialOfferExpiresAt, 0, 8.64e15, 0),
      homeOfferRound: int(s.homeOfferRound, 0, 2, 0),
      homeOfferNextAt: int(s.homeOfferNextAt, 0, 8.64e15, 0),
      activeRun: s.activeRun && Number.isFinite(s.activeRun.seed) ? { ...s.activeRun } : null,
      episode: sanitizeEpisode(s.episode || {}, int),
      solvedEpisodes: Array.isArray(s.solvedEpisodes) ? s.solvedEpisodes.filter(x => typeof x === 'string') : [],
      stageStars: sanitizeStars(s.stageStars),
      dailyBonus: {
        installDay: /^\d{4}-\d{2}-\d{2}$/.test(s.dailyBonus?.installDay || '') ? s.dailyBonus.installDay : '',
        claimed: int(s.dailyBonus?.claimed, 0, 7, 0),
        lastClaimDay: /^\d{4}-\d{2}-\d{2}$/.test(s.dailyBonus?.lastClaimDay || '') ? s.dailyBonus.lastClaimDay : '',
      },
      settings: sanitizeSettings(s.settings || {}, int),
    };
  }

  function sanitizeSettings(st, int) {
    const d = DEFAULTS.settings;
    return {
      bgmOn: st.bgmOn !== false,
      bgmVol: int(st.bgmVol, 0, 100, d.bgmVol),
      sfxOn: st.sfxOn !== false,
      sfxVol: int(st.sfxVol, 0, 100, d.sfxVol),
      nickname: TP.sanitizeNickname(st.nickname),
    };
  }

  function sanitizeEpisode(e, int) {
    const marks = {};
    for (const [id, m] of Object.entries(e.marks || {})) if (m === 'star' || m === 'x') marks[id] = m;
    return {
      index: int(e.index, 0, 999, 0),
      cleared: int(e.cleared, 0, 999, 0),
      marks,
      canAccuse: e.canAccuse !== false,
      wrongAccusations: int(e.wrongAccusations, 0, 1e6, 0),
      hintsShown: int(e.hintsShown, 0, 99, 0),
      unread: int(e.unread, 0, 999, 0),
      reaccuseAdWatchCount: int(e.reaccuseAdWatchCount, 0, 999, 0),
      hasFreeReaccuse: e.hasFreeReaccuse === true,
      freeReaccuseGranted: e.freeReaccuseGranted === true,
      stamped: Array.isArray(e.stamped) ? e.stamped.filter(x => typeof x === 'string') : [],
      // 논리 그리드 메모: 단서 데이터 버전이 바뀌면(퍼즐이 새로 생성됨) 예전 ✕/○ 는 다른 문제의 답이라 비운다
      grid: e.logicVer === LOGIC_VER ? Object.fromEntries(Object.entries(e.grid && typeof e.grid === 'object' ? e.grid : {})
        .filter(([k, v]) => typeof k === 'string' && (v === 'x' || v === 'o'))) : {},
      logicVer: LOGIC_VER,
      gridVerified: e.logicVer === LOGIC_VER && Array.isArray(e.gridVerified) ? e.gridVerified.filter(x => typeof x === 'string') : [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitize({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch (e) { /* 저장소 사용 불가(사생활 보호 모드 등) → 기본값으로 진행 */ }
    return sanitize(DEFAULTS);
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }

  TP.store = {
    MAX_LEVEL,
    get state() { return state; },

    update(fn) {
      const prev = state;
      const next = structuredClone(state);
      fn(next);
      state = sanitize(next);
      save();
      listeners.forEach(l => l(state, prev));
    },

    // 보유량이 부족하면 false, 충분하면 차감 후 true
    spend(key, amount) {
      if (state[key] < amount) return false;
      this.update(s => { s[key] -= amount; });
      return true;
    },

    // 보상 지급. infiniteMinutes는 남은 무한 에너지 시간 뒤에 이어 붙는다.
    grant({ gold = 0, undo = 0, wild = 0, hint = 0, adPass = 0, infiniteMinutes = 0, removeAds = false, levels = 0 } = {}) {
      const t = TP.now();
      this.update(s => {
        s.gold += gold;
        s.undoCount += undo;
        s.wildcardCount += wild;
        s.hintCount += hint;
        s.adPassCount += adPass;
        s.playerLevel += levels;
        if (infiniteMinutes) s.infiniteEnergyUntil = Math.max(t, s.infiniteEnergyUntil) + infiniteMinutes * 60000;
        if (removeAds) s.noAdsActive = true;
      });
    },

    subscribe(fn) { listeners.push(fn); fn(state, state); },

    reset() { this.update(s => Object.assign(s, structuredClone(DEFAULTS))); },
  };
})();
