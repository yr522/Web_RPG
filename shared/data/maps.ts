// 맵 데이터 (기획서 8장). 좌표 단위는 월드 픽셀, 화면 높이 540 기준.
// 학교에서 왼쪽으로 쭉 들어가는 구성: 학교 → 뒷숲 → 원소 슬라임 서식지 → 갈림길 → (가운데 포탈) 경비기계 A·B 지역 → 공방 입구
import type { Element } from './elements';
import type { MonsterId } from './monsters';
import type { Cond } from './npcs';
export const GROUND_Y = 470;

export interface Platform { x: number; y: number; w: number; h?: number }
/** when: 이 조건이 맞을 때만 보이고 탈 수 있음 (npcs.ts 의 Cond) */
export interface Portal {
  x: number; to: MapId; toX: number; label: string; when?: Cond;
  /** 포탈이 서 있는 높이 (발 높이, 없으면 땅) / 도착 높이 (없으면 땅) */
  y?: number; toY?: number;
  /** 들어가기 전에 물어봄 */
  confirm?: string;
  /** 보스 방 입장 포탈: 난이도를 골라 들어감 (bosses.ts 의 id). confirm 문구를 같이 보여 줌 */
  boss?: string;
}
/** id: 'prof'(교수님), 'shop'(매점) 은 특수 NPC, 나머지는 npcs.ts 의 대화 NPC. when: 이 조건이 맞을 때만 서 있음 */
export interface Npc { id: string; x: number; when?: Cond }
export interface Sign { x: number; text: string }
/** 몬스터 나오는 자리. elem = 원소 슬라임의 원소, y 가 없으면 땅 위 */
export interface Spawn { x: number; mob: MonsterId; elem?: Element; y?: number; once?: boolean }

export type MapId = 'school' | 'field' | 'field2' | 'crossroad' | 'guard_a' | 'guard_b' | 'workshop_gate' | 'dorm' | 'guard_a_quiet' | 'workshop' | 'under_trial' | 'under_cleared' | 'under' | 'golem_room' | 'golem_scene';

export interface MapDef {
  name: string;
  width: number;
  /**
   * 배경 그림 (assets/img/bg/ 아래 파일 이름, .png 빼고). groundY = 그림에서 발이 닿는 줄(픽셀).
   * 그림 맨 위가 맵 맨 위(top, 없으면 0)에, 그 줄이 땅 높이에 오도록 그림 크기를 맞춘다. 맵 폭은 그림 폭에 맞춰 둔다.
   */
  bg?: { img: string; groundY: number };
  /**
   * 시간대별 배경 그림 [아침, 낮, 밤] (assets/img/bg/, .png 빼고). 시간대가 바뀌기 직전에 부드럽게 섞인다.
   * 맵 폭에 맞춰 늘리고, 그림의 groundY 줄(픽셀)이 땅 높이에 온다 (그림 위쪽은 화면 밖으로 넘어가도 됨)
   */
  bgTime?: { imgs: [string, string, string]; groundY: number };
  /**
   * 배경 위에 세우는 그림 (건물 등). x = 가운데, groundY = 그림에서 땅에 닿는 줄(픽셀), scale = 그림 배율.
   * 시간대에 따라 색이 바뀜 (밤엔 어둡고 푸르게)
   */
  props?: { img: string; x: number; groundY: number; scale: number }[];
  /** 땅(발 밑) 색. 없으면 기본 어두운 땅. 시간대에 따라 색이 바뀜 */
  floor?: number;
  /** 플레이어·몬스터가 움직일 수 있는 범위 [왼쪽 x, 오른쪽 x] (없으면 맵 전체). 그림 양옆 전경까지는 못 가게 */
  walk?: [number, number];
  /** 조건이 맞으면 같은 자리의 다른 맵으로 바뀜 (몬스터 없는 맵 → 있는 맵 등) */
  becomes?: { when: Cond; to: MapId };
  /** 세로로 긴 맵: 맵 맨 위 y (음수, 없으면 한 화면) */
  top?: number;
  /** 배경을 그림·하늘 대신 한 가지 색으로 */
  bgColor?: number;
  /** 보스 방 천장 보안장치 위치 */
  orb?: { x: number; y: number };
  /** 여기서 쓰러지면 학교 대신 이곳에서 깨어남 */
  respawn?: { map: MapId; x: number; y?: number };
  /** 몬스터가 없는 안전 지대: 체력이 천천히 회복 */
  safe?: boolean;
  platforms: Platform[];
  portals: Portal[];
  npcs: Npc[];
  signs: Sign[];
  spawns: Spawn[];
}

/** 동급생 마법사 (검사·궁수만 보임) 이 서 있는 조건 */
const friend = (c: Cond): Cond => ({ all: [{ not: { cls: 'mage' } }, c] });

const slimes = (xs: [number, number?][]): Spawn[] => xs.map(([x, y]) => ({ x, mob: 'slime', y }));

/**
 * 공방 지하 모양 (배경 under.png 1024×1536, 땅 줄 1421 → 폭 1200, 맵 맨 위 -1195). 화면 양옆 여백이 없게 넓힘, 그림 위쪽은 화면 밖으로 넘어가도 됨:
 * 맨 위 가운데 발판(시작) + 양옆 발판 4개씩 (가운데는 비움) + 바닥. 발판 간격은 점프로 오를 수 있게 (125).
 * 맨 위 발판 위로는 천장까지 넉넉히 비워 둠
 */
const UNDER = (() => {
  const width = 1200, mapTop = -1195, mid = width / 2;
  const top = GROUND_Y - 125 * 5;
  const rows = [GROUND_Y - 125, GROUND_Y - 250, GROUND_Y - 375, GROUND_Y - 500];
  const platforms: Platform[] = [{ x: mid - 120, y: top, w: 240 }];
  for (const y of rows) platforms.push({ x: 40, y, w: 400 }, { x: width - 440, y, w: 400 });
  const spawns: Spawn[] = [
    { x: 160, mob: 'guard_c', y: rows[0] - 60 }, { x: 900, mob: 'guard_c', y: rows[1] - 60 }, { x: 200, mob: 'guard_c', y: rows[3] - 60 }, { x: 900, mob: 'guard_c' },
    { x: 320, mob: 'guard_d', y: rows[1] - 40 }, { x: 980, mob: 'guard_d', y: rows[2] - 40 }, { x: 580, mob: 'guard_d', y: rows[0] - 60 }, { x: 280, mob: 'guard_d', y: GROUND_Y - 120 },
  ];
  return { width, mapTop, mid, top, platforms, spawns };
})();
/** 골렘 방 배경 golem_room.png 1774×887, 땅 줄 714 → 폭 1168. 양옆 전경(그림 x 230 / 1545 밖)으로는 못 감 */
const GOLEM_ROOM = { width: 1168, walk: [151, 1017] as [number, number], mid: 584 };

export const MAPS: Record<MapId, MapDef> = {
  school: {
    // 배경: 아침·낮·밤 그림 (그림 맨 아래 = 땅) + 가운데 학교 건물
    name: '마법 학교', width: 1700, safe: true,
    bgTime: { imgs: ['school_morning', 'school_day', 'school_night'], groundY: 724 },
    props: [{ img: 'school_building', x: 850, groundY: 678, scale: 0.65 }],
    floor: 0xb4b2c4,
    platforms: [{ x: 250, y: 360, w: 160 }, { x: 1290, y: 360, w: 160 }],
    portals: [{ x: 90, to: 'field', toX: 1060, label: '학교 뒷숲' }, { x: 1620, to: 'dorm', toX: 700, label: '기숙사' }],
    npcs: [
      { id: 'story_test', x: 340 }, { id: 'test', x: 500 }, { id: 'prof', x: 860 }, { id: 'shop', x: 1160 },
      { id: 'mage_friend', x: 680, when: friend({ quest: 'mg5', state: 'none' }) },
      // 미니 챕터를 끝내고 학교로 돌아옴
      { id: 'mage_friend', x: 680, when: friend({ quest: 'mg12', state: 'done' }) },
    ],
    signs: [{ x: 220, text: '← 학교 뒷숲' }],
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
      // 숲 깊은 곳 입구: 처음엔 가려져 있음. 밤에 마법사와 갈 때(mg5) 몬스터 없는 맵, 그 뒤로는 몬스터 있는 맵
      { x: 800, to: 'guard_a_quiet', toX: 1390, label: '경비기계A 지역', when: { quest: 'mg5', state: 'active' } },
      { x: 800, to: 'guard_a', toX: 1390, label: '경비기계A 지역', when: { quest: 'mg5', state: 'done' } },
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
    npcs: [{ id: 'mage_friend', x: 1240, when: friend({ all: [{ quest: 'mg5', state: 'done' }, { not: { quest: 'mg6', state: 'done' } }] }) }],
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
    npcs: [{ id: 'mage_friend', x: 1240, when: friend({ all: [{ quest: 'mg6', state: 'done' }, { not: { quest: 'mg7', state: 'done' } }] }) }],
    signs: [],
    spawns: [{ x: 1080, mob: 'guard_b' }, { x: 820, mob: 'guard_b' }, { x: 560, mob: 'guard_b' }, { x: 320, mob: 'guard_b' }],
  },
  workshop_gate: {
    name: '공방 입구', width: 1088, bg: { img: 'workshop_gate', groundY: 722 },
    platforms: [],
    portals: [
      { x: 1010, to: 'guard_b', toX: 180, label: '경비기계B 지역' },
      // 공방 퀘스트 템을 가져다주면(보고) 열림
      { x: 684, to: 'workshop', toX: 1030, label: '공방 내부', when: { quest: 'mg9', state: 'done' } },
    ],
    npcs: [{ id: 'mage_friend', x: 560, when: friend({ all: [{ quest: 'mg7', state: 'done' }, { not: { quest: 'mg9', state: 'done' } }] }) }],
    signs: [],
    spawns: [],
  },
  // 경비기계A 지역의 몬스터 없는 모습: 밤에 마법사와 처음 온 곳. 목소리(나중에 연출) 뒤 같은 자리의 경비기계A 지역으로 바뀜
  guard_a_quiet: {
    name: '경비기계A 지역', width: 1500,
    platforms: [{ x: 980, y: 360, w: 200 }, { x: 640, y: 290, w: 170 }, { x: 300, y: 360, w: 200 }],
    portals: [{ x: 1420, to: 'crossroad', toX: 900, label: '갈림길' }],
    npcs: [],
    signs: [],
    spawns: [],
    becomes: { when: { quest: 'mg5', state: 'done' }, to: 'guard_a' },
  },
  // 내 기숙사 방 (임시 맵)
  dorm: {
    name: '기숙사 방', width: 900, safe: true,
    platforms: [],
    portals: [{ x: 800, to: 'school', toX: 1520, label: '마법 학교' }],
    npcs: [{ id: 'bed', x: 300 }],
    signs: [],
    spawns: [],
  },
  // 공방 내부 (배경 그림 1774×887, 발 줄 716)
  workshop: {
    name: '공방 내부', width: 1164, bg: { img: 'workshop', groundY: 716 }, safe: true,
    platforms: [],
    portals: [
      { x: 1100, to: 'workshop_gate', toX: 600, label: '공방 입구' },
      // 지하: 처음엔 시험(갇힘), 골렘을 잡은 뒤로는 보통 사냥터
      { x: 120, to: 'under_trial', toX: UNDER.mid, toY: UNDER.top, label: '공방 지하', when: { not: { quest: 'mg11', state: 'done' } } },
      { x: 120, to: 'under', toX: UNDER.mid, toY: UNDER.top, label: '공방 지하', when: { quest: 'mg11', state: 'done' } },
    ],
    npcs: [
      { id: 'mage_friend', x: 860, when: friend({ all: [{ quest: 'mg9', state: 'done' }, { any: [{ quest: 'mg10', state: 'none' }, { quest: 'mg10', state: 'active' }] }] }) },
      // 골렘 뒤: 윗층에서 후일담
      { id: 'mage_friend', x: 860, when: friend({ any: [{ quest: 'mg12', state: 'active' }, { quest: 'mg12', state: 'ready' }] }) },
    ],
    signs: [],
    spawns: [],
  },
  // 공방 지하 (세로로 긴 맵, 배경 색만): 위 발판에서 시작 → 양옆 발판 3개씩 → 바닥 가운데 골렘 방 포탈
  // 시험: 들어오면 갇힘 (나가는 포탈 없음), 몬스터 한 번씩만. 다 잡으면 바닥 가운데 포탈이 열림. 골렘을 잡으면 보통 사냥터로 바뀜
  under_trial: {
    name: '공방 지하', width: UNDER.width, top: UNDER.mapTop, bgColor: 0x1a1626, bg: { img: 'under', groundY: 1421 },
    platforms: UNDER.platforms,
    portals: [],
    // 다 잡으면 마법사가 문 옆에 나타나 골렘 퀘스트를 줌
    npcs: [{ id: 'mage_friend', x: UNDER.mid + 110, when: friend({ quest: 'mg10', state: 'ready' }) }],
    signs: [],
    spawns: UNDER.spawns.map(sp => ({ ...sp, once: true })),
    becomes: { when: { quest: 'mg10', state: 'done' }, to: 'under_cleared' },
  },
  // 지하 시험을 끝낸 뒤 ~ 골렘을 처음 잡기 전: 몬스터 없음, 여전히 갇힘, 골렘 방 문이 열려 있음.
  // 골렘 방에서 쓰러지면 여기 위쪽 발판에서 깨어남. 골렘을 처음 잡으면(퀘스트 끝) 몬스터가 나오는 보통 지하로
  under_cleared: {
    name: '공방 지하', width: UNDER.width, top: UNDER.mapTop, bgColor: 0x1a1626, bg: { img: 'under', groundY: 1421 },
    platforms: UNDER.platforms,
    portals: [
      { x: UNDER.mid, to: 'golem_room', toX: 220, label: '???', confirm: '강력한 기운이 느껴집니다. 이동하시겠습니까?', boss: 'golem' },
    ],
    npcs: [{ id: 'mage_friend', x: UNDER.mid + 110, when: friend({ quest: 'mg11', state: 'active' }) }],
    signs: [],
    spawns: [],
    becomes: { when: { quest: 'mg11', state: 'done' }, to: 'under' },
  },
  under: {
    name: '공방 지하', width: UNDER.width, top: UNDER.mapTop, bgColor: 0x1a1626, bg: { img: 'under', groundY: 1421 },
    platforms: UNDER.platforms,
    portals: [
      { x: UNDER.mid, y: UNDER.top, to: 'workshop', toX: 220, label: '공방 내부' },
      { x: UNDER.mid, to: 'golem_room', toX: 220, label: '???', confirm: '강력한 기운이 느껴집니다. 이동하시겠습니까?', boss: 'golem' },
    ],
    npcs: [],
    signs: [],
    spawns: UNDER.spawns,
  },
  // 골렘 방 (슬라임 맵 크기). 입장 포탈에서 고른 난이도로 골렘이 한 번만 나옴. 골렘 퀘스트를 끝냈으면 나가는 포탈
  golem_room: {
    name: '???', width: GOLEM_ROOM.width, walk: GOLEM_ROOM.walk, bgColor: 0x15121e, bg: { img: 'golem_room', groundY: 714 }, orb: { x: GOLEM_ROOM.mid, y: 70 },
    platforms: [],
    portals: [{ x: 220, to: 'under', toX: UNDER.mid, label: '공방 지하', when: { quest: 'mg11', state: 'done' } }],
    npcs: [],
    signs: [],
    spawns: [{ x: 800, mob: 'golem', once: true }],
    // 쓰러지면 공방 지하 위쪽 (위 포탈 옆)
    respawn: { map: 'under_trial', x: UNDER.mid, y: UNDER.top },
  },
  // 골렘을 처음 잡은 순간 옮겨 오는 장면 전용 맵 (골렘 방과 같은 모습, 골렘 없음): 수상한 자가 결정체를 가져감 (컷신 mg_steal)
  golem_scene: {
    name: '???', width: GOLEM_ROOM.width, walk: GOLEM_ROOM.walk, bgColor: 0x15121e, bg: { img: 'golem_room', groundY: 714 }, orb: { x: GOLEM_ROOM.mid, y: 70 }, safe: true,
    platforms: [],
    portals: [{ x: 220, to: 'under', toX: UNDER.mid, toY: UNDER.top, label: '공방 지하', when: { quest: 'mg11', state: 'done' } }],
    npcs: [
      { id: 'mage_friend', x: 400, when: friend({ quest: 'mg11', state: 'ready' }) },
      // 컷신이 끝나면(플래그) 사라짐
      { id: 'villain', x: 1120, when: { flag: 'mg_stolen', lt: 1 } },
    ],
    signs: [],
    spawns: [],
  },
};
