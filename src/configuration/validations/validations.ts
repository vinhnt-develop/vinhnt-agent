import * as Joi from 'joi';

export const validationSchema = Joi.object({
  APP_HOST: Joi.string().default('localhost'),
  APP_PORT: Joi.number().default(8080),
  APP_API_DOCUMENT: Joi.string().default('true'),
  APP_API_PREFIX: Joi.string().default('api'),
  APP_CORS_ORIGIN: Joi.string().default('http://localhost:2026'),

  // P3.1: shared secret with vinhnt-api — agent only verifies access tokens.
  // Unset → auth fails closed (reject all non-@Public routes).
  AUTH_SECRET: Joi.string().optional(),

  // P3.5: knowledge embeddings (OpenAI-compatible /embeddings). Model defaults
  // to gemini-embedding-001 (text-embedding-004 was removed upstream);
  // provider resolves KNOWLEDGE_EMBEDDING_PROVIDER → default/first active.
  KNOWLEDGE_EMBEDDING_MODEL: Joi.string().optional(),
  KNOWLEDGE_EMBEDDING_PROVIDER: Joi.string().optional(),

  DATABASE_URL: Joi.string().required(),

  NODE_ENV: Joi.string()
    .valid('development', 'production', 'staging', 'test')
    .default('development'),
});
