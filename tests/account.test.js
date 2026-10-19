// 유저 식별 (js/account.js) — Firebase 인증 플러그인을 흉내 내 흐름만 검사 (실제 로그인은 실기기에서)
// 실행: node tests/account.test.js
const assert = require('assert');
const path = require('path');
const FILE = path.join(__dirname, '../js/account.js');
const load = () => { delete require.cache[require.resolve(FILE)]; require(FILE); };
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };

function fakeFirebase(opts = {}) {
  let n = 0;
  let user = opts.user || null;
  const anon = () => ({ uid: `anon${++n}`, isAnonymous: true, email: null, displayName: null, providerData: [] });
  const google = (uid = user.uid) => ({ uid, isAnonymous: false, email: 'me@gmail.com', displayName: '탐정', providerData: [{ providerId: 'google.com', email: 'me@gmail.com' }] });
  const calls = [];
  return {
    calls,
    addListener() {},
    async getCurrentUser() { calls.push('get'); return { user }; },
    async signInAnonymously() { calls.push('anon'); user = anon(); return { user }; },
    async linkWithGoogle() { calls.push('link'); if (opts.conflict) throw { code: 'auth/credential-already-in-use' }; user = google(); return { user }; },
    async signInWithGoogle() { calls.push('google'); user = google('existing-google-uid'); return { user }; },
    async signOut() { calls.push('signOut'); user = null; },
    async deleteUser() { calls.push('delete'); if (opts.recent && !calls.includes('google')) throw { code: 'auth/requires-recent-login' }; user = null; },
  };
}
const native = FA => { globalThis.Capacitor = { isNativePlatform: () => true, isPluginAvailable: n => n === 'FirebaseAuthentication', Plugins: { FirebaseAuthentication: FA } }; };

(async () => {
  // 1) 웹 · 플러그인 없음 → 기기 ID 로 식별, 같은 ID 유지
  globalThis.TP = {};
  globalThis.Capacitor = undefined;
  load();
  let st = await TP.account.init();
  assert.equal(st.status, 'unavailable');
  assert(st.uid.startsWith('local-'));
  const firstLocal = st.uid;
  load(); st = await TP.account.init();
  assert.equal(st.uid, firstLocal, '다시 켜도 같은 기기 ID');
  assert.equal((await TP.account.linkGoogle()).reason, 'unavailable');

  // 2) 첫 실행 → 익명 계정 자동 생성
  let FA = fakeFirebase(); native(FA); load();
  const seen = [];
  TP.account.onChange(s => seen.push(s.provider));
  st = await TP.account.init();
  assert.equal(st.status, 'ready'); assert.equal(st.uid, 'anon1'); assert.equal(st.provider, 'anonymous');
  assert.deepEqual(FA.calls, ['get', 'anon']);
  assert.equal(TP.account.shortId(), 'ANON1');

  // 3) Google 연결 → 같은 UID, provider google
  assert((await TP.account.linkGoogle()).ok);
  assert.equal(TP.account.state.uid, 'anon1', 'UID 유지');
  assert.equal(TP.account.state.provider, 'google'); assert.equal(TP.account.state.email, 'me@gmail.com');
  assert(seen.includes('google'));

  // 4) 로그아웃 → 새 익명 UID
  assert((await TP.account.signOut()).ok);
  assert.equal(TP.account.state.provider, 'anonymous'); assert.notEqual(TP.account.state.uid, 'anon1');

  // 5) 이미 다른 UID 에 연결된 Google 계정 → conflict → 전환
  FA = fakeFirebase({ conflict: true }); native(FA); load(); await TP.account.init();
  const r = await TP.account.linkGoogle();
  assert.equal(r.conflict, true);
  assert((await TP.account.switchToGoogle()).ok);
  assert.equal(TP.account.state.uid, 'existing-google-uid');

  // 6) 기존 계정 그대로 (다시 켬) → 익명 새로 안 만듦
  FA = fakeFirebase({ user: { uid: 'keep', isAnonymous: true, providerData: [] } }); native(FA); load();
  st = await TP.account.init();
  assert.equal(st.uid, 'keep'); assert(!FA.calls.includes('anon'));

  // 7) 계정 삭제 — 오래된 Google 로그인이면 재인증 후 삭제 → 새 익명
  FA = fakeFirebase({ user: { uid: 'g1', isAnonymous: false, email: 'me@gmail.com', providerData: [{ providerId: 'google.com' }] }, recent: true });
  native(FA); load(); await TP.account.init();
  assert((await TP.account.deleteAccount()).ok);
  assert.deepEqual(FA.calls.slice(-4), ['delete', 'google', 'delete', 'anon']);
  assert.equal(TP.account.state.provider, 'anonymous');

  console.log('유저 식별 (익명 자동 · Google 연결 · 전환 · 로그아웃 · 계정 삭제 · 기기 ID 대체) 통과');
})().catch(e => { console.error(e); process.exit(1); });
