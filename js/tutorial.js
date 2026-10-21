// =====================================================================
// 첫 실행 튜토리얼 — 탐정 고양이 말풍선 + 스포트라이트 + 연습 테이블 (끝까지 보면 🪙 500)
// =====================================================================
//   순서: 환영 → 연습 테이블(±1 · K-A 순환 · 덱 뽑기) → 로비 안내(에피소드 · 단서 · 추리 수첩 직접 열기 · 하트 ·
//         별 · 연승 · 칭호 · 사건 파일 · 상점 · SPECIAL OFFER 미리보기) → 완료 보상
//   - 'tap' 단계는 스포트라이트 안의 진짜 버튼만 누를 수 있다 (나머지는 막음). 'next' 단계는 말풍선의 [다음].
//   - [건너뛰기] 는 확인 후 끝 (보상 없음). 설정 → [튜토리얼 다시 보기] 로 언제든 다시 (보상은 한 번만).
//   - 저장: store.tutorialDone (다시 자동으로 띄우지 않음) · store.tutorialRewarded (500G 를 받았는지)
//
//   TP.tutorial.shouldAutoStart(state) · start({ replay }) → Promise(끝나면) · active · claimReward()
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  const REWARD_GOLD = 500;
  const MASCOT = 'game_assets/mascot_cat.webp';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- 상태 (DOM 없이도 테스트 가능) ----------
  const shouldAutoStart = (state = TP.store.state) => !state.tutorialDone && !state.activeRun;
  // 끝까지 본 보상: 계정당 한 번
  function claimReward() {
    if (TP.store.state.tutorialRewarded) return { ok: false, gold: 0 };
    TP.store.update(s => { s.tutorialRewarded = true; s.tutorialDone = true; });
    TP.store.grant({ gold: REWARD_GOLD });
    return { ok: true, gold: REWARD_GOLD };
  }
  const markDone = () => TP.store.update(s => { s.tutorialDone = true; });

  // ---------- 화면 ----------
  let root = null, active = false;
  const stage = () => TP.ui.root();
  const $ = sel => document.querySelector(sel);
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function build() {
    root = document.createElement('div');
    root.className = 'tut';
    root.innerHTML = `
      <div class="tut-shade"></div>
      <div class="tut-block top"></div><div class="tut-block bottom"></div><div class="tut-block left"></div><div class="tut-block right"></div>
      <div class="tut-hole" hidden></div>
      <div class="tut-panel" hidden></div>
      <div class="tut-bubble" role="dialog" aria-live="polite">
        <img class="tut-mascot" src="${MASCOT}" alt="">
        <div class="tut-card">
          <div class="tut-head"><b class="tut-title"></b><small class="tut-step"></small></div>
          <p class="tut-text"></p>
          <div class="tut-actions">
            <button class="tut-skip">${T('건너뛰기')}</button>
            <button class="tut-next">${T('다음')}</button>
          </div>
        </div>
      </div>`;
    stage().append(root);
    root.querySelector('.tut-skip').onclick = () => onSkip?.();
  }
  let onSkip = null;

  // 대상 요소의 사각형 (스테이지 기준 px)
  function rectOf(el, pad = 8) {
    const s = stage().getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - s.left - pad, y: r.top - s.top - pad, w: r.width + pad * 2, h: r.height + pad * 2, sw: s.width, sh: s.height };
  }

  // 스포트라이트: 구멍 + 그 밖을 막는 네 조각 (tap 단계는 구멍만 누를 수 있음, next 단계는 전부 막음)
  let current = null;   // 지금 비추는 대상 (화면 크기가 바뀌면 다시 계산)
  function spotlight(el, { clickable = false } = {}) {
    current = el ? { el, clickable } : null;
    const hole = root.querySelector('.tut-hole');
    const shade = root.querySelector('.tut-shade');
    const blocks = [...root.querySelectorAll('.tut-block')];
    if (!el) {
      hole.hidden = true;
      shade.hidden = false;
      blocks.forEach(b => { b.style.cssText = 'left:0;top:0;width:100%;height:100%'; b.hidden = false; });
      return null;
    }
    const r = rectOf(el);
    shade.hidden = true;
    hole.hidden = false;
    Object.assign(hole.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    const [top, bottom, left, right] = blocks;
    blocks.forEach(b => { b.hidden = false; });
    Object.assign(top.style, { left: 0, top: 0, width: '100%', height: `${Math.max(0, r.y)}px` });
    Object.assign(bottom.style, { left: 0, top: `${r.y + r.h}px`, width: '100%', height: `${Math.max(0, r.sh - r.y - r.h)}px` });
    Object.assign(left.style, { left: 0, top: `${r.y}px`, width: `${Math.max(0, r.x)}px`, height: `${r.h}px` });
    Object.assign(right.style, { left: `${r.x + r.w}px`, top: `${r.y}px`, width: `${Math.max(0, r.sw - r.x - r.w)}px`, height: `${r.h}px` });
    if (!clickable) Object.assign(blocks[0].style, { height: '100%' });   // 다음 단계: 구멍까지 막음 (위 조각을 전체로)
    return r;
  }

  // 말풍선 위치: 대상이 있으면 그 위나 아래 (공간이 넓은 쪽), 없으면 가운데 아래
  function placeBubble(r, where) {
    const b = root.querySelector('.tut-bubble');
    b.classList.remove('at-top', 'at-bottom', 'at-center');
    b.style.left = b.style.top = b.style.bottom = '';
    if (where === 'top') { b.classList.add('at-top'); return; }
    if (!r) { b.classList.add(where === 'center' ? 'at-center' : 'at-bottom'); return; }
    const sw = r.sw, sh = r.sh;
    const bw = b.offsetWidth || sw * 0.5, bh = b.offsetHeight || sh * 0.3;
    const below = r.y + r.h + 12, above = r.y - bh - 12;
    const top = sh - (r.y + r.h) > r.y ? Math.min(below, sh - bh - 8) : Math.max(8, above);
    const left = Math.min(Math.max(8, r.x + r.w / 2 - bw / 2), sw - bw - 8);
    Object.assign(b.style, { left: `${left}px`, top: `${top}px` });
  }

  // 말풍선 내용 + 버튼 → [다음] 을 누르면 resolve ('next' 단계)
  function say({ title = '', text, step, next = T('다음'), showNext = true, skip = true }) {
    root.querySelector('.tut-title').textContent = title;
    root.querySelector('.tut-step').textContent = step || '';
    root.querySelector('.tut-text').innerHTML = text;
    const nb = root.querySelector('.tut-next');
    nb.textContent = next;
    nb.hidden = !showNext;
    root.querySelector('.tut-skip').hidden = !skip;
    const card = root.querySelector('.tut-card');
    card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    return new Promise(resolve => { nb.onclick = () => { TP.audio?.sfx?.('choose'); resolve('next'); }; });
  }

  // 대상 요소가 눌릴 때까지 (진짜 버튼의 동작은 그대로 실행됨)
  const waitTap = el => new Promise(resolve => el.addEventListener('click', () => resolve('tap'), { once: true, capture: true }));
  async function waitFor(fn, timeout = 4000) {
    for (let t = 0; t < timeout; t += 100) { if (fn()) return true; await sleep(100); }
    return false;
  }

  // ---------- 연습 테이블 (±1 · K-A 순환 · 덱) ----------
  //   카드 그림은 게임과 같은 TP.cardImage. rank: 1(A) ~ 13(K)
  function practice(panel, stepLabel) {
    const label = r => (TP.rankLabel ? TP.rankLabel(r) : String(r));
    const img = r => (TP.cardImage ? TP.cardImage({ rank: r }) : '');
    let open = 7;
    panel.hidden = false;
    panel.innerHTML = `
      <div class="tp-title">${T('연습 테이블')}</div>
      <div class="tp-board"></div>
      <div class="tp-bottom">
        <div class="tp-deck" title="${T('덱')}"><div class="tp-card tp-back"></div><div class="tp-card tp-back"></div><div class="tp-card tp-back"></div><small>${T('덱')}</small></div>
        <div class="tp-open"><div class="tp-card"></div><small>${T('열린 카드')}</small></div>
      </div>`;
    const board = panel.querySelector('.tp-board');
    const openEl = panel.querySelector('.tp-open .tp-card');
    const deckEl = panel.querySelector('.tp-deck');
    const setOpen = r => { open = r; openEl.style.backgroundImage = `url('${img(r)}')`; openEl.setAttribute('aria-label', label(r)); openEl.classList.remove('land'); void openEl.offsetWidth; openEl.classList.add('land'); };
    setOpen(open);

    // 보드에 카드 몇 장 → 맞는 카드를 누를 때까지. 틀리면 흔들고 안내
    function round(ranks, valid, { title, text, done }) {
      board.replaceChildren(...ranks.map(r => {
        const c = document.createElement('button');
        c.className = 'tp-card tp-face';
        c.style.backgroundImage = `url('${img(r)}')`;
        c.setAttribute('aria-label', label(r));
        c.dataset.rank = r;
        return c;
      }));
      say({ title, text, step: stepLabel(), showNext: false });
      return new Promise(resolve => {
        board.onclick = e => {
          const c = e.target.closest('.tp-card');
          if (!c) return;
          const r = Number(c.dataset.rank);
          if (!valid.includes(r)) {
            TP.audio?.sfx?.('error');
            c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
            root.querySelector('.tut-text').innerHTML = T('<b>{b}</b> → <b>{a}</b> ✕ 숫자 차이가 1이 아니에요. 1 크거나 1 작은 카드를 찾아보세요!', { a: label(r), b: label(open) });
            return;
          }
          board.onclick = null;
          TP.audio?.sfx?.('play');
          c.classList.add('fly');
          setTimeout(() => { c.style.visibility = 'hidden'; setOpen(r); }, 260);
          root.querySelector('.tut-text').innerHTML = done(r);
          setTimeout(() => resolve(r), 1300);
        };
      });
    }

    return (async () => {
      await round([3, 8, 12], [8], {
        title: T('카드 규칙 ① +1'),
        text: T('아래 <b>열린 카드</b>는 <b>7</b>이에요. 열린 카드보다 숫자가 <b>1 크거나 1 작은</b> 카드를 낼 수 있어요.<br>낼 수 있는 카드를 눌러 보세요!'),
        done: () => T('좋아요! <b>7 → 8</b> (+1). 이제 8이 열린 카드가 됐어요.'),
      });
      await round([4, 7, 13], [7], {
        title: T('카드 규칙 ② −1'),
        text: T('이번엔 한 칸 아래로! <b>8</b> 다음에는 <b>7</b>도 낼 수 있어요 (−1).'),
        done: () => T('맞아요! 위로든 아래로든 <b>1 차이</b>면 계속 이어 낼 수 있어요. 연달아 내면 <b>콤보</b>!'),
      });
      setOpen(1);
      const picked = await round([2, 9, 13], [2, 13], {
        title: T('카드 규칙 ③ A는 2와 K 사이'),
        text: T('열린 카드가 <b>A</b>예요. 숫자는 동그랗게 이어져서 <b>A 다음은 2</b>, <b>A 전은 K</b>예요.<br>둘 중 아무거나 골라 보세요!'),
        done: r => (r === 13 ? T('<b>A → K</b>! 2를 냈어도 정답이에요. 이제 K 다음에는 <b>Q</b>나 <b>A</b>를 낼 수 있어요.') : T('<b>A → 2</b>! K를 냈어도 정답이에요. 이제 2 다음에는 <b>3</b>이나 <b>A</b>를 낼 수 있어요.')),
      });
      // 덱: 낼 카드가 없으면 덱에서 새 카드를 연다
      board.replaceChildren(...[5, 10].map(r => {
        const c = document.createElement('button');
        c.className = 'tp-card tp-face';
        c.style.backgroundImage = `url('${img(r)}')`;
        c.dataset.rank = r;
        return c;
      }));
      deckEl.classList.add('pulse');
      say({
        title: T('카드 규칙 ④ 덱'),
        text: T('지금 열린 카드는 <b>{c}</b>. 보드의 5와 10은 이어지지 않아요.<br>낼 카드가 없으면 왼쪽 <b>덱</b>을 눌러 새 카드를 펼쳐요!', { c: label(picked) }),
        step: stepLabel(), showNext: false,
      });
      board.onclick = e => {
        const c = e.target.closest('.tp-card');
        if (!c) return;
        TP.audio?.sfx?.('error');
        c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
      };
      await new Promise(resolve => { deckEl.onclick = () => { deckEl.onclick = null; resolve(); }; });
      deckEl.classList.remove('pulse');
      TP.audio?.sfx?.('draw');
      setOpen(6);
      await round([5, 10], [5], {
        title: T('카드 규칙 ④ 덱'),
        text: T('덱에서 <b>6</b>이 나왔어요! 이제 낼 수 있는 카드를 눌러 보세요.'),
        done: () => T('완벽해요! 단, 덱은 장수가 정해져 있으니 아껴 쓰는 게 좋아요.'),
      });
      board.replaceChildren();
      await say({
        title: T('스테이지 클리어'),
        text: T('보드의 카드를 <b>모두 치우면 스테이지 클리어</b>! 덱이 바닥나기 전에 다 치워야 해요.<br>막히면 <b>되돌리기</b>나 <b>와일드</b>(아무 숫자에나 이어지는 카드) 아이템을 쓸 수 있어요.'),
        step: stepLabel(),
      });
      panel.hidden = true;
      panel.innerHTML = '';
    })();
  }

  // ---------- 로비 안내 ----------
  function lobbySteps() {
    const offerOn = () => TP.homeOfferAvailable?.() && !$('#hudOffer')?.hidden;
    return [
      { sel: '#btnPlay', title: T('에피소드와 스테이지'), text: T('<b>PLAY</b>를 누르면 다음 스테이지가 시작돼요.<br>사건 하나(<b>에피소드</b>)는 <b>스테이지 20개</b>로 되어 있어요.') },
      { sel: '#lobbyClueBlock', title: T('단서 모으기'), text: T('스테이지를 깰 때마다 <b>단서 1개</b>를 얻어요.<br>단서 <b>20개</b>를 다 모으면 <b>범인을 지목</b>할 수 있어요!') },
      { sel: '#btnBoard', title: T('추리 수첩'), text: T('모은 단서는 <b>추리 수첩</b>에서 봐요.<br>버튼을 눌러 직접 열어 보세요!'), tap: true,
        after: () => waitFor(() => !$('#notebookModal').hidden) },
      { sel: '#nbClues', title: T('단서 읽기'), text: T('왼쪽에는 <b>사건 개요</b>와 지금까지 모은 <b>단서</b>가 쌓여요. 새 단서는 반짝이며 표시돼요.'), pad: 4 },
      { sel: '#nbSuspects', title: T('용의자'), text: T('오른쪽은 <b>용의자</b>들이에요. 사진을 누르면 용의자 파일을 보고, <b>☆</b>(유력) · <b>✕</b>(제외)로 메모할 수 있어요.'), pad: 4 },
      { sel: '.board-tab[data-tab="grid"]', title: T('논리 그리드'), text: T('<b>논리 그리드</b>에서 단서를 <b>✕ · ○</b>로 정리하면 누가 어디서 무엇을 가졌는지 보여요.<br>범인 = <b>사건 현장</b>에서 <b>범행 도구</b>를 가진 사람!'),
        after: async () => { $('#nbClose')?.click(); await waitFor(() => $('#notebookModal').hidden, 1500); await sleep(250); } },
      { sel: '#sbEnergy', title: T('하트 (수사 생명력)'), text: T('스테이지에 들어갈 때마다 <b>하트 1개</b>를 써요.<br>하트는 <b>20분마다 1개씩</b> 다시 차고(최대 5개), 모자라면 광고나 골드로 채울 수 있어요.') },
      { sel: '#btnStages', title: T('별'), text: T('스테이지마다 <b>별을 최대 3개</b> 받아요.<br>★ 클리어 · ★★ 이어하기 없이 클리어 · ★★★ 거기에 덱을 넉넉히 남기고 클리어.<br>여기서 지난 스테이지를 다시 도전할 수 있어요.') },
      { sel: '#sbStreakChip', title: T('연승'), text: T('실패 없이 연속으로 깨면 <b>연승</b>이 쌓여요. 3 · 7 · 10 · 20 · 30 · 50연승마다 선물이 있어요!') },
      { sel: '.profile', title: T('탐정 칭호'), text: T('레벨이 오르고 사건을 해결할수록 <b>탐정 칭호</b>와 옷차림이 바뀌어요.<br>위쪽 <b>LEVEL</b>은 스테이지를 깨며 얻는 경험치로 올라요.') },
      { sel: '#hudEpisodes', title: T('사건 파일'), text: T('<b>사건 파일</b>에서 세계 여러 도시의 사건을 볼 수 있어요.<br>사건을 해결하면 다음 도시의 사건이 열려요.') },
      { sel: '#hudShop', title: T('상점'), text: T('<b>상점</b>에서는 골드, 찬스 팩(되돌리기 · 와일드), 힌트권, 광고 제거를 살 수 있어요.') },
      { sel: '#hudOffer', when: offerOn, title: T('SPECIAL OFFER'), text: T('가끔 <b>한정 판매</b> 특가가 찾아와요. 어떤 상품인지 한번 볼까요?'), next: T('보기'),
        after: async () => {
          spotlight(null); root.querySelector('.tut-shade').hidden = true;
          root.querySelectorAll('.tut-block').forEach(b => { b.hidden = true; });
          root.querySelector('.tut-bubble').classList.add('mini');
          placeBubble(null, 'top');
          say({ title: T('SPECIAL OFFER'), text: T('수사에 필요한 아이템을 반값에 묶은 특가예요. 마음에 들면 결제, 아니면 <b>✕</b>로 닫으면 돼요.'), step: '', showNext: false, skip: false });
          await TP.ui.showOfferPreview?.();
          root.querySelector('.tut-bubble').classList.remove('mini');
        } },
    ];
  }

  // ---------- 진행 ----------
  async function start({ replay = false } = {}) {
    if (active) return;
    active = true;
    build();
    let skipped = false;
    onSkip = async () => {
      root.hidden = true;   // 확인 창(일반 모달)이 튜토리얼 층 아래에 뜨므로 잠시 숨김
      const ok = await TP.ui.confirm({
        title: T('튜토리얼 건너뛰기'),
        message: TP.store.state.tutorialRewarded ? T('튜토리얼을 끝낼까요?\n설정에서 언제든 다시 볼 수 있어요.')
          : T('끝까지 보면 🪙 {n} 골드를 받을 수 있어요.\n그래도 건너뛸까요? (설정에서 다시 볼 수 있어요)', { n: REWARD_GOLD }),
        okLabel: T('건너뛰기'), cancelLabel: T('계속 보기'),
      });
      if (root) root.hidden = false;
      if (ok) { skipped = true; finishEarly(); }
    };
    let finishEarly;
    const aborted = new Promise(resolve => { finishEarly = resolve; });
    const run = async () => {
      const steps = lobbySteps().filter(s => !s.when || s.when());
      const total = 1 + 6 + steps.length;   // 환영 1 + 연습 6 + 로비
      let n = 0;
      const stepLabel = () => `${++n}/${total}`;
      // 1) 환영
      spotlight(null);
      placeBubble(null, 'center');
      await say({
        title: T('명탐정의 첫 사건!'),
        text: T('안녕하세요, 탐정님! 저는 조수 고양이예요. 🐾<br>카드를 맞춰 <b>단서</b>를 모으고, 세계 곳곳의 <b>사건</b>을 해결하는 법을 알려 드릴게요.<br>끝까지 보면 <b>🪙 {n} 골드</b>를 드려요!', { n: REWARD_GOLD }),
        step: stepLabel(), next: T('시작하기'),
      });
      // 2) 연습 테이블
      spotlight(null);
      placeBubble(null, 'bottom');
      await practice(root.querySelector('.tut-panel'), stepLabel);
      // 3) 로비 요소
      for (const s of steps) {
        const el = $(s.sel);
        if (!el || el.hidden || !el.getClientRects().length) continue;
        const r = spotlight(el, { clickable: !!s.tap });
        root.querySelector('.tut-hole').style.setProperty('--pad', `${s.pad ?? 8}px`);
        const tapped = s.tap ? waitTap(el) : null;
        const said = say({ title: s.title, text: s.text, step: stepLabel(), showNext: !s.tap, next: s.next });
        placeBubble(r);
        await (tapped || said);
        if (s.after) await s.after();
      }
      // 4) 완료
      spotlight(null);
      placeBubble(null, 'center');
      const first = !TP.store.state.tutorialRewarded;
      await say({
        title: T('튜토리얼 완료!'),
        text: first ? T('수고했어요, 탐정님! 이제 첫 사건을 해결하러 가 볼까요?<br>보상으로 <b>🪙 {n} 골드</b>를 드릴게요!', { n: REWARD_GOLD })
          : T('복습 끝! 이제 사건을 해결하러 가 볼까요?'),
        step: '', next: first ? T('보상 받기') : T('닫기'), skip: false,
      });
      if (first) {
        const r = claimReward();
        if (r.ok) {
          TP.audio?.sfx?.('collect');
          TP.ui.confettiAt?.(null, { particleCount: 90, origin: { x: 0.5, y: 0.45 } });
          TP.ui.toast?.(T('🎓 튜토리얼 완료 보상: 🪙 {n} 골드', { n: r.gold }));
        }
      }
    };
    await Promise.race([run(), aborted]);
    markDone();
    if (!$('#notebookModal')?.hidden && !TP.mystery?.isAccusationPhase?.()) $('#nbClose')?.click();
    root.remove();
    root = null;
    active = false;
    onSkip = null;
    return { skipped, replay };
  }

  globalThis.addEventListener?.('resize', () => {
    if (!root || !active || !current) return;
    placeBubble(spotlight(current.el, { clickable: current.clickable }));
  });

  TP.tutorial = {
    shouldAutoStart, claimReward, start, REWARD_GOLD,
    get active() { return active; },
  };
})();
