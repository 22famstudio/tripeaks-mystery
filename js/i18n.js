// =====================================================================
// 다국어 (한국어 · English · 日本語) — 설정 → 언어
// =====================================================================
//   방식: 한국어 원문이 곧 키 (gettext 방식). 코드에서는 TP.t('남은 카드 {n}장', { n }) 처럼 쓴다.
//         번역은 js/lang/en.js · js/lang/ja.js 의 TP.LANG_DATA[언어]['한국어 원문'] = '번역'.
//         번역이 없으면 한국어 원문을 그대로 보여 준다 (깨지지 않음). 누락은 tools/i18n_check.py 가 찾는다.
//   {이름} 자리표시자는 params 로 채운다 (값에 HTML 을 넣어도 됨 — 예: { t: `<b>${time}</b>` }).
//   tripeaks.html 의 고정 문구(버튼 · 제목 · title · aria-label · alt · placeholder)는 applyStatic() 이
//   불러올 때 한 번 정확히 일치하는 것만 바꾼다.
//   언어 바꾸기: TP.i18n.setLang('en') → 설정에 저장하고 새로 고침 (모든 화면을 새 언어로 다시 그림)
//   처음 실행(설정에 언어 없음): 기기 언어 — 한국어 → ko, 일본어 → ja, 그 밖 → en
//   글씨가 박힌 그림: TP.i18n.img('game_assets/txt_pause_title.webp') → 영어면 txt_pause_title.en.webp
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const SUPPORTED = ['ko', 'en', 'ja'];
  const NAMES = { ko: '한국어', en: 'English', ja: '日本語' };
  TP.LANG_DATA ??= {};

  const fmt = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : String(s));

  function detect() {
    const n = String((globalThis.navigator && navigator.language) || 'ko').toLowerCase();
    return n.startsWith('ko') ? 'ko' : n.startsWith('ja') ? 'ja' : 'en';
  }
  function saved() {
    const v = TP.store && TP.store.state && TP.store.state.settings && TP.store.state.settings.lang;
    return SUPPORTED.includes(v) ? v : '';
  }

  let lang = saved() || detect();
  const missing = new Set();

  function t(key, params) {
    if (lang === 'ko' || key == null) return fmt(key ?? '', params);
    const dict = TP.LANG_DATA[lang];
    const v = dict && dict[key];
    if (v == null) { missing.add(key); return fmt(key, params); }
    return fmt(v, params);
  }

  // 정적 HTML 번역: 텍스트 노드(앞뒤 공백 유지) + 몇몇 속성. 정확히 일치하는 것만
  const ATTRS = ['title', 'aria-label', 'alt', 'placeholder'];
  const HANGUL = /[가-힣]/;
  // emoji-icons.js 가 앞머리 이모지를 <img> 로 먼저 바꿔 글자가 쪼개진 경우: '🎵 오디오' → '오디오' 로도 찾는다
  let bare = null;
  function lookup(key) {
    const dict = TP.LANG_DATA[lang];
    if (!dict) return null;
    if (dict[key] != null) return dict[key];
    if (!bare) {
      bare = {};
      const LEAD = /^(?:[^\p{L}\p{N}<("'[]|ℹ)+\s*/u;   // ℹ 는 유니코드상 '글자'라 따로
      for (const [k, v] of Object.entries(dict)) {
        const p = k.match(LEAD);
        if (!p) continue;
        const vp = String(v).match(LEAD);
        bare[k.slice(p[0].length)] ??= vp ? String(v).slice(vp[0].length) : v;
      }
    }
    return bare[key] ?? null;
  }

  function applyStatic(root = globalThis.document && document.body) {
    if (!root || lang === 'ko') return;
    if (HANGUL.test(document.title)) document.title = lookup(document.title.trim()) ?? document.title;   // <title> (게임 이름)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const raw = n.nodeValue;
      if (!HANGUL.test(raw)) continue;
      const p = n.parentElement;
      if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.closest('[data-i18n-skip]'))) continue;   // 언어 이름 등은 그대로
      const key = raw.trim();
      const v = lookup(key);
      if (v != null) n.nodeValue = raw.replace(key, v);
      else missing.add(key);
    }
    root.querySelectorAll('*').forEach(el => {
      for (const a of ATTRS) {
        const raw = el.getAttribute(a);
        if (!raw || !HANGUL.test(raw)) continue;
        const v = lookup(raw.trim());
        if (v != null) el.setAttribute(a, v); else missing.add(raw.trim());
      }
    });
  }

  function setLang(next) {
    if (!SUPPORTED.includes(next) || next === lang) return;
    if (TP.settings) TP.settings.set({ lang: next });
    else if (TP.store) TP.store.update(s => { s.settings = { ...s.settings, lang: next }; });
    if (TP.localSave) TP.localSave.flush();
    setTimeout(() => globalThis.location && location.reload(), 150);
  }

  // 글씨가 박힌 그림의 언어별 파일 (그림이 준비된 것만 IMG_LANGS 에 등록)
  //   (Higgsfield 로 만든 글씨 그림 — 파일명.en.webp / 파일명.ja.webp, 원본과 같은 상자 크기)
  const IMG_LANGS = {};
  for (const n of ['txt_energy_title', 'txt_pause_title', 'txt_resume_title', 'txt_heart_charge', 'txt_gold_charge'])
    IMG_LANGS[`game_assets/${n}.webp`] = ['en', 'ja'];
  function img(path) {
    if (lang === 'ko') return path;
    const set = IMG_LANGS[path];
    return set && set.includes(lang) ? path.replace(/(\.\w+)$/, `.${lang}$1`) : path;
  }

  if (globalThis.document && document.documentElement) {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
  }

  TP.t = t;
  TP.i18n = {
    get lang() { return lang; },
    SUPPORTED, NAMES, t, applyStatic, setLang, img, IMG_LANGS, detect,
    missing: () => [...missing],
    _setLangForTest(l) { lang = l; },
  };
})();
