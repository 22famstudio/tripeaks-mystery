// =====================================================================
// 유저 식별 — Firebase Authentication (@capacitor-firebase/authentication, 네이티브 플러그인)
// =====================================================================
//   방식: 첫 실행 때 자동으로 익명 계정을 만든다(로그인 화면 없음) → 모든 유저가 바로 고유 ID(Firebase UID)를 가진다.
//         설정 → [Google 계정 연결] 을 누르면 같은 UID 에 Google 계정이 붙는다 (익명 → Google 연결, UID 유지).
//         이미 다른 계정에 연결된 Google 계정이면 그 계정으로 전환할지 묻는다.
//   계정 삭제: Google Play 정책상 계정을 만들 수 있는 앱은 앱 안에서 삭제할 수 있어야 한다 → [계정 삭제]
//   진행 상황(세이브)은 지금처럼 기기(localStorage)에만 있다. 클라우드 세이브는 별도 작업.
//
//   플러그인을 쓸 수 없을 때(웹 · google-services.json 없이 빌드해 플러그인이 빠진 APK):
//     기기 안에서 만든 임의 ID('local-…')로 식별만 한다. 로그인 버튼은 '준비 중' 안내.
//
//   TP.account.state  → { status: 'loading'|'ready'|'unavailable', uid, isAnonymous, email, displayName, provider }
//   TP.account.onChange(fn) · init() · linkGoogle() · signOut() · deleteAccount()
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const cap = globalThis.Capacitor;
  const LOCAL_KEY = 'tp.localDeviceId';
  const available = !!(cap && cap.isNativePlatform && cap.isNativePlatform() &&
    cap.isPluginAvailable && cap.isPluginAvailable('FirebaseAuthentication'));
  const FA = available ? cap.Plugins.FirebaseAuthentication : null;

  const listeners = new Set();
  let state = { status: 'loading', uid: null, isAnonymous: true, email: null, displayName: null, provider: 'none' };

  function localId() {
    try {
      let id = localStorage.getItem(LOCAL_KEY);
      if (!id) {
        id = 'local-' + (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
        localStorage.setItem(LOCAL_KEY, id);
      }
      return id;
    } catch { return 'local-unknown'; }
  }

  function set(user, status = 'ready') {
    const google = user && (user.providerData || []).find(p => p.providerId === 'google.com');
    state = user
      ? { status, uid: user.uid, isAnonymous: !!user.isAnonymous && !google, email: user.email || (google && google.email) || null,
          displayName: user.displayName || (google && google.displayName) || null, provider: google ? 'google' : 'anonymous' }
      : { status, uid: null, isAnonymous: true, email: null, displayName: null, provider: 'none' };
    listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
  }

  const errCode = e => String((e && (e.code || e.message)) || e);

  async function init() {
    if (!available) {
      state = { status: 'unavailable', uid: localId(), isAnonymous: true, email: null, displayName: null, provider: 'local' };
      listeners.forEach(fn => fn(state));
      return state;
    }
    try {
      FA.addListener('authStateChange', ({ user }) => { if (user) set(user); });
      let { user } = await FA.getCurrentUser();
      if (!user) ({ user } = await FA.signInAnonymously());        // 첫 실행: 익명 계정 자동 생성
      set(user);
    } catch (e) {
      console.warn('[account] 로그인 실패 — 기기 ID 로 대신 식별', e);
      state = { status: 'unavailable', uid: localId(), isAnonymous: true, email: null, displayName: null, provider: 'local', error: errCode(e) };
      listeners.forEach(fn => fn(state));
    }
    return state;
  }

  // 익명 → Google 연결 (UID 유지). 이미 다른 UID 에 연결된 Google 계정이면 { conflict: true } — 호출한 쪽이 전환 여부를 묻는다
  async function linkGoogle() {
    if (!available) return { ok: false, reason: 'unavailable' };
    try {
      const { user } = await FA.linkWithGoogle();
      set(user);
      return { ok: true };
    } catch (e) {
      const code = errCode(e);
      if (/credential-already-in-use|account-exists|already been linked|already linked/i.test(code)) return { ok: false, conflict: true };
      if (/cancel/i.test(code)) return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: code };
    }
  }

  // 그 Google 계정의 기존 UID 로 전환 (지금 익명 UID 는 버려짐 — 세이브는 기기에 그대로)
  async function switchToGoogle() {
    if (!available) return { ok: false, reason: 'unavailable' };
    try {
      const { user } = await FA.signInWithGoogle();
      set(user);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: /cancel/i.test(errCode(e)) ? 'cancelled' : errCode(e) };
    }
  }

  // 로그아웃 → 새 익명 계정 (다른 ID 가 된다)
  async function signOut() {
    if (!available) return { ok: false, reason: 'unavailable' };
    try {
      await FA.signOut();
      const { user } = await FA.signInAnonymously();
      set(user);
      return { ok: true };
    } catch (e) { return { ok: false, reason: errCode(e) }; }
  }

  // 계정 삭제 (Firebase 사용자 삭제). 오래전에 로그인한 Google 계정이면 다시 로그인한 뒤 삭제
  async function deleteAccount() {
    if (!available) return { ok: false, reason: 'unavailable' };
    try {
      try { await FA.deleteUser(); }
      catch (e) {
        if (!/recent-login|requires-recent/i.test(errCode(e)) || state.provider !== 'google') throw e;
        await FA.signInWithGoogle();                                 // 재인증
        await FA.deleteUser();
      }
      const { user } = await FA.signInAnonymously();                // 새 익명 계정으로 계속 플레이
      set(user);
      return { ok: true };
    } catch (e) { return { ok: false, reason: /cancel/i.test(errCode(e)) ? 'cancelled' : errCode(e) }; }
  }

  TP.account = {
    get state() { return state; },
    available,
    init, linkGoogle, switchToGoogle, signOut, deleteAccount,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    shortId: () => (state.uid ? state.uid.replace(/^local-/, '').slice(0, 8).toUpperCase() : '—'),
  };
})();
