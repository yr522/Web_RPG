// 보스 메뉴 (왼쪽 위 [보스]): 열린 보스는 그 보스 방으로 바로 이동
import type { Cond } from './npcs';
import type { MapId } from './maps';

export interface BossEntry {
  id: string;
  name: string;
  /** 이동할 맵과 위치 */
  map: MapId;
  x: number;
  /** 이 조건이 맞으면 버튼이 열림 */
  unlock: Cond;
}

export const BOSSES: BossEntry[] = [
  // 마법 골렘: 골렘 처치 퀘스트(mg11)를 끝내면 열림
  { id: 'golem', name: '마법 골렘', map: 'golem_room', x: 200, unlock: { quest: 'mg11', state: 'done' } },
];
