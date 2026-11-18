// 게임 화면(16:9) 자리. 창이 더 넓거나 길면 남는 곳은 검은 띠, HUD·창은 이 안에 들어간다.
export const ASPECT = 16 / 9;

/** 지금 창에서 게임 화면이 차지하는 자리 (CSS px) */
export function stageRect() {
  const w = Math.min(innerWidth, innerHeight * ASPECT), h = w / ASPECT;
  return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, w, h };
}

/** 끌어서 옮기는 창: 게임 화면 밖으로 나가지 않게 (왼쪽 위 좌표) */
export function clampToStage(x: number, y: number, w: number, h: number) {
  const s = stageRect();
  return {
    x: Math.max(s.x, Math.min(s.x + s.w - w, x)),
    y: Math.max(s.y, Math.min(s.y + s.h - h, y)),
  };
}
