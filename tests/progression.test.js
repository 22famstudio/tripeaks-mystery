// 성장 검증: 경험치 곡선 · 레벨업 · 7단계 칭호 · 코스튬 · 특별 할인 타이머
// 실행: node tests/progression.test.js
require('../js/economy.js');

const { TP } = globalThis;
const assert = require('assert');

// 1) 필요 EXP (home_progression_system 곡선: 100 + 20(L-1) + 4(L-1)^1.55) — 레벨마다 늘어 점점 느려진다
assert.deepEqual([1, 2, 10, 50, 100].map(TP.expToNext), [100, 124, 400, 2746, 7037]);
for (let lv = 1; lv < 300; lv++) assert(TP.expToNext(lv + 1) > TP.expToNext(lv));
assert.equal(TP.winExp({ bestCombo: 15 }), 75, '(45 + 15×2) × 1');
assert.equal(TP.winExp({ bestCombo: 15 }, 4), 131, '×4 배수 → EXP ×1.75');

// 2) 레벨업: 남는 EXP 이월, 한 번에 여러 레벨, 최대 레벨 고정
assert.deepEqual(TP.applyExp({ level: 1, exp: 90 }, 30), { level: 2, exp: 20, levelsGained: 1 });
const three = TP.expToNext(1) + TP.expToNext(2) + TP.expToNext(3);
assert.deepEqual(TP.applyExp({ level: 1, exp: 0 }, three + 5), { level: 4, exp: 5, levelsGained: 3 });
assert.deepEqual(TP.applyExp({ level: 999, exp: 0 }, 1e6), { level: 999, exp: 0, levelsGained: 0 });

// 3) 칭호 7단계 (home_progression_system LEVEL_TIERS 경계값). 첫 구간은 I~V 표기 유지
const title = lv => TP.playerTitle(lv, 0);
assert.deepEqual([1, 2, 3, 9, 13].map(title), [
  '오지랖 넓은 시민 I', '오지랖 넓은 시민 I', '오지랖 넓은 시민 II', '오지랖 넓은 시민 V', '오지랖 넓은 시민 V',
]);
assert.deepEqual([14, 33, 34, 53, 54, 103, 104, 153, 154, 199, 200, 999].map(title), [
  '흥신소 수습 인턴', '흥신소 수습 인턴', '흥신소 베테랑 소장', '흥신소 베테랑 소장', '동네 골목 명탐정', '동네 골목 명탐정',
  '미스터리 특수 해결사', '미스터리 특수 해결사', '국가대표 추리 거장', '국가대표 추리 거장', '글로벌 전설의 명탐정', '글로벌 전설의 명탐정',
]);
// 사건 해결로 승급 (기존 규칙 유지): Lv5여도 1건 해결 → 2단계 (로마 숫자 없음)
assert.equal(TP.playerTitle(5, 1), '흥신소 수습 인턴');
assert.equal(TP.playerTitle(5, 99), '글로벌 전설의 명탐정');

// 4) 홈 캐릭터: avatar_(레벨).webp — 레벨 이하 중 가장 큰 숫자 (avatar_11 = Lv.11부터)
const costume = lv => TP.avatarOf({ playerLevel: lv, solvedEpisodes: [] });
assert.deepEqual([1, 5, 6, 10, 11, 15, 16, 35, 130, 131, 810, 811, 999].map(costume).map(f => f.match(/avatar_(\d+)/)[1]),
  ['1', '1', '6', '6', '11', '11', '16', '31', '111', '131', '801', '811', '811']);
const fs = require('fs');
for (const n of TP.AVATAR_LEVELS) assert(fs.existsSync(`${__dirname}/../game_assets/avatar_${n}.webp`), `avatar_${n}.webp 없음`);
assert.equal(TP.costumeNameOf({ playerLevel: 14, solvedEpisodes: [] }), '체크무늬 수습생 트렌치코트');

// 4-1) 레벨 구간별 입장료·보상 인플레이션
assert.deepEqual([1, 13, 14, 34, 54, 104, 154, 200].map(lv => TP.entryFee(lv)), [100, 100, 150, 250, 400, 600, 850, 1200]);
assert.deepEqual(TP.rewardRange(14, 2), { min: 450, max: 660 });

// 5) 특별 할인 타이머: 3시간 창의 남은 시간
const day = new Date(2026, 9, 14).getTime();
assert.equal(TP.offerTimeLeft(day), 3 * 3600e3);
assert.equal(TP.offerTimeLeft(day + 2 * 3600e3 + 52 * 60e3 + 53e3), 7 * 60e3 + 7e3, '02:52:53 → 남은 00:07:07');

console.log('성장(레벨·칭호·코스튬) 테스트 통과');
