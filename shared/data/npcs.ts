// 대화 NPC 와 대사 (교수님·매점 모리는 메뉴가 있는 특수 NPC 라 여기 없음)
//
// 대사 쓰는 법: 위에서부터 차례로 나온다.
//   { line: '대사' }                  → 대사 한 줄 (누르면 다음)
//   { line: '대사', who: 'player' }   → 플레이어가 하는 말 (이름 자리에 플레이어 이름)
//   { line: '대사', who: 'NPC id' }   → 다른 NPC 가 하는 말 (이름 자리에 그 NPC 이름)
//   { choices: [ { label, reply } ] } → 선택지. 고르면 reply 대사들이 이어서 나온다
//   { do: 효과 }                       → 화면에 안 보이고 효과만 (퀘스트 주기·보고, 플래그 바꾸기, 물건·골드 주고받기)
//   { cutscene: '컷신 id' }            → 대화창을 닫고 컷신 재생 (cutscenes.ts)
//   { open: 'coinShop' }               → 대화창을 닫고 그 창을 엶 (주화 상점 등). 'npcShop' = 이 NPC 의 골드 상점 (items.ts NPC_SHOPS)
// 대사가 끝나면 창이 닫히고, 다시 말을 걸면 처음부터.
//
// 상황별 대사: talks 에 { when: 조건, steps: 대사 } 를 위에서부터 검사해서 처음 맞는 것을 쓴다.
// 하나도 안 맞으면 dialogue (기본 대사).

import { ADVANCE, ADVANCE_LINES } from './advance';
import type { ClassId } from './classes';

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
  | { cutscene: string }
  | { open: 'coinShop' | 'npcShop' };

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
  /** 그림 크기 배율 (작은 NPC 등, 없으면 1) */
  scale?: number;
  /** 이 NPC 가 줄 퀘스트가 있으면(지금 대사에 퀘스트 주기가 있으면) 길 안내 화살표가 이 NPC 를 가리킴 */
  guide?: boolean;
  /** 그 직업 플레이어 그림으로 (동급생). 없으면 임시 뼈대 그림 */
  avatar?: ClassId;
}

/** 튜토리얼(입학식)을 끝냈거나, 튜토리얼이 생기기 전에 미니 챕터를 시작한 캐릭터 (2026-11-25) */
export const TUT_DONE: Cond = { any: [{ quest: 'tu7', state: 'done' }, { not: { quest: 'mg2', state: 'none' } }, { not: { quest: 'mgm2', state: 'none' } }] };

/** 직업별 동급생 NPC (튜토리얼부터 같이 다니는 셋 중 내가 아닌 둘) */
export const CLASSMATE: Record<ClassId, string> = { warrior: 'warrior_friend', mage: 'mage_friend', archer: 'archer_friend' };
/** 'cls:<직업>' 화자 → 내 직업이면 'player', 아니면 그 직업 동급생 NPC id. 다른 화자는 그대로 */
export function resolveWho(who: string, cls: ClassId): string {
  if (!who.startsWith('cls:')) return who;
  const c = who.slice(4) as ClassId;
  return c === cls ? 'player' : CLASSMATE[c];
}

/** 튜토리얼 제3막: 인형 폭주 뒤 공통 대사 (검사 독백 / 검사 동급생의 외침 다음) */
const BERSERK: DialogueStep[] = [
  { line: '이런, 노후된 인형에 마력이 역류했나?! 제어판이 먹통이야! 신입생들, 뒤로 물러나라!', who: 'kyla' },
  { line: '마력 출력이 갑자기 치솟고 있어! 조심해, 방금 전이랑 단단함이 달라!', who: 'cls:mage' },
  { line: '물러나긴 늦었어, 이미 이쪽을 노리고 있잖아! 셋이서 한 번에 밀어붙이자!', who: 'cls:archer' },
  { do: { quest: 'report', id: 'tu6' } },
  { do: { quest: 'give', id: 'tu7' } },
];

/** 플레이어가 이 거리(월드 px) 안으로 들어오면 말풍선이 뜬다 */
export const NPC_BUBBLE_RANGE = 220;

/** 초대장 배달(bd3): 이 NPC 에게 초대장 1장 건네기 (대사 임시) */
const deliver = (id: string, reply: string, who?: string): { when: Cond; steps: DialogueStep[] } => ({
  when: { all: [{ quest: 'bd3', state: 'active' }, { flag: `bd3_${id}`, eq: 0 }, { has: 'invitation' }] },
  steps: [
    { line: '영주님 생신 잔치 초대장 전해 드리러 왔어요.', who: 'player' },
    { line: reply, who },
    { do: { item: 'invitation', n: -1 } },
    { do: { flag: `bd3_${id}`, set: 1 } },
  ],
});

export const TALK_NPCS: Record<string, TalkNpcDef> = {
  // ---- 마법공학의 유산 (대사는 줄거리만 알 수 있게 넣은 임시) ----
  // 동급생 마법사: 어느 맵에 서 있는지는 maps.ts 의 npcs (퀘스트 진행에 따라 자리를 옮김)
  mage_friend: {
    name: '동급생 마법사',
    icon: '🔮',
    avatar: 'mage',
    dialogue: [{ line: '하암… 요즘 통 잠을 못 자서 그런가, 머리가 멍해.' }],
    talks: [
      // 튜토리얼 (입학식): 벌청소 보고 → 노을 장면 / 그 밖에는 말 없음
      { when: { quest: 'tu2', state: 'ready' }, steps: [{ cutscene: 'tu_sunset' }] },
      { when: { not: TUT_DONE }, steps: [] },
      // 1. 사연 듣기 → 2. 숲 둘러보기 (2026-11-25: Lv 3 → 5, 튜토리얼을 끝낸 뒤)
      {
        when: { all: [{ level: { gte: 5 } }, { quest: 'mg2', state: 'none' }] },
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
  // ---- 마법사 직업용 (대사 임시) ----
  // 동급생 검사: 마법사에게는 동급생 마법사 대신 이 친구가 같이 감. 평소엔 학교 홀에 있음.
  // 피곤하고 심드렁하지만 부탁하면 마지못해 따라옴. '해 줘' 대신 '이렇게 해야 할 것 같아' 말투, 마력 얘기는 플레이어(마법사)가 함
  warrior_friend: {
    name: '동급생 검사',
    icon: '⚔️',
    avatar: 'warrior',
    dialogue: [{ line: '…하암. 수업 끝나면 바로 잘 거야.' }],
    talks: [
      // 튜토리얼 (입학식, 마법사일 때 벌청소 보고 상대) / 그 밖에는 말 없음
      { when: { all: [{ quest: 'tu2', state: 'ready' }, { cls: 'mage' }] }, steps: [{ cutscene: 'tu_sunset' }] },
      { when: { not: TUT_DONE }, steps: [] },
      // 밤에 깨우기 → 숲으로
      {
        when: { quest: 'mgm5', state: 'ready' },
        steps: [
          { line: '일어나, 일어나 봐! 그 소리가 또 들려!', who: 'player' },
          { line: '…으음. 지금 몇 시인데…' },
          { line: '숲 쪽에서 속삭이는 소리랑 덜컹거리는 소리! 이번엔 확실해. 같이 가 보자!', who: 'player' },
          { line: '하아… 내일 아침 수업 있는 거 알지?' },
          { line: '혼자 가기엔 좀 그렇단 말이야. 응? 부탁이야!', who: 'player' },
          { line: '…알았어, 알았다고. 검만 챙길게. 대신 빨리 끝내자.' },
          { do: { quest: 'report', id: 'mgm5' } },
          { do: { quest: 'give', id: 'mg5' } },
        ],
      },
      // 6. 경비기계A 지역
      {
        when: { all: [{ quest: 'mg5', state: 'done' }, { quest: 'mg6', state: 'none' }] },
        steps: [
          { line: '방금 그 목소리… 너도 들었지?' },
          { line: '응. 그리고 저 기계들, 몸에서 마력이 새어 나오고 있어. 누가 마력으로 움직이고 있는 거야.', who: 'player' },
          { line: '어쨌든 길을 막고 있네. 저것부터 치워야 지나갈 수 있겠어.' },
          { do: { quest: 'give', id: 'mg6' } },
        ],
      },
      { when: { quest: 'mg6', state: 'active' }, steps: [{ line: '아직 남아 있어. 다 치워야 안쪽으로 갈 수 있을 것 같아.' }] },
      {
        when: { quest: 'mg6', state: 'ready' },
        steps: [{ line: '다 치웠네. 길이 안쪽으로 더 이어져. 먼저 가서 살펴볼게.' }, { do: { quest: 'report', id: 'mg6' } }],
      },
      // 7. 경비기계B 지역
      {
        when: { all: [{ quest: 'mg6', state: 'done' }, { quest: 'mg7', state: 'none' }] },
        steps: [
          { line: '여기도 기계투성이네. 아까랑 생김새가 달라.' },
          { line: '마력이 흐르는 모양도 달라. 훨씬 단단하게 짜여 있어.', who: 'player' },
          { line: '그럼 이것들도 치우고 가야겠지.' },
          { do: { quest: 'give', id: 'mg7' } },
        ],
      },
      { when: { quest: 'mg7', state: 'active' }, steps: [{ line: '아까 것들보다 단단해. 무리하지 말고.' }] },
      {
        when: { quest: 'mg7', state: 'ready' },
        steps: [{ line: '이걸로 다 됐어. 저 안쪽에 뭔가 있는 것 같아. 먼저 가 있을게.' }, { do: { quest: 'report', id: 'mg7' } }],
      },
      // 8. 공방 입구
      {
        when: { all: [{ quest: 'mg7', state: 'done' }, { quest: 'mg9', state: 'none' }] },
        steps: [
          { line: '입구가 있긴 한데… 단단히 잠겨 있네. 힘으로는 안 열려.' },
          { line: '문에 마력 자물쇠가 걸려 있어. 여는 장치가 따로 있을 거야.', who: 'player' },
          { line: '그럼 아까 그 경비기계B 중 하나가 가지고 있을 것 같은데. 찾아봐야겠어.' },
          { do: { quest: 'give', id: 'mg9' } },
        ],
      },
      { when: { quest: 'mg9', state: 'active' }, steps: [{ line: '경비기계B 중 하나가 여는 장치를 가지고 있을 거야.' }] },
      {
        when: { quest: 'mg9', state: 'ready' },
        steps: [
          { line: '찾았어! 이걸로 열 수 있을 거야.', who: 'player' },
          { do: { quest: 'report', id: 'mg9' } },
          { line: '열렸네. 안에서 기다릴게.' },
        ],
      },
      // 9. 공방 안
      {
        when: { all: [{ quest: 'mg9', state: 'done' }, { quest: 'mg10', state: 'none' }] },
        steps: [
          { line: '여기가 그 소리의 정체였나… 오래된 공방 같은데.' },
          { line: '버려진 마법공방이야! 저 가운데 결정, 마력이 아직 남아 있어. 그런데 그것보다…', who: 'player' },
          { line: '지하에서 엄청 강한 마력이 느껴져.', who: 'player' },
          { line: '…그럼 지하부터 확인해 봐야겠네. 내려가 보자.' },
          { do: { quest: 'give', id: 'mg10' } },
        ],
      },
      { when: { quest: 'mg10', state: 'active' }, steps: [{ line: '지하가 수상하다고 했지. 조심해서 내려가자.' }] },
      // 10. 지하: 다 잡으면 골렘 방 문 옆에서
      {
        when: { quest: 'mg10', state: 'ready' },
        steps: [
          { line: '다 정리했어. 그런데 이 문은…' },
          { line: '문 너머 기운이 지금까지랑 차원이 달라. 이 공방의 마지막 경비일 거야.', who: 'player' },
          { do: { quest: 'report', id: 'mg10' } },
          { line: '그럼 저걸 쓰러뜨려야 끝나겠네. 준비되면 들어가자.' },
          { do: { quest: 'give', id: 'mg11' } },
        ],
      },
      { when: { quest: 'mg11', state: 'active' }, steps: [{ line: '이 문 너머야. 준비되면 들어가자.' }] },
      // 12. 골렘을 잡은 뒤 (결정체를 빼앗긴 직후, 장면 전용 맵)
      {
        when: { quest: 'mg11', state: 'ready' },
        steps: [
          { line: '놓쳤어…' },
          { line: '그 결정체, 골렘을 움직이던 마력의 원천이었어. 대체 누구였을까.', who: 'player' },
          { line: '일단 윗층으로 돌아가서 정리하자.' },
          { do: { quest: 'report', id: 'mg11' } },
          { do: { quest: 'give', id: 'mg12' } },
        ],
      },
      { when: { quest: 'mg12', state: 'active' }, steps: [{ line: '윗층으로 돌아가서 얘기하자.' }] },
      // 13. 공방 윗층에서 후일담 → 교수님께 보고하러
      {
        when: { quest: 'mg12', state: 'ready' },
        steps: [
          { line: '밤마다 들리던 소리, 결국 여기 기계들이었네.' },
          { line: '그런데 그 사람들, "우리"라고 했어. 처음부터 그 결정체를 노리고 온 거야.', who: 'player' },
          { line: '우리끼리 쫓을 일은 아닌 것 같아. 학교로 돌아가서 교수님께 말씀드리는 게 좋겠어.' },
          { line: '…그리고 이제 진짜 잘 거야. 다음엔 아침에 깨워.' },
          { do: { quest: 'report', id: 'mg12' } },
          { do: { quest: 'give', id: 'mg13' } },
        ],
      },
      { when: { quest: 'mg13', state: 'ready' }, steps: [{ line: '교수님께 같이 말씀드리자.' }] },
      { when: { quest: 'mg13', state: 'done' }, steps: [{ line: '요즘은 밤에 조용하네. 덕분에 잘 자. …그 결정체는 좀 신경 쓰이지만.' }] },
    ],
    guide: true,
  },
  // 나 (혼잣말): 마법사가 혼자 하는 퀘스트. 내 머리 위에 [?](받기) · [✔](보고) 말풍선이 뜨고, 누르면 이 대사
  self: {
    name: '',
    icon: '💭',
    dialogue: [],
    talks: [
      {
        // 2026-11-25: Lv 3 → 5, 튜토리얼을 끝낸 뒤
        when: { all: [{ cls: 'mage' }, { level: { gte: 5 } }, { quest: 'mgm2', state: 'none' }, { quest: 'tu7', state: 'done' }] },
        steps: [
          { line: '(요즘 밤마다 학교 뒤 숲 쪽에서 속삭이는 소리가 들린다…)', who: 'player' },
          { line: '(덜컹거리는 소리도 섞여 있었어. 숲 깊은 곳 갈림길까지 한번 가 봐야겠다.)', who: 'player' },
          { do: { quest: 'give', id: 'mgm2' } },
        ],
      },
      {
        when: { quest: 'mgm2', state: 'ready' },
        steps: [
          { line: '(갈림길까지 와 봤는데… 아무것도 없네.)', who: 'player' },
          { line: '(분명히 들렸는데. 오늘 밤에도 들리는지 기숙사에서 자면서 확인해 보자.)', who: 'player' },
          { do: { quest: 'report', id: 'mgm2' } },
          { do: { quest: 'give', id: 'mgm4' } },
        ],
      },
    ],
  },
  // ---- 튜토리얼: 입학식 (2026-11-25, 대사 = document/scenario 튜토리얼 시나리오) ----
  // 동급생 궁수 (튜토리얼에서만, 궁수 플레이면 안 나옴)
  archer_friend: {
    name: '동급생 궁수',
    icon: '🏹',
    avatar: 'archer',
    dialogue: [],
  },
  // 훈련교관 레온 (학교 홀, 기숙사 문 옆): 기초 생활 안내
  leon: {
    name: '훈련교관 레온',
    icon: '📋',
    tint: 0xa8b8d8,
    guide: true,
    dialogue: [],
    talks: [
      {
        when: { all: [{ quest: 'tu2', state: 'done' }, { quest: 'tu3', state: 'none' }] },
        steps: [
          { line: '어이, 입학식 때 강당을 화려하게 장식했던 신입생들이군! 난 신입생 기초 안내를 맡은 훈련교관 레온이다.' },
          { line: '본격적인 학과 수업에 들어가기 전에, 학교생활의 기본부터 익혀 두자. 먼저 가방(I)을 열어 기본 지급된 무기와 포션을 확인해 봐.' },
          { line: '그리고 저쪽 오른쪽 끝 문이 너희가 지낼 기숙사 방이야. 밤이 되면 침대에서 휴식을 취할 수 있으니, 먼저 들러서 방 위치부터 확인하고 오도록!' },
          { do: { quest: 'give', id: 'tu3' } },
        ],
      },
      { when: { quest: 'tu3', state: 'active' }, steps: [{ line: '오른쪽 끝 문이 기숙사 방이다. 방 위치부터 확인하고 오도록!' }] },
      {
        when: { quest: 'tu3', state: 'ready' },
        steps: [
          { line: '좋아, 방 확인은 끝났군. 이제 학교 바깥 오른쪽 훈련동에 있는 훈련실로 이동해 봐. 거기 있는 카일라 교관님이 기초 전투를 가르쳐 주실 거다.' },
          { do: { quest: 'report', id: 'tu3' } },
          { do: { quest: 'give', id: 'tu4' } },
        ],
      },
    ],
  },
  // 훈련교관 카일라 (훈련실 · 합동 훈련실): 실전 기초
  kyla: {
    name: '훈련교관 카일라',
    icon: '🔥',
    tint: 0xe0a088,
    guide: true,
    dialogue: [],
    talks: [
      {
        when: { quest: 'tu4', state: 'ready' },
        steps: [
          { line: '늦었군, 신입생! 난 실전 기초를 담당하는 훈련교관 카일라다. 입학식 때 소란을 피운 만큼 몸놀림도 쓸만한지 어디 한 번 볼까?' },
          { line: '기본 공격은 Z 키, 배운 스킬은 스킬 창(K)을 열어 원하는 단축키에 등록할 수 있다. 앞에 있는 훈련 인형을 상대로 기초 타격 연습부터 실시해!' },
          { do: { quest: 'report', id: 'tu4' } },
          { do: { quest: 'give', id: 'tu5' } },
        ],
      },
      {
        when: { quest: 'tu5', state: 'ready' },
        steps: [
          { line: '흠, 자세는 나쁘지 않군. 마침 다른 학과 신입생들도 도착했으니, 바로 3인 1조 합동 연습 전투로 넘어가겠다! 각자 위치로 서라!' },
          { do: { quest: 'report', id: 'tu5' } },
          { do: { quest: 'give', id: 'tu6' } },
        ],
      },
      // 합동 훈련실: 폭주한 인형을 잡은 뒤 (컷신 tu_end 에서)
      {
        when: { quest: 'tu7', state: 'ready' },
        steps: [
          { line: '하아, 하아…… 무사하냐, 너희들?! 제어 장치가 고장 나서 하마터면 큰일 날 뻔했구나. 신입생 셋이서 저 출력을 제압하다니 대단하다!' },
          { line: '후우…… 방금 그 마력 파동 봤어?! 단순 오작동이 아니었던 것 같은데, 진짜 실전 같았다니까!', who: 'cls:mage' },
          { line: '……덕분에 신입생 첫날부터 죽을 뻔했네. 그래도 셋이 합 맞춘 것치곤 호흡이 나쁘지 않았어.', who: 'cls:archer' },
          { line: '……다친 데 없으면 됐어. 너희 둘 덕분에 수월하게 막았네.', who: 'cls:warrior' },
          { line: '헤헤, 이제 우리 진짜 같은 팀 같지 않아? 앞으로 무슨 일 생기면 꼭 서로 부르기다!', who: 'cls:mage' },
          { line: '……이상한 사고만 안 치면 생각해 볼게.', who: 'cls:archer' },
          { do: { quest: 'report', id: 'tu7' } },
        ],
      },
    ],
  },
  // 입학식 강당 (tu1 동안만)
  lord: { name: '펌블턴 경', icon: '👑', tint: 0xe8d08a, dialogue: [] },
  prof_sword: { name: '검술과 바르크 교수', icon: '⚔️', tint: 0xc89a8a, dialogue: [] },
  prof_magic: { name: '마법학과 엘린 교수', icon: '🔮', tint: 0xb0a0e0, dialogue: [] },
  prof_bow: { name: '궁술과 시엘 교수', icon: '🏹', tint: 0xa0d0a8, dialogue: [] },
  student: { name: '신입생', icon: '🎒', tint: 0x9aa0b0, scale: 0.95, dialogue: [] },
  // 장면 대화 (컷신의 talk 로만 엶, 맵에 없음). 화자는 대사마다 who
  tut_scene: {
    name: '',
    icon: '🏫',
    dialogue: [],
    talks: [
      // 장면 1. 학교 홀 — 첫 충돌
      {
        when: { quest: 'tu1', state: 'none' },
        steps: [
          { line: '으아앗! 죄, 죄송합니다!! 앞을 못 보고 그만…… 어엇?! 선배님?!', who: 'cls:mage' },
          { line: '……어깨 부딪힌 건 난데 왜 저쪽한테 사과하냐.', who: 'cls:archer' },
          { line: '그, 그치만 인상이 너무 무서우셔서…… 앗! 가슴에 신입생 명찰! 같은 신입생이었구나!', who: 'cls:mage' },
          { line: '……무섭다는 소리는 자주 들어. 괜찮아, 안 다쳤으면 됐어.', who: 'cls:warrior' },
          { line: '하아…… 입학식 첫날부터 소란스럽네. 야, 거기 떨어진 종이. 네 거 아니냐?', who: 'cls:archer' },
          { line: '헐! 내 신입생 대표 선서문! 큰일 날 뻔했네, 고마워! 난 마법학과 수석 입학생이야. 잘 부탁해!', who: 'cls:mage' },
          { line: '수석 입학생이 복도를 전력 질주하다 부딪히고 다니냐…… 난 궁술과. 저쪽은 검술과 명찰이네.', who: 'cls:archer' },
          { line: '……반가워. 식 시작할 시간 다 됐으니까, 얼른 강당으로 가자.', who: 'cls:warrior' },
          { do: { quest: 'give', id: 'tu1' } },
        ],
      },
      // 장면 2. 강당 — 폭발 뒤 (앞부분을 본 뒤: 플래그 tu_cer)
      {
        when: { all: [{ quest: 'tu1', state: 'ready' }, { flag: 'tu_cer', gte: 1 }] },
        steps: [
          { line: '쿨럭, 쿨럭! 어라…… 살아있네? 고마워, 나이스 캐치!', who: 'cls:mage' },
          { line: '……무모한 짓 좀 하지 마. 다칠 뻔했잖아.', who: 'cls:warrior' },
          { line: '……몸이 먼저 움직였네. 야, 너 수석 입학생 맞냐? 식장을 폭파시킬 셈이야?', who: 'cls:archer' },
          { line: '오오오!! 보았는가, 교수진! 시작부터 불꽃 튀는 패기와 완벽한 협동심! 역시 우리 영지의 미래들이오!', who: 'lord' },
          { line: '……영주님께서 저렇게 흡족해하시니 징계는 면했군.', who: 'prof_sword' },
          { line: '하지만 소란을 피운 책임은 져야겠죠. 거기 세 학생, 입학식 끝난 뒤 학교 홀과 정원 뒷정리는 너희 몫입니다.', who: 'prof_magic' },
          { line: '……전부 깔끔하게 치우고 돌아가도록.', who: 'prof_bow' },
          { line: '에에엑?! 첫날부터 벌청소라니!', who: 'cls:mage' },
          { line: '……내가 왜 휩쓸려서 청소를 해야 하는 건데.', who: 'cls:archer' },
          { do: { quest: 'report', id: 'tu1' } },
          { do: { quest: 'give', id: 'tu2' } },
        ],
      },
      // 장면 2. 강당 — 폭발 전
      {
        when: { quest: 'tu1', state: 'ready' },
        steps: [
          { line: '에헴! 우리 가문이 되살린 이 유서 깊은 마법학교에 입학한 신입생 여러분, 진심으로 환영하오! 자, 올해 수석 입학생의 기념 시연이 있겠소!', who: 'lord' },
          { line: '(정석대로 기초 불꽃만 보여주면 너무 뻔하지! 부모님 여행 일지에서 본 원소 조합을 살짝만 섞어 볼까……!)', who: 'cls:mage' },
          { line: '잠깐, 그 마력 배열은 아직 신입생이 다루기엔——', who: 'prof_magic' },
          { do: { flag: 'tu_cer', set: 1 } },
        ],
      },
      // 장면 3. 방과 후 학교 홀 (벌청소 보고)
      {
        when: { quest: 'tu2', state: 'ready' },
        steps: [
          { line: '후우, 드디어 끝났다! 둘 다 진짜 미안해. 나 때문에 첫날부터 고생만 시키고……', who: 'cls:mage' },
          { line: '괜찮아. 혼자 멍하니 있는 것보다 움직이는 게 나았어.', who: 'cls:warrior' },
          { line: '……뭐, 덕분에 사람 얼굴은 확실히 익혔네. 다음부턴 실험하기 전에 예고나 해. 피할 준비는 하게.', who: 'cls:archer' },
          { line: '헤헤, 약속할게! 그 대신 내가 야외매점에서 간식 쏠게! 학과는 달라도 앞으로 자주 보자!', who: 'cls:mage' },
          { do: { quest: 'report', id: 'tu2' } },
        ],
      },
      // 제3막 1. 합동 배치 (합동 훈련실에 처음 들어옴)
      {
        when: { all: [{ quest: 'tu6', state: 'active' }, { flag: 'tu_joint', lt: 1 }] },
        steps: [
          { line: '신입생 기초 실전 평가를 시작한다! 학과 구분 없이 3인 1조로 편성했으니, 서로 호흡을 맞춰 마법으로 움직이는 훈련 인형들을 제압해 봐라!', who: 'kyla' },
          { line: '우와! 또 우리 셋이 한 조야! 이거 완전 운명 아니야?!', who: 'cls:mage' },
          { line: '……제비뽑기 운이 지지리도 없는 거겠지. 얌전히 기본기만 맞춰서 빨리 끝내자.', who: 'cls:archer' },
          { line: '……좋아. 내가 앞에서 시선을 끌 테니까, 뒤에서 지원해 줘.', who: 'cls:warrior' },
          { do: { flag: 'tu_joint', set: 1 } },
        ],
      },
      // 제3막 2. 폭주 (검사로 할 때: 손끝 독백)
      {
        when: { all: [{ quest: 'tu6', state: 'ready' }, { cls: 'warrior' }] },
        steps: [
          { line: '……어? 방금 손끝이 왜 이렇게 차가웠지……?', who: 'player' } as DialogueStep,
        ].concat(BERSERK),
      },
      {
        when: { quest: 'tu6', state: 'ready' },
        steps: [{ line: '……?! 잠깐, 저 인형 상태가 이상해!', who: 'cls:warrior' } as DialogueStep].concat(BERSERK),
      },
    ],
  },
  // 결정체를 가져가는 수상한 자 (장면 전용 맵의 컷신에만 나옴, 대화 없음)
  villain: {
    name: '???',
    icon: '🎭',
    dialogue: [],
    tint: 0x3a3048,
  },
  // 교수님 (특수 NPC): 이야기 대사가 있으면 교수님 메뉴 대신 대화창
  // 세발토끼 채집가 (2026-11-22, 채집 공간 포탈 옆): '세발토끼' 조직. 채집 도구 상점
  gatherer: {
    name: '세발토끼 채집가',
    icon: '🐇',
    dialogue: [{ choices: [{ label: '거래하기', reply: [{ open: 'npcShop' }] }] }],
  },
  // 성형사 (2026-11-25, 테스트): 말 걸면 성형 창 (얼굴·눈동자 색). 창 여는 건 client main.ts
  surgeon: {
    name: '성형사',
    icon: '💄',
    dialogue: [],
  },
  // 대장장이의 딸 (2026-11-21): 대장장이 옆, 대화만 (준비 중)
  smith_daughter: {
    name: '대 장부',
    icon: '🔨',
    scale: 0.8,
    dialogue: [{ line: '할 얘기 있어?' }],
  },
  prof: {
    name: '교수님',
    icon: '🧙',
    dialogue: [],
    talks: [
      // 전직 시험 보고: 갈래 고르기 (대사 임시)
      ...(Object.keys(ADVANCE_LINES) as ClassId[]).map(cls => ({
        when: { all: [{ quest: ADVANCE.quest, state: 'ready' }, { cls }] } as Cond,
        steps: [
          { line: '(임시) 시험을 통과했구나. 이제 네 길을 정할 때다.', who: 'prof' },
          {
            choices: ADVANCE_LINES[cls].map((l, i) => ({
              label: l.name,
              reply: [
                { do: { flag: ADVANCE.flag, set: i + 1 } },
                { do: { quest: 'report', id: ADVANCE.quest } },
                { line: `(임시) ${l.name}의 길이라. 좋다.`, who: 'prof' },
              ] as DialogueStep[],
            })),
          },
        ] as DialogueStep[],
      })),
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
  // ---- 영주님의 생일잔치 (2026-11-21, 대사 임시: 유저 줄거리로 Claude 가 씀) ----
  // 마을 아주머니 마샤: 꿀케이크 (bd1)
  masha: {
    name: '마샤',
    icon: '🧁',
    dialogue: [{ line: '요즘 마을이 북적북적하지? 다들 영주님 생신 잔치 준비로 정신이 없어.' }],
    talks: [
      deliver('masha', '어머, 초대장이 이제야 왔네! 잔치 날 꿀케이크 잔뜩 구워 갈게.'),
      {
        when: { all: [{ quest: 'mg13', state: 'done' }, { level: { gte: 3 } }, { quest: 'bd1', state: 'none' }] },
        steps: [
          { line: '세상에, 들었어? 영주님 생신 잔치가 올해도 신기록이래. 이번엔 진짜 역대급이라고 또 예고를 하셨다지 뭐야.' },
          { line: '잔치에 온 사람들 모두한테 내 꿀케이크를 먹이려면… 꿀이 턱없이 모자라.' },
          { line: '딱 한 가지 방법이 있긴 한데…' },
          { line: '제가 도울게요. 어떤 방법인데요?', who: 'player' },
          { line: '(목소리를 낮추며) …깊은 숲에 꿀을 머금은 슬라임이 살아. 좀 께름칙하지만, 맛은 있을 거야.' },
          { line: '원소 슬라임 서식지 왼쪽 위로 올라가면 있대. 꿀 50개만 모아다 줘!' },
          { do: { quest: 'give', id: 'bd1' } },
        ],
      },
      { when: { quest: 'bd1', state: 'active' }, steps: [{ line: '꿀 50개, 부탁해! 원소 슬라임 서식지 왼쪽 위로 올라가면 꿀 슬라임이 있대.' }] },
      {
        when: { quest: 'bd1', state: 'ready' },
        steps: [
          { line: '어머, 벌써 다 모았어? 이 정도면 꿀케이크를 잔뜩 구울 수 있겠다!' },
          { line: '고마워. 이건 수고비야.' },
          { do: { quest: 'report', id: 'bd1' } },
        ],
      },
      { when: { quest: 'bd1', state: 'done' }, steps: [{ line: '잔치 날 꿀케이크 꼭 먹으러 와!' }] },
    ],
    guide: true,
  },
  // 영주의 집사 세바스찬: 초대장 배달 (bd3)
  sebastian: {
    name: '세바스찬',
    icon: '🎩',
    dialogue: [{ line: '영주님의 생신 잔치 준비로 영지 전체가 분주합니다. 저 역시 마찬가지고요.' }],
    talks: [
      {
        when: { all: [{ quest: 'mg13', state: 'done' }, { level: { gte: 3 } }, { quest: 'bd3', state: 'none' }] },
        steps: [
          { line: '실례합니다. 저는 영주님을 모시는 집사, 세바스찬이라 합니다.' },
          { line: '생신 잔치 초대장은 진즉 보냈습니다만… 의문의 도적단에게 물자와 함께 통째로 약탈당하고 말았습니다.' },
          { line: '잔치가 코앞이라 이렇게 직접 돌고 있는데, 손이 모자라군요. 마을 분들께 초대장을 전해 주시겠습니까?' },
          { line: '대 장장이, 마샤 부인, 합창단 꼬마, 매점의 모리, 그리고 폭죽 장인. 이 다섯 분입니다.' },
          { do: { quest: 'give', id: 'bd3' } },
        ],
      },
      {
        when: { all: [{ quest: 'bd3', state: 'active' }, { not: { has: 'invitation' } }] },
        steps: [{ line: '초대장이 모자라십니까? 여분이 있으니 한 장 더 드리지요.' }, { do: { item: 'invitation', n: 1 } }],
      },
      { when: { quest: 'bd3', state: 'active' }, steps: [{ line: '대 장장이, 마샤 부인, 합창단 꼬마, 모리, 폭죽 장인. 잘 부탁드립니다.' }] },
      {
        when: { quest: 'bd3', state: 'ready' },
        steps: [{ line: '모두 전해 주셨군요. 덕분에 한시름 덜었습니다. 약소하지만 받아 주십시오.' }, { do: { quest: 'report', id: 'bd3' } }],
      },
      { when: { quest: 'bd3', state: 'done' }, steps: [{ line: '잔치 날 뵙겠습니다. 그 도적단 일은… 저희도 알아보는 중입니다.' }] },
    ],
    guide: true,
  },
  // 합창단 꼬마: 날아간 악보 (bd4). 초대장을 받으면 열림
  choir_kid: {
    name: '합창단 꼬마',
    icon: '🎵',
    dialogue: [{ line: '……. (부끄러운 듯 고개를 돌린다)' }],
    talks: [
      deliver('choir_kid', '……초대장. 고, 고마워요.'),
      {
        when: { all: [{ flag: 'bd3_choir_kid', gte: 1 }, { quest: 'bd4', state: 'none' }] },
        steps: [
          { line: '저, 저기… 잔치에서 노래하기로 했는데요…' },
          { line: '사람들 앞이 부끄러워서, 아무도 없는 밤에 가도에서 혼자 연습했어요.' },
          { line: '그랬더니 노랫소리를 듣고 들짐승들이 몰려와서… 가도를 점령해 버렸어요.' },
          { line: '그때 들짐승이 제 악보를 물고 가 버렸어요. 꼭 되찾아야 해요… 도와주실래요?' },
          { do: { quest: 'give', id: 'bd4' } },
        ],
      },
      { when: { quest: 'bd4', state: 'active' }, steps: [{ line: '악보는 영지 가도에 흩어져 있을 거예요… 다섯 장이에요.' }] },
      {
        when: { quest: 'bd4', state: 'ready' },
        steps: [{ line: '제 악보…! 정말 고마워요. 잔치 날, 꼭 들으러 와 주세요.' }, { do: { quest: 'report', id: 'bd4' } }],
      },
      { when: { quest: 'bd4', state: 'done' }, steps: [{ line: '라, 라라… (작게 연습 중이다)' }] },
    ],
    guide: true,
  },
  // 폭죽 장인: 폭죽은 처음이지? (bd_fw, 필수 아님·반복). 초대장을 받으면 열림
  firework_master: {
    name: '폭죽 장인',
    icon: '🎇',
    dialogue: [{ line: '이번 잔치 폭죽은 역대급이 될 거다. 두고 보라고!' }],
    talks: [
      deliver('firework_master', '초대장? 당연히 가지. 내 폭죽이 없는 잔치는 잔치가 아니니까!'),
      {
        when: { all: [{ flag: 'bd3_firework_master', gte: 1 }, { quest: 'bd_fw', state: 'none' }] },
        steps: [
          { line: '이번에 내가 신기술을 개발했거든. 원소의 힘으로 하늘을 수놓는 거지!' },
          { line: '너한테도 특별히 보여 주마. 원소 구슬 10개만 가져와. 공짜로 만들어 줄 테니.' },
          { do: { quest: 'give', id: 'bd_fw' } },
        ],
      },
      // 한 번 끝낸 뒤로는 돈으로 삼 (2026-11-22). 나중에 제작 레시피도 팔 예정
      { when: { quest: 'bd_fw', state: 'done' }, steps: [{ choices: [{ label: '거래하기', reply: [{ open: 'npcShop' }] }] }] },
      { when: { quest: 'bd_fw', state: 'active' }, steps: [{ line: '원소 구슬 10개. 원소 슬라임들이 가끔 떨어뜨리지.' }] },
      {
        when: { quest: 'bd_fw', state: 'ready' },
        steps: [{ line: '좋아, 좋아! 자, 받아라. 하늘에 쏘아 올려 보면 내 실력을 알 거다.' }, { do: { quest: 'report', id: 'bd_fw' } }],
      },
    ],
  },
  // 떠돌이 상인 (학교 앞): 먼 지역에서 온 특별 상인. [거래하기] = 주화 상점 (items.ts 의 COIN_SHOP)
  wanderer: {
    name: '떠돌이 상인',
    icon: '🎒',
    // 2026-11-21 유저: 선택지 두 개, [누구세요?] 대사는 이스터에그
    dialogue: [{
      choices: [
        { label: '누구세요?', reply: [{ line: '감옥에서누가돌아왔게' }] },
        { label: '거래하기', reply: [{ open: 'coinShop' }] },
      ],
    }],
  },
  // 매점 모리 (특수 NPC): 초대장 받기만 대화, 나머지는 매점 창
  shop: {
    name: '모리',
    icon: '🛒',
    dialogue: [],
    talks: [deliver('shop', '초대장이요? 잔치 날엔 매점 문 닫고 놀러 가야겠네요!')],
  },
  // 대 장장이: 영주님 동상 (bd2). 줄 퀘스트·보고할 퀘스트가 없으면 대장간 창이 열림
  smith: {
    name: '대 장장이',
    icon: '🔨',
    dialogue: [],
    talks: [
      deliver('smith', '초대장? …동상 만드느라 바빠 죽겠는데. 뭐, 공짜 밥이면 가야지.', 'smith'),
      {
        when: { all: [{ quest: 'mg13', state: 'done' }, { level: { gte: 3 } }, { quest: 'bd2', state: 'none' }] },
        steps: [
          { line: '하… 영주님이 또 특별 의뢰를 하셨어. 잔치 때 모두한테 나눠 줄 본인 동상을, 그것도 작은 걸로 잔뜩.', who: 'smith' },
          { line: '귀찮아 죽겠는데… 보수가 워낙 두둑해서 말이야.', who: 'smith' },
          { line: '너, 심부름 좀 해 줄래? 쓸만한 고철 5개만 구해 와. 보수는 나눠 줄게. 용돈 삼아.', who: 'smith' },
          { do: { quest: 'give', id: 'bd2' } },
        ],
      },
      {
        when: { quest: 'bd2', state: 'ready' },
        steps: [
          { line: '오, 쓸만한 고철이네. 이 정도면 동상 몇 개는 뽑겠어.', who: 'smith' },
          { line: '약속한 보수다. 아껴 써라.', who: 'smith' },
          { do: { quest: 'report', id: 'bd2' } },
        ],
      },
    ],
  },
  // 기숙사 방 침대: 밤에 자면 다음으로 (검사·궁수: 동급생 마법사가 깨우러 옴 / 마법사: 소리에 깨서 동급생 검사를 깨우러 감)
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
        when: { all: [{ quest: 'mgm4', state: 'ready' }, { time: 'night' }] },
        steps: [
          { line: '(잠이 든다…)', who: 'player' },
          { line: '(……!)', who: 'player' },
          { line: '(또 그 소리다! 이번엔 확실히 들렸어.)', who: 'player' },
          { line: '(혼자 가기엔 좀 무서운데… 학교 홀에 있는 동급생 검사를 깨우자!)', who: 'player' },
          { do: { quest: 'report', id: 'mgm4' } },
          { do: { quest: 'give', id: 'mgm5' } },
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
