// =====================================================================
// 에피소드 데이터 (JSON 호환 구조)
// =====================================================================
// file:// 로 더블클릭 실행해도 동작하도록 .js에 담았지만, 내용은 순수 JSON 형태다.
// 서버/앱 빌드 단계에서는 episodes.json 으로 분리해 fetch 하면 된다.
//
// 구조
//   episodeId, title, subtitle, intro, actualCulpritId, background(홈 배경), thumb(에피소드 카드)
//   attributes : 논리 퍼즐에 쓰이는 속성 이름표 (검증·힌트용)
//   suspects[] : { id, name, job, trait, emoji, color, portrait }
//                portrait = 초상화 경로(1:1). 없거나 로드 실패 시 emoji + color 원으로 대체 표시
//   clues[]    : { stage, text, facts[] }  — stage N 클리어 시 획득
//                facts = 기계가 읽는 사실 (사람에게는 text만 보인다)
//                  { type: 'crime', attr, value }            범인에 대한 사실
//                  { type: 'suspect', suspect, attr, value } 특정 용의자에 대한 사실
//   hints[]    : 지목 실패 후 광고로 여는 결정적 힌트 { text, eliminate: [suspectId] }
//   rewards    : 사건 해결 보상
//   solutionText : 해결 연출에서 보여 줄 추리 정리
//
// tests/mystery.test.js 가 facts로 "20개 단서를 모두 모으면 진범 한 명만 남고,
// 19개까지는 아직 특정되지 않는다"를 자동 검증한다. 시나리오를 고치면 테스트를 돌릴 것.
// =====================================================================
(function () {
  const TP = (globalThis.TP ??= {});

  const crime = (attr, value = true) => ({ type: 'crime', attr, value });
  const fact = (suspect, attr, value) => ({ type: 'suspect', suspect, attr, value });

  TP.EPISODES = [
    {
      episodeId: 'ep1-onsen',
      title: '산속 온천 여관의 비밀',
      subtitle: '사라진 달빛 탕패',
      background: 'game_assets/bg_detective_office.webp',  // 홈 화면 배경 (에피소드마다 교체)
      thumb: 'game_assets/card_episode_thumb_01.webp',
      intro: '눈 덮인 산골짜기의 전통 온천 여관 "달빛장". 여관의 가보인 「달빛 탕패」가 하룻밤 사이에 보관함에서 사라졌다!',
      actualCulpritId: 'chef',
      attributes: {
        knowsCode: '보관함 비밀번호를 안다',
        boots: '고무장화를 신었다',
        red: '붉은 옷/소품을 걸쳤다',
        yuzuAllergy: '유자 알레르기가 있다',
        leftHanded: '왼손잡이다',
        alibi: '사건 시각 알리바이가 있다',
      },
      // 순서 = 초상화 번호 (portrait_ep01_01 ~ 08)
      suspects: [
        { id: 'innkeeper', name: '하루오', job: '여관 주인', trait: '40년째 달빛장을 지켜 온 깐깐한 주인장. 매일 아침 손수 유자차를 끓인다.', emoji: '👘', color: '#c96b6b', portrait: 'game_assets/portrait_ep01_01.webp' },
        { id: 'chef', name: '민호', job: '주방장', trait: '서울에서 온 솜씨 좋은 주방장. 곧 자기 식당을 차릴 꿈이 있다. 긴장하면 땀을 비 오듯 흘린다.', emoji: '🍳', color: '#e0894a', portrait: 'game_assets/portrait_ep01_02.webp' },
        { id: 'maid', name: '윤서', job: '객실 담당 직원', trait: '방학마다 일하러 오는 대학생. 소문이라면 누구보다 빠르다.', emoji: '🎎', color: '#8a6db5', portrait: 'game_assets/portrait_ep01_03.webp' },
        { id: 'artist', name: '레오', job: '떠돌이 화가', trait: '설경을 그리러 와서 한 달째 묵고 있다. 옷마다 물감 자국투성이.', emoji: '🎨', color: '#5fae7a', portrait: 'game_assets/portrait_ep01_04.webp' },
        { id: 'merchant', name: '최 사장', job: '거상 · 리조트 개발업자', trait: '여관 자리에 대형 리조트를 짓고 싶어 한다. 탕패에도 눈독을 들였다.', emoji: '💼', color: '#a0784f', portrait: 'game_assets/portrait_ep01_05.webp' },
        { id: 'mechanic', name: '김덕배', job: '온천 보일러 기사', trait: '말수는 적지만 탕 온도만큼은 0.1도까지 맞추는 장인.', emoji: '🔧', color: '#5b7bb5', portrait: 'game_assets/portrait_ep01_06.webp' },
        { id: 'doctor', name: '박 박사', job: '요양 의사 · 단골손님', trait: '해마다 온천 요양을 오는 노의사. 탕패의 유래에도 관심이 많다.', emoji: '🩺', color: '#6f9aa0', portrait: 'game_assets/portrait_ep01_07.webp' },
        { id: 'constable', name: '오 순경', job: '마을 순경', trait: '폭설로 여관에 발이 묶인 마을 순경. 수사를 돕겠다고 나섰다.', emoji: '👮', color: '#3f5f9a', portrait: 'game_assets/portrait_ep01_08.webp' },
      ],
      clues: [
        { stage: 1, text: '보관함 자물쇠는 부서지지 않았다. 누군가 비밀번호를 정확히 눌러 열었다.', facts: [crime('knowsCode')] },
        { stage: 2, text: '보관함 앞 눈밭에 고무장화 발자국이 또렷하게 찍혀 있었다.', facts: [crime('boots')] },
        { stage: 3, text: '보관함 경첩에 붉은 털실 한 가닥이 걸려 있었다.', facts: [crime('red')] },
        { stage: 4, text: '밤 11시, 순찰을 돌던 오 순경이 탕패가 제자리에 있는 것을 확인했다. 범행은 11시에서 11시 30분 사이에 일어났다.', facts: [] },
        { stage: 5, text: '하루오 주인장은 평생 나막신만 신는다. 여관 어디에도 그의 장화는 없다.', facts: [fact('innkeeper', 'boots', false)] },
        { stage: 6, text: '박 박사는 붉은 털실로 뜨개질하는 게 취미다. 하지만 눈길에도 반들반들한 구두만 고집한다.', facts: [fact('doctor', 'red', true), fact('doctor', 'boots', false)] },
        { stage: 7, text: '발자국은 복도에 놓인 유자 바구니를 크게 돌아서 지나갔다. 범인은 유자를 만지지 못하는 듯하다.', facts: [crime('yuzuAllergy')] },
        { stage: 8, text: '레오는 새로 산 고무장화를 자랑했다. 작업복은 빨간 물감 자국으로 얼룩덜룩하다.', facts: [fact('artist', 'boots', true), fact('artist', 'red', true)] },
        { stage: 9, text: '김덕배는 회색 작업복만 입는다. 매일 유자탕에 유자를 띄우는 것도 그의 일이다.', facts: [fact('mechanic', 'red', false), fact('mechanic', 'yuzuAllergy', false)] },
        { stage: 10, text: '최 사장은 저녁 식사 때 유자 셔벗을 두 그릇이나 비웠다.', facts: [fact('merchant', 'yuzuAllergy', false)] },
        { stage: 11, text: '레오는 밤 10시부터 11시 40분까지 로비에서 손님들 초상화를 그려 주었다. 하루오 주인장이 내내 모델로 앉아 있었다.', facts: [fact('artist', 'alibi', true), fact('innkeeper', 'alibi', true)] },
        { stage: 12, text: '윤서는 유자차 냄새만 맡아도 재채기를 한다.', facts: [fact('maid', 'yuzuAllergy', true)] },
        { stage: 13, text: '다이얼에 왼쪽으로 세게 돌린 긁힘이 남아 있다. 범인은 왼손잡이다.', facts: [crime('leftHanded')] },
        { stage: 14, text: '최 사장은 왼손으로 계약서에 서명한다. 탕패가 있으면 땅 협상이 유리해진다는 소문도 돈다.', facts: [fact('merchant', 'leftHanded', true)] },
        { stage: 15, text: '박 박사는 11시부터 노천탕에서, 보일러를 점검하던 김덕배와 바둑 이야기를 나눴다.', facts: [fact('doctor', 'alibi', true), fact('mechanic', 'alibi', true)] },
        { stage: 16, text: '민호는 주방에서 늘 붉은 손수건을 목에 두른다. 칼은 왼손으로 쥔다.', facts: [fact('chef', 'red', true), fact('chef', 'leftHanded', true)] },
        { stage: 17, text: '보관함 비밀번호를 아는 사람은 하루오, 민호, 윤서 세 사람뿐이다. 오 순경조차 모른다.', facts: [
          fact('innkeeper', 'knowsCode', true), fact('chef', 'knowsCode', true), fact('maid', 'knowsCode', true),
          fact('mechanic', 'knowsCode', false), fact('doctor', 'knowsCode', false), fact('artist', 'knowsCode', false),
          fact('merchant', 'knowsCode', false), fact('constable', 'knowsCode', false),
        ] },
        { stage: 18, text: '민호는 유자 요리만큼은 꼭 남에게 맡긴다. 주방 뒷문에 둔 그의 장화 밑창엔 녹은 눈이 묻어 있었다.', facts: [fact('chef', 'yuzuAllergy', true), fact('chef', 'boots', true)] },
        { stage: 19, text: '민호는 11시쯤 혼자 아침 준비를 했다고 말하지만, 본 사람은 없다. 탕패 뒷면에는 창업주의 비밀 온천 달걀 레시피가 새겨져 있다고 한다.', facts: [fact('chef', 'alibi', false)] },
        { stage: 20, text: '윤서는 오른손잡이다. 그날 밤에도 보라색 기모노에 흰 앞치마 차림이었다.', facts: [fact('maid', 'leftHanded', false), fact('maid', 'red', false)] },
      ],
      hints: [
        { text: '보관함 비밀번호를 아는 사람은 세 명뿐이에요. 나머지 다섯은 범인이 될 수 없습니다.', eliminate: ['mechanic', 'doctor', 'artist', 'merchant', 'constable'] },
        { text: '하루오 주인장은 사건 시각 로비에서 모델을 서고 있었고, 장화도 없습니다.', eliminate: ['innkeeper'] },
        { text: '윤서는 오른손잡이이고 붉은 옷을 입지 않았습니다. 붉은 털실의 주인이 아니에요.', eliminate: ['maid'] },
      ],
      rewards: { gold: 5000, undo: 3, wild: 3 },
      solutionText: '비밀번호를 아는 세 사람 중 하루오는 알리바이가 있고, 윤서는 오른손잡이에 붉은 옷이 없었다. 붉은 손수건, 왼손잡이, 유자 알레르기, 장화, 그리고 비어 있는 알리바이까지 — 모든 단서가 가리키는 사람은 주방장 민호였다. 그는 탕패 뒷면의 레시피를 베껴 두고 아침에 몰래 돌려놓을 생각이었다며 땀을 뻘뻘 흘리며 고백했다.',
    },

    {
      episodeId: 'ep2-lighthouse',
      title: '항구 마을 등대 찻집',
      subtitle: '폭풍우 밤에 사라진 오르골',
      background: 'game_assets/card_episode_thumb_02.webp', // 전용 와이드 배경 제작 전 임시
      thumb: 'game_assets/card_episode_thumb_02.webp',
      intro: '폭풍우가 몰아친 밤, 항구 마을 등대 찻집 "물빛"에서 100년 된 은빛 오르골이 감쪽같이 사라졌다.',
      actualCulpritId: 'serin',
      attributes: {
        knowsKey: '진열장 비상 열쇠 위치를 안다',
        tall: '키가 커서 맨 윗선반에 손이 닿는다',
        yellowCoat: '노란 우비를 입었다',
        bluePaint: '손에 파란 물감이 묻어 있었다',
        alibi: '정전 시각 알리바이가 있다',
      },
      suspects: [
        { id: 'haesong', name: '해송', job: '찻집 주인', trait: '오르골을 할머니에게 물려받은 찻집 주인. 늘 발판을 들고 다닌다.', emoji: '🫖', color: '#4f9aa8', portrait: null },
        { id: 'bomi', name: '봄이', job: '바리스타', trait: '농구 선수 출신 바리스타. 시나몬 라테가 특기.', emoji: '☕', color: '#a0784f', portrait: null },
        { id: 'kang', name: '강 영감', job: '등대지기', trait: '50년째 등대를 지키는 무뚝뚝한 할아버지.', emoji: '🗼', color: '#7a8a99', portrait: null },
        { id: 'taeho', name: '태호', job: '어부', trait: '새벽마다 출항하는 젊은 어부. 배를 자식처럼 아낀다.', emoji: '🎣', color: '#3f6fa0', portrait: null },
        { id: 'serin', name: '세린', job: '화가', trait: '바다 그림을 그리러 한 달째 머무는 화가.', emoji: '🎨', color: '#c45f8a', portrait: null },
        { id: 'ma', name: '마 사장', job: '골동품상', trait: '오르골을 사겠다며 세 번이나 찾아온 골동품상.', emoji: '🧳', color: '#8c6b3f', portrait: null },
      ],
      clues: [
        { stage: 1, text: '진열장은 부서지지 않았다. 숨겨 둔 비상 열쇠로 열린 흔적이 있다.', facts: [crime('knowsKey')] },
        { stage: 2, text: '오르골은 정전이 된 밤 9시부터 9시 15분 사이에 사라졌다.', facts: [] },
        { stage: 3, text: '진열장 아래에서 노란 우비 섬유가 발견되었다.', facts: [crime('yellowCoat')] },
        { stage: 4, text: '오르골은 맨 윗선반에 있었다. 키가 큰 사람만 발판 없이 손이 닿는다. 발판은 제자리에 그대로였다.', facts: [crime('tall')] },
        { stage: 5, text: '해송은 찻집에서 키가 가장 작아 늘 발판을 쓴다.', facts: [fact('haesong', 'tall', false)] },
        { stage: 6, text: '마 사장은 오르골을 비싸게 사겠다고 세 번이나 제안했다가 모두 거절당했다.', facts: [] },
        { stage: 7, text: '태호는 그날 낮에 자기 배를 파랗게 칠했다. 하루 종일 노란 우비 차림이었다.', facts: [fact('taeho', 'bluePaint', true), fact('taeho', 'yellowCoat', true)] },
        { stage: 8, text: '선반 모서리에 파란 물감이 묻은 손자국이 남아 있었다.', facts: [crime('bluePaint')] },
        { stage: 9, text: '강 영감은 키가 크고 노란 우비를 입는다. 하지만 그날 손에 물감을 묻힐 일은 전혀 없었다.', facts: [fact('kang', 'tall', true), fact('kang', 'yellowCoat', true), fact('kang', 'bluePaint', false)] },
        { stage: 10, text: '마 사장은 정전 내내 항구 여관에서 통화 중이었다. 통화 기록이 남아 있다.', facts: [fact('ma', 'alibi', true)] },
        { stage: 11, text: '해송과 강 영감은 정전이 되자 함께 등대 발전기를 고쳤다.', facts: [fact('haesong', 'alibi', true), fact('kang', 'alibi', true)] },
        { stage: 12, text: '세린은 키가 크고, 늘 노란 우비를 입고 바닷가로 스케치를 나간다.', facts: [fact('serin', 'tall', true), fact('serin', 'yellowCoat', true)] },
        { stage: 13, text: '봄이는 농구 선수 출신이라 찻집에서 가장 키가 크다.', facts: [fact('bomi', 'tall', true)] },
        { stage: 14, text: '태호는 비상 열쇠가 어디 있는지 모른다고 했고, 해송도 그렇다고 확인했다.', facts: [fact('taeho', 'knowsKey', false)] },
        { stage: 15, text: '세린은 요즘 파란 밤바다 그림을 그리고 있다.', facts: [fact('serin', 'bluePaint', true)] },
        { stage: 16, text: '비상 열쇠의 위치를 아는 사람은 해송, 봄이, 세린뿐이다.', facts: [
          fact('haesong', 'knowsKey', true), fact('bomi', 'knowsKey', true), fact('serin', 'knowsKey', true),
          fact('kang', 'knowsKey', false), fact('taeho', 'knowsKey', false), fact('ma', 'knowsKey', false),
        ] },
        { stage: 17, text: '봄이는 정전 때 혼자 창고에서 초를 찾고 있었다고 한다.', facts: [fact('bomi', 'alibi', false)] },
        { stage: 18, text: '세린은 정전 때 바닷가에서 스케치를 했다고 하지만, 본 사람은 없다.', facts: [fact('serin', 'alibi', false)] },
        { stage: 19, text: '오르골의 멜로디는 세린의 돌아가신 어머니가 즐겨 부르던 자장가와 같다고 한다.', facts: [] },
        { stage: 20, text: '봄이의 우비는 초록색이다. 그날 그녀의 손에 묻은 건 시나몬 가루뿐이었다.', facts: [fact('bomi', 'yellowCoat', false), fact('bomi', 'bluePaint', false)] },
      ],
      hints: [
        { text: '비상 열쇠의 위치를 아는 사람은 세 명뿐이에요. 나머지 셋은 범인이 될 수 없습니다.', eliminate: ['kang', 'taeho', 'ma'] },
        { text: '해송은 발판 없이는 맨 윗선반에 손이 닿지 않고, 정전 때 등대에 있었습니다.', eliminate: ['haesong'] },
        { text: '봄이는 초록 우비를 입었고 손에는 시나몬 가루뿐이었습니다.', eliminate: ['bomi'] },
      ],
      rewards: { gold: 8000, undo: 5, wild: 5 },
      solutionText: '열쇠 위치를 아는 세 사람 중 해송은 키가 작고 알리바이가 있었으며, 봄이는 초록 우비에 물감도 없었다. 노란 우비, 큰 키, 파란 물감 손자국 — 범인은 화가 세린이었다. 어머니의 자장가가 담긴 오르골 소리를 그림으로 남기고 싶었던 그녀는, 해송에게 사과하고 완성된 그림을 찻집에 선물했다.',
    },
  ];

  // 에피소드 메뉴에 미리 보여 줄 출시 예정 사건 (데이터가 준비되면 TP.EPISODES로 옮긴다)
  TP.EPISODE_ROADMAP = [
    { no: 3, title: '준비 중인 사건', teaser: '다음 사건 파일을 정리하고 있어요' },
    { no: 4, title: '준비 중인 사건', teaser: '다음 사건 파일을 정리하고 있어요' },
    { no: 5, title: '준비 중인 사건', teaser: '다음 사건 파일을 정리하고 있어요' },
  ];
})();
