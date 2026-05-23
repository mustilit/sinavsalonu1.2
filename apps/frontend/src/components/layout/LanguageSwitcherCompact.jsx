import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { FlagIcon } from '@/components/layout/FlagIcon';
import { Check } from 'lucide-react';

/**
 * Kompakt dil seçici — sadece bayrak gösterilir; tıklayınca dropdown'da
 * bayrak + native name listelenir. PublicHeader gibi dar yerler için.
 *
 * - Dil isimleri her zaman kendi dilinde (native name): "中文" hangi dilde UI
 *   olursa olsun "中文" yazar; kullanıcı kendi dilini tanıyabilsin.
 * - Seçim localStorage'a `i18nextLng` ile kaydedilir (LanguageDetector otomatik).
 * - aria-label trigger'da; screen reader "Dili değiştir" duyurur.
 */
export function LanguageSwitcherCompact() {
  const { i18n, t } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage)
    ?? SUPPORTED_LANGUAGES[0];

  const handleSelect = (code) => {
    i18n.changeLanguage(code);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', code);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('language.label')}
        className="flex items-center justify-center w-9 h-9 rounded-md
                   hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        <FlagIcon code={current.code} className="w-6 h-4 rounded-sm overflow-hidden ring-1 ring-slate-200 dark:ring-gray-700" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <FlagIcon code={lang.code} className="w-5 h-3.5 rounded-sm overflow-hidden ring-1 ring-slate-200 dark:ring-gray-700" />
            <span className="flex-1 text-sm">{lang.label}</span>
            {lang.code === current.code && (
              <Check className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
