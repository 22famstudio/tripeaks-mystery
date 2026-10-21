# 세이브 구조 — 기기 파일 + Google Play 게임즈 클라우드 세이브

작성 2026-10-20. 서버 비용 0. 세이브는 기기와 유저 본인의 Google 계정 저장 공간에만 있습니다.

## 구조

```
 게임 진행 ─▶ TP.store.update()
               ├─ localStorage 사본 (즉시 · 동기)       ← 앱을 켜는 순간 상태가 필요해서 · 파일 쓰기 실패 시 폴백
               ├─ save_data.json (0.4초 모아서)         ← 정본. Directory.Data (앱 전용 폴더)
               └─ '클라우드 바뀜' 표시만
                       └─ 업로드: 앱이 백그라운드로 갈 때 · 바뀐 채로 5분 · [지금 저장]
                                  (최소 60초 간격, 백그라운드 · 수동은 15초)
```

| 파일 | 역할 |
|---|---|
| `js/save-codec.js` | 세 곳 모두 같은 형식: `TPS1.` + Base64(JSON) + `.` + 위조 검사 서명 |
| | 예전 평문 세이브는 한 번 읽어 주고 다음 저장 때 새 형식으로 바뀜 |
| `js/store.js` | `savedAt`(마지막 저장 시각) · `onPersist` · `replace` 추가 |
| `js/local-save.js` | 기기 파일 `save_data.json` 읽기 · 쓰기 (`@capacitor/filesystem`) |
| `js/play-games-sync.js` | 클라우드 비교 · 불러오기 팝업 · 업로드 묶기 (`@capacitor/app` 의 `appStateChange`) |
| `mobile/android/app/src/main/java/com/twotwofam/mystery/PlayGamesSavesPlugin.java` | Google 공식 `play-services-games-v2` 22.1.0 으로 만든 앱 안 플러그인 (저장된 게임 열기 · 읽기 · 쓰기) |
| `mobile/android/app/src/main/res/values/games_ids.xml` | Play 게임즈 프로젝트 ID. **비어 있으면 클라우드 세이브가 꺼진 채로 동작** |
| `tests/save-sync.test.js` | 인코딩 · 위조 검사 · 파일 · 폴백 · 클라우드 비교 · 업로드 묶기 |

### 요청과 다르게 한 부분 (이유)

1. **localStorage 를 "실패 시에만" 쓰지 않고 항상 사본으로 함께 씁니다.**
   - 파일 읽기는 비동기라, 사본이 없으면 앱이 켜진 직후 1초 동안 기본값(골드 0)으로 화면이 그려집니다.
   - 그 사이의 조작이 덮어써질 수도 있습니다.
   - 정본은 파일이고, 켤 때 둘의 `savedAt` 을 비교해 더 최근 쪽을 씁니다.
   - 파일 쓰기가 실패하면 사본이 그대로 폴백이 됩니다.
2. **파일명:** 요청하신 `localSaveManager.js` / `playGamesSync.js` 는 프로젝트 규칙에 맞춰 `local-save.js`(`TP.localSave`) / `play-games-sync.js`(`TP.playGamesSync`) 로 만들었습니다.
3. **플러그인:** `@capacitor-community/google-play-games` 는 npm 에 없습니다. 검색된 GPGS 플러그인 2개(`@openforge/capacitor-game-connect`, `capacitor-play-games-services`)는 **Capacitor 5 용**이고 저장된 게임(스냅샷)을 지원한다는 문서가 없습니다. 그래서 Google 공식 SDK 로 앱 안 플러그인을 직접 만들었습니다. 외부 플러그인 업데이트에 끌려다니지 않아 가장 안정적입니다.
4. **최소 Android 버전이 6.0 → 7.0 (minSdk 23 → 24) 으로 올라갔습니다.** Play 게임즈 SDK 22.x 의 요구사항입니다. Android 6 기기는 현재 거의 없습니다.

### 위조 방지의 한계

- 서명의 비밀 값이 앱 안에 있어서 작정한 해커는 풀 수 있습니다. "파일을 열어 골드 숫자만 고치기" 같은 가벼운 조작을 막는 수준입니다.
- 서명이 안 맞는 파일 · 사본 · 클라우드 세이브는 읽지 않고, 다른 정상 사본으로 덮어씁니다.
- 결제 재화를 완전히 지키려면 서버 검증이 필요한데, 이 구조(서버 비용 0)에서는 하지 않습니다.

### 충돌 처리

| 상황 | 동작 |
|---|---|
| 앱 실행 시, 클라우드가 **더 최근** + **진행도도 높음** | "클라우드 저장 데이터가 있습니다. 불러오시겠습니까? (진행도: 에피소드 X, 골드 Y)" + 이 기기의 진행도 · 골드 |
| → 불러오기 | 클라우드로 바꾸고 새로 고침 |
| → 아니요 | 다음 업로드 때 이 기기 데이터로 클라우드를 덮어씀 (팝업에 안내) |
| 클라우드가 최근이어도 진행도가 낮음 | 묻지 않고 이 기기 데이터를 올림 |
| 클라우드가 비어 있음 | 바로 첫 업로드 |
| 두 기기에서 따로 저장 (스냅샷끼리 충돌) | Play 게임즈의 `RESOLUTION_POLICY_HIGHEST_PROGRESS` 로 진행도 점수가 높은 쪽이 남음 |

- 진행도 점수 = 깬 스테이지 수 × 100만 + 레벨 × 1000 + 경험치. 깬 스테이지가 가장 중요합니다.
- 팝업은 시작 화면(로고 · 로딩)이 사라진 뒤에 뜹니다.
- 설정 → 프로필 및 계정 → "클라우드 저장 (Google Play 게임즈)" 줄에 상태(마지막 저장 시각 · 저장 대기)와 [로그인] / [지금 저장] 버튼이 있습니다.

---

## Play Console 설정 (직접 해 주셔야 하는 부분)

> 저장된 게임은 **Google Play Console 개발자 계정**(최초 1회 $25)과 Play Console 에 등록된 앱이 있어야 쓸 수 있습니다.
> 출시 전에도 테스터 계정으로 시험할 수 있습니다.

### 1. Play Console 에 앱 만들기

1. https://play.google.com/console 에서 **앱 만들기**를 누릅니다.
   - 앱 이름: 탐정 솔리테어: 세계 사건 수첩 (영어 Detective Solitaire: World Case Files · 일본어 探偵ソリティア：世界の事件手帳)
   - 기본 언어: 한국어
   - 앱/게임: **게임**, 무료/유료 선택
2. 패키지 이름은 처음 올리는 AAB/APK 의 `com.twotwofam.mystery` 로 정해집니다.
   - 저장된 게임 시험만 할 거면, 내부 테스트 트랙에 디버그가 아닌 릴리스 서명 빌드를 한 번 올리는 게 확실합니다.

### 2. Play 게임즈 서비스 프로젝트

1. 앱 → **Play 게임즈 서비스 → 설정 및 관리 → 구성** 으로 갑니다.
2. "새 Play 게임즈 서비스 프로젝트 만들기"를 선택합니다.
   - Cloud 프로젝트를 고르라고 하면 버킷이 있는 **My First Project (`project-c648076b-81ce-422b-9d4`)** 를 선택합니다.
3. **속성(Properties)** → **저장된 게임(Saved Games): 사용** → 저장
4. 같은 화면 위쪽의 **프로젝트 ID**(숫자 12자리 정도)를 복사합니다.

### 3. 사용자 인증 정보 (Android)

1. 구성 → **사용자 인증 정보 추가 → Android** 를 누릅니다.
2. 처음이면 "OAuth 동의 화면 구성"으로 안내됩니다. 아래처럼 입력하고 저장합니다.
   - 앱 이름
   - 지원 이메일 `orokorea1@gmail.com`
   - 외부(External)
3. "OAuth 클라이언트 만들기" → 유형 **Android** 로 만듭니다.
   - 패키지: `com.twotwofam.mystery`
   - SHA-1: 아래 표 참고
4. 만든 클라이언트를 Play Console 인증 정보에 연결하고 저장합니다.

| 빌드 | SHA-1 |
|---|---|
| 지금 보내드리는 디버그 APK (이 PC 디버그 키) | `CC:C2:35:19:61:49:70:CD:D2:E6:05:65:12:E3:9F:58:91:CF:4B:7E` |
| Play 스토어로 받은 앱 | Play Console → 앱 무결성 → **앱 서명 키 인증서**의 SHA-1 (따로 인증 정보 하나 더 추가) |

### 4. 테스터

- 게임 서비스를 게시하기 전에는 **테스터로 등록된 Google 계정만** 로그인됩니다.
- 구성 → 테스터 → 본인 Gmail 을 추가하세요.

### 5. 프로젝트 ID 넣고 빌드

`mobile/android/app/src/main/res/values/games_ids.xml` 에 프로젝트 ID 를 넣습니다.

```xml
<string name="game_services_project_id" translatable="false">여기에_프로젝트_ID</string>
```

그 뒤 평소처럼 빌드하면 클라우드 세이브가 켜집니다.

### 6. 실기기 확인

1. 앱 실행 → Play 게임즈 자동 로그인 (처음엔 화면 위에 "Play 게임즈 로그인" 알림)
   - 설정의 클라우드 줄이 "저장 대기 중"/"클라우드와 같아요" 로 바뀝니다.
2. 스테이지를 깬 뒤 홈 버튼으로 앱을 내리기 → 클라우드 업로드
   - 설정 줄에 "마지막 저장 시각"이 나옵니다.
3. 앱 데이터 삭제(또는 다른 기기에 설치) → 실행
   - "클라우드 저장 데이터가 있습니다…" 팝업 → 불러오기 → 진행도 복원

---

## 참고

- 클라우드 세이브 파일은 유저 Google 계정의 Play 게임즈 저장 공간에 들어갑니다. 크기는 수십 KB 이고 개발자 비용은 없습니다.
- 안드로이드에서 앱 데이터 삭제 · 앱 삭제 시 `save_data.json` 과 localStorage 는 함께 지워집니다. 그래서 기기 밖 백업은 클라우드 세이브가 맡습니다.
- **iOS:** Play 게임즈가 없으므로 나중에 iCloud(Key-Value Store / CloudKit) 로 같은 `TP.playGamesSync` 인터페이스를 따로 구현하면 됩니다.
- 설정의 [계정 삭제] → "진행 상황 초기화"는 `save_data.json` 과 localStorage 를 모두 지웁니다.
  - 클라우드 세이브는 유저 Google 계정 쪽이라, 유저가 Play 게임즈 앱에서 지울 수 있습니다.
