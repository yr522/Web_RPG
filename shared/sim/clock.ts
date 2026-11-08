// 실시간 낮밤 (기획서 9장). 시계는 밖에서 주입 → 테스트·서버에서 교체 가능.
export interface Clock { now(): number }
export const realClock: Clock = { now: () => Date.now() };

export const PHASE_MS = 4 * 60 * 1000;
export type DayPhase = 0 | 1 | 2;
export const PHASES = [
  { name: '아침', icon: '🌅' },
  { name: '낮', icon: '☀️' },
  { name: '밤', icon: '🌙' },
] as const;

export interface TimeInfo { phase: DayPhase; remain: number; frac: number; cycle: number }

export function timeInfo(ms: number): TimeInfo {
  const idx = Math.floor(ms / PHASE_MS);
  return {
    phase: (((idx % 3) + 3) % 3) as DayPhase,
    remain: PHASE_MS - (ms % PHASE_MS),
    frac: (ms % PHASE_MS) / PHASE_MS,
    cycle: Math.floor(idx / 3),
  };
}
