// =====================================================================
// 추리 시스템 로직 (DOM 없음): 에피소드 진행 · 단서 획득 · 수첩 마크 · 범인 지목 · 힌트
// =====================================================================
// 진행 상태는 TP.store.state.episode 에 저장된다 (localStorage).
//   { index, cleared, marks: { suspectId: 'star' | 'x' }, canAccuse, wrongAccusations, hintsShown, unread,
//     reaccuseAdWatchCount, hasFreeReaccuse, freeReaccuseGranted }
//   cleared  : 클리어한 스테이지 수 = 모은 단서 수. cleared === 20 이면 범인 지목 단계.
//   canAccuse: 지목 실패 후에는 false → 재지목 비용을 내면 다시 true.
//
// 재지목 비용 (지목 실패 = 진행 불가가 되지 않도록 항상 무료로 가는 길이 있다)
//   - 기본 500G, 할인 광고 1회당 단계적으로 500 → 400 → 300 → 200 → 0G (에피소드 단위로 누적)
//   - 결정적 힌트 3종을 모두 보면 무료 재지목권 1회 (에피소드당 1번 지급, 쓰면 사라짐)
//   - 무료 재지목권이 있으면 광고 할인보다 우선해서 0G
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const store = () => TP.store;

  TP.freshEpisodeState = index => ({
    index, cleared: 0, marks: {}, canAccuse: true, wrongAccusations: 0, hintsShown: 0, unread: 0,
    reaccuseAdWatchCount: 0, hasFreeReaccuse: false, freeReaccuseGranted: false, stamped: [],
    gridVerified: [],   // 힌트권으로 확인한 칸 ('용의자ID|p3' …)
    grid: {},   // 논리 그리드 칸: { '용의자ID|p0' ~ '|p5'(장소) · '|i0' ~ '|i5'(물건): 'x' | 'o' } — 빈칸은 저장하지 않음
  });

  // 논리 그리드 칸 상태 순환: 빈칸 → X(빨간 가위표) → O(초록 동그라미) → 빈칸
  TP.GRID_CYCLE = { '': 'x', x: 'o', o: '' };

  // ---------- 스토리 챕터 (대륙) ----------
  //   TP.EPISODE_CHAPTERS = [{ continent:'아시아', region:'Asia', from:1, to:100 }, ...] (episodes.js, V6 데이터 순서)
  //   데이터에 없으면 에피소드의 continent 필드로 판단
  TP.chapterOf = function (episode) {
    if (!episode) return null;
    const list = TP.EPISODE_CHAPTERS || [];
    const ch = list.find(c => episode.no >= c.from && episode.no <= c.to);
    if (ch) return { ...ch, index: list.indexOf(ch) };
    return episode.continent ? { continent: episode.continent, region: episode.region, from: episode.no, to: episode.no, index: -1 } : null;
  };

  // 다음 에피소드로 넘어갈 때 대륙이 바뀌면 새 챕터 정보, 아니면 null (예: 100화 → 101화 = 아시아 → 북아메리카)
  TP.chapterChange = function (prevEpisode, nextEpisode) {
    const a = TP.chapterOf(prevEpisode);
    const b = TP.chapterOf(nextEpisode);
    if (!b || (a && a.continent === b.continent)) return null;
    return { from: a ? a.continent : null, to: b.continent, chapter: b, firstEpisode: nextEpisode };
  };

  // episodeId('ep101') 또는 번호(101)로 에피소드 찾기
  TP.findEpisode = idOrNo => TP.EPISODES.find(e => e.episodeId === idOrNo || e.no === Number(idOrNo)) || null;

  // 재지목 비용 할인 테이블: 광고 [0회, 1회, 2회, 3회, 4회 이상]
  TP.REACCUSE_COST_STEPS = [500, 400, 300, 200, 0];

  // 순수 함수: 진행 상태(progress)만 보고 비용 계산 (테스트·UI 공용)
  TP.getReaccuseCost = function (progress) {
    if (progress.hasFreeReaccuse) return 0;
    const steps = TP.REACCUSE_COST_STEPS;
    return steps[Math.min(progress.reaccuseAdWatchCount || 0, steps.length - 1)];
  };

  // 스테이지마다 고정된 판 (같은 스테이지 = 같은 배치). FNV-1a 해시.
  TP.stageSeed = function (episodeId, stage) {
    let h = 0x811c9dc5;
    for (const ch of `${episodeId}:${stage}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) || 1;
  };

  // 진범 목록 (공범 사건이면 2명 이상)
  TP.culpritIds = episode => episode.actualCulpritIds || [episode.actualCulpritId];

  // 단서 앞 clueCount개만 보고 "아직 범인일 수 있는" 용의자 (논리 퍼즐 검증·디버그용)
  // facts 종류
  //   { type:'crime', attr, value }            범인에 대한 사실 (속성 대조형)
  //   { type:'suspect', suspect, attr, value } 특정 용의자에 대한 사실
  //   { type:'clear', suspect }                알리바이 확인 등으로 그 용의자를 직접 소거 (마스터 엑셀 방식)
  //   용의자 프로필의 attrs(성별 · 나이대)는 처음부터 알려진 사실로 친다 — V6 추리 단서 (tools/deduction_clues.py)
  //   ※ 게임 화면은 이 결과로 용의자를 자동으로 지우지 않는다 (검증 · 테스트용)
  TP.possibleCulprits = function (episode, clueCount = episode.clues.length) {
    const crimeFacts = {};
    // 프로필로 이미 알려진 속성 (성별 · 나이대 — 용의자 파일에 보임)
    const known = Object.fromEntries(episode.suspects.map(s => [s.id, { ...(s.attrs || {}) }]));
    const cleared = new Set();
    for (const clue of episode.clues.slice(0, clueCount)) {
      for (const f of clue.facts) {
        if (f.type === 'crime') crimeFacts[f.attr] = f.value;
        else if (f.type === 'clear') cleared.add(f.suspect);
        else (known[f.suspect] ??= {})[f.attr] = f.value;
      }
    }
    return episode.suspects
      .filter(s => !cleared.has(s.id))
      .filter(s => Object.entries(crimeFacts).every(([attr, v]) => known[s.id]?.[attr] === undefined || known[s.id][attr] === v))
      .map(s => s.id);
  };

  TP.mystery = {

    get episode() { return TP.EPISODES[store().state.episode.index] || null; },
    get progress() { return store().state.episode; },

    // 다음에 플레이할 스테이지 번호 (지목 단계이거나 에피소드가 없으면 null)
    nextStage() {
      const ep = this.episode;
      return ep && this.progress.cleared < ep.clues.length ? this.progress.cleared + 1 : null;
    },

    isAccusationPhase() {
      const ep = this.episode;
      return !!ep && this.progress.cleared >= ep.clues.length;
    },

    // ---------- 논리 그리드 (수첩) ----------
    gridCell(suspectId, col) { return this.progress.grid?.[`${suspectId}|${col}`] || ''; },

    // 칸을 눌렀을 때: 빈칸 → X → O → 빈칸. 새 상태를 돌려준다 (localStorage 에 바로 저장)
    cycleGridCell(suspectId, col) {
      const key = `${suspectId}|${col}`;
      const next = TP.GRID_CYCLE[this.gridCell(suspectId, col)];
      store().update(s => {
        s.episode.grid = { ...(s.episode.grid || {}) };
        if (next) s.episode.grid[key] = next;
        else delete s.episode.grid[key];
      });
      return next;
    },

    clearGrid() { store().update(s => { s.episode.grid = {}; s.episode.gridVerified = []; }); },

    // 칸 확인: 표시해 둔 ✕·○ 하나가 맞는지 정답과 대조 (힌트권 1장, 없으면 바깥에서 광고를 본 뒤 free=true 로 부른다)
    //   반환: { ok:false, reason:'empty'|'verified'|'ticket' } | { ok:true, correct, truth:'x'|'o' }
    //   틀렸으면 그 칸을 정답으로 바꿔 준다. 확인한 칸은 gridVerified 에 남아 ✓ 표시
    checkGridCell(suspectId, col, { free = false } = {}) {
      const ep = this.episode;
      const key = `${suspectId}|${col}`;
      const mark = this.gridCell(suspectId, col);
      if (!ep?.logic?.answer || !mark) return { ok: false, reason: 'empty' };
      if ((this.progress.gridVerified || []).includes(key)) return { ok: false, reason: 'verified' };
      if (!free && !store().spend('hintCount', 1)) return { ok: false, reason: 'ticket' };
      const a = ep.logic.answer[suspectId];
      const truth = (col[0] === 'p' ? a.p : a.i) === Number(col.slice(1)) ? 'o' : 'x';
      store().update(s => {
        s.episode.grid = { ...(s.episode.grid || {}), [key]: truth };
        s.episode.gridVerified = [...(s.episode.gridVerified || []), key];
      });
      return { ok: true, correct: mark === truth, truth };
    },
    isGridCellVerified(suspectId, col) { return (this.progress.gridVerified || []).includes(`${suspectId}|${col}`); },

    // ○ 에서 따라 나오는 ✕ (한 사람은 장소 · 물건이 하나씩, 한 장소 · 물건은 한 사람만) — 표시용, 저장하지 않음
    //   반환: Set('용의자ID|p3', …) — 직접 표시한 칸은 제외
    impliedCrosses() {
      const ep = this.episode;
      const out = new Set();
      if (!ep?.logic) return out;
      const grid = this.progress.grid || {};
      const ids = ep.logic.suspects;
      for (const [key, v] of Object.entries(grid)) {
        if (v !== 'o') continue;
        const [sid, col] = key.split('|');
        const kind = col[0];
        for (let i = 0; i < 6; i++) out.add(`${sid}|${kind}${i}`);   // 같은 사람의 같은 분류 다른 칸
        for (const other of ids) out.add(`${other}|${col}`);          // 같은 칸의 다른 사람
      }
      for (const key of Object.keys(grid)) out.delete(key);
      return out;
    },

    // 이름으로 범인 확인 (에피소드 데이터의 진범 이름과 비교) — 맞으면 true
    checkKiller(selectedName) {
      const ep = this.episode;
      if (!ep) return false;
      const killer = ep.logic ? ep.logic.killer : ep.suspects.find(s => s.id === ep.actualCulpritId)?.name;
      return String(selectedName).trim() === killer;
    },

    // 결정적 힌트(단서 21)는 단서 20개를 다 모으면 언제든 볼 수 있다 (광고 시청)
    canWatchHint() {
      return this.isAccusationPhase() && !!this.nextHint();
    },

    collectedClues() {
      return this.episode ? this.episode.clues.slice(0, this.progress.cleared) : [];
    },

    // 스테이지 클리어 → 그 스테이지의 단서 획득. 이미 받은 스테이지를 다시 깨면 null.
    collectClue(stage) {
      const ep = this.episode;
      if (!ep || stage !== this.progress.cleared + 1) return null;
      store().update(s => { s.episode.cleared += 1; s.episode.unread += 1; });
      return ep.clues[stage - 1];
    },

    markRead() {
      if (this.progress.unread) store().update(s => { s.episode.unread = 0; });
    },

    // 같은 마크를 다시 누르면 해제, 다른 마크를 누르면 교체
    toggleMark(suspectId, mark) {
      store().update(s => {
        if (s.episode.marks[suspectId] === mark) delete s.episode.marks[suspectId];
        else s.episode.marks[suspectId] = mark;
      });
    },

    // 지목: 단독 범행은 1명, 공범 사건은 진범 전원을 정확히 골라야 정답
    accuse(suspectIds) {
      const ep = this.episode;
      if (!this.isAccusationPhase() || !this.progress.canAccuse) return null;
      const picked = new Set([].concat(suspectIds));
      const culprits = TP.culpritIds(ep);
      const correct = picked.size === culprits.length && culprits.every(id => picked.has(id));
      if (!correct) store().update(s => { s.episode.canAccuse = false; s.episode.wrongAccusations += 1; });
      return { correct };
    },

    // ---------- 재지목 ----------
    reaccuseCost() {
      return TP.getReaccuseCost(this.progress);
    },

    // 할인 광고를 더 볼 수 있는가 (이미 무료면 의미 없음)
    canDiscountWithAd() {
      return !this.progress.canAccuse && this.reaccuseCost() > 0;
    },

    // 할인 광고 시청 완료 → 새 비용 반환
    recordReaccuseAdWatched() {
      store().update(s => { s.episode.reaccuseAdWatchCount += 1; });
      return this.reaccuseCost();
    },

    // 재지목 기회 얻기. 결과: { ok, cost, usedFreeTicket } 또는 { ok:false, reason:'gold', cost, gold }
    buyReaccuse() {
      const p = this.progress;
      if (!this.isAccusationPhase() || p.canAccuse) return { ok: false, reason: 'notNeeded', cost: 0 };
      if (p.hasFreeReaccuse) {
        store().update(s => { s.episode.hasFreeReaccuse = false; s.episode.canAccuse = true; });
        return { ok: true, cost: 0, usedFreeTicket: true };
      }
      const cost = this.reaccuseCost();
      if (cost > 0 && !store().spend('gold', cost)) {
        return { ok: false, reason: 'gold', cost, gold: store().state.gold };
      }
      store().update(s => { s.episode.canAccuse = true; });
      return { ok: true, cost, usedFreeTicket: false };
    },

    nextHint() {
      const ep = this.episode;
      return ep ? ep.hints[this.progress.hintsShown] || null : null;
    },

    revealedHints() {
      return this.episode ? this.episode.hints.slice(0, this.progress.hintsShown) : [];
    },

    // 결정적 힌트 공개: 힌트가 배제하는 용의자에게 자동으로 X 표시.
    // 마지막(3번째) 힌트까지 보면 무료 재지목권 1회 지급 (에피소드당 1번).
    // 반환: { hint, grantedFreeReaccuse } 또는 null
    revealHint() {
      const hint = this.nextHint();
      if (!hint) return null;
      const total = this.episode.hints.length;
      let grantedFreeReaccuse = false;
      store().update(s => {
        s.episode.hintsShown += 1;
        hint.eliminate.forEach(id => { s.episode.marks[id] = 'x'; });
        if (s.episode.hintsShown >= total && !s.episode.freeReaccuseGranted) {
          s.episode.freeReaccuseGranted = true;
          s.episode.hasFreeReaccuse = true;
          grantedFreeReaccuse = true;
        }
      });
      return { hint, grantedFreeReaccuse };
    },

    // 힌트권(아이템)으로 힌트 공개 — 광고 대신
    useHintTicket() {
      if (!this.nextHint() || !store().spend('hintCount', 1)) return null;
      return this.revealHint();
    },

    // 사건 해결: 보상 지급 + 해결 기록 + 다음 에피소드로
    //   보상(골드·되돌리기·와일드 + EXP 200)은 홈·성장 모듈의 completeCurrentEpisode 가 한 번만 지급한다.
    //   (모듈이 없는 환경 — 로직 테스트 등 — 에서는 저장소에 직접 지급)
    //   반환: { episode, next, chapterChange, levelUp } (예전 호출부 호환을 위해 episode 필드도 그대로 펼쳐 둔다)
    solve() {
      const ep = this.episode;
      let levelUp = null;
      const r = TP.home && typeof TP.home.completeCurrentEpisode === 'function'
        ? TP.home.completeCurrentEpisode(ep.rewards) : null;
      if (r && r.ok) levelUp = r.levelUp;
      else store().grant(ep.rewards);
      store().update(s => {
        if (!s.solvedEpisodes.includes(ep.episodeId)) s.solvedEpisodes.push(ep.episodeId);
        s.episode = TP.freshEpisodeState(s.episode.index + 1);
      });
      const next = this.episode;
      return { ...ep, episode: ep, next, chapterChange: TP.chapterChange(ep, next), levelUp };
    },

    // 에피소드 초기화: 단서·마크·힌트 모두 잃고 스테이지 1부터
    resetEpisode() {
      store().update(s => { s.episode = TP.freshEpisodeState(s.episode.index); });
    },
  };
})();
