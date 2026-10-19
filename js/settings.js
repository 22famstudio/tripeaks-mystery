// =====================================================================
// 플레이어 설정 (오디오 · 닉네임) + 효과음 · 배경음악
// =====================================================================
//   저장: TP.store.state.settings  { bgmOn, bgmVol(0~100), sfxOn, sfxVol(0~100), nickname }
//   TP.settings.get() / set(patch) — 값 검증은 store.js 의 sanitizeSettings
//
//   효과음: game_assets/sounds/sfx/*.ogg (TP.AUDIO_FILES.sfx). 첫 터치 때 미리 읽어 디코딩해 두고(지연 없이 재생)
//     파일이 없는 이름(tick · stamp)이나 읽기에 실패하면 Web Audio 합성음으로 대신한다.
//   배경음악: TP.AUDIO_FILES.bgm 에 파일 경로를 넣으면 반복 재생 (지금은 파일이 없어 null → 재생 안 함)
//   브라우저 정책상 소리는 첫 터치/클릭 이후부터 난다.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});

  const SFX = 'game_assets/sounds/sfx/';
  TP.AUDIO_FILES = {
    bgm: null,   // 홈 배경음악 (아직 없음)
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
  TP.SUPPORT = { email: 'dong2kids@gmail.com', version: '0.9.0 (prototype)' };

  // 법적 고지 (GDD 8장): 외부 웹뷰로 여는 이용약관 · 개인정보처리방침 주소 (게시 전이라 비어 있음)
  TP.LEGAL_URLS = { terms: '', privacy: '' };

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
  let bgmEl = null;
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
      this.apply();                                   // 홈 BGM (TP.AUDIO_FILES.bgm, 지금은 파일 없음 → 무음)
    },
    get activeSfx() { return [...voices].map(v => v.name); },   // 개발자 확인용

    // 설정 값(배경음악 켜기·볼륨)을 반영
    apply() {
      const s = TP.settings.get();
      if (!TP.AUDIO_FILES.bgm) return;
      if (!bgmEl) {
        bgmEl = new Audio(TP.AUDIO_FILES.bgm);
        bgmEl.loop = true;
      }
      bgmEl.volume = s.bgmVol / 100;
      if (s.bgmOn && s.bgmVol > 0 && unlocked) bgmEl.play().catch(() => {});
      else bgmEl.pause();
    },

    // ---- 상점 배경음악 (무작위 · 곡이 끝나면 다른 곡) ----
    playShopBgm() {
      shopOn = true;
      playNextShopTrack();
    },
    stopShopBgm() {
      shopOn = false;
      if (shopEl) { shopEl.pause(); shopEl = null; }
    },

    get unlocked() { return unlocked; },
  };

  let shopOn = false;
  let shopEl = null;
  let lastShopTrack = null;
  function playNextShopTrack() {
    const s = TP.settings.get();
    const list = TP.AUDIO_FILES.shopBgm || [];
    if (!shopOn || !list.length || !s.bgmOn || s.bgmVol <= 0) return;
    const pool = list.length > 1 ? list.filter(f => f !== lastShopTrack) : list;   // 방금 곡은 빼고
    const file = pool[Math.floor(Math.random() * pool.length)];
    lastShopTrack = file;
    if (shopEl) shopEl.pause();
    shopEl = new Audio(file);
    shopEl.volume = s.bgmVol / 100;
    shopEl.onended = () => playNextShopTrack();
    shopEl.play().catch(() => {});
  }
  // 설정에서 배경음악을 끄거나 볼륨을 바꾸면 상점 음악에도 바로 반영
  const applyBase = TP.audio.apply;
  TP.audio.apply = function () {
    applyBase.call(TP.audio);
    const s = TP.settings.get();
    if (!shopOn) return;
    if (!s.bgmOn || s.bgmVol <= 0) { if (shopEl) shopEl.pause(); }
    else if (!shopEl) playNextShopTrack();
    else { shopEl.volume = s.bgmVol / 100; if (shopEl.paused) shopEl.play().catch(() => {}); }
  };

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
