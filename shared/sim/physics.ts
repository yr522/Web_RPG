// 프로토타입 v0.4.7 물리 그대로 (중력, 발판 위에서만 착지, ↓+점프로 내려가기)
export const GRAVITY = 1800;
export const MAX_FALL = 1300;
export const JUMP_VELOCITY = -690;

export interface Solid { x: number; y: number; w: number; h: number; ground?: boolean }

export interface Body {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  onGround: boolean;
  /** 남은 시간 동안 발판을 통과 (↓+점프) */
  drop: number;
  plat: Solid | null;
}

export function stepBody(o: Body, dt: number, solids: Solid[], worldWidth: number, gravity = true) {
  if (gravity) o.vy = Math.min(o.vy + GRAVITY * dt, MAX_FALL);
  o.x += o.vx * dt;
  o.x = Math.max(0, Math.min(worldWidth - o.w, o.x));
  const prevBottom = o.y + o.h;
  o.y += o.vy * dt;
  o.onGround = false;
  o.plat = null;
  if (o.vy >= 0) {
    for (const p of solids) {
      if (o.x + o.w <= p.x || o.x >= p.x + p.w) continue;
      const bottom = o.y + o.h;
      if (p.ground) {
        if (bottom >= p.y) { o.y = p.y - o.h; o.vy = 0; o.onGround = true; o.plat = p; }
      } else if (!(o.drop > 0) && prevBottom <= p.y + 0.5 && bottom >= p.y) {
        o.y = p.y - o.h; o.vy = 0; o.onGround = true; o.plat = p;
      }
    }
  }
  if (o.y < -200) o.y = -200;
}

export const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
