"""
마스터 엑셀(TriPeaks_Mystery_300_Episodes_Master.xlsx) → js/data/episodes.js 변환기

사용법 (프로젝트 루트에서):
    python tools/import_episodes.py <xlsx 경로> [--from 1] [--to 10] [--check-all]

하는 일
  1. 300_Episodes_Overview / Suspects_Master_Pool / Clues_Matrix_6900 시트에서 지정 범위 에피소드 추출
  2. 게임 데이터 형식(TP.EPISODES)으로 변환
       - 단서의 '소거 대상 용의자 ID' → facts: [{ type: 'clear', suspect }]  (mystery.js가 그대로 추론에 사용)
       - 광고 힌트 3종 → hints: [{ text, eliminate }]
       - 템플릿 조사 표기 "을(를)", "이(가)", "은(는)", "와(과)" 를 받침에 맞게 자동 선택
       - 소거 대상이 있는데 본문에 그 이름이 없으면 "(○○ 용의선상 제외)"를 덧붙여 플레이어가 추론할 수 있게 함
  3. tools/sanitize_episodes.py 로 정제 (엑셀 파싱 직후, episodes.js 쓰기 직전)
       - 살인/독살/혈흔 등 → 코지 미스터리 어휘, 시대·성별 고증 교정, 중복 제목 해소,
         반복되는 진범 이름 교체, 용의자 순서 섞기(원본은 진범이 항상 3번째),
         광고 힌트 3종을 진범의 직업·연령·동기를 암시하는 힌트로 재작성
  4. 논리 검증 리포트 출력 (진범 소거 여부, 19단서 이전 확정 여부, 잔여 수 불일치, 힌트 실효성, 중복 제목 등)
     --check-all 을 주면 300개 전체를 검사만 하고 요약을 출력한다.

엑셀은 원본 그대로 두고 읽기만 한다.
"""
import argparse
import hashlib
import json
import random
import re
import sys
from collections import Counter, defaultdict

import openpyxl

sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))  # python -P 실행 대비
import sanitize_episodes as sanitize                      # tools/sanitize_episodes.py (같은 폴더)
from sanitize_episodes import sanitize_episode_dataset
import episode_art                                         # tools/episode_art.py (배경·초상화·단서 소품 배정)

sys.stdout.reconfigure(encoding='utf-8')

ROOT_OUT = 'js/data/episodes.js'

# 에피소드 1의 일러스트 초상화 (직업 + 성별이 그림과 맞을 때만 연결)
EP1_PORTRAITS = {
    '료칸 주인': ('game_assets/portrait_ep01_01.png', '남'),
    '수석 주방장': ('game_assets/portrait_ep01_02.png', '남'),
    '메이드': ('game_assets/portrait_ep01_03.png', '여'),
    '여행 화가': ('game_assets/portrait_ep01_04.png', '남'),
    '골동품 감정사': ('game_assets/portrait_ep01_05.png', '남'),
    '보일러 기사': ('game_assets/portrait_ep01_06.png', '남'),
    '마을 의사': ('game_assets/portrait_ep01_07.png', '남'),
    '마을 순경': ('game_assets/portrait_ep01_08.png', '남'),
}

# 초상화가 없는 용의자는 직업 키워드로 이모지를 고른다
JOB_EMOJI = [
    ('주방', '🍳'), ('요리', '🍳'), ('의사', '🩺'), ('간호', '🩺'), ('순경', '👮'), ('경찰', '👮'), ('형사', '👮'),
    ('화가', '🎨'), ('작가', '✒️'), ('기자', '📰'), ('선장', '⚓'), ('어부', '🎣'), ('기사', '🔧'), ('정비', '🔧'),
    ('메이드', '🧹'), ('하녀', '🧹'), ('집사', '🎩'), ('주인', '🏮'), ('지배인', '🗝️'), ('감정사', '🏺'), ('골동품', '🏺'),
    ('상인', '💼'), ('사업', '💼'), ('교수', '📜'), ('학자', '📜'), ('학생', '🎒'), ('배우', '🎭'), ('가수', '🎤'),
    ('승려', '📿'), ('신부', '⛪'), ('귀족', '👑'), ('백작', '👑'), ('변호사', '⚖️'), ('은행', '🏦'), ('사진', '📷'),
]
COLORS = ['#c96b6b', '#e0894a', '#8a6db5', '#5fae7a', '#a0784f', '#5b7bb5', '#6f9aa0', '#3f5f9a', '#c45f8a', '#7a8a99']

EP_SUFFIX = re.compile(r'\s*\(Ep\.\d+\)\s*$')
JOSA = re.compile(r'([가-힣A-Za-z0-9)\]』」]?)(을\(를\)|를\(을\)|이\(가\)|가\(이\)|은\(는\)|는\(은\)|와\(과\)|과\(와\)|으로\(로\)|로\(으로\))')


def has_batchim(ch):
    if not ch:
        return False
    code = ord(ch) - 0xAC00
    if 0 <= code < 11172:
        return code % 28 != 0
    return ch in '0136789LMNRlmnr'  # 숫자·영문 끝소리 근사


def fix_josa(text):
    pairs = {'을': ('을', '를'), '를': ('을', '를'), '이': ('이', '가'), '가': ('이', '가'),
             '은': ('은', '는'), '는': ('은', '는'), '와': ('과', '와'), '과': ('과', '와')}

    def repl(m):
        prev, token = m.group(1), m.group(2)
        if token.startswith('으로') or token.startswith('로'):
            code = ord(prev) - 0xAC00 if prev else -1
            rieul = 0 <= code < 11172 and code % 28 == 8
            return prev + ('로' if (not has_batchim(prev) or rieul) else '으로')
        with_b, without_b = pairs[token[0]]
        return prev + (with_b if has_batchim(prev) else without_b)

    return JOSA.sub(repl, text)


def clean_title(t):
    return EP_SUFFIX.sub('', str(t)).strip()


def split_ids(v):
    if v is None:
        return []
    s = str(v).strip()
    if s in ('', '-'):
        return []
    return [x.strip() for x in s.split(',') if x.strip()]


def color_for(sid):
    return COLORS[int(hashlib.md5(sid.encode()).hexdigest(), 16) % len(COLORS)]


def emoji_for(job):
    for key, e in JOB_EMOJI:
        if key in job:
            return e
    return '🕵️'


def load(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    overview, suspects, clues = {}, defaultdict(list), defaultdict(list)
    for r in wb['300_Episodes_Overview'].iter_rows(min_row=3, values_only=True):
        if r[0] is None:
            continue
        no = int(r[0])
        overview[no] = dict(no=no, title=clean_title(r[1]), region=r[2], country=r[3], era=r[4], scene=r[5],
                            case_type=r[6], synopsis=r[7], suspect_count=int(r[8]), culprit_ids=split_ids(r[10]),
                            culprit_name=r[11], motive_type=r[12], motive=r[13])
    for r in wb['Suspects_Master_Pool'].iter_rows(min_row=3, values_only=True):
        if r[1] is None:
            continue
        suspects[int(r[2])].append(dict(id=r[1], name=r[4], gender=r[5], age=r[6], job=r[7], background=r[8],
                                        alibi=r[9], culprit=str(r[10]).upper() == 'TRUE'))
    for r in wb['Clues_Matrix_6900'].iter_rows(min_row=3, values_only=True):
        if r[1] is None:
            continue
        clues[int(r[2])].append(dict(id=r[1], slot=str(r[4]), kind=r[5], text=r[6], facts=r[7],
                                     cleared=split_ids(r[8]), remaining=r[9]))
    return overview, suspects, clues


def validate(no, ov, sus, cl):
    """논리·데이터 검증. (오류 목록, 경고 목록)"""
    errors, warns = [], []
    ids = [s['id'] for s in sus]
    by_id = {s['id']: s for s in sus}
    culprits = set(ov['culprit_ids'])
    stages = sorted([c for c in cl if not c['slot'].upper().startswith('HINT')], key=lambda c: int(c['slot']))
    hints = [c for c in cl if c['slot'].upper().startswith('HINT')]

    if len(sus) != ov['suspect_count']:
        warns.append(f"용의자 수 불일치: 개요 {ov['suspect_count']} / 목록 {len(sus)}")
    flagged = [s['id'] for s in sus if s['culprit']]
    if set(flagged) != culprits:
        errors.append(f"진범 표시 불일치: 개요 {sorted(culprits)} / 용의자 시트 {flagged}")
    sheet_names = [by_id[c]['name'] for c in ov['culprit_ids'] if c in by_id]
    if any(n not in str(ov['culprit_name']) for n in sheet_names):
        warns.append(f"진범 이름 불일치: 개요 {ov['culprit_name']} / 용의자 시트 {sheet_names}")
    if len(culprits) > 1:
        warns.append(f"공범 사건: 진범 {len(culprits)}명 (모두 지목해야 해결)")
    if [int(c['slot']) for c in stages] != list(range(1, 21)):
        errors.append(f"스테이지 단서가 1~20이 아님: {[c['slot'] for c in stages]}")
    if len(hints) != 3:
        errors.append(f"힌트 {len(hints)}개 (3개여야 함)")

    alive = set(ids)
    remaining_after = []
    for c in stages:
        for x in c['cleared']:
            if x not in by_id:
                errors.append(f"단서 {c['slot']}: 없는 용의자 ID {x}")
            if x in culprits:
                errors.append(f"단서 {c['slot']}: 진범을 소거함")
            if x not in alive and x in by_id:
                warns.append(f"단서 {c['slot']}: 이미 소거된 {x} 재소거")
        alive -= set(c['cleared'])
        remaining_after.append(len(alive))
        try:
            if int(c['remaining']) != len(alive):
                warns.append(f"단서 {c['slot']}: 잔여 수 표기 {c['remaining']} / 실제 {len(alive)}")
        except (TypeError, ValueError):
            pass
        names_missing = [by_id[x]['name'] for x in c['cleared'] if x in by_id and by_id[x]['name'] not in str(c['text'])]
        if names_missing:
            warns.append(f"단서 {c['slot']}: 본문에 소거 대상 이름 없음 → 자동 보충 ({', '.join(names_missing)})")
    if alive != culprits:
        errors.append(f"20단서 후 남은 용의자 {sorted(alive)} (진범만 남아야 함)")
    if len(remaining_after) >= 19 and remaining_after[18] <= len(culprits):
        errors.append('19단서 이전에 범인이 확정됨')

    alive19 = set(ids) - {x for c in stages[:19] for x in c['cleared']}
    useful = 0
    for h in hints:
        if culprits & set(h['cleared']):
            errors.append(f"{h['slot']}: 진범을 소거함")
        if set(h['cleared']) & (alive19 - culprits):
            useful += 1
    if hints and useful == 0:
        warns.append('힌트 3종 모두 19단서 시점에 이미 소거된 용의자만 다룸 (힌트가 추리에 도움이 안 됨)')
    for c in cl:
        if JOSA.search(str(c['text'])):
            warns.append('조사 템플릿 표기 "을(를)" 등 → 자동 교정')
            break
    return errors, warns


def to_sanitizer_schema(no, ov, sus, cl):
    """엑셀 파싱 결과 → sanitize_episodes.py 가 기대하는 형태
    (id, title, country, era, synopsis, motive, suspects[{name, gender, age, job, description, culprit}], clues[{text}])"""
    culprits = set(ov['culprit_ids'])
    stages = sorted([c for c in cl if not c['slot'].upper().startswith('HINT')], key=lambda c: int(c['slot']))
    return dict(
        id=no, title=ov['title'], country=ov['country'], era=ov['era'], region=ov['region'],
        case_type=ov['case_type'], motive_type=ov['motive_type'], culprit_ids=ov['culprit_ids'],
        synopsis=str(ov['synopsis']), motive=str(ov['motive']),
        suspects=[dict(sid=x['id'], name=x['name'], gender=x['gender'], age=x['age'], job=str(x['job']),
                       description=str(x['background']), alibi=str(x['alibi']), culprit=x['id'] in culprits)
                  for x in sus],
        clues=[dict(stage=int(c['slot']), text=str(c['text']), cleared=c['cleared']) for c in stages],
    )


def convert(ep):
    """정제가 끝난 에피소드 → 게임 데이터(TP.EPISODES 항목)"""
    no = ep['id']
    country, era = ep['country'], ep['era']
    by_id = {x['sid']: x for x in ep['suspects']}
    # 정제 모듈이 다루지 않는 필드(시대·사건 유형·알리바이)도 같은 규칙으로 순화·고증 교정
    era_fixed = sanitize.fix_historical_and_gender_anachronisms(era, country, era)
    case_type = sanitize.sanitize_to_cozy_tone(str(ep['case_type']))

    def clue_text(c):
        text = fix_josa(c['text'].strip())
        # 소거 대상인데 본문에 이름이 없으면 덧붙임 (정제 모듈이 바꾼 이름 기준)
        missing = [by_id[x]['name'] for x in c['cleared'] if x in by_id and by_id[x]['name'] not in text]
        if missing:
            text += f" ({', '.join(missing)} 용의선상 제외)"
        return text

    # 초상화: Ep.1 전용 일러스트 → 없으면 생성 이미지 풀에서 대륙·직업·성별로 배정 (episode_art.py)
    dedicated = {x['sid']: EP1_PORTRAITS[x['job']][0] for x in ep['suspects']
                 if no == 1 and x['job'] in EP1_PORTRAITS and EP1_PORTRAITS[x['job']][1] == x['gender']}
    rest = [x for x in ep['suspects'] if x['sid'] not in dedicated]
    pooled = dict(zip((x['sid'] for x in rest), episode_art.assign_portraits(ep['region'], rest)))
    scene_text = f"{ep['title']} {ep['case_type']} {ep['synopsis']}"
    background = 'game_assets/bg_detective_office.png' if no == 1 else episode_art.bg_for(no, country, scene_text)

    suspects = []
    for x in ep['suspects']:            # 순서는 정제 모듈이 에피소드별 고정 시드로 섞은 그대로
        portrait = dedicated.get(x['sid']) or pooled.get(x['sid'])
        suspects.append(dict(
            id=x['sid'], name=x['name'], job=x['job'],
            trait=f"{x['gender']} · {x['age']}세. {fix_josa(x['description'])}",
            alibi=fix_josa(sanitize.sanitize_to_cozy_tone(x['alibi'])),
            emoji=emoji_for(x['job']), color=color_for(x['sid']), portrait=portrait,
        ))
    culprit_list = [by_id[c] for c in ep['culprit_ids'] if c in by_id]
    who = ', '.join(f"{c['job']} {c['name']}" for c in culprit_list)
    return dict(
        episodeId=f'ep{no:03d}',
        no=no,
        title=ep['title'],
        subtitle=f"{country} · {era_fixed} · {case_type}",
        intro=fix_josa(ep['synopsis']),
        region=ep['region'], country=country, era=era_fixed, caseType=case_type,
        motiveType=ep['motive_type'],
        background=background,
        thumb='game_assets/card_episode_thumb_01.png' if no == 1 else background,
        actualCulpritId=ep['culprit_ids'][0],          # 단독 범행 호환용 (첫 번째 진범)
        actualCulpritIds=ep['culprit_ids'],            # 공범 사건이면 2명 이상 — 모두 지목해야 해결
        suspects=suspects,
        clues=[dict(stage=c['stage'], text=clue_text(c), prop=episode_art.clue_prop_for(c['text']),
                    facts=[{'type': 'clear', 'suspect': x} for x in c['cleared']]) for c in ep['clues']],
        # 정제 모듈이 만든 광고 힌트(진범의 직업·연령·동기 암시). 특정 용의자를 소거하지 않는다.
        hints=[dict(text=h, eliminate=[]) for h in ep['hints']],
        rewards=dict(gold=1000, undo=1, wild=1),   # 에피소드 해결 보상 (completeCurrentEpisode 기본값과 같음)
        solutionText=(f"{'공범은' if len(culprit_list) > 1 else '진범은'} {who}. "
                      f"동기는 {ep['motive_type']} — {fix_josa(ep['motive'])}"),
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx')
    ap.add_argument('--from', dest='start', type=int, default=1)
    ap.add_argument('--to', dest='end', type=int, default=10)
    ap.add_argument('--roadmap', type=int, default=3, help='에피소드 메뉴에 "출시 예정"으로 보여 줄 다음 에피소드 수')
    ap.add_argument('--check-all', action='store_true')
    ap.add_argument('--out', default=ROOT_OUT)
    args = ap.parse_args()

    overview, suspects, clues = load(args.xlsx)

    if args.check_all:
        err_eps, warn_count = Counter(), Counter()
        for no in sorted(overview):
            e, w = validate(no, overview[no], suspects[no], clues[no])
            for x in e:
                err_eps[re.sub(r'\d+|SUS-[\d-]+|\[.*?\]|\{.*?\}', '#', x)] += 1
            for x in w:
                warn_count[re.sub(r'\d+|SUS-[\d-]+|\(.*?\)|\[.*?\]', '#', x)] += 1
        titles = Counter(o['title'] for o in overview.values())
        names = Counter(o['culprit_name'] for o in overview.values())
        print('공범(진범 2명 이상) 사건:', sum(1 for o in overview.values() if len(o['culprit_ids']) > 1))
        print(f"=== 전체 {len(overview)}개 에피소드 검사 ===")
        print('오류 유형 (에피소드 수):', dict(err_eps) or '없음')
        print('경고 유형 (에피소드 수):', dict(warn_count))
        print(f"중복 제목: {sum(1 for c in titles.values() if c > 1)}종 ({sum(c for c in titles.values() if c > 1)}개 에피소드)")
        print('진범 이름 최다 반복:', names.most_common(5))
        return

    episodes, report = [], []
    for no in range(args.start, args.end + 1):
        ov = overview[no]
        e, w = validate(no, ov, suspects[no], clues[no])   # 논리 검증은 원본 기준
        report.append((no, ov['title'], e, w))
        episodes.append(to_sanitizer_schema(no, ov, suspects[no], clues[no]))

    # 정제: 코지 톤 순화 · 고증/성별 교정 · 중복 제목 · 반복 진범 이름 · 용의자 순서 섞기 · 광고 힌트 재설계
    episodes = sanitize_episode_dataset(episodes)
    episodes = [convert(ep) for ep in episodes]

    roadmap = [dict(no=n, title=sanitize.sanitize_to_cozy_tone(overview[n]['title']),
                    teaser=f"{overview[n]['country']} · {sanitize.sanitize_to_cozy_tone(str(overview[n]['case_type']))}")
               for n in range(args.end + 1, args.end + 1 + args.roadmap) if n in overview]

    js = ("// 자동 생성 파일 — 직접 고치지 말고 tools/import_episodes.py 로 다시 만들 것\n"
          f"// 원본: TriPeaks_Mystery_300_Episodes_Master.xlsx · 에피소드 {args.start}~{args.end}\n"
          "// 구조 설명은 js/data/episodes.schema.md 참고\n"
          "(function () {\n"
          "  const TP = (globalThis.TP ??= {});\n"
          f"  TP.EPISODES = {json.dumps(episodes, ensure_ascii=False, indent=2)};\n"
          f"  TP.EPISODE_ROADMAP = {json.dumps(roadmap, ensure_ascii=False, indent=2)};\n"
          "})();\n")
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)

    print(f"→ {args.out}: 에피소드 {len(episodes)}개, 용의자 {sum(len(x['suspects']) for x in episodes)}명, "
          f"단서 {sum(len(x['clues']) for x in episodes)}개, 힌트 {sum(len(x['hints']) for x in episodes)}개")
    for no, title, e, w in report:
        print(f"\n[Ep.{no:03d}] {title}  — 오류 {len(e)} / 경고 {len(w)}")
        for x in e:
            print('   ❌', x)
        for x in w:
            print('   ⚠', x)


if __name__ == '__main__':
    main()
