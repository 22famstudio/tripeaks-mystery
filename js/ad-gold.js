// =====================================================================
// 홈 [광고 보고 골드 받기] — 보상형 광고 1회 = 골드 200, 24시간에 3번
// =====================================================================
//   첫 시청 시각부터 24시간이 한 주기. 주기 안에서 3번까지, 24시간이 지나면 다시 3번.
//   저장: store.adGoldStart (주기 시작 시각 ms, 0 = 아직 없음) · store.adGoldCount (그 주기에 받은 횟수)
//   광고 자체는 TP.ads.showRewarded('adGold') — 끝까지 본 경우에만 지급 (광고 패스권이 있으면 패스권 1장으로 대신)
//   TP.adGold.status(t) → { left, max, used, resetInMs } · claim(t) → { ok, gold } | { ok:false, reason:'limit' }
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const store = () => TP.store;
  const now = () => (TP.now ? TP.now() : Date.now());

  TP.AD_GOLD = { REWARD: 200, MAX: 3, WINDOW_MS: 24 * 3600 * 1000 };

  TP.adGold = {
    status(t = now()) {
      const { MAX, WINDOW_MS } = TP.AD_GOLD;
      const s = store().state;
      const start = s.adGoldStart || 0;
      // 주기가 없거나 24시간이 지났거나, 기기 시계를 되돌려 시작 시각이 미래면 새 주기
      const fresh = !start || t - start >= WINDOW_MS || t < start;
      const used = fresh ? 0 : Math.min(MAX, s.adGoldCount || 0);
      return { left: MAX - used, max: MAX, used, resetInMs: fresh ? 0 : start + WINDOW_MS - t };
    },

    // 광고를 끝까지 본 뒤 부른다
    claim(t = now()) {
      const st = this.status(t);
      if (st.left <= 0) return { ok: false, reason: 'limit', resetInMs: st.resetInMs };
      const gold = TP.AD_GOLD.REWARD;
      store().update(s => {
        if (st.used === 0) { s.adGoldStart = t; s.adGoldCount = 0; }
        s.adGoldCount += 1;
      });
      store().grant({ gold });
      return { ok: true, gold, left: st.left - 1 };
    },
  };
})();
