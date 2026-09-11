export interface PayloadToken {
  id: string;
  sessionId: string;
  type?: 'access' | 'refresh';
  username?: string;
  email?: string;
  phone?: string;
  iat?: number;
  exp?: number;
}

export interface TokenSession {
  accessToken: string;
  refreshToken: string;
}
