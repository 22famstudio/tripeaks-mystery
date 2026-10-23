// =====================================================================
// 수사 에너지 (☕ 스태미나) — DOM 없음, 상태는 TP.store에 저장
// =====================================================================
//   최대 5칸, 20분마다 1칸 자연 충전 (0 → 5칸 완충 100분)
//   스테이지 입장 시 1칸 소모 — 성공 · 실패와 상관없이 돌려주지 않는다
//   무한 에너지(infiniteEnergyUntil) 동안은 소모 없음
//   충전: 20분 자연 충전 / 골드 300 → 즉시 완충 / 보상형 광고 1회 → +1칸 (하루 5회) / 상점 무한 하트 팩
//
// 저장 필드 (store.state)
//   energy, lastEnergyTime(마지막 충전 기준 시각 ms), infiniteEnergyUntil(ms),
//   energyAdDay('YYYY-MM-DD'), energyAdCount
//
// 앱을 껐다 켜도 정확하도록 "잔량 + 기준 시각"만 저장하고, 읽을 때마다 경과 시간으로 다시 계산한다.
// 시간은 TP.now()로만 읽는다 (테스트에서 바꿔 끼울 수 있게).
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const store = () => TP.store;
  const now = () => TP.now();

  TP.ENERGY = {
    MAX: 5,
    REGEN_MS: 20 * 60 * 1000,
    GOLD_REFILL_COST: 300,
    AD_REFILL_AMOUNT: 1,   // 광고 1회 시청당 하트 1개
    AD_DAILY_LIMIT: 5,     // 하루 5회
  };

  // 순수 함수: 저장된 값 + 현재 시각 → 자연 충전을 반영한 값
  TP.computeEnergy = function ({ energy, lastEnergyTime }, t) {
    const { MAX, REGEN_MS } = TP.ENERGY;
    if (energy >= MAX) return { energy, lastEnergyTime };
    if (t < lastEnergyTime) return { energy, lastEnergyTime: t }; // 기기 시계를 되돌린 경우: 기준만 현재로
    const ticks = Math.floor((t - lastEnergyTime) / REGEN_MS);
    if (!ticks) return { energy, lastEnergyTime };
    const next = Math.min(MAX, energy + ticks);
    return { energy: next, lastEnergyTime: next >= MAX ? t : lastEnergyTime + ticks * REGEN_MS };
  };

  const dayKey = t => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // 00:00 / 1:02:03 형태
  TP.formatDuration = function (ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(h ? 2 : 1, '0');
    return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
  };

  TP.energy = {
    // 저장하지 않고 상태만 계산 (알림 예약 등 — js/notifications.js)
    statusOf(state, t) {
      const { MAX, REGEN_MS } = TP.ENERGY;
      const s = TP.computeEnergy(state, t);
      const full = s.energy >= MAX;
      const nextInMs = full ? 0 : REGEN_MS - (t - s.lastEnergyTime);
      return { energy: s.energy, max: MAX, full, fullInMs: full ? 0 : nextInMs + (MAX - s.energy - 1) * REGEN_MS, infinite: (state.infiniteEnergyUntil || 0) > t };
    },

    // 자연 충전을 저장소에 반영 (값이 바뀔 때만 저장)
    sync(t = now()) {
      const s = store().state;
      const next = TP.computeEnergy(s, t);
      if (next.energy !== s.energy || next.lastEnergyTime !== s.lastEnergyTime) {
        store().update(st => { st.energy = next.energy; st.lastEnergyTime = next.lastEnergyTime; });
      }
      return store().state;
    },

    isInfinite(t = now()) {
      return store().state.infiniteEnergyUntil > t;
    },

    adsUsedToday(t = now()) {
      const s = store().state;
      return s.energyAdDay === dayKey(t) ? s.energyAdCount : 0;
    },

    // 화면 표시용 요약
    status(t = now()) {
      const s = this.sync(t);
      const { MAX, REGEN_MS, AD_DAILY_LIMIT } = TP.ENERGY;
      const full = s.energy >= MAX;
      const nextInMs = full ? 0 : REGEN_MS - (t - s.lastEnergyTime);
      return {
        energy: s.energy,
        max: MAX,
        full,
        nextInMs,
        fullInMs: full ? 0 : nextInMs + (MAX - s.energy - 1) * REGEN_MS,
        infinite: this.isInfinite(t),
        infiniteLeftMs: Math.max(0, s.infiniteEnergyUntil - t),
        adsLeftToday: AD_DAILY_LIMIT - this.adsUsedToday(t),
      };
    },

    canPlay(t = now()) {
      return this.isInfinite(t) || this.sync(t).energy >= 1;
    },

    // 스테이지 입장. 결과 { ok, spent } — 무한 에너지면 spent 0 (클리어해도 환급 없음)
    consume(t = now()) {
      if (this.isInfinite(t)) return { ok: true, spent: 0 };
      const s = this.sync(t);
      if (s.energy < 1) return { ok: false, spent: 0 };
      store().update(st => {
        if (st.energy >= TP.ENERGY.MAX) st.lastEnergyTime = t; // 꽉 찬 상태에서 쓰면 그때부터 충전 시작
        st.energy -= 1;
      });
      return { ok: true, spent: 1 };
    },

    // 골드 300 → 즉시 완충. 결과 { ok } 또는 { ok:false, reason:'full'|'gold', cost }
    refillWithGold(t = now()) {
      const cost = TP.ENERGY.GOLD_REFILL_COST;
      if (this.sync(t).energy >= TP.ENERGY.MAX) return { ok: false, reason: 'full', cost };
      if (!store().spend('gold', cost)) return { ok: false, reason: 'gold', cost };
      store().update(st => { st.energy = TP.ENERGY.MAX; st.lastEnergyTime = t; });
      return { ok: true, cost };
    },

    // 광고를 볼 수 있는지 (보기 전에 확인해서 광고만 보고 보상을 못 받는 일이 없게)
    canRefillWithAd(t = now()) {
      if (this.sync(t).energy >= TP.ENERGY.MAX) return { ok: false, reason: 'full' };
      if (this.adsUsedToday(t) >= TP.ENERGY.AD_DAILY_LIMIT) return { ok: false, reason: 'limit' };
      return { ok: true };
    },

    // 보상형 광고 시청 완료 후 호출 → +1칸 (최대치까지), 하루 5회
    refillWithAd(t = now()) {
      const check = this.canRefillWithAd(t);
      if (!check.ok) return check;
      const today = dayKey(t);
      store().update(st => {
        if (st.energyAdDay !== today) { st.energyAdDay = today; st.energyAdCount = 0; }
        st.energyAdCount += 1;
        st.energy = Math.min(TP.ENERGY.MAX, st.energy + TP.ENERGY.AD_REFILL_AMOUNT);
        if (st.energy >= TP.ENERGY.MAX) st.lastEnergyTime = t;
      });
      return { ok: true, energy: store().state.energy };
    },

    // 무한 에너지 연장 (이미 켜져 있으면 남은 시간 뒤에 이어 붙임)
    addInfinite(minutes) {
      store().grant({ infiniteMinutes: minutes });
      return store().state.infiniteEnergyUntil;
    },
  };

  // 명세의 함수 이름 그대로도 쓸 수 있게
  TP.refillEnergyWithGold = t => TP.energy.refillWithGold(t);
})();
