// 보드 화면(GameView): 카드 렌더링·애니메이션·터치 입력·콤보 상자 UI.
// 규칙 판단은 전부 TriPeaksGame에 맡기고, 재화·정산 같은 메타 기능은 app.js가 붙인다.
(function () {
  const { TP } = globalThis;
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  const $ = sel => document.querySelector(sel);

  const FLY_MS = 220; // 카드 비행 시간 (0.22초)

  TP.createCardEl = function (card, faceUp) {
    const div = document.createElement('div');
    div.className = 'card' + (faceUp ? '' : ' face-down');
    let front;
    if (card.special === 'bonus') {
      // +1 덱 보너스 카드 (game_assets/card_plus1.webp)
      front = `<div class="face front img bonus" role="img" aria-label="${T('덱 +1 보너스 카드')}" style="background-image:url('${TP.ASSETS.cardPlus[1]}')"></div>`;
    } else {
      // 숫자 카드·와일드는 이미지 (game_assets/card_*.webp). 무늬는 규칙과 무관해 그림 하나로 공용.
      const label = card.wild || card.special === 'wild' ? T('와일드 카드') : `${TP.rankLabel(card.rank)}${card.suit}`;
      const src = TP.cardImage(card);
      front = `<div class="face front img" role="img" aria-label="${label}"${src ? ` style="background-image:url('${src}')"` : ''}></div>`;
    }
    div.innerHTML = `<div class="card-inner">${front}<div class="face back"></div></div>`;
    return div;
  };

  // 콤보 목표 보상 표시: 덱 +1~3 (목표 5·7) / 덱 +5 · 와일드 · 되돌리기 (목표 10·15)
  TP.chestRewardLabel = reward => (reward.wildItem ? T('와일드카드') : reward.undoItem ? T('되돌리기') : T('덱 +{n}장', { n: reward.cards }));
  // 콤보 게이지 끝 보상 아이콘: 와일드 → 와일드카드 그림, 되돌리기 → 되돌리기 아이템, 덱 추가 → +N 카드 그림
  TP.chestRewardImage = reward => (reward.wildItem ? TP.ASSETS.cardWild : reward.undoItem ? TP.ASSETS.btnUndo
    : TP.plusCardImage(reward.cards || 1));

  // 덱 빛남 힌트(낼 카드가 없을 때 덱을 깜빡여 알려 줌)는 이 레벨까지만.
  // 그 뒤로는 스스로 판단해 덱을 뽑거나 되돌리기·와일드를 전략적으로 쓰게 한다.
  TP.STUCK_HINT_MAX_LEVEL = 2;
  // 낼 수 있는 카드 빛남(금색 테두리) · 낼 수 없는 카드 어둡게 — 이것도 Lv.1~2에서만 (Lv.3부터는 직접 숫자를 보고 판단)
  TP.PLAYABLE_HINT_MAX_LEVEL = 2;
  TP.playableHintEnabled = () => ((TP.store && TP.store.state.playerLevel) || 1) <= TP.PLAYABLE_HINT_MAX_LEVEL;
  TP.stuckHintEnabled = () => ((TP.store && TP.store.state.playerLevel) || 1) <= TP.STUCK_HINT_MAX_LEVEL;

  // 오가닉 보드 배치 (v2 손맛 업데이트): 카드가 바둑판처럼 반듯하지 않게 -4°~+4° 비틀림.
  // 같은 판·같은 자리는 항상 같은 각도 (되돌리기·다시 그리기에도 흔들리지 않게 seed로 고정)
  TP.cardTilt = function (seed, slot) {
    let h = (Math.imul((seed >>> 0) ^ 0x9e3779b9, 31) + Math.imul(slot + 1, 2654435761)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return Math.round(((h % 8001) / 1000 - 4) * 10) / 10;   // -4.0 ~ +4.0
  };

  TP.createGameView = function ({ onEnd, onChange, onChest }) {
    const el = {
      tableau: $('#tableau'), stock: $('#stock'), waste: $('#waste'), mascot: $('#mascot'),
      stockCount: $('#stockCount'), remain: $('#hudRemain'), combo: $('#hudCombo'),
      seed: $('#hudSeed'), message: $('#message'),
      chest: $('#chest'), chestFill: $('#chestFill'), chestText: $('#chestText'), chestReward: $('#chestReward'),
      chestRewardIcon: $('#chestRewardIcon'), wildBtn: $('#btnWild'), undoBtn: $('#btnUndo'),
      fx: $('#fxLayer'),
    };

    let game = null;
    let deal = null;
    let layout = null;
    let slotEls = [];
    let busy = false;        // 카드 이동 애니메이션 중에는 입력 무시
    let autoTimer = null;    // 정답 수순 자동 재생 타이머

    function retrigger(node, cls) {
      node.classList.remove(cls);
      void node.offsetWidth;
      node.classList.add(cls);
    }

    // 요소를 target 위치까지 날려 보낸다: 0.22초 동안 살짝 커지고(scale 1.08) 기울며 날아가 착지.
    // 진행은 애니메이션 완료 이벤트가 아니라 타이머로 한다 (탭이 가려져 프레임이 멈춰도 게임이 멈추지 않게).
    // 플라잉 카드: 보드의 비틀린 각도에서 출발해 위로 솟았다가(포물선) 액티브 자리에 0°로 착지
    function flyTo(node, target) {
      const a = node.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      const tilt = dx >= 0 ? 12 : -12;
      const rot = parseFloat(node.style.getPropertyValue('--rot')) || 0;
      const lift = Math.max(b.height * 0.55, Math.abs(dx) * 0.18);   // 멀리 갈수록 더 높이 포물선
      node.classList.add('flying');
      node.animate(
        [
          { transform: 'translate(0, 0) scale(1) rotate(0deg)', rotate: `${rot}deg` },
          { transform: `translate(${dx * 0.5}px, ${Math.min(0, dy) * 0.5 - lift}px) scale(1.12) rotate(${tilt}deg)`, rotate: `${rot / 2}deg`, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(0deg)`, rotate: '0deg' },
        ],
        { duration: FLY_MS, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }
      );
      return new Promise(resolve => setTimeout(resolve, FLY_MS));
    }

    // 콤보 별가루: 착지한 자리에서 별(⭐)이 상단 콤보 게이지로 날아감
    function comboStars(rect, combo) {
      const [x0, y0] = fxCenter(rect);
      const [x1, y1] = fxCenter(el.chest.getBoundingClientRect());
      const n = Math.min(1 + Math.floor(combo / 2), 5);
      for (let i = 0; i < n; i++) {
        const s = document.createElement('img');
        s.className = 'combo-star';
        s.src = 'game_assets/icons/star.webp';
        s.alt = '';
        s.style.left = `${x0}px`;
        s.style.top = `${y0}px`;
        el.fx.append(s);
        const spread = (i - (n - 1) / 2) * 40;
        const midX = (x1 - x0) * 0.35 + spread;
        const midY = Math.min(0, y1 - y0) * 0.5 - 60 - Math.random() * 40;
        s.animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
            { transform: `translate(calc(-50% + ${midX}px), calc(-50% + ${midY}px)) scale(1.3) rotate(160deg)`, opacity: 1, offset: 0.4 },
            { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(0.6) rotate(360deg)`, opacity: 0.2 },
          ],
          { duration: 650 + i * 70, delay: i * 50, easing: 'cubic-bezier(.4,.1,.5,1)', fill: 'forwards' }
        ).finished.then(() => { s.remove(); retrigger(el.chest, 'lit'); }).catch(() => s.remove());
      }
    }

    // 마스코트(탐정 조수 고양이) 리액션: 카드를 맞힐 때마다 폴짝
    function mascotHappy() {
      if (el.mascot) retrigger(el.mascot, 'happy');
    }

    // 엔드게임 축포: 클리어 시 덱에 남은 카드 수만큼 골드가 허공으로 터져 오름 (덱 숫자도 하나씩 줄어듦)
    function stockFireworks(count) {
      if (!count || !el.stock.isConnected) return Promise.resolve();
      const gap = Math.max(45, Math.min(100, 2400 / count));   // 많아도 2.4초 안에 끝나게
      const rect = el.stock.getBoundingClientRect();
      const [x, y] = fxCenter(rect);
      return new Promise(resolve => {
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            const coin = document.createElement('img');
            coin.className = 'gold-burst';
            coin.src = i % 3 === 2 ? 'game_assets/icon_gold_s.webp' : 'game_assets/icon_gold.webp';
            coin.alt = '';
            coin.style.left = `${x}px`;
            coin.style.top = `${y - rect.height * 0.3}px`;
            el.fx.append(coin);
            const tx = (Math.random() * 2 - 1) * el.fx.clientWidth * 0.12;
            const ty = -(el.fx.clientHeight * (0.18 + Math.random() * 0.22));
            coin.animate(
              [
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx * 0.6}px), calc(-50% + ${ty}px)) scale(1.4) rotate(${tx > 0 ? 25 : -25}deg)`, opacity: 1, offset: 0.55 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty * 0.75}px)) scale(0.9)`, opacity: 0 },
              ],
              { duration: 800, easing: 'cubic-bezier(.25,1,.5,1)', fill: 'forwards' }
            ).finished.then(() => coin.remove()).catch(() => coin.remove());
            el.stockCount.textContent = count - i - 1;
            const back = el.stock.firstElementChild;
            if (count - i - 1 < 5 && back) back.remove();
            retrigger(el.stock, 'bump');
            TP.audio?.sfx('coin', { i });
            if (i === count - 1) setTimeout(resolve, 500);
          }, i * gap);
        }
      });
    }

    // ---------- 손맛 이펙트 (fx 레이어 위에 그림) ----------
    function fxCenter(rect) {
      const base = el.fx.getBoundingClientRect();
      return [rect.left - base.left + rect.width / 2, rect.top - base.top + rect.height / 2];
    }

    // "+N COMBO" 가 떠오르며 사라짐
    function comboPop(rect, combo) {
      const [x, y] = fxCenter(rect);
      const pop = document.createElement('div');
      pop.className = 'combo-pop' + (combo >= 8 ? ' fire' : combo >= 4 ? ' hot' : '');
      pop.style.left = `${x}px`;
      pop.style.top = `${y - rect.height * 0.3}px`;
      pop.style.setProperty('--lv', Math.min(combo, 10));
      pop.textContent = `+${combo} COMBO`;
      el.fx.append(pop);
      setTimeout(() => pop.remove(), 950);
    }

    // 착지 지점에서 반짝이 튀기기
    function sparks(rect, count = 8) {
      const [x, y] = fxCenter(rect);
      const reach = el.fx.clientHeight * 0.07;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = reach * (0.6 + Math.random() * 0.6);
        const s = document.createElement('i');
        s.className = 'spark';
        s.style.left = `${x}px`;
        s.style.top = `${y}px`;
        s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
        el.fx.append(s);
        setTimeout(() => s.remove(), 500);
      }
    }

    // ---------- 시작 ----------
    // saved: game.serialize() 결과 — 튕긴 판을 그 상태 그대로 이어서 (없으면 새 판)
    function start(newDeal, saved) {
      stopAutoplay();
      deal = newDeal;
      layout = TP.getLayout(deal.layoutId);
      game = new TP.TriPeaksGame(layout, deal);
      if (saved) game.load(saved);
      game.on('play', onPlay);
      game.on('draw', onDraw);
      game.on('wild', onWildItem);
      // 효과음 (settings.js — 설정에서 끄거나 볼륨 조절)
      //   보드 카드: card_flip (콤보가 오를수록 높게) · +1 카드: plus_card · 보드 와일드: wild_card · 콤보 목표 달성: bonus
      game.on('play', e => {
        TP.audio?.sfx(e.kind === 'bonus' ? 'plus' : e.kind === 'wild' ? 'wild' : 'play', { combo: e.combo });
        if (e.chest) setTimeout(() => TP.audio?.sfx('chest'), 120);
      });
      game.on('draw', () => TP.audio?.sfx('draw'));
      game.on('wild', () => TP.audio?.sfx('wild'));
      game.on('undo', () => TP.audio?.sfx('undo'));
      setTimeout(() => TP.audio?.sfx('deal'), 450);      // 카드 깔기 (입장 효과음 뒤에)
      game.on('stock', onStockAdded);
      game.on('undo', onUndo);
      const thisGame = game;
      game.on('end', e => {
        stopAutoplay();
        // 카드가 날아간 뒤에 알림. 그 사이 되돌리기 등으로 상태가 바뀌었으면 무시.
        setTimeout(() => {
          if (game === thisGame && game.status === e.status) onEnd(e);
        }, FLY_MS + 300);
      });

      // 레이아웃 크기에 맞춰 카드 크기 결정 (CSS 변수) — fitBoard 가 세이프 영역 · 최소 카드 크기를 반영
      document.documentElement.style.setProperty('--cols', layout.width);
      document.documentElement.style.setProperty('--rows', layout.height);
      fitBoard();

      busy = false;
      el.seed.textContent = deal.seed;
      renderBoard();
      renderWaste();
      refresh();
    }

    // 세이프 보드 영역(.board-area) 안에서 카드 크기를 정한다
    //   간격(pitch)은 항상 카드 너비 × 1.04 — 절대 압축하지 않는다. 압축하면 퍼즐상 덮지 않는 카드끼리 화면에서 겹쳐
    //   '열린 카드가 다른 카드 뒤에 깔린 것처럼' 보이기 때문. 대신 템플릿이 휴대폰 크기(폭 ≤ 8.2칸 · 높이 ≤ 1.85칸)에 맞게 설계돼 있다.
    //   카드 너비 = 영역에 꽉 차는 크기 (최소 너비 --card-min 을 목표로 하되, 넘치면 64px 까지만 줄인다)
    const CARD_RATIO = 260 / 180;
    function fitBoard() {
      if (!layout) return;
      const area = el.tableau.parentElement;
      if (!area || !area.classList.contains('board-area')) return;
      if (!area.clientWidth || !area.clientHeight) return;
      // 기울기(±30°)와 흩어짐(±2%)으로 카드가 논리 사각형 밖으로 삐져나오므로 영역 가장자리에 여유를 둔다
      const aw = area.clientWidth * 0.96, ah = area.clientHeight * 0.9;      // 기울기(±5°) 여유
      const minW = parseFloat(getComputedStyle(el.tableau.closest('.screen') || area).getPropertyValue('--card-min')) || 75;
      const cols = layout.width, rows = layout.height;
      const GAP = 1.04;                                                       // 카드 사이 간격 4% (논리 좌표 1칸 = 카드 1.04장)
      // 영역에 꽉 차는 카드 너비 (가로 · 세로 중 작은 쪽)
      const fitW = Math.min(aw / ((cols - 1) * GAP + 1), ah / (((rows - 1) * GAP + 1) * CARD_RATIO));
      const cardW = Math.max(64, Math.min(fitW, 150));
      if (cardW < minW) console.warn(`[layout] ${layout.id}: 카드 ${cardW.toFixed(0)}px < 최소 ${minW}px (보드 ${cols.toFixed(1)}×${rows.toFixed(1)}칸)`);
      const cardH = cardW * CARD_RATIO;
      const pitchX = cardW * GAP, pitchY = cardH * GAP;
      const st = el.tableau.style;
      st.setProperty('--card-w', `${cardW}px`);
      st.setProperty('--ch', `${cardH}px`);
      st.setProperty('--pitch-x', `${pitchX}px`);
      st.setProperty('--pitch-y', `${pitchY}px`);
      st.setProperty('--board-w', `${pitchX * (cols - 1) + cardW}px`);
      st.setProperty('--board-h', `${pitchY * (rows - 1) + cardH}px`);
    }
    if (typeof ResizeObserver !== 'undefined' && el.tableau.parentElement) new ResizeObserver(() => fitBoard()).observe(el.tableau.parentElement);

    function renderBoard() {
      el.tableau.replaceChildren();
      slotEls = layout.nodes.map(node => {
        const i = node.id;
        if (game.board[i].removed) return null;
        const cardEl = TP.createCardEl(game.board[i].card, game.isFaceUp(i));
        cardEl.style.setProperty('--x', node.x);
        cardEl.style.setProperty('--y', node.y);
        cardEl.style.setProperty('--z', node.z);
        cardEl.style.setProperty('--rot', `${TP.cardTilt(deal.seed, i) + (node.rot || 0)}deg`);   // 기본 기울기(부채) + 변형 ±5°
        if (node.jx) cardEl.style.setProperty('--jx', node.jx);                                       // ±2% 흩어짐 (표시 전용)
        if (node.jy) cardEl.style.setProperty('--jy', node.jy);
        cardEl.addEventListener('click', () => onSlotClick(i));
        el.tableau.append(cardEl);
        return cardEl;
      });
    }

    function renderWaste() {
      el.waste.replaceChildren(TP.createCardEl(game.activeCard, true));
    }

    // ---------- 입력 ----------
    function onSlotClick(i) {
      if (busy || autoTimer) return;
      if (!game.play(i)) { retrigger(slotEls[i], 'shake'); TP.audio?.sfx('error'); } // 낼 수 없는 카드: 0.15초 부르르
    }

    el.stock.addEventListener('click', () => {
      if (game && !busy && !autoTimer) game.draw();
    });

    // ---------- 게임 이벤트 → 화면 ----------
    function onPlay({ slot, kind, chest, combo }) {
      busy = true;
      const node = slotEls[slot];
      slotEls[slot] = null;
      node.classList.remove('playable', 'dim');
      comboPop(node.getBoundingClientRect(), combo);
      retrigger(el.chest, 'lit');   // 콤보 게이지 점등
      mascotHappy();
      refreshHud();
      // +1 보너스 카드는 덱으로, 나머지는 액티브 카드 자리로 날아간다
      const target = kind === 'bonus' ? el.stock : el.waste;
      flyTo(node, target).then(() => {
        node.remove();
        if (kind === 'bonus') retrigger(el.stock, 'bump');
        else {
          renderWaste();
          retrigger(el.waste, 'land'); // 착지: 슬롯이 1.0 → 0.95 → 1.0
          sparks(el.waste.getBoundingClientRect());
          comboStars(el.waste.getBoundingClientRect(), combo);
        }
        if (chest) openChest(chest);
        busy = false;
        refresh(); // 새로 드러난 카드는 face-down 클래스가 빠지면서 뒤집힌다
      });
    }

    // 콤보 목표 달성: 보상 아이콘이 게이지 끝 소켓에서 튀어나와
    //   와일드 → 와일드 버튼 / 되돌리기 → 되돌리기 버튼 (아이템 UI) · 덱 +N → 하단 덱(Stock)으로 포물선을 그리며 날아가 꽂힌다.
    //   도착하는 순간 덱 숫자가 늘고(덱) / 아이템이 지급된다 — onChest({ type, value, target }) → app.js 의 comboReward 처리
    const REWARD_FLY_MS = 650;
    function openChest(chest) {
      const thisGame = game;
      const ev = TP.comboRewardEvent(chest);          // { type: 'plus_cards' | 'wild' | 'undo', value, target }
      const target = ev.type === 'wild' ? el.wildBtn : ev.type === 'undo' ? el.undoBtn : el.stock;
      const src = TP.chestRewardImage(chest.reward);
      const from = el.chestRewardIcon.getBoundingClientRect();
      retrigger(el.chest, 'opened');
      // 소켓에는 다음 보상 아이콘이 톡 하고 새로 들어옴
      retrigger(el.chestRewardIcon, 'pop-in');

      if (!target || !target.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (chest.reward.cards) retrigger(el.stock, 'bump');
        onChest?.(ev);
        return;
      }
      // 덱 숫자는 도착할 때 늘어난 것처럼 보이게
      if (chest.reward.cards) el.stockCount.textContent = Math.max(0, game.stockCount - chest.reward.cards);

      const to = target.getBoundingClientRect();
      const [x0, y0] = fxCenter(from);
      const [x1, y1] = fxCenter(to);
      const fly = document.createElement('img');
      fly.className = 'reward-fly';
      fly.src = src;
      fly.alt = '';
      fly.style.left = `${x0}px`;
      fly.style.top = `${y0}px`;
      fly.style.height = `${from.height}px`;
      el.fx.append(fly);
      const dx = x1 - x0;
      const dy = y1 - y0;
      fly.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', offset: 0 },
          { transform: 'translate(-50%, -50%) translateY(-40%) scale(1.7) rotate(-8deg)', offset: 0.18 },   // 소켓에서 튀어나옴
          { transform: `translate(-50%, -50%) translate(${dx * 0.45}px, ${dy * 0.35 - 40}px) scale(1.5) rotate(${dx < 0 ? -200 : 200}deg)`, offset: 0.55 },
          { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.9) rotate(360deg)`, offset: 1 },
        ],
        { duration: REWARD_FLY_MS, easing: 'cubic-bezier(.35,.05,.45,1)', fill: 'forwards' }
      );
      // 꼬리 별가루
      for (let i = 1; i <= 3; i++) {
        setTimeout(() => {
          if (!fly.isConnected) return;
          const r = fly.getBoundingClientRect();
          sparks(r, 4);
        }, REWARD_FLY_MS * (0.25 * i));
      }
      setTimeout(() => {
        fly.remove();
        if (game !== thisGame) return;   // 그 사이 판이 바뀌었으면 무시
        retrigger(target, 'bump');
        sparks(to, 10);
        retrigger(target, 'reward-hit');
        onChest?.(ev);                   // comboReward 지급 · 안내 (app.js)
        refresh();                       // 덱 숫자 실제 값으로
      }, REWARD_FLY_MS);
    }

    function onDraw({ card }) {
      busy = true;
      const node = TP.createCardEl(card, false);
      el.waste.replaceChildren(node);
      const a = el.stock.getBoundingClientRect();
      const b = el.waste.getBoundingClientRect();
      node.animate(
        [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }],
        { duration: FLY_MS, easing: 'ease-out' }
      );
      void node.offsetWidth;
      node.classList.remove('face-down'); // 날아오면서 앞면으로 뒤집힘
      refresh();
      setTimeout(() => {
        busy = false;
        retrigger(el.waste, 'land');
      }, FLY_MS);
    }

    function onWildItem() {
      renderWaste();
      el.waste.firstChild.classList.add('pop-in');
      refresh();
    }

    function onStockAdded() {
      retrigger(el.stock, 'bump');
      refresh();
    }

    function onUndo() {
      renderBoard();
      renderWaste();
      refresh();
    }

    // ---------- 상태 반영 ----------
    function refresh() {
      el.tableau.classList.toggle('no-play-hint', !TP.playableHintEnabled());
      game.board.forEach((s, i) => {
        if (!slotEls[i]) return;
        const faceUp = game.isFaceUp(i);
        const playable = game.canPlay(i);
        slotEls[i].classList.toggle('face-down', !faceUp);
        // 그리는 순서: 앞면 카드는 항상 모든 뒷면 카드 위층.
        //   좁은 화면에서는 카드를 줄이지 않고 간격을 좁혀 겹치므로, 퍼즐상 서로 덮지 않는 카드끼리도 화면에서 겹친다.
        //   앞면 = 덮고 있던 카드가 다 치워진 카드라 맨 위로 올려도 규칙과 어긋나지 않고,
        //   '앞면이 뒷면 밑에 깔려 보이는' 일(= 낼 수 있는데 가려진 것처럼 보임)이 없어진다.
        slotEls[i].style.setProperty('--z', (faceUp ? 1000 : 0) + layout.nodes[i].z);
        slotEls[i].classList.toggle('playable', playable);
        slotEls[i].classList.toggle('dim', faceUp && !playable); // 앞면이지만 지금은 낼 수 없는 카드
      });

      const stockN = game.stockCount;
      el.stock.replaceChildren();
      el.stock.classList.toggle('empty', stockN === 0);
      // 덱: 남은 장수만큼(최대 5장) 뒷면을 살짝 어긋나게 겹쳐 쌓는다
      for (let i = Math.min(stockN, 5) - 1; i >= 0; i--) {
        const back = TP.createCardEl({ rank: 0, suit: '' }, false);
        back.style.setProperty('--i', i);
        el.stock.append(back);
      }

      const status = game.status;
      const stuck = status === 'playing' && !game.hasPlayableCard();
      const hint = stuck && TP.stuckHintEnabled();   // Lv.3부터는 덱 빛남·안내 문구 없음
      el.stock.classList.toggle('nudge', hint);
      el.message.textContent =
        hint ? T('낼 카드가 없어요. 덱을 터치해 한 장 뽑으세요.')
        : status === 'lost' ? T('덱이 바닥났어요!')
        : game.activeCard.wild ? T('와일드! 앞면 카드 아무거나 낼 수 있어요.')
        : '';
      refreshHud();
    }

    function refreshHud() {
      el.remain.textContent = game.remaining;
      el.combo.textContent = game.combo;
      el.stockCount.textContent = game.stockCount;

      // 콤보 상자 게이지
      const chest = game.currentChest;
      el.chestFill.style.width = `${(game.gauge / chest.target) * 100}%`;
      el.chestText.textContent = game.goalReached ? `${chest.target} ✔` : `${game.gauge}/${chest.target}`;
      el.chest.classList.toggle('reached', game.goalReached);
      el.chestReward.textContent = TP.chestRewardLabel(chest.reward);
      const icon = TP.chestRewardImage(chest.reward);
      if (!el.chestRewardIcon.src.endsWith(icon)) el.chestRewardIcon.src = icon;
      el.chestRewardIcon.alt = TP.chestRewardLabel(chest.reward);
      el.chest.dataset.reward = chest.reward.wildItem ? 'wild' : chest.reward.undoItem ? 'undo' : 'cards';
      el.chest.classList.toggle('almost', game.gauge > 0 && chest.target - game.gauge <= 1);
      onChange?.();
    }

    // ---------- 정답 수순 자동 재생 (개발자 확인용) ----------
    function playSolution() {
      start(deal);
      const moves = deal.solution.slice();
      autoTimer = setInterval(() => {
        if (busy) return;
        const move = moves.shift();
        if (!move) return stopAutoplay();
        if (move.type === 'play') game.play(move.slot);
        else game.draw();
      }, FLY_MS + 80);
    }

    function stopAutoplay() {
      clearInterval(autoTimer);
      autoTimer = null;
    }

    return {
      start,
      playSolution,
      get game() { return game; },
      get deal() { return deal; },
      get ready() { return !!game && !busy && !autoTimer; },
      undo() { return this.ready ? game.undo() : null; },
      useWild() { return this.ready ? game.useWild() : false; },
      addCards(n) { game.addCards(n); },
      buyCards(n) { game.buyCards(n); },
      stockFireworks,
      grantAdExtraCards(n) { return game.grantAdExtraCards(n); },
    };
  };
})();
