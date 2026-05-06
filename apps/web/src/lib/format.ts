import dayjs from 'dayjs';

export function formatDate(value?: string | null, template = 'YYYY-MM-DD') {
  if (!value) {
    return '-';
  }

  return dayjs(value).format(template);
}

export function getApiBaseUrl() {
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

export function toAbsoluteAssetUrl(path?: string | null) {
  if (!path) {
    return null;
  }

  if (path.startsWith('http')) {
    return path;
  }

  return `${getApiBaseUrl()}${path}`;
}
