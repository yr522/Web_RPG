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
  /** 지금 누르고 있는 스킬 슬롯 (꾹 누르기·연타용) */
  skillHeld: SlotKey[];
  potionPressed: ('hp' | 'mp')[];
}

export const emptyCommand = (): Command => ({
  move: 0, up: false, down: false, jumpPressed: false, upPressed: false, skillPressed: [], skillHeld: [], potionPressed: [],
});

export type GameEvent =
  | { type: 'portal'; playerId: EntityId; to: MapId; toX: number }
  | { type: 'mapEnter'; playerId: EntityId; map: MapId }
  | { type: 'notice'; playerId: EntityId; text: string }
  /** NPC 앞에서 ↑ */
  | { type: 'interact'; playerId: EntityId; npc: string }
  /** 머리 위 말풍선 (who = 플레이어 id 또는 'npc:<NPC id>'). 시나리오 장면용 */
  | { type: 'say'; who: string; text: string; life?: number }
  /** 머리 위에 떠오르는 글자 (피해, 회복 등) */
  | { type: 'float'; x: number; y: number; text: string; color: string; size?: number; life?: number }
  /** 화면 가운데 큰 글씨 */
  | { type: 'banner'; playerId: EntityId; text: string; color?: string }
  /** 몬스터가 맞음 (화면 흔들림·멈칫·번쩍임용) */
  | { type: 'hit'; enemyId: EntityId; heavy: boolean; reaction: boolean }
  /** 이펙트 (검기, 원 퍼짐 등) */
  | { type: 'fx'; fx: Fx }
  | { type: 'died'; playerId: EntityId }
  | { type: 'kill'; playerId: EntityId; enemyId: EntityId; tag?: string };

export type Fx =
  | { kind: 'arc'; x: number; y: number; face: number; r: number; a0: number; a1: number; color: string; w: number; life: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; w: number; life: number }
  | { kind: 'ring'; x: number; y: number; color: string; r0: number; r1: number; life: number }
  | { kind: 'ghost'; x: number; y: number; w: number; h: number; color: string; life: number }
  /** 원소 기둥: x = 가운데, by = 바닥 */
  | { kind: 'pillar'; x: number; by: number; w: number; h: number; color: string; life: number }
  /** 원소 파도 한 칸: x = 왼쪽, y = 바닥 */
  | { kind: 'flame'; x: number; y: number; w: number; h: number; color: string; life: number }
  /** 화살비 범위 (땅까지 세로 띠) */
  | { kind: 'zone'; x: number; w: number; color: string; life: number };
