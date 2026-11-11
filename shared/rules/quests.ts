// 퀘스트 진행·보상, 이야기 진행(플래그). 저장 데이터만 다룬다.
import { questDef, type QuestDef } from '../data/quests';
import { MAPS, type MapId } from '../data/maps';
import { itemDef } from '../data/items';
import type { SaveData } from '../sim/save';
import { BAG_FULL, addItem, countItem, removeItem } from './inventory';
import { gainExp, type ActionResult } from './progress';

/** 퀘스트 상태: 안 받음 / 하는 중 / 보고 가능 / 끝남(반복 안 되는 것) */
export type QuestState = 'none' | 'active' | 'ready' | 'done';

const fail = (msg: string): ActionResult => ({ ok: false, msg });

/** 진행도 (HUD 표시용). talk 는 그 NPC 에게 가면 끝 → 항상 0/1 */
export function questProgress(s: SaveData, q: QuestDef): { cur: number; need: number } {
  const st = s.quests[q.id];
  switch (q.goal.kind) {
    case 'kill': return { cur: Math.min(st?.count ?? 0, q.goal.n), need: q.goal.n };
    case 'collect': return { cur: Math.min(countItem(s, q.goal.item), q.goal.n), need: q.goal.n };
    case 'visit': return { cur: Math.min(st?.count ?? 0, 1), need: 1 };
    case 'talk': return { cur: 0, need: 1 };
  }
}

export function questState(s: SaveData, id: string): QuestState {
  const q = questDef(id), st = s.quests[id];
  if (!q) return 'none';
  if (st?.active) {
    if (q.goal.kind === 'talk') return 'ready';
    const p = questProgress(s, q);
    return p.cur >= p.need ? 'ready' : 'active';
  }
  return st?.done && !q.repeat ? 'done' : 'none';
}

export function acceptQuest(s: SaveData, id: string): ActionResult {
  const q = questDef(id);
  if (!q) return fail('없는 퀘스트야');
  if (questState(s, id) !== 'none') return fail('이미 받은 퀘스트야');
  s.quests[id] = { active: true, count: 0, done: s.quests[id]?.done };
  // 가기 퀘스트: 이미 그 맵에 있으면 바로 완료
  if (q.goal.kind === 'visit' && s.map === q.goal.map) s.quests[id].count = 1;
  return { ok: true, msg: `퀘스트 시작: ${q.name}` };
}

export function reportQuest(s: SaveData, id: string): ActionResult {
  const q = questDef(id);
  if (!q) return fail('없는 퀘스트야');
  const state = questState(s, id);
  if (state === 'none' || state === 'done') return fail('받은 퀘스트가 아니야');
  if (state !== 'ready') return fail('아직 덜 했어');
  const r = q.reward;
  // 보상 물건이 들어갈 자리부터 확인 (모아 온 물건을 먼저 빼고 계산)
  const room = structuredClone(s);
  if (q.goal.kind === 'collect') removeItem(room, q.goal.item, q.goal.n);
  for (const it of r.items ?? []) if (!addItem(room, it.id, it.n)) return fail(BAG_FULL);
  if (q.goal.kind === 'collect') removeItem(s, q.goal.item, q.goal.n);
  s.quests[id] = { active: false, count: 0, done: true };
  const parts: string[] = [];
  let res: ActionResult = { ok: true };
  const exp = typeof r.exp === 'function' ? r.exp(s.level) : r.exp;
  if (exp) { res = gainExp(s, exp); parts.push(`EXP +${exp}`); }
  if (r.gold) { s.gold += r.gold; parts.push(`+${r.gold} G`); }
  for (const it of r.items ?? []) { addItem(s, it.id, it.n); parts.push(`${itemDef(it.id)?.name ?? it.id} ×${it.n}`); }
  return { ...res, ok: true, banner: res.banner ?? `퀘스트 완료! ${parts.join(' · ')}` };
}

/** 몬스터 처치 → 처치 퀘스트 숫자. 방금 다 채운 퀘스트들을 돌려준다 */
export function questsOnKill(s: SaveData, elemental: boolean): QuestDef[] {
  const done: QuestDef[] = [];
  for (const [id, st] of Object.entries(s.quests)) {
    const q = questDef(id);
    if (!q || !st.active || q.goal.kind !== 'kill' || st.count >= q.goal.n) continue;
    const t = q.goal.target;
    if (t === 'any' || (t === 'elemental') === elemental) {
      st.count++;
      if (st.count >= q.goal.n) done.push(q);
    }
  }
  return done;
}

/** 지금 다 모은 모으기 퀘스트들 (주울 때 전후 비교용) */
export function collectReady(s: SaveData): QuestDef[] {
  const out: QuestDef[] = [];
  for (const [id, st] of Object.entries(s.quests)) {
    const q = questDef(id);
    if (q && st.active && q.goal.kind === 'collect' && countItem(s, q.goal.item) >= q.goal.n) out.push(q);
  }
  return out;
}

/** 맵에 들어감 → 가기 퀘스트 완료 */
export function questsOnVisit(s: SaveData, map: MapId): QuestDef[] {
  const done: QuestDef[] = [];
  for (const [id, st] of Object.entries(s.quests)) {
    const q = questDef(id);
    if (q && st.active && q.goal.kind === 'visit' && q.goal.map === map && !st.count) { st.count = 1; done.push(q); }
  }
  return done;
}

/** 길 안내 목적지: 맵 (+ 그 맵 안의 x, 있으면) */
export function questTarget(s: SaveData, q: QuestDef): { map: MapId; x?: number } | null {
  const state = questState(s, q.id);
  // 다 했으면 보고하러 주는 사람에게
  if (state === 'ready') return npcPlace(q.giver === 'prof' ? 'prof' : q.giver);
  if (q.where) return { map: q.where };
  switch (q.goal.kind) {
    case 'talk': return npcPlace(q.goal.npc);
    case 'visit': return { map: q.goal.map };
    case 'kill': {
      const want = q.goal.target;
      const id = (Object.keys(MAPS) as MapId[]).find(m => MAPS[m].spawns.some(sp => want === 'any' || (want === 'elemental') === !!sp[1]));
      return id ? { map: id } : null;
    }
    case 'collect': return null;
  }
}

/** NPC 가 있는 맵과 위치 */
export function npcPlace(npc: string): { map: MapId; x: number } | null {
  for (const id of Object.keys(MAPS) as MapId[]) {
    const n = MAPS[id].npcs.find(o => o.id === npc);
    if (n) return { map: id, x: n.x };
  }
  return null;
}
