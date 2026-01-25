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
  if (!context.pathname.startsWith('/admin')) {
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
  const [username, password] = decoded.split(':');

  if (username !== adminUser || password !== adminPassword) {
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
