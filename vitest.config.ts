import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// 게임 규칙 자동 테스트 (tests/). 화면 없이 shared/ 만 돌린다.
export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'] },
});
