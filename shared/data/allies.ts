// 같이 싸우는 동급생 (2026-11-25, 튜토리얼 합동 훈련실). 맵의 allies 가 켜져 있으면 내 직업이 아닌 두 직업이 나옴.
// 무적, 몬스터는 이 둘을 노리지 않음. 가까운 몬스터에게 다가가서 쿨마다 한 대씩 (피해는 고정값)
import type { ClassId } from './classes';

export interface AllyStat {
  /** 이 거리 안이면 멈춰서 공격 (가로, 몸 가운데끼리) */
  range: number;
  /** 한 대 피해 */
  dmg: number;
  /** 공격 간격 (초) */
  every: number;
  /** 걷는 속도 (월드 px/초) */
  speed: number;
}

export const ALLY: Record<ClassId, AllyStat> = {
  warrior: { range: 55, dmg: 20, every: 1.1, speed: 190 },
  mage: { range: 240, dmg: 16, every: 1.3, speed: 170 },
  archer: { range: 300, dmg: 15, every: 1.2, speed: 180 },
};

export const ALLY_AI = {
  /** 몬스터를 알아채는 거리 */
  sight: 1400,
  /** 할 일이 없으면 플레이어 뒤로 이만큼씩 떨어져 따라감 */
  follow: 70,
  /** 공격 모션 시간 (초) */
  swing: 0.35,
  /** 맞은 몬스터 밀림 */
  kb: 90,
};
