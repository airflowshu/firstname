export default () => ({
  port: Number.parseInt(process.env.API_PORT ?? process.env.PORT ?? '3001', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'please_change_me',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  corsOrigin: process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()) ?? [
    'http://localhost:3000',
  ],
});
