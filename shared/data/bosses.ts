// 보스: 보스 방 입장 포탈에서 난이도를 골라 들어감. 보스 메뉴(왼쪽 위 [보스])는 입장 포탈이 있는 맵으로 이동
import type { Cond } from './npcs';
import type { MapId } from './maps';

export type Difficulty = 'story' | 'easy' | 'normal' | 'hard';
export const DIFFICULTY_ORDER: Difficulty[] = ['story', 'easy', 'normal', 'hard'];

/**
 * 난이도별 배수 (보스 방 안의 몬스터 전부에 적용, 보통 = 몬스터 표 그대로)
 * hp: 체력, dmg: 플레이어가 받는 피해(몸통·패턴·보안장치), exp: 경험치, gold: 골드 (0 = 안 떨어뜨림)
 * extra: 노멀부터 추가 패턴 (골렘: 대지 붕괴·천장 잔해, GOLEM_NORMAL)
 */
export const DIFFICULTIES: Record<Difficulty, { name: string; hp: number; dmg: number; exp: number; gold: number; extra?: boolean }> = {
  story: { name: '스토리', hp: 0.7, dmg: 0.7, exp: 1, gold: 0 },
  easy: { name: '이지', hp: 1, dmg: 1, exp: 0.8, gold: 0.7 },
  normal: { name: '노멀', hp: 1.4, dmg: 1.25, exp: 1, gold: 1, extra: true },
  hard: { name: '하드', hp: 2, dmg: 1.5, exp: 2, gold: 2, extra: true },
};

export interface BossEntry {
  id: string;
  name: string;
  /** 보스 방과 들어가는 위치 */
  room: MapId;
  roomX: number;
  /** 입장 포탈이 있는 맵과 위치 (보스 메뉴로 오는 곳) */
  gate: { map: MapId; x: number };
  /** 보스 메뉴 버튼이 열리는 조건 */
  unlock: Cond;
  /** 난이도별로 열리는 조건 (없으면 처음부터 열림) */
  open: Partial<Record<Difficulty, Cond>>;
}

export const BOSSES: BossEntry[] = [
  // 마법 골렘: 처음엔 스토리만. 골렘 처치 퀘스트(mg11)를 끝내면 보스 메뉴와 나머지 난이도가 열림
  {
    id: 'golem', name: '마법 골렘', room: 'golem_room', roomX: 220, gate: { map: 'under', x: 600 },
    unlock: { quest: 'mg11', state: 'done' },
    open: {
      easy: { quest: 'mg11', state: 'done' },
      normal: { quest: 'mg11', state: 'done' },
      hard: { quest: 'mg11', state: 'done' },
    },
  },
];

export function bossDef(id: string) { return BOSSES.find(b => b.id === id); }

/** 화면 위 보스 HP 바: 한 줄 = layerHp. 다 깎이면 아래 줄 색이 나옴 (colors[줄 번호 % 개수], 0 = 마지막 줄) */
export const BOSS_BAR = { layerHp: 1000, colors: ['#e04848', '#e8892e', '#d8c234', '#4fbf5f', '#3f8fe8', '#9b5ee8'] };
