// =====================================================================
// 상점: 상품 카탈로그(4대 카테고리) · 스페셜 오퍼 · 구매 처리 · 광고 정책 — DOM 없음
// =====================================================================
// 상품 구조
//   { id, category, name, icon, price(USD), priceKRW?, rewards, tag?, bonusPct?, oncePerAccount? }
//   rewards: { gold, undo, wild, hint, adPass, infiniteMinutes, removeAds }
//     infiniteMinutes : 무한 수사 에너지(분) — 이미 켜져 있으면 남은 시간 뒤에 이어 붙음
//     adPass          : 보상형 광고 패스권 (광고 시청 없이 바로 보상)
//     removeAds       : store.noAdsActive = true (전면·배너 광고 스킵)
//
// 결제: TP.billing (js/billing.js — RevenueCat + Google Play Billing, 서버 영수증 확인 · 지급 기록 · 복원)
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  const N_ = s => s;   // 다국어: 표시할 때 TP.t() 로 번역하는 이름 (js/i18n.js · tools/i18n_check.js)

  TP.SHOP_CATEGORIES = [
    { id: 'starter', name: N_('스타터/특가') },
    { id: 'coin', name: N_('골드 코인') },
    { id: 'chance', name: N_('찬스 팩') },
    { id: 'hint', name: N_('힌트권') },
    { id: 'noads', name: N_('광고 제거') },
  ];

  const coin = (n, name, price, gold, bonusPct, tag) =>
    ({ id: `coin_tier_${String(n).padStart(2, '0')}`, category: 'coin', name, icon: '🪙', price, rewards: { gold }, bonusPct, tag });

  TP.SHOP_PRODUCTS = [
    // ---- 1. 스타터 팩: 계정당 1회 ----
    {
      id: 'starter_novice', category: 'starter', name: N_('초보 탐정 스타터팩'), icon: '🕵️',
      price: 2.99, priceKRW: 4200, tag: N_('2.3배 혜택'), oncePerAccount: true,
      rewards: { gold: 3000, undo: 5, wild: 2, infiniteMinutes: 30 },
    },
    {
      id: 'starter_elite', category: 'starter', name: N_('엘리트 탐정 스타터팩'), icon: '🎖️',
      price: 4.99, priceKRW: 6900, tag: N_('3.2배 혜택'), oncePerAccount: true,
      rewards: { gold: 6000, undo: 10, wild: 4, infiniteMinutes: 60, hint: 2 },
    },

    // ---- 2. 골드 팩 (10티어) — bonusPct는 $0.99=1,000G 기준 추가분 ----
    coin(1, N_('동전 주머니'), 0.99, 1000, 0),
    coin(2, N_('골드 주머니'), 1.99, 2200, 10),
    coin(3, N_('골드 상자'), 4.99, 6000, 20, N_('인기')),
    coin(4, N_('골드 자루'), 9.99, 13500, 35),
    coin(5, N_('골드 궤짝'), 14.99, 22000, 46),
    coin(6, N_('골드 금고'), 19.99, 32000, 60, N_('베스트')),
    coin(7, N_('골드 수레'), 29.99, 52500, 75),
    coin(8, N_('황금 마차'), 49.99, 95000, 90),
    coin(9, N_('황금 보물창고'), 79.99, 164000, 105),
    coin(10, N_('명탐정의 비밀 금고'), 99.99, 220000, 120, 'VIP'),

    // ---- 3. 찬스(부스터) 팩 ----
    // 힌트권 (논리 그리드 '칸 확인' 1회). 골드 상품은 currency: 'GOLD' — 결제 대신 골드 차감
    { id: 'hint_single', category: 'hint', name: N_('힌트권 1장'), icon: '🎟', price: 250, currency: 'GOLD', rewards: { hint: 1 } },
    { id: 'hint_trio', category: 'hint', name: N_('힌트권 3장 묶음'), icon: '🎟', price: 600, currency: 'GOLD', tag: N_('20% 할인'), rewards: { hint: 3 } },
    // 현금 힌트권: 10장 $0.99 (장당 ≈ 100G 가치) · 가방 15장 + 1,000G $1.99 (≈ 2,500G 가치 → 골드 2단계 2,200G 보다 좋아 BEST DEAL)
    { id: 'hint_ten', category: 'hint', name: N_('힌트권 10장 묶음'), icon: '🎟', price: 0.99, rewards: { hint: 10 } },
    { id: 'hint_case', category: 'hint', name: N_('탐정 힌트 가방'), icon: '💼', price: 1.99, tag: 'BEST DEAL', rewards: { hint: 15, gold: 1000 } },
    { id: 'chance_mini', category: 'chance', name: N_('미니 찬스 팩'), icon: '🎒', price: 0.99, rewards: { undo: 5, wild: 2 } },
    { id: 'chance_standard', category: 'chance', name: N_('스탠다드 찬스 팩'), icon: '🧳', price: 2.99, rewards: { undo: 15, wild: 6, infiniteMinutes: 15 } },
    { id: 'chance_pro', category: 'chance', name: N_('프로 찬스 팩'), icon: '💼', price: 6.99, rewards: { undo: 40, wild: 15, infiniteMinutes: 30 } },
    // 교차 비교 보정(골드 단계 곡선 $12.99 ≈ 1,400 G/$ · $24.99 ≈ 1,650 G/$ 에 맞춤): 되돌리기 150 → 110 · 300 → 250
    { id: 'chance_bulk', category: 'chance', name: N_('대용량 찬스 팩'), icon: '📦', price: 12.99, rewards: { undo: 110, wild: 15, infiniteMinutes: 60 } },
    { id: 'chance_master', category: 'chance', name: N_('마스터 찬스 팩'), icon: '🏆', price: 24.99, rewards: { undo: 250, wild: 35, infiniteMinutes: 120 } },

    // ---- 4. 광고 제거 팩 ----
    { id: 'noads_basic', category: 'noads', name: N_('광고 제거'), icon: '🚫', price: 4.99, rewards: { removeAds: true } },
    { id: 'noads_plus', category: 'noads', name: N_('광고 제거 플러스'), icon: '🚫', price: 5.99, rewards: { removeAds: true, gold: 1000 } },
    { id: 'noads_deluxe', category: 'noads', name: N_('광고 제거 디럭스'), icon: '🚫', price: 7.99, rewards: { removeAds: true, gold: 2500, undo: 5 } },
    {
      id: 'noads_vip', category: 'noads', name: N_('광고 제거 VIP'), icon: '👑', price: 11.99, tag: 'VIP',
      rewards: { removeAds: true, gold: 6000, undo: 12, wild: 4, adPass: 10 },
    },
  ];

  // ---------- 스페셜 오퍼 (상점 진입 시 일정 확률로 먼저 노출) ----------
  // 더미 템플릿: 항목만 추가/수정하면 팝업에 그대로 반영된다.
  //   weight : 여러 오퍼 중 뽑힐 비중 / originalPrice : 할인 전 가격(취소선) / headline : 한 줄 카피
  //   art    : 팝업 상단 일러스트 경로 (없으면 icon 이모지)
  TP.SPECIAL_OFFER_CHANCE = 0.2;
  TP.SPECIAL_OFFERS = [
    {
      id: 'offer_detective_emergency', category: 'offer', name: N_('탐정 긴급 지원 팩'), icon: '🚨', special: true,
      art: 'game_assets/popup_special_offer.webp',
      headline: N_('막힌 사건, 지금 바로 해결하세요!'),
      price: 3300, originalPrice: 6600, currency: 'KRW', weight: 1,
      // 교차 비교 보정: 이전 1,500G + 와일드 2 + 힌트 1 (≈ 1,960G 가치) 은 ₩3,300 에 골드 1단계보다 못했다 → 특가답게 상향
      rewards: { gold: 2500, wild: 3, hint: 3 },
    },
  ];

  // ---------- 홈 SPECIAL OFFER (상시 오퍼) ----------
  //   상점의 스타터 · 특가 팩과 겹치지 않는 홈 전용 상품. 홈 좌측 상단 버튼 · 홈 5초 체류 자동 팝업으로만 판매.
  //   한 번 노출(회차)은 사거나 닫으면 끝 → 10일 동안 버튼까지 사라졌다가 다시 팝업. 최대 2회차 후 영영 사라짐.
  //   가치: 4,000G + 와일드 5(≈1,000G) + 되돌리기 8(≈800G) + 힌트권 4(≈600G) ≈ 6,400G → $3.99 (≈1,600 G/$, 골드 3단계 1,200 G/$ 보다 좋음)
  TP.HOME_OFFER = {
    id: 'offer_home_always', category: 'homeoffer', name: N_('명탐정 상시 특별 지원'), icon: '🎁',
    art: 'game_assets/popup_home_offer.webp',   // 상점 가판대 + 탐정 고양이 (흰 배경 제거 · 배지 숫자는 코드가 씀)
    headline: N_('수사에 필요한 모든 것을 반값에!'),
    price: 3.99, originalPrice: 7.99,
    rewards: { gold: 4000, wild: 5, undo: 8, hint: 4 },
  };
  TP.HOME_OFFER_ROUNDS = 2;                          // 최대 노출 회차
  TP.HOME_OFFER_COOLDOWN_MS = 10 * 24 * 3600 * 1000; // 닫거나 산 뒤 다시 뜰 때까지 10일
  TP.homeOfferAvailable = (state = TP.store.state, t = TP.now ? TP.now() : Date.now()) =>
    state.homeOfferRound < TP.HOME_OFFER_ROUNDS && t >= state.homeOfferNextAt;
  // 이번 회차 끝 (닫기 → 포기 또는 구매): 10일 쉬고, 2회차까지 끝나면 영영 없음
  TP.endHomeOfferRound = () => TP.store.update(s => {
    s.homeOfferRound = Math.min(TP.HOME_OFFER_ROUNDS, s.homeOfferRound + 1);
    s.homeOfferNextAt = (TP.now ? TP.now() : Date.now()) + TP.HOME_OFFER_COOLDOWN_MS;
  });

  TP.formatPrice = (price, currency = 'USD') =>
    currency === 'KRW' ? `₩${price.toLocaleString('ko-KR')}`
      : currency === 'GOLD' ? `🪙 ${price.toLocaleString()}`
      : `$${price.toFixed(2)}`;

  TP.formatMinutes = m => (m >= 60 && m % 60 === 0 ? T('{h}시간', { h: m / 60 }) : m >= 60 ? T('{h}시간 {m}분', { h: Math.floor(m / 60), m: m % 60 }) : T('{m}분', { m }));

  TP.describeRewards = function ({ gold, undo, wild, hint, adPass, infiniteMinutes, removeAds }) {
    const parts = [];
    if (removeAds) parts.push(T('광고 영구 제거'));
    if (gold) parts.push(T('{n} 골드', { n: gold.toLocaleString() }));
    if (undo) parts.push(T('되돌리기 {n}', { n: undo }));
    if (wild) parts.push(T('와일드 {n}', { n: wild }));
    if (hint) parts.push(T('힌트권 {n}', { n: hint }));
    if (infiniteMinutes) parts.push(T('무한 하트 {t}', { t: TP.formatMinutes(infiniteMinutes) }));
    if (adPass) parts.push(T('광고 패스권 {n}', { n: adPass }));
    return parts.join(' + ');
  };

  const allProducts = () => [...TP.SHOP_PRODUCTS, ...TP.SPECIAL_OFFERS, TP.HOME_OFFER];

  TP.shop = {
    findProduct: id => allProducts().find(p => p.id === id) || null,
    isOfferProduct: product => product.category === 'starter' || product.category === 'offer' || !!product.special,
    productsIn: category => TP.SHOP_PRODUCTS.filter(p => p.category === category),

    // 상점 진입 시 스페셜 오퍼 추첨: chance 확률로 (보유하지 않은) 오퍼 하나, 아니면 null
    rollSpecialOffer(rng = Math.random, chance = TP.SPECIAL_OFFER_CHANCE) {
      if (rng() >= chance) return null;
      const pool = TP.SPECIAL_OFFERS.filter(o => !this.isOwned(o));
      const total = pool.reduce((sum, o) => sum + (o.weight || 1), 0);
      let r = rng() * total;
      return pool.find(o => (r -= o.weight || 1) < 0) || null;
    },

    // 더 살 수 없는 상품: 1회 한정을 이미 산 경우, 광고 제거가 이미 적용된 경우의 광고 제거 팩
    isOwned(product, state = TP.store.state) {
      if (product.category === 'noads' && state.noAdsActive) return true;
      return !!product.oncePerAccount && state.purchasedOnce.includes(product.id);
    },

    // 구매 → 결제 → 보상 지급. 결과 { ok, product, transactionId } 또는 { ok:false, reason }
    async buyProduct(productId) {
      const product = this.findProduct(productId);
      if (!product) return { ok: false, reason: 'notFound' };
      if (this.isOwned(product)) return { ok: false, reason: 'owned' };
      if (product.id === TP.HOME_OFFER.id && !TP.homeOfferAvailable()) return { ok: false, reason: 'owned' };
      if (product.currency === 'GOLD') {                              // 골드 상품: 결제 대신 골드 차감
        if (!TP.store.spend('gold', product.price)) return { ok: false, reason: 'gold', required: product.price };
        TP.store.grant(product.rewards);
        return { ok: true, product, transactionId: null, paidGold: product.price };
      }
      const result = await TP.billing.purchase(product);   // 결제 → 서버 확인 → 보상 지급 · 1회 상품 · 광고 제거 기록까지
      if (!result.ok) return result;
      if (product.id === TP.HOME_OFFER.id) TP.endHomeOfferRound();
      return { ...result, product };
    },
  };
  TP.shop.buy = TP.shop.buyProduct; // 예전 이름 호환

  // ---------- 광고 정책 ----------
  // 전면 광고: 스테이지를 INTERSTITIAL_EVERY판 클리어할 때마다 1번. 광고 제거(noAdsActive)면 항상 스킵.
  TP.ADS = { INTERSTITIAL_EVERY: 2 };
  TP.shouldShowInterstitial = (state, clearsThisSession) =>
    !state.noAdsActive && clearsThisSession > 0 && clearsThisSession % TP.ADS.INTERSTITIAL_EVERY === 0;
})();
