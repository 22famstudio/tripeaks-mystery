// =====================================================================
// 이모지 → 게임 그림 아이콘 (game_assets/icons/*.webp · 기존 에셋)
// =====================================================================
//   화면 문구(토스트·팝업·버튼·툴팁 패널 등)에 쓰인 이모지를 같은 그림체의 작은 이미지로 바꿔 보여 준다.
//   문구는 코드에 이모지 그대로 두고(검색·수정이 쉬움), 화면에 붙는 순간 MutationObserver가 글자를
//   <img class="ei">로 교체한다 → textContent로 나중에 바뀐 문구도 자동으로 다시 교체된다.
//   바꾸지 않는 것: 카드 무늬(♠♥♦♣ — 카드 데이터), ✕·☆(닫기·마크 기호), 🛠(개발자 패널), title/alt 속성(그림 불가)
//   아이콘 그림: Higgsfield GPT Image 2.5 로 기존 그림체(btn_shop.webp 참조)에 맞춰 생성
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const D = 'game_assets/';
  const I = 'game_assets/icons/';

  TP.EMOJI_ICONS = {
    // 기존 에셋
    '🪙': `${D}icon_gold.webp`,
    '🎁': `${D}icon_gift.webp`,
    '❤': `${D}icon_heart.webp`,
    '♾': `${D}icon_infinite_heart.webp`,
    '📺': `${D}icon_ad.webp`,
    '🎟': `${D}icon_hint_ticket.webp`,
    '🚫': `${D}pack_noads.webp`,
    '★': `${D}card_wild.webp`,
    '↶': `${D}btn_booster_undo.webp`,
    '🛒': `${D}btn_shop.webp`,
    '📚': `${D}btn_episode.webp`,
    '⚙': `${D}btn_settings.webp`,
    '⏸': `${D}btn_pause.webp`,
    '🂠': `${D}card_back.webp`,
    // 새로 만든 아이콘 (game_assets/icons/)
    '🔥': `${I}fire.webp`,
    '⚡': `${I}bolt.webp`,
    '📓': `${I}notebook.webp`,
    '🔒': `${I}lock.webp`,
    '🔓': `${I}unlock.webp`,
    '🏠': `${I}home.webp`,
    '💡': `${I}bulb.webp`,
    '🎉': `${I}party.webp`,
    '🔍': `${I}magnifier.webp`,
    '🔎': `${I}magnifier.webp`,
    '🚨': `${I}siren.webp`,
    '📢': `${I}megaphone.webp`,
    '👔': `${I}costume.webp`,
    '🫵': `${I}accuse.webp`,
    '🗺': `${I}map.webp`,
    '⚠': `${I}warning.webp`,
    '📈': `${I}chart_up.webp`,
    '📉': `${I}chart_down.webp`,
    '🗂': `${I}case_file.webp`,
    '✔': `${I}check.webp`,
    '✅': `${I}check.webp`,
    '👥': `${I}suspects.webp`,
    '🏅': `${I}medal.webp`,
    '📱': `${I}rotate_phone.webp`,
    '↻': null,                       // 📱↻ 한 쌍 → 📱 그림 하나로 (화살표 포함)
    '⏰': `${I}alarm.webp`,
    // 설정 모달
    '❌': `${I}close.webp`,
    '🎵': `${I}music.webp`,
    '👤': `${I}profile.webp`,
    'ℹ': `${I}info.webp`,
    '📜': `${I}legal.webp`,
    '✉': `${I}mail.webp`,
  };

  const keys = Object.keys(TP.EMOJI_ICONS).sort((a, b) => b.length - a.length);
  const RE = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\uFE0F?`, 'g');
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'TITLE']);

  // 문자열 안의 이모지를 <img> HTML로 (innerHTML에 직접 넣을 때 쓸 수 있게)
  TP.emojiHtml = str => String(str).replace(RE, (m, e) => {
    const src = TP.EMOJI_ICONS[e];
    return src ? `<img class="ei" src="${src}" alt="${e}" draggable="false">` : '';
  });

  function iconizeText(node) {
    const text = node.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(text)) return;
    const parent = node.parentNode;
    if (!parent || SKIP.has(parent.nodeName) || parent.closest?.('[data-no-icons]')) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(RE, (m, e, offset) => {
      if (offset > last) frag.append(text.slice(last, offset));
      const src = TP.EMOJI_ICONS[e];
      if (src) {
        const img = document.createElement('img');
        img.className = 'ei';
        img.src = src;
        img.alt = e;
        img.draggable = false;
        frag.append(img);
      }
      last = offset + m.length;
      return m;
    });
    if (last < text.length) frag.append(text.slice(last));
    parent.replaceChild(frag, node);
  }

  TP.iconize = function (root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) return iconizeText(root);
    if (root.nodeType !== Node.ELEMENT_NODE || SKIP.has(root.nodeName)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach(iconizeText);
  };

  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const start = () => {
    TP.iconize(document.body);
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') iconizeText(r.target);
        else r.addedNodes.forEach(n => TP.iconize(n));
      }
    }).observe(document.body, { childList: true, characterData: true, subtree: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
