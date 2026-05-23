import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPageUrl } from "@/utils";
import { ArrowLeft, HelpCircle, Book, CreditCard, User, Settings, MessageCircle } from "lucide-react";

/**
 * Support (Yardım ve Destek) sayfası — sık sorulan soruları kategorilere
 * göre accordion yapısında listeler; her soru bir `<details>` öğesiyle açılıp kapanır.
 * Sayfanın altında destek ekibine yönlendiren iletişim bölümü yer alır.
 */
export default function Support() {
  const { t } = useTranslation(["pages"]);
  // Kategori meta listesi: i18n key'leri t() ile render anında çevrilir.
  const categoryMeta = [
    { titleKey: "pages:support.cat1Title", itemsKey: "pages:support.cat1Items", icon: HelpCircle },
    { titleKey: "pages:support.cat2Title", itemsKey: "pages:support.cat2Items", icon: Book },
    { titleKey: "pages:support.cat3Title", itemsKey: "pages:support.cat3Items", icon: CreditCard },
    { titleKey: "pages:support.cat4Title", itemsKey: "pages:support.cat4Items", icon: User },
    { titleKey: "pages:support.cat5Title", itemsKey: "pages:support.cat5Items", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("pages:support.backToHome")}
        </Link>

        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">{t("pages:titles.support")}</h1>
          <p className="text-lg text-slate-600">
            {t("pages:support.subtitle")}
          </p>
        </div>

        <div className="space-y-8">
          {categoryMeta.map((category, idx) => {
            const Icon = category.icon;
            const items = t(category.itemsKey, { returnObjects: true });
            const questions = Array.isArray(items) ? items : [];
            return (
              <div key={idx}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                    <Icon className="w-5 h-5" style={{color: '#0000CD'}} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">{t(category.titleKey)}</h2>
                </div>

                <div className="space-y-4">
                  {questions.map((item, qIdx) => (
                    <details key={qIdx} className="bg-white rounded-xl border border-slate-200 overflow-hidden group">
                      <summary className="p-6 cursor-pointer font-semibold text-slate-900 hover:bg-slate-50 transition-colors list-none flex items-center justify-between">
                        <span>{item.q}</span>
                        <svg className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-slate-50 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
            <MessageCircle className="w-8 h-8" style={{color: '#0000CD'}} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{t("pages:support.noAnswerTitle")}</h2>
          <p className="text-slate-600 mb-6">
            {t("pages:support.noAnswerDesc")}
          </p>
          <Link to={createPageUrl("Contact")}>
            <button className="px-6 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-opacity" style={{backgroundColor: '#0000CD'}}>
              {t("pages:support.contactButton")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
