// 연금술 대기열 (저장 데이터만 다룸). 시간은 실제 시간(ms)을 받아서 계산.
// 칸마다 끝나는 시각(end)을 저장: 앞 칸이 끝난 뒤(또는 지금부터) 개수 × 1개 시간
import { ALCHEMY, CRAFT_MAP, alchemyRecipe, recipeNeeds } from '../data/alchemy';
import type { SaveData } from '../sim/save';
import { BAG_FULL, addItem, canAdd, countItem, removeItem } from './inventory';

type Res = { ok: boolean; msg?: string };

/** 지금 가진 재료로 몇 개까지 만들 수 있는지 */
export function alchemyMax(s: SaveData, recipe: string) {
  const r = alchemyRecipe(recipe);
  if (!r) return 0;
  return Math.min(ALCHEMY.maxN, ...recipeNeeds(r).map(m => Math.floor(countItem(s, m.item) / m.n)));
}

/** [제작]: 재료를 n 개 분량 가져가고 대기열 끝에 한 칸 */
export function alchemyOrder(s: SaveData, recipe: string, n: number, now: number): Res {
  const r = alchemyRecipe(recipe);
  if (!r || s.map !== CRAFT_MAP) return { ok: false };
  n = Math.floor(n);
  if (!(n >= 1 && n <= ALCHEMY.maxN)) return { ok: false };
  const q = s.alchemy.queue;
  if (q.length >= ALCHEMY.queueMax) return { ok: false };
  if (alchemyMax(s, recipe) < n) return { ok: false };
  for (const m of recipeNeeds(r)) removeItem(s, m.item, m.n * n);
  const start = Math.max(now, q.length ? q[q.length - 1].end : 0);
  q.push({ r: recipe, n, end: start + r.time * n * 1000 });
  return { ok: true };
}

/** 다 만들어진 칸 수 (앞에서부터) */
export function alchemyDone(s: SaveData, now: number) {
  let k = 0;
  while (k < s.alchemy.queue.length && s.alchemy.queue[k].end <= now) k++;
  return k;
}

/** [수령]: 다 된 칸을 앞에서부터 가방에 (한 칸 개수 전부가 들어갈 때만) */
export function alchemyCollect(s: SaveData, now: number): Res {
  const done = alchemyDone(s, now);
  if (!done) return { ok: false };
  let got = 0;
  for (let i = 0; i < done; i++) {
    const head = s.alchemy.queue[0], r = alchemyRecipe(head.r);
    if (r && !canAdd(s, r.out, head.n)) break;
    if (r) addItem(s, r.out, head.n);
    s.alchemy.queue.shift();
    got++;
  }
  return got ? { ok: true } : { ok: false, msg: BAG_FULL };
}

/** 칸의 진행도 (0~1) */
export function alchemyProgress(s: SaveData, i: number, now: number) {
  const q = s.alchemy.queue[i], r = q && alchemyRecipe(q.r);
  if (!q || !r) return 0;
  const dur = r.time * q.n * 1000;
  return Math.max(0, Math.min(1, 1 - (q.end - now) / dur));
}
