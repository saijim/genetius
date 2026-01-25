import { defineMiddleware } from 'astro:middleware';
import { validateAuth } from '~/lib/auth';

const ADMIN_USER = import.meta.env.ADMIN_USER || process.env.ADMIN_USER;
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  throw new Error('ADMIN_USER and ADMIN_PASSWORD environment variables must be set');
}

export const onRequest = defineMiddleware((context, next) => {
  const { url, request } = context;

  const authResult = validateAuth(
    {
      pathname: url.pathname,
      authHeader: request.headers.get('Authorization'),
    },
    ADMIN_USER,
    ADMIN_PASSWORD
  );

  if (!authResult.success) {
    return new Response(authResult.body, {
      status: authResult.status,
      headers: authResult.headers,
    });
  }

  return next();
});
