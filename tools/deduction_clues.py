"""
추리형 단서 20개 생성기 (tools/import_episodes_v6.py 에서 사용)

단서에 "○○는 용의선상에서 제외된다" 같은 정답을 쓰지 않는다. 대신
  ① 범인에 대한 사실 (crime fact)   : "범인은 왼손잡이다" · "범인은 사건 시각 서재에 있었다" · "목격자: 범인은 30대였다"
  ② 용의자에 대한 관찰 (suspect fact): "하린은 늘 오른손으로 펜을 쥔다" · "민지는 사건 시각 온실에 있었다"
를 섞어 주고, 플레이어가 ①과 ②를 맞춰 보며 범인을 스스로 좁혀 가게 한다.
나이 · 성별은 용의자 프로필(수사 보드의 용의자 파일)에 이미 보이므로 목격 증언 하나만으로도 대조할 수 있다.

속성 (ep.attributes)
  gender · ageGroup : 프로필 (항상 알려져 있음)
  hand              : 주로 쓰는 손 (왼손잡이 / 오른손잡이)
  place             : 사건 시각 있던 곳 (공간별 방 이름)
  trace             : 옷 · 손에 묻은 흔적 (밀가루 · 잉크 · 흙 …)

보장 (validate 로 매번 확인, 안 맞으면 다른 배치로 다시 생성)
  - 20개 단서를 모두 모으면 논리적으로 진범 한 명만 남는다
  - 19개까지는 아직 두 명 이상 남는다 (마지막 단서까지 모아야 확정)
  - 진범에 대한 관찰은 모두 범인 사실과 맞는다 (모순 없음)
  - 무고한 사람마다 범인 사실과 어긋나는 관찰(또는 프로필)이 적어도 하나 있다
"""

HANDS = {'왼손': '왼손잡이', '오른손': '오른손잡이'}
TRACES = ['밀가루', '잉크', '진흙', '페인트', '촛농', '석탄 가루', '꽃가루', '모래']

ATTRIBUTES = {
    'gender': {'label': '성별'},
    'ageGroup': {'label': '나이대'},
    'hand': {'label': '주로 쓰는 손'},
    'place': {'label': '사건 시각 위치'},
    'trace': {'label': '옷에 묻은 흔적'},
}


def has_batchim(ch):
    code = ord(ch) - 0xAC00
    return 0 <= code < 11172 and code % 28 != 0


def j(word, with_b, without_b):
    return word + (with_b if has_batchim(word[-1]) else without_b)


def age_group(age):
    return f'{age // 10 * 10}대'


# ---------- 문장 ----------
def crime_text(attr, value, rng, rooms, objects):
    if attr == 'hand':
        obj = rng.choice(objects)
        return rng.choice([
            f"{j(obj, '을', '를')} 조사해 보니 손잡이에 남은 지문은 모두 {value} 자국이다. 범인은 {HANDS[value]}다.",
            f"범행 도구의 각도로 보아 범인은 {HANDS[value]}가 틀림없다.",
            f"현장의 메모는 {value}으로 쓴 필체였다. 범인은 {HANDS[value]}다.",
        ])
    if attr == 'place':
        return rng.choice([
            f"사건은 {value}에서 벌어졌다. 범인은 사건 시각 {value}에 있었던 사람이다.",
            f"{value}의 시계가 멈춘 시각, 그 방 안에 있던 사람만이 범행을 저지를 수 있었다.",
        ])
    if attr == 'trace':
        return rng.choice([
            f"현장 바닥에 {j(value, '이', '가')} 흩어져 있었다. 범인의 옷에도 {j(value, '이', '가')} 묻었을 것이다.",
            f"감식 결과, 범인의 손에는 {j(value, '이', '가')} 묻어 있었을 것으로 보인다.",
        ])
    if attr == 'ageGroup':
        return f"목격자의 증언: 현장을 빠져나간 사람은 {value}였다."
    if attr == 'gender':
        return f"목격자의 증언: 현장을 빠져나간 사람은 {'여성' if value == '여' else '남성'}이었다."
    raise ValueError(attr)


def suspect_text(person, attr, value, rng, witnesses, crime_place):
    name = person['name']
    if attr == 'hand':
        return rng.choice([
            f"{j(name, '은', '는')} 메모를 할 때 늘 {value}으로 펜을 쥔다.",
            f"{j(name, '이', '가')} {value}으로 찻잔을 드는 모습이 여러 번 목격되었다.",
            f"{rng.choice(witnesses)}의 증언: \"{name} 씨는 {HANDS[value]}예요.\"",
        ])
    if attr == 'place':
        w = rng.choice(witnesses)
        if value == crime_place:
            return rng.choice([
                f"{j(name, '은', '는')} 사건 시각 {value}에 잠시 들렀다고 털어놓았다.",
                f"{j(w, '이', '가')} 사건 시각 {value}에서 {j(name, '을', '를')} 보았다고 말했다.",
            ])
        return rng.choice([
            f"{j(name, '은', '는')} 사건 시각 {value}에 있었다. {j(w, '이', '가')} 그 모습을 보았다.",
            f"{j(w, '은', '는')} 사건 시각 {value}에서 {name}{'과' if has_batchim(name[-1]) else '와'} 함께 있었다고 증언했다.",
        ])
    if attr == 'trace':
        return rng.choice([
            f"{name}의 소매에 {j(value, '이', '가')} 묻어 있었다.",
            f"{name}의 장갑에서 {j(value, '이', '가')} 발견되었다.",
        ])
    raise ValueError(attr)


# ---------- 논리 확인 (js/mystery.js possibleCulprits 와 같은 규칙) ----------
def possible(people, facts_by_stage, upto):
    crime, known = {}, {p['id']: dict(p['attrs']) for p in people}
    for facts in facts_by_stage[:upto]:
        for f in facts:
            if f['type'] == 'crime':
                crime[f['attr']] = f['value']
            elif f['type'] == 'suspect':
                known[f['suspect']][f['attr']] = f['value']
    return [p['id'] for p in people
            if all(known[p['id']].get(a) in (None, v) for a, v in crime.items())]


def build(people, rooms, witnesses, objects, scene_pool, rng, tries=200):
    """people: [{id, name, age, gender, culprit}] → (clues[{stage, text, facts}], attrs per person id)"""
    for _ in range(tries):
        out = _attempt(people, rooms, witnesses, objects, scene_pool, rng)
        if out:
            return out
    raise RuntimeError('추리 단서 배치를 만들지 못했습니다')


def _attempt(people, rooms, witnesses, objects, scene_pool, rng):
    for p in people:
        p['attrs'] = {'gender': p['gender'], 'ageGroup': age_group(p['age'])}
    culprit = next(p for p in people if p['culprit'])
    innocents = [p for p in people if not p['culprit']]
    n_inn = len(innocents)

    # 프로필 속성 하나 (목격 증언) — 한두 명만 걸러지도록 너무 강하지 않은 것
    profile = None
    for attr in rng.sample(['ageGroup', 'gender'], 2):
        out = [p for p in innocents if p['attrs'][attr] != culprit['attrs'][attr]]
        if 1 <= len(out) <= max(1, n_inn // 2):
            profile = attr
            break
    by_profile = {p['id'] for p in innocents if profile and p['attrs'][profile] != culprit['attrs'][profile]}

    # 숨은 속성 값
    crime_place = rng.choice(rooms)
    c_vals = {'hand': rng.choice(list(HANDS)), 'place': crime_place, 'trace': rng.choice(TRACES)}
    other = {
        'hand': lambda: '오른손' if c_vals['hand'] == '왼손' else '왼손',
        'place': lambda: rng.choice([r for r in rooms if r != crime_place] + ['손님 휴게실', '뒷마당']),
        'trace': lambda: rng.choice([t for t in TRACES if t != c_vals['trace']]),
    }
    dims = ['hand', 'place', 'trace']
    facts = []        # (kind, fact dict, text)
    decisive = {}     # innocent id → attr

    for attr in dims:
        facts.append(('crime', {'type': 'crime', 'attr': attr, 'value': c_vals[attr]},
                      crime_text(attr, c_vals[attr], rng, rooms, objects)))
    if profile:
        facts.append(('crime', {'type': 'crime', 'attr': profile, 'value': culprit['attrs'][profile]},
                      crime_text(profile, culprit['attrs'][profile], rng, rooms, objects)))

    # 무고한 사람: 걸러 줄 관찰 1개 (프로필로 이미 걸러지는 사람은 헛다리 관찰만)
    pool = innocents[:]
    rng.shuffle(pool)
    for i, p in enumerate(pool):
        if p['id'] in by_profile:
            continue
        attr = dims[i % 3] if rng.random() < 0.7 else rng.choice(dims)
        decisive[p['id']] = attr
        val = other[attr]()
        facts.append(('decisive', {'type': 'suspect', 'suspect': p['id'], 'attr': attr, 'value': val},
                      suspect_text(p, attr, val, rng, witnesses, crime_place)))
    # 헛다리: 범인 사실과 '맞는' 관찰 (최대 3명) — 이 사람도 범인일 수 있어 보이게
    herring_pool = [p for p in pool if p['id'] not in by_profile or rng.random() < 0.5]
    for p in herring_pool[:3]:
        attr = rng.choice([d for d in dims if d != decisive.get(p['id'])])
        facts.append(('herring', {'type': 'suspect', 'suspect': p['id'], 'attr': attr, 'value': c_vals[attr]},
                      suspect_text(p, attr, c_vals[attr], rng, witnesses, crime_place)))
    # 진범: 범인 사실과 맞는 관찰 2개
    for attr in rng.sample(dims, 2):
        facts.append(('culprit', {'type': 'suspect', 'suspect': culprit['id'], 'attr': attr, 'value': c_vals[attr]},
                      suspect_text(culprit, attr, c_vals[attr], rng, witnesses, crime_place)))

    if len(facts) > 20:
        return None
    # ---- 배치: 마지막 걸러 주는 관찰을 20번에, 범인 사실은 2~14번 ----
    last = next((f for f in facts if f[0] == 'decisive'), None)
    if not last:
        return None
    slots = [None] * 21
    slots[20] = last
    rest = [f for f in facts if f is not last]
    crime_stages = rng.sample(range(2, 15), sum(1 for f in rest if f[0] == 'crime'))
    for st, f in zip(sorted(crime_stages), [f for f in rest if f[0] == 'crime']):
        slots[st] = f
    free = [s for s in range(1, 20) if slots[s] is None]
    others = [f for f in rest if f[0] != 'crime']
    for st, f in zip(sorted(rng.sample(free, len(others))), rng.sample(others, len(others))):
        slots[st] = f
    scenes = scene_pool[:]
    rng.shuffle(scenes)
    for st in range(1, 21):
        if slots[st] is None:
            slots[st] = ('scene', None, scenes.pop())

    stage_facts = [[s[1]] if s[1] else [] for s in slots[1:]]
    after19 = possible(people, stage_facts, 19)
    after20 = possible(people, stage_facts, 20)
    after10 = possible(people, stage_facts, 10)
    if after20 != [culprit['id']] or len(after19) < 2 or len(after10) < 3:
        return None
    clues = [dict(stage=st, text=slots[st][2], facts=stage_facts[st - 1]) for st in range(1, 21)]
    return clues
