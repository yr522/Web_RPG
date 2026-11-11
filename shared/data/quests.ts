// 퀘스트 (기획서 6장).
// - 교수님 반복 퀘스트: giver 'prof', repeat true → 교수님 퀘스트 메뉴에 나옴
// - 이야기 퀘스트: 대화 NPC 대사의 { do: { quest: 'give', id } } 로 받고, { do: { quest: 'report', id } } 로 보고
import type { MapId } from './maps';

/** 퀘스트 목표 */
export type QuestGoal =
  /** 몬스터 처치. target: 일반 / 원소 / 아무거나. tag 가 있으면 그 이름표 몬스터만 셈 (보스 등, 컷신의 fight 로 나옴) */
  | { kind: 'kill'; target: 'normal' | 'elemental' | 'any'; n: number; tag?: string }
  /** 물건 모아 오기 (가방에 있는 개수로 셈, 보고할 때 가져감) */
  | { kind: 'collect'; item: string; n: number }
  /** 누구에게 말 걸기 (그 NPC 대사에 { do: { quest: 'report' } } 가 있어야 끝남) */
  | { kind: 'talk'; npc: string }
  /** 어느 맵에 가 보기 */
  | { kind: 'visit'; map: MapId };

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
  goal: QuestGoal;
  reward: QuestReward;
  /** 누가 주는지: 'prof'(교수님 메뉴) 또는 대화 NPC id */
  giver: string;
  /** 끝난 뒤 다시 받을 수 있는지 */
  repeat?: boolean;
  /** 길 안내 목적지 (없으면 목표에서 짐작: 말 걸기 → 그 NPC 맵, 가기 → 그 맵, 처치 → 그 몬스터 맵) */
  where?: MapId;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'q1', name: '슬라임 퇴치', desc: '학교 뒷숲에서 일반 슬라임 8마리 처치', giver: 'prof', repeat: true,
    goal: { kind: 'kill', target: 'normal', n: 8 }, reward: { exp: lv => 60 + lv * 12 },
  },
  {
    id: 'q2', name: '원소 슬라임 조사', desc: '원소 슬라임 서식지에서 원소 슬라임 5마리 처치', giver: 'prof', repeat: true,
    goal: { kind: 'kill', target: 'elemental', n: 5 }, reward: { exp: lv => 100 + lv * 18 },
  },
  // ---- 이야기 장치 테스트용 (시나리오가 들어오면 지움) ----
  {
    id: 'test_gel', name: '테스트 퀘스트: 점액 모으기', desc: '슬라임 점액 3개를 테스트 NPC 에게', giver: 'story_test',
    goal: { kind: 'collect', item: 'slime_gel', n: 3 }, reward: { exp: 50, gold: 100, items: [{ id: 'hp', n: 2 }] }, where: 'field',
  },
  {
    id: 'test_visit', name: '테스트 퀘스트: 서식지 가 보기', desc: '원소 슬라임 서식지에 가 보기', giver: 'story_test',
    goal: { kind: 'visit', map: 'field2' }, reward: { exp: 30 },
  },
  {
    id: 'test_talk', name: '테스트 퀘스트: 말 걸기', desc: '테스트 NPC 에게 말 걸기', giver: 'story_test',
    goal: { kind: 'talk', npc: 'story_test' }, reward: { gold: 50 },
  },
  {
    id: 'test_boss', name: '테스트 퀘스트: 이름표 몬스터', desc: '컷신에서 나온 테스트 슬라임 처치 (다른 슬라임은 안 셈)', giver: 'story_test',
    goal: { kind: 'kill', target: 'any', n: 1, tag: 'test_boss' }, reward: { exp: 40 },
  },
];

export const questDef = (id: string) => QUESTS.find(q => q.id === id);
