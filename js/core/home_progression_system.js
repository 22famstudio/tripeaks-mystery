/**
 * TriPeaks Mystery Solitaire - Home UI, Economy & Progression System
 * ==================================================================
 * 손글씨 기획안(홈 화면 UI 스케치) 및 GDD 4~6장 완벽 반영 모듈:
 * 1. 생명력(Life / 하트) 시스템: 최대 5개, 20분(1,200초)마다 1개 자동 충전 타이머 및 골드/광고 충전
 * 2. 레벨(Lv.1~999) 및 경험치 커브: 레벨이 오를수록 요구 경험치가 증가하여 성장이 점진적으로 느려짐
 * 3. 레벨 구간별 프로필 칭호(Title) & 탐정 코스튬(의상) 자동 변경 + 구간별 입장료/보상 인플레이션
 * 4. 플레이 버튼 -> 배수(1x, 2x, 4x) 선택 시스템 (Lv.1: 1배, Lv.20: 2배 해금, Lv.40: 4배 해금)
 * 5. 연속 승리 보상(Win Streak): 3연승, 5연승, 10연승, 15연승, 20연승 달성 시 매력적인 보상 지급
 *    (단, 20연승 최대 보상을 상점 $2.99 패키지 가치 수준으로 제한하여 상점 카니발리제이션 방지)
 * 6. 상단 바 Special Offer(한정 시간 타이머) & 상점(Shop) 패키지 구매 처리
 * 7. 에피소드별 배경 테마(30종 순환 폴백 포함) 및 단서 진행도(CLUE: 03/20) 표시 데이터 제공
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HomeProgressionSystem = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIFE_MAX = 5;
  const LIFE_REGEN_MS = 20 * 60 * 1000; // 20분 (1,200,000ms)
  const MAX_LEVEL = 999;

  /**
   * 손글씨 기획안 + GDD 통합: 레벨 구간별 칭호, 코스튬, 입장료/보상 스케일 테이블
   * - 레벨 카테고리가 올라갈수록 기본 플레이 가격(입장료)과 승리 보상이 함께 상승
   */
  const LEVEL_TIERS = [
    {
      minLv: 1, maxLv: 13,
      title: '오지랖 넓은 시민',
      costumeId: 'costume_citizen_1',
      costumeName: '동네 산책 조끼와 돋보기',
      avatarEmoji: '🧐',
      baseEntryFee: 100,
      baseRewardMin: 150,
      baseRewardMax: 220
    },
    {
      minLv: 14, maxLv: 33,
      title: '흥신소 수습 인턴',
      costumeId: 'costume_intern_2',
      costumeName: '체크무늬 수습생 트렌치코트',
      avatarEmoji: '🕵️',
      baseEntryFee: 150,
      baseRewardMin: 225,
      baseRewardMax: 330
    },
    {
      minLv: 34, maxLv: 53,
      title: '흥신소 베테랑 소장',
      costumeId: 'costume_chief_3',
      costumeName: '클래식 브라운 중절모와 코트',
      avatarEmoji: '🕵️‍♂️',
      baseEntryFee: 250,
      baseRewardMin: 375,
      baseRewardMax: 550
    },
    {
      minLv: 54, maxLv: 103,
      title: '동네 골목 명탐정',
      costumeId: 'costume_detective_4',
      costumeName: '셜록 케이프 코트와 사냥모자',
      avatarEmoji: '🎩',
      baseEntryFee: 400,
      baseRewardMin: 600,
      baseRewardMax: 880
    },
    {
      minLv: 104, maxLv: 153,
      title: '미스터리 특수 해결사',
      costumeId: 'costume_solver_5',
      costumeName: '네이비 시크릿 에이전트 수트',
      avatarEmoji: '🕶️',
      baseEntryFee: 600,
      baseRewardMin: 900,
      baseRewardMax: 1320
    },
    {
      minLv: 154, maxLv: 199,
      title: '국가대표 추리 거장',
      costumeId: 'costume_master_6',
      costumeName: '골드 엠블럼 마스터 망토',
      avatarEmoji: '👑',
      baseEntryFee: 850,
      baseRewardMin: 1275,
      baseRewardMax: 1870
    },
    {
      minLv: 200, maxLv: 999,
      title: '글로벌 전설의 명탐정',
      costumeId: 'costume_legend_7',
      costumeName: '로열 다이아몬드 명탐정 예복',
      avatarEmoji: '🌟',
      baseEntryFee: 1200,
      baseRewardMin: 1800,
      baseRewardMax: 2640
    }
  ];

  /**
   * 배수(Multiplier) 해금 조건 정의 (GDD 4장 반영)
   */
  const MULTIPLIER_OPTIONS = [
    { multiplier: 1, unlockLevel: 1,  label: '1배속 (안전 추리)' },
    { multiplier: 2, unlockLevel: 20, label: '2배속 (대담한 추리)' },
    { multiplier: 4, unlockLevel: 40, label: '4배속 (하이리스크 베팅)' }
  ];

  /**
   * 연속 승리 보상 (Win Streak: 3, 5, 10, 15, 20연승)
   * - 손글씨 기획안: "보상이 매력적이지만 상점에서 사는 것보다는 적은 보상 (예: 20연승 = $2.99 가치 정도)"
   * - GDD 기준 $2.99 스타터팩 가치 = 3,000G + 되돌리기 5 + 와일드 3
   * - 따라서 3~20연승 누적 합계가 약 2,200G + 되돌리기 4 + 와일드 2 수준이 되도록 정교하게 배분
   */
  // 값이 [최소, 최대] 배열이면 달성 순간에 그 범위에서 무작위 (정수). life = 하트(생명력)
  // 50연승 프레스티지: 카드 뒷면 스킨 1종 해제 (모두 모았으면 대체 보상, 지급은 바깥 — js/card-backs.js) 후 연승 0으로 리셋
  const WIN_STREAK_MILESTONES = [
    { streak: 3,  gold: 0,          undo: 0,      wild: 0, life: 1, label: '3연승 달성!' },
    { streak: 7,  gold: [100, 200], undo: 0,      wild: 0, life: 1, hint: 1, label: '7연승 달성!' },
    { streak: 10, gold: [100, 200], undo: 0,      wild: 0, life: 2, label: '10연승 달성!' },
    { streak: 20, gold: [200, 500], undo: [1, 2], wild: 0, life: 0, hint: 1, label: '20연승 달성!' },
    { streak: 30, gold: 500,        undo: 1,      wild: 1, life: 0, hint: 2, label: '30연승 마스터!' },
    { streak: 50, gold: 0,          undo: 0,      wild: 0, life: 0, prestige: true, label: '50연승 프레스티지!' }
  ];
  const WIN_STREAK_RESET_AT = 50;

  // 마일스톤 보상 굴리기: [min, max] → 정수 하나
  function rollStreakReward(milestone, rng = Math.random) {
    const roll = v => (Array.isArray(v) ? v[0] + Math.floor(rng() * (v[1] - v[0] + 1)) : (v || 0));
    return {
      streak: milestone.streak,
      label: milestone.label,
      gold: roll(milestone.gold),
      undo: roll(milestone.undo),
      wild: roll(milestone.wild),
      life: roll(milestone.life),
      hint: roll(milestone.hint),                 // 힌트권 (논리 그리드 칸 확인) — 모듈 상태에는 없고 바깥(home-bridge · streak.js)이 지급
      prestige: !!milestone.prestige
    };
  }

  /**
   * GDD 6장 상점(Shop) & Special Offer 상품 테이블
   */
  const SHOP_CATALOG = [
    {
      id: 'gold_small',
      name: '소형 골드 주머니',
      priceUSD: 0.99,
      priceKRW: 1500,
      gold: 1000,
      undo: 0,
      wild: 0,
      removeAds: false,
      tag: '입문용'
    },
    {
      id: 'gold_medium',
      name: '중형 골드 상자',
      priceUSD: 1.99,
      priceKRW: 3000,
      gold: 2500,
      undo: 2,
      wild: 0,
      removeAds: false,
      tag: '가성비'
    },
    {
      id: 'gold_large',
      name: '대형 골드 금고',
      priceUSD: 4.99,
      priceKRW: 7500,
      gold: 6500,
      undo: 0,
      wild: 3,
      removeAds: false,
      tag: '인기'
    },
    {
      id: 'remove_ads_pack',
      name: '광고 제거 패키지',
      priceUSD: 3.99,
      priceKRW: 4400,
      gold: 1000,
      undo: 0,
      wild: 0,
      removeAds: true,
      oneTime: true,
      tag: '추천 1순위'
    },
    {
      id: 'starter_detective_pack',
      name: '초보 탐정 스타터팩',
      priceUSD: 2.99,
      priceKRW: 4400,
      gold: 3000,
      undo: 5,
      wild: 3,
      removeAds: false,
      oneTime: true,
      isSpecialOffer: true,
      offerDurationMs: 24 * 60 * 60 * 1000, // 24시간 타이머
      tag: '한정 특가'
    }
  ];

  /**
   * 레벨업에 필요한 요구 경험치 계산 함수
   * - 손글씨 기획안: "Level 오르는 속도는 점점 느려짐"
   * - 완만한 지수+다항 증가식: Lv.1->2는 100 EXP, Lv.20은 약 580 EXP, Lv.100은 약 4,500 EXP
   */
  function getRequiredExpForLevel(level) {
    if (level >= MAX_LEVEL) return Infinity;
    return Math.floor(100 + (level - 1) * 20 + Math.pow(level - 1, 1.55) * 4);
  }

  /**
   * 현재 레벨에 해당하는 티어(칭호, 의상, 입장료, 보상 범위) 반환
   */
  function getTierForLevel(level) {
    const clamped = Math.max(1, Math.min(MAX_LEVEL, level));
    for (const tier of LEVEL_TIERS) {
      if (clamped >= tier.minLv && clamped <= tier.maxLv) {
        return { ...tier };
      }
    }
    return { ...LEVEL_TIERS[LEVEL_TIERS.length - 1] };
  }

  /**
   * 에피소드 번호(1~300)에 맞춰 30개의 배경 테마 에셋 경로를 매핑
   * - 손글씨 기획안: "에피소드에 맞는 배경 (30개 생성 필요)"
   */
  function getEpisodeBackgroundInfo(episodeId, episodeData = {}) {
    const themeIndex = ((Math.max(1, episodeId) - 1) % 30) + 1;
    const padded = String(themeIndex).padStart(2, '0');
    const customBg = episodeData.background || `assets/backgrounds/bg_theme_${padded}.jpg`;
    return {
      themeIndex,
      backgroundUrl: customBg,
      fallbackGradient: `linear-gradient(135deg, hsl(${(themeIndex * 37) % 360}, 45%, 22%), hsl(${(themeIndex * 37 + 40) % 360}, 50%, 12%))`
    };
  }

  /**
   * 밀리초(ms)를 "MM:SS" 또는 "HH:MM:SS" 포맷으로 변환 (하트 타이머 및 오퍼 타이머용)
   */
  function formatTimer(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  }

  /**
   * =========================================================================
   * HomeGameManager 클래스: 유저 프로필, 생명력, 배수 진입, 연승, 홈 UI 렌더링 관리
   * =========================================================================
   */
  class HomeGameManager {
    constructor(options = {}) {
      this.storageKey = options.storageKey || 'tripeaks_mystery_profile_v2';
      this.nowFn = options.nowFn || (() => Date.now());
      this.rng = options.rng || Math.random;          // 연승 보상 범위 굴림 (테스트에서 고정 가능)
      this.onStateChange = options.onStateChange || null;

      this.state = this._loadInitialState(options.initialState);
      this.syncTimers();
    }

    _loadInitialState(override) {
      const now = this.nowFn();
      const defaultState = {
        level: 1,
        exp: 0,
        gold: 1500,
        lives: LIFE_MAX,
        lastLifeRegenAt: now,
        selectedMultiplier: 1,
        currentEpisodeId: 1,
        cluesCollectedInEpisode: 0, // 0 ~ 20
        totalStagesCleared: 0,
        winStreak: 0,
        claimedStreakMilestones: [], // 현재 스트릭 사이클에서 수령한 마일스톤
        inventory: {
          undo: 3,
          wild: 2
        },
        adsRemoved: false,
        purchasedOneTimePacks: [],
        specialOfferExpiresAt: now + 24 * 60 * 60 * 1000
      };

      if (override) {
        return {
          ...defaultState,
          ...override,
          inventory: { ...defaultState.inventory, ...(override.inventory || {}) }
        };
      }

      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(this.storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            return {
              ...defaultState,
              ...parsed,
              inventory: { ...defaultState.inventory, ...(parsed.inventory || {}) }
            };
          }
        } catch (e) {
          // 로컬 스토리지 접근 불가 시 메모리 상태 사용
        }
      }
      return defaultState;
    }

    save() {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) {}
      }
      if (typeof this.onStateChange === 'function') {
        this.onStateChange(this.getHomeUIModel());
      }
    }

    /**
     * 1. 생명력(Life) 20분 자동 충전 계산
     * - 접속 중이거나 재접속했을 때 경과 시간만큼 하트를 자동 회복
     */
    syncTimers() {
      const now = this.nowFn();
      if (this.state.lives >= LIFE_MAX) {          // 연승 보상 하트로 최대치를 넘었으면 그대로 둔다 (충전만 멈춤)
        this.state.lastLifeRegenAt = now;
        return { lives: this.state.lives, remainingMsToNextLife: 0, formattedTimer: 'MAX' };
      }

      const elapsed = now - this.state.lastLifeRegenAt;
      if (elapsed >= LIFE_REGEN_MS) {
        const gained = Math.floor(elapsed / LIFE_REGEN_MS);
        this.state.lives = Math.min(LIFE_MAX, this.state.lives + gained);
        if (this.state.lives >= LIFE_MAX) {
          this.state.lastLifeRegenAt = now;
        } else {
          this.state.lastLifeRegenAt += gained * LIFE_REGEN_MS;
        }
      }

      const remainingMs = this.state.lives >= LIFE_MAX
        ? 0
        : Math.max(0, LIFE_REGEN_MS - (now - this.state.lastLifeRegenAt));

      return {
        lives: this.state.lives,
        remainingMsToNextLife: remainingMs,
        formattedTimer: this.state.lives >= LIFE_MAX ? 'MAX' : formatTimer(remainingMs)
      };
    }

    /**
     * 하트(Life) 충전: 골드 구매 또는 보상형 광고 시청
     */
    refillLife(method = 'gold') {
      this.syncTimers();
      if (this.state.lives >= LIFE_MAX) {
        return { ok: false, reason: 'LIFE_ALREADY_FULL' };
      }

      if (method === 'gold') {
        const lifeCost = 300; // 하트 1개 구매 비용 (또는 풀충전)
        if (this.state.gold < lifeCost) {
          return { ok: false, reason: 'INSUFFICIENT_GOLD', requiredGold: lifeCost };
        }
        this.state.gold -= lifeCost;
        this.state.lives = Math.min(LIFE_MAX, this.state.lives + 1);
      } else if (method === 'ad') {
        this.state.lives = Math.min(LIFE_MAX, this.state.lives + 1);
      }

      if (this.state.lives >= LIFE_MAX) {
        this.state.lastLifeRegenAt = this.nowFn();
      }
      this.save();
      return { ok: true, lives: this.state.lives, gold: this.state.gold };
    }

    /**
     * 2. 배수(1x, 2x, 4x) 선택 및 해금 검증
     */
    selectMultiplier(multiplier) {
      const option = MULTIPLIER_OPTIONS.find(o => o.multiplier === multiplier);
      if (!option) {
        return { ok: false, reason: 'INVALID_MULTIPLIER' };
      }
      if (this.state.level < option.unlockLevel) {
        return {
          ok: false,
          reason: 'LEVEL_TOO_LOW',
          requiredLevel: option.unlockLevel
        };
      }
      this.state.selectedMultiplier = multiplier;
      this.save();
      return { ok: true, selectedMultiplier: multiplier };
    }

    /**
     * 3. 홈 화면 [Play] 버튼 -> 배수 확정 후 스테이지 진입 처리
     * - 하트 1개 및 (레벨 구간 기본 입장료 * 배수) 골드 차감
     */
    startStageWithBet(requestedMultiplier) {
      this.syncTimers();
      const mult = requestedMultiplier !== undefined ? requestedMultiplier : this.state.selectedMultiplier;
      const multCheck = this.selectMultiplier(mult);
      if (!multCheck.ok) return multCheck;

      if (this.state.lives <= 0) {
        return { ok: false, reason: 'NO_LIFE_REMAINING' };
      }

      const tier = getTierForLevel(this.state.level);
      const entryCost = tier.baseEntryFee * mult;

      if (this.state.gold < entryCost) {
        return {
          ok: false,
          reason: 'INSUFFICIENT_GOLD',
          requiredGold: entryCost,
          currentGold: this.state.gold
        };
      }

      // 하트가 MAX 상태에서 처음 깎일 때 타이머 시작점 갱신
      if (this.state.lives === LIFE_MAX) {
        this.state.lastLifeRegenAt = this.nowFn();
      }

      this.state.lives -= 1;
      this.state.gold -= entryCost;
      this.save();

      return {
        ok: true,
        episodeId: this.state.currentEpisodeId,
        stageNumber: Math.min(20, this.state.cluesCollectedInEpisode + 1),
        multiplier: mult,
        entryCostPaid: entryCost,
        baseEntryFee: tier.baseEntryFee,
        remainingGold: this.state.gold,
        remainingLives: this.state.lives
      };
    }

    /**
     * 4. 스테이지 종료 후 결과 정산 (승리/패배, 경험치/레벨업, 단서 획득, 연속 승리 보상)
     */
    recordStageResult({ won, remainingStockCards = 0, maxStreak = 0, multiplier, clueEligible = true }) {
      const mult = multiplier || this.state.selectedMultiplier || 1;
      const tier = getTierForLevel(this.state.level);

      if (!won) {
        // 패배 시: 연속 승리(Win Streak) 초기화
        this.state.winStreak = 0;
        this.state.claimedStreakMilestones = [];
        this.save();
        return {
          won: false,
          goldEarned: 0,
          expEarned: 15, // 패배 시에도 소량의 위로 경험치 제공 여부 선택 가능
          levelUp: this._addExp(15),
          winStreak: 0,
          streakRewardClaimed: null,
          cluesCollectedInEpisode: this.state.cluesCollectedInEpisode,
          readyForAccusation: this.state.cluesCollectedInEpisode >= 20
        };
      }

      // 승리 시 보상 계산 (레벨 구간별 baseRewardMin ~ baseRewardMax 반영)
      const stockRatio = Math.min(1, remainingStockCards / 12);
      const comboRatio = Math.min(1, maxStreak / 10);
      const perfFactor = Math.min(1, stockRatio * 0.65 + comboRatio * 0.35);
      const baseReward = Math.round(
        tier.baseRewardMin + (tier.baseRewardMax - tier.baseRewardMin) * perfFactor
      );
      const totalGoldReward = baseReward * mult;

      // 승리 시 하트 1개 반환(클리어 시 하트 유지 방식) 또는 보너스 지급
      this.state.gold += totalGoldReward;
      this.state.totalStagesCleared += 1;

      // 단서 1개 획득 (최대 20개). clueEligible=false 는 이미 단서를 받은 스테이지를 다시 깬 경우 (바깥에서 판단)
      let newClueUnlocked = false;
      if (clueEligible && this.state.cluesCollectedInEpisode < 20) {
        this.state.cluesCollectedInEpisode += 1;
        newClueUnlocked = true;
      }

      // 연속 승리(Win Streak) 갱신 및 마일스톤 보상 체크 (3, 7, 10, 20, 30연승)
      //   중복 플레이(이미 깬 스테이지라 단서를 얻지 못함)는 연승을 올리지 않는다 — 초기화도 하지 않고 그대로 유지
      let streakRewardClaimed = null;
      if (newClueUnlocked) {
        this.state.winStreak += 1;
        const milestone = WIN_STREAK_MILESTONES.find(
          m => m.streak === this.state.winStreak && !this.state.claimedStreakMilestones.includes(m.streak)
        );

        if (milestone) {
          const reward = rollStreakReward(milestone, this.rng);
          this.state.gold += reward.gold;
          this.state.inventory.undo += reward.undo;
          this.state.inventory.wild += reward.wild;
          this.state.lives += reward.life;             // 하트는 최대치(5)를 넘어 쌓일 수 있음
          this.state.claimedStreakMilestones.push(milestone.streak);
          streakRewardClaimed = reward;

          // 50연승(프레스티지) 달성 시 연승을 0으로 리셋 (다음 스킨을 목표로 처음부터 다시)
          if (this.state.winStreak >= WIN_STREAK_RESET_AT) {
            this.state.winStreak = 0;
            this.state.claimedStreakMilestones = [];
          }
        }
      }

      // 경험치 부여 (배수 및 콤보 보너스 반영)
      const expEarned = Math.round((45 + maxStreak * 2) * (1 + (mult - 1) * 0.25));
      const levelUpInfo = this._addExp(expEarned);

      this.save();

      return {
        won: true,
        multiplier: mult,
        baseReward,                                     // 기본 승리 보상 (배수 적용 전) — 결과창 '기본 × 배수' 표시
        goldEarned: totalGoldReward,
        expEarned,
        levelUp: levelUpInfo,
        newClueUnlocked,
        streakCounted: newClueUnlocked,                 // false = 중복 플레이라 연승이 오르지 않음
        cluesCollectedInEpisode: this.state.cluesCollectedInEpisode,
        readyForAccusation: this.state.cluesCollectedInEpisode >= 20,
        winStreak: this.state.winStreak,
        streakRewardClaimed
      };
    }

    /**
     * 에피소드 최종 범인 지목 성공 시 처리 (GDD 2장 반영)
     */
    completeCurrentEpisode(reward = { gold: 1000, undo: 1, wild: 1 }) {
      // (밸런스) 골드 인플레이션 방지: 5,000G · 되돌리기 3 · 와일드 3 → 1,000G · 되돌리기 1 · 와일드 1
      if (this.state.cluesCollectedInEpisode < 20) {
        return { ok: false, reason: 'CLUES_INCOMPLETE' };
      }
      this.state.gold += reward.gold ?? 1000;
      this.state.inventory.undo += reward.undo ?? 1;
      this.state.inventory.wild += reward.wild ?? 1;

      const completedEp = this.state.currentEpisodeId;
      this.state.currentEpisodeId = Math.min(300, this.state.currentEpisodeId + 1);
      this.state.cluesCollectedInEpisode = 0;
      const levelUpInfo = this._addExp(200);

      this.save();
      return {
        ok: true,
        completedEpisodeId: completedEp,
        nextEpisodeId: this.state.currentEpisodeId,
        reward,
        levelUp: levelUpInfo
      };
    }

    /**
     * 경험치 추가 및 다중 레벨업 처리
     */
    _addExp(amount) {
      const prevLevel = this.state.level;
      const prevTier = getTierForLevel(prevLevel);
      this.state.exp += amount;

      while (this.state.level < MAX_LEVEL) {
        const req = getRequiredExpForLevel(this.state.level);
        if (this.state.exp >= req) {
          this.state.exp -= req;
          this.state.level += 1;
        } else {
          break;
        }
      }

      const newTier = getTierForLevel(this.state.level);
      return {
        leveledUp: this.state.level > prevLevel,
        prevLevel,
        newLevel: this.state.level,
        costumeChanged: prevTier.costumeId !== newTier.costumeId,
        newTitle: newTier.title,
        newCostumeName: newTier.costumeName
      };
    }

    /**
     * 상점 패키지 구매 처리
     */
    purchasePack(packId) {
      const pack = SHOP_CATALOG.find(p => p.id === packId);
      if (!pack) return { ok: false, reason: 'PACK_NOT_FOUND' };
      if (pack.oneTime && this.state.purchasedOneTimePacks.includes(packId)) {
        return { ok: false, reason: 'ALREADY_PURCHASED_ONE_TIME' };
      }

      this.state.gold += pack.gold;
      this.state.inventory.undo += pack.undo;
      this.state.inventory.wild += pack.wild;
      if (pack.removeAds) this.state.adsRemoved = true;
      if (pack.oneTime) this.state.purchasedOneTimePacks.push(packId);

      this.save();
      return {
        ok: true,
        pack,
        gold: this.state.gold,
        inventory: { ...this.state.inventory },
        adsRemoved: this.state.adsRemoved
      };
    }

    /**
     * 손글씨 홈 화면 스케치의 모든 UI 컴포넌트에 즉시 바인딩할 수 있는 뷰 모델 반환
     */
    getHomeUIModel(episodeMeta = {}) {
      const lifeStatus = this.syncTimers();
      const tier = getTierForLevel(this.state.level);
      const reqExp = getRequiredExpForLevel(this.state.level);
      const expPercent = Math.min(100, Math.round((this.state.exp / reqExp) * 100));

      const now = this.nowFn();
      const offerRemainingMs = Math.max(0, this.state.specialOfferExpiresAt - now);

      const nextMilestone = WIN_STREAK_MILESTONES.find(m => m.streak > this.state.winStreak)
        || WIN_STREAK_MILESTONES[WIN_STREAK_MILESTONES.length - 1];

      const bgInfo = getEpisodeBackgroundInfo(this.state.currentEpisodeId, episodeMeta);

      return {
        topBar: {
          specialOffer: {
            available: !this.state.purchasedOneTimePacks.includes('starter_detective_pack') && offerRemainingMs > 0,
            packId: 'starter_detective_pack',
            timerText: formatTimer(offerRemainingMs),
            priceText: '$2.99 / 4,400원'
          },
          level: this.state.level,
          exp: this.state.exp,
          reqExp,
          expPercent,
          gold: this.state.gold,
          formattedGold: this.state.gold.toLocaleString()
        },
        profileWidget: {
          level: this.state.level,
          title: tier.title,
          costumeId: tier.costumeId,
          costumeName: tier.costumeName,
          avatarEmoji: tier.avatarEmoji
        },
        centerStage: {
          episodeId: this.state.currentEpisodeId,
          episodeTitle: episodeMeta.title || `에피소드 ${this.state.currentEpisodeId}: 일본 시골 온천 사건`,
          clueText: `CLUE : ${String(this.state.cluesCollectedInEpisode).padStart(2, '0')}/20`,
          cluesCollected: this.state.cluesCollectedInEpisode,
          maxClues: 20,
          readyForAccusation: this.state.cluesCollectedInEpisode >= 20,
          background: bgInfo
        },
        rightControls: {
          winStreak: {
            current: this.state.winStreak,
            maxTarget: WIN_STREAK_RESET_AT,
            nextTarget: nextMilestone.streak,
            nextReward: nextMilestone,
            milestones: WIN_STREAK_MILESTONES.map(m => ({
              ...m,
              claimed: this.state.claimedStreakMilestones.includes(m.streak),
              reached: this.state.winStreak >= m.streak
            }))
          },
          playButton: {
            selectedMultiplier: this.state.selectedMultiplier,
            entryCost: tier.baseEntryFee * this.state.selectedMultiplier,
            multiplierOptions: MULTIPLIER_OPTIONS.map(opt => ({
              ...opt,
              unlocked: this.state.level >= opt.unlockLevel,
              cost: tier.baseEntryFee * opt.multiplier,
              rewardMin: tier.baseRewardMin * opt.multiplier,
              rewardMax: tier.baseRewardMax * opt.multiplier
            }))
          },
          lifeWidget: {
            current: lifeStatus.lives,
            max: LIFE_MAX,
            heartsDisplay: '♥'.repeat(Math.min(LIFE_MAX, lifeStatus.lives)) + '♡'.repeat(Math.max(0, LIFE_MAX - lifeStatus.lives)),
            timerText: lifeStatus.formattedTimer,
            isFull: lifeStatus.lives >= LIFE_MAX
          }
        },
        inventory: { ...this.state.inventory },
        shopCatalog: SHOP_CATALOG
      };
    }
  }

  return {
    LIFE_MAX,
    LIFE_REGEN_MS,
    MAX_LEVEL,
    LEVEL_TIERS,
    MULTIPLIER_OPTIONS,
    WIN_STREAK_MILESTONES,
    WIN_STREAK_RESET_AT,
    rollStreakReward,
    SHOP_CATALOG,
    getRequiredExpForLevel,
    getTierForLevel,
    getEpisodeBackgroundInfo,
    formatTimer,
    HomeGameManager
  };
});
