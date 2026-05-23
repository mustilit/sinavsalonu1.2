import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPageUrl } from "@/utils";
import { Target, Users, Award, Heart, ArrowLeft } from "lucide-react";

/**
 * About (Hakkımızda) sayfası — platformun misyonu, vizyonu,
 * değerleri ve tercih edilme nedenlerini açıklayan statik tanıtım sayfası.
 */
export default function About() {
  const { t } = useTranslation(["pages"]);
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("pages:about.backToHome")}
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">{t("pages:titles.about")}</h1>
          <p className="text-lg text-slate-600">
            {t("pages:about.subtitle")}
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <Target className="w-6 h-6" style={{color: '#0000CD'}} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t("pages:about.missionTitle")}</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {t("pages:about.missionBody")}
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <Award className="w-6 h-6" style={{color: '#0000CD'}} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t("pages:about.visionTitle")}</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {t("pages:about.visionBody")}
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <Heart className="w-6 h-6" style={{color: '#0000CD'}} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t("pages:about.valuesTitle")}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-xl">
                <h3 className="font-semibold text-slate-900 mb-2">{t("pages:about.value1Title")}</h3>
                <p className="text-sm text-slate-600">
                  {t("pages:about.value1Body")}
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl">
                <h3 className="font-semibold text-slate-900 mb-2">{t("pages:about.value2Title")}</h3>
                <p className="text-sm text-slate-600">
                  {t("pages:about.value2Body")}
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl">
                <h3 className="font-semibold text-slate-900 mb-2">{t("pages:about.value3Title")}</h3>
                <p className="text-sm text-slate-600">
                  {t("pages:about.value3Body")}
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl">
                <h3 className="font-semibold text-slate-900 mb-2">{t("pages:about.value4Title")}</h3>
                <p className="text-sm text-slate-600">
                  {t("pages:about.value4Body")}
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <Users className="w-6 h-6" style={{color: '#0000CD'}} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t("pages:about.whyTitle")}</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                  <span className="font-semibold" style={{color: '#0000CD'}}>1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{t("pages:about.why1Title")}</h3>
                  <p className="text-slate-600">{t("pages:about.why1Body")}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                  <span className="font-semibold" style={{color: '#0000CD'}}>2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{t("pages:about.why2Title")}</h3>
                  <p className="text-slate-600">{t("pages:about.why2Body")}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                  <span className="font-semibold" style={{color: '#0000CD'}}>3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{t("pages:about.why3Title")}</h3>
                  <p className="text-slate-600">{t("pages:about.why3Body")}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
