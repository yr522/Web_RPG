import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// client/ 가 화면(Phaser), shared/ 가 게임 로직. 나중에 server/ 도 shared/ 를 같이 쓴다.
export default defineConfig({
  root: 'client',
  base: './',
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  server: { host: true, fs: { allow: ['..'] } },
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
