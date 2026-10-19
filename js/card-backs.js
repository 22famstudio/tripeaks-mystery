// =====================================================================
// 카드 뒷면 스킨 수집 (50연승 프레스티지 보상) — 상태는 TP.store (ownedCardBacks, equippedCardBack)
// =====================================================================
//   스킨: 기본 'default'(card_back.webp, 처음부터 보유) + 'back_2' ~ 'back_19' (card_back_2.webp ~ card_back_19.webp, 18종)
//         그림은 tools/build_card_backs.py 가 카드 규격(180×260)에 맞춘 game_assets/derived/card_backs/ 를 쓴다.
//   50연승 프레스티지: 아직 없는 스킨 하나를 무작위로 잠금 해제 → 18종을 다 모았으면 대체 보상 (골드 · 아이템)
//   장착: TP.cardBacks.equip(id) → 즉시 화면에 반영 (CSS 변수 --card-back, 보드의 뒤집힌 카드 · 덱)
//   DOM 이 없는 테스트 환경에서도 상태 로직은 동작한다.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const store = () => TP.store;

  TP.CARD_BACKS = [
    { id: 'default', name: '기본 탐정 고양이', src: 'game_assets/card_back.webp' },
    ...Array.from({ length: 18 }, (_, i) => {
      const n = i + 2;
      return { id: `back_${n}`, name: `컬렉션 #${n - 1}`, src: `game_assets/derived/card_backs/card_back_${n}.webp` };
    }),
  ];
  TP.PRESTIGE_STREAK = 50;
  // 18종을 모두 모은 뒤 50연승 대체 보상
  TP.PRESTIGE_FALLBACK = { gold: 3000, undo: 2, wild: 2 };

  const byId = id => TP.CARD_BACKS.find(b => b.id === id) || TP.CARD_BACKS[0];

  TP.cardBacks = {
    all: () => TP.CARD_BACKS,
    get: byId,
    owned: () => store().state.ownedCardBacks,
    isOwned: id => store().state.ownedCardBacks.includes(id),
    equipped: () => byId(store().state.equippedCardBack),
    missing: () => TP.CARD_BACKS.filter(b => !store().state.ownedCardBacks.includes(b.id)),

    // 50연승 프레스티지 보상: 없는 스킨 하나 무작위 해제 (새 스킨은 바로 장착) → 결과 { type:'cardBack', back } | { type:'fallback', reward }
    grantPrestige(rng = Math.random) {
      const missing = this.missing();
      if (!missing.length) {
        store().grant(TP.PRESTIGE_FALLBACK);
        return { type: 'fallback', reward: { ...TP.PRESTIGE_FALLBACK } };
      }
      const back = missing[Math.floor(rng() * missing.length)];
      store().update(s => {
        s.ownedCardBacks = [...s.ownedCardBacks, back.id];
        s.equippedCardBack = back.id;
      });
      return { type: 'cardBack', back };
    },

    // 장착 (보유한 스킨만). 반환: 성공 여부
    equip(id) {
      if (!this.isOwned(id)) return false;
      store().update(s => { s.equippedCardBack = id; });
      return true;
    },

    // 화면 반영: 뒤집힌 카드 · 덱의 그림은 CSS 변수 --card-back 하나를 본다 (css/style.css .face.back)
    apply() {
      if (typeof document === 'undefined') return;
      // 절대 주소로: CSS 변수 속 상대 경로는 변수를 쓰는 스타일시트(css/) 기준으로 풀리기 때문
      const url = new URL(this.equipped().src, document.baseURI).href;
      document.documentElement.style.setProperty('--card-back', `url("${url}")`);
    },
  };

  if (typeof document !== 'undefined' && store()) {
    TP.cardBacks.apply();
    let last = store().state.equippedCardBack;
    store().subscribe(s => {                       // 장착이 바뀌면 즉시 보드 · 덱에 새 스킨
      if (s.equippedCardBack !== last) { last = s.equippedCardBack; TP.cardBacks.apply(); }
    });
  }
})();
