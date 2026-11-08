// 키보드·터치 입력 → 틱마다 Command 로 변환.
// "새로 눌림"은 다음 틱이 읽어갈 때까지 보관해서, 프레임이 빨라도 느려도 입력이 사라지지 않게 한다.
import { emptyCommand, type Command } from '@shared/sim/types';
import { SLOT_KEYS, type SlotKey } from '@shared/data/classes';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | `skill${SlotKey}` | 'potionHp' | 'potionMp';

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Space: 'jump',
  KeyZ: 'skillZ', KeyA: 'skillA', KeyS: 'skillS', KeyD: 'skillD',
  KeyQ: 'skillQ', KeyW: 'skillW', KeyE: 'skillE',
  Digit1: 'potionHp', Digit2: 'potionMp', Numpad1: 'potionHp', Numpad2: 'potionMp',
};

export class Input {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  /** 키·버튼이 눌리고 떼질 때 (HUD 버튼 눌림 표시용) */
  onChange: (a: Action, down: boolean) => void = () => {};
  /** 키보드 단축키 (C 캐릭터 창 등) */
  onHotkey: (code: string) => void = () => {};

  constructor() {
    addEventListener('keydown', e => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      const a = KEYMAP[e.code];
      if (this._blocked) return;
      if (a) {
        e.preventDefault();
        if (!e.repeat) this.set(a, true);
        return;
      }
      if (!e.repeat) this.onHotkey(e.code);
    });
    addEventListener('keyup', e => {
      const a = KEYMAP[e.code];
      if (a) { e.preventDefault(); this.set(a, false); }
    });
    const releaseAll = () => { for (const a of [...this.held]) this.set(a, false); };
    addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', releaseAll);
  }

  set(a: Action, down: boolean) {
    if (down && this._blocked) return;
    if (down === this.held.has(a)) return;
    if (down) { this.held.add(a); this.pressed.add(a); } else this.held.delete(a);
    this.onChange(a, down);
  }

  isHeld(a: Action) { return this.held.has(a); }

  private _blocked = false;
  /** 창이 열려 있는 동안 게임 입력을 막는다 */
  set blocked(v: boolean) {
    this._blocked = v;
    if (v) { for (const a of [...this.held]) this.set(a, false); this.pressed.clear(); }
  }
  get blocked() { return this._blocked; }

  /** 틱마다 한 번 호출 */
  readCommand(): Command {
    const h = this.held, p = this.pressed;
    const c = emptyCommand();
    c.move = ((h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0)) as -1 | 0 | 1;
    c.up = h.has('up');
    c.down = h.has('down');
    c.jumpPressed = p.has('jump');
    c.upPressed = p.has('up');
    c.skillPressed = SLOT_KEYS.filter(k => p.has(`skill${k}`));
    if (p.has('potionHp')) c.potionPressed.push('hp');
    if (p.has('potionMp')) c.potionPressed.push('mp');
    p.clear();
    return c;
  }
}
