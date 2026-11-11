// 맵 데이터 (기획서 8장). 좌표 단위는 월드 픽셀, 화면 높이 540 기준.
export const GROUND_Y = 470;

export interface Platform { x: number; y: number; w: number; h?: number }
export interface Portal { x: number; to: MapId; toX: number; label: string }
/** id: 'prof'(교수님), 'shop'(매점) 은 특수 NPC, 나머지는 npcs.ts 의 대화 NPC */
export interface Npc { id: string; x: number }
export interface Sign { x: number; text: string }
export type Spawn = [x: number, element?: string | null, y?: number];

export type MapId = 'school' | 'field' | 'field2';

export interface MapDef {
  name: string;
  width: number;
  building?: boolean;
  /** 몬스터가 없는 안전 지대: 체력이 천천히 회복 */
  safe?: boolean;
  platforms: Platform[];
  portals: Portal[];
  npcs: Npc[];
  signs: Sign[];
  spawns: Spawn[];
}

export const MAPS: Record<MapId, MapDef> = {
  school: {
    name: '마법 학교', width: 1700, building: true, safe: true,
    platforms: [{ x: 250, y: 360, w: 160 }, { x: 1290, y: 360, w: 160 }],
    portals: [{ x: 1610, to: 'field', toX: 270, label: '학교 뒷숲' }],
    npcs: [{ id: 'story_test', x: 340 }, { id: 'test', x: 500 }, { id: 'prof', x: 860 }, { id: 'shop', x: 1160 }],
    signs: [{ x: 1480, text: '학교 뒷숲 →' }, { x: 200, text: '기숙사 (준비 중)' }],
    spawns: [],
  },
  field: {
    name: '학교 뒷숲', width: 1300,
    platforms: [{ x: 360, y: 370, w: 170 }, { x: 610, y: 290, w: 150 }, { x: 880, y: 360, w: 190 }],
    portals: [
      { x: 150, to: 'school', toX: 1530, label: '마법 학교' },
      { x: 1210, to: 'field2', toX: 270, label: '원소 슬라임 서식지' },
    ],
    npcs: [],
    signs: [{ x: 1080, text: '원소 슬라임 서식지 →' }],
    spawns: [[440], [680, null, 200], [790], [970, null, 270], [1030]],
  },
  field2: {
    name: '원소 슬라임 서식지', width: 1400,
    platforms: [{ x: 360, y: 375, w: 200 }, { x: 650, y: 300, w: 180 }, { x: 960, y: 350, w: 210 }],
    portals: [{ x: 150, to: 'field', toX: 1140, label: '학교 뒷숲' }],
    npcs: [],
    signs: [{ x: 1330, text: '끝' }],
    spawns: [[460, 'fire'], [740, 'water', 210], [860, 'earth'], [1060, 'light', 260], [1160, 'dark'], [1270, 'fire']],
  },
};
