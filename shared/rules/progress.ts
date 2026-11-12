// 메뉴에서 하는 행동들 (상점, 퀘스트, 수업, 스킬 배우기, 능력치).
// 화면은 SaveData 를 직접 고치지 않고 이 행동을 요청한다 → 나중에 서버가 같은 함수로 검사·처리.
import { CLASSES, SKILLS, SLOT_KEYS, UNLOCK_LEVELS, MAX_SKILL_LEVEL, expNeed, type SlotKey, type StatId } from '../data/classes';
import type { Element } from '../data/elements';
import { ITEMS, SHOP_ITEMS, type EquipSlot, type ItemDef, type ItemId } from '../data/items';
import { BAG_FULL, addItem, canAdd, moveItem, removeItem, sortBag, toggleEquip, unequip } from './inventory';
import { QUESTS, questDef } from '../data/quests';
import { acceptQuest, questState, reportQuest, togglePin } from './quests';
import { applyEffect, findEffect, pickTalk } from './story';
import { CUTSCENES } from '../data/cutscenes';
import { timeInfo } from '../sim/clock';
import type { SaveData } from '../sim/save';

export type MenuAction =
  | { type: 'buy'; item: ItemId; n: number }
  | { type: 'questAccept'; id: string }
  | { type: 'questReport'; id: string }
  /** 퀘스트 핀 꽂기 / 빼기 */
  | { type: 'questPin'; id: string }
  | { type: 'learn'; skill: string; element: Element | null }
  | { type: 'attend'; skill: string }
  | { type: 'stat'; stat: StatId }
  | { type: 'useReset' }
  /** 스킬 포인트로 배운 스킬 레벨 +1 */
  | { type: 'skillUp'; skill: string }
  /** 스킬 키 등록: 스킬 창에서 끌어다 놓기 (다른 키에 있던 같은 스킬은 빠짐, 그 키에 있던 스킬은 밀려남) */
  | { type: 'bindSkill'; key: SlotKey; skill: string }
  /** 스킬 키 비우기 (스킬 창 키 칸 우클릭) */
  | { type: 'unbindKey'; key: SlotKey }
  /** 스킬 키끼리 옮기기 (둘 다 있으면 자리 바꿈) */
  | { type: 'swapKeys'; from: SlotKey; to: SlotKey }
  /** 가방 index 칸의 장비 끼기 / 벗기 */
  | { type: 'equip'; index: number }
  | { type: 'unequip'; slot: EquipSlot }
  /** 가방 칸 옮기기 (물건이 있으면 자리 바꿈) */
  | { type: 'moveItem'; from: number; to: number }
  | { type: 'sortBag' }
  /** 대화 중 효과 (퀘스트 주기·보고, 플래그). 위치는 story.ts 의 findEffect 참고 */
  | { type: 'storyDo'; npc: string; talk: number; path: number[] }
  /** 컷신 안의 { do } 단계 (데이터에서 직접 찾음) */
  | { type: 'cutDo'; cut: string; step: number }
  | { type: 'debug'; what: 'nextPhase' | 'levelUp' | 'gold' | 'resetStory' };

export interface ActionResult {
  ok: boolean;
  /** 화면에 띄울 말 */
  msg?: string;
  /** 큰 글씨 알림 */
  banner?: string;
  /** 능력치가 바뀌었으니 다시 계산해야 함 */
  statsChanged?: boolean;
  /** 레벨업해서 HP·MP 가득 */
  fullHeal?: boolean;
}

const fail = (msg: string): ActionResult => ({ ok: false, msg });

export const learned = (s: SaveData, id: string) => id in s.learned;
export const skillLevel = (s: SaveData, id: string) => s.skillLevels[id] ?? 1;

/**
 * 스킬 키에 지금 쓸 스킬. 배운 스킬이면 그 스킬,
 * 첫 직업 스킬 자리인데 아직 안 배웠으면 기본 공격, 그 밖에는 null
 */
export function keySkill(s: SaveData, key: SlotKey): string | null {
  const id = s.skillKeys[key];
  if (!id) return null;
  if (learned(s, id)) return id;
  return id === CLASSES[s.cls].skills[0] ? 'basic' : null;
}

/** 이 스킬(기본 공격 포함)이 등록된 키 */
export function skillKeyOf(s: SaveData, skill: string): SlotKey | null {
  const id = skill === 'basic' ? CLASSES[s.cls].skills[0] : skill;
  return SLOT_KEYS.find(k => s.skillKeys[k] === id) ?? null;
}

/** 다음에 배울 스킬 순번 (0~3), 다 배웠으면 -1 */
export function nextToLearn(s: SaveData) {
  return CLASSES[s.cls].skills.findIndex(id => !learned(s, id));
}

export function gainExp(s: SaveData, n: number): ActionResult {
  s.exp += n;
  let ups = 0;
  while (s.exp >= expNeed(s.level)) {
    s.exp -= expNeed(s.level);
    s.level++;
    s.statPts += 3;
    ups++;
  }
  if (!ups) return { ok: true, msg: `+${n} EXP` };
  const ni = nextToLearn(s);
  const unlock = ni >= 0 && UNLOCK_LEVELS[ni] === s.level ? ` · 새 스킬 해금: ${SKILLS[CLASSES[s.cls].skills[ni]].name}` : '';
  return { ok: true, msg: `+${n} EXP`, banner: `레벨 업! Lv ${s.level}${unlock}`, statsChanged: true, fullHeal: true };
}

/** 교수님 머리 위 "!" : 배울 스킬, 받을·보고할 퀘스트, 들을 수업이 있음 */
export function professorHasNews(s: SaveData, nowMs: number) {
  const ni = nextToLearn(s);
  if (ni >= 0 && s.level >= UNLOCK_LEVELS[ni]) return true;
  for (const q of QUESTS) {
    if (q.giver !== 'prof') continue;
    const st = questState(s, q.id);
    if (st === 'none' || st === 'ready') return true;
  }
  // 이야기 대사 (보고 받을 퀘스트 등)
  if ((pickTalk(s, 'prof', nowMs)?.talk ?? -1) >= 0) return true;
  return canAttend(s, nowMs) === null;
}

/** 지금 수업을 들을 수 있으면 null, 아니면 이유 */
export function canAttend(s: SaveData, nowMs: number): string | null {
  const ti = timeInfo(nowMs);
  const list = CLASSES[s.cls].skills.filter(id => learned(s, id));
  if (ti.phase !== 0) return 'notMorning';
  if (s.attendedCycle === ti.cycle) return 'done';
  if (!list.length) return 'noSkill';
  if (list.every(id => skillLevel(s, id) >= MAX_SKILL_LEVEL)) return 'allMaster';
  return null;
}

export function applyAction(s: SaveData, a: MenuAction, nowMs: number): ActionResult {
  switch (a.type) {
    case 'buy': {
      const it: ItemDef | undefined = SHOP_ITEMS.includes(a.item) ? ITEMS[a.item] : undefined;
      if (!it?.price || !it.bulk?.includes(a.n)) return fail('살 수 없는 물건이야');
      const cost = it.price * a.n;
      if (s.gold < cost) return fail('골드가 부족해');
      if (!canAdd(s, a.item, a.n)) return fail(BAG_FULL);
      s.gold -= cost;
      addItem(s, a.item, a.n);
      return { ok: true, msg: `${it.icon} ${it.name} ${a.n}개 구매!` };
    }
    case 'questAccept': {
      // 메뉴로 받는 건 교수님 퀘스트만 (이야기 퀘스트는 대사로)
      if (questDef(a.id)?.giver !== 'prof') return fail('없는 퀘스트야');
      return acceptQuest(s, a.id);
    }
    case 'questReport': {
      if (questDef(a.id)?.giver !== 'prof') return fail('없는 퀘스트야');
      return reportQuest(s, a.id);
    }
    case 'questPin': return togglePin(s, a.id);
    case 'learn': {
      const cls = CLASSES[s.cls], i = cls.skills.indexOf(a.skill);
      if (i < 0) return fail('우리 학과 스킬이 아니야');
      if (i !== nextToLearn(s)) return fail('스킬은 순서대로 배워야 해');
      if (s.level < UNLOCK_LEVELS[i]) return fail(`Lv ${UNLOCK_LEVELS[i]}에 배울 수 있어`);
      const sk = SKILLS[a.skill];
      if (sk.elements.length ? !a.element || !sk.elements.includes(a.element) : a.element !== null) return fail('원소를 골라줘');
      s.learned[a.skill] = a.element;
      s.skillLevels[a.skill] ??= 1;
      return { ok: true, banner: `${sk.name} 습득!` };
    }
    case 'attend': {
      const why = canAttend(s, nowMs);
      if (why) return fail('지금은 수업을 들을 수 없어');
      if (!learned(s, a.skill)) return fail('배운 스킬이 아니야');
      const lv = skillLevel(s, a.skill);
      if (lv >= MAX_SKILL_LEVEL) return fail('이미 마스터한 스킬이야');
      s.skillLevels[a.skill] = lv + 1;
      s.attendedCycle = timeInfo(nowMs).cycle;
      return { ok: true, banner: `${SKILLS[a.skill].name} Lv ${lv + 1}${lv + 1 >= MAX_SKILL_LEVEL ? ' (마스터!)' : ''}` };
    }
    case 'skillUp': {
      if (s.skillPts <= 0) return fail('스킬 포인트가 없어');
      if (!learned(s, a.skill)) return fail('배운 스킬이 아니야');
      const lv = skillLevel(s, a.skill);
      if (lv >= MAX_SKILL_LEVEL) return fail('이미 마스터한 스킬이야');
      s.skillPts--;
      s.skillLevels[a.skill] = lv + 1;
      return { ok: true };
    }
    case 'bindSkill': {
      if (!SLOT_KEYS.includes(a.key) || !CLASSES[s.cls].skills.includes(a.skill)) return fail('등록할 수 없어');
      if (!learned(s, a.skill)) return fail('배운 스킬만 등록할 수 있어');
      for (const k of SLOT_KEYS) if (s.skillKeys[k] === a.skill) delete s.skillKeys[k];
      s.skillKeys[a.key] = a.skill;
      return { ok: true };
    }
    case 'unbindKey': {
      if (!SLOT_KEYS.includes(a.key)) return fail('없는 키야');
      delete s.skillKeys[a.key];
      return { ok: true };
    }
    case 'swapKeys': {
      if (!SLOT_KEYS.includes(a.from) || !SLOT_KEYS.includes(a.to)) return fail('없는 키야');
      const f = s.skillKeys[a.from], t = s.skillKeys[a.to];
      if (t) s.skillKeys[a.from] = t; else delete s.skillKeys[a.from];
      if (f) s.skillKeys[a.to] = f; else delete s.skillKeys[a.to];
      return { ok: true };
    }
    case 'stat': {
      if (s.statPts <= 0) return fail('남은 포인트가 없어');
      s.statPts--;
      s.stats[a.stat]++;
      return { ok: true, statsChanged: true };
    }
    case 'useReset': {
      if (!removeItem(s, 'reset')) return fail('초기화 주문서가 없어');
      // 수업으로 올린 레벨(Lv1 넘는 만큼)은 스킬 포인트로 돌려받음
      for (const lv of Object.values(s.skillLevels)) s.skillPts += Math.max(0, lv - 1);
      s.skillLevels = {};
      s.learned = {};
      return { ok: true, banner: '스킬트리 초기화! 교수님께 다시 배우자' };
    }
    case 'equip': {
      const why = toggleEquip(s, a.index);
      return why ? fail(why) : { ok: true, statsChanged: true };
    }
    case 'unequip': {
      const why = unequip(s, a.slot);
      return why ? fail(why) : { ok: true, statsChanged: true };
    }
    case 'moveItem': {
      const why = moveItem(s, a.from, a.to);
      return why ? fail(why) : { ok: true };
    }
    case 'sortBag': {
      sortBag(s);
      return { ok: true };
    }
    case 'storyDo': {
      const e = findEffect(a.npc, a.talk, a.path);
      return e ? applyEffect(s, e) : fail('없는 대사야');
    }
    case 'cutDo': {
      const st = CUTSCENES[a.cut]?.[a.step];
      return st && 'do' in st ? applyEffect(s, st.do) : fail('없는 컷신이야');
    }
    case 'debug': {
      if (a.what === 'resetStory') {
        // 이야기 테스트 처음부터 (플래그 + 이야기 퀘스트)
        s.flags = {};
        for (const q of QUESTS) if (q.giver !== 'prof') delete s.quests[q.id];
        s.questPins = s.questPins.filter(id => s.quests[id]?.active);
        return { ok: true, msg: '이야기 초기화' };
      }
      if (a.what === 'nextPhase') { s.timeOffset += timeInfo(nowMs).remain + 50; return { ok: true }; }
      if (a.what === 'gold') { s.gold += 1000; return { ok: true, msg: '+1000 G' }; }
      return gainExp(s, expNeed(s.level) - s.exp);
    }
  }
}
