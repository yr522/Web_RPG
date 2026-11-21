// 미니 챕터 "마법공학의 유산"을 직업마다 처음부터 끝까지 자동으로 진행해 본다 (막히는 곳이 없는지).
// 사람이 하듯이: 보이는 NPC 에게 말 걸기(대사 효과 적용, 선택지는 첫 번째) → 퀘스트 목표 채우기 → 자동 보고.
import { describe, expect, it } from 'vitest';
import { TALK_NPCS, type DialogueStep } from '../shared/data/npcs';
import { CUTSCENES } from '../shared/data/cutscenes';
import { MAPS, type MapId } from '../shared/data/maps';
import { expNeed, type ClassId } from '../shared/data/classes';
import { questDef } from '../shared/data/quests';
import { applyEffect, mapNpcs, mapPickups, npcMark, pickTalk } from '../shared/rules/story';
import { World } from '../shared/sim/World';
import { GROUND_Y } from '../shared/data/maps';
import { ADVANCE, ADVANCE_LINES } from '../shared/data/advance';
import { advanceLine } from '../shared/rules/advance';
import { acceptQuest, profQuests, autoReport, companionNpc, nightLocked, questState, questsOnKill, questsOnVisit } from '../shared/rules/quests';
import { addItem, countItem, removeItem } from '../shared/rules/inventory';
import { gainExp } from '../shared/rules/progress';
import { PHASE_MS } from '../shared/sim/clock';
import { newSave, type SaveData } from '../shared/sim/save';

const STORY = ['mg2', 'mg4', 'mgm2', 'mgm4', 'mgm5', 'mg5', 'mg6', 'mg7', 'mg9', 'mg10', 'mg11', 'mg12', 'mg13'];
const PHASE_NOW = [PHASE_MS * 0.5, PHASE_MS * 1.5, PHASE_MS * 2.5];

/** 대사를 위에서부터: 효과는 적용, 실패하면 거기서 멈춤 (게임과 같음), 컷신은 그 안의 효과까지 */
function play(s: SaveData, steps: DialogueStep[]): boolean {
  for (const st of steps) {
    if ('do' in st && !applyEffect(s, st.do).ok) return false;
    if ('cutscene' in st) for (const c of CUTSCENES[st.cutscene] ?? []) if ('do' in c) applyEffect(s, c.do);
    if ('choices' in st && !play(s, st.choices[0].reply)) return false;
  }
  return true;
}

/** 보고할 수 있게 된 퀘스트의 장면 (골렘 → 결정체 컷신) */
function readyScenes(s: SaveData, seen: Set<string>) {
  for (const id of STORY) {
    const q = questDef(id)!;
    if (!q.readyScene || seen.has(id) || questState(s, id) !== 'ready') continue;
    seen.add(id);
    const cut = q.readyScene.cutsceneFor?.[s.cls] ?? q.readyScene.cutscene;
    for (const c of CUTSCENES[cut]) if ('do' in c) applyEffect(s, c.do);
    s.map = q.readyScene.map;
  }
}

/** 하는 중인 이야기 퀘스트의 목표를 채움 */
function doGoals(s: SaveData) {
  for (const id of STORY) {
    if (questState(s, id) !== 'active') continue;
    for (const g of questDef(id)!.goals) {
      if (g.kind === 'visit') { s.map = g.map; questsOnVisit(s, g.map); }
      if (g.kind === 'kill') for (let i = 0; i < g.n; i++) questsOnKill(s, g.mob ?? 'slime', g.tag);
      if (g.kind === 'collect') addItem(s, g.item, g.n);
      if (g.kind === 'level') while (s.level < g.n) gainExp(s, expNeed(s.level));
    }
  }
}

function playthrough(cls: ClassId) {
  const s = newSave('t', cls, 'M');
  const log: string[] = [];
  const scenes = new Set<string>();
  for (let turn = 0; turn < 200 && questState(s, 'mg13') !== 'done'; turn++) {
    const before = JSON.stringify(s);
    // 이야기 진행에 레벨이 필요한 대사가 있어서 (밤 침대 Lv 3 등) 조금씩 올려 둠
    if (s.level < 5) gainExp(s, expNeed(s.level));
    const phases = nightLocked(s) ? [PHASE_NOW[2]] : PHASE_NOW;
    for (const now of phases) {
      // 'self' = 내 머리 위 !·? (어느 맵에서나)
      for (const map of ['self', ...Object.keys(MAPS)] as (MapId | 'self')[]) {
        for (const n of map === 'self' ? [{ id: 'self' }] : mapNpcs(s, map)) {
          if (!TALK_NPCS[n.id] && n.id !== 'prof') continue;
          const pick = pickTalk(s, n.id, now);
          if (!pick || pick.talk < 0) continue;
          const b = JSON.stringify(s);
          play(s, pick.steps);
          if (JSON.stringify(s) !== b) log.push(`${map}:${n.id}`);
        }
      }
    }
    doGoals(s);
    readyScenes(s, scenes);
    autoReport(s);
    if (JSON.stringify(s) === before) break;
  }
  return { s, log };
}

describe('마법사 처음 부분', () => {
  it('Lv3 이 되면 내 머리 위 [?], 갈림길에 가면 [✔], 밤에 자면 동급생 검사를 깨우러, 깨우면 동행', async () => {
    const { selfMark } = await import('../shared/rules/story');
    const s = newSave('t', 'mage', 'M');
    expect(selfMark(s)).toBeNull();
    while (s.level < 3) gainExp(s, expNeed(s.level));
    expect(selfMark(s)).toBe('!');
    play(s, pickTalk(s, 'self')!.steps);
    expect(questState(s, 'mgm2')).toBe('active');
    expect(selfMark(s)).toBeNull();
    questsOnVisit(s, 'crossroad');
    expect(selfMark(s)).toBe('?');
    play(s, pickTalk(s, 'self')!.steps);
    expect(questState(s, 'mgm4')).toBe('ready');
    expect(pickTalk(s, 'bed', PHASE_NOW[1])!.talk).toBe(-1);
    play(s, pickTalk(s, 'bed', PHASE_NOW[2])!.steps);
    expect(questState(s, 'mgm5')).toBe('ready');
    expect(nightLocked(s)).toBe(true);
    expect(mapNpcs(s, 'school_hall').some(n => n.id === 'warrior_friend')).toBe(true);
    play(s, pickTalk(s, 'warrior_friend')!.steps);
    expect(questState(s, 'mg5')).toBe('active');
    expect(companionNpc(s)).toBe('warrior_friend');
  });
  it('검사·궁수에게는 [?] 가 안 뜨고 동급생 검사도 안 보임', async () => {
    const { selfMark } = await import('../shared/rules/story');
    const s = newSave('t', 'warrior', 'M');
    while (s.level < 3) gainExp(s, expNeed(s.level));
    expect(selfMark(s)).toBeNull();
    expect(mapNpcs(s, 'school_hall').some(n => n.id === 'warrior_friend')).toBe(false);
  });
});

describe('미니 챕터 끝까지', () => {
  for (const cls of ['warrior', 'mage', 'archer'] as ClassId[]) {
    it(`${cls}`, () => {
      const { s, log } = playthrough(cls);
      // 마법사는 처음 부분이 다름 (mgm: 혼자 + 동급생 검사), 검사·궁수는 mg2·mg4 (동급생 마법사)
      const skip = cls === 'mage' ? ['mg2', 'mg4'] : ['mgm2', 'mgm4', 'mgm5'];
      const stuck = STORY.find(id => questState(s, id) !== 'done' && !skip.includes(id));
      expect(stuck, `막힌 곳: ${stuck} (${stuck && questState(s, stuck)}) · 지나온 대화 ${log.join(' → ')}`).toBeUndefined();
      for (const id of skip) expect(questState(s, id), id).toBe('none');
      expect(s.flags.mg_stolen).toBe(1);
      // 마법사는 동급생 마법사를 만나지 않고 동급생 검사와 감
      const friend = cls === 'mage' ? 'warrior_friend' : 'mage_friend', other = cls === 'mage' ? 'mage_friend' : 'warrior_friend';
      expect(log.some(l => l.endsWith(`:${friend}`))).toBe(true);
      expect(log.some(l => l.endsWith(`:${other}`))).toBe(false);
      if (cls === 'mage') expect(log.filter(l => l === 'self:self').length).toBe(2);
    });
  }
});

describe('영주님의 생일잔치: 초대장·악보·폭죽', () => {
  const talk = (s: SaveData, npc: string) => play(s, pickTalk(s, npc)!.steps);
  function ready() {
    const s = newSave('t', 'warrior', 'M');
    s.quests.mg13 = { active: false, counts: [], done: true };
    s.level = 5;
    return s;
  }
  it('세바스찬에게 받으면 초대장 5장, 다섯 명에게 하나씩 건네면 보고', () => {
    const s = ready();
    talk(s, 'sebastian');
    expect(questState(s, 'bd3')).toBe('active');
    expect(countItem(s, 'invitation')).toBe(5);
    for (const npc of ['smith', 'masha', 'choir_kid', 'shop', 'firework_master']) {
      expect(npcMark(s, npc)).toBe('?');
      talk(s, npc);
    }
    expect(countItem(s, 'invitation')).toBe(0);
    expect(questState(s, 'bd3')).toBe('ready');
    talk(s, 'sebastian');
    expect(questState(s, 'bd3')).toBe('done');
  });
  it('초대장을 잃어버리면 세바스찬이 한 장 더 줌', () => {
    const s = ready();
    talk(s, 'sebastian');
    removeItem(s, 'invitation', 5);
    talk(s, 'sebastian');
    expect(countItem(s, 'invitation')).toBe(1);
  });
  it('악보: 가도에서 5장 주우면 완료 (버려도 주운 수로 셈), 주운 것은 다시 안 보임', () => {
    const s = ready();
    s.flags.bd3_choir_kid = 1;
    talk(s, 'choir_kid');
    expect(questState(s, 'bd4')).toBe('active');
    const w = new World('road', 1);
    const p = w.addPlayer('p', s, 300);
    for (const o of mapPickups(s, 'road')) {
      p.x = o.x - p.w / 2; p.y = (o.y ?? GROUND_Y) - p.h; p.onGround = true;
      (w as unknown as { takePickup(p: unknown, o: unknown): void }).takePickup(p, o);
    }
    expect(mapPickups(s, 'road')).toHaveLength(0);
    removeItem(s, 'music_sheet', 2);
    expect(questState(s, 'bd4')).toBe('ready');
    talk(s, 'choir_kid');
    expect(questState(s, 'bd4')).toBe('done');
    expect(countItem(s, 'music_sheet')).toBe(0);
  });
  it('폭죽 장인: 원소 구슬 10개 → 폭죽, 또 받을 수 있음', () => {
    const s = ready();
    s.flags.bd3_firework_master = 1;
    talk(s, 'firework_master');
    addItem(s, 'elem_orb', 10);
    talk(s, 'firework_master');
    expect(countItem(s, 'firework')).toBe(5);
    expect(questState(s, 'bd_fw')).toBe('none');
    expect(npcMark(s, 'firework_master')).toBe('!');
  });
  it('폭죽: 서 있는 자리에 설치, 3초 뒤 발사, 터지고 나면 사라짐', () => {
    const s = ready();
    addItem(s, 'firework', 1);
    const w = new World('school', 1);
    const p = w.addPlayer('p', s, 600);
    for (let i = 0; i < 60; i++) w.step(new Map());
    expect(w.useFirework(p)).toBe(true);
    expect(countItem(s, 'firework')).toBe(0);
    expect(w.fireworks[0].x).toBeCloseTo(p.x + p.w / 2);
    for (let i = 0; i < 400; i++) w.step(new Map());
    expect(w.fireworks).toHaveLength(0);
  });
});

describe('전직 (뼈대)', () => {
  for (const cls of ['warrior', 'mage', 'archer'] as ClassId[]) {
    it(`${cls}: 레벨이 되면 교수님 메뉴에 나오고, 골렘을 잡고 보고하면서 고른 갈래로 전직`, () => {
      const s = newSave('t', cls, 'M');
      expect(profQuests(s).some(q => q.id === ADVANCE.quest)).toBe(false);
      s.level = ADVANCE.level;
      expect(profQuests(s).some(q => q.id === ADVANCE.quest)).toBe(true);
      expect(acceptQuest(s, ADVANCE.quest)).toBeTruthy();
      questsOnKill(s, 'golem');
      expect(questState(s, ADVANCE.quest)).toBe('ready');
      const pick = pickTalk(s, 'prof', PHASE_NOW[1])!;
      const ch = pick.steps.find(st => 'choices' in st) as Extract<DialogueStep, { choices: unknown }>;
      expect(ch.choices.map(c => c.label)).toEqual(ADVANCE_LINES[cls].map(l => l.name));
      expect(play(s, ch.choices[1].reply)).toBe(true);
      expect(questState(s, ADVANCE.quest)).toBe('done');
      expect(advanceLine(s)?.name).toBe(ADVANCE_LINES[cls][1].name);
    });
  }
});
