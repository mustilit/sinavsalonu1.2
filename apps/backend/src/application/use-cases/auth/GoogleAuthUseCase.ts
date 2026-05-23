import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';
import { UserPublic } from '../../../domain/entities/User';
import { IUserRepository } from '../../../domain/interfaces/IUserRepository';
import { JwtService } from '../../../infrastructure/services/JwtService';
import { PasswordService } from '../../../infrastructure/services/PasswordService';
import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';

/** Google ID token doğrulayıp kullanıcıyı oluşturur/eşler ve JWT döner. */
export interface GoogleAuthResult {
  user: UserPublic;
  token: string;
  isNewUser: boolean;
}

/**
 * Google OAuth ID token doğrulama akışı:
 *  1) Frontend Google Identity Services SDK ile ID token alır.
 *  2) Bu use case token'ı Google'ın `tokeninfo` ile doğrular (audience kontrolü).
 *  3) E-posta ile mevcut kullanıcı varsa googleId attach edilir; yoksa yeni kullanıcı.
 *  4) Standart JWT döner — sıradan login akışıyla aynı.
 *
 * E-posta zaten doğrulanmış (Google email_verified=true) — şifre kontrolü atlanır.
 * Şifre alanı için rastgele uzun bir hash set edilir (kullanıcı isterse "şifremi
 * unuttum" üzerinden parola belirleyebilir).
 */
export class GoogleAuthUseCase {
  // client artık her execute'ta etkin clientId'ye göre oluşturulur (admin panelinden
  // değişirse module restart gerektirmesin diye)

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    _clientId: string | undefined,  // eski constructor imzasını koru (DI uyumlu)
  ) {
    // _clientId artık kullanılmıyor — runtime'da DB+env'den çekilir
    void _clientId;
  }

  async execute(input: { idToken: string; role?: 'CANDIDATE' | 'EDUCATOR' }): Promise<GoogleAuthResult> {
    // Önce admin paneli ayarından (DB), yoksa env'den oku
    let dbClientId: string | null = null;
    try {
      const row = await (prisma as any).$queryRaw`
        SELECT "googleClientId" FROM admin_settings WHERE id = 1
      ` as Array<{ googleClientId: string | null }>;
      dbClientId = row?.[0]?.googleClientId ?? null;
    } catch {
      // kolon yoksa sessizce env'e düş
    }
    const envClientId = process.env.GOOGLE_CLIENT_ID;
    const clientId =
      (dbClientId && dbClientId.trim()) ? dbClientId.trim() :
      (envClientId && envClientId.trim()) ? envClientId.trim() :
      null;
    if (!clientId) {
      throw new AppError('GOOGLE_NOT_CONFIGURED', 'Google OAuth yapılandırılmamış — admin panelinden Google Client ID giriniz', 500);
    }
    if (!input?.idToken) {
      throw new AppError('INVALID_INPUT', 'idToken zorunludur', 400);
    }

    // Token doğrulama (signature + expiry + audience) — her seferinde güncel clientId ile
    const client = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: input.idToken,
        audience: clientId,
      });
    } catch {
      throw new AppError('GOOGLE_TOKEN_INVALID', 'Google token geçersiz veya süresi dolmuş', 401);
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new AppError('GOOGLE_TOKEN_INVALID', 'Google token payload eksik', 401);
    }
    if (payload.email_verified === false) {
      throw new AppError('GOOGLE_EMAIL_UNVERIFIED', 'Google hesabınızın e-posta adresi doğrulanmamış', 403);
    }
    const googleSub = payload.sub;
    const googleEmail = (payload.email ?? '').toLowerCase().trim();
    const googleName = payload.name ?? payload.given_name ?? googleEmail.split('@')[0];
    if (!googleEmail) {
      throw new AppError('GOOGLE_NO_EMAIL', 'Google token e-posta içermiyor', 400);
    }

    // 1) googleId ile eşleştir
    let existing: any = await (prisma.user as any).findUnique({ where: { googleId: googleSub } });

    // 2) E-posta ile eşleştir (henüz googleId bağlanmamış kullanıcı)
    if (!existing) {
      existing = await prisma.user.findUnique({ where: { email: googleEmail } });
      if (existing) {
        // E-posta zaten kayıtlı — googleId attach
        existing = await (prisma.user as any).update({
          where: { id: existing.id },
          data: { googleId: googleSub },
        });
      }
    }

    let isNewUser = false;
    if (!existing) {
      // 3) Yeni kullanıcı oluştur
      isNewUser = true;
      // username çakışmasını önlemek için: e-postanın @ öncesi + suffix dene
      const base = googleEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '') || 'kullanici';
      let username = base.toLowerCase();
      let attempt = 0;
      while (await prisma.user.findUnique({ where: { username } })) {
        attempt++;
        username = `${base.toLowerCase()}${attempt}`;
        if (attempt > 50) {
          username = `${base.toLowerCase()}${Date.now()}`;
          break;
        }
      }
      // Rastgele güvenli şifre (kullanıcı şifremi unuttum ile sıfırlayabilir)
      const randomPwd = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64');
      const passwordHash = await this.passwordService.hash(randomPwd);

      // Tenant: dev-tenant veya ilk tenant
      const tenant = await prisma.tenant.findFirst();
      if (!tenant) {
        throw new AppError('NO_TENANT', 'Sistem henüz yapılandırılmamış (tenant yok)', 500);
      }

      const role = input.role === 'EDUCATOR' ? 'EDUCATOR' : 'CANDIDATE';
      existing = await (prisma.user as any).create({
        data: {
          email: googleEmail,
          username,
          passwordHash,
          role,
          status: 'ACTIVE',
          tenantId: tenant.id,
          googleId: googleSub,
          metadata: googleName ? { displayName: googleName } : undefined,
        },
      });
    }

    if (existing.status === 'SUSPENDED') {
      throw new AppError('ACCOUNT_SUSPENDED', 'Hesabınız askıya alınmış', 403);
    }
    if (existing.isBanned) {
      throw new AppError('ACCOUNT_BANNED', 'Hesabınız yasaklanmış', 403);
    }

    // Tek aktif oturum — eski cihaz token'ları bu noktada geçersizleşir.
    const sid = randomUUID();
    await prisma.user.update({
      where: { id: existing.id },
      data: { activeSessionId: sid } as any,
    });
    try {
      const { RedisCache } = await import('../../../infrastructure/cache/RedisCache');
      await new RedisCache().del(`userBanStatus:${existing.id}`);
    } catch { /* sessiz */ }

    const token = this.jwtService.sign({
      sub: existing.id,
      email: existing.email,
      role: existing.role,
      sid,
    });

    const userPublic: UserPublic = {
      id: existing.id,
      email: existing.email,
      username: existing.username,
      role: existing.role,
      status: existing.status,
      createdAt: existing.createdAt,
    } as UserPublic;

    return { user: userPublic, token, isNewUser };
  }
}
