// =====================================================================
// 비주얼 에셋 목록 (game_assets/)
// =====================================================================
// JS에서 쓰는 이미지 경로는 전부 여기서 꺼낸다. CSS가 직접 쓰는 이미지는 css/style.css의
// "비주얼 에셋" 섹션에 있고, 두 곳의 목록을 tools/asset-check.html이 한 번에 로드 검사한다.
//
// status
//   ok      : 그대로 사용
//   adjusted: 사용하지만 CSS로 보정 중 (잘라내기/색 키잉/모서리 마스크). 올바른 원본이 오면 보정 CSS만 지우면 된다.
//   mismatch: 파일 내용이 이름과 달라 사용하지 않음 → CSS 대체 표현 사용. 교체 파일이 오면 used를 true로.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const DIR = 'game_assets/';

  const RANK_FILE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  TP.ASSETS = {
    // ---- 카드 (180×260) ----
    cards: Object.fromEntries(Array.from({ length: 13 }, (_, i) => {
      const rank = i + 1;
      return [rank, `${DIR}card_${RANK_FILE[rank] || rank}.webp`];
    })),
    cardBack: `${DIR}card_back.webp`,
    cardWild: `${DIR}card_wild.webp`,
    cardHighlight: `${DIR}card_highlight.webp`,   // 196×276 금색 테두리 (투명)
    cardDimmed: `${DIR}card_dimmed.webp`,         // 180×260 반투명 검정 (투명)
    cardPlus: { 1: `${DIR}card_plus1.webp`, 2: `${DIR}card_plus2.webp`, 3: `${DIR}card_plus3.webp`, 5: `${DIR}card_plus5.webp` },
    cardLocked: `${DIR}card_locked.webp`,         // 잠긴·출시 예정 에피소드 카드

    // ---- 버튼 / 팝업 일러스트 ----
    btnUndo: `${DIR}btn_booster_undo.webp`,
    btnWild: `${DIR}btn_booster_wild.webp`,
    btnNotebook: `${DIR}btn_open_notebook.webp`,
    btnPause: `${DIR}btn_pause.webp`,
    btnAccuse: `${DIR}btn_accuse_submit.webp`,
    btnAdHint: `${DIR}btn_ad_hint.webp`,
    markStar: `${DIR}mark_circle_star.webp`,
    markCross: `${DIR}mark_cross_x.webp`,
    popupStageClear: `${DIR}popup_stage_clear.webp`,
    popupClueFound: `${DIR}popup_clue_found.webp`,
    popupAccuseSuccess: `${DIR}popup_accuse_success.webp`,
    popupAccuseFailed: `${DIR}popup_accuse_failed.webp`,
    popupSpecialOffer: `${DIR}popup_special_offer.webp`,
    defaultEpisodeBg: `${DIR}bg_detective_office.webp`,
    episodeThumbs: [`${DIR}card_episode_thumb_01.webp`, `${DIR}card_episode_thumb_02.webp`],
    uiEpisodeProgress: `${DIR}ui_episode_progress.webp`,   // 500×80 단서 진행 바 (인게임 상단)
    uiLoading: `${DIR}ui_loading.webp`,                    // 1920×1080 시작 로딩 화면
    uiTransition: `${DIR}ui_screen_transition1.webp`,      // 스테이지 입장 전환 (INVESTIGATING...)
    uiChapterTransition: `${DIR}ui_chapter_transition.webp`, // 1600×900 대륙(챕터) 이동 전환 (비행기 · TRANSITING...)      // 1600×900 스테이지 입장 전환 (카메라 찰칵)
    uiWinPage: `${DIR}ui_win_page.webp`,                   // 1600×900 클리어 화면 (CONGRATS! · 빈 골드 칸 · COLLECT 그림)
    congrats: `${DIR}congrats.webp`,                       // 사건 해결 팝업 배너 (투명 배경)
    iconGift: `${DIR}icon_gift.webp`,
    // 상점 상품 그림 (Higgsfield 생성, 기존 그림체에 맞춤) — 없으면 이모지
    products: {
      // 골드 코인 10종 (Higgsfield GPT Image 2.5, icon_gold · pack_chance_mini 그림체 참조 · 9 · 10단계는 7 · 8 참조해 더 많은 금으로)
      coin_tier_01: `${DIR}pack_coin_01.webp`, coin_tier_02: `${DIR}pack_coin_02.webp`, coin_tier_03: `${DIR}pack_coin_03.webp`,
      coin_tier_04: `${DIR}pack_coin_04.webp`, coin_tier_05: `${DIR}pack_coin_05.webp`, coin_tier_06: `${DIR}pack_coin_06.webp`,
      coin_tier_07: `${DIR}pack_coin_07.webp`, coin_tier_08: `${DIR}pack_coin_08.webp`, coin_tier_09: `${DIR}pack_coin_09.webp`, coin_tier_10: `${DIR}pack_coin_10.webp`,
      starter_novice: `${DIR}pack_starter_novice.webp`,
      starter_elite: `${DIR}pack_starter_elite.webp`,
      hint_single: `${DIR}pack_hint_single.webp`,
      hint_trio: `${DIR}pack_hint_trio.webp`,
      hint_ten: `${DIR}pack_hint_case.webp`,
      hint_case: `${DIR}pack_hint_case.webp`,
      chance_mini: `${DIR}pack_chance_mini.webp`,
      chance_standard: `${DIR}pack_chance_standard.webp`,
      chance_pro: `${DIR}pack_chance_pro.webp`,
      chance_bulk: `${DIR}pack_chance_bulk.webp`,
      chance_master: `${DIR}pack_chance_master.webp`,
      noads_basic: `${DIR}pack_noads.webp`,
      noads_plus: `${DIR}pack_noads.webp`,
      noads_deluxe: `${DIR}pack_noads.webp`,
      noads_vip: `${DIR}pack_noads_vip.webp`,
      // 광고 패스권 묶음 4종 (Higgsfield GPT Image 2.5, icon_ad · pack_hint 그림체 참조)
      adpass_10: `${DIR}pack_adpass_10.webp`, adpass_20: `${DIR}pack_adpass_20.webp`,
      adpass_50: `${DIR}pack_adpass_50.webp`, adpass_100: `${DIR}pack_adpass_100.webp`,
      offer_detective_emergency: `${DIR}pack_emergency.webp`,
    },
  };
  // 골드 상품: 1~2단계 주머니 · 3~5단계 상자 · 6~10단계 금고
  TP.productImage = p => {
    if (TP.ASSETS.products[p.id]) return TP.ASSETS.products[p.id];
    const tier = /^coin_tier_(\d+)$/.exec(p.id);
    if (!tier) return null;
    const n = Number(tier[1]);
    return `${DIR}${n <= 2 ? 'icon_gold_s' : n <= 5 ? 'icon_gold_m' : 'icon_gold_l'}.webp`;
  };
  // 덱 +N 아이콘 (+1/+2/+3/+5 그림 중 가장 가까운 것)
  // 홈 레벨 숫자: level_numbers.webp 를 잘라 둔 0~9 그림을 이어 붙인다 (tools/build_level_digits.py)
  TP.levelDigitsHtml = level => String(level).split('')
    .map(d => `<img src="${DIR}derived/level_digits/${d}.webp" alt="">`).join('');

  TP.plusCardImage = n => TP.ASSETS.cardPlus[n] || TP.ASSETS.cardPlus[n >= 5 ? 5 : n >= 3 ? 3 : n >= 2 ? 2 : 1];

  TP.cardImage = card =>
    card.wild || card.special === 'wild' ? TP.ASSETS.cardWild : TP.ASSETS.cards[card.rank];

  // 에셋 상태표 (검사 페이지·문서용). used=false 는 현재 화면에서 쓰지 않는 파일.
  TP.ASSET_REPORT = [
    { file: 'card_A~K.webp (13)', status: 'ok', used: true },
    { file: 'card_back.webp', status: 'ok', used: true },
    { file: 'card_wild.webp', status: 'ok', used: true, note: '보드 와일드 카드 · 와일드 액티브 카드' },
    { file: 'card_highlight.webp', status: 'ok', used: true },
    { file: 'card_dimmed.webp', status: 'ok', used: true },
    { file: 'btn_shop.webp / btn_episode.webp', status: 'ok', used: true, note: '상단 바 SHOP · EPISODE 동전 버튼 (글자가 그림에 있음)' },
    { file: 'frame_modal_popup.webp', status: 'adjusted', used: false, note: '파란 패널 프레임 — 아래 빨강·초록 버튼이 그림에 박혀 있어 버튼 수가 다른 팝업에 못 씀 → 버튼만 지운 frame_modal_popup_plain.webp(Higgsfield 편집) 사용, 버튼은 같은 색 스타일로 그림' },
    { file: 'frame_modal_popup_plain.webp', status: 'ok', used: true, note: '공용 팝업 프레임 (Higgsfield 편집: 원본에서 버튼만 제거)' },
    { file: 'ui_win_page.webp', status: 'adjusted', used: true, note: '클리어 화면 — 그림의 "x200" 위에 실제 골드를 덮어 표시, COLLECT 자리에 실제 버튼' },
    { file: 'ui_loading.webp', status: 'ok', used: true, note: '시작 로딩 화면 (진행 바 채움은 그림 그대로)' },
    { file: 'ui_screen_transition1.webp', status: 'ok', used: true, note: '스테이지 입장 전환 연출' },
    { file: 'congrats.webp', status: 'adjusted', used: true, note: '흰 배경 → derived/congrats_t.webp (바깥 흰색만 투명) · 사건 해결 팝업 배너' },
    { file: 'avatar_05~07 · btn_offer · ui_level_star · badge_streak · icon_* · pack_*', status: 'ok', used: true, note: 'Higgsfield GPT Image 2.5로 기존 그림체(btn_shop · avatar_01 참조)에 맞춰 새로 만듦' },
    { file: 'ui_combo.webp', status: 'ok', used: true, note: '콤보 게이지 틀 (임시: Higgsfield 생성) — 같은 이름으로 덮어쓰면 교체. 트랙·소켓 위치는 css/layout.css .gauge-track / .gauge-reward' },
    { file: 'mascot_cat.webp · icons/star.webp', status: 'ok', used: true, note: '인게임 탐정 조수 마스코트 · 콤보 별가루 (Higgsfield 생성, avatar_01 고양이 · btn_shop 그림체 참조)' },
    { file: 'icons/*.webp (23)', status: 'ok', used: true, note: '문구 속 이모지 대체 아이콘 (🔥⚡📓🔒🏠💡🎉🔍🚨📢👔🫵🗺⚠📈📉🗂✔👥🏅📱⏰) — Higgsfield 생성 · js/emoji-icons.js가 화면에서 자동 교체' },
    { file: 'card_plus1/2/3/5.webp', status: 'ok', used: true, note: '+1 = 보드의 덱 보너스 카드 · 콤보 상자 덱 보상(+1~3) · 이어하기(+5) · 광고 부활(+3) 아이콘' },
    { file: 'card_locked.webp', status: 'ok', used: true, note: '에피소드 메뉴의 잠긴·출시 예정 카드' },
    { file: 'card_key.webp', status: 'ok', used: false, note: '쓸 자리 미정' },
    { file: 'ui_level.webp', status: 'mismatch', used: false, note: '숫자 "25"가 그림에 박혀 있어 실제 레벨 표시에 못 씀 → 숫자 없는 판이 오면 레벨 별 교체' },
    { file: 'ui_episode_progress.webp', status: 'ok', used: true, note: '인게임 상단 단서 진행 바 (채움은 CSS)' },
    { file: 'episodes/bg · suspect · clue', status: 'ok', used: true, note: 'characters_background 생성 풀을 tools/build_episode_art.py로 웹용 변환 · tools/episode_art.py 규칙으로 에피소드에 배정' },
    { file: 'slot_draw_deck.webp', status: 'ok', used: true },
    { file: 'slot_active_card.webp', status: 'ok', used: true },
    { file: 'frame_modal_popup.webp', status: 'ok', used: true, note: '공용 팝업 골드 프레임 (투명 배경) — 투명 여백을 잘라 쓰고 안쪽 패널에 내용 배치' },
    { file: 'frame_modal_wood.webp', status: 'ok', used: false, note: '이전 나무 팝업 프레임 (frame_modal_popup.webp 으로 교체)' },
    { file: 'popup_stage_clear.webp', status: 'ok', used: true },
    { file: 'popup_accuse_success.webp', status: 'ok', used: true },
    { file: 'popup_accuse_failed.webp', status: 'ok', used: true },
    { file: 'popup_special_offer.webp', status: 'ok', used: true },
    { file: 'portrait_ep01_01~08.webp', status: 'adjusted', used: true, note: '하단 이름표가 그림에 박혀 있어 1:1 비율을 유지한 채 확대해 잘라 냄' },
    { file: 'mark_cross_x.webp / mark_circle_star.webp', status: 'adjusted', used: true, note: '투명 배경이 아니고 라벨 글자가 포함됨 → SVG 색 키잉 필터로 나무 배경·글자 제거' },
    { file: 'btn_booster_undo.webp / btn_open_notebook.webp', status: 'adjusted', used: true, note: '나무 배경 모서리 → clip-path로 마스크' },
    { file: 'btn_pause.webp', status: 'ok', used: false, note: '금화 일시정지 버튼 — 일시정지는 설정 톱니(btn_settings) 메뉴로 열려 현재 자리 없음' },
    { file: 'btn_booster_wild.webp', status: 'adjusted', used: true, note: '버튼이 아니라 와일드 카드 그림을 자른 것 → 둥근 사각형으로 마스크해 아이콘처럼 사용' },
    { file: 'btn_accuse_submit.webp', status: 'adjusted', used: true, note: '하단 "Accuse CTA Button" 라벨 → 위쪽만 보이게 잘라 냄' },
    { file: 'btn_ad_hint.webp', status: 'ok', used: true, note: '광고 힌트 버튼 아이콘 (돋보기·전구·AD)' },
    { file: 'popup_clue_found.webp', status: 'adjusted', used: true, note: '"의문의 돋보기" 이름과 "확인" 버튼이 그림에 박혀 있어 위쪽 "단서 획득" 배너만 잘라 쓰고, 아래에 단서 소품 그림을 따로 표시' },
    { file: 'ui_currency_bar.webp', status: 'adjusted', used: true, note: '숫자 "100"이 그림에 박혀 있음 → 숫자 칸 위에 실제 골드를 덮어 표시' },
    { file: 'bg_puzzle_felt.webp', status: 'ok', used: true, note: '16:9 게임 테이블 (탐정 책상 종이 배경)' },
    { file: 'bg_corkboard.webp', status: 'ok', used: true, note: '16:9 코르크 보드 — 생성: Higgsfield GPT Image 2.5로 새로 만듦 (원본은 game_assets/_replaced/에 보관)' },
    { file: 'badge_deck_count.webp', status: 'ok', used: true, note: '투명 배경 배지 — 생성: Higgsfield GPT Image 2.5로 새로 만듦 (원본은 game_assets/_replaced/에 보관)' },
    { file: 'ui_suspect_card_base.webp', status: 'mismatch', used: false, note: '프레임이 아니라 여관 주인 초상화 → CSS 종이 카드 유지' },
    { file: 'btn_modal_close.webp', status: 'mismatch', used: false, note: 'btn_pause.png와 동일한 톱니 일시정지 그림 → CSS ✕ 유지' },
    { file: 'string_red.webp', status: 'mismatch', used: false, note: '실타래 그림 + 라벨 글자 → 붉은 실은 SVG 선으로 렌더링' },
    { file: 'popup_gold_shortage.webp', status: 'mismatch', used: false, note: '"50% OFF" 할인 그림이라 골드 부족 안내에 쓰면 오해 소지 → 미사용' },
    { file: 'popup_stage_failed.webp', status: 'mismatch', used: false, note: '"CULPRIT ESCAPED!"(범인 도주) 그림이라 일반 스테이지 실패에 쓰면 사건 실패로 오해 → 미사용' },
    { file: 'bg_detective_office.webp', status: 'ok', used: true, note: '로비 16:9 배경 — 생성: Higgsfield GPT Image 2.5로 새로 만듦 (원본은 game_assets/_replaced/에 보관)' },
    { file: 'btn_play_game.webp', status: 'ok', used: true, note: '수사 시작 버튼(투명, 글자는 HTML) — 생성: Higgsfield GPT Image 2.5로 새로 만듦 (원본은 game_assets/_replaced/에 보관)' },
    { file: 'btn_settings.webp', status: 'ok', used: true, note: '설정 톱니(투명) — 생성: Higgsfield GPT Image 2.5로 새로 만듦 (원본은 game_assets/_replaced/에 보관)' },
    { file: 'frame_modal_wide.webp', status: 'ok', used: true, note: '상점용 16:9 나무 프레임 — 생성: Higgsfield GPT Image 2.5로 새로 만듦 (원본은 game_assets/_replaced/에 보관)' },
    { file: 'ui_title_badge.webp / ui_streak_gauge.webp', status: 'adjusted', used: true, note: '"LEVEL 724", "30/180" 글자가 그림에 박혀 있어 실제 값으로 덮어 표시' },
    { file: 'card_episode_thumb_01/02.webp', status: 'ok', used: true, note: '로비 에피소드 카드' },
    { file: 'logo_tripeaks_mystery.webp', status: 'mismatch', used: false, note: '로고가 아니라 동전 그림만 들어 있음 → 로비 타이틀은 텍스트' },
  ];
})();
