// 대장장이 제작 대기열 (저장 데이터만 다룸). 시간은 실제 시간(ms)을 받아서 계산
import { CRAFT, recipeDef } from '../data/craft';
import { itemDef } from '../data/items';
import type { SaveData } from '../sim/save';
import { BAG_FULL, addItem, canAdd, countItem, removeItem } from './inventory';

type Res = { ok: boolean; msg?: string };

/** 대기열 상태: 다 된 개수, 지금 만드는 것의 남은 시간(초, 없으면 0) */
export function craftStatus(s: SaveData, now: number) {
  const q = s.craft.queue, per = CRAFT.time * 1000;
  if (!q.length) return { done: 0, left: 0 };
  const done = Math.min(q.length, Math.max(0, Math.floor((now - s.craft.t0) / per)));
  const left = done < q.length ? Math.ceil((per - (now - s.craft.t0 - done * per)) / 1000) : 0;
  return { done, left };
}

/** 맡기기: 재료·형판·골드를 가져가고 대기열 끝에 넣음 */
export function craftOrder(s: SaveData, recipe: string, now: number): Res {
  const r = recipeDef(recipe);
  if (!r) return { ok: false, msg: '없는 제작이야' };
  if (s.craft.queue.length >= CRAFT.queueMax) return { ok: false, msg: `한 번에 ${CRAFT.queueMax}개까지 맡길 수 있어` };
  for (const m of r.mats) if (countItem(s, m.item) < m.n) return { ok: false, msg: `${itemDef(m.item)?.name ?? m.item}이(가) 모자라` };
  if (s.gold < r.gold) return { ok: false, msg: '골드가 부족해' };
  // 비어 있으면 지금부터, 이미 다 된 것만 남아 있으면(안 받음) 지금부터 이어서
  const st = craftStatus(s, now);
  if (!s.craft.queue.length) s.craft.t0 = now;
  else if (st.done === s.craft.queue.length) s.craft.t0 = now - st.done * CRAFT.time * 1000;
  for (const m of r.mats) removeItem(s, m.item, m.n);
  s.gold -= r.gold;
  s.craft.queue.push(recipe);
  return { ok: true, msg: `${itemDef(r.out)?.name ?? r.out} 제작을 맡겼어` };
}

/** 받기: 다 된 것을 가방에 (가방이 차면 들어가는 만큼만) */
export function craftCollect(s: SaveData, now: number): Res {
  const { done } = craftStatus(s, now);
  if (!done) return { ok: false, msg: '아직 다 된 게 없어' };
  let got = 0;
  for (let i = 0; i < done; i++) {
    const r = recipeDef(s.craft.queue[0]);
    if (r && !canAdd(s, r.out)) break;
    if (r) addItem(s, r.out);
    s.craft.queue.shift();
    s.craft.t0 += CRAFT.time * 1000;
    got++;
  }
  if (!got) return { ok: false, msg: BAG_FULL };
  return { ok: true, msg: `제작품 ${got}개를 받았어` };
}
