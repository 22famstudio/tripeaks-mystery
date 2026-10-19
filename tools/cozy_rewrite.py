"""
코지 미스터리 톤 일괄 순화 — Claude API (LLM) 버전

  '동기'와 '진범의 고백' 텍스트에서 살인 · 유혈 · 흉기 같은 무거운 표현을 찾아
  코지 미스터리 톤(기절 · 창고에 가둠 · 수면제로 재움 · 대중 앞 망신 / 비밀 레시피 · 마을 명물 · 반려동물 소동)으로
  다시 쓴 뒤 episodes_cozy.json 으로 저장한다. 원본 파일은 고치지 않는다.

  규칙 기반 기본값은 tools/cozy_rules.py (API 없이 importer 가 바로 적용). 이 스크립트는 문장을 새로 쓰고 싶을 때.

사용법
  python tools/cozy_rewrite.py data/TriPeaks_300_Episodes_V6_Sorted.csv --dry-run        # 금지어 보고만 (API 호출 없음)
  set ANTHROPIC_API_KEY=sk-ant-...      (PowerShell: $env:ANTHROPIC_API_KEY = "sk-ant-...")
  python tools/cozy_rewrite.py data/TriPeaks_300_Episodes_V6_Sorted.csv -o data/episodes_cozy.json
  python tools/cozy_rewrite.py episodes_raw.json --limit 10 --model claude-sonnet-5-5 --batch-size 5

입력: .csv / .json (객체 배열) / .xlsx (openpyxl 필요)
  동기 컬럼   : '살해 동기' 또는 '동기'
  고백 컬럼   : '스토리(진범의 고백)' 또는 '진범의 고백' 또는 '게임 고백 문장'
  번호 컬럼   : '에피소드' 또는 '에피소드 ID' (없으면 줄 번호)

출력 (episodes_cozy.json): [{ 에피소드, 동기, 진범의 고백, 원본 동기, 원본 고백, 바뀜, 남은 금지어 }]
캐시: <출력 파일>.cache.json — 같은 원문 + 같은 프롬프트 버전은 다시 요청하지 않는다 (중간에 끊겨도 이어서 실행).
"""
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cozy_rules  # noqa: E402
import sanitize_episodes  # noqa: E402

API_URL = 'https://api.anthropic.com/v1/messages'
DEFAULT_MODEL = 'claude-sonnet-5-5'
PROMPT_VERSION = 'cozy-v1'

MOTIVE_KEYS = ['살해 동기', '동기']
CONFESSION_KEYS = ['스토리(진범의 고백)', '진범의 고백', '게임 고백 문장']
ID_KEYS = ['에피소드', '에피소드 ID', 'episodeId', 'no']

# ---------------------------------------------------------------------------
# 프롬프트 (시스템 = 규칙 · 예시 / 사용자 = 이번 배치 JSON)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """당신은 모바일 캐주얼 게임 '트라이픽스 추리 솔리테어'의 한국어 시나리오 에디터입니다.
이 게임은 코지 미스터리(Cozy Mystery) 장르입니다. 남녀노소 누구나 편하게 즐기는 아기자기한 소동극이어야 하며,
유혈 · 잔혹한 살인 · 공포스러운 분위기가 절대 없어야 합니다.

## 할 일
각 에피소드의 '동기'와 '진범의 고백'을 코지 미스터리 톤으로 다시 씁니다.

## 금지어 · 금지 상황 (결과에 한 번도 나오면 안 됨)
살인, 살해, 피(유혈 의미), 피눈물, 시체, 시신, 토막, 치명상, 암살, 독살, 흉기, 칼날, 총성, 죽음, 죽이다/죽였다/죽어/죽일,
목숨, 숨이 멎다/끊어지다, 비명, 지옥, 괴물, 처단, 단죄, 사형, 복수, 뺑소니, 학대, 고문, 자살
(일상어인 '커피를', '책갈피', '창피', '피로가 풀리다'는 괜찮습니다.)

## 대체 규칙
- 살인 → 기절시킴 / 창고 · 지하실에 가둠 / 수면제를 탄 홍차로 푹 재움 / 마을 사람들 앞에서 망신을 줌
- 절도 → 가문의 비밀 레시피를 훔침 / 마을 명물(트로피 · 조각상 · 우승 호박)을 빼돌림 / 반려동물(고양이 · 앵무새)을 몰래 데려감
- 흉기 → 밀가루 포대 / 수면제가 든 홍차 / 잠긴 방문 / 미끄러운 버터
- 복수 · 원한 → 앙갚음 · 해묵은 앙금 · 골탕 먹이기
- 피해자는 다치지 않습니다. 잠들거나, 갇히거나, 망신을 당하거나, 물건을 잃을 뿐입니다.

## 반드시 지킬 것
1. 인물의 감정선(질투 · 배신감 · 억울함 · 후회 · 뻔뻔함)과 말투(존댓말/반말, 문장 수)는 원문 그대로 살립니다.
2. 고유명사(사람 이름 · 지명 · 직업)와 사건의 큰 줄거리(누가, 왜)는 바꾸지 않습니다.
3. 고백은 원문과 비슷한 길이(±20%)와 문장 수를 유지합니다. 새로운 인물이나 설정을 덧붙이지 않습니다.
4. '동기'는 짧은 분류 이름(2~8자)입니다. 다음 중 하나로 바꾸거나, 이미 괜찮으면 그대로 둡니다:
   비밀 은폐 · 치정 및 배신 · 질투와 시기 · 해묵은 앙금 · 금전 및 재산 갈취
5. 원문에 금지어가 없고 톤도 이미 부드러우면 그대로 돌려줍니다.

## 출력 형식
JSON 배열만 출력합니다 (설명 · 마크다운 코드블록 없이).
[{"id": <입력 id 그대로>, "motive": "...", "confession": "..."}]

## 예시
입력: {"id": 7, "motive": "원한 및 복수", "confession": "그 악마를 죽인 밤, 나는 십 년 만에 가장 깊은 잠을 잤습니다. 내 칼은 정의의 저울보다 훨씬 정확했습니다."}
출력: {"id": 7, "motive": "해묵은 앙금", "confession": "그 사람을 창고에 가둔 밤, 나는 십 년 만에 가장 깊은 잠을 잤습니다. 내 계획은 정의의 저울보다 훨씬 정확했습니다."}

입력: {"id": 46, "motive": "금전 및 재산 갈취", "confession": "평생 만져보지도 못할 돈이 굴러들어오는데, 그깟 목숨 하나 사라지는 게 대수입니까?"}
출력: {"id": 46, "motive": "금전 및 재산 갈취", "confession": "평생 만져보지도 못할 돈이 굴러들어오는데, 그깟 비밀 레시피 하나 사라지는 게 대수입니까?"}
"""

RETRY_PROMPT = """방금 결과의 id {id} 고백에 아직 금지어가 남아 있습니다: {words}
규칙을 다시 지켜, 같은 형식의 JSON 배열(항목 1개)로만 다시 써 주세요.
원문: {item}
방금 결과: {prev}"""


# ---------------------------------------------------------------------------
# 입출력
# ---------------------------------------------------------------------------
def pick(row, keys):
    for k in keys:
        if k in row and row[k] not in (None, ''):
            return str(row[k]).strip()
    return ''


def load_rows(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.json':
        data = json.load(open(path, encoding='utf-8'))
        return data if isinstance(data, list) else data.get('episodes', [])
    if ext == '.csv':
        with open(path, encoding='utf-8-sig', newline='') as f:
            return list(csv.DictReader(f))
    if ext in ('.xlsx', '.xlsm'):
        try:
            import openpyxl
        except ImportError:
            sys.exit('xlsx 를 읽으려면 openpyxl 이 필요해요: pip install openpyxl')
        ws = openpyxl.load_workbook(path, read_only=True, data_only=True).active
        rows = ws.iter_rows(values_only=True)
        head = [str(h).strip() if h is not None else '' for h in next(rows)]
        return [dict(zip(head, r)) for r in rows if any(v is not None for v in r)]
    sys.exit(f'지원하지 않는 형식: {ext} (csv / json / xlsx)')


def to_items(rows):
    items = []
    for i, row in enumerate(rows, start=1):
        rid = pick(row, ID_KEYS) or str(i)
        items.append(dict(id=int(rid) if rid.isdigit() else rid,
                          motive=pick(row, MOTIVE_KEYS), confession=pick(row, CONFESSION_KEYS)))
    return items


def banned(item):
    return cozy_rules.banned_in(item['motive'] + ' ' + item['confession'])


# ---------------------------------------------------------------------------
# Claude API (표준 라이브러리 urllib — 별도 패키지 없이)
# ---------------------------------------------------------------------------
def call_claude(api_key, model, messages, max_tokens=8000, tries=5):
    body = json.dumps(dict(model=model, max_tokens=max_tokens, temperature=0.4,
                           system=SYSTEM_PROMPT, messages=messages)).encode('utf-8')
    for attempt in range(tries):
        req = urllib.request.Request(API_URL, data=body, method='POST', headers={
            'x-api-key': api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                res = json.load(r)
            return ''.join(b.get('text', '') for b in res.get('content', []) if b.get('type') == 'text')
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            if e.code in (429, 500, 502, 503, 529) and attempt < tries - 1:
                wait = int(e.headers.get('retry-after') or 0) or 2 ** attempt * 3
                print(f'  … API {e.code}, {wait}초 뒤 다시 시도 ({attempt + 1}/{tries})')
                time.sleep(wait)
                continue
            sys.exit(f'API 오류 {e.code}: {msg}')
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < tries - 1:
                time.sleep(2 ** attempt * 3)
                continue
            sys.exit(f'네트워크 오류: {e}')


def parse_json_array(text):
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text)
    start, end = text.find('['), text.rfind(']')
    return json.loads(text[start:end + 1])


def cache_key(item, model):
    raw = json.dumps([PROMPT_VERSION, model, item['motive'], item['confession']], ensure_ascii=False)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:24]


def rewrite_batch(api_key, model, batch, max_fix=2):
    payload = json.dumps([dict(id=b['id'], motive=b['motive'], confession=b['confession']) for b in batch], ensure_ascii=False)
    user = f'다음 {len(batch)}개 에피소드를 규칙대로 다시 써 주세요.\n{payload}'
    out = {r['id']: r for r in parse_json_array(call_claude(api_key, model, [{'role': 'user', 'content': user}]))}
    results = {}
    for item in batch:
        r = out.get(item['id']) or dict(id=item['id'], motive=item['motive'], confession=item['confession'])
        r = dict(id=item['id'], motive=r.get('motive', item['motive']), confession=r.get('confession', item['confession']))
        # 금지어 재검사 → 남았으면 그 항목만 이유를 알려 주고 다시 요청
        for _ in range(max_fix):
            left = banned(r)
            if not left:
                break
            msg = RETRY_PROMPT.format(id=item['id'], words=', '.join(sorted(set(left))),
                                      item=json.dumps(item, ensure_ascii=False), prev=json.dumps(r, ensure_ascii=False))
            fixed = parse_json_array(call_claude(api_key, model, [{'role': 'user', 'content': msg}], max_tokens=2000))
            if fixed:
                r = dict(id=item['id'], motive=fixed[0].get('motive', r['motive']), confession=fixed[0].get('confession', r['confession']))
        results[item['id']] = r
    return results


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description='동기 · 진범의 고백을 코지 미스터리 톤으로 일괄 순화 (Claude API)')
    ap.add_argument('input', help='episodes_raw.json / .csv / .xlsx')
    ap.add_argument('-o', '--output', default='episodes_cozy.json')
    ap.add_argument('--model', default=os.environ.get('COZY_MODEL', DEFAULT_MODEL))
    ap.add_argument('--batch-size', type=int, default=8)
    ap.add_argument('--limit', type=int, default=0, help='앞에서부터 N개만 (시험용)')
    ap.add_argument('--all', action='store_true', help='금지어가 없는 항목도 다시 쓰기 (기본: 금지어가 있는 항목만)')
    ap.add_argument('--dry-run', action='store_true', help='API 호출 없이 금지어 보고만')
    ap.add_argument('--rules', action='store_true', help='API 대신 규칙 기반(tools/cozy_rules.py)으로 순화')
    args = ap.parse_args()

    items = to_items(load_rows(args.input))
    if args.limit:
        items = items[:args.limit]
    todo = [it for it in items if args.all or banned(it)]

    counts = {}
    for it in items:
        for w in banned(it):
            counts[w] = counts.get(w, 0) + 1
    print(f'입력 {len(items)}개 · 금지어가 있는 항목 {sum(1 for it in items if banned(it))}개')
    print('  금지어 빈도:', ', '.join(f'{w} {n}' for w, n in sorted(counts.items(), key=lambda x: -x[1])) or '없음')
    if args.dry_run:
        for it in items:
            if banned(it):
                print(f"  - {it['id']}: {', '.join(sorted(set(banned(it))))}")
        return

    results = {}
    if args.rules:
        for it in todo:
            results[it['id']] = dict(id=it['id'], motive=cozy_rules.MOTIVE_LABEL.get(it['motive'], it['motive']),
                                     confession=cozy_rules.cozy(sanitize_episodes.sanitize_to_cozy_tone(it['confession'])))
    else:
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            sys.exit('ANTHROPIC_API_KEY 환경 변수가 없어요.\n'
                     '  PowerShell: $env:ANTHROPIC_API_KEY = "sk-ant-..."  후 다시 실행\n'
                     '  (키 없이 바로 쓰려면 --rules 로 규칙 기반 순화)')
        cache_path = args.output + '.cache.json'
        cache = json.load(open(cache_path, encoding='utf-8')) if os.path.exists(cache_path) else {}
        pending = [it for it in todo if cache_key(it, args.model) not in cache]
        print(f'API 요청 대상 {len(pending)}개 (캐시 {len(todo) - len(pending)}개) · 모델 {args.model}')
        for i in range(0, len(pending), args.batch_size):
            batch = pending[i:i + args.batch_size]
            print(f'  [{i + len(batch)}/{len(pending)}] {batch[0]["id"]} ~ {batch[-1]["id"]}')
            for rid, r in rewrite_batch(api_key, args.model, batch).items():
                item = next(b for b in batch if b['id'] == rid)
                cache[cache_key(item, args.model)] = r
            json.dump(cache, open(cache_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)   # 배치마다 저장
        for it in todo:
            results[it['id']] = cache[cache_key(it, args.model)]

    out = []
    for it in items:
        r = results.get(it['id'], it)
        out.append({'에피소드': it['id'], '동기': r['motive'], '진범의 고백': r['confession'],
                    '원본 동기': it['motive'], '원본 고백': it['confession'],
                    '바뀜': r['motive'] != it['motive'] or r['confession'] != it['confession'],
                    '남은 금지어': sorted(set(banned(r)))})
    json.dump(out, open(args.output, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    left = [o for o in out if o['남은 금지어']]
    print(f'→ {args.output}: {len(out)}개 저장 · 바뀐 항목 {sum(o["바뀜"] for o in out)}개 · 금지어 남은 항목 {len(left)}개')
    for o in left[:20]:
        print(f"  ! {o['에피소드']}: {', '.join(o['남은 금지어'])}")


if __name__ == '__main__':
    main()
