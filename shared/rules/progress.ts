// 메뉴에서 하는 행동들 (상점, 퀘스트, 수업, 스킬 배우기, 능력치).
// 화면은 SaveData 를 직접 고치지 않고 이 행동을 요청한다 → 나중에 서버가 같은 함수로 검사·처리.
import { CLASSES, SKILLS, UNLOCK_LEVELS, MAX_SKILL_LEVEL, expNeed, type StatId } from '../data/classes';
import type { Element } from '../data/elements';
import { ITEMS, type ItemId } from '../data/items';
import { QUESTS } from '../data/quests';
import { timeInfo } from '../sim/clock';
import type { SaveData } from '../sim/save';

export type MenuAction =
  | { type: 'buy'; item: ItemId; n: number }
  | { type: 'questAccept'; id: string }
  | { type: 'questReport'; id: string }
  | { type: 'learn'; skill: string; element: Element | null }
  | { type: 'attend'; skill: string }
  | { type: 'stat'; stat: StatId }
  | { type: 'useReset' }
  | { type: 'debug'; what: 'nextPhase' | 'levelUp' | 'gold' };

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
    const st = s.quests[q.id];
    if (!st?.active || st.count >= q.need) return true;
  }
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
      const it = ITEMS[a.item];
      if (!it || !it.bulk.includes(a.n)) return fail('살 수 없는 물건이야');
      const cost = it.price * a.n;
      if (s.gold < cost) return fail('골드가 부족해');
      s.gold -= cost;
      s.inventory[a.item] += a.n;
      return { ok: true, msg: `${it.icon} ${it.name} ${a.n}개 구매!` };
    }
    case 'questAccept': {
      const q = QUESTS.find(x => x.id === a.id);
      if (!q) return fail('없는 퀘스트야');
      if (s.quests[q.id]?.active) return fail('이미 받은 퀘스트야');
      s.quests[q.id] = { active: true, count: 0 };
      return { ok: true, msg: `퀘스트 시작: ${q.name}` };
    }
    case 'questReport': {
      const q = QUESTS.find(x => x.id === a.id), st = q && s.quests[q.id];
      if (!q || !st?.active) return fail('받은 퀘스트가 아니야');
      if (st.count < q.need) return fail('아직 덜 했어');
      const reward = q.exp(s.level);
      s.quests[q.id] = { active: false, count: 0 };
      const r = gainExp(s, reward);
      return { ...r, banner: r.banner ?? `퀘스트 완료! EXP +${reward}` };
    }
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
    case 'stat': {
      if (s.statPts <= 0) return fail('남은 포인트가 없어');
      s.statPts--;
      s.stats[a.stat]++;
      return { ok: true, statsChanged: true };
    }
    case 'useReset': {
      if (s.inventory.reset <= 0) return fail('초기화 주문서가 없어');
      s.inventory.reset--;
      s.learned = {};
      return { ok: true, banner: '스킬트리 초기화! 교수님께 다시 배우자' };
    }
    case 'debug': {
      if (a.what === 'nextPhase') { s.timeOffset += timeInfo(nowMs).remain + 50; return { ok: true }; }
      if (a.what === 'gold') { s.gold += 1000; return { ok: true, msg: '+1000 G' }; }
      return gainExp(s, expNeed(s.level) - s.exp);
    }
  }
}
