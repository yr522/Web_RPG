// 아이템 (기획서 7장). 상점 물건, 몬스터 드롭, 장비가 전부 여기 있다.
import type { StatId } from './classes';

/** 인벤토리 탭 종류 */
export type ItemKind = 'equip' | 'use' | 'etc';
export const ITEM_TABS: { id: 'all' | ItemKind; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'equip', label: '장비' },
  { id: 'use', label: '소비' },
  { id: 'etc', label: '기타' },
];

/** 장비 칸 (반지는 2칸) */
export type EquipSlot = 'hat' | 'ring1' | 'necklace' | 'weapon' | 'ring2' | 'top' | 'gloves' | 'bottom' | 'shoes';
export const EQUIP_SLOTS: Record<EquipSlot, string> = {
  hat: '모자', ring1: '반지1', necklace: '목걸이', weapon: '무기', ring2: '반지2', top: '상의', gloves: '장갑', bottom: '하의', shoes: '신발',
};
/** 아이템에 적는 장비 부위 (반지는 반지1·반지2 아무 칸에나) */
export type EquipPart = Exclude<EquipSlot, 'ring1' | 'ring2'> | 'ring';

export interface ItemDef {
  name: string;
  kind: ItemKind;
  desc: string;
  /** 그림이 없을 때 대신 보여 줄 글자 아이콘 */
  icon: string;
  /** 그림 파일 (assets/img/icon/ 아래 경로, 확장자 .png 빼고). 파일이 없으면 icon 을 쓴다 */
  img?: string;
  /** 매점 가격 (없으면 매점에서 안 팖) */
  price?: number;
  /** 매점에서 한 번에 살 수 있는 개수 */
  bulk?: number[];
  /** 장비 부위와 능력치 */
  part?: EquipPart;
  bonus?: Partial<Record<StatId, number>>;
}

const ARMOR_IMG = 'equipment/armor/test_armor_icon';
const testEquip = (name: string, part: EquipPart): ItemDef => ({
  name, kind: 'equip', desc: '근력 +1', icon: '🛡️', img: ARMOR_IMG, price: 100, bulk: [1], part, bonus: { str: 1 },
});

const ITEM_LIST = {
  hp: { name: 'HP 포션', kind: 'use', icon: '🧪', price: 30, desc: 'HP 50 회복 (1번 키)', bulk: [1, 10] },
  mp: { name: 'MP 포션', kind: 'use', icon: '💧', price: 30, desc: 'MP 40 회복 (2번 키)', bulk: [1, 10] },
  reset: { name: '스킬트리 초기화 주문서', kind: 'use', icon: '📜', price: 1000, desc: '배운 스킬을 모두 초기화. 교수님께 원소를 다시 골라 배울 수 있어. 스킬 레벨은 유지돼.', bulk: [1] },
  slime_gel: { name: '슬라임 점액', kind: 'etc', icon: '🟢', img: 'item/a_001_slime_fluid', desc: '슬라임에게서 얻은 끈적한 점액' },
  // 테스트용 장비 (매점 모리)
  test_hat: testEquip('테스트 모자', 'hat'),
  test_necklace: testEquip('테스트 목걸이', 'necklace'),
  test_weapon: testEquip('테스트 무기', 'weapon'),
  test_top: testEquip('테스트 상의', 'top'),
  test_gloves: testEquip('테스트 장갑', 'gloves'),
  test_bottom: testEquip('테스트 하의', 'bottom'),
  test_shoes: testEquip('테스트 신발', 'shoes'),
  test_ring: { name: '테스트 반지', kind: 'equip', desc: '모든 능력치 +1', icon: '💍', img: ARMOR_IMG, price: 200, bulk: [1], part: 'ring', bonus: { str: 1, dex: 1, int: 1 } },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEM_LIST;
export const ITEMS: Record<ItemId, ItemDef> = ITEM_LIST;
export const itemDef = (id: string): ItemDef | undefined => (ITEMS as Record<string, ItemDef>)[id];

/** 매점 모리가 파는 물건 (보이는 순서) */
export const SHOP_ITEMS: ItemId[] = [
  'hp', 'mp', 'reset',
  'test_hat', 'test_necklace', 'test_weapon', 'test_top', 'test_gloves', 'test_bottom', 'test_shoes', 'test_ring',
];

/** 처음 시작할 때 가진 물건 */
export const START_ITEMS: { id: ItemId; n: number }[] = [{ id: 'hp', n: 3 }, { id: 'mp', n: 3 }];

export const POTION = { hp: 50, mp: 40, cooldown: 0.8 };
