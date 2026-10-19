"""
논리 그리드 단서 (data/V6_300_Episodes_Logic_Clues.json) 읽기 · 검증 — tools/import_episodes_v6.py 에서 사용

JSON 한 항목 = 에피소드 하나
  { "에피소드": 1, "에피소드 ID": "ep001", "장소": ..., "진범": "서아",
    "단서 1" ~ "단서 20": 문장, "단서 21 (광고/마스터키)": 결정적 힌트 }

300화 모두 같은 20문장 틀(용의자 6명 × 장소 6곳 × 물건 6개 짝 맞추기)이라, 틀에서 이름 · 장소 · 물건을 뽑아
  - 논리 그리드 축 (장소 6 · 물건 6 · 용의자 6)
  - 조사 교정 ("신위안와" → "신위안과", "만년필를" → "만년필을" …)
  - 풀이 검증: 단서 1~20을 모두 만족하는 배치를 전부 찾아, 범인(사건 현장 + 범행 도구)이 진범 한 명으로 정해지는지
를 만든다.
"""
import itertools
import re

CLUE_KEYS = [f'단서 {i}' for i in range(1, 21)]
HINT_KEY = '단서 21 (광고/마스터키)'

N = r'(.+?)'
# 틀마다 뽑을 이름표 (조사는 원본이 틀린 경우가 있어 [와과]처럼 둘 다 받는다)
PATTERNS = {
    1: (rf'수사 기록: {N}(?:와|과) {N} 중 한 명은 {N}에, 다른 한 명은 {N}에 있었다', ['A', 'B', 'P1', 'P2']),
    2: (rf'소지한 사람은 {N}(?:이나|나) {N}에 가지 않았다', ['P3', 'P4']),
    3: (rf'증언에 따르면 {N}(?:은|는) {N}에 머물며', ['C', 'P5']),
    4: (rf'사건 현장인 {N}에는 {N}(?:이|가) 남겨져 있었지만, {N}의 물건은 아니었다', ['PC', 'W', 'A4']),
    5: (rf'^{N}의 소지품을 조사한 결과, {N}(?:이|가) 발견되었다', ['D', 'I2']),
    6: (rf'^{N}에 있던 용의자는 {N}(?:을|를) 들고 있었음이', ['P6', 'I3']),
    7: (rf'^{N}(?:은|는) {N}에 있었거나, 혹은 {N}(?:을|를) 가지고 있었다', ['E', 'P7', 'I7']),
    8: (rf'조사 결과, {N}(?:을|를) 가진 사람은 {N}(?:으로|로) 밝혀졌다', ['I4', 'A8']),
    9: (rf'^{N}에서 발견된 족적은 {N}(?:이나|나|와|과) {N}의 것이 아니었다', ['P9', 'S9a', 'S9b']),
    10: (rf'^{N}(?:은|는) 사건 당시 {N}(?:을|를) 사용 중이었다고', ['B10', 'I5']),
    11: (rf'^{N}(?:은|는) {N}에서 빠져나오는 모습이', ['S11', 'P11']),
    12: (rf'^{N}(?:을|를) 가진 용의자는 {N}(?:이거나|거나) {N}(?:이다|다)\.?$', ['I12', 'S12a', 'S12b']),
    13: (rf'거짓말 탐지기 결과, {N}에 있던 사람은 {N}(?:을|를) 가지지 않았음이', ['P13', 'I13']),
    14: (rf'^{N}(?:은|는) 범행 도구인 {N}(?:을|를) 한 번도', ['S14', 'W14']),
    15: (rf'알리바이 교차 검증: {N}(?:와|과) {N}(?:은|는) 사건 발생 시 서로 다른 장소에', ['S15a', 'S15b']),
    16: (rf'^{N}에 있던 용의자는 {N}(?:이나|나) {N}(?:을|를) 가지고 있지 않았다', ['P16', 'I16a', 'I16b']),
    17: (rf'CCTV 확인 결과, {N}의 주인은 {N}도 아니고 {N}도 아니었다', ['I17', 'S17a', 'S17b']),
    18: (rf'^{N}(?:을|를) 조사한 감식반은 그곳에 {N}(?:이|가) 놓여 있었던 흔적', ['P18', 'I18']),
    19: (rf'^{N}(?:은|는) {N}부터 {N}까지 그 어느 곳에도 나타나지 않았다', ['S19', 'P19a', 'P19b']),
    20: (rf'종합 감식 결과, {N}(?:을|를) 소지한 인물이 사건 시각 {N}에 있었던 것이 확실시된다', ['W20', 'PC20']),
}
ITEM1 = re.compile(rf'경찰의 탐문 결과, {N}(?:을|를) 소지한 사람은')


def parse(ep):
    """→ dict(tokens, places[6], items[6], suspects[6], killer) — 틀에 맞지 않으면 ValueError"""
    t = {}
    for i, (pat, names) in PATTERNS.items():
        m = re.search(pat, ep[f'단서 {i}'])
        if not m:
            raise ValueError(f"Ep.{ep['에피소드']} 단서 {i} 틀이 다름: {ep[f'단서 {i}']}")
        t.update(zip(names, (g.strip() for g in m.groups())))
    t['I1'] = ITEM1.search(ep['단서 2']).group(1).strip()
    killer = ep['진범'].strip()
    places = [t['P1'], t['P2'], t['P3'], t['P4'], t['P5'], t['PC']]
    items = [t['I1'], t['I2'], t['I3'], t['I4'], t['I5'], t['W']]
    suspects = [t['A'], t['B'], t['C'], t['D'], t['E'], killer]
    for label, xs in (('장소', places), ('물건', items), ('용의자', suspects)):
        if len(set(xs)) != 6:
            raise ValueError(f"Ep.{ep['에피소드']} {label} 6개가 아님: {xs}")
    return dict(tokens=t, places=places, items=items, suspects=suspects, killer=killer)


def solve(p, clues=range(1, 21)):
    """단서(번호 목록)를 모두 만족하는 (장소 배치, 물건 배치) 전부. 사람 → 장소/물건"""
    t, S, P, I = p['tokens'], p['suspects'], p['places'], p['items']
    k = p['killer']
    clues = set(clues)
    range19 = P[P.index(t['P19a']):P.index(t['P19b']) + 1]
    sols = []
    for pp in itertools.permutations(P):
        pl = dict(zip(S, pp))
        at = {v: s for s, v in pl.items()}
        if 1 in clues and {pl[t['A']], pl[t['B']]} != {t['P1'], t['P2']}: continue
        if 3 in clues and pl[t['C']] != t['P5']: continue
        if 9 in clues and at[t['P9']] in (t['S9a'], t['S9b']): continue
        if 11 in clues and pl[t['S11']] != t['P11']: continue
        if 15 in clues and pl[t['S15a']] == pl[t['S15b']]: continue
        if 19 in clues and pl[t['S19']] in range19: continue
        for ii in itertools.permutations(I):
            it = dict(zip(S, ii))
            has = {v: s for s, v in it.items()}
            if 2 in clues and pl[has[t['I1']]] in (t['P3'], t['P4']): continue
            if 4 in clues and it[t['A4']] == t['W']: continue
            if 5 in clues and it[t['D']] != t['I2']: continue
            if 6 in clues and it[at[t['P6']]] != t['I3']: continue
            if 7 in clues and (pl[t['E']] == t['P7']) == (it[t['E']] == t['I7']): continue
            if 8 in clues and it[t['A8']] != t['I4']: continue
            if 10 in clues and it[t['B10']] != t['I5']: continue
            if 12 in clues and has[t['I12']] not in (t['S12a'], t['S12b']): continue
            if 13 in clues and it[at[t['P13']]] == t['I13']: continue
            if 14 in clues and it[t['S14']] == t['W14']: continue
            if 16 in clues and it[at[t['P16']]] in (t['I16a'], t['I16b']): continue
            if 17 in clues and has[t['I17']] in (t['S17a'], t['S17b']): continue
            if 18 in clues and pl[has[t['I18']]] != t['P18']: continue
            if 20 in clues and pl[has[t['W20']]] != t['PC20']: continue
            sols.append((pl, it))
    return sols


def culprits_of(p, sols):
    """해들에서 '사건 현장에 있고 범행 도구를 가진' 사람 집합"""
    out = set()
    for pl, it in sols:
        out |= {s for s in p['suspects'] if pl[s] == p['places'][5] and it[s] == p['items'][5]}
    return out


# ---------- 조사 교정 ----------
def has_batchim(ch):
    code = ord(ch) - 0xAC00
    return 0 <= code < 11172 and code % 28 != 0


def rieul(ch):
    code = ord(ch) - 0xAC00
    return 0 <= code < 11172 and code % 28 == 8


JOSA_ALT = '이거나|거나|이나|으로|와|과|은|는|이|가|을|를|나|로'
PAIRS = {'이거나': ('이거나', '거나'), '거나': ('이거나', '거나'), '이나': ('이나', '나'), '나': ('이나', '나'),
         '와': ('과', '와'), '과': ('과', '와'), '은': ('은', '는'), '는': ('은', '는'),
         '이': ('이', '가'), '가': ('이', '가'), '을': ('을', '를'), '를': ('을', '를')}


def fix_josa(text, words):
    """이름 · 장소 · 물건 바로 뒤의 조사를 받침에 맞게 (원본 데이터의 '신위안와' · '만년필를' 같은 표기 교정)"""
    for w in sorted(set(words), key=len, reverse=True):
        # '독이 든 찻잔(범행도구)' 처럼 괄호 설명이 붙은 이름은 괄호 앞 낱말 기준 (찻잔이)
        base = w.split('(')[0] or w
        last = next((c for c in reversed(base) if '가' <= c <= '힣'), None)
        if not last:
            continue

        def repl(m, last=last):
            j = m.group(2)
            if j in ('으로', '로'):
                return m.group(1) + ('으로' if has_batchim(last) and not rieul(last) else '로')
            yes, no = PAIRS[j]
            return m.group(1) + (yes if has_batchim(last) else no)
        text = re.sub(rf'({re.escape(w)})({JOSA_ALT})(?=[\s.,)!?]|$)', repl, text)
    return text
