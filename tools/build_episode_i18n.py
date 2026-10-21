"""
에피소드 번역 데이터 만들기 (3단계) — js/data/episodes.en.js · js/data/episodes.ja.js

    python tools/build_episode_i18n.py            # 1~300화 전체
    python tools/build_episode_i18n.py --to 100   # N화까지만 본문 (나머지는 제목만)

  사람이 옮긴 것: 진범의 고백 (data/i18n/confessions.en.json · confessions.ja.json)
  기계로 조립하는 것 (논리를 바꾸지 않기 위해 — docs/i18n/STYLE_GUIDE.md 4장):
    - 단서 1~20 : data/V6_300_Episodes_Logic_Clues.json 의 '단서 구조' + 한국어 문장이 어느 틀 · 머리말로 만들어졌는지 찾아
                  같은 틀의 영어 · 일본어 문장으로. 틀을 못 찾으면 오류로 멈춘다 (번역이 논리와 어긋나지 않게)
    - 결정적 힌트 · 사건 개요 · 부제 · 해결 문구 · 제목(수식어 + 도시 + 명사 틀) · 용의자 배경(이유 + 성격 틀)
    - 이름 · 직업 · 장소 · 물건 · 도시 · 동기: data/i18n/glossary.json
  결과는 화면에 쓰는 필드만 담은 덮어쓰기 데이터 — js/episode-i18n.js 가 TP.EPISODES 에 덮는다 (한국어 원본은 그대로)
  번역이 없는 에피소드(101화~)는 한국어로 보인다.
"""
import argparse
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import logic_gen as LG   # noqa: E402  (단서 문장 틀 · 증인 · 머리말 — 한국어 쪽 기준)
import episode_text as ET   # noqa: E402  (용의자 배경 · 사건 개요 틀 — 한국어 생성기와 같은 표)

sys.stdout.reconfigure(encoding='utf-8')
G = json.load(open(os.path.join(ROOT, 'data', 'i18n', 'glossary.json'), encoding='utf-8'))
LANGS = ['en', 'ja']
LI = {'en': 0, 'ja': 1}

CONTINENTS = {'아시아': ['Asia', 'アジア'], '북아메리카': ['North America', '北アメリカ'], '남아메리카': ['South America', '南アメリカ'],
              '아프리카': ['Africa', 'アフリカ'], '유럽': ['Europe', 'ヨーロッパ'], '오세아니아': ['Oceania', 'オセアニア']}

# ---------------------------------------------------------------------------
# 제목: '{수식어} {도시}의 {명사}[: 부제]'
# ---------------------------------------------------------------------------
TITLE_PREFIX = {
    '노을빛에 물든': ['Sunset-Dyed', '夕焼けに染まる'], '거짓말과 위선에 찬': ['Two-Faced', '嘘と偽りに満ちた'],
    '비정한 도시를 적신': ['Cold-Hearted', '非情な街を濡らす'], '비밀을 품은': ['Secret-Keeping', '秘密を抱く'],
    '검붉은 노을을 머금은': ['Crimson-Skied', '赤黒い夕焼けを宿す'], '눈보라에 고립된': ['Snowbound', '吹雪に閉ざされた'],
    '광기에 사로잡힌': ['Frenzied', '狂気に囚われた'], '완전범죄를 꿈꾸는': ['Scheming', '完全犯罪を夢見る'],
    '안개 속에 갇힌': ['Fog-Bound', '霧に閉ざされた'], '뒤틀린 욕망이 낳은': ['Twisted', '歪んだ欲望が生んだ'],
    '폭우에 고립된': ['Storm-Bound', '豪雨に閉ざされた'],
}
TITLE_NOUN = {
    '침묵': ['Silence', '沈黙'], '심판': ['Judgment', '審判'], '마지막 밤': ['Last Night', '最後の夜'], '비밀': ['Secret', '秘密'],
    '앙갚음 소동': ['Payback Prank', '仕返し騒動'], '절규': ['Outcry', '叫び'], '눈물': ['Tears', '涙'], '환영': ['Phantom', '幻影'],
    '흔적': ['Traces', '痕跡'], '속삭임': ['Whispers', 'ささやき'], '진혼곡': ['Requiem', '鎮魂歌'], '망령': ['Ghost', '亡霊'],
    '그림자': ['Shadows', '影'], '광기': ['Frenzy', '狂気'], '저주': ['Curse', '呪い'],
}
TITLE_CITY_EXTRA = {   # 제목에만 쓰는 도시 이름 (본문 도시는 용어집 cities)
    '홉스골': ['Khuvsgul', 'フブスグル'],
}
TITLE_SUB = {
    '전설의 비법서 도난 사건': ['The Stolen Recipe Book', '伝説の秘伝書盗難事件'],
    '사라진 가보의 행방': ['Where the Lost Heirloom Went', '消えた家宝の行方'],
    '감춰진 진실과 낡은 편지': ['A Hidden Truth and an Old Letter', '隠された真実と古い手紙'],
    '비밀 금고와 사라진 열쇠': ['The Secret Safe and the Missing Key', '秘密の金庫と消えた鍵'],
    '봉인된 방의 수수께끼': ['The Riddle of the Sealed Room', '封印された部屋の謎'],
    '초대받지 않은 손님': ['The Uninvited Guest', '招かれざる客'],
}
TITLE_EN_DOUBLE = {   # 한국어 원제가 같은 낱말을 두 번 쓰는 경우 (비밀을 품은 … 비밀 · 광기에 사로잡힌 … 광기) — 영어는 겹치지 않게
    ('비밀을 품은', '비밀'): "{c}'s Hidden Secret", ('광기에 사로잡힌', '광기'): '{c} in a Frenzy',
}


def title_of(ep, lang):
    li = LI[lang]
    t, _, sub = ep['title'].partition(': ')
    pre = next(p for p in sorted(TITLE_PREFIX, key=len, reverse=True) if t.startswith(p + ' '))
    rest = t[len(pre) + 1:]
    city, _, noun = rest.partition('의 ')
    c = (G['cities'].get(city) or TITLE_CITY_EXTRA[city])[li]
    p, n = TITLE_PREFIX[pre][li], TITLE_NOUN[noun][li]
    if lang == 'en' and (pre, noun) in TITLE_EN_DOUBLE:
        out = TITLE_EN_DOUBLE[(pre, noun)].format(c=c)
    else:
        out = f'The {n} of {p} {c}' if lang == 'en' else f'{p}{c}の{n}'
    if sub:
        out += (': ' if lang == 'en' else '：') + TITLE_SUB[sub][li]
    return out


# ---------------------------------------------------------------------------
# 장소 (부제 · 개요): '{도시}의 {분위기} {공간}'
# ---------------------------------------------------------------------------
def split_place(place):
    city, _, rest = place.partition('의 ')
    mood = next((m for m in sorted(G['sceneMoods'], key=len, reverse=True) if rest.startswith(m + ' ')), '')
    space = rest[len(mood):].strip()
    return city, mood, space


def place_phrase(ep, lang, article=True):
    city, mood, space = split_place(ep['place'])
    li = LI[lang]
    c, s = G['cities'][city][li], G['sceneSpaces'][space][li]
    m = G['sceneMoods'][mood][li] if mood else ''
    if lang == 'ja':
        return f'{c}の{m}{s}'
    words = f'{m} {s}'.strip()
    art = ('an ' if words[0].lower() in 'aeiou' else 'a ') if article else ''
    prep = 'on' if city.endswith('호수') else 'in'
    return f'{art}{words} {prep} {c}'


def cap(s):
    return s[:1].upper() + s[1:]


# ---------------------------------------------------------------------------
# 용의자 배경: 이유 + 성격 (tools/import_episodes_v6.py BIO_REASONS · BIO_TRAITS 와 같은 순서)
# ---------------------------------------------------------------------------
def bio_of(ep, s, lang):
    """용의자 배경: episodes.js 의 bioKey [이유 번호, 성격 번호] + 공간 → tools/episode_text.py 의 같은 틀"""
    r, t = s['bioKey']
    city, _, space = split_place(ep['place'])
    li = LI[lang]
    return ET.bio_text(space, r, t, lang, G['sceneSpaces'][space][li], G['cities'][city][li])


# ---------------------------------------------------------------------------
# 단서 틀 (logic_gen.text_of 의 한국어 틀과 같은 순서 · 같은 수)
#   EN 토큰: {S} {S2} 이름 · {theP} 'the Study' · {atP} 'in the Study' · {I} {I2} 'the Pocket Watch'
# ---------------------------------------------------------------------------
EN = {
    'NOT_PLACE': ['At that time, {S} was not {atP}.', "{S}'s name was not in {theP}'s entry log.",
                  "The footprints in {theP} did not match {S}'s shoes.", 'Several people testified that {S} never set foot in {theP}.'],
    'IS_PLACE': ['The hallway camera caught {S} going into {theP}.', 'It was confirmed that {S} stayed {atP} the whole time.'],
    'NOT_PLACES': ['{S} went neither to {theP} nor to {theP2}.', "Retracing {S}'s steps: no stop at {theP} or {theP2}.",
                   'No one saw {S} {atP} or {atP2}.'],
    'OR_PLACE': ['{S} was in one of two places: {theP} or {theP2}.',
                 "The witness's memory is hazy: they saw {S} either {atP} or {atP2}."],
    'NOT_AT': ['The person {atP} was neither {S} nor {S2}.', 'Neither {S} nor {S2} went to {theP}.',
               "{theP}'s guest book had no entry for {S} or {S2}."],
    'OR_AT': ['The person {atP} was either {S} or {S2}.', 'The voice heard {atP} belonged to either {S} or {S2}.',
              '{S} and {S2} each said the other was {atP}. One of them is right.'],
    'NEIGHBOR': ['{S} and {S2} were in rooms right next to each other along the hallway.',
                 '{S} heard {S2} coughing through the wall, in the room next door.',
                 'Through a window, {S} saw {S2} moving in the room right next door.'],
    'NOT_NEIGHBOR': ["{S}'s room and {S2}'s room were not next to each other.",
                     "{S} never heard {S2}'s voice. They were not in neighboring rooms."],
    'LEFT_OF': ["Going down the hallway, {S}'s room came before {S2}'s.", '{S} was in a room closer to the entrance than {S2}.',
                "Coming in from the entrance, {S2} walked past {S}'s room to their own room farther in."],
    'NOT_ITEM': ["{S}'s fingerprints were not on {I}.", '{S} never once touched {I}.', "{I} was not in {S}'s bag."],
    'IS_ITEM': ["{I} was found among {S}'s belongings.", '{I} belonged to {S}.'],
    'NOT_ITEMS': ['{S} had neither {I} nor {I2}.', "A search of {S}'s pockets turned up neither {I} nor {I2}.",
                  "{S}'s fingerprints were on neither {I} nor {I2}."],
    'NOT_HOLDERS': ['{I} belonged to neither {S} nor {S2}.', '{S} and {S2} both said they had never even seen {I}. It was true.',
                    'Neither {S} nor {S2} had ever laid a hand on {I}.'],
    'OR_HOLDER': ['{I} belonged to either {S} or {S2}.', '{I} was among the belongings of either {S} or {S2} — one of the two.'],
    'PLACE_NOT_ITEM': ['Whoever was {atP} did not have {I}.', 'Forensics found no sign that {I} had ever been {atP}.'],
    'ITEM_AT_PLACE': ['Whoever had {I} was {atP} at that time.', 'Traces of {I} turned up {atP} — its owner was there.'],
    'XOR': ['{S} was either {atP} or had {I} — but not both.',
            'Of the two statements about {S} — "was {atP}" and "had {I}" — exactly one is true.'],
    'IFF': ["If {S} was {atP}, {I} is {S}'s too; if not, {I} is not {S}'s either.",
            '{S}\'s two statements — "I was {atP}" and "I had {I}" — are either both true or both false.'],
    'IF_THEN': ['If {S} was {atP}, then {S} had {I}.', "If the testimony that {S} was {atP} is right, {I} is {S}'s."],
    'IF_THEN_X': ['If {S} was {atP}, then {I} belonged to {S2}.', "If it's true that {S} was {atP}, {I} must have been {S2}'s."],
    'ITEM_NEIGHBOR': ['Whoever had {I} and whoever had {I2} were in rooms right next to each other.',
                      'The owner of {I} heard the owner of {I2} moving in the room next door.',
                      'The owners of {I} and {I2} were in neighboring rooms along the hallway.'],
    'ITEM_LEFT_OF': ['Going down the hallway, the room of whoever had {I} came before the room of whoever had {I2}.',
                     'The owner of {I} was in a room closer to the entrance than the owner of {I2}.'],
    'HOLDER_NEAR_PLACE': ['Whoever had {I} was in the room right next to {theP}.',
                          'The owner of {I} was just through the wall from {theP}, in the room next door.'],
}
JA = {
    'NOT_PLACE': ['その時刻、{S}は{P}にいなかった。', '{P}の入室記録に{S}の名前はなかった。', '{P}に残っていた足跡は、{S}の靴と合わなかった。',
                  '何人もが「{S}は{P}には足を踏み入れていない」と証言した。'],
    'IS_PLACE': ['廊下の防犯カメラに、{S}が{P}へ入っていく姿が映っていた。', '{S}は騒ぎの間ずっと{P}にいたことが確認された。'],
    'NOT_PLACES': ['{S}は{P}にも{P2}にも行かなかった。', '{S}の足取りをたどると、{P}にも{P2}にも立ち寄っていなかった。',
                   '{P}でも{P2}でも、{S}を見た者はいなかった。'],
    'OR_PLACE': ['{S}は{P}か{P2}、どちらか一方にいた。', '目撃者の記憶はあいまいだ。{S}を見たのは{P}か{P2}のどちらかだという。'],
    'NOT_AT': ['{P}にいたのは{S}でも{S2}でもない。', '{S}も{S2}も{P}には行っていない。', '{P}の記帳簿に、{S}と{S2}の名前はなかった。'],
    'OR_AT': ['{P}にいたのは{S}か{S2}のどちらかだ。', '{P}から聞こえた声は、{S}か{S2}のどちらかのものだった。',
              '{P}にいた人物について、{S}と{S2}は互いを指さした。どちらか一方が正しい。'],
    'NEIGHBOR': ['{S}と{S2}は、廊下で隣り合う部屋にいた。', '{S}は壁越しに、隣の部屋から{S2}の咳を聞いた。', '{S}は窓越しに、すぐ隣の部屋で{S2}が動くのを見た。'],
    'NOT_NEIGHBOR': ['{S}と{S2}の部屋は隣り合っていなかった。', '{S}は{S2}の声をまったく聞いていない。二人は隣の部屋ではなかった。'],
    'LEFT_OF': ['廊下の順番で見ると、{S}の部屋は{S2}の部屋より手前にあった。', '{S}は{S2}より玄関に近い部屋にいた。',
                '玄関から入った{S2}は、{S}の部屋の前を通り過ぎ、さらに奥の自分の部屋へ向かった。'],
    'NOT_ITEM': ['{I}から{S}の指紋は出なかった。', '{S}は{I}に一度も触れたことがない。', '{S}のかばんから{I}は出てこなかった。'],
    'IS_ITEM': ['{S}の持ち物から{I}が見つかった。', '{I}の持ち主は{S}だった。'],
    'NOT_ITEMS': ['{S}は{I}も{I2}も持っていなかった。', '{S}のポケットを調べたが、{I}も{I2}もなかった。', '{I}からも{I2}からも、{S}の指紋は出なかった。'],
    'NOT_HOLDERS': ['{I}の持ち主は{S}でも{S2}でもなかった。', '{S}と{S2}は{I}を見たこともないと言った。それは本当だった。',
                    '{I}には、{S}と{S2}が触れた形跡がなかった。'],
    'OR_HOLDER': ['{I}を持っていたのは{S}か{S2}のどちらかだ。', '{I}は、{S}か{S2}のどちらか一方の持ち物だった。'],
    'PLACE_NOT_ITEM': ['{P}にいた人物は{I}を持っていなかった。', '鑑識の結果、{P}に{I}が置かれていた形跡はなかった。'],
    'ITEM_AT_PLACE': ['{I}を持っていた人物は、その時刻{P}にいた。', '{P}の床から{I}の痕跡が出た。持ち主がそこにいたということだ。'],
    'XOR': ['{S}は{P}にいたか、{I}を持っていたかのどちらかだ。だが両方ではない。',
            '{S}についての二つの証言「{P}にいた」「{I}を持っていた」のうち、本当なのはちょうど一つだけだ。'],
    'IFF': ['{S}が{P}にいたなら{I}も{S}のもので、いなかったなら{I}も{S}のものではない。',
            '{S}の二つの供述「{P}にいた」「{I}を持っていた」は、両方とも本当か、両方とも嘘かのどちらかだ。'],
    'IF_THEN': ['もし{S}が{P}にいたなら、{S}は{I}を持っていたはずだ。', '{S}が{P}にいたという証言が正しいなら、{I}の持ち主は{S}だ。'],
    'IF_THEN_X': ['もし{S}が{P}にいたなら、{I}を持っていたのは{S2}だ。', '{S}が{P}にいたというのが本当なら、{I}の持ち主は{S2}だったはずだ。'],
    'ITEM_NEIGHBOR': ['{I}を持っていた人物と{I2}を持っていた人物は、すぐ隣の部屋同士にいた。', '{I}の持ち主は壁越しに、隣の部屋で{I2}の持ち主が動く音を聞いた。',
                      '{I}の持ち主と{I2}の持ち主は、廊下で隣り合う部屋にいた。'],
    'ITEM_LEFT_OF': ['廊下の順番で見ると、{I}を持つ人物の部屋は{I2}を持つ人物の部屋より手前だった。', '{I}の持ち主は、{I2}の持ち主より玄関に近い部屋にいた。'],
    'HOLDER_NEAR_PLACE': ['{I}を持っていた人物は、{P}のすぐ隣の部屋にいた。', '{I}の持ち主は、{P}の壁の向こう、隣の部屋にいた。'],
}
LIAR = {
    'en': {'NOT_PLACE': '{S} claimed, "I was {atP} at that time." That turned out to be a lie.',
           'NOT_ITEM': '{S} insisted, "{Icap} is mine." That turned out to be a lie.'},
    'ja': {'NOT_PLACE': '{S}は「その時刻、私は{P}にいた」と主張した。だが、それは嘘だと判明した。',
           'NOT_ITEM': '{S}は「{I}はもともと私のものだ」と言い張った。だが、それは嘘だと判明した。'},
}
# 머리말: logic_gen.LEADS_TESTIMONY · LEADS_EVIDENCE 와 같은 순서
LEADS = {
    'en': ["{W}'s statement: ", 'As {w} remembers it: ', '{W} said: ', '{W} quietly mentioned: ', "{W}'s written statement — ",
           'Forensics report — ', 'Looking at the scene photos again: ', "Detective's notes: ", 'Case memo — ', 'According to records {w} brought in: '],
    'ja': ['{w}の証言：', '{w}の記憶では、', '{w}はこう言った。', '{w}がそっと耳打ちした。', '{w}の供述書 — ',
           '鑑識の報告 — ', '現場写真を見直すと、', '探偵の手帳：', '捜査メモ — ', '{w}が持ってきた記録によれば、'],
}
HINT = {
    'en': ("Key contradiction: {D}'s alibi checked out — {D} was {atDP} at that time. {K}, however, said they were {atLP}, "
           'but {W} was the one {atLP} at that time. At the root of this commotion: {motive}.'),
    'ja': ('決定的な矛盾：{D}のアリバイは事実と確認された。その時刻、{D}は{DP}にいた。一方、{K}は「{LP}にいた」と供述したが、'
           'その時刻{LP}にいたのは{W}だった。この騒動の根っこにあったのは「{motive}」だった。'),
}
MOTIVE_DESC = {
    '비밀 은폐': ['they wanted to keep the victim from revealing a secret.', '被害者が握っていた秘密が世に出るのを防ごうとした。'],
    '치정 및 배신': ['they could never get over being betrayed by someone they trusted.', '信じていた人に裏切られた気持ちを、どうしても抑えられなかった。'],
    '질투와 시기': ["they had long envied the victim's talent and success.", '被害者の才能と成功を、長いあいだ妬んでいた。'],
    '해묵은 앙금': ['they wanted to pay back an old hurt with a prank of their own.', '昔受けた傷を、いたずら騒ぎで仕返ししようとした。'],
    '금전 및 재산 갈취': ["they were after the victim's money and property.", '被害者の金と財産を手に入れようとした。'],
}
GENDER = {'여': ['Female', '女性'], '남': ['Male', '男性']}


class Fail(Exception):
    pass


def make_filler(lang, names, places, items):
    li = LI[lang]

    def nm(ko):
        return G['names'][ko][li]

    def pl(ko):
        g = G['places'][LG_bare(ko)]
        if lang == 'ja':
            return g[1], g[1], g[1]
        the = g[0] if len(g) > 3 and g[3] == 'noThe' else 'the ' + g[0]
        return the, the, f'{g[2]} {the}'

    def it(ko):
        g = G['items'][LG_bare(ko)]
        return g[1] if lang == 'ja' else 'the ' + g[0]

    def fill(tpl, c):
        v = {}
        if 's' in c: v['S'] = nm(names[c['s']])
        if 's2' in c: v['S2'] = nm(names[c['s2']])
        for k, suf in (('p', ''), ('p2', '2')):
            if k in c:
                p, the, at = pl(places[c[k]])
                v['P' + suf], v['theP' + suf], v['atP' + suf] = p, the, at
        for k, suf in (('i', ''), ('i2', '2')):
            if k in c:
                v['I' + suf] = it(items[c[k]])
        if 'I' in v:
            v['Icap'] = cap(v['I'])
        # 그 단서가 다루는 이름 · 장소 · 물건이 번역문에 모두 들어가는지 (틀이 하나라도 빠뜨리면 논리가 바뀜)
        need = [k for k in ('S', 'S2') if k in v] + [k for k in ('P', 'P2') if k in v] + [k for k in ('I', 'I2') if k in v]
        used = set(re.findall(r'\{(\w+)\}', tpl))
        for k in need:
            if not ({k, 'the' + k, 'at' + k, k + 'cap', 'Icap' if k == 'I' else k} & used):
                raise Fail(f"틀에 {{{k}}} 없음 ({c['t']}): {tpl}")
        out = tpl.format(**v)
        return cap(out) if lang == 'en' else out
    return fill, nm, pl


def LG_bare(s):
    return s.split('(')[0].strip()


def variant_index(c, names, places, items, body):
    outs = [LG.text_of(c, names, places, items, n) for n in range(12)]
    L = len(dict.fromkeys(outs))
    if body not in outs:
        raise Fail(f"단서 틀을 못 찾음 ({c['t']}): {body}")
    seed = random.Random(json.dumps(c, sort_keys=True)).randrange(97)
    return (seed + outs.index(body)) % L, L


def split_lead(text, theme):
    witnesses = LG.WITNESSES.get(theme, LG.DEFAULT_WITNESSES)
    for i, lead in enumerate(LG.LEADS_TESTIMONY + LG.LEADS_EVIDENCE):
        for w in (witnesses if '{w}' in lead else [None]):
            s = lead
            if w:
                s = s.replace('{w}{이}', LG.J2(w, '이')).replace('{w}{은}', LG.J2(w, '은')).replace('{w}', w)
            if text.startswith(s):
                return i, w, text[len(s):]
    return None, None, text


def lead_text(lang, i, w):
    tpl = LEADS[lang][i]
    if w is None:
        return tpl
    wt = G['witnesses'][w][LI[lang]]
    return tpl.replace('{W}', cap(wt)).replace('{w}', wt)


def clue_text(lang, k, c, J, ep):
    names, places, items = J['용의자'], J['그리드 장소'], J['그리드 물건']
    fill, _, _ = make_filler(lang, names, places, items)
    text = ep['clues'][k]['text']
    tail = ''
    if J['장면'].get('소문') and (k + 1) in J['장면']['소문']:
        text, tail = rumor_text(lang, text, J, fill)
    if J['장면'].get('거짓증언') == k + 1:
        if LG.liar_text(c, names, places, items) != text:
            raise Fail(f'거짓 증언 문장 불일치: {text}')
        return fill(LIAR[lang][c['t']], c) + tail
    li, w, body = split_lead(text, J['장면'].get('공간'))
    idx, L = variant_index(c, names, places, items, body)
    table = (EN if lang == 'en' else JA)[c['t']]
    if len(table) != L:
        raise Fail(f"{c['t']} 틀 수 불일치 (한국어 {L} · {lang} {len(table)})")
    out = fill(table[idx], c)
    return ((lead_text(lang, li, w) + out) if li is not None else out) + tail


# 확인되지 않은 소문 꼬리 (logic_gen.rumor_tail 의 두 틀). 퍼즐 구조 밖이라 단서 뒤에 붙이기만 함
RUMOR_RE = [re.compile(r" 한편 (.+?)(?:이|가) (.+?)에 있었다는 소문도 돌았지만, 확인되지는 않았다\.$"),
            re.compile(r" \(떠도는 말로는 (.+?)(?:이|가) (.+?) 근처에서 보였다고 하나, 확인된 바 없다\.\)$")]
RUMOR = {
    'en': [' Meanwhile, a rumor went around that {S} had been {atP}, but it was never confirmed.',
           ' (Word has it {S} was seen near {theP}, but nothing has been confirmed.)'],
    'ja': ['一方で、{S}が{P}にいたという噂も流れたが、確かめられてはいない。',
           '（噂では{S}が{P}の近くで見かけられたというが、確認はされていない。）'],
}


def rumor_text(lang, text, J, fill):
    names, places = J['용의자'], J['그리드 장소']
    for v, rx in enumerate(RUMOR_RE):
        m = rx.search(text)
        if m and m.group(1) in names and m.group(2) in [LG_bare(p) for p in places]:
            c = dict(s=names.index(m.group(1)), p=[LG_bare(p) for p in places].index(m.group(2)))
            return text[:m.start()], fill(RUMOR[lang][v], c)
    raise Fail(f'소문 틀을 못 찾음: {text}')


HINT_RE = re.compile(r"^결정적 모순: (.+?)의 알리바이는 사실로 확인됐다\. 그 시각 \1(?:은|는) (.+?)에 있었다\. 반면 (.+?)(?:은|는) '(.+?)에 있었다'고 진술했지만, "
                     r"그 시각 \4에는 (.+?)(?:이|가) 있었다\.(?: 이 소동의 뿌리는 '(.+?)'였다\.)?$")


def hint_text(lang, text, J):
    m = HINT_RE.match(text)
    if not m:
        raise Fail(f'힌트 틀이 다름: {text}')
    D, DP, K, LP, W, motive = m.groups()
    names, places, items = J['용의자'], J['그리드 장소'], J['그리드 물건']
    fill, nm, pl = make_filler(lang, names, places, items)
    full = {LG_bare(p): p for p in places}
    dp, lp = pl(full[DP]), pl(full[LP])
    li = LI[lang]
    mot = G['motives'][motive][li] if motive else ''
    out = HINT[lang].format(D=nm(D), K=nm(K), W=nm(W), DP=dp[0], LP=lp[0], atDP=dp[2], atLP=lp[2], motive=mot)
    if not motive:
        out = re.sub(r' At the root.*$| この騒動の根っこ.*$', '', out)
    return out


def load_episodes():
    eps = []
    for line in open(os.path.join(ROOT, 'js', 'data', 'episodes.js'), encoding='utf-8'):
        line = line.strip()
        if line.startswith('{"episodeId"'):
            eps.append(json.loads(line.rstrip(',')))
    return eps


def build(lang, eps, logic, conf, to):
    li = LI[lang]
    out = {}
    for ep in eps:
        no = ep['no']
        if no > to:                     # --to 밖: 제목만 (잠긴 사건 카드 · 사건 파일 목록에 보임)
            out[ep['episodeId']] = dict(title=title_of(ep, lang))
            continue
        J = logic[no]
        city, _, _ = split_place(ep['place'])
        culprit = next(s for s in ep['suspects'] if s['id'] == ep['actualCulpritId'])
        motive = G['motives'][ep['motiveType']][li]
        sus = {}
        for s in ep['suspects']:
            bio = bio_of(ep, s, lang)
            age = f"{s['age']}" if lang == 'en' else f"{s['age']}歳"
            sus[s['id']] = dict(name=G['names'][s['name']][li], job=G['jobs'][s['job']][li], bio=bio,
                                trait=(f"{GENDER[s['gender']][0]} · {age}. {bio}" if lang == 'en' else f"{GENDER[s['gender']][1]}・{age}。{bio}"))
        place = place_phrase(ep, lang)
        lg = ep['logic']
        mark = lambda t, tr: tr + t[len(LG_bare(t)):]   # '(사건현장)' 표시는 그대로 (그리드가 빨간 칸으로 씀)
        e = dict(
            title=title_of(ep, lang),
            subtitle=f"{CONTINENTS[ep['continent']][li]} · {cap(place)}" if lang == 'en' else f"{CONTINENTS[ep['continent']][li]}・{place}",
            intro=ET.intro_text(ep['motiveType'], no, lang, place),
            continent=CONTINENTS[ep['continent']][li], city=G['cities'][city][li], country=G['cities'][city][li],
            place=cap(place), motiveType=motive,
            suspects=sus,
            clues=[clue_text(lang, k, c, J, ep) for k, c in enumerate(J['단서 구조'])],
            hints=[hint_text(lang, h['text'], J) for h in ep['hints']],
            confession=conf[str(no)],
            solutionText=(f"The culprit: {sus[culprit['id']]['name']}, the {sus[culprit['id']]['job']}. Motive: {motive} — {MOTIVE_DESC[ep['motiveType']][0]}"
                          if lang == 'en' else
                          f"真犯人は{sus[culprit['id']]['job']}の{sus[culprit['id']]['name']}。動機は{motive} — {MOTIVE_DESC[ep['motiveType']][1]}"),
            logic=dict(places=[mark(p, G['places'][LG_bare(p)][li]) for p in lg['places']],
                       items=[mark(i, G['items'][LG_bare(i)][li]) for i in lg['items']],
                       killer=G['names'][lg['killer']][li], difficulty=G['difficulty'][lg['difficulty']][li]),
        )
        out[ep['episodeId']] = e
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--to', type=int, default=300)
    args = ap.parse_args()
    eps = load_episodes()
    logic = {x['에피소드']: x for x in json.load(open(os.path.join(ROOT, 'data', 'V6_300_Episodes_Logic_Clues.json'), encoding='utf-8'))}
    errors = 0
    for lang in LANGS:
        conf = json.load(open(os.path.join(ROOT, 'data', 'i18n', f'confessions.{lang}.json'), encoding='utf-8'))
        try:
            data = build(lang, eps, logic, conf, args.to)
        except (Fail, KeyError, StopIteration, ValueError) as e:
            print(f'[{lang}] 오류: {type(e).__name__} {e}')
            errors += 1
            continue
        chapters = {ko: v[LI[lang]] for ko, v in CONTINENTS.items()}
        js = ("// 자동 생성 — python tools/build_episode_i18n.py (고치려면 용어집 · 틀 · 고백 번역을 고치고 다시 생성)\n"
              f"// 에피소드 1~{args.to}화 {lang} 덮어쓰기 데이터 — js/episode-i18n.js 가 TP.EPISODES 에 적용\n"
              "(globalThis.TP ??= {}).EPISODE_I18N ??= {};\n"
              f"TP.EPISODE_I18N.{lang} = {{\n  chapters: {json.dumps(chapters, ensure_ascii=False)},\n  episodes: {{\n"
              + ',\n'.join(f'    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False, separators=(",", ":"))}' for k, v in data.items())
              + "\n  },\n};\n")
        path = os.path.join(ROOT, 'js', 'data', f'episodes.{lang}.js')
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(js)
        print(f'→ js/data/episodes.{lang}.js: 전체 번역 {args.to}화 + 제목만 {len(data) - args.to}화 ({os.path.getsize(path) / 1e3:.0f}KB)')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
