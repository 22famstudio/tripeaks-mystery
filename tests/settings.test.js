// 플레이어 설정 검증: 기본값 · 저장/불러오기 · 볼륨 범위 · 닉네임 정리
// 실행: node tests/settings.test.js
require('../js/store.js');

const { TP } = globalThis;
const assert = require('assert');
const store = TP.store;

store.reset();
assert.deepEqual(store.state.settings, { bgmOn: true, bgmVol: 70, sfxOn: true, sfxVol: 80, nickname: '탐정님' }, '기본값');

// 저장 · 값 검증 (볼륨은 0~100 정수, 켜기/끄기는 불리언)
store.update(s => { s.settings = { ...s.settings, bgmOn: false, bgmVol: 140, sfxVol: -5.7, nickname: '셜록' }; });
assert.deepEqual(store.state.settings, { bgmOn: false, bgmVol: 100, sfxOn: true, sfxVol: 0, nickname: '셜록' });
store.update(s => { s.settings.sfxVol = 'abc'; });
assert.equal(store.state.settings.sfxVol, 80, '숫자가 아니면 기본값');

// 닉네임: 앞뒤 공백 · 제어문자 · 꺾쇠 제거, 최대 12자, 비면 기본값
assert.equal(TP.sanitizeNickname('  왓슨 박사  '), '왓슨 박사');
assert.equal(TP.sanitizeNickname('<script>'), 'script');
assert.equal(TP.sanitizeNickname('\n\t'), '탐정님');
assert.equal(TP.sanitizeNickname(''), '탐정님');
assert.equal(TP.sanitizeNickname('가'.repeat(30)).length, TP.NICKNAME_MAX);

// 예전 세이브(settings 없음)도 기본값으로 채워짐
store.update(s => { delete s.settings; });
assert.equal(store.state.settings.nickname, '탐정님');

console.log('설정 테스트 통과');

// 스테이지 최고 별 저장: 1~3만, 잘못된 값은 정리
{
  const store = globalThis.TP.store;
  store.update(s => { s.stageStars = { ep001: { 1: 3, 2: 2, 3: 7, x: 1 }, ep002: 'bad', ep003: {} }; });
  require('assert').deepEqual(store.state.stageStars, { ep001: { 1: 3, 2: 2 } });
  console.log('스테이지 별 저장 정리 통과');
}

// 논리 그리드 메모: 단서 데이터 버전이 다르면(예전 퍼즐) 비우고, 같으면 유지
{
  const store = globalThis.TP.store;
  store.update(s => { s.episode = { ...s.episode, grid: { 'a|p0': 'o' }, logicVer: 1 }; });
  require('assert').deepEqual(store.state.episode.grid, {}, '예전 버전 그리드는 비움');
  store.update(s => { s.episode.grid = { 'a|p0': 'x' }; });
  require('assert').deepEqual(store.state.episode.grid, { 'a|p0': 'x' }, '같은 버전은 유지');
  console.log('논리 그리드 데이터 버전 정리 통과');
}
