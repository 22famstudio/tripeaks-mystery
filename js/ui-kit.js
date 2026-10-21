// 공용 UI 도구: 모달 · 다이얼로그 · 확인창 · 토스트 · 이펙트 · (가짜) 보상형 광고 · 상점/스페셜 오퍼 모달
// app.js(게임 메타)와 notebook.js(탐정 수첩)가 함께 쓴다. 상품·결제 로직은 shop.js(TP.shop).
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  const $ = sel => document.querySelector(sel);

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 팝업을 붙일 곳: 16:9 스테이지 안 (레터박스 밖으로 나가지 않게). 없으면 body.
  const root = () => document.getElementById('stage') || document.body;

  let zTop = 300;
  // 패널 열기/닫기 효과음: open / exit (탐정 수첩은 notebook.js 가 책 소리를 따로 냄 · { silent: true } 면 무음)
  const openModal = (node, { silent = false } = {}) => {
    if (!silent && node.hidden && node.id !== 'notebookModal') TP.audio?.sfx?.('open');
    node.hidden = false;
    node.style.zIndex = ++zTop;
  };
  const closeModal = (node, { silent = false } = {}) => {
    if (!silent && !node.hidden && node.id !== 'notebookModal') TP.audio?.sfx?.('exit');
    node.hidden = true;
  };

  // 버튼 중 하나를 누르면 그 value로 resolve되는 다이얼로그
  //   buttons: [{ label, value, cls, disabled }]   footer: 버튼 아래에 붙는 안내 문구(HTML)
  //   art: 제목 위 일러스트 { src, cls }           framed: 파란 패널 팝업 프레임(frame_modal_popup_plain.webp) 사용 여부 — 제목은 프레임 위쪽 띠
  function showDialog({
    title, body = '', buttons = [{ label: T('확인'), value: true, cls: 'primary' }],
    className = '', footer = '', art = null, framed = true, sfx = 'popup',
  }) {
    if (sfx) TP.audio?.sfx?.(sfx);            // 팝업 효과음 (단서 획득 'clue' · 용의자 파일 'pageFlip' 등으로 바꿀 수 있음, null = 무음)
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.style.zIndex = ++zTop;
      backdrop.innerHTML = `
        <div class="modal dialog ${framed ? 'framed' : ''} ${className}" role="dialog" aria-modal="true">
          ${framed && title ? `<h2 class="frame-title">${title}</h2>` : ''}
          <div class="paper">
            ${art ? `<div class="dialog-art ${art.cls || ''}"><img src="${art.src}" alt=""></div>` : ''}
            ${!framed && title ? `<h2>${title}</h2>` : ''}
            <div class="dialog-body">${body}</div>
            <div class="actions"></div>
            ${footer ? `<div class="dialog-footer">${footer}</div>` : ''}
          </div>
        </div>`;
      const actions = backdrop.querySelector('.actions');
      for (const b of buttons) {
        const btn = document.createElement('button');
        btn.className = b.cls || '';
        btn.innerHTML = b.label;
        btn.disabled = !!b.disabled;
        btn.onclick = () => { backdrop.remove(); resolve(b.value); };
        actions.append(btn);
      }
      root().append(backdrop);
    });
  }

  // 예/아니오 확인창 → true / false. message의 줄바꿈(\n)은 그대로 줄바꿈으로 보인다.
  function confirm({ title, message, okLabel = T('확인'), cancelLabel = T('취소'), className = '' }) {
    return showDialog({
      title,
      className: `confirm ${className}`,
      body: `<p class="confirm-msg">${esc(message).replace(/\n/g, '<br>')}</p>`,
      buttons: [
        { label: cancelLabel, value: false, cls: 'ghost' },
        { label: okLabel, value: true, cls: 'primary' },
      ],
    });
  }

  // 결제 처리 중 같은 대기 화면. 반환된 함수를 호출하면 닫힌다.
  function showBusy(text) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.zIndex = ++zTop;
    backdrop.innerHTML = `<div class="modal dialog busy"><div class="paper"><div class="spinner"></div><p>${text}</p></div></div>`;
    root().append(backdrop);
    return () => backdrop.remove();
  }

  function toast(html) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    $('#toasts').append(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2600);
  }

  // canvas-confetti(CDN)가 없으면(오프라인 등) 조용히 생략
  function confettiAt(node, opts = {}) {
    if (typeof confetti !== 'function') return;
    let origin = { x: 0.5, y: 0.4 };
    if (node) {
      const r = node.getBoundingClientRect();
      origin = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
    }
    confetti({ particleCount: 80, spread: 70, origin, zIndex: 100000, disableForReducedMotion: true, ...opts });
  }

  function bigCelebration(x) {
    const rounds = x >= 4 ? 4 : x >= 2 ? 2 : 1;
    for (let i = 0; i < rounds; i++) {
      setTimeout(() => {
        confettiAt(null, { particleCount: 120, spread: 100, startVelocity: 45, origin: { x: 0.2 + Math.random() * 0.6, y: 0.5 } });
      }, i * 250);
    }
  }

  function bump(node) {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }

  // 광고: js/ad-manager.js (TP.ads — AdMob 보상형 · 전면, UMP 동의). 예전 타이머 모의 광고는 없앴다.

  // =====================================================================
  // 상점 모달: 카테고리 탭 + 상품 카드 (+ 진입 시 확률형 스페셜 오퍼)
  // =====================================================================
  const shopModal = $('#shopModal');
  let shopClosedResolvers = [];
  let shopTab = null;

  // 처음 열 때: 아직 살 수 있는 스타터 팩이 있으면 스타터 탭, 아니면 골드 탭
  const defaultTab = () =>
    TP.shop.productsIn('starter').some(p => !TP.shop.isOwned(p)) ? 'starter' : 'coin';

  // 상점 열기. 상점이 닫힐 때 resolve된다. tab: 'starter' | 'coin' | 'chance' | 'noads'
  // 진입할 때 TP.SPECIAL_OFFER_CHANCE(20%) 확률로 스페셜 오퍼 팝업이 먼저 뜨고,
  // 오퍼를 닫거나 구매하면 일반 상점 목록으로 이어진다.
  async function openShop({ allowOffer = true, forceOffer = false, tab } = {}) {
    const closed = new Promise(resolve => shopClosedResolvers.push(resolve));
    if (tab) shopTab = tab;
    if (!shopModal.hidden) { renderShop(); return closed; } // 이미 열려 있으면 탭만 바꿈
    shopTab ??= defaultTab();
    // forceOffer: 로비의 [스페셜 오퍼] 버튼처럼 확률 없이 바로 보여 줄 때
    const offer = forceOffer ? TP.shop.rollSpecialOffer(() => 0) : allowOffer ? TP.shop.rollSpecialOffer() : null;
    if (offer) await showSpecialOffer(offer);
    renderShop();
    openModal(shopModal);
    TP.billing.init().then(() => { if (!shopModal.hidden) renderShop(); });   // 스토어 현지 가격이 오면 다시 그림
    TP.audio?.playShopBgm?.();                   // 상점 배경음악 (shop_bgm_* 무작위, 곡이 끝나면 다음 곡)
    return closed;
  }

  function closeShop() {
    TP.audio?.stopShopBgm?.();
    closeModal(shopModal);
    shopClosedResolvers.forEach(resolve => resolve());
    shopClosedResolvers = [];
  }

  function renderShop() {
    const tabs = $('#shopTabs');
    tabs.replaceChildren(...TP.SHOP_CATEGORIES.map(c => {
      const btn = document.createElement('button');
      btn.className = 'shop-tab' + (c.id === shopTab ? ' on' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', c.id === shopTab);
      btn.textContent = T(c.name);
      btn.onclick = () => {
        shopTab = c.id;
        renderShop();
        shopModal.querySelector('.paper').scrollTop = 0;
      };
      return btn;
    }));
    // 탭이 넘치면(영어 · 일본어) 고른 탭이 가운데 보이게
    const on = tabs.querySelector('.on');
    if (on && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2;
    const grid = $('#productGrid');
    grid.className = `product-grid cat-${shopTab}`;
    // 철제 선반 한 단에 상품 3개 — 아이콘이 크게 보이도록 (design/shop/components.md)
    const list = TP.shop.productsIn(shopTab);
    const shelves = [];
    for (let i = 0; i < Math.max(1, list.length); i += 3) {
      const shelf = document.createElement('section');
      shelf.className = 'shelf';
      const row = document.createElement('div');
      row.className = 'shelf-products';
      row.append(...list.slice(i, i + 3).map(productCard));
      shelf.append(row);
      shelf.insertAdjacentHTML('beforeend', '<div class="shelf-beam"><i class="rivet"></i><i class="rivet"></i><i class="rivet"></i><i class="rivet"></i></div>');
      shelves.push(shelf);
    }
    const foot = document.createElement('div');
    foot.className = 'shop-foot';
    foot.innerHTML = `<button class="shop-restore">${T('구매 복원')}</button>`
      + (TP.billing.status.mode === 'dummy' ? `<small>${T('개발용: 실제 결제 없이 바로 지급돼요')}</small>` : '');
    foot.querySelector('.shop-restore').onclick = restorePurchases;
    grid.replaceChildren(...shelves, foot);
  }

  // 구매 복원 (광고 제거 · 스타터팩 보유 상태를 Google Play 구매 내역에서 되살림 — js/billing.js)
  async function restorePurchases() {
    const done = showBusy(T('구매 내역 확인 중…'));
    const r = await TP.billing.restore();
    done();
    if (!r.ok) return toast(r.reason === 'unavailable' ? T('지금은 결제를 사용할 수 없어요') : T('구매 내역을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요'));
    toast(r.noAds ? T('구매 내역을 복원했어요 (광고 제거 적용 중)') : T('구매 내역을 복원했어요'));
  }

  function productCard(p) {
    const owned = TP.shop.isOwned(p);
    const card = document.createElement('div');
    card.className = `product cat-${p.category}` + (p.category === 'starter' ? ' featured' : '') + (owned ? ' owned' : '');
    const isCoin = p.category === 'coin';
    const price = p.currency === 'GOLD' ? TP.formatPrice(p.price, p.currency) : TP.billing.priceLabel(p);   // 현금 상품: Play 스토어의 현지 가격
    // 광고 제거만 있는 상품은 이름이 곧 설명이라 구성품 줄을 생략 ('광고 제거 광고 제거' 중복 방지)
    const onlyNoAds = p.rewards.removeAds && !p.rewards.gold && !p.rewards.undo && !p.rewards.wild && !p.rewards.hint && !p.rewards.adPass;
    const img = TP.productImage(p);
    // 광고 제거 탭: '광고 제거'는 이름에 이미 있으므로 구성품 줄에서는 뺀다
    card.innerHTML = `
      ${p.tag ? `<span class="tag">${esc(T(p.tag))}</span>` : ''}
      <div class="product-glow"></div>
      <i class="sparkle" style="left:14%; top:2cqh;">✦</i><i class="sparkle" style="right:12%; top:9cqh; animation-delay:.8s;">✦</i>
      <div class="product-icon ${img ? '' : 'emoji'}">${img ? `<img src="${img}" alt="">` : p.icon}</div>
      <div class="price-paper">
        <div class="product-name">${esc(T(p.name))}</div>
        ${isCoin ? `<div class="coin-amount"><i class="ico gold"></i>${p.rewards.gold.toLocaleString()}</div>` : ''}
        ${isCoin ? `<span class="bonus-badge ${p.bonusPct ? '' : 'none'}">${p.bonusPct ? T('보너스 +{n}%', { n: p.bonusPct }) : T('기본')}</span>` : ''}
        ${isCoin || onlyNoAds ? '' : `<ul class="reward-icons">${rewardIcons(p.category === 'noads' ? { ...p.rewards, removeAds: false } : p.rewards)}</ul>`}
      </div>
      <button class="price" ${owned ? 'disabled' : ''}>
        ${owned ? (p.category === 'noads' ? T('적용됨') : T('구매 완료')) : price}
      </button>`;
    card.querySelector('.price').onclick = () => buyProduct(p);
    return card;
  }

  async function buyProduct(product) {
    const done = showBusy(T('결제 진행 중…'));
    const result = await TP.shop.buyProduct(product.id);
    done();
    if (!result.ok) {
      if (result.reason === 'gold') {
        const go = await TP.ui.confirm({ title: T('골드가 부족해요'), message: T('필요 🪙 {need} / 보유 🪙 {have}\n골드 코인 탭으로 이동할까요?', { need: result.required.toLocaleString(), have: TP.store.state.gold.toLocaleString() }), okLabel: T('골드 충전') });
        if (go) { shopTab = 'coin'; renderShop(); }
        return false;
      }
      toast({
        owned: T('이미 구매한 상품이에요'),
        cancelled: T('결제를 취소했어요'),
        pending: T('결제가 승인 대기 중이에요. 완료되면 자동으로 지급돼요'),
        unavailable: T('지금은 결제를 사용할 수 없어요'),
        network: T('인터넷 연결을 확인해 주세요'),
      }[result.reason] || T('결제하지 못했어요. 잠시 뒤 다시 시도해 주세요'));
      return false;
    }
    TP.audio?.sfx?.('purchase');
    toast(result.paidGold
      ? `✅ 🪙 -${result.paidGold.toLocaleString()}<br><small>${T('{r} 지급', { r: TP.describeRewards(product.rewards) })}</small>`
      : `✅ ${T('결제가 완료되었습니다!')}<br><small>${T('{r} 지급', { r: TP.describeRewards(product.rewards) })}</small>`);
    confettiAt(null, { particleCount: 60, origin: { x: 0.5, y: 0.2 } });
    return true;
  }

  // 보상 구성 → 아이콘 목록 (아이콘 이미지는 CSS .ico.* 가 game_assets/에서 가져온다)
  function rewardIcons({ gold, undo, wild, hint, adPass, infiniteMinutes, removeAds }) {
    return [
      removeAds && ['noads', T('광고 제거')],
      gold && ['gold', gold.toLocaleString()],
      undo && ['undo', `×${undo}`],
      wild && ['wild', `×${wild}`],
      hint && ['hint', `×${hint}`],
      infiniteMinutes && ['energy', TP.formatMinutes(infiniteMinutes)],
      adPass && ['adpass', `×${adPass}`],
    ].filter(Boolean).map(([ico, text]) => `<li><i class="ico ${ico}"></i><span>${text}</span></li>`).join('');
  }

  // 스페셜 오퍼 팝업 (TP.SPECIAL_OFFERS 템플릿을 그대로 그린다)
  // 상점 진입 스페셜 오퍼 (TP.SPECIAL_OFFERS — 탐정 긴급 지원 팩 등): 홈 SPECIAL OFFER 와 같은 가판대 팝업
  //   [✕] 는 경고 없이 닫고 상점으로 이어진다 (홈 오퍼의 '회차 · 10일' 규칙은 홈 상품에만)
  async function showSpecialOffer(offer) {
    if (await homeOfferPage(offer) === 'buy') await buyProduct(offer);
  }

  // 홈 SPECIAL OFFER 팝업: 가판대 그림(popup_home_offer.webp) 안 진열판에 구성품 · 가격, 그림의 BUY NOW 가 결제 버튼
  //   [✕] → 경고 '지금 닫으면 같은 오퍼를 다시 받지 못할 수 있어요' (10일 쉬는 규칙은 사용자에게 알리지 않음) [포기하기] [돌아가기] → 돌아가기면 오퍼로 복귀, 포기하면 회차 끝
  const OFFER_STALL = 'game_assets/popup_home_offer.webp';   // 가판대 + 탐정 고양이 (홈 · 상점 스페셜 오퍼 공통)
  function homeOfferPage(offer) {
    const price = TP.billing.priceLabel(offer);
    const original = TP.billing.originalPriceLabel(offer);
    const off = offer.originalPrice ? Math.round((1 - offer.price / offer.originalPrice) * 100) : 0;
    const page = document.createElement('div');
    page.className = 'ho-popup';
    page.style.zIndex = ++zTop;
    page.innerHTML = `
      <div class="ho-stage" role="dialog" aria-modal="true" aria-label="SPECIAL OFFER">
        <img class="ho-art" src="${OFFER_STALL}" alt="">
        ${off ? `<div class="ho-badge" data-no-icons><b>${off}%</b><small>OFF</small></div>` : '<div class="ho-badge" data-no-icons><small>SPECIAL</small></div>'}
        <div class="ho-panel">
          <div class="ho-name">${esc(T(offer.name))}</div>
          <ul class="ho-items reward-icons">${rewardIcons(offer.rewards)}</ul>
          <div class="ho-price">${original ? `<s>${original}</s>` : ''}<b>${price}</b></div>
        </div>
        <button class="ho-buy" aria-label="${T('{p} 지금 결제하기', { p: price })}"></button>
        <button class="ho-close" aria-label="${T('닫기')}">✕</button>
      </div>`;
    root().append(page);
    TP.audio?.sfx?.('popup');
    return new Promise(resolve => {
      const done = v => { page.remove(); resolve(v); };
      page.querySelector('.ho-buy').onclick = () => done('buy');
      page.querySelector('.ho-close').onclick = () => done('close');
    });
  }
  // 튜토리얼의 SPECIAL OFFER 소개: 같은 가판대 팝업을 보여 주기만 (닫아도 회차가 끝나지 않음, 결제하면 실제 구매)
  async function showOfferPreview() {
    const offer = TP.HOME_OFFER;
    if (!TP.homeOfferAvailable()) return false;
    if (await homeOfferPage(offer) === 'buy') return buyProduct(offer);
    return false;
  }

  async function showHomeOffer() {
    const offer = TP.HOME_OFFER;
    if (!TP.homeOfferAvailable()) return false;
    for (;;) {
      const choice = await homeOfferPage(offer);
      if (choice === 'buy') { if (await buyProduct(offer)) return true; continue; }   // 결제 실패 · 취소면 오퍼로 복귀
      const back = await showDialog({
        title: T('잠깐만요!'),
        className: 'confirm offer-warn',
        body: `<p class="confirm-msg">${T('지금 이 창을 닫으면<br><b>같은 오퍼를 다시 받지 못할 수 있어요.</b><br>정말 포기하시겠어요?')}</p>`,
        buttons: [
          { label: T('포기하기'), value: false, cls: 'ghost' },
          { label: T('돌아가기'), value: true, cls: 'primary' },
        ],
      });
      if (!back) { TP.endHomeOfferRound(); return false; }
    }
  }

  $('#shopClose').onclick = closeShop;
  shopModal.addEventListener('click', e => { if (e.target === shopModal) closeShop(); });
  TP.store.subscribe(() => { if (!shopModal.hidden) renderShop(); });

  TP.ui = {
    root, openModal, closeModal, showDialog, confirm, showBusy, toast, confettiAt, bigCelebration, bump,
    openShop, closeShop, showHomeOffer, showOfferPreview, restorePurchases,
  };
})();
