import { createFileRoute } from '@tanstack/react-router';
import { db } from '~/db';
import { readAvatar } from '~/lib/board/avatar';

// Each upload gets a new id, so a picture at one URL never changes and can be cached for good.
export const Route = createFileRoute('/api/board/avatar/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const avatar = /^[A-Za-z0-9_-]{16,64}$/.test(params.id) ? await readAvatar(db, params.id) : null;
        if (!avatar) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
        return new Response(avatar.bytes, {
          headers: {
            'content-type': avatar.mime,
            'cache-control': 'public, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'"
          }
        });
      }
    }
  }
});
