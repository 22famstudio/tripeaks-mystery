// =====================================================================
// 연승(Win Streak) 사다리 — DOM 없음, 상태는 TP.store (winStreak, bestStreak, lostStreak)
// =====================================================================
//   승리하면 +1, 패배하면 0 (끊긴 연승은 lostStreak에 남아 500G로 1회 되살릴 수 있음)
//   reward : 3 · 7 · 10 · 20 · 30연승에 "도달한 순간" 한 번 지급 (골드·되돌리기는 범위 안에서 무작위, 하트 포함)
//            → home_progression_system WIN_STREAK_MILESTONES
//              3연승 하트 +1 · 7연승 100~200G + 하트 +1 · 10연승 100~200G + 하트 +2
//              20연승 200~500G + 되돌리기 1~2 · 30연승 500G + 되돌리기 1 + 와일드 1
//              50연승 프레스티지: 카드 뒷면 스킨 1종 해제 (18종 다 모으면 대체 보상) → 연승 0으로 리셋
//   중복 플레이(이미 단서를 받은 스테이지)는 연승을 올리지 않는다 (유지)
//   buffs  : 3 · 5 · 7 · 10 · 15 · 20연승 단계 — 연승이 그 이상인 동안 매 스테이지에 무료로 자동 장착
//       extraCards 덱 +N장 / freeUndo 무료 되돌리기 / freeWild 무료 와일드 / comboBoost 콤보 보너스 배율 +N
//   50연승 프레스티지 후 0부터 다시 (모듈 WIN_STREAK_RESET_AT)
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const store = () => TP.store;

  TP.STREAK = { SAVE_COST: 500, CAP: 50 };

  const NO_BUFFS = Object.freeze({ extraCards: 0, freeUndo: 0, freeWild: 0, comboBoost: 0 });

  const HP = TP.HP || globalThis.HomeProgressionSystem
    || (typeof require === 'function' ? require('./core/home_progression_system.js') : null);

  // 연승 보상 마일스톤 (모듈 원본) → { at, label, reward:{gold, undo, wild, life} } — 값은 숫자 또는 [최소, 최대]
  TP.STREAK_MILESTONES = HP.WIN_STREAK_MILESTONES.map(m => ({
    at: m.streak, label: m.label, reward: { gold: m.gold, undo: m.undo, wild: m.wild, life: m.life, hint: m.hint, prestige: !!m.prestige },
  }));
  const milestoneReward = at => TP.STREAK_MILESTONES.find(m => m.at === at)?.reward || null;

  // 버프 단계 (7연승은 보상 없이 버프만)
  TP.STREAK_TIERS = [
    { at: 3, buffs: { extraCards: 2 } },
    { at: 5, buffs: { extraCards: 3, freeUndo: 1 } },
    { at: 7, buffs: { extraCards: 4, freeWild: 1 } },
    { at: 10, buffs: { extraCards: 5, freeWild: 1, comboBoost: 1 } },
    { at: 15, buffs: { extraCards: 5, freeWild: 2, comboBoost: 2 } },
    // 20연승 명세에는 콤보 배율이 없지만, 15연승보다 버프가 줄어들지 않도록 +2를 유지한다
    { at: 20, buffs: { extraCards: 6, freeWild: 2, comboBoost: 2 } },
    { at: 30, buffs: { extraCards: 6, freeWild: 2, comboBoost: 2 } },
    { at: 50, buffs: { extraCards: 6, freeWild: 2, comboBoost: 2 } },   // 50연승 프레스티지 직후 연승 0으로 리셋
  ].map(t => ({ ...t, buffs: { ...NO_BUFFS, ...t.buffs }, reward: milestoneReward(t.at) }));

  // 현재 연승으로 받는 버프 (가장 높은 달성 단계)
  TP.streakBuffs = streak => TP.STREAK_TIERS.filter(t => streak >= t.at).pop()?.buffs || NO_BUFFS;
  // 정확히 그 연승에 도달했을 때 받는 1회 보상 (없으면 null)
  TP.streakReward = milestoneReward;
  // 다음 버프 단계 (20연승 이후에는 null)
  TP.nextStreakTier = streak => TP.STREAK_TIERS.find(t => t.at > streak) || null;
  // 다음 보상 마일스톤 (20연승 이후에는 null)
  TP.nextStreakMilestone = streak => TP.STREAK_MILESTONES.find(m => m.at > streak) || null;

  TP.describeBuffs = b => [
    b.extraCards && `덱 +${b.extraCards}`,
    b.freeUndo && `무료 되돌리기 ${b.freeUndo}`,
    b.freeWild && `무료 와일드 ${b.freeWild}`,
    b.comboBoost && `콤보 배율 +${b.comboBoost}`,
  ].filter(Boolean).join(' · ');

  // 보상 표시: 숫자 → 그대로, [최소, 최대] → '100~200'
  const amount = v => (Array.isArray(v) ? `${v[0].toLocaleString()}~${v[1].toLocaleString()}` : v.toLocaleString());
  const has = v => (Array.isArray(v) ? v[1] > 0 : !!v);
  TP.describeStreakReward = r => !r ? '' : [
    has(r.gold) && `🪙 ${amount(r.gold)}`,
    has(r.undo) && `↶ ${amount(r.undo)}`,
    has(r.wild) && `★ ${amount(r.wild)}`,
    has(r.life) && `❤️ +${amount(r.life)}`,
    has(r.hint) && `🎟 힌트권 ${amount(r.hint)}`,
    r.infiniteMinutes && `♾️ 무한 하트 ${r.infiniteMinutes}분`,
    r.prestige && '🂠 카드 뒷면 스킨',
  ].filter(Boolean).join(' + ');

  TP.streak = {
    get current() { return store().state.winStreak; },

    // 승리: +1, 아직 받지 않은 마일스톤이면 보상 지급. 반환 { streak, reward|null }
    // (게임 루프에서는 TP.home.recordStageResult 가 같은 규칙으로 처리한다 — js/home-bridge.js)
    recordWin() {
      const streak = store().state.winStreak + 1;
      const milestone = store().state.claimedStreakMilestones.includes(streak) ? null
        : HP.WIN_STREAK_MILESTONES.find(m => m.streak === streak);
      const reward = milestone ? HP.rollStreakReward(milestone) : null;   // 범위 보상은 여기서 굴림
      const reset = !!reward && streak >= HP.WIN_STREAK_RESET_AT;
      store().update(s => {
        s.winStreak = reset ? 0 : streak;
        s.bestStreak = Math.max(s.bestStreak, streak);
        s.lostStreak = 0;
        if (reward) s.claimedStreakMilestones = reset ? [] : [...s.claimedStreakMilestones, streak];
        if (reward) s.energy += reward.life;
        if (reward) s.hintCount += reward.hint || 0;
      });
      if (reward) store().grant({ gold: reward.gold, undo: reward.undo, wild: reward.wild });
      if (reward && reward.prestige && TP.cardBacks) reward.prestigeResult = TP.cardBacks.grantPrestige();
      return { streak, reward };
    },

    // 패배: 0으로. 끊긴 연승은 세이브용으로 기억. 반환: 끊긴 연승 수
    recordLoss() {
      const lost = store().state.winStreak;
      store().update(s => { s.winStreak = 0; s.lostStreak = lost; s.claimedStreakMilestones = []; });
      return lost;
    },

    canSave() {
      return store().state.lostStreak > 0;
    },

    // 500G로 끊긴 연승 되살리기. 결과 { ok, streak } 또는 { ok:false, reason:'none'|'gold' }
    save() {
      const lost = store().state.lostStreak;
      if (!lost) return { ok: false, reason: 'none' };
      if (!store().spend('gold', TP.STREAK.SAVE_COST)) return { ok: false, reason: 'gold' };
      store().update(s => {
        s.winStreak = lost;
        s.lostStreak = 0;
        s.claimedStreakMilestones = TP.STREAK_MILESTONES.filter(m => m.at <= lost).map(m => m.at); // 이미 받은 보상 재지급 방지
      });
      return { ok: true, streak: lost };
    },

    // 세이브하지 않고 다음 판에 들어가면 기회 소멸
    forfeitSave() {
      if (store().state.lostStreak) store().update(s => { s.lostStreak = 0; });
    },
  };
})();
