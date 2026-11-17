import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/lab')({
  head: () => seo({ title: 'Brickfray Lab', noindex: true }),
  component: Lab
});

function Lab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mounts the WebGL lab once
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(location.search);
    const quality = (params.get('quality') ?? 'high') as 'low' | 'medium' | 'high';
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('~/brickfray/lab/lab').then(async ({ startLab }) => {
      if (cancelled || !canvasRef.current) return;
      stop = await startLab(canvasRef.current, params.get('scene') ?? 'plaza', quality);
      if (cancelled) stop();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  if (!import.meta.env.DEV) return null;
  return <canvas ref={canvasRef} className='fixed inset-0 h-full w-full touch-none' />;
}
