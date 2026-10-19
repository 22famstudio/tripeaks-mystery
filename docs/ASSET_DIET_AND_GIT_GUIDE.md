# 에셋 다이어트 + 첫 Git 커밋 가이드

출시 전 할 일 두 가지: APK 용량 줄이기, 코드를 Git 에 처음으로 백업하기.
측정값은 2026-10-20 기준 프로젝트에서 직접 잰 수치입니다.

---

## 0. 지금 상태 (먼저 알아둘 것)

| 항목 | 실제 상태 |
|---|---|
| `game_assets/` 1.4GB | 이 중 **약 1.25GB 는 이미 APK 에 안 들어갑니다.** `tools/build_www.py` 가 생성 원본 폴더(`characters/` 777MB, `background/` 283MB, `sounds/bgm/` WAV 161MB 등)를 빼고 묶습니다. 그래서 이 폴더들을 옮겨도 **Git 저장소가 가벼워질 뿐 APK 는 그대로**입니다. |
| APK 193MB 의 실제 원인 | 에피소드 JPG 100MB (배경 300장 61MB · 초상화 2,114장 32MB · 썸네일 6.6MB), 루트 PNG 167개 58MB, MP3 34개 12.8MB |
| PNG → WebP (품질 82) | **58MB → 5MB** (표본 167개 전부 측정) |
| JPG → WebP (품질 82) | **오히려 커짐**: 에피소드 배경 20장 4.18MB → 4.50MB. 이미 손실 압축된 JPG 라서입니다. 품질 75 면 −12% 정도. |
| MP3 → OGG (품질 3) | 12.8MB → 10.7MB (−17%) |
| Git | 저장소는 **이미 초기화돼 있음** (`master` 브랜치, 커밋 0개). `git init` 은 다시 할 필요 없습니다(다시 해도 해는 없음). |

**예상 결과:** APK 약 193MB → **약 135MB**.
그 아래로 내리려면 에피소드 이미지(100MB)를 손봐야 합니다. 맨 아래 "더 줄이려면"을 보세요.

---

## 1. 설치

```bash
python -m pip install Pillow
```

ffmpeg 는 이미 설치돼 있습니다 (`winget` Gyan.FFmpeg 9.0.2). 다른 PC 라면:

```bash
winget install Gyan.FFmpeg
```

설치 확인 (새 터미널에서):

```bash
ffmpeg -version
```

`pydub` 은 필요 없습니다. 스크립트가 ffmpeg 를 직접 부릅니다. pydub 도 결국 내부에서 ffmpeg 를 쓰기 때문입니다.

---

## 2. 에셋 최적화 — `tools/optimize_assets.py`

### 2-1. 미리보기 (아무것도 바뀌지 않음)

```bash
python tools/optimize_assets.py
```

다음 다섯 가지를 출력합니다.
- 옮길 원본 폴더
- 변환 전후 예상 용량
- 코드에서 바뀔 파일 수
- 치환 후 없는 파일을 가리키게 될 경로
- 미사용 후보

**"없는 파일을 가리키는 경로" 가 0개인지 꼭 확인하세요.**

### 2-2. 실제 실행

```bash
python tools/optimize_assets.py --apply
```

| 단계 | 내용 |
|---|---|
| 원본 폴더 이동 | 앱에 안 들어가는 생성 원본 폴더 → `../assets_original_backup/game_assets/…` |
| PNG → WebP | 투명도 유지, 품질 82, 긴 변 최대 2048px |
| JPG | **그대로 둠** (2-4 참고) |
| MP3 · WAV → OGG Vorbis | 품질 3 |
| 원본 보관 | 변환된 원본은 지우지 않고 백업 폴더로 이동 (같은 상대 경로) |
| 코드 치환 | `js/` · `css/` · `tests/` · `tripeaks.html` 의 `.png` → `.webp`, `.mp3` → `.ogg`. 고치기 전 코드는 `../assets_original_backup/_code/` 에 사본 |
| 기록 | `../assets_original_backup/manifest.json` 에 옮긴 파일 · 변환 목록 |

옵션:

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--quality` | 82 | WebP 품질 |
| `--max-side` | 2048 | 긴 변 최대 px. `0` 이면 줄이지 않음 |
| `--audio-q` | 3 | OGG 품질 (0~10) |
| `--include-jpg` | 꺼짐 | JPG 도 변환. 단, WebP(품질 `--jpg-quality` 75)가 `--min-saving` 10% 이상 작을 때만 |
| `--keep-unshipped` | 꺼짐 | 생성 원본 폴더를 옮기지 않음 (`.gitignore` 가 Git 에서 제외해 줌) |
| `--backup 경로` | `../assets_original_backup` | 백업 위치. 프로젝트 안쪽이면 실행을 거부합니다 |

### 2-3. 확인

```bash
for f in tests/*.test.js; do node "$f"; done
```

```bash
cd mobile && npm run sync && cd android && ./gradlew.bat clean assembleDebug
```

- 브라우저로 `tripeaks.html` 을 열어 홈 · 상점 · 게임 · 수첩 · 결과창 이미지와 소리가 나오는지 봅니다.
- APK 크기도 확인합니다: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### 2-4. 주의할 점

- **iOS:** Safari · WKWebView 는 OGG Vorbis 지원이 불완전합니다. 안드로이드(Capacitor WebView)는 문제없습니다. iOS 버전을 낼 때는 백업의 MP3 를 다시 쓰거나 AAC(.m4a)로 바꾸세요.
- **JPG 변환:** 권하지 않습니다. 위 표처럼 품질 80~85 의 WebP 가 원본 JPG 보다 커집니다.
- **미사용 후보 목록:** 자동으로 지우지 않습니다. `avatar_${n}.png`, `pack_coin_${n}` 처럼 이름을 조합해 쓰는 파일이 섞여 있어, 목록만 보고 지우면 게임이 깨질 수 있습니다. 하나씩 `grep` 으로 확인한 뒤 직접 옮기세요.
- **생성 도구:** `tools/` 의 생성 스크립트(`import_episodes_v6.py`, `build_episode_backgrounds.py` 등)는 여전히 `.jpg` · `.png` 를 씁니다. 또 원본 폴더(`background/`, `characters/`)를 읽습니다.
  - 다시 돌리려면 백업에서 원본 폴더를 되돌려 놓고 실행합니다.
  - 그 뒤 `optimize_assets.py --apply` 를 한 번 더 돌립니다.
- **되돌리기:**
  - 코드는 `_code/` 사본을 덮어씁니다 (Git 커밋 뒤라면 `git checkout -- .`).
  - 에셋은 `manifest.json` 의 `to` → `from` 으로 옮기고, 생긴 `.webp` · `.ogg` 를 지웁니다.

### 2-5. 경로를 손으로 바꿀 때 (정규식)

스크립트가 자동으로 하지만, 직접 할 때는 VS Code 로 합니다.
- 전체 검색에서 `Ctrl+Shift+H` 를 누르고 `.*`(정규식)를 켭니다.
- 포함할 파일: `js/**, css/**, tests/**, *.html`
- 제외할 파일: `mobile/**, tools/**, docs/**, node_modules/**`

| 바꿀 것 | 찾기 | 바꾸기 |
|---|---|---|
| PNG | `\.png\b` | `.webp` |
| MP3 · WAV | `\.(mp3\|wav)\b` | `.ogg` |
| 특정 폴더만 | `(game_assets/[^"'\`\s)]*?)\.png\b` | `$1.webp` |

- **PNG** 는 앱에 들어가는 PNG 를 전부 바꾸므로 확장자째 바꿔도 안전합니다. `${DIR}pack_coin_${n}.png` 같은 조합 경로도 같이 맞춰집니다.
- **JPG** 는 일부만 바뀌므로 확장자째 바꾸면 안 됩니다. 실제 변환된 파일 경로만 바꾸세요 (`manifest.json` 의 `converted`).

---

## 3. `.gitignore`

프로젝트 루트의 `.gitignore` 에 다음이 들어 있습니다.

| 구분 | 항목 |
|---|---|
| 의존성 | `node_modules/` |
| 빌드 결과물 | `build/`, `mobile/www/`, 안드로이드 빌드 폴더, `*.apk` · `*.aab` · `*.apks` |
| 서명 키 · 비밀 값 | `*.keystore` · `*.jks` · `keystore.properties` · `local.properties` · `.env` · `.env.*` (`.env.example` 은 허용) · `*.pem` · `*.p12` |
| 에셋 원본 | 백업 폴더 이름, 앱에 안 들어가는 생성 원본 폴더들 (옮기지 않았을 때 대비) |
| 기타 | `__pycache__/` · 가상환경 · `.vscode/` · `.idea/` · `.DS_Store` · `Thumbs.db` · 로그 · `.claude/settings.local.json` |

확인한 결과 (최적화 전 기준, `git add -n .`):
- 파일 3,168개, 약 198MB
- 50MB 넘는 파일 0개
- `node_modules` · APK · 키 파일 0개

최적화 후에는 약 140MB 로 줄어듭니다. 대부분은 에피소드 JPG 입니다. GitHub 파일 한도(100MB)에 걸리는 파일이 없어 Git LFS 는 필요 없습니다.

---

## 4. 첫 커밋 (에셋 다이어트가 끝난 뒤)

### 1단계. 프로젝트 폴더로 이동

```bash
cd C:/Users/Aedri/Desktop/TriPeaks-card-game
```

### 2단계. 저장소 상태 확인

이미 초기화돼 있습니다. "No commits yet on master" 가 나오면 정상입니다.

```bash
git status -sb
```

`fatal: not a git repository` 가 나올 때만 초기화합니다:

```bash
git init
```

### 3단계. 기본 브랜치 이름을 main 으로

```bash
git branch -M main
```

### 4단계. 작성자 정보 (처음 한 번만)

```bash
git config --global user.name "이름"
```

```bash
git config --global user.email "메일주소"
```

### 5단계. 올라갈 목록 미리 보기

APK · 키 · `node_modules` · `mobile/www` 가 없어야 합니다.

```bash
git add -n . | grep -E "\.apk|\.aab|\.keystore|\.jks|node_modules|mobile/www|\.env"
```

아무것도 안 나오면 통과입니다.

### 6단계. 스테이징 · 확인

```bash
git add .
```

```bash
git status
```

### 7단계. 첫 커밋

```bash
git commit -m "첫 커밋: 트라이픽스 추리 솔리테어 (웹 + Capacitor 안드로이드)"
```

### 8단계. 원격 저장소에 올리기

로컬 커밋만으로는 디스크가 망가지면 같이 사라집니다. **비공개(private)** 원격 저장소에 올려 두세요.

GitHub CLI 를 쓸 때:

```bash
gh repo create tripeaks-mystery --private --source . --push
```

이미 만든 저장소에 연결할 때:

```bash
git remote add origin https://github.com/<계정>/tripeaks-mystery.git
```

```bash
git push -u origin main
```

### 이후 작업

작업 단위마다 커밋합니다:

```bash
git add -A
```

```bash
git commit -m "무엇을 바꿨는지"
```

```bash
git push
```

> **순서에 대해:** 스크립트는 고치기 전 코드를 `_code/` 에 따로 남기고, 에셋은 지우지 않고 옮기기만 합니다. 그래서 "다이어트 → 첫 커밋" 순서도 안전합니다.
> 더 조심하려면 반대로 할 수 있습니다: 다이어트 **전에** 먼저 커밋해 두면 `git checkout -- .` 한 번으로 되돌릴 수 있습니다.
> 대신 그때의 PNG(약 58MB)가 Git 기록에 영구히 남습니다.

---

## 더 줄이려면 (135MB → 그 아래)

| 방법 | 효과 | 비고 |
|---|---|---|
| 에피소드 배경 300장을 가로 960px JPG 로 다시 만들기 (`tools/build_episode_backgrounds.py`, ffmpeg `-q:v 6`) | 61MB → 약 37MB (표본 30장 측정 −39%) | 반투명 배경으로 쓰여 차이가 작을 것으로 예상. 실기기에서 확인 필요 |
| 초상화 2,114장 → WebP (`--include-jpg`) | 32MB → 약 27MB | 장당 −15% 정도 (표본 측정) |
| Play Asset Delivery / 에피소드 101~300 을 처음 실행 때 내려받기 | 기본 설치 크기 대폭 감소 | AAB 빌드 필요 |
| 출시는 AAB 로 | 기기별로 필요한 것만 받음 | Play 스토어는 AAB 필수 |
