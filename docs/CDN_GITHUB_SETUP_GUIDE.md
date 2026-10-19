# CDN 에셋 다운로드 · GitHub · 줄바꿈 · iOS 오디오 설정 가이드

작성 2026-10-20. 이 문서의 코드는 저장소에 이미 들어 있습니다.

| 파일 | 역할 |
|---|---|
| `js/asset-manager.js` | 첫 실행 다운로드 · 진행 막대 · 기기에 풀기 · 경로 바꿔 끼우기 |
| `js/cdn-config.js` | 기본 꺼짐. CDN 빌드 때만 켜짐 |
| `js/audio-helper.js` | iOS 면 `.mp3`, 그 밖에는 `.ogg` |
| `tools/build_cdn_pack.py` | 버킷에 올릴 zip 묶음 + `version.json` 생성 |
| `tools/build_www.py` | `--cdn` · `--platform ios` 옵션 |
| `.gitattributes` | 줄바꿈 규칙 |
| `tests/asset-manager.test.js` | 경로 바꿔 끼우기 · 오디오 형식 테스트 |

> **이름에 대해:** 요청하신 `AssetManager.js` / `audioHelper.js` 는 프로젝트 규칙(소문자-하이픈 파일명, `TP.` 전역 객체)에 맞춰 `js/asset-manager.js`(`TP.AssetManager`) / `js/audio-helper.js`(`TP.audioHelper`) 로 만들었습니다.
> 이 프로젝트는 번들러 없이 `<script>` 로 읽기 때문에, 플러그인은 `import` 대신 `Capacitor.Plugins.Filesystem` 으로 부릅니다.

---

## 1. GCP 기반 초기 에셋 다운로드

### 1-1. 무엇이 어떻게 바뀌나

| | 지금 (기본 빌드) | CDN 빌드 |
|---|---|---|
| 에피소드 그림 약 98MB<br>(`episodes/ep_bg` · `portraits` · `ep_thumb` · `clue`) | APK 안에 포함 | APK 에서 빠짐 → 첫 실행 때 버킷에서 받음 |
| 사운드 (`sounds/sfx` · `bgm_mp3`) | APK 안에 OGG | APK 에서 빠짐 → 안드로이드는 OGG 묶음, iOS 는 MP3 묶음을 받음 |
| APK 크기 | 약 136MB | 약 27MB 예상 (그림 · 사운드 약 109MB 가 빠짐) |
| 첫 실행 | 바로 시작 | "사건 파일을 준비하고 있어요" 진행 막대 → 끝나면 자동 새로 고침 |
| 이후 실행 · 오프라인 | — | 받아 둔 파일 사용 (오프라인 OK) |

동작 방식:
- zip 을 **받으면서 바로 풀어** 파일로 씁니다. zip 전체를 메모리나 디스크에 쌓지 않아 저사양 기기에서도 안전합니다.
- 압축 해제는 fflate 의 스트리밍 Unzip, 파일 쓰기는 `@capacitor/filesystem` 이 합니다.
- 받은 파일은 앱 전용 저장소 `Directory.DATA/cdn_assets/<버전>/` 에 들어갑니다.
- 게임은 `Capacitor.convertFileSrc()` 주소로 이 파일을 읽습니다.
- 새 버전을 올리면 다음 실행 때 다시 받고, 예전 버전 폴더는 지웁니다.
- **처음 실행했는데 오프라인이면** [다시 시도] 버튼이 나옵니다.

### 1-2. 플러그인 설치 (mobile 폴더)

```bash
cd mobile
```

Capacitor 가 7.6.9 이므로 같은 7 버전대를 받습니다.

```bash
npm install @capacitor/filesystem@^7 fflate
```

```bash
npx cap sync android
```

- **`@capacitor/filesystem`:** 기기 저장소에 파일을 쓰고, 폴더를 지우고, 경로를 얻습니다.
- **`fflate`:** zip 스트리밍 해제. 빌드 때 `vendor/fflate.js` 로 앱 안에 복사됩니다(오프라인 동작).
- **`@capacitor/file-transfer` 는 쓰지 않습니다.** 내려받기는 WebView `fetch()` 스트림으로 하고, 진행률은 받은 바이트로 계산합니다.

### 1-3. GCP 버킷 만들기 (콘솔)

1. https://console.cloud.google.com 에 `orokorea1@gmail.com` 으로 로그인합니다.
2. 결제 계정에 무료 크레딧이 연결된 프로젝트를 선택합니다. 없으면 새로 만듭니다(예: `tripeaks-mystery`).
3. 메뉴 **Cloud Storage → 버킷 → 만들기** 를 누르고 아래처럼 설정합니다.

   | 항목 | 값 |
   |---|---|
   | 이름 | 전 세계에서 유일해야 함. 예: `tripeaks-mystery-assets` |
   | 위치 유형 | **Region — `us-central1`(아이오와) 권장.** Cloud Storage 의 항상 무료(Always Free) 등급은 미국 리전(`us-east1` · `us-west1` · `us-central1`) 버킷에만 적용됩니다. 서울(`asia-northeast3`)이 한국 사용자에게 더 빠르지만 무료 등급이 없습니다. 첫 실행 1회 다운로드라 속도 차이는 크지 않습니다 |
   | 스토리지 클래스 | **Standard** |
   | 액세스 제어 | **균일(Uniform)** |
   | 공개 액세스 방지 | **체크 해제** ("이 버킷에 공개 액세스 방지 적용"을 끔) |
   | 보호 · 데이터 보호 | 기본값 (버전 관리 · 보존 정책 끔) |

4. **공개 읽기 권한:** 버킷 → **권한** 탭 → **액세스 권한 부여**
   - 새 주 구성원: `allUsers`
   - 역할: **Cloud Storage → 스토리지 객체 뷰어 (Storage Object Viewer)**
   - 저장 → "공개 액세스 허용" 확인

   > 버킷 안의 모든 파일이 누구나 읽을 수 있게 됩니다. 게임 그림 외에 다른 파일은 이 버킷에 두지 마세요.

### 1-4. 묶음 만들어 올리기

**PC 에서 묶음 만들기** (프로젝트 루트):

```bash
python tools/build_cdn_pack.py
```

`dist/cdn/` 에 두 종류의 파일이 생깁니다 (`dist/` 는 Git 제외).
- `version.json`
- `game_assets-<버전>-img-1.zip` ~ `-img-3.zip` (그림 98MB)
- `game_assets-<버전>-snd-android-1.zip` (OGG 10.7MB), `game_assets-<버전>-snd-ios-1.zip` (MP3 12.8MB — 백업 폴더에서 읽음)

**올리기 — 콘솔에서:**
- 버킷 → **파일 업로드** → `dist/cdn/` 의 파일 전부를 올립니다.

**올리기 — Cloud Shell 에서** (콘솔 오른쪽 위 `>_` 아이콘을 누르면 열림):
- 먼저 파일을 Cloud Shell 로 업로드합니다 (Cloud Shell 메뉴 ⋮ → 업로드).

```bash
gcloud storage cp dist/cdn/* gs://tripeaks-mystery-assets/
```

**캐시 설정** (중요):
- `version.json` 은 매번 새로 읽어야 합니다 → 캐시 안 함.
- zip 은 이름에 버전이 들어가 내용이 절대 바뀌지 않습니다 → 1년 캐시.

```bash
gcloud storage objects update gs://tripeaks-mystery-assets/version.json --cache-control="no-cache, max-age=0"
```

```bash
gcloud storage objects update "gs://tripeaks-mystery-assets/game_assets-*.zip" --cache-control="public, max-age=31536000, immutable"
```

### 1-5. CORS 설정 (필수)

앱 WebView 의 주소(`https://localhost`, iOS 는 `capacitor://localhost`)에서 버킷 파일을 `fetch()` 로 읽으려면 CORS 를 열어야 합니다.
- 진행률을 계산하려면 `Content-Length` 헤더도 보여야 합니다.

Cloud Shell 에서 `cors.json` 을 만듭니다 (편집기 아이콘으로 열거나 아래 명령):

```bash
cat > cors.json <<'EOF'
[
  {
    "origin": ["https://localhost", "http://localhost", "capacitor://localhost"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
EOF
```

```bash
gcloud storage buckets update gs://tripeaks-mystery-assets --cors-file=cors.json
```

### 1-6. 확인

브라우저에서 아래 주소를 열면 JSON 이 보여야 합니다.

```
https://storage.googleapis.com/tripeaks-mystery-assets/version.json
```

### 1-7. CDN 빌드 · APK

(프로젝트 루트) www 를 만들 때 CDN 을 켭니다.

```bash
python tools/build_www.py --cdn https://storage.googleapis.com/tripeaks-mystery-assets/version.json
```

```bash
cd mobile && npx cap sync android
```

```bash
cd android && ./gradlew.bat clean assembleDebug
```

> **주의:** `npm run sync` 는 www 를 옵션 없이 다시 만들어 CDN 이 꺼집니다. 환경 변수로 주면 그대로 유지됩니다. PowerShell 기준:
> `$env:TP_CDN_URL="https://storage.googleapis.com/tripeaks-mystery-assets/version.json"; npm run sync`

### 1-8. 새 그림을 올릴 때 (업데이트)

1. `python tools/build_cdn_pack.py --version 20261101-1` — 버전 이름을 새로 줍니다.
2. 새 zip 들과 `version.json` 을 버킷에 올립니다. 예전 zip 은 지워도 됩니다.
3. 1-4 의 캐시 설정 두 줄을 다시 실행합니다.

**앱 업데이트(새 APK)는 필요 없습니다.** 다음 실행 때 새 버전을 받습니다.

### 1-9. 비용 · 대안 · 테스트 상태

**비용 — 무료 체험 크레딧 → 그 뒤 항상 무료 등급:**
- 설치 1회당 약 109MB 가 나갑니다 (안드로이드 108.7MB · iOS 110.8MB). 50MB 가 아닙니다.
- **무료 체험 기간:** 저장 · 전송 요금이 모두 크레딧에서 빠지고, 카드로 청구되지 않습니다.
- **체험이 끝날 때:** 결제 계정을 **유료로 업그레이드해야** 버킷이 계속 동작합니다.
  - 업그레이드하지 않으면 리소스가 중지되고, 일정 기간 뒤 삭제될 수 있습니다.
  - 업그레이드 후에도 항상 무료 등급은 그대로 적용됩니다.
- **항상 무료 등급 (Cloud Storage, 미국 리전 버킷 기준 · 월 단위):**
  - Standard 저장 5GB — 이 게임은 약 120MB 라 저장 비용은 0
  - 북미 → 인터넷 전송 100GB (중국 · 호주 목적지 제외) — 설치 약 900회분
  - 읽기 요청 5만 회 · 쓰기 요청 5천 회
- **넘으면:** 인터넷 전송이 대략 GB 당 0.1달러대 (목적지 · 사용량에 따라 다름).
  - 월 설치 1만 건 ≈ 1.1TB ≈ 1.0TB 유료분 → 대략 100달러대 예상
- **정확한 수치는 바뀔 수 있습니다.** 버킷을 만들기 전에 공식 가격표(cloud.google.com/storage/pricing, cloud.google.com/free)에서 꼭 확인하세요.
- 콘솔 **결제 → 예산 및 알림** 에 월 예산 알림(예: 1만 원 · 3만 원)을 꼭 걸어 두세요.
  - 예산 알림은 메일만 보내고 **자동으로 멈추지는 않습니다.**

**전송량이 커지면 (Plan B):**
- 앱 안의 로직은 그대로 두고, 빌드할 때 `--cdn` 의 `version.json` 주소만 바꾸면 됩니다 (`version.json` 기준 상대 경로로 묶음을 찾음).
- **Cloudflare R2:** 인터넷 전송 요금이 없음, 저장 10GB 무료
- **Firebase Storage:** 일일 무료 전송량 있음
- 이미 설치된 앱은 예전 주소를 계속 보므로, 옮길 때는 한동안 두 곳에 같은 묶음을 두세요.

**대안:**
- **Google Play Asset Delivery** 는 Play 스토어가 무료로 배포합니다 (AAB 빌드, install-time / fast-follow 팩).
- 출시 규모가 커지면 비교해 보세요.

**테스트 상태:**
- 경로 바꿔 끼우기 · 오디오 형식 고르기 · 묶음 생성은 자동 테스트로 확인했습니다.
- **실제 다운로드 · 압축 해제는 플러그인 설치 후 실기기에서 확인이 필요합니다.**
  - 버킷 업로드 전에 플러그인을 설치하고 CDN 빌드로 한 번 돌려 보세요.

---

## 2. GitHub 비공개 저장소에 올리기

로컬 저장소는 `main` 브랜치에 첫 커밋(`c0b9284`)이 있습니다. 약 120MB, 100MB 넘는 단일 파일은 없음.

### 방법 A — 웹에서 저장소 만들고 연결 (가장 간단)

1. https://github.com/new 를 엽니다.
   - Repository name: `tripeaks-mystery`
   - **Private** 선택
   - **README · .gitignore · license 는 모두 추가하지 않음** (빈 저장소여야 충돌 없음)
2. 터미널 (프로젝트 루트):

```bash
git remote add origin https://github.com/<내-계정>/tripeaks-mystery.git
```

```bash
git push -u origin main
```

처음 push 때 Git for Windows 의 Credential Manager 가 브라우저 로그인 창을 엽니다. 로그인하면 다음부터는 자동입니다.

### 방법 B — GitHub CLI (지금 PC 에는 `gh` 가 없음)

```bash
winget install GitHub.cli
```

새 터미널에서:

```bash
gh auth login
```

```bash
gh repo create tripeaks-mystery --private --source . --remote origin --push
```

### 이후

```bash
git add -A
```

```bash
git commit -m "무엇을 바꿨는지"
```

```bash
git push
```

---

## 3. 줄바꿈 (`.gitattributes`)

프로젝트 루트에 `.gitattributes` 가 들어 있습니다. 규칙은 다음과 같습니다.
- 텍스트는 저장소 · 작업 폴더 모두 **LF**
- `gradlew` · `*.sh` 는 반드시 LF (CRLF 면 맥 · 리눅스 · CI 에서 "bad interpreter")
- `.bat` · `.cmd` · `.ps1` 은 CRLF
- 이미지 · 사운드 · 폰트 · zip · 키는 binary (변환 · diff 안 함)

적용 (한 번만):

```bash
git add .gitattributes
```

```bash
git add --renormalize .
```

```bash
git status
```

```bash
git commit -m "줄바꿈 규칙(.gitattributes) 추가"
```

- 지금 저장소의 텍스트 파일은 이미 LF 로 저장돼 있어서, `--renormalize` 로 바뀌는 파일은 거의 없습니다 (`gradlew.bat` 만 작업 폴더에서 CRLF 로 바뀜).
- 이후 "LF will be replaced by CRLF" 경고는 나오지 않습니다.

---

## 4. 원본 백업 · iOS 오디오

### 원본 백업 (구글 드라이브, 수동)

1. `C:\Users\Aedri\Desktop\assets_original_backup` 폴더를 우클릭 → **압축(ZIP) 파일**로 만듭니다.
   - 이름 예: `assets_original_backup_20261020.zip`, 약 1.4GB
2. `orokorea1@gmail.com` 구글 드라이브에 올립니다.
3. 원본이 바뀔 때마다 날짜를 붙여 새로 올리고, 이전 것도 1개 이상 남깁니다.

이 내용은 GDD 9장에 적어 두었습니다.

### iOS 오디오 (`js/audio-helper.js`)

**판단 순서:**
1. `Capacitor.getPlatform() === 'ios'` → `.mp3`
2. 브라우저가 `canPlayType('audio/ogg; codecs="vorbis"')` 에 빈 값으로 답함 → `.mp3`
3. 그 밖(안드로이드 · 크롬) → `.ogg`

**동작:**
- `settings.js` 바로 뒤에 읽혀 `TP.AUDIO_FILES` 의 모든 경로를 한 번에 바꿉니다.
- 확장자를 고른 뒤 `TP.AssetManager.url()` 을 거칩니다. CDN 으로 받아 둔 사운드면 기기 저장소 주소가 됩니다.
- 새 사운드도 `TP.AUDIO_FILES` 에 넣기만 하면 자동으로 따라옵니다.
- 코드에서 직접 경로를 쓸 때는 `TP.audioHelper.url('game_assets/sounds/sfx/x.ogg')` 로 감싸세요.

**CDN 빌드 (권장) — 다운로드 매니저가 기기에 맞는 사운드 묶음을 받음:**

| 버킷의 묶음 | 내용 | 받는 기기 |
|---|---|---|
| `…-img-1~3.zip` | 에피소드 그림 98MB | 모두 |
| `…-snd-android-1.zip` | 사운드 OGG 10.7MB (`game_assets/sounds`) | 안드로이드 |
| `…-snd-ios-1.zip` | 사운드 MP3 12.8MB (`../assets_original_backup/game_assets/sounds`) | iOS |

- `version.json` 의 `packs[].platform` 으로 구분합니다. 매니저는 `all` + 자기 플랫폼 묶음만 받습니다.
- 앱 안에는 사운드가 없습니다.
- `build_cdn_pack.py` 는 OGG 와 MP3 목록이 정확히 같은지 검사합니다. 하나라도 빠지면 묶지 않고 멈춥니다.
- 사운드는 앱에 두고 그림만 CDN 으로 하려면 `build_cdn_pack.py --no-audio` + `build_www.py --cdn … --cdn-no-audio` 를 씁니다.

**CDN 없는 iOS 빌드:**
- 백업의 MP3 를 앱 안 같은 경로에 넣고 OGG 는 뺍니다.

```bash
python tools/build_www.py --platform ios
```

- 그 뒤 `npx cap add ios`(처음 한 번) · `npx cap sync ios` 를 실행합니다. iOS 빌드에는 Mac + Xcode 가 필요합니다.
- 웹 개발 서버를 Safari 로 열면 MP3 가 프로젝트에 없어 소리만 나지 않습니다. 게임은 정상입니다.
