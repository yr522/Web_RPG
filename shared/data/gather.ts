// 채집 (2026-11-22, 수치 임시). 채집 도구(낫·곡괭이)를 무기 칸에 끼면 Z 가 [채집].
// 맵의 채집물(maps.ts 의 gathers) 앞에서 Z → GATHER.time 초 뒤 1개 얻음, 도구 내구도 −1 (0 이면 파괴 → 대장장이 수리 또는 새로 사기).
// 캔 채집물은 사라졌다가 GATHER.respawn 초 뒤 다시 생김
import type { GatherKind } from './items';

export const GATHER = {
  /** 캐는 데 걸리는 시간 (초) */
  time: 0.6,
  /** 캔 채집물이 다시 생기는 시간 (초) */
  respawn: 20,
  /** 채집물 중심에서 이 거리(px) 안에 서 있어야 캠 */
  range: 50,
  /** 파괴된 도구 수리비 (골드만, 내구도 가득) */
  repair: 100,
};

/** 채집물 종류: 캐면 나오는 물건 · 필요한 도구 종류 · 임시 그림 색 */
export const GATHER_NODES: Record<string, { item: string; tool: GatherKind; color: number }> = {
  blue_herb: { item: 'blue_herb', tool: 'herb', color: 0x5aa8e8 },
  tin: { item: 'tin', tool: 'ore', color: 0x9aa0a8 },
};
