import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '@/api/dalClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPageUrl } from '@/utils';
import { useAppNavigate } from '@/lib/navigation';
import { Link } from 'react-router-dom';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import TurnstileWidget from '@/components/auth/TurnstileWidget';
import { GraduationCap } from 'lucide-react';

export default function Register() {
  const { t } = useTranslation(['auth', 'common']);
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role'); // 'candidate' | 'educator' | null
  const isEducator = roleParam === 'educator';

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Eğitici kaydında zorunlu (aday için kullanılmaz)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const navigate = useAppNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isEducator) {
        await auth.registerEducator(email, username, password, { firstName, lastName, turnstileToken });
        // Eğitici: doğrulama → login → EducatorOnboarding (CV + uzmanlık alanı zorunlu)
        navigate(createPageUrl('VerifyEmail') + `?email=${encodeURIComponent(email)}&role=educator`, { replace: true });
      } else {
        await auth.register(email, username, password, { turnstileToken });
        // Aday: e-posta doğrulama sayfasına yönlendir; doğrulama sonrası SelectExamTypes'a yönlendirilir
        navigate(createPageUrl('VerifyEmail') + `?email=${encodeURIComponent(email)}`, { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || t('auth:register.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Sınav Salonu marka başlığı */}
        <Link
          to={createPageUrl('Home')}
          className="flex items-center justify-center gap-3 mb-8"
          aria-label={t('auth:register.brandAriaLabel')}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md">
            <GraduationCap className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{t('common:sidebar.brandName')}</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">{t('auth:register.title')}</h1>

        {roleParam && (
          <div className={`mb-6 text-center text-sm font-medium px-4 py-2 rounded-xl ${isEducator ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'}`}>
            {isEducator ? t('auth:register.signingUpAsEducator') : t('auth:register.signingUpAsCandidate')}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {/* Eğitici kaydında ad ve soyad zorunlu — resmi kayıt için */}
          {isEducator && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-first" className="block text-sm font-medium text-slate-700 mb-1">{t('auth:register.firstName')}</label>
                <Input
                  id="reg-first"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('auth:register.firstNamePlaceholder')}
                  required
                  minLength={2}
                  maxLength={50}
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="reg-last" className="block text-sm font-medium text-slate-700 mb-1">{t('auth:register.lastName')}</label>
                <Input
                  id="reg-last"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('auth:register.lastNamePlaceholder')}
                  required
                  minLength={2}
                  maxLength={50}
                  className="w-full"
                />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1">{t('auth:register.email')}</label>
            <Input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth:register.emailPlaceholder')}
              required
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="reg-username" className="block text-sm font-medium text-slate-700 mb-1">{t('auth:register.username')}</label>
            <Input
              id="reg-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth:register.usernamePlaceholder')}
              required
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1">{t('auth:register.password')}</label>
            <Input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {/* Bot doğrulaması — normal kullanıcıya görünmez; şüpheli aktivitede challenge */}
          <TurnstileWidget onSuccess={setTurnstileToken} action="register" />
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? t('auth:register.submitting') : t('auth:register.submit')}
          </Button>
        </form>

        {/* Google ile kayıt — yeni kullanıcı oluşturma role parametresine göre yapılır */}
        <div className="mt-6">
          <div className="relative my-4" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-50 px-2 text-slate-500">{t('common:common.or')}</span>
            </div>
          </div>
          <GoogleSignInButton
            text="signup_with"
            role={isEducator ? 'EDUCATOR' : 'CANDIDATE'}
          />
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          {t('auth:register.haveAccount')}{' '}
          <Link to={createPageUrl('Login')} className="text-indigo-600 underline hover:no-underline">
            {t('auth:register.login')}
          </Link>
        </p>
        <p className="mt-2 text-center">
          <Link to={createPageUrl('Home')} className="text-sm text-slate-500 hover:text-slate-700">
            {t('auth:register.backToHome')}
          </Link>
        </p>
      </div>
    </div>
  );
}
