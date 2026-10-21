// =====================================================================
// 에피소드 번역 덮어쓰기 — js/data/episodes.{en,ja}.js (tools/build_episode_i18n.py 가 만듦)
// =====================================================================
//   tripeaks.html 이 고른 언어의 번역 파일만 불러온 뒤 이 파일을 실행한다.
//   TP.EPISODES 의 화면용 필드(제목 · 개요 · 단서 · 힌트 · 고백 · 용의자 이름/직업/배경 · 그리드 장소/물건 …)를 번역으로 바꾼다.
//   id · 정답 배치 · 진범 id · 단서 facts 같은 게임 데이터는 그대로라 저장 데이터와 논리는 언어와 상관없다.
//   101화~ 는 아직 제목만 번역 (사건 파일 목록 · 잠긴 카드), 본문은 한국어.
// =====================================================================
(function () {
  const TP = globalThis.TP;
  const lang = TP.i18n && TP.i18n.lang;
  const data = lang && TP.EPISODE_I18N && TP.EPISODE_I18N[lang];
  if (!data || !Array.isArray(TP.EPISODES)) return;

  const FIELDS = ['title', 'subtitle', 'intro', 'continent', 'city', 'country', 'place', 'motiveType', 'confession', 'solutionText'];
  for (const ep of TP.EPISODES) {
    const tr = data.episodes[ep.episodeId];
    if (!tr) continue;
    for (const f of FIELDS) if (tr[f] != null) ep[f] = tr[f];
    if (tr.suspects) for (const s of ep.suspects) Object.assign(s, tr.suspects[s.id] || {});
    if (tr.clues) ep.clues.forEach((c, i) => { if (tr.clues[i] != null) c.text = tr.clues[i]; });
    if (tr.hints) ep.hints.forEach((h, i) => { if (tr.hints[i] != null) h.text = tr.hints[i]; });
    if (ep.logic && tr.logic) Object.assign(ep.logic, tr.logic);
  }
  // 대륙(챕터) 이름 — 챕터 전환 연출 · 로비 표시. 번역 안 된 에피소드의 continent 도 같은 이름으로 맞춘다
  for (const ch of TP.EPISODE_CHAPTERS || []) if (data.chapters[ch.continent]) ch.continent = data.chapters[ch.continent];
  for (const ep of TP.EPISODES) if (data.chapters[ep.continent]) ep.continent = data.chapters[ep.continent];
})();
