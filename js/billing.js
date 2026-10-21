// =====================================================================
// 결제 — RevenueCat (@revenuecat/purchases-capacitor 11.x, Capacitor 7) + Google Play Billing
// =====================================================================
//   설정: js/billing-config.js (Public SDK key) · 콘솔 설정 순서는 docs/REVENUECAT_GUIDE.md
//
//   영수증 검증: 결제가 끝나면 RevenueCat SDK 가 구매 토큰을 RevenueCat 서버로 보내고, 서버가 Google Play 에 확인한 뒤에야
//     purchaseStoreProduct() 가 성공한다 → 여기서 성공을 받았을 때만 보상을 준다 (기기에서 결과를 꾸며도 서버를 통과 못 함).
//     소비형은 RevenueCat 이 확인 후 소비(consume), 비소비형(대시보드에서 'Non-consumable' 로 지정)은 승인(acknowledge).
//
//   상품 종류 (Play Console 상품 ID = TP.SHOP_PRODUCTS 의 id 그대로)
//     비소비형 : 광고 제거 4종(noads_*) · 스타터팩 2종(oncePerAccount) — Google 계정당 1번만 살 수 있고 복원 대상
//     소비형   : 나머지 (골드 · 찬스 팩 · 현금 힌트권 · 스페셜 오퍼 · 홈 오퍼)
//
//   같은 결제를 두 번 주지 않기: 보상을 준 거래 ID 를 store.paidTx 에 남긴다 (세이브와 함께 클라우드로도 감).
//   끝나지 않은 결제 복구: 앱이 결제 도중 꺼졌거나 '대기 중'(편의점 · 현금 결제 등)이던 결제가 나중에 끝나면
//     RevenueCat 이 고객 정보에 그 거래를 싣는다 → reconcile() 이 paidTx 에 없는 최근(RECOVER_DAYS 일 이내) 거래를 찾아 지급.
//     오래된 거래는 다시 주지 않는다 (재설치 · 세이브 분실 때 예전 소비형 결제가 통째로 다시 지급되지 않게).
//   구매 복원: restore() — 광고 제거 Entitlement 와 스타터팩 구매 기록만 되살린다 (함께 받았던 골드 등은 다시 주지 않음).
//
//   사용자 ID: Firebase 유저 ID(js/account.js)를 RevenueCat appUserID 로 쓴다. 계정이 바뀌면 logIn.
//   휴대폰이 아니면(브라우저 개발용) 키가 없을 때 가짜 결제(0.7초 후 성공)로 동작한다. 휴대폰에서는 키가 없으면 결제를 막는다.
//
//   TP.billing.init() · purchase(product) · restore() · priceLabel(product) · originalPriceLabel(product)
//   TP.billing.status → { mode: 'loading'|'live'|'dummy'|'unavailable', products: {id: storeProduct}, error }
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)
  const RECOVER_DAYS = 3;
  const CODE = { CANCELLED: '1', STORE_PROBLEM: '2', NOT_ALLOWED: '3', NOT_AVAILABLE: '5', ALREADY_OWNED: '6', NETWORK: '10', PENDING: '20' };

  const cap = globalThis.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const RC = native && cap.isPluginAvailable && cap.isPluginAvailable('Purchases') ? cap.Plugins.Purchases : null;
  const config = () => TP.BILLING_CONFIG || {};

  const status = { mode: 'loading', products: {}, error: null };
  let configured = null;      // init() 의 Promise
  let busy = false;           // 결제 진행 중에는 고객 정보 갱신으로 지급하지 않음 (끝난 뒤 한 번에)
  let pendingInfo = null;

  // ---------- 상품 분류 ----------
  const isNonConsumable = product => product.category === 'noads' || !!product.oncePerAccount;
  const cashProducts = () => [...TP.SHOP_PRODUCTS, ...TP.SPECIAL_OFFERS, TP.HOME_OFFER].filter(p => p.currency !== 'GOLD');

  // ---------- 보상 지급 (거래 1건 = 1번) ----------
  // 이미 지급한 거래면 false. 지급 기록과 보상을 같은 틱에서 남긴다.
  function fulfill(product, txId, { rewards = true } = {}) {
    if (txId && TP.store.state.paidTx.includes(txId)) return false;
    TP.store.update(s => {
      if (txId) s.paidTx = [...s.paidTx, txId].slice(-300);
      if (product.oncePerAccount && !s.purchasedOnce.includes(product.id)) s.purchasedOnce.push(product.id);
      if (product.category === 'noads') s.noAdsActive = true;
      // 스페셜 오퍼(스타터팩 · 특가 팩)를 사면 홈의 SPECIAL OFFER 버튼을 더 보여 주지 않는다
      if (rewards && TP.shop.isOfferProduct(product)) s.offerPurchased = true;
    });
    if (rewards) TP.store.grant(product.rewards);
    return true;
  }

  // 고객 정보(RevenueCat) → 광고 제거 · 1회 상품 · 끝나지 않은 결제를 세이브에 맞춘다
  //   recovered: [{ product, rewards }] — 화면에 '지급했어요' 를 알릴 것
  function reconcile(customerInfo, { restoring = false } = {}) {
    if (!customerInfo) return [];
    if (busy) { pendingInfo = customerInfo; return []; }
    const recovered = [];
    const ent = customerInfo.entitlements && customerInfo.entitlements.active && customerInfo.entitlements.active[config().entitlementNoAds];
    if (ent && !TP.store.state.noAdsActive) {
      TP.store.update(s => { s.noAdsActive = true; });
      recovered.push({ product: null, removeAds: true });
    }
    const now = TP.now ? TP.now() : Date.now();
    for (const tx of customerInfo.nonSubscriptionTransactions || []) {
      const id = tx.transactionIdentifier;
      if (!id || TP.store.state.paidTx.includes(id)) continue;
      const product = TP.shop.findProduct(tx.productIdentifier);
      if (!product) continue;
      const recent = now - Date.parse(tx.purchaseDate) < RECOVER_DAYS * 24 * 3600 * 1000;
      if (recent && !restoring) {                       // 결제는 끝났는데 보상을 못 받은 거래
        if (fulfill(product, id)) recovered.push({ product, rewards: true });
      } else if (isNonConsumable(product)) {            // 예전 결제의 '보유' 상태만 (광고 제거 · 스타터팩 구매 기록)
        fulfill(product, id, { rewards: false });
      } else {                                          // 오래된 소비형 결제: 다시 주지 않고 확인만 해 둔다
        TP.store.update(s => { s.paidTx = [...s.paidTx, id].slice(-300); });
      }
    }
    return recovered;
  }

  function notifyRecovered(list) {
    const items = list.filter(r => r.product);
    if (!items.length) return;
    const names = items.map(r => T(r.product.name)).join(', ');
    TP.ui?.toast?.(T('완료되지 않았던 결제를 지급했어요: {names}', { names }));
  }

  // ---------- 초기화 ----------
  async function setUser(uid) {
    if (!RC || status.mode !== 'live' || !uid || uid.startsWith('local-')) return;
    try {
      const { appUserID } = await RC.getAppUserID();
      if (appUserID === uid) return;
      const { customerInfo } = await RC.logIn({ appUserID: uid });
      notifyRecovered(reconcile(customerInfo));
    } catch (e) { console.warn('[billing] logIn', e); }
  }

  async function loadProducts() {
    const ids = cashProducts().map(p => p.id);
    const { products } = await RC.getProducts({ productIdentifiers: ids, type: 'NON_SUBSCRIPTION' });
    status.products = Object.fromEntries((products || []).map(p => [p.identifier, p]));
    const missing = ids.filter(id => !status.products[id]);
    if (missing.length) console.warn('[billing] Play Console 에 없는 상품:', missing.join(', '));
  }

  function init() {
    if (configured) return configured;
    configured = (async () => {
      const key = config().revenuecatGoogleApiKey;
      if (!RC || !key) {
        status.mode = native ? 'unavailable' : 'dummy';
        return status;
      }
      try {
        const uid = TP.account && TP.account.state.uid;
        await RC.configure({ apiKey: key, appUserID: uid && !uid.startsWith('local-') ? uid : null });
        status.mode = 'live';
        await RC.addCustomerInfoUpdateListener(info => notifyRecovered(reconcile(info)));
        TP.account?.onChange?.(st => setUser(st.uid));
        await loadProducts().catch(e => console.warn('[billing] 상품 불러오기', e));
        const { customerInfo } = await RC.getCustomerInfo();
        notifyRecovered(reconcile(customerInfo));
      } catch (e) {
        console.warn('[billing] 초기화 실패', e);
        status.mode = 'unavailable';
        status.error = String((e && (e.message || e.code)) || e);
      }
      return status;
    })();
    return configured;
  }

  // ---------- 결제 ----------
  const errCode = e => String((e && (e.code ?? (e.data && e.data.code))) ?? '');
  const cancelled = e => errCode(e) === CODE.CANCELLED || !!(e && (e.userCancelled || (e.data && e.data.userCancelled)));

  // 결과 { ok:true, transactionId, recoveredOnly? } 또는 { ok:false, reason, message? }
  //   reason: cancelled · pending · unavailable · network · owned · error
  async function purchase(product) {
    await init();
    if (status.mode === 'dummy') {
      await new Promise(r => setTimeout(r, TP.billing.dummyDelayMs));
      const transactionId = `dummy_${product.id}_${Date.now()}`;
      fulfill(product, transactionId);
      return { ok: true, transactionId, dummy: true };
    }
    if (status.mode !== 'live') return { ok: false, reason: 'unavailable' };
    busy = true;
    try {
      let storeProduct = status.products[product.id];
      if (!storeProduct) {
        await loadProducts().catch(() => {});
        storeProduct = status.products[product.id];
      }
      if (!storeProduct) return { ok: false, reason: 'unavailable' };
      const result = await RC.purchaseStoreProduct({ product: storeProduct });
      const txId = result.transaction && result.transaction.transactionIdentifier;
      fulfill(product, txId);   // 서버 확인을 통과한 결제만 여기까지 온다
      return { ok: true, transactionId: txId };
    } catch (e) {
      if (cancelled(e)) return { ok: false, reason: 'cancelled' };
      const code = errCode(e);
      if (code === CODE.PENDING) return { ok: false, reason: 'pending' };
      if (code === CODE.ALREADY_OWNED) {          // 이미 산 비소비형 → 복원으로 보유 상태만 맞춤
        await restore().catch(() => {});
        return { ok: false, reason: 'owned' };
      }
      if (code === CODE.NETWORK) return { ok: false, reason: 'network' };
      if (code === CODE.NOT_ALLOWED || code === CODE.NOT_AVAILABLE || code === CODE.STORE_PROBLEM) return { ok: false, reason: 'unavailable' };
      console.warn('[billing] 결제 실패', e);
      return { ok: false, reason: 'error', message: String((e && e.message) || e) };
    } finally {
      busy = false;
      if (pendingInfo) { const info = pendingInfo; pendingInfo = null; notifyRecovered(reconcile(info)); }
    }
  }

  // 구매 복원: 광고 제거 · 스타터팩 보유 상태를 되살린다. 결과 { ok, noAds, mode }
  async function restore() {
    await init();
    if (status.mode === 'dummy') return { ok: true, noAds: TP.store.state.noAdsActive, mode: 'dummy' };
    if (status.mode !== 'live') return { ok: false, reason: 'unavailable' };
    try {
      const { customerInfo } = await RC.restorePurchases();
      reconcile(customerInfo, { restoring: true });
      return { ok: true, noAds: TP.store.state.noAdsActive };
    } catch (e) {
      return { ok: false, reason: errCode(e) === CODE.NETWORK ? 'network' : 'error' };
    }
  }

  // ---------- 가격 표시: Play 스토어의 현지 가격 (불러오기 전 · 개발용이면 카탈로그 가격) ----------
  function priceLabel(product) {
    const sp = status.products[product.id];
    return sp ? sp.priceString : TP.formatPrice(product.price, product.currency);
  }
  function originalPriceLabel(product) {
    if (!product.originalPrice) return '';
    const sp = status.products[product.id];
    if (!sp || !sp.price || !sp.currencyCode) return TP.formatPrice(product.originalPrice, product.currency);
    try {
      return new Intl.NumberFormat(TP.i18n?.lang || undefined, { style: 'currency', currency: sp.currencyCode })
        .format(sp.price * product.originalPrice / product.price);
    } catch { return TP.formatPrice(product.originalPrice, product.currency); }
  }

  TP.billing = { init, purchase, restore, priceLabel, originalPriceLabel, status, isNonConsumable, dummyDelayMs: 700, _reconcile: reconcile };
})();
