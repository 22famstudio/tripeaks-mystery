// 카드 데이터와 공용 유틸 (DOM 없음 → 브라우저/Node 양쪽에서 사용)
(function () {
  const TP = (globalThis.TP ??= {});

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  TP.createDeck = function () {
    const deck = [];
    for (const suit of SUITS)
      for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit, id: `${rank}${suit}` });
    return deck;
  };

  // ±1 이면 연결, K(13)와 A(1)도 연결 (차이 12)
  TP.isAdjacent = function (a, b) {
    const diff = Math.abs(a - b);
    return diff === 1 || diff === 12;
  };

  TP.rankLabel = rank => RANK_LABEL[rank] || String(rank);
  TP.isRed = card => card.suit === '♥' || card.suit === '♦';

  // 시드 고정 난수 (같은 시드 = 같은 판 → 스테이지 번호를 시드로 쓸 수 있음)
  TP.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  TP.shuffle = function (arr, rng = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  TP.pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
})();
