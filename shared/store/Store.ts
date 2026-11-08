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

/** 저장이 안 되는 메모리 저장소 (테스트용) */
export class MemoryStore implements Store {
  private data: SaveData | null = null;
  async load() { return this.data; }
  async save(d: SaveData) { this.data = structuredClone(d); }
  async clear() { this.data = null; }
}
