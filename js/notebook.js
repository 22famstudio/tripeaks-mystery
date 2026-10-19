// =====================================================================
// 탐정 수첩(코르크 보드) UI + 범인 지목 / 실패 시 BM 흐름
// =====================================================================
//   TP.createNotebook({ onSolvedNext, onReset }) → { open, close, render, isOpen, showClueAcquired }
//   - 평소: 모은 단서(포스트잇) · 용의자 폴라로이드(최대 10명) · ☆/✕ 마크 · 붉은 실(단서 ↔ 언급된 용의자)
//   - 범인을 자동으로 지워 주지 않는다: 단서의 '범인에 대한 사실'과 '용의자 관찰'을 플레이어가 직접 대조 (☆/✕ 메모는 직접)
//     붉은 실은 단서에 이름이 나온 용의자에게만 이어진다 / 사진을 누르면 용의자 파일 팝업
//   - 지목 단계(20개 단서 완성): 닫기 버튼이 사라지고 보드 중앙 [최종 범인 지목하기] → 지목 팝업 (공범 사건은 2명)
//   - 지목 성공: 진범의 고백(타이핑) → [사건 해결 완료] 도장 → 보상 → onSolvedNext({ chapterChange }) — 대륙 전환은 app.js
//   - 지목 실패: 재지목(500→400→300→200→0G, 광고 할인 / 힌트 3종 무료권) · 힌트 · 에피소드 초기화
//     비용 계산과 상태 변경은 전부 mystery.js, 여기서는 버튼 구성과 팝업만 담당한다.
// =====================================================================
(function () {
  const { TP } = globalThis;
  const $ = sel => document.querySelector(sel);
  const { openModal, closeModal, showDialog, toast, confettiAt, bigCelebration } = TP.ui;
  const mystery = TP.mystery;
  const store = TP.store;

  // 받침 유무에 따라 조사 선택: josa('미나', '을', '를') → '미나를'
  const josa = (word, withBatchim, without) => {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    return word + (code >= 0 && code < 11172 && code % 28 ? withBatchim : without);
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 초상화(1:1). 경로가 없거나 로드에 실패하면 이모지 + 색 원으로 대체한다.
  const avatar = (s, size = '') => s.portrait
    ? `<div class="avatar portrait ${size}" style="--c:${s.color}" data-emoji="${s.emoji}">
         <img src="${esc(s.portrait)}" alt="${esc(s.name)}" onerror="this.parentNode.classList.add('missing');this.remove()">
       </div>`
    : `<div class="avatar ${size}" style="--c:${s.color}">${s.emoji}</div>`;

  // 마크 이미지 (mark_circle_star.webp / mark_cross_x.webp). 배경 제거는 CSS의 SVG 필터가 담당.
  const markImg = kind => `<img class="mark-img ${kind}" src="${kind === 'star' ? TP.ASSETS.markStar : TP.ASSETS.markCross}" alt="">`;

  TP.createNotebook = function ({ onSolvedNext, onReset }) {
    const modal = $('#notebookModal');
    const isOpen = () => !modal.hidden;

    function open() {
      render();
      if (modal.hidden) TP.audio?.sfx?.('bookOpen');
      openModal(modal);
      // 처음 수첩을 열면 (보통 에피소드 1) 논리 그리드 사용법을 먼저 보여 준다
      if (mystery.episode?.logic && !store.state.gridGuideSeen) setTimeout(() => showGridGuide(), 450);
      // 새 단서 강조는 한 번 보여 준 뒤 읽음 처리
      setTimeout(() => mystery.markRead(), 1500);
    }

    function close() {
      if (mystery.isAccusationPhase()) return; // 지목 단계에서는 닫을 수 없다
      TP.audio?.sfx?.('bookClose');
      closeModal(modal);
    }

    $('#nbClose').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    // ---------- 렌더링 ----------
    function render() {
      const ep = mystery.episode;
      const p = mystery.progress;
      const accusing = mystery.isAccusationPhase();
      modal.querySelector('.notebook').classList.toggle('accusing', accusing);
      $('#nbClose').hidden = accusing;

      if (!ep) {
        $('#nbSub').textContent = '모든 사건을 해결했어요! 다음 에피소드를 준비 중입니다.';
        $('#nbBanner').hidden = true;
        $('#nbClueCount').textContent = '';
        $('#nbClues').innerHTML = '<li class="clue intro">자유 플레이로 골드를 모으며 새 사건을 기다려 주세요.</li>';
        $('#nbHints').innerHTML = '';
        $('#nbSuspects').innerHTML = '';
        return;
      }

      $('#nbSub').textContent = `EP${p.index + 1} · ${ep.title} — ${ep.subtitle}`;
      $('#nbClueCount').textContent = `${p.cleared}/${ep.clues.length}`;

      // 단서 (모은 것은 핀으로 꽂힌 메모, 아직인 것은 한 줄로 요약)
      const newFrom = p.cleared - p.unread;
      const lockedCount = ep.clues.length - p.cleared;
      $('#nbClues').innerHTML =
        `<li class="clue intro"><b>사건 개요</b> ${esc(ep.intro)}</li>` +
        ep.clues.slice(0, p.cleared).map((c, i) =>
          `<li class="clue pinned ${i >= newFrom ? 'new' : ''}" data-stage="${c.stage}" style="--tilt:${((i * 37) % 7) - 3}deg">
             <span class="pin"></span><b>#${c.stage}</b> ${esc(c.text)}</li>`
        ).join('') +
        (lockedCount ? `<li class="clue locked">🔒 다음 단서: 스테이지 ${p.cleared + 1} 클리어 시 획득 · 남은 단서 ${lockedCount}개</li>` : '');

      $('#nbHints').innerHTML = mystery.revealedHints()
        .map(h => `<div class="hint-note">💡 <b>${h.master ? '단서 #21 · 결정적 힌트' : '결정적 힌트'}</b> ${esc(h.text)}</div>`).join('');

      renderBanner(ep, p, accusing);
      renderSuspects(ep, p, accusing);
      renderGrid(ep);
      requestAnimationFrame(drawStrings);
    }

    // ---------- 용의자 / 논리 그리드 탭 ----------
    let checkMode = false;   // 논리 그리드 '칸 확인' 모드
    let tab = 'suspects';
    modal.querySelectorAll('.board-tab').forEach(btn => {
      btn.onclick = () => {
        tab = btn.dataset.tab;
        TP.audio?.sfx?.('pageFlip');
        render();
        if (tab === 'grid' && !store.state.gridGuideSeen) showGridGuide();
      };
    });

    // 논리 그리드: 세로 = 용의자 6명(초상화 + 이름), 가로 = [장소 6] | [물건 6]
    //   칸을 누를 때마다 빈칸 → X(빨간 가위표) → O(초록 동그라미) → 빈칸, 상태는 바로 저장된다 (TP.store episode.grid)
    function renderGrid(ep) {
      const wrap = $('#nbGrid');
      const onGrid = tab === 'grid' && !!ep?.logic;
      modal.querySelectorAll('.board-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === (onGrid ? 'grid' : 'suspects')));
      modal.querySelector('.board-tab[data-tab="grid"]').hidden = !ep?.logic;
      modal.querySelector('.notebook').classList.toggle('grid-mode', onGrid);   // 그리드가 보드 대부분을 차지 (휴대폰에서도 칸이 크게)
      $('#nbSuspects').hidden = onGrid;
      wrap.hidden = !onGrid;
      $('#nbTabHelp').textContent = onGrid ? '' : '사진을 누르면 용의자 파일 · ☆ 유력 · ✕ 제외 메모';
      if (!onGrid) return;
      const { places, items } = ep.logic;
      const people = ep.logic.suspects.map(id => ep.suspects.find(s => s.id === id)).filter(Boolean);
      const label = t => esc(t.replace(/\((사건현장|범행도구)\)/, ''));
      const implied = mystery.impliedCrosses();
      const cell = (s, col, first) => {
        const v = mystery.gridCell(s.id, col) || (implied.has(`${s.id}|${col}`) ? 'auto' : '');
        const ok = mystery.isGridCellVerified(s.id, col);
        return `<td class="${first ? 'split' : ''}"><button class="lg-cell ${v}${ok ? ' verified' : ''}" data-s="${s.id}" data-c="${col}"
          aria-label="${esc(s.name)}${ok ? ' (확인됨)' : ''}">${v ? '<i></i>' : ''}${ok ? '<em>✓</em>' : ''}</button></td>`;
      };
      const tickets = store.state.hintCount;
      const head = (t, i, first) => `<th class="lg-head${i === 5 ? ' crime' : ''}${first ? ' split' : ''}">
          <span>${label(t)}</span></th>`;   // 6번째 칸 = 사건 현장 · 범행 도구 (빨간 점, CSS .crime)
      wrap.innerHTML = `
        <div class="lg-bar">
          <span class="lg-legend"><i class="lg-mini x"></i>아니다 <i class="lg-mini o"></i>맞다 <i class="lg-mini auto"></i>자동</span>
          <span class="lg-goal">🎯 범인 = <b>사건 현장</b>에서 <b>범행 도구</b>를 가진 사람</span>
          <button class="lg-check${checkMode ? ' on' : ''}" title="표시한 ✕·○ 한 칸이 맞는지 확인해요 (힌트권 1장 · 없으면 광고)">🎟 칸 확인 <b>${tickets || '📺'}</b></button>
          <button class="lg-help" aria-label="논리 그리드 사용법">?</button>
          <button class="lg-clear">지우기</button>
        </div>
        ${checkMode ? '<p class="lg-check-tip">확인할 ✕ 또는 ○ 칸을 누르세요 (틀렸다면 정답으로 고쳐 드려요)</p>' : ''}
        <table class="logic-grid${checkMode ? ' checking' : ''}">
          <colgroup><col class="lg-col-who">${'<col>'.repeat(12)}</colgroup>
          <thead>
            <tr><th></th><th class="lg-group places" colspan="6">📍 장소 <small class="lg-corridor">현관 → 복도 순서 →</small></th><th class="lg-group items split" colspan="6">🔍 물건 · 특징</th></tr>
            <tr><th></th>${places.map((t, i) => head(t, i)).join('')}${items.map((t, i) => head(t, i, i === 0)).join('')}</tr>
          </thead>
          <tbody>${people.map(s => `
            <tr>
              <th class="lg-who">${avatar(s)}<b>${esc(s.name)}</b></th>
              ${places.map((_, i) => cell(s, `p${i}`)).join('')}
              ${items.map((_, i) => cell(s, `i${i}`, i === 0)).join('')}
            </tr>`).join('')}
          </tbody>
        </table>`;
    }
    async function checkCell(btn) {
      const { s, c } = btn.dataset;
      let r = mystery.checkGridCell(s, c);
      if (!r.ok && r.reason === 'empty') return toast('먼저 ✕ 또는 ○를 표시한 칸을 고르세요');
      if (!r.ok && r.reason === 'verified') return toast('이미 확인한 칸이에요');
      if (!r.ok && r.reason === 'ticket') {
        const go = await TP.ui.confirm({ title: '힌트권이 없어요', message: '광고를 보고 이 칸을 확인할까요?', okLabel: '📺 광고 보기' });
        if (!go || !(await showRewardAd())) return;
        r = mystery.checkGridCell(s, c, { free: true });
        if (!r.ok) return;
      }
      checkMode = false;
      if (r.correct) { TP.audio?.sfx?.('collect'); toast('✅ 맞아요! 이 칸은 확실해요'); }
      else { TP.audio?.sfx?.('error'); toast(`❌ 틀렸어요 — 이 칸은 ${r.truth === 'o' ? '○ 맞다' : '✕ 아니다'}예요. 정답으로 고쳐 두었어요`); }
      render();
    }
    $('#nbGrid').addEventListener('click', e => {
      const btn = e.target.closest('.lg-cell');
      if (btn) {
        if (checkMode) { checkCell(btn); return; }
        const v = mystery.cycleGridCell(btn.dataset.s, btn.dataset.c);   // 저장 → store 구독이 다시 그림
        TP.audio?.sfx?.(v === 'x' ? 'error' : v === 'o' ? 'click' : 'tick');
        return;
      }
      if (e.target.closest('.lg-check')) { checkMode = !checkMode; TP.audio?.sfx?.('click'); render(); return; }
      if (e.target.closest('.lg-help')) { showGridGuide(); return; }
      if (e.target.closest('.lg-clear')) {
        TP.ui.confirm({ title: '그리드 지우기', message: '논리 그리드의 ✕ · ○ 표시를 모두 지울까요?', okLabel: '지우기' })
          .then(ok => ok && mystery.clearGrid());
      }
    });

    // 논리 그리드 사용법 (처음 한 번 자동 · 그리드의 [?] 버튼으로 다시 보기)
    function showGridGuide() {
      store.update(s => { s.gridGuideSeen = true; });
      return showDialog({
        title: '📓 논리 그리드 사용법',
        className: 'grid-guide',
        sfx: 'pageFlip',
        body: `
          <ol class="gg-rules">
            <li><b>한 사람 = 장소 1곳 + 물건 1개.</b> 용의자 6명은 각자 정확히 한 곳에 있었고, 물건도 정확히 하나씩 가지고 있어요.</li>
            <li><b>한 장소 · 한 물건 = 한 사람.</b> 같은 장소에 두 사람이 있거나, 같은 물건을 두 사람이 가질 수는 없어요.</li>
            <li>칸을 누를 때마다 <span class="gg-cell"><i class="lg-mini x"></i> ✕ 아니다</span> → <span class="gg-cell"><i class="lg-mini o"></i> ○ 맞다</span> → 빈칸으로 바뀌어요.</li>
            <li>○를 하나 찾으면 <b>같은 줄의 다른 장소(또는 물건)</b>와 <b>같은 칸의 다른 사람</b>은 자동으로 흐린 ✕가 돼요.</li>
            <li><b>장소는 왼쪽부터 복도를 따라 한 줄.</b> "옆방" = 그리드에서 바로 이웃한 칸, "앞쪽 · 현관에 가까운" = 더 왼쪽 칸이에요.</li>
            <li>"만약 ~라면", "둘 중 하나", "둘 다 참이거나 둘 다 거짓" 같은 단서는 다른 단서와 엮어서 풀어요.</li>
            <li>단서를 하나씩 읽으며 ✕를 채워 가다 보면 남는 칸이 ○예요. 범인 후보는 단서 20번까지 다 모아야 한 명으로 좁혀져요.</li>
            <li><b>"거짓으로 밝혀졌다"</b>는 주장은 반대로 읽으면 돼요. <b>"확인되지 않았다"</b>는 소문은 참일 수도 거짓일 수도 있으니 그리드에 적지 마세요.</li>
            <li>막히면 <b>🎟 칸 확인</b>: 표시한 ✕·○ 한 칸이 맞는지 알려 줘요 (힌트권 1장, 없으면 광고).</li>
          </ol>
          <div class="gg-goal">🎯 <b>범인</b>은 <b>사건 현장</b>(빨간 장소 칸)에서 <b>범행 도구</b>(빨간 물건 칸)를 가진 사람!</div>
          <p class="small">예) "민지는 서재에 있었다" → 민지 줄의 <b>서재 칸 ○</b>. "만년필은 민지 것이 아니다" → 민지 줄의 <b>만년필 칸 ✕</b>.</p>`,
        buttons: [{ label: '알겠어요!', value: true, cls: 'primary' }],
      });
    }

    // ---------- 결정적 힌트 (단서 21 · 광고 / 마스터키) ----------
    //   단서 20개를 다 모으면 수첩 위쪽에 [결정적 힌트 보기] → 보상형 광고(showRewardAd) → 단서 21 해금
    async function watchHintAd() {
      if (!mystery.canWatchHint()) return;
      const watched = await showRewardAd();
      if (!watched) return;
      await showHint(mystery.revealHint());
    }

    // ---------- 붉은 실: 단서 메모 ↔ 그 단서가 언급한 용의자 ----------
    // 단서의 facts(용의자에 대한 사실)를 그대로 연결선으로 그린다. 메모/카드에 마우스를 올리면 관련 실만 강조.
    const cork = $('#nbCork');
    const strings = $('#nbStrings');
    const SVG_NS = 'http://www.w3.org/2000/svg';

    function drawStrings() {
      strings.replaceChildren();
      const ep = mystery.episode;
      if (!ep || modal.hidden) return;
      const base = cork.getBoundingClientRect();
      strings.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
      const point = (el, ax, ay) => {
        const r = el.getBoundingClientRect();
        return [r.left - base.left + r.width * ax, r.top - base.top + r.height * ay];
      };
      for (const clue of mystery.collectedClues()) {
        const note = cork.querySelector(`.clue[data-stage="${clue.stage}"]`);
        const suspects = [...new Set(clue.facts.filter(f => f.type === 'suspect' || f.type === 'clear').map(f => f.suspect))];
        for (const id of suspects) {
          const card = cork.querySelector(`.suspect[data-suspect="${id}"] .suspect-photo`);
          if (!note || !card) continue;
          const [x1, y1] = point(note, 0.5, 0.05);   // 메모의 핀
          const [x2, y2] = point(card, 0.5, 0.1);    // 초상화 위쪽
          const sag = Math.min(60, Math.hypot(x2 - x1, y2 - y1) * 0.15); // 실이 살짝 처지게
          const path = document.createElementNS(SVG_NS, 'path');
          path.setAttribute('d', `M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 + sag} ${x2},${y2}`);
          path.dataset.stage = clue.stage;
          path.dataset.suspect = id;
          strings.append(path);
        }
      }
    }

    function highlightStrings(attr, value) {
      strings.classList.toggle('focus', value != null);
      strings.querySelectorAll('path').forEach(pth => pth.classList.toggle('on', value != null && pth.dataset[attr] === String(value)));
    }

    cork.addEventListener('pointerover', e => {
      const clue = e.target.closest('.clue[data-stage]');
      const suspect = e.target.closest('.suspect[data-suspect]');
      if (clue) highlightStrings('stage', clue.dataset.stage);
      else if (suspect) highlightStrings('suspect', suspect.dataset.suspect);
      else highlightStrings(null, null);
    });
    cork.addEventListener('pointerleave', () => highlightStrings(null, null));
    new ResizeObserver(() => drawStrings()).observe(cork);
    cork.addEventListener('scroll', () => requestAnimationFrame(drawStrings), true); // 좌우 영역을 따로 스크롤해도 실이 따라감
    cork.addEventListener('load', () => drawStrings(), true); // 초상화가 늦게 로드돼 배치가 바뀌는 경우

    function renderBanner(ep, p, accusing) {
      const banner = $('#nbBanner');
      banner.hidden = !accusing;
      if (!accusing) return;
      if (p.canAccuse) {
        banner.className = 'accuse-banner';
        banner.innerHTML = `🔎 <b>모든 단서가 모였습니다. 진범을 지목하세요!</b>
          <span class="small">단서와 논리 그리드로 정리한 뒤, 보드 아래 [최종 범인 지목하기]를 누르세요.</span>
          ${mystery.canWatchHint() ? `<button class="hint-ad-btn"><img class="btn-icon" src="${TP.ASSETS.btnAdHint}" alt="">결정적 힌트 보기 <small>(광고 · 단서 21)</small></button>` : ''}`;
        banner.querySelector('.hint-ad-btn')?.addEventListener('click', watchHintAd);
        return;
      }
      banner.className = 'accuse-banner flee';
      banner.innerHTML = `🚨 <b>용의자가 도망가려 합니다!</b>${discountLadderHtml()}<div class="banner-actions"></div>`;
      const actions = banner.querySelector('.banner-actions');
      for (const o of fleeOptions()) {
        const btn = document.createElement('button');
        btn.className = o.cls || '';
        btn.innerHTML = o.label;
        btn.disabled = !!o.disabled;
        btn.onclick = () => handleFleeChoice(o.value);
        actions.append(btn);
      }
    }

    // 재지목 비용 사다리: 500 → 400 → 300 → 200 → 무료 (현재 단계 강조)
    function discountLadderHtml() {
      const p = mystery.progress;
      const steps = TP.REACCUSE_COST_STEPS;
      const current = p.hasFreeReaccuse ? -1 : Math.min(p.reaccuseAdWatchCount, steps.length - 1);
      const chips = steps.map((c, i) =>
        `<span class="step ${i === current ? 'now' : i < current ? 'done' : ''}">${c ? `${c}G` : '무료'}</span>`
      ).join('<i>›</i>');
      return `<div class="cost-ladder">${p.hasFreeReaccuse ? '<span class="step now ticket">🎟 무료 재지목권 보유</span>' : chips}</div>`;
    }

    // 지목 실패 후 선택지 (팝업과 배너가 같은 목록을 쓴다)
    function fleeOptions() {
      const p = mystery.progress;
      const ep = mystery.episode;
      const cost = mystery.reaccuseCost();
      const steps = TP.REACCUSE_COST_STEPS;
      const nextCost = steps[Math.min(p.reaccuseAdWatchCount + 1, steps.length - 1)];
      const hintsLeft = ep.hints.length - p.hintsShown;
      const tickets = store.state.hintCount;
      const freeNote = p.freeReaccuseGranted ? '' : ' · 3개 모두 보면 무료 재지목';

      const options = [{
        value: 'pay',
        cls: 'primary hot',
        label: p.hasFreeReaccuse ? '🎟 무료 재지목권으로 다시 지목하기'
          : cost === 0 ? '🫵 무료로 다시 지목하기'
          : `🪙 ${cost} 지불하고 다시 지목하기`,
      }];
      if (mystery.canDiscountWithAd()) {
        options.push({ value: 'discount', label: `📺 광고 보고 비용 할인 <small>(${cost}G → ${nextCost ? `${nextCost}G` : '무료'})</small>` });
      }
      if (!hintsLeft) options.push({ value: 'none', label: '💡 결정적 힌트 <small>(모두 확인함)</small>', disabled: true });
      else if (tickets > 0) options.push({ value: 'hintTicket', label: `💡 힌트권 사용 <small>(보유 ${tickets} · ${hintsLeft}개 남음${freeNote})</small>` });
      else options.push({ value: 'hintAd', cls: 'ad-hint', label: `<img class="btn-icon" src="${TP.ASSETS.btnAdHint}" alt="">광고 보고 결정적 힌트 <small>(${hintsLeft}개 남음${freeNote})</small>` });
      options.push({ value: 'reset', cls: 'danger-link', label: '에피소드 초기화 (처음부터 다시)' });
      return options;
    }

    // ---------- 용의자 폴라로이드 (최대 10명) ----------
    //   - 단서로 자동 소거하지 않는다 (흑백 · ✕ 도장 · 취소선 없음) — 추리는 플레이어 몫
    //   - ☆/✕ 버튼은 플레이어가 직접 하는 메모
    //   - 사진을 누르면 용의자 파일 팝업 (이름 · 나이 · 직업 · 배경 · 이 사람이 언급된 단서)
    function renderSuspects(ep, p, accusing) {
      const grid = $('#nbSuspects');
      grid.classList.toggle('many', ep.suspects.length > 8);
      grid.replaceChildren(...ep.suspects.slice(0, 10).map((s, i) => {
        const mark = p.marks[s.id];
        const card = document.createElement('div');
        card.className = `suspect selectable ${mark ? `mark-${mark}` : ''}`;
        card.dataset.suspect = s.id;
        card.style.setProperty('--tilt', `${((i * 53) % 7) - 3}deg`);
        card.innerHTML = `
          <div class="suspect-photo">${avatar(s)}${markImg('star')}${markImg('x')}</div>
          <div class="suspect-name">${esc(s.name)}</div>
          <div class="suspect-job">${esc(s.job)}${s.age ? ` · ${s.age}세` : ''}</div>
          <div class="suspect-trait">${esc(s.trait)}</div>
          <div class="mark-btns">
            <button class="mark star ${mark === 'star' ? 'on' : ''}" aria-label="유력 용의자 표시">${markImg('star')}</button>
            <button class="mark x ${mark === 'x' ? 'on' : ''}" aria-label="용의 선상 제외 표시">${markImg('x')}</button>
          </div>`;
        card.querySelector('.mark.star').onclick = e => { e.stopPropagation(); mystery.toggleMark(s.id, 'star'); };
        card.querySelector('.mark.x').onclick = e => { e.stopPropagation(); mystery.toggleMark(s.id, 'x'); };
        card.addEventListener('click', () => showSuspectInfo(s));
        return card;
      }));
      renderAccuseBar(ep, p, accusing);
    }
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 20개 단서가 모이면 보드 중앙 하단에 [최종 범인 지목하기] 버튼 → 지목 팝업 (단독 1명 / 공범 2명)
    function renderAccuseBar(ep, p, accusing) {
      const bar = $('#nbAccuseBar');
      bar.hidden = !accusing;
      if (!accusing) return;
      const need = TP.culpritIds(ep).length;
      bar.innerHTML = `
        <button class="final-accuse-btn" ${p.canAccuse ? '' : 'disabled'}>
          <span>🫵 최종 범인 지목하기</span>
          <small>${p.canAccuse ? (need > 1 ? `공범 사건 — ${need}명을 지목하세요` : '진범 1명을 지목하세요') : '재지목 기회를 먼저 얻으세요'}</small>
        </button>`;
      bar.querySelector('.final-accuse-btn').onclick = () => openAccusePicker();
    }

    // ---------- 용의자 파일 팝업 ----------
    async function showSuspectInfo(s) {
      const ep = mystery.episode;
      if (!ep) return;
      const related = mystery.collectedClues().filter(c => c.facts.some(f => f.suspect === s.id));
      const gender = s.gender === '여' ? '여성' : s.gender === '남' ? '남성' : '';
      const accusing = mystery.isAccusationPhase() && mystery.progress.canAccuse;
      const v = await showDialog({
        title: '🗂 용의자 파일',
        className: 'suspect-info',
        sfx: 'pageFlip',
        body: `
          <div class="suspect-file">
            <div class="file-photo">${avatar(s, 'lg')}</div>
            <dl>
              <dt>이름</dt><dd><b>${esc(s.name)}</b></dd>
              ${s.age ? `<dt>나이</dt><dd>${s.age}세${gender ? ` · ${gender}` : ''}</dd>` : ''}
              <dt>직업</dt><dd>${esc(s.job)}</dd>
              <dt>배경</dt><dd>${esc(s.bio || s.trait)}</dd>
            </dl>
          </div>
          ${related.length ? `<ul class="related-clues">${related.map(c => `<li><b>#${c.stage}</b> ${esc(c.text)}</li>`).join('')}</ul>`
            : '<p class="small">이 용의자를 언급한 단서를 아직 찾지 못했어요.</p>'}`,
        buttons: accusing
          ? [{ label: '닫기', value: false, cls: 'ghost' }, { label: '🫵 이 사람을 지목', value: 'accuse', cls: 'primary' }]
          : [{ label: '닫기', value: false, cls: 'primary' }],
      });
      if (v === 'accuse') openAccusePicker([s.id]);
    }

    // ---------- 최종 범인 지목 팝업 ----------
    //   공범 사건이면 진범 수만큼 고른다 (다 고른 상태에서 또 누르면 가장 먼저 고른 사람이 빠짐)
    async function openAccusePicker(preselect = []) {
      const ep = mystery.episode;
      if (!ep || !mystery.isAccusationPhase() || !mystery.progress.canAccuse) return;
      const need = TP.culpritIds(ep).length;
      let picked = preselect.slice(0, need);
      const pending = showDialog({
        title: '🫵 최종 범인 지목',
        className: 'accuse-picker-dialog',
        body: `
          <p class="picker-guide">${need > 1 ? `공범 사건입니다. 진범 <b>${need}명</b>을 모두 고르세요.` : '단 한 명의 <b>진범</b>을 고르세요.'}
            <span class="pick-count"></span></p>
          <div class="accuse-picker">${ep.suspects.map(s => `
            <button class="pick ${mystery.progress.marks[s.id] === 'x' ? 'memo-x' : ''}" data-id="${esc(s.id)}">
              ${avatar(s)}
              <b>${esc(s.name)}</b><small>${esc(s.job)}</small>
            </button>`).join('')}</div>
          <p class="small">틀리면 진범이 도망가려 해요! 재지목에는 골드나 광고가 필요합니다.</p>`,
        buttons: [{ label: '다시 생각하기', value: null, cls: 'ghost' }, { label: '🫵 지목한다!', value: 'go', cls: 'primary', disabled: true }],
      });
      const dlg = [...TP.ui.root().querySelectorAll('.accuse-picker-dialog')].pop();
      const go = dlg.querySelector('.actions .primary');
      const sync = () => {
        dlg.querySelectorAll('.pick').forEach(b => b.classList.toggle('picked', picked.includes(b.dataset.id)));
        dlg.querySelector('.pick-count').textContent = `(${picked.length}/${need})`;
        go.disabled = picked.length !== need;
      };
      dlg.querySelector('.accuse-picker').addEventListener('click', e => {
        const b = e.target.closest('.pick');
        if (!b) return;
        const id = b.dataset.id;
        picked = picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id].slice(-need);
        TP.audio?.sfx?.('choose');
        sync();
      });
      sync();
      if (await pending !== 'go') return;
      accuse(picked.map(id => ep.suspects.find(s => s.id === id)));
    }

    // ---------- 범인 지목 ----------
    async function accuse(chosen) {
      const suspect = chosen[0];
      const result = mystery.accuse(chosen.map(c => c.id));
      if (!result) return;
      await suspense(chosen);                      // 결과 발표 전 두근두근 (before_answer.ogg)
      if (result.correct) solved();
      else {
        render();
        await cutscene('failed');
        showFleePopup(suspect);
      }
    }

    // 지목 직후 결과 발표 전: 지목한 사람 사진이 두근두근 + before_answer.ogg (약 1.4초)
    function suspense(chosen) {
      TP.audio?.sfx?.('suspense');
      const overlay = document.createElement('div');
      overlay.className = 'suspense-scene';
      overlay.style.zIndex = 99000;
      overlay.innerHTML = `<div class="suspense-avatars">${chosen.map(c => avatar(c, 'lg')).join('')}</div><p>과연 진범은…?</p>`;
      TP.ui.root().append(overlay);
      const ms = reducedMotion() ? 500 : 1400;
      return new Promise(resolve => setTimeout(() => { overlay.remove(); resolve(); }, ms));
    }

    // 지목 결과 컷씬: 성공 = 스탬프 쾅 / 실패 = 경보등 + 도주 포스터. 끝나면 resolve.
    function cutscene(kind) {
      TP.audio?.sfx?.(kind === 'success' ? 'accuseSuccess' : 'accuseFail');
      const overlay = document.createElement('div');
      overlay.className = `cutscene ${kind}`;
      overlay.style.zIndex = 99000;
      overlay.innerHTML = `<img src="${kind === 'success' ? TP.ASSETS.popupAccuseSuccess : TP.ASSETS.popupAccuseFailed}" alt="">`;
      TP.ui.root().append(overlay);
      const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 1800;
      return new Promise(resolve => setTimeout(() => {
        overlay.classList.add('out');
        setTimeout(() => { overlay.remove(); resolve(); }, 250);
      }, ms));
    }

    async function showFleePopup(suspect) {
      const ep = mystery.episode;
      const choice = await showDialog({
        title: '🚨 추리가 틀렸습니다!',
        className: 'flee',
        body: `
          <p class="flee-text">용의자가 도망가려 합니다!</p>
          ${suspect ? `<p class="small">${esc(josa(suspect.name, '은', '는'))} 범인이 아니었어요. <b>단서를 다시 확인해 보세요.</b></p>` : ''}
          ${discountLadderHtml()}
          <p class="small">에피소드를 초기화하면 모은 단서 ${ep.clues.length}개가 모두 사라져요.</p>`,
        buttons: fleeOptions(),
      });
      handleFleeChoice(choice);
    }

    async function handleFleeChoice(choice) {
      if (choice === 'pay') {
        const r = mystery.buyReaccuse();
        if (r.ok) {
          toast(r.usedFreeTicket ? '🎟 무료 재지목권 사용! 다시 지목하세요'
            : r.cost ? `🪙 -${r.cost} · 다시 지목할 수 있어요!`
            : '무료로 다시 지목할 수 있어요!');
          render();
        } else if (r.reason === 'gold') {
          const go = await TP.ui.confirm({
            title: '골드가 부족해요',
            message: `재지목에 필요한 골드가 부족합니다. (필요: ${r.cost} G / 보유: ${r.gold} G)\n골드를 충전할 수 있는 상점으로 이동하시겠습니까?`,
            okLabel: '상점 이동',
          });
          if (go) await TP.ui.openShop({ tab: 'coin' });
          render();
        }
      } else if (choice === 'discount') {
        await TP.ui.watchRewardedAd(5);
        const cost = mystery.recordReaccuseAdWatched();
        toast(cost ? `📉 재지목 비용이 ${cost}G로 내려갔어요` : '🎉 이제 무료로 다시 지목할 수 있어요!');
        render();
      } else if (choice === 'hintAd') {
        await TP.ui.watchRewardedAd(5);
        await showHint(mystery.revealHint());
      } else if (choice === 'hintTicket') {
        await showHint(mystery.useHintTicket());
      } else if (choice === 'reset') {
        const sure = await showDialog({
          title: '정말 처음부터 다시 할까요?',
          className: 'flee',
          body: `<p>모은 단서 <b>${mystery.progress.cleared}개</b>, 수첩 메모, 힌트가 <b>모두 사라지고</b><br>스테이지 1부터 다시 시작합니다.</p>`,
          buttons: [{ label: '아니요, 돌아갈래요', value: false, cls: 'primary' }, { label: '초기화', value: true, cls: 'danger-link' }],
        });
        if (!sure) return;
        mystery.resetEpisode();
        closeModal(modal);
        toast('에피소드를 처음부터 다시 시작합니다');
        onReset?.();
      }
    }

    async function showHint(result) {
      if (!result) return;
      render();
      const { hint, grantedFreeReaccuse } = result;
      const names = (hint.eliminate || []).map(id => mystery.episode.suspects.find(s => s.id === id)?.name).filter(Boolean).join(', ');
      await showDialog({
        title: '💡 결정적 힌트',
        className: 'hint-dialog',
        body: `<p>${esc(hint.text)}</p>
          ${names ? `<p class="small">수첩에서 <b>${esc(names)}</b>에게 ✕ 표시를 해 두었어요.</p>` : ''}
          ${grantedFreeReaccuse ? '<p class="free-ticket">🎟 힌트 3종 완성! <b>무료 재지목권 1회</b>를 받았어요.</p>' : ''}`,
      });
    }

    // ---------- 사건 해결 ----------
    //   성공 컷씬 → 진범의 고백(타이핑) → [사건 해결 완료] 도장 → 보상 → (대륙이 바뀌면) 챕터 전환 → 다음 에피소드
    //   보상은 mystery.solve() → 홈·성장 모듈 completeCurrentEpisode 에서 한 번만 지급된다.
    async function solved() {
      const titleBefore = TP.titleOf(store.state);
      const levelBefore = store.state.playerLevel;
      const res = mystery.solve();
      const ep = res.episode;
      const titleAfter = TP.titleOf(store.state);
      const culprits = TP.culpritIds(ep).map(id => ep.suspects.find(s => s.id === id));
      const next = res.next;

      closeModal(modal);
      await cutscene('success');
      await confessionScene(ep, culprits);
      bigCelebration(4);
      setTimeout(() => bigCelebration(4), 900);

      const levelAfter = store.state.playerLevel;
      await showDialog({
        title: '🎉 사건 해결!',
        className: 'solved',
        art: { src: TP.ASSETS.congrats, cls: 'congrats-art' },
        body: `
          ${culprits.map(c => `<div class="culprit-reveal">${avatar(c, 'lg')}<div><small>${culprits.length > 1 ? '공범' : '진범'}</small><b>${esc(c.name)}</b> ${esc(c.job)}</div></div>`).join('')}
          <p class="solution">${esc(ep.solutionText)}</p>
          <div class="episode-rewards">
            <span>🪙 ${ep.rewards.gold.toLocaleString()}</span><span>↶ ${ep.rewards.undo}</span><span>★ ${ep.rewards.wild}</span>${TP.home ? '<span>EXP +200</span>' : ''}
          </div>
          ${levelAfter > levelBefore ? `<p class="title-up">⬆ 레벨 업! Lv.${levelBefore} → <b>Lv.${levelAfter}</b></p>` : ''}
          ${titleAfter !== titleBefore ? `<p class="title-up">🏅 칭호 승급! ${esc(titleBefore)} → <b>${esc(titleAfter)}</b></p>` : ''}
          <p class="small">${next ? `다음 사건: <b>EP${next.no} · ${esc(next.title)}</b>` : '준비된 모든 사건을 해결했어요!'}</p>`,
        buttons: [{ label: next ? '다음 사건으로 ▶' : '확인', value: true, cls: 'primary' }],
      });
      onSolvedNext?.({ solvedEpisode: ep, next, chapterChange: res.chapterChange });
    }

    // 진범의 고백: 초상화 + 한 글자씩 타이핑 (화면을 누르면 바로 끝까지) → 끝나면 [사건 해결 완료] 도장 쾅
    function confessionScene(ep, culprits) {
      const text = ep.confession || ep.solutionText || '';
      const c = culprits[0];
      const overlay = document.createElement('div');
      overlay.className = 'confession-scene';
      overlay.style.zIndex = 99000;
      overlay.innerHTML = `
        <div class="cf-bg" style="background-image:url('${esc(ep.background || '')}')"></div>
        <div class="cf-card">
          <div class="cf-head">
            <div class="cf-portraits">${culprits.map(x => avatar(x, 'lg')).join('')}</div>
            <div class="cf-who"><small>${culprits.length > 1 ? '공범의 고백' : '진범의 고백'}</small>
              <b>${culprits.map(x => esc(x.name)).join(' · ')}</b>
              <span>${esc(c.job)}${c.age ? ` · ${c.age}세` : ''} — ${esc(ep.place || ep.subtitle || '')}</span></div>
          </div>
          <p class="cf-text"><span class="cf-typed"></span><i class="cf-caret"></i></p>
          <div class="cf-stamp" aria-hidden="true"><span>사건 해결 완료</span><small>CASE CLOSED · EP${ep.no}</small></div>
          <button class="cf-next">탭하여 넘기기 ▶</button>
        </div>`;
      TP.ui.root().append(overlay);
      const typed = overlay.querySelector('.cf-typed');
      const nextBtn = overlay.querySelector('.cf-next');
      const chars = [...text];
      let i = 0;
      let timer = 0;
      let phase = 'typing';

      return new Promise(resolve => {
        const finishTyping = () => {
          clearInterval(timer);
          typed.textContent = text;
          phase = 'stamping';
          overlay.classList.add('typed');
          setTimeout(() => {
            overlay.classList.add('stamped');
            TP.audio?.sfx?.('stamp');
            nextBtn.textContent = '사건 종결 ▶';
            phase = 'done';
          }, reducedMotion() ? 0 : 350);
        };
        const close = () => {
          overlay.classList.add('out');
          setTimeout(() => { overlay.remove(); resolve(); }, 300);
        };
        overlay.addEventListener('click', () => {
          if (phase === 'typing') finishTyping();
          else if (phase === 'done') close();
        });
        if (reducedMotion() || !chars.length) { finishTyping(); return; }
        timer = setInterval(() => {
          typed.textContent += chars[i++];
          if (i % 3 === 0) TP.audio?.sfx?.('tick');
          if (i >= chars.length) finishTyping();
        }, 55);
      });
    }

    // ---------- 스테이지 클리어 시 단서 획득 연출 ----------
    // 단서 획득 팝업 (세로 파란 패널 · '단서 획득' 배지 · 집게로 집은 양피지에 큰 단서 글씨 · COLLECT)
    //   그림: popup_clue_badge.webp · clue_note_paper.webp (Higgsfield, 기존 배지 그림체) · derived/frame_result.webp · btn_collect.webp
    //   효과음: 뜰 때 clue_popup.ogg / COLLECT 를 누르면 clue_received.ogg (수첩에 저장)
    function showClueAcquired(clue) {
      const ep = mystery.episode;
      confettiAt(null, { particleCount: 40, spread: 50, origin: { x: 0.5, y: 0.35 }, colors: ['#f3e2b3', '#c96b6b', '#fff'] });
      TP.audio?.sfx?.('clue');
      const page = document.createElement('div');
      page.className = 'clue-screen';
      page.style.zIndex = 98600;
      page.innerHTML = `
        <div class="cs-panel" role="dialog" aria-modal="true" aria-label="단서 획득">
          <div class="cs-badge"><img src="game_assets/popup_clue_badge.webp" alt=""><span>단서 획득</span></div>
          <div class="cs-note">
            <b>단서 #${clue.stage}</b>
            <p>${esc(clue.text)}</p>
          </div>
          <p class="cs-saved"><img src="game_assets/icons/notebook.webp" alt="">탐정 수첩에 저장되었습니다 (${mystery.progress.cleared}/${ep.clues.length})</p>
          <button class="cs-collect" data-nosfx aria-label="확인"><img src="game_assets/btn_collect.webp" alt=""></button>
        </div>`;
      TP.ui.root().append(page);
      return new Promise(resolve => {
        page.querySelector('.cs-collect').onclick = () => {
          TP.audio?.sfx?.('clueSaved');            // 수첩에 저장되는 소리
          page.classList.add('out');
          setTimeout(() => { page.remove(); resolve(true); }, 220);
        };
      });
    }

    return { open, close, render, isOpen, showClueAcquired, showFleePopup };
  };
})();
