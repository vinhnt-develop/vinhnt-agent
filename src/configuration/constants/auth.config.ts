import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  // Shared secret with vinhnt-api (AUTH_SECRET). The agent only VERIFIES
  // access tokens (P3.1) — it never issues them. Unset → JwtAuthGuard and
  // the WS handshake fail CLOSED (reject everything except @Public routes).
  secret: process.env.AUTH_SECRET,
}));
