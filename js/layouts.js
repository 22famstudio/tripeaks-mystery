// =====================================================================
// 보드 레이아웃 (좌표/노드 기반)
// =====================================================================
// 노드 하나 = 카드 자리 하나
//   { id, x, y, z, parents, children }
//   x : 카드 너비 단위,  y : 카드 높이 단위,  z : 쌓인 높이(클수록 위)
//   parents  : 이 카드를 "덮고 있는" 카드 id들 → 전부 치워져야 앞면이 된다
//   children : 이 카드가 덮고 있는 카드 id들 (parents의 역방향)
//
// parents를 직접 적어도 되지만, 생략하면 좌표로 자동 계산한다:
//   두 카드의 사각형이 겹치고 z가 더 큰 쪽이 작은 쪽을 덮는다.
// → 새 레이아웃은 (x, y, z) 목록만 적으면 된다. 추후 레벨 에디터와도 그대로 호환.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const N_ = s => s;   // 다국어: 표시할 때 TP.t() 로 번역하는 이름 (js/i18n.js · tools/i18n_check.js)
  const EPS = 1e-6;

  function finalize(id, name, cards) {
    const minX = Math.min(...cards.map(c => c.x));
    const minY = Math.min(...cards.map(c => c.y));
    const nodes = cards.map((c, i) => ({
      id: i, x: c.x - minX, y: c.y - minY, z: c.z,
      parents: c.parents ? c.parents.slice() : null, children: [],
    }));

    for (const a of nodes) {
      if (a.parents) continue;
      a.parents = nodes
        .filter(b => b.z > a.z && Math.abs(b.x - a.x) < 1 - EPS && Math.abs(b.y - a.y) < 1 - EPS)
        .map(b => b.id);
    }
    for (const a of nodes) for (const p of a.parents) nodes[p].children.push(a.id);

    return {
      id, name, nodes,
      width: Math.max(...nodes.map(n => n.x)) + 1,
      height: Math.max(...nodes.map(n => n.y)) + 1,
    };
  }

  // 작은 피라미드: rows=3 이면 1 / 2 / 3장, 아래 줄일수록 앞(z 큼)
  function pyramid(left, top, rows, zBase = 0) {
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let k = 0; k <= r; k++)
        out.push({ x: left + (rows - 1 - r) * 0.5 + k, y: top + r * 0.5, z: zBase + r });
    return out;
  }

  const BUILDERS = {
    // 클래식 트라이픽스: 봉우리 3개, 3 / 6 / 9 / 10 = 28장
    peaks() {
      const cards = [];
      for (let p = 0; p < 3; p++) cards.push({ x: 3 * p + 1.5, y: 0, z: 0 });
      for (let m = 0; m < 6; m++) cards.push({ x: m + Math.floor(m / 2) + 1, y: 0.5, z: 1 });
      for (let k = 0; k < 9; k++) cards.push({ x: k + 0.5, y: 1, z: 2 });
      for (let j = 0; j < 10; j++) cards.push({ x: j, y: 1.5, z: 3 });
      return finalize('peaks', N_('세 봉우리'), cards);
    },

    // 하트: 뒤층 16장(하트 실루엣) + 앞층 11장이 반 칸씩 엇갈려 덮음 = 27장
    heart() {
      const back = [
        [0.5, 0], [1.5, 0], [3.5, 0], [4.5, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [1, 2], [2, 2], [3, 2], [4, 2],
        [2, 3], [3, 3],
      ];
      const front = [
        [1, 0.5], [4, 0.5],
        [0.5, 1.5], [1.5, 1.5], [2.5, 1.5], [3.5, 1.5], [4.5, 1.5],
        [1.5, 2.5], [2.5, 2.5], [3.5, 2.5],
        [2.5, 3.5],
      ];
      return finalize('heart', N_('하트'), [
        ...back.map(([x, y]) => ({ x, y, z: 0 })),
        ...front.map(([x, y]) => ({ x, y, z: 1 })),
      ]);
    },

    // 섬: 작은 피라미드 5개(각 6장)가 떨어져 있는 군도 = 30장
    islands() {
      return finalize('islands', N_('온천 섬'), [
        ...pyramid(0, 0, 3),
        ...pyramid(3.5, 0, 3),
        ...pyramid(7, 0, 3),
        ...pyramid(1.75, 2.2, 3),
        ...pyramid(5.25, 2.2, 3),
      ]);
    },
  };

  TP.LAYOUT_IDS = Object.keys(BUILDERS);
  const cache = {};
  TP.getLayout = id => (cache[id] ??= BUILDERS[id]());
})();
