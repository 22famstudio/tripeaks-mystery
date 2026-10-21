// =====================================================================
// 동적 레이아웃 엔진 — 기본 프리셋 20종 + 절차적 변형 (generateLevelLayout)
// =====================================================================
// 데이터 구조
//   템플릿  TP.LAYOUT_TEMPLATES[i] = { id, name, cards: [{ x, y, z, t }] }
//     x · y : 카드 너비 · 높이 단위의 보드 내부 좌표 (픽셀 · vw 아님 — 렌더러가 컨테이너 크기에 맞춰 환산)
//     z     : 쌓인 높이. 사각형이 겹치는 두 카드 중 z 큰 쪽이 작은 쪽을 덮는다 (js/layouts.js 규칙 그대로)
//     t     : 잘라내기 순위(truncation tier). 클수록 초반 레벨에서 먼저 빠지는 '맨 위층 · 맨 바깥쪽' 카드 (0 = 항상 남음)
//   레벨 레이아웃  generateLevelLayout(levelId, template) → { id, name, nodes, width, height, variant }
//     nodes[i] = { id, x, y, z, parents, children, rot, jx, jy }
//       x · y     : 변형(반전 · 잘라내기)까지 적용된 논리 좌표 — 덮임 판정은 이 좌표로만 한다
//       rot       : 기본 기울기에 더해지는 -5° ~ +5°  (표시 전용)
//       jx · jy   : -2% ~ +2% (보드 크기 기준) 흩어짐 (표시 전용 — 덮임 판정에는 쓰지 않아 퍼즐 논리가 흔들리지 않는다)
//     variant = { mirrorX, mirrorY, removed: [..], seed }
//
// 레이아웃 id
//   'peaks' · 'heart' · 'islands'   : 예전 고정 레이아웃 (js/layouts.js) — 그대로 동작
//   'mickey@12345'                  : 템플릿 mickey 를 levelId 12345 로 변형한 것 (딜 시드 = levelId → 재도전해도 같은 판)
//   TP.layoutIdForSeed(seed)        : 시드로 템플릿을 고르고 '<tpl>@<seed>' 를 돌려준다 (deal-generator 기본값)
//
// 카드 크기는 절대 줄이지 않는다: 렌더러(ui.js fitBoard)가 카드 최소 너비(휴대폰 75px · 데스크톱 90px)를 지키고,
// 보드가 좁으면 카드 간격(pitch)을 줄여 겹치는 면적으로 흡수한다. 덮임 판정은 논리 좌표라 겹쳐 보여도 규칙은 그대로.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const N_ = s => s;   // 다국어: 표시할 때 TP.t() 로 번역하는 이름 (js/i18n.js · tools/i18n_check.js)
  const EPS = 1e-6;

  // ---------- 템플릿 작성 도우미 ----------
  const C = (x, y, z, t = 0) => ({ x, y, z, t });
  // 작은 피라미드: rows 줄 (1 / 2 / 3 …), 아래 줄일수록 앞(z 큼). 맨 위 줄이 t
  function pyramid(left, top, rows, zBase = 0, tTop = 1) {
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let k = 0; k <= r; k++)
        out.push(C(left + (rows - 1 - r) * 0.5 + k, top + r * 0.5, zBase + r, r === 0 ? tTop : 0));
    return out;
  }
  // 가로 줄: x0 부터 n장, 간격 step
  const row = (x0, y, n, z, t = 0, step = 1) => Array.from({ length: n }, (_, i) => C(x0 + i * step, y, z, t));

  // ---------- 기본 프리셋 20종 ----------
  //   불변식 (tests/layout-engine.test.js 가 검사): "화면에서 겹치면 반드시 퍼즐상 덮는 관계" — 겹치는 두 카드는 z 가 달라야 한다.
  //     렌더러는 간격을 절대 압축하지 않으므로(ui.js fitBoard), 논리 좌표의 겹침(|dx|<1 · |dy|<1) = 화면의 겹침.
  //     → 앞면(열린) 카드가 다른 카드 뒤에 깔려 보이는 일이 구조적으로 없다 (잘라내기로 카드를 빼도 유지된다).
  //   크기: 폭 ≤ 8.2칸 · 높이 ≤ 1.85칸 — 휴대폰(스테이지 732×412)에서 75px 카드가 보드 영역에 그대로 들어가는 한계.
  //   문법: 부채(fan) — 0.3~0.32칸 간격으로 겹쳐 기울인 손패 (앞 카드부터 벗겨짐) / 세로 띠(strip) — 0.36칸씩 겹친 기둥 /
  //         카펫 — 왼쪽 카드가 위에 있어 오른쪽으로 펼쳐지는 줄.  rot = 기본 기울기, t = 초반 레벨에서 먼저 잘라내는 카드.
  const T = [];
  // 부채: (cx, cy) 중심 n장, 간격 step, 기울기 tilt. z 는 뒤(zBase)에서 앞으로, dir 로 펼침 방향. 양끝 카드가 t
  function fan(cx, cy, n, step, tilt, zBase = 0, dir = 1, t = 1) {
    return Array.from({ length: n }, (_, i) => {
      const k = i - (n - 1) / 2;
      return { ...C(cx + k * step * dir, cy + Math.abs(k) * 0.04, zBase + i, i === 0 ? t : 0), rot: tilt * 0.8 + k * 4.5 * dir };
    });
  }
  // 세로 띠: (x, y0) 에서 아래로 n장, 0.36칸 간격 — 아래 카드가 위 카드를 덮는다. 맨 위가 t
  const strip = (x, y0, n, zBase = 0, t = 1) => Array.from({ length: n }, (_, i) => C(x, y0 + i * 0.36, zBase + i, i === 0 ? t : 0));
  // 3줄 피라미드 (1/2/3), 줄 간격 0.42 — 아래 줄이 앞. 꼭대기가 t
  const pyr3 = (left, zBase = 0) => [C(left + 1, 0, zBase, 2), C(left + 0.5, 0.42, zBase + 1, 1), C(left + 1.5, 0.42, zBase + 1, 1),
    C(left, 0.84, zBase + 2), C(left + 1, 0.84, zBase + 2), C(left + 2, 0.84, zBase + 2)];
  // 2줄 피라미드 (1/2)
  const pyr2 = (left, y0, zBase = 0) => [C(left + 0.5, y0, zBase, 1), C(left, y0 + 0.42, zBase + 1), C(left + 1, y0 + 0.42, zBase + 1)];

  // 1 세 봉우리: 양쪽 피라미드 + 가운데 띠와 부채 (20)
  T.push({ id: 'peaks', name: N_('세 봉우리'), cards: [...pyr3(0), ...pyr3(5), ...strip(3.5, 0.05, 3, 5), ...fan(3.5, 0.76, 5, 0.32, 0, 10)] });
  // 2 미키 마우스 (참고 이미지 1): 바깥으로 기운 귀 부채 + 얼굴 띠 3개 + 턱 부채 (21)
  T.push({ id: 'mickey', name: N_('미키 마우스'), cards: [
    ...fan(0.7, 0, 5, 0.3, -16, 0, -1), ...fan(6.6, 0, 5, 0.3, 16, 0, 1),
    ...strip(2.5, 0.2, 2, 5), ...strip(3.65, 0.2, 2, 5), ...strip(4.8, 0.2, 2, 5), ...fan(3.65, 0.75, 5, 0.32, 0, 10)] });
  // 3 액자 (참고 이미지 2 · 6): 테두리 두 줄 + 옆 띠 + 네 모서리 부채가 덮는다 (28)
  T.push({ id: 'frame', name: N_('액자'), cards: [
    ...row(1, 0, 6, 0), ...row(1, 0.85, 6, 2), ...strip(0, 0.25, 2, 0), ...strip(7, 0.25, 2, 0),
    ...fan(1.0, 0.03, 3, 0.3, -12, 10, -1), ...fan(6.5, 0.03, 3, 0.3, 12, 10, 1), ...fan(1.0, 0.75, 3, 0.3, 12, 20, -1), ...fan(6.5, 0.75, 3, 0.3, -12, 20, 1)] });
  // 4 카펫 (참고 이미지 3): 두 줄 모두 왼쪽 카드가 위 — 왼쪽부터 맞추면 오른쪽으로 펼쳐진다 (24)
  T.push({ id: 'carpet', name: N_('카펫'), noMirrorX: true, cards: [
    ...Array.from({ length: 12 }, (_, k) => ({ ...C(k * 0.55, 0, 20 - k, k >= 10 ? 2 : k === 9 ? 1 : 0), rot: -3 })),
    ...Array.from({ length: 12 }, (_, k) => ({ ...C(0.4 + k * 0.55, 0.8, k < 6 ? 5 - k : 40 - k, k >= 10 ? 2 : k === 9 ? 1 : 0), rot: 3 }))] });
  // 5 부채 다섯 (참고 이미지 4): 위 셋 + 아래 둘이 덮는다 (26)
  T.push({ id: 'fans', name: N_('부채'), cards: [
    ...fan(0.7, 0, 5, 0.3, -8, 0, -1), ...fan(4.0, 0, 6, 0.3, 0, 0, 1), ...fan(6.6, 0, 5, 0.3, 8, 0, 1),
    ...fan(2.4, 0.72, 5, 0.32, 6, 20, -1), ...fan(5.0, 0.72, 5, 0.32, -6, 20, 1)] });
  // 6 바람개비 (참고 이미지 5): 네 모서리 부채 + 가운데 띠 + 양옆 카드 (21)
  T.push({ id: 'pinwheel', name: N_('바람개비'), cards: [
    ...fan(0.6, 0, 4, 0.3, -20, 0, -1), ...fan(6.6, 0, 4, 0.3, 20, 0, 1), ...fan(0.6, 0.75, 4, 0.3, 20, 5, -1), ...fan(6.6, 0.75, 4, 0.3, -20, 5, 1),
    ...strip(3.6, 0.1, 3, 10, 2), C(2.3, 0.4, 20), C(4.9, 0.4, 20)] });
  // 7 기둥 (참고 이미지 6): 세로 띠 2개 + 양옆 부채 넷 (22)
  T.push({ id: 'pillars', name: N_('기둥'), cards: [
    ...strip(3.3, 0, 3, 0, 2), ...strip(4.4, 0, 3, 0, 2),
    ...fan(0.7, 0.05, 4, 0.3, -12, 5, -1), ...fan(6.5, 0.05, 4, 0.3, 12, 5, 1), ...fan(0.7, 0.75, 4, 0.3, 12, 15, -1), ...fan(6.5, 0.75, 4, 0.3, -12, 15, 1)] });
  // 8 블록 (참고 이미지 7): 뒷줄 띠 6개 + 반 칸 어긋난 앞줄 띠 5개 (22)
  T.push({ id: 'blocks', name: N_('블록'), cards: [
    ...[0, 1.25, 2.5, 3.75, 5, 6.25].flatMap(x => strip(x, 0, 2, 0)), ...[0.62, 1.87, 3.12, 4.37, 5.62].flatMap(x => strip(x, 0.48, 2, 2, 0))] });
  // 9 커튼 (참고 이미지 8): 뒷줄 띠 7개 + 앞줄 띠 6개 (26)
  T.push({ id: 'curtain', name: N_('커튼'), cards: [
    ...[0, 1.2, 2.4, 3.6, 4.8, 6, 7.2].flatMap(x => strip(x, 0, 2, 0)), ...[0.6, 1.8, 3.0, 4.2, 5.4, 6.6].flatMap(x => strip(x, 0.47, 2, 2, 0))] });
  // 10 하트: 두 봉우리 부채 + 넓은 줄 + 좁은 줄 (20)
  T.push({ id: 'heart', name: N_('하트'), cards: [
    ...fan(1.6, 0, 3, 0.3, -10, 0, -1), ...fan(4.4, 0, 3, 0.3, 10, 0, 1), ...row(0, 0.45, 8, 5), ...row(0.5, 0.82, 6, 6)] });
  // 11 온천 섬: 작은 피라미드 4개 + 앞을 덮는 부채 3개 (27)
  T.push({ id: 'islands', name: N_('온천 섬'), cards: [
    ...pyr2(0, 0), ...pyr2(2, 0), ...pyr2(4, 0), ...pyr2(6, 0),
    ...fan(1.5, 0.75, 5, 0.32, -5, 10, -1), ...fan(4.0, 0.75, 5, 0.32, 0, 10, 1), ...fan(6.5, 0.75, 5, 0.32, 5, 10, 1)] });
  // 12 다이아몬드: 가운데 마름모 + 양옆 부채 (20)
  T.push({ id: 'diamond', name: N_('다이아몬드'), cards: [
    C(3.5, 0, 0, 2), ...row(3, 0.28, 2, 1, 1), ...row(2.5, 0.56, 3, 2), ...row(2, 0.84, 4, 3),
    ...fan(0.8, 0.4, 5, 0.3, -10, 10, -1), ...fan(6.4, 0.4, 5, 0.3, 10, 10, 1)] });
  // 13 화살표: 오른쪽을 가리키는 촉 + 꼬리를 덮는 부채 (24)
  T.push({ id: 'arrow', name: N_('화살표'), cards: [
    ...row(0, 0.45, 4, 0), C(4, 0, 0, 2), C(4, 0.85, 1, 2), C(5, 0.2, 2, 1), C(5, 0.7, 3, 1), C(6, 0.45, 4),
    ...fan(1.5, 0.08, 5, 0.32, 0, 10, 1), ...fan(1.5, 0.76, 5, 0.32, 0, 20, 1), ...fan(3.2, 0.42, 5, 0.32, 0, 30, 1)] });
  // 14 십자가: 세로 띠 + 가로 줄 + 네 모서리 부채 (23)
  T.push({ id: 'cross', name: N_('십자가'), cards: [
    ...strip(3.5, 0.05, 3, 0, 2), ...row(0, 0.41, 8, 5),
    ...fan(1.0, 0, 3, 0.3, -12, 10, -1), ...fan(6.0, 0, 3, 0.3, 12, 10, 1), ...fan(1.0, 0.76, 3, 0.3, 12, 20, -1), ...fan(6.0, 0.76, 3, 0.3, -12, 20, 1)] });
  // 15 쌍둥이 탑: 피라미드 둘 + 가운데 띠 + 바닥을 덮는 부채 (25)
  T.push({ id: 'towers', name: N_('쌍둥이 탑'), cards: [...pyr3(0), ...pyr3(5), ...strip(3.5, 0.05, 3, 5), ...fan(1.0, 0.72, 5, 0.32, 0, 10, -1), ...fan(6.0, 0.72, 5, 0.32, 0, 10, 1)] });
  // 16 나비: 날개 부채 넷 + 몸통 띠 (23)
  T.push({ id: 'butterfly', name: N_('나비'), cards: [
    ...fan(0.9, 0, 5, 0.32, -16, 0, -1), ...fan(6.3, 0, 5, 0.32, 16, 0, 1), ...fan(1.1, 0.72, 5, 0.32, 16, 10, -1), ...fan(6.1, 0.72, 5, 0.32, -16, 10, 1),
    ...strip(3.6, 0.05, 3, 20, 2)] });
  // 17 왕관: 꼭짓점 4 + 중간 3 + 띠 줄 + 앞 부채 (20)
  T.push({ id: 'crown', name: N_('왕관'), cards: [
    ...[0.5, 2.5, 4.5, 6.5].map(x => C(x, 0, 0, 2)), ...[1.5, 3.5, 5.5].map(x => C(x, 0.25, 1, 1)), ...row(0, 0.6, 8, 5), ...fan(3.5, 0.76, 5, 0.32, 0, 10)] });
  // 18 골짜기: 위 줄이 아래 줄을 덮는 뒤집힌 봉우리 + 양옆 부채 (25)
  T.push({ id: 'valley', name: N_('골짜기'), cards: [
    ...row(2, 0.84, 4, 0), ...row(1.5, 0.42, 5, 1), ...row(1, 0, 6, 2, 1),
    ...fan(0.8, 0.3, 5, 0.32, -10, 10, -1), ...fan(6.5, 0.3, 5, 0.32, 10, 10, 1)] });
  // 19 태양: 가운데 띠 + 둥근 테두리 + 햇살 부채 (24)
  T.push({ id: 'sun', name: N_('태양'), cards: [
    ...strip(3.6, 0.25, 2, 0), ...[1.8, 3, 4.2, 5.4].map(x => C(x, 0, 5, 1)), C(0.6, 0.42, 5, 1), C(6.6, 0.42, 5, 1), ...[1.8, 3, 4.2, 5.4].map(x => C(x, 0.84, 6)),
    ...fan(0.8, 0, 3, 0.3, -14, 10, -1), ...fan(6.4, 0, 3, 0.3, 14, 10, 1), ...fan(0.8, 0.78, 3, 0.3, 14, 20, -1), ...fan(6.4, 0.78, 3, 0.3, -14, 20, 1)] });
  // 20 고양이: 귀 부채 + 얼굴 두 줄 + 수염 + 턱 부채 (20)
  T.push({ id: 'cat', name: N_('고양이'), cards: [
    ...fan(1.0, 0, 3, 0.3, -18, 1, -1), ...fan(6.2, 0, 3, 0.3, 18, 1, 1), ...row(1.5, 0.4, 5, 5), ...row(2, 0.78, 4, 6),
    { ...C(0, 0.5, 0, 1), rot: -8 }, { ...C(7, 0.5, 0, 1), rot: 8 }, ...fan(3.5, 0.8, 3, 0.3, 0, 10)] });

  // 같은 층(z)끼리 겹치는 쌍 — 0 이어야 한다 (앞면 카드가 다른 앞면 카드 뒤에 깔리는 착시 방지)
  TP.layoutConflicts = layout => {
    const out = [];
    const ns = layout.nodes;
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j];
      if (Math.abs(a.x - b.x) < 1 - EPS && Math.abs(a.y - b.y) < 1 - EPS && a.z === b.z) out.push([i, j]);
    }
    return out;
  };

  TP.LAYOUT_TEMPLATES = T;
  const byId = Object.fromEntries(T.map(t => [t.id, t]));

  // ---------- 좌표 → 노드 그래프 (덮임 판정) ----------
  function finalize(id, name, cards, extra = {}) {
    const minX = Math.min(...cards.map(c => c.x));
    const minY = Math.min(...cards.map(c => c.y));
    const nodes = cards.map((c, i) => ({
      id: i, x: +(c.x - minX).toFixed(4), y: +(c.y - minY).toFixed(4), z: c.z,
      rot: c.rot || 0, jx: c.jx || 0, jy: c.jy || 0, src: c.src ?? i, parents: null, children: [],
    }));
    for (const a of nodes) {
      a.parents = nodes.filter(b => b.z > a.z && Math.abs(b.x - a.x) < 1 - EPS && Math.abs(b.y - a.y) < 1 - EPS).map(b => b.id);
    }
    for (const a of nodes) for (const p of a.parents) nodes[p].children.push(a.id);
    return {
      id, name, nodes,
      width: Math.max(...nodes.map(n => n.x)) + 1,
      height: Math.max(...nodes.map(n => n.y)) + 1,
      ...extra,
    };
  }


  // ---------- 기하 정착: 회전 · 흩어짐까지 포함한 '실제 사각형' 기준으로 가짜 겹침을 없앤다 ----------
  //   렌더러와 같은 수치(간격 1.04 · 비율 180:260)로 카드 네 모서리를 구해 분리축(SAT)으로 겹침을 판정한다.
  //   논리상 덮는 관계(|dx|<1 · |dy|<1 · z 다름)는 겹쳐도 된다. 그 외 쌍이 겹치면 두 카드의 기울기 · 흩어짐을 줄여 가며 다시 검사.
  //   기울기 0 · 흩어짐 0이면 논리상 떨어진 카드는 항상 떨어지므로(간격 ≥ 1칸) 반드시 수렴한다.
  const GAP = 1.04, RATIO = 260 / 180;
  function corners(n) {
    const cx = n.x * GAP + 0.5 + n.jx, cy = (n.y * GAP + 0.5 + n.jy) * RATIO;
    const a = (n.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [[-0.5, -0.5 * RATIO], [0.5, -0.5 * RATIO], [0.5, 0.5 * RATIO], [-0.5, 0.5 * RATIO]]
      .map(([px, py]) => [cx + px * c - py * s, cy + px * s + py * c]);
  }
  function rectsOverlap(A, B) {
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4];
      const nx = y1 - y2, ny = x2 - x1;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [x, y] of A) { const d = x * nx + y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const [x, y] of B) { const d = x * nx + y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 <= b0 || b1 <= a0) return false;
    }
    return true;
  }
  const logicalOverlap = (a, b) => Math.abs(a.x - b.x) < 1 - EPS && Math.abs(a.y - b.y) < 1 - EPS;
  // 논리상 떨어져 있는데 화면에서 겹치는 쌍 (0 이어야 한다)
  TP.layoutGeometryConflicts = function (layout) {
    const ns = layout.nodes, out = [];
    const R = ns.map(corners);
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      if (logicalOverlap(ns[i], ns[j])) continue;
      if (Math.abs(ns[i].x - ns[j].x) > 1.6 || Math.abs(ns[i].y - ns[j].y) > 1.6) continue;   // 멀리 떨어진 쌍은 건너뜀
      if (rectsOverlap(R[i], R[j])) out.push([i, j]);
    }
    return out;
  };
  function settleGeometry(cards) {
    const nodes = cards.map(c => ({ x: c.x, y: c.y, rot: c.rot, jx: c.jx, jy: c.jy }));
    for (let iter = 0; iter < 12; iter++) {
      const bad = TP.layoutGeometryConflicts({ nodes });
      if (!bad.length) break;
      for (const [i, j] of bad) for (const k of [i, j]) {
        const n = nodes[k];
        if (iter >= 8) { n.rot = 0; n.jx = 0; n.jy = 0; }        // 마지막 수단: 똑바로 세운다
        else { n.rot *= 0.55; n.jx *= 0.5; n.jy *= 0.5; }
      }
    }
    cards.forEach((c, i) => { c.rot = nodes[i].rot; c.jx = nodes[i].jx; c.jy = nodes[i].jy; });
  }

  // ---------- 절차적 변형 ----------
  const MIN_CARDS = 18;          // 잘라내도 최소 18장 (덱 생성기 · 콤보 목표가 성립하는 하한)
  const MAX_REMOVE = 8;          // 한 템플릿에서 최대 8장까지만 잘라낸다 (실루엣이 남도록)
  const JITTER = 0.015;          // ±1.5% (카드 크기 기준)
  const ROT = 5;                 // ±5°

  // 레벨 진행도 0~1 → 잘라낼 장수. 초반 레벨은 카드를 적게, 후반은 템플릿 그대로
  //   difficulty 를 직접 주면(0=가장 쉬움 · 1=가장 어려움) 그 값을, 없으면 levelId 로 결정
  function removeCountFor(tpl, difficulty, rng) {
    const removable = tpl.cards.filter(c => c.t > 0).length;
    const cap = Math.min(MAX_REMOVE, removable, tpl.cards.length - MIN_CARDS);
    if (cap <= 0) return 0;
    const n = Math.round((1 - difficulty) * cap + (rng() - 0.5) * 1.2);   // ±0.6장 무작위
    return Math.max(0, Math.min(cap, n));
  }

  /**
   * generateLevelLayout(levelId, baseTemplate, { difficulty })
   *   levelId      : 숫자 (딜 시드) — 같은 levelId 면 항상 같은 결과
   *   baseTemplate : 템플릿 객체 또는 id
   *   difficulty   : 0~1 (생략 시 levelId 에서 유도)
   *   1) Mirroring  좌우 · 상하 반전 (각 50%)
   *   2) Node Truncation  t 가 큰 카드(꼭대기 · 바깥)부터 잘라내기 — 쉬울수록 많이
   *   3) Jittering  표시 좌표 ±2%
   *   4) Rotation Shifting  카드마다 -5° ~ +5°
   */
  TP.generateLevelLayout = function (levelId, baseTemplate, opts = {}) {
    const tpl = typeof baseTemplate === 'string' ? byId[baseTemplate] : baseTemplate;
    if (!tpl) throw new Error(`레이아웃 템플릿 없음: ${baseTemplate}`);
    const seed = (Number(levelId) >>> 0) || 1;
    const rng = TP.mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const difficulty = opts.difficulty ?? ((seed % 1000) / 999);
    const mirrorX = !tpl.noMirrorX && rng() < 0.5;          // 카펫처럼 방향에 뜻이 있는 템플릿은 좌우 반전 안 함
    const mirrorY = rng() < 0.35;

    // 2) 잘라내기: t 내림차순, 같은 t 안에서는 무작위
    const removeN = removeCountFor(tpl, difficulty, rng);
    const order = tpl.cards.map((c, i) => ({ i, t: c.t, r: rng() })).filter(o => o.t > 0)
      .sort((a, b) => b.t - a.t || a.r - b.r).slice(0, removeN).map(o => o.i);
    const removed = new Set(order);

    const W = Math.max(...tpl.cards.map(c => c.x)) + 1;
    const H = Math.max(...tpl.cards.map(c => c.y)) + 1;
    const cards = tpl.cards.map((c, i) => ({ ...c, src: i })).filter(c => !removed.has(c.src)).map(c => ({
      x: mirrorX ? W - 1 - c.x : c.x,                       // 1) 반전 (논리 좌표 — 덮임 관계는 거울상으로 보존)
      y: mirrorY ? H - 1 - c.y : c.y,
      z: c.z,
      jx: (rng() * 2 - 1) * JITTER,                         // 3) 흩어짐 (표시 전용, 카드 크기의 ±1.5% — 이웃 카드와 가짜 겹침이 생기지 않는 범위)
      jy: (rng() * 2 - 1) * JITTER,
      rot: (c.rot || 0) * (mirrorX ? -1 : 1) + (rng() * 2 - 1) * ROT,   // 4) 기본 기울기(부채) ± 5° (표시 전용)
      src: c.src,                                            // 템플릿 카드 번호 (테스트 · 에디터용)
    }));
    settleGeometry(cards);                                   // 5) 기하 정착 — 논리상 떨어진 카드끼리 모서리가 닿지 않게
    // id 에 난이도까지 적어 두어 TP.getLayout(layout.id) 가 항상 같은 배치를 돌려준다 (딜 → 게임 → 재도전 왕복)
    return finalize(`${tpl.id}@${seed}@${(+difficulty).toFixed(2)}`, tpl.name, cards, {
      template: tpl.id, variant: { mirrorX, mirrorY, removed: [...removed].sort((a, b) => a - b), seed, difficulty: +difficulty.toFixed(3) },
    });
  };

  // 시드 → 템플릿 (300화 × 20스테이지가 고르게 섞이도록 시드를 한 번 더 섞는다)
  TP.templateForSeed = seed => T[Math.floor(TP.mulberry32((seed >>> 0) ^ 0x5bd1e995)() * T.length)];
  //   difficulty(0~1) 를 주면 id 에 같이 적어 둔다 ('mickey@123@0.40') — 난이도 등급별 잘라내기 양이 재도전에도 그대로
  TP.layoutIdForSeed = (seed, difficulty) =>
    `${TP.templateForSeed(seed).id}@${seed >>> 0}${difficulty == null ? '' : `@${(+difficulty).toFixed(2)}`}`;

  // ---------- TP.getLayout 확장: '<tpl>@<levelId>' 는 변형 생성, 예전 id 는 고정 레이아웃 ----------
  const legacyGetLayout = TP.getLayout;
  const legacyIds = new Set(TP.LAYOUT_IDS || []);
  const cache = new Map();
  TP.getLayout = function (id) {
    if (legacyIds.has(id)) return legacyGetLayout(id);
    if (cache.has(id)) return cache.get(id);
    const [tplId, lv, d] = String(id).split('@');
    const level = lv ? Number(lv) : 1;
    const layout = byId[tplId] ? TP.generateLevelLayout(level, byId[tplId], d == null ? {} : { difficulty: Number(d) }) : legacyGetLayout(id);
    if (layout.id !== id) cache.set(layout.id, layout);          // 난이도를 생략한 id 로 불러도 정규 id 로도 찾게
    if (cache.size > 400) cache.clear();
    cache.set(id, layout);
    return layout;
  };
  TP.LAYOUT_IDS = [...legacyIds];
  TP.TEMPLATE_IDS = T.map(t => t.id);
})();
