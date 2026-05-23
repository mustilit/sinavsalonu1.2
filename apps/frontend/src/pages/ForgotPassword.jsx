import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPageUrl } from '@/utils';
import api from '@/lib/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * ForgotPassword (Şifremi Unuttum) sayfası — e-posta adresiyle
 * şifre sıfırlama bağlantısı talep etmeyi sağlar.
 */
export default function ForgotPassword() {
  const { t } = useTranslation(['auth']);
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setLoading(false);
      const message = err?.response?.data?.message || err?.message || t('auth:forgotPassword.failed');
      setError(message);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="forgot-password-success">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">{t('auth:forgotPassword.title')}</h1>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <p className="text-slate-600 mb-4">
                {t('auth:forgotPassword.successMessage')}
              </p>
              <p className="text-sm text-slate-500 mb-6">
                {t('auth:forgotPassword.linkValidity')}
              </p>
            </div>
            <Link to={createPageUrl('Login')} className="block w-full">
              <Button type="button" className="w-full bg-indigo-600 hover:bg-indigo-700">
                {t('auth:forgotPassword.loginLink')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">{t('auth:forgotPassword.title')}</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth:forgotPassword.email')}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth:login.emailPlaceholder')}
              required
              className="w-full"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? t('auth:forgotPassword.submitting') : t('auth:forgotPassword.submit')}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {t('auth:forgotPassword.rememberQuestion')}{' '}
          <Link to={createPageUrl('Login')} className="text-indigo-600 hover:underline">
            {t('auth:forgotPassword.loginLink')}
          </Link>
        </p>
        <p className="mt-2 text-center">
          <Link to={createPageUrl('Home')} className="text-sm text-slate-500 hover:text-slate-700">
            {t('auth:forgotPassword.backToHome')}
          </Link>
        </p>
      </div>
    </div>
  );
}
