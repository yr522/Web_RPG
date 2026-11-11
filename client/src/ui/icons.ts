// 아이템 아이콘 그림. assets/img/icon/ 아래 png 를 전부 불러 두고, 아이템의 img 경로로 찾는다.
// 그림 파일이 아직 없으면 아이템의 글자 아이콘(이모지)을 대신 보여 준다.
import { itemDef } from '@shared/data/items';

const files = import.meta.glob('../../../assets/img/icon/**/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const PREFIX = '../../../assets/img/icon/';

/** 'equipment/armor/test_armor_icon' → 그림 주소 */
export const ICON_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) ICON_URLS[path.slice(PREFIX.length, -4)] = url;

export function iconUrl(id: string): string | null {
  const img = itemDef(id)?.img;
  return (img && ICON_URLS[img]) || null;
}

/** 아이콘 하나 (그림 또는 이모지) */
export function itemIcon(id: string): HTMLElement {
  const url = iconUrl(id);
  if (url) {
    const img = document.createElement('img');
    img.className = 'item-ico';
    img.src = url;
    img.alt = itemDef(id)?.name ?? id;
    img.draggable = false;
    return img;
  }
  const span = document.createElement('span');
  span.className = 'item-ico emoji';
  span.textContent = itemDef(id)?.icon ?? '?';
  return span;
}
