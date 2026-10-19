// 공용 UI 도구: 모달 · 다이얼로그 · 확인창 · 토스트 · 이펙트 · (가짜) 보상형 광고 · 상점/스페셜 오퍼 모달
// app.js(게임 메타)와 notebook.js(탐정 수첩)가 함께 쓴다. 상품·결제 로직은 shop.js(TP.shop).
(function () {
  const TP = (globalThis.TP ??= {});
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
    title, body = '', buttons = [{ label: '확인', value: true, cls: 'primary' }],
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
  function confirm({ title, message, okLabel = '확인', cancelLabel = '취소', className = '' }) {
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

  // 보상형 광고 (프로토타입: N초 카운트다운 후 보상). 출시 때 AdMob 보상형 광고 호출로 교체한다.
  // 광고 제거 패키지는 배너·전면 광고만 없애고, 유저가 직접 고르는 보상형 광고는 남겨 둔다.
  // 보상형 광고 (더미): 시청을 끝까지 하면 true. 실제 광고 SDK 를 붙일 때 이 함수만 바꾸면 된다.
  async function showRewardAd() {
    await watchRewardedAd(5);
    return true;
  }
  globalThis.showRewardAd = showRewardAd;

  function watchRewardedAd(seconds = 5) {
    if (TP.store.state.adPassCount > 0 && TP.store.spend('adPassCount', 1)) {
      toast(`🎟 광고 패스권 사용 (남은 ${TP.store.state.adPassCount}장)`);
      return Promise.resolve({ ok: true, passUsed: true });
    }
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.style.zIndex = ++zTop;
      backdrop.innerHTML = `
        <div class="modal dialog ad-player"><div class="paper">
          <div class="ad-screen">📺 광고 재생 중</div>
          <p>보상까지 <b class="ad-count">${seconds}</b>초</p>
        </div></div>`;
      root().append(backdrop);
      let left = seconds;
      const timer = setInterval(() => {
        left--;
        backdrop.querySelector('.ad-count').textContent = left;
        if (left <= 0) {
          clearInterval(timer);
          backdrop.remove();
          resolve({ ok: true });
        }
      }, 1000);
    });
  }

  // 전면 광고 (프로토타입: N초 뒤 닫기 가능). 출시 때 AdMob 전면 광고 호출로 교체한다.
  function showInterstitial(seconds = 3) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop interstitial';
      backdrop.style.zIndex = ++zTop;
      backdrop.innerHTML = `
        <div class="modal dialog ad-player"><div class="paper">
          <div class="ad-screen">📢 전면 광고 (테스트)</div>
          <div class="actions">
            <button class="ghost" data-act="noads">광고 제거하기</button>
            <button class="primary" data-act="close" disabled>닫기 <b class="ad-count">${seconds}</b></button>
          </div>
        </div></div>`;
      root().append(backdrop);
      const closeBtn = backdrop.querySelector('[data-act="close"]');
      let left = seconds;
      const timer = setInterval(() => {
        left--;
        closeBtn.querySelector('.ad-count').textContent = left;
        if (left <= 0) {
          clearInterval(timer);
          closeBtn.disabled = false;
          closeBtn.textContent = '닫기 ✕';
        }
      }, 1000);
      const finish = () => { clearInterval(timer); backdrop.remove(); resolve(); };
      closeBtn.onclick = finish;
      backdrop.querySelector('[data-act="noads"]').onclick = () => { finish(); openShop({ tab: 'noads', allowOffer: false }); };
    });
  }

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
      btn.textContent = c.name;
      btn.onclick = () => {
        shopTab = c.id;
        renderShop();
        shopModal.querySelector('.paper').scrollTop = 0;
      };
      return btn;
    }));
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
    grid.replaceChildren(...shelves);
  }

  function productCard(p) {
    const owned = TP.shop.isOwned(p);
    const card = document.createElement('div');
    card.className = `product cat-${p.category}` + (p.category === 'starter' ? ' featured' : '') + (owned ? ' owned' : '');
    const isCoin = p.category === 'coin';
    const price = TP.formatPrice(p.price, p.currency) + (p.priceKRW ? ` <small>${TP.formatPrice(p.priceKRW, 'KRW')}</small>` : '');
    // 광고 제거만 있는 상품은 이름이 곧 설명이라 구성품 줄을 생략 ('광고 제거 광고 제거' 중복 방지)
    const onlyNoAds = p.rewards.removeAds && !p.rewards.gold && !p.rewards.undo && !p.rewards.wild && !p.rewards.hint && !p.rewards.adPass;
    const img = TP.productImage(p);
    // 광고 제거 탭: '광고 제거'는 이름에 이미 있으므로 구성품 줄에서는 뺀다
    card.innerHTML = `
      ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}
      <div class="product-glow"></div>
      <i class="sparkle" style="left:14%; top:2cqh;">✦</i><i class="sparkle" style="right:12%; top:9cqh; animation-delay:.8s;">✦</i>
      <div class="product-icon ${img ? '' : 'emoji'}">${img ? `<img src="${img}" alt="">` : p.icon}</div>
      <div class="price-paper">
        <div class="product-name">${esc(p.name)}</div>
        ${isCoin ? `<div class="coin-amount"><i class="ico gold"></i>${p.rewards.gold.toLocaleString()}</div>` : ''}
        ${isCoin ? `<span class="bonus-badge ${p.bonusPct ? '' : 'none'}">${p.bonusPct ? `보너스 +${p.bonusPct}%` : '기본'}</span>` : ''}
        ${isCoin || onlyNoAds ? '' : `<ul class="reward-icons">${rewardIcons(p.category === 'noads' ? { ...p.rewards, removeAds: false } : p.rewards)}</ul>`}
      </div>
      <button class="price" ${owned ? 'disabled' : ''}>
        ${owned ? (p.category === 'noads' ? '적용됨' : '구매 완료') : price}
      </button>`;
    card.querySelector('.price').onclick = () => buyProduct(p);
    return card;
  }

  async function buyProduct(product) {
    const done = showBusy('결제 진행 중…');
    const result = await TP.shop.buyProduct(product.id);
    done();
    if (!result.ok) {
      if (result.reason === 'gold') {
        const go = await TP.ui.confirm({ title: '골드가 부족해요', message: `필요 🪙 ${result.required.toLocaleString()} / 보유 🪙 ${TP.store.state.gold.toLocaleString()}\n골드 코인 탭으로 이동할까요?`, okLabel: '골드 충전' });
        if (go) { shopTab = 'coin'; renderShop(); }
        return false;
      }
      toast('이미 구매한 상품이에요');
      return false;
    }
    TP.audio?.sfx?.('purchase');
    toast(result.paidGold
      ? `✅ 🪙 -${result.paidGold.toLocaleString()}<br><small>${TP.describeRewards(product.rewards)} 지급</small>`
      : `✅ 결제가 완료되었습니다!<br><small>${TP.describeRewards(product.rewards)} 지급</small>`);
    confettiAt(null, { particleCount: 60, origin: { x: 0.5, y: 0.2 } });
    return true;
  }

  // 보상 구성 → 아이콘 목록 (아이콘 이미지는 CSS .ico.* 가 game_assets/에서 가져온다)
  function rewardIcons({ gold, undo, wild, hint, adPass, infiniteMinutes, removeAds }) {
    return [
      removeAds && ['noads', '광고 제거'],
      gold && ['gold', gold.toLocaleString()],
      undo && ['undo', `×${undo}`],
      wild && ['wild', `×${wild}`],
      hint && ['hint', `×${hint}`],
      infiniteMinutes && ['energy', TP.formatMinutes(infiniteMinutes)],
      adPass && ['adpass', `×${adPass}`],
    ].filter(Boolean).map(([ico, text]) => `<li><i class="ico ${ico}"></i><span>${text}</span></li>`).join('');
  }

  // 스페셜 오퍼 팝업 (TP.SPECIAL_OFFERS 템플릿을 그대로 그린다)
  async function showSpecialOffer(offer) {
    const price = TP.formatPrice(offer.price, offer.currency);
    const original = offer.originalPrice ? TP.formatPrice(offer.originalPrice, offer.currency) : '';
    const off = offer.originalPrice ? Math.round((1 - offer.price / offer.originalPrice) * 100) : 0;
    const choice = await showDialog({
      className: 'special-offer',
      framed: false,
      art: offer.art ? { src: offer.art, cls: 'offer-art' } : null,
      body: `
        <div class="offer-ribbon">⏰ SPECIAL OFFER · 지금만</div>
        ${offer.art ? '' : `<div class="offer-icon">${TP.productImage(offer) ? `<img src="${TP.productImage(offer)}" alt="">` : offer.icon}</div>`}
        <div class="offer-name">${esc(offer.name)}</div>
        ${offer.headline ? `<p class="offer-headline">${esc(offer.headline)}</p>` : ''}
        <ul class="offer-items reward-icons">${rewardIcons(offer.rewards)}</ul>
        <div class="offer-price">
          ${original ? `<s>${original}</s>` : ''} <b>${price}</b> ${off ? `<span class="off">-${off}%</span>` : ''}
        </div>`,
      buttons: [
        { label: '닫기', value: 'close', cls: 'ghost' },
        { label: `${price} 구매하기`, value: 'buy', cls: 'primary hot' },
      ],
      footer: '※ 이 팝업을 닫으면 동일한 오퍼가 다시 나타나지 않을 수 있습니다.',
    });
    if (choice === 'buy') await buyProduct(offer);
  }

  // 홈 SPECIAL OFFER 팝업: 가판대 그림(popup_home_offer.webp) 안 진열판에 구성품 · 가격, 그림의 BUY NOW 가 결제 버튼
  //   [✕] → 경고 '지금 닫으면 같은 오퍼를 다시 받지 못할 수 있어요' (10일 쉬는 규칙은 사용자에게 알리지 않음) [포기하기] [돌아가기] → 돌아가기면 오퍼로 복귀, 포기하면 회차 끝
  function homeOfferPage(offer) {
    const price = TP.formatPrice(offer.price, offer.currency);
    const original = TP.formatPrice(offer.originalPrice, offer.currency);
    const off = Math.round((1 - offer.price / offer.originalPrice) * 100);
    const page = document.createElement('div');
    page.className = 'ho-popup';
    page.style.zIndex = ++zTop;
    page.innerHTML = `
      <div class="ho-stage" role="dialog" aria-modal="true" aria-label="SPECIAL OFFER">
        <img class="ho-art" src="${offer.art}" alt="">
        <div class="ho-badge" data-no-icons><b>${off}%</b><small>OFF</small></div>
        <div class="ho-panel">
          <div class="ho-name">${esc(offer.name)}</div>
          <ul class="ho-items reward-icons">${rewardIcons(offer.rewards)}</ul>
          <div class="ho-price"><s>${original}</s><b>${price}</b></div>
        </div>
        <button class="ho-buy" aria-label="${price} 지금 결제하기"></button>
        <button class="ho-close" aria-label="닫기">✕</button>
      </div>`;
    root().append(page);
    TP.audio?.sfx?.('popup');
    return new Promise(resolve => {
      const done = v => { page.remove(); resolve(v); };
      page.querySelector('.ho-buy').onclick = () => done('buy');
      page.querySelector('.ho-close').onclick = () => done('close');
    });
  }
  async function showHomeOffer() {
    const offer = TP.HOME_OFFER;
    if (!TP.homeOfferAvailable()) return false;
    for (;;) {
      const choice = await homeOfferPage(offer);
      if (choice === 'buy') { if (await buyProduct(offer)) return true; continue; }   // 결제 실패 · 취소면 오퍼로 복귀
      const back = await showDialog({
        title: '잠깐만요!',
        className: 'confirm offer-warn',
        body: `<p class="confirm-msg">지금 이 창을 닫으면<br><b>같은 오퍼를 다시 받지 못할 수 있어요.</b><br>정말 포기하시겠어요?</p>`,
        buttons: [
          { label: '포기하기', value: false, cls: 'ghost' },
          { label: '돌아가기', value: true, cls: 'primary' },
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
    watchRewardedAd, showInterstitial, openShop, closeShop, showHomeOffer,
  };
})();
