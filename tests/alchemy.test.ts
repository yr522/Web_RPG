import { describe, expect, it } from 'vitest';
import { ALCHEMY } from '../shared/data/alchemy';
import { addItem, countItem } from '../shared/rules/inventory';
import { alchemyMax, alchemyOrder, alchemyTick } from '../shared/rules/alchemy';
import { newSave } from '../shared/sim/save';

const per = ALCHEMY.time * 1000;
function inWorkshop() {
  const s = newSave('t', 'warrior', 'M');
  s.map = 'my_workshop';
  addItem(s, 'slime_gel', 5);
  addItem(s, 'honey', 10);
  return s;
}

describe('연금술', () => {
  it('최대 개수 = 재료가 허락하는 만큼', () => {
    const s = inWorkshop();
    expect(alchemyMax(s, 'hp')).toBe(5);
    expect(alchemyMax(s, 'honey_shake')).toBe(5);
  });
  it('개인 공방 밖에서는 못 만듦', () => {
    const s = inWorkshop();
    s.map = 'school';
    expect(alchemyOrder(s, 'hp', 1, 0).ok).toBe(false);
  });
  it('재료를 개수만큼 가져가고 시간에 맞춰 한 개씩 가방에', () => {
    const s = inWorkshop();
    const hp0 = countItem(s, 'hp');
    expect(alchemyOrder(s, 'hp', 2, 0).ok).toBe(true);
    expect(countItem(s, 'slime_gel')).toBe(3);
    expect(countItem(s, 'honey')).toBe(8);
    alchemyTick(s, per - 1);
    expect(countItem(s, 'hp')).toBe(hp0);
    alchemyTick(s, per);
    expect(countItem(s, 'hp')).toBe(hp0 + 1);
    alchemyTick(s, per * 5);
    expect(countItem(s, 'hp')).toBe(hp0 + 2);
    expect(s.alchemy.queue).toHaveLength(0);
  });
  it('대기열은 3칸 (같은 것도 따로), 재료가 모자라면 못 넣음', () => {
    const s = inWorkshop();
    expect(alchemyOrder(s, 'honey_shake', 6, 0).ok).toBe(false);
    for (let i = 0; i < 3; i++) expect(alchemyOrder(s, 'honey_shake', 1, 0).ok).toBe(true);
    expect(alchemyOrder(s, 'honey_shake', 1, 0).ok).toBe(false);
  });
});
