// 장비 부가효과(옵션) · 강화 · 대장장이 수치 (기획서 7장 "장비 옵션·강화")
import type { BonusId, EquipPart, Grade } from './items';

// ---------- 부가효과 ----------
/** 옵션 하나: 단계(1~OPT_MAX_TIER)마다 per 만큼 */
export interface OptionDef { per: number }
export type OptionId = Extract<BonusId, 'str' | 'dex' | 'int' | 'hp' | 'mp' | 'atk' | 'def' | 'crit' | 'mpCost' | 'speed' | 'hpRegen' | 'boss' | 'mob'>;
export const OPTIONS: Record<OptionId, OptionDef> = {
  str: { per: 1 }, dex: { per: 1 }, int: { per: 1 },
  hp: { per: 10 }, mp: { per: 8 },
  atk: { per: 2 }, def: { per: 3 },
  crit: { per: 1 },      // 치명타 확률 %
  mpCost: { per: 2 },    // MP 소모 감소 %
  speed: { per: 2 },     // 이동속도 %
  hpRegen: { per: 0.4 }, // 초당 HP 회복
  boss: { per: 3 },      // 보스 피해 %
  mob: { per: 3 },       // 일반몹 피해 % (정예몹 포함, 보스 빼고)
};
export const OPT_MAX_TIER = 5;

/** 부위마다 붙을 수 있는 옵션 */
const WEAPON: OptionId[] = ['str', 'dex', 'int', 'atk', 'crit', 'mpCost', 'boss', 'mob'];
const ARMOR: OptionId[] = ['str', 'dex', 'int', 'hp', 'mp', 'def', 'hpRegen', 'speed'];
const ACC: OptionId[] = ['str', 'dex', 'int', 'hp', 'mp', 'crit', 'mpCost', 'speed', 'boss', 'mob'];
export const OPTION_POOL: Record<EquipPart, OptionId[]> = {
  weapon: WEAPON, hat: ARMOR, top: ARMOR, bottom: ARMOR, gloves: ARMOR, shoes: ARMOR, necklace: ACC, ring: ACC,
};

/** 등급별 옵션 최대 개수 */
export const OPT_MAX: Record<Grade, number> = { common: 1, rare: 2, epic: 3, legendary: 3, mythic: 3 };
/** 드롭될 때 n 번째 옵션이 붙을 확률 (앞 칸이 붙어야 다음 칸을 굴림) */
export const OPT_CHANCE = [0.5, 0.25, 0.1];

// ---------- 강화 ----------
export const ENHANCE_MAX = 15;
/**
 * [지금 강화 수치] → 다음 단계 시도: 성공·파괴 확률, 비용(골드). 나머지는 실패(그대로).
 * +1~5 무난 · +6~10 중수 목표 · +11~15 어려움
 */
export const ENHANCE: { ok: number; boom: number; cost: number }[] = [
  { ok: 1.0, boom: 0, cost: 50 },
  { ok: 0.95, boom: 0, cost: 80 },
  { ok: 0.9, boom: 0, cost: 120 },
  { ok: 0.85, boom: 0, cost: 170 },
  { ok: 0.8, boom: 0, cost: 230 },
  { ok: 0.7, boom: 0.02, cost: 300 },
  { ok: 0.6, boom: 0.03, cost: 400 },
  { ok: 0.5, boom: 0.05, cost: 500 },
  { ok: 0.45, boom: 0.07, cost: 650 },
  { ok: 0.4, boom: 0.1, cost: 800 },
  { ok: 0.3, boom: 0.15, cost: 1000 },
  { ok: 0.25, boom: 0.18, cost: 1300 },
  { ok: 0.2, boom: 0.2, cost: 1600 },
  { ok: 0.15, boom: 0.25, cost: 2000 },
  { ok: 0.1, boom: 0.3, cost: 2500 },
];
/** 파괴 방지: 비용 배수 (파괴가 나오면 실패로) */
export const ENHANCE_PROTECT = 2;
/** 강화 1단계마다 장비 기본 능력치 +% : +1~5 / +6~10 / +11~15 (15강 = +90%) */
export const ENHANCE_PCT = [0.08, 0.06, 0.04];
export function enhanceMult(enh: number) {
  let p = 0;
  for (let i = 1; i <= enh; i++) p += ENHANCE_PCT[Math.min(2, Math.floor((i - 1) / 5))];
  return 1 + p;
}

// ---------- 대장장이 ----------
/** 파괴된 장비 수리 (강화·옵션 그대로) */
export const repairCost = (enh: number) => 300 + 150 * enh;
/** 옵션 재설정: 옵션 종류만 다시 뽑음 (칸 수·단계는 그대로) */
export const REROLL_COST = 300;
/** 옵션 칸 강화 (무조건 성공): [지금 단계 1~4] → 비용 */
export const OPT_UP_COST = [0, 200, 400, 800, 1600];
