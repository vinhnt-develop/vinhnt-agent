import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';

export const IS_PUBLIC_KEY = 'isPublic';

/** Mark a route/controller as exempt from JWT auth (health probes, etc.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Verify an api-issued access token (P3.1). The agent only VERIFIES — it
 * shares `AUTH_SECRET` with vinhnt-api and never issues tokens. Stateless by
 * design: signature + expiry + `type === 'access'`; no user/session DB check
 * (the agent has no PostgreSQL connection).
 */
export function verifyAccessToken(token: string, secret: string): jwt.JwtPayload {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || payload.type !== 'access') {
    throw new Error('Invalid token payload');
  }
  return payload;
}

/** Extract a JWT from `Authorization: Bearer` or the `access_token` cookie. */
export function extractBearerOrCookie(
  authorization?: string,
  cookieHeader?: string,
): string | null {
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
  }
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() === 'access_token') {
        return decodeURIComponent(part.slice(eq + 1).trim()) || null;
      }
    }
  }
  return null;
}

/**
 * Global REST guard (P3.1): every route requires a valid api access token
 * unless marked @Public(). Fails CLOSED when AUTH_SECRET is not configured.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const secret = this.configService.get<string>('auth.secret');
    if (!secret) {
      throw new UnauthorizedException('AUTH_NOT_CONFIGURED');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearerOrCookie(req.headers.authorization, req.headers.cookie);
    if (!token) throw new UnauthorizedException('Missing access token');

    try {
      const payload = verifyAccessToken(token, secret);
      (req as Request & { user?: jwt.JwtPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
