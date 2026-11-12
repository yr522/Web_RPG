// 캐릭터 선택 화면: 슬롯 3개. 캐릭터를 골라 시작 / 빈 슬롯의 + → 캐릭터 생성 화면
import { CLASSES } from '@shared/data/classes';
import { CHAR_SLOTS } from '@shared/data/account';
import { MAPS } from '@shared/data/maps';
import { LocalStore, slotKey } from '@shared/store/Store';
import { normalizeSave, type SaveData } from '@shared/sim/save';
import { el, esc } from './Dialog';
import { BANNERS, FULL_BANNER, showCreateScreen } from './CreateScreen';

/** 시작할 캐릭터를 고를 때까지 화면을 띄우고, 그 슬롯의 저장소와 저장 데이터를 돌려준다 */
export async function showSelectScreen(): Promise<{ store: LocalStore; save: SaveData }> {
  const stores = Array.from({ length: CHAR_SLOTS }, (_, i) => new LocalStore(slotKey(i)));
  const load = async () => Promise.all(stores.map(async st => { const d = await st.load(); return d ? normalizeSave(d) : null; }));
  let saves = await load();
  let sel = saves.findIndex(s => s);

  for (;;) {
    const r = await new Promise<{ start: number } | { create: number }>(resolve => {
      const root = el('div', 'cs');
      root.appendChild(el('div', 'cs-title', '캐릭터 선택'));
      const slots = el('div', 'cs-slots');
      const btns = el('div', 'cs-btns');
      const start = el('button', 'cs-start', '시작', () => { if (sel >= 0 && saves[sel]) { root.remove(); resolve({ start: sel }); } }) as HTMLButtonElement;
      let asking = false;
      const del = el('button', 'cs-del', '삭제', async () => {
        if (sel < 0 || !saves[sel]) return;
        if (!asking) { asking = true; render(); return; }
        await stores[sel].clear();
        saves = await load();
        sel = saves.findIndex(s => s);
        asking = false;
        render();
      }) as HTMLButtonElement;
      btns.append(start, del);
      root.append(slots, btns);
      document.body.appendChild(root);

      function render() {
        slots.innerHTML = '';
        saves.forEach((s, i) => {
          if (!s) {
            const b = el('button', 'cs-slot empty', '<span class="cs-plus">+</span>', () => { root.remove(); resolve({ create: i }); });
            b.setAttribute('aria-label', '캐릭터 생성');
            slots.appendChild(b);
            return;
          }
          const b = el('button', `cs-slot${i === sel ? ' sel' : ''}`, '', () => { if (sel !== i) { sel = i; asking = false; render(); } });
          b.addEventListener('dblclick', () => { root.remove(); resolve({ start: i }); });
          const img = el('img') as HTMLImageElement;
          img.src = BANNERS[s.cls][s.gender];
          img.alt = '';
          if (FULL_BANNER.includes(s.cls)) img.classList.add('full');
          b.append(img, el('div', 'cs-info', `<div class="cs-name">${esc(s.name)}</div><div class="cs-sub">Lv ${s.level} ${CLASSES[s.cls].name} · ${esc(MAPS[s.map]?.name ?? '')}</div>`));
          slots.appendChild(b);
        });
        const has = sel >= 0 && !!saves[sel];
        start.disabled = !has;
        del.disabled = !has;
        del.textContent = asking ? '정말 삭제' : '삭제';
        del.classList.toggle('ask', asking);
      }
      render();
    });

    if ('start' in r) return { store: stores[r.start], save: saves[r.start]! };
    // 빈 슬롯: 캐릭터 생성 → 만들면 그 슬롯에 저장하고 선택 화면으로
    const made = await showCreateScreen();
    if (made) {
      await stores[r.create].save(made);
      saves = await load();
      sel = r.create;
    }
  }
}
