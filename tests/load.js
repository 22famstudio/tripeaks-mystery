// 테스트용: 브라우저와 같은 순서로 DOM 없는 게임 로직만 불러온다
require('../js/cards.js');
require('../js/layouts.js');
require('../js/layout-engine.js');
require('../js/game.js');
globalThis.TriPeaksEngine = require('../js/core/tripeaks_core_engine.js');   // 클리어 보장 역산 덱 생성 · GDD 정산
require('../js/deal-generator.js');
