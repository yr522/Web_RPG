// 길 찾기: 맵끼리는 포탈로 이어져 있다 (maps.ts 의 portals). 가장 적게 갈아타는 길의 첫 포탈을 알려 준다.
import { MAPS, type MapId, type Portal } from '../data/maps';

/** from 에서 to 로 가려면 지금 맵에서 탈 포탈 (같은 맵이거나 길이 없으면 null) */
export function nextPortal(from: MapId, to: MapId): Portal | null {
  if (from === to) return null;
  // 너비 우선 탐색: 처음 탄 포탈을 같이 기억
  const seen = new Set<MapId>([from]);
  let frontier: { map: MapId; first: Portal }[] = MAPS[from].portals.map(p => ({ map: p.to, first: p }));
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const f of frontier) {
      if (f.map === to) return f.first;
      if (seen.has(f.map)) continue;
      seen.add(f.map);
      for (const p of MAPS[f.map].portals) if (!seen.has(p.to)) next.push({ map: p.to, first: f.first });
    }
    frontier = next;
  }
  return null;
}
