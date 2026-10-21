"""
원본 데이터 손질 (2026-10-20, docs/i18n/EPISODE_AUDIT.md 2-4 · 2-5 · 2-8) — 한 번만 돌리는 기록용 스크립트

    python tools/fix_source_v6.py          # data/TriPeaks_300_Episodes_V6_Sorted.csv · data/V6_300_Episodes_Logic_Clues.json 수정
    python tools/import_episodes_v6.py      # → js/data/episodes.js 다시 생성

  - 비슷한 이름 (한 사건 안에서 한 이름이 다른 이름 속에 들어 있음): 41화 하루카 → 미오 · 59화 히나 → 모모카 · 99화 위안 → 샤오란
    (CSV 용의자 + 논리 JSON 의 용의자 · 정답 · 단서 1~21 문장. 받침이 같은 이름으로 바꿔 조사는 그대로)
  - 성별과 맞지 않는 직업: 여성 신부 → 목사, 남성 수녀 → 수도사, 남성 전속 메이드 → 집사 (초상화 4장은 옷차림을 새로 그림)
  - 설정 모순 (열대 도시의 눈 · 내륙 도시의 유람선 · 겹말): 장소 분위기 낱말 · 제목 수정. 눈이 그려진 배경 6장은 새로 그림
    (game_assets/episodes/ep_bg · ep_thumb — 원본 1376×768 은 ../assets_original_backup/game_assets/background)
이미 고친 파일에 다시 돌려도 바뀌는 것이 없다.
"""
import csv
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, 'data', 'TriPeaks_300_Episodes_V6_Sorted.csv')
LOGIC_PATH = os.path.join(ROOT, 'data', 'V6_300_Episodes_Logic_Clues.json')

# 에피소드: (옛 이름, 새 이름, 새 이름이 다른 이름 속 글자와 겹치지 않게 막을 뒤 글자)
RENAMES = {41: ('하루카', '미오', ''), 59: ('히나', '모모카', '타'), 99: ('위안', '샤오란', ''),
           140: ('카이', '마카나', ''), 263: ('쥘', '노엘', '리'),
           249: [('시안', '키안', ''), ('에오인', '로신', '')], 180: ('마르틴', '마티아스', '')}
# 140 이카이카 · 263 쥘리에트와 겹침 (263 은 이미 '폴'이 있어 노엘) · 249 더블린 남성 = Cian, 여성 에오인(Eoin 은 남자 이름) = Róisín
# 180 영어로 Martin ⊂ Martina (같은 화에 마르티나)
JOBS = {   # 에피소드: {이름: (옛 직업, 새 직업)}
    2: {'보원': ('전속 메이드', '집사')},
    5: {'카밀': ('신부', '목사')},          # 초상화가 로만 칼라 차림 → 목사
    18: {'나타폰': ('수녀', '수도사')},
    35: {'나나미': ('신부', '목사')},
    44: {'샤오퉁': ('신부', '목사')},
    45: {'신이': ('신부', '목사')},
    58: {'민지': ('신부', '목사'), '진우': ('수녀', '수도사')},   # 진우는 퍼즐 밖 용의자 (화면에 안 나옴)
    79: {'밍웨이': ('전속 메이드', '집사')},
    97: {'꽝하이': ('전속 메이드', '집사')},
}
PLACES = {
    7: ('울란바토르의 바람 부는 유람선 선실', '홉스골 호수의 바람 부는 유람선 선실'),    # 울란바토르는 내륙 → 몽골 최대 호수의 유람선
    11: ('마닐라의 낡은 오래된 성당', '마닐라의 조용한 오래된 성당'),
    15: ('싱가포르의 눈 덮인 카지노 VIP룸', '싱가포르의 비 내리는 카지노 VIP룸'),
    18: ('방콕의 눈 덮인 도서관', '방콕의 비 내리는 도서관'),
    45: ('싱가포르의 눈 덮인 도서관', '싱가포르의 안개 낀 도서관'),
    56: ('뭄바이의 눈 덮인 골목길 다방', '뭄바이의 비 내리는 골목길 다방'),
    65: ('도쿄의 눈 덮인 지하 주차장', '도쿄의 비 내리는 지하 주차장'),
    92: ('홍콩의 눈 덮인 오래된 성당', '홍콩의 안개 낀 오래된 성당'),
    # 101화~ (2026-10-21) — 눈이 그려진 배경 6장(119 · 132 · 155 · 170 · 178 · 205)도 같은 구도로 다시 그림
    119: ('로스앤젤레스의 눈 덮인 카지노 VIP룸', '로스앤젤레스의 화려한 카지노 VIP룸'),
    132: ('마이애미의 눈 덮인 재즈 클럽', '마이애미의 비 내리는 재즈 클럽'),
    155: ('보고타의 눈 덮인 극장 무대 뒤', '보고타의 비 내리는 극장 무대 뒤'),
    170: ('리마의 눈 덮인 오래된 성당', '리마의 안개 낀 오래된 성당'),
    178: ('리우데자네이루의 눈 덮인 박물관 전시실', '리우데자네이루의 비 내리는 박물관 전시실'),
    205: ('다카르의 눈 덮인 재즈 클럽', '다카르의 비 내리는 재즈 클럽'),
    225: ('나이로비의 낡은 오래된 성당', '나이로비의 조용한 오래된 성당'),
    117: ('샌프란시스코의 눈 덮인 재즈 클럽', '샌프란시스코의 안개 낀 재즈 클럽'),     # 눈이 거의 안 오는 도시 — 배경 3장도 다시 그림
    221: ('케이프타운의 눈 덮인 항구 창고', '케이프타운의 바람 부는 항구 창고'),
    287: ('웰링턴의 눈 덮인 카지노 VIP룸', '웰링턴의 바람 부는 카지노 VIP룸'),
}
# 따뜻한 도시 제목의 '눈보라에 고립된' → '폭우에 고립된'
WARM_CITIES = {'싱가포르', '방콕', '마닐라', '뭄바이', '호이안', '홍콩', '타이베이', '마이애미', '하와이', '리우데자네이루', '리마', '카르타헤나',
               '나이로비', '다카르', '잔지바르', '마라케시', '카이로', '기자', '카사블랑카', '타히티', '피지', '아디스아바바', '상파울루', '보고타',
               '갈라파고스', '로스앤젤레스', '라스베이거스', '텍사스', '샌프란시스코', '케이프타운', '웰링턴', '시드니', '오클랜드'}
# 성별과 맞지 않는 직업 — 모든 인물(퍼즐 밖 용의자 포함)에 같은 규칙
GENDER_JOB = {('신부', '여'): '목사', ('수녀', '남'): '수도사', ('전속 메이드', '남'): '집사'}


def fix_gender_jobs(text):
    def sub(m):
        new = GENDER_JOB.get((m.group(4), m.group(3)))
        return f'{m.group(1)}{m.group(2)}세/{m.group(3)}/{new})' if new else m.group(0)
    return re.sub(r'([^,()]+? \()(\d+)세/([남여])/([^)]+)\)', sub, text)
TITLES = {
    7: ('눈보라에 고립된 울란바토르의 심판', '눈보라에 고립된 홉스골의 심판'),
    15: ('눈보라에 고립된 싱가포르의 절규', '폭우에 고립된 싱가포르의 절규'),
}


def renames_of(no):
    r = RENAMES.get(no, [])
    return r if isinstance(r, list) else [r]


def rename_text(text, old, new, not_before):
    pat = r'(?<![가-힣])' + re.escape(old) + (f'(?!{re.escape(not_before)})' if not_before else '')   # 다른 이름 속 글자는 건드리지 않음 (신위안 ≠ 위안)
    return re.sub(pat, new, text)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    txt = open(CSV_PATH, 'rb').read().decode('utf-8-sig')
    rows = list(csv.reader(io.StringIO(txt, newline='')))
    head = rows[0]
    col = {h.strip(): i for i, h in enumerate(head)}
    changed = 0
    for r in rows[1:]:
        if not r or not r[0].strip():
            continue
        no = int(re.sub(r'\D', '', r[col['에피소드']]))
        before = list(r)
        for old, new, nb in renames_of(no):
            for key in ('진범', '용의자들'):
                r[col[key]] = rename_text(r[col[key]], old + ' (', new + ' (', '')
        for name, (oj, nj) in JOBS.get(no, {}).items():
            for key in ('진범', '용의자들'):
                for o in (oj, '수녀'):     # '수녀' = 이 스크립트의 첫 판이 고쳤던 값 (→ 목사로 다시)
                    r[col[key]] = re.sub(rf'({re.escape(name)} \(\d+세/[남여]/){re.escape(o)}\)', rf'\g<1>{nj})', r[col[key]])
        for key in ('진범', '용의자들'):
            r[col[key]] = fix_gender_jobs(r[col[key]])
        if no in PLACES and r[col['장소']].strip() == PLACES[no][0]:
            r[col['장소']] = PLACES[no][1]
        if r[col['장소']].split('의 ')[0] in WARM_CITIES and r[col['제목']].startswith('눈보라에 고립된 '):
            r[col['제목']] = '폭우에 고립된 ' + r[col['제목']][len('눈보라에 고립된 '):]
        if no in TITLES:
            r[col['제목']] = r[col['제목']].replace(TITLES[no][0], TITLES[no][1])
        if r != before:
            changed += 1
            print(f'CSV Ep.{no}: ' + ' · '.join(f'{head[i].strip()}' for i in range(len(r)) if r[i] != before[i]))
    out = io.StringIO(newline='')
    csv.writer(out, lineterminator='\n').writerows(rows)
    with open(CSV_PATH, 'wb') as f:
        f.write(('﻿' + out.getvalue()).encode('utf-8'))

    logic = json.load(open(LOGIC_PATH, encoding='utf-8'))
    for e in logic:
        no = e['에피소드']
        for old, new, nb in renames_of(no):
            e['용의자'] = [new if n == old else n for n in e['용의자']]
            e['정답'] = {(new if k == old else k): v for k, v in e['정답'].items()}
            if e['진범'] == old:
                e['진범'] = new
            for k in list(e):
                if k.startswith('단서 ') and isinstance(e[k], str):
                    e[k] = rename_text(e[k], old, new, nb)
            print(f'논리 Ep.{no}: {old} → {new}')
        if no in PLACES and e.get('장소') == PLACES[no][0]:
            e['장소'] = PLACES[no][1]
    with open(LOGIC_PATH, 'w', encoding='utf-8') as f:
        json.dump(logic, f, ensure_ascii=False, indent=1)
    print(f'CSV {changed}행 수정')


if __name__ == '__main__':
    main()
