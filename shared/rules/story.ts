// 이야기 진행: 대사 조건 검사, 대사 효과(퀘스트 주기·보고, 플래그) 처리.
import { TALK_NPCS, type Cond, type DialogueStep, type Effect } from '../data/npcs';
import type { SaveData } from '../sim/save';
import { acceptQuest, questState, reportQuest } from './quests';
import type { ActionResult } from './progress';

export function checkCond(s: SaveData, c: Cond): boolean {
  if ('all' in c) return c.all.every(x => checkCond(s, x));
  if ('quest' in c) return questState(s, c.quest) === c.state;
  const v = s.flags[c.flag] ?? 0;
  return (c.eq === undefined || v === c.eq) && (c.gte === undefined || v >= c.gte) && (c.lt === undefined || v < c.lt);
}

/** 지금 상황에 맞는 대사. talk = talks 번호 (-1 = 기본 대사) */
export function pickTalk(s: SaveData, npc: string): { talk: number; steps: DialogueStep[] } | null {
  const def = TALK_NPCS[npc];
  if (!def) return null;
  const i = def.talks?.findIndex(t => checkCond(s, t.when)) ?? -1;
  return i >= 0 ? { talk: i, steps: def.talks![i].steps } : { talk: -1, steps: def.dialogue };
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
  s.flags[e.flag] = e.set;
  return { ok: true };
}
