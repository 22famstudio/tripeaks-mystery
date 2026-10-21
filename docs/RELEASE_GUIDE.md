# 릴리스 빌드 · AAB 가이드

## 1. 한 줄 요약

```bash
cd mobile
npm run aab
```

→ `mobile/android/app/build/outputs/bundle/release/app-release.aab` 을 Play Console에 올립니다.

## 2. 설정 내용 (`mobile/android/app/build.gradle`)

| 항목 | 값 |
| --- | --- |
| 서명 | 업로드 키 `upload-keystore.jks` (별칭 `upload`, RSA 2048, 유효 10,000일) |
| 버전 | `mobile/package.json`의 `"version"` 하나로 정합니다. versionName = 그대로, versionCode = 주 × 10000 + 부 × 100 + 수 (0.9.0 → **900**) |
| 난독화 · 최적화 | `minifyEnabled true` (R8) + `shrinkResources true` |
| SDK | compileSdk / targetSdk **36** (Android 16), minSdk 24 |
| 빌드 도구 | Android Gradle Plugin 8.9.1, Gradle 8.11.1 |
| 권한 | 인터넷 · 네트워크 상태 · Google Play 결제 · **광고 ID(`AD_ID`)**. Play Console의 '광고 ID 사용' 선언과 맞춰야 하며, 빠지면 업로드할 때 오류가 납니다 |
| 앱 분류 | `android:appCategory="game"` — Android 16이 큰 화면에서 가로 고정을 무시하는 규칙에서 게임은 빠집니다 |

- Google Play는 **2026-08-31부터 새 앱과 업데이트에 targetSdk 36 이상**을 요구합니다.
- R8을 켜도 Capacitor, RevenueCat, Firebase, Play 게임즈 플러그인은 각자의 keep 규칙으로 보존됩니다.
  - 빌드 후 `app/build/outputs/mapping/release/mapping.txt`에서 `PurchasesPlugin`, `PlayGamesSavesPlugin`, `MessageHandler.postMessage`가 그대로 남은 것을 확인했습니다.
  - Play Console에 AAB를 올릴 때 이 `mapping.txt`도 함께 올리면, 크래시 기록이 원래 이름으로 보입니다.
- R8 경고 `amazon-appstore-sdk … Expected stack map table`은 RevenueCat에 들어 있는 아마존 스토어 라이브러리에서 나옵니다. 무시해도 됩니다.

## 3. 업로드 키 — 반드시 백업

| 파일 | 위치 |
| --- | --- |
| 키 파일 | `C:\Users\Aedri\Desktop\TriPeaks-keys\upload-keystore.jks` |
| 비밀번호 | `C:\Users\Aedri\Desktop\TriPeaks-keys\keystore.properties` (빌드는 같은 내용의 `mobile/android/keystore.properties`를 읽음) |
| 인증서 SHA-1 | `FC:29:E5:81:C9:67:B8:2B:D0:6B:69:A7:10:BB:49:00:1E:31:A7:03` |
| 인증서 SHA-256 | `AD:EB:A5:2B:09:43:2F:5B:12:47:96:58:B2:40:A3:24:91:55:6F:0B:05:9F:2A:5B:AA:43:83:E5:CF:86:6A:01` |

- 두 파일은 **git에 들어가지 않습니다**(`.gitignore`: `*.jks`, `keystore.properties`).
- `TriPeaks-keys` 폴더를 **USB, 비밀번호 관리자, 개인 클라우드 등 다른 곳에도 복사**해 두세요.
- 이 키는 **업로드 키**입니다.
  - Play 앱 서명(기본값)을 쓰면 Google이 실제 배포용 앱 서명 키를 따로 보관합니다.
  - 그래서 업로드 키를 잃어도 Play Console → 앱 무결성에서 **업로드 키 재설정**을 요청할 수 있습니다. 다만 며칠이 걸리니 잃지 않는 게 최선입니다.
- 키가 없는 PC에서 빌드하면 서명 없는 AAB가 만들어지고, 이 파일은 Play에 올라가지 않습니다.

## 4. 첫 업로드 순서 (Play Console)

1. **테스트 및 출시 → 테스트 → 내부 테스트 → 새 버전 만들기**를 누릅니다.
2. 처음이면 **Play 앱 서명** 안내가 나옵니다. **Google에서 생성한 앱 서명 키 사용**(기본값)을 고릅니다.
3. `app-release.aab`를 올리고, 출시 노트를 적은 뒤 저장 · 검토 → 출시합니다. 버전 이름은 자동으로 채워지고, 첫 업로드는 `0.9.1 (901)`입니다. 0.9.0(900)은 광고 ID 권한이 빠져 있어 버렸습니다.
4. 업로드가 끝나면 **설정 → 앱 무결성 → 앱 서명**에서 **앱 서명 키 인증서**의 SHA-1과 SHA-256을 확인해 아래에 등록합니다.
   - Firebase 프로젝트 설정 → Android 앱 → SHA 인증서 지문 (업로드 키 SHA-1도 같이)
   - Play 게임즈 서비스 → 사용자 인증 정보 (앱 서명 키용 OAuth 클라이언트를 하나 더)
5. 이제 **인앱 상품을 만들 수 있습니다** → [REVENUECAT_GUIDE.md](REVENUECAT_GUIDE.md) 1단계.
6. 정식 출시 전에 **비공개 테스트(테스터 12명 이상, 14일 이상)**가 필요합니다. 신규 개인 개발자 계정 조건입니다. 내부 테스트와는 별개입니다.

## 5. 다음 버전을 올릴 때

1. `mobile/package.json`의 `"version"`을 올립니다(예: 0.9.0 → 0.9.1 = versionCode 901).
   - 같은 versionCode는 Play에 두 번 올릴 수 없습니다.
   - 설정 → 법적 고지에 보이는 버전(`js/settings.js` `TP.SUPPORT.version`)도 같이 맞춥니다.
2. `npm run aab`
3. Play Console에 새 버전을 만들고 AAB와 `mapping.txt`를 올립니다.

## 6. 휴대폰에서 릴리스 빌드 직접 확인하기

- `npm run sync && cd android && gradlew.bat assembleRelease`로 만듭니다.
  - 결과: `app/build/outputs/apk/release/app-release.apk` (업로드 키로 서명됨)
- 이 파일은 휴대폰에 바로 설치해 볼 수 있습니다.
- 다만 **디버그 APK와 서명이 달라** 그 위에 덮어 설치할 수 없습니다. 기존 앱을 지우고 설치해야 하고, 이때 기기의 진행 상황이 지워집니다.
- 결제는 Play에서 받은 앱에서만 테스트할 수 있습니다(REVENUECAT_GUIDE 5단계).
