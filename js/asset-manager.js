// =====================================================================
// CDN 에셋 다운로드 매니저 — 에피소드 그림(배경 · 초상화 · 썸네일 · 단서, 약 100MB)을 APK 에서 빼고
//   첫 실행 때 Google Cloud Storage 버킷에서 내려받아 기기 저장소(Directory.DATA)에 풀어 둔다.
// =====================================================================
//   켜기: tools/build_www.py --cdn <version.json 주소>  (js/cdn-config.js 를 enabled: true 로 바꿔 넣고
//         APK 에서 game_assets/episodes/{ep_bg,portraits,ep_thumb,clue} 를 뺀다 · vendor/fflate.js 를 넣는다)
//   꺼져 있거나(기본) 브라우저에서 열면 아무것도 하지 않는다 → 지금까지처럼 앱에 들어 있는 파일을 쓴다.
//
//   흐름
//     1) 스크립트가 읽히는 즉시(동기): 이미 받아 둔 버전이 있으면 TP.EPISODES 의 그림 경로를
//        'game_assets/episodes/…' → 기기 저장소 주소(Capacitor.convertFileSrc)로 바꾼다.
//     2) TP.AssetManager.ensure(): version.json 을 확인해 새 버전이면 로딩 화면(진행 막대)을 띄우고
//        zip 묶음을 스트리밍으로 받으면서 바로 풀어(fflate) 파일로 쓴다 — zip 전체를 메모리 · 디스크에 두지 않음.
//        다 받으면 저장 정보(버전 · 경로)를 남기고 새로 고침 → 1) 이 새 경로로 바꿔 끼운다.
//     3) 오프라인: 받아 둔 버전이 있으면 그대로 쓰고, 처음 실행인데 받을 수 없으면 [다시 시도] 를 보여 준다.
//
//   version.json (tools/build_cdn_pack.py 가 만든다)
//     { "version": "20261020-1", "packs": [{ "url": "game_assets-20261020-1-1.zip", "size": 52428800, "files": 1400 }, …] }
//     pack.url 은 version.json 기준 상대 경로. 버전마다 파일 이름이 달라 캐시가 섞이지 않는다.
//
//   필요: @capacitor/filesystem (네이티브 플러그인 — Capacitor.Plugins.Filesystem 으로 부름) · fflate (vendor/fflate.js)
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const CFG = TP.CDN_CONFIG || { enabled: false };
  const LS_KEY = 'tp.cdnAssets.v1';                 // { version, dir, webBase }
  const PREFIX = 'game_assets/episodes/';            // 이 접두사로 시작하는 그림만 CDN 에서 받는다
  const DATA = 'DATA';                               // Filesystem Directory.Data (앱 전용 · 지우기 전까지 유지)
  const MAX_INFLIGHT = 6;                            // 동시에 기록하는 파일 수 (메모리 상한)

  const cap = globalThis.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const FS = isNative ? cap.Plugins && cap.Plugins.Filesystem : null;

  const readState = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; } };
  const writeState = s => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* 저장 공간 없음: 다음 실행 때 다시 받음 */ } };

  // ---------- 1) 받아 둔 버전으로 경로 바꿔 끼우기 (동기) ----------
  function rebase(webBase) {
    const swap = p => (typeof p === 'string' && p.startsWith(PREFIX) ? webBase + p.slice(PREFIX.length) : p);
    for (const ep of TP.EPISODES || []) {
      ep.background = swap(ep.background);
      ep.thumb = swap(ep.thumb);
      for (const s of ep.suspects || []) s.portrait = swap(s.portrait);
      for (const c of ep.clues || []) c.prop = swap(c.prop);
    }
  }
  const installed = CFG.enabled && isNative ? readState() : null;
  if (installed && installed.webBase) rebase(installed.webBase);

  // ---------- 로딩 화면 (진행 막대) ----------
  function overlay() {
    const el = document.createElement('div');
    el.className = 'cdn-loader';
    el.innerHTML = `
      <style>
        .cdn-loader { position: fixed; inset: 0; z-index: 100000; display: grid; place-items: center; background: #0d2a4a; color: #fff; font-family: inherit; text-align: center; }
        .cdn-loader .box { width: min(80vw, 520px); }
        .cdn-loader h2 { margin: 0 0 4px; font-size: 22px; }
        .cdn-loader p { margin: 0 0 16px; font-size: 14px; opacity: .8; }
        .cdn-loader .bar { height: 18px; border-radius: 999px; background: #ffffff22; border: 2px solid #000; overflow: hidden; }
        .cdn-loader .fill { height: 100%; width: 0%; background: linear-gradient(#ffe27a, #f2a91c); transition: width .2s; }
        .cdn-loader .num { margin-top: 8px; font-size: 13px; opacity: .85; font-variant-numeric: tabular-nums; }
        .cdn-loader button { margin-top: 16px; padding: 10px 28px; border-radius: 999px; border: 3px solid #000; background: #8ade2e; font: inherit; font-weight: 800; }
      </style>
      <div class="box">
        <h2>사건 파일을 준비하고 있어요</h2>
        <p>처음 한 번만 받아요 (Wi-Fi 권장)</p>
        <div class="bar"><div class="fill"></div></div>
        <div class="num">0%</div>
        <button hidden>다시 시도</button>
      </div>`;
    document.body.append(el);
    const mb = n => (n / 1048576).toFixed(1);
    return {
      progress(done, total) {
        const pct = total ? Math.min(100, Math.floor((done / total) * 100)) : 0;
        el.querySelector('.fill').style.width = `${pct}%`;
        el.querySelector('.num').textContent = total ? `${pct}% · ${mb(done)} / ${mb(total)} MB` : `${mb(done)} MB`;
      },
      fail(msg, retry) {
        el.querySelector('h2').textContent = '사건 파일을 받지 못했어요';
        el.querySelector('p').textContent = msg;
        const b = el.querySelector('button');
        b.hidden = false;
        b.onclick = () => { el.remove(); retry(); };
      },
      done() { el.querySelector('.num').textContent = '완료! 잠시만요…'; },
    };
  }

  // ---------- 파일 쓰기 ----------
  function toBase64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const writeFile = (path, u8) => FS.writeFile({ path, data: toBase64(u8), directory: DATA, recursive: true });
  const concat = parts => {
    if (parts.length === 1) return parts[0];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };

  // zip 하나를 받으면서 바로 풀어 dir/ 아래에 쓴다. onBytes(받은 바이트 증가분)
  async function streamPack(url, dir, onBytes) {
    const fflate = globalThis.fflate;
    if (!fflate) throw new Error('fflate 가 없습니다 (vendor/fflate.js)');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const inflight = new Set();
    let failure = null;
    const track = p => {
      inflight.add(p);
      p.catch(e => { failure = failure || e; }).finally(() => inflight.delete(p));
    };
    const unzip = new fflate.Unzip(file => {
      if (file.name.endsWith('/')) return;                  // 폴더 항목
      const parts = [];
      file.ondata = (err, chunk, final) => {
        if (err) { failure = failure || err; return; }
        if (chunk && chunk.length) parts.push(chunk);
        if (final) track(writeFile(`${dir}/${file.name}`, concat(parts)));
      };
      file.start();
    });
    unzip.register(fflate.UnzipInflate);                    // 압축(deflate) 항목 — 무압축(stored)은 기본 지원
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (failure) throw failure;
      if (done) { unzip.push(new Uint8Array(0), true); break; }
      unzip.push(value);
      onBytes(value.length);
      while (inflight.size >= MAX_INFLIGHT) await Promise.race(inflight);   // 쓰기가 밀리면 받기를 잠시 멈춤
    }
    await Promise.all(inflight);
    if (failure) throw failure;
  }

  async function removeDir(path) {
    try { await FS.rmdir({ path, directory: DATA, recursive: true }); } catch { /* 없으면 그만 */ }
  }

  // ---------- 2) 확인 · 다운로드 ----------
  async function ensure() {
    if (!CFG.enabled || !isNative) return { status: 'disabled' };
    if (!FS) return { status: 'error', error: 'Filesystem 플러그인이 없습니다 (npx cap sync)' };
    let remote;
    try {
      const r = await fetch(CFG.versionUrl, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      remote = await r.json();
    } catch (e) {
      if (installed) return { status: 'offline', version: installed.version };   // 받아 둔 것으로 계속
      return new Promise(resolve => overlay().fail('인터넷 연결을 확인한 뒤 다시 시도해 주세요.', () => resolve(ensure())));
    }
    if (installed && installed.version === remote.version) return { status: 'ready', version: installed.version };

    const ui = overlay();
    const dir = `cdn_assets/${remote.version}`;
    const total = remote.packs.reduce((n, p) => n + (p.size || 0), 0);
    let done = 0;
    ui.progress(0, total);
    try {
      await removeDir(dir);                                    // 지난번에 받다 만 같은 버전 정리
      for (const pack of remote.packs) {
        const url = new URL(pack.url, CFG.versionUrl).href;
        await streamPack(url, dir, n => { done += n; ui.progress(done, total); });
      }
    } catch (e) {
      return new Promise(resolve => ui.fail(`받는 중 문제가 생겼어요 (${e.message || e}). 다시 시도해 주세요.`, () => resolve(ensure())));
    }
    const { uri } = await FS.getUri({ path: dir, directory: DATA });
    const webBase = cap.convertFileSrc(uri).replace(/\/?$/, '/');
    const old = installed && installed.dir;
    writeState({ version: remote.version, dir, webBase });
    if (old && old !== dir) await removeDir(old);              // 예전 버전 지우기
    ui.done();
    setTimeout(() => location.reload(), 400);                 // 새 경로로 다시 시작
    return { status: 'updated', version: remote.version };
  }

  TP.AssetManager = { ensure, rebase, state: readState, isEnabled: () => !!(CFG.enabled && isNative) };
})();
