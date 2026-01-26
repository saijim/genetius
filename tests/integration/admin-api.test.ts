import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext, MiddlewareHandler } from 'astro';
import { db, refreshLogs, eq } from 'astro:db'; // This will resolve to our mock

// 'astro:db' is now mocked via alias in vitest.config.ts, so we don't need vi.mock('astro:db') here
// But we still need to import from it.

// Mock the paper-fetch orchestration
vi.mock('~/lib/paper-fetch', () => ({
  fetchPapersOrchestration: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock environment variables for auth
vi.stubEnv('ADMIN_USER', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'secret');

// Import modules AFTER mocking
import { POST as resetStatusPost } from '~/pages/admin/api/reset-status';
import { POST as refreshPost } from '~/pages/admin/api/refresh';
import { onRequest as middleware } from '~/middleware';
import { fetchPapersOrchestration } from '~/lib/paper-fetch';

// Helper to get mocked db functions
const getMockDb = () => db as unknown as { update: any };

describe('Admin API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default success behavior for update
    getMockDb().update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowsAffected: 1 })
      })
    });
  });

  describe('Authentication (Middleware)', () => {
    // Helper to run middleware
    const runMiddleware = async (pathname: string, authHeader: string | null) => {
      const context = {
        url: { pathname },
        request: {
          headers: {
            get: (key: string) => (key === 'Authorization' ? authHeader : null),
          },
        },
      } as any;

      const next = vi.fn().mockResolvedValue(new Response('OK'));
      const response = await (middleware as MiddlewareHandler)(context, next);
      
      // If middleware calls next(), it returns the result of next()
      // If it blocks, it returns its own response
      return { response, next };
    };

    it('should block access to /admin/api endpoints without credentials', async () => {
      const { response, next } = await runMiddleware('/admin/api/reset-status', null);
      
      expect(next).not.toHaveBeenCalled();
      if (!(response instanceof Response)) throw new Error('Expected Response');
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe('Basic realm="Genetius"');
    });

    it('should block access with invalid credentials', async () => {
      const badAuth = 'Basic ' + btoa('wrong:pass');
      const { response, next } = await runMiddleware('/admin/api/refresh', badAuth);

      expect(next).not.toHaveBeenCalled();
      if (!(response instanceof Response)) throw new Error('Expected Response');
      expect(response.status).toBe(401);
    });

    it('should allow access with valid credentials', async () => {
      // Credentials must match what is defined in vitest.config.ts
      // vitest.config.ts defines import.meta.env.ADMIN_PASSWORD as 'password' by default
      const credentials = 'admin:password';
      const encoded = Buffer.from(credentials).toString('base64');
      const validAuth = `Basic ${encoded}`;
      
      const { response, next } = await runMiddleware('/admin/api/refresh', validAuth);
      
      expect(next).toHaveBeenCalled();
      if (!(response instanceof Response)) throw new Error('Expected Response');
      const text = await response.text();
      expect(text).toBe('OK');
    });
  });

  describe('Endpoint: /admin/api/reset-status', () => {
    it('should update stuck "in_progress" logs to "interrupted"', async () => {
      const request = new Request('http://localhost/admin/api/reset-status', {
        method: 'POST',
      });
      
      const response = await resetStatusPost({ request } as APIContext);
      const data = await response.json();

      expect(db.update).toHaveBeenCalledWith(refreshLogs);
      // We can't easily inspect the chain, but we know our mock returns success
      expect(eq).toHaveBeenCalledWith(refreshLogs.status, 'in_progress');
      expect(data).toEqual({ success: true, rowsAffected: 1 });
      expect(response.status).toBe(200);
    });

    it('should handle database errors gracefully', async () => {
      // Force an error
      getMockDb().update.mockImplementationOnce(() => {
        throw new Error('DB Connection Failed');
      });

      const request = new Request('http://localhost/admin/api/reset-status', {
        method: 'POST',
      });
      
      const response = await resetStatusPost({ request } as APIContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to reset status' });
    });
  });

  describe('Endpoint: /admin/api/refresh', () => {
    it('should trigger paper fetch with default params', async () => {
      const formData = new FormData(); // Empty form data
      const request = new Request('http://localhost/admin/api/refresh', {
        method: 'POST',
        body: formData,
      });

      const response = await refreshPost({ request } as APIContext);
      const data = await response.json();

      expect(fetchPapersOrchestration).toHaveBeenCalledWith(undefined);
      expect(data.success).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should trigger paper fetch with specific daysBack', async () => {
      const formData = new FormData();
      formData.append('daysBack', '7');
      
      const request = new Request('http://localhost/admin/api/refresh', {
        method: 'POST',
        body: formData,
      });

      const response = await refreshPost({ request } as APIContext);
      
      expect(fetchPapersOrchestration).toHaveBeenCalledWith(7);
      expect(response.status).toBe(200);
    });

    it('should return 500 if orchestration fails', async () => {
      vi.mocked(fetchPapersOrchestration).mockResolvedValueOnce(new Error('API Rate Limit'));
      
      const formData = new FormData();
      const request = new Request('http://localhost/admin/api/refresh', {
        method: 'POST',
        body: formData,
      });

      const response = await refreshPost({ request } as APIContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Refresh failed');
    });
  });
});
