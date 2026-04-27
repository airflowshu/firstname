import dayjs from 'dayjs';

export function formatDate(value?: string | null, template = 'YYYY-MM-DD') {
  if (!value) {
    return '-';
  }

  return dayjs(value).format(template);
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
