// 아이템 (기획서 7장). 상점 물건, 몬스터 드롭, 장비가 전부 여기 있다.
import type { StatId } from './classes';

/**
 * 장비가 올려 주는 값 (기본 능력치·부가효과 공통). 공격력·방어력은 장비로만.
 * crit·mpCost·speed·boss·mob 은 %, hpRegen 은 초당
 */
export type BonusId = StatId | 'atk' | 'def' | 'hp' | 'mp' | 'crit' | 'mpCost' | 'speed' | 'hpRegen' | 'boss' | 'mob';
export const BONUS_NAMES: Record<BonusId, string> = {
  str: '근력', dex: '민첩', int: '지능', atk: '공격력', def: '방어력', hp: '최대 HP', mp: '최대 MP',
  crit: '치명타 확률', mpCost: 'MP 소모 감소', speed: '이동속도', hpRegen: 'HP 회복', boss: '보스 피해', mob: '일반몹 피해',
};
const PCT: BonusId[] = ['crit', 'mpCost', 'speed', 'boss', 'mob'];
const num = (v: number) => String(Math.round(v * 10) / 10);
/** '방어력 +5' · '치명타 확률 +3%' · 'HP 회복 +0.4/초' */
export const bonusLine = (k: BonusId, v: number) => `${BONUS_NAMES[k]} +${num(v)}${PCT.includes(k) ? '%' : k === 'hpRegen' ? '/초' : ''}`;
/** '근력 +1 · 방어력 +5' */
export const bonusText = (b: Partial<Record<BonusId, number>>) =>
  (Object.keys(b) as BonusId[]).map(k => bonusLine(k, b[k] ?? 0)).join(' · ');

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

/** 장비 등급 (장비에만, 일반 아이템은 없음). 이름·칸 테두리 색 */
export type Grade = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const GRADES: Record<Grade, { name: string; color: string }> = {
  common: { name: 'Common', color: '#e8e8e8' },
  rare: { name: 'Rare', color: '#4aa8ff' },
  epic: { name: 'Epic', color: '#b46cff' },
  legendary: { name: 'Legendary', color: '#ffb02e' },
  mythic: { name: 'Mythic', color: '#ff4a5a' },
};
/** 장비 등급 (등급을 안 적은 장비는 커먼, 장비가 아니면 null) */
export const itemGrade = (d: ItemDef | undefined): Grade | null => (d?.kind === 'equip' ? d.grade ?? 'common' : null);

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
  /** 매점에 팔 때 받는 값 (없으면 가격 × SELL_RATE, 가격도 없으면 못 팖) */
  sell?: number;
  /** 매점에서 한 번에 살 수 있는 개수 */
  bulk?: number[];
  /** 장비 부위와 능력치 */
  part?: EquipPart;
  bonus?: Partial<Record<BonusId, number>>;
  /** 장비 등급 (장비만) */
  grade?: Grade;
}

const ARMOR_IMG = 'equipment/armor/test_armor_icon';
const testEquip = (name: string, part: EquipPart): ItemDef => {
  const bonus = part === 'weapon' ? { str: 1, atk: 5 } : { str: 1, def: 5 };
  return { name, kind: 'equip', desc: bonusText(bonus), icon: '🛡️', img: ARMOR_IMG, price: 100, bulk: [1], part, bonus };
};

const gradeWeapon = (grade: Grade, n: number): ItemDef => {
  const bonus = { str: n, atk: n * 3 };
  return { name: `${GRADES[grade].name} 테스트 무기`, kind: 'equip', desc: bonusText(bonus), icon: '🗡️', img: ARMOR_IMG, price: 100, bulk: [1], part: 'weapon', bonus, grade };
};

/**
 * 포션 5단계. id 순서 = 작은 것부터 (1·2번 키는 가진 것 중 가장 작은 것부터 씀).
 * hp·mp 는 예전 포션 id 그대로 (= 소형). 그림: assets/img/icon/item/potion/red_* · blue_*
 */
export const POTION_TIERS = [
  { suffix: '', name: '소형', img: 'small', hp: 50, mp: 40, price: 30 },
  { suffix: '_ms', name: '중소형', img: 'small_plus', hp: 120, mp: 100, price: 80 },
  { suffix: '_m', name: '중형', img: 'medium', hp: 250, mp: 200, price: 180 },
  { suffix: '_l', name: '대형', img: 'medium_plus', hp: 500, mp: 400, price: 400 },
  { suffix: '_xl', name: '초대형', img: 'large', hp: 1000, mp: 800, price: 900 },
] as const;
export type PotionKind = 'hp' | 'mp';
/** 포션 id → 종류·회복량 */
export const POTIONS: Record<string, { kind: PotionKind; amount: number }> = {};
for (const t of POTION_TIERS) for (const k of ['hp', 'mp'] as const) POTIONS[k + t.suffix] = { kind: k, amount: t[k] };
/** 종류별 포션 id (작은 것부터) */
export const potionIds = (k: PotionKind) => POTION_TIERS.map(t => k + t.suffix);

function potionItems() {
  const out: Record<string, ItemDef> = {};
  for (const t of POTION_TIERS) {
    out['hp' + t.suffix] = { name: `${t.name} HP 포션`, kind: 'use', icon: '🧪', img: `item/potion/red_${t.img}`, price: t.price, desc: `HP ${t.hp} 회복 (1번 키)`, bulk: [1, 10] };
    out['mp' + t.suffix] = { name: `${t.name} MP 포션`, kind: 'use', icon: '💧', img: `item/potion/blue_${t.img}`, price: t.price, desc: `MP ${t.mp} 회복 (2번 키)`, bulk: [1, 10] };
  }
  return out as Record<'hp' | 'mp' | 'hp_ms' | 'mp_ms' | 'hp_m' | 'mp_m' | 'hp_l' | 'mp_l' | 'hp_xl' | 'mp_xl', ItemDef>;
}

const ITEM_LIST = {
  // 포션 5단계 (소형 → 초대형). 회복량·가격은 POTIONS 표에서
  ...potionItems(),
  reset: { name: '스킬트리 초기화 주문서', kind: 'use', icon: '📜', price: 1000, desc: '배운 스킬을 모두 초기화. 교수님께 원소를 다시 골라 배울 수 있어. 스킬 레벨은 유지돼.', bulk: [1] },
  test_letter: { name: '테스트 편지', kind: 'etc', icon: '✉️', desc: '이야기 테스트용 편지' },
  workshop_key: { name: '공방 퀘스트 템', kind: 'etc', icon: '⚙️', img: 'item/quest/workshop_key', desc: '임시' },
  slime_gel: { name: '슬라임 점액', kind: 'etc', icon: '🟢', img: 'item/material/a_001_slime_fluid', desc: '슬라임에게서 얻은 끈적한 점액', sell: 1 },
  // 영주님의 생일잔치 (2026-11-21, 설명·판매가 임시)
  // 일일 퀘스트 보상 (2026-11-21). 나중에 주화 상점 등에 씀. 팔 수 없음
  mission_coin: { name: '미션 주화', kind: 'etc', icon: '🪙', desc: '일일 퀘스트를 끝내고 받은 주화' },
  // 대장장이 제작 (2026-11-21, 이름·가격 임시). 형판은 대장장이가 팔고, 제작할 때 하나씩 씀
  mold_rusty: { name: '녹슨 주괴 형판', kind: 'etc', icon: '🧱', price: 30, desc: '녹슨 고철을 녹여 주괴로 굳히는 틀 (제작할 때 하나씩 씀)', bulk: [1, 10] },
  mold_iron: { name: '철 주괴 형판', kind: 'etc', icon: '🧱', price: 100, desc: '쓸만한 고철을 녹여 철 주괴로 굳히는 틀 (제작할 때 하나씩 씀)', bulk: [1, 10] },
  ingot_rusty: { name: '녹슨 주괴', kind: 'etc', icon: '🟫', desc: '녹슨 고철을 녹여 만든 주괴. 강화 재료 (+0 ~ +9)', sell: 180 },
  ingot_iron: { name: '철 주괴', kind: 'etc', icon: '⬜', desc: '쓸만한 고철을 녹여 만든 주괴. 강화(+10 이상)·수리 재료', sell: 600 },
  honey: { name: '꿀', kind: 'etc', icon: '🍯', img: 'item/material/honey', desc: '꿀 슬라임에게서 얻은 달콤한 꿀', sell: 2 },
  scrap_rusty: { name: '녹슨 고철', kind: 'etc', icon: '🔩', img: 'item/material/bad_slate', desc: '경비기계에서 떨어진 녹슨 쇳조각', sell: 5 },
  scrap_good: { name: '쓸만한 고철', kind: 'etc', icon: '⚙️', img: 'item/material/good_slate', desc: '경비기계에서 떨어진 아직 쓸 만한 쇳조각', sell: 30 },
  // 테스트용 장비 (매점 모리)
  test_hat: testEquip('테스트 모자', 'hat'),
  test_necklace: testEquip('테스트 목걸이', 'necklace'),
  test_weapon: testEquip('테스트 무기', 'weapon'),
  test_top: testEquip('테스트 상의', 'top'),
  test_gloves: testEquip('테스트 장갑', 'gloves'),
  test_bottom: testEquip('테스트 하의', 'bottom'),
  test_shoes: testEquip('테스트 신발', 'shoes'),
  // 등급 테스트용 무기 (등급마다 1개)
  grade_common: gradeWeapon('common', 1),
  grade_rare: gradeWeapon('rare', 2),
  grade_epic: gradeWeapon('epic', 3),
  grade_legendary: gradeWeapon('legendary', 4),
  grade_mythic: gradeWeapon('mythic', 5),
  // 슬라임류(슬라임·원소 슬라임) 드롭 장비
  slime_armor: { name: '슬라임 갑옷', kind: 'equip', desc: bonusText({ def: 4, hp: 10 }), icon: '🛡️', img: 'equipment/armor/slime_armor', part: 'top', bonus: { def: 4, hp: 10 }, sell: 100 },
  slime_ring: { name: '슬라임 반지', kind: 'equip', desc: bonusText({ hp: 15, mp: 10 }), icon: '💍', img: 'equipment/ring/slime_ring', part: 'ring', bonus: { hp: 15, mp: 10 }, sell: 100 },
  test_ring: { name: '테스트 반지', kind: 'equip', desc: '모든 능력치 +1', icon: '💍', img: ARMOR_IMG, price: 200, bulk: [1], part: 'ring', bonus: { str: 1, dex: 1, int: 1 } },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEM_LIST;
export const ITEMS: Record<ItemId, ItemDef> = ITEM_LIST;
export const itemDef = (id: string): ItemDef | undefined => (ITEMS as Record<string, ItemDef>)[id];

/** 매점에 팔 때: 산 값의 이만큼 (2026-11-18 유저 결정 50%) */
export const SELL_RATE = 0.5;
/** 매점에 팔 때 받는 값 (0 = 못 팖: 퀘스트 물건 등). 강화·옵션은 값에 안 들어감 */
export function sellPrice(id: string) {
  const d = itemDef(id);
  if (!d) return 0;
  if (d.sell !== undefined) return d.sell;
  return d.price ? Math.floor(d.price * SELL_RATE) : 0;
}

/** 매점 모리가 파는 물건 (보이는 순서) */
export const SHOP_ITEMS: ItemId[] = [
  'hp', 'hp_ms', 'hp_m', 'hp_l', 'hp_xl', 'mp', 'mp_ms', 'mp_m', 'mp_l', 'mp_xl', 'reset',
  'test_hat', 'test_necklace', 'test_weapon', 'test_top', 'test_gloves', 'test_bottom', 'test_shoes', 'test_ring',
  'grade_common', 'grade_rare', 'grade_epic', 'grade_legendary', 'grade_mythic',
];

/** 처음 시작할 때 가진 물건 */
export const START_ITEMS: { id: ItemId; n: number }[] = [{ id: 'hp', n: 3 }, { id: 'mp', n: 3 }];

/** 가방 칸 수 (4칸 × 15줄). 장비는 1칸에 1개, 나머지는 같은 것끼리 1칸 */
export const BAG_SIZE = 60;
/** 창고 칸 수 (개인 창고·공용 창고 각각, 2026-11-21 임시) */
export const STORAGE_SIZE = 40;

export const POTION = { cooldown: 0.8 };
