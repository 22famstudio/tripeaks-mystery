# 결제 연동 가이드 — RevenueCat + Google Play Billing

앱 쪽 코드는 준비돼 있고, 아래 콘솔 설정과 키 한 줄만 넣으면 실제 결제가 켜집니다.

## 0. 구조 한눈에

```
상점 [구매] ─▶ js/shop.js buyProduct ─▶ js/billing.js purchase
                                         │  RevenueCat SDK → Google Play 결제창
                                         │  결제 완료 → RevenueCat 서버가 Google Play 에 영수증 확인 (서버 검증)
                                         ▼  통과한 결제만 성공으로 돌아옴
                                     보상 지급 + 거래 ID 기록 (store.paidTx — 같은 결제 두 번 지급 안 함)
```

| 기능 | 어디서 | 설명 |
| --- | --- | --- |
| 서버 영수증 검증 | RevenueCat 서버 | 서버를 직접 만들 필요 없음 (Firebase Functions 불필요) |
| 소비형 / 비소비형 | RevenueCat 대시보드의 상품 종류 | 소비형은 확인 후 소비, 비소비형은 승인만 → 다시 살 수 없고 복원 가능 |
| 끝나지 않은 결제 복구 | `billing.js reconcile()` | 결제 도중 앱이 꺼졌거나 '대기 중' 결제(현금 · 편의점 등)가 나중에 끝나면, 다음 실행 · 고객 정보 갱신 때 3일 이내 거래를 찾아 지급 |
| 구매 복원 | 상점 맨 아래 · 설정 → 계정 관리 **[구매 복원]** | 광고 제거와 스타터팩 '구매함' 상태만 되살림 (함께 받은 골드는 다시 안 줌) |
| 광고 제거 자동 복원 | Entitlement `no_ads` | 재설치 · 새 기기에서도 앱을 켜면 광고 제거가 다시 적용됨 |
| 현지 가격 표시 | `billing.priceLabel()` | 상점 가격 = Play 스토어 가격(₩ · ¥ · $ 등). 불러오기 전에는 카탈로그 가격 |
| 사용자 연결 | Firebase 유저 ID = RevenueCat App User ID | 계정이 바뀌면 `logIn` |

키가 비어 있으면 휴대폰에서는 결제가 막히고("지금은 결제를 사용할 수 없어요"), 브라우저 미리보기에서만 가짜 결제로 바로 지급됩니다. 가짜 결제일 때는 상점 아래에 "개발용" 문구가 보입니다.

## 1. Play Console — 상품 등록

1. **먼저 앱 빌드를 테스트 트랙에 올려야 상품을 만들 수 있습니다.**
   - 테스트 → 내부 테스트에 AAB를 업로드합니다.
   - 이 빌드에는 결제 권한(`com.android.vending.BILLING`)이 이미 들어 있습니다.
2. **수익 창출 → 제품 → 인앱 상품 → 상품 만들기**에서 아래 29개를 만듭니다. (광고 패스권 4종 `adpass_*` 는 2026-10-24 추가)
   - 상품 ID는 코드와 **정확히 같아야** 합니다.
   - 가격은 기준 가격(USD)을 넣고 **현지 가격 자동 변환**을 쓰면 됩니다.
3. 상품마다 **활성화**를 누릅니다.

| 상품 ID | 이름 | 기준 가격 | 종류 |
| --- | --- | --- | --- |
| `starter_novice` | 초보 탐정 스타터팩 | $2.99 | **비소비형** |
| `starter_elite` | 엘리트 탐정 스타터팩 | $4.99 | **비소비형** |
| `coin_tier_01` | 동전 주머니 | $0.99 | 소비형 |
| `coin_tier_02` | 골드 주머니 | $1.99 | 소비형 |
| `coin_tier_03` | 골드 상자 | $4.99 | 소비형 |
| `coin_tier_04` | 골드 자루 | $9.99 | 소비형 |
| `coin_tier_05` | 골드 궤짝 | $14.99 | 소비형 |
| `coin_tier_06` | 골드 금고 | $19.99 | 소비형 |
| `coin_tier_07` | 골드 수레 | $29.99 | 소비형 |
| `coin_tier_08` | 황금 마차 | $49.99 | 소비형 |
| `coin_tier_09` | 황금 보물창고 | $79.99 | 소비형 |
| `coin_tier_10` | 명탐정의 비밀 금고 | $99.99 | 소비형 |
| `hint_ten` | 힌트권 10장 묶음 | $0.99 | 소비형 |
| `hint_case` | 탐정 힌트 가방 | $1.99 | 소비형 |
| `chance_mini` | 미니 찬스 팩 | $0.99 | 소비형 |
| `chance_standard` | 스탠다드 찬스 팩 | $2.99 | 소비형 |
| `chance_pro` | 프로 찬스 팩 | $6.99 | 소비형 |
| `chance_bulk` | 대용량 찬스 팩 | $12.99 | 소비형 |
| `chance_master` | 마스터 찬스 팩 | $24.99 | 소비형 |
| `noads_basic` | 광고 제거 | $4.99 | **비소비형** |
| `noads_plus` | 광고 제거 플러스 | $5.99 | **비소비형** |
| `noads_deluxe` | 광고 제거 디럭스 | $7.99 | **비소비형** |
| `noads_vip` | 광고 제거 VIP | $11.99 | **비소비형** |
| `adpass_10` | 광고 패스권 10장 | $0.99 | 소비형 |
| `adpass_20` | 광고 패스권 20장 | $1.79 | 소비형 |
| `adpass_50` | 광고 패스권 50장 | $3.99 | 소비형 |
| `adpass_100` | 광고 패스권 100장 | $6.99 | 소비형 |
| `offer_detective_emergency` | 탐정 긴급 지원 팩 | ₩3,300 | 소비형 |
| `offer_home_always` | 명탐정 상시 특별 지원 | $3.99 | 소비형 |

- Play Console에는 소비형과 비소비형을 정하는 칸이 없습니다. 종류는 3단계에서 RevenueCat에 지정합니다.
- 스페셜 오퍼의 할인 전 가격(취소선)은 앱이 스토어 가격 × (원래 가격 / 할인 가격)으로 계산해 보여 줍니다.

## 2. Google Cloud — RevenueCat이 Google Play를 확인할 수 있게 (서비스 계정)

RevenueCat 공식 문서의 **"Google Play Store service credentials"** 순서를 그대로 따르면 됩니다.

1. Google Cloud 콘솔(Play Console과 연결된 프로젝트)에서 다음 두 API를 **사용 설정**합니다.
   - Google Play Android Developer API
   - Google Play Developer Reporting API
2. **IAM → 서비스 계정 → 만들기**를 누르고, 역할에 *Pub/Sub Admin*(실시간 알림용)과 *Monitoring Viewer*를 줍니다.
3. 서비스 계정의 **키 → JSON 키 만들기**로 파일을 받습니다.
   - 이 파일은 비밀입니다. **git에 넣지 마세요.**
4. Play Console의 **사용자 및 권한 → 새 사용자 초대**에서 서비스 계정 이메일을 초대하고, 다음 권한을 줍니다.
   - 앱 정보 보기
   - 재무 데이터 보기
   - 주문 및 구독 관리
5. 권한이 퍼지는 데 **최대 36시간**이 걸릴 수 있습니다. RevenueCat에 "credentials invalid"가 떠도 하루쯤 기다리면 됩니다.

## 3. RevenueCat 대시보드

1. https://app.revenuecat.com 에서 프로젝트를 만듭니다. 이름은 예를 들어 "탐정 솔리테어"로 합니다.
2. **Apps → New → Google Play Store**를 고릅니다.
   - 패키지 이름: `com.twotwofam.mystery`
   - 서비스 계정 자격 증명: 2단계의 JSON 파일을 올립니다.
3. **Products → Import**로 1단계의 29개를 가져옵니다.
   - **비소비형 6개**(`starter_*` 2개, `noads_*` 4개)는 상품을 열어 Type을 **Non-consumable**로 바꿉니다.
   - 이걸 안 하면 소비 처리돼서 다시 살 수 있고 복원도 안 됩니다.
4. **Entitlements → New**를 누릅니다.
   - Identifier: `no_ads` (`js/billing-config.js`의 `entitlementNoAds`와 같게)
   - Attach: `noads_basic`, `noads_plus`, `noads_deluxe`, `noads_vip`
5. **Offerings는 만들지 않아도 됩니다.** 앱이 상품 ID로 직접 불러옵니다.
6. **Project settings → General → Restore Behavior**는 기본값 *Transfer to new App User ID*로 둡니다.
   - 재설치 등으로 유저 ID가 바뀌어도 같은 Google 계정의 구매가 따라옵니다.
7. (선택) **Google Real-Time Developer Notifications**를 연결합니다.
   - 환불 · 대기 결제가 즉시 반영됩니다.
   - RevenueCat 앱 설정 화면에 나오는 Pub/Sub 토픽을 Play Console → 수익 창출 설정에 넣습니다.

## 4. 앱에 키 넣기

RevenueCat → **API keys** → 이 Google Play 앱의 **Public SDK key**(`goog_…`)를 복사해 [js/billing-config.js](../js/billing-config.js)에 넣습니다.

```js
revenuecatGoogleApiKey: 'goog_xxxxxxxxxxxxxxxxxxxxxxxx',
```

- 공개 키라 앱에 들어가도 됩니다.
- **비밀 키(`sk_…`)는 절대 앱에 넣지 마세요.**

넣은 뒤 `cd mobile && npm run sync`로 빌드합니다.

## 5. 테스트

1. **Play Console → 설정 → 라이선스 테스트**에 테스트할 Google 계정을 넣습니다.
   - 이 계정은 결제가 실제로 청구되지 않습니다(테스트 카드).
2. **결제 테스트는 Play에서 설치한 앱으로만 됩니다.**
   - 내부 테스트 트랙에 올린 빌드를 테스터 링크로 설치하세요.
   - 직접 설치한 debug APK는 서명이 달라 "이 버전의 애플리케이션은 결제를 지원하지 않습니다"가 뜹니다.
3. 확인할 것:
   - 골드 팩 구매 → 지급, RevenueCat 대시보드 → Customers에 거래 표시
   - 광고 제거 구매 → 버튼 '적용됨', 다시 사려고 하면 막힘
   - 앱 삭제 → 재설치 → 상점 **[구매 복원]** → 광고 제거 다시 적용, 골드는 다시 안 들어옴
   - 테스트 카드의 **"느리게 승인됨"** 결제 → "승인 대기 중" 안내 → 몇 분 뒤 앱을 다시 켜면 "완료되지 않았던 결제를 지급했어요"
   - 결제창에서 취소 → "결제를 취소했어요", 아무것도 지급 안 됨

## 6. 운영 메모

- **계정 삭제 요청:** 앱의 [계정 삭제]는 Firebase 계정만 지웁니다.
  - RevenueCat의 고객 기록은 결제 기록이라 법령상 5년 보관합니다(개인정보처리방침 3장).
  - 삭제를 따로 요청받으면 RevenueCat 대시보드 → Customers에서 해당 유저 ID를 찾아 삭제합니다.
- **새 상품 추가 순서:**
  1. `js/shop.js`에 추가
  2. Play Console 상품 등록
  3. RevenueCat Import (비소비형이면 Type 지정)
  - Play에 없는 상품은 브라우저 콘솔에 `[billing] Play Console 에 없는 상품:` 경고가 뜹니다.
- **환불:** Google Play가 처리합니다. 소비형 환불분의 골드를 회수하는 기능은 없습니다. 악용이 보이면 RevenueCat 웹훅으로 추가하면 됩니다.
- **플러그인 버전:** `@revenuecat/purchases-capacitor` **11.3.3**은 Capacitor 7에 맞는 마지막 버전입니다. 12 이상은 Capacitor 8이 필요합니다.
