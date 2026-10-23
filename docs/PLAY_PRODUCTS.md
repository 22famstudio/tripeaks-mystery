# Play Console 인앱 상품 등록표

Play Console → 수익 창출 → 제품 → 인앱 상품(일회성 상품) → **상품 만들기** 에서 아래 상품을 하나씩 만든다 (광고 패스권 4종 adpass_* 는 2026-10-24 추가).

| 칸 | 넣을 값 |
| --- | --- |
| 상품 ID | 아래 `상품 ID` 그대로 (js/shop.js 와 같아야 하고, 만든 뒤에는 못 바꾼다) |
| 이름 · 설명 | 한국어(기본 언어). **번역 추가** 로 영어(en-US) · 일본어(ja-JP) 도 넣는다. 이름 최대 55자, 설명 50~200자 |
| 아이콘 | `store/iap_icons/<상품 ID>.png` (512×512, 투명 배경 32비트 PNG, 글자 없음) |
| 제품 세금 카테고리 | **디지털 앱 판매** (기본값 그대로) |
| 연령 등급 | **선택 안 함** (앱 등급을 따름) |
| 결제 위치 제한 | **제한 없음** (기본값 그대로) |
| 구매 옵션 | ID 는 `buy`, 유형 **구매(Buy)**, **이전 버전과 호환** 켬, 여러 개 구매(수량) 끔 |
| 가격 | 아래 기준 가격 → 다른 국가는 환율로 자동 변환. 앱 상점에는 Play 의 현지 가격이 그대로 보인다 |
| 마지막 | **저장 → 활성화** |

소비형 / 비소비형은 Play 에 넣는 칸이 없다 → RevenueCat 에서 지정한다 (docs/REVENUECAT_GUIDE.md 3단계).

## 1. `starter_novice` — 초보 탐정 스타터팩

- 가격 **$2.99 (₩4,200)** · 비소비형 · 아이콘 `store/iap_icons/starter_novice.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 초보 탐정 스타터팩 | 새로 수사를 시작한 탐정을 위한 계정당 1회 한정 팩이에요. 구성: 골드 3,000, 되돌리기 5, 와일드 2, 무한 하트 30분. 넉넉한 아이템으로 첫 사건들을 막힘없이 풀어 보세요. |
| English | Rookie Detective Starter Pack | A one-time pack for new detectives (once per account). Includes 3,000 Gold, 5 Undo, 2 Wild, 30 min Infinite Hearts. Plenty of items to get through your first cases. |
| 日本語 | 新米探偵スターターパック | 捜査を始めたばかりの探偵のための、アカウントごとに1回限りのパックです。内容：ゴールド3,000、元に戻す5回、ワイルド2枚、無限ハート30分。たっぷりのアイテムで最初の事件を解決しましょう。 |

## 2. `starter_elite` — 엘리트 탐정 스타터팩

- 가격 **$4.99 (₩6,900)** · 비소비형 · 아이콘 `store/iap_icons/starter_elite.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 엘리트 탐정 스타터팩 | 새로 수사를 시작한 탐정을 위한 계정당 1회 한정 팩이에요. 구성: 골드 6,000, 되돌리기 10, 와일드 4, 무한 하트 60분, 힌트권 2장. 넉넉한 아이템으로 첫 사건들을 막힘없이 풀어 보세요. |
| English | Elite Detective Starter Pack | A one-time pack for new detectives (once per account). Includes 6,000 Gold, 10 Undo, 4 Wild, 60 min Infinite Hearts, 2 Hint Tickets. Plenty of items to get through your first cases. |
| 日本語 | エリート探偵スターターパック | 捜査を始めたばかりの探偵のための、アカウントごとに1回限りのパックです。内容：ゴールド6,000、元に戻す10回、ワイルド4枚、無限ハート60分、ヒントチケット2枚。たっぷりのアイテムで最初の事件を解決しましょう。 |

## 3. `coin_tier_01` — 동전 주머니

- 가격 **$0.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_01.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 동전 주머니 | 수사 자금 골드 묶음이에요. 구성: 골드 1,000. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Coin Pouch | Get 1,000 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | 小銭袋 | ゴールド1,000を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 4. `coin_tier_02` — 골드 주머니

- 가격 **$1.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_02.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 골드 주머니 | 수사 자금 골드 묶음이에요. 구성: 골드 2,200. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Gold Pouch | Get 2,200 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | ゴールド袋 | ゴールド2,200を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 5. `coin_tier_03` — 골드 상자

- 가격 **$4.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_03.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 골드 상자 | 수사 자금 골드 묶음이에요. 구성: 골드 6,000. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Gold Box | Get 6,000 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | ゴールド箱 | ゴールド6,000を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 6. `coin_tier_04` — 골드 자루

- 가격 **$9.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_04.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 골드 자루 | 수사 자금 골드 묶음이에요. 구성: 골드 13,500. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Gold Sack | Get 13,500 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | ゴールド大袋 | ゴールド13,500を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 7. `coin_tier_05` — 골드 궤짝

- 가격 **$14.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_05.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 골드 궤짝 | 수사 자금 골드 묶음이에요. 구성: 골드 22,000. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Gold Chest | Get 22,000 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | ゴールド櫃 | ゴールド22,000を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 8. `coin_tier_06` — 골드 금고

- 가격 **$19.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_06.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 골드 금고 | 수사 자금 골드 묶음이에요. 구성: 골드 32,000. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Gold Safe | Get 32,000 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | ゴールド金庫 | ゴールド32,000を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 9. `coin_tier_07` — 골드 수레

- 가격 **$29.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_07.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 골드 수레 | 수사 자금 골드 묶음이에요. 구성: 골드 52,500. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Gold Cart | Get 52,500 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | ゴールド荷車 | ゴールド52,500を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 10. `coin_tier_08` — 황금 마차

- 가격 **$49.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_08.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 황금 마차 | 수사 자금 골드 묶음이에요. 구성: 골드 95,000. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Golden Carriage | Get 95,000 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | 黄金の馬車 | ゴールド95,000を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 11. `coin_tier_09` — 황금 보물창고

- 가격 **$79.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_09.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 황금 보물창고 | 수사 자금 골드 묶음이에요. 구성: 골드 164,000. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Golden Treasury | Get 164,000 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | 黄金の宝物庫 | ゴールド164,000を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 12. `coin_tier_10` — 명탐정의 비밀 금고

- 가격 **$99.99** · 소비형 · 아이콘 `store/iap_icons/coin_tier_10.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 명탐정의 비밀 금고 | 수사 자금 골드 묶음이에요. 구성: 골드 220,000. 골드로 상점에서 힌트권, 되돌리기, 와일드 같은 수사 아이템을 사고, 막힌 판을 이어서 할 수 있어요. |
| English | Master Detective's Secret Vault | Get 220,000 Gold. Spend Gold in the shop on Hint Tickets, Undo, Wild and other items, or to keep playing a tough round. |
| 日本語 | 名探偵の秘密金庫 | ゴールド220,000を獲得できます。ゴールドはショップでヒントチケット、元に戻す、ワイルドなどの捜査アイテムの購入や、難しいステージの続行に使えます。 |

## 13. `hint_ten` — 힌트권 10장 묶음

- 가격 **$0.99** · 소비형 · 아이콘 `store/iap_icons/hint_ten.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 힌트권 10장 묶음 | 추리 그리드에서 칸 하나의 정답을 바로 확인하는 힌트권 묶음이에요. 구성: 힌트권 10장. 막힌 추리를 풀고 범인에게 한 걸음 더 다가가세요. |
| English | 10 Hint Tickets | Hint Tickets reveal the answer for one cell of the logic grid. Includes 10 Hint Tickets. Crack the case and get closer to the culprit. |
| 日本語 | ヒントチケット10枚セット | 推理グリッドのマスひとつの答えを確認できるヒントチケットのセットです。内容：ヒントチケット10枚。行き詰まった推理を解いて犯人に近づきましょう。 |

## 14. `hint_case` — 탐정 힌트 가방

- 가격 **$1.99** · 소비형 · 아이콘 `store/iap_icons/hint_case.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 탐정 힌트 가방 | 추리 그리드에서 칸 하나의 정답을 바로 확인하는 힌트권 묶음이에요. 구성: 힌트권 15장, 골드 1,000. 막힌 추리를 풀고 범인에게 한 걸음 더 다가가세요. |
| English | Detective's Hint Bag | Hint Tickets reveal the answer for one cell of the logic grid. Includes 15 Hint Tickets, 1,000 Gold. Crack the case and get closer to the culprit. |
| 日本語 | 探偵のヒントかばん | 推理グリッドのマスひとつの答えを確認できるヒントチケットのセットです。内容：ヒントチケット15枚、ゴールド1,000。行き詰まった推理を解いて犯人に近づきましょう。 |

## 15. `chance_mini` — 미니 찬스 팩

- 가격 **$0.99** · 소비형 · 아이콘 `store/iap_icons/chance_mini.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 미니 찬스 팩 | 카드 플레이를 돕는 아이템 묶음이에요. 구성: 되돌리기 5, 와일드 2. 되돌리기로 실수를 무르고, 와일드로 막힌 판을 뚫어 보세요. |
| English | Mini Booster Pack | A bundle of items that help with card play. Includes 5 Undo, 2 Wild. Undo your mistakes and use Wild cards to break through tough rounds. |
| 日本語 | ミニチャンスパック | カードプレイを助けるアイテムのセットです。内容：元に戻す5回、ワイルド2枚。元に戻すでミスを取り消し、ワイルドで行き詰まったステージを突破しましょう。 |

## 16. `chance_standard` — 스탠다드 찬스 팩

- 가격 **$2.99** · 소비형 · 아이콘 `store/iap_icons/chance_standard.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 스탠다드 찬스 팩 | 카드 플레이를 돕는 아이템 묶음이에요. 구성: 되돌리기 15, 와일드 6, 무한 하트 15분. 되돌리기로 실수를 무르고, 와일드로 막힌 판을 뚫어 보세요. |
| English | Standard Booster Pack | A bundle of items that help with card play. Includes 15 Undo, 6 Wild, 15 min Infinite Hearts. Undo your mistakes and use Wild cards to break through tough rounds. |
| 日本語 | スタンダードチャンスパック | カードプレイを助けるアイテムのセットです。内容：元に戻す15回、ワイルド6枚、無限ハート15分。元に戻すでミスを取り消し、ワイルドで行き詰まったステージを突破しましょう。 |

## 17. `chance_pro` — 프로 찬스 팩

- 가격 **$6.99** · 소비형 · 아이콘 `store/iap_icons/chance_pro.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 프로 찬스 팩 | 카드 플레이를 돕는 아이템 묶음이에요. 구성: 되돌리기 40, 와일드 15, 무한 하트 30분. 되돌리기로 실수를 무르고, 와일드로 막힌 판을 뚫어 보세요. |
| English | Pro Booster Pack | A bundle of items that help with card play. Includes 40 Undo, 15 Wild, 30 min Infinite Hearts. Undo your mistakes and use Wild cards to break through tough rounds. |
| 日本語 | プロチャンスパック | カードプレイを助けるアイテムのセットです。内容：元に戻す40回、ワイルド15枚、無限ハート30分。元に戻すでミスを取り消し、ワイルドで行き詰まったステージを突破しましょう。 |

## 18. `chance_bulk` — 대용량 찬스 팩

- 가격 **$12.99** · 소비형 · 아이콘 `store/iap_icons/chance_bulk.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 대용량 찬스 팩 | 카드 플레이를 돕는 아이템 묶음이에요. 구성: 되돌리기 110, 와일드 15, 무한 하트 60분. 되돌리기로 실수를 무르고, 와일드로 막힌 판을 뚫어 보세요. |
| English | Mega Booster Pack | A bundle of items that help with card play. Includes 110 Undo, 15 Wild, 60 min Infinite Hearts. Undo your mistakes and use Wild cards to break through tough rounds. |
| 日本語 | 大容量チャンスパック | カードプレイを助けるアイテムのセットです。内容：元に戻す110回、ワイルド15枚、無限ハート60分。元に戻すでミスを取り消し、ワイルドで行き詰まったステージを突破しましょう。 |

## 19. `chance_master` — 마스터 찬스 팩

- 가격 **$24.99** · 소비형 · 아이콘 `store/iap_icons/chance_master.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 마스터 찬스 팩 | 카드 플레이를 돕는 아이템 묶음이에요. 구성: 되돌리기 250, 와일드 35, 무한 하트 120분. 되돌리기로 실수를 무르고, 와일드로 막힌 판을 뚫어 보세요. |
| English | Master Booster Pack | A bundle of items that help with card play. Includes 250 Undo, 35 Wild, 120 min Infinite Hearts. Undo your mistakes and use Wild cards to break through tough rounds. |
| 日本語 | マスターチャンスパック | カードプレイを助けるアイテムのセットです。内容：元に戻す250回、ワイルド35枚、無限ハート120分。元に戻すでミスを取り消し、ワイルドで行き詰まったステージを突破しましょう。 |

## 20. `noads_basic` — 광고 제거

- 가격 **$4.99** · 비소비형 · 아이콘 `store/iap_icons/noads_basic.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 제거 | 게임 중 전면 광고와 배너 광고를 없애요. 같은 Google 계정이면 다시 설치해도 복원돼요. 보상형 광고는 원할 때 계속 볼 수 있어요. 함께 받는 것: 광고 패스권 1장. |
| English | No Ads | Removes interstitial and banner ads. Restores on reinstall with the same Google account. Rewarded ads stay available when you want them. Also includes 1 Ad Passes. |
| 日本語 | 広告削除 | ゲーム中のインタースティシャル広告とバナー広告を削除します。同じGoogleアカウントなら再インストールしても復元できます。リワード広告は引き続き視聴できます。さらに広告スキップ券1枚も付いてきます。 |

## 21. `noads_plus` — 광고 제거 플러스

- 가격 **$5.99** · 비소비형 · 아이콘 `store/iap_icons/noads_plus.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 제거 플러스 | 게임 중 전면 광고와 배너 광고를 없애요. 같은 Google 계정이면 다시 설치해도 복원돼요. 보상형 광고는 원할 때 계속 볼 수 있어요. 함께 받는 것: 골드 1,000, 광고 패스권 2장. |
| English | No Ads Plus | Removes interstitial and banner ads. Restores on reinstall with the same Google account. Rewarded ads stay available when you want them. Also includes 1,000 Gold, 2 Ad Passes. |
| 日本語 | 広告削除プラス | ゲーム中のインタースティシャル広告とバナー広告を削除します。同じGoogleアカウントなら再インストールしても復元できます。リワード広告は引き続き視聴できます。さらにゴールド1,000、広告スキップ券2枚も付いてきます。 |

## 22. `noads_deluxe` — 광고 제거 디럭스

- 가격 **$7.99** · 비소비형 · 아이콘 `store/iap_icons/noads_deluxe.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 제거 디럭스 | 게임 중 전면 광고와 배너 광고를 없애요. 같은 Google 계정이면 다시 설치해도 복원돼요. 보상형 광고는 원할 때 계속 볼 수 있어요. 함께 받는 것: 골드 2,500, 되돌리기 5, 광고 패스권 3장. |
| English | No Ads Deluxe | Removes interstitial and banner ads. Restores on reinstall with the same Google account. Rewarded ads stay available when you want them. Also includes 2,500 Gold, 5 Undo, 3 Ad Passes. |
| 日本語 | 広告削除デラックス | ゲーム中のインタースティシャル広告とバナー広告を削除します。同じGoogleアカウントなら再インストールしても復元できます。リワード広告は引き続き視聴できます。さらにゴールド2,500、元に戻す5回、広告スキップ券3枚も付いてきます。 |

## 23. `noads_vip` — 광고 제거 VIP

- 가격 **$11.99** · 비소비형 · 아이콘 `store/iap_icons/noads_vip.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 제거 VIP | 게임 중 전면 광고와 배너 광고를 없애요. 같은 Google 계정이면 다시 설치해도 복원돼요. 보상형 광고는 원할 때 계속 볼 수 있어요. 함께 받는 것: 골드 6,000, 되돌리기 12, 와일드 4, 광고 패스권 10장. |
| English | No Ads VIP | Removes interstitial and banner ads. Restores on reinstall with the same Google account. Rewarded ads stay available when you want them. Also includes 6,000 Gold, 12 Undo, 4 Wild, 10 Ad Passes. |
| 日本語 | 広告削除VIP | ゲーム中のインタースティシャル広告とバナー広告を削除します。同じGoogleアカウントなら再インストールしても復元できます。リワード広告は引き続き視聴できます。さらにゴールド6,000、元に戻す12回、ワイルド4枚、広告スキップ券10枚も付いてきます。 |

## 24. `adpass_10` — 광고 패스권 10장

- 가격 **$0.99** · 소비형 · 아이콘 `store/iap_icons/adpass_10.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 패스권 10장 | 보상형 광고를 보지 않고 바로 보상을 받는 광고 패스권 묶음이에요. 구성: 광고 패스권 10장. 하트 충전, 덱 추가, 결정적 힌트 같은 광고 보상을 한 장으로 바로 받아요. |
| English | 10 Ad Passes | Ad Passes let you skip a rewarded ad and get the reward instantly. Includes 10 Ad Passes. Use one for hearts, extra cards, key hints and other ad rewards. |
| 日本語 | 広告スキップ券10枚 | リワード広告を見ずにすぐ報酬を受け取れる広告スキップ券のセットです。内容：広告スキップ券10枚。ハート回復やカード追加、決定的ヒントなどの広告報酬に1枚ずつ使えます。 |

## 25. `adpass_20` — 광고 패스권 20장

- 가격 **$1.79** · 소비형 · 아이콘 `store/iap_icons/adpass_20.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 패스권 20장 | 보상형 광고를 보지 않고 바로 보상을 받는 광고 패스권 묶음이에요. 구성: 광고 패스권 20장. 하트 충전, 덱 추가, 결정적 힌트 같은 광고 보상을 한 장으로 바로 받아요. |
| English | 20 Ad Passes | Ad Passes let you skip a rewarded ad and get the reward instantly. Includes 20 Ad Passes. Use one for hearts, extra cards, key hints and other ad rewards. |
| 日本語 | 広告スキップ券20枚 | リワード広告を見ずにすぐ報酬を受け取れる広告スキップ券のセットです。内容：広告スキップ券20枚。ハート回復やカード追加、決定的ヒントなどの広告報酬に1枚ずつ使えます。 |

## 26. `adpass_50` — 광고 패스권 50장

- 가격 **$3.99** · 소비형 · 아이콘 `store/iap_icons/adpass_50.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 패스권 50장 | 보상형 광고를 보지 않고 바로 보상을 받는 광고 패스권 묶음이에요. 구성: 광고 패스권 50장. 하트 충전, 덱 추가, 결정적 힌트 같은 광고 보상을 한 장으로 바로 받아요. |
| English | 50 Ad Passes | Ad Passes let you skip a rewarded ad and get the reward instantly. Includes 50 Ad Passes. Use one for hearts, extra cards, key hints and other ad rewards. |
| 日本語 | 広告スキップ券50枚 | リワード広告を見ずにすぐ報酬を受け取れる広告スキップ券のセットです。内容：広告スキップ券50枚。ハート回復やカード追加、決定的ヒントなどの広告報酬に1枚ずつ使えます。 |

## 27. `adpass_100` — 광고 패스권 100장

- 가격 **$6.99** · 소비형 · 아이콘 `store/iap_icons/adpass_100.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 광고 패스권 100장 | 보상형 광고를 보지 않고 바로 보상을 받는 광고 패스권 묶음이에요. 구성: 광고 패스권 100장. 하트 충전, 덱 추가, 결정적 힌트 같은 광고 보상을 한 장으로 바로 받아요. |
| English | 100 Ad Passes | Ad Passes let you skip a rewarded ad and get the reward instantly. Includes 100 Ad Passes. Use one for hearts, extra cards, key hints and other ad rewards. |
| 日本語 | 広告スキップ券100枚 | リワード広告を見ずにすぐ報酬を受け取れる広告スキップ券のセットです。内容：広告スキップ券100枚。ハート回復やカード追加、決定的ヒントなどの広告報酬に1枚ずつ使えます。 |

## 28. `offer_detective_emergency` — 탐정 긴급 지원 팩

- 가격 **₩3,300** · 소비형 · 아이콘 `store/iap_icons/offer_detective_emergency.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 탐정 긴급 지원 팩 | 사건 수사에 꼭 필요한 아이템을 모은 특별 구성 팩이에요. 구성: 골드 2,500, 와일드 3, 힌트권 3장. 막힌 사건을 지금 바로 풀어 보세요. |
| English | Detective Emergency Kit | A special bundle of must-have items for your investigation. Includes 2,500 Gold, 3 Wild, 3 Hint Tickets. Solve that stuck case right now. |
| 日本語 | 探偵緊急サポートパック | 事件捜査に欠かせないアイテムを集めた特別パックです。内容：ゴールド2,500、ワイルド3枚、ヒントチケット3枚。行き詰まった事件を今すぐ解決しましょう。 |

## 29. `offer_home_always` — 명탐정 상시 특별 지원

- 가격 **$3.99** · 소비형 · 아이콘 `store/iap_icons/offer_home_always.png`

| 언어 | 이름 | 설명 |
| --- | --- | --- |
| 한국어 | 명탐정 상시 특별 지원 | 사건 수사에 꼭 필요한 아이템을 모은 특별 구성 팩이에요. 구성: 골드 4,000, 와일드 5, 되돌리기 8, 힌트권 4장. 막힌 사건을 지금 바로 풀어 보세요. |
| English | Master Detective Special Kit | A special bundle of must-have items for your investigation. Includes 4,000 Gold, 5 Wild, 8 Undo, 4 Hint Tickets. Solve that stuck case right now. |
| 日本語 | 名探偵 常設スペシャルサポート | 事件捜査に欠かせないアイテムを集めた特別パックです。内容：ゴールド4,000、ワイルド5枚、元に戻す8回、ヒントチケット4枚。行き詰まった事件を今すぐ解決しましょう。 |
