#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TriPeaks Mystery Solitaire - Master Scenario Sanitizer & Converter (v2.0)
========================================================================
옵션 1: 마스터 엑셀(또는 변환된 에피소드 데이터)의 5대 문제를 일괄 해결하는 모듈입니다.
1. 잔혹한 표현(살인/독살/혈흔 등) -> 코지 미스터리 톤앤매너(도난/실종/소동 등)로 자동 순화
2. 무용지물 광고 힌트 3개 -> 진범(단독 또는 2인 공범)의 직업/배경/동기를 암시하는 결정적 힌트로 재설계
3. 배경/시대/성별 고증 오류(일본 배경의 조선/당나라, 현대의 마차, 남성 메이드 등) 자동 교정
4. 중복 에피소드 제목(92종 241화 중복) -> 배경 장소 및 사건 특성을 조합해 300화 고유 제목 부여
5. 한글 조사 템플릿('을(를)', '이(가)', '은(는)', '과(와)') 받침 유무 기반 완벽 교정 및 20번 단서 소거자 명시
"""

import re
import json
import random
from collections import Counter

# ---------------------------------------------------------
# 1. 한글 조사 자동 교정기 (받침 유무 판별)
# ---------------------------------------------------------
def has_batchim(char):
    """마지막 글자에 받침(종성)이 있는지 확인"""
    if not char:
        return False
    code = ord(char)
    if 0xAC00 <= code <= 0xD7A3:
        return (code - 0xAC00) % 28 != 0
    if char in '013678LMNRlmnr':
        return True
    return False

def fix_korean_particles(text):
    """'을(를)', '이(가)', '은(는)', '과(와)', '으로(로)' 등을 앞 글자 받침에 맞게 교정"""
    if not text:
        return text

    patterns = [
        (r'([가-힣A-Za-z0-9]+)\s*을\(를\)', lambda m: m.group(1) + ('을' if has_batchim(m.group(1)[-1]) else '를')),
        (r'([가-힣A-Za-z0-9]+)\s*를\(을\)', lambda m: m.group(1) + ('을' if has_batchim(m.group(1)[-1]) else '를')),
        (r'([가-힣A-Za-z0-9]+)\s*이\(가\)', lambda m: m.group(1) + ('이' if has_batchim(m.group(1)[-1]) else '가')),
        (r'([가-힣A-Za-z0-9]+)\s*가\(이\)', lambda m: m.group(1) + ('이' if has_batchim(m.group(1)[-1]) else '가')),
        (r'([가-힣A-Za-z0-9]+)\s*은\(는\)', lambda m: m.group(1) + ('은' if has_batchim(m.group(1)[-1]) else '는')),
        (r'([가-힣A-Za-z0-9]+)\s*는\(은\)', lambda m: m.group(1) + ('은' if has_batchim(m.group(1)[-1]) else '는')),
        (r'([가-힣A-Za-z0-9]+)\s*과\(와\)', lambda m: m.group(1) + ('과' if has_batchim(m.group(1)[-1]) else '와')),
        (r'([가-힣A-Za-z0-9]+)\s*와\(과\)', lambda m: m.group(1) + ('과' if has_batchim(m.group(1)[-1]) else '와')),
        (r'([가-힣A-Za-z0-9]+)\s*으로\(로\)', lambda m: m.group(1) + ('으로' if has_batchim(m.group(1)[-1]) and (ord(m.group(1)[-1]) - 0xAC00) % 28 != 8 else '로')),
    ]
    for pat, repl in patterns:
        text = re.sub(pat, repl, text)
    return text


# ---------------------------------------------------------
# 2. 코지 미스터리(Cozy Mystery) 어휘 순화 사전
# ---------------------------------------------------------
COZY_REPLACEMENTS = [
    (r'연쇄\s*살인\s*사건', '연쇄 도난 소동'),
    (r'밀실\s*살인\s*사건', '밀실 보물 증발 사건'),
    (r'쌍둥이\s*공범\s*살인', '쌍둥이 합작 금고 털이'),
    (r'공범\s*살인', '합작 도난 사건'),
    (r'독살\s*사건', '비법 소스 바꿔치기 사건'),
    (r'살인\s*사건', '도난 사건'),
    (r'살해\s*사건', '실종 소동'),
    (r'살인미수', '습격 소동'),
    (r'살인', '도난 소동'),
    (r'살해하였다', '빼돌렸다'),
    (r'살해했다', '빼돌렸다'),
    (r'살해하고', '빼돌리고'),
    (r'살해하려', '빼돌리려'),
    (r'살해한', '빼돌린'),
    (r'살해하', '빼돌리'),
    (r'살해된', '사라진'),
    (r'살해', '은닉'),
    (r'피살자', '피해자'),
    (r'시신', '사라진 가보'),
    (r'사체', '파손된 유물'),
    (r'주검', '빈 상자'),
    (r'치사량의\s*독극물', '강력한 수면제 가루'),
    (r'독극물', '수상한 약초 가루'),
    (r'청산가리', '강력 수면 유도제'),
    (r'비소', '가짜 향신료'),
    (r'독살', '수면제 혼입'),
    (r'혈흔', '붉은 포도주 얼룩'),
    (r'핏자국', '진흙 발자국'),
    (r'피가\s*묻은', '염료가 묻은'),
    (r'타박흔', '끌려간 자국'),
    (r'자상', '날카롭게 찢긴 흔적'),
    (r'교살흔', '묶였던 자국'),
    (r'흉기', '범행 도구'),
    (r'사망\s*추정\s*시각', '사건 발생 추정 시각'),
    (r'사망\s*시각', '사건 발생 시각'),
    (r'사인\(死因\)', '분실 경위'),
    # --- 추가 (Ep.1~10 검증 중 발견된 누락 어휘) — '살의'보다 먼저: '타살의/암살의' 안의 '살의'가 '탐욕'으로 바뀌는 것 방지 ---
    (r'익사\s*위장\s*타살', '물가 실종 위장 소동'),
    (r'타살', '계획된 소동'),
    (r'암살', '바꿔치기 계획'),
    (r'피빛', '붉은빛'),
    (r'피\s*묻은', '염료가 묻은'),
    (r'사망\s*직전', '병석에서'),
    (r'약물\s*과다\s*투여', '수면제 과다 혼입'),
    (r'살의', '탐욕'),
    # --- 추가 (V6 300화 제목) ---
    (r'검붉은\s*피를\s*머금은', '검붉은 노을을 머금은'),
    (r'피로\s*물든', '노을빛에 물든'),
]

def sanitize_to_cozy_tone(text):
    """잔혹한 범죄 용어를 따뜻하고 아기자기한 코지 미스터리 톤으로 변환"""
    if not text:
        return text
    for pat, repl in COZY_REPLACEMENTS:
        # (추가) 바뀐 단어 바로 뒤의 조사도 새 단어 받침에 맞게 다시 고른다 — '살의를' → '탐욕을' (예전: '탐욕를')
        text = re.sub(f'(?:{pat})(?:({_JOSA_ALT})(?![가-힣]))?',
                      lambda m, r=repl: r + _rejosa(r, m.group(1)), text)
    return fix_korean_particles(text)


_JOSA_PAIRS = [('으로', '로'), ('을', '를'), ('은', '는'), ('과', '와'), ('이', '가')]
_JOSA_ALT = '|'.join(j for pair in _JOSA_PAIRS for j in pair)


def _rejosa(word, josa):
    if not josa:
        return ''
    last = word[-1]
    batchim = has_batchim(last)
    for with_b, without_b in _JOSA_PAIRS:
        if josa in (with_b, without_b):
            if with_b == '으로':   # ㄹ 받침 뒤는 '로'
                return '으로' if batchim and (ord(last) - 0xAC00) % 28 != 8 else '로'
            return with_b if batchim else without_b
    return josa


# ---------------------------------------------------------
# 3. 배경·시대·성별 고증 오류 교정기
# ---------------------------------------------------------
def fix_historical_and_gender_anachronisms(text, country="", era="", gender=""):
    """국가/시대 배경과 어긋나는 표현 및 성별-직업 불일치 교정"""
    if not text:
        return text

    if "일본" in country:
        text = re.sub(r'조선\s*말기', '메이지 유신 무렵(막부 말기)', text)
        text = re.sub(r'조선\s*시대', '에도 시대', text)
        text = re.sub(r'당나라\s*번성기', '헤이안 시대 전성기', text)
        text = re.sub(r'청나라', '에도 막부', text)
    elif "중국" in country:
        text = re.sub(r'조선\s*말기', '청나라 말기', text)
        text = re.sub(r'에도\s*시대', '명·청 교체기', text)
    elif "유럽" in country or "영국" in country or "프랑스" in country:
        text = re.sub(r'조선\s*말기', '빅토리아 시대 말기', text)
        text = re.sub(r'당나라\s*번성기', '중세 봉건 시대', text)

    if any(k in era for k in ['1960', '1970', '1980', '1990', '2000', '현대', '현재', '20세기 후반', '21세기']):
        text = re.sub(r'마차\s*바퀴', '클래식 자동차 타이어', text)
        text = re.sub(r'마차', '구형 밴(승합차)', text)
        text = re.sub(r'마부', '운전기사', text)
        text = re.sub(r'주막', '심야 식당', text)
        text = re.sub(r'포졸', '순경', text)

    if gender in ['남', '남성', 'M', 'Male']:
        text = re.sub(r'메이드', '집사(하인)', text)
        text = re.sub(r'하녀', '사용인', text)
        text = re.sub(r'수녀', '수사(수도승)', text)
        text = re.sub(r'무희', '무용수', text)
        text = re.sub(r'안주인', '바깥주인', text)
    elif gender in ['여', '여성', 'F', 'Female']:
        text = re.sub(r'집사', '수석 메이드', text)
        text = re.sub(r'수도승', '수녀', text)

    return fix_korean_particles(text)


# ---------------------------------------------------------
# 4. 광고 힌트 3개 재설계 (진범 타겟팅 힌트 자동 생성)
# ---------------------------------------------------------
def generate_smart_ad_hints(suspects, motive=""):
    culprits = [s for s in suspects if s.get('isCulprit') or s.get('culprit')]
    innocents = [s for s in suspects if not (s.get('isCulprit') or s.get('culprit'))]

    if not culprits:
        return [
            "현장에 남은 흔적은 내부 사정을 가장 잘 아는 인물을 가리키고 있습니다.",
            "용의자들 중 알리바이가 끝까지 교차 검증되지 않은 인물에 주목하세요.",
            "사라진 물건의 가치를 정확히 알고 있던 인물이 진범입니다."
        ]

    if len(culprits) == 1:
        c = culprits[0]
        job = c.get('job', c.get('occupation', '내부 관계자'))
        age = c.get('age', '')
        gender = c.get('gender', '')
        desc = c.get('description', c.get('bio', ''))
        
        age_group = f"{str(age)[0]}0대" if str(age).isdigit() and len(str(age)) >= 2 else "해당 연령대"
        
        hint1 = f"[결정적 단서 1] 사건 현장에 남은 특수한 흔적은 평소 '{job}' 업무를 수행하는 인물만이 남길 수 있는 것입니다."
        hint2 = f"[결정적 단서 2] 목격자의 추가 증언에 따르면, 사건 직후 현장을 빠져나간 인물은 {age_group} {gender}성이었다고 합니다."
        if motive:
            clean_motive = sanitize_to_cozy_tone(motive)
            if c.get('name'):
                clean_motive = re.sub(re.escape(c['name']) + r'(이|가|은|는)?', '진범은 ', clean_motive)
            hint3 = f"[결정적 단서 3] 사건의 내막: '{clean_motive.strip()}' — 수첩에서 끝까지 알리바이가 입증되지 않은 인물을 지목하세요."
        elif desc:
            hint3 = f"[결정적 단서 3] 진범의 배경 조사 결과: '{desc[:40]}...'라는 사연이 확인되었습니다."
        else:
            extra_clear = innocents[-1]['name'] if innocents else '마지막 참고인'
            hint3 = f"[결정적 단서 3] 재조사 결과 '{extra_clear}'의 알리바이는 완벽히 사실로 확인되었습니다. 남은 용의자는 단 한 명뿐입니다."
        return [fix_korean_particles(hint1), fix_korean_particles(hint2), fix_korean_particles(hint3)]

    else:
        c1, c2 = culprits[0], culprits[1]
        job1 = c1.get('job', c1.get('occupation', '첫 번째 용의자'))
        job2 = c2.get('job', c2.get('occupation', '두 번째 용의자'))
        hint1 = f"[공범 힌트 1] 이 사건은 단독 범행이 아닙니다! '{job1}' 역할을 맡은 인물과 내부 조력자가 치밀하게 역할을 분담했습니다."
        hint2 = f"[공범 힌트 2] 두 번째 공범은 '{job2}' 신분을 이용해 사건 시각의 알리바이를 교묘하게 위장했습니다."
        hint3 = f"[공범 힌트 3] 20개의 단서에서 이름이 제외되지 않은 두 명({c1.get('name', '')} 외 1인 가능성)을 모두 지목해야 사건이 해결됩니다."
        return [fix_korean_particles(hint1), fix_korean_particles(hint2), fix_korean_particles(hint3)]


# ---------------------------------------------------------
# 5. 중복 제목 방지 및 반복 진범 이름 다변화
# ---------------------------------------------------------
ALTERNATIVE_SURNAMES_JP = ['사토', '스즈키', '다카하시', '와타나베', '이토', '야마모토', '나카무라', '고바야시', '가토', '요시다', '야마다', '사사키', '야마구치', '마츠모토', '이노우에', '기무라', '하야시', '시미즈']
ALTERNATIVE_GIVEN_JP_F = ['유이', '아오이', '미사키', '하루카', '사쿠라', '린이', '나나', '카오리', '아스카', '미유', '치히로', '에미']
ALTERNATIVE_GIVEN_JP_M = ['렌', '히로시', '켄지', '타쿠미', '소타', '다이키', '유토', '류노스케', '신지', '카즈야', '마코토', '코우키']

COZY_TITLE_SUFFIXES = [
    '사라진 가보의 행방',
    '한밤중의 기묘한 소동',
    '비밀 금고와 사라진 열쇠',
    '안개 속의 그림자',
    '감춰진 진실과 낡은 편지',
    '초대받지 않은 손님',
    '전설의 비법서 도난 사건',
    '봉인된 방의 수수께끼',
]

def deduplicate_title(raw_title, ep_num, location="", seen_titles=None):
    if seen_titles is None:
        seen_titles = set()
    clean_title = sanitize_to_cozy_tone(raw_title).strip()
    if clean_title not in seen_titles:
        seen_titles.add(clean_title)
        return clean_title

    suffix = COZY_TITLE_SUFFIXES[(ep_num - 1) % len(COZY_TITLE_SUFFIXES)]
    base = re.sub(r'(의\s*비밀|사건|소동)$', '', clean_title).strip()
    new_title = f"{base}: {suffix}"
    if new_title in seen_titles:
        new_title = f"{base} (제{ep_num}장: {suffix})"
    seen_titles.add(new_title)
    return new_title


def diversify_overused_culprit_names(episode, culprit_name_counter, rng):
    suspects = episode.get('suspects', [])
    for s in suspects:
        is_c = s.get('isCulprit') or s.get('culprit')
        if is_c:
            old_name = s.get('name', '')
            culprit_name_counter[old_name] += 1
            if culprit_name_counter[old_name] > 1:
                gender = s.get('gender', '여')
                surname = rng.choice(ALTERNATIVE_SURNAMES_JP)
                given = rng.choice(ALTERNATIVE_GIVEN_JP_F if '여' in gender or 'F' in gender else ALTERNATIVE_GIVEN_JP_M)
                new_name = f"{surname} {given}"
                existing_names = {x.get('name') for x in suspects}
                while new_name in existing_names:
                    new_name = f"{rng.choice(ALTERNATIVE_SURNAMES_JP)} {rng.choice(ALTERNATIVE_GIVEN_JP_F)}"
                
                s['name'] = new_name
                for clue in episode.get('clues', []):
                    if isinstance(clue, dict) and 'text' in clue:
                        clue['text'] = clue['text'].replace(old_name, new_name)
                if 'motive' in episode and episode['motive']:
                    episode['motive'] = episode['motive'].replace(old_name, new_name)


# ---------------------------------------------------------
# 6. 에피소드 전체 파이프라인 실행 함수
# ---------------------------------------------------------
def sanitize_episode_dataset(episodes):
    seen_titles = set()
    culprit_name_counter = Counter()

    for idx, ep in enumerate(episodes, start=1):
        ep_id = ep.get('id', idx)
        rng = random.Random(ep_id * 9973)

        country = ep.get('country', ep.get('region', '일본'))
        era = ep.get('era', ep.get('period', '현대'))

        ep['title'] = deduplicate_title(ep.get('title', f'에피소드 {ep_id}'), ep_id, country, seen_titles)

        if 'synopsis' in ep:
            ep['synopsis'] = fix_historical_and_gender_anachronisms(sanitize_to_cozy_tone(ep['synopsis']), country, era)
        if 'motive' in ep:
            ep['motive'] = fix_historical_and_gender_anachronisms(sanitize_to_cozy_tone(ep['motive']), country, era)

        suspects = ep.get('suspects', [])
        for s in suspects:
            g = s.get('gender', '')
            if 'job' in s:
                s['job'] = fix_historical_and_gender_anachronisms(sanitize_to_cozy_tone(s['job']), country, era, g)
            if 'description' in s:
                s['description'] = fix_historical_and_gender_anachronisms(sanitize_to_cozy_tone(s['description']), country, era, g)

        diversify_overused_culprit_names(ep, culprit_name_counter, rng)

        rng.shuffle(suspects)
        ep['suspects'] = suspects

        clues = ep.get('clues', [])
        for c_idx, clue in enumerate(clues, start=1):
            if isinstance(clue, dict):
                txt = sanitize_to_cozy_tone(clue.get('text', ''))
                txt = fix_historical_and_gender_anachronisms(txt, country, era)
                elim_target = clue.get('eliminates') or clue.get('targetName')
                if (c_idx == 20 or clue.get('id') == 20 or c_idx == len(clues)) and elim_target and elim_target not in txt:
                    txt = f"{txt} ({elim_target} 용의선상 제외)"
                clue['text'] = txt

        ep['hints'] = generate_smart_ad_hints(suspects, ep.get('motive', ''))

    return episodes
