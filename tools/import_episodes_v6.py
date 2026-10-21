"""
V6 에피소드 데이터(TriPeaks_300_Episodes_V6_Sorted) → js/data/episodes.js 변환기

사용법 (프로젝트 루트에서):
    python tools/import_episodes_v6.py [data/TriPeaks_300_Episodes_V6_Sorted.csv] [--from 1] [--to 300]

원본 열 (CSV 또는 같은 내용의 xlsx 첫 시트)
    에피소드 | 제목 | 대륙 | 장소 | 진범 | 용의자들 | 살해 동기 | 스토리(진범의 고백)
    진범·용의자 = '이름 (나이세/성별/직업)', 용의자들은 쉼표로 구분 (진범은 목록에 없음)

스토리 진행 순서 = 대륙 순서
    아시아(1~100) → 북아메리카(101~140) → 남아메리카(141~180) → 아프리카(181~230) → 유럽(231~280) → 오세아니아(281~300)

하는 일
  1. 원본을 그대로 읽는다 (장소 · 진범 프로필 · 용의자 프로필 · 동기 · 고백 스토리). 엑셀/CSV 는 고치지 않는다.
  2. V6 에는 스테이지 단서가 없으므로 에피소드마다 20개를 만든다 (에피소드 번호 고정 시드 → 매번 같은 결과)
       - 추리형 (tools/deduction_clues.py): "○○는 제외" 같은 정답 대신
         범인에 대한 사실(왼손잡이 · 사건 시각 위치 · 옷에 묻은 흔적 · 목격된 나이대/성별)과
         용의자에 대한 관찰을 섞어 주고, 플레이어가 대조해서 범인을 좁힌다
         → 20개를 다 모으면 논리적으로 진범 한 명, 19개까지는 두 명 이상
       - 나머지 단서: 장소(도시·공간·날씨) 묘사, 동기 유형별 물증
  3. tools/sanitize_episodes.py 로 정제 (코지 톤 순화 · 조사 교정 · 중복 제목 해소 · 광고 힌트 3종 = 진범의 직업·연령·동기 암시)
       반복되는 진범 이름 교체(일본식 이름으로 바꿈)는 V6 의 대륙별 이름과 맞지 않아 쓰지 않는다.
  4. 배경(도시)·초상화(대륙·직업·성별)·단서 소품 그림 배정 (tools/episode_art.py)
  5. 검증 리포트: 용의자 수, 대륙 구간, 소거 순서, 순화로 바뀐 문장 수
"""
import argparse
import csv
import hashlib
import json
import os
import random
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # python -P 실행 대비
import sanitize_episodes as sanitize
import cozy_rules
import episode_text                                         # tools/episode_text.py (용의자 배경 · 사건 개요 틀 — 번역과 같이 씀)
import episode_art
import deduction_clues                                      # tools/deduction_clues.py (추리형 단서 20개 — 논리 그리드 데이터가 없을 때)
import logic_clues                                          # tools/logic_clues.py (조사 교정 fix_josa)
import logic_gen                                            # tools/logic_gen.py (논리 그리드 단서 생성기 · 같은 풀이기로 검증)
from import_episodes import fix_josa, color_for, emoji_for

sys.stdout.reconfigure(encoding='utf-8')

DEFAULT_SRC = 'data/TriPeaks_300_Episodes_V6_Sorted.csv'
LOGIC_SRC = 'data/V6_300_Episodes_Logic_Clues.json'   # 논리 그리드 단서 20개 + 단서 21(광고) — 있으면 이 단서를 쓴다
CONFESSION_SRC = 'data/confessions_rewrite.json'       # 다시 쓴 진범의 고백 { "에피소드 번호": 문장 } — 있으면 원본 고백 대신 그대로 (코지 순화 생략)
CONFESSIONS = ({int(k): v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), CONFESSION_SRC),
                                                     encoding='utf-8')).items() if k.isdigit()}
               if os.path.exists(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), CONFESSION_SRC)) else {})
ROOT_OUT = 'js/data/episodes.js'
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 대륙 (스토리 진행 순서). key = 그림 풀(episode_art.REGION_KEY)의 영문 이름
CONTINENTS = [
    ('아시아', 'Asia', 'Asia'),
    ('북아메리카', 'North America', 'North America'),
    ('남아메리카', 'South America', 'South America'),
    ('아프리카', 'Africa', 'Africa'),
    ('유럽', 'Europe', 'Europe'),
    ('오세아니아', 'Oceania', 'Oceania'),
]
CONTINENT_EN = {ko: en for ko, en, _ in CONTINENTS}
EXPECTED_RANGES = {'아시아': (1, 100), '북아메리카': (101, 140), '남아메리카': (141, 180),
                   '아프리카': (181, 230), '유럽': (231, 280), '오세아니아': (281, 300)}

PERSON = re.compile(r'^\s*(.+?)\s*\((\d+)세/(남|여)/(.+?)\)?\s*$')
JOB_FIX = {'음악 가': '음악가'}

ADJECTIVES = ['비 내리는', '눈 덮인', '바람 부는', '안개 낀', '음산한', '조용한', '낡은', '화려한', '호화로운',
              '비밀스러운', '시끄러운', '버려진', '어두운']

# ---- 공간별 단서 재료: 세부 장소 · 목격자 · 사라지거나 발견되는 물건(소품 그림 낱말 포함) ----
SPOTS = {
    '고급 저택': (['서재', '응접실', '온실', '와인 저장고'], ['집사', '정원사'], ['금고', '회중시계', '유언장']),
    '연구소': (['실험실', '자료실', '연구실 복도', '온실 표본실'], ['야간 연구원', '청소 담당 직원'], ['연구 장부', '열쇠 카드', '약초 표본']),
    '오래된 성당': (['고해실', '종탑', '성구실', '지하 납골당 입구'], ['성가대 지휘자', '관리인'], ['은촛대', '기부금 장부', '오래된 열쇠']),
    '카지노 VIP룸': (['딜러 테이블', '금고실', '라운지 바', '보안실'], ['딜러', '보안 요원'], ['칩 보관 금고', '반지', '회중시계']),
    '극장 무대 뒤': (['분장실', '소품 창고', '조명실', '무대 승강기'], ['무대 감독', '조명 기사'], ['소품 상자', '향수병', '협박 편지']),
    '골목길 다방': (['주방', '창가 자리', '뒷문', '지하 창고'], ['다방 주인', '단골 손님'], ['찻잔', '홍차 깡통', '장부']),
    '지하 주차장': (['관리 사무소', '비상계단', 'B2 구역', '출차 게이트'], ['주차 관리원', '세차 직원'], ['차 열쇠', '진흙 발자국', '영수증']),
    '기차역': (['대합실', '수하물 보관소', '3번 승강장', '역장실'], ['역무원', '짐꾼'], ['열차 시간표', '회중시계', '여행 가방 열쇠']),
    '도서관': (['고서 열람실', '서고', '사서실', '열람실 구석'], ['사서 보조', '경비원'], ['희귀본', '편지', '열쇠 꾸러미']),
    '폐공장': (['기계실', '옛 사무실', '창고 2층', '정문 초소'], ['고물상', '경비원'], ['진흙 발자국', '장부', '녹슨 열쇠']),
    '유람선 선실': (['갑판', '선장실', '식당칸', 'VIP 선실'], ['승무원', '선원'], ['선실 열쇠', '회중시계', '반지']),
    '호텔 스위트룸': (['스위트룸 거실', '프런트', '룸서비스 주방', '비상계단'], ['벨보이', '룸메이드'], ['마스터키', '향수병', '금고']),
    '박물관 전시실': (['특별 전시실', '수장고', '경비실', '학예사 연구실'], ['학예사', '야간 경비원'], ['전시품 인장', '열쇠', '유물 장부']),
    '항구 창고': (['선적 사무실', '컨테이너 구역', '부두 끝', '하역장'], ['하역 인부', '세관 직원'], ['선적 장부', '자물쇠 열쇠', '진흙 발자국']),
    '재즈 클럽': (['무대 뒤 대기실', '바 카운터', 'VIP 부스', '뒷골목 출입구'], ['바텐더', '피아니스트'], ['악보 사이 편지', '반지', '향수병']),
    '해안가 펜션': (['2층 객실', '부엌', '바닷가 테라스', '창고'], ['펜션 주인', '이웃 어부'], ['방 열쇠', '진흙 발자국', '홍차 찻잔']),
}
DEFAULT_SPOT = (['현장', '복도', '뒷문', '창고'], ['직원', '이웃'], ['열쇠', '편지', '장부'])

WEATHER = {
    '비 내리는': '빗물에 젖은 우산이 {room} 입구에 세워져 있었다. 비가 그친 뒤에 누군가 드나들었다는 뜻이다.',
    '눈 덮인': '{room} 앞 눈밭에 발자국이 한 줄 나 있었는데, 돌아 나온 발자국은 없었다.',
    '바람 부는': '강한 바람에 {room} 창문이 열려 있었지만, 걸쇠는 안쪽에서 일부러 풀어 둔 것이었다.',
    '안개 낀': '짙은 안개 때문에 바깥 목격자는 없었다. 범인은 현장 구조를 잘 아는 사람이다.',
}

# ---- 동기 유형별 물증 (이름 없음) ----
MOTIVE_CLUES = {
    '비밀 은폐': [
        '피해자의 책상 서랍에서 누군가의 과거를 폭로하겠다는 내용의 편지 초안이 발견되었다.',
        '피해자가 최근 "곧 모든 걸 밝히겠다"고 말하고 다녔다는 증언이 나왔다.',
        '{room} 벽난로에서 반쯤 타다 만 장부 조각이 나왔다. 누군가 기록을 없애려 했다.',
        '피해자의 수첩 마지막 장이 찢겨 나가 있었다. 지워진 것은 누군가의 이름으로 보인다.',
    ],
    '치정 및 배신': [
        '{room} 쓰레기통에서 반으로 찢긴 연인 사진이 발견되었다.',
        '피해자의 외투 주머니에서 받는 사람 이름이 지워진 연애 편지가 나왔다.',
        '사건 전날 밤, {room}에서 누군가 울며 언성을 높이는 소리를 들었다는 증언이 있다.',
        '현장에 떨어진 반지 안쪽에 두 사람의 이니셜이 새겨져 있었다.',
    ],
    '질투와 시기': [
        '피해자가 받은 상패가 {room} 구석에서 금이 간 채 발견되었다.',
        '피해자의 성공을 다룬 신문 기사 스크랩에 누군가 붉은 펜으로 낙서를 해 두었다.',
        '"늘 그 사람만 주인공이었다"는 푸념을 자주 듣던 사람이 있다는 증언이 나왔다.',
        '피해자의 작업 노트 몇 장이 사라졌다. 누군가 그 성과를 탐냈던 것 같다.',
    ],
    '금전 및 재산 갈취': [
        '{room}의 금고가 열려 있었고, 장부의 마지막 몇 쪽이 뜯겨 나가 있었다.',
        '피해자 앞으로 온 빚 독촉장 사이에 다른 사람 이름의 차용증이 끼어 있었다.',
        '사건 전날 피해자가 거액의 유언장 내용을 바꾸려 했다는 이야기가 돌았다.',
        '현장에서 고급 회중시계 하나가 사라졌다. 단순한 좀도둑의 솜씨는 아니다.',
    ],
    '원한 및 복수': [
        '피해자의 서랍에서 십여 년 전 사고를 다룬 낡은 신문 기사가 발견되었다.',
        '{room} 벽에 오래된 단체 사진이 걸려 있었는데, 한 사람의 얼굴만 긁혀 있었다.',
        '피해자가 최근 "옛날 일은 다 잊었다"며 누군가에게 사과 편지를 보냈다고 한다.',
        '범인은 서두르지 않았다. 오랫동안 이날만을 준비해 온 사람의 솜씨다.',
    ],
}
# 광고 힌트 3번(사건의 내막)에 들어갈 동기 설명
MOTIVE_DESC = {
    '비밀 은폐': '피해자가 쥐고 있던 비밀이 세상에 드러나는 것을 막으려 했다',
    '치정 및 배신': '믿었던 사람에게 배신당한 마음을 끝내 다스리지 못했다',
    '질투와 시기': '피해자의 재능과 성공을 오랫동안 시기해 왔다',
    '금전 및 재산 갈취': '피해자의 돈과 재산을 손에 넣으려 했다',
    '원한 및 복수': '오래전 피해자에게 입은 상처를 갚으려 했다',
}

SCENE_CLUES = [
    '사건 발생 추정 시각은 밤 {hh}시 무렵으로 좁혀졌다.',
    '{room} 바닥에서 진흙 발자국이 발견되었다. 신발 크기로는 누구인지 가려낼 수 없다.',
    '{room}의 {obj}{josa_ga} 사라졌다. 현장 구조를 잘 아는 사람의 짓으로 보인다.',
    '누군가 {room} 열쇠를 미리 복사해 둔 흔적이 발견되었다.',
    '{witness}의 증언: "사건 직전 {room} 쪽에서 문 닫히는 소리를 들었어요."',
    '현장에 은은한 향수 냄새가 남아 있었다. 다만 여러 사람이 같은 향수를 쓴다.',
    '{room}의 시계가 {hh}시 {mm}분에 멈춰 있었다. 누군가 일부러 멈춘 것일까?',
    '{city} 경찰의 협조로 그날 밤 {spot} 출입 기록을 확보했다. 용의자 전원이 출입한 적이 있다.',
    '피해자는 사건 직전 누군가와 {room}에서 만나기로 약속했다는 메모를 남겼다.',
    '{room} 탁자 위 찻잔 두 개 중 하나에서 수면제 성분이 검출되었다.',
]
RED_HERRINGS = [
    '{name}({job}){josa_ga} 사건 직전 {room} 근처를 서성이는 모습이 목격되었다.',
    '{name}의 소지품에서 {room} 열쇠와 비슷한 열쇠가 나왔다.',
    '{name}({job}){josa_eun} 피해자와 최근 크게 다툰 적이 있다고 한다.',
    '{name}의 외투에 {room}에서 묻은 것과 비슷한 흙이 묻어 있었다.',
]
CULPRIT_CLUES = [
    '{name}({job})의 진술 중 사건 시각에 대한 부분이 앞뒤가 맞지 않는다.',
    '{name}{josa_ga} 사건 다음 날 아침 일찍 {room_eul} 혼자 정리했다는 이야기가 있다.',
    '{name}{josa_eun} 피해자와 아는 사이가 아니라고 했지만, 두 사람이 함께 찍힌 사진이 나왔다.',
    '{name}의 장갑 한 짝이 {room} 근처 화분 뒤에서 발견되었다.',
]
ALIBIS = [
    '{name}의 알리바이 확인: 사건 시각 {where}에서 {w_wa} 함께 있었다는 증언이 나왔다. {name}{josa_eun} 용의선상에서 제외된다.',
    '{job} {name}의 업무 기록을 확인한 결과, 사건 시각에는 {where}에서 일하고 있었다. {name}{josa_eun} 용의선상에서 제외된다.',
    '{spot} 입구 CCTV에 {name}{josa_ga} 사건 시각 {where}에 있는 모습이 찍혀 있었다. {name}{josa_eun} 용의선상에서 제외된다.',
    '{name}{josa_ga} 사건 시각에 건 전화 기록이 {where}에서 확인되었다. {name}{josa_eun} 용의선상에서 제외된다.',
    '{name}의 영수증 시각이 사건 시각과 정확히 겹친다. {where}에 있었으니 {name}{josa_eun} 용의선상에서 제외된다.',
    '{w_ga} "{name} 씨는 그때 {where}에서 저와 이야기하고 있었어요"라고 증언했다. {name}{josa_eun} 용의선상에서 제외된다.',
]
BIO_REASONS = [
    '피해자의 초대를 받아 그날 {spot}에 머물고 있었다.',
    '일 때문에 사건 당일 {spot}을 찾았다.',
    '피해자와 오랜 인연이 있어 자주 {spot}에 드나들었다.',
    '우연히 근처를 지나다 {spot}에 들렀다고 말한다.',
    '사건 전날부터 {city}에 와 있었다.',
    '피해자와 사업 이야기를 나누러 {spot}에 왔다.',
]
BIO_TRAITS = [
    '말수가 적고 늘 주변을 살핀다.', '사교적이라 누구와도 금방 친해진다.', '꼼꼼한 성격으로 메모를 즐긴다.',
    '감정이 얼굴에 잘 드러난다.', '늘 시간 약속을 철저히 지킨다.', '모두에게 친절하지만 속을 알 수 없다.',
    '피해자에 대해 말할 때 표정이 굳는다.', '질문에 대답하기 전 잠시 뜸을 들인다.', '유머 감각이 뛰어나다.',
    '자기 일에 대한 자부심이 강하다.',
]


def josa(word, with_b, without_b):
    return word + (with_b if sanitize.has_batchim(word[-1]) else without_b)


def parse_person(text):
    m = PERSON.match(text)
    if not m:
        raise ValueError(f'인물 형식 오류: {text!r}')
    name, age, gender, job = m.groups()
    job = JOB_FIX.get(job.strip(), job.strip())
    return dict(name=name.strip(), age=int(age), gender=gender, job=job)


def split_place(place):
    city, _, rest = place.partition('의 ')
    adj = next((a for a in ADJECTIVES if rest.startswith(a + ' ')), '')
    spot = rest[len(adj):].strip() if adj else rest
    return city.strip(), adj, spot


def load_rows(path):
    if path.lower().endswith('.xlsx'):
        import openpyxl
        ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        head = [str(h).strip() for h in rows[0]]
        return [dict(zip(head, [('' if v is None else str(v)) for v in r])) for r in rows[1:] if r[0]]
    with open(path, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def parse(row):
    no = int(re.sub(r'\D', '', row['에피소드']))
    culprit = parse_person(row['진범'])
    others = [parse_person(p) for p in re.split(r'\)\s*,\s*', row['용의자들'].strip()) if p.strip()]
    city, adj, spot = split_place(row['장소'].strip())
    return dict(no=no, title=row['제목'].strip(), continent=row['대륙'].strip(), place=row['장소'].strip(),
                city=city, adj=adj, spot=spot, culprit=culprit, others=others,
                motive_type=row['살해 동기'].strip(), confession=row['스토리(진범의 고백)'].strip())


def build_clues(ep, suspects, rng):
    """20개 단서. suspects: 표시 순서대로 [{id, name, job, culprit}]"""
    rooms, witnesses, objects = SPOTS.get(ep['spot'], DEFAULT_SPOT)
    culprit = next(s for s in suspects if s['culprit'])
    innocents = [s for s in suspects if not s['culprit']]
    rng.shuffle(innocents)                     # 소거 순서 (표시 순서와 다르게)
    k = len(innocents)
    # 소거 스테이지: 고르게 퍼뜨리고 마지막 무고한 사람은 반드시 20번
    clear_at = sorted({max(2, round(20 * (i + 1) / k)) for i in range(k)})
    while len(clear_at) < k:                   # 반올림 충돌 보정 (k ≤ 10이라 거의 없음)
        clear_at = sorted(set(clear_at) | {next(x for x in range(2, 20) if x not in clear_at)})
    clear_at[-1] = 20
    slots = {}
    for st, s in zip(clear_at, innocents):
        slots[st] = ('clear', s)
    free = [x for x in range(1, 21) if x not in slots]
    # 진범의 수상한 행적 2개 (전반·후반), 무고한 사람 헛다리 최대 3개 (그 사람이 소거되기 전)
    for target in (round(len(free) * 0.35), round(len(free) * 0.7)):
        st = free[min(target, len(free) - 1)]
        slots[st] = ('culprit', culprit)
        free.remove(st)
    herrings = 0
    for st, s in zip(clear_at, innocents):
        if herrings >= 3:
            break
        before = [x for x in free if x < st and x > 1]
        if before:
            pick = rng.choice(before)
            slots[pick] = ('herring', s)
            free.remove(pick)
            herrings += 1
    motive_pool = MOTIVE_CLUES.get(ep['motive_type'], sum(MOTIVE_CLUES.values(), []))[:]
    scene_pool = SCENE_CLUES[:]
    rng.shuffle(motive_pool)
    rng.shuffle(scene_pool)
    if ep['adj'] in WEATHER:
        scene_pool.insert(1, WEATHER[ep['adj']])
    fill = []
    while len(fill) < len(free):               # 동기 물증과 현장 묘사를 번갈아
        src = motive_pool if (len(fill) % 2 and motive_pool) or not scene_pool else scene_pool
        fill.append(src.pop(0))
    for st, text in zip(free, fill):
        slots[st] = ('scene', text)

    herring_tpl, culprit_tpl, alibi_tpl = RED_HERRINGS[:], CULPRIT_CLUES[:], ALIBIS[:]
    rng.shuffle(herring_tpl)
    rng.shuffle(culprit_tpl)
    rng.shuffle(alibi_tpl)
    elsewhere = [r for r in rooms] + [f'{ep["city"]} 시내', '근처 식당', '손님 휴게실']
    out = []
    for st in range(1, 21):
        kind, val = slots[st]
        room = rng.choice(rooms)
        v = dict(room=room, obj=rng.choice(objects), witness=rng.choice(witnesses), city=ep['city'], spot=ep['spot'],
                 hh=rng.choice([9, 10, 11]), mm=rng.choice(['05', '17', '40', '52']))
        v['josa_ga'] = '이' if sanitize.has_batchim(v['obj'][-1]) else '가'
        v['room_eul'] = josa(room, '을', '를')
        v['w_ga'] = josa(v['witness'], '이', '가')
        v['w_wa'] = josa(v['witness'], '과', '와')
        facts = []
        if kind == 'scene':
            text = val.format(**v)
        else:
            s = val
            v.update(name=s['name'], job=s['job'],
                     josa_ga='이' if sanitize.has_batchim(s['name'][-1]) else '가',
                     josa_eun='은' if sanitize.has_batchim(s['name'][-1]) else '는',
                     where=rng.choice([r for r in elsewhere if r != room]))
            if kind == 'clear':
                text = alibi_tpl[len([x for x in out if x['_kind'] == 'clear']) % len(alibi_tpl)].format(**v)
                facts = [{'type': 'clear', 'suspect': s['id']}]
            elif kind == 'herring':
                text = herring_tpl.pop(0).format(**v)
                facts = [{'type': 'suspect', 'suspect': s['id']}]
            else:
                text = culprit_tpl.pop(0).format(**v)
                facts = [{'type': 'suspect', 'suspect': s['id']}]
        out.append(dict(stage=st, text=text, facts=facts, _kind=kind))
    return out


def scene_texts(ep, rooms, witnesses, objects, rng):
    """용의자를 가리키지 않는 분위기 · 동기 단서 문장 (추리 단서 사이를 채움)"""
    pool = []
    for tpl in SCENE_CLUES + MOTIVE_CLUES.get(ep['motive_type'], []) + ([WEATHER[ep['adj']]] if ep['adj'] in WEATHER else []):
        obj = rng.choice(objects)
        pool.append(fix_josa(tpl.format(room=rng.choice(rooms), obj=obj, witness=rng.choice(witnesses), city=ep['city'],
                                        spot=ep['spot'], hh=rng.choice([9, 10, 11]), mm=rng.choice(['05', '17', '40', '52']),
                                        josa_ga='이' if sanitize.has_batchim(obj[-1]) else '가')))
    return pool


def convert(ep, seen_titles, stats):
    no = ep['no']
    rng = random.Random(no * 7919 + 13)
    region = CONTINENT_EN.get(ep['continent'])
    people = [dict(p, culprit=True) for p in [ep['culprit']]] + [dict(p, culprit=False) for p in ep['others']]
    # 표시 순서: 에피소드 고정 시드로 섞기 (원본은 진범이 따로 적혀 있음)
    rng.shuffle(people)
    for i, p in enumerate(people, start=1):
        p['id'] = f'S{no:03d}-{i:02d}'
        p['job'] = sanitize.sanitize_to_cozy_tone(p['job'])

    def cozy(text):
        out = fix_josa(cozy_rules.cozy(sanitize.sanitize_to_cozy_tone(text)))   # 낱말 순화 → 문장 단위 코지 톤
        if out != text:
            stats['sanitized'] += 1
        return out

    title = sanitize.deduplicate_title(cozy_rules.rewrite_words(ep['title']), no, ep['city'], seen_titles)
    if title != ep['title']:
        stats['titles'] += 1
    rooms, witnesses, objects = SPOTS.get(ep['spot'], DEFAULT_SPOT)
    scene_pool = scene_texts(ep, rooms, witnesses, objects, rng)
    clues = deduction_clues.build(people, rooms, witnesses, objects, scene_pool, rng)
    scene_text = f"{ep['title']} {ep['place']}"
    # 에피소드 전용 배경 (game_assets/background → tools/build_episode_backgrounds.py 압축본) → 없으면 도시별 공용 배경
    own_bg = f'game_assets/episodes/ep_bg/ep{no:03d}.jpg'
    own_thumb = f'game_assets/episodes/ep_thumb/ep{no:03d}.jpg'
    has_own = os.path.exists(os.path.join(ROOT_DIR, own_bg))
    background = own_bg if has_own else episode_art.bg_for_city(no, ep['city'], scene_text)
    if has_own:
        stats['own_bg'] += 1
    # 초상화: 용의자 전용 그림 (game_assets/characters/<ID>.jpg → tools/build_character_portraits.py 압축본)
    #   → 없으면 공용 그림 풀에서 대륙 · 직업 · 성별로 배정
    pooled = episode_art.assign_portraits(region, people)
    portraits = []
    for p, fallback in zip(people, pooled):
        own = f"game_assets/episodes/portraits/{p['id']}.jpg"
        portraits.append(own if os.path.exists(os.path.join(ROOT_DIR, own)) else fallback)
        stats['own_portrait'] += own == portraits[-1]

    suspects = []
    for p, portrait in zip(people, portraits):
        # 고르는 순서(rng)는 예전과 같게: 이유 6개 · 성격 10개 중 번호만 뽑고, 문장은 공간에 맞는 틀로 (tools/episode_text.py)
        r = BIO_REASONS.index(rng.choice(BIO_REASONS))
        t = BIO_TRAITS.index(rng.choice(BIO_TRAITS))
        bio = episode_text.bio_text(ep['spot'], r, t, 'ko', ep['spot'], ep['city'])
        bio = fix_josa(re.sub(r'(\S+)을 찾았다', lambda m: josa(m.group(1), '을', '를') + ' 찾았다', bio))
        suspects.append(dict(
            id=p['id'], name=p['name'], age=p['age'], gender=p['gender'], job=p['job'], bio=bio, bioKey=[r, t],   # bioKey: 번역용 틀 번호
            trait=f"{p['gender']} · {p['age']}세. {bio}",
            attrs=p['attrs'],                      # 프로필로 이미 알려진 속성 (성별 · 나이대) — 추리 대조용
            emoji=emoji_for(p['job']), color=color_for(p['id']), portrait=portrait,
        ))
    culprit = next(p for p in people if p['culprit'])
    motive_desc = cozy_rules.MOTIVE_DESC.get(ep['motive_type']) or MOTIVE_DESC.get(ep['motive_type'], ep['motive_type'])
    motive_label = cozy_rules.MOTIVE_LABEL.get(ep['motive_type'], ep['motive_type'])   # 화면 표시용 (원한 및 복수 → 해묵은 앙금)
    hints = sanitize.generate_smart_ad_hints(
        [dict(name=p['name'], job=p['job'], age=p['age'], gender=p['gender'], culprit=p['culprit']) for p in people],
        motive_desc)
    confession = CONFESSIONS[no] if no in CONFESSIONS else cozy(ep['confession'])
    return dict(
        episodeId=f'ep{no:03d}',
        no=no,
        title=title,
        subtitle=f"{ep['continent']} · {ep['place']}",
        intro=fix_josa(f"{ep['place']}에서 한밤중에 기묘한 사건이 벌어졌다. "
                       f"그날 현장에 있던 용의자는 {len(people)}명. 단서 20개를 모아 진범을 가려내자."),
        continent=ep['continent'], region=region, city=ep['city'], place=ep['place'], country=ep['city'],
        motiveType=motive_label,
        background=background,
        thumb=own_thumb if has_own else background,
        attributes=deduction_clues.ATTRIBUTES,
        actualCulpritId=culprit['id'],
        actualCulpritIds=[culprit['id']],
        suspects=suspects,
        clues=[dict(stage=c['stage'], text=fix_josa(c['text']), prop=episode_art.clue_prop_for(c['text']), facts=c['facts'])
               for c in clues],
        hints=[dict(text=h, eliminate=[]) for h in hints],
        confession=confession,
        rewards=dict(gold=1000, undo=1, wild=1),   # 에피소드 해결 보상 (completeCurrentEpisode 기본값과 같음)
        solutionText=f"진범은 {culprit['job']} {culprit['name']}. 동기는 {motive_label} — {motive_desc}.",
    )


def apply_logic(ep, logic, stats):
    """논리 그리드 단서 (tools/logic_gen.py 가 만든 JSON): 단서 1~20 · 단서 21(광고 마스터키) · 그리드 축 · 용의자 6명
    용의자는 퍼즐에 나오는 6명만 남긴다. 그리드 줄 순서 = JSON '용의자' 순서 (진범 자리는 1~6번째 무작위).
    풀이 검증 (같은 풀이기): 단서 1~20 을 만족하는 배치가 하나뿐 · 범인 = 진범 · 단서 19개까지 범인 후보 2명 이상."""
    names, places, items = logic['용의자'], logic['그리드 장소'], logic['그리드 물건']
    n_sols, culprits, trail = logic_gen.verify(logic)
    if n_sols != 1 or culprits != {logic['진범']} or min(trail) < 2:
        raise SystemExit(f"Ep.{ep['no']}: 논리 단서 검증 실패 — 해 {n_sols}개 · 범인 {culprits} · 후보 {trail}")
    by_name = {s['name']: s for s in ep['suspects']}
    missing = [n for n in names if n not in by_name]
    if missing:
        raise SystemExit(f"Ep.{ep['no']}: 퍼즐 용의자가 에피소드 데이터에 없음 {missing}")
    suspects = [s for s in ep['suspects'] if s['name'] in names]      # 수사 보드 표시 순서는 그대로
    stats['dropped_suspects'] += len(ep['suspects']) - len(suspects)
    if by_name[logic['진범']]['id'] != ep['actualCulpritId']:
        raise SystemExit(f"Ep.{ep['no']}: 진범 불일치 {logic['진범']}")
    cozy = sanitize.sanitize_to_cozy_tone
    places = [cozy(x) for x in places]
    items = [cozy(x) for x in items]
    words = names + places + items + [w.split('(')[0] for w in places + items]
    def mentioned_in(text):
        # 긴 이름부터 지워 가며 찾는다: '히나타'를 지운 뒤 '히나'를 찾아야 '히나'가 엉뚱하게 걸리지 않는다.
        # 이름 바로 앞이 한글이면(하루카+나 → '카나') 다른 낱말의 일부이므로 제외
        found, t = [], text
        for s in sorted(suspects, key=lambda s: -len(s['name'])):
            idx, hit = 0, False
            while (idx := t.find(s['name'], idx)) >= 0:
                if idx == 0 or not ('가' <= text[idx - 1] <= '힣'):     # 경계는 원문 기준 (가린 자리 뒤는 경계가 아님)
                    hit = True
                    t = t[:idx] + '\u2400' * len(s['name']) + t[idx + len(s['name']):]
                idx += len(s['name'])
            if hit:
                found.append(s)
        return [s for s in suspects if s in found]
    clues = []
    for i in range(1, 21):
        raw = logic[f'단서 {i}'].strip()
        text = logic_clues.fix_josa(cozy(raw), words)
        stats['josa_fixed'] += text != raw
        mentioned = mentioned_in(text)
        clues.append(dict(stage=i, text=text, prop=episode_art.clue_prop_for(text),
                          facts=[{'type': 'suspect', 'suspect': s['id']} for s in mentioned]))
    hint = logic_clues.fix_josa(cozy(logic[logic_gen.HINT_KEY].strip()), words)
    stats['tier_' + logic['난이도']] += 1
    ep.update(
        suspects=suspects,
        clues=clues,
        hints=[dict(text=hint, eliminate=[], master=True)],       # 단서 21 (광고 / 마스터키)
        logic=dict(places=places, items=items, killer=logic['진범'], difficulty=logic['난이도'],
                   suspects=[by_name[n]['id'] for n in names],
                   # 정답 (칸 확인 — 힌트권/광고로 ✕·○ 하나를 검증): { 용의자ID: { p: 장소 번호, i: 물건 번호 } }
                   answer={by_name[n]['id']: dict(p=logic['그리드 장소'].index(a['장소']), i=logic['그리드 물건'].index(a['물건']))
                           for n, a in logic['정답'].items()}),
        # 첫 문장은 동기별 3가지 (에피소드 번호로 고정), 뒤는 규칙 안내 — tools/episode_text.py
        intro=logic_clues.fix_josa(episode_text.intro_text(ep['motiveType'], ep['no'], 'ko', ep['place'], len(suspects)), words),
    )
    ep.pop('attributes', None)
    for s in ep['suspects']:
        s.pop('attrs', None)
    return ep


def validate(eps):
    problems = []
    by_cont = {}
    for e in eps:
        by_cont.setdefault(e['continent'], []).append(e['no'])
    for cont, (a, b) in EXPECTED_RANGES.items():
        got = by_cont.get(cont, [])
        if got and (min(got), max(got)) != (a, b):
            problems.append(f'{cont}: {min(got)}~{max(got)}화 (예상 {a}~{b})')
    for e in eps:
        if len(e['suspects']) > 10:
            problems.append(f"Ep.{e['no']}: 용의자 {len(e['suspects'])}명 (수사 보드 최대 10)")
        if not e['background']:
            problems.append(f"Ep.{e['no']}: 배경 없음 ({e['city']})")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='?', default=DEFAULT_SRC)
    ap.add_argument('--from', dest='start', type=int, default=1)
    ap.add_argument('--to', dest='end', type=int, default=300)
    ap.add_argument('--out', default=ROOT_OUT)
    args = ap.parse_args()

    rows = sorted((parse(r) for r in load_rows(args.src)), key=lambda e: e['no'])
    rows = [e for e in rows if args.start <= e['no'] <= args.end]
    stats = Counter()
    seen = set()
    eps = [convert(e, seen, stats) for e in rows]
    # 논리 그리드 단서 JSON 이 있으면 그 단서로 교체 (없으면 tools/deduction_clues.py 의 자동 단서)
    if os.path.exists(LOGIC_SRC):
        logic = {int(x['에피소드']): x for x in json.load(open(LOGIC_SRC, encoding='utf-8'))}
        eps = [apply_logic(e, logic[e['no']], stats) if e['no'] in logic else e for e in eps]
        print('난이도: ' + ' · '.join(f"{k[5:]} {v}화" for k, v in sorted(stats.items()) if k.startswith('tier_')))
        print(f"논리 그리드 단서: {sum(1 for e in eps if 'logic' in e)}화 (모두 해 1개 · 범인 = 진범 · 단서 19개까지 후보 2명+ 검증) · "
              f"조사 교정 {stats['josa_fixed']}문장 · 퍼즐 밖 용의자 {stats['dropped_suspects']}명 제외")

    chapters = []
    for ko, en, _ in CONTINENTS:
        nos = [e['no'] for e in eps if e['continent'] == ko]
        if nos:
            chapters.append(dict(continent=ko, region=en, from_=min(nos), to=max(nos)))
    chapters = [{('from' if k == 'from_' else k): v for k, v in c.items()} for c in chapters]

    body = ',\n'.join('    ' + json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in eps)
    js = ("// 자동 생성 파일 — 직접 고치지 말고 tools/import_episodes_v6.py 로 다시 만들 것\n"
          f"// 원본: data/TriPeaks_300_Episodes_V6_Sorted.csv · 에피소드 {args.start}~{args.end} (한 줄 = 에피소드 하나)\n"
          "// 구조 설명은 js/data/episodes.schema.md 참고\n"
          "(function () {\n"
          "  const TP = (globalThis.TP ??= {});\n"
          "  // 스토리 진행 순서 = 대륙 순서 (대륙이 바뀌는 에피소드에서 챕터 전환 연출)\n"
          f"  TP.EPISODE_CHAPTERS = {json.dumps(chapters, ensure_ascii=False)};\n"
          f"  TP.EPISODES = [\n{body}\n  ];\n"
          "  TP.EPISODE_ROADMAP = [];\n"
          "})();\n")
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)

    print(f"→ {args.out}: 에피소드 {len(eps)}개 ({os.path.getsize(args.out) / 1e6:.2f}MB), "
          f"용의자 {sum(len(e['suspects']) for e in eps)}명, 단서 {sum(len(e['clues']) for e in eps)}개")
    print('챕터:', ' → '.join(f"{c['continent']}({c['from']}~{c['to']})" for c in chapters))
    print(f"순화된 고백 문장 {stats['sanitized']}개 · 바뀐 제목 {stats['titles']}개")
    print(f"에피소드 전용 배경: {stats['own_bg']}개 (나머지는 도시별 공용 배경)")
    print(f"용의자 전용 초상화: {stats['own_portrait']}명")
    print('초상화 없음:', sum(1 for e in eps for s in e['suspects'] if not s['portrait']))
    for p in validate(eps):
        print('  ⚠', p)


if __name__ == '__main__':
    main()
