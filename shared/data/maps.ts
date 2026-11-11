// 맵 데이터 (기획서 8장). 좌표 단위는 월드 픽셀, 화면 높이 540 기준.
// 학교에서 왼쪽으로 쭉 들어가는 구성: 학교 → 뒷숲 → 원소 슬라임 서식지 → 갈림길 → (가운데 포탈) 경비기계 A·B 지역 → 공방 입구
import type { Element } from './elements';
import type { MonsterId } from './monsters';
export const GROUND_Y = 470;

export interface Platform { x: number; y: number; w: number; h?: number }
export interface Portal { x: number; to: MapId; toX: number; label: string }
/** id: 'prof'(교수님), 'shop'(매점) 은 특수 NPC, 나머지는 npcs.ts 의 대화 NPC */
export interface Npc { id: string; x: number }
export interface Sign { x: number; text: string }
/** 몬스터 나오는 자리. elem = 원소 슬라임의 원소, y 가 없으면 땅 위 */
export interface Spawn { x: number; mob: MonsterId; elem?: Element; y?: number }

export type MapId = 'school' | 'field' | 'field2' | 'crossroad' | 'guard_a' | 'guard_b' | 'workshop_gate';

export interface MapDef {
  name: string;
  width: number;
  building?: boolean;
  /**
   * 배경 그림 (assets/img/bg/ 아래 파일 이름, .png 빼고). groundY = 그림에서 발이 닿는 줄(픽셀).
   * 그 줄이 땅 높이에 오도록 그림 크기를 맞춘다. 맵 폭은 그림 폭에 맞춰 둔다.
   */
  bg?: { img: string; groundY: number };
  /** 몬스터가 없는 안전 지대: 체력이 천천히 회복 */
  safe?: boolean;
  platforms: Platform[];
  portals: Portal[];
  npcs: Npc[];
  signs: Sign[];
  spawns: Spawn[];
}

const slimes = (xs: [number, number?][]): Spawn[] => xs.map(([x, y]) => ({ x, mob: 'slime', y }));

export const MAPS: Record<MapId, MapDef> = {
  school: {
    name: '마법 학교', width: 1700, building: true, safe: true,
    platforms: [{ x: 250, y: 360, w: 160 }, { x: 1290, y: 360, w: 160 }],
    portals: [{ x: 90, to: 'field', toX: 1060, label: '학교 뒷숲' }],
    npcs: [{ id: 'story_test', x: 340 }, { id: 'test', x: 500 }, { id: 'prof', x: 860 }, { id: 'shop', x: 1160 }],
    signs: [{ x: 220, text: '← 학교 뒷숲' }, { x: 1560, text: '기숙사 (준비 중)' }],
    spawns: [],
  },
  field: {
    name: '학교 뒷숲', width: 1300,
    platforms: [{ x: 770, y: 370, w: 170 }, { x: 540, y: 290, w: 150 }, { x: 230, y: 360, w: 190 }],
    portals: [
      { x: 1150, to: 'school', toX: 190, label: '마법 학교' },
      { x: 90, to: 'field2', toX: 1150, label: '원소 슬라임 서식지' },
    ],
    npcs: [],
    signs: [{ x: 220, text: '← 원소 슬라임 서식지' }],
    spawns: slimes([[818], [578, 200], [468], [288, 270], [228]]),
  },
  field2: {
    name: '원소 슬라임 서식지', width: 1400,
    platforms: [{ x: 840, y: 375, w: 200 }, { x: 570, y: 300, w: 180 }, { x: 230, y: 350, w: 210 }],
    portals: [
      { x: 1250, to: 'field', toX: 160, label: '학교 뒷숲' },
      { x: 70, to: 'crossroad', toX: 1430, label: '갈림길' },
    ],
    npcs: [],
    signs: [],
    spawns: [
      { x: 898, mob: 'slime_elem', elem: 'fire' }, { x: 618, mob: 'slime_elem', elem: 'water', y: 210 }, { x: 498, mob: 'slime_elem', elem: 'earth' },
      { x: 298, mob: 'slime_elem', elem: 'light', y: 260 }, { x: 198, mob: 'slime_elem', elem: 'dark' }, { x: 760, mob: 'slime_elem', elem: 'fire' },
    ],
  },
  // 갈림길: 몬스터 없음. 가운데 포탈 = 마법공학의 유산 쪽, 왼쪽 끝은 나중에 다른 사냥터
  crossroad: {
    name: '갈림길', width: 1600,
    platforms: [{ x: 380, y: 360, w: 180 }, { x: 1080, y: 360, w: 180 }],
    portals: [
      { x: 1520, to: 'field2', toX: 170, label: '원소 슬라임 서식지' },
      { x: 800, to: 'guard_a', toX: 1390, label: '경비기계A 지역' },
    ],
    npcs: [],
    signs: [],
    spawns: [],
  },
  guard_a: {
    name: '경비기계A 지역', width: 1500,
    platforms: [{ x: 980, y: 360, w: 200 }, { x: 640, y: 290, w: 170 }, { x: 300, y: 360, w: 200 }],
    portals: [
      { x: 1420, to: 'crossroad', toX: 900, label: '갈림길' },
      { x: 80, to: 'guard_b', toX: 1390, label: '경비기계B 지역' },
    ],
    npcs: [],
    signs: [],
    spawns: [
      { x: 1100, mob: 'guard_a' }, { x: 860, mob: 'guard_a' }, { x: 680, mob: 'guard_a', y: 200 }, { x: 520, mob: 'guard_a' }, { x: 300, mob: 'guard_a' },
    ],
  },
  guard_b: {
    name: '경비기계B 지역', width: 1500,
    platforms: [{ x: 1000, y: 360, w: 220 }, { x: 600, y: 300, w: 200 }, { x: 260, y: 360, w: 200 }],
    portals: [
      { x: 1420, to: 'guard_a', toX: 180, label: '경비기계A 지역' },
      { x: 80, to: 'workshop_gate', toX: 990, label: '공방 입구' },
    ],
    npcs: [],
    signs: [],
    spawns: [{ x: 1080, mob: 'guard_b' }, { x: 820, mob: 'guard_b' }, { x: 560, mob: 'guard_b' }, { x: 320, mob: 'guard_b' }],
  },
  workshop_gate: {
    name: '공방 입구', width: 1088, bg: { img: 'workshop_gate', groundY: 722 },
    platforms: [],
    portals: [{ x: 1010, to: 'guard_b', toX: 180, label: '경비기계B 지역' }],
    npcs: [],
    signs: [],
    spawns: [],
  },
};
