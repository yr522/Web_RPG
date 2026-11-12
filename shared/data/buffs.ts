// 플레이어에게 걸린 버프·디버프 (체력 바 위 아이콘 줄). 아이콘 그림이 생기기 전까지는 색 네모
import type { PlayerState } from '../sim/entities';
import { HAEBANG_TIME } from '../sim/skills/mage';
import { GOLEM_AI } from './monsters';

export type BuffId = 'haebang' | 'stun';

export const BUFFS: Record<BuffId, { name: string; color: string; debuff?: boolean }> = {
  haebang: { name: '마력 해방', color: '#b388ff' },
  stun: { name: '기절', color: '#ffd84a', debuff: true },
};

/** 지금 걸린 버프들: 남은 시간 / 전체 시간 */
export function playerBuffs(p: PlayerState): { id: BuffId; t: number; max: number }[] {
  const out: { id: BuffId; t: number; max: number }[] = [];
  if (p.buffT > 0) out.push({ id: 'haebang', t: p.buffT, max: HAEBANG_TIME });
  if (p.stunT > 0) out.push({ id: 'stun', t: p.stunT, max: GOLEM_AI.stunTime });
  return out;
}
