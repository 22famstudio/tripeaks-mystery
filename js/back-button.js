// =====================================================================
// 안드로이드 뒤로가기 버튼 — ① 맨 위 팝업 닫기 → ② 화면 단계 (게임 중 = 일시정지 메뉴, 로비 = 종료 확인)
// =====================================================================
//   Capacitor App 플러그인의 'backButton' 을 받는다 (리스너가 있으면 안드로이드가 앱을 바로 닫지 않음).
//   팝업은 종류마다 '닫기에 해당하는 버튼'을 눌러 준다 → 각 팝업의 원래 닫기 동작(보상 지급 · 회차 처리 등)을 그대로 탄다.
//   여러 개가 겹쳐 있으면 z-index 가 가장 높은(같으면 DOM 에서 나중) 것 하나만.
//   'block' = 지금은 뒤로가기를 무시 (결제 대기 · 전환 연출 · 꼭 골라야 하는 창).
//
//   TP.backButton.handle() → 처리했으면 true (브라우저에서 확인할 때도 이 함수를 부르면 된다)
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const root = () => (TP.ui ? TP.ui.root() : document.body);

  // 팝업 종류 → 뒤로가기 때 누를 버튼 (위에서부터 먼저 맞는 규칙)
  const RULES = [
    { sel: '.boot-splash, .chapter-transition, .screen-transition, .suspense-scene, .cutscene', act: 'block' },
    { sel: '.modal-backdrop .dialog.busy', up: '.modal-backdrop', act: 'block' },                       // 결제 진행 중
    { sel: '.tut:not([hidden])', press: '.tut-skip' },                                                   // 튜토리얼 → 건너뛰기 확인
    { sel: '.daily-bonus', press: '.db-collect' },
    { sel: '.win-page', press: '.win-collect' },
    { sel: '.prestige-screen', press: '.ps-ok' },
    { sel: '.ws-popup', press: '.ws-ok' },
    { sel: '.clue-screen', press: '.cs-collect' },
    { sel: '.confession-scene', press: '.cf-next' },
    { sel: '.result-screen', press: '.rs-tile[data-value="lobby"]' },                                    // 클리어 · 실패 화면 → 홈
    { sel: '.rsm-popup', act: 'block' },                                                                 // 이어하기 / 포기 중 골라야 함
    { sel: '.en-popup', press: '.en-btn[data-v="close"], .en-btn[data-v="resume"]' },                    // 수사 생명력 · 일시정지
    { sel: '.ho-popup', press: '.ho-close' },
    { sel: '#settings-modal', visible: el => el.style.display !== 'none', fn: () => globalThis.app?.closeSettings() },
    { sel: '#entryModal', press: '#entryCancel' },
    { sel: '#shopModal', press: '#shopClose' },
    { sel: '#notebookModal', press: '#nbClose' },                                                        // 범인 지목 단계면 닫기가 없음 → 무시
    { sel: '#episodesModal', press: '#episodesClose' },
    { sel: '#stagesModal', press: '#stagesClose' },
    { sel: '.modal-backdrop', press: 'dialog' },                                                         // showDialog · confirm 창
  ];

  const shown = el => !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const zOf = el => { const z = parseInt(getComputedStyle(el).zIndex, 10); return Number.isFinite(z) ? z : 0; };
  const enabled = b => b && !b.disabled && !b.hidden && b.getClientRects().length > 0;

  // 지금 화면에 떠 있는 팝업 중 맨 위 하나 { el, rule }
  function topmost() {
    const found = [];
    const all = [...root().querySelectorAll('*')];
    for (const rule of RULES) {
      for (let el of root().querySelectorAll(rule.sel)) {
        if (rule.up) el = el.closest(rule.up);
        if (!el || found.some(f => f.el === el)) continue;
        if (!(rule.visible ? rule.visible(el) : shown(el))) continue;
        found.push({ el, rule, z: zOf(el), order: all.indexOf(el) });
      }
    }
    found.sort((a, b) => b.z - a.z || b.order - a.order);
    return found[0] || null;
  }

  // showDialog 창: 취소 · 닫기(ghost) 버튼, 없고 버튼이 하나뿐이면 그 버튼 (확인 · 닫기), 고를 게 여러 개면 무시
  function dialogButton(backdrop) {
    const buttons = [...backdrop.querySelectorAll('.actions button')].filter(enabled);
    const ghost = buttons.filter(b => b.classList.contains('ghost'));
    if (ghost.length) return ghost[ghost.length - 1];
    return buttons.length === 1 ? buttons[0] : null;
  }

  function closeTopmost() {
    const top = topmost();
    if (!top) return false;
    const { el, rule } = top;
    if (rule.act === 'block') return true;
    if (rule.fn) { rule.fn(); return true; }
    const btn = rule.press === 'dialog' ? dialogButton(el)
      : [...el.querySelectorAll(rule.press), ...root().querySelectorAll(rule.press)].find(enabled);
    if (btn) btn.click();
    return true;                                                   // 누를 게 없어도(꼭 골라야 하는 창) 앱은 닫지 않음
  }

  // 뒤로가기 한 번: 팝업 → 화면 단계 (app.js 의 app.onBack)
  function handle() {
    if (closeTopmost()) return true;
    globalThis.app?.onBack?.();
    return true;
  }

  const cap = globalThis.Capacitor;
  const App = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.isPluginAvailable && cap.isPluginAvailable('App')
    ? cap.Plugins.App : null;
  if (App) App.addListener('backButton', () => handle());

  TP.backButton = { handle, topmost, exitApp: () => (App ? App.exitApp() : null) };
})();
