# 유저 식별 (Firebase 로그인) 설정 가이드

작성 2026-10-20.

## 지금 상태

코드는 저장소에 들어 있습니다. **Firebase 콘솔에서 `google-services.json` 을 받아 넣는 순간 켜집니다.**

| 파일 | 역할 |
|---|---|
| `js/account.js` | `TP.account` — 첫 실행 자동 익명 계정, Google 연결 · 전환 · 로그아웃 · 계정 삭제 |
| `js/app.js` | 설정 → 계정 줄(게스트 / Google 이메일 · 유저 ID), [계정 관리] 대화상자 |
| | 법적 고지의 개인정보 문구, 고객 문의 메일에 유저 ID 포함 |
| `mobile` | `@capacitor-firebase/authentication` 7.5.0 설치 |
| | `capacitor.config.json` 에 Google 제공자 설정 |
| | `android/variables.gradle` — `rgcfaIncludeGoogle` 는 `google-services.json` 이 있을 때만 켜짐 |
| `tools/build_www.py` | `google-services.json` 이 있을 때만 로그인 플러그인을 안드로이드 빌드에 넣음 |
| | 없으면 빼서 앱이 켜질 때 꺼지지 않게 함 |
| `tests/account.test.js` | 익명 자동 생성 · 연결 · 충돌 시 전환 · 로그아웃 · 삭제(재인증) · 기기 ID 대체 |

### 동작 방식

| 상황 | 동작 |
|---|---|
| 첫 실행 | 로그인 화면 없이 **익명 계정 자동 생성** → 고유 유저 ID (Firebase UID) |
| 설정 → 계정 관리 → **Google 계정 연결** | 같은 UID 에 Google 계정이 붙음 (ID 유지) |
| 이미 다른 UID 에 연결된 Google 계정 | "그 계정으로 전환할까요?" → 전환 |
| **로그아웃** | 새 게스트(익명) ID 로 바뀜 |
| **계정 삭제** | Firebase 사용자 영구 삭제 → 새 게스트 ID. 이어서 "이 기기의 진행 상황도 초기화할까요?" |
| 플러그인 없는 빌드 · 웹 | 기기 안에서 만든 ID(`local-…`)로 식별. Google 연결은 "아직 쓸 수 없어요" |

- 진행 상황(골드 · 레벨 · 사건)은 지금처럼 **기기에만** 저장됩니다. 계정을 바꿔도 기기 세이브는 그대로입니다. 클라우드 세이브는 별도 작업입니다.
- 이미 확인한 것: 테스트 통과, 웹 화면 확인, 안드로이드 빌드 2가지
  - `google-services.json` 없이 → 플러그인 빠지고 정상 빌드
  - 임시 가짜 파일로 → 플러그인 + Google 로그인 포함해 컴파일 성공 (가짜 파일은 삭제함)
- **실제 Google 로그인은 진짜 `google-services.json` 을 넣은 뒤 실기기에서 확인해야 합니다.**

---

## 1. Firebase 프로젝트 만들기 (기존 GCP 프로젝트에 연결)

1. https://console.firebase.google.com 에 `orokorea1@gmail.com` 으로 로그인합니다.
2. **프로젝트 추가 (Create a project)** 를 누릅니다.
   - 이름 입력칸 아래 **"Google Cloud 프로젝트에 Firebase 추가"**(또는 기존 프로젝트 선택)에서 버킷이 있는 **My First Project (`project-c648076b-81ce-422b-9d4`)** 를 고릅니다.
   - 같은 프로젝트라 결제 · 크레딧 · 버킷을 함께 씁니다.
3. **Google 애널리틱스:** 이번 범위가 아니므로 **사용 안 함**으로 두어도 됩니다. 나중에 켤 수 있습니다.
4. 요금제 안내가 나오면 그대로 진행합니다.
   - 결제 계정이 연결된 GCP 프로젝트라 Blaze(종량제)로 표시될 수 있습니다.
   - 익명 · Google 로그인은 무료 사용량 안에서 쓰입니다.
   - 정확한 한도는 Firebase 가격 페이지(firebase.google.com/pricing)에서 확인하세요.

## 2. 안드로이드 앱 등록 → `google-services.json`

1. 프로젝트 개요 → **앱 추가 → Android** 를 누릅니다.
2. 아래처럼 입력합니다.

   | 항목 | 값 |
   |---|---|
   | Android 패키지 이름 | `com.twotwofam.mystery` |
   | 앱 닉네임 | 탐정 솔리테어 (자유) |
   | 디버그 서명 인증서 SHA-1 | `CC:C2:35:19:61:49:70:CD:D2:E6:05:65:12:E3:9F:58:91:CF:4B:7E` |

   SHA-1 은 이 PC 의 디버그 키입니다. 지금까지 보내드린 APK 가 이 키로 서명됐습니다.

3. **앱 등록** → `google-services.json` **다운로드**
4. 이후의 "Firebase SDK 추가" 단계는 **건너뜁니다.** 플러그인과 프로젝트 설정이 이미 해 둡니다.
5. 프로젝트 설정(톱니) → **내 앱** → 이 앱 → **디지털 지문 추가** → SHA-256 도 넣습니다.

   ```
   9C:7B:1F:DB:37:6D:03:A1:01:DF:B6:BB:2C:5A:A1:FC:52:59:5C:61:A3:57:5A:10:2A:ED:F1:05:79:A7:29:0B
   ```

## 3. 로그인 방법 켜기

1. 빌드 → **Authentication** → **시작하기** 를 누릅니다.
2. **로그인 방법(Sign-in method)** 탭에서 두 가지를 켭니다.
   - **익명(Anonymous)** → 사용 설정 → 저장
   - **Google** → 사용 설정 → 프로젝트 지원 이메일 `orokorea1@gmail.com` → 저장
3. **Google 을 켠 뒤 `google-services.json` 을 다시 받으세요.**
   - 프로젝트 설정 → 내 앱 → `google-services.json` 다운로드
   - Google 을 켜야 파일 안에 로그인용 OAuth 클라이언트가 들어갑니다.
   - 2번에서 먼저 받은 파일에는 없을 수 있습니다.

## 4. 파일 넣고 빌드

1. 받은 파일을 이 위치에 넣습니다: `C:\Users\Aedri\Desktop\TriPeaks-card-game\mobile\android\app\google-services.json`
2. 평소처럼 빌드합니다.
   - `npm run sync` 가 파일을 감지해 "Firebase 로그인: 켜짐" 을 출력하고 플러그인을 넣습니다.
   - `variables.gradle` 이 Google 로그인도 켭니다.
3. 실기기 확인 순서:
   - 앱 실행 → 설정 → 계정 줄이 "게스트 · 유저 ID ○○○○○○○○" 로 표시
   - Firebase 콘솔 → Authentication → **사용자** 에 익명 사용자 1명 생김
   - 계정 관리 → **Google 계정 연결** → 계정 선택 → 계정 줄이 Gmail 주소로 바뀜 (유저 ID 는 그대로)
   - 콘솔의 같은 사용자에 Google 제공자가 붙어 있음

> `google-services.json` 은 비밀 키 파일은 아닙니다 (앱 패키지 · 서명으로 사용이 제한된 설정 파일).
> 비공개 저장소이므로 커밋해 두면 다른 PC 에서도 같은 빌드가 됩니다.

## 5. 출시 전에 꼭 할 것

| 할 일 | 이유 |
|---|---|
| **Play 앱 서명 키의 SHA-1 · SHA-256 등록** | Play 스토어로 받은 앱은 Google 의 앱 서명 키로 다시 서명됩니다. Play Console → 앱 무결성 → 앱 서명 키 인증서의 SHA-1/256 을 Firebase 에 추가하지 않으면 스토어 버전에서 Google 로그인이 실패합니다 (`DEVELOPER_ERROR` · 코드 10). 업로드 키(릴리스 키스토어)의 SHA 도 함께 넣으세요 — 업로드 키 SHA-1 `FC:29:E5:81:C9:67:B8:2B:D0:6B:69:A7:10:BB:49:00:1E:31:A7:03` (docs/RELEASE_GUIDE.md). |
| **계정 삭제 웹 페이지** | Google Play 는 계정을 만들 수 있는 앱에 대해 앱 안 삭제(✅ 구현됨) **와** 앱 밖에서 삭제를 요청할 수 있는 웹 링크를 요구합니다. 간단한 요청 폼이나 안내 페이지(예: 유저 ID 와 메일을 보내면 삭제)를 만들어 Play Console 데이터 보안 항목에 넣으세요. |
| **데이터 보안(Data safety) 양식** | 수집: 사용자 ID(필수, 앱 기능 · 계정 관리), 이메일 주소(Google 연결 시 선택). 전송 시 암호화 ✅, 삭제 요청 가능 ✅ |
| **개인정보처리방침** | 위 수집 항목과 Firebase(Google) 처리 위탁을 적고, `js/settings.js` 의 `TP.LEGAL_URLS.privacy` 에 주소를 넣으세요. |
| (iOS 출시 때) | Firebase 에 iOS 앱 추가 → `GoogleService-Info.plist`, URL scheme 설정. 다른 소셜 로그인을 넣으면 Apple 로그인도 필수 (App Store 규정). |
