"""
에피소드 고정 문구 틀 — 한국어 · English · 日本語 (tools/import_episodes_v6.py 와 tools/build_episode_i18n.py 가 함께 쓴다)

  - 용의자 배경 = 이유(6가지) + 성격(10가지). 이유는 공간 종류마다 자연스럽게 바꾼다
      (예전: '피해자의 초대를 받아 그날 지하 주차장에 머물고 있었다' → 지하 주차장은 '그날 밤 주차장에서 만나기로 약속했다')
    고르는 순서(rng)는 예전과 같다 — 이유 목록 길이 6 · 성격 10 을 그대로 둬서 다른 데이터가 바뀌지 않는다.
  - 사건 개요 첫 문장 = 동기 5가지 × 3가지 (에피소드 번호로 고정) + 규칙 안내 (모든 화 같음)
  문장마다 [한국어, English, 日本語]. {spot}·{city}·{place} 는 그 언어의 장소 이름으로 채운다.
"""

LANG_INDEX = {'ko': 0, 'en': 1, 'ja': 2}

# ---------------------------------------------------------------------------
# 용의자 배경 — 이유 (번호 = 뜻: 0 초대 · 1 일 · 2 오랜 인연 · 3 우연히 · 4 전날부터 도시에 · 5 사업 이야기)
# ---------------------------------------------------------------------------
BIO_REASONS = [
    ['피해자의 초대를 받아 그날 {spot}에 머물고 있었다.', "Was staying at the {spot} that day at the victim's invitation.", '被害者に招かれ、その日{spot}に滞在していた。'],
    ['일 때문에 사건 당일 {spot}을 찾았다.', 'Came to the {spot} on business that day.', '仕事でその日{spot}を訪れた。'],
    ['피해자와 오랜 인연이 있어 자주 {spot}에 드나들었다.', 'An old acquaintance of the victim who often visited the {spot}.', '被害者とは古い付き合いで、よく{spot}に出入りしていた。'],
    ['우연히 근처를 지나다 {spot}에 들렀다고 말한다.', 'Says they just happened to be passing and dropped in at the {spot}.', 'たまたま近くを通りかかり、{spot}に立ち寄ったと話している。'],
    ['사건 전날부터 {city}에 와 있었다.', 'Had been in {city} since the day before.', '事件の前日から{city}に来ていた。'],
    ['피해자와 사업 이야기를 나누러 {spot}에 왔다.', 'Came to the {spot} to talk business with the victim.', '被害者と商談をするため{spot}に来た。'],
]
# 머무는 곳이 아닌 공간: 이유를 그 공간에 맞게 (번호는 위와 같은 뜻)
BIO_OVERRIDES = {
    '연구소': {0: ['피해자의 초대로 그날 연구소의 공개 세미나에 참석했다.', "Attended the institute's open seminar that day at the victim's invitation.", '被害者に招かれ、その日研究所の公開セミナーに出席していた。']},
    '폐공장': {
        0: ['피해자의 연락을 받고 그날 밤 폐공장으로 불려 나왔다.', 'Was called out to the abandoned factory that night by a message from the victim.', '被害者から連絡を受け、その夜廃工場に呼び出された。'],
        2: ['예전에 이 공장에서 일한 적이 있어 안쪽 구조를 잘 안다.', 'Once worked at this factory and knows the layout well.', '以前この工場で働いていたことがあり、中の造りに詳しい。'],
        5: ['피해자와 공장 부지를 사고파는 이야기를 하러 왔다.', 'Came to discuss selling the factory site with the victim.', '工場跡地の売買について被害者と話しに来た。'],
    },
    '항구 창고': {0: ['피해자의 부탁으로 그날 창고에 들어올 화물을 함께 기다리고 있었다.', "Was waiting with the victim that day for a shipment to arrive, at the victim's request.", '被害者に頼まれ、その日倉庫に届く荷物を一緒に待っていた。']},
    '기차역': {0: ['피해자와 같은 열차를 타기로 하고 그날 역에서 기다리고 있었다.', 'Had planned to take the same train as the victim and was waiting at the station that day.', '被害者と同じ列車に乗る約束で、その日駅で待っていた。']},
    '도서관': {0: ['피해자의 부탁으로 그날 밤 도서관에서 자료 정리를 돕고 있었다.', 'Was helping the victim sort records at the library that night, at their request.', '被害者に頼まれ、その夜図書館で資料整理を手伝っていた。']},
    '오래된 성당': {0: ['피해자의 초대를 받아 그날 성당의 저녁 미사에 참석했다.', "Attended evening mass at the cathedral that day at the victim's invitation.", '被害者に招かれ、その日聖堂の夕べのミサに出席していた。']},
    '박물관 전시실': {0: ['피해자의 초대로 그날 밤 전시 개막 행사에 와 있었다.', "Was at the exhibit's opening night at the victim's invitation.", '被害者に招かれ、その夜展示のオープニングに来ていた。']},
    '카지노 VIP룸': {0: ['피해자의 초대를 받아 그날 VIP룸의 게임 테이블에 앉아 있었다.', "Was seated at a table in the VIP room that day at the victim's invitation.", '被害者に招かれ、その日VIPルームのテーブルについていた。']},
    '재즈 클럽': {0: ['피해자의 초대를 받아 그날 밤 클럽 공연을 보러 왔다.', "Came to see the club's show that night at the victim's invitation.", '被害者に招かれ、その夜クラブのライブを見に来ていた。']},
    '골목길 다방': {0: ['피해자와 약속이 있어 그날 다방에서 기다리고 있었다.', 'Had arranged to meet the victim and was waiting at the cafe that day.', '被害者と約束があり、その日喫茶店で待っていた。']},
    '지하 주차장': {
        0: ['그날 밤 피해자와 주차장에서 만나기로 약속했다.', 'Had agreed to meet the victim in the parking garage that night.', 'その夜、駐車場で被害者と会う約束をしていた。'],
        2: ['같은 건물에서 일해 매일 이 주차장을 오간다.', 'Works in the same building and passes through this garage every day.', '同じビルで働いていて、毎日この駐車場を通っている。'],
        5: ['피해자와 차 안에서 사업 이야기를 나누러 왔다.', "Came to talk business with the victim in the victim's car.", '被害者と車の中で商談をするために来た。'],
    },
    '극장 무대 뒤': {0: ['피해자의 초대로 그날 공연을 보고 무대 뒤로 인사하러 왔다.', "Saw the show that day at the victim's invitation and came backstage to say hello.", '被害者に招かれ、その日公演を見て楽屋へあいさつに来ていた。']},
}
BIO_TRAITS = [
    ['말수가 적고 늘 주변을 살핀다.', 'Quiet, and always watching the room.', '口数が少なく、いつも周りをうかがっている。'],
    ['사교적이라 누구와도 금방 친해진다.', 'Sociable; makes friends with anyone in no time.', '社交的で、誰とでもすぐ打ち解ける。'],
    ['꼼꼼한 성격으로 메모를 즐긴다.', 'Meticulous, and loves taking notes.', '几帳面な性格で、メモをとるのが好き。'],
    ['감정이 얼굴에 잘 드러난다.', 'Wears every feeling on their face.', '感情がすぐ顔に出る。'],
    ['늘 시간 약속을 철저히 지킨다.', 'Never late for an appointment.', '時間には人一倍厳しい。'],
    ['모두에게 친절하지만 속을 알 수 없다.', 'Kind to everyone, but hard to read.', '誰にでも親切だが、本心が読めない。'],
    ['피해자에 대해 말할 때 표정이 굳는다.', 'Their face stiffens whenever the victim comes up.', '被害者の話になると表情がこわばる。'],
    ['질문에 대답하기 전 잠시 뜸을 들인다.', 'Pauses for a moment before answering any question.', '質問に答える前に、少し間を置く。'],
    ['유머 감각이 뛰어나다.', 'Has a great sense of humor.', 'ユーモアのセンスがある。'],
    ['자기 일에 대한 자부심이 강하다.', 'Takes great pride in their work.', '自分の仕事に強い誇りを持っている。'],
]


def bio_reason(space, idx, lang):
    """이유 문장 틀 (아직 {spot}·{city} 를 채우지 않은 것)"""
    row = BIO_OVERRIDES.get(space, {}).get(idx) or BIO_REASONS[idx]
    return row[LANG_INDEX[lang]]


def bio_text(space, r, t, lang, spot, city):
    sep = '' if lang == 'ja' else ' '
    return bio_reason(space, r, lang).format(spot=spot, city=city) + sep + BIO_TRAITS[t][LANG_INDEX[lang]]


# ---------------------------------------------------------------------------
# 사건 개요 — 첫 문장 (동기별 3가지, 에피소드 번호 % 3) + 규칙 안내
#   EN 의 {place} 는 'an eerie mansion in Busan' 처럼 관사 포함 소문자 — 문장 첫머리에 오지 않게 썼다
# ---------------------------------------------------------------------------
INTRO_OPENERS = {
    '비밀 은폐': [
        ['{place}에서 한밤중에 기묘한 소동이 벌어졌다. 누군가 감추고 싶은 비밀이 있었던 모양이다.',
         'Late one night, a strange commotion broke out at {place}. Someone, it seems, had a secret to hide.',
         '真夜中、{place}で奇妙な騒動が起きた。誰かに隠したい秘密があったらしい。'],
        ['{place}의 고요한 밤이 한 사람의 비밀 때문에 소동으로 바뀌었다.',
         "One person's secret turned a quiet night at {place} into chaos.",
         '{place}の静かな夜が、ある人物の秘密のせいで騒動に変わった。'],
        ['{place}에서 누군가 들켜서는 안 될 것을 지키려다 큰 소동을 일으켰다.',
         'At {place}, someone caused quite a stir trying to protect something that must never come out.',
         '{place}で、誰かが知られてはならないものを守ろうとして大騒ぎを起こした。'],
    ],
    '치정 및 배신': [
        ['{place}에서 한밤중에 소동이 벌어졌다. 그 뒤에는 어긋난 마음이 있었다.',
         'Late one night, a commotion broke out at {place}—and behind it was a heart betrayed.',
         '真夜中、{place}で騒動が起きた。その裏には、すれ違った想いがあった。'],
        ['믿었던 사이가 무너진 밤, {place}에서 소동이 시작됐다.',
         'On the night a trusted bond fell apart, a commotion began at {place}.',
         '信じ合っていた仲が崩れた夜、{place}で騒動が始まった。'],
        ['{place}에 모인 사람들 사이에서 오래된 배신이 소동이 되어 터져 나왔다.',
         'Among the people gathered at {place}, an old betrayal burst out as a commotion.',
         '{place}に集まった人々の間で、古い裏切りが騒動となって噴き出した。'],
    ],
    '질투와 시기': [
        ['{place}에서 한밤중에 소동이 벌어졌다. 누군가의 빛이 누군가에게는 그림자였다.',
         "Late one night, a commotion broke out at {place}. One person's spotlight was another's shadow.",
         '真夜中、{place}で騒動が起きた。誰かの光は、別の誰かにとって影だった。'],
        ['{place}에서 열린 자리가 한 사람의 질투로 엉망이 되었다.',
         "A gathering at {place} was thrown into disarray by one person's jealousy.",
         '{place}での集まりが、ある人物の嫉妬で台無しになった。'],
        ['늘 앞서가던 사람과 늘 뒤따르던 사람. {place}의 밤, 그 거리가 소동을 불렀다.',
         'One always ahead, one always behind. One night at {place}, the gap between them sparked a commotion.',
         'いつも先を行く人と、いつも後を追う人。{place}の夜、その距離が騒動を呼んだ。'],
    ],
    '해묵은 앙금': [
        ['{place}에서 한밤중에 소동이 벌어졌다. 오래 묵은 앙금이 마침내 터진 것이다.',
         'Late one night, a commotion broke out at {place}. An old grudge had finally boiled over.',
         '真夜中、{place}で騒動が起きた。積年の恨みがついに噴き出したのだ。'],
        ['{place}에서 누군가 오래전 받은 상처를 소동으로 갚으려 했다.',
         'At {place}, someone tried to repay an old hurt with a commotion.',
         '{place}で、誰かが昔受けた傷を騒ぎで返そうとした。'],
        ['몇 해 동안 잠자던 원망이 {place}의 밤에 깨어났다.',
         'A resentment that had slept for years woke up one night at {place}.',
         '何年も眠っていた恨みが、{place}の夜に目を覚ました。'],
    ],
    '금전 및 재산 갈취': [
        ['{place}에서 한밤중에 소동이 벌어졌다. 그 중심에는 돈이 있었다.',
         'Late one night, a commotion broke out at {place}. At its center: money.',
         '真夜中、{place}で騒動が起きた。その中心にはお金があった。'],
        ['{place}에서 누군가 남의 재산에 손을 뻗었고, 밤은 소동으로 끝났다.',
         "Someone reached for another's fortune at {place}, and the night ended in chaos.",
         '{place}で誰かが他人の財産に手を伸ばし、夜は騒動で終わった。'],
        ['빚과 욕심이 얽힌 밤, {place}에서 소동이 벌어졌다.',
         'On a night tangled with debt and greed, a commotion broke out at {place}.',
         '借金と欲が絡み合った夜、{place}で騒動が起きた。'],
    ],
}
INTRO_RULES = [
    '용의자는 {n}명. 단서를 모아 수첩의 논리 그리드로 누가 어디에서 무엇을 가졌는지 맞혀 보자. '
    '장소는 그리드 왼쪽부터 복도를 따라 한 줄로 이어져 있다. 범인은 사건 현장에서 범행 도구를 가진 사람이다.',
    'There are {n} suspects. Gather clues and use the Logic Grid in your notebook to work out who was where with what. '
    'The places run left to right along a single hallway. The culprit is whoever was at the crime scene with the weapon.',
    '容疑者は{n}人。手がかりを集め、手帳の推理グリッドで「誰が・どこで・何を持っていたか」を突き止めよう。'
    '場所はグリッドの左から廊下に沿って一列に並んでいる。犯人は、事件現場で凶器を持っていた人物だ。',
]


def intro_text(motive, no, lang, place, n=6):
    li = LANG_INDEX[lang]
    opener = INTRO_OPENERS[motive][no % 3][li].format(place=place)
    return opener + ('' if lang == 'ja' else ' ') + INTRO_RULES[li].format(n=n)
