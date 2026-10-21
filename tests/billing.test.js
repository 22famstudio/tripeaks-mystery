// 결제 (js/billing.js): 같은 결제 두 번 지급 안 함 · 끝나지 않은 결제 복구 · 광고 제거/스타터팩 복원 · 오래된 소비형은 다시 안 줌
// 실행: node tests/billing.test.js   (휴대폰이 아니라 RevenueCat 대신 가짜 결제 · reconcile 은 고객 정보를 직접 넣어 검사)
require('../js/store.js');
require('../js/energy.js');
require('../js/shop.js');
require('../js/billing.js');

const { TP } = globalThis;
const assert = require('assert');
const store = TP.store;
const T0 = new Date(2026, 9, 21, 12, 0, 0).getTime();
TP.now = () => T0;
const ago = h => new Date(T0 - h * 3600 * 1000).toISOString();
const tx = (id, product, hoursAgo) => ({ transactionIdentifier: id, productIdentifier: product, purchaseDate: ago(hoursAgo), purchaseToken: null });
const info = (txs, noAds = false) => ({ entitlements: { active: noAds ? { no_ads: { identifier: 'no_ads', isActive: true } } : {} }, nonSubscriptionTransactions: txs });

(async () => {
  TP.billing.dummyDelayMs = 0;
  store.reset();
  const gold0 = store.state.gold;

  // 1) 가짜 결제(개발용): 지급 + 거래 기록
  const r = await TP.shop.buyProduct('coin_tier_01');
  assert.equal(r.ok, true);
  assert.equal(store.state.gold, gold0 + 1000);
  assert(store.state.paidTx.includes(r.transactionId), '지급한 거래 ID 기록');

  // 2) 끝나지 않은 결제 복구: 최근 소비형 거래 → 1번만 지급
  const g1 = store.state.gold;
  let rec = TP.billing._reconcile(info([tx('GPA.1', 'coin_tier_03', 2)]));
  assert.equal(rec.length, 1);
  assert.equal(store.state.gold, g1 + 6000);
  rec = TP.billing._reconcile(info([tx('GPA.1', 'coin_tier_03', 2)]));
  assert.equal(rec.length, 0, '같은 거래 두 번 지급 안 함');
  assert.equal(store.state.gold, g1 + 6000);

  // 3) 오래된 소비형(재설치 · 세이브 분실)은 다시 주지 않고 확인만
  const g2 = store.state.gold;
  TP.billing._reconcile(info([tx('GPA.old', 'coin_tier_10', 24 * 30)]));
  assert.equal(store.state.gold, g2, '한 달 전 골드 결제는 다시 안 줌');
  assert(store.state.paidTx.includes('GPA.old'));

  // 4) 오래된 비소비형: 스타터팩은 '구매함'만, 광고 제거 Entitlement 는 광고 제거 켜기 (골드는 다시 안 줌)
  const g3 = store.state.gold;
  TP.billing._reconcile(info([tx('GPA.st', 'starter_novice', 24 * 40), tx('GPA.na', 'noads_plus', 24 * 40)], true));
  assert.equal(store.state.gold, g3, '함께 받았던 골드는 다시 안 줌');
  assert(store.state.purchasedOnce.includes('starter_novice'));
  assert.equal(store.state.noAdsActive, true);
  assert.equal(TP.shop.isOwned(TP.shop.findProduct('starter_novice')), true);

  // 5) 구매 복원 중에는 최근 소비형도 지급하지 않음 (복원 = 보유 상태만)
  const g4 = store.state.gold;
  TP.billing._reconcile(info([tx('GPA.2', 'coin_tier_02', 1)]), { restoring: true });
  assert.equal(store.state.gold, g4);

  // 6) 모르는 상품 · 거래 ID 없는 거래는 무시
  TP.billing._reconcile(info([tx('GPA.x', 'unknown_product', 1), { productIdentifier: 'coin_tier_01', purchaseDate: ago(1) }]));
  assert.equal(store.state.gold, g4);

  // 7) 거래 기록은 세이브에 남고 300건까지만
  for (let i = 0; i < 320; i++) TP.billing._reconcile(info([tx(`GPA.b${i}`, 'coin_tier_01', 24 * 10)]));
  assert.equal(store.state.paidTx.length, 300);

  console.log('결제 (RevenueCat 연동 로직 · 중복 지급 방지 · 복구 · 복원) 통과');
})().catch(e => { console.error(e); process.exit(1); });
