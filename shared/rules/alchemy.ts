// 연금술 대기열 (저장 데이터만 다룸). 시간은 실제 시간(ms)을 받아서 계산
import { ALCHEMY, CRAFT_MAP, alchemyRecipe } from '../data/alchemy';
import type { SaveData } from '../sim/save';
import { addItem, canAdd, countItem, removeItem } from './inventory';

type Res = { ok: boolean; msg?: string };

/** 지금 가진 재료로 몇 개까지 만들 수 있는지 */
export function alchemyMax(s: SaveData, recipe: string) {
  const r = alchemyRecipe(recipe);
  if (!r) return 0;
  return Math.min(ALCHEMY.maxN, ...r.mats.map(m => Math.floor(countItem(s, m.item) / m.n)));
}

/** [제작]: 재료를 n 개 분량 가져가고 대기열 끝에 한 칸 */
export function alchemyOrder(s: SaveData, recipe: string, n: number, now: number): Res {
  const r = alchemyRecipe(recipe);
  if (!r || s.map !== CRAFT_MAP) return { ok: false };
  n = Math.floor(n);
  if (!(n >= 1 && n <= ALCHEMY.maxN)) return { ok: false };
  if (s.alchemy.queue.length >= ALCHEMY.queueMax) return { ok: false };
  if (alchemyMax(s, recipe) < n) return { ok: false };
  for (const m of r.mats) removeItem(s, m.item, m.n * n);
  if (!s.alchemy.queue.length) s.alchemy.t0 = now;
  s.alchemy.queue.push({ r: recipe, n, got: 0 });
  return { ok: true };
}

/**
 * 시간이 된 만큼 만들어서 가방에 넣음 (매 프레임). 가방이 차 있으면 다 된 채로 기다림.
 * 새로 들어간 개수를 돌려줌
 */
export function alchemyTick(s: SaveData, now: number): number {
  const per = ALCHEMY.time * 1000, q = s.alchemy.queue;
  let got = 0;
  while (q.length && now - s.alchemy.t0 >= per) {
    const head = q[0], r = alchemyRecipe(head.r);
    if (r) {
      if (!canAdd(s, r.out)) { s.alchemy.t0 = now - per; break; }
      addItem(s, r.out);
      got++;
    }
    head.got++;
    s.alchemy.t0 += per;
    if (!r || head.got >= head.n) q.shift();
  }
  return got;
}

/** 지금 만드는 것의 진행도 (0~1) */
export function alchemyProgress(s: SaveData, now: number) {
  if (!s.alchemy.queue.length) return 0;
  return Math.max(0, Math.min(1, (now - s.alchemy.t0) / (ALCHEMY.time * 1000)));
}
