// 업적 달성 검사 · 칭호 달기 · 도감 (저장 데이터만 다룸)
import { ACHIEVEMENTS, achievementDef, type AchievementDef } from '../data/achievements';
import { MONSTERS, type MonsterId } from '../data/monsters';
import { MAPS, type MapId } from '../data/maps';
import type { SaveData } from '../sim/save';
import { questState } from './quests';

/** 도감에 나오는 몬스터 (허수아비 빼고, 몬스터 표 순서) */
export const CODEX_MOBS = (Object.keys(MONSTERS) as MonsterId[]).filter(id => MONSTERS[id].ai !== 'dummy');

/** 도감: 한 마리라도 잡은 종류 수 */
export const codexCount = (s: SaveData) => CODEX_MOBS.filter(id => (s.mobKills[id] ?? 0) > 0).length;

/** 이 몬스터가 나오는 맵 (이름, 같은 이름은 한 번) */
export function mobMaps(mob: MonsterId): string[] {
  const names = new Set<string>();
  for (const id of Object.keys(MAPS) as MapId[]) {
    const m = MAPS[id];
    if ([...m.spawns, ...(m.waves ?? []).flat()].some(sp => sp.mob === mob)) names.add(m.name);
  }
  return [...names];
}

/** 업적 조건 진행도 */
export function achievementProgress(s: SaveData, a: AchievementDef): { cur: number; need: number } {
  const c = a.cond;
  if ('kills' in c) return { cur: s.kills, need: c.kills };
  if ('mob' in c) return { cur: s.mobKills[c.mob] ?? 0, need: c.n };
  if ('level' in c) return { cur: s.level, need: c.level };
  if ('quest' in c) return { cur: questState(s, c.quest) === 'done' ? 1 : 0, need: 1 };
  if ('gold' in c) return { cur: s.gold, need: c.gold };
  return { cur: codexCount(s), need: c.codex };
}

/** 새로 달성한 업적을 저장에 넣고 돌려줌 (매 순간 불러도 됨) */
export function checkAchievements(s: SaveData): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) continue;
    const p = achievementProgress(s, a);
    if (p.cur >= p.need) { s.achievements.push(a.id); out.push(a); }
  }
  return out;
}

/** 칭호 달기 (null = 떼기). 달성한 업적만 */
export function setTitle(s: SaveData, id: string | null): { ok: boolean; msg?: string } {
  if (id !== null && (!achievementDef(id) || !s.achievements.includes(id))) return { ok: false, msg: '아직 없는 칭호야' };
  s.title = id;
  return { ok: true };
}
