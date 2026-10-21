// =====================================================================
// Google Play 게임즈 클라우드 세이브 — '저장된 게임(Saved Games · 스냅샷)' API
// =====================================================================
//   네이티브 부분: mobile/android/app/src/main/java/com/twotwofam/mystery/PlayGamesSavesPlugin.java
//     (Google 공식 play-services-games-v2 로 만든 앱 안 플러그인. Capacitor 7 에서 저장된 게임을 지원하는
//      관리되는 커뮤니티 플러그인이 없어 직접 둔다.) Play Console 의 게임 서비스 프로젝트 ID 가
//      res/values/games_ids.xml 에 들어가기 전에는 '사용 불가'로 답하고 아무것도 하지 않는다.
//   세이브는 유저 본인의 Google 계정 저장 공간에 들어간다 → 서버 비용 0.
//
//   업로드 최적화 (호출 제한 · 배터리)
//     - 게임 진행은 기기 파일에만 즉시 쓰고(local-save.js), 클라우드는 '바뀜' 표시만 해 둔다.
//     - 실제 업로드: ① 앱이 백그라운드로 내려갈 때(@capacitor/app 'appStateChange') ② 바뀐 채로 5분이 지났을 때
//       ③ 설정의 [지금 저장]. 같은 이유로 연달아 올리지 않게 최소 60초 간격 (백그라운드 · 수동은 15초).
//
//   앱 실행 시 (init → reconcile)
//     클라우드가 더 최근(savedAt)이고 진행도도 높으면 → ask(클라우드, 이 기기) 팝업으로 불러올지 묻는다.
//       예: 클라우드로 바꾸고 새로 고침 / 아니요: 이 기기 데이터를 다음 업로드 때 클라우드에 덮어쓴다.
//     이 기기가 더 최근이거나 진행도가 높으면 → '바뀜' 표시 (다음 업로드 때 올라감).
//
//   TP.playGamesSync.init({ ask }) · signIn() · uploadNow() · status
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  const SNAPSHOT = 'save_data';
  const INTERVAL_MS = 5 * 60 * 1000;
  const MIN_GAP_MS = 60 * 1000;
  const MIN_GAP_URGENT_MS = 15 * 1000;

  const cap = globalThis.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const has = n => native && cap.isPluginAvailable && cap.isPluginAvailable(n);
  const PG = has('PlayGamesSaves') ? cap.Plugins.PlayGamesSaves : null;
  const App = has('App') ? cap.Plugins.App : null;

  const status = { state: 'off', signedIn: false, dirty: false, lastUpload: 0, lastError: null, cloudSavedAt: 0 };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(status); } catch (e) { console.error(e); } });
  let uploading = null;
  let wired = false;

  if (TP.store) TP.store.onPersist(() => { status.dirty = true; });

  const description = s => {
    const p = TP.saveCodec.progress(s);
    return T('에피소드 {ep} · Lv.{lv} · 스테이지 {st} · 골드 {g}', { ep: p.episode, lv: p.level, st: p.stages, g: p.gold.toLocaleString() });
  };

  async function upload(reason, gap = MIN_GAP_MS) {
    if (!PG || !status.signedIn || !status.dirty) return false;
    if (uploading) return uploading;
    if (Date.now() - status.lastUpload < gap) return false;
    const store = TP.store;
    const data = TP.saveCodec.encode(store.state, store.savedAt);    // 지금 상태를 바로 굳혀 둔다 (백그라운드 직전에도 안전)
    status.dirty = false;
    uploading = PG.save({
      name: SNAPSHOT,
      data,
      description: description(store.state),
      progress: TP.saveCodec.progress(store.state).score,           // 기기끼리 충돌하면 진행도가 높은 쪽이 남는다
      playedTimeMillis: 0,
    }).then(() => {
      status.lastUpload = Date.now();
      status.cloudSavedAt = store.savedAt;
      status.lastError = null;
      return true;
    }).catch(e => {
      status.dirty = true;                                          // 다음 기회에 다시
      status.lastError = String((e && e.message) || e);
      console.warn(`[playGames] 업로드 실패 (${reason})`, e);
      return false;
    }).finally(() => { uploading = null; emit(); });
    return uploading;
  }

  async function reconcile(ask) {
    let r;
    try { r = await PG.load({ name: SNAPSHOT }); }
    catch (e) { status.lastError = String((e && e.message) || e); return 'load-failed'; }
    const store = TP.store;
    if (!r || !r.exists || !r.data) { status.dirty = true; await upload('first', 0); return 'uploaded-first'; }
    const d = TP.saveCodec.decode(r.data);
    if (!d.ok) { status.dirty = true; return 'cloud-invalid'; }      // 클라우드 쪽이 깨졌으면 이 기기 것으로 덮어씀
    status.cloudSavedAt = d.savedAt;
    if (d.savedAt === store.savedAt) return 'same';
    const cloud = TP.saveCodec.progress(d.data);
    const local = TP.saveCodec.progress(store.state);
    if (d.savedAt > store.savedAt && cloud.score > local.score) {
      const yes = ask ? await ask(cloud, local) : false;
      if (yes) {
        store.replace(d.data, d.savedAt);
        status.dirty = false;
        if (TP.localSave) await TP.localSave.flush();
        return 'restored';
      }
      status.dirty = true;
      return 'kept-local';
    }
    status.dirty = true;                                            // 이 기기가 최신 · 진행도가 높음 → 다음 업로드
    return 'local-newer';
  }

  function wire() {
    if (wired) return;
    wired = true;
    const onBackground = () => upload('background', MIN_GAP_URGENT_MS);
    if (App) App.addListener('appStateChange', ({ isActive }) => { if (!isActive) onBackground(); });
    else document.addEventListener('visibilitychange', () => { if (document.hidden) onBackground(); });
    setInterval(() => { if (status.dirty) upload('interval'); }, INTERVAL_MS);
  }

  // 앱 실행 시: 조용히 로그인(Play 게임즈 v2 는 자동 로그인) → 클라우드와 비교
  async function init({ ask } = {}) {
    if (!PG) { status.state = 'unavailable'; emit(); return status; }
    try {
      const { available } = await PG.isAvailable();
      if (!available) { status.state = 'unavailable'; emit(); return status; }
      const { authenticated } = await PG.signIn({ interactive: false });
      status.signedIn = !!authenticated;
      status.state = authenticated ? 'ready' : 'signed-out';
      wire();
      if (authenticated) status.result = await reconcile(ask);
    } catch (e) {
      status.state = 'error';
      status.lastError = String((e && e.message) || e);
    }
    emit();
    return status;
  }

  // 설정의 [Play 게임즈 로그인]
  async function signIn({ ask } = {}) {
    if (!PG) return false;
    try {
      const { authenticated } = await PG.signIn({ interactive: true });
      status.signedIn = !!authenticated;
      status.state = authenticated ? 'ready' : 'signed-out';
      wire();
      if (authenticated) status.result = await reconcile(ask);
    } catch (e) { status.lastError = String((e && e.message) || e); }
    emit();
    return status.signedIn;
  }

  // 설정의 [지금 저장]
  async function uploadNow() {
    status.dirty = true;
    return upload('manual', MIN_GAP_URGENT_MS);
  }

  TP.playGamesSync = {
    init, signIn, uploadNow, status,
    available: !!PG,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _upload: upload, _reconcile: reconcile,       // 테스트용
  };
})();
