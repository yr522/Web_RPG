// 피부색: 뼈대 그림(회색 몸)을 피부색으로 바꿔 칠함. 회색 밝기(그림자·하이라이트)는 그대로 살리고, 검은 테두리는 그대로.
// 뼈대 기본 회색 = 164 (조금 밝은 168 · 어두운 159·142 도 섞여 있음) → 피부색 × (밝기 / 164)
import type { ClassId } from '@shared/data/classes';

/** 직업별 피부색 (2026-11-21 유저 검사 스케치 #F5C8A5). 없으면 뼈대 회색 그대로 */
export const SKIN: Partial<Record<ClassId, string>> = {
  warrior: '#F5C8A5',
};

const BONE_GRAY = 164;

/** 그림을 피부색으로 바꾼 캔버스 (원본은 그대로) */
export function skinCanvas(img: CanvasImageSource & { width: number; height: number }, hex: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  const sr = parseInt(hex.slice(1, 3), 16), sg = parseInt(hex.slice(3, 5), 16), sb = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2];
    // 회색 칠(테두리 검정 빼고)만 바꿈
    if (r !== g || g !== b || r < 60) continue;
    const k = r / BONE_GRAY;
    p[i] = Math.min(255, Math.round(sr * k));
    p[i + 1] = Math.min(255, Math.round(sg * k));
    p[i + 2] = Math.min(255, Math.round(sb * k));
  }
  ctx.putImageData(d, 0, 0);
  return c;
}
