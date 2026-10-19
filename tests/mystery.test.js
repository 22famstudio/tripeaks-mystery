// 추리 시나리오 검증 (episodes.js를 다시 생성할 때마다 실행)
//   1) 데이터 구조: 용의자 6~12명, 단서 20개(1~20 순서), 힌트 3개, facts가 가리키는 용의자 존재
//   2) 20개 단서를 모두 모으면 진범(공범 사건은 진범 전원)만 남는다
//   3) 19개까지는 아직 특정되지 않는다 (마지막 단서까지 모아야 확정)
//   4) 단서·힌트가 진범을 소거하지 않는다
//   5) 용의자 표시 순서에서 진범 위치가 고정돼 있지 않다 (원본 엑셀은 항상 3번째)
//   6) 공범 사건: 한 명만 지목하면 오답, 전원 지목해야 정답
//   7) 재지목 비용: 광고 할인 단계 / 힌트 3종 무료권 / 골드 부족 / 상태 저장·초기화
// 실행: node tests/mystery.test.js
require('../js/store.js');          // Node에는 localStorage가 없어 메모리에서만 동작한다
require('../js/data/episodes.js');
require('../js/mystery.js');

const { TP } = globalThis;
const assert = require('assert');
const FACT_TYPES = ['crime', 'suspect', 'clear'];

const culpritSlots = new Set();
for (const ep of TP.EPISODES) {
  const ids = ep.suspects.map(s => s.id);
  const culprits = TP.culpritIds(ep);
  assert(ids.length >= 6 && ids.length <= 12, `${ep.episodeId}: 용의자 6~12명 (지금 ${ids.length})`);
  assert.equal(new Set(ids).size, ids.length, `${ep.episodeId}: 용의자 ID 중복`);
  assert(culprits.every(id => ids.includes(id)), `${ep.episodeId}: 진범 ID가 용의자 목록에 없음`);
  assert.equal(ep.clues.length, 20, `${ep.episodeId}: 단서 20개`);
  assert.equal(ep.hints.length, ep.logic ? 1 : 3, `${ep.episodeId}: 힌트 (논리 그리드는 단서 21 하나)`);
  ep.clues.forEach((c, i) => assert.equal(c.stage, i + 1, `${ep.episodeId}: 단서 stage 순서`));
  for (const c of ep.clues) for (const f of c.facts) {
    assert(FACT_TYPES.includes(f.type), `${ep.episodeId} 단서 ${c.stage}: 알 수 없는 fact 종류 ${f.type}`);
    if (f.attr) assert(ep.attributes?.[f.attr], `${ep.episodeId} 단서 ${c.stage}: 알 수 없는 속성 ${f.attr}`);
    if (f.suspect) assert(ids.includes(f.suspect), `${ep.episodeId} 단서 ${c.stage}: 없는 용의자 ${f.suspect}`);
    if (f.type === 'clear') assert(!culprits.includes(f.suspect), `${ep.episodeId} 단서 ${c.stage}: 진범을 소거함`);
  }
  for (const c of [...ep.clues, ...ep.hints]) assert(!/을\(를\)|이\(가\)|은\(는\)/.test(c.text), `${ep.episodeId}: 조사 템플릿 표기 남음`);

  // 논리 그리드 단서는 문장 퍼즐이라 이 추론기로 풀 수 없다 → 변환기(tools/logic_clues.py)가 '해 1개 · 범인 = 진범' 검증
  if (!ep.logic) {
    const all = TP.possibleCulprits(ep, 20);
    assert.deepEqual([...all].sort(), [...culprits].sort(), `${ep.episodeId}: 20개 단서로 진범만 남아야 함 (지금: ${all})`);
    const before = TP.possibleCulprits(ep, 19);
    assert(before.length > culprits.length, `${ep.episodeId}: 19개 단서로는 아직 특정되면 안 됨 (지금: ${before})`);
  }

  const eliminated = ep.hints.flatMap(h => h.eliminate);
  assert(!eliminated.some(id => culprits.includes(id)), `${ep.episodeId}: 힌트가 진범을 배제함`);
  assert(eliminated.every(id => ids.includes(id)), `${ep.episodeId}: 힌트가 없는 용의자를 가리킴`);

  const seeds = new Set(ep.clues.map(c => TP.stageSeed(ep.episodeId, c.stage)));
  assert.equal(seeds.size, 20, `${ep.episodeId}: 스테이지 시드 중복`);
  culpritSlots.add(ids.indexOf(culprits[0]));

  if (!ep.logic) {
    const narrowing = Array.from({ length: 20 }, (_, i) => TP.possibleCulprits(ep, i + 1).length);
    console.log(`Ep.${ep.no ?? ''} ${ep.title}${culprits.length > 1 ? ' [공범]' : ''}: ${narrowing.join('→')}`);
  }
}
if (TP.EPISODES.length >= 5) assert(culpritSlots.size >= 3, '진범이 늘 같은 자리에 표시됨');

console.log('추리 시나리오 검증 통과');

// =====================================================================
// 재지목 비용 · 무료권 · 골드 부족 · 상태 저장/초기화
// =====================================================================
const store = TP.store;
const mystery = TP.mystery;
const ep1 = TP.EPISODES[0];
const wrongId = ep1.suspects.find(s => s.id !== ep1.actualCulpritId).id;

// 지목 단계(단서 20개)에서 시작하는 깨끗한 상태
function enterAccusation({ gold = 1500 } = {}) {
  store.reset();
  store.update(s => { s.gold = gold; s.episode.cleared = ep1.clues.length; });
  assert(mystery.isAccusationPhase());
}

function failOnce() {
  assert.deepEqual(mystery.accuse(wrongId), { correct: false });
  assert.equal(mystery.progress.canAccuse, false);
}

// 1) 비용 테이블 (순수 함수)
{
  const costs = [0, 1, 2, 3, 4, 5, 9].map(n => TP.getReaccuseCost({ reaccuseAdWatchCount: n, hasFreeReaccuse: false }));
  assert.deepEqual(costs, [500, 400, 300, 200, 0, 0, 0], '광고 할인 단계');
  assert.equal(TP.getReaccuseCost({ reaccuseAdWatchCount: 0, hasFreeReaccuse: true }), 0, '무료권 우선');
  assert.equal(TP.getReaccuseCost({}), 500, '필드가 없으면 기본 500');
}

// 2) 광고 할인 → 결제 → 재지목. 할인 횟수는 에피소드 동안 유지된다
{
  enterAccusation();
  failOnce();
  assert.equal(mystery.reaccuseCost(), 500);
  assert.equal(mystery.canDiscountWithAd(), true);
  assert.equal(mystery.recordReaccuseAdWatched(), 400);
  assert.deepEqual(mystery.buyReaccuse(), { ok: true, cost: 400, usedFreeTicket: false });
  assert.equal(store.state.gold, 1100);
  assert.equal(mystery.progress.canAccuse, true);
  assert.equal(mystery.buyReaccuse().reason, 'notNeeded', '지목 가능 상태에서는 결제하지 않음');
  failOnce();
  assert.equal(mystery.reaccuseCost(), 400, '두 번째 실패에도 할인 유지');
}

// 3) 골드 부족: 실패 결과만 돌려주고 상태는 그대로
{
  enterAccusation({ gold: 100 });
  failOnce();
  assert.deepEqual(mystery.buyReaccuse(), { ok: false, reason: 'gold', cost: 500, gold: 100 });
  assert.equal(store.state.gold, 100);
  assert.equal(mystery.progress.canAccuse, false);
}

// 4) 광고 4회 이상이면 골드 없이도 무료 → 진행 불가(소프트락) 없음
{
  enterAccusation({ gold: 0 });
  failOnce();
  const seen = [1, 2, 3, 4].map(() => mystery.recordReaccuseAdWatched());
  assert.deepEqual(seen, [400, 300, 200, 0]);
  assert.equal(mystery.canDiscountWithAd(), false, '무료가 되면 할인 광고 버튼 불필요');
  assert.deepEqual(mystery.buyReaccuse(), { ok: true, cost: 0, usedFreeTicket: false });
  assert.equal(store.state.gold, 0);
}

// 5) 힌트 전부(논리 그리드 에피소드는 단서 21 하나) 확인 → 무료 재지목권 1회 (광고 횟수와 무관, 에피소드당 한 번)
{
  enterAccusation({ gold: 0 });
  failOnce();
  const results = ep1.hints.map(() => mystery.revealHint());
  assert.deepEqual(results.map(r => r.grantedFreeReaccuse), ep1.hints.map((_, i) => i === ep1.hints.length - 1), '마지막 힌트에서 무료권');
  assert.equal(mystery.revealHint(), null, '힌트는 3개뿐');
  assert.equal(mystery.progress.hasFreeReaccuse, true);
  assert.equal(mystery.reaccuseCost(), 0);
  assert.deepEqual(mystery.buyReaccuse(), { ok: true, cost: 0, usedFreeTicket: true });
  assert.equal(mystery.progress.hasFreeReaccuse, false, '무료권은 쓰면 사라짐');
  failOnce();
  assert.equal(mystery.reaccuseCost(), 500, '무료권은 다시 지급되지 않음');
}

// 6) 힌트권 아이템: 없으면 null, 있으면 1장 쓰고 힌트 공개
{
  enterAccusation();
  failOnce();
  assert.equal(mystery.useHintTicket(), null);
  store.grant({ hint: 1 });
  const r = mystery.useHintTicket();
  assert.equal(r.hint, ep1.hints[0]);
  assert.equal(store.state.hintCount, 0);
  assert.equal(mystery.progress.hintsShown, 1);
}

// 7) 에피소드 초기화 / 해결 시 재지목 관련 상태도 초기화
{
  enterAccusation();
  failOnce();
  mystery.recordReaccuseAdWatched();
  ep1.hints.forEach(() => mystery.revealHint());
  mystery.resetEpisode();
  const p = mystery.progress;
  assert.deepEqual(
    [p.cleared, p.reaccuseAdWatchCount, p.hasFreeReaccuse, p.freeReaccuseGranted, p.hintsShown, p.canAccuse],
    [0, 0, false, false, 0, true]
  );

  enterAccusation();
  failOnce();
  mystery.recordReaccuseAdWatched();
  mystery.buyReaccuse();
  assert.equal(mystery.accuse(ep1.actualCulpritId).correct, true);
  mystery.solve();
  assert.equal(mystery.progress.index, 1);
  assert.equal(mystery.progress.reaccuseAdWatchCount, 0, '다음 에피소드는 할인 0회부터');
}

// 8) 저장 데이터가 손상돼도 안전한 값으로 복구
{
  store.update(s => {
    s.episode.reaccuseAdWatchCount = -3;
    s.episode.hasFreeReaccuse = 'yes';
    s.hintCount = 'many';
  });
  assert.equal(mystery.progress.reaccuseAdWatchCount, 0);
  assert.equal(mystery.progress.hasFreeReaccuse, false);
  assert.equal(store.state.hintCount, 0);
}

// 9) 공범 사건: 한 명만 지목하면 오답, 진범 전원을 골라야 정답
{
  const idx = TP.EPISODES.findIndex(e => TP.culpritIds(e).length > 1);
  if (idx >= 0) {
    const ep = TP.EPISODES[idx];
    const [a, b] = TP.culpritIds(ep);
    const reset = () => {
      store.reset();
      store.update(s => { s.episode = TP.freshEpisodeState(idx); s.episode.cleared = ep.clues.length; });
    };
    reset();
    assert.equal(mystery.accuse(a).correct, false, '공범 중 한 명만 지목 → 오답');
    reset();
    const innocent = ep.suspects.find(s => !TP.culpritIds(ep).includes(s.id)).id;
    assert.equal(mystery.accuse([a, innocent]).correct, false, '한 명이 틀리면 오답');
    reset();
    assert.equal(mystery.accuse([b, a]).correct, true, '진범 전원(순서 무관) → 정답');
    console.log(`공범 사건 지목 테스트 통과 (${ep.title})`);
  }
}

console.log('재지목 비용 · 무료권 · 상태 초기화 테스트 통과');
