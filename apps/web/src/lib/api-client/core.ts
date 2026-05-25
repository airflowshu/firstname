import type { AuthUser } from '../types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type RequestOptions = RequestInit & {
  token?: string | null;
  responseType?: 'json' | 'blob';
  skipAuthRefresh?: boolean;
};

let runtimeAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getRuntimeAccessToken() {
  return runtimeAccessToken;
}

export function setRuntimeAccessToken(token: string | null) {
  runtimeAccessToken = token;
}

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (typeof window === 'undefined') {
    return configuredUrl || 'http://localhost:3001';
  }

  const currentUrl = new URL(window.location.href);
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(currentUrl.hostname);

  if (configuredUrl) {
    try {
      const apiUrl = new URL(configuredUrl);
      const configuredPointsToCurrentFrontend =
        apiUrl.hostname === currentUrl.hostname && apiUrl.port === currentUrl.port;
      const configuredLocalhostFromRemotePage =
        ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname) && !isLocalHost;

      if (configuredPointsToCurrentFrontend || configuredLocalhostFromRemotePage) {
        apiUrl.hostname = currentUrl.hostname;
        apiUrl.port = '3001';
        return apiUrl.origin;
      }

      return apiUrl.origin;
    } catch {
      return configuredUrl;
    }
  }

  if (!isLocalHost) {
    return `${currentUrl.protocol}//${currentUrl.hostname}:3001`;
  }

  return 'http://localhost:3001';
}

export function clearStoredAuth() {
  setRuntimeAccessToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fisrtname:auth-cleared'));
  }
}

async function parseErrorMessage(response: Response) {
  let message = `请求失败：${response.status}`;

  try {
    const errorBody = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(errorBody.message)) {
      message = errorBody.message.join('；');
    } else if (errorBody.message) {
      message = errorBody.message;
    }
  } catch {
    // ignore parse failure
  }

  return message;
}

function shouldTryRefresh(path: string, options: RequestOptions) {
  if (options.skipAuthRefresh) {
    return false;
  }

  return path !== '/auth/login' && path !== '/auth/refresh';
}

async function refreshAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        clearStoredAuth();
        return null;
      }

      const payload = (await response.json()) as {
        accessToken: string;
        user?: AuthUser;
      };

      setRuntimeAccessToken(payload.accessToken);
      window.dispatchEvent(
        new CustomEvent('fisrtname:token-refreshed', {
          detail: {
            token: payload.accessToken,
            user: payload.user,
          },
        }),
      );
      return payload.accessToken;
    } catch {
      clearStoredAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  const token = options.token ?? getRuntimeAccessToken();

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
    credentials: 'include',
  });

  if (response.status === 401 && shouldTryRefresh(path, options)) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return request<T>(path, {
        ...options,
        token: refreshedToken,
        skipAuthRefresh: true,
      });
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (options.responseType === 'blob') {
    return (await response.blob()) as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
