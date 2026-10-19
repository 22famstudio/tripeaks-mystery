// =====================================================================
// 글꼴: 영문 · 숫자는 어디서나 Luckiest Guy, 한글은 나눔스퀘어 (css/readability.css 글꼴 목록)
//   이 파일은 영문만 있는 글씨에 .lang-en (자간 · 굵기 고정)만 붙인다
// =====================================================================
//   글씨가 화면에 붙는 순간(MutationObserver) 문장 단위로 검사해 class="lang-en" 을 붙이거나 뗀다.
//     - 문장 = 가장 가까운 블록 요소(p · div · button · li …)의 글씨 전체. 그 안의 <b>·<span> 같은 인라인 조각도
//       문장에 한글이 있으면 영문 글꼴을 쓰지 않는다 (예: "다음 <b>STAGE 3</b> 시작" → 글꼴은 그대로, .lang-en 없음)
//     - 영문 글자(A~Z)가 있고 한글이 하나도 없으면 영문 글꼴 (숫자·기호만 있으면 붙이지 않음)
//   바꾸지 않는 곳: 입력칸 · 선택 상자 · 스크립트/스타일
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
  const LATIN = /[A-Za-z]/;
  const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'SMALL', 'SPAN', 'A', 'SUB', 'SUP', 'U', 'S', 'MARK', 'LABEL', 'CODE']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'IMG']);

  // 이 요소가 속한 '문장'의 글씨: 줄 안에 흐르는 인라인 요소면 감싸는 부모로 올라간다.
  //   따로 떠 있는 라벨(position: absolute — 예: 연승 배지의 WIN STREAK)이나 블록 요소는 그 자체가 문장
  const standsAlone = node => {
    if (!INLINE.has(node.tagName)) return true;
    const cs = getComputedStyle(node);
    return cs.display !== 'inline' || cs.position === 'absolute' || cs.position === 'fixed';
  };
  function sentenceOf(el) {
    let node = el;
    while (!standsAlone(node) && node.parentElement && node.parentElement !== document.body) node = node.parentElement;
    return node.textContent;
  }

  TP.isEnglishOnly = text => LATIN.test(text) && !HANGUL.test(text);

  function classify(el) {
    if (!el || el.nodeType !== 1 || SKIP.has(el.tagName)) return;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
    if (!own) { el.classList.remove('lang-en'); return; }
    el.classList.toggle('lang-en', TP.isEnglishOnly(el.textContent) && TP.isEnglishOnly(sentenceOf(el)));
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    classify(root);
    root.querySelectorAll('*').forEach(classify);
  }

  // 변경을 모아서 한 프레임에 한 번만 처리 (타이머 문구가 1초마다 바뀌어도 가볍게)
  const pending = new Set();
  let scheduled = false;
  function queue(el) {
    if (!el) return;
    pending.add(el);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const list = [...pending];
      pending.clear();
      list.forEach(el => {
        if (!el.isConnected) return;
        scan(el);
        // 인라인 조각이 바뀌면 같은 문장의 다른 조각도 다시 판단
        let p = el.parentElement;
        while (p && INLINE.has(el.tagName) && p !== document.body) { classify(p); if (!INLINE.has(p.tagName)) break; p = p.parentElement; }
      });
    });
  }

  function start() {
    scan(document.body);
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') queue(r.target.parentElement);
        else {
          queue(r.target);
          r.addedNodes.forEach(n => queue(n.nodeType === 1 ? n : n.parentElement));
        }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
