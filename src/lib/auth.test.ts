import { describe, it, expect } from 'vitest';
import { validateAuth, type AuthContext } from './auth';

describe('validateAuth', () => {
  const adminUser = 'admin';
  const adminPassword = 'password';

  it('should allow request to proceed for non-admin routes', () => {
    const context: AuthContext = {
      pathname: '/',
      authHeader: null,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(true);
  });

  it('should allow request to proceed for valid admin credentials', () => {
    const credentials = btoa('admin:password');
    const context: AuthContext = {
      pathname: '/admin',
      authHeader: `Basic ${credentials}`,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(true);
  });

  it('should return 401 for missing Authorization header on admin route', () => {
    const context: AuthContext = {
      pathname: '/admin',
      authHeader: null,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.body).toBe('Unauthorized');
    expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="Genetius"');
  });

  it('should return 401 for invalid Authorization header format on admin route', () => {
    const context: AuthContext = {
      pathname: '/admin',
      authHeader: 'Bearer token',
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="Genetius"');
  });

  it('should return 401 for wrong username', () => {
    const credentials = btoa('wrong:password');
    const context: AuthContext = {
      pathname: '/admin',
      authHeader: `Basic ${credentials}`,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="Genetius"');
  });

  it('should return 401 for wrong password', () => {
    const credentials = btoa('admin:wrong');
    const context: AuthContext = {
      pathname: '/admin',
      authHeader: `Basic ${credentials}`,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="Genetius"');
  });

  it('should return 401 for empty credentials', () => {
    const credentials = btoa(':');
    const context: AuthContext = {
      pathname: '/admin',
      authHeader: `Basic ${credentials}`,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="Genetius"');
  });

  it('should allow access to /admin/refresh with valid credentials', () => {
    const credentials = btoa('admin:password');
    const context: AuthContext = {
      pathname: '/admin/refresh',
      authHeader: `Basic ${credentials}`,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(true);
  });

  it('should handle credentials without colon', () => {
    const credentials = btoa('adminpassword');
    const context: AuthContext = {
      pathname: '/admin',
      authHeader: `Basic ${credentials}`,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="Genetius"');
  });

  it('should handle path with /admin prefix', () => {
    const context: AuthContext = {
      pathname: '/something/admin',
      authHeader: null,
    };

    const result = validateAuth(context, adminUser, adminPassword);
    expect(result.success).toBe(true);
  });
});
