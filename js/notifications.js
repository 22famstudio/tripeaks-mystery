// =====================================================================
// 알림 (로컬 알림 — 서버 없이 기기 안에서 예약 · @capacitor/local-notifications)
// =====================================================================
//   ① 하트 충전 완료 : 하트가 가득 차는 시각에 1번. 단 조용한 시간(20:30~08:30)에 차면 보내지 않고
//                      다음 날 아침 08:30 알림 문구를 '하트가 가득 찼어요'로 바꾼다.
//   ② 아침 알림       : 매일 08:30 (앞으로 7일치를 미리 예약 — 날마다 문구가 달라서)
//                      출석 보상을 받을 수 있는 날 > 밤사이 하트가 찬 날 > 일반 문구 3종 돌아가며
//   ③ 복귀 알림       : 마지막으로 앱을 쓴 뒤 3일. 1번만. 조용한 시간이면 그다음 12:30 으로 옮긴다.
//   ※ 정보통신망법 제50조(광고성 정보 야간 전송 제한 21~08시)를 넉넉히 피하려고 혜택 · 복귀 알림은 08:30~20:30 에만.
//
//   예약 시점: 앱이 백그라운드로 갈 때 지금 상태로 전부 다시 예약하고, 앱으로 돌아오면 전부 취소한다
//   (게임 중에는 알림이 뜨지 않게). 설정 → 알림 끄기면 모두 취소.
//   권한(Android 13+): 튜토리얼을 마친 뒤 처음 로비에 왔을 때 한 번 묻는다.
//
//   TP.planNotifications(state, now) → [{ id, at, kind, title, body }]  (순수 함수 · tests/notifications.test.js)
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)

  TP.NOTIFY = {
    MORNING: { h: 8, m: 30 },          // 아침 알림 시각
    QUIET_FROM: { h: 20, m: 30 },      // 조용한 시간 시작 (이 시각부터 다음 날 08:30 전까지는 보내지 않음)
    QUIET_TO: { h: 8, m: 30 },
    COMEBACK_MS: 3 * 24 * 3600 * 1000, // 복귀 알림: 마지막 사용 뒤 3일
    COMEBACK_MOVE_TO: { h: 12, m: 30 },// 복귀 알림이 조용한 시간에 걸리면 옮기는 시각
    MORNING_DAYS: 7,                   // 아침 알림을 미리 예약하는 날 수
    IDS: { heart: 1, comeback: 2, morning: 100 },   // morning: 100 + 0~6
  };
  const N = TP.NOTIFY;

  const atTime = (t, { h, m }, addDays = 0) => {
    const d = new Date(t);
    d.setHours(h, m, 0, 0);
    d.setDate(d.getDate() + addDays);
    return d.getTime();
  };
  // 조용한 시간인가 (20:30 이상이거나 08:30 미만)
  TP.isQuietTime = t => {
    const d = new Date(t);
    const mins = d.getHours() * 60 + d.getMinutes();
    return mins >= N.QUIET_FROM.h * 60 + N.QUIET_FROM.m || mins < N.QUIET_TO.h * 60 + N.QUIET_TO.m;
  };
  // 조용한 시간이면 그다음 허용 시각(같은 날 또는 다음 날의 move 시각)으로
  const moveOutOfQuiet = (t, move) => {
    if (!TP.isQuietTime(t)) return t;
    const d = new Date(t);
    const mins = d.getHours() * 60 + d.getMinutes();
    return atTime(t, move, mins >= N.QUIET_FROM.h * 60 + N.QUIET_FROM.m ? 1 : 0);
  };

  const dayKey = t => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 864e5);

  // 그날 아침에 출석 보상을 받을 수 있는가 (js/daily-bonus.js 규칙: 설치일부터 7일 · 하루 1번 · 7개까지)
  function bonusAvailableOn(state, dayT, now) {
    const db = state.dailyBonus || {};
    const days = (TP.DAILY_BONUS || []).length || 7;
    if (!db.installDay || (db.claimed || 0) >= days) return false;
    const day = dayKey(dayT);
    const nth = dayDiff(db.installDay, day) + 1;
    if (nth < 1 || nth > days) return false;
    if (day === dayKey(now) && db.lastClaimDay === day) return false;   // 오늘 이미 받음
    // 앞으로의 날: 그날 전까지 날마다 받는다고 해도 남은 보상이 있어야 한다
    //   (오늘 이미 받았으면 내일부터 그 전날까지, 아직이면 오늘부터 그 전날까지 받는다고 본다)
    const before = dayDiff(dayKey(now), day) - (db.lastClaimDay === dayKey(now) ? 1 : 0);
    return (db.claimed || 0) + Math.max(0, before) < days;
  }

  const GENERIC = [
    () => ({ title: T('좋은 아침이에요, 탐정님! ☕'), body: T('오늘의 사건이 기다리고 있어요. 카드 한 판으로 수사를 시작해 볼까요?') }),
    () => ({ title: T('새로운 단서가 기다려요 🔍'), body: T('범인은 아직 잡히지 않았어요. 오늘도 함께 추리해요!') }),
    () => ({ title: T('사건 수첩을 펼칠 시간이에요 🗂'), body: T('어제 모은 단서를 이어서 맞춰 볼까요?') }),
  ];

  // 지금 상태로 예약할 알림 목록 (순수 함수)
  TP.planNotifications = function (state, now) {
    const out = [];
    // ① 하트
    let heartsByMorning = null;   // 조용한 시간에 가득 차서 다음 아침 문구로 넘긴 경우: 그 아침 시각
    const st = TP.energy?.statusOf ? TP.energy.statusOf(state, now) : null;
    if (st && !st.full && !st.infinite && st.fullInMs > 0) {
      const fullAt = now + st.fullInMs;
      if (!TP.isQuietTime(fullAt)) {
        out.push({ id: N.IDS.heart, at: fullAt, kind: 'heart', title: T('하트가 가득 찼어요 ❤'), body: T('하트 {n}개가 모두 충전됐어요. 사건 수사를 이어가 볼까요?', { n: st.max }) });
      } else {
        heartsByMorning = moveOutOfQuiet(fullAt, N.MORNING);
      }
    }
    // ② 아침 08:30 × 7일
    for (let i = 0; i <= N.MORNING_DAYS; i++) {
      const at = atTime(now, N.MORNING, i);
      if (at <= now) continue;
      const k = out.filter(o => o.kind === 'morning').length;
      if (k >= N.MORNING_DAYS) break;
      let msg;
      if (bonusAvailableOn(state, at, now)) msg = { title: T('출석 보상이 도착했어요 🎁'), body: T('오늘의 출석 보상이 준비됐어요. 잊지 말고 받아 가세요!') };
      else if (heartsByMorning === at) msg = { title: T('밤사이 하트가 가득 찼어요 ❤'), body: T('충전된 하트로 오늘의 사건을 풀어 볼까요?') };
      else msg = GENERIC[Math.floor(at / 864e5) % GENERIC.length]();
      out.push({ id: N.IDS.morning + k, at, kind: 'morning', ...msg });
    }
    // ③ 복귀 (3일 뒤 1번)
    const back = moveOutOfQuiet(now + N.COMEBACK_MS, N.COMEBACK_MOVE_TO);
    out.push({ id: N.IDS.comeback, at: back, kind: 'comeback', title: T('탐정님, 사건 현장이 기다려요 🔎'), body: T('풀던 사건이 그대로 남아 있어요. 다시 수사를 이어가 볼까요?') });
    return out;
  };

  // ---------------- 휴대폰: 실제 예약 ----------------
  const cap = globalThis.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const has = n => native && cap.isPluginAvailable && cap.isPluginAvailable(n);
  const LN = has('LocalNotifications') ? cap.Plugins.LocalNotifications : null;
  const App = has('App') ? cap.Plugins.App : null;
  const CHANNEL = 'reminders';
  let channelReady = false;

  const enabled = () => TP.store?.state.settings?.notifyOn !== false;

  async function permitted() {
    try { return (await LN.checkPermissions()).display === 'granted'; } catch { return false; }
  }

  async function cancelAll() {
    if (!LN) return;
    try {
      const { notifications } = await LN.getPending();
      if (notifications.length) await LN.cancel({ notifications: notifications.map(n => ({ id: n.id })) });
    } catch (e) { console.warn('[notify] 취소 실패', e); }
  }

  async function scheduleAll() {
    if (!LN || !enabled() || !(await permitted())) return;
    if (!channelReady) {
      try { await LN.createChannel({ id: CHANNEL, name: T('게임 알림'), description: T('하트 충전 · 아침 알림 · 복귀 알림'), importance: 3 }); } catch {}
      channelReady = true;
    }
    const list = TP.planNotifications(TP.store.state, TP.now ? TP.now() : Date.now());
    await cancelAll();
    try {
      await LN.schedule({
        notifications: list.map(n => ({
          id: n.id, title: n.title, body: n.body, channelId: CHANNEL,
          schedule: { at: new Date(n.at), allowWhileIdle: true },
          smallIcon: 'ic_stat_notify', iconColor: '#E8A33C', extra: { kind: n.kind },
        })),
      });
    } catch (e) { console.warn('[notify] 예약 실패', e); }
  }

  // 권한 묻기: 튜토리얼을 마친 뒤 한 번 (거절해도 설정에서 다시 켤 수 있음)
  async function askOnce() {
    if (!LN || !enabled() || TP.store.state.notifyAsked) return;
    if (!TP.store.state.tutorialDone) return;
    TP.store.update(s => { s.notifyAsked = true; });
    try { await LN.requestPermissions(); } catch {}
  }

  // 설정 → 알림 켜기/끄기
  async function setEnabled(on) {
    TP.settings?.set({ notifyOn: !!on });
    if (!LN) return { ok: true };
    if (!on) { await cancelAll(); return { ok: true }; }
    let granted = await permitted();
    if (!granted) { try { granted = (await LN.requestPermissions()).display === 'granted'; } catch {} }
    return { ok: granted, reason: granted ? null : 'denied' };
  }

  function init() {
    if (!LN) return;
    cancelAll();                                         // 앱을 켜면: 예약된 알림은 지운다 (나갈 때 다시 예약)
    if (App) App.addListener('appStateChange', ({ isActive }) => { if (isActive) cancelAll(); else scheduleAll(); });
    askOnce();
    TP.store.subscribe?.(() => askOnce());               // 튜토리얼을 막 끝냈을 때
  }

  TP.notifications = { init, scheduleAll, cancelAll, setEnabled, available: !!LN };
})();
