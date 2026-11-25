// 머리 부분만 잘라 낸 작은 그림 (장비창 Looks 칸·성형 창). 그림을 다 읽으면 done() 을 부름
import type { ClassId } from '@shared/data/classes';
import type { FaceId } from '@shared/data/looks';
import { FACE_FILES, LOOKS, PART_FILES } from '../scenes/PlayerAvatar';
import { SKIN, eyeCanvas, skinCanvas } from '../scenes/skin';

/** 기본 자세 첫 칸에서 머리 자리 */
const HEAD_CROP = { x: 28, y: 38, size: 40 };
const cache = new Map<string, string>();
const load = (src: string) => new Promise<HTMLImageElement>(res => { const im = new Image(); im.onload = () => res(im); im.src = src; });

/** what: 'hair' = 앞머리만, 얼굴 = 피부색 머리 + 얼굴 + 눈동자. 아직이면 null (다 되면 done) */
export function headIcon(cls: ClassId, what: 'hair' | { face: FaceId; eye?: string }, done: () => void): string | null {
  const hair = LOOKS[cls]?.hair;
  if (what === 'hair' && !hair) return null;
  const key = what === 'hair' ? `${cls}:hair` : `${cls}:${what.face}:${what.eye ?? ''}`;
  const got = cache.get(key);
  if (got !== undefined) return got || null;
  cache.set(key, '');
  const srcs = what === 'hair' ? [hair!] : [PART_FILES.head, FACE_FILES[what.face].face, FACE_FILES[what.face].eyes];
  void Promise.all(srcs.map(load)).then(ims => {
    const { x, y, size } = HEAD_CROP, c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ims.forEach((im, i) => {
      let src: CanvasImageSource = im;
      if (what !== 'hair' && i === 0 && SKIN[cls]) src = skinCanvas(im, SKIN[cls]!);
      if (what !== 'hair' && i === 2 && what.eye) src = eyeCanvas(im, what.eye);
      ctx.drawImage(src, x, y, size, size, 0, 0, size, size);
    });
    cache.set(key, c.toDataURL());
    done();
  });
  return null;
}
