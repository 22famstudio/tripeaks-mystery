// =====================================================================
// 광고 — Google AdMob (@capacitor-community/admob 7.x, Capacitor 7) + 유럽 GDPR 동의(UMP)
// =====================================================================
//   설치: cd mobile && npm install @capacitor-community/admob@7 && npx cap sync   (tools/build_www.py 의 BASE_PLUGINS 에 들어 있음)
//   앱 ID 는 안드로이드 매니페스트에도 있어야 한다: mobile/android/app/src/main/res/values/strings.xml 의 admob_app_id
//
//   시작 순서 (init — 앱이 켜질 때 로비 · 튜토리얼보다 먼저):
//     ① 동의 정보 갱신   AdMob.requestConsentInfo()   (= UMP ConsentInformation.requestConsentInfoUpdate)
//     ② 필요하면 동의 창 AdMob.showConsentForm()      (= UMP UserMessagingPlatform.loadAndShowConsentFormIfRequired)
//                         — 유럽 · 영국 · 스위스 등 동의가 필요한 지역에서만 뜬다
//     ③ 광고를 요청해도 되면(canRequestAds) AdMob.initialize() → 보상형 · 전면 광고 미리 불러 두기
//
//   보상형: showRewarded(장소) → true 면 보상 지급. 끝까지 봐서 'Rewarded' 이벤트가 온 경우에만 true.
//     중간에 닫음 → false. 불러오기 실패 · 오프라인 · 보여 줄 광고 없음 → 안내 토스트 + false (튕기지 않음).
//     광고 패스권이 있으면 광고 없이 바로 true (1장 사용).
//   전면: maybeShowInterstitial('clear' | 'fail') — 규칙은 아래 INTERSTITIAL_RULES · interstitialDecision()
//   웹(브라우저 미리보기)에는 AdMob 이 없다 → 보상형은 '광고 생략' 안내 후 바로 지급(개발 확인용), 전면은 생략.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});
  const T = (s, p) => (TP.t ? TP.t(s, p) : p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);   // 다국어 (js/i18n.js)

  // ---------------------------------------------------------------------
  // 광고 ID — 출시 전에 AdMob 콘솔의 실제 ID 로 바꾸고 USE_TEST_ADS 를 false 로
  //   (실제 ID 로 개발 중에 광고를 누르면 계정이 정지될 수 있다 — 테스트는 늘 테스트 ID 나 테스트 기기로)
  // ---------------------------------------------------------------------
  TP.ADS_CONFIG = {
    USE_TEST_ADS: false,
    TEST: {   // Google 공식 테스트 ID (https://developers.google.com/admob/android/test-ads)
      APP_ID: 'ca-app-pub-3940256099942544~3347511713',
      REWARDED: 'ca-app-pub-3940256099942544/5224354917',
      INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
    },
    LIVE: {   // AdMob 콘솔 → 앱 → 광고 단위 (APP_ID 는 strings.xml 의 admob_app_id 에도 같은 값)
      APP_ID: 'ca-app-pub-3154824293592161~6595672743',
      REWARDED: 'ca-app-pub-3154824293592161/9207550332',
      INTERSTITIAL: 'ca-app-pub-3154824293592161/1524054327',
    },
  };

  // 전면 광고 규칙
  TP.INTERSTITIAL_RULES = {
    PROTECTED_CLEARS: 5,   // 처음 스테이지 5판(누적 클리어 1~5)은 전면 광고 없음 — 온보딩 이탈 방지
    EVERY_CLEARS: 2,       // 그 뒤로는 클리어 2판마다 1번 (6 · 7판째 → 7판째에, 8 · 9 → 9판째에 …)
    ON_FAIL: false,        // 실패 화면에서는 띄우지 않음 (카운트도 안 셈)
  };

  // 전면 광고를 띄울지 (순수 함수 — tests/ads.test.js). state 는 이번 판 결과가 반영된 뒤의 세이브
  //   반환: { show, counter } — counter 는 저장할 새 카운터 값
  TP.interstitialDecision = (state, result, rules = TP.INTERSTITIAL_RULES) => {
    const counter = state.adClearCounter || 0;
    if (state.noAdsActive) return { show: false, counter };                          // 광고 제거 구매 → 전면 광고 영구 생략
    if (result !== 'clear') return { show: !!rules.ON_FAIL && state.totalStagesCleared > rules.PROTECTED_CLEARS, counter };
    if ((state.totalStagesCleared || 0) <= rules.PROTECTED_CLEARS) return { show: false, counter: 0 };
    const next = counter + 1;
    return next >= rules.EVERY_CLEARS ? { show: true, counter: 0 } : { show: false, counter: next };
  };

  // ---------------------------------------------------------------------
  const cap = globalThis.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const AdMob = native && cap.isPluginAvailable && cap.isPluginAvailable('AdMob') ? cap.Plugins.AdMob : null;
  const ids = () => (TP.ADS_CONFIG.USE_TEST_ADS || !TP.ADS_CONFIG.LIVE.REWARDED ? TP.ADS_CONFIG.TEST : TP.ADS_CONFIG.LIVE);
  const EV = {
    rewardLoaded: 'onRewardedVideoAdLoaded', rewardFailedToLoad: 'onRewardedVideoAdFailedToLoad', rewardShowed: 'onRewardedVideoAdShowed',
    rewardFailedToShow: 'onRewardedVideoAdFailedToShow', rewardDismissed: 'onRewardedVideoAdDismissed', rewarded: 'onRewardedVideoAdReward',
    interDismissed: 'interstitialAdDismissed', interFailedToShow: 'interstitialAdFailedToShow',
  };
  const FAIL_MSG = () => T('광고를 불러올 수 없습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.');
  const LOAD_TIMEOUT_MS = 12000;

  const status = { consent: 'unknown', canRequestAds: false, initialized: false, privacyOptionsRequired: false, error: null };
  const ready = { rewarded: false, interstitial: false };
  let showing = false;
  let initPromise = null;

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

  // ① ② ③ 동의 → 초기화. 동의 창이 필요 없거나 실패해도 게임은 계속된다 (광고만 못 띄움)
  function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!AdMob) { status.consent = native ? 'unavailable' : 'web'; return status; }
      try {
        let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false });
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
        status.consent = info.status;
        status.canRequestAds = info.canRequestAds !== false;
        status.privacyOptionsRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
      } catch (e) {
        console.warn('[ads] 동의 정보', e);
        status.error = String((e && e.message) || e);
        status.canRequestAds = true;               // 동의 서버에 못 닿음 → SDK 가 지역 규칙대로 비맞춤 광고만 요청함
      }
      if (!status.canRequestAds) return status;
      try {
        await AdMob.initialize({ initializeForTesting: TP.ADS_CONFIG.USE_TEST_ADS, tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false });
        status.initialized = true;
        preload('rewarded');
        preload('interstitial');
      } catch (e) {
        console.warn('[ads] 초기화', e);
        status.error = String((e && e.message) || e);
      }
      return status;
    })();
    return initPromise;
  }

  // 미리 불러 두기 (실패해도 조용히 — 보여 줄 때 다시 시도)
  async function preload(kind) {
    if (!status.initialized || ready[kind] || !online()) return false;
    try {
      const opts = { adId: kind === 'rewarded' ? ids().REWARDED : ids().INTERSTITIAL, isTesting: TP.ADS_CONFIG.USE_TEST_ADS };
      await withTimeout(kind === 'rewarded' ? AdMob.prepareRewardVideoAd(opts) : AdMob.prepareInterstitial(opts), LOAD_TIMEOUT_MS);
      ready[kind] = true;
    } catch (e) {
      ready[kind] = false;
      console.warn(`[ads] ${kind} 불러오기 실패`, e);
    }
    return ready[kind];
  }

  // 광고가 화면을 덮는 동안 배경음악 멈춤 (광고 소리와 겹치지 않게)
  const setAdPlaying = on => TP.audio?.setAdPlaying?.(on);

  // ---------------- 보상형 ----------------
  //   placement: 'heart' · 'gridCheck' · 'keyHint' · 'revive' · 'solution' · 'reaccuse' … (로그용)
  async function showRewarded(placement = '') {
    if (showing) return false;
    // 광고 패스권: 광고 없이 바로 보상
    if (TP.store.state.adPassCount > 0 && TP.store.spend('adPassCount', 1)) {
      TP.ui?.toast?.(T('🎟 광고 패스권 사용 (남은 {n}장)', { n: TP.store.state.adPassCount }));
      return true;
    }
    if (!AdMob) {
      if (native) { TP.ui?.toast?.(FAIL_MSG()); return false; }
      TP.ui?.toast?.(T('🛠 미리보기: 광고 없이 보상을 받아요 (앱에서는 실제 광고)'));   // 웹 개발 확인용
      return true;
    }
    if (!online()) { TP.ui?.toast?.(FAIL_MSG()); return false; }
    showing = true;
    const done = TP.ui?.showBusy?.(T('광고 불러오는 중…'));
    try {
      await init();
      if (!status.initialized || !(ready.rewarded || await preload('rewarded'))) {
        done?.();
        TP.ui?.toast?.(FAIL_MSG());
        return false;
      }
      done?.();
      ready.rewarded = false;
      setAdPlaying(true);
      const earned = await new Promise(resolve => {
        let got = false, finished = false;
        const handles = [];
        const finish = v => {
          if (finished) return;
          finished = true;
          resolve(v);
          removeListeners(handles);
        };
        handles.push(AdMob.addListener(EV.rewarded, () => { got = true; }));
        // 닫힘: 보상 이벤트가 닫힘 직후에 오는 기기도 있어 잠깐 기다렸다가 결과를 정한다
        handles.push(AdMob.addListener(EV.rewardDismissed, () => setTimeout(() => finish(got), 400)));
        handles.push(AdMob.addListener(EV.rewardFailedToShow, () => { TP.ui?.toast?.(FAIL_MSG()); finish(false); }));
        // showRewardVideoAd 는 보상을 받았을 때만 끝나는 Promise (중간에 닫으면 끝나지 않음) → 결과는 위 이벤트로 판단
        AdMob.showRewardVideoAd().then(() => { got = true; }).catch(e => { console.warn('[ads] 보상형 표시 실패', e); TP.ui?.toast?.(FAIL_MSG()); finish(false); });
      });
      if (!earned) TP.ui?.toast?.(T('광고를 끝까지 봐야 보상을 받을 수 있어요'));
      return earned;
    } catch (e) {
      done?.();
      console.warn(`[ads] 보상형 (${placement})`, e);
      TP.ui?.toast?.(FAIL_MSG());
      return false;
    } finally {
      showing = false;
      setAdPlaying(false);
      preload('rewarded');                         // 다음 광고 미리
    }
  }

  // addListener 가 돌려주는 것: @capacitor/core 를 쓰면 Promise<handle>, 앱처럼 네이티브 브리지만 쓰면 handle 객체 그대로.
  //   예전엔 h.then(...) 으로만 지워서 휴대폰에서 'h.then is not a function' → 광고를 닫은 뒤 다음 화면으로 넘어가지 못하고 멈췄다.
  const removeListeners = handles => handles.forEach(h => {
    Promise.resolve(h).then(x => x && x.remove && x.remove()).catch(() => {});
  });

  // ---------------- 전면 ----------------
  //   스테이지 결과 뒤에 부른다. 규칙(초반 5판 · 2판마다 · 광고 제거)은 interstitialDecision.
  //   광고가 없거나 실패하면 조용히 넘어간다 (유저가 원한 광고가 아니므로 안내도 하지 않음).
  async function maybeShowInterstitial(result = 'clear') {
    const d = TP.interstitialDecision(TP.store.state, result);
    if (d.counter !== (TP.store.state.adClearCounter || 0)) TP.store.update(s => { s.adClearCounter = d.counter; });
    if (!d.show || !AdMob || showing || !online()) return false;
    await init();
    if (!status.initialized || !ready.interstitial) { preload('interstitial'); return false; }
    showing = true;
    ready.interstitial = false;
    setAdPlaying(true);
    try {
      await new Promise(resolve => {
        const handles = [];
        const finish = () => { resolve(); removeListeners(handles); };
        handles.push(AdMob.addListener(EV.interDismissed, finish));
        handles.push(AdMob.addListener(EV.interFailedToShow, finish));
        AdMob.showInterstitial().catch(finish);
      });
      return true;
    } finally {
      showing = false;
      setAdPlaying(false);
      preload('interstitial');
    }
  }

  // 설정 → 광고 개인정보 설정 (유럽 등 UMP 가 '설정 다시 열기'를 요구하는 지역에서만 보임)
  async function showPrivacyOptions() {
    if (!AdMob) return;
    try { await AdMob.showPrivacyOptionsForm(); } catch (e) { console.warn('[ads] 개인정보 옵션', e); }
  }

  TP.ads = { init, showRewarded, maybeShowInterstitial, showPrivacyOptions, status, ready, get available() { return !!AdMob; } };
})();
