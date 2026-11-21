// 전직: 고른 갈래 (전직 전이면 null)
import { ADVANCE, ADVANCE_LINES, type AdvanceLine } from '../data/advance';
import type { SaveData } from '../sim/save';

export function advanceLine(s: SaveData): AdvanceLine | null {
  const i = s.flags[ADVANCE.flag] ?? 0;
  return ADVANCE_LINES[s.cls][i - 1] ?? null;
}
