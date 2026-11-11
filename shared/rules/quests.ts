// 퀘스트 진행·보상. 저장 데이터만 다룬다.
// 퀘스트 하나에 목표가 여러 개일 수 있다 (전부 해야 보고).
import { questDef, type QuestDef } from '../data/quests';
import { MAPS, type MapId } from '../data/maps';
import { itemDef } from '../data/items';
import type { SaveData } from '../sim/save';
import { BAG_FULL, addItem, countItem, removeItem } from './inventory';
import { gainExp, type ActionResult } from './progress';

/** 퀘스트 상태: 안 받음 / 하는 중 / 보고 가능 / 끝남(반복 안 되는 것) */
export type QuestState = 'none' | 'active' | 'ready' | 'done';

const fail = (msg: string): ActionResult => ({ ok: false, msg });

/** 퀘스트 저장 상태. counts = 목표마다 센 숫자 (처치 수, 가 봤으면 1. 모으기는 가방 개수로 세서 안 씀) */
export interface QuestSave { active: boolean; counts: number[]; done?: boolean }

/** 목표 하나의 진행도. talk 는 그 NPC 에게 가서 보고하면 끝 → 항상 0/1 */
export function goalProgress(s: SaveData, q: QuestDef, i: number): { cur: number; need: number } {
  const g = q.goals[i], c = s.quests[q.id]?.counts[i] ?? 0;
  switch (g.kind) {
    case 'kill': return { cur: Math.min(c, g.n), need: g.n };
    case 'collect': return { cur: Math.min(countItem(s, g.item), g.n), need: g.n };
    case 'visit': return { cur: Math.min(c, 1), need: 1 };
    case 'talk': return { cur: 0, need: 1 };
  }
}

/** 숫자를 보여 줄 목표들의 진행도 (HUD·퀘스트 목록 표시용. 말 걸기·가 보기는 숫자 없이) */
export function questProgressText(s: SaveData, q: QuestDef) {
  const out: string[] = [];
  q.goals.forEach((g, i) => {
    if (g.kind === 'talk' || g.kind === 'visit') return;
    const p = goalProgress(s, q, i);
    out.push(`${p.cur}/${p.need}`);
  });
  return out.join(' · ');
}

/** 말 걸기를 뺀 목표를 다 했는지 */
function goalsDone(s: SaveData, q: QuestDef) {
  return q.goals.every((g, i) => {
    if (g.kind === 'talk') return true;
    const p = goalProgress(s, q, i);
    return p.cur >= p.need;
  });
}

/** 보고할 NPC: 말 걸기 목표가 있으면 그 NPC, 없으면 준 사람 */
export function reportTo(q: QuestDef): string {
  const t = q.goals.find(g => g.kind === 'talk');
  return t && t.kind === 'talk' ? t.npc : q.giver;
}

export function questState(s: SaveData, id: string): QuestState {
  const q = questDef(id), st = s.quests[id];
  if (!q) return 'none';
  if (st?.active) return goalsDone(s, q) ? 'ready' : 'active';
  return st?.done && !q.repeat ? 'done' : 'none';
}

export function acceptQuest(s: SaveData, id: string): ActionResult {
  const q = questDef(id);
  if (!q) return fail('없는 퀘스트야');
  if (questState(s, id) !== 'none') return fail('이미 받은 퀘스트야');
  // 가기 목표: 이미 그 맵에 있으면 바로 완료
  const counts = q.goals.map(g => (g.kind === 'visit' && s.map === g.map ? 1 : 0));
  s.quests[id] = { active: true, counts, done: s.quests[id]?.done };
  return { ok: true, msg: `퀘스트 시작: ${q.name}` };
}

/** 모아 오기 목표들이 가져갈 물건 */
const collectCosts = (q: QuestDef) => q.goals.flatMap(g => (g.kind === 'collect' ? [{ id: g.item, n: g.n }] : []));

export function reportQuest(s: SaveData, id: string): ActionResult {
  const q = questDef(id);
  if (!q) return fail('없는 퀘스트야');
  const state = questState(s, id);
  if (state === 'none' || state === 'done') return fail('받은 퀘스트가 아니야');
  if (state !== 'ready') return fail('아직 덜 했어');
  const r = q.reward;
  // 보상 물건이 들어갈 자리부터 확인 (모아 온 물건을 먼저 빼고 계산)
  const room = structuredClone(s);
  for (const c of collectCosts(q)) removeItem(room, c.id, c.n);
  for (const it of r.items ?? []) if (!addItem(room, it.id, it.n)) return fail(BAG_FULL);
  for (const c of collectCosts(q)) removeItem(s, c.id, c.n);
  s.quests[id] = { active: false, counts: [], done: true };
  const parts: string[] = [];
  let res: ActionResult = { ok: true };
  const exp = typeof r.exp === 'function' ? r.exp(s.level) : r.exp;
  if (exp) { res = gainExp(s, exp); parts.push(`EXP +${exp}`); }
  if (r.gold) { s.gold += r.gold; parts.push(`+${r.gold} G`); }
  for (const it of r.items ?? []) { addItem(s, it.id, it.n); parts.push(`${itemDef(it.id)?.name ?? it.id} ×${it.n}`); }
  return { ...res, ok: true, banner: res.banner ?? `퀘스트 완료! ${parts.join(' · ')}` };
}

/** 하는 중인 퀘스트들 */
function activeQuests(s: SaveData): QuestDef[] {
  const out: QuestDef[] = [];
  for (const [id, st] of Object.entries(s.quests)) {
    const q = questDef(id);
    if (q && st.active) out.push(q);
  }
  return out;
}

/** 지금 보고할 수 있는 퀘스트 id 들 (바뀌기 전후 비교용) */
export function readyQuestIds(s: SaveData): string[] {
  return activeQuests(s).filter(q => goalsDone(s, q)).map(q => q.id);
}

/** change 를 하고 나서 새로 보고할 수 있게 된 퀘스트들 */
export function newlyReady(s: SaveData, change: () => void): QuestDef[] {
  const before = readyQuestIds(s);
  change();
  return readyQuestIds(s).filter(id => !before.includes(id)).map(id => questDef(id)!);
}

/** 몬스터 처치 → 처치 목표 숫자. 방금 보고할 수 있게 된 퀘스트들을 돌려준다 */
export function questsOnKill(s: SaveData, elemental: boolean, tag?: string): QuestDef[] {
  return newlyReady(s, () => {
    for (const q of activeQuests(s)) {
      const st = s.quests[q.id];
      q.goals.forEach((g, i) => {
        if (g.kind !== 'kill' || (st.counts[i] ?? 0) >= g.n) return;
        // 이름표 목표는 그 이름표 몬스터만, 보통 목표는 이름표 몬스터도 같이 셈
        const t = g.target;
        const match = g.tag ? g.tag === tag : t === 'any' || (t === 'elemental') === elemental;
        if (match) st.counts[i] = (st.counts[i] ?? 0) + 1;
      });
    }
  });
}

/** 맵에 들어감 → 가기 목표 완료 */
export function questsOnVisit(s: SaveData, map: MapId): QuestDef[] {
  return newlyReady(s, () => {
    for (const q of activeQuests(s)) q.goals.forEach((g, i) => { if (g.kind === 'visit' && g.map === map) s.quests[q.id].counts[i] = 1; });
  });
}

/** 길 안내 목적지: 맵 (+ 그 맵 안의 x, 있으면) */
export function questTarget(s: SaveData, q: QuestDef): { map: MapId; x?: number } | null {
  const state = questState(s, q.id);
  // 다 했으면 보고하러
  if (state === 'ready') return npcPlace(reportTo(q));
  if (q.where) return { map: q.where };
  // 아직 안 끝난 첫 목표 쪽으로
  for (let i = 0; i < q.goals.length; i++) {
    const g = q.goals[i], p = goalProgress(s, q, i);
    if (g.kind === 'talk' || p.cur >= p.need) continue;
    switch (g.kind) {
      case 'visit': return { map: g.map };
      case 'kill': {
        if (g.tag) return null;
        const want = g.target;
        const id = (Object.keys(MAPS) as MapId[]).find(m => MAPS[m].spawns.some(sp => want === 'any' || (want === 'elemental') === !!sp[1]));
        return id ? { map: id } : null;
      }
      case 'collect': return null;
    }
  }
  return null;
}

/** NPC 가 있는 맵과 위치 */
export function npcPlace(npc: string): { map: MapId; x: number } | null {
  for (const id of Object.keys(MAPS) as MapId[]) {
    const n = MAPS[id].npcs.find(o => o.id === npc);
    if (n) return { map: id, x: n.x };
  }
  return null;
}
