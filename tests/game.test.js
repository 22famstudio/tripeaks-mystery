// 엔진 검증: 되돌리기(상자·보너스 포함) / 와일드 / 이어하기 / 덱 장수 제한
// 실행: node tests/game.test.js
require('./load.js');

const { TP } = globalThis;
const assert = require('assert');
const snapshot = g => JSON.stringify([g.board, g.waste, g.drawn, g.allowance, g.gauge, g.chestIndex, g.combo, g.bestCombo, g.moves]);

let chestsOpened = 0;
for (let seed = 1; seed <= 600; seed++) {
  const tierId = TP.DIFFICULTY_TIERS[seed % 4].id;
  const deal = TP.generateDeal({ seed, tierId });
  const game = new TP.TriPeaksGame(TP.getLayout(deal.layoutId), deal);
  const rng = TP.mulberry32(seed);
  game.on('play', e => { if (e.chest) chestsOpened++; });
  const start = snapshot(game);

  for (let step = 0; step < 80 && game.remaining > 0; step++) {
    const playable = game.board.map((_, i) => i).filter(i => game.canPlay(i));
    const r = rng();
    if (game.status === 'lost') game.addCards(2);       // 이어하기
    else if (r < 0.05 && game.canUseWild()) assert(game.useWild());
    else if (playable.length && r < 0.75) assert(game.play(TP.pick(playable, rng)));
    else if (!game.draw()) assert(game.play(TP.pick(playable, rng)));
    assert(game.stockCount >= 0);
    if (game.activeCard.wild && game.remaining) assert(game.hasPlayableCard(), '와일드 상태에서는 앞면 카드를 항상 낼 수 있어야 함');
  }

  if (game.remaining === 0) continue;
  const purchased = game.purchased;
  while (game.canUndo()) game.undo();
  assert.equal(snapshot(game), start, `seed ${seed}: 전부 되돌리면 처음 상태와 같아야 함`);
  assert.equal(game.purchased, purchased, '이어하기로 산 카드는 되돌리기로 사라지면 안 됨');
}

assert(chestsOpened > 0, '콤보 상자가 한 번도 열리지 않음');

// 광고 부활 (+3장, 판당 1번): 막힌 판에서 첫 장을 뽑으면 바로 낼 카드가 생겨야 한다
let revived = 0;
for (let seed = 1; seed <= 300; seed++) {
  const deal = TP.generateDeal({ seed, tierId: 'hard' });
  const game = new TP.TriPeaksGame(TP.getLayout(deal.layoutId), deal);
  while (game.status === 'playing') {           // 덱만 뽑아서 일부러 막히게 만든다
    if (!game.draw()) break;
  }
  if (game.status !== 'lost') continue;
  assert(game.grantAdExtraCards(3));
  assert.equal(game.stockCount, 3);
  assert.equal(game.status, 'playing');
  assert(game.draw() && game.hasPlayableCard(), `seed ${seed}: 광고 첫 장은 바로 낼 수 있어야 함`);
  assert.equal(game.grantAdExtraCards(3), false, '광고 부활은 판당 1번');
  revived++;
}
assert(revived > 0);
console.log(`엔진 테스트 통과 (콤보 상자 ${chestsOpened}회 열림)`);

// +1 보너스 카드는 콤보·게이지를 올리지도 끊지도 않는다 (보드 카드 연속 제거만 콤보)
{
  let checked = 0;
  for (let seed = 1; seed <= 400 && checked < 30; seed++) {
    const deal = TP.generateDeal({ seed, tierId: 'easy' });
    if (!deal.board.some(c => c.special === 'bonus')) continue;
    const game = new TP.TriPeaksGame(TP.getLayout(deal.layoutId), deal);
    for (const m of deal.solution) {
      if (m.type === 'draw') { game.draw(); continue; }
      const isBonus = deal.board[m.slot].special === 'bonus';
      const [combo, gauge, chestIndex] = [game.combo, game.gauge, game.chestIndex];
      let ev = null;
      game.on('play', e => { ev = ev || e; });
      assert(game.play(m.slot));
      if (isBonus) {
        assert.deepEqual([game.combo, game.gauge, game.chestIndex], [combo, gauge, chestIndex], `seed ${seed}: +1 카드가 콤보를 바꿈`);
        assert.equal(ev.chest, null);
        checked++;
      } else {
        assert.equal(game.combo, combo + 1, '보드 카드는 콤보 +1');
      }
      game.listeners.play = game.listeners.play.slice(0, -1);
    }
    assert.equal(game.status, 'won');
  }
  assert(checked >= 10, '+1 카드 검증 표본 부족');
  console.log(`+1 카드 콤보 제외 확인 (${checked}장)`);
}

// 골드 이어하기(+5장)도 첫 장은 바로 낼 수 있는 구조 카드 · 판 저장/이어하기(serialize → load)로 같은 상태 복원
{
  let bought = 0, resumed = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const deal = TP.generateDeal({ seed, tierId: TP.DIFFICULTY_TIERS[seed % 4].id });
    const layout = TP.getLayout(deal.layoutId);
    const game = new TP.TriPeaksGame(layout, deal);
    const rng = TP.mulberry32(seed * 7);
    for (let step = 0; step < 40 && game.status === 'playing'; step++) {
      const playable = game.board.map((_, i) => i).filter(i => game.canPlay(i));
      if (playable.length && rng() < 0.7) game.play(TP.pick(playable, rng)); else if (!game.draw()) break;
      if (rng() < 0.05 && game.canUseWild()) game.useWild();
    }
    // 저장 → JSON → 새 게임에 불러오기: 보이는 상태와 이후 수가 모두 같아야 한다
    const saved = JSON.parse(JSON.stringify(game.serialize()));
    const copy = new TP.TriPeaksGame(layout, deal);
    copy.load(saved);
    const view = g => JSON.stringify([g.board.map(s => s.removed), g.activeCard, g.stockCount, g.combo, g.gauge, g.chestIndex, g.status, g.remaining]);
    assert.equal(view(copy), view(game), `seed ${seed}: 이어하기 후 상태가 같아야 함`);
    for (let k = 0; k < 6 && game.status === 'playing'; k++) { game.draw(); copy.draw(); }
    assert.equal(view(copy), view(game), `seed ${seed}: 이어한 뒤 뽑히는 카드도 같아야 함`);
    resumed++;
    // 막힐 때까지 덱만 뽑고 골드 이어하기
    while (game.status === 'playing') { if (!game.draw()) break; }
    if (game.status !== 'lost' || !game.board.some((s, i) => !s.removed && !s.card.special && game.isFaceUp(i))) continue;
    game.buyCards(5);
    assert.equal(game.stockCount, 5);
    assert(game.draw() && game.hasPlayableCard(), `seed ${seed}: 골드 +5장 첫 장은 바로 낼 수 있어야 함`);
    bought++;
  }
  {
    const d1 = TP.generateDeal({ seed: 1 });
    assert.throws(() => new TP.TriPeaksGame(TP.getLayout(d1.layoutId), d1).load({ v: 1, snap: { removed: [true], waste: [] }, pile: [] }), /맞지 않습니다/, '맞지 않는 저장은 거부');
  }
  assert(bought > 10 && resumed > 100);
  console.log(`골드 이어하기 구조 카드 ${bought}판 · 판 저장/이어하기 ${resumed}판 확인`);
}

// 별 등급: 정답 수순대로 깨면 ★3 (남은 덱 = 기준), 이어하기를 쓰면 ★1, 덱을 더 쓰면 ★2
{
  let three = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const deal = TP.generateDeal({ seed, tierId: TP.DIFFICULTY_TIERS[seed % 4].id });
    const left = TP.solutionLeftover(deal);
    const target = TP.starTarget(deal);
    assert(left >= 0 && target === Math.max(1, left));
    if (left >= 1) { assert.equal(TP.stageStars({ stockLeft: left, target }), 3, `seed ${seed}: 정답 수순 = ★3`); three++; }
    assert.equal(TP.stageStars({ stockLeft: target - 1, target }), 2);
    assert.equal(TP.stageStars({ stockLeft: 99, continued: true, target }), 1, '이어하기 = ★1');
  }
  assert(three > 60);
  console.log(`별 등급 확인 (정답 수순 ★3 ${three}판)`);
}
