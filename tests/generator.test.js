// 클리어 보장 검증: 모든 난이도·레이아웃에서 생성된 판의 정답 수순을
// 실제 게임 엔진 규칙(콤보 상자·보너스 카드·덱 장수 제한 포함)으로 재생해 본다.
// 실행: node tests/generator.test.js [난이도별 판 수]
require('./load.js');

const { TP } = globalThis;
const N = Number(process.argv[2]) || 200;
let failures = 0;

for (const tier of TP.DIFFICULTY_TIERS) {
  const t0 = Date.now();
  const stats = { winRate: 0, inBand: 0, stock: 0, chestNeeded: 0 };

  for (let seed = 1; seed <= N; seed++) {
    const deal = TP.generateDeal({ seed, tierId: tier.id });
    const layout = TP.getLayout(deal.layoutId);
    const game = new TP.TriPeaksGame(layout, deal);
    const replayed = deal.solution.every(m => (m.type === 'play' ? game.play(m.slot) : game.draw()));
    const regular = [...deal.board, ...deal.pile.slice(0, 52), deal.startCard].filter(c => !c.special);
    const unique = new Set(regular.map(c => c.id)).size;

    if (!replayed || game.status !== 'won' || unique !== 52) {
      failures++;
      console.error(`[${tier.id}] seed ${seed} 실패`, { replayed, status: game.status, unique });
    }
    stats.winRate += deal.winRate;
    stats.inBand += deal.bandDistance === 0;
    stats.stock += deal.initialStock;
    stats.chestNeeded += deal.stats.minStockNoChest > deal.initialStock;
  }

  const pct = v => `${Math.round((v / N) * 100)}%`;
  console.log(
    `${tier.name.padEnd(4)} | 무작위 승률 평균 ${pct(stats.winRate)} | 목표 구간 적중 ${pct(stats.inBand)}` +
    ` | 시작 덱 평균 ${(stats.stock / N).toFixed(1)}장 | 상자 필수 ${pct(stats.chestNeeded)}` +
    ` | 판당 ${((Date.now() - t0) / N).toFixed(0)}ms`
  );
}

console.log(failures ? `실패 ${failures}판` : '모든 판 클리어 보장 확인');
process.exit(failures ? 1 : 0);
