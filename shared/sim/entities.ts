// 시뮬레이션 안의 것들 (플레이어, 몬스터, 공격 판정)
import type { Body } from './physics';
import type { Command, EntityId } from './types';
import type { DerivedStats, SaveData } from './save';
import type { Element } from '../data/elements';

/** 지금 하고 있는 행동 (공격, 조준, 돌진 등) */
export interface PlayerAction {
  name: string;
  skill?: string;
  t: number;
  dur: number;
  events?: { at: number; fn: () => void; done?: boolean }[];
  update?: (dt: number) => void;
  end?: () => void;
  noGravity?: boolean;
  /** 무적 */
  inv?: boolean;
  superArmor?: boolean;
  /** 조준 각도 (질풍참) */
  ang?: number;
  maxAng?: number;
  aiming?: boolean;
}

export interface PlayerState extends Body {
  id: EntityId;
  name: string;
  face: 1 | -1;
  hp: number;
  mp: number;
  stats: DerivedStats;
  /** 직업·배운 스킬·포션 등 (로컬에서는 저장 데이터 그 자체, 나중에는 서버가 가진 데이터) */
  data: SaveData;
  /** 이번 틱 입력 */
  cmd: Command;
  potionCd: number;
  warnCd: number;
  action: PlayerAction | null;
  cd: Record<string, number>;
  /** 공격 후 다음 입력까지 잠깐 쉬는 시간 */
  lockT: number;
  buffer: { name: string; t: number } | null;
  lastHit: { order: number; t: number } | null;
  /** 전사 초식 순서 (일섬 1 → 월참 2 → 질풍참 3) */
  combo: number;
  /** 질풍참 직후 천붕을 쓸 수 있는 시간 */
  cbWindow: number;
  /** 맞은 뒤 무적 시간 */
  invT: number;
  hurt: number;
}

export interface Enemy extends Body {
  id: EntityId;
  elem: Element | null;
  elemental: boolean;
  hp: number;
  maxHp: number;
  dir: 1 | -1;
  turnT: number;
  hopT: number;
  stun: number;
  /** 마지막으로 맞은 원소 (원소 반응용) */
  record: Element | null;
  dead: boolean;
  deadT: number;
  spawnX: number;
  spawnY: number;
  speed: number;
  /** 큰 점프 패턴: 'none' → 'crouch'(웅크림) → 'leap'(점프) */
  leap: 'none' | 'crouch' | 'leap';
  leapT: number;
  /** 다음 큰 점프까지 */
  leapCd: number;
}

export interface Coin {
  id: EntityId;
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  onGround: boolean; drop: number; plat: import('./physics').Solid | null;
  amt: number;
  t: number;
}

export interface Hitbox {
  owner: PlayerState;
  /** 플레이어 중심 기준 위치 (center 면 가운데 정렬) */
  dx: number; dy: number; w: number; h: number;
  center?: boolean;
  face: number;
  coef: number;
  elem: Element | null;
  order: number;
  chain: boolean;
  kb: number;
  kbAng?: number;
  launch?: number;
  light?: boolean;
  life: number;
  t: number;
  hit: Set<EntityId>;
  /** 스킬 레벨 배율 */
  sm: number;
}
