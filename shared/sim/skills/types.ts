import type { Element } from '../../data/elements';
import type { Fx } from '../types';
import type { Hitbox, PlayerState } from '../entities';

export type HitboxSpec = Omit<Hitbox, 'owner' | 't' | 'hit' | 'sm' | 'face' | 'order' | 'chain'> & {
  face?: number; order?: number; chain?: boolean; skill: string;
};

/** 스킬 코드가 월드에 할 수 있는 일 */
export interface SkillWorld {
  time: number;
  rng: () => number;
  addHB(p: PlayerState, h: HitboxSpec): void;
  fx(f: Fx): void;
  float(x: number, y: number, text: string, color: string, size?: number, life?: number): void;
  chainText(p: PlayerState, skill: string, chain: boolean): void;
  elemOf(p: PlayerState, skill: string): Element | null;
  learned(p: PlayerState, skill: string): boolean;
  held(p: PlayerState, skill: string): boolean;
}
