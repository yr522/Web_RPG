// 외형: 얼굴·눈동자 색 (성형사 NPC 에서 바꿈, 2026-11-25 테스트)
import type { ClassId } from './classes';

/** 고를 수 있는 얼굴 (그림은 client PlayerAvatar.ts 의 FACE_FILES) */
export const FACES = ['swordsman', 'magician'] as const;
export type FaceId = (typeof FACES)[number];

/** 직업별 처음 얼굴 (없으면 얼굴 없음) */
export const DEFAULT_FACE: Partial<Record<ClassId, FaceId>> = { warrior: 'swordsman', mage: 'magician' };

/** 눈동자 색: 빨주노초파남보 */
export const EYE_COLORS = ['#E03C3C', '#F08A24', '#F2D02E', '#3FB04A', '#3A7BE0', '#2E3A9E', '#8A3CC8'] as const;

export const isFace = (v: unknown): v is FaceId => (FACES as readonly unknown[]).includes(v);
export const isEyeColor = (v: unknown) => (EYE_COLORS as readonly unknown[]).includes(v);
