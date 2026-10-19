// V6 300화 데이터 + 수사 보드 흐름 검증
//  A) 원본(data/TriPeaks_300_Episodes_V6_Sorted.csv)과 대조: 에피소드 번호 · 대륙 · 장소 · 진범 프로필 · 용의자 프로필 · 동기 · 고백
//  B) 대륙 챕터 순서: 아시아 1~100 → 북아메리카 101~140 → 남아메리카 141~180 → 아프리카 181~230 → 유럽 231~280 → 오세아니아 281~300
//     대륙이 바뀌는 곳(100→101 등 5곳)에서만 챕터 전환
//  C) 논리 그리드 단서: 용의자 6 · 장소 6 · 물건 6, 단서 1~20 + 단서 21(광고), 진범 일치, 그리드 저장 · checkKiller
//  D) 사건 해결: 보상은 completeCurrentEpisode 로 한 번만 (1,000G · 되돌리기 1 · 와일드 1 + EXP 200), 다음 에피소드 + 챕터 전환 정보
// 실행: node tests/episodes-v6.test.js
require('../js/store.js');
require('../js/energy.js');
require('../js/economy.js');
require('../js/streak.js');
require('../js/data/episodes.js');
require('../js/mystery.js');
require('../js/home-bridge.js');

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { TP } = globalThis;
const mystery = TP.mystery;
const store = TP.store;

// ---- 원본 CSV 읽기 (따옴표 안 쉼표 처리) ----
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1);
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, '').trim(), (r[i] || '').trim()])));
}
const person = t => {
  const m = t.trim().match(/^(.+?)\s*\((\d+)세\/(남|여)\/(.+?)\)?$/);
  return { name: m[1], age: Number(m[2]), gender: m[3], job: m[4].replace('음악 가', '음악가') };
};
const csv = parseCsv(fs.readFileSync(path.join(__dirname, '../data/TriPeaks_300_Episodes_V6_Sorted.csv'), 'utf8'));

// A) 원본 대조
assert.equal(csv.length, 300);
assert.equal(TP.EPISODES.length, 300, '300화 전부');
for (const row of csv) {
  const no = Number(row['에피소드'].replace(/\D/g, ''));
  const ep = TP.findEpisode(`ep${String(no).padStart(3, '0')}`);
  assert(ep, `ep${no} 없음`);
  assert.equal(TP.EPISODES.indexOf(ep), no - 1, `${ep.episodeId}: 배열 순서 = 에피소드 번호`);
  assert.equal(ep.continent, row['대륙'], `${ep.episodeId} 대륙`);
  assert.equal(ep.place, row['장소'], `${ep.episodeId} 장소`);
  assert.equal(ep.motiveType, row['살해 동기'] === '원한 및 복수' ? '해묵은 앙금' : row['살해 동기'], `${ep.episodeId} 동기 (복수 → 코지 표현)`);
  const culprit = ep.suspects.find(s => s.id === ep.actualCulpritId);
  const want = person(row['진범']);
  assert.deepEqual([culprit.name, culprit.age, culprit.gender, culprit.job], [want.name, want.age, want.gender, want.job], `${ep.episodeId} 진범`);
  const others = row['용의자들'].split(/\)\s*,\s*/).map(person)
    .filter(o => ep.suspects.some(s => s.name === o.name));   // 논리 그리드 퍼즐에 나오는 6명만 남김
  assert.equal(ep.suspects.length, others.length + 1, `${ep.episodeId} 용의자 수`);
  assert(ep.suspects.length <= 10, `${ep.episodeId}: 수사 보드 최대 10명`);
  for (const o of others) {
    assert(ep.suspects.some(s => s.name === o.name && s.age === o.age && s.gender === o.gender && s.job === o.job),
      `${ep.episodeId}: 용의자 ${o.name} 프로필`);
  }
  // 고백: 코지 톤 순화 외에는 원문 그대로 (문장 수 동일, 비어 있지 않음)
  const sentences = t => t.split(/(?<=[.?!])\s+/).length;
  assert(ep.confession && sentences(ep.confession) === sentences(row['스토리(진범의 고백)']), `${ep.episodeId} 고백`);
  assert(ep.background, `${ep.episodeId} 배경`);
}
console.log('A) V6 원본 대조 통과 (300화 · 장소 · 진범/용의자 프로필 · 동기 · 고백)');

// B) 대륙 챕터
const want = [['아시아', 1, 100], ['북아메리카', 101, 140], ['남아메리카', 141, 180], ['아프리카', 181, 230], ['유럽', 231, 280], ['오세아니아', 281, 300]];
assert.deepEqual(TP.EPISODE_CHAPTERS.map(c => [c.continent, c.from, c.to]), want);
const changes = [];
for (let i = 0; i + 1 < TP.EPISODES.length; i++) {
  const c = TP.chapterChange(TP.EPISODES[i], TP.EPISODES[i + 1]);
  if (c) changes.push(`${TP.EPISODES[i].no}→${TP.EPISODES[i + 1].no}:${c.from}→${c.to}`);
}
assert.deepEqual(changes, ['100→101:아시아→북아메리카', '140→141:북아메리카→남아메리카', '180→181:남아메리카→아프리카',
  '230→231:아프리카→유럽', '280→281:유럽→오세아니아']);
assert.equal(TP.chapterOf(TP.findEpisode(101)).index, 1);
console.log('B) 대륙 전환 5곳:', changes.join(' / '));

// C) 논리 그리드 단서 (data/V6_300_Episodes_Logic_Clues.json): 용의자 6 · 장소 6 · 물건 6, 단서 1~20 + 단서 21(광고)
{
  const logic = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/V6_300_Episodes_Logic_Clues.json'), 'utf8'));
  const josaOk = (t, words) => words.every(w => {
    const last = [...(w.split('(')[0] || w)].reverse().find(c => c >= '가' && c <= '힣');   // 괄호 설명 앞 낱말 기준
    if (!last) return true;
    const b = (last.charCodeAt(0) - 0xac00) % 28 !== 0;
    const bad = b ? ['를', '는', '와', '가'] : ['을', '은', '과', '이'];
    return !bad.some(j => t.includes(`${w}${j} `) || t.includes(`${w}${j}.`) || t.includes(`${w}${j},`));
  });
  for (const ep of TP.EPISODES) {
    const L = logic.find(x => x['에피소드 ID'] === ep.episodeId);
    assert(ep.logic && L, `${ep.episodeId}: 논리 그리드 데이터`);
    assert.equal(ep.suspects.length, 6, `${ep.episodeId}: 용의자 6명`);
    assert.equal(ep.logic.places.length, 6);
    assert.equal(ep.logic.items.length, 6);
    assert.deepEqual([...ep.logic.suspects].sort(), ep.suspects.map(s => s.id).sort());
    assert.equal(ep.logic.killer, L['진범']);
    assert.equal(ep.suspects.find(s => s.id === ep.actualCulpritId).name, L['진범'], `${ep.episodeId}: 진범 = 데이터의 진범`);
    ep.clues.forEach((c, i) => {
      const raw = L[`단서 ${i + 1}`];
      assert.equal(c.text, raw, `${ep.episodeId} #${i + 1}: 생성기(tools/logic_gen.py) 문장 그대로`);
      assert(josaOk(c.text, [...ep.suspects.map(s => s.name), ...ep.logic.places, ...ep.logic.items]), `${ep.episodeId} #${i + 1}: 조사 ${c.text}`);
      for (const f of c.facts) assert(c.text.includes(ep.suspects.find(s => s.id === f.suspect).name), '붉은 실은 이름이 나온 용의자에게만');
    });
    assert.equal(ep.hints.length, 1);
    assert(ep.hints[0].master && ep.hints[0].text.includes(L['진범']), `${ep.episodeId}: 단서 21 = 결정적 힌트`);
    // 단서 21은 범인을 대놓고 지목하지 않는다 (후보 2명 중 한 명의 알리바이 · 다른 한 명의 거짓 진술)
    assert(!/범인은|진범은/.test(ep.hints[0].text), `${ep.episodeId}: 단서 21은 범인을 직접 말하지 않음`);
    assert.equal(ep.logic.difficulty, L['난이도']);
    assert.equal(L['난이도'][0], String(ep.no <= 100 ? 1 : ep.no <= 200 ? 2 : 3), `${ep.episodeId}: 난이도 단계 (1~100 · 101~200 · 201~300)`);
    assert(L['검증']['범인 후보 수'].slice(0, 19).every(n => n >= 2), `${ep.episodeId}: 단서 19개까지 범인 후보 2명 이상`);
    assert(ep.clues.every(c => !/흉기/.test(c.text)), `${ep.episodeId}: 코지 톤 (흉기 → 범행 도구)`);
  }
  // 패턴 없음: 진범의 그리드 줄 위치가 고르게 퍼지고, 1번 단서 유형도 여러 가지
  const pos = [0, 0, 0, 0, 0, 0];
  for (const ep of TP.EPISODES) pos[ep.logic.suspects.indexOf(ep.actualCulpritId)]++;
  assert(pos.every(n => n >= 25), `진범 줄 위치가 한쪽으로 몰림: ${pos}`);
  const firstTypes = new Set(logic.map(x => x['단서 구조'][0].t));
  assert(firstTypes.size >= 5, '1번 단서 유형이 다양해야 함');
  console.log(`   진범 줄 위치 1~6: ${pos.join(' / ')} · 1번 단서 유형 ${firstTypes.size}종`);
  console.log(`C) 논리 그리드 ${TP.EPISODES.length}화: 용의자·장소·물건 6×6×6 · 단서 1~20 + 단서 21 · 진범 일치 · 조사 교정`);
}

// C-2) 수첩 상태: 그리드 칸 순환(빈칸 → X → O → 빈칸) 저장 · checkKiller · 결정적 힌트(단서 21)는 단서 20개 이후
{
  store.reset();
  const ep = TP.EPISODES[0];
  const sid = ep.suspects[0].id;
  assert.deepEqual([mystery.cycleGridCell(sid, 'p0'), mystery.cycleGridCell(sid, 'p0'), mystery.cycleGridCell(sid, 'p0')], ['x', 'o', '']);
  mystery.cycleGridCell(sid, 'i5');
  assert.deepEqual(store.state.episode.grid, { [`${sid}|i5`]: 'x' }, '빈칸은 저장하지 않음');
  store.update(s => { s.episode.grid = { a: 'o', b: 'z', c: 1 }; });
  assert.deepEqual(store.state.episode.grid, { a: 'o' }, '저장 데이터 정리');
  assert.equal(mystery.checkKiller(ep.logic.killer), true);
  assert.equal(mystery.checkKiller(ep.suspects.find(s => s.name !== ep.logic.killer).name), false);
  assert.equal(mystery.canWatchHint(), false, '단서 20개 전에는 결정적 힌트 없음');
  store.update(s => { s.episode.cleared = 20; });
  assert.equal(mystery.canWatchHint(), true);
  assert(mystery.revealHint().hint.master);
  assert.equal(mystery.canWatchHint(), false, '단서 21은 한 번');
  // 칸 확인: 힌트권 1장 소모 · 맞으면 그대로, 틀리면 정답으로 고침 · 같은 칸은 한 번만
  store.update(s => { s.hintCount = 2; s.episode.grid = {}; s.episode.gridVerified = []; });
  const ans = ep.logic.answer[sid];
  const rightCol = `p${ans.p}`, wrongCol = `p${(ans.p + 1) % 6}`;
  mystery.cycleGridCell(sid, rightCol); mystery.cycleGridCell(sid, rightCol);          // ○ (정답)
  mystery.cycleGridCell(sid, wrongCol); mystery.cycleGridCell(sid, wrongCol);          // ○ (오답)
  assert.deepEqual(mystery.checkGridCell(sid, rightCol), { ok: true, correct: true, truth: 'o' });
  assert.deepEqual(mystery.checkGridCell(sid, wrongCol), { ok: true, correct: false, truth: 'x' });
  assert.equal(mystery.gridCell(sid, wrongCol), 'x', '틀린 칸은 정답으로 고침');
  assert.equal(store.state.hintCount, 0);
  assert.equal(mystery.checkGridCell(sid, rightCol).reason, 'verified');
  assert.equal(mystery.checkGridCell(sid, 'i0').reason, 'empty');
  mystery.cycleGridCell(sid, 'i1');
  assert.equal(mystery.checkGridCell(sid, 'i1').reason, 'ticket');
  assert(mystery.checkGridCell(sid, 'i1', { free: true }).ok, '광고를 본 뒤에는 무료');
  for (const e of TP.EPISODES) for (const [id, a] of Object.entries(e.logic.answer)) {
    assert(e.logic.suspects.includes(id) && a.p >= 0 && a.i >= 0, `${e.episodeId}: 정답 데이터`);
    if (id === e.actualCulpritId) assert(a.p === 5 && a.i === 5, `${e.episodeId}: 진범 = 사건 현장 + 범행 도구`);
  }
  mystery.resetEpisode();
  assert.deepEqual(store.state.episode.grid, {}, '에피소드 초기화 시 그리드도 비움');
  console.log('C-2) 논리 그리드 저장 · checkKiller · 단서 21 광고 힌트 통과');
}

// C-3) 코지 미스터리 톤: 제목 · 소개 · 고백 · 동기 · 해설 · 힌트에 유혈 · 살인 표현 없음 (tools/cozy_rules.py BANNED 와 같은 목록)
{
  const BANNED = ['살인', '살해', '시체', '시신', '토막', '치명상', '암살', '독살', '혈흔', '유혈', '핏자국', '피를', '피가', '피는',
    '죽였', '죽이', '죽인', '죽여', '죽음', '죽었', '죽은', '죽어', '죽일', '피눈물', '지옥', '괴물', '숨이 멎', '숨이 끊', '총성', '사형', '뺑소니', '무참',
    '목숨', '비명', '흉기', '칼날', '처단', '단죄', '숨통', '목을 졸', '복수'];
  for (const ep of TP.EPISODES) {
    // 사람 이름 안의 글자(예: 펠리'피는')는 금지어가 아니다 → 이름을 지우고 검사
    const t = ep.suspects.reduce((acc, p) => acc.split(p.name).join('○'),
      [ep.title, ep.intro, ep.confession, ep.motiveType, ep.solutionText, ...ep.hints.map(h => h.text)].join(' '));
    for (const w of BANNED) {
      let i = -1;
      while ((i = t.indexOf(w, i + 1)) >= 0) {
        if (w[0] === '피' && '커소혈갈포알창'.includes(t[i - 1])) continue;   // 커피를 · 책갈피를 · 창피를 …
        assert.fail(`${ep.episodeId}: 코지 톤 금지어 '${w}' — ${t.slice(Math.max(0, i - 20), i + 20)}`);
      }
    }
  }
  console.log('C-3) 코지 미스터리 톤: 300화 금지어 0');
}

// D) 사건 해결 = 보상 한 번 + 다음 에피소드 + 챕터 전환
function solveAt(index) {
  store.reset();
  store.update(s => { s.episode = { ...TP.freshEpisodeState(index), cleared: 20 }; s.gold = 1000; s.undoCount = 0; s.wildcardCount = 0; });
  const before = { ...store.state };
  assert.deepEqual(mystery.accuse(TP.EPISODES[index].actualCulpritId), { correct: true });
  const r = mystery.solve();
  const after = store.state;
  assert.equal(after.gold - before.gold, 1000, '골드 1,000 한 번만');
  assert.equal(after.undoCount, 1);
  assert.equal(after.wildcardCount, 1);
  assert(after.exp > before.exp || after.playerLevel > before.playerLevel, 'EXP 200');
  assert.equal(after.episode.index, index + 1);
  assert.equal(after.episode.cleared, 0);
  assert(after.solvedEpisodes.includes(TP.EPISODES[index].episodeId));
  assert.equal(r.next, TP.EPISODES[index + 1]);
  return r;
}
assert.equal(solveAt(0).chapterChange, null, '1화 → 2화는 같은 대륙');
const c100 = solveAt(99).chapterChange;
assert.deepEqual([c100.from, c100.to, c100.firstEpisode.no], ['아시아', '북아메리카', 101]);
assert.equal(solveAt(279).chapterChange.to, '오세아니아');
console.log('D) 사건 해결 보상 1회 · 100화 해결 → "새로운 대륙 [북아메리카]" 전환 정보 통과');

// C-4) 붉은 실(단서 facts)은 문장에 '독립된 낱말'로 나온 용의자에게만 — 다른 이름의 일부(히나 ⊂ 히나타 · 위안 ⊂ 신위안)나
//      다른 낱말+조사(하루카+나 → 카나)로 걸리면 안 된다. 또 실제로 나온 이름이 빠져도 안 된다.
{
  const standalone = (text, name, names) => {
    let t = text;
    for (const n of names.filter(x => x !== name && x.length > name.length && x.includes(name))) t = t.split(n).join('\u2400'.repeat(n.length));
    let i = -1;
    while ((i = t.indexOf(name, i + 1)) >= 0) if (i === 0 || !/[가-힣]/.test(t[i - 1])) return true;
    return false;
  };
  let checked = 0;
  for (const ep of TP.EPISODES) {
    const names = ep.suspects.map(s => s.name);
    for (const c of ep.clues) {
      const linked = new Set(c.facts.map(f => f.suspect));
      for (const s of ep.suspects) {
        const should = standalone(c.text, s.name, names);
        assert.equal(linked.has(s.id), should, `${ep.episodeId} #${c.stage} '${s.name}' 붉은 실 ${should ? '누락' : '오연결'}: ${c.text}`);
        checked++;
      }
    }
  }
  console.log(`C-4) 붉은 실 연결 ${checked}건 검사 통과`);
}
