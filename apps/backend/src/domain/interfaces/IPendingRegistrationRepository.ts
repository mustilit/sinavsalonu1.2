import { UserRole } from '../types';

export type PendingRegistrationModel = {
  id: string;
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
  createdAt: Date;
  /** Eğitici wizard step 2 — CV dosya URL'i (zorunlu eğitici için) */
  cvUrl?: string | null;
  /** Eğitici wizard step 2 — uzmanlık exam type ID'leri */
  specializations?: string[];
  /** Eğitici wizard step 2 — mezuniyet / eğitim bilgisi (opsiyonel) */
  educationInfo?: string | null;
  /** Eğitici wizard step 2 — tanıtım metni / bio (opsiyonel) */
  bio?: string | null;
};

export interface IPendingRegistrationRepository {
  create(input: {
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
    /** Eğitici wizard step 2 alanları */
    cvUrl?: string | null;
    specializations?: string[];
    educationInfo?: string | null;
    bio?: string | null;
  }): Promise<PendingRegistrationModel>;

  findByEmail(email: string): Promise<PendingRegistrationModel | null>;
  findByUsername(username: string): Promise<PendingRegistrationModel | null>;
  findByToken(token: string): Promise<PendingRegistrationModel | null>;
  deleteByEmail(email: string): Promise<void>;
  deleteByUsername(username: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  /** Süresi dolmuş kayıtları sil (cron için). Silinen kayıt sayısını döner. */
  deleteExpired(): Promise<number>;
}
