import { describe, expect, it } from 'vitest';
import { alchemyRecipe } from '../shared/data/alchemy';
import { addItem, countItem } from '../shared/rules/inventory';
import { alchemyCollect, alchemyDone, alchemyMax, alchemyOrder } from '../shared/rules/alchemy';
import { newSave } from '../shared/sim/save';

const per = alchemyRecipe('hp')!.time * 1000;
function inWorkshop() {
  const s = newSave('t', 'warrior', 'M');
  s.map = 'my_workshop';
  addItem(s, 'blue_herb', 5);
  addItem(s, 'honey', 10);
  addItem(s, 'empty_bottle', 4);
  return s;
}

describe('연금술', () => {
  it('최대 개수 = 재료·빈 병이 허락하는 만큼', () => {
    const s = inWorkshop();
    expect(alchemyMax(s, 'hp')).toBe(4);
    expect(alchemyMax(s, 'honey_shake')).toBe(4);
  });
  it('개인 공방 밖에서는 못 만듦', () => {
    const s = inWorkshop();
    s.map = 'school';
    expect(alchemyOrder(s, 'hp', 1, 0).ok).toBe(false);
  });
  it('재료·빈 병을 개수만큼 가져가고, 한 칸이 다 돼야 수령', () => {
    const s = inWorkshop();
    const hp0 = countItem(s, 'hp');
    expect(alchemyOrder(s, 'hp', 2, 0).ok).toBe(true);
    expect([countItem(s, 'blue_herb'), countItem(s, 'honey'), countItem(s, 'empty_bottle')]).toEqual([3, 8, 2]);
    expect(alchemyCollect(s, per).ok).toBe(false);
    expect(countItem(s, 'hp')).toBe(hp0);
    expect(alchemyDone(s, per * 2)).toBe(1);
    expect(alchemyCollect(s, per * 2).ok).toBe(true);
    expect(countItem(s, 'hp')).toBe(hp0 + 2);
    expect(s.alchemy.queue).toHaveLength(0);
  });
  it('다음 칸은 앞 칸이 끝난 뒤부터 (안 받고 있어도 계속 만듦)', () => {
    const s = inWorkshop();
    alchemyOrder(s, 'hp', 1, 0);
    alchemyOrder(s, 'hp', 1, 0);
    expect(alchemyDone(s, per)).toBe(1);
    expect(alchemyDone(s, per * 2)).toBe(2);
    // 다 끝난 뒤 넣으면 지금부터
    alchemyOrder(s, 'hp', 1, per * 10);
    expect(alchemyDone(s, per * 10.5)).toBe(2);
  });
  it('대기열은 3칸 (같은 것도 따로), 재료가 모자라면 못 넣음', () => {
    const s = inWorkshop();
    expect(alchemyOrder(s, 'honey_shake', 5, 0).ok).toBe(false);
    for (let i = 0; i < 3; i++) expect(alchemyOrder(s, 'honey_shake', 1, 0).ok).toBe(true);
    expect(alchemyOrder(s, 'honey_shake', 1, 0).ok).toBe(false);
  });
});
