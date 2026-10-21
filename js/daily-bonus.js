// =====================================================================
// 데일리 로그인 보너스 — 설치 후 첫 7일
// =====================================================================
// 규칙
//   - 설치한 날이 Day 1. 하루(기기 달력 기준)에 한 번, 그날 처음 로비에 들어올 때 받는다.
//   - 받은 횟수로 다음 보상이 정해진다: 하루를 건너뛰어도 다음 접속에 '다음 날 보너스'(Day n+1)를 받는다. 되돌아가지 않는다.
//   - 설치일로부터 7일(Day 1~7 달력일)이 지나면 남은 보상과 함께 사라진다. 7개를 다 받아도 끝.
// 저장: store.dailyBonus = { installDay: 'YYYY-MM-DD', claimed: 0~7, lastClaimDay: 'YYYY-MM-DD' | '' }
//   installDay 는 처음 status() 를 부를 때 적는다 (이미 설치돼 있던 저장 데이터는 그 시점부터 7일).
// 시간은 TP.now() 로만 읽는다 (테스트에서 날짜를 바꿔 끼운다).
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  const store = () => TP.store;

  // 7일 보상 (예시 화면 기준 · 경제: 7일 합계 골드 4,800 ≈ 1단계 입장료 48판 — 첫 주 이탈 방지용 스타터)
  TP.DAILY_BONUS = [
    { day: 1, gold: 500 },
    { day: 2, gold: 800 },
    { day: 3, undo: 1 },
    { day: 4, hint: 1 },
    { day: 5, gold: 1500 },
    { day: 6, life: 5 },
    { day: 7, gold: 2000, undo: 1, wild: 1, big: true },
  ];
  const DAYS = TP.DAILY_BONUS.length;

  // 기기 달력 날짜 'YYYY-MM-DD' (자정에 바뀐다)
  const dayKey = t => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 864e5);

  TP.dailyBonus = {
    dayKey,
    rewards: TP.DAILY_BONUS,

    // 현재 상태 (installDay 가 없으면 오늘로 적는다)
    status() {
      const s = store().state;
      const today = dayKey(TP.now());
      if (!s.dailyBonus.installDay) store().update(x => { x.dailyBonus.installDay = today; });
      const d = store().state.dailyBonus;
      const dayOfWindow = dayDiff(d.installDay, today) + 1;          // 설치일 = 1
      const expired = dayOfWindow > DAYS || dayOfWindow < 1;         // 7일 지남 (시계를 되돌린 경우도 종료)
      const finished = d.claimed >= DAYS;
      const active = !expired && !finished;
      return {
        active, expired, finished, dayOfWindow, today,
        claimed: d.claimed,
        nextDay: finished ? null : d.claimed + 1,                   // 다음에 받을 보상 (Day n)
        claimedToday: d.lastClaimDay === today,
        canClaim: active && d.lastClaimDay !== today,
        daysLeft: Math.max(0, DAYS - dayOfWindow + 1),
      };
    },

    canClaim() { return this.status().canClaim; },

    // 오늘 보상 받기 → { ok, day, reward } | { ok:false, reason }
    claim() {
      const st = this.status();
      if (!st.canClaim) return { ok: false, reason: st.expired ? 'expired' : st.finished ? 'finished' : 'claimedToday' };
      const reward = TP.DAILY_BONUS[st.claimed];
      store().grant({ gold: reward.gold || 0, undo: reward.undo || 0, wild: reward.wild || 0, hint: reward.hint || 0 });
      if (reward.life) store().update(s => { s.energy = Math.max(s.energy, Math.min(99, s.energy + reward.life)); });
      store().update(s => { s.dailyBonus.claimed += 1; s.dailyBonus.lastClaimDay = st.today; });
      return { ok: true, day: reward.day, reward };
    },
  };

  TP.describeDailyReward = r => [
    r.gold && `🪙 ${r.gold.toLocaleString()}`,
    r.undo && T('↶ 되돌리기 ×{n}', { n: r.undo }),
    r.wild && T('★ 와일드 ×{n}', { n: r.wild }),
    r.hint && T('🎟 힌트권 ×{n}', { n: r.hint }),
    r.life && T('❤️ 하트 ×{n}', { n: r.life }),
  ].filter(Boolean).join(' + ');
})();
