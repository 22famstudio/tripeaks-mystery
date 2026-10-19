# Disney Solitaire 리뷰 분석 → 트라이픽스 미스터리 개선안

- 대상: Disney Solitaire (SuperPlay) — Google Play `com.superplaystudios.disneysolitairedreams` / App Store id 6475757306
- 표본: **리뷰 559개 수집 → 중복 10개 제거 후 549개**, 출처 3곳
  - App Store 미국 250개 · 한국 250개 (Apple 공식 고객 리뷰 RSS, 2026-06-27 ~ 2026-10-15, 최신순)
  - Google Play 한국 59개 (브라우저에서 '리뷰 모두 보기'를 직접 열어 읽음, 관련성순 상위 중 별 1~4점, 2026-03 ~ 2026-09)
- 한계: Google Play는 별 1~4점만 옮겼다(5점 제외) → 그쪽은 불만 쪽으로 치우친 표본. Reddit · 커뮤니티는 이번에 읽지 않았다.
- 원본 집계표: `replica/feedback.md` (테마 정의 `replica/themes-solitaire.json`, 원문 `replica/reviews.csv`)
- 인용은 모두 원문 그대로이며, App Store 인용 링크는 해당 리뷰가 실린 RSS 페이지, Google Play 인용 링크는 리뷰 고유 주소다.

---

## 1. 사용자들이 싫어하는 것 (What they hate)

| 순위 | 문제 | 리뷰 수 | 출처 |
| --- | --- | --- | --- |
| 1 | 돈을 내지 않으면 진행이 안 된다 (현질 유도) | 150 (27%) | 3 |
| 2 | 판마다 입장 코인을 내는데 이겨도 거의 남지 않는다 | 89 (16%) | 3 |
| 3 | 패가 조작된 것 같다 — 실력보다 운 (억까) | 77 (14%) | 3 |
| 4 | 뒤로 갈수록 난이도 · 별 · 장면 요구량이 폭증 | 60 (11%) | 3 |
| 5 | 아이템 · 입장료가 레벨마다 계속 오른다 | 42 (8%) | 3 |
| 6 | 앱이 판 도중 튕겨서 코인을 잃는다 | 44 (8%) | 3 |
| 7 | 1시간마다 코인을 직접 받아야 하고 쌓이지 않는다 | 30 (6%) | 3 |
| 8 | 산 추가 카드 5장 · 골드카드가 소용없다 | 15 (3%) | 3 |
| 9 | 접속하면 결제 팝업이 수십 개 | 12 (2%) | 3 |
| 10 | 보상 · 친구 초대 · 구매 아이템 누락 | 11 (2%) | 3 |
| — | (얇음) 같은 숫자 카드가 4장 넘게 나온다 | 4 | 2 |

1. **현질 유도** — 150개 · 3곳
   - "a game that will force you to spend money in order to win. will run out of coins quickly." (App Store US, 1★) https://itunes.apple.com/us/rss/customerreviews/page=1/id=6475757306/sortBy=mostRecent/json
   - "이 게임은 돈없으면 못합니다.." (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=b22929c1-8d3d-4d54-b177-99723a60a5e9
2. **입장 코인 대비 보상이 적다** — 89개 · 3곳
   - "한 판에 플레이 비용이 2000코인이라 쳤을 때 '아무런 템 안 사고 한 번에' 클리어하면 2300정도 줌 그럼 남는 건 300코인 정도가 순이익인 거임" (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=c08b7c82-2ba9-48d6-8cfb-d3c9c712197d
   - "it’s a very fun game until you get to about level 90 when winning the levels doesn’t even give you enough coins to play another level." (App Store US, 1★) https://itunes.apple.com/us/rss/customerreviews/page=3/id=6475757306/sortBy=mostRecent/json
3. **패 조작 · 운빨** — 77개 · 3곳
   - "Never played a solitaire game where you have one card left and over 10 cards in the deck. And none of those cards are what you need to complete the level." (App Store US, 1★) https://itunes.apple.com/us/rss/customerreviews/page=5/id=6475757306/sortBy=mostRecent/json
   - "카드 배치애 패턴이나 공략이 있는 거라면 초반 튜토리얼에서 제대로 알려줬으면 합니다." (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=67ee0c39-4749-4694-9766-065f35222fb9
4. **후반 난이도 · 별 요구량 폭증** — 60개 · 3곳 (평균 2.9★: 계속 하는 사람들의 불만)
   - "지금 챕터 9 진행중인데 별이 42개나 필요하다니..." (Google Play, 2★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=fa493d5a-341b-4c2c-bad5-fc4f15b374b9
5. **입장료 · 아이템 가격 상승** — 42개 · 3곳
   - "게임을 플레이 할수록 입장료 같은게 1000, 1200, 1500씩 올라가고" (App Store KR, 1★) https://itunes.apple.com/kr/rss/customerreviews/page=5/id=6475757306/sortBy=mostRecent/json
   - "무슨 판넘길때마다 들어가는 비용이 계속 올라가고 안에서 아이템도 해당판기준이아니라 그냥 다음판진행될때마다 올라감" (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=9f361e48-afce-42b5-b681-94ed98068d49
6. **판 도중 튕김** — 44개 · 3곳
   - "Several times a day, the game will close in the middle of challenges." (App Store US, 3★) https://itunes.apple.com/us/rss/customerreviews/page=2/id=6475757306/sortBy=mostRecent/json
   - "게임이 계속 튕겨요 업데이트 해주세요" (App Store KR, 1★) https://itunes.apple.com/kr/rss/customerreviews/page=1/id=6475757306/sortBy=mostRecent/json
7. **1시간 코인, 누적 안 됨** — 30개 · 3곳
   - "Once you run out of money….you have to wait for an entire hour to be able to play again." (App Store US, 2★) https://itunes.apple.com/us/rss/customerreviews/page=1/id=6475757306/sortBy=mostRecent/json
   - "골드 누적도 안되서 1시간에 한번씩 들어가서 수동으로 골드를 모아 야 하는게 무소과금은 피로감이 쌓입니다." (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=bfb35fbe-d689-4a1f-b9c2-b46b68fe15dd
8. **추가 카드 5장이 소용없음** — 15개 · 3곳
   - "적어도 아이템 카드 쓰면 5장 중 1장이라도 쓸수있는카드를 넣어줘야 겜을 하든말든하지" (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=18bf3e67-83f2-49df-b6bd-1b2d68a4b6f7
9. **결제 팝업 폭탄** — 12개 · 3곳
   - "As soon as you open the game it's an insane amount of pop ups of in game events and whatnot that you cannot click out of" (App Store US, 1★) https://itunes.apple.com/us/rss/customerreviews/page=2/id=6475757306/sortBy=mostRecent/json
   - "일단 접속을 하면 팝업을 5~8개를 봐야함." (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=653fa99c-af7a-429a-a14d-ccac62853d72

## 2. 없어서 아쉬워하는 것 (What is missing)

1. **돈 대신 광고로 이어하기** — 3개 · 2곳 *(얇음)*
   - "유일한 장점이 광고가 없다인데 차라리 광고 달고 부활 같은 거 있었으면 낫겠네." (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=729cf244-db81-4d7b-a8e8-9643253a71b0
   - "Other games at least let you watch ads to earn coins or extras- nothing available here like that." (App Store US, 1★) https://itunes.apple.com/us/rss/customerreviews/page=3/id=6475757306/sortBy=mostRecent/json
2. **운이 아니라 실력 · 전략이 통한다는 설명** — 10개 · 3곳
   - "최소한 4개로 제한을 걸면 깨는 재미라도 있고 아 머리를 좀 써야하는구나 싶은건데." (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=982937c8-b1a2-42dc-adcd-5bfea0ab7baf
3. **튕겼을 때 코인 · 진행 보전** — 튕김 테마 44개 중 일부가 코인 손실을 직접 언급
   - "it keeps shutting me out in the middle of game. Like one game each probably a handful of times and sometimes when it does that it doesn’t give your rewards." (App Store US, 2★) https://itunes.apple.com/us/rss/customerreviews/page=2/id=6475757306/sortBy=mostRecent/json

## 3. 아무도 해결하지 않은 것 (What is unsolved → 포지셔닝)

1. **"공정한 솔리테어" 자체** — 현질 · 입장료 · 조작 의심 세 테마 중 하나라도 걸린 리뷰가 전체(5점 포함)의 약 34%다 (약 190개). 이용자들은 게임(트라이픽스)은 좋아하지만 *지는 이유를 믿지 못한다*. 공정성을 증명해 주는 게임이 없다.
2. **오래 하는 사람(레벨 1000+)** — 후반 난이도 테마는 평균 2.9★: 떠나지 않고 버티는 충성층이 지쳐 있다.
   - "저는 9500레벨 넘었어요. 과금유도 정말 심해요." (Google Play, 1★) https://play.google.com/store/apps/details?id=com.superplaystudios.disneysolitairedreams&hl=ko&reviewId=d460eefe-f1f0-4e74-9d58-357252869636
3. **리워드 앱(프리캐시 등)으로 들어온 사람** — 20개 · 2곳: 보상 조건 직전에 막힌다고 느끼고 바로 삭제. (우리 게임과는 대상이 달라 참고만)

---

## 4. 우리 게임(트라이픽스 미스터리)에 대한 시사점 — 주의

우리 경제 구조가 지금 Disney Solitaire 와 **꽤 닮아 있다**: 판마다 입장 골드(100G~), 레벨 구간이 오르면 입장료도 상승(100 → 150 → 250 …), 카드 소진 시 골드로 +5장(900G). 리뷰 1 · 2 · 5 · 8 순위 불만이 그대로 우리에게도 올 수 있다.
반대로 이미 강점인 것: **모든 판이 정답 수순으로 클리어 가능**(생성기 테스트로 증명), 클리어 시 보상 150~220G > 입장 100G (항상 흑자), 52장 한 벌(숫자별 4장), 광고 하트 · 광고 +3장 이어하기, 하트는 20분마다 자동 충전 · 5개까지 쌓임.

## 5. 수정 계획 (근거 × 비용으로 상위 7개)

| # | 무엇을 | 크기 | 담당 | 근거 |
| --- | --- | --- | --- | --- |
| F1 | **"이 판은 반드시 깰 수 있어요" 공정성 표시** — 입장 팝업 · 실패 창에 배지, 실패 후 [정답 수순 보기](처음 몇 수만 무료, 이후 광고) | S~M | replica-build | 조작 · 운빨 77개 · 3곳 |
| F2 | **이겼을 때 항상 흑자 보장을 UI로** — 결과창에 '입장 100 → 획득 205 (+105)' 순이익 표시, 레벨 구간이 올라도 보상/입장료 비율 ≥ 1.5 유지 | S | replica-build | 입장 코인 대비 보상 89개 · 가격 상승 42개 |
| F3 | **레벨이 올라도 아이템 · 이어하기 가격 고정** (지금 +5장 900G는 고정이지만 입장료는 구간마다 오름 → 입장료 상승폭 완만하게, 상승 시점을 미리 안내) | S | replica-build | 가격 상승 42개 · 3곳 |
| F4 | **유료 +5장에도 '바로 낼 수 있는 카드 1장' 보장** (광고 +3장에는 이미 적용) | S | replica-build | 추가 카드 소용없음 15개 · 3곳 |
| F5 | **튕김 · 강제 종료 시 판 이어하기** — 지금은 재접속하면 실패 처리(입장료 · 연승 손실). 판 상태를 저장해 이어하거나 최소한 입장료 환불 | M | replica-build / replica-backend | 튕김 44개 · 3곳 |
| F6 | **접속 시 팝업 1개 제한** — 상점 제안은 하루 1회, 나머지는 로비 배지로 | S | replica-build | 팝업 12개 · 3곳 |
| F7 | **광고로 이어하기 · 하트를 '돈 대신' 선택지로 명확히** (이미 있음 → 실패 창 · 골드 부족 팝업에 노출) | S | replica-build | 광고 요청 3개 · 2곳 (얇음) |

가격 · 결제 관련(F2 · F3의 수치 결정)은 `/replica-launch` 에서 상점 가격표와 함께 다시 본다.

## 6. 포지셔닝 (세 가지)

A. **공정성**
> 지는 게 조작 같아서 지친 솔리테어 팬을 위해, 트라이픽스 미스터리는 모든 판이 반드시 깰 수 있도록 만들어지고, 진 판의 정답 수순까지 보여 준다.
> 근거: 조작 · 운빨 77개 + 현질 유도 150개, 3곳

B. **이기면 남는 게임**
> 한 판 이겨도 다음 판 입장료가 안 나와서 그만둔 사람을 위해, 트라이픽스 미스터리는 이기면 언제나 입장료보다 많이 받고, 하트는 기다리면 쌓인다.
> 근거: 입장 코인 대비 보상 89개 · 1시간 코인 30개 · 가격 상승 42개, 3곳

C. **이야기가 있는 솔리테어**
> 카드만 넘기는 게 지루해진 사람을 위해, 트라이픽스 미스터리는 판을 깰 때마다 단서를 모아 300개의 사건을 직접 추리하게 한다.
> 근거: 리뷰에서 직접 요청된 테마는 아님 — 우리 쪽 강점. 후반 난이도 · 별 요구량(60개)에 지친 사람에게 '진행 목표가 이야기'라는 대안.

**추천: A (공정성) + B를 근거로.** 가장 크고(3곳에서 일관), 우리는 이미 생성기로 증명할 수 있다(정답 수순 100% 클리어 테스트). C는 스토어 설명의 두 번째 줄로.
원작 이름(디즈니 · Disney Solitaire)은 앱 이름 · 광고 · 스토어 설명에 쓰지 않는다. 비교 페이지는 국가별 법률 검토가 필요하다.
