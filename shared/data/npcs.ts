// 대화 NPC 와 대사 (교수님·매점 모리는 메뉴가 있는 특수 NPC 라 여기 없음)
//
// 대사 쓰는 법: 위에서부터 차례로 나온다.
//   { line: '대사' }                  → 대사 한 줄 (누르면 다음)
//   { line: '대사', who: 'player' }   → 플레이어가 하는 말 (이름 자리에 플레이어 이름)
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
  | { line: string; who?: 'npc' | 'player' }
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
}

/** 플레이어가 이 거리(월드 px) 안으로 들어오면 말풍선이 뜬다 */
export const NPC_BUBBLE_RANGE = 220;

export const TALK_NPCS: Record<string, TalkNpcDef> = {
  // ---- 마법공학의 유산 (대사 없이 진행만. 대사는 나중에) ----
  // 동급생 마법사: 어느 맵에 서 있는지는 maps.ts 의 npcs (퀘스트 진행에 따라 자리를 옮김)
  mage_friend: {
    name: '마법사 동급생',
    icon: '🔮',
    dialogue: [],
    talks: [
      // 1. 사연 듣기 → 2. 숲 둘러보기
      { when: { all: [{ level: { gte: 3 } }, { quest: 'mg2', state: 'none' }] }, steps: [{ do: { quest: 'give', id: 'mg2' } }] },
      // 3. 아무것도 없다고 알리기 → 4. 밤에 잠자기
      { when: { quest: 'mg2', state: 'ready' }, steps: [{ do: { quest: 'report', id: 'mg2' } }] },
    ],
  },
  // 기숙사 방 침대: 밤에 자면 다음으로 (검사·궁수는 4번 퀘스트, 마법사는 혼자 수색 시작)
  bed: {
    name: '침대',
    icon: '🛏️',
    prop: 'bed',
    dialogue: [],
    talks: [
      { when: { all: [{ quest: 'mg4', state: 'ready' }, { time: 'night' }] }, steps: [{ do: { quest: 'report', id: 'mg4' } }] },
      {
        when: { all: [{ cls: 'mage' }, { level: { gte: 3 } }, { quest: 'mg5', state: 'none' }, { time: 'night' }] },
        steps: [{ do: { quest: 'give', id: 'mg5' } }],
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
