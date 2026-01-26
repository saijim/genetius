import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface AuthContext {
  pathname: string;
  authHeader: string | null;
}

export interface AuthResult {
  success: boolean;
  headers?: Record<string, string>;
  status?: number;
  body?: string;
}

export function validateAuth(
  context: AuthContext,
  adminUser: string,
  adminPassword: string
): AuthResult {
  // Strict check: strictly /admin or /admin/...
  // This prevents /adminapi or other partial matches from being accidentally protected (or excluded if logic was inverted)
  if (context.pathname !== '/admin' && !context.pathname.startsWith('/admin/')) {
    return { success: true };
  }

  if (!context.authHeader || !context.authHeader.startsWith('Basic ')) {
    return {
      success: false,
      status: 401,
      body: 'Unauthorized',
      headers: {
        'WWW-Authenticate': 'Basic realm="Genetius"',
      },
    };
  }

  const credentials = context.authHeader.slice(6);
  const decoded = atob(credentials);
  const separatorIndex = decoded.indexOf(':');
  
  // Handle case where no separator exists
  if (separatorIndex === -1) {
    return {
      success: false,
      status: 401,
      body: 'Unauthorized',
      headers: {
        'WWW-Authenticate': 'Basic realm="Genetius"',
      },
    };
  }

  const username = decoded.substring(0, separatorIndex);
  const password = decoded.substring(separatorIndex + 1);

  const usernameBuffer = Buffer.from(username);
  const passwordBuffer = Buffer.from(password);
  const adminUserBuffer = Buffer.from(adminUser);
  const adminPasswordBuffer = Buffer.from(adminPassword);

  // Check lengths first to avoid errors with timingSafeEqual
  const usernameMatch = 
    usernameBuffer.length === adminUserBuffer.length && 
    timingSafeEqual(usernameBuffer, adminUserBuffer);
    
  const passwordMatch = 
    passwordBuffer.length === adminPasswordBuffer.length && 
    timingSafeEqual(passwordBuffer, adminPasswordBuffer);

  if (!usernameMatch || !passwordMatch) {
    return {
      success: false,
      status: 401,
      body: 'Unauthorized',
      headers: {
        'WWW-Authenticate': 'Basic realm="Genetius"',
      },
    };
  }

  return { success: true };
}
