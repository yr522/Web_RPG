// 외형: 얼굴·눈동자 색 (성형사 NPC 에서 바꿈, 2026-11-25 테스트)
import type { ClassId } from './classes';

/** 고를 수 있는 얼굴 (그림은 client PlayerAvatar.ts 의 FACE_FILES) */
export const FACES = ['swordsman', 'magician'] as const;
export type FaceId = (typeof FACES)[number];

/** 직업별 처음 얼굴 (없으면 얼굴 없음) */
export const DEFAULT_FACE: Partial<Record<ClassId, FaceId>> = { warrior: 'swordsman', mage: 'magician' };

/** 눈동자 색: 빨주노초파남보 + 검정 (진짜 #000 은 테두리와 구분 안 돼서 어두운 회색) */
export const EYE_COLORS = ['#E03C3C', '#F08A24', '#F2D02E', '#3FB04A', '#3A7BE0', '#2E3A9E', '#8A3CC8', '#303030'] as const;

/**
 * 눈동자 칠하기 판정: 원래 그림의 회색 밝기(upTo 이하) → 고른 색을
 * bright 배 밝기 · sat 만큼 채도 (나머지는 회색 쪽으로) · white 만큼 흰색 섞음.
 * 순수 검정(0) = 테두리라 안 바꿈. 위에서부터 처음 맞는 구간을 씀
 */
export const EYE_SHADE = [
  { upTo: 45, bright: 0.6, sat: 0.65, white: 0 },
  { upTo: 90, bright: 0.8, sat: 0.85, white: 0 },
  { upTo: 255, bright: 1, sat: 1, white: 0.4 },
] as const;

export const isFace = (v: unknown): v is FaceId => (FACES as readonly unknown[]).includes(v);
export const isEyeColor = (v: unknown) => (EYE_COLORS as readonly unknown[]).includes(v);
