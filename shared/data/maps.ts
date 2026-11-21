// 맵 데이터 (기획서 8장). 좌표 단위는 월드 픽셀, 화면 높이 540 기준.
// 학교에서 왼쪽으로 쭉 들어가는 구성: 학교 → 뒷숲 → 원소 슬라임 서식지 → 갈림길 → (가운데 포탈) 경비기계 A·B 지역 → 공방 입구
import type { Element } from './elements';
import type { MonsterId } from './monsters';
import type { Cond } from './npcs';
export const GROUND_Y = 470;
/** 슬라임 숲 배경 (학교 뒷숲·원소 슬라임 서식지). 1672×941, 바닥 풀 윗면이 위에서 768px */
const FOREST_BG: { imgs: [string, string, string]; groundY: number } = { imgs: ['forest_morning', 'forest_day', 'forest_night'], groundY: 768 };

export interface Platform { x: number; y: number; w: number; h?: number }
/** when: 이 조건이 맞을 때만 보이고 탈 수 있음 (npcs.ts 의 Cond) */
export interface Portal {
  x: number; to: MapId; toX: number; label: string; when?: Cond;
  /** 포탈이 서 있는 높이 (발 높이, 없으면 땅) / 도착 높이 (없으면 땅) */
  y?: number; toY?: number;
  /** 들어가기 전에 물어봄 */
  confirm?: string;
  /** 갈 곳 고르기 (대화창 선택지). 있으면 to·toX 대신 고른 곳으로 */
  choose?: { label: string; to: MapId; toX: number }[];
  /** 보스 방 입장 포탈: 난이도를 골라 들어감 (bosses.ts 의 id). confirm 문구를 같이 보여 줌 */
  boss?: string;
  /** 닫힌 포탈: ↑ 를 누르면 이 글만 뜨고 안 들어가짐 (나중에 열 곳. to 는 아무 맵이나) */
  closed?: string;
  /** 던전 방: 몬스터 웨이브를 다 잡아야 나타남 */
  afterClear?: boolean;
}
/** id: 'prof'(교수님), 'shop'(매점), 'smith'(대장장이) 는 특수 NPC, 나머지는 npcs.ts 의 대화 NPC. when: 이 조건이 맞을 때만 서 있음 */
export interface Npc { id: string; x: number; when?: Cond }
export interface Sign { x: number; text: string }
/** 몬스터 나오는 자리. elem = 원소 슬라임의 원소, y 가 없으면 땅 위 */
export interface Spawn { x: number; mob: MonsterId; elem?: Element; y?: number; once?: boolean; elite?: import('./monsters').EliteAffix[] }

export type MapId = 'school' | 'field' | 'field2' | 'crossroad' | 'guard_a' | 'guard_b' | 'workshop_gate' | 'dorm' | 'guard_a_quiet' | 'workshop' | 'under_trial' | 'under_cleared' | 'under' | 'golem_room' | 'golem_scene'
  | 'school_hall' | 'school_hallway' | 'classroom_sword' | 'classroom_magic' | 'classroom_bow' | 'my_workshop' | 'road'
  | 'dungeon1' | 'dungeon2' | 'dungeon3' | 'training' | 'town' | 'honey_field';

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
   * 그림 맨 아래가 화면 맨 아래에, 그림의 groundY 줄(픽셀, 바닥 타일 윗면)이 땅 높이에 오게 크기를 맞춘다.
   * 맵 가운데에 놓고, 맵보다 넓은 양옆·화면보다 높은 위쪽은 잘려도 됨
   */
  bgTime?: { imgs: [string, string, string]; groundY: number };
  /**
   * 배경 위에 세우는 그림 (건물 등). x = 가운데, groundY = 그림에서 땅에 닿는 줄(픽셀), scale = 그림 배율.
   * 시간대에 따라 색이 바뀜 (밤엔 어둡고 푸르게)
   */
  props?: { img: string; x: number; groundY: number; scale: number }[];
  /** 플레이어·몬스터가 움직일 수 있는 범위 [왼쪽 x, 오른쪽 x] (없으면 맵 전체). 그림 양옆 전경까지는 못 가게 */
  walk?: [number, number];
  /** 조건이 맞으면 같은 자리의 다른 맵으로 바뀜 (몬스터 없는 맵 → 있는 맵 등) */
  becomes?: { when: Cond; to: MapId };
  /** 실내 맵: 밤이어도 화면을 어둡게 하지 않음 (시간은 그대로 흐름) */
  indoor?: boolean;
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
  /** 던전 방: 몬스터가 웨이브로 나옴 (spawns 대신). 한 웨이브를 다 잡으면 다음, 다 끝나면 afterClear 포탈이 열림 */
  waves?: Spawn[][];
  /**
   * 한 번만 줍는 물건 (↑ 로 주움, 주우면 영영 사라짐: 플래그 got_<id>). when = 이 조건일 때만 보임.
   * y = 발이 닿는 높이 (없으면 땅). 그림이 없으면 흰 상자
   */
  pickups?: { id: string; x: number; y?: number; item: string; when?: Cond }[];
  /** 던전 마지막 방: 다 잡으면 주는 보상 */
  clearReward?: { gold: number; exp: number };
  platforms: Platform[];
  portals: Portal[];
  npcs: Npc[];
  signs: Sign[];
  spawns: Spawn[];
}

/** 동급생 마법사 (검사·궁수만 보임) 이 서 있는 조건 */
const friend = (c: Cond): Cond => ({ all: [{ not: { cls: 'mage' } }, c] });
/** 동급생 검사 (마법사에게만 보임, 동급생 마법사와 같은 자리) 가 서 있는 조건 */
const wfriend = (c: Cond): Cond => ({ all: [{ cls: 'mage' }, c] });

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
/**
 * 던전 방: 배경 그림 하나, 왼쪽 포탈 = 나가기(공방 지하), 오른쪽 포탈 = 다음 방 (다 잡아야 나타남). 쓰러지면 공방 지하에서 깨어남
 */
function dungeonRoom(name: string, img: string, groundY: number, width: number, walk: [number, number] | undefined, next: MapId | null, waves: Spawn[][], clearReward?: { gold: number; exp: number }): MapDef {
  const [l, r] = walk ?? [0, width];
  const portals: Portal[] = [{ x: l + 70, to: 'under', toX: 150, label: '나가기' }];
  if (next) portals.push({ x: r - 70, to: next, toX: 220, label: '다음 방', afterClear: true });
  return {
    name, width, indoor: true, walk, bgColor: 0x15121e, bg: { img, groundY },
    platforms: [], portals, npcs: [], signs: [], spawns: [], waves, clearReward,
    respawn: { map: 'under', x: UNDER.mid, y: UNDER.top },
  };
}

/** 골렘 방 배경 golem_room.png 1774×887, 땅 줄 714 → 폭 1168. 양옆 전경(그림 x 230 / 1545 밖)으로는 못 감 */
const GOLEM_ROOM = { width: 1168, walk: [151, 1017] as [number, number], mid: 584 };

/** 마법 학교 맵에서 훈련장 포탈 자리 (가운데 오른쪽, 매점과 대장장이 사이) */
const SCHOOL_TRAINING_X = 1280;
/** 마법 학교 맵에서 건물 정문 자리 */
const SCHOOL_DOOR_X = 1018;
/** 학교 홀 그림 속 복도로 가는 아치 통로 자리 */
const HALL_ARCH_X = 499;
const HALL_DORM_X = 1346;
/** 마법 학교 맵 오른쪽 끝: 마을 가는 포탈 (예전 기숙사 포탈 자리) */
const SCHOOL_TOWN_X = 1620;
/** 마법 학교 오른쪽 2층 발판 (영지 가도 포탈) */
const SCHOOL_ROAD = { x: 1500, y: 360, w: 180, portal: 1590 };
/** 영지 가도: 마을 폭의 4/5, 같은 길이 2층 발판 2개 (가운데 기준 대칭) */
const ROAD = (() => {
  const width = 1360, mid = width / 2, w = 420, gap = 220, y = 360;
  return { width, y, left: mid - gap / 2 - w, right: mid + gap / 2, w };
})();
/** 원소 슬라임 서식지 왼쪽 위 발판 (꿀 슬라임 서식지 포탈) */
const FIELD2_HONEY = { x: 40, y: 240, w: 170, portal: 110 };
/** 학교 복도 그림 속 강의실 문 자리 (왼쪽부터 검술과 · 마법학과 · 궁술과 · 나중 직업 2개) */
const HALLWAY_DOORS = [261, 569, 880, 1197, 1516];
/** 강의실 그림 속 교탁 자리 */
const CLASSROOM_PROF_X = 916;
/** 강의실 맵 (그림은 같고, 나가면 그 강의실 문 앞으로) */
const classroom = (name: string, door: number, cls: 'warrior' | 'mage' | 'archer'): MapDef => ({
  name, width: 1367, safe: true, indoor: true, bg: { img: 'school_classroom', groundY: 791 },
  platforms: [],
  portals: [{ x: 70, to: 'school_hallway', toX: HALLWAY_DOORS[door], label: '학교 복도' }],
  // 교수님(내 학과 교수님)은 내 학과 강의실 교탁 앞에만 서 있음
  npcs: [{ id: 'prof', x: CLASSROOM_PROF_X, when: { cls } }], signs: [], spawns: [],
});

export const MAPS: Record<MapId, MapDef> = {
  school: {
    // 배경: 아침·낮·밤 그림 (그림 맨 아래 타일 = 땅) + 가운데 학교 건물.
    // 그림 위쪽 여유만큼 맵을 위로 늘려서(top) 점프하면 카메라가 조금 따라 올라감
    name: '마법 학교', width: 1700, safe: true, top: -150,
    bgTime: { imgs: ['school_morning', 'school_day', 'school_night'], groundY: 584 },
    props: [{ img: 'school_building', x: 850, groundY: 678, scale: 0.75 }],
    platforms: [{ x: 250, y: 360, w: 160 }, { x: 1290, y: 360, w: 160 }, { x: SCHOOL_ROAD.x, y: SCHOOL_ROAD.y, w: SCHOOL_ROAD.w }],
    portals: [
      { x: 90, to: 'field', toX: 772, label: '학교 뒷숲' },
      // 2026-11-21: 오른쪽 2층 발판 → 영지 가도
      { x: SCHOOL_ROAD.portal, y: SCHOOL_ROAD.y, to: 'road', toX: 160, label: '영지 가도' },
      { x: SCHOOL_TOWN_X, to: 'town', toX: 160, label: '마을' },
      // 학교 건물 정문 → 학교 홀
      { x: SCHOOL_DOOR_X, to: 'school_hall', toX: 80, label: '학교 홀' },
      { x: SCHOOL_TRAINING_X, to: 'training', toX: 120, label: '훈련장' },
    ],
    npcs: [
      { id: 'story_test', x: 340 }, { id: 'test', x: 500 }, { id: 'shop', x: 1160 }, { id: 'smith', x: 1400 },
      // 떠돌이 상인 (2026-11-21): 학교 앞
      { id: 'wanderer', x: 880 },
      { id: 'mage_friend', x: 680, when: friend({ quest: 'mg5', state: 'none' }) },
      // 미니 챕터를 끝내고 학교로 돌아옴
      { id: 'mage_friend', x: 680, when: friend({ quest: 'mg12', state: 'done' }) },
    ],
    signs: [{ x: 220, text: '← 학교 뒷숲' }],
    spawns: [],
  },
  field: {
    // 2026-11-18: 폭 1300 → 975 (3/4), 슬라임 5 → 10마리 (땅 5 · 발판 5). 오른쪽 입구 쪽은 비워 둠
    name: '학교 뒷숲', width: 975, bgTime: FOREST_BG,
    platforms: [{ x: 578, y: 370, w: 170 }, { x: 405, y: 290, w: 150 }, { x: 173, y: 360, w: 190 }],
    portals: [
      { x: 862, to: 'school', toX: 190, label: '마법 학교' },
      { x: 90, to: 'field2', toX: 848, label: '원소 슬라임 서식지' },
    ],
    npcs: [],
    signs: [{ x: 200, text: '← 원소 슬라임 서식지' }],
    spawns: slimes([
      [180], [290], [430], [560], [680],
      [210, 270], [300, 270], [440, 200], [510, 200], [640, 280],
    ]),
  },
  // 마을 (2026-11-21, 임시): 학교 바깥 그림을 그대로 쓰는 빈 마을. 영주님의 생일잔치 NPC
  town: {
    name: '마을', width: 1700, safe: true, top: -150,
    bgTime: { imgs: ['school_morning', 'school_day', 'school_night'], groundY: 584 },
    platforms: [],
    portals: [{ x: 90, to: 'school', toX: SCHOOL_TOWN_X - 100, label: '마법 학교' }],
    npcs: [{ id: 'masha', x: 620 }, { id: 'sebastian', x: 1150 }, { id: 'choir_kid', x: 1360 }, { id: 'firework_master', x: 1560 }],
    signs: [],
    spawns: [],
  },
  // 영지 가도 (2026-11-21): 마을과 같은 배경(건물 없음), 마을 폭의 4/5, 같은 길이 2층 발판 2개 대칭. 들짐승
  // 악보 5장 (날아간 악보 bd4 하는 동안만 보임, 주우면 영영 사라짐)
  road: {
    name: '영지 가도', width: ROAD.width, top: -150,
    bgTime: { imgs: ['school_morning', 'school_day', 'school_night'], groundY: 584 },
    platforms: [{ x: ROAD.left, y: ROAD.y, w: ROAD.w }, { x: ROAD.right, y: ROAD.y, w: ROAD.w }],
    portals: [{ x: 90, to: 'school', toX: SCHOOL_ROAD.portal, toY: SCHOOL_ROAD.y, label: '마법 학교' }],
    npcs: [],
    signs: [],
    spawns: [
      { x: 420, mob: 'beast' }, { x: 700, mob: 'beast' }, { x: 980, mob: 'beast' }, { x: 1240, mob: 'beast' },
      { x: ROAD.left + 100, mob: 'beast', y: ROAD.y - 60 }, { x: ROAD.left + ROAD.w - 100, mob: 'beast', y: ROAD.y - 60 },
      { x: ROAD.right + 100, mob: 'beast', y: ROAD.y - 60 }, { x: ROAD.right + ROAD.w - 100, mob: 'beast', y: ROAD.y - 60 },
    ],
    pickups: [
      { id: 'sheet1', x: 320, item: 'music_sheet', when: { quest: 'bd4', state: 'active' } },
      { id: 'sheet2', x: ROAD.left + 260, y: ROAD.y, item: 'music_sheet', when: { quest: 'bd4', state: 'active' } },
      { id: 'sheet3', x: ROAD.width / 2, item: 'music_sheet', when: { quest: 'bd4', state: 'active' } },
      { id: 'sheet4', x: ROAD.right + 160, y: ROAD.y, item: 'music_sheet', when: { quest: 'bd4', state: 'active' } },
      { id: 'sheet5', x: 1180, item: 'music_sheet', when: { quest: 'bd4', state: 'active' } },
    ],
  },
  // 꿀 슬라임 서식지 (2026-11-21): 학교 뒷숲 배치를 그대로 (임시). 배경 forest_inside (1672×941, 풀 윗면 849) → 폭은 그림 비율대로
  honey_field: {
    name: '꿀 슬라임 서식지', width: 926, bg: { img: 'forest_inside', groundY: 849 },
    platforms: [{ x: 578, y: 370, w: 170 }, { x: 405, y: 290, w: 150 }, { x: 173, y: 360, w: 190 }],
    portals: [{ x: 850, to: 'field2', toX: FIELD2_HONEY.portal + 40, toY: FIELD2_HONEY.y, label: '원소 슬라임 서식지' }],
    npcs: [],
    signs: [],
    spawns: [
      ...[180, 290, 430, 560, 680].map(x => ({ x, mob: 'honey_slime' as const })),
      ...([[210, 270], [300, 270], [440, 200], [510, 200], [640, 280]] as const).map(([x, y]) => ({ x, y, mob: 'honey_slime' as const })),
    ],
  },
  field2: {
    // 2026-11-20: 학교 뒷숲과 같은 조건으로 — 폭 1400 → 1050 (3/4), 원소 슬라임 1.2배, 10마리 (땅 5 · 발판 5, 원소마다 2마리). 오른쪽 입구 쪽은 비워 둠
    name: '원소 슬라임 서식지', width: 1050, bgTime: FOREST_BG,
    // 왼쪽 위 발판 (2026-11-21): 꿀 슬라임 서식지 포탈만 (몬스터 없음)
    platforms: [{ x: 630, y: 375, w: 200 }, { x: 428, y: 300, w: 180 }, { x: 173, y: 350, w: 210 }, { x: FIELD2_HONEY.x, y: FIELD2_HONEY.y, w: FIELD2_HONEY.w }],
    portals: [
      { x: 938, to: 'field', toX: 160, label: '학교 뒷숲' },
      { x: FIELD2_HONEY.portal, y: FIELD2_HONEY.y, to: 'honey_field', toX: 800, label: '꿀 슬라임 서식지' },
      { x: 70, to: 'crossroad', toX: 1430, label: '갈림길' },
    ],
    npcs: [],
    signs: [],
    spawns: [
      { x: 150, mob: 'slime_elem', elem: 'fire' }, { x: 330, mob: 'slime_elem', elem: 'water' }, { x: 500, mob: 'slime_elem', elem: 'earth' },
      { x: 670, mob: 'slime_elem', elem: 'light' }, { x: 820, mob: 'slime_elem', elem: 'dark' },
      { x: 220, mob: 'slime_elem', elem: 'fire', y: 260 }, { x: 460, mob: 'slime_elem', elem: 'water', y: 210 }, { x: 540, mob: 'slime_elem', elem: 'earth', y: 210 },
      { x: 700, mob: 'slime_elem', elem: 'light', y: 285 }, { x: 780, mob: 'slime_elem', elem: 'dark', y: 285 },
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
    npcs: [{ id: 'mage_friend', x: 1240, when: friend({ all: [{ quest: 'mg5', state: 'done' }, { not: { quest: 'mg6', state: 'done' } }] }) }, { id: 'warrior_friend', x: 1240, when: wfriend({ all: [{ quest: 'mg5', state: 'done' }, { not: { quest: 'mg6', state: 'done' } }] }) }],
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
    npcs: [{ id: 'mage_friend', x: 1240, when: friend({ all: [{ quest: 'mg6', state: 'done' }, { not: { quest: 'mg7', state: 'done' } }] }) }, { id: 'warrior_friend', x: 1240, when: wfriend({ all: [{ quest: 'mg6', state: 'done' }, { not: { quest: 'mg7', state: 'done' } }] }) }],
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
    npcs: [{ id: 'mage_friend', x: 560, when: friend({ all: [{ quest: 'mg7', state: 'done' }, { not: { quest: 'mg9', state: 'done' } }] }) }, { id: 'warrior_friend', x: 560, when: wfriend({ all: [{ quest: 'mg7', state: 'done' }, { not: { quest: 'mg9', state: 'done' } }] }) }],
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
  // ---- 마법 학교 안: 홀 → 복도 → 강의실 ----
  school_hall: {
    name: '학교 홀', width: 1426, indoor: true, safe: true, bg: { img: 'school_hall', groundY: 758 },
    platforms: [],
    portals: [
      { x: 80, to: 'school', toX: SCHOOL_DOOR_X, label: '마법 학교' },
      // 그림 속 아치 통로
      { x: HALL_ARCH_X, to: 'school_hallway', toX: 70, label: '학교 복도' },
      // 맨 오른쪽: 기숙사 (2026-11-20, 예전엔 학교 바깥 오른쪽 끝)
      // 2026-11-21: 기숙사 / 개인 공방 고르기
      { x: HALL_DORM_X, to: 'dorm', toX: 190, label: '기숙사', choose: [{ label: '기숙사', to: 'dorm', toX: 190 }, { label: '개인 공방', to: 'my_workshop', toX: 190 }] },
    ],
    // 동급생 검사 (마법사만): 평소엔 여기, 밤에 깨우러 옴(mgm5). 이야기를 끝내면 다시 여기
    npcs: [{ id: 'storage', x: 250 }, { id: 'warrior_friend', x: 1000, when: wfriend({ any: [{ quest: 'mg5', state: 'none' }, { quest: 'mg12', state: 'done' }] }) }],
    signs: [], spawns: [],
  },
  school_hallway: {
    name: '학교 복도', width: 1846, indoor: true, safe: true, bg: { img: 'school_hallway', groundY: 553 },
    platforms: [],
    portals: [
      { x: 70, to: 'school_hall', toX: HALL_ARCH_X, label: '학교 홀' },
      { x: HALLWAY_DOORS[0], to: 'classroom_sword', toX: 70, label: '검술과 강의실' },
      { x: HALLWAY_DOORS[1], to: 'classroom_magic', toX: 70, label: '마법학과 강의실' },
      { x: HALLWAY_DOORS[2], to: 'classroom_bow', toX: 70, label: '궁술과 강의실' },
      // 나중에 직업이 늘면 열 강의실
      { x: HALLWAY_DOORS[3], to: 'school_hallway', toX: HALLWAY_DOORS[3], label: '', closed: '지금은 들어갈 수 없다.' },
      { x: HALLWAY_DOORS[4], to: 'school_hallway', toX: HALLWAY_DOORS[4], label: '', closed: '지금은 들어갈 수 없다.' },
    ],
    npcs: [], signs: [], spawns: [],
  },
  classroom_sword: classroom('검술과 강의실', 0, 'warrior'),
  classroom_magic: classroom('마법학과 강의실', 1, 'mage'),
  classroom_bow: classroom('궁술과 강의실', 2, 'archer'),
  dorm: {
    // 2026-11-20: 학교 홀 맨 오른쪽 문으로 들어옴. 배경 school_room (그림 속 왼쪽 복도 문 = 나가는 포탈), 폭 = 그림 비율대로
    name: '기숙사 방', width: 1113, indoor: true, safe: true, bg: { img: 'school_room', groundY: 706 },
    platforms: [],
    portals: [{ x: 126, to: 'school_hall', toX: HALL_DORM_X - 80, label: '학교 홀' }],
    npcs: [{ id: 'bed', x: 413 }],
    signs: [],
    spawns: [],
  },
  // 개인 공방 (2026-11-21): 이 맵에서만 제작(J). 배경 school_workshop (기숙사와 같은 틀, 왼쪽 문 = 나가는 포탈)
  my_workshop: {
    name: '개인 공방', width: 1113, indoor: true, safe: true, bg: { img: 'school_workshop', groundY: 706 },
    platforms: [],
    portals: [{ x: 126, to: 'school_hall', toX: HALL_DORM_X - 80, label: '학교 홀' }],
    npcs: [],
    signs: [],
    spawns: [],
  },
  // 공방 내부 (배경 그림 1774×887, 발 줄 716)
  workshop: {
    name: '공방 내부', width: 1164, indoor: true, bg: { img: 'workshop', groundY: 716 }, safe: true,
    platforms: [],
    portals: [
      { x: 1100, to: 'workshop_gate', toX: 600, label: '공방 입구' },
      // 지하: 처음엔 시험(갇힘), 골렘을 잡은 뒤로는 보통 사냥터
      { x: 120, to: 'under_trial', toX: UNDER.mid, toY: UNDER.top, label: '공방 지하', when: { not: { quest: 'mg11', state: 'done' } } },
      { x: 120, to: 'under', toX: UNDER.mid, toY: UNDER.top, label: '공방 지하', when: { quest: 'mg11', state: 'done' } },
    ],
    npcs: [
      { id: 'mage_friend', x: 860, when: friend({ all: [{ quest: 'mg9', state: 'done' }, { any: [{ quest: 'mg10', state: 'none' }, { quest: 'mg10', state: 'active' }] }] }) }, { id: 'warrior_friend', x: 860, when: wfriend({ all: [{ quest: 'mg9', state: 'done' }, { any: [{ quest: 'mg10', state: 'none' }, { quest: 'mg10', state: 'active' }] }] }) },
      // 골렘 뒤: 윗층에서 후일담
      { id: 'mage_friend', x: 860, when: friend({ any: [{ quest: 'mg12', state: 'active' }, { quest: 'mg12', state: 'ready' }] }) }, { id: 'warrior_friend', x: 860, when: wfriend({ any: [{ quest: 'mg12', state: 'active' }, { quest: 'mg12', state: 'ready' }] }) },
    ],
    signs: [],
    spawns: [],
  },
  // 공방 지하 (세로로 긴 맵, 배경 색만): 위 발판에서 시작 → 양옆 발판 3개씩 → 바닥 가운데 골렘 방 포탈
  // 시험: 들어오면 갇힘 (나가는 포탈 없음), 몬스터 한 번씩만. 다 잡으면 바닥 가운데 포탈이 열림. 골렘을 잡으면 보통 사냥터로 바뀜
  under_trial: {
    name: '공방 지하', width: UNDER.width, indoor: true, top: UNDER.mapTop, bgColor: 0x1a1626, bg: { img: 'under', groundY: 1421 },
    platforms: UNDER.platforms,
    portals: [],
    // 다 잡으면 마법사가 문 옆에 나타나 골렘 퀘스트를 줌
    npcs: [{ id: 'mage_friend', x: UNDER.mid + 110, when: friend({ quest: 'mg10', state: 'ready' }) }, { id: 'warrior_friend', x: UNDER.mid + 110, when: wfriend({ quest: 'mg10', state: 'ready' }) }],
    signs: [],
    spawns: UNDER.spawns.map(sp => ({ ...sp, once: true })),
    becomes: { when: { quest: 'mg10', state: 'done' }, to: 'under_cleared' },
  },
  // 지하 시험을 끝낸 뒤 ~ 골렘을 처음 잡기 전: 몬스터 없음, 여전히 갇힘, 골렘 방 문이 열려 있음.
  // 골렘 방에서 쓰러지면 여기 위쪽 발판에서 깨어남. 골렘을 처음 잡으면(퀘스트 끝) 몬스터가 나오는 보통 지하로
  under_cleared: {
    name: '공방 지하', width: UNDER.width, indoor: true, top: UNDER.mapTop, bgColor: 0x1a1626, bg: { img: 'under', groundY: 1421 },
    platforms: UNDER.platforms,
    portals: [
      { x: UNDER.mid, to: 'golem_room', toX: 220, label: '???', confirm: '강력한 기운이 느껴집니다. 이동하시겠습니까?', boss: 'golem' },
    ],
    npcs: [{ id: 'mage_friend', x: UNDER.mid + 110, when: friend({ quest: 'mg11', state: 'active' }) }, { id: 'warrior_friend', x: UNDER.mid + 110, when: wfriend({ quest: 'mg11', state: 'active' }) }],
    signs: [],
    spawns: [],
    becomes: { when: { quest: 'mg11', state: 'done' }, to: 'under' },
  },
  under: {
    name: '공방 지하', width: UNDER.width, indoor: true, top: UNDER.mapTop, bgColor: 0x1a1626, bg: { img: 'under', groundY: 1421 },
    platforms: UNDER.platforms,
    portals: [
      { x: UNDER.mid, y: UNDER.top, to: 'workshop', toX: 220, label: '공방 내부' },
      { x: UNDER.mid, to: 'golem_room', toX: 220, label: '???', confirm: '강력한 기운이 느껴집니다. 이동하시겠습니까?', boss: 'golem' },
      // 던전 입구 (바닥 왼쪽)
      { x: 150, to: 'dungeon1', toX: 220, label: '잊힌 공방', confirm: '던전 잊힌 공방에 들어갈까? (방 3개, 다 잡아야 다음 방)' },
    ],
    npcs: [],
    signs: [],
    spawns: UNDER.spawns,
  },
  // 골렘 방 (슬라임 맵 크기). 입장 포탈에서 고른 난이도로 골렘이 한 번만 나옴. 골렘 퀘스트를 끝냈으면 나가는 포탈
  golem_room: {
    name: '???', width: GOLEM_ROOM.width, indoor: true, walk: GOLEM_ROOM.walk, bgColor: 0x15121e, bg: { img: 'golem_room', groundY: 714 }, orb: { x: GOLEM_ROOM.mid, y: 150 },
    platforms: [],
    portals: [{ x: 220, to: 'under', toX: UNDER.mid, label: '공방 지하', when: { quest: 'mg11', state: 'done' } }],
    npcs: [],
    signs: [],
    spawns: [{ x: 800, mob: 'golem', once: true }],
    // 쓰러지면 공방 지하 위쪽 (위 포탈 옆)
    respawn: { map: 'under_trial', x: UNDER.mid, y: UNDER.top },
  },
  // ===== 훈련장: 허수아비를 때려 초당 피해를 재는 곳 (학교 맵 가운데 오른쪽 포탈). 안전 지대 =====
  training: {
    name: '훈련장', width: 1300, safe: true,
    platforms: [],
    portals: [{ x: 70, to: 'school', toX: SCHOOL_TRAINING_X, label: '마법 학교' }],
    npcs: [], signs: [],
    spawns: [{ x: 800, mob: 'dummy' }],
  },
  // ===== 던전: 잊힌 공방 (공방 지하 바닥 왼쪽 포탈). 방 3개, 웨이브를 다 잡으면 다음 방 포탈이 열림. 왼쪽 포탈은 언제나 나가기 =====
  dungeon1: dungeonRoom('잊힌 공방 1', 'workshop', 716, 1164, undefined, 'dungeon2', [
    [{ x: 600, mob: 'guard_a' }, { x: 800, mob: 'guard_a' }, { x: 1000, mob: 'guard_a' }, { x: 900, mob: 'guard_d', y: GROUND_Y - 160 }],
    [{ x: 650, mob: 'guard_b' }, { x: 950, mob: 'guard_b' }, { x: 700, mob: 'guard_d', y: GROUND_Y - 150 }, { x: 1000, mob: 'guard_d', y: GROUND_Y - 200 }],
    [{ x: 750, mob: 'guard_c' }, { x: 1000, mob: 'guard_a', elite: ['swift'] }],
  ]),
  dungeon2: dungeonRoom('잊힌 공방 2', 'workshop', 716, 1164, undefined, 'dungeon3', [
    [{ x: 650, mob: 'guard_c' }, { x: 950, mob: 'guard_c' }, { x: 600, mob: 'guard_d', y: GROUND_Y - 160 }, { x: 1000, mob: 'guard_d', y: GROUND_Y - 200 }],
    [{ x: 600, mob: 'guard_b' }, { x: 1000, mob: 'guard_b' }, { x: 800, mob: 'guard_c' }, { x: 850, mob: 'guard_d', y: GROUND_Y - 180, elite: ['rage'] }],
    [{ x: 600, mob: 'guard_a' }, { x: 750, mob: 'guard_a', elite: ['iron'] }, { x: 900, mob: 'guard_a' }, { x: 1050, mob: 'guard_a', elite: ['swift'] }],
  ]),
  dungeon3: dungeonRoom('잊힌 공방 3', 'golem_room', 714, GOLEM_ROOM.width, GOLEM_ROOM.walk, null, [
    [{ x: 500, mob: 'guard_d', y: GROUND_Y - 160 }, { x: 750, mob: 'guard_d', y: GROUND_Y - 200 }, { x: 900, mob: 'guard_d', y: GROUND_Y - 150 }],
    [{ x: 780, mob: 'guard_boss', elite: ['iron', 'rage'] }, { x: 600, mob: 'guard_a' }, { x: 950, mob: 'guard_a' }],
  ], { gold: 400, exp: 600 }),
  // 골렘을 처음 잡은 순간 옮겨 오는 장면 전용 맵 (골렘 방과 같은 모습, 골렘 없음): 수상한 자가 결정체를 가져감 (컷신 mg_steal)
  golem_scene: {
    name: '???', width: GOLEM_ROOM.width, indoor: true, walk: GOLEM_ROOM.walk, bgColor: 0x15121e, bg: { img: 'golem_room', groundY: 714 }, orb: { x: GOLEM_ROOM.mid, y: 150 }, safe: true,
    platforms: [],
    portals: [{ x: 220, to: 'under', toX: UNDER.mid, toY: UNDER.top, label: '공방 지하', when: { quest: 'mg11', state: 'done' } }],
    npcs: [
      { id: 'mage_friend', x: 400, when: friend({ quest: 'mg11', state: 'ready' }) }, { id: 'warrior_friend', x: 400, when: wfriend({ quest: 'mg11', state: 'ready' }) },
      // 컷신이 끝나면(플래그) 사라짐
      { id: 'villain', x: 1120, when: { flag: 'mg_stolen', lt: 1 } },
    ],
    signs: [],
    spawns: [],
  },
};

/**
 * 배경 음악 (assets/sound/BGM/ 아래 파일 이름, .mp3 빼고). 없는 맵은 음악 없음 (사냥터 기본은 조용함).
 * 같은 음악인 맵끼리 옮겨 다니면 음악이 처음부터 다시 나오지 않고 이어짐 (2026-11-21, 임시 음악)
 */
export const MAP_BGM: Partial<Record<MapId, string>> = {
  // 마을 · 학교 바깥 · 학교 안 전부
  town: 'Noblesse nostalgia', school: 'Noblesse nostalgia', school_hall: 'Noblesse nostalgia', school_hallway: 'Noblesse nostalgia',
  classroom_sword: 'Noblesse nostalgia', classroom_magic: 'Noblesse nostalgia', classroom_bow: 'Noblesse nostalgia',
  dorm: 'Noblesse nostalgia', my_workshop: 'Noblesse nostalgia', training: 'Noblesse nostalgia',
  // 슬라임 사냥터 3개
  field: 'MoonlightShadow', field2: 'MoonlightShadow', honey_field: 'MoonlightShadow', road: 'MoonlightShadow',
  // 공방 안 전부 (던전 잊힌 공방 포함)
  workshop: 'LowGradeOre', under_trial: 'LowGradeOre', under_cleared: 'LowGradeOre', under: 'LowGradeOre',
  dungeon1: 'LowGradeOre', dungeon2: 'LowGradeOre', dungeon3: 'LowGradeOre',
  // 골렘 보스
  golem_room: 'GelimerLab', golem_scene: 'GelimerLab',
};
