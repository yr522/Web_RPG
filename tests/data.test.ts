// 데이터끼리 서로 가리키는 이름이 다 있는지 (오타·지운 것 찾기)
import { describe, expect, it } from 'vitest';
import { MAPS, type MapId, type Portal } from '../shared/data/maps';
import { MONSTERS } from '../shared/data/monsters';
import { ITEMS, SHOP_ITEMS, START_ITEMS, itemDef } from '../shared/data/items';
import { QUESTS, questDef } from '../shared/data/quests';
import { TALK_NPCS, type Cond, type DialogueStep, type Effect } from '../shared/data/npcs';
import { CUTSCENES, type CutStep } from '../shared/data/cutscenes';
import { CLASSES, SKILLS } from '../shared/data/classes';

const SPECIAL_NPCS = ['prof', 'shop', 'smith'];
const npcExists = (id: string) => SPECIAL_NPCS.includes(id) || id in TALK_NPCS;
const mapIds = Object.keys(MAPS) as MapId[];

/** 조건 안에서 가리키는 퀘스트·물건 */
function condRefs(c: Cond, out: { quests: string[]; items: string[] }) {
  if ('quest' in c) out.quests.push(c.quest);
  if ('has' in c) out.items.push(c.has);
  if ('all' in c) c.all.forEach(x => condRefs(x, out));
  if ('any' in c) c.any.forEach(x => condRefs(x, out));
  if ('not' in c) condRefs(c.not, out);
  return out;
}

function effectOk(e: Effect): string | null {
  if ('quest' in e) return questDef(e.id) ? null : `퀘스트 ${e.id}`;
  if ('item' in e) return itemDef(e.item) ? null : `물건 ${e.item}`;
  return null;
}

function stepsErrors(steps: DialogueStep[], where: string, out: string[]) {
  for (const st of steps) {
    if ('do' in st) { const e = effectOk(st.do); if (e) out.push(`${where}: 없는 ${e}`); }
    if ('cutscene' in st && !CUTSCENES[st.cutscene]) out.push(`${where}: 없는 컷신 ${st.cutscene}`);
    if ('line' in st && st.who && st.who !== 'player' && !npcExists(st.who)) out.push(`${where}: 없는 NPC ${st.who}`);
    if ('choices' in st) for (const ch of st.choices) stepsErrors(ch.reply, where, out);
  }
}

describe('맵', () => {
  it('포탈이 가리키는 맵이 다 있음', () => {
    const bad: string[] = [];
    for (const id of mapIds) for (const p of MAPS[id].portals as Portal[]) if (!MAPS[p.to]) bad.push(`${id} → ${p.to}`);
    expect(bad).toEqual([]);
  });
  it('몬스터 자리·웨이브의 몬스터가 다 있음', () => {
    const bad: string[] = [];
    for (const id of mapIds) {
      for (const sp of [...MAPS[id].spawns, ...(MAPS[id].waves ?? []).flat()]) if (!MONSTERS[sp.mob]) bad.push(`${id}: ${sp.mob}`);
    }
    expect(bad).toEqual([]);
  });
  it('NPC 가 다 있음', () => {
    const bad: string[] = [];
    for (const id of mapIds) for (const n of MAPS[id].npcs) if (!npcExists(n.id)) bad.push(`${id}: ${n.id}`);
    expect(bad).toEqual([]);
  });
  it('쓰러지면 깨어나는 곳·바뀌는 맵이 다 있음', () => {
    for (const id of mapIds) {
      const m = MAPS[id];
      if (m.respawn) expect(MAPS[m.respawn.map], id).toBeDefined();
      if (m.becomes) expect(MAPS[m.becomes.to], id).toBeDefined();
    }
  });
  it('포탈·NPC·몬스터는 맵 안에 있음', () => {
    const bad: string[] = [];
    for (const id of mapIds) {
      const m = MAPS[id];
      for (const p of m.portals) if (p.x < 0 || p.x > m.width) bad.push(`${id} 포탈 ${p.label} x=${p.x}`);
      for (const n of m.npcs) if (n.x < 0 || n.x > m.width) bad.push(`${id} NPC ${n.id} x=${n.x}`);
      for (const sp of m.spawns) if (sp.x < 0 || sp.x > m.width) bad.push(`${id} ${sp.mob} x=${sp.x}`);
      for (const p of m.portals) {
        const to = MAPS[p.to];
        if (to && (p.toX < 0 || p.toX > to.width)) bad.push(`${id} 포탈 ${p.label} 도착 x=${p.toX} (폭 ${to.width})`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('몬스터', () => {
  it('드롭 물건·퀘스트가 다 있고 확률은 0~1', () => {
    const bad: string[] = [];
    for (const [id, m] of Object.entries(MONSTERS)) {
      for (const d of m.drops ?? []) {
        if (!itemDef(d.item)) bad.push(`${id}: 물건 ${d.item}`);
        if (d.quest && !questDef(d.quest)) bad.push(`${id}: 퀘스트 ${d.quest}`);
        if (d.chance < 0 || d.chance > 1) bad.push(`${id}: 확률 ${d.chance}`);
      }
      if (m.gold[0] > m.gold[1]) bad.push(`${id}: 골드 범위`);
    }
    expect(bad).toEqual([]);
  });
});

describe('아이템', () => {
  it('매점·시작 물건이 다 있고, 매점 물건은 가격이 있음', () => {
    for (const id of SHOP_ITEMS) { expect(ITEMS[id]).toBeDefined(); expect(ITEMS[id].price).toBeGreaterThan(0); }
    for (const it of START_ITEMS) expect(ITEMS[it.id]).toBeDefined();
  });
  it('장비는 등급이 맞음, 장비가 아닌 건 부위·능력치가 없음', () => {
    for (const [id, d] of Object.entries(ITEMS)) {
      if (d.kind === 'equip') expect(d.part, id).toBeDefined();
      else { expect(d.part, id).toBeUndefined(); expect(d.bonus, id).toBeUndefined(); }
    }
  });
});

describe('퀘스트', () => {
  it('id 가 겹치지 않음', () => {
    const ids = QUESTS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('다음 퀘스트·준 사람·목표가 가리키는 것이 다 있음', () => {
    const bad: string[] = [];
    for (const q of QUESTS) {
      if (q.next && !questDef(q.next)) bad.push(`${q.id}: next ${q.next}`);
      if (q.solo?.next && !questDef(q.solo.next)) bad.push(`${q.id}: solo.next ${q.solo.next}`);
      if (q.giver && !npcExists(q.giver)) bad.push(`${q.id}: giver ${q.giver}`);
      if (q.where && !MAPS[q.where]) bad.push(`${q.id}: where ${q.where}`);
      if (q.readyScene && (!MAPS[q.readyScene.map] || !CUTSCENES[q.readyScene.cutscene])) bad.push(`${q.id}: readyScene`);
      if (q.readyScene?.soloCutscene && !CUTSCENES[q.readyScene.soloCutscene]) bad.push(`${q.id}: soloCutscene`);
      if (q.companion && !npcExists(q.companion.npc)) bad.push(`${q.id}: companion`);
      for (const it of [...(q.start?.items ?? []), ...(q.reward.items ?? [])]) if (!itemDef(it.id)) bad.push(`${q.id}: 물건 ${it.id}`);
      for (const g of q.goals) {
        if (g.kind === 'kill' && g.mob && !MONSTERS[g.mob]) bad.push(`${q.id}: 몬스터 ${g.mob}`);
        if (g.kind === 'collect' && !itemDef(g.item)) bad.push(`${q.id}: 물건 ${g.item}`);
        if (g.kind === 'talk' && !npcExists(g.npc)) bad.push(`${q.id}: NPC ${g.npc}`);
        if (g.kind === 'visit' && !MAPS[g.map]) bad.push(`${q.id}: 맵 ${g.map}`);
        if (g.kind === 'learn' && g.skill && !SKILLS[g.skill]) bad.push(`${q.id}: 스킬 ${g.skill}`);
        if (g.kind === 'equip' && g.item && !itemDef(g.item)) bad.push(`${q.id}: 장비 ${g.item}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('다음 퀘스트 사슬이 돌지 않음', () => {
    for (const q of QUESTS) {
      const seen = new Set<string>();
      let cur: string | undefined = q.id;
      while (cur) {
        expect(seen.has(cur), `${q.id} 사슬`).toBe(false);
        seen.add(cur);
        const d = questDef(cur);
        cur = d?.next ?? d?.solo?.next;
      }
    }
  });
});

describe('대화 NPC · 컷신', () => {
  it('대사의 효과·컷신·말하는 사람·조건이 가리키는 것이 다 있음', () => {
    const bad: string[] = [];
    for (const [id, n] of Object.entries(TALK_NPCS)) {
      stepsErrors(n.dialogue, id, bad);
      for (const [i, t] of (n.talks ?? []).entries()) {
        stepsErrors(t.steps, `${id}#${i}`, bad);
        const r = condRefs(t.when, { quests: [], items: [] });
        for (const qid of r.quests) if (!questDef(qid)) bad.push(`${id}#${i}: 조건 퀘스트 ${qid}`);
        for (const it of r.items) if (!itemDef(it)) bad.push(`${id}#${i}: 조건 물건 ${it}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('컷신 안의 효과·대화·NPC 가 다 있음', () => {
    const bad: string[] = [];
    const who = (w: string, where: string) => { if (w.startsWith('npc:') && !npcExists(w.slice(4))) bad.push(`${where}: ${w}`); };
    for (const [id, steps] of Object.entries(CUTSCENES)) {
      for (const st of steps as CutStep[]) {
        if ('do' in st && typeof st.do === 'object') { const e = effectOk(st.do); if (e) bad.push(`${id}: 없는 ${e}`); }
        if ('talk' in st && !npcExists(st.talk)) bad.push(`${id}: 대화 ${st.talk}`);
        for (const k of ['walk', 'pose', 'face', 'say'] as const) if (k in st) who((st as unknown as Record<string, { who: string }>)[k].who, id);
      }
    }
    expect(bad).toEqual([]);
  });
  it('맵 조건(when)의 퀘스트가 다 있음', () => {
    const bad: string[] = [];
    for (const id of mapIds) {
      const m = MAPS[id];
      const conds = [...m.portals.map(p => p.when), ...m.npcs.map(n => n.when), m.becomes?.when].filter((c): c is Cond => !!c);
      for (const c of conds) for (const q of condRefs(c, { quests: [], items: [] }).quests) if (!questDef(q)) bad.push(`${id}: ${q}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('직업', () => {
  it('직업 스킬이 다 있음', () => {
    for (const [id, c] of Object.entries(CLASSES)) for (const sk of [...c.skills, ...c.hints, ...c.passives, ...(c.move ? [c.move] : [])]) expect(SKILLS[sk], `${id}: ${sk}`).toBeDefined();
  });
});
