// =====================================================================
// 세이브 인코딩 — Base64 + 위조 검사 서명 (기기 파일 save_data.json · localStorage 사본 · Play 게임즈 클라우드 공통)
// =====================================================================
//   형식: 'TPS1.' + Base64(UTF-8 JSON { savedAt, data }) + '.' + 서명
//         서명 = cyrb53(본문 + 비밀 소금) — 파일을 열어 골드 숫자만 바꾸면 서명이 맞지 않아 읽지 않는다.
//   한계: 소금이 앱 코드 안에 있으므로 작정한 해커는 풀 수 있다. 목적은 '메모장으로 고치기' 같은 가벼운 조작 방지.
//         결제 · 재화의 진짜 보호는 서버 검증이 필요하다 (이 게임은 서버 비용 0 구조라 하지 않음).
//   예전 형식(평문 JSON)은 한 번 읽어 주고 다음 저장 때 새 형식으로 바뀐다.
//
//   TP.saveCodec.encode(state, savedAt) → 문자열
//   TP.saveCodec.decode(문자열)         → { ok, savedAt, data, legacy? } | { ok: false, reason }
//   TP.saveCodec.progress(state)        → { score, episode, gold, level, stages }  (충돌 비교 · 팝업 표시용)
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const PREFIX = 'TPS1';
  const SALT = 'onsen-ryokan|tripeaks|detective-cat|2026';

  // cyrb53 — 빠른 53비트 해시 (암호용 아님, 변조 감지용)
  function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function toB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromB64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encode(state, savedAt) {
    const body = toB64(JSON.stringify({ savedAt, data: state }));
    return `${PREFIX}.${body}.${cyrb53(body + SALT)}`;
  }

  function decode(text) {
    if (typeof text !== 'string' || !text) return { ok: false, reason: 'empty' };
    if (text.trimStart().startsWith('{')) {                       // 예전 평문 JSON
      try { return { ok: true, legacy: true, savedAt: 0, data: JSON.parse(text) }; } catch { return { ok: false, reason: 'corrupt' }; }
    }
    const [prefix, body, sig] = text.split('.');
    if (prefix !== PREFIX || !body || !sig) return { ok: false, reason: 'format' };
    if (cyrb53(body + SALT) !== sig) return { ok: false, reason: 'tampered' };
    try {
      const { savedAt, data } = JSON.parse(fromB64(body));
      if (!data || typeof data !== 'object') return { ok: false, reason: 'corrupt' };
      return { ok: true, savedAt: Number(savedAt) || 0, data };
    } catch { return { ok: false, reason: 'corrupt' }; }
  }

  // 진행도: 깬 스테이지 수가 가장 중요하고, 같으면 레벨 · 경험치로 가린다
  function progress(s = {}) {
    const stages = Math.max(0, s.totalStagesCleared | 0);
    const level = Math.max(1, s.playerLevel | 0);
    return {
      score: stages * 1e6 + level * 1e3 + Math.min(999, Math.floor((s.exp | 0) / 100)),
      episode: ((s.episode && s.episode.index) | 0) + 1,
      gold: s.gold | 0,
      level,
      stages,
    };
  }

  TP.saveCodec = { encode, decode, progress, hash: cyrb53 };
})();
