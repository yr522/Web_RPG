import type { MonsterId } from '../data/monsters';
// 시뮬레이션 안의 것들 (플레이어, 몬스터, 공격 판정)
import type { Body } from './physics';
import type { Command, EntityId } from './types';
import type { DerivedStats, SaveData } from './save';
import type { Element } from '../data/elements';

/** 지금 하고 있는 행동 (공격, 조준, 돌진 등) */
export interface PlayerAction {
  name: string;
  skill?: string;
  t: number;
  dur: number;
  events?: { at: number; fn: () => void; done?: boolean }[];
  update?: (dt: number) => void;
  end?: () => void;
  noGravity?: boolean;
  /** 무적 */
  inv?: boolean;
  superArmor?: boolean;
  /** 마법사 캐스팅 (발밑 마법진·캐스팅 바) */
  cast?: boolean;
  /** 캐스팅 바가 다 차는 시점 (없으면 dur) */
  castEnd?: number;
  /** 궁수 충전: 0~1 */
  g?: number;
  /** 궁수 충전: 손을 뗐음 */
  released?: boolean;
  /** 궁수 충전: 이 시간 전에는 발사하지 않음 (직전 발사 후 쉬는 시간) */
  minT?: number;
  /** 충전·조준 중인 스킬의 원소 */
  elem?: import('../data/elements').Element | null;
  /** 흘려베기 받아내기 중: 받은 피해(줄이기 전) 합 */
  guard?: { taken: number };
  /** 조준 각도 (사슬 화살) */
  ang?: number;
  maxAng?: number;
}

export interface PlayerState extends Body {
  id: EntityId;
  name: string;
  face: 1 | -1;
  hp: number;
  mp: number;
  stats: DerivedStats;
  /** 직업·배운 스킬·포션 등 (로컬에서는 저장 데이터 그 자체, 나중에는 서버가 가진 데이터) */
  data: SaveData;
  /** 이번 틱 입력 */
  cmd: Command;
  potionCd: number;
  /** 쓰러져 있는 남은 시간 (0 = 안 쓰러짐). 끝나면 died 이벤트 */
  downT: number;
  /** 남은 밀려남 거리 (px, 부호 = 방향). 마법사 기본 공격 반동 */
  push: number;
  warnCd: number;
  action: PlayerAction | null;
  cd: Record<string, number>;
  /** 공격 후 다음 입력까지 잠깐 쉬는 시간 */
  lockT: number;
  buffer: { name: string; t: number } | null;
  lastHit: { order: number; t: number } | null;
  /** 검사 초식 순서 (일섬 1 → 월참 2 → 질풍참 3) */
  combo: number;
  /** 질풍참 직후 천붕을 쓸 수 있는 시간 */
  cbWindow: number;
  /** 맞은 뒤 무적 시간 */
  invT: number;
  /** 땅에서 ↓ 를 누르고 앉아 있음 (이동 멈춤) */
  crouch: boolean;
  hurt: number;
  /** 기절: 남은 시간 동안 조작 불가 */
  stunT: number;
  /** 지금 무적(invT)이 몸통 접촉으로 생긴 것 (보스 패턴은 이 무적을 무시) */
  touchInv?: boolean;
  /** 마력 해방 남은 시간 */
  buffT: number;
  /** 날아가는 중인 사슬 화살 (한 번 더 누르면 끌려감) */
  chainArrow: Projectile | null;
  /** 사슬 화살로 끌려가는 지점 (밧줄 그리기용) */
  ropeTo: { x: number; y: number } | null;
}

export interface Enemy extends Body {
  id: EntityId;
  /** 몬스터 종류 (monsters.ts) */
  mob: MonsterId;
  elem: Element | null;
  elemental: boolean;
  hp: number;
  maxHp: number;
  dir: 1 | -1;
  turnT: number;
  hopT: number;
  stun: number;
  /** 마지막으로 맞은 원소 (원소 반응용) */
  record: Element | null;
  dead: boolean;
  deadT: number;
  spawnX: number;
  spawnY: number;
  speed: number;
  /** 특수 패턴: 'none' → 'crouch'(웅크림·예고) → 'leap'(슬라임 점프 / 돌진형 돌진) */
  leap: 'none' | 'crouch' | 'leap';
  leapT: number;
  /** 다음 큰 점프까지 */
  leapCd: number;
  /** 이번 틱에 소용돌이에 끌려감 (스스로 움직이지 않음) */
  pulled: boolean;
  /** 보스 패턴 (골렘: 내려치기 / 돌진) */
  pat?: 'slam' | 'charge' | 'quake';
  /** 대지 붕괴를 쓴 횟수 (GOLEM_NORMAL.quakeAt 순서) */
  quakes?: number;
  /** 돌진 방향 (예고할 때 고정) */
  chargeDir?: 1 | -1;
  /** 연달아 쓴 내려치기 수 (다 차면 돌진) */
  slams?: number;
  /** 보안장치 오브에 맞은 횟수 (다 차면 기절) */
  orbHits?: number;
  /** 기절(취약) 남은 시간: 못 움직이고 받는 피해 배수 */
  groggy?: number;
  /** 날아다니는 몬스터의 둥실둥실 기준 높이 */
  hoverY?: number;
  /** 이야기용 이름표 (이 몬스터를 잡으면 진행되는 퀘스트용, 예: 보스) */
  tag?: string;
  /** 컷신 중 붙잡힘: 스스로 안 움직이고 부딪혀도 피해 없음 (컷신이 끝나면 풀림) */
  held?: boolean;
  /** 한 번만 나오는 몬스터 (죽으면 다시 안 나타남) */
  once?: boolean;
  /** 출혈 (혈섬): 남은 시간, 다음 피해까지, 한 번 피해 */
  bleed?: { t: number; tick: number; dmg: number; owner: PlayerState; elem: Element | null } | null;
  /** 마력 씨앗: 심은 사람, 심은 뒤 그 사람이 준 피해 합 */
  seed?: { owner: PlayerState; dmg: number; elem: Element | null } | null;
  /** 묶임 (땅 덫): 남은 시간 동안 못 움직임 */
  root?: number;
}

/** 궁수 덫: 바닥에 설치, 밟으면 작동. (x, y) = 아래 가운데 */
export interface Trap { id: EntityId; owner: PlayerState; x: number; y: number; w: number; elem: Element | null; t: number }

export interface Coin {
  id: EntityId;
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  onGround: boolean; drop: number; plat: import('./physics').Solid | null;
  /** 골드 액수 (item 이 있으면 그 물건 개수) */
  amt: number;
  /** 떨어진 물건 (없으면 골드) */
  item?: string;
  t: number;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** 몬스터를 때리는 것의 공통 부분 (공격 판정, 투사체) */
export interface Attack {
  owner: PlayerState;
  face: number;
  coef: number;
  elem: Element | null;
  order: number;
  chain: boolean;
  kb: number;
  kbAng?: number;
  launch?: number;
  light?: boolean;
  /** 스킬 레벨 배율 */
  sm: number;
  /** 어떤 스킬의 공격인지 (출혈·씨앗 등 스킬별 효과) */
  skill: string;
  /** 잃은 HP 비례 추가 피해 (그림자 화살): 잃은 HP × pct, 최대 공격력 × cap */
  exec?: { pct: number; cap: number };
  /** 맞은 몬스터를 이 시간(초)만큼 묶음 (보스 제외) */
  root?: number;
}

/** 날아가는 공격 (마력탄, 화살) */
export interface Projectile extends Attack {
  id: EntityId;
  kind: 'orb' | 'arrow' | 'chain' | 'big';
  x: number; y: number;
  ang: number;
  speed: number;
  range: number;
  traveled: number;
  /** 판정 크기 (정사각형 한 변) */
  size: number;
  /** 화살 길이 (그리기용) */
  len?: number;
  pierce?: boolean;
  hit: Set<EntityId>;
  dead: boolean;
  /** 궤도탄: 몸 주위를 도는 중 (ang = 각도, t = 남은 시간, wait = 적을 찾은 뒤 출발까지) */
  orbit?: { ang: number; t: number; wait: number };
  /** 궤도탄: 쫓아가는 몬스터 */
  target?: EntityId;
}

/** 소용돌이 화살: 범위 안 몬스터를 가운데로 끌어모음 */
export interface Vortex { x: number; y: number; r: number; t: number; life: number; color: string }

export interface Hitbox extends Attack {
  /** 고정 위치 판정 (원소 기둥, 화살비 등). 있으면 dx·dy 무시 */
  abs?: Rect;
  /** 플레이어 중심 기준 위치 (center 면 가운데 정렬) */
  dx: number; dy: number; w: number; h: number;
  center?: boolean;
  life: number;
  t: number;
  hit: Set<EntityId>;
}
