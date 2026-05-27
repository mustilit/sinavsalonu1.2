# OAuth Google Setup Runbook

> **Statü:** Backend + Frontend tam entegre (mevcut kod tabanında çalışıyor)
> **Versiyon:** B3+ itibariyle
> **İlgili dosyalar:**
> - `apps/backend/src/application/use-cases/auth/GoogleAuthUseCase.ts`
> - `apps/backend/src/nest/controllers/auth.controller.ts` (`/auth/google`)
> - `apps/frontend/src/components/auth/GoogleSignInButton.jsx`
> - `apps/frontend/src/pages/Login.jsx` + `Register.jsx`

## Akış

1. **Frontend** `@react-oauth/google` SDK ile Google Identity Services'i sarmalar
2. Kullanıcı butona basar → Google popup → ID token frontend'e döner
3. **Frontend** `POST /auth/google` çağrısı `{ idToken, role }` body ile
4. **Backend** `GoogleAuthUseCase`:
   - `google-auth-library`'nin `OAuth2Client.verifyIdToken()` ile token + audience doğrular
   - Email mevcut user'la eşleşir mi? Varsa `googleId` attach. Yoksa yeni user oluşturur
   - Standart JWT döner
5. **Frontend** JWT'yi `localStorage.auth_token`'a yazar + redirect

## Google Cloud Console kurulumu

### 1. OAuth 2.0 Client ID oluştur

1. https://console.cloud.google.com → APIs & Services → Credentials
2. **Create credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `Sınav Salonu — Web (production)` veya `(staging)`

### 2. Authorized origins

Hangi domain'lerden Google Sign-In çalışacak:

**Geliştirme:**
- `http://localhost:5174`

**Staging:**
- `https://staging.sinavsalonu.example`

**Production:**
- `https://sinavsalonu.example`
- `https://www.sinavsalonu.example`

**ÖNEMLİ:** `http://` (TLS yok) sadece localhost'ta kabul edilir. Diğer her yer `https://` olmak zorunda.

### 3. Authorized redirect URIs

Sınav Salonu **JS SDK** kullandığı için redirect URI gerekmez (popup mode).
Boş bırakılabilir.

### 4. Client ID'yi env'ye al

```bash
# Backend (.env)
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com

# Frontend (.env)
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

**ÖNEMLİ:** Backend + Frontend AYNI client ID'yi kullanır. Audience doğrulaması için zorunlu.

## Admin paneli yapılandırması

Sınav Salonu admin paneli `AdminSettings.googleClientId` alanı üzerinden de yapılandırma yapılabilir (env'i override eder):

1. Admin → Sistem Kontrolleri → Entegrasyonlar
2. Google OAuth bölümünde Client ID gir
3. Kaydet → backend modül restart gerektirmeden devreye girer (use-case her çağrıda DB'den okur)

## Yeni kullanıcı oluşumu

Google ile ilk kez giren kullanıcı için:
- `email` Google'dan alınır (zaten doğrulanmış)
- `username` email local-part'ından üretilir (collision varsa `-2`, `-3` suffix)
- `passwordHash` rastgele bir hash (kullanıcı "şifremi unuttum" ile sıfırlayabilir)
- `googleId` Google `sub` claim'inden alınır
- `role` body'den (`CANDIDATE` veya `EDUCATOR`)
- `emailVerifiedAt` = now (Google doğruladı)

## Email çakışması

Kullanıcı önce email/şifre ile kayıt olmuş → sonra Google ile giriş yaparsa:
- Email eşleşir → mevcut user'a `googleId` attach edilir
- Sonraki tüm girişler ya email/şifre ya Google ile çalışır
- Şifresini unutursa "Şifremi Unuttum" hâlâ çalışır

## Çıkış (sign out)

Frontend `localStorage.removeItem('auth_token')` + `google.accounts.id.disableAutoSelect()`. Google'ın kendi
oturumu açık kalır — kullanıcı Google'dan ayrı çıkış yapar.

## Audit log

Her başarılı Google girişi:
- `AUTH_LOGIN_SUCCESS` audit log + `metadata.provider = 'google'`
- IP + user-agent + tenant ID

Başarısız token:
- `AUTH_LOGIN_FAIL` + `metadata.reason = 'invalid_google_token'`

## Test

Frontend `@react-oauth/google` mock'lu:

```jsx
// Register.test.jsx
jest.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }) => children,
  GoogleLogin: () => <button data-testid="google-mock">Mock Google</button>,
}));
```

Backend integration test'i için `GoogleAuthUseCase.test.ts`'te `OAuth2Client.verifyIdToken` mock'lanır.

## Sorun giderme

| Sorun | Sebep | Çözüm |
|---|---|---|
| `redirect_uri_mismatch` | Origin yetkili değil | Google Console'da `Authorized origins`'e ekle |
| `invalid_audience` | Backend + Frontend farklı client ID | Aynı ID kullan, env güncelle |
| Button render olmuyor | SDK yüklenmedi | Network tab kontrol et — `accounts.google.com/gsi/client` |
| Token 401 backend | Audience mismatch veya expired | Audit log'da `invalid_google_token` ara |

## Güvenlik notları

- **Hiçbir zaman client secret frontend'e koyma** — Google Web Application client'ı için secret zorunlu değil (PKCE mantığı SDK'da)
- ID token kısa ömürlü (1 saat) — backend her seferinde doğrular
- Backend'de **audience whitelist** kontrolü zorunlu (`verifyIdToken({ audience: clientId })`)
- `email_verified=false` Google response'ları reddedilir
