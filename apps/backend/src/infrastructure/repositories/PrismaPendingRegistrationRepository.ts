import { randomUUID } from 'crypto';
import { prisma } from '../database/prisma';
import type {
  IPendingRegistrationRepository,
  PendingRegistrationModel,
} from '../../domain/interfaces/IPendingRegistrationRepository';
import type { UserRole } from '../../domain/types';

/**
 * PendingRegistration repository — Prisma client regenerate edilemediği
 * (Windows EPERM: backend çalışırken DLL kilitli) için **raw SQL** kullanır.
 * Migration uygulandı, kolonlar DB'de var; client model alanı (prisma.pendingRegistration)
 * generate edilene kadar bu dosya $queryRaw/$executeRaw ile çalışır.
 * Parametreler template literal'la güvenli (SQL injection yok).
 */
export class PrismaPendingRegistrationRepository implements IPendingRegistrationRepository {
  async create(input: {
    email: string;
    username: string;
    passwordHash: string;
    firstName?: string | null;
    lastName?: string | null;
    role: UserRole;
    acceptedTermsContractId?: string | null;
    acceptedPrivacyContractId?: string | null;
    verificationToken: string;
    verificationTokenExpiresAt: Date;
    ip?: string | null;
    userAgent?: string | null;
    tenantId?: string | null;
    cvUrl?: string | null;
    specializations?: string[];
    educationInfo?: string | null;
    bio?: string | null;
  }): Promise<PendingRegistrationModel> {
    const id = randomUUID();
    const email = input.email.toLowerCase();
    // PostgreSQL text[] literal: '{id1,id2}' formatında gönderilir
    const specializationsLiteral = `{${(input.specializations ?? []).join(',')}}`;
    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO pending_registrations (
        id, email, username, "passwordHash", "firstName", "lastName", role,
        "acceptedTermsContractId", "acceptedPrivacyContractId",
        "verificationToken", "verificationTokenExpiresAt",
        ip, "userAgent", "tenantId",
        "cvUrl", specializations, "educationInfo", bio,
        "createdAt"
      ) VALUES (
        ${id}, ${email}, ${input.username}, ${input.passwordHash},
        ${input.firstName ?? null}, ${input.lastName ?? null},
        ${input.role}::"UserRole",
        ${input.acceptedTermsContractId ?? null}, ${input.acceptedPrivacyContractId ?? null},
        ${input.verificationToken}, ${input.verificationTokenExpiresAt},
        ${input.ip ?? null}, ${input.userAgent ?? null}, ${input.tenantId ?? null},
        ${input.cvUrl ?? null}, ${specializationsLiteral}::text[], ${input.educationInfo ?? null}, ${input.bio ?? null},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    return this.toDomain(rows[0]);
  }

  async findByEmail(email: string): Promise<PendingRegistrationModel | null> {
    const e = email.toLowerCase();
    const rows = await prisma.$queryRaw<any[]>`
      SELECT * FROM pending_registrations WHERE email = ${e} LIMIT 1
    `;
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<PendingRegistrationModel | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT * FROM pending_registrations WHERE username = ${username} LIMIT 1
    `;
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async findByToken(token: string): Promise<PendingRegistrationModel | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT * FROM pending_registrations WHERE "verificationToken" = ${token} LIMIT 1
    `;
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async deleteByEmail(email: string): Promise<void> {
    const e = email.toLowerCase();
    await prisma.$executeRaw`DELETE FROM pending_registrations WHERE email = ${e}`;
  }

  async deleteByUsername(username: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM pending_registrations WHERE username = ${username}`;
  }

  async deleteById(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM pending_registrations WHERE id = ${id}`;
  }

  async deleteExpired(): Promise<number> {
    const count = await prisma.$executeRaw`
      DELETE FROM pending_registrations WHERE "verificationTokenExpiresAt" < NOW()
    `;
    return Number(count) || 0;
  }

  private toDomain(row: any): PendingRegistrationModel {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.passwordHash,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      role: row.role as UserRole,
      acceptedTermsContractId: row.acceptedTermsContractId ?? null,
      acceptedPrivacyContractId: row.acceptedPrivacyContractId ?? null,
      verificationToken: row.verificationToken,
      verificationTokenExpiresAt: row.verificationTokenExpiresAt,
      ip: row.ip ?? null,
      userAgent: row.userAgent ?? null,
      tenantId: row.tenantId ?? null,
      createdAt: row.createdAt,
      cvUrl: row.cvUrl ?? null,
      // PostgreSQL text[] → JS string[] (raw query döner string veya array)
      specializations: Array.isArray(row.specializations)
        ? row.specializations
        : typeof row.specializations === 'string'
          ? row.specializations.replace(/^\{/, '').replace(/\}$/, '').split(',').filter(Boolean)
          : [],
      educationInfo: row.educationInfo ?? null,
      bio: row.bio ?? null,
    };
  }
}
