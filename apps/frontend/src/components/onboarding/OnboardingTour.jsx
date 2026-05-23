/**
 * OnboardingTour — Çok adımlı rehberlik popup'ı
 *
 * Props:
 *   steps    : { title, description, illustration: ReactNode }[]
 *   onComplete: () => void   — son adımda "Başla" ya da "Tamamla" butonuna basılınca
 *   onSkip   : () => void    — "Atla" butonuna basılınca
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OnboardingTour({ steps = [], onComplete, onSkip }) {
  const { t } = useTranslation(["onboarding"]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  if (!visible || !steps.length) return null;

  const step = steps[current];
  const isLast = current === steps.length - 1;
  const isFirst = current === 0;

  const handleClose = () => {
    setVisible(false);
    onSkip?.();
  };

  const handleNext = () => {
    if (isLast) {
      setVisible(false);
      onComplete?.();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setCurrent((c) => c - 1);
  };

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Skip button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
          aria-label={t("onboarding:ui.skipAria")}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Illustration area */}
        <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-50 px-8 pt-8 pb-6 min-h-[220px] flex items-center justify-center">
          {step.illustration}
        </div>

        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2 pt-5 px-8">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={cn(
                "rounded-full transition-all duration-200",
                idx === current
                  ? "w-6 h-2 bg-indigo-600"
                  : "w-2 h-2 bg-slate-200 hover:bg-slate-300"
              )}
              aria-label={t("onboarding:ui.stepAria", { n: idx + 1 })}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pt-4 pb-6">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">
            {current + 1} / {steps.length}
          </p>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t(step.title)}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t(step.description)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-8 pb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
          >
            {t("onboarding:ui.skip")}
          </Button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                {t("onboarding:ui.back")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className={cn(
                "flex items-center gap-1",
                isLast
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {t("onboarding:ui.letsStart")}
                </>
              ) : (
                <>
                  {t("onboarding:ui.next")}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
