// 게임 화면 자리 (HUD·NPC 창이 들어가는 곳).
// 게임 화면은 창 비율에 맞춰 넓어지고 좁아짐 (월드 폭 720 ~ 1280, 높이 620). 이 범위를 넘는 아주 넓거나 긴 창만 남는 곳이 검은 띠.
// 모바일은 HUD 가 창 전체를 씀 (조작 버튼이 화면 끝에 붙어야 해서). 모바일 HUD 자리·크기는 JS 가 아니라 CSS(style.css 의 html.mobile)가 창 크기 단위로 바로 정함.
export const VIEW_H = 620;
export const VIEW_MIN_W = 720;
export const VIEW_MAX_W = 1280;

let fullWindow = false;
/** 모바일: HUD·창이 창 전체를 씀 */
export function setFullWindowStage(on: boolean) { fullWindow = on; }

/** 월드 화면 폭 (높이 VIEW_H 기준, 창 비율에 맞춤) */
export const viewWidth = () => Math.round(Math.max(VIEW_MIN_W, Math.min(VIEW_MAX_W, (VIEW_H * innerWidth) / innerHeight)));

/** 게임 그림(캔버스)이 차지하는 자리 (CSS px) */
export function canvasRect() {
  const vw = viewWidth();
  const h = Math.min(innerHeight, (innerWidth * VIEW_H) / vw), w = (h * vw) / VIEW_H;
  return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, w, h };
}

/** HUD·창이 들어가는 자리 (PC = 캔버스 자리, 모바일 = 창 전체) */
export function stageRect() {
  return fullWindow ? { x: 0, y: 0, w: innerWidth, h: innerHeight } : canvasRect();
}

/** 끌어서 옮기는 창: 게임 화면 밖으로 나가지 않게 (왼쪽 위 좌표) */
export function clampToStage(x: number, y: number, w: number, h: number) {
  const s = stageRect();
  return {
    x: Math.max(s.x, Math.min(s.x + s.w - w, x)),
    y: Math.max(s.y, Math.min(s.y + s.h - h, y)),
  };
}
