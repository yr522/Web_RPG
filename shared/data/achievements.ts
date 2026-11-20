// 업적 · 칭호 (2026-11-21, 이름·조건 임시). 업적을 달성하면 그 이름이 칭호가 되어 캐릭터 이름 위에 달 수 있음.
// 칭호에는 능력치가 없음 (밸런스 정하기 전까지).
import type { MonsterId } from './monsters';

export type AchievementCond =
  /** 몬스터 아무거나 n 마리 */
  | { kills: number }
  /** 이 몬스터 n 마리 */
  | { mob: MonsterId; n: number }
  /** 레벨 n */
  | { level: number }
  /** 이 퀘스트를 끝냄 */
  | { quest: string }
  /** 골드를 n 이상 가짐 */
  | { gold: number }
  /** 도감: 몬스터 n 종류 이상 잡음 */
  | { codex: number };

export interface AchievementDef {
  id: string;
  /** 업적 이름 = 칭호 */
  name: string;
  desc: string;
  cond: AchievementCond;
  /** 칭호 글자 색 */
  color?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_hunt', name: '첫 사냥', desc: '몬스터를 처음으로 잡았다', cond: { kills: 1 } },
  { id: 'hunter_500', name: '사냥꾼', desc: '몬스터 500마리 잡기', cond: { kills: 500 } },
  { id: 'hunter_3000', name: '베테랑 사냥꾼', desc: '몬스터 3000마리 잡기', cond: { kills: 3000 }, color: '#ffd84a' },
  { id: 'slime_100', name: '슬라임 사냥꾼', desc: '슬라임 100마리 잡기', cond: { mob: 'slime', n: 100 }, color: '#8fd18a' },
  { id: 'elem_100', name: '원소 탐구자', desc: '원소 슬라임 100마리 잡기', cond: { mob: 'slime_elem', n: 100 }, color: '#7fc4ff' },
  { id: 'honey_100', name: '꿀 수집가', desc: '꿀 슬라임 100마리 잡기', cond: { mob: 'honey_slime', n: 100 }, color: '#f0b840' },
  { id: 'guard_100', name: '기계 파괴자', desc: '경비기계A 100마리 잡기', cond: { mob: 'guard_a', n: 100 }, color: '#c0c8d0' },
  { id: 'golem', name: '골렘 사냥꾼', desc: '마법 골렘 쓰러뜨리기', cond: { mob: 'golem', n: 1 }, color: '#b388ff' },
  { id: 'guardian', name: '수호기계 파괴자', desc: '고대 수호기계 쓰러뜨리기', cond: { mob: 'guard_boss', n: 1 }, color: '#b388ff' },
  { id: 'lv10', name: '견습생', desc: '레벨 10 달성', cond: { level: 10 } },
  { id: 'lv20', name: '숙련자', desc: '레벨 20 달성', cond: { level: 20 }, color: '#ffd84a' },
  { id: 'legacy', name: '유산의 계승자', desc: '마법공학의 유산 끝내기', cond: { quest: 'mg13' }, color: '#b388ff' },
  { id: 'honey_cake', name: '꿀케이크 후원자', desc: '꿀케이크를 위해서라면... 끝내기', cond: { quest: 'bd1' }, color: '#f0b840' },
  { id: 'rich', name: '부자', desc: '골드 10000 모으기', cond: { gold: 10000 }, color: '#ffd84a' },
  { id: 'codex_5', name: '몬스터 박사', desc: '몬스터 도감 5종 채우기', cond: { codex: 5 } },
];

export const achievementDef = (id: string | null | undefined) => ACHIEVEMENTS.find(a => a.id === id) ?? null;
