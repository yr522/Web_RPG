// 미니맵 (오른쪽 위, 맵 이름·시간 줄 아래): 맵 전체를 작게. 땅·발판, 포탈(보라), NPC(노랑, 받을 퀘스트 ! 금색 · 보고할 퀘스트 ? 민트), 몬스터(빨강), 나(흰색)
import { GROUND_Y, MAPS } from '@shared/data/maps';
import { MONSTERS } from '@shared/data/monsters';
import { mapNpcs, mapPortals, npcMark } from '@shared/rules/story';
import { professorMark } from '@shared/rules/progress';
import type { World } from '@shared/sim/World';
import type { SaveData } from '@shared/sim/save';

export class Minimap {
  readonly el = document.createElement('div');
  private cv = document.createElement('canvas');
  private ctx = this.cv.getContext('2d')!;
  private t = 0;

  constructor() {
    this.el.className = 'minimap';
    this.el.appendChild(this.cv);
  }

  /** 매 프레임 불러도 됨 (1초에 10번만 다시 그림) */
  draw(world: World, save: SaveData, nowMs: number, dt: number) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.1;
    const r = this.el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    const c = this.ctx, map = MAPS[world.mapId];
    const top = Math.min(map.top ?? 0, 0) + 60, bottom = GROUND_Y + 24;
    const pad = 6 * dpr, sx = (W - pad * 2) / map.width, sy = (H - pad * 2) / (bottom - top);
    const X = (x: number) => pad + x * sx, Y = (y: number) => pad + (y - top) * sy;
    c.clearRect(0, 0, W, H);
    // 땅 · 발판
    c.fillStyle = 'rgba(243, 222, 186, .55)';
    for (const s of world.solids) {
      const y = Math.max(top, s.y);
      if (s.ground) c.fillRect(X(s.x), Y(y), Math.max(1, s.w * sx), 2 * dpr);
      else c.fillRect(X(s.x), Y(y), Math.max(2, s.w * sx), 2 * dpr);
    }
    const dot = (x: number, y: number, rad: number, fill: string, stroke?: string) => {
      c.beginPath(); c.arc(X(x), Y(y), rad * dpr, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
      if (stroke) { c.lineWidth = 1.5 * dpr; c.strokeStyle = stroke; c.stroke(); }
    };
    for (const p of mapPortals(save, world.mapId, world.cleared)) dot(p.x, (p.y ?? GROUND_Y) - 14, 3, '#b388ff', '#2a1d4a');
    for (const e of world.enemies) if (!e.dead && MONSTERS[e.mob].ai !== 'dummy') dot(e.x + e.w / 2, e.y + e.h / 2, MONSTERS[e.mob].boss ? 3.5 : 2, '#ff6060');
    for (const n of mapNpcs(save, world.mapId)) {
      const m = n.id === 'prof' ? professorMark(save, nowMs) : npcMark(save, n.id, nowMs);
      if (n.id === 'bed') continue;
      dot(n.x, GROUND_Y - 14, m ? 3.5 : 2.5, m === '?' ? '#abc4aa' : m === '!' ? '#ffd84a' : '#e8d9a8', m ? '#4a3a10' : undefined);
    }
    for (const p of world.players.values()) dot(p.x + p.w / 2, p.y + p.h / 2, 3.5, '#ffffff', '#222');
  }
}
