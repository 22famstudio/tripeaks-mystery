// =====================================================================
// 기기 파일 세이브 — @capacitor/filesystem 으로 앱 전용 폴더(Directory.Data)의 save_data.json 에 쓰고 읽는다
// =====================================================================
//   - TP.store 가 저장될 때마다(onPersist) 0.4초 모아서 파일에 쓴다 (연속 변경을 한 번에).
//     앱이 백그라운드로 내려가면 기다리지 않고 바로 쓴다.
//   - 파일 쓰기가 실패하면 localStorage 사본(store.js 가 늘 같이 씀)이 폴백이 된다 — 다음 저장 때 다시 파일을 시도.
//   - 앱을 켤 때 init(): 파일과 localStorage 사본 중 savedAt 이 더 최근인 쪽을 쓴다.
//       파일이 더 최근(사본이 지워졌거나 쓰기 실패) → 파일로 상태를 바꾸고 새로 고침
//       파일이 없거나 위조 · 손상 → 지금 상태로 새 파일을 쓴다
//   - 형식은 js/save-codec.js (Base64 + 위조 검사 서명). 웹 · 플러그인이 없으면 localStorage 만 쓴다(지금까지와 같음).
//
//   ※ 안드로이드에서 '앱 데이터 삭제' · 앱 삭제를 하면 이 파일과 localStorage 가 함께 지워진다.
//     기기 밖 보관(다른 기기 · 재설치 복원)은 js/play-games-sync.js 의 클라우드 세이브가 맡는다.
//
//   TP.localSave.init() → { source: 'file'|'localStorage'|'new-file'|'web', restored?, tampered? }
//   TP.localSave.flush() · wipe() · status
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const FILE = 'save_data.json';
  const DIR = 'DATA';                       // Directory.Data — 앱 전용, 다른 앱 · 사용자 파일 관리자에서 안 보임
  const DEBOUNCE_MS = 400;

  const cap = globalThis.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const FS = native && cap.isPluginAvailable && cap.isPluginAvailable('Filesystem') ? cap.Plugins.Filesystem : null;

  const status = { mode: FS ? 'file' : 'localStorage', lastWrite: 0, lastError: null };
  let pending = null;
  let timer = null;
  let writing = Promise.resolve();

  async function writeNow(text) {
    try {
      await FS.writeFile({ path: FILE, data: text, directory: DIR, encoding: 'utf8' });
      status.lastWrite = Date.now();
      status.lastError = null;
      status.mode = 'file';
    } catch (e) {
      status.lastError = String((e && e.message) || e);
      status.mode = 'localStorage';         // 폴백: localStorage 사본은 store.js 가 이미 썼다
      console.warn('[localSave] save_data.json 쓰기 실패 → localStorage 사본 사용', e);
    }
  }

  // 모아 둔 마지막 상태를 지금 쓴다 (앞의 쓰기가 끝난 뒤 순서대로)
  function flush() {
    if (!FS || pending == null) return writing;
    clearTimeout(timer);
    const text = pending;
    pending = null;
    writing = writing.then(() => writeNow(text));
    return writing;
  }

  if (FS && TP.store) {
    TP.store.onPersist((state, at, text) => {
      pending = text;
      clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    });
    // 백그라운드로 내려갈 때 · 닫힐 때 바로 쓰기
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    const App = cap.isPluginAvailable && cap.isPluginAvailable('App') ? cap.Plugins.App : null;
    if (App) App.addListener('appStateChange', ({ isActive }) => { if (!isActive) flush(); });
  }

  async function readFile() {
    try {
      const { data } = await FS.readFile({ path: FILE, directory: DIR, encoding: 'utf8' });
      return typeof data === 'string' ? data : null;
    } catch { return null; }                // 파일 없음
  }

  async function init() {
    if (!FS) return { source: 'web' };
    const codec = TP.saveCodec;
    const store = TP.store;
    const text = await readFile();
    const current = () => codec.encode(store.state, store.savedAt);
    if (!text) {                            // 처음 · 파일 없음 → 지금 상태로 만든다
      pending = current();
      await flush();
      return { source: 'new-file' };
    }
    const d = codec.decode(text);
    if (!d.ok) {                            // 위조 · 손상 → 사본(또는 기본값)으로 덮어쓴다
      console.warn('[localSave] save_data.json 이상 → 덮어씀', d.reason);
      pending = current();
      await flush();
      return { source: 'localStorage', tampered: d.reason === 'tampered' };
    }
    if (d.savedAt > store.savedAt) {        // 파일이 더 최근 → 파일로 복구
      store.replace(d.data, d.savedAt);
      await flush();
      return { source: 'file', restored: true };
    }
    if (d.savedAt < store.savedAt) {        // 사본이 더 최근(파일 쓰기 실패 뒤 등) → 파일 갱신
      pending = current();
      await flush();
    }
    return { source: 'file' };
  }

  // 계정 삭제 · 초기화: 파일과 localStorage 사본 모두 지운다
  async function wipe() {
    pending = null;
    clearTimeout(timer);
    await writing;
    if (FS) { try { await FS.deleteFile({ path: FILE, directory: DIR }); } catch { /* 없으면 그만 */ } }
    try { localStorage.removeItem(TP.store.STORAGE_KEY); } catch { /* 무시 */ }
  }

  TP.localSave = { init, flush, wipe, status, FILE };
})();
