// 이야기 진행: 대사 조건 검사, 대사 효과(퀘스트 주기·보고, 플래그, 물건·골드) 처리.
import { TALK_NPCS, type Cond, type DialogueStep, type Effect } from '../data/npcs';
import type { SaveData } from '../sim/save';
import { acceptQuest, questState, reportQuest } from './quests';
import { QUESTS, type QuestDef } from '../data/quests';
import { BAG_FULL, addItem, countItem, removeItem } from './inventory';
import { itemDef } from '../data/items';
import { MAPS, type MapId } from '../data/maps';
import { timeInfo } from '../sim/clock';

const PHASE_IDS = ['morning', 'day', 'night'] as const;

/** 지금 이 맵에 보이는 NPC (조건이 맞는 것만) */
export const mapNpcs = (s: SaveData, map: MapId) => MAPS[map].npcs.filter(n => !n.when || checkCond(s, n.when));
/** 지금 이 맵에서 탈 수 있는 포탈 (조건이 맞는 것만) */
/** 이 맵에서 보이는 포탈. cleared = 던전 방을 다 잡았는지 (false 면 afterClear 포탈은 숨김) */
export const mapPortals = (s: SaveData, map: MapId, cleared = true) => MAPS[map].portals.filter(p => (!p.when || checkCond(s, p.when)) && (cleared || !p.afterClear));
import type { ActionResult } from './progress';

/** 조건 검사. 시간대 조건은 nowMs 가 있어야 맞을 수 있음 */
export function checkCond(s: SaveData, c: Cond, nowMs?: number): boolean {
  if ('all' in c) return c.all.every(x => checkCond(s, x, nowMs));
  if ('any' in c) return c.any.some(x => checkCond(s, x, nowMs));
  if ('not' in c) return !checkCond(s, c.not, nowMs);
  if ('time' in c) return nowMs !== undefined && PHASE_IDS[timeInfo(nowMs).phase] === c.time;
  if ('quest' in c) return questState(s, c.quest) === c.state;
  if ('level' in c) return (c.level.gte === undefined || s.level >= c.level.gte) && (c.level.lt === undefined || s.level < c.level.lt);
  if ('has' in c) return countItem(s, c.has) >= (c.n ?? 1);
  if ('cls' in c) return s.cls === c.cls;
  const v = s.flags[c.flag] ?? 0;
  return (c.eq === undefined || v === c.eq) && (c.gte === undefined || v >= c.gte) && (c.lt === undefined || v < c.lt);
}

/** 지금 상황에 맞는 대사. talk = talks 번호 (-1 = 기본 대사) */
export function pickTalk(s: SaveData, npc: string, nowMs?: number): { talk: number; steps: DialogueStep[] } | null {
  const def = TALK_NPCS[npc];
  if (!def) return null;
  const i = def.talks?.findIndex(t => checkCond(s, t.when, nowMs)) ?? -1;
  return i >= 0 ? { talk: i, steps: def.talks![i].steps } : { talk: -1, steps: def.dialogue };
}

/** 이 NPC 가 지금 말을 걸면 퀘스트를 주는지 (길 안내용) */
export function offersQuest(s: SaveData, npc: string, nowMs?: number): boolean {
  const pick = pickTalk(s, npc, nowMs);
  return !!pick && pick.talk >= 0 && pick.steps.some(st => 'do' in st && !!st.do && 'quest' in st.do && st.do.quest === 'give');
}

/** 대사(선택지 안까지)에 들어 있는 효과들 */
function stepEffects(steps: DialogueStep[]): Effect[] {
  return steps.flatMap(st => ('do' in st ? [st.do] : 'choices' in st ? st.choices.flatMap(c => stepEffects(c.reply)) : []));
}

/**
 * 수락 대기 퀘스트: 지금 받을 수 있는데 안 받은 것.
 * 교수님 메뉴 퀘스트 + 지금 말을 걸면 퀘스트를 주는 대화 NPC 의 퀘스트
 * (보고하면서 바로 다음 퀘스트를 주는 대사는 빼고: 그건 보고하는 순간 받음)
 * 메인 퀘스트가 위, 같으면 퀘스트 표 순서
 */
export function offeredQuests(s: SaveData, nowMs?: number): QuestDef[] {
  const ids = new Set<string>();
  for (const q of QUESTS) if (q.giver === 'prof' && questState(s, q.id) === 'none') ids.add(q.id);
  for (const npc of Object.keys(TALK_NPCS)) {
    const pick = pickTalk(s, npc, nowMs);
    if (!pick || pick.talk < 0) continue;
    const fx = stepEffects(pick.steps);
    if (fx.some(e => 'quest' in e && e.quest === 'report')) continue;
    for (const e of fx) if ('quest' in e && e.quest === 'give' && questState(s, e.id) === 'none') ids.add(e.id);
  }
  return QUESTS.filter(q => ids.has(q.id)).sort((a, b) => Number(!!b.main) - Number(!!a.main));
}

/**
 * 대사 안의 효과 위치: [단계 번호, 선택지 번호, 단계 번호, …].
 * 화면이 보낸 위치로 데이터에서 효과를 직접 찾는다 → 화면이 마음대로 효과를 만들 수 없다.
 */
export function findEffect(npc: string, talk: number, path: number[]): Effect | null {
  const def = TALK_NPCS[npc];
  if (!def) return null;
  let steps: DialogueStep[] | undefined = talk < 0 ? def.dialogue : def.talks?.[talk]?.steps;
  for (let i = 0; steps && i < path.length; i += 2) {
    const step: DialogueStep | undefined = steps[path[i]];
    if (!step) return null;
    if (i === path.length - 1) return 'do' in step ? step.do : null;
    if (!('choices' in step)) return null;
    steps = step.choices[path[i + 1]]?.reply;
  }
  return null;
}

export function applyEffect(s: SaveData, e: Effect): ActionResult {
  if ('quest' in e) return e.quest === 'give' ? acceptQuest(s, e.id) : reportQuest(s, e.id);
  if ('item' in e) {
    const name = itemDef(e.item)?.name ?? e.item;
    if (e.n >= 0) return addItem(s, e.item, e.n) ? { ok: true, msg: `+${name} ×${e.n}` } : { ok: false, msg: BAG_FULL };
    return removeItem(s, e.item, -e.n) ? { ok: true } : { ok: false, msg: `${name}이(가) 모자라` };
  }
  if ('gold' in e) {
    if (s.gold + e.gold < 0) return { ok: false, msg: '골드가 부족해' };
    s.gold += e.gold;
    return { ok: true, msg: e.gold > 0 ? `+${e.gold} G` : undefined };
  }
  s.flags[e.flag] = e.set;
  return { ok: true };
}
