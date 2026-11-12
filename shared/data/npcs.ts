// 대화 NPC 와 대사 (교수님·매점 모리는 메뉴가 있는 특수 NPC 라 여기 없음)
//
// 대사 쓰는 법: 위에서부터 차례로 나온다.
//   { line: '대사' }                  → 대사 한 줄 (누르면 다음)
//   { line: '대사', who: 'player' }   → 플레이어가 하는 말 (이름 자리에 플레이어 이름)
//   { line: '대사', who: 'NPC id' }   → 다른 NPC 가 하는 말 (이름 자리에 그 NPC 이름)
//   { choices: [ { label, reply } ] } → 선택지. 고르면 reply 대사들이 이어서 나온다
//   { do: 효과 }                       → 화면에 안 보이고 효과만 (퀘스트 주기·보고, 플래그 바꾸기, 물건·골드 주고받기)
//   { cutscene: '컷신 id' }            → 대화창을 닫고 컷신 재생 (cutscenes.ts)
// 대사가 끝나면 창이 닫히고, 다시 말을 걸면 처음부터.
//
// 상황별 대사: talks 에 { when: 조건, steps: 대사 } 를 위에서부터 검사해서 처음 맞는 것을 쓴다.
// 하나도 안 맞으면 dialogue (기본 대사).

export type Effect =
  /** 퀘스트 주기 / 보고하기 (보상 받음) */
  | { quest: 'give' | 'report'; id: string }
  /** 이야기 플래그를 값으로 */
  | { flag: string; set: number }
  /** 물건 주기 (n 이 음수면 가져감). 가방에 자리가 없거나 물건이 모자라면 대사가 거기서 멈춤 */
  | { item: string; n: number }
  /** 골드 주기 (음수면 가져감, 모자라면 멈춤) */
  | { gold: number };

export type DialogueStep =
  | { line: string; who?: string }
  | { choices: { label: string; reply: DialogueStep[] }[] }
  | { do: Effect }
  | { cutscene: string };

export type Cond =
  /** 플래그 값 비교 (없는 플래그 = 0) */
  | { flag: string; eq?: number; gte?: number; lt?: number }
  /** 퀘스트 상태: 안 받음 / 하는 중 / 보고 가능 / 끝남 */
  | { quest: string; state: 'none' | 'active' | 'ready' | 'done' }
  /** 레벨 비교 */
  | { level: { gte?: number; lt?: number } }
  /** 가방에 물건이 n 개 이상 있을 때 */
  | { has: string; n?: number }
  /** 직업 (검사 warrior / 마법사 mage / 궁수 archer) */
  | { cls: 'warrior' | 'mage' | 'archer' }
  /** 시간대 (아침 / 낮 / 밤) */
  | { time: 'morning' | 'day' | 'night' }
  /** 모두 맞을 때 */
  | { all: Cond[] }
  /** 하나라도 맞을 때 */
  | { any: Cond[] }
  /** 안 맞을 때 */
  | { not: Cond };

export interface TalkNpcDef {
  name: string;
  /** 초상화가 없을 때 대신 보여 줄 아이콘 */
  icon: string;
  /** 기본 대사 */
  dialogue: DialogueStep[];
  /** 상황별 대사 (위에서부터 처음 맞는 것) */
  talks?: { when: Cond; steps: DialogueStep[] }[];
  /** 플레이어가 다가오면 머리 위에 잠깐 뜨는 말풍선 */
  bubble?: { text: string; life: number };
  /** 사람이 아니라 물건 (임시 그림) */
  prop?: 'bed';
  /** 그림 색 (임시 그림을 어둡게 등) */
  tint?: number;
  /** 이 NPC 가 줄 퀘스트가 있으면(지금 대사에 퀘스트 주기가 있으면) 길 안내 화살표가 이 NPC 를 가리킴 */
  guide?: boolean;
}

/** 플레이어가 이 거리(월드 px) 안으로 들어오면 말풍선이 뜬다 */
export const NPC_BUBBLE_RANGE = 220;

export const TALK_NPCS: Record<string, TalkNpcDef> = {
  // ---- 마법공학의 유산 (대사는 줄거리만 알 수 있게 넣은 임시) ----
  // 동급생 마법사: 어느 맵에 서 있는지는 maps.ts 의 npcs (퀘스트 진행에 따라 자리를 옮김)
  mage_friend: {
    name: '마법사 동급생',
    icon: '🔮',
    dialogue: [{ line: '하암… 요즘 통 잠을 못 자서 그런가, 머리가 멍해.' }],
    talks: [
      // 1. 사연 듣기 → 2. 숲 둘러보기
      {
        when: { all: [{ level: { gte: 3 } }, { quest: 'mg2', state: 'none' }] },
        steps: [
          { line: '하암… 아, 미안. 요즘 밤마다 이상한 소리가 들려서 잠을 하나도 못 잤어.' },
          { line: '속삭이는 소리 같기도 하고, 뭔가 덜컹거리는 소리 같기도 하고… 학교 뒤 숲 쪽에서 나는 것 같아.' },
          { line: '혹시 숲 깊은 곳까지 한 번만 둘러봐 줄 수 있어?' },
          { do: { quest: 'give', id: 'mg2' } },
        ],
      },
      { when: { quest: 'mg2', state: 'active' }, steps: [{ line: '숲 깊은 곳, 갈림길 쪽이야. 부탁할게.' }] },
      // 3. 아무것도 없다고 알리기 → 4. 밤에 잠자기
      {
        when: { quest: 'mg2', state: 'ready' },
        steps: [
          { line: '갈림길까지 가 봤는데, 아무것도 없던데?', who: 'player' },
          { line: '그래…? 이상하다. 분명히 들렸는데.' },
          { line: '오늘 밤에도 들리면 깨우러 갈게. 일단 기숙사에서 푹 자 둬.' },
          { do: { quest: 'report', id: 'mg2' } },
          { do: { quest: 'give', id: 'mg4' } },
        ],
      },
      { when: { quest: 'mg4', state: 'ready' }, steps: [{ line: '밤에 기숙사에서 자 둬. 소리가 들리면 깨우러 갈게.' }] },
      // 6. 경비기계A 지역
      {
        when: { all: [{ quest: 'mg5', state: 'done' }, { quest: 'mg6', state: 'none' }] },
        steps: [{ line: '방금 그 목소리 들었지…? 기계들이 길을 막고 있어. 먼저 저것들부터 처리하자!' }, { do: { quest: 'give', id: 'mg6' } }],
      },
      { when: { quest: 'mg6', state: 'active' }, steps: [{ line: '기계들이 아직 남아 있어. 조심해!' }] },
      {
        when: { quest: 'mg6', state: 'ready' },
        steps: [{ line: '다 처리했구나! 길이 더 안쪽으로 이어져. 먼저 가 있을게.' }, { do: { quest: 'report', id: 'mg6' } }],
      },
      // 7. 경비기계B 지역
      {
        when: { all: [{ quest: 'mg6', state: 'done' }, { quest: 'mg7', state: 'none' }] },
        steps: [{ line: '여기도 기계투성이야. 아까랑은 생김새가 달라. 이것들도 부탁해!' }, { do: { quest: 'give', id: 'mg7' } }],
      },
      { when: { quest: 'mg7', state: 'active' }, steps: [{ line: '아까 것들보다 단단해 보여. 조심해!' }] },
      {
        when: { quest: 'mg7', state: 'ready' },
        steps: [{ line: '고마워! 저 안쪽에 뭔가 있는 것 같아. 먼저 가 볼게.' }, { do: { quest: 'report', id: 'mg7' } }],
      },
      // 8. 공방 입구
      {
        when: { all: [{ quest: 'mg7', state: 'done' }, { quest: 'mg9', state: 'none' }] },
        steps: [
          { line: '여기 입구가 있어! 그런데 단단히 잠겨 있네…' },
          { line: '여는 장치가 따로 있는 것 같아. 아까 그 경비기계B 중 하나가 가지고 있지 않을까?' },
          { do: { quest: 'give', id: 'mg9' } },
        ],
      },
      { when: { quest: 'mg9', state: 'active' }, steps: [{ line: '경비기계B 중 하나가 여는 장치를 가지고 있을 거야.' }] },
      {
        when: { quest: 'mg9', state: 'ready' },
        steps: [{ line: '찾았구나! 이걸로 열 수 있을 거야.' }, { do: { quest: 'report', id: 'mg9' } }, { line: '열렸다! 안에서 기다릴게.' }],
      },
      // 9. 공방 안
      {
        when: { all: [{ quest: 'mg9', state: 'done' }, { quest: 'mg10', state: 'none' }] },
        steps: [
          { line: '여기가 그 소리의 정체였구나… 오래전에 버려진 마법공방이야.' },
          { line: '저 가운데 결정, 마력이 아직 남아 있어. 그런데 그것보다…' },
          { line: '지하에서 엄청 강한 마력이 느껴져. 내려가 보자.' },
          { do: { quest: 'give', id: 'mg10' } },
        ],
      },
      { when: { quest: 'mg10', state: 'active' }, steps: [{ line: '지하에서 엄청 강한 마력이 느껴져. 조심해.' }] },
      // 10. 지하: 다 잡으면 골렘 방 문 옆에서
      {
        when: { quest: 'mg10', state: 'ready' },
        steps: [
          { line: '다 처리했네! 그런데 이 문 너머… 지금까지랑은 차원이 다른 기운이야.' },
          { do: { quest: 'report', id: 'mg10' } },
          { line: '이 공방의 마지막 경비일 거야. 쓰러뜨리자!' },
          { do: { quest: 'give', id: 'mg11' } },
        ],
      },
      { when: { quest: 'mg11', state: 'active' }, steps: [{ line: '이 문 너머야. 준비되면 들어가자.' }] },
      // 12. 골렘을 잡은 뒤 (결정체를 빼앗긴 직후, 장면 전용 맵)
      {
        when: { quest: 'mg11', state: 'ready' },
        steps: [
          { line: '놓쳐 버렸네…' },
          { line: '그 결정체, 골렘을 움직이던 마력의 원천이었는데… 대체 누구였을까.' },
          { line: '일단 윗층으로 돌아가자.' },
          { do: { quest: 'report', id: 'mg11' } },
          { do: { quest: 'give', id: 'mg12' } },
        ],
      },
      { when: { quest: 'mg12', state: 'active' }, steps: [{ line: '윗층으로 돌아가서 얘기하자.' }] },
      // 13. 공방 윗층에서 후일담 → 교수님께 보고하러
      {
        when: { quest: 'mg12', state: 'ready' },
        steps: [
          { line: '여기가 밤마다 들리던 소리의 정체였어. 버려진 공방에서 기계들이 아직도 움직이고 있었던 거야.' },
          { line: '그런데 그 사람들… "우리"라고 했지. 처음부터 그 결정체를 노리고 있었던 것 같아.' },
          { line: '우리끼리 쫓을 수 있는 일이 아니야. 학교로 돌아가서 교수님께 말씀드리자.' },
          { line: '그리고… 고마워. 오늘 밤은 조금 잘 수 있을 것 같아.' },
          { do: { quest: 'report', id: 'mg12' } },
          { do: { quest: 'give', id: 'mg13' } },
        ],
      },
      { when: { quest: 'mg13', state: 'ready' }, steps: [{ line: '교수님께 같이 말씀드리자.' }] },
      { when: { quest: 'mg13', state: 'done' }, steps: [{ line: '요즘은 소리도 안 들리고 푹 자! 그 결정체는… 언젠가 꼭 되찾자.' }] },
    ],
    guide: true,
  },
  // 결정체를 가져가는 수상한 자 (장면 전용 맵의 컷신에만 나옴, 대화 없음)
  villain: {
    name: '???',
    icon: '🎭',
    dialogue: [],
    tint: 0x3a3048,
  },
  // 교수님 (특수 NPC): 이야기 대사가 있으면 교수님 메뉴 대신 대화창
  prof: {
    name: '교수님',
    icon: '🧙',
    dialogue: [],
    talks: [
      {
        when: { quest: 'mg13', state: 'ready' },
        steps: [
          { line: '숲 깊은 곳의 버려진 마법공방, 마법 골렘… 그리고 결정체를 가져간 자들이라.', who: 'prof' },
          { line: '잘 해냈다. 그 결정체 일은 학교에서도 알아보마. 너희는 너무 무리하지 말거라.', who: 'prof' },
          { line: '이건 수고한 보상이다.', who: 'prof' },
          { do: { quest: 'report', id: 'mg13' } },
        ],
      },
    ],
  },
  // 기숙사 방 침대: 밤에 자면 다음으로 (검사·궁수는 4번 퀘스트, 마법사는 혼자 수색 시작)
  bed: {
    name: '침대',
    icon: '🛏️',
    prop: 'bed',
    dialogue: [{ line: '(아직 잘 시간은 아니다.)', who: 'player' }],
    talks: [
      {
        when: { all: [{ quest: 'mg4', state: 'ready' }, { time: 'night' }] },
        steps: [
          { line: '(잠이 든다…)', who: 'player' },
          { line: '일어나, 일어나 봐! 지금 그 소리가 또 들려!', who: 'mage_friend' },
          { line: '같이 가 보자. 지금이면 뭔가 찾을 수 있을지도 몰라!', who: 'mage_friend' },
          { do: { quest: 'report', id: 'mg4' } },
          { do: { quest: 'give', id: 'mg5' } },
        ],
      },
      {
        when: { all: [{ cls: 'mage' }, { level: { gte: 3 } }, { quest: 'mg5', state: 'none' }, { time: 'night' }] },
        steps: [
          { line: '(오늘 밤도 숲 쪽에서 속삭임과 덜컹거리는 소리가 들린다…)', who: 'player' },
          { line: '(며칠째 잠을 못 잤다. 직접 가 봐야겠다.)', who: 'player' },
          { do: { quest: 'give', id: 'mg5' } },
        ],
      },
    ],
  },

  test: {
    name: '테스트 NPC',
    icon: '💬',
    // 이야기 테스트의 편지 전달 받는 쪽 (시나리오가 들어오면 지움)
    talks: [
      {
        when: { quest: 'test_deliver', state: 'ready' },
        steps: [{ line: '이야기 테스트: 편지 받음' }, { do: { quest: 'report', id: 'test_deliver' } }],
      },
    ],
    dialogue: [
      { line: '대화 테스트입니다. 1' },
      { line: '대화 테스트입니다. 2' },
      {
        choices: [
          { label: '1번 선택지', reply: [{ line: '1번 선택지 답변' }] },
          { label: '2번 선택지', reply: [{ line: '2번 선택지 답변' }] },
        ],
      },
    ],
    bubble: { text: '윗키를 눌러 상호작용하세요', life: 3 },
  },

  // ---- 이야기 장치 테스트용 (시나리오가 들어오면 지움). 대사는 전부 임시 ----
  // 흐름: 점액 퀘스트 → (보고) → 서식지 가 보기 퀘스트 → (보고) → 컷신 → 말 걸기 퀘스트 → 몬스터 컷신·이름표 몬스터 처치 → 끝
  story_test: {
    name: '이야기 테스트 NPC',
    icon: '📖',
    talks: [
      { when: { quest: 'test_gel', state: 'active' }, steps: [{ line: '이야기 테스트: 점액 3개 아직' }] },
      {
        when: { quest: 'test_gel', state: 'ready' },
        steps: [{ line: '이야기 테스트: 점액 3개 받음' }, { do: { quest: 'report', id: 'test_gel' } }, { line: '이야기 테스트: 서식지에 가 보기' }, { do: { quest: 'give', id: 'test_visit' } }],
      },
      { when: { quest: 'test_visit', state: 'active' }, steps: [{ line: '이야기 테스트: 서식지 아직' }] },
      {
        when: { quest: 'test_visit', state: 'ready' },
        steps: [{ line: '이야기 테스트: 서식지 다녀옴' }, { do: { quest: 'report', id: 'test_visit' } }, { do: { flag: 'story_test', set: 1 } }, { cutscene: 'test' }],
      },
      {
        when: { all: [{ flag: 'story_test', eq: 1 }, { quest: 'test_talk', state: 'none' }] },
        steps: [{ line: '이야기 테스트: 컷신 끝' }, { line: '이야기 테스트: 플레이어 대사', who: 'player' }, { do: { quest: 'give', id: 'test_talk' } }],
      },
      {
        when: { quest: 'test_talk', state: 'ready' },
        steps: [{ do: { quest: 'report', id: 'test_talk' } }, { do: { flag: 'story_test', set: 2 } }, { line: '이야기 테스트: 끝' }],
      },
      // 몬스터 연출 테스트: 연출용 몬스터 → 진짜 몬스터로 바뀌어 싸움 → 그 몬스터만 세는 퀘스트
      {
        when: { all: [{ flag: 'story_test', eq: 2 }, { quest: 'test_boss', state: 'none' }] },
        steps: [{ line: '이야기 테스트: 몬스터 테스트 시작' }, { do: { quest: 'give', id: 'test_boss' } }, { cutscene: 'test_mob' }],
      },
      { when: { quest: 'test_boss', state: 'active' }, steps: [{ line: '이야기 테스트: 이름표 몬스터 아직' }] },
      {
        when: { quest: 'test_boss', state: 'ready' },
        steps: [{ do: { quest: 'report', id: 'test_boss' } }, { do: { flag: 'story_test', set: 3 } }, { line: '이야기 테스트: 몬스터 테스트 끝' }],
      },
      // 전달 테스트: 편지를 받아 테스트 NPC 에게 → 목표 여러 개 테스트 (장비 끼기 + 레벨 + 처치)
      {
        when: { all: [{ flag: 'story_test', eq: 3 }, { quest: 'test_deliver', state: 'none' }] },
        steps: [{ line: '이야기 테스트: 편지 전달 시작' }, { do: { quest: 'give', id: 'test_deliver' } }],
      },
      { when: { any: [{ quest: 'test_deliver', state: 'active' }, { quest: 'test_deliver', state: 'ready' }] }, steps: [{ line: '이야기 테스트: 편지는 테스트 NPC 에게' }] },
      {
        when: { all: [{ flag: 'story_test', eq: 3 }, { quest: 'test_deliver', state: 'done' }, { quest: 'test_multi', state: 'none' }] },
        steps: [{ line: '이야기 테스트: 목표 여러 개 시작' }, { do: { quest: 'give', id: 'test_multi' } }],
      },
      { when: { quest: 'test_multi', state: 'active' }, steps: [{ line: '이야기 테스트: 목표 여러 개 아직' }] },
      {
        when: { quest: 'test_multi', state: 'ready' },
        steps: [{ do: { quest: 'report', id: 'test_multi' } }, { do: { flag: 'story_test', set: 4 } }, { line: '이야기 테스트: 목표 여러 개 끝' }],
      },
      { when: { flag: 'story_test', gte: 4 }, steps: [{ line: '이야기 테스트: 다 끝남 (다시 하려면 테스트 기능에서 초기화)' }] },
    ],
    dialogue: [
      { line: '이야기 테스트: 처음' },
      {
        choices: [
          { label: '이야기 테스트: 받기', reply: [{ do: { quest: 'give', id: 'test_gel' } }, { line: '이야기 테스트: 점액 3개 가져와' }] },
          { label: '이야기 테스트: 안 받기', reply: [{ line: '이야기 테스트: 다음에' }] },
        ],
      },
    ],
  },
};
