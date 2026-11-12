// 저장소 교체 구조: 지금은 LocalStore(localStorage), 나중에 SupabaseStore
import type { SaveData } from '../sim/save';

export interface Store {
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
  clear(): Promise<void>;
}

export class LocalStore implements Store {
  constructor(private key = 'mgs_phaser_v1') {}
  async load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch { return null; }
  }
  async save(data: SaveData) {
    try { localStorage.setItem(this.key, JSON.stringify(data)); } catch { /* 저장 불가 환경은 무시 */ }
  }
  async clear() {
    try { localStorage.removeItem(this.key); } catch { /* 무시 */ }
  }
}

/** 캐릭터 슬롯 저장소 키 (슬롯마다 따로 저장) */
export const slotKey = (i: number) => `mgs_phaser_v1_s${i}`;

/** 슬롯이 생기기 전 저장(캐릭터 하나)을 1번 슬롯으로 옮김 */
export async function migrateToSlots() {
  const old = new LocalStore(), first = new LocalStore(slotKey(0));
  const data = await old.load();
  if (data && !(await first.load())) await first.save(data);
  if (data) await old.clear();
}

/** 저장이 안 되는 메모리 저장소 (테스트용) */
export class MemoryStore implements Store {
  private data: SaveData | null = null;
  async load() { return this.data; }
  async save(d: SaveData) { this.data = structuredClone(d); }
  async clear() { this.data = null; }
}
