// =====================================================================
// 플레이어 설정 (오디오 · 닉네임) + 효과음 · 배경음악
// =====================================================================
//   저장: TP.store.state.settings  { bgmOn, bgmVol(0~100), sfxOn, sfxVol(0~100), nickname }
//   TP.settings.get() / set(patch) — 값 검증은 store.js 의 sanitizeSettings
//
//   효과음: game_assets/sounds/sfx/*.ogg (TP.AUDIO_FILES.sfx). 첫 터치 때 미리 읽어 디코딩해 두고(지연 없이 재생)
//     파일이 없는 이름(tick · stamp)이나 읽기에 실패하면 Web Audio 합성음으로 대신한다.
//   배경음악: 상점 밖(홈 · 사건 파일 · 추리 수첩 · 카드 플레이)은 TP.AUDIO_FILES.homeBgm, 상점은 shopBgm.
//     둘 다 무작위 · 곡이 끝나면 방금 곡을 빼고 다른 곡. 홈 곡은 효과음 아래 잔잔하게(HOME_BGM_GAIN), 상점에 들어가면
//     홈 곡을 줄이며 멈추고 상점 곡, 나오면 홈 곡을 멈춘 자리부터 다시. 앱이 뒤로 가면 멈추고 돌아오면 이어서.
//   브라우저 정책상 소리는 첫 터치/클릭 이후부터 난다.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});

  const SFX = 'game_assets/sounds/sfx/';
  TP.AUDIO_FILES = {
    // 홈 · 게임 배경음악 20곡 (원본은 ../assets_original_backup/game_assets/sounds/bgm — tools/build_bgm.py home 이 OGG · iOS MP3 로)
    homeBgm: Array.from({ length: 20 }, (_, i) => `game_assets/sounds/bgm_mp3/home_bgm_${i + 1}.ogg`),
    // 상점 배경음악: 파일명이 shop 으로 시작하는 곡 (tools/build_bgm.py 가 WAV → MP3). 상점에 들어가면 무작위로 틀고,
    // 한 곡이 끝나면 다른 곡으로 이어서 재생, 상점을 나가면 멈춘다.
    shopBgm: [1, 2, 3, 4, 5].map(n => `game_assets/sounds/bgm_mp3/shop_bgm_${n}.ogg`),
    // 효과음 이름 → 파일 (이름은 코드에서 TP.audio.sfx('이름') 으로 부른다)
    sfx: {
      click: `${SFX}click.ogg`,                    // 모든 버튼
      play: `${SFX}card_flip.ogg`,                 // 보드 카드 맞힘 (콤보가 오를수록 살짝 높게)
      draw: `${SFX}card_flip.ogg`,                 // 덱에서 한 장 뽑기
      deal: `${SFX}setting_cards.ogg`,             // 판 시작: 카드 깔기
      start: `${SFX}game_start.ogg`,               // 입장하기 → 게임 시작
      plus: `${SFX}plus_card.ogg`,                 // +1 보너스 카드 · 덱 +N장 (콤보 보상 도착 · 이어하기 · 광고 부활)
      chest: `${SFX}bonus.ogg`,                    // 콤보 목표 달성
      wild: `${SFX}wild_card.ogg`,                 // 와일드카드 (아이템 사용 · 보드 와일드 카드)
      undo: `${SFX}undo.ogg`,                      // 되돌리기
      error: `${SFX}incorrect.ogg`,                // 낼 수 없는 카드 · 막힌 동작
      coin: `${SFX}coin.ogg`,                      // 골드 (엔드게임 축포 · 골드 지불)
      win: `${SFX}stage_success.ogg`,              // 스테이지 클리어
      fail: `${SFX}stage_failed.ogg`,              // 스테이지 실패 (포기)
      purchase: `${SFX}purchase_success.ogg`,      // 상점 결제 완료
      popup: `${SFX}popup.ogg`,                    // 팝업(대화 상자) 열림
      open: `${SFX}open.ogg`,                      // 패널 열림 (입장 · 상점 · 에피소드 · 설정)
      exit: `${SFX}exit.ogg`,                      // 패널 닫힘
      bookOpen: `${SFX}book_flip_1.ogg`,           // 탐정 수첩(수사 보드) 열기
      pageFlip: `${SFX}book_flip_2.ogg`,           // 용의자 파일 넘겨 보기
      bookClose: `${SFX}clue_book_closed.ogg`,     // 탐정 수첩 닫기
      clue: `${SFX}clue_popup.ogg`,                // 단서 획득 팝업
      clueSaved: `${SFX}clue_received.ogg`,        // 단서를 수첩에 저장 ([확인])
      success: `${SFX}success.ogg`,                // 클리어 결과 화면
      nextStage: `${SFX}next_stage.ogg`,           // 결과 화면 NEXT STAGE
      collect: `${SFX}collect.ogg`,                // 클리어 화면 COLLECT
      chapter: `${SFX}plane.ogg`,                  // 대륙(챕터) 이동 화면 (ui_chapter_transition — 비행기)
      choose: `${SFX}choosing_person.ogg`,         // 지목 팝업에서 용의자 고르기
      suspense: `${SFX}before_answer.ogg`,         // 지목 직후 결과 발표 전 (두근두근)
      accuseSuccess: `${SFX}accuse_success.ogg`,   // 진범 지목 성공
      accuseFail: `${SFX}wrong_person.ogg`,        // 지목 실패
    },
  };

  // 고객 문의 (GDD 8장): 기본 이메일 앱 호출, 답변 3~10 working days
  TP.SUPPORT = { email: 'dong2kids@gmail.com', version: '0.9.9' };   // 버전은 mobile/package.json 과 맞춤

  // 법적 고지 (GDD 8장): 외부 브라우저로 여는 이용약관 · 개인정보처리방침 주소 — 언어별 (없는 언어는 en → ko 순으로)
  //   개인정보처리방침 원문: docs/legal/privacy_policy_{ko,en,ja}.md → Notion 게시
  TP.LEGAL_URLS = {
    terms: {     // 이용약관 원문: docs/legal/terms_{ko,en,ja}.md → Notion 게시
      ko: 'https://brash-sleet-4e0.notion.site/99b2c16d20c482ef97f581212fb12799',
      en: 'https://brash-sleet-4e0.notion.site/Terms-of-Service-4002c16d20c480519fc5cb36889424be',
      ja: 'https://brash-sleet-4e0.notion.site/2e22c16d20c480e29cabfe21efd2da5d',
    },
    privacy: {
      ko: 'https://brash-sleet-4e0.notion.site/4002c16d20c48021ac99e29e06fdb8c1',
      en: 'https://brash-sleet-4e0.notion.site/Privacy-Policy-4002c16d20c48040afd6fa18b964fe43',
      ja: 'https://brash-sleet-4e0.notion.site/4002c16d20c48004b6cad64b3153a12c',
    },
    tokushoho: { // 일본 特定商取引法に基づく表記 (일본어만) — 원문: docs/legal/tokushoho_ja.md
      ja: 'https://brash-sleet-4e0.notion.site/4022c16d20c480caa3ccebfa0967cd91',
    },
  };
  TP.legalUrl = kind => {
    const urls = TP.LEGAL_URLS[kind] || {};
    return urls[TP.i18n?.lang] || urls.en || urls.ko || '';
  };

  TP.settings = {
    get() { return TP.store.state.settings; },
    set(patch) {
      TP.store.update(s => { s.settings = { ...s.settings, ...patch }; });
      TP.audio.apply();
      return this.get();
    },
  };

  // ---------------- 오디오 ----------------
  let ctx = null;
  let unlocked = false;
  const buffers = {};      // 파일 경로 → 디코딩된 AudioBuffer (첫 터치 때 미리 읽음)

  // 효과음 파일 미리 읽기 (http/앱에서만 — file:// 로 열면 fetch 가 막혀 <audio> 재생으로 대신)
  function preload() {
    const ac = context();
    if (!ac || typeof fetch !== 'function') return;
    for (const file of new Set(Object.values(TP.AUDIO_FILES.sfx))) {
      if (buffers[file]) continue;
      buffers[file] = 'loading';
      fetch(file).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b))
        .then(buf => { buffers[file] = buf; })
        .catch(() => { buffers[file] = null; });
    }
  }

  function context() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 짧은 음 하나: 주파수·길이·파형·시작 지연
  function tone(ac, out, { freq, dur = 0.08, type = 'triangle', delay = 0, slide = 0, gain = 1 }) {
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const SYNTH = {
    // 콤보가 오를수록 음이 올라간다 (최대 12단계)
    play: (ac, out, { combo = 1 } = {}) => tone(ac, out, { freq: 523 * Math.pow(2, Math.min(combo - 1, 12) / 12), dur: 0.09 }),
    draw: (ac, out) => tone(ac, out, { freq: 260, dur: 0.07, type: 'sine', slide: 0.6 }),
    wild: (ac, out) => { tone(ac, out, { freq: 784, dur: 0.08 }); tone(ac, out, { freq: 1175, dur: 0.12, delay: 0.07 }); },
    chest: (ac, out) => [659, 784, 988].forEach((f, i) => tone(ac, out, { freq: f, dur: 0.1, delay: i * 0.06 })),
    win: (ac, out) => [523, 659, 784, 1047].forEach((f, i) => tone(ac, out, { freq: f, dur: 0.16, delay: i * 0.09, type: 'square', gain: 0.5 })),
    click: (ac, out) => tone(ac, out, { freq: 1200, dur: 0.025, type: 'sine', gain: 0.6 }),
    coin: (ac, out, { i = 0 } = {}) => { tone(ac, out, { freq: 1319 + (i % 5) * 60, dur: 0.06, type: 'square', gain: 0.3 }); tone(ac, out, { freq: 1760, dur: 0.08, delay: 0.05, gain: 0.3 }); },
    error: (ac, out) => tone(ac, out, { freq: 160, dur: 0.12, type: 'square', gain: 0.4, slide: 0.8 }),
    // 파일이 없는 소리 (모르는 건 합성음 그대로)
    chapter: (ac, out) => [523, 659, 784, 1047].forEach((f, i) => tone(ac, out, { freq: f, dur: 0.16, delay: i * 0.09, type: 'square', gain: 0.5 })),
    tick: (ac, out) => tone(ac, out, { freq: 900, dur: 0.02, type: 'sine', gain: 0.25 }),
    stamp: (ac, out) => tone(ac, out, { freq: 110, dur: 0.18, type: 'square', gain: 0.7, slide: 0.5 }),
  };
  // 콤보가 오를수록 카드 소리를 조금씩 높게 (최대 +40%)
  const RATE = {
    play: ({ combo = 1 } = {}) => 1 + Math.min(combo - 1, 10) * 0.04,
    draw: () => 0.9,
  };

  // ---- 재생 중인 효과음 추적 (화면 전환 때 멈추기 위해) ----
  //   전환용 효과음: 화면을 넘어가며 길게 울리는 소리. 화면이 바뀌거나 전환 연출이 닫히면 페이드아웃.
  TP.TRANSITION_SFX = new Set(['chapter']);          // chapter = plane.ogg (대륙 이동)
  const voices = new Set();                           // { name, src?, gain?, el? }
  function track(v) {
    voices.add(v);
    const done = () => voices.delete(v);
    if (v.src) v.src.onended = done; else if (v.el) v.el.addEventListener('ended', done);
    return v;
  }
  function fadeOut(v, ms) {
    voices.delete(v);
    if (v.src) {
      const ac = context();
      const t = ac.currentTime;
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(v.gain.gain.value, t);
        v.gain.gain.linearRampToValueAtTime(0, t + ms / 1000);
        v.src.stop(t + ms / 1000 + 0.02);
      } catch (e) { try { v.src.stop(); } catch (_) {} }
    } else if (v.el) {
      const el = v.el;
      const from = el.volume;
      const t0 = performance.now();
      const step = now => {
        const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
        el.volume = from * (1 - k);
        if (k < 1) requestAnimationFrame(step); else { el.pause(); el.currentTime = 0; }
      };
      if (ms > 0) requestAnimationFrame(step); else { el.pause(); el.currentTime = 0; }
    }
  }

  TP.audio = {
    // 효과음 재생. 설정에서 꺼져 있으면 아무것도 하지 않는다.
    sfx(name, opts) {
      const s = TP.settings.get();
      if (!s.sfxOn || s.sfxVol <= 0 || !unlocked) return;
      const file = TP.AUDIO_FILES.sfx[name];
      const rate = RATE[name] ? RATE[name](opts) : 1;
      if (file) {
        const ac = context();
        const buf = buffers[file];
        if (ac && buf && buf !== 'loading') {
          const src = ac.createBufferSource();
          const g = ac.createGain();
          src.buffer = buf;
          src.playbackRate.value = rate;
          g.gain.value = s.sfxVol / 100;
          src.connect(g).connect(ac.destination);
          src.start();
          track({ name, src, gain: g });
          return;
        }
        if (buf !== null || buffers[file] === undefined) {      // 아직 읽는 중 · file:// → <audio> 로 재생
          const a = new Audio(file);
          a.volume = s.sfxVol / 100;
          a.playbackRate = rate;
          a.play().catch(() => {});
          track({ name, el: a });
          return;
        }
      }
      const ac = context();
      if (!ac || !SYNTH[name]) return;
      const out = ac.createGain();
      out.gain.value = (s.sfxVol / 100) * 0.22;
      out.connect(ac.destination);
      SYNTH[name](ac, out, opts);
    },

    // 이름으로 재생 중인 효과음 멈추기 (fadeMs 동안 줄인 뒤 정지, 0이면 즉시)
    stopSfx(names, { fadeMs = 250 } = {}) {
      const set = new Set([].concat(names));
      for (const v of [...voices]) if (set.has(v.name)) fadeOut(v, fadeMs);
    },
    // 전환용 효과음(비행기 소리 등)만 멈춘다 — 화면 전환 · 전환 연출이 닫힐 때
    stopTransitionSounds({ fadeMs = 300 } = {}) {
      this.stopSfx([...TP.TRANSITION_SFX], { fadeMs });
    },
    // 홈 화면 진입: 이전 화면에서 넘어온 전환 효과음 · 상점 음악을 정리하고 홈 배경음악만 남긴다
    enterLobby() {
      this.stopTransitionSounds();
      this.stopShopBgm();
      this.apply();                                   // 홈 배경음악 (TP.AUDIO_FILES.homeBgm, 상점에서 나왔으면 멈춘 자리부터)
    },
    get activeSfx() { return [...voices].map(v => v.name); },   // 개발자 확인용
    // 개발자 확인용: 지금 배경음악 상태
    get bgmState() {
      const st = el => el && { file: decodeURIComponent(el.src.split('/').pop()), paused: el.paused, volume: +el.volume.toFixed(2), time: +el.currentTime.toFixed(1) };
      return { home: st(homeEl), shop: st(shopEl), shopOn, appHidden };
    },

    // 설정 값(배경음악 켜기 · 볼륨) · 지금 화면(상점 안/밖) · 앱이 앞에 있는지를 배경음악에 반영
    apply() {
      const s = TP.settings.get();
      const on = unlocked && s.bgmOn && s.bgmVol > 0 && !appHidden && !adPlaying;   // 광고가 화면을 덮는 동안 멈춤
      // 상점 곡
      if (!on || !shopOn) { if (shopEl) shopEl.pause(); }
      else if (!shopEl) playNextShopTrack();
      else { shopEl.volume = s.bgmVol / 100; if (shopEl.paused) shopEl.play().catch(() => {}); }
      // 홈 곡 (상점 밖)
      if (!on || shopOn) { if (homeEl && !homeEl.paused) fadeVolume(homeEl, 0, shopOn ? 500 : 0, () => homeEl && homeEl.pause()); }
      else if (!homeEl) playNextHomeTrack();
      else if (homeEl.paused) { homeEl.volume = 0; homeEl.play().catch(() => {}); fadeVolume(homeEl, homeVolume(), 1200); }
      else fadeVolume(homeEl, homeVolume(), 200);
    },

    // ---- 상점 배경음악 (무작위 · 곡이 끝나면 다른 곡) — 들어가면 홈 곡은 줄이며 멈춤, 나오면 이어서 ----
    playShopBgm() {
      shopOn = true;
      this.apply();
    },
    stopShopBgm() {
      shopOn = false;
      if (shopEl) { shopEl.pause(); shopEl = null; }
      this.apply();
    },

    // 광고(js/ad-manager.js)가 재생되는 동안 배경음악 멈춤 → 끝나면 이어서
    setAdPlaying(on) { adPlaying = !!on; this.apply(); },
    get unlocked() { return unlocked; },
  };

  let shopOn = false;
  let shopEl = null;
  let homeEl = null;
  let appHidden = false;
  let adPlaying = false;
  // 홈 · 게임 배경음악은 효과음 · 대사 뒤에 잔잔하게 — 설정 볼륨의 35% (상점 곡은 설정 볼륨 그대로)
  TP.HOME_BGM_GAIN = 0.35;
  const homeVolume = () => (TP.settings.get().bgmVol / 100) * TP.HOME_BGM_GAIN;
  const last = { home: null, shop: null };
  // 무작위로 고르되 방금 곡은 빼고
  function pick(list, key) {
    const pool = list.length > 1 ? list.filter(f => f !== last[key]) : list;
    const file = pool[Math.floor(Math.random() * pool.length)];
    last[key] = file;
    return file;
  }
  // 볼륨을 ms 동안 to 로 (0 이면 바로). 끝나면 then()
  function fadeVolume(el, to, ms, then) {
    cancelAnimationFrame(el._fadeId);
    const from = el.volume, t0 = performance.now();
    const step = now => {
      const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) el._fadeId = requestAnimationFrame(step); else if (then) then();
    };
    if (ms > 0) el._fadeId = requestAnimationFrame(step); else step(t0);
  }
  function playNextShopTrack() {
    const list = TP.AUDIO_FILES.shopBgm || [];
    if (!shopOn || !list.length) return;
    if (shopEl) shopEl.pause();
    shopEl = new Audio(pick(list, 'shop'));
    shopEl.volume = TP.settings.get().bgmVol / 100;
    shopEl.onended = () => playNextShopTrack();
    shopEl.play().catch(() => {});
  }
  function playNextHomeTrack() {
    const list = TP.AUDIO_FILES.homeBgm || [];
    if (!list.length) return;
    if (homeEl) homeEl.pause();
    const el = homeEl = new Audio(pick(list, 'home'));
    el.volume = 0;
    el.onended = () => { if (homeEl === el) { homeEl = null; TP.audio.apply(); } };   // 다음 곡 (상점 안이면 나올 때)
    el.play().catch(() => {});
    fadeVolume(el, homeVolume(), 1200);
  }
  // 앱이 뒤로 가면(홈 버튼 · 화면 끔) 배경음악을 멈추고, 돌아오면 이어서
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { appHidden = document.hidden; TP.audio.apply(); });
    // 안드로이드 앱(Capacitor)은 앱이 뒤로 갈 때 document 에 pause / resume 을 보낸다 (WebView 가 visibilitychange 를 안 줄 때 대비)
    document.addEventListener('pause', () => { appHidden = true; TP.audio.apply(); });
    document.addEventListener('resume', () => { appHidden = false; TP.audio.apply(); });
  }

  // 첫 사용자 입력에서 오디오 잠금 해제 + 모든 버튼에 클릭음
  if (typeof document !== 'undefined') {
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      context();
      preload();
      TP.audio.apply();
    };
    document.addEventListener('pointerdown', e => {
      unlock();
      // 자기 소리가 따로 있는 버튼(닫기 · 입장 · 용의자 고르기 · 최종 지목 · 결제)은 클릭음을 겹쳐 내지 않는다
      if (e.target.closest('button, .clickable') && !e.target.closest('[data-nosfx], .icon-btn, #entryGo, #entryCancel, .pick, .final-accuse-btn, .price, .win-collect'))
        TP.audio.sfx('click');
    }, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true, once: true });
  }
})();
