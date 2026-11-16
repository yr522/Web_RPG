/**
 * 마법 골렘 파츠 애니메이션 (그림: assets/img/sprites/enemies/02_boss_Golem, 192×192 한 장을 레이어별로 나눈 것)
 * 그림은 왼쪽을 봄. 발바닥 = 맨 아래 줄. Phaser 없이 파츠 위치·회전만 계산한다.
 */

/** 파츠 그림 (그리는 순서 = 아래 → 위) */
export const GOLEM_PARTS = [
  'hip', 'foot_l', 'foot_r', 'elbow_l', 'shoulder_l', 'body', 'hand_l', 'elbow_r', 'shoulder_r', 'hand_r', 'head',
] as const;
export type GolemPart = typeof GOLEM_PARTS[number];

/** 그림 한 칸 크기, 발 기준점 (가운데 아래) */
export const GOLEM_CANVAS = 192;
export const GOLEM_FOOT = { x: 96, y: 192 };
/** 그림 높이 (머리 위 ~ 발바닥): 몸 판정 높이에 맞출 때 씀 */
export const GOLEM_ART_H = 179;

type BoneId = 'legL' | 'legR' | 'hip' | 'torso' | 'head' | 'armL' | 'handL' | 'armR' | 'handR';

/** 뼈: 돌아가는 기준점(그림 좌표), 부모 */
const BONES: Record<BoneId, { pivot: [number, number]; parent?: BoneId }> = {
  legL: { pivot: [62, 162] },
  legR: { pivot: [140, 162] },
  hip: { pivot: [106, 150] },
  torso: { pivot: [96, 132], parent: 'hip' },
  head: { pivot: [80, 108], parent: 'torso' },
  armL: { pivot: [50, 90], parent: 'torso' },
  handL: { pivot: [30, 136], parent: 'armL' },
  armR: { pivot: [146, 64], parent: 'torso' },
  handR: { pivot: [166, 116], parent: 'armR' },
};
const ORDER: BoneId[] = ['legL', 'legR', 'hip', 'torso', 'head', 'armL', 'handL', 'armR', 'handR'];

/** 파츠 → 붙어 있는 뼈 (팔꿈치는 어깨에 붙어서 손만 따로 움직임) */
const PART_BONE: Record<GolemPart, BoneId> = {
  hip: 'hip', foot_l: 'legL', foot_r: 'legR', elbow_l: 'armL', shoulder_l: 'armL', body: 'torso',
  hand_l: 'handL', elbow_r: 'armR', hand_r: 'handR', shoulder_r: 'armR', head: 'head',
};

/** 뼈 하나의 움직임: 회전(라디안, 시계 방향 +), 이동(그림 픽셀) */
interface Move { r?: number; x?: number; y?: number }
type Pose = Partial<Record<BoneId, Move>> & { root?: { x?: number; y?: number } };

export type GolemMode = 'idle' | 'walk' | 'slamWind' | 'slamHit' | 'chargeWind' | 'charge' | 'quakeWind' | 'quakeHit' | 'groggy' | 'dead';

export interface GolemState {
  mode: GolemMode;
  /** 패턴 진행도 0 → 1 (예고·후딜), 죽음은 지난 초 */
  p: number;
  /** 시계 (초) */
  t: number;
}

/** 파츠 하나를 그릴 위치: 발 기준점에서 (x, y), 회전, 그림 안 기준점(0~1) */
export interface PartDraw { part: GolemPart; x: number; y: number; rot: number; ox: number; oy: number; alpha: number }

const ease = (p: number) => 1 - (1 - p) * (1 - p);
const easeIn = (p: number) => p * p;
const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 두 손을 머리 위로 (손 이동량) */
const HANDS_UP = { handL: { x: 38, y: -128, r: 0.5 }, handR: { x: -34, y: -122, r: -0.5 } };
/** 두 주먹을 앞쪽 바닥에 (손 이동량) */
const HANDS_DOWN = { handL: { x: -40, y: 16, r: -0.3 }, handR: { x: -112, y: 34, r: 0.2 } };

function mix(a: Pose, b: Pose, p: number): Pose {
  const out: Pose = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Pose>;
  for (const k of keys) {
    const ma = (a[k] ?? {}) as Move, mb = (b[k] ?? {}) as Move;
    (out as Record<string, Move>)[k] = { r: lerp(ma.r ?? 0, mb.r ?? 0, p), x: lerp(ma.x ?? 0, mb.x ?? 0, p), y: lerp(ma.y ?? 0, mb.y ?? 0, p) };
  }
  return out;
}

function idle(t: number): Pose {
  const b = Math.sin(t * 2.2);
  return {
    hip: { y: b * 0.8 }, torso: { y: b * 1.2 }, head: { r: Math.sin(t * 1.1) * 0.025 },
    handL: { y: Math.sin(t * 2.2 - 0.6) * 2 }, handR: { y: Math.sin(t * 2.2 - 0.9) * 2 },
  };
}

function walk(t: number): Pose {
  const ph = t * 4.2, s = Math.sin(ph), c = Math.cos(ph);
  return {
    legL: { x: -s * 9, y: -Math.max(0, c) * 7 },
    legR: { x: s * 9, y: -Math.max(0, -c) * 7 },
    hip: { y: -Math.abs(c) * 2 },
    torso: { r: s * 0.035, y: -Math.abs(c) * 1.5 },
    head: { r: -s * 0.03 },
    armL: { r: s * 0.06 }, armR: { r: -s * 0.05 },
    handL: { x: s * 6, y: -Math.abs(s) * 2 }, handR: { x: -s * 6, y: -Math.abs(s) * 2 },
  };
}

const SLAM_UP: Pose = { torso: { r: 0.14 }, head: { r: 0.08 }, hip: { y: 2 }, armL: { r: 0.25 }, armR: { r: -0.1 }, ...HANDS_UP };
const SLAM_DOWN: Pose = { torso: { r: -0.2, y: 6 }, head: { r: -0.12 }, hip: { y: 6 }, armL: { r: -0.15 }, ...HANDS_DOWN };
const CROUCH_FWD: Pose = { hip: { y: 8 }, torso: { r: -0.18, y: 4 }, head: { r: -0.06 }, handL: { x: 26, y: -6, r: 0.3 }, handR: { x: 22, y: -4, r: 0.2 } };
const GROGGY: Pose = { hip: { y: 10 }, torso: { r: -0.3, y: 6 }, head: { r: -0.35, y: 4 }, armL: { r: -0.2 }, armR: { r: 0.15 }, handL: { y: 22, r: -0.4 }, handR: { x: -6, y: 26, r: 0.3 } };

/** 지금 상태의 자세 */
function pose(s: GolemState): Pose {
  const shake = (amt: number) => Math.sin(s.t * 70) * amt;
  switch (s.mode) {
    case 'walk': return walk(s.t);
    case 'slamWind': {
      const p = ease(clamp01(s.p / 0.8));
      const pz = mix(idle(s.t), SLAM_UP, p);
      if (s.p > 0.6) pz.root = { x: shake(1.2 * (s.p - 0.6) / 0.4) };
      return pz;
    }
    case 'slamHit': {
      // 짧게 내려침 → 잠깐 박혀 있다가 → 일어남
      if (s.p < 0.12) return mix(SLAM_UP, SLAM_DOWN, easeIn(s.p / 0.12));
      if (s.p < 0.55) return SLAM_DOWN;
      return mix(SLAM_DOWN, idle(s.t), ease((s.p - 0.55) / 0.45));
    }
    case 'chargeWind': {
      const pz = mix(idle(s.t), CROUCH_FWD, ease(clamp01(s.p / 0.5)));
      pz.root = { x: shake(0.6 + 1.6 * s.p) };
      return pz;
    }
    case 'charge': {
      const w = walk(s.t * 2.2);
      return mix(w, { ...w, ...CROUCH_FWD, torso: { r: -0.24, y: 4 } }, 0.85);
    }
    case 'quakeWind': {
      // 웅크림 → 두 손 들고 뛰어오름 → 마지막에 떨어짐
      if (s.p < 0.35) {
        const pz = mix(idle(s.t), { ...CROUCH_FWD, ...HANDS_UP, hip: { y: 12 }, torso: { r: 0.05, y: 8 } }, ease(s.p / 0.35));
        pz.root = { x: shake(1.5) };
        return pz;
      }
      const up: Pose = { ...SLAM_UP, legL: { y: -6 }, legR: { y: -6 } };
      if (s.p < 0.88) {
        const k = ease((s.p - 0.35) / 0.53);
        const pz = mix({ ...CROUCH_FWD, ...HANDS_UP, hip: { y: 12 }, torso: { r: 0.05, y: 8 } }, up, Math.min(1, k * 1.6));
        pz.root = { y: -60 * k };
        return pz;
      }
      const pz = mix(up, SLAM_DOWN, easeIn((s.p - 0.88) / 0.12));
      pz.root = { y: -60 * (1 - easeIn((s.p - 0.88) / 0.12)) };
      return pz;
    }
    case 'quakeHit': {
      const down: Pose = { ...SLAM_DOWN, hip: { y: 12 }, torso: { r: -0.1, y: 12 }, handL: { x: -30, y: 34, r: -0.3 }, handR: { x: -8, y: 36, r: 0.3 } };
      if (s.p < 0.6) return down;
      return mix(down, idle(s.t), ease((s.p - 0.6) / 0.4));
    }
    case 'groggy': {
      const pz = mix(GROGGY, GROGGY, 1);
      pz.head = { r: -0.35 + Math.sin(s.t * 1.6) * 0.06, y: 4 };
      pz.torso = { r: -0.3 + Math.sin(s.t * 1.6 - 0.5) * 0.03, y: 6 };
      return pz;
    }
    default: return idle(s.t);
  }
}

/** 죽음: 파츠마다 튀어 나가는 방향 (x 속도, y 속도, 회전 속도) */
const BREAK: Record<GolemPart, [number, number, number]> = {
  head: [-60, -260, -3], body: [10, -120, 1.2], hip: [20, -40, 0.6], foot_l: [-40, -60, -1], foot_r: [50, -70, 1.4],
  shoulder_l: [-110, -200, -2.5], elbow_l: [-90, -140, 3], hand_l: [-150, -180, -4],
  shoulder_r: [120, -230, 2.2], elbow_r: [100, -150, -3], hand_r: [160, -170, 4],
};
/** 파츠 그림이 차지하는 칸 [왼, 위, 오른, 아래] (192 그림 기준) */
const BBOX: Record<GolemPart, [number, number, number, number]> = {
  head: [29, 29, 119, 114], body: [40, 39, 148, 134], hip: [75, 120, 137, 159], foot_l: [40, 158, 84, 192], foot_r: [119, 158, 161, 192],
  shoulder_l: [10, 74, 62, 125], elbow_l: [18, 117, 50, 139], hand_l: [0, 131, 41, 179],
  shoulder_r: [129, 13, 183, 102], elbow_r: [151, 92, 181, 115], hand_r: [145, 115, 192, 161],
};

/** 파츠별 그릴 위치 계산 */
export function golemPose(s: GolemState): PartDraw[] {
  const pz = pose(s.mode === 'dead' ? { ...s, mode: 'idle', t: 0 } : s);
  // 뼈마다 (회전, 이동): 그림 좌표 p → R(rot)·p + (tx, ty)
  const world = {} as Record<BoneId, { rot: number; tx: number; ty: number }>;
  const apply = (m: { rot: number; tx: number; ty: number }, x: number, y: number): [number, number] => {
    const c = Math.cos(m.rot), sn = Math.sin(m.rot);
    return [c * x - sn * y + m.tx, sn * x + c * y + m.ty];
  };
  const rx = pz.root?.x ?? 0, ry = pz.root?.y ?? 0;
  for (const id of ORDER) {
    const b = BONES[id], mv = pz[id] ?? {};
    const parent = b.parent ? world[b.parent] : { rot: 0, tx: rx, ty: ry };
    // 내 기준점이 부모를 따라 옮겨진 자리 + 내 이동, 그 점을 중심으로 회전
    const [px, py] = apply(parent, b.pivot[0] + (mv.x ?? 0), b.pivot[1] + (mv.y ?? 0));
    const rot = parent.rot + (mv.r ?? 0);
    const c = Math.cos(rot), sn = Math.sin(rot);
    world[id] = { rot, tx: px - (c * b.pivot[0] - sn * b.pivot[1]), ty: py - (sn * b.pivot[0] + c * b.pivot[1]) };
  }
  return GOLEM_PARTS.map(part => {
    const id = PART_BONE[part], m = world[id], bb = BBOX[part];
    if (s.mode === 'dead') {
      // 와르르: 파츠 가운데를 중심으로 돌며 튀어 오르고, 떨어져 바닥에서 멈춤, 끝에 흐려짐
      const cx0 = (bb[0] + bb[2]) / 2, cy0 = (bb[1] + bb[3]) / 2;
      const [vx, vy, vr] = BREAK[part], t = s.p, g = 900;
      const floor = Math.max(cy0, GOLEM_CANVAS - Math.min(bb[2] - bb[0], bb[3] - bb[1]) / 2);
      const fall = (tt: number) => cy0 + vy * tt + 0.5 * g * tt * tt;
      const tLand = (-vy + Math.sqrt(vy * vy + 2 * g * (floor - cy0))) / g;
      const tt = Math.min(t, tLand);
      return {
        part, x: cx0 + vx * tt * 0.6 - GOLEM_FOOT.x, y: (t >= tLand ? floor : fall(t)) - GOLEM_FOOT.y,
        rot: vr * tt, ox: cx0 / GOLEM_CANVAS, oy: cy0 / GOLEM_CANVAS, alpha: clamp01(1 - (t - 1.6) / 0.6),
      };
    }
    const pv = BONES[id].pivot;
    let [x, y] = apply(m, pv[0], pv[1]);
    // 주먹은 바닥을 뚫고 내려가지 않게
    if (part === 'hand_l' || part === 'hand_r') y = Math.min(y, GOLEM_CANVAS - (bb[3] - pv[1]));
    return { part, x: x - GOLEM_FOOT.x, y: y - GOLEM_FOOT.y, rot: m.rot, ox: pv[0] / GOLEM_CANVAS, oy: pv[1] / GOLEM_CANVAS, alpha: 1 };
  });
}

/** 죽고 나서 파츠가 보이는 시간 (초) */
export const GOLEM_DEATH_TIME = 2.2;
