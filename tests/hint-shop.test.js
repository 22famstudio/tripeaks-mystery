// 힌트권 상점: 골드 상품(결제 대신 골드 차감 · 부족하면 실패) + 현금 팩 — shop.test.js 와 저장소를 공유하지 않도록 따로 실행
// 실행: node tests/hint-shop.test.js
require('../js/store.js');
require('../js/energy.js');
require('../js/shop.js');
require('../js/billing.js');   // 휴대폰이 아니면 가짜 결제 (바로 지급)
const { TP } = globalThis;
// 힌트권: 골드 상품(결제 대신 골드 차감 · 부족하면 실패) + 현금 팩
{
  const assert = require('assert');
  const store = globalThis.TP.store;
  store.update(s => { s.gold = 700; s.hintCount = 0; });
  (async () => {
    const r1 = await TP.shop.buyProduct('hint_trio');
    assert(r1.ok && r1.paidGold === 600, '3장 묶음 600G');
    assert.equal(store.state.gold, 100); assert.equal(store.state.hintCount, 3);
    const r2 = await TP.shop.buyProduct('hint_single');
    assert(!r2.ok && r2.reason === 'gold' && r2.required === 250, '골드 부족 → 실패, 차감 없음');
    assert.equal(store.state.gold, 100);
    const r3 = await TP.shop.buyProduct('hint_case');
    assert(r3.ok && r3.transactionId, '현금 팩은 결제 게이트웨이');
    assert.equal(store.state.hintCount, 18); assert.equal(store.state.gold, 1100, '가방 = 힌트 15 + 골드 1,000');
    const r4 = await TP.shop.buyProduct('hint_ten');
    assert(r4.ok && r4.transactionId && store.state.hintCount === 28, '10장 묶음은 $0.99 현금');
    const per = TP.shop.productsIn('hint').filter(p => p.currency === 'GOLD').map(p => p.price / p.rewards.hint);
    assert.deepEqual(per, [250, 200], '골드 묶음일수록 장당 싸다');
    const ten = TP.shop.findProduct('hint_ten'), bag = TP.shop.findProduct('hint_case');
    assert.equal(ten.price, 0.99); assert.equal(bag.price, 1.99); assert.equal(bag.tag, 'BEST DEAL');
    console.log('힌트권 상점 (골드 250/600 · 현금 10장 $0.99 · 가방 15+1,000G $1.99) 통과');
  })();
}
