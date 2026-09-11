import * as Joi from 'joi';

export const validationSchema = Joi.object({
  APP_HOST: Joi.string().default('localhost'),
  APP_PORT: Joi.number().default(8080),
  APP_API_DOCUMENT: Joi.string().default('true'),
  APP_API_PREFIX: Joi.string().default('api'),
  APP_CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  DATABASE_URL: Joi.string().required(),

  NODE_ENV: Joi.string()
    .valid('development', 'production', 'staging', 'test')
    .default('development'),

  SYNC_API_URL: Joi.string().allow('').optional(),
  SYNC_API_KEY: Joi.string().allow('').optional(),
  SYNC_ENABLED: Joi.boolean().default(false),
});
