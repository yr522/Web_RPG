// 대화 NPC 와 대사 (교수님·매점 모리는 메뉴가 있는 특수 NPC 라 여기 없음)
//
// 대사 쓰는 법: 위에서부터 차례로 나온다.
//   { line: '대사' }                  → 대사 한 줄 (누르면 다음)
//   { line: '대사', who: 'player' }   → 플레이어가 하는 말 (이름 자리에 플레이어 이름)
//   { line: '대사', who: 'NPC id' }   → 다른 NPC 가 하는 말 (이름 자리에 그 NPC 이름)
//   { choices: [ { label, reply } ] } → 선택지. 고르면 reply 대사들이 이어서 나온다
//   { do: 효과 }                       → 화면에 안 보이고 효과만 (퀘스트 주기·보고, 플래그 바꾸기, 물건·골드 주고받기)
//   { cutscene: '컷신 id' }            → 대화창을 닫고 컷신 재생 (cutscenes.ts)
//   { open: 'coinShop' }               → 대화창을 닫고 그 창을 엶 (주화 상점 등)
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
  | { open: 'coinShop' };

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
}

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
  // ---- 마법사 직업용 (대사 임시) ----
  // 동급생 검사: 마법사에게는 동급생 마법사 대신 이 친구가 같이 감. 평소엔 학교 홀에 있음.
  // 피곤하고 심드렁하지만 부탁하면 마지못해 따라옴. '해 줘' 대신 '이렇게 해야 할 것 같아' 말투, 마력 얘기는 플레이어(마법사)가 함
  warrior_friend: {
    name: '동급생 검사',
    icon: '⚔️',
    tint: 0xe8b8a0,
    dialogue: [{ line: '…하암. 수업 끝나면 바로 잘 거야.' }],
    talks: [
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
        when: { all: [{ cls: 'mage' }, { level: { gte: 3 } }, { quest: 'mgm2', state: 'none' }] },
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
  // 결정체를 가져가는 수상한 자 (장면 전용 맵의 컷신에만 나옴, 대화 없음)
  villain: {
    name: '???',
    icon: '🎭',
    dialogue: [],
    tint: 0x3a3048,
  },
  // 교수님 (특수 NPC): 이야기 대사가 있으면 교수님 메뉴 대신 대화창
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
