"""
논리 그리드 단서 생성기 v2 (아인슈타인 퍼즐 방식) — data/V6_300_Episodes_Logic_Clues.json 을 새로 만든다

    python tools/logic_gen.py                 # 300화 전부 생성 → data/V6_300_Episodes_Logic_Clues.json
    python tools/logic_gen.py --from 1 --to 5 --print   # 일부만 만들어 단서를 화면에 출력 (파일은 그대로)

예전 데이터(사람이 쓴 20문장 틀)의 문제
  - 300화 모두 1번 단서가 "A와 B 중 한 명은 P1에, 다른 한 명은 P2에" — 문장 구조와 순서가 늘 같았다
  - 용의자 목록의 6번째가 늘 진범이었다 (그리드 맨 아랫줄 = 범인)
  - 단서 7~8개면 범인이 보였다

새 방식
  1) 정답을 먼저 만든다: 용의자 6 × 장소 6 × 물건 6 무작위 배치. 진범(V6 원본의 진범)은 용의자 목록 1~6번째 중 무작위 자리.
     규칙: 사건 현장(장소 6번째 칸)에 있던 사람이 범행 도구(물건 6번째 칸)를 가지고 있었고, 그 사람이 범인이다.
  2) 정답에서 참인 단서를 26가지 유형 · 유형마다 여러 문장으로 뽑는다. 단서를 하나 고를 때마다 풀이기(solver)로
     '남은 가능한 배치 수'와 '범인 후보 수'를 다시 센다.
       - 단서 1~10  : 직접 소거(✕) 위주 — 그리드를 채우는 재미
       - 단서 11~19 : 두 조건을 엮어야 하는 복합 단서 (만약 ~라면, 둘 중 하나, 옆방, 앞쪽 …)
       - 단서 19까지: 범인 후보가 반드시 2명 이상 남는다 (19번째 뒤에는 정확히 2명)
       - 단서 20    : 그리드 전체가 하나로 정해지고 범인도 1명이 된다
       - 단서 21    : 광고 마스터키 — 남은 후보 2명 중 한 명의 알리바이가 진짜이고, 다른 한 명의 진술이 거짓이라는 모순을 짚는다
                     ("범인은 누구"라고 말하지 않는다. 유저가 직접 ○를 친다)
  3) 난이도 3단계 (에피소드 1~100 · 101~200 · 201~300) — 아래 TIERS 참고. 1단계도 단서 19개까지는 범인을 못 고른다.

장소는 그리드 왼쪽부터 복도를 따라 한 줄로 늘어서 있다 (옆방 = 그리드에서 이웃한 칸, 앞쪽 = 왼쪽).
결과 JSON 은 문장과 함께 기계가 읽는 단서 구조(단서 구조)를 담고, 변환기(tools/import_episodes_v6.py)가 같은 풀이기로 다시 검증한다.
"""
import argparse
import itertools
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

N = 6
CRIME = 5          # 장소 · 물건 6번째 칸 = 사건 현장 · 범행 도구
PERMS = list(itertools.permutations(range(N)))
HINT_KEY = '단서 21 (광고/마스터키)'
OUT = os.path.join(ROOT, 'data', 'V6_300_Episodes_Logic_Clues.json')

# ---------------------------------------------------------------------------
# 난이도 3단계
#   floors   : 단서 k개를 본 뒤 범인 후보가 최소 몇 명 남아야 하는가 [(k까지, 최소 후보)]
#   early    : 단서 1~10 에 쓰는 유형 (뒤로 갈수록 직접 정보가 적다)
#   mid      : 단서 11~19 에 쓰는 유형
#   curve    : 남은 배치 수(로그)를 줄이는 곡선. <1 이면 앞 단서가 많이 줄이고(쉬움), >1 이면 뒤 단서로 미룬다(어려움)
# ---------------------------------------------------------------------------
EARLY_BASE = ['NOT_PLACE', 'NOT_ITEM', 'PLACE_NOT_ITEM', 'NOT_PLACES', 'NOT_ITEMS', 'NOT_HOLDERS', 'NOT_AT']
MID_BASE = ['OR_PLACE', 'OR_HOLDER', 'OR_AT', 'XOR', 'IF_THEN', 'IFF', 'NEIGHBOR', 'NOT_NEIGHBOR']
TIERS = {
    1: dict(name='1단계 · 견습 탐정', floors=[(19, 2)], curve=0.8,
            early=EARLY_BASE + ['IS_PLACE', 'IS_ITEM', 'ITEM_AT_PLACE'],
            mid=MID_BASE + ['ITEM_AT_PLACE', 'NOT_PLACES', 'NOT_ITEMS']),
    2: dict(name='2단계 · 정식 탐정', floors=[(12, 3), (19, 2)], curve=1.0,
            early=EARLY_BASE + ['ITEM_AT_PLACE'],
            mid=MID_BASE + ['LEFT_OF', 'ITEM_NEIGHBOR', 'HOLDER_NEAR_PLACE']),
    3: dict(name='3단계 · 명탐정', floors=[(12, 4), (16, 3), (19, 2)], curve=1.35,
            early=EARLY_BASE,
            mid=MID_BASE + ['LEFT_OF', 'ITEM_NEIGHBOR', 'HOLDER_NEAR_PLACE', 'IF_THEN_X', 'ITEM_LEFT_OF']),
}


def tier_of(no):
    return 1 if no <= 100 else 2 if no <= 200 else 3


# ---------------------------------------------------------------------------
# 단서 = (유형, 인자들). 인자: 용의자 s* · 장소 p* · 물건 i* (모두 0~5 번호)
#   kind: 'P' 장소만 · 'I' 물건만 · 'M' 둘 다 — 풀이기가 장소 배치 · 물건 배치를 따로 거를 수 있게
# ---------------------------------------------------------------------------
def holder(it, i):
    return it.index(i)


def check(c, pl=None, it=None):
    t, a = c['t'], c
    if t == 'NOT_PLACE': return pl[a['s']] != a['p']
    if t == 'IS_PLACE': return pl[a['s']] == a['p']
    if t == 'NOT_PLACES': return pl[a['s']] not in (a['p'], a['p2'])
    if t == 'OR_PLACE': return pl[a['s']] in (a['p'], a['p2'])
    if t == 'NOT_AT': return pl[a['s']] != a['p'] and pl[a['s2']] != a['p']
    if t == 'OR_AT': return pl[a['s']] == a['p'] or pl[a['s2']] == a['p']
    if t == 'NEIGHBOR': return abs(pl[a['s']] - pl[a['s2']]) == 1
    if t == 'NOT_NEIGHBOR': return abs(pl[a['s']] - pl[a['s2']]) != 1
    if t == 'LEFT_OF': return pl[a['s']] < pl[a['s2']]
    if t == 'NOT_ITEM': return it[a['s']] != a['i']
    if t == 'IS_ITEM': return it[a['s']] == a['i']
    if t == 'NOT_ITEMS': return it[a['s']] not in (a['i'], a['i2'])
    if t == 'NOT_HOLDERS': return it[a['s']] != a['i'] and it[a['s2']] != a['i']
    if t == 'OR_HOLDER': return it[a['s']] == a['i'] or it[a['s2']] == a['i']
    if t == 'PLACE_NOT_ITEM': return pl[holder(it, a['i'])] != a['p']
    if t == 'ITEM_AT_PLACE': return pl[holder(it, a['i'])] == a['p']
    if t == 'XOR': return (pl[a['s']] == a['p']) != (it[a['s']] == a['i'])
    if t == 'IFF': return (pl[a['s']] == a['p']) == (it[a['s']] == a['i'])
    if t == 'IF_THEN': return pl[a['s']] != a['p'] or it[a['s']] == a['i']
    if t == 'IF_THEN_X': return pl[a['s']] != a['p'] or it[a['s2']] == a['i']
    if t == 'ITEM_NEIGHBOR': return abs(pl[holder(it, a['i'])] - pl[holder(it, a['i2'])]) == 1
    if t == 'ITEM_LEFT_OF': return pl[holder(it, a['i'])] < pl[holder(it, a['i2'])]
    if t == 'HOLDER_NEAR_PLACE': return abs(pl[holder(it, a['i'])] - a['p']) == 1
    raise ValueError(t)


KIND = {
    **{t: 'P' for t in ['NOT_PLACE', 'IS_PLACE', 'NOT_PLACES', 'OR_PLACE', 'NOT_AT', 'OR_AT', 'NEIGHBOR', 'NOT_NEIGHBOR', 'LEFT_OF']},
    **{t: 'I' for t in ['NOT_ITEM', 'IS_ITEM', 'NOT_ITEMS', 'NOT_HOLDERS', 'OR_HOLDER']},
    **{t: 'M' for t in ['PLACE_NOT_ITEM', 'ITEM_AT_PLACE', 'XOR', 'IFF', 'IF_THEN', 'IF_THEN_X', 'ITEM_NEIGHBOR',
                        'ITEM_LEFT_OF', 'HOLDER_NEAR_PLACE']},
}


def ok(c, pl, it):
    k = KIND[c['t']]
    return check(c, pl=pl) if k == 'P' else check(c, it=it) if k == 'I' else check(c, pl, it)


# ---------------------------------------------------------------------------
# 풀이기: 가능한 (장소 배치, 물건 배치) 전부. 규칙: 사건 현장에 있는 사람 = 범행 도구를 가진 사람
#   단서가 장소만/물건만 다루는 동안에는 두 목록을 따로 거르고, 섞인 단서가 오면 짝 목록으로 바꾼다.
# ---------------------------------------------------------------------------
class State:
    def __init__(self, P=None, I=None, pairs=None):
        self.P = P if P is not None else PERMS
        self.I = I if I is not None else PERMS
        self.pairs = pairs

    @staticmethod
    def _k(perm):
        return perm.index(CRIME)

    def count(self):
        if self.pairs is not None:
            return len(self.pairs)
        cI = [0] * N
        for it in self.I:
            cI[self._k(it)] += 1
        return sum(cI[self._k(pl)] for pl in self.P)

    def killers(self):
        if self.pairs is not None:
            return {self._k(pl) for pl, _ in self.pairs}
        return {self._k(pl) for pl in self.P} & {self._k(it) for it in self.I}

    def to_pairs(self):
        if self.pairs is not None:
            return self.pairs
        by = {}
        for it in self.I:
            by.setdefault(self._k(it), []).append(it)
        return [(pl, it) for pl in self.P for it in by.get(self._k(pl), [])]

    def apply(self, c, limit=None):
        """단서를 더한 새 상태. limit: 짝 목록으로 바꿔야 하는데 너무 크면 None"""
        k = KIND[c['t']]
        if self.pairs is not None:
            return State(pairs=[(pl, it) for pl, it in self.pairs if ok(c, pl, it)])
        if k == 'P':
            return State(P=[pl for pl in self.P if check(c, pl=pl)], I=self.I)
        if k == 'I':
            return State(P=self.P, I=[it for it in self.I if check(c, it=it)])
        if limit is not None and self.count() > limit:
            return None
        return State(pairs=[(pl, it) for pl, it in self.to_pairs() if check(c, pl, it)])


def solve(clues):
    st = State()
    for c in sorted(clues, key=lambda c: KIND[c['t']] == 'M'):     # 장소만 · 물건만 단서를 먼저 걸러 빠르게
        st = st.apply(c)
    return st.to_pairs()


# ---------------------------------------------------------------------------
# 정답에서 참인 단서 하나 뽑기 (유형별)
# ---------------------------------------------------------------------------
def make_clue(t, pl, it, rng):
    S = range(N)
    s = rng.randrange(N)
    others = [x for x in S if x != s]
    s2 = rng.choice(others)
    hold = {it[x]: x for x in S}
    at = {pl[x]: x for x in S}
    wrong_p = [p for p in S if p != pl[s]]
    wrong_i = [i for i in S if i != it[s]]
    if t == 'NOT_PLACE': return dict(t=t, s=s, p=rng.choice(wrong_p))
    if t == 'IS_PLACE': return dict(t=t, s=s, p=pl[s])
    if t == 'NOT_PLACES':
        p, p2 = rng.sample(wrong_p, 2); return dict(t=t, s=s, p=p, p2=p2)
    if t == 'OR_PLACE':
        p2 = rng.choice(wrong_p); a, b = rng.sample([pl[s], p2], 2); return dict(t=t, s=s, p=a, p2=b)
    if t == 'NOT_AT':
        p = rng.choice([p for p in S if p not in (pl[s], pl[s2])]); return dict(t=t, s=s, s2=s2, p=p)
    if t == 'OR_AT':
        a, b = rng.sample([s, s2], 2); return dict(t=t, s=a, s2=b, p=pl[s])
    if t == 'NEIGHBOR':
        n = [x for x in S if abs(pl[x] - pl[s]) == 1]; return dict(t=t, s=s, s2=rng.choice(n))
    if t == 'NOT_NEIGHBOR':
        n = [x for x in others if abs(pl[x] - pl[s]) != 1]; return dict(t=t, s=s, s2=rng.choice(n)) if n else None
    if t == 'LEFT_OF':
        a, b = sorted([s, s2], key=lambda x: pl[x]); return dict(t=t, s=a, s2=b)
    if t == 'NOT_ITEM': return dict(t=t, s=s, i=rng.choice(wrong_i))
    if t == 'IS_ITEM': return dict(t=t, s=s, i=it[s])
    if t == 'NOT_ITEMS':
        i, i2 = rng.sample(wrong_i, 2); return dict(t=t, s=s, i=i, i2=i2)
    if t == 'NOT_HOLDERS':
        i = rng.choice([i for i in S if i not in (it[s], it[s2])]); return dict(t=t, s=s, s2=s2, i=i)
    if t == 'OR_HOLDER':
        a, b = rng.sample([s, s2], 2); return dict(t=t, s=a, s2=b, i=it[s])
    if t == 'PLACE_NOT_ITEM':
        i = rng.randrange(N); p = rng.choice([p for p in S if p != pl[hold[i]]]); return dict(t=t, p=p, i=i)
    if t == 'ITEM_AT_PLACE':
        i = rng.randrange(N); return dict(t=t, i=i, p=pl[hold[i]])
    if t == 'XOR':
        if rng.random() < 0.5: return dict(t=t, s=s, p=pl[s], i=rng.choice(wrong_i))
        return dict(t=t, s=s, p=rng.choice(wrong_p), i=it[s])
    if t == 'IFF':
        if rng.random() < 0.4: return dict(t=t, s=s, p=pl[s], i=it[s])
        return dict(t=t, s=s, p=rng.choice(wrong_p), i=rng.choice(wrong_i))
    if t == 'IF_THEN':        # 거짓 전제(p가 틀림) 또는 참 결론 — 어느 쪽이든 참
        if rng.random() < 0.5: return dict(t=t, s=s, p=rng.choice(wrong_p), i=rng.randrange(N))
        return dict(t=t, s=s, p=rng.randrange(N), i=it[s])
    if t == 'IF_THEN_X':
        if rng.random() < 0.5: return dict(t=t, s=s, p=rng.choice(wrong_p), s2=s2, i=rng.randrange(N))
        return dict(t=t, s=s, p=rng.randrange(N), s2=s2, i=it[s2])
    if t == 'ITEM_NEIGHBOR':
        i = rng.randrange(N); n = [x for x in S if abs(pl[x] - pl[hold[i]]) == 1]
        return dict(t=t, i=i, i2=it[rng.choice(n)])
    if t == 'ITEM_LEFT_OF':
        i, i2 = rng.sample(list(S), 2)
        if pl[hold[i]] > pl[hold[i2]]: i, i2 = i2, i
        return dict(t=t, i=i, i2=i2)
    if t == 'HOLDER_NEAR_PLACE':
        i = rng.randrange(N); n = [p for p in S if abs(p - pl[hold[i]]) == 1]; return dict(t=t, i=i, p=rng.choice(n))
    raise ValueError(t)


# ---------------------------------------------------------------------------
# 문장 (유형마다 여러 표현 · 조사는 받침에 맞게)
# ---------------------------------------------------------------------------
def last_hangul(w):
    base = w.split('(')[0]
    return next((c for c in reversed(base) if '가' <= c <= '힣'), None)


def batchim(w):
    c = last_hangul(w)
    return c is not None and (ord(c) - 0xAC00) % 28 != 0


def rieul(w):
    c = last_hangul(w)
    return c is not None and (ord(c) - 0xAC00) % 28 == 8


def J(w, kind):
    b = batchim(w)
    return w + {
        '이': '이' if b else '가', '은': '은' if b else '는', '을': '을' if b else '를', '과': '과' if b else '와',
        '이나': '이나' if b else '나', '이다': '이다' if b else '다', '이었': '이었' if b else '였',
        '로': '으로' if b and not rieul(w) else '로', '아': '아' if b else '야',
    }[kind]


def text_of(c, names, places, items, n=0):
    """단서 구조 → 문장. 장소 · 물건은 괄호 설명을 뺀 이름으로 (그리드 칸 머리는 '금고실(사건현장)')"""
    seed = random.Random(json.dumps(c, sort_keys=True)).randrange(97)
    S = lambda k='s': names[c[k]]
    P = lambda k='p': places[c[k]].split('(')[0]
    I = lambda k='i': items[c[k]].split('(')[0]
    crime = places[CRIME].split('(')[0]
    t = c['t']
    pick = lambda opts: opts[(seed + n) % len(opts)]
    if t == 'NOT_PLACE':
        return pick([
            f"그 시각 {J(S(), '은')} {P()}에 있지 않았다.",
            f"{P()}의 출입 기록에 {S()}의 이름은 없었다.",
            f"{P()}에 남은 발자국은 {S()}의 신발과 맞지 않았다.",
            f"여러 사람이 '{J(S(), '은')} {P()}에 발을 들인 적도 없다'고 증언했다.",   # '근처에도'는 옆방 뜻으로 읽힐 수 있어 바꿈
        ])
    if t == 'IS_PLACE':
        return pick([
            f"복도 CCTV에 {J(S(), '이')} {P()}에 들어가는 모습이 찍혀 있었다.",
            f"{J(S(), '은')} 사건 내내 {P()}에 머물렀다는 것이 확인되었다.",
        ])
    if t == 'NOT_PLACES':
        return pick([
            f"{J(S(), '은')} {P()}에도, {P('p2')}에도 가지 않았다.",
            f"{S()}의 동선을 따라가 보니 {J(P(), '과')} {P('p2')}에는 들르지 않았다.",
            f"{J(P(), '과')} {P('p2')} 어느 쪽에서도 {J(S(), '을')} 본 사람은 없었다.",
        ])
    if t == 'OR_PLACE':
        return pick([
            f"{J(S(), '은')} {J(P(), '이나')} {P('p2')} 둘 중 한 곳에 있었다.",
            f"목격자의 기억이 흐릿하다. {J(S(), '을')} 본 곳은 {J(P(), '이나')} {P('p2')} 중 하나였다고 한다.",
        ])
    if t == 'NOT_AT':
        return pick([
            f"{P()}에 있던 사람은 {S()}도 {S('s2')}도 아니다.",
            f"{J(S(), '과')} {J(S('s2'), '은')} 둘 다 {P()}에 가지 않았다.",
            f"{P()}의 방명록에는 {J(S(), '과')} {S('s2')}의 이름이 없었다.",
        ])
    if t == 'OR_AT':
        return pick([
            f"{P()}에 있던 사람은 {J(S(), '이나')} {J(S('s2'), '이다')}.",
            f"{P()}에서 들린 목소리는 {J(S(), '이나')} {S('s2')} 둘 중 한 명의 것이었다.",
            f"{P()}에 있던 사람을 두고 {J(S(), '과')} {J(S('s2'), '이')} 서로를 가리켰다. 둘 중 한 명이 맞다.",
        ])
    if t == 'NEIGHBOR':
        return pick([
            f"{J(S(), '과')} {S('s2')}의 자리는 복도에서 바로 옆방이었다.",
            f"{J(S(), '은')} 벽 너머 옆방에서 {S('s2')}의 기침 소리를 들었다.",
            f"{J(S(), '은')} 창문 너머 바로 옆방에서 {J(S('s2'), '이')} 움직이는 것을 보았다.",
        ])
    if t == 'NOT_NEIGHBOR':
        return pick([
            f"{J(S(), '과')} {S('s2')}의 방은 서로 붙어 있지 않았다.",
            f"{J(S(), '은')} {S('s2')}의 목소리를 전혀 듣지 못했다. 둘은 옆방이 아니었다.",
        ])
    if t == 'LEFT_OF':
        return pick([
            f"복도 순서로 보면 {S()}의 방이 {S('s2')}의 방보다 앞쪽에 있었다.",
            f"{J(S(), '은')} {S('s2')}보다 현관에 가까운 쪽 방에 있었다.",
            f"현관에서 들어온 {J(S('s2'), '은')} {S()}의 방 앞을 지나 더 안쪽에 있는 자기 방으로 갔다.",
        ])
    if t == 'NOT_ITEM':
        return pick([
            f"{I()}에서 {S()}의 지문은 나오지 않았다.",
            f"{J(S(), '은')} {J(I(), '을')} 한 번도 만진 적이 없다.",
            f"{S()}의 가방에서는 {J(I(), '이')} 나오지 않았다.",
        ])
    if t == 'IS_ITEM':
        return pick([
            f"{S()}의 소지품에서 {J(I(), '이')} 발견되었다.",
            f"{I()}의 주인은 {J(S(), '이었')}다.",
        ])
    if t == 'NOT_ITEMS':
        return pick([
            f"{J(S(), '은')} {J(I(), '과')} {I('i2')} 중 어느 것도 가지고 있지 않았다.",
            f"{S()}의 주머니를 뒤져 봤지만 {I()}도 {I('i2')}도 없었다.",
            f"{J(I(), '과')} {I('i2')} 어디에서도 {S()}의 지문은 나오지 않았다.",
        ])
    if t == 'NOT_HOLDERS':
        return pick([
            f"{I()}의 주인은 {S()}도 {S('s2')}도 아니었다.",
            f"{J(S(), '과')} {J(S('s2'), '은')} {J(I(), '을')} 본 적도 없다고 했다. 사실이었다.",
            f"{I()}에는 {J(S(), '과')} {S('s2')}의 손길이 닿은 흔적이 없었다.",
        ])
    if t == 'OR_HOLDER':
        return pick([
            f"{J(I(), '을')} 가진 사람은 {J(S(), '이나')} {S('s2')} 중 한 명이다.",
            f"{J(I(), '은')} {J(S(), '이나')} {S('s2')} 둘 중 한 명의 소지품이었다.",   # 예전 '향수 냄새' 문장은 주인 뜻과 연결이 약해 바꿈
        ])
    if t == 'PLACE_NOT_ITEM':
        return pick([
            f"{P()}에 있던 사람은 {J(I(), '을')} 가지고 있지 않았다.",
            f"감식 결과, {P()}에는 {J(I(), '이')} 놓였던 흔적이 없었다.",
        ])
    if t == 'ITEM_AT_PLACE':
        return pick([
            f"{J(I(), '을')} 가진 사람은 그 시각 {P()}에 있었다.",
            f"{P()} 바닥에서 {I()}의 흔적이 나왔다. 그것을 가진 사람이 거기 있었다는 뜻이다.",
        ])
    if t == 'XOR':
        return pick([
            f"{J(S(), '은')} {P()}에 있었거나 {J(I(), '을')} 가지고 있었다. 하지만 둘 다는 아니다.",
            f"{S()}에 대한 두 증언 '{P()}에 있었다'와 '{J(I(), '을')} 가지고 있었다' 중 정확히 하나만 사실이다.",
        ])
    if t == 'IFF':
        return pick([
            f"{J(S(), '이')} {P()}에 있었다면 {I()}도 {S()}의 것이고, {P()}에 없었다면 {I()}도 {S()}의 것이 아니다.",
            f"{S()}의 두 진술 '{P()}에 있었다'와 '{J(I(), '을')} 가지고 있었다'는 둘 다 참이거나 둘 다 거짓이다.",
        ])
    if t == 'IF_THEN':
        return pick([
            f"만약 {J(S(), '이')} {P()}에 있었다면, {J(S(), '은')} {J(I(), '을')} 가지고 있었을 것이다.",
            f"{J(S(), '이')} {P()}에 있었다는 증언이 맞다면, {I()}의 주인은 {J(S(), '이다')}.",
        ])
    if t == 'IF_THEN_X':
        return pick([
            f"만약 {J(S(), '이')} {P()}에 있었다면, {J(I(), '을')} 가진 사람은 {J(S('s2'), '이다')}.",
            f"{J(S(), '이')} {P()}에 있었다는 말이 사실이라면, {I()}의 주인은 {J(S('s2'), '이었')}을 것이다.",
        ])
    if t == 'ITEM_NEIGHBOR':
        return pick([
            f"{J(I(), '을')} 가진 사람과 {J(I('i2'), '을')} 가진 사람은 바로 옆방에 있었다.",
            f"{I()}의 주인은 벽 너머 옆방에서 {I('i2')}의 주인이 움직이는 소리를 들었다.",
            f"{I()}의 주인과 {I('i2')}의 주인은 복도에서 이웃한 방에 있었다.",
        ])
    if t == 'ITEM_LEFT_OF':
        return pick([
            f"복도 순서로 보면 {J(I(), '을')} 가진 사람의 방이 {J(I('i2'), '을')} 가진 사람의 방보다 앞쪽이었다.",
            f"{I()}의 주인은 {I('i2')}의 주인보다 현관에 가까운 쪽 방에 있었다.",
        ])
    if t == 'HOLDER_NEAR_PLACE':
        return pick([
            f"{J(I(), '을')} 가진 사람은 {P()} 바로 옆방에 있었다.",
            f"{I()}의 주인은 {P()}의 벽 너머 옆방에 있었다.",
        ])
    raise ValueError(t)


def master_text(names, places, pl, killer, decoy):
    """단서 21: 후보 2명 중 한 명의 알리바이는 진짜, 다른 한 명의 진술은 거짓 — 범인 이름을 직접 지목하지 않는다"""
    P = lambda p: places[p].split('(')[0]
    K, D = names[killer], names[decoy]
    lie = random.Random(killer * 7 + decoy).choice([p for p in range(N) if p not in (CRIME, pl[killer], pl[decoy])])
    witness = pl.index(lie)
    return (f"결정적 모순: {D}의 알리바이는 사실로 확인됐다. 그 시각 {J(D, '은')} {P(pl[decoy])}에 있었다. "
            f"반면 {J(K, '은')} '{P(lie)}에 있었다'고 진술했지만, 그 시각 {P(lie)}에는 {J(names[witness], '이')} 있었다.")


# ---------------------------------------------------------------------------
# 에피소드 하나 생성
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# 전파 풀이기 (추측 · 분기 없음): 사람마다 장소 후보 · 물건 후보 집합만 두고 단서를 규칙으로 적용해 줄여 간다.
#   퍼즐 커뮤니티 기준(해는 하나이고 매 단계가 보이는 정보로 추론 가능해야 — 분기(bifurcation) 금지)을 지키기 위해
#   단서 20개를 모두 적용했을 때 이 풀이기만으로 그리드 전체가 정해져야 합격.
# ---------------------------------------------------------------------------
def propagate(cl):
    P = [set(range(N)) for _ in range(N)]
    I = [set(range(N)) for _ in range(N)]
    who_has = lambda i: [s for s in range(N) if i in I[s]]
    who_at = lambda p: [s for s in range(N) if p in P[s]]

    def near(A, B, rel):
        a = {x for x in A if any(rel(x, y) for y in B)}
        b = {y for y in B if any(rel(x, y) for x in a)}
        return a, b
    while True:
        before = sum(map(len, P)) + sum(map(len, I))
        for c in cl:
            t = c['t']; s = c.get('s'); s2 = c.get('s2'); p = c.get('p'); p2 = c.get('p2'); i = c.get('i'); i2 = c.get('i2')
            if t == 'NOT_PLACE': P[s].discard(p)
            elif t == 'IS_PLACE': P[s] &= {p}
            elif t == 'NOT_PLACES': P[s] -= {p, p2}
            elif t == 'OR_PLACE': P[s] &= {p, p2}
            elif t == 'NOT_AT': P[s].discard(p); P[s2].discard(p)
            elif t == 'OR_AT':
                for x in range(N):
                    if x not in (s, s2): P[x].discard(p)
                if p not in P[s]: P[s2] &= {p}
                if p not in P[s2]: P[s] &= {p}
            elif t == 'NOT_ITEM': I[s].discard(i)
            elif t == 'IS_ITEM': I[s] &= {i}
            elif t == 'NOT_ITEMS': I[s] -= {i, i2}
            elif t == 'NOT_HOLDERS': I[s].discard(i); I[s2].discard(i)
            elif t == 'OR_HOLDER':
                for x in range(N):
                    if x not in (s, s2): I[x].discard(i)
                if i not in I[s]: I[s2] &= {i}
                if i not in I[s2]: I[s] &= {i}
            elif t == 'PLACE_NOT_ITEM':
                for x in range(N):
                    if I[x] == {i}: P[x].discard(p)
                    if P[x] == {p}: I[x].discard(i)
            elif t == 'ITEM_AT_PLACE':
                for x in range(N):
                    if I[x] == {i}: P[x] &= {p}
                    if P[x] == {p}: I[x] &= {i}
                    if p not in P[x]: I[x].discard(i)
                    if i not in I[x]: P[x].discard(p)
            elif t == 'XOR':
                if P[s] == {p}: I[s].discard(i)
                if I[s] == {i}: P[s].discard(p)
                if p not in P[s]: I[s] &= {i}
                if i not in I[s]: P[s] &= {p}
            elif t == 'IFF':
                if P[s] == {p}: I[s] &= {i}
                if I[s] == {i}: P[s] &= {p}
                if p not in P[s]: I[s].discard(i)
                if i not in I[s]: P[s].discard(p)
            elif t == 'IF_THEN':
                if P[s] == {p}: I[s] &= {i}
                if i not in I[s]: P[s].discard(p)
            elif t == 'IF_THEN_X':
                if P[s] == {p}: I[s2] &= {i}
                if i not in I[s2]: P[s].discard(p)
            elif t == 'NEIGHBOR': P[s], P[s2] = near(P[s], P[s2], lambda x, y: abs(x - y) == 1)
            elif t == 'LEFT_OF': P[s], P[s2] = near(P[s], P[s2], lambda x, y: x < y)
            elif t == 'NOT_NEIGHBOR':
                if len(P[s]) == 1: P[s2] = {y for y in P[s2] if abs(next(iter(P[s])) - y) != 1}
                if len(P[s2]) == 1: P[s] = {x for x in P[s] if abs(x - next(iter(P[s2]))) != 1}
            elif t == 'HOLDER_NEAR_PLACE':
                hs = who_has(i)
                if len(hs) == 1: P[hs[0]] = {x for x in P[hs[0]] if abs(x - p) == 1}
                for x in range(N):
                    if not any(abs(y - p) == 1 for y in P[x]): I[x].discard(i)
            elif t in ('ITEM_NEIGHBOR', 'ITEM_LEFT_OF'):
                hs, h2 = who_has(i), who_has(i2)
                rel = (lambda x, y: abs(x - y) == 1) if t == 'ITEM_NEIGHBOR' else (lambda x, y: x < y)
                if len(hs) == 1 and len(h2) == 1:
                    P[hs[0]], P[h2[0]] = near(P[hs[0]], P[h2[0]], rel)
                elif len(hs) == 1:
                    for x in h2:
                        if not any(rel(a, b) for a in P[hs[0]] for b in P[x]): I[x].discard(i2)
                elif len(h2) == 1:
                    for x in hs:
                        if not any(rel(a, b) for a in P[x] for b in P[h2[0]]): I[x].discard(i)
        ca, ch = set(who_at(CRIME)), set(who_has(CRIME))          # 사건 현장에 있는 사람 = 범행 도구 주인
        for x in range(N):
            if x not in ch: P[x].discard(CRIME)
            if x not in ca: I[x].discard(CRIME)
        for D in (P, I):                                            # 한 사람 = 한 칸, 한 칸 = 한 사람
            for x in range(N):
                if len(D[x]) == 1:
                    v = next(iter(D[x]))
                    for y in range(N):
                        if y != x: D[y].discard(v)
            for v in range(N):
                owners = [x for x in range(N) if v in D[x]]
                if len(owners) == 1: D[owners[0]] &= {v}
        after = sum(map(len, P)) + sum(map(len, I))
        if after >= before or after == 0:
            return P, I


def propagation_solved(cl):
    P, I = propagate(cl)
    return all(len(x) == 1 for x in P + I)


# ---------------------------------------------------------------------------
# 장면화 (단서를 그 사건의 장면 · 증인 목소리로)
#   논리 내용은 '단서 구조'가 전부이고, 여기서는 문장 앞뒤에 공간에 맞는 증인 · 자료 출처를 붙인다.
#   - 증인 역할은 공간 종류(고급 저택 · 기차역 …)마다 다르고, 용의자 이름은 절대 쓰지 않는다 (붉은 실이 엉키지 않게)
#   - 에피소드마다 '거짓 증언' 한 건: 용의자의 주장을 그대로 싣고 거짓으로 밝혀졌다고 표시 (논리는 소거 그대로)
#   - 2 · 3단계: '확인되지 않은 소문' 꼬리 1~2개 — 참일 수도 거짓일 수도 있으며, 그렇게 표시된다 (가짜 단서는 반드시 표시)
# ---------------------------------------------------------------------------
WITNESSES = {
    '고급 저택': ['집사', '정원사', '가정부', '요리사'], '호텔 스위트룸': ['프런트 직원', '룸메이드', '도어맨', '벨보이'],
    '해안가 펜션': ['펜션 주인', '낚시꾼', '이웃 민박 아주머니', '등대지기'], '연구소': ['경비원', '청소 직원', '야간 당직 연구원', '안내 데스크 직원'],
    '폐공장': ['경비원', '고물상', '순찰 경관', '근처 노점상'], '항구 창고': ['세관원', '부두 노동자', '선원', '경비 초소 직원'],
    '기차역': ['역무원', '매점 아주머니', '청소부', '열차 승무원'], '유람선 선실': ['선장', '승무원', '바텐더', '갑판원'],
    '도서관': ['사서', '야간 경비원', '단골 이용자', '청소 직원'], '오래된 성당': ['신부님', '종지기', '성가대원', '수녀님'],
    '박물관 전시실': ['학예사', '경비원', '안내원', '복원 기술자'], '카지노 VIP룸': ['딜러', '경비원', '바텐더', '지배인'],
    '재즈 클럽': ['바텐더', '피아니스트', '웨이터', '클럽 사장'], '골목길 다방': ['다방 주인', '단골 손님', '배달 소년', '옆집 세탁소 아저씨'],
    '지하 주차장': ['관리인', '경비원', '세차장 직원', '순찰 경관'], '극장 무대 뒤': ['무대 감독', '조명 기사', '의상 담당', '매표소 직원'],
}
DEFAULT_WITNESSES = ['목격자', '경비원', '이웃', '지나가던 행인']
LEADS_TESTIMONY = ["{w}의 증언: ", "{w}{이} 기억하기로, ", "{w}{은} 이렇게 말했다. ", "{w}{이} 조용히 귀띔했다. ", "{w}의 진술서 — "]
LEADS_EVIDENCE = ["감식반 보고 — ", "현장 사진을 다시 보니, ", "탐정의 수첩: ", "수사 메모 — ", "{w}{이} 가져온 기록에 따르면, "]
EVIDENCE_TYPES = {'NOT_ITEM', 'IS_ITEM', 'NOT_ITEMS', 'NOT_HOLDERS', 'PLACE_NOT_ITEM', 'ITEM_AT_PLACE', 'ITEM_NEIGHBOR', 'ITEM_LEFT_OF', 'HOLDER_NEAR_PLACE'}
# 두 조건을 엮는 단서('만약 ~라면' · '둘 중 하나' · '둘 다 참이거나 둘 다 거짓' · 옆방/앞쪽)는 증인이 할 말이 아니라 탐정의 정리 → 수사 메모 머리말만
COMPOUND_TYPES = {'XOR', 'IFF', 'IF_THEN', 'IF_THEN_X', 'OR_PLACE', 'OR_AT', 'OR_HOLDER', 'ITEM_NEIGHBOR', 'ITEM_LEFT_OF', 'HOLDER_NEAR_PLACE', 'LEFT_OF'}
LEADS_COMPOUND = ["수사 메모 — ", "탐정의 수첩: "]


def witness_ok(role, jobs):
    """증인 역할이 그 사건 용의자의 직업과 겹치지 않는가 (예: 증인 '바텐더' + 용의자 바텐더 → 같은 사람으로 오해)"""
    r = {'신부님': '신부', '수녀님': '수녀'}.get(role, role)   # 높임 '님'만 뗀다 ('단골 손님'의 '님'은 그대로)
    return not any(j == r or j.endswith(r) or r.endswith(j) for j in jobs)
DRESS_RATE = 0.45


def J2(w, kind):
    """역할 이름용 조사 ({이}/{은} 자리)"""
    return J(w, kind)


def dress(text, c, theme, rng, jobs=()):
    """단서 앞에 증인 · 자료 출처 붙이기 (약 45%). 이미 출처로 시작하는 문장은 그대로
    jobs: 그 사건 용의자들의 직업 — 겹치는 증인 역할은 쓰지 않는다"""
    if rng.random() > DRESS_RATE or text.startswith(('감식', '복도 CCTV', '여러 사람이', '목격자', '수사 기록', '결정적')):
        return text
    pool = [w for w in WITNESSES.get(theme, DEFAULT_WITNESSES) if witness_ok(w, jobs)] or            [w for w in DEFAULT_WITNESSES if witness_ok(w, jobs)]
    w = rng.choice(pool)
    lead = rng.choice(LEADS_COMPOUND if c['t'] in COMPOUND_TYPES else LEADS_EVIDENCE if c['t'] in EVIDENCE_TYPES else LEADS_TESTIMONY)
    lead = lead.replace('{w}{이}', J2(w, '이')).replace('{w}{은}', J2(w, '은')).replace('{w}', w)
    return lead + text


def liar_text(c, names, places, items):
    """거짓 증언 (NOT_PLACE / NOT_ITEM 를 '주장 → 거짓으로 밝혀짐' 틀로). 논리는 같다"""
    S = names[c['s']]
    if c['t'] == 'NOT_PLACE':
        P = places[c['p']].split('(')[0]
        return f"{J(S, '은')} \"그 시각 나는 {P}에 있었다\"고 주장했다. 하지만 그 말은 거짓으로 밝혀졌다."
    I = items[c['i']].split('(')[0]
    return f"{J(S, '은')} \"{J(I, '은')} 원래 내 것\"이라고 우겼다. 하지만 그 말은 거짓으로 밝혀졌다."


def rumor_tail(names, places, pl, rng):
    """확인되지 않은 소문 (참 · 거짓 반반). 반드시 '확인되지 않았다'로 표시"""
    s = rng.randrange(N)
    p = pl[s] if rng.random() < 0.5 else rng.choice([x for x in range(N) if x != pl[s]])
    P = places[p].split('(')[0]
    return rng.choice([
        f" 한편 {J(names[s], '이')} {P}에 있었다는 소문도 돌았지만, 확인되지는 않았다.",
        f" (떠도는 말로는 {J(names[s], '이')} {P} 근처에서 보였다고 하나, 확인된 바 없다.)",
    ])


def floor_at(tier, k):
    for upto, n in TIERS[tier]['floors']:
        if k <= upto:
            return n
    return 1


def generate(no, names, killer_name, places, items, tries=200):
    """names: 퍼즐 용의자 6명 (진범 포함, 순서 무관). 반환: dict (JSON 한 항목의 퍼즐 부분)"""
    tier = tier_of(no)
    T = TIERS[tier]
    order = names[:]
    random.Random(no * 13 + 1).shuffle(order)               # 진범 자리도 1~6번째 무작위 (에피소드마다 고정)
    killer = order.index(killer_name)
    for attempt in range(tries):
        rng = random.Random(no * 7919 + attempt * 104729 + 3)
        # 정답: 진범 = 사건 현장 + 범행 도구
        pl = list(range(N)); it = list(range(N))
        rng.shuffle(pl); rng.shuffle(it)
        a = pl.index(CRIME); pl[a], pl[killer] = pl[killer], pl[a]
        b = it.index(CRIME); it[b], it[killer] = it[killer], it[b]
        pl, it = tuple(pl), tuple(it)

        st = State()
        logN0 = math.log(st.count())
        clues, used, counts, trail = [], {}, [], []
        failed = False
        for k in range(1, 20):
            pool = T['early'] if k <= 10 else T['mid']
            # 앞 단계 후반에는 복합 단서를 조금 섞고, 같은 유형이 몰리지 않게
            target = logN0 * (1 - (k / 19.5) ** T['curve'])     # curve>1: 앞 단서가 정보를 덜 줘서 그리드가 오래 열려 있다
            target = max(target, math.log(3))
            best = None
            # 마지막 몇 단서는 '후보 정확히 2명'을 맞추기 어려워 더 많이 찾아보고, 막히면 직접 단서도 허용
            samples = 36 if k < 17 else 160
            for n_try in range(samples):
                t = rng.choice(pool if n_try < 100 else T['early'] + T['mid'])
                cap = 3 if k >= 17 else 2
                if used.get(t, 0) >= cap or (clues and clues[-1]['t'] == t):
                    continue
                c = make_clue(t, pl, it, rng)
                if not c or c in clues:
                    continue
                nst = st.apply(c, limit=40000)
                if nst is None:
                    continue
                n = nst.count()
                if n >= st.count() or n < 2 + (19 - k):      # 다음 단서들이 하나씩 줄일 여유를 남긴다
                    continue
                kc = len(nst.killers())
                if kc < floor_at(tier, k) or (k == 19 and kc != 2):
                    continue
                score = abs(math.log(n) - target)
                if best is None or score < best[0]:
                    best = (score, c, nst, n, kc)
            if best is None:
                failed = True
                break
            _, c, st, n, kc = best
            clues.append(c); used[c['t']] = used.get(c['t'], 0) + 1
            counts.append(n); trail.append(kc)
        if failed or st.count() > 40:
            continue
        # 단서 20: 그리드 전체가 하나로 (3단계는 복합 단서 우선)
        prefer = T['mid'] if tier >= 2 else T['mid'] + T['early']
        last = None
        for _ in range(400):
            t = rng.choice(prefer if _ < 250 else T['early'] + T['mid'])
            c = make_clue(t, pl, it, rng)
            if not c or c in clues:
                continue
            nst = st.apply(c)
            if nst.count() == 1:
                last = (c, nst)
                break
        if not last:
            continue
        clues.append(last[0]); counts.append(1); trail.append(1)
        if not propagation_solved(clues):                   # 추측 없이 연쇄 추론만으로 풀려야 한다
            continue
        decoy = next(iter(State(pairs=st.to_pairs()).killers() - {killer}))
        return dict(order=order, killer=killer, pl=pl, it=it, clues=clues, counts=counts, killers=trail,
                    decoy=decoy, tier=tier, attempt=attempt)
    raise RuntimeError(f'Ep.{no}: 조건에 맞는 단서 세트를 {tries}번 안에 못 만듦')


def build_entry(ep_no, ep_id, place_desc, puzzle, places, items, theme=None, motive=None, jobs=()):
    names = puzzle['order']
    pl, it = puzzle['pl'], puzzle['it']
    rng = random.Random(ep_no * 977 + 11)
    entry = {
        '에피소드': ep_no, '에피소드 ID': ep_id, '장소': place_desc,
        '진범': names[puzzle['killer']], '난이도': TIERS[puzzle['tier']]['name'],
        '용의자': names, '그리드 장소': places, '그리드 물건': items,
        '정답': {names[s]: {'장소': places[pl[s]], '물건': items[it[s]]} for s in range(N)},
    }
    seen = {}
    clues = puzzle['clues']
    liar = next((k for k, c in enumerate(clues[:10]) if c['t'] in ('NOT_PLACE', 'NOT_ITEM')), None)   # 거짓 증언 1건
    rumors = set(rng.sample(range(2, 15), 2 if puzzle['tier'] == 3 else 1)) if puzzle['tier'] >= 2 else set()
    for k, c in enumerate(clues, start=1):
        if k - 1 == liar:
            text = liar_text(c, names, places, items)
        else:
            text = dress(text_of(c, names, places, items, seen.get(c['t'], 0)), c, theme, rng, jobs)
        if k - 1 in rumors:
            text += rumor_tail(names, places, pl, rng)
        entry[f'단서 {k}'] = text
        seen[c['t']] = seen.get(c['t'], 0) + 1
    hint = master_text(names, places, pl, puzzle['killer'], puzzle['decoy'])
    if motive:
        hint += f" 이 소동의 뿌리는 '{motive}'였다."
    entry[HINT_KEY] = hint
    entry['장면'] = dict(공간=theme or '', 동기=motive or '', 거짓증언=liar + 1 if liar is not None else None, 소문=sorted(k + 1 for k in rumors))
    entry['단서 구조'] = [dict(c) for c in puzzle['clues']]
    entry['검증'] = {'남은 배치 수': puzzle['counts'], '범인 후보 수': puzzle['killers']}
    return entry


def verify(entry):
    """JSON 항목 → (해 개수, 범인 이름 집합, 단서 19개까지 범인 후보 수 목록). 전파(추측 없음)만으로 안 풀리면 해 개수 0"""
    names = entry['용의자']
    clues = entry['단서 구조']
    if not propagation_solved(clues):
        return 0, set(), []
    sols = solve(clues)
    culprits = {names[pl.index(CRIME)] for pl, _ in sols}
    st, trail = State(), []
    for c in clues[:19]:
        st = st.apply(c)
        trail.append(len(st.killers()))
    return len(sols), culprits, trail


# ---------------------------------------------------------------------------
TIER_BY_NAME = {v['name']: k for k, v in TIERS.items()}


def retext(args, jobs_of):
    """--retext: 기존 JSON 의 퍼즐(용의자 순서 · 정답 · 단서 구조 · 검증)을 그대로 두고 단서 문장만 다시 만든다.
    문장 틀 · 머리말 규칙을 고친 뒤 쓴다 — 정답 배치 · 사건 현장 · 범행 도구가 바뀌지 않아 고백 · 그림과 어긋나지 않는다."""
    data = json.load(open(args.out, encoding='utf-8'))
    changed = 0
    for i, old in enumerate(data):
        no = old['에피소드']
        if not args.start <= no <= args.end:
            continue
        names, places, items = old['용의자'], old['그리드 장소'], old['그리드 물건']
        killer = names.index(old['진범'])
        pl = tuple(places.index(old['정답'][n]['장소']) for n in names)
        it = tuple(items.index(old['정답'][n]['물건']) for n in names)
        clues = old['단서 구조']
        st = State()
        for c in clues[:19]:
            st = st.apply(c)
        decoy = next(iter(State(pairs=st.to_pairs()).killers() - {killer}))
        puzzle = dict(order=names, killer=killer, pl=pl, it=it, clues=clues, decoy=decoy, tier=TIER_BY_NAME[old['난이도']],
                      counts=old['검증']['남은 배치 수'], killers=old['검증']['범인 후보 수'])
        scene = old.get('장면', {})
        entry = build_entry(no, old['에피소드 ID'], old['장소'], puzzle, places, items, theme=scene.get('공간') or None,
                            motive=scene.get('동기') or None, jobs=[jobs_of[no].get(n, '') for n in names])
        assert entry[HINT_KEY] == old[HINT_KEY], (no, '힌트 문장이 달라짐')
        assert entry['단서 구조'] == clues and entry['정답'] == old['정답'] and entry['진범'] == old['진범'], no
        n, culprits, trail = verify(entry)
        assert n == 1 and culprits == {old['진범']} and min(trail) >= 2, (no, n, culprits, trail)
        for k in ['장소', '에피소드 ID']:
            entry[k] = old[k]
        changed += sum(entry[f'단서 {k}'] != old[f'단서 {k}'] for k in range(1, 21))
        data[i] = {**old, **entry}
    json.dump(data, open(args.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'→ {args.out}: 단서 문장 {changed}개 바뀜 (퍼즐 · 정답 · 힌트 그대로)')


def main():
    import import_episodes_v6 as imp
    import logic_themes
    import cozy_rules
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='start', type=int, default=1)
    ap.add_argument('--to', dest='end', type=int, default=300)
    ap.add_argument('--print', action='store_true')
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--retext', action='store_true', help='퍼즐(단서 구조 · 정답)은 그대로 두고 문장만 지금 규칙으로 다시 쓴다')
    args = ap.parse_args()

    rows = sorted((imp.parse(r) for r in imp.load_rows(os.path.join(ROOT, imp.DEFAULT_SRC))), key=lambda e: e['no'])
    jobs_of = {e['no']: {p['name']: p['job'] for p in [e['culprit']] + e['others']} for e in rows}
    if args.retext:
        return retext(args, jobs_of)
    out = []
    for e in rows:
        if not args.start <= e['no'] <= args.end:
            continue
        rng = random.Random(e['no'] * 31 + 5)
        others = [p['name'] for p in e['others'] if p['name'] != e['culprit']['name']]
        names = [e['culprit']['name']] + rng.sample(others, 5)
        places, items = logic_themes.pick(e['no'], e['place'])
        puzzle = generate(e['no'], names, e['culprit']['name'], places, items)
        motive = cozy_rules.MOTIVE_LABEL.get(e['motive_type'], e['motive_type'])
        entry = build_entry(e['no'], f"ep{e['no']:03d}", e['place'], puzzle, places, items,
                            theme=logic_themes.theme_for(e['place']), motive=motive,
                            jobs=[jobs_of[e['no']][n] for n in names])
        n, culprits, trail = verify(entry)
        assert n == 1 and culprits == {e['culprit']['name']} and min(trail) >= 2, (e['no'], n, culprits, trail)
        out.append(entry)
        if args.print:
            print(f"\n=== Ep.{e['no']} [{entry['난이도']}] 진범 {entry['진범']} (용의자 {entry['용의자'].index(entry['진범']) + 1}번째) 시도 {puzzle['attempt'] + 1}")
            for k in range(1, 21):
                print(f"  {k:2}. {entry[f'단서 {k}']}   [{puzzle['clues'][k - 1]['t']} · 후보 {puzzle['killers'][k - 1]} · 배치 {puzzle['counts'][k - 1]}]")
            print(f"  21. {entry[HINT_KEY]}")
        elif e['no'] % 25 == 0:
            print(f"  … Ep.{e['no']}", flush=True)

    # 통계
    by_tier = {}
    for x in out:
        by_tier.setdefault(x['난이도'], []).append(x['검증'])
    for name, vs in by_tier.items():
        avg = lambda k: sum(v['범인 후보 수'][k - 1] for v in vs) / len(vs)
        avgn = lambda k: sum(v['남은 배치 수'][k - 1] for v in vs) / len(vs)
        print(f"{name}: {len(vs)}화 · 범인 후보 평균 (단서 5/10/15/19) {avg(5):.1f} / {avg(10):.1f} / {avg(15):.1f} / {avg(19):.1f}"
              f" · 남은 배치 평균 (단서 10/15/19) {avgn(10):.0f} / {avgn(15):.0f} / {avgn(19):.1f}")
    pos = [x['용의자'].index(x['진범']) + 1 for x in out]
    print('진범 위치 분포 (1~6번째):', [pos.count(i) for i in range(1, 7)])
    first = {}
    for x in out:
        first[x['단서 구조'][0]['t']] = first.get(x['단서 구조'][0]['t'], 0) + 1
    print('1번 단서 유형 분포:', dict(sorted(first.items(), key=lambda kv: -kv[1])))
    if not args.print or (args.start, args.end) == (1, 300):
        json.dump(out, open(args.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'→ {args.out}: {len(out)}화')


if __name__ == '__main__':
    main()
