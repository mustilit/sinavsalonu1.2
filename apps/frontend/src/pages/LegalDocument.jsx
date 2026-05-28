/**
 * LegalDocument — Sprint 14
 *
 * Yasal metin (sözleşme/aydınlatma) public sayfası. Route param `slug` ile
 * gelen değeri ContractType'a map eder ve markdown içeriği render eder.
 *
 * Route'lar (pages.config.js):
 *   /sozlesmeler/uyelik           → CANDIDATE
 *   /sozlesmeler/kvkk             → PRIVACY
 *   /sozlesmeler/mesafeli-satis   → DISTANCE_SALE
 *   /sozlesmeler/egitici-hizmet   → EDUCATOR
 *
 * İçerik backend `/contracts/active?type=...` üzerinden çekilir; admin yeni
 * versiyon yayımlarsa kullanıcılar otomatik yeni metni görür. Auth gerekmez.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { contracts } from '@/api/dalClient';
import { createPageUrl } from '@/utils';
import { ChevronLeft, FileText } from 'lucide-react';

const SLUG_TO_TYPE = {
  uyelik: 'CANDIDATE',
  kvkk: 'PRIVACY',
  'mesafeli-satis': 'DISTANCE_SALE',
  'egitici-hizmet': 'EDUCATOR',
};

const SLUG_LABEL = {
  uyelik: 'Üyelik / Kullanım Sözleşmesi',
  kvkk: 'KVKK Aydınlatma Metni',
  'mesafeli-satis': 'Mesafeli Satış Sözleşmesi',
  'egitici-hizmet': 'Eğitici Hizmet Sözleşmesi',
};

export default function LegalDocument() {
  const { t } = useTranslation(['common']);
  const { slug } = useParams();
  const [contract, setContract] = useState(null);
  const [error, setError] = useState(null);
  const type = SLUG_TO_TYPE[slug];

  useEffect(() => {
    if (!type) {
      setError('not_found');
      return;
    }
    contracts
      .getActive(type)
      .then((c) => setContract(c))
      .catch(() => setError('fetch_failed'));
  }, [type]);

  if (error === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-slate-900">Sözleşme bulunamadı</h1>
          <p className="text-slate-500 mt-2 mb-6">
            Bu URL ile eşleşen bir yasal metin yok. Footer linkleri üzerinden tekrar deneyin.
          </p>
          <Link to={createPageUrl('Home')} className="text-indigo-600 underline">
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <Link
          to={createPageUrl('Home')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common:common.backToHome', { defaultValue: 'Ana sayfa' })}
        </Link>

        {!contract && !error && (
          <div className="space-y-3 animate-pulse">
            <div className="h-7 bg-slate-200 rounded w-2/3" />
            <div className="h-4 bg-slate-100 rounded" />
            <div className="h-4 bg-slate-100 rounded w-5/6" />
            <div className="h-4 bg-slate-100 rounded w-3/4" />
          </div>
        )}

        {error === 'fetch_failed' && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
            Yasal metin yüklenemedi. Sistem yöneticisine başvurun veya daha sonra tekrar deneyin.
          </div>
        )}

        {contract && (
          <article className="prose prose-slate max-w-none">
            <header className="mb-6 pb-4 border-b border-slate-200">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{contract.title}</h1>
              <p className="text-xs text-slate-500">
                Versiyon {contract.version}
                {contract.publishedAt &&
                  ` • Yayımlanma: ${new Date(contract.publishedAt).toLocaleDateString('tr-TR')}`}
                {SLUG_LABEL[slug] && ` • ${SLUG_LABEL[slug]}`}
              </p>
            </header>
            <ReactMarkdown>{contract.content || ''}</ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
}
