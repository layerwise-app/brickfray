import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { seo } from '~/utils/seo';

const App = lazy(() => import('~/brickfray/ui/App'));

export const Route = createFileRoute('/')({
  head: () =>
    seo({
      title: 'Brickfray — Small bricks. Big battles.',
      description:
        'An original brick-built online FPS. Battle with up to 10 players or survive waves of Snapbots in colorful arenas.',
      path: '/'
    }),
  component: Home
});

function Splash() {
  return (
    <div className='fixed inset-0 grid place-items-center bg-[#0b1222]'>
      <div className='h-12 w-12 animate-bounce rounded-xl bg-[#ffcd2e] shadow-[inset_0_-5px_0_#c98f00]' />
    </div>
  );
}

function Home() {
  return (
    <ClientOnly fallback={<Splash />}>
      <Suspense fallback={<Splash />}>
        <App />
      </Suspense>
    </ClientOnly>
  );
}
