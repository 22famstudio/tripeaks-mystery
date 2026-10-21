// 상점 검증: 카탈로그 · 상품별 지급량 · 1회 한정 · 광고 제거 · 스페셜 오퍼
// 실행: node tests/shop.test.js
require('../js/store.js');
require('../js/energy.js');
require('../js/shop.js');
require('../js/billing.js');   // 휴대폰이 아니면 가짜 결제 (바로 지급)

const { TP } = globalThis;
const assert = require('assert');
const store = TP.store;
const seq = (...values) => () => values.shift();
const T0 = new Date(2026, 9, 13, 9, 0, 0).getTime();
TP.now = () => T0;

const COUNTED = { gold: 'gold', undo: 'undoCount', wild: 'wildcardCount', hint: 'hintCount', adPass: 'adPassCount' };

(async () => {
  TP.billing.dummyDelayMs = 0;

  // 1) 카탈로그: 카테고리별 개수, id 중복 없음, 골드 보너스율이 실제 지급량과 맞는지 (오타 방지)
  const count = id => TP.shop.productsIn(id).length;
  assert.deepEqual(TP.SHOP_CATEGORIES.map(c => count(c.id)), [2, 10, 5, 4, 4]);
  const ids = [...TP.SHOP_PRODUCTS, ...TP.SPECIAL_OFFERS].map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, '상품 id 중복');
  for (const p of TP.shop.productsIn('coin')) {
    const actual = (p.rewards.gold / ((p.price / 0.99) * 1000) - 1) * 100;
    assert(Math.abs(actual - p.bonusPct) < 3, `${p.id}: 표기 +${p.bonusPct}% / 실제 +${actual.toFixed(1)}%`);
  }

  // 1-b) 골드 팩 가치 곡선: 1,000G ≈ $1 기준, 비쌀수록 달러당 골드와 보너스율이 계속 오르고,
  //      전체 기울기는 가격의 로그에 비례 (가격 2배당 평균 약 +18%p, 마지막 VIP 티어는 더 가파름)
  const coins = TP.shop.productsIn('coin');
  assert.equal(coins[0].rewards.gold, 1000);
  assert.equal(coins[0].price, 0.99);
  for (let i = 1; i < coins.length; i++) {
    const [a, b] = [coins[i - 1], coins[i]];
    assert(b.bonusPct > a.bonusPct, `${b.id}: 보너스율 증가`);
    assert(b.rewards.gold / b.price > a.rewards.gold / a.price, `${b.id}: 달러당 골드 증가`);
  }
  const slope = (coins.at(-1).bonusPct - coins[0].bonusPct) / Math.log2(coins.at(-1).price / coins[0].price);
  assert(slope > 15 && slope < 25, `가격 2배당 평균 보너스 +${slope.toFixed(1)}%p (로그형)`);
  assert.equal(coins.at(-1).rewards.gold, 220000);
  assert.equal(coins.at(-1).bonusPct, 120);

  // 2) 모든 상품: 구매하면 정확히 그만큼 지급 (골드·부스터·힌트권·광고 패스권·무한 하트·광고 제거)
  for (const product of TP.SHOP_PRODUCTS) {
    store.reset();
    const before = store.state;
    const result = await TP.shop.buyProduct(product.id);
    assert.equal(result.ok, true, product.id);
    const after = store.state;
    for (const [reward, field] of Object.entries(COUNTED)) {
      const paid = reward === 'gold' && product.currency === 'GOLD' ? product.price : 0;   // 골드 상품은 가격만큼 빠진다
      assert.equal(after[field] - before[field], (product.rewards[reward] || 0) - paid, `${product.id}: ${reward}`);
    }
    const minutes = product.rewards.infiniteMinutes || 0;
    assert.equal(after.infiniteEnergyUntil, minutes ? T0 + minutes * 60000 : 0, `${product.id}: 무한 하트`);
    assert.equal(after.noAdsActive, !!product.rewards.removeAds, `${product.id}: 광고 제거`);
  }

  // 3) 무한 하트는 남은 시간 뒤에 이어 붙음 (30분 + 15분)
  store.reset();
  await TP.shop.buyProduct('starter_novice');
  await TP.shop.buyProduct('chance_standard');
  assert.equal(store.state.infiniteEnergyUntil, T0 + 45 * 60000);
  assert.equal(TP.energy.consume().spent, 0, '무한 하트 중 입장은 생명력 차감 없음');

  // 4) 스타터 팩: 계정당 1회 → 두 번째는 실패하고 아무것도 지급하지 않음
  store.reset();
  assert.equal((await TP.shop.buyProduct('starter_elite')).ok, true);
  const goldAfterFirst = store.state.gold;
  assert.deepEqual(await TP.shop.buyProduct('starter_elite'), { ok: false, reason: 'owned' });
  assert.equal(store.state.gold, goldAfterFirst);
  assert.equal(TP.shop.isOwned(TP.shop.findProduct('starter_elite')), true);
  assert.equal(TP.shop.isOwned(TP.shop.findProduct('starter_novice')), false, '다른 스타터는 별개');
  assert.equal((await TP.shop.buyProduct('coin_tier_03')).ok, true, '골드 팩은 반복 구매 가능');
  assert.equal((await TP.shop.buyProduct('coin_tier_03')).ok, true);

  // 5) 광고 제거: 플래그 활성화 → 전면 광고 스킵, 다른 광고 제거 팩은 '적용됨'
  store.reset();
  assert.equal(TP.shouldShowInterstitial(store.state, 2), true, '광고 제거 전: 2판마다 전면 광고');
  assert.equal(TP.shouldShowInterstitial(store.state, 3), false);
  await TP.shop.buyProduct('noads_basic');
  assert.equal(store.state.noAdsActive, true);
  assert.equal(TP.shouldShowInterstitial(store.state, 2), false, '광고 제거 후: 전면 광고 스킵');
  assert.equal(TP.shop.isOwned(TP.shop.findProduct('noads_vip')), true);
  assert.equal((await TP.shop.buyProduct('noads_vip')).reason, 'owned');

  // 6) 예전 저장 필드(hasAdsRemoved)는 noAdsActive로 이어짐
  store.update(s => { s.noAdsActive = false; s.hasAdsRemoved = true; });
  assert.equal(store.state.noAdsActive, true);

  // 7) 스페셜 오퍼: rng() < 0.2 일 때만, 실제 노출률 약 20%, 구매 지급
  store.reset();
  assert.equal(TP.shop.rollSpecialOffer(seq(0.1, 0)).id, 'offer_detective_emergency');
  assert.equal(TP.shop.rollSpecialOffer(seq(0.2, 0)), null);
  let shown = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) if (TP.shop.rollSpecialOffer()) shown++;
  assert(Math.abs(shown / N - 0.2) < 0.01, `노출 비율 ${(shown / N).toFixed(3)}`);
  const before = store.state;
  assert.equal((await TP.shop.buyProduct('offer_detective_emergency')).ok, true);
  assert.deepEqual(
    [store.state.gold - before.gold, store.state.wildcardCount - before.wildcardCount, store.state.hintCount - before.hintCount],
    [2500, 3, 3]
  );

  // 8) 표시 문자열
  assert.equal(TP.formatPrice(3300, 'KRW'), '₩3,300');
  assert.equal(TP.formatPrice(99.99), '$99.99');
  assert.equal(TP.describeRewards(TP.shop.findProduct('starter_elite').rewards),
    '6,000 골드 + 되돌리기 10 + 와일드 4 + 힌트권 2 + 무한 하트 1시간');
  assert.equal(TP.formatMinutes(90), '1시간 30분');

  console.log(`상점 테스트 통과 (상품 ${TP.SHOP_PRODUCTS.length}종 · 오퍼 노출 ${((shown / N) * 100).toFixed(1)}%)`);
})().catch(e => { console.error(e); process.exit(1); });
