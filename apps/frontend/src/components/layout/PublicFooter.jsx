import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPageUrl } from "@/utils";
import { GraduationCap } from "lucide-react";

/**
 * PublicFooter — login olmayan kullanıcılar için paylaşılan alt bar.
 * Tüm public sayfalarda Layout tarafından render edilir
 * (TakeTest + LiveSession + auth/onboarding sayfaları hariç).
 *
 * PublicHeader ile aynı kapsam — header'la beraber gelir.
 */
export default function PublicFooter() {
  const { t } = useTranslation(["pages", "common"]);

  return (
    <footer className="text-slate-400 py-8" style={{ backgroundColor: "#0000CD" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              {/* Marka adı — i18n'lenmiyor */}
              <span className="text-lg font-bold text-white">{t("common:sidebar.brandName")}</span>
            </div>
            <p className="text-white/70 text-sm">
              {t("pages:home.footer.tagline")}
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">{t("pages:home.footer.corporate")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "about", page: "About", label: t("pages:home.footer.links.about") },
                { key: "contact", page: "Contact", label: t("pages:home.footer.links.contact") },
                { key: "privacy", page: "Privacy", label: t("pages:home.footer.links.privacy") },
                { key: "partnership", page: "Partnership", label: t("pages:home.footer.links.partnership") },
              ].map(({ key, page, label }) => (
                <Link
                  key={key}
                  to={createPageUrl(page)}
                  className="text-white/70 hover:text-white text-sm transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">{t("pages:home.footer.support")}</h3>
            <Link
              to={createPageUrl("Support")}
              className="text-white/70 hover:text-white text-sm transition-colors block"
            >
              {t("pages:home.footer.supportLink")}
            </Link>
          </div>
        </div>
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-white/80 text-center">
            © {new Date().getFullYear()} {t("common:sidebar.brandName")}. {t("pages:home.footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
