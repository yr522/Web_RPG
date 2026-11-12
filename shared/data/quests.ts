// 퀘스트 (기획서 6장).
// - 교수님 반복 퀘스트: giver 'prof', repeat true → 교수님 퀘스트 메뉴에 나옴
// - 목표(goals)는 여러 개 가능, 전부 해야 보고
// - 전달 퀘스트: start 로 물건을 주고, 목표 = [모아 오기(그 물건), 말 걸기(받을 사람)]
// - 이야기 퀘스트: 대화 NPC 대사의 { do: { quest: 'give', id } } 로 받고, { do: { quest: 'report', id } } 로 보고
import type { MapId } from './maps';
import type { MonsterId } from './monsters';

/** 퀘스트 목표 */
export type QuestGoal =
  /** 몬스터 처치. mob: 몬스터 종류 (없으면 아무거나). tag 가 있으면 그 이름표 몬스터만 셈 (보스 등, 컷신의 fight 로 나옴) */
  | { kind: 'kill'; mob?: MonsterId; n: number; tag?: string }
  /** 물건 모아 오기 (가방에 있는 개수로 셈, 보고할 때 가져감) */
  | { kind: 'collect'; item: string; n: number }
  /** 누구에게 말 걸기 (그 NPC 대사에 { do: { quest: 'report' } } 가 있어야 끝남) */
  | { kind: 'talk'; npc: string }
  /** 어느 맵에 가 보기 */
  | { kind: 'visit'; map: MapId }
  /** 레벨 n 달성 */
  | { kind: 'level'; n: number }
  /** 스킬 배우기 (skill 이 없으면 아무 스킬이나 하나) */
  | { kind: 'learn'; skill?: string }
  /** 장비 끼기 (item 이 있으면 그 장비, 없으면 아무 장비나) */
  | { kind: 'equip'; item?: string };

export interface QuestReward {
  /** 숫자 또는 레벨에 따라 바뀌는 값 */
  exp?: number | ((level: number) => number);
  gold?: number;
  items?: { id: string; n: number }[];
}

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  /** 목표들. 여러 개면 전부 해야 보고할 수 있다 (동시에 진행) */
  goals: QuestGoal[];
  reward: QuestReward;
  /** 받을 때 주는 물건 (전달 퀘스트: 이 물건을 모아 오기 목표 + 말 걸기 목표로 전달). 가방에 자리가 없으면 못 받음 */
  start?: { items: { id: string; n: number }[] };
  /** 누가 주는지: 'prof'(교수님 메뉴) 또는 대화 NPC id */
  giver: string;
  /** 끝난 뒤 다시 받을 수 있는지 */
  repeat?: boolean;
  /** 다 하면 NPC 에게 안 가도 바로 보고됨 */
  auto?: boolean;
  /** 보고하면 바로 받는 다음 퀘스트 (자동 수락) */
  next?: string;
  /** 끝났을 때 "퀘스트 완료!" 대신 띄울 큰 글씨 */
  doneBanner?: string;
  /** 하는 동안 밤으로 고정 */
  nightLock?: boolean;
  /** 이 직업이면 (이야기 NPC 가 동행하지 않아서) 다 하면 바로 끝나고 next 를 바로 받음 */
  solo?: { cls: 'warrior' | 'mage' | 'archer'; next?: string };
  /** 하는 동안 따라다니는 NPC (연출, 무적. 플레이어 직업이 그 NPC 와 같으면 안 나옴) */
  companion?: { npc: string; notCls: 'warrior' | 'mage' | 'archer' };
  /** 길 안내 목적지 (없으면 목표에서 짐작: 말 걸기 → 그 NPC 맵, 가기 → 그 맵, 처치 → 그 몬스터 맵) */
  where?: MapId;
}

export const QUESTS: QuestDef[] = [
  // ---- 미니 챕터: 마법공학의 유산 (보상·이름 임시) ----
  // 검사·궁수: 동급생 마법사가 퀘스트를 주고, 다 하면 마법사에게 가서 보고 → 마법사는 다음 맵으로 옮겨 가 있음 → 거기서 다음 퀘스트
  // 마법사: 동행 NPC 가 없어서 다 하면 바로 끝나고 다음 퀘스트를 받음 (solo)
  //   밤에 기숙사 침대에서 자면(Lv 3) 바로 mg5 (혼자 수색)
  {
    id: 'mg2', name: '학교 뒤 숲 둘러보기', desc: '숲 깊은 곳(갈림길)까지 둘러보고 마법사에게 알리기', giver: 'mage_friend',
    goals: [{ kind: 'visit', map: 'crossroad' }, { kind: 'talk', npc: 'mage_friend' }], reward: {},
  },
  {
    id: 'mg4', name: '밤에 잠자기', desc: '밤에 기숙사 방 침대에서 자기', giver: 'mage_friend',
    goals: [{ kind: 'talk', npc: 'bed' }], reward: {},
  },
  {
    id: 'mg5', name: '마법사와 숲으로', desc: '밤의 숲 깊은 곳으로', giver: 'mage_friend',
    goals: [{ kind: 'visit', map: 'guard_a_quiet' }], reward: {}, auto: true, nightLock: true, doneBanner: '"…접근하지 마라."',
    companion: { npc: 'mage_friend', notCls: 'mage' }, solo: { cls: 'mage', next: 'mg6' },
  },
  {
    id: 'mg6', name: '길을 막는 기계 처치', desc: '경비기계A 처치', giver: 'mage_friend',
    goals: [{ kind: 'kill', mob: 'guard_a', n: 5 }], reward: {}, solo: { cls: 'mage', next: 'mg7' },
  },
  {
    id: 'mg7', name: '길을 막는 기계 계속 처치', desc: '경비기계B 처치', giver: 'mage_friend',
    goals: [{ kind: 'kill', mob: 'guard_b', n: 4 }], reward: {}, solo: { cls: 'mage', next: 'mg9' },
  },
  {
    // 공방 입구에서 받음. 보고하면(템은 이때 씀) 공방 입구의 포탈이 열림
    id: 'mg9', name: '입구를 여는 장치', desc: '경비기계B 에게서 공방 퀘스트 템 얻기', giver: 'mage_friend',
    goals: [{ kind: 'collect', item: 'workshop_key', n: 1 }], reward: {}, solo: { cls: 'mage', next: 'mg10' },
  },
  {
    // 공방 안에서 받음. 지하는 갇히는 맵: 다 잡으면 마법사가 골렘 방 문 옆에 나타남 → 보고하고 골렘 퀘스트를 받으면 문이 열림
    id: 'mg10', name: '공방 지하', desc: '공방 지하의 경비기계 전부 처치', giver: 'mage_friend', where: 'under_trial',
    goals: [{ kind: 'kill', mob: 'guard_c', n: 4 }, { kind: 'kill', mob: 'guard_d', n: 4 }], reward: {},
    doneBanner: '강력한 기운이 느껴진다', solo: { cls: 'mage', next: 'mg11' },
  },
  {
    // 골렘을 잡으면 마법사가 골렘 방에 나타남 → 보고하면 끝 (보스 메뉴의 마법 골렘 워프가 열림)
    id: 'mg11', name: '마법 골렘', desc: '마법공학의 유산, 마법 골렘 처치', giver: 'mage_friend', where: 'golem_room',
    goals: [{ kind: 'kill', mob: 'golem', n: 1 }], reward: {}, solo: { cls: 'mage' },
  },

  {
    id: 'q1', name: '슬라임 퇴치', desc: '학교 뒷숲에서 일반 슬라임 8마리 처치', giver: 'prof', repeat: true,
    goals: [{ kind: 'kill', mob: 'slime', n: 8 }], reward: { exp: lv => 60 + lv * 12 },
  },
  {
    id: 'q2', name: '원소 슬라임 조사', desc: '원소 슬라임 서식지에서 원소 슬라임 5마리 처치', giver: 'prof', repeat: true,
    goals: [{ kind: 'kill', mob: 'slime_elem', n: 5 }], reward: { exp: lv => 100 + lv * 18 },
  },
  // ---- 이야기 장치 테스트용 (시나리오가 들어오면 지움) ----
  {
    id: 'test_gel', name: '테스트 퀘스트: 점액 모으기', desc: '슬라임 점액 3개를 테스트 NPC 에게', giver: 'story_test',
    goals: [{ kind: 'collect', item: 'slime_gel', n: 3 }], reward: { exp: 50, gold: 100, items: [{ id: 'hp', n: 2 }] }, where: 'field',
  },
  {
    id: 'test_visit', name: '테스트 퀘스트: 서식지 가 보기', desc: '원소 슬라임 서식지에 가 보기', giver: 'story_test',
    goals: [{ kind: 'visit', map: 'field2' }], reward: { exp: 30 },
  },
  {
    id: 'test_talk', name: '테스트 퀘스트: 말 걸기', desc: '테스트 NPC 에게 말 걸기', giver: 'story_test',
    goals: [{ kind: 'talk', npc: 'story_test' }], reward: { gold: 50 },
  },
  {
    id: 'test_boss', name: '테스트 퀘스트: 이름표 몬스터', desc: '컷신에서 나온 테스트 슬라임 처치 (다른 슬라임은 안 셈)', giver: 'story_test',
    goals: [{ kind: 'kill', n: 1, tag: 'test_boss' }], reward: { exp: 40 },
  },
  {
    id: 'test_deliver', name: '테스트 퀘스트: 편지 전달', desc: '테스트 편지를 테스트 NPC 에게', giver: 'story_test',
    start: { items: [{ id: 'test_letter', n: 1 }] },
    goals: [{ kind: 'collect', item: 'test_letter', n: 1 }, { kind: 'talk', npc: 'test' }], reward: { gold: 30 },
  },
  {
    id: 'test_multi', name: '테스트 퀘스트: 여러 목표', desc: '장비 끼기 + 레벨 3 + 일반 슬라임 2마리', giver: 'story_test',
    goals: [{ kind: 'equip' }, { kind: 'level', n: 3 }, { kind: 'kill', mob: 'slime', n: 2 }], reward: { exp: 30 },
  },
];

export const questDef = (id: string) => QUESTS.find(q => q.id === id);
