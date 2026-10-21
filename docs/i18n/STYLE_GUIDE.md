# 번역 문체 가이드 — English · 日本語 (2단계)

에피소드 1~300화 번역과 이후 모든 번역의 기준. 용어는 [`data/i18n/glossary.json`](../../data/i18n/glossary.json), 검사는 `node tools/episode_audit.js --glossary --translations`.

## 0. 가장 중요한 규칙 — 논리를 바꾸지 않는다

단서는 퍼즐이다. 문장이 자연스러워도 **뜻이 한 칸이라도 넓어지거나 좁아지면 퍼즐이 깨진다.** 번역할 때 아래를 지킨다.

| 한국어 | 뜻 (그리드) | EN | JA | 하면 안 되는 것 |
|---|---|---|---|---|
| A나 B 중 한 명이다 | 둘 중 정확히 한 명 (한 물건 = 한 주인) | either A or B | AかBのどちらか | "A and/or B", "A or B or both" |
| A도 B도 아니다 | 둘 다 아님 | neither A nor B | AでもBでもない | "not A or B" (모호) |
| 둘 중 한 곳에 있었다 | 두 장소 중 하나 | in one of two places: … | …のどちらか一方にいた | 장소를 하나 더 붙이기 |
| 옆방 · 이웃한 방 | 그리드에서 바로 붙은 칸 | right next door / neighboring rooms | すぐ隣の部屋 | "nearby", "close to" (거리 뜻이 넓어짐) |
| 앞쪽 · 현관에 가까운 | 그리드에서 더 왼쪽 (바로 옆일 필요 없음) | closer to the entrance / came before | 玄関に近い / 手前 | "right before" (바로 앞으로 좁아짐) |
| …였다면 …이다 (만약) | 앞이 거짓이면 아무것도 말하지 않음 | If …, then … | もし…なら、… | "only if", "if and only if" |
| …였다면 …이고, …없었다면 …아니다 | 둘 다 참이거나 둘 다 거짓 | If …, then …; if not, … either | …なら…で、…でないなら…でもない | 한쪽만 옮기기 |
| 하나만 사실이다 / 둘 다는 아니다 | 정확히 하나 | exactly one … / but not both | ちょうど一つだけ / 両方ではない | "at least one" |
| 거짓으로 밝혀졌다 | 반대가 사실 | turned out to be a lie | 嘘だと判明した | "was doubtful" |
| 확인되지 않았다 (소문) | 참·거짓 모름 — 그리드에 쓰지 않음 | unconfirmed | 確認されていない | "it was said that" (사실처럼 읽힘) |

- 증인 · 자료 머리말("집사는 이렇게 말했다.", "감식반 보고 —")은 **사실**로 읽힌다. 번역에서 "claimed", "allegedly", 「〜らしい」처럼 의심을 붙이지 않는다. 거짓은 오직 "거짓으로 밝혀졌다"로만 표시된다.
- 장소는 그리드 왼쪽부터 복도를 따라 한 줄 — "방", "옆방", "현관", "안쪽"은 그 줄을 가리키는 말이다. 정원 · 갑판 같은 곳도 "방"으로 옮긴다 (room / 部屋).
- 이름 · 장소 · 물건은 **용어집 표기를 그대로** 쓴다. 그리드 칸 이름과 단서 속 이름이 한 글자라도 다르면 유저가 대조하지 못한다.
- 번역 뒤 `episode_audit.js` 의 L6(단서에 이름 · 장소 · 물건이 모두 나오는가)을 번역문에도 돌린다 (3단계에서 번역문 검사 추가).

## 1. 톤

- **코지 미스터리.** 사건은 "소동"이고 범행 도구는 수면제 든 음료 · 미끄러운 기름 · 열쇠 같은 장난스러운 것들이다. 피해자는 잠들거나, 창고에 갇히거나, 망신을 당한다.
- 금지: 죽음 · 살인 · 피 · 시체를 떠올리게 하는 말 (EN *kill, murder, dead, body, blood* / JA 殺す・殺人・死体・血). 원문 고백에 이런 말이 있으면 번역에서 순화하고 [검수 보고서](EPISODE_AUDIT.md)에 표시된 대로 원문도 고친다.
- 욕설은 쓰지 않는다. 화난 말투는 어휘가 아니라 문장 길이 · 느낌표로 낸다 (EN "How dare you!" / JA 「ふざけるな！」 정도까지).
- 탐정(플레이어)을 부르는 말: EN *Detective* / JA 探偵さん (UI 기본 닉네임과 같음).

## 2. English

- 미국 영어. 철자 *color, theater, gray*.
- UI 버튼은 첫 글자만 대문자 (*Give up stage*, *Back to lobby*). 제목은 Title Case (*Win Streak Rewards*).
- 그리드 칸 이름(장소 · 물건)은 단서 속에서도 **Title Case + the** — 그리드와 바로 대조되도록: *was in the Study*, *had the Pocket Watch*. 용어집에 `noThe` 가 붙은 이름은 the 없이 (*on Platform 3*, *on Level B2*).
- 장소 전치사는 용어집의 세 번째 값 (in / at / on): *in the Study*, *at the Front Desk*, *on the Stern Deck*.
- 증인 역할은 소문자 + the: *the butler*, *a dockworker* (용어집 값 그대로). 문장 첫머리면 대문자.
- 성별을 모르는 사람(물건 주인 등)은 *whoever had the …*, *the owner of the …*, 대명사는 *they*.
- 단서 문장은 과거형 · 짧게. 축약형(*didn't*)은 대사 · 고백에서만, 단서 본문은 풀어 쓴다(*did not*) — 논리 단어(not)가 눈에 잘 띄게.
- 이름: 한국 이름은 붙여 쓰는 통용 표기(*Minji, Seoyeon, Dohyun*), 중국 본토는 병음(*Zixuan*), 대만은 하이픈 웨이드식(*Po-han*), 홍콩 · 싱가포르 광둥/호키엔식은 띄어 쓰기(*Wing Yan, Jun Jie*), 베트남은 띄어 쓰기 · 성조 기호 없이(*Minh Anh*). 서양 이름은 그 나라 철자(*Joaquin, Siobhan, Ondrej*).
- **악센트 · 발음 구별 기호 없이 ASCII 로** (*Jose, Sean, Roisin, Sao Paulo, cafe*) — 본문 글꼴(나눔스퀘어)에 é · ř 같은 글자가 없어 그 글자만 다른 글꼴로 보이기 때문. 고백도 같음.
- 한 화 안의 두 이름이 서로 겹치면 안 됨 (*Martin* ⊂ *Martina*, リアム ⊂ ウィリアム) — 화면이 이름을 글자로 찾아 강조하므로. `--translations` 의 T2 가 잡는다 (리암은 リーアム).

## 3. 日本語

- UI · 안내문: です・ます調. 단서 · 수사 메모: だ・である調 (보고서 말투). 고백 · 대사: 인물 말투 그대로.
- **용의자 이름은 모두 가타카나** — 일본 인물도 (サクラ, ハルト). 히라가나 이름은 문장 속 조사와 붙어 경계가 안 보이고(さくらは…), 한자는 원래 표기를 알 수 없어서. 여러 낱말 이름은 ・로 (ジョン・ポール, ミン・アイン).
- 문장부호는 전각: 「」 『』 ！ ？ （ ） ・ 。、 숫자 · 영문은 반각 (3番ホーム, VIPルーム).
- 장소 · 물건은 용어집 표기 그대로, 앞뒤에 「」를 붙이지 않는다 (그리드와 같은 모양으로).
- 「AかBのどちらか」= 정확히 하나. 「AもBも〜ない」= 둘 다 아님. 「〜なら」의 조건 · 결론 순서를 바꾸지 않는다.
- 탐정 호칭 探偵さん, 고백 속 "탐정님" → 探偵さん, "명탐정님" → 名探偵さん.

## 4. 단서 문장 틀 (tools/logic_gen.py `text_of` 와 같은 순서)

`{S}` `{S2}` 용의자 · `{P}` `{P2}` 장소 · `{I}` `{I2}` 물건. EN 의 `{in}` 은 장소 전치사, `the` 는 `noThe` 장소에서 뺀다.

| 유형 | 한국어 | English | 日本語 |
|---|---|---|---|
| NOT_PLACE ① | 그 시각 {S}는 {P}에 있지 않았다. | At that time, {S} was not {in} the {P}. | その時刻、{S}は{P}にいなかった。 |
| NOT_PLACE ② | {P}의 출입 기록에 {S}의 이름은 없었다. | {S}'s name was not in the {P}'s entry log. | {P}の入室記録に{S}の名前はなかった。 |
| NOT_PLACE ③ | {P}에 남은 발자국은 {S}의 신발과 맞지 않았다. | The footprints in the {P} did not match {S}'s shoes. | {P}に残っていた足跡は、{S}の靴と合わなかった。 |
| NOT_PLACE ④ | 여러 사람이 '{S}는 {P}에 발을 들인 적도 없다'고 증언했다. | Several people testified that {S} never set foot in the {P}. | 何人もが「{S}は{P}には足を踏み入れていない」と証言した。 |
| IS_PLACE ① | 복도 CCTV에 {S}가 {P}에 들어가는 모습이 찍혀 있었다. | The hallway camera caught {S} going into the {P}. | 廊下の防犯カメラに、{S}が{P}へ入っていく姿が映っていた。 |
| IS_PLACE ② | {S}는 사건 내내 {P}에 머물렀다는 것이 확인되었다. | It was confirmed that {S} stayed {in} the {P} the whole time. | {S}は騒ぎの間ずっと{P}にいたことが確認された。 |
| NOT_PLACES ① | {S}는 {P}에도, {P2}에도 가지 않았다. | {S} went neither to the {P} nor to the {P2}. | {S}は{P}にも{P2}にも行かなかった。 |
| NOT_PLACES ② | {S}의 동선을 따라가 보니 {P}과 {P2}에는 들르지 않았다. | Retracing {S}'s steps: no stop at the {P} or the {P2}. | {S}の足取りをたどると、{P}にも{P2}にも立ち寄っていなかった。 |
| NOT_PLACES ③ | {P}과 {P2} 어느 쪽에서도 {S}를 본 사람은 없었다. | No one saw {S} in the {P} or in the {P2}. | {P}でも{P2}でも、{S}を見た者はいなかった。 |
| OR_PLACE ① | {S}는 {P}이나 {P2} 둘 중 한 곳에 있었다. | {S} was in one of two places: the {P} or the {P2}. | {S}は{P}か{P2}、どちらか一方にいた。 |
| OR_PLACE ② | 목격자의 기억이 흐릿하다. {S}를 본 곳은 {P}이나 {P2} 중 하나였다고 한다. | The witness's memory is hazy: they saw {S} either in the {P} or in the {P2}. | 目撃者の記憶はあいまいだ。{S}を見たのは{P}か{P2}のどちらかだという。 |
| NOT_AT ① | {P}에 있던 사람은 {S}도 {S2}도 아니다. | The person in the {P} was neither {S} nor {S2}. | {P}にいたのは{S}でも{S2}でもない。 |
| NOT_AT ② | {S}과 {S2}는 둘 다 {P}에 가지 않았다. | Neither {S} nor {S2} went to the {P}. | {S}も{S2}も{P}には行っていない。 |
| NOT_AT ③ | {P}의 방명록에는 {S}과 {S2}의 이름이 없었다. | The {P}'s guest book had no entry for {S} or {S2}. | {P}の記帳簿に、{S}と{S2}の名前はなかった。 |
| OR_AT ① | {P}에 있던 사람은 {S}이나 {S2}다. | The person in the {P} was either {S} or {S2}. | {P}にいたのは{S}か{S2}のどちらかだ。 |
| OR_AT ② | {P}에서 들린 목소리는 {S}이나 {S2} 둘 중 한 명의 것이었다. | The voice heard in the {P} belonged to either {S} or {S2}. | {P}から聞こえた声は、{S}か{S2}のどちらかのものだった。 |
| OR_AT ③ | {P}에 있던 사람을 두고 {S}과 {S2}가 서로를 가리켰다. 둘 중 한 명이 맞다. | {S} and {S2} each said the other was in the {P}. One of them is right. | {P}にいた人物について、{S}と{S2}は互いを指さした。どちらか一方が正しい。 |
| NEIGHBOR ① | {S}과 {S2}의 자리는 복도에서 바로 옆방이었다. | {S} and {S2} were in rooms right next to each other along the hallway. | {S}と{S2}は、廊下で隣り合う部屋にいた。 |
| NEIGHBOR ② | {S}는 벽 너머 옆방에서 {S2}의 기침 소리를 들었다. | {S} heard {S2} coughing through the wall, in the room next door. | {S}は壁越しに、隣の部屋から{S2}の咳を聞いた。 |
| NEIGHBOR ③ | {S}는 창문 너머 바로 옆방에서 {S2}가 움직이는 것을 보았다. | Through a window, {S} saw {S2} moving in the room right next door. | {S}は窓越しに、すぐ隣の部屋で{S2}が動くのを見た。 |
| NOT_NEIGHBOR ① | {S}과 {S2}의 방은 서로 붙어 있지 않았다. | {S}'s room and {S2}'s room were not next to each other. | {S}と{S2}の部屋は隣り合っていなかった。 |
| NOT_NEIGHBOR ② | {S}는 {S2}의 목소리를 전혀 듣지 못했다. 둘은 옆방이 아니었다. | {S} never heard {S2}'s voice. They were not in neighboring rooms. | {S}は{S2}の声をまったく聞いていない。二人は隣の部屋ではなかった。 |
| LEFT_OF ① | 복도 순서로 보면 {S}의 방이 {S2}의 방보다 앞쪽에 있었다. | Going down the hallway, {S}'s room came before {S2}'s. | 廊下の順番で見ると、{S}の部屋は{S2}の部屋より手前にあった。 |
| LEFT_OF ② | {S}는 {S2}보다 현관에 가까운 쪽 방에 있었다. | {S} was in a room closer to the entrance than {S2}. | {S}は{S2}より玄関に近い部屋にいた。 |
| LEFT_OF ③ | 현관에서 들어온 {S2}는 {S}의 방 앞을 지나 더 안쪽에 있는 자기 방으로 갔다. | Coming in from the entrance, {S2} walked past {S}'s room to their own room farther in. | 玄関から入った{S2}は、{S}の部屋の前を通り過ぎ、さらに奥の自分の部屋へ向かった。 |
| NOT_ITEM ① | {I}에서 {S}의 지문은 나오지 않았다. | {S}'s fingerprints were not on the {I}. | {I}から{S}の指紋は出なかった。 |
| NOT_ITEM ② | {S}는 {I}를 한 번도 만진 적이 없다. | {S} never once touched the {I}. | {S}は{I}に一度も触れたことがない。 |
| NOT_ITEM ③ | {S}의 가방에서는 {I}가 나오지 않았다. | The {I} was not in {S}'s bag. | {S}のかばんから{I}は出てこなかった。 |
| IS_ITEM ① | {S}의 소지품에서 {I}가 발견되었다. | The {I} was found among {S}'s belongings. | {S}の持ち物から{I}が見つかった。 |
| IS_ITEM ② | {I}의 주인은 {S}였다. | The {I} belonged to {S}. | {I}の持ち主は{S}だった。 |
| NOT_ITEMS ① | {S}는 {I}과 {I2} 중 어느 것도 가지고 있지 않았다. | {S} had neither the {I} nor the {I2}. | {S}は{I}も{I2}も持っていなかった。 |
| NOT_ITEMS ② | {S}의 주머니를 뒤져 봤지만 {I}도 {I2}도 없었다. | A search of {S}'s pockets turned up neither the {I} nor the {I2}. | {S}のポケットを調べたが、{I}も{I2}もなかった。 |
| NOT_ITEMS ③ | {I}과 {I2} 어디에서도 {S}의 지문은 나오지 않았다. | {S}'s fingerprints were on neither the {I} nor the {I2}. | {I}からも{I2}からも、{S}の指紋は出なかった。 |
| NOT_HOLDERS ① | {I}의 주인은 {S}도 {S2}도 아니었다. | The {I} belonged to neither {S} nor {S2}. | {I}の持ち主は{S}でも{S2}でもなかった。 |
| NOT_HOLDERS ② | {S}과 {S2}는 {I}를 본 적도 없다고 했다. 사실이었다. | {S} and {S2} both said they had never even seen the {I}. It was true. | {S}と{S2}は{I}を見たこともないと言った。それは本当だった。 |
| NOT_HOLDERS ③ | {I}에는 {S}과 {S2}의 손길이 닿은 흔적이 없었다. | Neither {S} nor {S2} had ever laid a hand on the {I}. | {I}には、{S}と{S2}が触れた形跡がなかった。 |
| OR_HOLDER ① | {I}를 가진 사람은 {S}이나 {S2} 중 한 명이다. | The {I} belonged to either {S} or {S2}. | {I}を持っていたのは{S}か{S2}のどちらかだ。 |
| OR_HOLDER ② | {I}은 {S}이나 {S2} 둘 중 한 명의 소지품이었다. | {I} was among the belongings of either {S} or {S2} — one of the two. | {I}は、{S}か{S2}のどちらか一方の持ち物だった。 |
| PLACE_NOT_ITEM ① | {P}에 있던 사람은 {I}를 가지고 있지 않았다. | Whoever was in the {P} did not have the {I}. | {P}にいた人物は{I}を持っていなかった。 |
| PLACE_NOT_ITEM ② | 감식 결과, {P}에는 {I}가 놓였던 흔적이 없었다. | Forensics found no sign that the {I} had ever been in the {P}. | 鑑識の結果、{P}に{I}が置かれていた形跡はなかった。 |
| ITEM_AT_PLACE ① | {I}를 가진 사람은 그 시각 {P}에 있었다. | Whoever had the {I} was {in} the {P} at that time. | {I}を持っていた人物は、その時刻{P}にいた。 |
| ITEM_AT_PLACE ② | {P} 바닥에서 {I}의 흔적이 나왔다. 그것을 가진 사람이 거기 있었다는 뜻이다. | Traces of the {I} turned up on the {P} floor — its owner was there. | {P}の床から{I}の痕跡が出た。持ち主がそこにいたということだ。 |
| XOR ① | {S}는 {P}에 있었거나 {I}를 가지고 있었다. 하지만 둘 다는 아니다. | {S} was either {in} the {P} or had the {I} — but not both. | {S}は{P}にいたか、{I}を持っていたかのどちらかだ。だが両方ではない。 |
| XOR ② | {S}에 대한 두 증언 '{P}에 있었다'와 '{I}를 가지고 있었다' 중 정확히 하나만 사실이다. | Of the two statements about {S} — "was {in} the {P}" and "had the {I}" — exactly one is true. | {S}についての二つの証言「{P}にいた」「{I}を持っていた」のうち、本当なのはちょうど一つだけだ。 |
| IFF ① | {S}가 {P}에 있었다면 {I}도 {S}의 것이고, {P}에 없었다면 {I}도 {S}의 것이 아니다. | If {S} was {in} the {P}, the {I} is {S}'s too; if not, the {I} is not {S}'s either. | {S}が{P}にいたなら{I}も{S}のもので、いなかったなら{I}も{S}のものではない。 |
| IFF ② | {S}의 두 진술 '{P}에 있었다'와 '{I}를 가지고 있었다'는 둘 다 참이거나 둘 다 거짓이다. | {S}'s two statements — "I was {in} the {P}" and "I had the {I}" — are either both true or both false. | {S}の二つの供述「{P}にいた」「{I}を持っていた」は、両方とも本当か、両方とも嘘かのどちらかだ。 |
| IF_THEN ① | 만약 {S}가 {P}에 있었다면, {S}는 {I}를 가지고 있었을 것이다. | If {S} was {in} the {P}, then {S} had the {I}. | もし{S}が{P}にいたなら、{S}は{I}を持っていたはずだ。 |
| IF_THEN ② | {S}가 {P}에 있었다는 증언이 맞다면, {I}의 주인은 {S}다. | If the testimony that {S} was {in} the {P} is right, the {I} is {S}'s. | {S}が{P}にいたという証言が正しいなら、{I}の持ち主は{S}だ。 |
| IF_THEN_X ① | 만약 {S}가 {P}에 있었다면, {I}를 가진 사람은 {S2}다. | If {S} was {in} the {P}, then the {I} belonged to {S2}. | もし{S}が{P}にいたなら、{I}を持っていたのは{S2}だ。 |
| IF_THEN_X ② | {S}가 {P}에 있었다는 말이 사실이라면, {I}의 주인은 {S2}였을 것이다. | If it's true that {S} was {in} the {P}, the {I} must have been {S2}'s. | {S}が{P}にいたというのが本当なら、{I}の持ち主は{S2}だったはずだ。 |
| ITEM_NEIGHBOR ① | {I}를 가진 사람과 {I2}를 가진 사람은 바로 옆방에 있었다. | Whoever had the {I} and whoever had the {I2} were in rooms right next to each other. | {I}を持っていた人物と{I2}を持っていた人物は、すぐ隣の部屋同士にいた。 |
| ITEM_NEIGHBOR ② | {I}의 주인은 벽 너머 옆방에서 {I2}의 주인이 움직이는 소리를 들었다. | The owner of the {I} heard the owner of the {I2} moving in the room next door. | {I}の持ち主は壁越しに、隣の部屋で{I2}の持ち主が動く音を聞いた。 |
| ITEM_NEIGHBOR ③ | {I}의 주인과 {I2}의 주인은 복도에서 이웃한 방에 있었다. | The owners of the {I} and the {I2} were in neighboring rooms along the hallway. | {I}の持ち主と{I2}の持ち主は、廊下で隣り合う部屋にいた。 |
| ITEM_LEFT_OF ① | 복도 순서로 보면 {I}를 가진 사람의 방이 {I2}를 가진 사람의 방보다 앞쪽이었다. | Going down the hallway, the room of whoever had the {I} came before the room of whoever had the {I2}. | 廊下の順番で見ると、{I}を持つ人物の部屋は{I2}を持つ人物の部屋より手前だった。 |
| ITEM_LEFT_OF ② | {I}의 주인은 {I2}의 주인보다 현관에 가까운 쪽 방에 있었다. | The owner of the {I} was in a room closer to the entrance than the owner of the {I2}. | {I}の持ち主は、{I2}の持ち主より玄関に近い部屋にいた。 |
| HOLDER_NEAR_PLACE ① | {I}를 가진 사람은 {P} 바로 옆방에 있었다. | Whoever had the {I} was in the room right next to the {P}. | {I}を持っていた人物は、{P}のすぐ隣の部屋にいた。 |
| HOLDER_NEAR_PLACE ② | {I}의 주인은 {P}의 벽 너머 옆방에 있었다. | The owner of the {I} was just through the wall from the {P}, in the room next door. | {I}の持ち主は、{P}の壁の向こう、隣の部屋にいた。 |
| 거짓 증언 (장소) | {S}는 "그 시각 나는 {P}에 있었다"고 주장했다. 하지만 그 말은 거짓으로 밝혀졌다. | {S} claimed, "I was {in} the {P} at that time." That turned out to be a lie. | {S}は「その時刻、私は{P}にいた」と主張した。だが、それは嘘だと判明した。 |
| 거짓 증언 (물건) | {S}는 "{I}는 원래 내 것"이라고 우겼다. 하지만 그 말은 거짓으로 밝혀졌다. | {S} insisted, "The {I} is mine." That turned out to be a lie. | {S}は「{I}はもともと私のものだ」と言い張った。だが、それは嘘だと判明した。 |
| 소문 (2·3단계) | 한편 {S}가 {P}에 있었다는 소문도 돌았지만, 확인되지는 않았다. | There was also a rumor that {S} was {in} the {P}, but it was never confirmed. | 一方、{S}が{P}にいたという噂もあったが、確認されていない。 |
| 결정적 힌트 (21) | 결정적 모순: {D}의 알리바이는 사실로 확인됐다. 그 시각 {D}는 {DP}에 있었다. 반면 {K}는 '{LP}에 있었다'고 진술했지만, 그 시각 {LP}에는 {W}가 있었다. 이 소동의 뿌리는 '{동기}'였다. | Key contradiction: {D}'s alibi checked out — {D} was {in} the {DP} at that time. {K}, however, said they were {in} the {LP}, but {W} was the one {in} the {LP} at that time. At the root of this commotion: {motive}. | 決定的な矛盾：{D}のアリバイは事実と確認された。その時刻、{D}は{DP}にいた。一方、{K}は「{LP}にいた」と供述したが、その時刻{LP}にいたのは{W}だった。この騒動の根っこにあったのは「{動機}」だった。 |

### 머리말 (증인 · 자료 출처)

| 한국어 | English | 日本語 |
|---|---|---|
| {w}의 증언: | {W}'s statement: | {w}の証言： |
| {w}가 기억하기로, | As {w} remembers it, | {w}の記憶では、 |
| {w}는 이렇게 말했다. | {W} said: | {w}はこう言った。 |
| {w}가 조용히 귀띔했다. | {W} quietly mentioned: | {w}がそっと耳打ちした。 |
| {w}의 진술서 — | {W}'s written statement — | {w}の供述書 — |
| 감식반 보고 — | Forensics report — | 鑑識の報告 — |
| 현장 사진을 다시 보니, | Looking at the scene photos again: | 現場写真を見直すと、 |
| 탐정의 수첩: | Detective's notes: | 探偵の手帳： |
| 수사 메모 — | Case memo — | 捜査メモ — |
| {w}가 가져온 기록에 따르면, | According to records {w} brought in: | {w}が持ってきた記録によれば、 |

`{w}` 는 용어집 `witnesses` (EN 은 *the butler* 처럼 관사 포함, 문장 첫머리면 대문자 `{W}`).

머리말 규칙 (`tools/logic_gen.py` `dress()`): 두 조건을 엮는 단서(XOR · IFF · IF_THEN · OR_* · 옆방 · 앞쪽)에는 증인 말투를 붙이지 않고 **수사 메모 — / 탐정의 수첩:** 만 쓴다 (증인이 '만약 ~라면'을 말하지 않게). 그 사건 용의자의 직업과 겹치는 증인 역할(예: 용의자 바텐더 + '바텐더의 증언')은 고르지 않는다.

## 5. 에피소드 고정 문구

| 항목 | 한국어 | English | 日本語 |
|---|---|---|---|
| 부제 | {대륙} · {도시}의 {분위기} {공간} | {continent} · A {mood} {space} in {city} | {大陸}・{都市}の{雰囲気}{空間} |
| 사건 개요 | {장소}에서 한밤중에 기묘한 소동이 벌어졌다. 용의자는 6명. 단서를 모아 수첩의 논리 그리드로 누가 어디에서 무엇을 가졌는지 맞혀 보자. 장소는 그리드 왼쪽부터 복도를 따라 한 줄로 이어져 있다. 범인은 사건 현장에서 범행 도구를 가진 사람이다. | Late one night, a strange commotion broke out at {a place}. There are six suspects. Gather clues and use the Logic Grid in your notebook to work out who was where with what. The places run left to right along a single hallway. The culprit is whoever was at the crime scene with the weapon. | 真夜中、{場所}で奇妙な騒動が起きた。容疑者は6人。手がかりを集め、手帳の推理グリッドで「誰が・どこで・何を持っていたか」を突き止めよう。場所はグリッドの左から廊下に沿って一列に並んでいる。犯人は、事件現場で凶器を持っていた人物だ。 |
| 해결 문구 | 진범은 {직업} {이름}. 동기는 {동기} — {설명} | The culprit: {name}, the {job}. Motive: {motive} — {explanation} | 真犯人は{職業}の{名前}。動機は{動機} — {説明} |
| 동기 설명 · 비밀 은폐 | 피해자가 쥐고 있던 비밀이 세상에 드러나는 것을 막으려 했다. | They wanted to keep the victim from revealing a secret. | 被害者が握っていた秘密が世に出るのを防ごうとした。 |
| 동기 설명 · 치정 및 배신 | 믿었던 사람에게 배신당한 마음을 끝내 다스리지 못했다. | They could never get over being betrayed by someone they trusted. | 信じていた人に裏切られた気持ちを、どうしても抑えられなかった。 |
| 동기 설명 · 질투와 시기 | 피해자의 재능과 성공을 오랫동안 시기해 왔다. | They had long envied the victim's talent and success. | 被害者の才能と成功を、長いあいだ妬んでいた。 |
| 동기 설명 · 해묵은 앙금 | 오래전 받은 상처를 골탕 먹이는 소동으로 갚으려 했다. | They wanted to pay back an old hurt with a prank of their own. | 昔受けた傷を、いたずら騒ぎで仕返ししようとした。 |
| 동기 설명 · 금전 및 재산 갈취 | 피해자의 돈과 재산을 손에 넣으려 했다. | They were after the victim's money and property. | 被害者の金と財産を手に入れようとした。 |
| 용의자 정보 | {성별} · {나이}세. {배경} | {gender} · age {age}. {bio} | {性別}・{年齢}歳。{経歴} |

- "피해자"(victim)는 그대로 둔다 — 소동을 당한 사람. 다만 죽음을 떠올리게 하는 수식은 붙이지 않는다.
- 용의자 배경(bio)은 20여 개 틀의 조합이다. 3단계에서 틀 단위로 옮기고, [검수 보고서](EPISODE_AUDIT.md) 2-6 의 어색한 조합은 원문부터 고친다.
- 진범의 고백(confession)은 에피소드마다 따로 옮긴다. 원문 문제(살인 암시 · 욕설 · 직업 · 도구 불일치)는 보고서 3장대로 먼저 고친다.

## 6. 3단계 진행 순서 (제안)

1. 보고서의 원문 수정안 확정 → `tools/logic_gen.py` · `import_episodes_v6.py` · CSV 반영 → 다시 생성 → `episode_audit.js` 0 오류
2. 단서 · 힌트 · 부제 · 개요 · 해결 문구: 위 틀 + 용어집으로 **기계 조립** (사람이 옮기지 않음 → 논리 보존). `js/data/episodes.en.js` · `episodes.ja.js`
3. 고백 · 용의자 배경 · 에피소드 제목: 사람(모델) 번역 + 용어집 검사
4. 번역문 검사 추가: 단서마다 그 단서의 이름 · 장소 · 물건이 번역 표기 그대로 모두 들어 있는가 (L6 번역판)
5. 원어민 검수(4단계) 전에 영어 · 일본어 화면에서 1·50·100·150·250·300화 플레이

> 1~5 완료 (1~100화 2026-10-20, 101~300화 2026-10-21). 일본어 고백에 새 한자를 쓰면 `python tools/build_jp_font.py` 를 다시 돌리고, 원본 글꼴에 없는 한자(覯 · 攀 등)는 쉬운 말로 바꾼다.
