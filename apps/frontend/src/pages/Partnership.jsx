import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Handshake, TrendingUp, Users, Award, CheckCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Partnership (İş Ortaklığı) sayfası — kurumsal satış, eğitim kurumu
 * ve teknoloji ortaklığı seçeneklerini listeler; başvuru formu içerir.
 * Form gönderimi şu an simüle edilmektedir (gerçek backend entegrasyonu yok).
 */
export default function Partnership() {
  const { t } = useTranslation(["pages"]);
  // Ortaklık başvuru formu alanları
  const [formData, setFormData] = useState({
    company_name: "",
    name: "",
    email: "",
    phone: "",
    message: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company_name || !formData.name || !formData.email || !formData.message) {
      toast.error(t("pages:partnership.toasts.missingFields"));
      return;
    }
    setLoading(true);
    setTimeout(() => {
      toast.success(t("pages:partnership.toasts.submitted"));
      setFormData({ company_name: "", name: "", email: "", phone: "", message: "" });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("pages:partnership.backToHome")}
        </Link>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
              <Handshake className="w-6 h-6" style={{color: '#0000CD'}} />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">{t("pages:titles.partnership")}</h1>
          </div>
          <p className="text-lg text-slate-600">
            {t("pages:partnership.subtitle")}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                  <TrendingUp className="w-6 h-6" style={{color: '#0000CD'}} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">{t("pages:partnership.type1Title")}</h3>
                  <p className="text-slate-600 text-sm">
                    {t("pages:partnership.type1Body")}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                  <Users className="w-6 h-6" style={{color: '#0000CD'}} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">{t("pages:partnership.type2Title")}</h3>
                  <p className="text-slate-600 text-sm">
                    {t("pages:partnership.type2Body")}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                  <Award className="w-6 h-6" style={{color: '#0000CD'}} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">{t("pages:partnership.type3Title")}</h3>
                  <p className="text-slate-600 text-sm">
                    {t("pages:partnership.type3Body")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{t("pages:partnership.formTitle")}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("pages:partnership.companyLabel")}
                </label>
                <Input
                  placeholder={t("pages:partnership.companyPlaceholder")}
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("pages:partnership.nameLabel")}
                </label>
                <Input
                  placeholder={t("pages:partnership.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("pages:partnership.emailLabel")}
                </label>
                <Input
                  type="email"
                  placeholder={t("pages:partnership.emailPlaceholder")}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("pages:partnership.phoneLabel")}
                </label>
                <Input
                  type="tel"
                  placeholder={t("pages:partnership.phonePlaceholder")}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("pages:partnership.messageLabel")}
                </label>
                <Textarea
                  placeholder={t("pages:partnership.messagePlaceholder")}
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                style={{backgroundColor: '#0000CD'}}
              >
                {loading ? t("pages:partnership.submitting") : t("pages:partnership.submitButton")}
              </Button>
            </form>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">{t("pages:partnership.advantagesTitle")}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <CheckCircle className="w-8 h-8" style={{color: '#0000CD'}} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{t("pages:partnership.adv1Title")}</h3>
              <p className="text-sm text-slate-600">{t("pages:partnership.adv1Body")}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <CheckCircle className="w-8 h-8" style={{color: '#0000CD'}} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{t("pages:partnership.adv2Title")}</h3>
              <p className="text-sm text-slate-600">{t("pages:partnership.adv2Body")}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <CheckCircle className="w-8 h-8" style={{color: '#0000CD'}} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{t("pages:partnership.adv3Title")}</h3>
              <p className="text-sm text-slate-600">{t("pages:partnership.adv3Body")}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(0, 0, 205, 0.1)'}}>
                <CheckCircle className="w-8 h-8" style={{color: '#0000CD'}} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{t("pages:partnership.adv4Title")}</h3>
              <p className="text-sm text-slate-600">{t("pages:partnership.adv4Body")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
