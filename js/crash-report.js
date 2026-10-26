// =====================================================================
// 충돌 · 오류 보고 — Firebase Crashlytics (@capacitor-firebase/crashlytics)
// =====================================================================
//   네이티브(자바) 충돌 · ANR 은 Crashlytics SDK 가 알아서 보낸다.
//   게임 화면은 WebView 라 JS 오류가 나도 앱이 죽지 않는다 → window.onerror · 처리 안 된 Promise 를
//   '심각하지 않은 오류(non-fatal)'로 보낸다 (예: 광고 뒤 멈춤 같은 오류를 바로 볼 수 있게).
//   함께 보내는 정보: 앱 버전 · 언어 · 화면(홈/게임) · 에피소드 · 스테이지 · 익명 유저 ID (개인정보 없음)
//   한 번 실행에 같은 오류는 1번, 전체 20번까지만 (오류가 반복돼도 폭주하지 않게).
//   휴대폰이 아니거나(브라우저) google-services.json 없이 빌드하면 아무것도 하지 않는다.
//   TP.crash.report(err, where) — 직접 잡은 오류를 보낼 때 · TP.crash.testCrash() — 개발자 패널 [테스트 충돌]
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const cap = globalThis.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const FC = native && cap.isPluginAvailable && cap.isPluginAvailable('FirebaseCrashlytics') ? cap.Plugins.FirebaseCrashlytics : null;
  const MAX_REPORTS = 20;
  const seen = new Set();
  let sent = 0;

  // Chrome 스택 문자열 → Crashlytics StackFrame[] ('at fn (https://localhost/js/app.js:12:34)')
  function frames(stack) {
    return String(stack || '').split('\n').map(line => {
      const m = /at (?:(.+?) \()?(.+?):(\d+):\d+\)?$/.exec(line.trim());
      return m ? { functionName: m[1] || '(anonymous)', fileName: m[2].replace(/^https?:\/\/localhost\//, ''), lineNumber: +m[3] } : null;
    }).filter(Boolean).slice(0, 30);
  }

  function context() {
    const s = TP.store?.state || {};
    const keys = [
      ['appVersion', TP.SUPPORT?.version || '', 'string'],
      ['lang', TP.i18n?.lang || '', 'string'],
      ['screen', globalThis.document?.querySelector('#stage')?.dataset.screen || '', 'string'],
      ['episode', (s.episode?.index ?? -1) + 1, 'int'],
      ['stage', (s.episode?.cleared ?? -1) + 1, 'int'],
    ];
    return keys.map(([key, value, type]) => ({ key, value, type }));
  }

  function report(err, where = '') {
    if (!FC || sent >= MAX_REPORTS) return;
    const message = `${where ? `[${where}] ` : ''}${(err && (err.message || err.reason)) || String(err)}`.slice(0, 500);
    const stack = err && err.stack;
    const sig = message + '|' + String(stack || '').split('\n')[1];
    if (seen.has(sig)) return;
    seen.add(sig);
    sent++;
    FC.recordException({ message, stacktrace: frames(stack), keysAndValues: context() }).catch(() => {});
  }

  if (FC) {
    globalThis.addEventListener?.('error', e => report(e.error || e.message, 'onerror'));
    globalThis.addEventListener?.('unhandledrejection', e => report(e.reason, 'promise'));
    // 익명 유저 ID (Firebase 인증) — 고객 문의 때 같은 사람의 오류를 찾을 수 있게
    TP.account?.onChange?.(st => { if (st.uid) FC.setUserId({ userId: st.uid }).catch(() => {}); });
  }

  TP.crash = {
    available: !!FC,
    report,
    testCrash() { return FC ? FC.crash({ message: 'Test Crash (개발자 패널)' }) : null; },
  };
})();
