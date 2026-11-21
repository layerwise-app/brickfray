import { useEffect, useRef, useState } from 'react';
import { AVATAR_MAX_BYTES, AVATAR_PX } from '../../../lib/board/contract';
import { useT } from '../i18n';
import { PendingButton } from './Avatar';

const VIEW = 240;

interface Framing {
  zoom: number;
  /** Center of the square, as a share of the image's width and height. */
  x: number;
  y: number;
}

/** The square cut from the image: side and top-left corner in image pixels. */
function cut(image: ImageBitmap, f: Framing) {
  const side = Math.min(image.width, image.height) / f.zoom;
  const left = Math.min(image.width - side, Math.max(0, f.x * image.width - side / 2));
  const top = Math.min(image.height - side, Math.max(0, f.y * image.height - side / 2));
  return { side, left, top };
}

function draw(canvas: HTMLCanvasElement, image: ImageBitmap, f: Framing, px: number) {
  const ctx = canvas.getContext('2d')!;
  const { side, left, top } = cut(image, f);
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(image, left, top, side, side, 0, 0, px, px);
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The final 128 px square: WebP where the browser can write it, JPEG otherwise, smaller until it fits. */
async function export128(image: ImageBitmap, f: Framing): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = AVATAR_PX;
  draw(canvas, image, f, AVATAR_PX);
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    let blob = await encode(canvas, 'image/webp', quality);
    if (blob?.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= AVATAR_MAX_BYTES) return blob;
  }
  throw new Error('picture too large');
}

/** Frames an uploaded picture: drag to move, zoom to fit, then it is cut to a small square here in the browser. */
export function Crop({ file, pending, onCancel, onDone, onFail }: { file: File; pending: boolean; onCancel: () => void; onDone: (blob: Blob) => void; onFail: () => void }) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [frame, setFrame] = useState<Framing>({ zoom: 1, x: 0.5, y: 0.5 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- decodes the chosen file once; the bitmap is closed on the way out
  useEffect(() => {
    let alive = true;
    let bitmap: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((b) => {
        bitmap = b;
        if (alive) setImage(b);
        else b.close();
      })
      .catch(() => {
        if (alive) onFail();
        onCancel();
      });
    return () => {
      alive = false;
      bitmap?.close();
    };
  }, [file]);

  // Draws the preview canvas (a DOM surface) whenever the framing changes.
  useEffect(() => {
    if (image && canvas.current) draw(canvas.current, image, frame, VIEW * 2);
  }, [image, frame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !image) return;
    const { side } = cut(image, frame);
    const scale = side / VIEW;
    setFrame((f) => ({
      ...f,
      x: Math.min(1, Math.max(0, f.x - ((e.clientX - d.x) * scale) / image.width)),
      y: Math.min(1, Math.max(0, f.y - ((e.clientY - d.y) * scale) / image.height))
    }));
    d.x = e.clientX;
    d.y = e.clientY;
  };

  const finish = async () => {
    if (!image) return;
    try {
      onDone(await export128(image, frame));
    } catch {
      onFail();
    }
  };

  return (
    <div className='bf-board-crop' role='dialog' aria-modal aria-label={t('board.crop')}>
      <div className='bf-panel bf-pop bf-board-crop-box'>
        <h3 className='bf-display text-2xl'>{t('board.crop')}</h3>
        <div
          className='bf-board-crop-frame'
          onPointerDown={(e) => {
            drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <canvas ref={canvas} width={VIEW * 2} height={VIEW * 2} />
        </div>
        <label className='flex w-full items-center gap-3'>
          <span className='text-sm font-semibold'>{t('board.zoom')}</span>
          <input
            type='range'
            className='bf-range'
            min={1}
            max={4}
            step={0.01}
            value={frame.zoom}
            style={{ ['--fill' as string]: `${((frame.zoom - 1) / 3) * 100}%` }}
            onChange={(e) => setFrame({ ...frame, zoom: Number(e.target.value) })}
          />
        </label>
        <div className='flex w-full gap-3'>
          <button className='bf-btn bf-btn-ghost flex-1' onClick={onCancel}>
            <span className='font-bold'>{t('cancel')}</span>
          </button>
          <PendingButton className='bf-btn-primary flex-1' pending={pending} disabled={!image} onClick={() => void finish()}>
            {t('board.usePicture')}
          </PendingButton>
        </div>
      </div>
    </div>
  );
}
