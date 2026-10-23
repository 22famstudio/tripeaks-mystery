# Play Console 출시 설정 가이드 — 앱 콘텐츠 · 데이터 보안 · 등급 · 스토어 등록정보

Play Console → **탐정 솔리테어** 앱을 연 뒤 진행합니다. 새 화면에서는 왼쪽 아이콘 메뉴 위치가 조금씩 다를 수 있습니다.

| 할 일 | 위치 |
| --- | --- |
| 앱 콘텐츠(아래 1~8) | 왼쪽 메뉴 **정책**(🛡) → **앱 콘텐츠**. 또는 앱 **대시보드 → "앱 설정"** 할 일 목록 |
| 스토어 등록정보(9) | 왼쪽 메뉴 **Play에서 성장**(또는 스토어 노출) → **기본 스토어 등록정보** |

---

## 1. 개인정보처리방침
- URL: `https://brash-sleet-4e0.notion.site/Privacy-Policy-4002c16d20c48040afd6fa18b964fe43` (영어판. 영어판 안에 한국어·일본어 링크가 없다면 한국어판 URL을 써도 됩니다)

## 2. 앱 액세스 권한
- **모든 기능을 별도의 액세스 권한 없이 사용할 수 있음** 선택 (로그인 없이 익명으로 바로 시작)

## 3. 광고
- **예, 앱에 광고가 포함되어 있습니다**

## 4. 광고 ID
- 광고 ID를 사용하나요? **예**
- 용도: **광고 또는 마케팅**, **분석**, **사기 방지·보안·규정 준수**
  (AndroidManifest 에 `com.google.android.gms.permission.AD_ID` 권한이 있습니다)

## 5. 콘텐츠 등급 (IARC 설문)
- 이메일: 연락용 이메일, 카테고리: **게임**
- 이 게임은 그림으로 된 폭력 장면이 없고, **텍스트로 범죄(절도·사건)를 추리**합니다. 사건 텍스트에 **술 이름(위스키·샴페인 등)과 "수면제"가 범행 도구로 등장**하고, 일부 사건 제목에 "피"라는 단어가 나옵니다. 사실대로 답하면 됩니다.

| 질문 (요지) | 답 |
| --- | --- |
| 폭력 (피·신체 손상 묘사 포함) | **아니요** — 그림 묘사 없음. "폭력에 대한 언급/범죄 테마"를 묻는 항목이 있으면 **예(텍스트 언급만)** |
| 공포·무서운 요소 | **아니요** (코지 미스터리) |
| 성적 콘텐츠·노출 | **아니요** |
| 욕설·저속한 표현 | **아니요** |
| 규제 약물 — 술·담배·마약 **언급** | **예: 술 언급**(텍스트), 약물은 "수면제가 사건 도구로 언급"되는 정도 → 언급(reference)만, 사용·조장 아님 |
| 도박 / 실제 돈 베팅 / 도박 시뮬레이션 | **아니요** (솔리테어는 베팅 없음) |
| 사용자 간 상호작용·채팅·콘텐츠 공유 | **아니요** |
| 사용자 위치 공유 | **아니요** |
| 디지털 상품 구매 (인앱 결제) | **예** |
| 무작위 아이템(루트박스) 구매 | **아니요** (상품 구성이 모두 고정) |
| 인터넷 브라우저·검색 기능 | **아니요** |

- 예상 등급: 대략 **12세 이상 / Teen** (술 언급 때문). 13세 이상 타겟층과 맞습니다.

## 6. 타겟층 및 콘텐츠
- 타겟 연령: **13~15세, 16~17세, 18세 이상** 체크 (**12세 이하 체크 안 함**)
- "아동의 관심을 끌 수 있나요?" → **아니요** (캐릭터가 귀엽긴 하지만 텍스트 논리 추리 · 범죄 테마 · 인앱 결제 중심, 성인·청소년 대상)
  - 검토자가 아동 대상으로 볼 수 있다고 물으면: 스토어 설명 · 스크린샷에 아동 대상 표현이 없는지 확인
- 이 선택 때문에 Google Play 가족 정책(디자인 포 패밀리) 대상이 아니며, AdMob 은 지금 설정(`tagForChildDirectedTreatment: false`) 그대로 맞습니다.

## 7. 뉴스 앱 · 정부 앱 · 금융 기능 · 건강 앱 · COVID 등
- 모두 **아니요 / 해당 없음**

## 8. 데이터 보안 (Data safety)

### 8-1. 데이터 수집 및 보안
| 질문 | 답 |
| --- | --- |
| 필수 사용자 데이터 유형을 수집하거나 공유하나요? | **예** |
| 수집하는 모든 데이터는 전송 중에 암호화되나요? | **예** (Firebase · RevenueCat · AdMob 모두 HTTPS) |
| 계정을 만드는 방법 | **OAuth(Google 로그인)** + 익명 계정. 선택지에 "기타"가 있으면 "익명 계정 자동 생성"도 적기 |
| 계정 삭제 URL | 개인정보처리방침 URL(위 1번) — 방침에 "설정 → 계정 관리 → [계정 삭제]" 방법과 이메일 요청 방법이 적혀 있음 |
| 앱 밖에서 데이터 삭제를 요청할 수 있나요? | **예** (dong2kids@gmail.com 으로 요청) |

### 8-2. 데이터 유형 (아래 표에 있는 것만 체크)

| 데이터 유형 | 어디서 | 수집 | 공유 | 필수/선택 | 목적 |
| --- | --- | --- | --- | --- | --- |
| **개인 정보 → 이름** | Google 계정 연결 시 Firebase | ✔ | ✘ | **선택** | 계정 관리, 앱 기능 |
| **개인 정보 → 이메일 주소** | Google 계정 연결 시 Firebase | ✔ | ✘ | **선택** | 계정 관리, 앱 기능 |
| **개인 정보 → 사용자 ID** | Firebase 익명 UID · RevenueCat 고객 ID · Play 게임즈 플레이어 ID | ✔ | ✘ | **필수** | 앱 기능, 계정 관리 |
| **금융 정보 → 구매 기록** | RevenueCat · Google Play 결제 | ✔ | ✘ | **선택** (구매한 사람만) | 앱 기능(지급 · 구매 복원), 사기 방지 |
| **위치 → 대략적인 위치** | AdMob (IP 기반) | ✔ | ✔ | **필수** | 광고, 분석, 사기 방지 |
| **앱 활동 → 앱 상호작용** | AdMob (광고 노출 · 클릭) | ✔ | ✔ | **필수** | 광고, 분석 |
| **앱 정보 및 성능 → 비정상 종료 로그 · 진단** | AdMob SDK | ✔ | ✔ | **필수** | 분석, 사기 방지 |
| **기기 또는 기타 ID** | AdMob 광고 ID · Firebase 기기 정보 | ✔ | ✔ | **필수** | 광고, 분석, 사기 방지, 계정 관리 |

- **수집** = 기기 밖으로 전송됨. **공유** = 서비스 제공자(우리 대신 처리하는 곳)가 아닌 제3자에게 전달. Firebase · RevenueCat 은 우리 대신 처리하는 서비스 제공자라 "공유 아님", AdMob 광고 데이터는 Google 이 광고 목적으로 쓰므로 보수적으로 "공유"로 체크합니다.
- "일시적으로 처리되나요?"(ephemeral) → 모두 **아니요**
- 게임 진행 데이터: 기기와 이용자 본인의 Play 게임즈 저장 공간에만 저장되고 우리 서버로 오지 않으므로 체크하지 않습니다.
- 체크하지 않는 것: 정확한 위치, 연락처, 사진·동영상, 오디오, 파일, 캘린더, 메시지, 웹 기록, 건강 정보, 결제 정보(카드번호는 Google Play 만 처리)
- 참고: Google 공식 "Google Mobile Ads SDK 데이터 공개" 문서와 RevenueCat 의 "Google Play data safety" 문서에 같은 항목이 정리돼 있습니다. 나중에 Firebase Analytics · Crashlytics 를 넣으면 이 표와 개인정보처리방침을 같이 고칩니다.

---

## 9. 스토어 등록정보 (기본 언어 한국어 + 번역 추가: 영어(en-US), 일본어(ja-JP))

- 위치: **기본 스토어 등록정보** → 언어별로 **번역 관리 → 자체 번역 추가**
- 그래픽 이미지 · 스크린샷: 완료 ✅
- 앱 카테고리: **게임 → 카드** (또는 퍼즐), 태그: 솔리테어 · 미스터리 · 추리 · 퍼즐
- 연락처: 이메일 `dong2kids@gmail.com`, 웹사이트 `https://22famstudio.github.io` (이미 입력함 — app-ads.txt 용)

### 앱 이름 (최대 30자)
| 언어 | 이름 | 글자 수 |
| --- | --- | --- |
| 한국어 | 탐정 솔리테어: 세계 사건 수첩 | 16 |
| English | **Detective Solitaire: Mystery** | 29 (스토어에 등록한 이름. 게임 안 영어 제목 "Detective Solitaire: World Case Files"는 37자라 Play 제한 30자를 넘어 따로 정함. Play 게임즈 사용자 인증 정보 이름도 이것과 같게) |
| 日本語 | 探偵ソリティア：世界の事件手帳 | 15 |

### 간단한 설명 (최대 80자)
- 한국어: `카드를 맞춰 단서를 모으고 범인을 찾아라! 세계 300개 사건을 푸는 추리 솔리테어`
- English: `Clear solitaire hands, gather clues and catch the culprit in 300 mystery cases!`
- 日本語: `カードをそろえて手がかりを集め、犯人を見つけよう！世界300の事件に挑む推理ソリティア`

### 자세한 설명 — 한국어
```
카드 한 판을 넘길 때마다 단서가 하나씩 모입니다.
탐정 솔리테어는 트라이픽스 솔리테어와 코지 미스터리 추리를 합친 퍼즐 게임이에요.

🃏 쉽고 빠른 트라이픽스 솔리테어
바닥 카드보다 1 크거나 1 작은 카드를 골라 세 개의 봉우리를 모두 치우세요. A 다음은 2, A 앞은 K로 이어져요.
막힐 땐 되돌리기와 와일드 카드로 한 번에 뚫을 수 있어요.

🔍 20개의 단서, 한 명의 범인
스테이지를 깰 때마다 사건 단서를 얻어요. 코르크 보드에 용의자 사진과 단서를 붙이고, 붉은 실로 연결해 보세요.
용의자 6명 × 장소 6곳 × 물건 6개 논리 그리드를 채우면 누가, 어디서, 무엇으로 했는지 드러납니다.

🌏 세계 6개 대륙, 300개 사건
홍콩의 도서관에서 유럽의 극장, 아프리카의 항구까지. 견습 탐정에서 명탐정까지 사건은 점점 어려워져요.
범인을 지목하면 진범의 고백이 펼쳐집니다.

🐈 귀여운 탐정 고양이와 함께
처음엔 탐정 고양이가 규칙을 차근차근 알려 줘요. 튜토리얼을 끝까지 보면 보너스 골드도 드려요.

✨ 이런 분께 추천해요
• 솔리테어, 카드 퍼즐을 좋아하는 분
• 추리 소설, 방탈출, 논리 퍼즐을 좋아하는 분
• 짧은 시간에 한 판씩 가볍게 즐기고 싶은 분

• 무료로 플레이할 수 있으며, 일부 아이템은 유료로 구매할 수 있습니다.
• 광고가 포함되어 있습니다. (광고 제거 상품 있음)
• 문의: dong2kids@gmail.com
```

### 자세한 설명 — English
```
Every hand you clear reveals a new clue.
Detective Solitaire is a puzzle game that blends TriPeaks solitaire with cozy mystery deduction.

🃏 Quick, easy TriPeaks solitaire
Tap cards one higher or one lower than the open card to clear all three peaks. Aces wrap around: A goes to 2 or K.
Stuck? Use Undo and Wild cards to break through.

🔍 20 clues, one culprit
Every stage you clear gives you a clue. Pin suspect photos and clues on your corkboard and link them with red string.
Fill in a logic grid of 6 suspects × 6 places × 6 items to reveal who did it, where, and with what.

🌏 300 cases across 6 continents
From a library in Hong Kong to a theater in Europe and a harbor in Africa, cases get harder as you rise from Rookie to Master Detective.
Accuse the right suspect and hear the culprit's confession.

🐈 Solve cases with a cute detective cat
A friendly detective cat walks you through the rules, and you earn bonus Gold for finishing the tutorial.

✨ Perfect for you if you love
• Solitaire and card puzzles
• Mystery novels, escape rooms and logic puzzles
• Quick games you can play in a few minutes

• Free to play. Some items can be purchased with real money.
• Contains ads. (A No Ads option is available.)
• Contact: dong2kids@gmail.com
```

### 자세한 설명 — 日本語
```
カードを1回クリアするたびに、手がかりがひとつ見つかります。
探偵ソリティアは、トライピークスソリティアとコージーミステリーの推理を合わせたパズルゲームです。

🃏 かんたん・スピーディーなトライピークス
場札より1大きいか1小さいカードを選んで、3つの山をすべて消しましょう。Aの次は2、Aの前はKにつながります。
行き詰まったら「元に戻す」と「ワイルド」で突破できます。

🔍 20の手がかり、ひとりの犯人
ステージをクリアするたびに事件の手がかりを入手。コルクボードに容疑者の写真と手がかりを貼り、赤い糸でつないでみましょう。
容疑者6人 × 場所6か所 × 物6つのロジックグリッドを埋めれば、誰が・どこで・何を使ったのかが明らかに。

🌏 世界6大陸、300の事件
香港の図書館からヨーロッパの劇場、アフリカの港まで。見習い探偵から名探偵へ、事件はだんだん難しくなります。
犯人を指名すると、真犯人の告白が始まります。

🐈 かわいい探偵ネコといっしょに
最初は探偵ネコがルールをやさしく教えてくれます。チュートリアルを最後まで見るとボーナスゴールドももらえます。

✨ こんな方におすすめ
• ソリティアやカードパズルが好きな方
• 推理小説、脱出ゲーム、ロジックパズルが好きな方
• すきま時間に気軽に遊びたい方

• 基本プレイ無料。一部アイテムは有料で購入できます。
• 広告が含まれています。（広告削除アイテムあり）
• お問い合わせ: dong2kids@gmail.com
```
