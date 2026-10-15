import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import {
  JwtAuthGuard,
  extractBearerOrCookie,
  verifyAccessToken,
} from './jwt-auth.guard';

const SECRET = 'test-secret';

function signAccessToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign({ id: 'u1', sessionId: 's1', type: 'access', ...overrides }, SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

function mockContext(opts: {
  isPublic?: boolean;
  authorization?: string;
  cookie?: string;
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          ...(opts.authorization !== undefined ? { authorization: opts.authorization } : {}),
          ...(opts.cookie !== undefined ? { cookie: opts.cookie } : {}),
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('jwt-auth.guard (P3.1)', () => {
  describe('extractBearerOrCookie', () => {
    it('reads Bearer header', () => {
      expect(extractBearerOrCookie('Bearer abc', undefined)).toBe('abc');
    });
    it('reads access_token cookie among others', () => {
      expect(extractBearerOrCookie(undefined, 'foo=1; access_token=xyz; bar=2')).toBe('xyz');
    });
    it('returns null when nothing present', () => {
      expect(extractBearerOrCookie(undefined, undefined)).toBeNull();
      expect(extractBearerOrCookie('Bearer ', undefined)).toBeNull();
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies a valid access token', () => {
      const payload = verifyAccessToken(signAccessToken(), SECRET);
      expect(payload.id).toBe('u1');
      expect(payload.type).toBe('access');
    });
    it('rejects a wrong secret', () => {
      expect(() => verifyAccessToken(signAccessToken(), 'other')).toThrow();
    });
    it('rejects non-access token types', () => {
      const refresh = jwt.sign({ id: 'u1', type: 'refresh' }, SECRET, { algorithm: 'HS256' });
      expect(() => verifyAccessToken(refresh, SECRET)).toThrow();
    });
  });

  describe('JwtAuthGuard', () => {
    const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    const makeGuard = (secret?: string) =>
      new JwtAuthGuard(reflector, {
        get: (key: string) => (key === 'auth.secret' ? secret : undefined),
      } as unknown as ConfigService);

    beforeEach(() => jest.clearAllMocks());

    it('allows @Public routes without a token', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      expect(makeGuard(undefined).canActivate(mockContext({}))).toBe(true);
    });

    it('fails closed when AUTH_SECRET is unset', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      expect(() => makeGuard(undefined).canActivate(mockContext({}))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects missing token', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      expect(() => makeGuard(SECRET).canActivate(mockContext({}))).toThrow(
        'Missing access token',
      );
    });

    it('accepts cookie token and attaches payload', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      const req = { headers: { cookie: `access_token=${signAccessToken()}` } };
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;
      expect(makeGuard(SECRET).canActivate(ctx)).toBe(true);
      expect((req as { user?: { id?: string } }).user?.id).toBe('u1');
    });

    it('rejects invalid token', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      expect(() =>
        makeGuard(SECRET).canActivate(mockContext({ authorization: 'Bearer garbage' })),
      ).toThrow('Invalid access token');
    });
  });
});
