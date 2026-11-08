// 시뮬레이션 ↔ 화면 사이에 오가는 것들.
// 입력은 "명령", 결과는 "이벤트". 나중에 멀티가 되면 이 둘이 그대로 네트워크로 오간다.
import type { MapId } from '../data/maps';
import type { SlotKey } from '../data/classes';

export type EntityId = string;

/** 한 틱 동안의 플레이어 입력 */
export interface Command {
  /** -1 왼쪽, 0 정지, 1 오른쪽 */
  move: -1 | 0 | 1;
  up: boolean;
  down: boolean;
  /** 이번 틱에 새로 눌렀는지 (누르고 있는 동안 계속 true 아님) */
  jumpPressed: boolean;
  upPressed: boolean;
  /** 이번 틱에 새로 누른 스킬 슬롯 */
  skillPressed: SlotKey[];
  potionPressed: ('hp' | 'mp')[];
}

export const emptyCommand = (): Command => ({
  move: 0, up: false, down: false, jumpPressed: false, upPressed: false, skillPressed: [], potionPressed: [],
});

export type GameEvent =
  | { type: 'portal'; playerId: EntityId; to: MapId; toX: number }
  | { type: 'mapEnter'; playerId: EntityId; map: MapId }
  | { type: 'notice'; playerId: EntityId; text: string };
