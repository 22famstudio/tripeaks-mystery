// 에피소드 번역 덮어쓰기 (js/episode-i18n.js) — 언어별로 화면 필드만 바뀌고 게임 데이터(id · 정답 · facts)는 그대로인지
//   번역 문장 자체의 논리 검사는 node tools/episode_audit.js --translations
// 실행: node tests/episode-i18n.test.js
const assert = require('assert');
const path = require('path');

function load(lang) {
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}js${path.sep}`)) delete require.cache[k];
  globalThis.TP = { i18n: { lang } };
  require('../js/data/episodes.js');
  const before = JSON.parse(JSON.stringify(globalThis.TP.EPISODES));
  if (lang !== 'ko') require(`../js/data/episodes.${lang}.js`);
  require('../js/episode-i18n.js');
  return { TP: globalThis.TP, before };
}

const ko = load('ko').TP.EPISODES;
for (const lang of ['en', 'ja']) {
  const { TP, before } = load(lang);
  const eps = TP.EPISODES;
  assert.equal(eps.length, before.length);
  for (let i = 0; i < eps.length; i++) {
    const e = eps[i], b = before[i];
    assert.notEqual(e.title, b.title, `${lang} ${e.episodeId} 제목 번역`);
    assert.doesNotMatch(e.clues.map(c => c.text).join(' ') + e.hints.map(h => h.text).join(' ') + e.confession + e.intro, /[가-힣]/, `${lang} ${e.episodeId} 단서 · 힌트 · 고백 · 개요에 한글이 남음`);
    assert.doesNotMatch(e.suspects.map(s => s.name + s.job + s.trait).join(' '), /[가-힣]/, `${lang} ${e.episodeId} 용의자 정보에 한글`);
    // 게임 데이터는 그대로
    assert.equal(e.actualCulpritId, b.actualCulpritId);
    assert.deepEqual(e.suspects.map(s => [s.id, s.gender, s.age]), b.suspects.map(s => [s.id, s.gender, s.age]));
    assert.deepEqual(e.clues.map(c => [c.stage, c.facts]), b.clues.map(c => [c.stage, c.facts]));
    assert.deepEqual(e.logic.answer, b.logic.answer);
    assert.equal(e.logic.places.filter(p => p.endsWith('(사건현장)')).length, 1, '사건 현장 표시 유지');
    // 진범 이름 = 번역된 진범 용의자 이름 (checkKiller)
    assert.equal(e.logic.killer, e.suspects.find(s => s.id === e.actualCulpritId).name);
  }
  assert.equal(eps.length, 300, `${lang}: 300화 모두`);
  assert.doesNotMatch(TP.EPISODE_CHAPTERS.map(c => c.continent).join(''), /[가-힣]/, `${lang}: 대륙 이름`);
}
assert.match(ko[100].clues[0].text, /[가-힣]/, 'ko 는 덮어쓰기 없음');
console.log('에피소드 번역 덮어쓰기 통과 (en · ja 1~300화, 게임 데이터 불변)');
