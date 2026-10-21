// 에피소드 검수 — node tools/episode_audit.js [--from 1] [--to 300] [--json]
//   번역(3단계) 전후로 돌려서 논리 · 문장 · 설정 오류를 찾는다. tools/logic_gen.py 와 따로 만든 풀이기로 다시 푼다.
//
//   논리 (오류 = 종료 코드 1)
//     L1 정답 배치가 단서 1~20 을 모두 만족하는가
//     L2 단서 20개로 배치가 하나만 남고, 범인 = 진범인가
//     L3 단서 19개까지는 범인 후보가 2명 이상인가
//     L4 단서 21(결정적 힌트)의 사실(알리바이 · 목격)이 정답과 맞고, 미끼가 19번째 뒤 남은 후보인가
//     L5 episodes.js 의 단서 문장 · 정답 · 진범이 data/V6_300_Episodes_Logic_Clues.json 과 같은가
//     L6 단서 문장에 그 단서가 다루는 이름 · 장소 · 물건이 모두 나오고, 다른 용의자 이름은 없는가
//   문장 · 설정 (경고)
//     W1 증인 역할 이름이 같은 에피소드 용의자의 직업과 같다 ("바텐더의 증언" — 용의자 바텐더와 헷갈림)
//     W2 증인 말투 머리말이 복합 논리 단서에 붙었다 ("집사가 기억하기로, 만약 ~라면 …")
//     W3 조사 받침 불일치 (이름 · 장소 · 물건 바로 뒤)
//     W4 설정 모순 (열대 도시의 눈 · 내륙 도시의 유람선 · '낡은 오래된' 겹말)
//     W5 성별과 맞지 않는 직업 (수녀 · 신부)
//     W6 한국어 낱말로 읽히는 이름 (멍한 · 위한 …) — 번역 때 원래 표기를 확인할 것
//     W7 해결 문구 · 고백의 진범 이름 · 직업 불일치
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
globalThis.TP = {};
require(path.join(ROOT, 'js/data/episodes.js'));
const JSONDATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/V6_300_Episodes_Logic_Clues.json'), 'utf8'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const FROM = arg('--from', 1), TO = arg('--to', 300);
const N = 6, CRIME = 5;

// ---------- 풀이기 (logic_gen.py 와 별개 구현) ----------
const perms = (() => {
  const out = [];
  const rec = (a, used) => { if (a.length === N) return out.push(a.slice()); for (let x = 0; x < N; x++) if (!used[x]) { used[x] = 1; a.push(x); rec(a, used); a.pop(); used[x] = 0; } };
  rec([], []);
  return out;
})();
const who = (it, i) => it.indexOf(i);
const SEM = {   // 문장을 읽고 정한 뜻 (pl[s] = 용의자 s 의 장소, it[s] = 물건)
  NOT_PLACE: (c, pl) => pl[c.s] !== c.p,
  IS_PLACE: (c, pl) => pl[c.s] === c.p,
  NOT_PLACES: (c, pl) => pl[c.s] !== c.p && pl[c.s] !== c.p2,
  OR_PLACE: (c, pl) => pl[c.s] === c.p || pl[c.s] === c.p2,
  NOT_AT: (c, pl) => pl[c.s] !== c.p && pl[c.s2] !== c.p,
  OR_AT: (c, pl) => pl[c.s] === c.p || pl[c.s2] === c.p,
  NEIGHBOR: (c, pl) => Math.abs(pl[c.s] - pl[c.s2]) === 1,
  NOT_NEIGHBOR: (c, pl) => Math.abs(pl[c.s] - pl[c.s2]) !== 1,
  LEFT_OF: (c, pl) => pl[c.s] < pl[c.s2],
  NOT_ITEM: (c, pl, it) => it[c.s] !== c.i,
  IS_ITEM: (c, pl, it) => it[c.s] === c.i,
  NOT_ITEMS: (c, pl, it) => it[c.s] !== c.i && it[c.s] !== c.i2,
  NOT_HOLDERS: (c, pl, it) => it[c.s] !== c.i && it[c.s2] !== c.i,
  OR_HOLDER: (c, pl, it) => it[c.s] === c.i || it[c.s2] === c.i,
  PLACE_NOT_ITEM: (c, pl, it) => pl[who(it, c.i)] !== c.p,
  ITEM_AT_PLACE: (c, pl, it) => pl[who(it, c.i)] === c.p,
  XOR: (c, pl, it) => (pl[c.s] === c.p) !== (it[c.s] === c.i),
  IFF: (c, pl, it) => (pl[c.s] === c.p) === (it[c.s] === c.i),
  IF_THEN: (c, pl, it) => pl[c.s] !== c.p || it[c.s] === c.i,
  IF_THEN_X: (c, pl, it) => pl[c.s] !== c.p || it[c.s2] === c.i,
  ITEM_NEIGHBOR: (c, pl, it) => Math.abs(pl[who(it, c.i)] - pl[who(it, c.i2)]) === 1,
  ITEM_LEFT_OF: (c, pl, it) => pl[who(it, c.i)] < pl[who(it, c.i2)],
  HOLDER_NEAR_PLACE: (c, pl, it) => Math.abs(pl[who(it, c.i)] - c.p) === 1,
};
const PLACE_ONLY = new Set(['NOT_PLACE', 'IS_PLACE', 'NOT_PLACES', 'OR_PLACE', 'NOT_AT', 'OR_AT', 'NEIGHBOR', 'NOT_NEIGHBOR', 'LEFT_OF']);
const ITEM_ONLY = new Set(['NOT_ITEM', 'IS_ITEM', 'NOT_ITEMS', 'NOT_HOLDERS', 'OR_HOLDER']);
function solutions(clues) {
  const P = perms.filter(pl => clues.every(c => !PLACE_ONLY.has(c.t) || SEM[c.t](c, pl)));
  const I = perms.filter(it => clues.every(c => !ITEM_ONLY.has(c.t) || SEM[c.t](c, null, it)));
  const mixed = clues.filter(c => !PLACE_ONLY.has(c.t) && !ITEM_ONLY.has(c.t));
  const out = [];
  for (const pl of P) {
    const k = pl.indexOf(CRIME);
    for (const it of I) if (it.indexOf(CRIME) === k && mixed.every(c => SEM[c.t](c, pl, it))) out.push([pl, it]);
  }
  return out;
}

// ---------- 문장 도우미 ----------
const bare = s => String(s).split('(')[0].trim();
const lastHangul = w => [...bare(w)].reverse().find(ch => ch >= '가' && ch <= '힣');
const hasBatchim = w => { const c = lastHangul(w); return c ? (c.charCodeAt(0) - 0xac00) % 28 !== 0 : null; };
const isRieul = w => { const c = lastHangul(w); return c ? (c.charCodeAt(0) - 0xac00) % 28 === 8 : false; };
const JOSA = [['은', '는'], ['이', '가'], ['을', '를'], ['과', '와'], ['이나', '나'], ['이었', '였'], ['이다', '다'], ['으로', '로']];

const WITNESS_ROLES = ['집사', '정원사', '가정부', '요리사', '프런트 직원', '룸메이드', '도어맨', '벨보이', '펜션 주인', '낚시꾼', '등대지기', '경비원', '청소 직원',
  '야간 당직 연구원', '고물상', '순찰 경관', '근처 노점상', '세관원', '부두 노동자', '선원', '역무원', '청소부', '열차 승무원', '선장', '승무원', '바텐더', '갑판원', '사서',
  '야간 경비원', '단골 이용자', '신부님', '종지기', '성가대원', '수녀님', '학예사', '안내원', '복원 기술자', '딜러', '지배인', '피아니스트', '웨이터', '클럽 사장',
  '다방 주인', '단골 손님', '배달 소년', '관리인', '세차장 직원', '무대 감독', '조명 기사', '의상 담당', '매표소 직원', '목격자', '이웃'];
const TESTIMONY_LEAD = /^(.+?)(의 증언: |(이|가) 기억하기로, |(은|는) 이렇게 말했다\. |(이|가) 조용히 귀띔했다\. |의 진술서 — )/;
const COMPOUND = new Set(['XOR', 'IFF', 'IF_THEN', 'IF_THEN_X', 'OR_PLACE', 'OR_AT', 'OR_HOLDER', 'ITEM_NEIGHBOR', 'ITEM_LEFT_OF', 'HOLDER_NEAR_PLACE', 'LEFT_OF']);
const TROPICAL = ['싱가포르', '방콕', '마닐라', '뭄바이', '호이안', '홍콩', '타이베이', '마이애미', '하와이', '리우데자네이루', '리마', '카르타헤나', '나이로비', '다카르', '잔지바르', '마라케시', '카이로', '기자', '카사블랑카', '타히티', '피지', '아디스아바바', '상파울루', '보고타', '갈라파고스', '로스앤젤레스', '라스베이거스', '텍사스', '자카르타', '하노이', '두바이', '발리', '샌프란시스코', '케이프타운', '웰링턴', '시드니', '오클랜드'];
const LANDLOCKED = ['울란바토르', '카트만두', '라파스', '나이로비'];
const WORDLIKE = ['멍한', '위한', '천시', '시안', '이항', '호인', '록인', '이판', '보한', '이한', '보원', '사란', '이샤', '초이', '은우', '하준'];
const WORDLIKE_NOTE = { 멍한: '멍하다(dazed)', 위한: '~을 위한(for)', 천시: '천시하다(despise)', 시안: '시안(draft)', 이항: '이항(transposition)', 호인: '호인(good-natured man)', 록인: 'lock-in', 이판: '이판사판' };

const report = { errors: [], warnings: [] };
const err = (no, code, msg) => report.errors.push({ no, code, msg });
const warn = (no, code, msg) => report.warnings.push({ no, code, msg });

for (const ep of TP.EPISODES) {
  const no = ep.no;
  if (no < FROM || no > TO) continue;
  const J = JSONDATA[no - 1];
  if (!J || J['에피소드'] !== no) { err(no, 'L5', 'JSON 항목 없음'); continue; }
  const names = J['용의자'], places = J['그리드 장소'], items = J['그리드 물건'];
  const clues = J['단서 구조'];
  const ans = J['정답'];
  const pl = names.map(n => places.indexOf(ans[n]['장소']));
  const it = names.map(n => items.indexOf(ans[n]['물건']));
  const killer = names.indexOf(J['진범']);
  if (pl[killer] !== CRIME || it[killer] !== CRIME) err(no, 'L1', `정답에서 진범 ${J['진범']}이 사건 현장 · 범행 도구가 아님`);

  // L1
  clues.forEach((c, k) => { if (!SEM[c.t](c, pl, it)) err(no, 'L1', `단서 ${k + 1}(${c.t})이 정답과 맞지 않음: ${J[`단서 ${k + 1}`]}`); });
  // L2
  const sols = solutions(clues);
  if (sols.length !== 1) err(no, 'L2', `단서 20개로 남는 배치 ${sols.length}개`);
  const culprits = new Set(sols.map(([p]) => names[p.indexOf(CRIME)]));
  if (culprits.size !== 1 || !culprits.has(J['진범'])) err(no, 'L2', `범인 후보 ${[...culprits].join(',')} (진범 ${J['진범']})`);
  // L3
  const s19 = solutions(clues.slice(0, 19));
  const cand19 = new Set(s19.map(([p]) => p.indexOf(CRIME)));
  if (cand19.size < 2) err(no, 'L3', `단서 19개로 이미 범인이 정해짐`);
  // L4
  const hint = J['단서 21 (광고/마스터키)'];
  const hm = hint.match(/^결정적 모순: (.+?)의 알리바이는 사실로 확인됐다\. 그 시각 \1(?:은|는) (.+?)에 있었다\. 반면 (.+?)(?:은|는) '(.+?)에 있었다'고 진술했지만, 그 시각 \4에는 (.+?)(?:이|가) 있었다\./);
  if (!hm) err(no, 'L4', `힌트 문장 틀이 다름: ${hint}`);
  else {
    const [, D, DP, K, LP, W] = hm;
    const d = names.indexOf(D), w = names.indexOf(W);
    if (d < 0 || bare(places[pl[d]]) !== DP) err(no, 'L4', `힌트: ${D}의 장소 ${DP} ≠ 정답`);
    if (w < 0 || bare(places[pl[w]]) !== LP) err(no, 'L4', `힌트: ${LP}에 있던 사람 ${W} ≠ 정답`);
    if (K !== J['진범']) err(no, 'L4', `힌트의 거짓 진술자 ${K} ≠ 진범`);
    if (bare(places[pl[killer]]) === LP) err(no, 'L4', `힌트: 진범이 실제로 ${LP}에 있었음 (거짓 진술 아님)`);
    if (!cand19.has(d)) err(no, 'L4', `힌트의 알리바이 인물 ${D}는 19번째 뒤 후보가 아님`);
    if (d === killer || w === killer) err(no, 'L4', `힌트 인물이 진범`);
  }
  // L5
  const epNames = ep.suspects.map(s => s.name);
  if (names.some(n => !epNames.includes(n))) err(no, 'L5', `용의자 이름 불일치 ${names} / ${epNames}`);
  const cul = ep.suspects.find(s => s.id === ep.actualCulpritId);
  if (!cul || cul.name !== J['진범']) err(no, 'L5', `actualCulpritId ${cul && cul.name} ≠ 진범 ${J['진범']}`);
  ep.clues.forEach((c, k) => { if (c.text !== J[`단서 ${k + 1}`]) err(no, 'L5', `단서 ${k + 1} 문장이 JSON 과 다름`); });
  if (ep.clues.length !== 20) err(no, 'L5', `단서 수 ${ep.clues.length}`);
  for (const [id, a] of Object.entries(ep.logic.answer)) {
    const n = ep.suspects.find(s => s.id === id).name;
    if (bare(places[a.p]) !== bare(ans[n]['장소']) || bare(items[a.i]) !== bare(ans[n]['물건'])) err(no, 'L5', `logic.answer ${n} 불일치`);
  }
  // L6
  clues.forEach((c, k) => {
    const text = J[`단서 ${k + 1}`];
    const want = [];
    for (const key of ['s', 's2']) if (key in c) want.push(names[c[key]]);
    for (const key of ['p', 'p2']) if (key in c) want.push(bare(places[c[key]]));
    for (const key of ['i', 'i2']) if (key in c) want.push(bare(items[c[key]]));
    for (const w of want) if (!text.includes(w)) err(no, 'L6', `단서 ${k + 1}에 '${w}' 없음: ${text}`);
    const mentioned = names.filter((n, idx) => text.includes(n) && !['s', 's2'].some(key => c[key] === idx));
    for (const n of mentioned) {
      // 다른 낱말 속에 들어간 경우 (예: '위한')도 함께 알린다
      warn(no, 'W6', `단서 ${k + 1}에 다루지 않는 용의자 이름 '${n}'이 보임 (낱말 일부일 수 있음): ${text}`);
    }
    // W2
    const lead = text.match(TESTIMONY_LEAD);
    if (lead && COMPOUND.has(c.t)) warn(no, 'W2', `단서 ${k + 1} 증인 말투 + 복합 단서(${c.t}): ${text}`);
  });
  // W1
  const jobs = ep.suspects.map(s => s.job);
  const allText = ep.clues.map(c => c.text).join(' ');
  for (const role of WITNESS_ROLES) {
    const used = new RegExp(`(^|[ .—:])${role}(의|이|가|은|는) `).test(allText);
    const clash = jobs.find(j => j === role || j === role.replace('님', '') || (role.length >= 2 && j.endsWith(role)));
    if (used && clash) warn(no, 'W1', `증인 '${role}'과 용의자 직업 '${clash}'(${ep.suspects.find(s => s.job === clash).name})이 겹침`);
  }
  // W3 조사
  const words = [...names, ...places.map(bare), ...items.map(bare)];
  const texts = [...ep.clues.map(c => c.text), J['단서 21 (광고/마스터키)'], ep.intro, ep.solutionText];
  for (const t of texts) for (const w of words) {
    const b = hasBatchim(w);
    if (b === null) continue;
    let from = 0, at;
    while ((at = t.indexOf(w, from)) >= 0) {
      from = at + w.length;
      const rest = t.slice(from);
      for (const [withB, noB] of JOSA) {
        const good = (withB === '으로') ? (b && !isRieul(w) ? '으로' : '로') : (b ? withB : noB);
        const bad = good === withB ? noB : withB;
        if (rest.startsWith(bad) && !rest.startsWith(good) && /^[\s.,'"]/.test(rest.slice(bad.length) || ' ')) {
          if (bad === '이' && /^이[다었나]/.test(rest)) continue;   // '이다' 등은 아래 쌍에서 따로 본다
          if (bad === '로' && good === '으로') { /* 받침 뒤 '로' */ }
          warn(no, 'W3', `조사: '${w}${bad}' → '${w}${good}' : ${t.slice(Math.max(0, at - 10), at + w.length + 8)}`);
        }
      }
    }
  }
  // W4 설정
  if (/눈 덮인/.test(ep.place) && TROPICAL.includes(ep.city)) warn(no, 'W4', `열대 도시에 눈: ${ep.place}`);
  if (/눈보라/.test(ep.title) && TROPICAL.includes(ep.city)) warn(no, 'W4', `따뜻한 도시 제목에 눈보라: ${ep.title}`);
  if (/유람선/.test(ep.place) && LANDLOCKED.includes(ep.city)) warn(no, 'W4', `바다 없는 도시에 유람선: ${ep.place}`);
  if (/낡은 오래된/.test(ep.place)) warn(no, 'W4', `겹말 '낡은 오래된': ${ep.place}`);
  if (/눈 덮인 지하/.test(ep.place)) warn(no, 'W4', `지하인데 눈 덮인: ${ep.place}`);
  // W5 성별 · 직업
  for (const s of ep.suspects) {
    if (s.job === '수녀' && s.gender !== '여') warn(no, 'W5', `${s.name}(${s.gender}) 수녀`);
    if (s.job === '신부' && s.gender !== '남') warn(no, 'W5', `${s.name}(${s.gender}) 신부 — 가톨릭 신부는 남성 (여성이면 '신부(新婦)'로 읽힘)`);
    if (s.job === '전속 메이드' && s.gender !== '여') warn(no, 'W5', `${s.name}(${s.gender}) 메이드`);
  }
  // W6 낱말 같은 이름
  for (const s of ep.suspects) if (WORDLIKE_NOTE[s.name]) warn(no, 'W6', `이름 '${s.name}' = 한국어 ${WORDLIKE_NOTE[s.name]}로 읽힘`);
  // W8 한 이름이 다른 이름 속에 들어 있다 (하루카 · 카나 → '하루카나 코하루' 가 '하루 + 카나' 로도 읽힘)
  for (const a of epNames) for (const b of epNames) if (a !== b && b.includes(a)) warn(no, 'W8', `비슷한 이름: '${a}' ⊂ '${b}'`);
  for (const a of epNames) for (const b of epNames) {
    if (a === b) continue;
    const joined = ep.clues.map(c => c.text).find(t => t.includes(b + '나 ' + a) || t.includes(b + '나 ') && (b + '나').endsWith(a));
    if ((b + '나').endsWith(a) && joined) warn(no, 'W8', `'${b}나'가 '${a}'로도 읽힘: ${joined}`);
  }
  const dup = epNames.filter((n, i) => epNames.indexOf(n) !== i);
  if (dup.length) err(no, 'L5', `같은 이름의 용의자: ${dup}`);
  // W7
  if (!ep.solutionText.includes(cul.name) || !ep.solutionText.includes(cul.job)) warn(no, 'W7', `해결 문구에 진범 이름/직업 없음: ${ep.solutionText}`);
}

// ---------- 용어집 (data/i18n/glossary.json) — --glossary ----------
//   G1 에피소드에 나오는 이름 · 장소 · 물건 · 직업 · 도시 · 동기 · 증인이 용어집에 모두 있는가 (오류)
//   G2 한 에피소드 안에서 서로 다른 한국어가 같은 영어/일본어로 옮겨지지 않는가 (오류 — 단서가 헷갈림)
if (process.argv.includes('--glossary')) {
  const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/i18n/glossary.json'), 'utf8'));
  for (const ep of TP.EPISODES) {
    const no = ep.no;
    if (no < FROM || no > TO) continue;
    const need = (sect, ko) => { if (!G[sect] || !G[sect][ko]) err(no, 'G1', `용어집 ${sect}에 '${ko}' 없음`); return G[sect] && G[sect][ko]; };
    need('cities', ep.city); need('motives', ep.motiveType); need('difficulty', ep.logic.difficulty);
    ep.suspects.forEach(s => { need('names', s.name); need('jobs', s.job); });
    ep.logic.places.forEach(p => need('places', bare(p)));
    ep.logic.items.forEach(i => need('items', bare(i)));
    for (const role of WITNESS_ROLES) if (ep.clues.some(c => c.text.startsWith(role) || c.text.includes(' ' + role + '의 ') || c.text.startsWith(role + '의 '))) need('witnesses', role);
    for (const [sect, list] of [['names', ep.suspects.map(s => s.name)], ['places', ep.logic.places.map(bare)], ['items', ep.logic.items.map(bare)]]) {
      for (const li of [0, 1]) {
        const seen = new Map();
        for (const ko of list) {
          const tr = G[sect] && G[sect][ko] && G[sect][ko][li];
          if (!tr) continue;
          const key = tr.replace(/\(.*\)$/, '').toLowerCase();
          if (seen.has(key)) err(no, 'G2', `${sect}: '${seen.get(key)}' · '${ko}' → 둘 다 '${tr}' (${li ? 'ja' : 'en'})`);
          seen.set(key, ko);
        }
      }
    }
  }
}

// ---------- 번역 (js/data/episodes.{en,ja}.js) — --translations ----------
//   T1 번역 단서에 그 단서의 이름 · 장소 · 물건이 번역 표기 그대로 모두 들어 있는가 (오류)
//   T2 한 에피소드 안에서 번역 이름이 다른 번역 이름 속에 들어 있지 않은가 (오류 — 단서가 헷갈림)
//   T3 단서 수 · 용의자 · 그리드 장소/물건/진범이 빠짐없이 번역됐는가 (오류)
if (process.argv.includes('--translations')) {
  for (const lang of ['en', 'ja']) {
    const file = path.join(ROOT, 'js/data', `episodes.${lang}.js`);
    if (!fs.existsSync(file)) continue;
    globalThis.TP.EPISODE_I18N = {};
    delete require.cache[require.resolve(file)];
    require(file);
    const tr = globalThis.TP.EPISODE_I18N[lang];
    for (const [id, e] of Object.entries(tr.episodes)) {
      const ep = TP.EPISODES.find(x => x.episodeId === id);
      const no = ep.no;
      if (!e.clues) continue;           // 제목만 번역된 에피소드 (101화~)
      const J = JSONDATA[no - 1];
      const nameOf = ko => e.suspects[ep.suspects.find(s => s.name === ko).id].name;
      const trPlace = i => bare(e.logic.places[i]);
      const trItem = i => bare(e.logic.items[i]);
      if (e.clues.length !== 20 || Object.keys(e.suspects).length !== ep.suspects.length) err(no, 'T3', `${lang}: 단서/용의자 수`);
      if (e.logic.killer !== nameOf(J['진범'])) err(no, 'T3', `${lang}: 진범 이름 불일치`);
      J['단서 구조'].forEach((c, k) => {
        const text = e.clues[k];
        const want = [];
        for (const key of ['s', 's2']) if (key in c) want.push(nameOf(J['용의자'][c[key]]));
        for (const key of ['p', 'p2']) if (key in c) want.push(trPlace(c[key]));
        for (const key of ['i', 'i2']) if (key in c) want.push(trItem(c[key]));
        for (const w of want) if (!text.toLowerCase().includes(w.toLowerCase())) err(no, 'T1', `${lang} 단서 ${k + 1}에 '${w}' 없음: ${text}`);
      });
      const names = Object.values(e.suspects).map(s => s.name);
      for (const a of names) for (const b of names) if (a !== b && b.includes(a)) err(no, 'T2', `${lang}: '${a}' ⊂ '${b}'`);
    }
  }
}

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 1));
else {
  const by = {};
  for (const r of [...report.errors, ...report.warnings]) (by[r.code] ??= []).push(r);
  console.log(`에피소드 ${FROM}~${TO} 검수: 오류 ${report.errors.length} · 경고 ${report.warnings.length}`);
  for (const code of Object.keys(by).sort()) {
    console.log(`\n[${code}] ${by[code].length}건`);
    by[code].slice(0, 400).forEach(r => console.log(`  Ep.${r.no}: ${r.msg}`));
  }
}
process.exit(report.errors.length ? 1 : 0);
