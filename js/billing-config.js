// 결제 설정 — RevenueCat (js/billing.js · docs/REVENUECAT_GUIDE.md)
//   revenuecatGoogleApiKey : RevenueCat 대시보드 → 프로젝트 → API keys → Google Play 앱의 'Public SDK key' (goog_ 로 시작).
//                            공개 키라 앱에 넣어도 된다 (비밀 키 sk_ 는 절대 넣지 않는다).
//   entitlementNoAds       : 광고 제거 상품 4종을 묶은 RevenueCat Entitlement ID
//   ※ 키가 비어 있으면: 휴대폰에서는 '결제 준비 중' 으로 막고, 브라우저(개발용)에서만 가짜 결제로 바로 지급한다.
(globalThis.TP ??= {}).BILLING_CONFIG = {
  revenuecatGoogleApiKey: '',
  entitlementNoAds: 'no_ads',
};
