// 다국어 검사 — node tools/i18n_check.js [--unwrapped] [--json]
//   1) 번역할 문구 모으기: 코드의 T('…') · TP.t('…') 호출 + tripeaks.html 의 고정 문구(텍스트 · title · aria-label · alt · placeholder)
//   2) js/lang/en.js · ja.js 에 빠진 번역 · 쓰이지 않는 번역 · {자리표시자} 불일치를 보고
//   3) --unwrapped: 코드 안에서 아직 T() 로 감싸지 않은 한글 문자열 위치 (주석 제외, 대략적인 검사)
//   종료 코드: 빠진 번역이나 자리표시자 불일치가 있으면 1
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const HANGUL = /[가-힣]/;
const SKIP = new Set(['js/data', 'js/lang']);   // 에피소드 데이터(3단계) · 사전 자체

function jsFiles() {
  const out = [];
  const walk = d => {
    for (const f of fs.readdirSync(path.join(ROOT, d))) {
      const rel = `${d}/${f}`;
      if (SKIP.has(rel)) continue;
      const st = fs.statSync(path.join(ROOT, rel));
      if (st.isDirectory()) walk(rel); else if (f.endsWith('.js')) out.push(rel);
    }
  };
  walk('js');
  return out;
}

// 주석을 지운다 (문자열 · 템플릿 · 정규식 안의 // 는 남김 — 대략적)
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += n || ''; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ''; i++; } i += 2; continue; }
    out += c; i++;
  }
  return out;
}

function unescapeJs(s, quote) {
  try { return quote === '`' ? s.replace(/\\`/g, '`').replace(/\\\\/g, '\\').replace(/\\n/g, '\n') : JSON.parse('"' + s.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'); }
  catch { return s; }
}

const keys = new Map();          // 문구 → 처음 나온 곳
const unwrapped = [];
for (const f of jsFiles()) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  // T('…') · TP.t('…') · N_('…') (N_ = 표시할 때 T() 로 번역하는 데이터 이름 — 번역 목록에만 올림)
  const callRe = /(?<![\w.])(?:TP\.t|T|N_)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  let m;
  const callSpans = [];
  while ((m = callRe.exec(src))) {
    const text = unescapeJs(m[2], m[1]);
    if (m[1] === '`' && text.includes('${')) continue;
    if (!HANGUL.test(text)) continue;
    if (!keys.has(text)) keys.set(text, `${f}:${src.slice(0, m.index).split('\n').length}`);
    callSpans.push([m.index, m.index + m[0].length]);
  }
  if (process.argv.includes('--unwrapped')) {
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (!HANGUL.test(line)) return;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;                          // 주석 줄
      const stripped = line.replace(/\s\/\/\s.*$/, '')                       // 줄 끝 주석
        .replace(/(?<![\w.])(?:TP\.t|T|N_)\(\s*(['"`])(?:\\.|(?!\1)[^\\])*?\1/g, '')
        .replace(/(?:console\.(?:log|warn|error)|new Error)\(.*$/, '');        // 개발자용 로그 · 오류 문구는 번역 안 함
      if (HANGUL.test(stripped)) unwrapped.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`);
    });
  }
}

// tripeaks.html 고정 문구
const html = fs.readFileSync(path.join(ROOT, 'tripeaks.html'), 'utf8').replace(/<select[^>]*data-i18n-skip[\s\S]*?<\/select>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
for (const m of html.matchAll(/>([^<>]*[가-힣][^<>]*)</g)) keys.has(m[1].trim()) || keys.set(m[1].trim(), 'tripeaks.html');
for (const m of html.matchAll(/\s(?:title|aria-label|alt|placeholder)="([^"]*[가-힣][^"]*)"/g)) keys.has(m[1].trim()) || keys.set(m[1].trim(), 'tripeaks.html');

globalThis.TP = {};
for (const l of ['en', 'ja']) require(path.join(ROOT, 'js/lang', `${l}.js`));
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort().join(',');
let bad = 0;
const report = {};
for (const l of ['en', 'ja']) {
  const dict = TP.LANG_DATA[l] || {};
  const miss = [...keys.keys()].filter(k => dict[k] == null);
  const unused = Object.keys(dict).filter(k => !keys.has(k));
  const phBad = Object.keys(dict).filter(k => keys.has(k) && ph(k) !== ph(dict[k]));
  report[l] = { total: keys.size, translated: keys.size - miss.length, missing: miss, unused, placeholderMismatch: phBad };
  bad += miss.length + phBad.length;
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ keys: [...keys.entries()], report, unwrapped }, null, 1));
else {
  console.log(`번역할 문구 ${keys.size}개`);
  for (const l of ['en', 'ja']) {
    const r = report[l];
    console.log(`  ${l}: 번역 ${r.translated}/${r.total} · 빠짐 ${r.missing.length} · 안 쓰임 ${r.unused.length} · 자리표시자 불일치 ${r.placeholderMismatch.length}`);
    r.missing.slice(0, 15).forEach(k => console.log(`      빠짐: ${k.slice(0, 80)}  (${keys.get(k)})`));
    r.placeholderMismatch.forEach(k => console.log(`      자리표시자: ${k}`));
  }
  if (process.argv.includes('--unwrapped')) { console.log(`\n감싸지 않은 한글 ${unwrapped.length}줄`); unwrapped.forEach(u => console.log('  ' + u)); }
}
process.exit(bad ? 1 : 0);
