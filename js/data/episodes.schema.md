# 에피소드 데이터 구조 (`TP.EPISODES`)

`js/data/episodes.js`는 **자동 생성 파일**입니다. 직접 고치지 말고 원본 데이터를 고친 뒤 다시 생성하세요.

## 현재 원본: V6 300화 (대륙 순서)

```bash
python tools/import_episodes_v6.py            # data/TriPeaks_300_Episodes_V6_Sorted.csv → 1~300화
node tests/episodes-v6.test.js                # 원본 대조 · 대륙 전환 · 해결 보상 검증
```

V6 에피소드에 추가된 필드: `continent`(한국어 대륙) · `region`(그림 풀 키) · `city` · `place` · `confession`(진범의 고백) ·
용의자 `age` · `gender` · `bio`. 파일 맨 위 `TP.EPISODE_CHAPTERS` = 대륙별 에피소드 구간 (챕터 전환 연출에 사용).
단서 20개 · 광고 힌트 3종은 변환기가 에피소드 번호 고정 시드로 만든다 (V6에는 단서 열이 없음).

아래는 예전 마스터 엑셀(`import_episodes.py`) 기준 설명이며 필드 의미는 같다.

```bash
python tools/import_episodes.py "TriPeaks_Mystery_300_Episodes_Master.xlsx" --from 1 --to 10
```

- `--check-all` : 300개 전체를 검사만 하고 요약 출력 (파일은 만들지 않음)
- `--roadmap N` : 에피소드 메뉴에 "출시 예정"으로 보여 줄 다음 에피소드 수 (기본 3)
- 생성 후 `node tests/mystery.test.js`로 논리 검증

## 에피소드

| 필드 | 설명 | 엑셀 원본 |
|---|---|---|
| `episodeId` | `ep001` 형식 (스테이지 시드·저장 데이터 키) | Ep No |
| `no`, `title` | 번호, 제목(끝의 `(Ep.001)` 제거) | Ep No, 에피소드 타이틀 |
| `subtitle` | `국가 · 시대 · 사건 유형` | 국가/문화권, 역사적 시대 배경, 사건 유형 |
| `intro` | 사건 개요 (수첩 첫 메모) | 사건 시놉시스 |
| `actualCulpritIds` | 진범 ID 목록 — 공범 사건은 2명 이상, 전원을 지목해야 해결 | 진범 ID (쉼표 구분) |
| `actualCulpritId` | 첫 번째 진범 (단독 범행 호환용) | |
| `suspects[]` | 용의자 (표시 순서는 에피소드별 고정 시드로 섞임) | Suspects_Master_Pool |
| `clues[]` | 스테이지 1~20 단서 | Clues_Matrix_6900 (스테이지 1~20) |
| `hints[]` | 광고 힌트 3종 `{ text, eliminate: [id] }` | Clues_Matrix_6900 (HINT 1~3) |
| `background`, `thumb` | 홈 배경 / 에피소드 카드 이미지 — 국가·제목 낱말로 배경 풀에서 배정 (Ep.1은 전용 그림) | 국가/문화권 (`tools/episode_art.py`) |
| `rewards`, `solutionText` | 해결 보상(기본값), 해결 연출 문구 | 범행 동기 유형, 세부 범행 동기 |

## 용의자

`{ id, name, job, trait, alibi, emoji, color, portrait }`
- `trait` = `성별 · 나이. 배경 설정`
- `portrait` : Ep.1 전용 일러스트(직업·성별 일치 시) → 없으면 생성 초상화 풀에서 **대륙 · 직업 · 성별**로 배정 (한 에피소드 안에서 중복 없음). 그래도 없으면 `emoji` + `color` 원

## 단서 소품 (`clues[].prop`)

단서 문장에 금고·향수·장부·반지·홍차·편지·시계·열쇠·약초·등산화·유언장 낱말이 있으면 소품 그림 경로. 없으면 `null` (단서 획득 팝업에서 그림 생략).

## 에피소드 그림 풀

`game_assets/characters_background/` 의 생성 이미지 중 공용 풀(`_gen_cache/proc`)만 쓴다.
같은 폴더의 `배경 도구 용의자/Ep.N` 묶음은 다른 데이터로 만든 것이라(용의자 직업·진범·국가 배경이 현재 엑셀과 다르고 파일명에 '진범' 표시) 사용하지 않는다.

```bash
python tools/build_episode_art.py     # 풀 → game_assets/episodes/{bg,suspect,clue}/*.jpg (웹용, 약 17MB)
```
배정 규칙(국가→배경, 게임 직업→풀 직업, 그림별 성별, 단서 낱말→소품)은 `tools/episode_art.py`.

## 단서의 facts (추론용, 화면에는 text만 보임)

| 종류 | 형태 | 의미 |
|---|---|---|
| `clear` | `{ type: 'clear', suspect }` | 알리바이 확인 등으로 그 용의자를 직접 소거 (마스터 엑셀 방식) |
| `crime` | `{ type: 'crime', attr, value }` | 범인에 대한 사실 (속성 대조형, 수기 시나리오용) |
| `suspect` | `{ type: 'suspect', suspect, attr, value }` | 특정 용의자에 대한 사실 |

## 변환기가 자동으로 고치는 것

1. 조사 템플릿 `을(를)`, `이(가)`, `은(는)`, `와(과)`, `(으)로` → 받침에 맞는 조사 하나로
2. 소거 대상이 있는데 본문에 이름이 없으면 `(○○ 용의선상 제외)` 덧붙임 — 플레이어가 글만 보고 추리할 수 있게
3. 용의자 순서 섞기 — 원본은 진범이 항상 3번째(공범은 2·5번째)
