import type { Element } from '../../data/elements';
import type { Fx } from '../types';
import type { Enemy, Hitbox, PlayerState, Projectile, Vortex } from '../entities';

export type HitboxSpec = Omit<Hitbox, 'owner' | 't' | 'hit' | 'sm' | 'face' | 'order' | 'chain' | 'dx' | 'dy' | 'w' | 'h'> & {
  dx?: number; dy?: number; w?: number; h?: number;
  face?: number; order?: number; chain?: boolean; skill: string;
};

export interface ProjSpec {
  kind: Projectile['kind'];
  x: number; y: number; vx: number; vy: number;
  range: number; size: number; len?: number;
  coef: number; elem: Element | null; kb: number;
  pierce?: boolean; order?: number; chain?: boolean;
  skill: string;
  exec?: { pct: number; cap: number };
}

/** 스킬 코드가 월드에 할 수 있는 일 */
export interface SkillWorld {
  time: number;
  rng: () => number;
  addHB(p: PlayerState, h: HitboxSpec): void;
  addProj(p: PlayerState, s: ProjSpec): Projectile;
  addVortex(p: PlayerState, v: Vortex): void;
  /** t 초 뒤에 실행 */
  later(p: PlayerState, t: number, fn: () => void): void;
  /** 바라보는 쪽에서 가장 가까운 몬스터 */
  nearestFront(p: PlayerState, range: number): Enemy | null;
  fx(f: Fx): void;
  float(x: number, y: number, text: string, color: string, size?: number, life?: number): void;
  chainText(p: PlayerState, skill: string, chain: boolean): void;
  elemOf(p: PlayerState, skill: string): Element | null;
  learned(p: PlayerState, skill: string): boolean;
  held(p: PlayerState, skill: string): boolean;
  /** 덫 설치 (x = 가운데, 바닥 위) */
  addTrap(p: PlayerState, x: number): void;
}

/** 직업별 스킬 묶음 */
export interface ClassSkills {
  /** 쓸 수 있는지 검사 (true 또는 안 되는 이유) */
  can: Record<string, (w: SkillWorld, p: PlayerState) => true | string>;
  start: Record<string, (w: SkillWorld, p: PlayerState, chain: boolean) => void>;
  /** 공격 중에도 걸을 수 있는 행동 (값 = 이동 속도 배율) */
  walk: Record<string, number>;
  /** Z 를 누르고 있으면 계속 나가는 스킬 */
  auto: string[];
}
