// 콤보 (타격 수). 데미지 이점은 없고, 높게 유지하면 몬스터 경험치에 아주 조금 보너스
export const HIT_COMBO = {
  max: 500,
  /** 이 시간(초) 동안 아무 적도 못 맞히면 0 으로 (사냥터에서 다음 몬스터로 걸어가는 시간 기준, 리젠 대기는 생각 안 함) */
  timeout: 4,
  /** 콤보 every 마다 경험치 +perStep (500 콤보 = +5%) */
  every: 100,
  perStep: 0.01,
  /** 화면 숫자 색이 바뀌는 콤보 (위에서부터) */
  colors: [
    { min: 300, color: '#ff5a4a' },
    { min: 200, color: '#ff9a3a' },
    { min: 100, color: '#ffd84a' },
    { min: 0, color: '#ffffff' },
  ],
};

/** 콤보에 따른 경험치 배율 (1 = 보너스 없음) */
export const comboExpMult = (hits: number) => 1 + Math.floor(Math.min(hits, HIT_COMBO.max) / HIT_COMBO.every) * HIT_COMBO.perStep;
export const comboColor = (hits: number) => HIT_COMBO.colors.find(c => hits >= c.min)!.color;
