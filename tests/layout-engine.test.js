// 동적 레이아웃 엔진 (js/layout-engine.js) 검증
//  1) 템플릿 20종: 20~32장, 같은 자리(x,y,z) 중복 없음, 덮임 그래프가 비순환, 처음부터 앞면인 카드 ≥ 3, 폭 ≤ 11칸
//  2) generateLevelLayout: 같은 levelId → 같은 결과, 반전 · 잘라내기 · 흩어짐(±2%) · 기울기(±5°) 범위
//  3) 300화 × 20스테이지 시드 → 서로 다른 배치 (서명 기준) · 쉬운 레벨일수록 카드가 적다
//  4) 모든 변형에서 클리어 보장 덱 생성이 성공한다 (코어 역산 + 콤보 상자 시뮬레이션)
// 실행: node tests/layout-engine.test.js
require('./load.js');
const { TP } = globalThis;
const assert = require('assert');

const T = TP.LAYOUT_TEMPLATES;
assert.equal(T.length, 20, '템플릿 20종');
const acyclic = nodes => {
  const seen = new Set(), stack = new Set();
  const visit = n => { if (stack.has(n)) return false; if (seen.has(n)) return true; seen.add(n); stack.add(n);
    for (const p of nodes[n].parents) if (!visit(p)) return false; stack.delete(n); return true; };
  return nodes.every((_, i) => visit(i));
};
for (const tpl of T) {
  const L = TP.generateLevelLayout(1, tpl, { difficulty: 1 });        // 잘라내기 없음
  assert(tpl.cards.length >= 20 && tpl.cards.length <= 32, `${tpl.id}: ${tpl.cards.length}장`);
  assert.equal(L.nodes.length, tpl.cards.length, `${tpl.id}: 난이도 1 = 전부`);
  const keys = new Set(L.nodes.map(n => `${n.x},${n.y},${n.z}`));
  assert.equal(keys.size, L.nodes.length, `${tpl.id}: 같은 자리 중복`);
  assert(acyclic(L.nodes), `${tpl.id}: 덮임 순환`);
  assert(L.nodes.filter(n => !n.parents.length).length >= 2, `${tpl.id}: 처음 앞면 카드 부족`);   // 카펫은 양 끝 2장부터 펼쳐진다
  // 휴대폰(스테이지 732×412) 보드 영역에 75px 카드가 간격 압축 없이 들어가는 한계: 폭 8.2칸 · 높이 1.85칸
  assert(L.width <= 8.2 + 1e-9 && L.height <= 1.85 + 1e-9, `${tpl.id}: 크기 ${L.width}×${L.height} (한계 8.2×1.85)`);
  // 불변식: 화면에서 겹치면 반드시 퍼즐상 덮는 관계 (같은 층끼리 겹침 없음) — 앞면 카드가 다른 카드 뒤에 깔려 보이지 않는다
  assert.equal(TP.layoutConflicts(L).length, 0, `${tpl.id}: 같은 층 카드가 겹침 ${JSON.stringify(TP.layoutConflicts(L))}`);
  assert(tpl.cards.some(c => c.t > 0), `${tpl.id}: 잘라낼 카드(t) 없음`);
}
// 회전 · 흩어짐까지 포함한 실제 사각형 기준: 논리상 떨어진 카드끼리 화면에서 겹치는 쌍 0 (템플릿 20 × 시드 30)
{
  let flattened = 0, checked = 0;
  for (const tpl of T) for (let s = 1; s <= 30; s++) {
    const L = TP.generateLevelLayout(s * 37 + 11, tpl);
    const g = TP.layoutGeometryConflicts(L);
    assert.equal(g.length, 0, `${L.id}: 회전 포함 가짜 겹침 ${JSON.stringify(g.slice(0, 3))}`);
    flattened += L.nodes.filter(n => n.rot === 0 && n.jx === 0).length; checked += L.nodes.length;
  }
  console.log(`기하 정착: 600판 가짜 겹침 0 · 똑바로 세운 카드 ${(flattened / checked * 100).toFixed(1)}%`);
}
// 휴대폰 크기 실측 공식(ui.js fitBoard)으로 20종 모두 75px 이상
{
  const AW = 688 * 0.96, AH = 229.8 * 0.9, R = 260 / 180, GAP = 1.04;
  for (const tpl of T) {
    const L = TP.generateLevelLayout(1, tpl, { difficulty: 1 });
    const fitW = Math.min(AW / ((L.width - 1) * GAP + 1), AH / (((L.height - 1) * GAP + 1) * R));
    assert(fitW >= 75, `${tpl.id}: 휴대폰에서 카드 ${fitW.toFixed(0)}px < 75px`);
  }
}

// 2) 결정성 · 변형 범위
{
  const a = TP.generateLevelLayout(4242, 'mickey'), b = TP.generateLevelLayout(4242, 'mickey');
  assert.deepEqual(a.nodes, b.nodes, '같은 levelId → 같은 배치');
  for (const n of a.nodes) {
    assert(Math.abs(n.jx) <= 0.015 + 1e-9 && Math.abs(n.jy) <= 0.015 + 1e-9, '흩어짐 ±1.5% (카드 기준)');
  }
  const tplCards = T.find(t => t.id === 'mickey').cards;
  const sign = a.variant.mirrorX ? -1 : 1;
  for (const n of a.nodes) assert(Math.abs(n.rot - (tplCards[n.src].rot || 0) * sign) <= 5 + 1e-9, '기울기 = 템플릿 기본값 ±5° 이내');
  const easy = TP.generateLevelLayout(7, 'frame', { difficulty: 0 }), hard = TP.generateLevelLayout(7, 'frame', { difficulty: 1 });
  assert(easy.nodes.length < hard.nodes.length && easy.nodes.length >= 18, `쉬운 레벨은 카드 적게 (${easy.nodes.length} < ${hard.nodes.length})`);
  const mirrored = [1, 2, 3, 4, 5, 6, 7, 8].map(s => TP.generateLevelLayout(s, 'mickey').variant.mirrorX);
  assert(mirrored.includes(true) && mirrored.includes(false), '좌우 반전이 섞여 나옴');
  assert([1, 2, 3, 4, 5, 6, 7, 8].every(s => !TP.generateLevelLayout(s, 'carpet').variant.mirrorX), '카펫은 좌→우 방향을 지키므로 좌우 반전 없음');
}

// 3) 300화 × 20스테이지 → 서로 다른 배치 · 템플릿 고루 사용
{
  require('../js/data/episodes.js');
  require('../js/store.js'); require('../js/energy.js'); require('../js/mystery.js');
  const logic = new Set(), visual = new Set(), tplUse = {};
  let total = 0;
  for (const ep of TP.EPISODES) for (let st = 1; st <= 20; st++) {
    const seed = TP.stageSeed(ep.episodeId, st);
    const L = TP.getLayout(TP.layoutIdForSeed(seed, 0.5));
    logic.add(L.template + '|' + L.nodes.map(n => `${n.x},${n.y},${n.z}`).join(';'));
    visual.add(L.template + '|' + L.nodes.map(n => `${n.x},${n.y},${n.z},${n.rot.toFixed(1)},${n.jx.toFixed(3)}`).join(';'));
    tplUse[L.template] = (tplUse[L.template] || 0) + 1;
    total++;
  }
  assert.equal(total, 6000);
  assert(visual.size === 6000, `보이는 배치는 전부 달라야 함 ${visual.size}`);
  assert(logic.size >= 1000, `논리 배치(반전 · 잘라내기) ${logic.size}종`);
  assert(Object.keys(tplUse).length === 20 && Math.min(...Object.values(tplUse)) >= 150, `템플릿 사용 편중 ${JSON.stringify(tplUse)}`);
  // 난이도 등급 → 카드 수: 쉬움 < 전문가
  const cnt = tier => { let n = 0; for (let s = 1; s <= 40; s++) n += TP.getLayout(TP.generateDeal({ seed: s * 101, tierId: tier }).layoutId).nodes.length; return n / 40; };
  const easyN = cnt('easy'), expertN = cnt('expert');
  assert(easyN + 2 < expertN, `쉬움 평균 ${easyN.toFixed(1)}장 < 전문가 ${expertN.toFixed(1)}장`);
  console.log(`템플릿 20종 · 6000스테이지: 보이는 배치 ${visual.size} 모두 다름 · 논리 배치 ${logic.size}종 · 템플릿별 ${Math.min(...Object.values(tplUse))}~${Math.max(...Object.values(tplUse))}회 · 카드 수 쉬움 ${easyN.toFixed(1)} → 전문가 ${expertN.toFixed(1)}`);
}

// 4) 모든 템플릿 × 4난이도 × 시드 10개 → 클리어 보장 덱 생성 성공 + 정답 수순 재생
{
  let built = 0;
  for (const tpl of T) for (const tier of TP.DIFFICULTY_TIERS) for (let s = 1; s <= 10; s++) {
    const seed = s * 7919 + T.indexOf(tpl) * 131;
    const deal = TP.generateDeal({ seed, tierId: tier.id, layoutId: `${tpl.id}@${seed}` });
    const layout = TP.getLayout(deal.layoutId);
    assert.equal(TP.layoutConflicts(layout).length, 0, `${deal.layoutId}: 변형 후 같은 층 겹침`);
    assert.equal(TP.layoutGeometryConflicts(layout).length, 0, `${deal.layoutId}: 변형 후 회전 포함 가짜 겹침`);
    const game = new TP.TriPeaksGame(layout, deal);
    // 매 수마다: 앞면 카드 위에 겹쳐 그려지는(z 같거나 큰) 다른 카드가 남아 있으면 안 된다
    const checkVisible = () => {
      for (let i = 0; i < game.board.length; i++) {
        if (game.board[i].removed || !game.isFaceUp(i)) continue;
        const a = layout.nodes[i];
        for (let j = 0; j < game.board.length; j++) {
          if (i === j || game.board[j].removed) continue;
          const b = layout.nodes[j];
          const overlap = Math.abs(a.x - b.x) < 1 - 1e-6 && Math.abs(a.y - b.y) < 1 - 1e-6;
          assert(!(overlap && b.z >= a.z), `${deal.layoutId}: 앞면 카드 ${i} 가 카드 ${j} 뒤에 깔림`);
        }
      }
    };
    checkVisible();
    for (const m of deal.solution) { if (m.type === 'play') assert(game.play(m.slot), `${tpl.id} ${tier.id} #${seed}: 정답 수순`); else assert(game.draw()); checkVisible(); }
    assert.equal(game.remaining, 0);
    built++;
  }
  console.log(`클리어 보장 덱 ${built}판 (템플릿 20 × 난이도 4 × 시드 10) · 매 수마다 '앞면 카드가 뒤에 깔리지 않음' 통과`);
}
console.log('동적 레이아웃 엔진 테스트 통과');
