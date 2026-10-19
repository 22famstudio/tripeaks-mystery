// 홈 SPECIAL OFFER: 상점 상품과 별개 · 회차(닫기 또는 구매)가 끝나면 10일 쉬고 다시 · 최대 2회차 후 영영 없음
// 실행: node tests/home-offer.test.js
require('../js/store.js');
require('../js/energy.js');
require('../js/economy.js');
require('../js/shop.js');
const assert = require('assert');
const { TP } = globalThis;
(async () => {
  const offer = TP.HOME_OFFER;
  const shopIds = [...TP.SHOP_PRODUCTS, ...TP.SPECIAL_OFFERS].map(p => p.id);
  assert(!shopIds.includes(offer.id), '상점 · 상점 특가 목록에 없는 홈 전용 상품');
  assert(!TP.shop.isOfferProduct(offer), '스타터 · 특가 분류가 아님');
  assert.equal(TP.shop.findProduct(offer.id), offer);
  assert.equal(offer.art, 'game_assets/popup_home_offer.webp');
  assert.equal(TP.SPECIAL_OFFERS[0].art, 'game_assets/popup_special_offer.webp', '상점 특가 그림은 그대로');
  assert.equal(Math.round((1 - offer.price / offer.originalPrice) * 100), 50, '배지 할인율 = 실제 가격');
  const DAY = 864e5;
  let now = new Date(2026, 9, 19, 10).getTime();
  TP.now = () => now;
  TP.store.update(s => { s.gold = 0; s.homeOfferRound = 0; s.homeOfferNextAt = 0; });
  assert(TP.homeOfferAvailable(), '1회차 노출');
  TP.endHomeOfferRound();                                          // 1회차: 닫고 포기
  assert(!TP.homeOfferAvailable(), '닫으면 사라짐');
  assert.equal((await TP.shop.buyProduct(offer.id)).reason, 'owned', '쉬는 동안 구매 불가');
  now += 10 * DAY - 1000;
  assert(!TP.homeOfferAvailable(), '10일 전에는 없음');
  now += 1000;
  assert(TP.homeOfferAvailable(), '10일 뒤 2회차');
  const r = await TP.shop.buyProduct(offer.id);                   // 2회차: 구매
  assert(r.ok && TP.store.state.gold === 4000, '결제 → 보상 지급');
  assert.equal(TP.store.state.homeOfferRound, 2);
  now += 365 * DAY;
  assert(!TP.homeOfferAvailable(), '2회차 뒤엔 영영 없음');
  console.log('홈 SPECIAL OFFER (홈 전용 · 닫으면 10일 · 최대 2회) 통과');
})().catch(e => { console.error(e); process.exit(1); });
