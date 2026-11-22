import { createFileRoute, redirect } from '@tanstack/react-router';

// Left from the starter template: the game signs in with an email code from its own profile menu (/api/auth), so
// nothing links here; an old bookmark lands on the game.
export const Route = createFileRoute('/sign-up')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  }
});
