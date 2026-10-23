// 메타 게임 연결: 상태바 · 입장(스테이지·배수·난이도) · 정산 · 연승 · 단서 · 이어하기 · 아이템 · 상점 · 개발자 패널
//   게임 루프: openEntry(스테이지 시작) → view.start → handleEnd → settleWin(클리어) / offerContinue(막힘)
//   추리 진행: settleWin에서 단서 획득 → 20개가 모이면 탐정 수첩(notebook.js)이 강제로 열려 범인 지목
(function () {
  const { TP } = globalThis;
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  TP.i18n?.applyStatic();   // tripeaks.html 고정 문구 번역 (한국어면 아무것도 안 함)
  const $ = sel => document.querySelector(sel);
  const store = TP.store;
  const randomSeed = () => 1 + Math.floor(Math.random() * 1e9);

  const { openModal, closeModal, showDialog, toast, confettiAt, bigCelebration, bump } = TP.ui;

  const tierBadge = tier => `<span class="tier-badge tier-${tier.id}">${T(tier.name)}</span>`;

  // =====================================================================
  // 게임 보드 + 현재 판(run)
  // =====================================================================
  let run = null; // { seed, tierId, stage, mult, fee, finished }
  const view = TP.createGameView({ onEnd: handleEnd, onChange: () => { refreshItemButtons(); saveRunState(); }, onChest: handleChest });
  const activeRun = () => run && !run.finished && view.game;
  const mystery = TP.mystery;
  const notebook = TP.createNotebook({
    // 사건 해결 → 홈으로. 다음 에피소드의 대륙이 바뀌면(예: 100화 → 101화 아시아 → 북아메리카) 챕터 전환 연출
    onSolvedNext: async ({ chapterChange } = {}) => {
      showScreen('lobby');
      if (chapterChange) await playChapterTransition(chapterChange);
    },
    onReset: () => showScreen('lobby'),
  });

  // =====================================================================
  // 챕터(대륙) 전환 연출 — "새로운 대륙 [북아메리카]로 이동합니다!"
  // =====================================================================
  //   다음 에피소드 배경을 깔고 지도 아이콘 · 대륙 이름 · 6개 대륙 진행 점을 보여 준 뒤 사라진다 (화면을 누르면 바로 닫힘)
  //   TP.EPISODE_CHAPTERS (episodes.js) : 아시아 1~100 → 북아메리카 101~140 → 남아메리카 141~180
  //                                       → 아프리카 181~230 → 유럽 231~280 → 오세아니아 281~300
  const CHAPTER_MS = 3200;
  function playChapterTransition(change) {
    const chapters = TP.EPISODE_CHAPTERS || [];
    const idx = change.chapter.index;
    const ep = change.firstEpisode;
    const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fx = document.createElement('div');
    fx.className = 'chapter-transition';
    fx.style.zIndex = 99200;
    fx.innerHTML = `
      <img class="ct-art" src="${TP.ASSETS.uiChapterTransition}" alt="">
      <div class="ct-body">
        <small class="ct-chapter">CHAPTER ${idx >= 0 ? idx + 1 : ''}${change.from ? ` · ${T('{c} 수사 완료', { c: esc(change.from) })}` : ''}</small>
        <h2>${T('새로운 대륙 <b>[{c}]</b>로 이동합니다!', { c: esc(change.to) })}</h2>
        ${ep ? `<p class="ct-ep">EP${ep.no} · ${esc(ep.title)}</p>` : ''}
        <ol class="ct-route">${chapters.map((c, i) =>
          `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"><i></i><span>${esc(c.continent)}</span></li>`).join('')}</ol>
      </div>`;
    TP.ui.root().append(fx);
    TP.audio?.sfx?.('chapter');
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1600 : CHAPTER_MS;
    return new Promise(resolve => {
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        fx.classList.add('out');
        TP.audio?.stopTransitionSounds?.({ fadeMs: 450 });   // 연출이 닫히는 순간(언마운트) 비행기 소리도 함께 페이드아웃
        setTimeout(() => { fx.remove(); resolve(); }, 450);
      };
      fx.addEventListener('click', close);
      setTimeout(close, ms);
    });
  }
  TP.playChapterTransition = playChapterTransition;   // 개발자 패널 · 테스트용

  // 화면 전환: 'lobby' | 'game' (16:9 스테이지 안에서 교체)
  //   오디오: 화면이 바뀌면(라우팅 변경) 전환용 효과음을 끊고, 로비에 들어오면 홈 오디오 상태로 초기화
  function showScreen(name) {
    const prev = $('#stage').dataset.screen;
    $('#stage').dataset.screen = name;
    if (prev !== name) TP.audio?.stopTransitionSounds?.();
    if (name === 'lobby') {
      TP.audio?.enterLobby?.();
      setMultiplierMood(1);
      renderLobby();
    }
  }

  function setMultiplierMood(x) {
    document.body.dataset.mult = x;
    $('#hudMult').textContent = `×${x}`;
  }

  // =====================================================================
  // 연승 미터 (클리어 창·입장 창에서 사용)
  // =====================================================================
  // 보상 마일스톤 3 · 5 · 10 · 15 · 20연승(🎁) + 버프만 있는 7연승(⚡) + 현재 버프 + 다음 보상
  function streakMeterHtml(streak) {
    const nextGift = TP.nextStreakMilestone(streak);
    const nextBuff = TP.nextStreakTier(streak);
    const buffs = TP.describeBuffs(TP.streakBuffs(streak));
    const pips = TP.STREAK_TIERS.map(t =>
      `<span class="pip ${streak >= t.at ? 'on' : ''} ${t.reward ? 'gift' : 'buff'}">${t.reward ? `<img src="${TP.ASSETS.iconGift}" alt="">` : '⚡'}<small>${t.at}</small></span>`).join('');
    return `
      <div class="streak-meter">
        <div class="streak-title">🔥 ${T('<b>{n}</b>연승', { n: streak })}${streak >= TP.STREAK.CAP ? T(' · 최고 단계') : ''}</div>
        <div class="pips">${pips}</div>
        ${buffs ? `<div class="streak-buffs">${T('⚡ 자동 장착 버프: {b}', { b: buffs })}</div>` : ''}
        <div class="streak-next">${nextGift
          ? T('🎁 {at}연승까지 <b>{left}승</b> → {r}', { at: nextGift.at, left: nextGift.at - streak, r: TP.describeStreakReward(nextGift.reward) })
          : T('최고 단계 버프 유지 중 (20연승 이후 추가 보상 없음)')}${nextBuff && nextBuff.at !== (nextGift && nextGift.at)
          ? `<br>${T('⚡ {at}연승 버프: {b}', { at: nextBuff.at, b: TP.describeBuffs(nextBuff.buffs) })}` : ''}</div>
      </div>`;
  }

  // =====================================================================
  // 입장 모달 (난이도·레이아웃 정보 + 배수 선택)
  // =====================================================================
  let pending = null;   // { deal, tier, stage }
  let selectedX = store.state.selectedMultiplier;
  // 배수별 입장료·보상 범위·해금 — 홈·성장 모듈의 Play 버튼 모델 (레벨 구간이 오르면 함께 오른다)
  const multOptions = () => TP.home.uiModel().rightControls.playButton.multiplierOptions;
  const multOption = x => multOptions().find(o => o.multiplier === x);

  // 기본은 현재 에피소드의 다음 스테이지(스테이지마다 고정된 판).
  // 재도전은 { seed, tierId, stage }를 그대로 넘긴다. 이미 단서를 받은 스테이지는 골드만 준다.
  //   episodeId 를 주면 그 사건의 스테이지 (스테이지 선택 화면 · 지난 사건 다시하기)
  function openEntry({ seed, tierId, stage, episodeId } = {}) {
    // 20개 단서가 다 모였으면 스테이지 대신 범인 지목부터 (스테이지를 직접 고른 경우는 다시하기 허용)
    if (!stage && mystery.isAccusationPhase()) {
      notebook.open();
      return;
    }
    const s = store.state;
    const ep = (episodeId && TP.findEpisode(episodeId)) || mystery.episode;
    stage ??= mystery.nextStage();
    seed ??= ep && stage ? TP.stageSeed(ep.episodeId, stage) : randomSeed();
    const tier = tierId ? TP.getTier(tierId) : TP.tierForLevel(s.playerLevel);
    pending = { deal: TP.generateDeal({ seed, tierId: tier.id }), tier, stage, ep };
    const m = multOption(selectedX);
    if (!m || !m.unlocked) selectedX = 1;
    renderEntry();
    openModal($('#entryModal'));
  }

  const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3 6.5 7.1.8-5.3 4.8 1.5 7L12 17.3l-6.3 3.6 1.5-7L1.9 9.1 9 8.3z"/></svg>';
  function renderEntry() {
    if (!pending) return;
    const s = store.state;
    const { deal, tier, stage, ep } = pending;
    const isCurrent = ep && mystery.episode && ep.episodeId === mystery.episode.episodeId;

    $('#entryTitle').textContent = ep && stage ? `STAGE ${stage}/${ep.clues.length}` : 'FREE PLAY';
    $('#entryTier').textContent = tier.id.toUpperCase();
    $('#entryTier').className = `ev2-tier tier-${tier.id}`;
    $('#entrySeed').textContent = deal.seed;
    const clueNote = !ep || !stage ? ''
      : !isCurrent ? T('해결한 사건 다시하기')
      : stage <= s.episode.cleared ? T('단서 획득 완료 · 골드 · 별만')
      : T('🔍 클리어하면 단서 #{n}', { n: stage });
    const best = ep && stage ? (s.stageStars[ep.episodeId]?.[stage] || 0) : 0;
    const epStars = ep ? Object.values(s.stageStars[ep.episodeId] || {}).reduce((a, b) => a + b, 0) : 0;
    $('#entryStars').innerHTML = ep && stage ? `
      <span class="es-line">
        ${clueNote ? `<span class="es-clue">${clueNote}</span>` : ''}
        <span class="es-best" aria-label="${T('최고 기록 별 {n}개', { n: best })}">${[1, 2, 3].map(i => `<i class="${i <= best ? 'on' : ''}">${STAR_SVG}</i>`).join('')}</span>
        <span class="es-total">${T('이 사건')} <b>★</b> ${epStars}/${ep.clues.length * 3}</span>
      </span>
      <span class="es-rule">${starRuleHtml(TP.starTarget(deal))}</span>` : '';

    // 배수 카드: 선택 = 금색 카드 · 해금 = 파란 카드 · 잠김 = 사슬 카드 (×4 잠김은 더 어둡게)
    const A = 'game_assets/';
    const opts = multOptions();
    $('#multList').replaceChildren(...opts.map(o => {
      const locked = !o.unlocked;
      const selected = o.multiplier === selectedX && !locked;
      const poor = s.gold < o.cost;
      const btn = document.createElement('button');
      btn.className = `mult-opt x${o.multiplier}` + (selected ? ' selected' : '') + (locked ? ' locked' : '');
      btn.disabled = locked;
      btn.innerHTML = `
        <img class="mult-bg" src="${A}${selected ? 'card_mult_gold' : locked ? 'card_mult_locked' : 'card_mult_blue'}.webp" alt="">
        <span class="mult-x">×${o.multiplier}</span>
        <span class="mult-fee"><img src="${A}icon_gold.webp" alt="${T('골드')}">${o.cost.toLocaleString()}</span>
        <span class="mult-reward">${T('보상 {a}~{b}', { a: o.rewardMin.toLocaleString(), b: o.rewardMax.toLocaleString() })}</span>
        ${locked ? `<span class="mult-lock">${T('LV.{n} 해제', { n: o.unlockLevel })}</span>`
          : poor ? `<span class="mult-lock poor">${T('골드 부족')}</span>` : ''}`;
      btn.onclick = () => selectMult(o.multiplier);
      return btn;
    }));

    const m = opts.find(o => o.multiplier === selectedX);
    const poor = s.gold < m.cost;
    const card = $('#entryCard');
    card.classList.toggle('x2', selectedX === 2);
    card.classList.toggle('x4', selectedX === 4);

    const st = energy.status();
    const noEnergy = !energy.canPlay();
    entryCanPlay = !noEnergy;
    const go = $('#entryGo');
    go.className = 'ev2-play' + (selectedX === 4 && !poor && !noEnergy ? ' hot' : '') + (noEnergy || poor ? ' blocked' : '');
    // '하트 충전' · '골드 충전' 은 Luckiest Guy 풍 글씨 그림 (txt_heart_charge / txt_gold_charge.webp, Higgsfield)
    const goLabel = $('#entryGoLabel');
    goLabel.classList.toggle('txt-img', noEnergy || poor);
    goLabel.innerHTML = noEnergy ? `<img src="${TP.i18n ? TP.i18n.img(A + 'txt_heart_charge.webp') : A + 'txt_heart_charge.webp'}" alt="${T('하트 충전')}">`
      : poor ? `<img src="${TP.i18n ? TP.i18n.img(A + 'txt_gold_charge.webp') : A + 'txt_gold_charge.webp'}" alt="${T('골드 충전')}">` : 'PLAY';
    // PLAY 말풍선: 입장 비용 (골드 × 배수 입장료 + 하트 1 — 무한 하트면 하트 생략)
    $('#entryCost').innerHTML = `<img src="${A}icon_gold.webp" alt="${T('골드')}"><b>×${m.cost.toLocaleString()}</b>${st.infinite ? '' : `<i>+</i><span class="ev2-heart"><img src="${A}icon_heart.webp" alt="${T('하트')}"><b>1</b></span>`}`;

    $('#entryCancel').textContent = 'BACK';
    $('#entryNote').textContent =
      activeRun() ? T('새로 입장하면 진행 중인 판은 실패 처리돼요{s}.', { s: s.winStreak ? T(' (🔥 {n}연승 초기화)', { n: s.winStreak }) : '' })
      : noEnergy ? T('❤️ 하트가 없어요 · 다음 충전까지 {t}', { t: TP.formatDuration(st.nextInMs) })
      : selectedX === 4 ? T('하이리스크 하이리턴! 클리어하면 보상이 4배예요.')
      : '';
  }

  function selectMult(x) {
    const changed = x !== selectedX;
    if (!TP.home.selectMultiplier(x).ok) return;   // 해금 확인 + 마지막 배수 저장
    selectedX = x;
    renderEntry();
    if (x === 4 && changed) {
      confettiAt($('.mult-opt.x4'), { colors: ['#ff3cac', '#ffcf5a', '#2bd2ff'], particleCount: 90 });
    }
  }

  // 입장 모달: 하트가 생기거나 떨어지면 다시 그림 (1초마다 확인)
  let entryCanPlay = null;
  function renderEntryEnergy() {
    if (energy.canPlay() !== entryCanPlay || !energy.canPlay()) renderEntry();
  }

  $('#entryGo').onclick = () => {
    const m = multOption(selectedX);
    if (!energy.canPlay()) {
      openEnergyPanel();
      return;
    }
    if (store.state.gold < m.cost) {
      noGoldPopup(m);
      return;
    }
    if (activeRun()) failRun();
    // 홈·성장 모듈: 하트 1칸(무한 하트 중이면 0) + (레벨 구간 입장료 × 배수) 차감, 세이브 안 한 끊긴 연승 소멸
    const bet = TP.home.startStageWithBet(selectedX);
    if (!bet.ok) {
      if (bet.reason === 'NO_LIFE_REMAINING') openEnergyPanel();
      else if (bet.reason === 'INSUFFICIENT_GOLD') noGoldPopup(multOption(selectedX));
      else toast(bet.reason === 'LEVEL_TOO_LOW' ? T('🔒 Lv.{n}에 해금돼요', { n: bet.requiredLevel }) : T('입장할 수 없어요'));
      return;
    }
    const { deal, tier, stage, ep } = pending;
    const buffs = TP.streakBuffs(store.state.winStreak);
    run = {
      seed: deal.seed, tierId: tier.id, stage, mult: bet.multiplier, fee: bet.entryCostPaid, energySpent: bet.lifeSpent, finished: false,
      continued: false, starTarget: TP.starTarget(deal), episodeId: ep ? ep.episodeId : null,
      // 연승 버프 (이번 판에만 유효, 인벤토리보다 먼저 사용)
      freeUndo: buffs.freeUndo, freeWild: buffs.freeWild, comboBoost: buffs.comboBoost, wildSources: [],
    };
    closeModal($('#entryModal'), { silent: true });
    TP.audio.sfx('start');                       // game_start.ogg (이어서 카드 깔기 setting_cards.ogg)
    playTransition();
    showScreen('game');
    setMultiplierMood(run.mult);
    $('#hudTier').innerHTML = tierBadge(tier);
    view.start(deal);
    if (buffs.extraCards) view.addCards(buffs.extraCards);
    saveRunState();
    const buffText = TP.describeBuffs(buffs);
    toast(`${T('입장료 🪙 -{fee} (×{m})', { fee: run.fee, m: run.mult })}${buffText ? `<br><small>${T('🔥 연승 버프 장착: {b}', { b: buffText })}</small>` : ''}`);
    refreshItemButtons();
    if (run.mult === 4) setTimeout(() => bigCelebration(2), 100);
  };

  // 판돈(입장료)이 모자라면 시작할 수 없다 — 낮은 배수로 바꾸거나 상점으로
  async function noGoldPopup(m) {
    const have = store.state.gold;
    const lower = multOptions().filter(o => o.unlocked && o.multiplier < m.multiplier && o.cost <= have).pop();
    const choice = await showDialog({
      title: T('골드가 부족해요'),
      className: 'no-gold',
      body: `
        <p>${T('×{m} 판돈을 낼 골드가 부족해서 시작할 수 없어요.', { m: m.multiplier })}</p>
        <div class="ng-row"><span>${T('필요')}</span><b>🪙 ${m.cost.toLocaleString()}</b><span>${T('보유')}</span><b class="have">🪙 ${have.toLocaleString()}</b></div>`,
      buttons: [
        ...(lower ? [{ label: T('×{m}로 바꾸기 · 🪙 {c}', { m: lower.multiplier, c: lower.cost }), value: 'lower' }] : []),
        { label: T('🛒 상점에서 골드 충전'), value: 'shop', cls: 'primary' },
        { label: T('닫기'), value: 'close', cls: 'ghost' },
      ],
    });
    if (choice === 'shop') openShop({ tab: 'coin' });
    else if (choice === 'lower') selectMult(lower.multiplier);
  }

  $('#entryCancel').onclick = () => {
    closeModal($('#entryModal'));
    if (!activeRun()) showScreen('lobby');
  };

  // =====================================================================
  // 판 종료: 클리어 정산 / 이어하기 유도 / 실패
  // =====================================================================
  const isCurrentRun = () => !run.episodeId || (mystery.episode && run.episodeId === mystery.episode.episodeId);

  // ---- 튕김 대비: 수마다 판 상태를 저장 (재접속하면 그대로 이어하기) ----
  let lastSavedRun = '';
  function saveRunState() {
    if (!activeRun()) return;
    const saved = {
      seed: run.seed, tierId: run.tierId, stage: run.stage, mult: run.mult, fee: run.fee, energySpent: run.energySpent,
      continued: run.continued, starTarget: run.starTarget, episodeId: run.episodeId,
      buffs: { freeUndo: run.freeUndo, freeWild: run.freeWild, comboBoost: run.comboBoost, wildSources: run.wildSources },
      state: view.game.serialize(),
    };
    const json = JSON.stringify(saved);
    if (json === lastSavedRun) return;
    lastSavedRun = json;
    store.update(s => { s.activeRun = saved; });
  }

  // 재접속 때 저장된 판으로 돌아가기. 실패하면 false (상태가 없거나 판이 바뀐 경우)
  function resumeRun(saved) {
    try {
      const tier = TP.getTier(saved.tierId);
      const deal = TP.generateDeal({ seed: saved.seed, tierId: tier.id });
      run = {
        seed: saved.seed, tierId: tier.id, stage: saved.stage, mult: saved.mult, fee: saved.fee, energySpent: saved.energySpent, finished: false,
        continued: !!saved.continued, starTarget: saved.starTarget || TP.starTarget(deal),
        episodeId: saved.episodeId || (mystery.episode ? mystery.episode.episodeId : null),
        freeUndo: 0, freeWild: 0, comboBoost: 0, wildSources: [], ...(saved.buffs || {}),
      };
      showScreen('game');
      setMultiplierMood(run.mult);
      $('#hudTier').innerHTML = tierBadge(tier);
      view.start(deal, saved.state);
      lastSavedRun = '';
      refreshItemButtons();
      saveRunState();
      if (view.game.status !== 'playing') setTimeout(() => handleEnd({ status: view.game.status, stockLeft: view.game.stockCount, bestCombo: view.game.bestCombo }), 600);
      return true;
    } catch (e) {
      run = null;
      showScreen('lobby');
      return false;
    }
  }

  function handleEnd(e) {
    if (!activeRun()) return;
    if (e.status === 'won') settleWin(e);
    else offerContinue();
  }

  async function settleWin(e) {
    run.finished = true;
    const before = store.state;
    // 홈·성장 모듈 정산: 레벨 구간 보상 골드 × 배수 · EXP/레벨업 · 단서 해금 · 연승 마일스톤 보상
    const r = TP.home.recordStageResult({
      won: true,
      remainingStockCards: e.stockLeft,
      maxStreak: e.bestCombo,
      multiplier: run.mult,
      comboBoost: run.comboBoost,   // 연승 버프 '콤보 배율'
      // 다음 스테이지를 처음 깼을 때만 단서 — 지난 사건 다시하기는 stage 를 넘기지 않아 단서 · 연승 없음
      stage: isCurrentRun() ? run.stage : undefined,
    });
    // 별 등급 (스테이지 최고 기록만 저장)
    const stars = TP.stageStars({ stockLeft: e.stockLeft, continued: run.continued, target: run.starTarget });
    const epId = run.episodeId && run.stage ? run.episodeId : null;
    const prevStars = epId ? (store.state.stageStars[epId]?.[run.stage] || 0) : 0;
    store.update(s => {
      s.activeRun = null;
      if (epId && stars > prevStars) (s.stageStars[epId] ??= {})[run.stage] = stars;
    });
    const after = store.state;
    const streak = after.winStreak;
    const streakReward = r.streakRewardClaimed;   // { streak, gold, undo, wild, life, label } | null
    // 결과 화면에 보이는 골드는 이 값 하나로만 그린다 (클리어 화면 ×N · 결과 모달 +N · 순이익).
    //   = 실제로 지갑에 들어온 골드 (스테이지 보상 + 연승 보상 골드). 따로 계산하던 값이 서로 달라 보이던 문제 수정
    const resultMeta = {
      goldEarned: after.gold - before.gold,
      stageGold: r.goldEarned,
      streakGold: streakReward ? streakReward.gold : 0,
      streakCounted: r.streakCounted !== false,
    };
    bigCelebration(run.mult + (streakReward ? 2 : 0));
    TP.audio.sfx('win');
    // 입장 때 쓴 하트는 클리어해도 돌려주지 않는다 (충전: 자연 충전 · 광고 · 골드 완충 · 무한 하트 팩)

    await view.stockFireworks(e.stockLeft);          // 엔드게임 축포: 남은 덱 카드 수만큼 골드
    await showWinPage(resultMeta.goldEarned);

    // 🔍 단서 획득 (해당 스테이지를 처음 깼을 때만)
    if (r.clue) await notebook.showClueAcquired(r.clue);
    const accusing = mystery.isAccusationPhase();
    const nextStage = mystery.nextStage();

    const unlocked = TP.MULTIPLIERS.find(m => m.minLevel > before.playerLevel && m.minLevel <= after.playerLevel);
    const titleChanged = TP.titleOf(before) !== TP.titleOf(after);
    const oldTier = TP.tierForLevel(before.playerLevel);
    const newTier = TP.tierForLevel(after.playerLevel);
    const feeBefore = TP.entryFee(before.playerLevel);
    const feeAfter = TP.entryFee(after.playerLevel);
    const range = TP.rewardRange(after.playerLevel);

    // 50연승 프레스티지: 카드 뒷면 해제 팝업 (팡파르)
    if (streakReward && streakReward.prestigeResult) await showPrestigeModal(streakReward.prestigeResult);

    // 클리어 화면 (INVESTIGATION SUCCESS 배지 · 획득 골드 + 연승 · 연승 보너스 말풍선 · HOME / REPLAY / NEXT STAGE)
    const notes = [
      r.levelUp.leveledUp && `${T('레벨 업!')} <b>Lv.${r.levelUp.newLevel}</b>${titleChanged ? ` · ${T('새 칭호')} <b>${TP.titleOf(after)}</b>` : ''}`,
      r.levelUp.costumeChanged && `${T('👔 새 코스튬:')} <b>${T(TP.costumeNameOf(after))}</b>`,
      feeAfter > feeBefore && T('📈 레벨 구간 상승 · 입장료 {a}→{b}G · 보상 {min}~{max}G', { a: feeBefore, b: feeAfter, min: range.min, max: range.max }),
      unlocked && T('🔓 ×{x} 배수가 해금됐어요!', { x: unlocked.x }),
      newTier !== oldTier && `${T('다음 판부터 난이도')} ${tierBadge(newTier)}`,
      !resultMeta.streakCounted && T('🔁 이미 단서를 받은 스테이지라 연승은 그대로예요'),
    ].filter(Boolean);
    const choice = await showResultScreen({
      gold: resultMeta.goldEarned,
      exp: r.expEarned,
      stars, newBest: !!epId && prevStars > 0 && stars > prevStars, starTarget: run.starTarget,
      base: r.baseReward,
      mult: run.mult,
      streakGold: resultMeta.streakGold,
      streak: resultMeta.streakCounted ? streak || (streakReward ? streakReward.streak : 0) : 0,
      streakReward,
      notes,
      accusing,
    });
    // 전면 광고 (js/ad-manager.js: 누적 클리어 5판까지 없음 · 그 뒤 2판마다 · 광고 제거 구매 시 영구 생략)
    await TP.ads.maybeShowInterstitial('clear');
    if (choice === 'accuse') notebook.open();
    else if (choice === 'lobby') showScreen('lobby');
    else if (choice === 'retry') openEntry({ seed: run.seed, tierId: run.tierId, stage: run.stage, episodeId: run.episodeId });
    else if (!isCurrentRun() && run.episodeId && run.stage < 20) openEntry({ stage: run.stage + 1, episodeId: run.episodeId });   // 지난 사건: 그 사건의 다음 스테이지
    else openEntry({});
  }

  // =====================================================================
  // 클리어 결과 화면 (기획 이미지: 파란 패널 + INVESTIGATION SUCCESS 배지 + 골드/연승 + BONUS 말풍선 + 버튼 3개)
  //   그림: popup_stage_clear.webp(배지) · derived/frame_result.webp(파란 패널, 고양이 모서리) · icon_gold.webp
  //         btn_home / btn_replay / btn_nextstage (주황 라벨) · icon_home / icon_replay / icon_play (동그란 아이콘)
  //   지목 단계(단서 20개)면 오른쪽 버튼이 [CONTINUE → 범인 지목]
  //   반환: 'lobby' | 'retry' | 'next' | 'accuse'
  // =====================================================================
  // =====================================================================
  // 50연승 프레스티지 보상 팝업: 팡파르 + 새 카드 뒷면을 크게
  //   result: TP.cardBacks.grantPrestige() 결과 { type:'cardBack', back } | { type:'fallback', reward }
  // =====================================================================
  function showPrestigeModal(result) {
    const isBack = result.type === 'cardBack';
    const page = document.createElement('div');
    page.className = 'prestige-screen';
    page.style.zIndex = 98700;
    page.innerHTML = `
      <div class="ps-rays" aria-hidden="true"></div>
      <div class="ps-body" role="dialog" aria-modal="true" aria-label="${T('50연승 프레스티지 보상')}">
        <h2 class="ps-title">50 WIN STREAK ACHIEVED!</h2>
        <p class="ps-sub">${isBack ? 'NEW CARD BACK UNLOCKED!' : 'ALL CARD BACKS COLLECTED!'}</p>
        ${isBack
          ? `<div class="ps-card"><img src="${result.back.src}" alt="${result.back.name}"></div>
             <p class="ps-name">${T('새 카드 뒷면: <b>{name}</b> ({a}/{b}) · 바로 장착했어요', { name: result.back.name, a: TP.cardBacks.owned().length, b: TP.CARD_BACKS.length })}</p>`
          : `<div class="ps-fallback">${TP.describeStreakReward(result.reward)}</div>
             <p class="ps-name">${T('카드 뒷면 {n}종을 모두 모아 대체 보상을 받았어요!', { n: TP.CARD_BACKS.length })}</p>`}
        <button class="ps-ok" data-nosfx aria-label="${T('확인')}"><img src="game_assets/btn_collect.webp" alt=""></button>
        <p class="ps-reset">${T('🔥 연승이 0부터 다시 시작돼요. 다음 50연승에 도전!')}</p>
      </div>`;
    TP.ui.root().append(page);
    TP.audio.sfx('success');
    bigCelebration(4);
    setTimeout(() => bigCelebration(4), 700);
    return new Promise(resolve => {
      page.querySelector('.ps-ok').onclick = () => {
        TP.audio.sfx('collect');
        page.classList.add('out');
        setTimeout(() => { page.remove(); resolve(); }, 250);
      };
    });
  }
  TP.showPrestigeModal = showPrestigeModal;   // 개발자 확인용

  TP.showResultScreen = (...args) => showResultScreen(...args);   // 개발자 확인용
  function showResultScreen({ gold, exp = 0, stars = 0, newBest = false, starTarget = 1, base = 0, mult = 1, streakGold = 0, streak, streakReward, notes = [], accusing }) {
    const A = 'game_assets/';
    const bonusParts = streakReward ? [
      streakReward.life && `<img src="${A}icon_heart.webp" alt="${T('하트')}"><b>+${streakReward.life}</b>`,
      streakReward.hint && `<img src="${A}icon_hint_ticket.webp" alt="${T('힌트권')}"><b>+${streakReward.hint}</b>`,
      streakReward.gold && `<img src="${A}icon_gold.webp" alt="${T('골드')}"><b>+${streakReward.gold}</b>`,
      streakReward.undo && `<img src="${A}btn_booster_undo.webp" alt="${T('되돌리기')}"><b>+${streakReward.undo}</b>`,
      streakReward.wild && `<img src="${A}card_wild.webp" alt="${T('와일드')}"><b>+${streakReward.wild}</b>`,
      streakReward.prestigeResult?.type === 'cardBack' && `<img class="rs-back" src="${streakReward.prestigeResult.back.src}" alt="${T('카드 뒷면')}"><b>NEW</b>`,
    ].filter(Boolean) : [];
    const tiles = [
      { value: 'lobby', cls: 'red', icon: 'icon_home', label: 'btn_home', alt: T('홈') },
      { value: 'retry', cls: 'orange', icon: 'icon_replay', label: 'btn_replay', alt: T('같은 판 다시') },
      accusing
        ? { value: 'accuse', cls: 'green hot', icon: 'icon_play', label: 'btn_continue', alt: T('범인 지목하러 가기'), caption: T('범인 지목!') }
        : { value: 'next', cls: 'green', icon: 'icon_play', label: 'btn_nextstage', alt: T('다음 스테이지') },
    ];
    const page = document.createElement('div');
    page.className = 'result-screen';
    page.style.zIndex = 98500;
    page.innerHTML = `
      <div class="rs-panel" role="dialog" aria-modal="true" aria-label="${T('스테이지 클리어')}">
        <img class="rs-badge" src="${TP.ASSETS.popupStageClear}" alt="INVESTIGATION SUCCESS!">
        ${bonusParts.length ? `<div class="rs-bonus"><small>BONUS</small><span>${bonusParts.join('')}</span></div>` : ''}
        <div class="rs-gold">
          <img src="${A}icon_gold.webp" alt="${T('골드')}">
          <b data-roll="${gold}">+0</b>${streak ? `<i>+</i><b class="rs-streak">${T('{n}연승!', { n: streak })}</b>` : ''}
        </div>
        ${stars ? `<div class="rs-stars" data-no-icons aria-label="${T('별 {n}개', { n: stars })}" title="${T('★ 통과 · ★★ 이어하기 없이 통과 · ★★★ 이어하기 없이 덱 {n}장 이상 남기고 통과', { n: starTarget })}">
          ${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="--d:${i}">${STAR_SVG}</i>`).join('')}${newBest ? '<b>NEW BEST!</b>' : ''}
        </div>` : ''}
        ${base || exp ? `<div class="rs-sub">
          ${base ? `<p class="rs-calc">${T('기본 보상')} <b>${base}</b> × <b class="x${mult}">${T('{n}배', { n: mult })}</b>${streakGold ? ` + ${T('연승 보너스')} <b>${streakGold}</b>` : ''}</p>` : ''}
          ${exp ? `<div class="rs-exp"><span>EXP</span><b data-roll="${exp}">+0</b></div>` : ''}
        </div>` : ''}
        ${notes.length ? `<div class="rs-notes">${notes.map(n => `<p>${n}</p>`).join('')}</div>` : ''}
        <div class="rs-actions">${tiles.map(t => `
          <button class="rs-tile ${t.cls}" data-value="${t.value}" data-nosfx aria-label="${t.alt}">
            <img class="rs-icon" src="${A}${t.icon}.webp" alt="">
            <img class="rs-label" src="${A}${t.label}.webp" alt="">
            ${t.caption ? `<small>${t.caption}</small>` : ''}
          </button>`).join('')}</div>
      </div>`;
    TP.ui.root().append(page);
    TP.audio.sfx('popup');
    rollNumbers(page);
    return new Promise(resolve => {
      page.querySelectorAll('.rs-tile').forEach(btn => {
        btn.onclick = () => {
          const v = btn.dataset.value;
          TP.audio.sfx(v === 'next' || v === 'accuse' ? 'nextStage' : 'click');
          page.classList.add('out');
          setTimeout(() => { page.remove(); resolve(v); }, 220);
        };
      });
    });
  }

  // 숫자 롤링: [data-roll] 요소를 0 → 목표값까지 올린다 (ease-out, 골드 먼저 · EXP 이어서)
  function rollNumbers(root, { delay = 350, dur = 900 } = {}) {
    const els = [...root.querySelectorAll('[data-roll]')];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.forEach((el, i) => {
      const to = Number(el.dataset.roll) || 0;
      const show = v => { el.textContent = `+${v.toLocaleString()}`; };
      if (reduce || !to) return show(to);
      setTimeout(() => {
        const t0 = performance.now();
        let last = -1;
        const step = now => {
          const p = Math.min(1, (now - t0) / dur);
          const v = Math.round(to * (1 - (1 - p) ** 3));
          show(v);
          const tick = Math.floor(p * 12);
          if (tick !== last) { last = tick; TP.audio.sfx('tick'); }
          if (p < 1 && el.isConnected) requestAnimationFrame(step);
          else { el.classList.add('done'); if (i === 0) TP.audio.sfx('coin'); }
        };
        requestAnimationFrame(step);
      }, delay + i * (dur * 0.6));
    });
  }

  // 실패 결과창: 골드 보상 없음 (입장료만 소진) · 하트는 입장 때 이미 썼으므로 [로비로] / [재도전]만
  //   연승이 끊겼으면 500G 연승 세이브를 작은 버튼으로 함께 (다음 입장 전까지만 가능)
  //   반환: 'lobby' | 'retry' | 'save'
  TP.showFailScreen = (...args) => showFailScreen(...args);   // 개발자 확인용
  function showFailScreen({ fee, mult, lostStreak, deal }) {
    const A = 'game_assets/';
    const cost = TP.STREAK.SAVE_COST;
    const page = document.createElement('div');
    page.className = 'result-screen fail';
    page.style.zIndex = 98500;
    page.innerHTML = `
      <div class="rs-panel" role="dialog" aria-modal="true" aria-label="${T('스테이지 실패')}">
        <h2 class="rs-fail-title">STAGE FAILED</h2>
        <div class="rs-gold">
          <img src="${A}icon_gold.webp" alt="${T('골드')}">
          <b>+0</b>
        </div>
        <p class="rs-calc">${T('입장료 <b>{fee}</b> 골드(×{m})가 소진됐어요', { fee: fee.toLocaleString(), m: mult })}</p>
        ${lostStreak ? `<p class="rs-calc lost">${T('🔥 {n}연승이 끊겼어요', { n: lostStreak })}</p>
          <button class="rs-save" data-value="save">${T('🔥 🪙 {c}으로 {n}연승 지키기', { c: cost, n: lostStreak })}</button>` : ''}
        <p class="rs-tip">${T('✅ 이 판은 반드시 깰 수 있는 판이에요.')} ${deal && deal.solution ? `<button class="rs-solution" data-solution>${T('🔍 정답 수순 보기')}</button>` : T('다시 도전해 보세요!')}</p>
        <div class="rs-actions two">
          <button class="rs-tile red" data-value="lobby" data-nosfx aria-label="${T('로비로 가기')}">
            <img class="rs-icon" src="${A}icon_home.webp" alt="">
            <img class="rs-label" src="${A}btn_home.webp" alt="">
          </button>
          <button class="rs-tile orange hot" data-value="retry" data-nosfx aria-label="${T('재도전')}">
            <img class="rs-icon" src="${A}icon_replay.webp" alt="">
            <img class="rs-label" src="${A}btn_replay.webp" alt="">
          </button>
        </div>
      </div>`;
    TP.ui.root().append(page);
    const solBtn = page.querySelector('[data-solution]');
    if (solBtn) solBtn.onclick = async () => {
      TP.audio.sfx('click');
      page.hidden = true;
      await showSolution(deal);
      page.hidden = false;
    };
    return new Promise(resolve => {
      page.querySelectorAll('[data-value]').forEach(btn => {
        btn.onclick = () => {
          TP.audio.sfx('click');
          page.classList.add('out');
          setTimeout(() => { page.remove(); resolve(btn.dataset.value); }, 220);
        };
      });
    });
  }

  // 정답 수순 보기: 생성기가 만든 '반드시 깰 수 있는' 수순을 카드로 보여 준다
  //   처음 SOLUTION_FREE_STEPS 수는 무료, 나머지는 보상형 광고 1번 (같은 판은 다시 안 봐도 됨)
  const SOLUTION_FREE_STEPS = 6;
  const solutionUnlocked = new Set();
  const RANK_TEXT = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const cardChip = c => c.special
    ? `<span class="sol-card special">${c.special === 'wild' ? '★' : '+1'}</span>`
    : `<span class="sol-card ${c.suit === '♥' || c.suit === '♦' ? 'red' : ''}">${RANK_TEXT[c.rank] || c.rank}${c.suit}</span>`;
  async function showSolution(deal) {
    let drawIdx = 0;
    const steps = deal.solution.map(m => (m.type === 'draw'
      ? `<li class="sol-step draw"><small>${T('덱')}</small>${cardChip(deal.pile[drawIdx++])}</li>`
      : `<li class="sol-step"><small>${T('보드')}</small>${cardChip(deal.board[m.slot])}</li>`));
    for (;;) {
      const all = solutionUnlocked.has(deal.seed);
      const shown = all ? steps : steps.slice(0, SOLUTION_FREE_STEPS);
      const choice = await showDialog({
        title: T('정답 수순'),
        className: 'solution',
        body: `
          <p class="small">${T('시작 카드 {card} 에서 출발해 이 순서대로 내면 반드시 클리어돼요. (총 {n}수)', { card: cardChip(deal.startCard), n: steps.length })}</p>
          <ol class="sol-list">${shown.join('')}${all ? '' : `<li class="sol-more">… ${T('{n}수 더', { n: steps.length - shown.length })}</li>`}</ol>`,
        buttons: [
          ...(all ? [] : [{ label: T('📺 광고 보고 전체 수순 보기'), value: 'ad', cls: 'primary' }]),
          { label: T('닫기'), value: 'close', cls: all ? 'primary' : 'ghost' },
        ],
      });
      if (choice !== 'ad') return;
      if (await TP.ads.showRewarded('solution')) solutionUnlocked.add(deal.seed);
    }
  }
  TP.showSolution = deal => showSolution(deal || view.deal);   // 개발자 확인용

  // 클리어 화면 (ui_win_page.webp): 그림의 "x200" 자리에 실제 획득 골드, COLLECT를 누르면 다음으로
  function showWinPage(gold) {
    return new Promise(resolve => {
      const page = document.createElement('div');
      page.className = 'win-page';
      page.style.zIndex = 98000;
      page.innerHTML = `
        <img class="win-bg" src="${TP.ASSETS.uiWinPage}" alt="">
        <span class="win-amount">+${gold.toLocaleString()}</span>
        <button class="win-collect" aria-label="${T('보상 받기 (COLLECT)')}"></button>`;
      const done = () => {
        page.classList.add('out');
        setTimeout(() => { page.remove(); resolve(); }, 250);
      };
      page.querySelector('.win-collect').onclick = () => { TP.audio.sfx('collect'); done(); };
      TP.ui.root().append(page);
      TP.audio.sfx('success');                    // Congrats! 화면
    });
  }

  // 스테이지 입장 전환 (ui_screen_transition1.webp: 카메라 찰칵)
  function playTransition() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fx = document.createElement('div');
    fx.className = 'screen-transition';
    fx.style.zIndex = 97000;
    fx.innerHTML = `<img src="${TP.ASSETS.uiTransition}" alt="">`;
    TP.ui.root().append(fx);
    setTimeout(() => fx.remove(), 900);
  }

  // 덱이 바닥나고 낼 카드도 없을 때: 바로 게임 오버 대신 이어하기 제안
  async function offerContinue() {
    const s = store.state;
    const { cost, cards } = TP.CONTINUE_OFFER;
    const loss = s.winStreak ? T('입장료 {fee} 골드와 🔥 {n}연승이', { fee: run.fee, n: s.winStreak }) : T('입장료 {fee} 골드가', { fee: run.fee });
    const choice = await showDialog({
      title: T('카드가 부족합니다!'),
      className: 'continue',
      body: `
        <p class="continue-q">${T('계속하시겠습니까?')}</p>
        <div class="remaining-big">${T('남은 카드 <b>{n}</b>장', { n: view.game.remaining })}</div>
        <p class="small">${T('지금 포기하면 {loss} 사라져요.', { loss })}</p>`,
      buttons: [
        { label: `<img class="btn-card" src="${TP.plusCardImage(cards)}" alt="">${T('🪙 {c} 지불하고 +{n}장 뽑기', { c: cost, n: cards })} <small>${s.gold < cost ? T('(골드 부족)') : T('(첫 장은 바로 낼 수 있는 카드)')}</small>`, value: 'buy', cls: 'primary hot' },
        ...(view.game.canGrantAdCards()
          ? [{ label: `<img class="btn-card" src="${TP.plusCardImage(TP.AD_REVIVE_CARDS)}" alt="">${T('📺 광고 보고 +{n}장', { n: TP.AD_REVIVE_CARDS })} <small>${T('(판당 1회)')}</small>`, value: 'ad' }] : []),
        { label: `${T('★ 와일드카드 사용하기')} <span class="pill">${s.wildcardCount}</span>`, value: 'wild' },
        { label: `${T('↶ 되돌리기')} <span class="pill">${s.undoCount}</span>`, value: 'undo' },
        { label: T('포기하기'), value: 'giveup', cls: 'ghost' },
      ],
    });
    if (!activeRun()) return;
    if (choice === 'buy') buyContinue();
    else if (choice === 'ad') adRevive();
    else if (choice === 'wild') useWild();
    else if (choice === 'undo') useUndo();
    else giveUp();
  }

  function buyContinue() {
    const { cost, cards } = TP.CONTINUE_OFFER;
    if (!store.spend('gold', cost)) return askShop(T('골드가 없어요'), 'coin');
    view.buyCards(cards);                       // 첫 장은 지금 바로 낼 수 있는 카드 (사도 소용없는 5장 방지)
    run.continued = true;                       // 별 등급: 이어하기를 쓰면 ★1
    TP.audio.sfx('plus');
    toast(`${T('🂠 덱 +{n}장!', { n: cards })} 🪙 -${cost}<br><small>${T('첫 장은 바로 이어서 낼 수 있어요')}</small>`);
  }

  // 보상형 광고 부활: 덱 +3장 (첫 장은 바로 낼 수 있는 구조 카드)
  async function adRevive() {
    if (!(await TP.ads.showRewarded('revive'))) return;   // 끝까지 봤을 때만 덱 +3장
    if (!activeRun()) return;
    if (view.grantAdExtraCards(TP.AD_REVIVE_CARDS)) run.continued = true, TP.audio.sfx('plus'), toast(T('📺 덱 +{n}장! 첫 장은 바로 이어서 낼 수 있어요', { n: TP.AD_REVIVE_CARDS }));
  }

  // 실패 처리: 입장료는 이미 냈으므로 연승만 초기화
  function failRun() {
    run.finished = true;
    TP.audio.sfx('fail');
    store.update(s => { s.activeRun = null; });
    // 홈·성장 모듈: 연승 초기화(끊긴 연승은 500G 세이브용으로 기억) + 위로 EXP 15
    return TP.home.recordStageResult({ won: false, multiplier: run.mult }).lostStreak;
  }

  async function giveUp() {
    const lostStreak = failRun();
    const cost = TP.STREAK.SAVE_COST;
    const choice = await showFailScreen({ fee: run.fee, mult: run.mult, lostStreak, deal: view.deal });
    if (choice === 'save') {
      const r = TP.streak.save();
      if (r.ok) toast(T('🔥 {n}연승을 지켰어요! 🪙 -{c}', { n: r.streak, c: cost }));
      else if (r.reason === 'gold') {
        const go = await TP.ui.confirm({
          title: T('골드가 부족해요'),
          message: T('연승 세이브에 필요한 골드가 부족합니다. (필요: {need} G / 보유: {have} G)\n골드를 충전할 수 있는 상점으로 이동하시겠습니까?', { need: cost, have: store.state.gold }),
          okLabel: T('상점 이동'),
        });
        if (go) {
          await openShop({ tab: 'coin' });
          if (TP.streak.canSave() && TP.streak.save().ok) toast(T('🔥 {n}연승을 지켰어요!', { n: lostStreak }));
        }
      }
      return openEntry({ seed: run.seed, tierId: run.tierId, stage: run.stage, episodeId: run.episodeId });
    }
    if (choice === 'retry') openEntry({ seed: run.seed, tierId: run.tierId, stage: run.stage, episodeId: run.episodeId });
    else showScreen('lobby');
  }

  // 콤보 상자 보상: 보상 아이콘이 와일드 버튼 / 덱에 도착하는 순간 ui.js가 부른다
  //   (덱 카드는 엔진이 이미 반영, 와일드 아이템만 여기서 지급)
  // 콤보 목표 보상 (엔진 'comboReward' 이벤트 { type, value, target }) — 보상 아이콘이 날아가 꽂히는 순간 호출된다
  //   ui.js 연출: wild → 와일드 버튼 · undo → 되돌리기 버튼 (아이템 UI) / plus_cards → 덱(Stock)
  //   덱 +N장은 엔진이 이미 덱에 넣었고, 아이템(와일드 · 되돌리기)은 여기서 인벤토리에 지급한다
  function handleChest({ type, value, target }) {
    confettiAt($('#chest'), { particleCount: 40, spread: 60, colors: ['#ffcf5a', '#ff9f43', '#fff'] });
    if (type === 'wild') {
      store.grant({ wild: value });
      toast(`<img class="toast-card" src="${TP.ASSETS.cardWild}" alt="">${T('🎁 {t}콤보 달성! 와일드카드 +{v}', { t: target, v: value })}`);
    } else if (type === 'undo') {
      store.grant({ undo: value });
      toast(`<img class="toast-card" src="${TP.ASSETS.btnUndo}" alt="">${T('🎁 {t}콤보 달성! 되돌리기 +{v}', { t: target, v: value })}`);
    } else {
      TP.audio.sfx('plus');
      toast(`<img class="toast-card" src="${TP.plusCardImage(value)}" alt="">${T('🎁 {t}콤보 달성! 덱 +{v}장', { t: target, v: value })}`);
    }
  }

  // =====================================================================
  // 인게임 아이템
  // =====================================================================
  async function useUndo() {
    if (!activeRun()) return toast(T('진행 중인 게임이 없어요'));
    if (!view.ready) return;
    if (!run.freeUndo && store.state.undoCount < 1) return askShop(T('되돌리기가 없어요'), 'chance');
    if (!view.game.canUndo()) return toast(T('되돌릴 수 있는 수가 없어요'));
    if (run.freeUndo) run.freeUndo--;      // 연승 버프 무료분부터
    else store.spend('undoCount', 1);
    const move = view.undo();
    if (move?.type === 'wild') {
      // 무료 와일드였으면 무료분으로, 아이템이었으면 인벤토리로 돌려준다
      if (run.wildSources.pop() === 'free') run.freeWild++;
      else store.grant({ wild: 1 });
      toast(T('와일드카드를 돌려받았어요'));
    }
    refreshItemButtons();
  }

  async function useWild() {
    if (!activeRun()) return toast(T('진행 중인 게임이 없어요'));
    if (!view.ready) return;
    if (!run.freeWild && store.state.wildcardCount < 1) return askShop(T('와일드카드가 없어요'), 'chance');
    if (!view.game.canUseWild()) return toast(T('이미 와일드카드가 액티브 카드예요'));
    if (run.freeWild) { run.freeWild--; run.wildSources.push('free'); }
    else { store.spend('wildcardCount', 1); run.wildSources.push('item'); }
    view.useWild();
    refreshItemButtons();
    confettiAt($('#waste'), { particleCount: 40, spread: 50, colors: ['#ffcf5a', '#fff'] });
  }

  async function askShop(itemWithParticle, tab) {
    const ok = await showDialog({
      title: itemWithParticle,
      body: `<p>${T('상점에서 구매할까요?')}</p>`,
      buttons: [
        { label: T('취소'), value: false, cls: 'ghost' },
        { label: T('상점 열기'), value: true, cls: 'primary' },
      ],
    });
    if (ok) await openShop({ tab });
    // 막힌 상태였다면 이어하기 선택지를 다시 보여 준다
    if (activeRun() && view.game.status === 'lost') offerContinue();
  }

  function refreshItemButtons() {
    const s = store.state;
    const g = activeRun() ? view.game : null;
    // 연승 버프 무료분은 초록 배지로 "보유+무료" 표시
    const setBadge = (node, n, free = 0) => {
      node.textContent = free ? `${n}+${free}` : n > 0 ? n : '+';
      node.classList.toggle('zero', n === 0 && !free);
      node.classList.toggle('free', free > 0);
    };
    setBadge($('#badgeUndo'), s.undoCount, g ? run.freeUndo : 0);
    setBadge($('#badgeWild'), s.wildcardCount, g ? run.freeWild : 0);
    $('#btnUndo').classList.toggle('dim', !(g && g.canUndo()));
    $('#btnWild').classList.toggle('dim', !(g && g.canUseWild()));
  }

  $('#btnUndo').onclick = useUndo;
  $('#btnWild').onclick = useWild;

  // =====================================================================
  // 상점 (모달·스페셜 오퍼는 ui-kit.js — 탐정 수첩에서도 같은 상점을 연다)
  // =====================================================================
  function openShop(opts) {
    return TP.ui.openShop(opts);
  }

  $('#sbGoldPlus').onclick = () => openShop({ tab: 'coin' });

  // =====================================================================
  // 수사 생명력 (로직은 energy.js)
  // =====================================================================
  const energy = TP.energy;

  function updateEnergyHud() {
    const life = TP.home.uiModel().rightControls.lifeWidget;   // { current, max, heartsDisplay, timerText, isFull, infinite? }
    const block = $('#sbEnergy');
    block.classList.toggle('infinite', !!life.infinite);
    block.classList.toggle('empty', !life.infinite && life.current < 1);
    $('#sbEnergyNum').textContent = life.infinite ? '∞' : `${life.current}/${life.max}`;
    $('#sbEnergyCells').innerHTML = [...life.heartsDisplay].map(h =>
      `<i class="${life.infinite ? 'on infinite' : h === '♥' ? 'on' : ''}">♥</i>`).join('');
    $('#sbEnergyTimer').textContent = life.infinite || life.isFull ? life.timerText : `(${life.timerText})`;
    if (!$('#entryModal').hidden) renderEntryEnergy();
  }
  setInterval(updateEnergyHud, 1000);
  $('#sbEnergy').onclick = () => openEnergyPanel();

  // 수사 생명력(하트) 팝업 — frame_resume.webp(파란 패널 + 고양이) · 제목 글씨 txt_energy_title.webp (Higgsfield)
  //   왼쪽: 하트 5칸 · 상태(무한 하트 / n/5) · 남은 시간   오른쪽: [골드로 완충] [광고 +1칸] [무한 하트 팩] [닫기]   아래: 규칙 안내
  function energyPage(st, adCheck) {
    const A = 'game_assets/';
    const { MAX, GOLD_REFILL_COST, AD_REFILL_AMOUNT, AD_DAILY_LIMIT } = TP.ENERGY;
    const hearts = Array.from({ length: MAX }, (_, i) =>
      `<img class="${st.infinite ? 'gold' : i < st.energy ? 'on' : 'off'}" src="${A}${st.infinite || i < st.energy ? 'icon_heart' : 'icon_heart_empty'}.webp" alt="">`).join('');
    const timer = st.infinite ? T('무한 하트 남은 시간 {t}', { t: `<b>${TP.formatDuration(st.infiniteLeftMs)}</b>` })
      : st.full ? T('생명력이 가득 찼어요')
      : T('다음 1칸 {a} · 완충까지 {b}', { a: `<b>${TP.formatDuration(st.nextInMs)}</b>`, b: `<b>${TP.formatDuration(st.fullInMs)}</b>` });
    const page = document.createElement('div');
    page.className = 'en-popup';
    page.style.zIndex = 98600;
    page.innerHTML = `
      <div class="en-frame" role="dialog" aria-modal="true" aria-label="${T('수사 생명력')}" data-no-icons>
        <div class="en-head"><img class="en-heart" src="${A}icon_heart.webp" alt=""><img class="en-title" src="${TP.i18n ? TP.i18n.img(A + 'txt_energy_title.webp') : A + 'txt_energy_title.webp'}" alt="${T('수사생명력')}"></div>
        <div class="en-body">
          <div class="en-status">
            <div class="en-hearts">${hearts}</div>
            <p class="en-big">${st.infinite ? `<img src="${A}icon_infinite_heart.webp" alt=""><span>${T('무한 하트')}</span>` : `<b>${st.energy}</b> / ${MAX}`}</p>
            <p class="en-timer">${timer}</p>
          </div>
          <div class="en-actions">
            <button class="en-btn blue" data-v="gold" ${st.full ? 'disabled' : ''}><img src="${A}icon_gold.webp" alt="">${T('{n} 골드로 즉시 완충', { n: GOLD_REFILL_COST })}</button>
            <button class="en-btn blue" data-v="ad" ${adCheck.ok ? '' : 'disabled'}><span class="tv">📺</span>${T('광고 보고 +{n}칸', { n: AD_REFILL_AMOUNT })} <small>${T('(오늘 {a}/{b}회 남음)', { a: st.adsLeftToday, b: AD_DAILY_LIMIT })}</small></button>
            <button class="en-btn green" data-v="shop"><img src="${A}icon_infinite_heart.webp" alt="">${T('무한 하트 팩 보기')}</button>
            <button class="en-btn red" data-v="close">${T('닫기')}</button>
          </div>
          <p class="en-rule">${T('스테이지 입장 시 1칸 소모 (성공해도 돌아오지 않아요) · 20분마다 1칸 충전')}</p>
        </div>
      </div>`;
    TP.ui.root().append(page);
    TP.audio.sfx('popup');
    return new Promise(resolve => {
      page.querySelectorAll('.en-btn').forEach(b => { b.onclick = () => { TP.audio.sfx('click'); page.remove(); resolve(b.dataset.v); }; });
      page.addEventListener('click', e => { if (e.target === page) { page.remove(); resolve('close'); } });
    });
  }

  async function openEnergyPanel() {
    const st = energy.status();
    const { MAX, AD_REFILL_AMOUNT } = TP.ENERGY;
    const adCheck = energy.canRefillWithAd();
    const choice = await energyPage(st, adCheck);
    if (choice === 'gold') {
      const r = energy.refillWithGold();
      if (r.ok) toast(T('❤️ 수사 생명력 완충! 🪙 -{c}', { c: r.cost }));
      else if (r.reason === 'gold') {
        const go = await TP.ui.confirm({
          title: T('골드가 부족해요'),
          message: T('생명력 완충에 필요한 골드가 부족합니다. (필요: {need} G / 보유: {have} G)\n골드를 충전할 수 있는 상점으로 이동하시겠습니까?', { need: r.cost, have: store.state.gold }),
          okLabel: T('상점 이동'),
        });
        if (go) await openShop({ tab: 'coin' });
      }
    } else if (choice === 'ad') {
      const r = (await TP.ads.showRewarded('heart')) ? energy.refillWithAd() : { ok: false };   // 끝까지 봤을 때만 하트 +1
      if (r.ok) toast(T('❤️ 수사 생명력 +{n}칸 ({a}/{b})', { n: AD_REFILL_AMOUNT, a: r.energy, b: MAX }));
    } else if (choice === 'shop') {
      await openShop({ tab: 'chance' });
    }
    updateEnergyHud();
    if (!$('#entryModal').hidden) renderEntry();
  }

  // =====================================================================
  // 하단 버튼
  // =====================================================================
  $('#btnPlay').onclick = () => openEntry(); // 배수 선택 팝업 → 솔리테어 (지목 단계면 수첩)
  $('#btnStages').onclick = () => openStages();
  $('#btnNotebook').onclick = () => notebook.open();
  $('#lobbyClueBlock').onclick = () => notebook.open();
  $('#btnBoard').onclick = () => notebook.open();     // [추리 수첩 보기] → 수사 보드
  $('#hudShop').onclick = () => openShop();
  $('#hudOffer').onclick = () => TP.ui.showHomeOffer();     // 홈 상시 SPECIAL OFFER (상점 상품과 별개)
  $('#hudEpisodes').onclick = () => openEpisodes();
  // 톱니: 로비에서는 설정, 게임 중에는 일시정지 메뉴(그 안에 '설정')
  $('#btnSettings').onclick = () => ($('#stage').dataset.screen === 'game' ? settingsMenu() : app.openSettings());
  $('#sbStreakChip').onclick = () => showStreakLadder();
  $('#streakTrack').onclick = () => showStreakLadder();    // WIN STREAK 아래 선물 줄도 같은 팝업

  const EP_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
  const clueDotsHtml = (cleared, total, blinkNext) =>
    Array.from({ length: total }, (_, i) =>
      `<i class="${i < cleared ? 'on' : i === cleared && blinkNext ? 'next' : ''}"></i>`).join('');

  // 홈: TP.home.uiModel() (= HomeGameManager.getHomeUIModel + 기존 규칙) 을 손글씨 기획안 배치에 바인딩
  //   중앙: 에피소드 배경(전용 → 30종 테마 순환 폴백) · <제목> · CLUE : 03/20
  //   좌하단: 레벨 구간 칭호 · 코스튬   우측: 연승 보상 아이콘 · PLAY(→ 배수 팝업) · Life ♥ + 20분 충전 타이머
  function renderLobby() {
    const s = store.state;
    const ep = mystery.episode;
    const accusing = mystery.isAccusationPhase();
    const { centerStage: c, profileWidget: p, rightControls: rc } = TP.home.uiModel();
    const total = c.maxClues;
    const cleared = ep ? c.cluesCollected : total;
    $('#lobbyBg').style.backgroundImage = c.background.css;
    $('#lobbyBg').dataset.theme = c.background.themeIndex;
    $('#lobbyEpisodeTitle').textContent = `<${c.episodeTitle}>`;
    $('#lobbyEpNo').textContent = EP_WORDS[s.episode.index] || (ep ? ep.no : s.episode.index + 1);
    const chapter = TP.chapterOf(ep);
    $('#lobbyChapter').hidden = !chapter;
    if (chapter) $('#lobbyChapter').innerHTML = `<small>CH.${chapter.index + 1}</small>${chapter.continent}${ep.city ? ` · ${ep.city}` : ''}`;
    $('#boardBadge').textContent = s.episode.unread;
    $('#boardBadge').hidden = !s.episode.unread;
    $('#btnBoard').classList.toggle('hot', accusing);
    $('#clueDots').innerHTML = clueDotsHtml(cleared, total, !accusing);
    $('#clueCount').textContent = ep ? c.clueText.replace(/^CLUE\s*:\s*/, '') : `${total}/${total}`;
    if (!$('#avatarImg').src.endsWith(p.avatarUrl)) $('#avatarImg').src = p.avatarUrl;
    $('#profileNick').textContent = T(TP.settings.get().nickname);   // 기본 닉네임 '탐정님' 만 번역됨

    const stage = mystery.nextStage();
    $('#playSub').textContent = accusing ? T('🔎 범인 지목!')
      : ep && stage ? `EP${s.episode.index + 1} · STAGE ${stage}/${total}` : T('자유 플레이');

    // 연속 승리 보상 (3 · 5 · 10 · 15 · 20연승)
    const ws = rc.winStreak;
    $('#streakTrack').innerHTML = ws.milestones.map(m => `
      <i class="${m.reached ? 'on' : ''} ${m.streak === ws.nextTarget && !m.reached ? 'next' : ''}"
         title="${m.label} ${TP.describeStreakReward(m)}"><img src="${TP.ASSETS.iconGift}" alt=""><small>${m.streak}</small></i>`).join('');
    const buffs = TP.describeBuffs(TP.streakBuffs(ws.current));
    const nextGift = TP.nextStreakMilestone(ws.current);
    $('#streakTip').innerHTML = `
      <b>${T('🔥 {n}연승', { n: ws.current })}</b><br>
      ${buffs ? T('⚡ 현재 혜택: {b}', { b: buffs }) : T('아직 연승 혜택이 없어요')}<br>
      ${nextGift ? T('🎁 {at}연승까지 <b>{left}승</b> → {r}', { at: nextGift.at, left: nextGift.at - ws.current, r: TP.describeStreakReward(nextGift.reward) }) : T('최고 단계 혜택 유지 중')}`;
  }

  // =====================================================================
  // 연속 승리 보상 팝업 (시안: win_streak_popup — 불꽃 금색 제목 · 3~50연승 트랙 · 달성 도장 · NEXT 말풍선)
  //   노드 = TP.STREAK_TIERS (3 · 5 · 7 · 10 · 15 · 20 · 30 · 50). 보상이 없는 단계(5 · 15)는 버프(덱 +N 등)를 보여 준다.
  // =====================================================================
  function showWinStreakPopup() {
    const A = 'game_assets/';
    const streak = store.state.winStreak;
    const tiers = TP.STREAK_TIERS;
    const nextIdx = tiers.findIndex(t => t.at > streak);
    const FIRE = `<img class="ws-fire-ico" src="${A}icons/fire.webp" alt="">`;
    // 보상 → 대표 아이콘 · 짧은 설명 (게임 에셋 그림)
    const amt = v => (Array.isArray(v) ? `${v[0]}~${v[1]}` : v);
    const has = v => (Array.isArray(v) ? v[1] > 0 : !!v);
    const rewardIcon = t => {
      const r = t.reward;
      if (r) {
        if (r.prestige) return `${A}card_back.webp`;
        const kinds = ['gold', 'undo', 'wild', 'life', 'hint'].filter(k => has(r[k]));
        if (kinds.length > 1) return `${A}icon_gift.webp`;
        return { gold: `${A}icon_gold.webp`, undo: `${A}btn_booster_undo.webp`, wild: `${A}card_wild.webp`, life: `${A}icon_heart.webp`, hint: `${A}icon_hint_ticket.webp` }[kinds[0]] || `${A}icon_gift.webp`;
      }
      return TP.plusCardImage(t.buffs.extraCards || 1);       // 버프만 있는 단계: 덱 +N 카드
    };
    const rewardText = t => {
      const r = t.reward;
      if (!r) return T('{b} 버프', { b: TP.describeBuffs(t.buffs) });
      const ic = (src, alt) => `<img class="ws-inline" src="${A}${src}" alt="${alt}">`;
      return [
        r.prestige && `${ic('card_back.webp', '')}${T('카드 뒷면 스킨')}`,
        has(r.life) && `<b class="red">${ic('icon_heart.webp', '')}${T('하트 +{n}', { n: amt(r.life) })}</b>`,
        has(r.gold) && `<b class="gold">${ic('icon_gold.webp', '')}${T('{n}골드', { n: amt(r.gold) })}</b>`,
        has(r.undo) && `${ic('btn_booster_undo.webp', '')}${T('되돌리기 +{n}', { n: amt(r.undo) })}`,
        has(r.wild) && `${ic('card_wild.webp', '')}${T('와일드 +{n}', { n: amt(r.wild) })}`,
        has(r.hint) && `${ic('icon_hint_ticket.webp', '')}${T('힌트권 +{n}', { n: amt(r.hint) })}`,
      ].filter(Boolean).join(' & ');
    };
    const nodes = tiers.map((t, i) => {
      const state = t.at <= streak ? 'done' : i === nextIdx ? 'next' : 'locked';
      return `
        <div class="ws-node ${state}" style="--i:${i}">
          <div class="ws-top">${state === 'done' ? `<div class="ws-tile claimed"><img src="${rewardIcon(t)}" alt=""><i class="ws-check">✔</i></div>` : ''}</div>
          <div class="ws-num"><b>${t.at}</b>${state === 'locked' ? `<img class="ws-lock" src="${A}icons/lock.webp" alt="">` : ''}</div>
          <div class="ws-bottom">
            ${state === 'done' ? `<div class="ws-tile stamp"><span>${T('달성 완료')}</span></div>`
              : state === 'next' ? `<div class="ws-tile now"><b>${T('진행 중!')}</b><small>(NEXT)</small></div>`
              : `<div class="ws-tile future"><img src="${rewardIcon(t)}" alt=""></div>`}
          </div>
        </div>`;
    }).join('');
    // 트랙 채움: 지난 노드까지 + 다음 노드까지의 진행 비율
    const n = tiers.length;
    const lastDone = tiers.filter(t => t.at <= streak).length - 1;
    // k = 노드 위치(소수 인덱스). 노드는 8칸 그리드의 칸 중앙에 놓이므로 비율은 (k + 0.5) / n
    let k = lastDone;
    if (nextIdx > 0) {
      const a = tiers[nextIdx - 1].at, b = tiers[nextIdx].at;
      k = nextIdx - 1 + (streak - a) / (b - a);
    } else if (nextIdx === 0) k = -0.5 + 0.5 * streak / tiers[0].at;
    const fill = (k + 0.5) / n;
    const next = nextIdx >= 0 ? tiers[nextIdx] : null;
    const nextGift = TP.nextStreakMilestone(streak);
    const left = next ? next.at - streak : 0;
    const page = document.createElement('div');
    page.className = 'ws-popup';
    page.style.zIndex = 98700;
    page.innerHTML = `
      <div class="ws-frame" role="dialog" aria-modal="true" aria-label="${T('연속 승리 보상')}" data-no-icons>
        <img class="ws-cat" src="${A}mascot_cat.webp" alt="">
        <h2 class="ws-title">${FIRE}<span>${T('연속 승리 보상')}</span>${FIRE}</h2>
        <div class="ws-board">
          <div class="ws-current">${FIRE}<span>${T('현재 <b>{n}연승</b>', { n: streak })}</span></div>
          <div class="ws-track-wrap">
            <div class="ws-track"><i class="ws-track-fill" style="width:${Math.max(0, Math.min(1, fill)) * 100}%"></i></div>
            ${next ? `<img class="ws-runner" src="${A}icons/fire.webp" alt="" style="left:calc(4% + ${Math.max(0, Math.min(1, fill)) * 92}%)">` : ''}
            ${next ? `<div class="ws-bubble${nextIdx >= 5 ? ' flip' : ''}" style="--x:${(nextIdx + 0.5) / n}">${T('다음 보상: <b>{at}연승</b> 달성 시<br>{r} 획득 가능!', { at: next.at, r: rewardText(next) })}</div>` : ''}
            <div class="ws-nodes">${nodes}</div>
          </div>
          <div class="ws-foot">
            ${nextGift ? `<p class="ws-line">${T('{at}연승까지 <b>{left}승</b> → {r}', { at: nextGift.at, left: nextGift.at - streak, r: rewardText({ reward: nextGift.reward, buffs: {} }) })}</p>` : `<p class="ws-line">${T('모든 연승 보상 달성! 🏆')}</p>`}
            ${next ? `<p class="ws-big">${FIRE}<span>${T('다음 보상까지 <b>단 {n}승</b> 남음!', { n: left })}</span></p>` : ''}
          </div>
        </div>
        <button class="ws-ok" data-nosfx>${T('확인')}</button>
      </div>`;
    TP.ui.root().append(page);
    TP.audio.sfx('popup');
    return new Promise(resolve => {
      const close = () => { TP.audio.sfx('click'); page.classList.add('out'); setTimeout(() => { page.remove(); resolve(); }, 220); };
      page.querySelector('.ws-ok').onclick = close;
      page.addEventListener('click', e => { if (e.target === page) close(); });
    });
  }
  TP.showWinStreakPopup = showWinStreakPopup;   // 개발자 확인용

  // 별 기준 안내 (TP.stageStars: 이어하기 쓰면 ★1 · 안 쓰면 ★2 · 안 쓰고 덱 N장 이상 남기면 ★3) — 칩 3개 한 줄
  function starRuleHtml(target) {
    const three = target ? T('덱 {n}장 이상 남기고 통과', { n: target }) : T('덱을 많이 남기고 통과');
    return `<span class="sr-row"><b>★</b> ${T('통과')}</span><span class="sr-row"><b>★★</b> ${T('이어하기 없이 통과')}</span><span class="sr-row"><b>★★★</b> ${three}</span>`;
  }

  function showStreakLadder() {
    return showWinStreakPopup();
  }

  // 에피소드 메뉴: 해결한 사건 · 진행 중 · 잠긴 사건 · 출시 예정
  function openEpisodes() {
    const s = store.state;
    const cards = TP.EPISODES.map((ep, i) => {
      const solved = s.solvedEpisodes.includes(ep.episodeId);
      const current = !solved && i === s.episode.index;
      const cls = solved ? 'past' : current ? 'current' : 'future';
      const cleared = solved ? ep.clues.length : current ? s.episode.cleared : 0;
      return `
        <button class="ep-card ${cls}" data-ep="${i}">
          <span class="ep-thumb">${cls === 'future' ? `<img class="locked-card" src="${TP.ASSETS.cardLocked}" alt="${T('잠김')}">`
            : ep.thumb ? `<img src="${ep.thumb}" alt="" loading="lazy">` : `<span class="ep-placeholder">🗂️<small>${ep.country || ''}</small></span>`}
            ${solved ? '<span class="stamp">CASE CLOSED</span>' : cls === 'future' ? '<span class="stamp">🔒</span>' : ''}</span>
          <span class="ep-no">EPISODE ${i + 1}</span>
          <span class="ep-name">${ep.title}</span>
          <span class="ep-desc">${cls === 'future' ? T('이전 사건을 해결하면 열려요') : ep.subtitle}</span>
          <span class="ep-progress"><span class="clue-dots">${clueDotsHtml(cleared, ep.clues.length, false)}</span></span>
          <span class="ep-state">${solved ? T('✔ 해결 완료') : current ? T('수사 중 · 단서 {a}/{b}', { a: cleared, b: ep.clues.length }) : T('잠김')}</span>
        </button>`;
    });
    const upcoming = TP.EPISODE_ROADMAP.map(r => `
      <div class="ep-card future">
        <span class="ep-thumb"><img class="locked-card" src="${TP.ASSETS.cardLocked}" alt="${T('출시 예정')}"></span>
        <span class="ep-no">EPISODE ${r.no}</span>
        <span class="ep-name">${r.title}</span>
        <span class="ep-desc">${r.teaser}</span>
        <span class="ep-state">COMING SOON</span>
      </div>`);
    $('#episodeStrip').innerHTML = [...cards, ...upcoming].join('');
    openModal($('#episodesModal'));
    const cur = $('#episodeStrip .ep-card.current');
    if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  $('#episodesClose').onclick = () => closeModal($('#episodesModal'));
  $('#episodesModal').addEventListener('click', e => { if (e.target.id === 'episodesModal') closeModal($('#episodesModal')); });
  $('#episodeStrip').addEventListener('click', e => {
    const card = e.target.closest('.ep-card.current, .ep-card.past');
    if (!card) return;
    closeModal($('#episodesModal'));
    openStages(TP.EPISODES[+card.dataset.ep].episodeId);
  });

  // =====================================================================
  // 스테이지 선택: 사건마다 스테이지 20개 — 깬 스테이지(최고 별) · 다음 스테이지 · 잠김
  //   해결한 사건과 지금 사건만 열 수 있다 (‹ › 로 넘기기). 깬 스테이지는 언제든 다시해서 별을 채운다.
  // =====================================================================
  let stagesEp = null;
  const openableEpisodes = () => TP.EPISODES.filter((ep, i) =>
    store.state.solvedEpisodes.includes(ep.episodeId) || i === store.state.episode.index);
  const episodeStarsOf = epId => Object.values(store.state.stageStars[epId] || {}).reduce((a, b) => a + b, 0);

  function openStages(episodeId) {
    const list = openableEpisodes();
    if (!list.length) return toast(T('열 수 있는 사건이 없어요'));
    stagesEp = list.find(ep => ep.episodeId === episodeId) || (mystery.episode && list.find(ep => ep.episodeId === mystery.episode.episodeId)) || list[list.length - 1];
    renderStages();
    openModal($('#stagesModal'));
  }

  function renderStages() {
    const s = store.state;
    const ep = stagesEp;
    const list = openableEpisodes();
    const idx = list.indexOf(ep);
    const isCurrent = mystery.episode && ep.episodeId === mystery.episode.episodeId;
    const cleared = isCurrent ? s.episode.cleared : ep.clues.length;
    const stars = s.stageStars[ep.episodeId] || {};
    const accusing = isCurrent && mystery.isAccusationPhase();
    $('#stagesTitle').textContent = `EPISODE ${TP.EPISODES.indexOf(ep) + 1}`;
    $('#stagesSub').textContent = `${ep.title}${isCurrent ? T(' · 수사 중 (단서 {a}/{b})', { a: cleared, b: ep.clues.length }) : T(' · 해결 완료')}`;
    $('#stagesPrev').disabled = idx <= 0;
    $('#stagesNext').disabled = idx >= list.length - 1;
    $('#stageGrid').innerHTML = ep.clues.map((_, i) => {
      const n = i + 1;
      const best = stars[n] || 0;
      const done = n <= cleared;
      const next = isCurrent && n === cleared + 1;
      const cls = done ? 'done' : next ? 'next' : 'locked';
      return `<button class="st-tile ${cls}${best === 3 ? ' perfect' : ''}" data-stage="${n}" ${cls === 'locked' ? 'disabled' : ''}
          aria-label="${T('스테이지 {n}', { n })}${done ? T(' · 별 {n}개', { n: best }) : next ? T(' · 다음 스테이지') : T(' · 잠김')}">
        <span class="st-no">${n}</span>
        ${done ? `<span class="st-stars">${[1, 2, 3].map(k => `<i class="${k <= best ? 'on' : ''}">${STAR_SVG}</i>`).join('')}</span>`
          : next ? '<span class="st-next">NEXT</span>' : '<span class="st-lock">🔒</span>'}
        ${done && isCurrent ? `<small class="st-clue">${T('단서')}</small>` : ''}
      </button>`;
    }).join('');
    const total = episodeStarsOf(ep.episodeId);
    const perfect = Object.values(stars).filter(v => v === 3).length;
    $('#stagesFoot').innerHTML = `<span class="sf-total"><b>★</b> ${total}/${ep.clues.length * 3}</span>
      <span>${T('별 3개 {a}/{b}스테이지', { a: perfect, b: ep.clues.length })}</span>
      <span class="sf-rule">${starRuleHtml()}</span>
      ${accusing ? `<span class="sf-accuse">${T('단서 20개 완료 — 수첩에서 범인을 지목하세요')}</span>` : ''}`;
  }

  $('#stagesClose').onclick = () => closeModal($('#stagesModal'));
  $('#stagesModal').addEventListener('click', e => { if (e.target.id === 'stagesModal') closeModal($('#stagesModal')); });
  $('#stagesPrev').onclick = () => { const l = openableEpisodes(); stagesEp = l[Math.max(0, l.indexOf(stagesEp) - 1)]; renderStages(); };
  $('#stagesNext').onclick = () => { const l = openableEpisodes(); stagesEp = l[Math.min(l.length - 1, l.indexOf(stagesEp) + 1)]; renderStages(); };
  $('#stageGrid').addEventListener('click', e => {
    const tile = e.target.closest('.st-tile:not(.locked)');
    if (!tile) return;
    closeModal($('#stagesModal'), { silent: true });
    openEntry({ stage: +tile.dataset.stage, episodeId: stagesEp.episodeId });
  });

  // 홈 SPECIAL OFFER: 회차가 끝나면(닫기 · 구매) 10일 동안 버튼째 사라짐, 2회차 뒤엔 영영
  function updateOfferTimer() {
    $('#offerTimer').textContent = T('한정 판매');
    $('#hudOffer').hidden = !TP.homeOfferAvailable();
  }
  setInterval(updateOfferTimer, 1000);
  updateOfferTimer();

  // 접속 후 홈 화면에 (다른 팝업 없이) 5초 머물면 SPECIAL OFFER 팝업 — 접속당 한 번
  let homeOfferShown = false, homeIdle = 0;
  const popupOpen = () => !!TP.ui.root().querySelector('.modal-backdrop:not([hidden]), .ws-popup, .daily-bonus, .ho-popup, .boot-splash, .rsm-popup, .tut');
  setInterval(() => {
    if (homeOfferShown) return;
    homeIdle = $('#stage').dataset.screen === 'lobby' && !popupOpen() && !document.hidden ? homeIdle + 1 : 0;
    if (homeIdle >= 5 && TP.homeOfferAvailable()) { homeOfferShown = true; TP.ui.showHomeOffer(); }
  }, 1000);

  // 골드 롤링 카운터
  let goldShown = null;
  let goldRollId = 0;
  function rollGold(to) {
    const el = $('#sbGold');
    const from = goldShown ?? to;
    goldShown = to;
    const id = ++goldRollId;
    if (from === to) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now();
    const DUR = 700;
    const step = now => {
      if (id !== goldRollId) return;
      const k = Math.min(1, (now - t0) / DUR);
      el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3)).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { if (id === goldRollId) el.textContent = to.toLocaleString(); }, DUR + 60); // 탭이 가려져도 최종값
  }

  // 설정 · 일시정지 메뉴 (트라이픽스는 시간 제한이 없어, 메뉴가 열린 동안 입력만 막으면 된다)
  // 일시정지 팝업 — 수사 생명력 팝업과 같은 디자인 (frame_resume.webp · 제목 글씨 txt_pause_title.webp, Higgsfield)
  //   왼쪽: 판 상태(스테이지 · 배수 · 남은 카드 · 덱)   오른쪽: 버튼 2열   아래: 안내
  function pausePage({ inGame, running }) {
    const A = 'game_assets/';
    const g = view.game;
    const stat = (label, value) => `<div class="pz-stat"><small>${label}</small><b>${value}</b></div>`;
    const btn = (v, cls, icon, label) => `<button class="en-btn ${cls}" data-v="${v}">${icon}${label}</button>`;
    const page = document.createElement('div');
    page.className = 'en-popup';
    page.style.zIndex = 98600;
    page.innerHTML = `
      <div class="en-frame pause" role="dialog" aria-modal="true" aria-label="${T('일시정지')}" data-no-icons>
        <div class="en-head"><img class="en-title" src="${TP.i18n ? TP.i18n.img(A + 'txt_pause_title.webp') : A + 'txt_pause_title.webp'}" alt="${T('일시정지')}"></div>
        <div class="en-body">
          <div class="en-status pz-status">
            ${running && run ? `
              ${stat(T('스테이지'), run.stage ? `STAGE ${run.stage}` : T('자유 플레이'))}
              ${stat(T('배수'), `×${run.mult}`)}
              ${stat(T('남은 카드'), T('{n}장', { n: g.remaining }))}
              ${stat(T('덱'), T('{n}장', { n: g.stockCount }))}` : `<p class="en-timer">${T('진행 중인 판이 없어요')}</p>`}
          </div>
          <div class="en-actions pz-actions">
            ${btn('resume', 'green wide', '▶ ', T('계속하기'))}
            ${btn('notebook', 'blue', `<img src="${A}icons/notebook.webp" alt="">`, T('탐정 수첩'))}
            ${btn('shop', 'blue', `<img src="${A}btn_shop.webp" alt="">`, T('상점'))}
            ${btn('settings', 'blue', `<img src="${A}btn_settings.webp" alt="">`, T('설정'))}
            ${inGame ? btn('lobby', 'blue', `<img src="${A}icons/home.webp" alt="">`, T('로비로 나가기')) : ''}
            ${running ? btn('giveup', 'red', '', T('스테이지 포기')) : ''}
          </div>
          <p class="en-rule">${running ? T('로비로 나가거나 포기하면 이 판은 실패 처리되고 입장료는 돌아오지 않아요') : T('트라이픽스는 시간 제한이 없어요 — 천천히 생각해도 돼요')}</p>
        </div>
      </div>`;
    TP.ui.root().append(page);
    TP.audio.sfx('popup');
    return new Promise(resolve => {
      page.querySelectorAll('.en-btn').forEach(b => { b.onclick = () => { TP.audio.sfx('click'); page.remove(); resolve(b.dataset.v); }; });
      page.addEventListener('click', e => { if (e.target === page) { page.remove(); resolve('resume'); } });
    });
  }

  async function settingsMenu() {
    const inGame = $('#stage').dataset.screen === 'game';
    const choice = await pausePage({ inGame, running: !!activeRun() });
    if (choice === 'notebook') notebook.open();
    else if (choice === 'shop') openShop();
    else if (choice === 'settings') app.openSettings();
    else if (choice === 'lobby') {
      if (!activeRun()) return showScreen('lobby');
      const sure = await TP.ui.confirm({
        title: T('로비로 나가기'),
        message: T('진행 중인 판은 실패 처리돼요.') +
          (store.state.winStreak ? T(' 🔥 {n}연승도 초기화돼요.', { n: store.state.winStreak }) : '') + '\n' + T('그래도 나갈까요?'),
        okLabel: T('나가기'),
      });
      if (sure) { failRun(); showScreen('lobby'); }
    } else if (choice === 'giveup' && activeRun()) {
      const sure = await TP.ui.confirm({
        title: T('스테이지 포기'),
        message: (store.state.winStreak
          ? T('입장료 {fee} 골드를 돌려받지 못하고 🔥 {n}연승이 초기화돼요.', { fee: run.fee, n: store.state.winStreak })
          : T('입장료 {fee} 골드를 돌려받지 못해요.', { fee: run.fee })) + '\n' + T('정말 포기할까요?'),
        okLabel: T('포기하기'),
      });
      if (sure) giveUp();
    }
  }
  $('#hudEpisode').onclick = () => notebook.open();
  $('#clueProgress').onclick = () => notebook.open();

  // =====================================================================
  // 설정 모달 (#settings-modal) — HTML의 onclick="app.…" 에서 부른다
  // =====================================================================
  const settingsModal = $('#settings-modal');
  const field = id => document.getElementById(id);

  function fillSettings() {
    const s = TP.settings.get();
    if (TP.i18n) field('setting-lang').value = TP.i18n.lang;
    field('setting-bgm-toggle').checked = s.bgmOn;
    field('setting-bgm-vol').value = s.bgmVol;
    field('setting-bgm-vol').disabled = !s.bgmOn;
    field('setting-sfx-toggle').checked = s.sfxOn;
    field('setting-sfx-vol').value = s.sfxVol;
    field('setting-sfx-vol').disabled = !s.sfxOn;
    if (document.activeElement !== field('setting-nickname')) field('setting-nickname').value = T(s.nickname);
    renderCardBacks();
  }

  // 설정 · 카드 뒷면: 기본 + 18종 그리드. 보유한 것은 눌러서 장착(테두리 · 체크), 없는 것은 흑백 + 자물쇠
  function renderCardBacks() {
    const equipped = TP.cardBacks.equipped().id;
    field('cardBackCount').textContent = `${TP.cardBacks.owned().length} / ${TP.CARD_BACKS.length}`;
    field('cardBackGrid').innerHTML = TP.CARD_BACKS.map(b => {
      const owned = TP.cardBacks.isOwned(b.id);
      return `<button class="cb-item ${owned ? 'owned' : 'locked'} ${b.id === equipped ? 'equipped' : ''}" data-id="${b.id}"
                ${owned ? '' : 'disabled'} role="option" aria-selected="${b.id === equipped}" title="${owned ? b.name : T('50연승 보상으로 얻을 수 있어요')}">
          <img src="${b.src}" alt="${b.name}">
          ${owned ? '' : '<span class="cb-lock">🔒</span>'}
          ${b.id === equipped ? '<span class="cb-check">✔</span>' : ''}
        </button>`;
    }).join('');
  }
  field('cardBackGrid').addEventListener('click', e => {
    const item = e.target.closest('.cb-item.owned');
    if (!item || !TP.cardBacks.equip(item.dataset.id)) return;
    renderCardBacks();
    toast(T('🂠 카드 뒷면을 <b>{name}</b>(으)로 바꿨어요', { name: TP.cardBacks.get(item.dataset.id).name }));
  });

  // 바꾸는 즉시 저장
  field('setting-bgm-toggle').onchange = e => { TP.settings.set({ bgmOn: e.target.checked }); fillSettings(); };
  field('setting-sfx-toggle').onchange = e => { TP.settings.set({ sfxOn: e.target.checked }); fillSettings(); TP.audio.sfx('click'); };
  field('setting-bgm-vol').oninput = e => TP.settings.set({ bgmVol: Number(e.target.value) });
  field('setting-sfx-vol').oninput = e => TP.settings.set({ sfxVol: Number(e.target.value) });
  field('setting-sfx-vol').onchange = () => TP.audio.sfx('play', { combo: 5 });   // 놓으면 미리 듣기
  const saveNickname = () => {
    const before = TP.settings.get().nickname;
    const after = TP.sanitizeNickname(field('setting-nickname').value);
    field('setting-nickname').value = after;
    if (after !== before && after !== T(before)) {   // 번역해 보여 준 기본 닉네임('탐정님' → Detective)은 그대로 둠
      TP.settings.set({ nickname: after });
      toast(T('닉네임을 <b>{name}</b>(으)로 바꿨어요', { name: after.replace(/[&<>"']/g, '') }));
    }
  };
  field('setting-nickname').onchange = saveNickname;
  field('setting-nickname').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); };
  // 언어 바꾸기 → 설정에 저장하고 새로 고침 (js/i18n.js)
  field('setting-lang').onchange = e => { if (TP.i18n) TP.i18n.setLang(e.target.value); };
  settingsModal.addEventListener('click', e => { if (e.target === settingsModal) app.closeSettings(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && settingsModal.style.display !== 'none') app.closeSettings();
  });

  const app = (globalThis.app = {
    openSettings() {
      fillSettings();                                   // 저장된 값으로 채우기
      document.getElementById('settings-modal').style.display = 'flex';
    },

    closeSettings() {
      document.getElementById('settings-modal').style.display = 'none';
      saveNickname();                                   // 입력 중이던 닉네임도 저장 (정리 규칙 적용)
      const newName = TP.settings.get().nickname;
      console.log('저장된 닉네임: ', newName);
    },

    // 계정 관리 (js/account.js — Firebase Authentication): 게스트(익명) ↔ Google 연결 · 로그아웃 · 계정 삭제
    async manageAccount() {
      const acc = TP.account;
      const st = acc.state;
      if (!acc.available) {
        await showDialog({
          title: T('구글 계정 연동'),
          className: 'account',
          body: `<p class="small">${T('이 버전에서는 Google 로그인을 아직 쓸 수 없어요.')}</p>
                 <p class="small">${T('유저 ID')} <b data-no-icons>${acc.shortId()}</b> ${T('(이 기기)')}</p>`,
          buttons: [{ label: T('구매 복원'), value: 'restore' }, { label: T('닫기'), value: null, cls: 'ghost' }],
        }).then(v => v === 'restore' && TP.ui.restorePurchases());
        return;
      }
      const google = st.provider === 'google';
      const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const choice = await showDialog({
        title: T('구글 계정 연동'),
        className: 'account',
        body: `<p class="small">${T('현재:')} <b>${google ? esc(st.email || st.displayName || T('Google 계정')) : T('게스트')}</b></p>
               <p class="small">${T('유저 ID')} <b data-no-icons>${acc.shortId()}</b></p>
               <p class="small">${google ? T('Google 계정에 연결돼 있어요.') : T('Google 계정을 연결하면 같은 유저 ID 로 계속 식별돼요.')}<br>${T('진행 상황은 이 기기에 저장돼요.')}</p>`,
        buttons: [
          ...(google ? [{ label: T('로그아웃'), value: 'logout' }] : [{ label: T('Google 계정 연결'), value: 'link', cls: 'primary' }]),
          { label: T('구매 복원'), value: 'restore' },
          { label: T('계정 삭제'), value: 'delete', cls: 'danger-link' },
          { label: T('닫기'), value: null, cls: 'ghost' },
        ],
      });
      if (choice === 'restore') return TP.ui.restorePurchases();
      if (choice === 'link') {
        const r = await acc.linkGoogle();
        if (r.ok) return toast(T('Google 계정을 연결했어요'));
        if (r.conflict) {
          const go = await TP.ui.confirm({ title: T('이미 사용 중인 Google 계정'), message: T('이 Google 계정은 다른 유저 ID 에 연결돼 있어요.\n그 계정으로 전환할까요? (이 기기의 진행 상황은 그대로예요)'), okLabel: T('전환') });
          if (go) { const s = await acc.switchToGoogle(); toast(s.ok ? T('Google 계정으로 전환했어요') : T('전환하지 못했어요')); }
          return;
        }
        if (r.reason !== 'cancelled') toast(T('Google 계정을 연결하지 못했어요'));
      } else if (choice === 'logout') {
        const ok = await TP.ui.confirm({ title: T('로그아웃'), message: T('로그아웃하면 새 게스트 유저 ID 로 바뀌어요.\n(이 기기의 진행 상황은 그대로예요)'), okLabel: T('로그아웃') });
        if (ok) toast((await acc.signOut()).ok ? T('로그아웃했어요') : T('로그아웃하지 못했어요'));
      } else if (choice === 'delete') {
        const ok = await TP.ui.confirm({ title: T('계정 삭제'), message: T('유저 ID 와 연결된 Google 계정 정보를 서버에서 영구 삭제해요.\n되돌릴 수 없어요. 계속할까요?'), okLabel: T('삭제') });
        if (!ok) return;
        const r = await acc.deleteAccount();
        if (!r.ok) return toast(r.reason === 'cancelled' ? T('삭제를 취소했어요') : T('계정을 삭제하지 못했어요'));
        toast(T('계정을 삭제했어요'));
        const wipe = await TP.ui.confirm({ title: T('진행 상황도 지울까요?'), message: T('이 기기에 저장된 게임 진행 상황(골드 · 레벨 · 사건)도 초기화할까요?'), okLabel: T('초기화'), cancelLabel: T('남겨두기') });
        if (wipe) { await TP.localSave?.wipe(); try { localStorage.clear(); } catch { /* 무시 */ } location.reload(); }
      }
    },

    // 법적 고지 (GDD 8장): 이용약관 · 개인정보처리방침을 외부 웹뷰(새 창)로. 주소가 아직 없으면 안내
    // 안드로이드 뒤로가기에서 팝업이 없을 때 (js/back-button.js): 게임 중 = 일시정지 메뉴, 판이 끝난 게임 화면 = 로비, 로비 = 종료 확인
    async onBack() {
      if ($('#stage').dataset.screen === 'game') return activeRun() ? settingsMenu() : showScreen('lobby');
      const ok = await TP.ui.confirm({ title: T('게임 종료'), message: T('게임을 종료할까요?'), okLabel: T('종료'), cancelLabel: T('취소') });
      if (!ok) return;
      await TP.localSave?.flush?.();
      TP.backButton?.exitApp();
    },

    // 설정 → 튜토리얼 다시 보기 (보상은 처음 한 번만)
    async replayTutorial() {
      app.closeSettings();
      if (activeRun()) return toast(T('게임이 끝난 뒤 로비에서 볼 수 있어요'));
      showScreen('lobby');
      await TP.tutorial?.start({ replay: true });
    },

    async openLegal() {
      const choice = await showDialog({
        title: T('📜 법적 고지'),
        className: 'legal',
        body: `
          <div class="legal-text">
            <p><b>${T('결제 안내')}</b><br>${T('상품은 Google Play 결제로 구매해요. 환불 · 구매 취소 기준은 [이용약관]에서 볼 수 있어요.')}</p>
            <p><b>${T('개인정보')}</b><br>${T('게임 진행 상황은 이 기기에 저장되고, 클라우드 저장을 쓰면 내 Google Play 게임즈 저장 공간에도 저장돼요. 유저 식별을 위해 Google Firebase 인증이 익명 유저 ID 를 만들고, Google 계정을 연결하면 그 계정의 이메일 · 이름을 함께 처리해요. 설정 → 계정 관리 → [계정 삭제] 로 언제든 지울 수 있어요. 자세한 내용은 [개인정보처리방침] 에서 볼 수 있어요.')}</p>
            <p><b>${T('오픈소스')}</b><br>Capacitor · @capacitor/app · @capacitor/filesystem · @capacitor-community/admob · RevenueCat Purchases — MIT License<br>Capacitor Firebase Authentication — Apache License 2.0</p>
            <p><b>${T('그림')}</b><br>${T('일부 일러스트는 AI 이미지 생성 도구(Higgsfield)로 제작했어요.')}</p>
            <p class="small">${T('버전')} ${TP.SUPPORT.version}</p>
          </div>`,
        buttons: [
          { label: T('이용약관'), value: 'terms', cls: 'primary' },
          { label: T('개인정보처리방침'), value: 'privacy', cls: 'primary' },
          { label: T('닫기'), value: null, cls: 'ghost' },
        ],
      });
      if (!choice) return;
      const url = TP.legalUrl(choice);
      if (url) window.open(url, '_blank', 'noopener');
      else toast(T('출시 전에 게시될 예정이에요'));
    },

    // 클라우드 저장 (Google Play 게임즈 저장된 게임): 로그인 전이면 로그인, 로그인했으면 지금 올리기
    async cloudSave() {
      const sync = TP.playGamesSync;
      if (!sync || sync.status.state === 'unavailable') return toast(T('이 버전에서는 클라우드 저장을 아직 쓸 수 없어요'));
      if (!sync.status.signedIn) {
        const ok = await sync.signIn({ ask: askCloudRestore });
        return toast(ok ? T('Play 게임즈에 로그인했어요') : T('Play 게임즈에 로그인하지 못했어요'));
      }
      const done = await sync.uploadNow();
      toast(done ? T('☁️ 클라우드에 저장했어요') : sync.status.lastError ? T('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요') : T('방금 저장했어요'));
    },

    // 고객 문의 (GDD 8장): 안내 후 기본 이메일 앱 호출
    contactUs() {
      alert(T('문의 메일을 작성합니다.\n답변에는 영업일 기준 3~10일이 소요될 수 있습니다.'));
      const email = TP.SUPPORT.email;   // dong2kids@gmail.com
      const subject = encodeURIComponent(T('[탐정 솔리테어] 고객 문의'));
      // 안내문 양식 그대로, 닉네임 · 기기 정보 칸은 자동으로 채운다
      const body = encodeURIComponent(
        T('게임 닉네임: {nick}\n유저 ID: {uid}\n기기 정보: {ua} (버전 {ver})\n\n', { nick: TP.settings.get().nickname, uid: TP.account ? TP.account.state.uid || '-' : '-', ua: navigator.userAgent, ver: TP.SUPPORT.version }) +
        T('문의 내용을 아래에 적어주세요.\n(답변에는 3~10 working days가 소요됩니다.)\n--------------------------\n'));
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    },
  });
  store.subscribe(() => { if (settingsModal.style.display !== 'none') fillSettings(); });

  // ---------- 세이브: 기기 파일(save_data.json) → Play 게임즈 클라우드 ----------
  // 시작 화면(로고 · 로딩)이 사라진 뒤에 묻는다
  const afterSplash = () => new Promise(resolve => {
    const check = () => (document.querySelector('.boot-splash') ? setTimeout(check, 300) : resolve());
    check();
  });
  // 클라우드가 더 최근이고 진행도도 높을 때
  async function askCloudRestore(cloud, local) {
    await afterSplash();
    return TP.ui.confirm({
      title: T('☁️ 클라우드 저장 데이터'),
      message: T("클라우드 저장 데이터가 있습니다. 불러오시겠습니까?\n(진행도: 에피소드 {ce}, 골드 {cg})\n\n이 기기: 에피소드 {le}, 골드 {lg}\n'아니요'를 고르면 다음 저장 때 이 기기 데이터로 클라우드를 덮어써요.", { ce: cloud.episode, cg: cloud.gold.toLocaleString(), le: local.episode, lg: local.gold.toLocaleString() }),
      okLabel: T('불러오기'),
      cancelLabel: T('아니요'),
    });
  }
  const cloudLabel = st => ({
    unavailable: T('이 버전에서는 사용할 수 없어요'), off: T('준비 중'), error: T('연결 오류'),
    'signed-out': T('Play 게임즈 로그인이 필요해요'),
    ready: st.lastUpload ? T('마지막 저장 {t}', { t: new Date(st.lastUpload).toLocaleTimeString() }) + (st.dirty ? T(' · 저장 대기') : '') : (st.dirty ? T('저장 대기 중') : T('클라우드와 같아요')),
  }[st.state] || T('준비 중'));
  if (TP.playGamesSync) TP.playGamesSync.onChange(st => {
    $('#cloudSaveLabel').textContent = cloudLabel(st);
    $('#cloudSaveBtn').textContent = st.state === 'signed-out' ? T('로그인') : T('지금 저장');
  });
  (async () => {
    const local = TP.localSave ? await TP.localSave.init() : { source: 'web' };
    if (local.restored) return location.reload();                 // 기기 파일이 더 최근 → 그 상태로 다시 시작
    if (!TP.playGamesSync) return;
    const st = await TP.playGamesSync.init({ ask: askCloudRestore });
    if (st.result === 'restored') { toast(T('☁️ 클라우드 저장 데이터를 불러왔어요')); setTimeout(() => location.reload(), 600); }
  })();

  // 유저 식별: 첫 실행에 익명 계정 자동 생성 → 설정의 계정 줄 갱신
  if (TP.account) {
    const showAccount = st => {
      $('#accountLabel').textContent = st.provider === 'google' ? (st.email || st.displayName || T('Google 계정')) : T('게스트');
      $('#accountId').textContent = TP.account.shortId();
    };
    TP.account.onChange(showAccount);
    TP.account.init().then(() => TP.billing?.init());   // 결제: 유저 ID 가 정해진 뒤 RevenueCat 시작 (끝나지 않은 결제 복구 · 광고 제거 복원)
  } else TP.billing?.init();

  // =====================================================================
  // 숨겨진 개발자 패널: 레벨 칩을 1.5초 안에 5번 터치
  // =====================================================================
  let taps = [];
  $('#sbLevel').onclick = () => {
    const now = Date.now();
    taps = taps.filter(t => now - t < 1500).concat(now);
    if (taps.length >= 5) {
      taps = [];
      $('#devPanel').hidden = !$('#devPanel').hidden;
      toast($('#devPanel').hidden ? '개발자 패널 닫힘' : '🛠 개발자 패널 열림');
    }
  };
  $('#devLevel').onclick = () => {
    store.grant({ levels: 10 });
    const tier = TP.tierForLevel(store.state.playerLevel);
    toast(`🛠 레벨 +10 → Lv.${store.state.playerLevel} (${tier.name})`);
  };
  $('#devStreak').onclick = () => {
    store.update(s => { s.winStreak += 1; });
    toast(`🛠 연승 → ${store.state.winStreak}`);
  };
  $('#devClues').onclick = () => {
    if (!mystery.episode) return toast('진행 중인 에피소드가 없어요');
    store.update(s => {
      const add = Math.min(5, mystery.episode.clues.length - s.episode.cleared);
      s.episode.cleared += add;
      s.episode.unread += add;
    });
    toast(`🛠 단서 → ${mystery.progress.cleared}개`);
    if (mystery.isAccusationPhase()) notebook.open();
  };
  // 대륙 전환 연출 확인용: 지금 대륙의 마지막 에피소드(예: 100화)로 이동 + 단서 20개 → 지목 성공 시 다음 대륙으로
  $('#devChapterEnd').onclick = () => {
    const ch = TP.chapterOf(mystery.episode);
    if (!ch) return toast('진행 중인 에피소드가 없어요');
    const index = TP.EPISODES.findIndex(e => e.no === ch.to);
    store.update(s => { s.episode = { ...TP.freshEpisodeState(index), cleared: TP.EPISODES[index].clues.length }; });
    toast(`🛠 EP${ch.to} (${ch.continent} 마지막 화) · 단서 20개`);
    notebook.open();
  };
  $('#devSolve').onclick = () => {
    if (!activeRun()) return toast(T('진행 중인 게임이 없어요'));
    view.playSolution();
  };
  $('#devReset').onclick = async () => {
    const ok = await showDialog({
      title: '데이터 초기화',
      body: '<p>골드·아이템·레벨·연승·구매 기록을 처음 상태로 되돌릴까요?</p>',
      buttons: [{ label: '취소', value: false, cls: 'ghost' }, { label: '초기화', value: true, cls: 'primary' }],
    });
    if (ok) {
      store.reset();
      toast('초기화했어요');
    }
  };

  // =====================================================================
  // 상태가 바뀔 때마다 상태바·버튼·열린 모달 갱신
  // =====================================================================
  store.subscribe((s, prev) => {
    const top = TP.home.uiModel().topBar;          // 상단 바: Level · EXP 진행 바 · Gold
    if ($('#sbLevelNum').dataset.level !== String(top.level)) {        // level_frame 방패 안에 숫자 그림
      $('#sbLevelNum').dataset.level = top.level;
      $('#sbLevelNum').innerHTML = TP.levelDigitsHtml(top.level);
      $('#sbLevelNum').setAttribute('aria-label', T('레벨 {n}', { n: top.level }));
    }
    $('#expFill').style.width = `${top.expPercent}%`;
    $('#expText').textContent = `${top.exp.toLocaleString()} / ${top.reqExp.toLocaleString()} EXP`;
    $('#sbTitle').textContent = TP.titleOf(s);
    rollGold(top.gold);
    $('#sbStreak').textContent = s.winStreak;
    $('#sbStreakChip').classList.toggle('hot', s.winStreak >= 3);
    $('#hudOffer').hidden = !TP.homeOfferAvailable();   // 오퍼가 쉬는 중이면 사라지고 SHOP · EPISODE 가 왼쪽으로 당겨짐

    if (s.gold !== prev.gold) bump($('#sbGoldChip'));
    if (s.undoCount !== prev.undoCount) bump($('#btnUndo'));
    if (s.wildcardCount !== prev.wildcardCount) bump($('#btnWild'));
    if (s.winStreak !== prev.winStreak) bump($('#sbStreakChip'));

    // 에피소드 진행 표시
    const ep = mystery.episode;
    // 인게임 상단 단서 진행 바 (ui_episode_progress.webp)
    $('#hudEpisode').innerHTML = ep
      ? `<span class="ep-progress-bar" style="--p:${(s.episode.cleared / ep.clues.length) * 100}%"><i></i><b>EP${s.episode.index + 1} · ${s.episode.cleared}/${ep.clues.length}</b></span>`
      : T('📓 자유 플레이');
    // 홈 [STAGES] 버튼: 지금 플레이할 스테이지 / 20 (예전엔 별 합계 / 60 이라 '12/60' 처럼 헷갈렸다 — 별은 스테이지 창에서)
    $('#stagesStars').textContent = ep ? `${mystery.nextStage() || Math.min(s.episode.cleared, ep.clues.length)}/${ep.clues.length}` : '';
    $('#notebookBadge').textContent = s.episode.unread;
    $('#notebookBadge').hidden = !s.episode.unread;
    $('#clueProgress').textContent = ep ? `${s.episode.cleared} / ${ep.clues.length}` : T('해결 완료');
    if ($('#stage').dataset.screen === 'lobby') renderLobby();

    refreshItemButtons();
    updateEnergyHud(); // 구매·충전 즉시 반영 (1초 타이머를 기다리지 않음)
    if (!$('#entryModal').hidden) renderEntry();
    if (notebook.isOpen()) notebook.render();
  });

  // =====================================================================
  // 시작
  // =====================================================================
  // 판 도중에 앱이 튕기거나 종료됐다면: 저장된 판 상태로 이어하기 제안 (덱 순서까지 그대로라 연승 꼼수는 불가)
  //   상태가 없는 예전 저장(또는 판이 바뀐 경우)은 실패 대신 입장료를 돌려주고 연승은 그대로 둔다
  if (store.state.activeRun) {
    const saved = store.state.activeRun;
    setTimeout(async () => {
      if (!saved.state) {
        store.update(s => { s.activeRun = null; s.gold += saved.fee || 0; });
        toast(T('중단된 판이 있어 입장료 🪙 {n}을 돌려드렸어요', { n: saved.fee || 0 }));
        return;
      }
      const choice = await showResumePopup(saved);
      if (choice === 'resume' && resumeRun(saved)) return toast(T('🔄 이어서 플레이해요!'));
      if (choice === 'resume') {                     // 판을 다시 만들 수 없음 → 입장료 환불
        store.update(s => { s.activeRun = null; s.gold += saved.fee || 0; });
        return toast(T('판을 불러올 수 없어 입장료 🪙 {n}을 돌려드렸어요', { n: saved.fee || 0 }));
      }
      store.update(s => { s.activeRun = null; });
      const lost = TP.home.recordStageResult({ won: false, multiplier: saved.mult }).lostStreak;
      if (lost) toast(T('🔥 {n}연승이 끊겼어요', { n: lost }));
    }, 1400);
  }

  // 이어하기 팝업 (frame_resume.webp: 파란 패널 + 오른쪽 위 고양이 · 제목 글씨 txt_resume_title.webp — Higgsfield)
  function showResumePopup(saved) {
    const A = 'game_assets/';
    const page = document.createElement('div');
    page.className = 'rsm-popup';
    page.style.zIndex = 99000;
    page.innerHTML = `
      <div class="rsm-frame" role="dialog" aria-modal="true" aria-label="${T('진행 중이던 판이 있어요')}">
        <img class="rsm-title" src="${TP.i18n ? TP.i18n.img(A + 'txt_resume_title.webp') : A + 'txt_resume_title.webp'}" alt="${T('진행 중이던 판이 있어요')}">
        <div class="rsm-body" data-no-icons>
          <p class="rsm-msg">${T('앱이 종료되기 전 판을 그대로 이어서 할 수 있어요.')}</p>
          <p class="rsm-info">${saved.stage ? `STAGE ${saved.stage} · ` : ''}×${saved.mult} · ${T('입장료')} <img src="${A}icon_gold.webp" alt="${T('골드')}"> ${(saved.fee || 0).toLocaleString()} ${T('(이미 지불)')}</p>
          <div class="rsm-actions">
            <button class="rsm-go"><i>▶</i> ${T('이어서 하기')}</button>
            <button class="rsm-quit">${T('포기하기 (실패 처리)')}</button>
          </div>
        </div>
      </div>`;
    TP.ui.root().append(page);
    TP.audio.sfx('popup');
    return new Promise(resolve => {
      const done = v => { page.remove(); resolve(v); };
      page.querySelector('.rsm-go').onclick = () => done('resume');
      page.querySelector('.rsm-quit').onclick = () => done('giveup');
    });
  }

  // CDN 에셋(에피소드 그림): 새 버전이면 진행 막대 화면에서 받고 새로 고침 (꺼져 있거나 웹이면 아무것도 안 함)
  TP.AssetManager?.ensure();

  // 시작 화면: 스튜디오 로고(logo_studio2.webp, 원본 logo_studio2.png 는 ../assets_original_backup/game_assets/) 1.6초 → 로딩 화면(ui_loading.webp)
  //   로딩 화면은 자주 쓰는 이미지를 미리 불러오는 동안 (로고 뒤 최소 0.9초, 최대 6초)
  (function bootSplash() {
    const LOGO_MS = 1600;
    const splash = document.createElement('div');
    splash.className = 'boot-splash';
    splash.style.zIndex = 99500;
    splash.innerHTML = `<img src="${TP.ASSETS.uiLoading}" alt="${T('불러오는 중')}"><div class="studio-logo"><img src="game_assets/logo_studio2.webp" alt="22FAM STUDIO"></div>`;
    TP.ui.root().append(splash);
    setTimeout(() => splash.querySelector('.studio-logo').classList.add('out'), LOGO_MS);
    const ep = mystery.episode;
    const urls = [
      ...Object.values(TP.ASSETS.cards), TP.ASSETS.cardBack, TP.ASSETS.cardWild, TP.ASSETS.cardPlus[1],
      TP.ASSETS.uiWinPage, TP.ASSETS.uiTransition, 'game_assets/frame_modal_popup_plain.webp', 'game_assets/bg_puzzle_felt.webp',
      ...(ep ? [ep.background, ...ep.suspects.map(s => s.portrait)] : []),
    ].filter(Boolean);
    const loads = urls.map(src => new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = src; }));
    const minTime = new Promise(res => setTimeout(res, LOGO_MS + 900));
    const maxTime = new Promise(res => setTimeout(res, LOGO_MS + 6000));
    Promise.race([Promise.all([...loads, minTime]), maxTime]).then(() => {
      splash.classList.add('out');
      setTimeout(() => splash.remove(), 400);
    });
  })();

  // =====================================================================
  // 데일리 로그인 보너스 (설치 후 7일 · 하루 1회 · 건너뛰면 다음 접속에 다음 날 보상 · 7일 지나면 사라짐) — js/daily-bonus.js
  // =====================================================================
  function showDailyBonus() {
    const st = TP.dailyBonus.status();
    if (!st.canClaim) return Promise.resolve(false);
    const A = 'game_assets/';
    const icon = r => r.gold ? `<img src="${A}icon_gold.webp" alt="${T('골드')}">` : r.undo ? `<img src="${A}btn_booster_undo.webp" alt="${T('되돌리기')}">`
      : r.hint ? `<img src="${A}icon_hint_ticket.webp" alt="${T('힌트권')}">` : r.life ? `<img src="${A}icon_heart.webp" alt="${T('하트')}">` : '';
    const amount = r => r.gold ? r.gold.toLocaleString() : r.undo ? `X${r.undo}` : r.hint ? `X${r.hint}` : r.life ? `X${r.life}` : '';
    const tile = (r, i) => {
      const state = i < st.claimed ? 'done' : i === st.claimed ? 'today' : 'future';
      if (r.big) return `
        <div class="db-tile big ${state}">
          <span class="db-day">Day ${r.day}</span>
          <div class="db-body">
            <img class="db-coin" src="${A}icon_gold.webp" alt=""><b class="db-amt">${r.gold.toLocaleString()}</b>
            <span class="db-extra"><span><img src="${A}btn_booster_undo.webp" alt=""><small>X${r.undo}</small></span><span><img src="${A}card_wild.webp" alt=""><small>X${r.wild}</small></span></span>
          </div>
          ${state === 'done' ? '<i class="db-check">✔</i>' : ''}
        </div>`;
      return `
        <div class="db-tile ${state}">
          <span class="db-day">Day ${r.day}</span>
          <div class="db-body">${icon(r)}<b class="db-amt">${amount(r)}</b></div>
          ${state === 'done' ? '<i class="db-check">✔</i>' : ''}
        </div>`;
    };
    const page = document.createElement('div');
    page.className = 'daily-bonus';
    page.style.zIndex = 98800;
    page.innerHTML = `
      <div class="db-panel" role="dialog" aria-modal="true" aria-label="${T('데일리 보너스')}">
        <h2 class="db-title"><span>DAILY</span><span>BONUS</span></h2>
        <p class="db-sub">${T('Day {d} 보상 · 설치 후 {n}일 남음', { d: st.nextDay, n: st.daysLeft })}</p>
        <div class="db-grid">${TP.DAILY_BONUS.map(tile).join('')}</div>
        <button class="db-collect" data-nosfx aria-label="${T('보상 받기 (COLLECT)')}"><img src="${A}btn_collect.webp" alt=""></button>
        <img class="db-avatar" src="${TP.avatarOf ? TP.avatarOf(store.state) : A + 'avatar_1.webp'}" alt="">
      </div>`;
    TP.ui.root().append(page);
    TP.audio.sfx('popup');
    return new Promise(resolve => {
      page.querySelector('.db-collect').onclick = () => {
        const r = TP.dailyBonus.claim();
        if (r.ok) {
          TP.audio.sfx('collect');
          confettiAt(page.querySelector('.db-tile.today'), { particleCount: 70, colors: ['#ffcf5a', '#7ed84a', '#2bd2ff'] });
          toast(T('🎁 Day {d} 보너스: {r} 지급', { d: r.day, r: TP.describeDailyReward(r.reward) }));
        }
        page.classList.add('out');
        setTimeout(() => { page.remove(); resolve(r.ok); }, 250);
      };
    });
  }
  TP.showDailyBonus = showDailyBonus;   // 개발자 확인용
  // 시작 1.6초 뒤(로딩 화면 · 이어하기 안내 뒤): 처음이면 튜토리얼(js/tutorial.js) 먼저, 그다음 받을 수 있으면 보너스 창
  setTimeout(async () => {
    // 광고 동의(유럽 등 필요한 지역에서만 창이 뜸) → AdMob 초기화를 튜토리얼 · 보너스 창보다 먼저 (js/ad-manager.js)
    await Promise.race([TP.ads?.init(), new Promise(r => setTimeout(r, 8000))]);
    const privacyBtn = $('#adPrivacyBtn');
    if (privacyBtn) privacyBtn.hidden = !TP.ads?.status.privacyOptionsRequired;
    if (store.state.activeRun) return;
    if (TP.tutorial?.shouldAutoStart()) {
      await afterSplash();
      homeOfferShown = true;          // 튜토리얼에서 SPECIAL OFFER 를 이미 보여 줌 → 이번 접속엔 자동 팝업 안 함
      showScreen('lobby');
      const r = await TP.tutorial.start();
      if (!r.skipped) await new Promise(res => setTimeout(res, 1800));   // 완료 보상 축포 · 안내를 본 뒤
    }
    showDailyBonus();
  }, 1600);

  // ?seed=123 으로 특정 판 고정 가능
  showScreen('lobby');
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  if (Number.isFinite(urlSeed) && urlSeed > 0) openEntry({ seed: urlSeed });
})();
