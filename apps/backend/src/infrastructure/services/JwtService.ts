import jwt from 'jsonwebtoken';
import { UserRole } from '../../domain/types';

const JWT_SECRET = process.env.JWT_SECRET || 'dal-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN
  ? parseInt(process.env.JWT_EXPIRES_IN, 10)
  : 604800; // 7 gün (saniye)

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /**
   * Session ID — her başarılı login için crypto.randomUUID() ile üretilir.
   * JwtAuthGuard payload.sid ile User.activeSessionId'yi karşılaştırır;
   * uyumsuzsa "başka cihazda giriş yapıldı" hatası fırlatır.
   * Eski (sid'siz) tokenlar legacy session olarak kabul edilir.
   */
  sid?: string;
  iat?: number;
  exp?: number;
}

export class JwtService {
  sign(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verify(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  }
}
