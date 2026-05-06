const DEFAULT_CORS_ORIGIN = ['http://localhost:3000'];
const INSECURE_JWT_SECRETS = new Set([
  'please_change_me',
  'changeme',
  'change_me',
  'default',
  'secret',
  '123456',
]);
const MIN_JWT_SECRET_LENGTH = 32;

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseCorsOrigin(value: string | undefined) {
  if (!value) {
    return DEFAULT_CORS_ORIGIN;
  }

  const origins = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGIN;
}

function parseTokenExpiresInSeconds(value: string | undefined, fallbackSeconds: number) {
  if (!value) {
    return fallbackSeconds;
  }

  const normalized = value.trim().toLowerCase();

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  const matcher = normalized.match(/^(\d+)(s|m|h|d)$/);
  if (!matcher) {
    return fallbackSeconds;
  }

  const amount = Number.parseInt(matcher[1], 10);
  const unit = matcher[2];
  const multiplier = unit === 'd' ? 86_400 : unit === 'h' ? 3_600 : unit === 'm' ? 60 : 1;

  return amount * multiplier;
}

function resolveJwtSecret(nodeEnv: string) {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('缺少 JWT_SECRET 环境变量，请配置不少于 32 位的高强度密钥。');
  }

  if (INSECURE_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET 使用了弱默认值，请替换为高强度随机密钥。');
  }

  if (nodeEnv === 'production' && secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error('生产环境 JWT_SECRET 长度必须不少于 32 位。');
  }

  return secret;
}

export default () => {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';

  return {
    nodeEnv,
    port: parseNumber(process.env.API_PORT ?? process.env.PORT, 3001),
    jwtSecret: resolveJwtSecret(nodeEnv),
    accessTokenExpiresInSeconds: parseTokenExpiresInSeconds(
      process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
      43_200,
    ),
    refreshTokenExpiresInSeconds: parseTokenExpiresInSeconds(
      process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
      604_800,
    ),
    refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME?.trim() || 'fisrtname_rt',
    frontendBaseUrl: process.env.FRONTEND_BASE_URL?.trim() || 'http://localhost:3000',
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
    servePublicUploads: parseBoolean(process.env.SERVE_PUBLIC_UPLOADS, nodeEnv !== 'production'),
    corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
    enableSwagger: parseBoolean(process.env.ENABLE_SWAGGER, nodeEnv !== 'production'),
    loginThrottleLimit: parseNumber(process.env.LOGIN_THROTTLE_LIMIT, 5),
    loginThrottleTtlMs: parseNumber(process.env.LOGIN_THROTTLE_TTL_MS, 60_000),
    globalThrottleLimit: parseNumber(process.env.GLOBAL_THROTTLE_LIMIT, 120),
    globalThrottleTtlMs: parseNumber(process.env.GLOBAL_THROTTLE_TTL_MS, 60_000),
  };
};
