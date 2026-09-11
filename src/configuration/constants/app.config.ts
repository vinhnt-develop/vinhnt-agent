import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  host: process.env.APP_HOST || 'localhost',
  port: parseInt(process.env.APP_PORT || '8080', 10),
  apiDocument: process.env.APP_API_DOCUMENT || 'true',
  apiPrefix: process.env.APP_API_PREFIX || 'api',
  corsOrigin: process.env.APP_CORS_ORIGIN || 'http://localhost:5173',
  version: process.env.APP_VERSION || '0.1.0',
}));
