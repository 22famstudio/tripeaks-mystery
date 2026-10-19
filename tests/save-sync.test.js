// 세이브 구조 — 인코딩/위조 검사 · 기기 파일(save_data.json) · Play 게임즈 클라우드 비교 · 업로드 묶기
// 네이티브 플러그인(Filesystem · PlayGamesSaves · App)은 흉내 낸다. 실제 기기 동작은 실기기에서 확인.
// 실행: node tests/save-sync.test.js
const assert = require('assert');
const path = require('path');
const J = f => path.join(__dirname, '..', f);
const load = f => { delete require.cache[require.resolve(J(f))]; require(J(f)); };
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

function memStorage() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, clear: () => { for (const k in m) delete m[k]; }, _m: m };
}
function fakeFS(initial) {
  const files = { ...initial };
  const calls = [];
  return {
    files, calls,
    async writeFile({ path: p, data }) { calls.push('write'); if (this.failWrites) throw new Error('disk full'); files[p] = data; },
    async readFile({ path: p }) { calls.push('read'); if (!(p in files)) throw new Error('not found'); return { data: files[p] }; },
    async deleteFile({ path: p }) { delete files[p]; },
  };
}
function fakePG(cloud) {
  const calls = [];
  return {
    calls, cloud,
    async isAvailable() { return { available: true }; },
    async signIn() { calls.push('signIn'); return { authenticated: true }; },
    async load() { calls.push('load'); return this.cloud ? { exists: true, data: this.cloud } : { exists: false, data: '' }; },
    async save({ data, progress }) { calls.push('save'); this.cloud = data; this.lastProgress = progress; return { modifiedAt: 1 }; },
  };
}
// 앱을 새로 켠 것처럼: 전역을 새로 깔고 모듈을 다시 읽는다
function boot({ ls = memStorage(), FS = null, PG = null, now = 1000 } = {}) {
  globalThis.TP = { now: () => now };
  globalThis.localStorage = ls;
  globalThis.document = { hidden: false, addEventListener() {} };
  const plugins = { Filesystem: FS, PlayGamesSaves: PG };
  globalThis.Capacitor = FS || PG
    ? { isNativePlatform: () => true, isPluginAvailable: n => !!plugins[n], Plugins: plugins }
    : undefined;
  load('js/save-codec.js');
  load('js/store.js');
  load('js/local-save.js');
  load('js/play-games-sync.js');
  return { ls, FS, PG, setNow: t => { now = t; } };
}

(async () => {
  // ---- 1) 인코딩 · 위조 검사 ----
  boot();
  const C = TP.saveCodec;
  const enc = C.encode({ gold: 500, playerLevel: 3 }, 123);
  assert(enc.startsWith('TPS1.'));
  assert(!enc.includes('500'), 'Base64 라 평문 숫자가 보이지 않음');
  const dec = C.decode(enc);
  assert(dec.ok && dec.savedAt === 123 && dec.data.gold === 500);
  // 본문을 바꿔치기 (골드 500 → 999999) → 서명 불일치
  const [p, , sig] = enc.split('.');
  const forged = `${p}.${Buffer.from(JSON.stringify({ savedAt: 123, data: { gold: 999999 } })).toString('base64')}.${sig}`;
  assert.equal(C.decode(forged).reason, 'tampered');
  assert.equal(C.decode('{"gold":7}').legacy, true, '예전 평문 JSON 은 한 번 읽어 줌');
  assert.equal(C.decode('엉망').ok, false);
  assert(C.progress({ totalStagesCleared: 5, playerLevel: 2 }).score > C.progress({ totalStagesCleared: 4, playerLevel: 50 }).score, '깬 스테이지가 우선');
  // 한글 닉네임도 깨지지 않음
  assert.equal(C.decode(C.encode({ settings: { nickname: '탐정님' } }, 1)).data.settings.nickname, '탐정님');

  // ---- 2) store: localStorage 에 서명된 형식 · 변조된 사본은 버림 · 예전 평문 이어받기 ----
  let env = boot({ now: 5000 });
  TP.store.update(s => { s.gold = 1234; });
  const raw = env.ls.getItem(TP.store.STORAGE_KEY);
  assert(raw.startsWith('TPS1.'));
  assert.equal(TP.store.savedAt, 5000);
  env = boot({ ls: env.ls });
  assert.equal(TP.store.state.gold, 1234, '다시 켜면 그대로');
  env.ls.setItem(TP.store.STORAGE_KEY, raw.slice(0, -1) + (raw.endsWith('x') ? 'y' : 'x'));   // 서명 한 글자 변조
  env = boot({ ls: env.ls });
  assert.notEqual(TP.store.state.gold, 1234, '변조된 사본은 쓰지 않음');
  const legacy = memStorage();
  legacy.setItem('tripeaks-mystery.player.v1', JSON.stringify({ gold: 777 }));
  boot({ ls: legacy });
  assert.equal(TP.store.state.gold, 777, '예전 세이브 이어받기');

  // ---- 3) 기기 파일: 처음엔 파일 생성 · 저장은 0.4초 모아서 · 쓰기 실패 시 localStorage 폴백 ----
  env = boot({ FS: fakeFS(), now: 1000 });
  let r = await TP.localSave.init();
  assert.equal(r.source, 'new-file');
  assert(env.FS.files['save_data.json'].startsWith('TPS1.'));
  const writesBefore = env.FS.calls.filter(c => c === 'write').length;
  for (let i = 0; i < 10; i++) TP.store.update(s => { s.gold += 1; });
  await tick(50);
  assert.equal(env.FS.calls.filter(c => c === 'write').length, writesBefore, '바로 쓰지 않고 모음');
  await tick(500);
  assert.equal(env.FS.calls.filter(c => c === 'write').length, writesBefore + 1, '10번 바뀌어도 1번 씀');
  assert.equal(C.decode(env.FS.files['save_data.json']).data.gold, TP.store.state.gold);
  env.FS.failWrites = true;
  TP.store.update(s => { s.gold = 42; });
  await TP.localSave.flush();
  assert.equal(TP.localSave.status.mode, 'localStorage', '쓰기 실패 → 폴백');
  assert.equal(C.decode(env.ls.getItem(TP.store.STORAGE_KEY)).data.gold, 42, 'localStorage 사본에는 있음');

  // ---- 4) 기기 파일이 사본보다 최근 → 파일로 복구 / 파일 위조 → 사본으로 덮어씀 ----
  const fileNewer = fakeFS({ 'save_data.json': C.encode({ gold: 9000, totalStagesCleared: 30 }, 9999) });
  env = boot({ FS: fileNewer });
  r = await TP.localSave.init();
  assert(r.restored); assert.equal(TP.store.state.gold, 9000); assert.equal(TP.store.savedAt, 9999);
  const forgedFile = fakeFS({ 'save_data.json': forged });
  env = boot({ FS: forgedFile });
  r = await TP.localSave.init();
  assert.equal(r.tampered, true);
  assert.equal(C.decode(forgedFile.files['save_data.json']).ok, true, '정상 파일로 다시 씀');

  // ---- 5) 클라우드: 최신 + 진행도 높음 → 묻고(예) 불러옴 ----
  const cloudSave = C.encode({ gold: 50000, totalStagesCleared: 80, playerLevel: 20, episode: { index: 3 } }, 8000);
  env = boot({ FS: fakeFS(), PG: fakePG(cloudSave), now: 2000 });
  TP.store.update(s => { s.gold = 300; s.totalStagesCleared = 2; });
  let asked = null;
  let st = await TP.playGamesSync.init({ ask: async (cloud, local) => { asked = { cloud, local }; return true; } });
  assert.equal(st.result, 'restored');
  assert.deepEqual([asked.cloud.episode, asked.cloud.gold, asked.local.gold], [4, 50000, 300], '팝업에 에피소드 · 골드');
  assert.equal(TP.store.state.gold, 50000);

  // (아니요) → 이 기기 유지, 다음 업로드에서 덮어씀
  env = boot({ FS: fakeFS(), PG: fakePG(cloudSave), now: 2000 });
  TP.store.update(s => { s.gold = 300; });
  st = await TP.playGamesSync.init({ ask: async () => false });
  assert.equal(st.result, 'kept-local'); assert.equal(TP.store.state.gold, 300); assert(st.dirty);

  // 클라우드가 더 최근이어도 진행도가 낮으면 묻지 않음 → 이 기기 것이 올라갈 차례
  const cloudLow = C.encode({ gold: 10, totalStagesCleared: 1 }, 9000);
  env = boot({ FS: fakeFS(), PG: fakePG(cloudLow), now: 2000 });
  TP.store.update(s => { s.totalStagesCleared = 40; });
  asked = null;
  st = await TP.playGamesSync.init({ ask: async () => { asked = true; return true; } });
  assert.equal(st.result, 'local-newer'); assert.equal(asked, null);

  // 클라우드가 비어 있으면 바로 첫 업로드
  const emptyPG = fakePG(null);
  env = boot({ FS: fakeFS(), PG: emptyPG });
  st = await TP.playGamesSync.init({});
  assert.equal(st.result, 'uploaded-first'); assert(emptyPG.cloud.startsWith('TPS1.'));

  // ---- 6) 업로드 묶기: 바뀔 때마다 올리지 않음 · 최소 간격 ----
  const pg = fakePG(null);
  env = boot({ FS: fakeFS(), PG: pg });
  await TP.playGamesSync.init({});
  const saves = () => pg.calls.filter(c => c === 'save').length;
  const n0 = saves();
  for (let i = 0; i < 20; i++) TP.store.update(s => { s.gold += 1; });   // 스테이지 20번 깬 셈
  assert.equal(saves(), n0, '진행할 때마다 올리지 않음');
  assert(TP.playGamesSync.status.dirty, '바뀜 표시만');
  assert.equal(await TP.playGamesSync._upload('interval'), false, '방금 올렸으면 60초 안에는 안 올림');
  TP.playGamesSync.status.lastUpload = Date.now() - 61000;
  assert.equal(await TP.playGamesSync._upload('interval'), true);
  assert.equal(saves(), n0 + 1, '20번 바뀐 것을 1번에');
  assert.equal(TP.playGamesSync.status.dirty, false);
  assert.equal(pg.lastProgress, C.progress(TP.store.state).score, '진행도를 스냅샷에 기록(기기끼리 충돌 시 높은 쪽)');

  // ---- 7) 플러그인 없음(웹) → 지금처럼 localStorage 만 ----
  boot();
  assert.equal((await TP.localSave.init()).source, 'web');
  assert.equal((await TP.playGamesSync.init({})).state, 'unavailable');

  console.log('세이브 (인코딩 · 위조 검사 · 기기 파일 · 폴백 · 클라우드 비교 · 업로드 묶기) 통과');
  process.exit(0);                     // play-games-sync 의 5분 주기 업로드 타이머가 남아 있어 직접 끝낸다
})().catch(e => { console.error(e); process.exit(1); });
