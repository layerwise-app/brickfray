import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { seo } from '~/utils/seo';

const App = lazy(() => import('~/brickfray/ui/App'));

/**
 * The game fills the screen edge to edge (the HUD keeps clear of notches through safe-area insets), never zooms, and
 * can be added to a phone's home screen to play without browser bars.
 */
const gameShell = [
  { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
  { name: 'theme-color', content: '#0b1222' },
  { name: 'mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
];

export const Route = createFileRoute('/')({
  head: () => {
    const head = seo({
      title: 'Brickfray — Small bricks. Big battles.',
      description:
        'An original brick-built online FPS. Battle with up to 10 players or survive waves of Snapbots in colorful arenas.',
      path: '/'
    });
    return { ...head, meta: [...head.meta, ...gameShell] };
  },
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
