// 빌드할 때만: 큰 그림(배경·배너·포트레이트 등 1MB 이상 PNG)을 WebP 로 바꿔서 dist 에 넣음 (2026-11-22).
// assets/ 의 원본 PNG 는 그대로. 작은 그림(스프라이트·아이콘·이펙트)은 PNG 그대로 둠 (칸 경계가 번지지 않게)
import sharp from 'sharp';
import type { Plugin } from 'vite';

const MIN_BYTES = 1_000_000;
const QUALITY = 90;

export function webpBig(): Plugin {
  return {
    name: 'webp-big',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_opts, bundle) {
      const renamed = new Map<string, string>();
      for (const [key, item] of Object.entries(bundle)) {
        if (item.type !== 'asset' || !key.endsWith('.png')) continue;
        const src = Buffer.from(item.source as Uint8Array);
        if (src.length < MIN_BYTES) continue;
        const out = await sharp(src).webp({ quality: QUALITY, alphaQuality: 100, effort: 5 }).toBuffer();
        if (out.length >= src.length) continue;
        const name = key.replace(/\.png$/, '.webp');
        delete bundle[key];
        bundle[name] = { ...item, fileName: name, names: item.names?.map(n => n.replace(/\.png$/, '.webp')), source: out };
        renamed.set(key.split('/').pop()!, name.split('/').pop()!);
      }
      // 코드·CSS 안의 파일 이름도 바꿈
      for (const item of Object.values(bundle)) {
        const isCode = item.type === 'chunk';
        if (!isCode && !(item.fileName.endsWith('.css') || item.fileName.endsWith('.html'))) continue;
        let text = isCode ? item.code : String(item.source);
        let changed = false;
        for (const [from, to] of renamed) if (text.includes(from)) { text = text.split(from).join(to); changed = true; }
        if (!changed) continue;
        if (isCode) item.code = text; else item.source = text;
      }
    },
  };
}
