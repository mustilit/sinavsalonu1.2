import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api/apiClient";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { GraduationCap, CheckCircle2, XCircle, Loader2 } from "lucide-react";

/**
 * DeviceVerify — yeni cihazdan giriş mailindeki "Bu bendim — Cihazı doğrula"
 * linkinden açılır.
 */
export default function DeviceVerify() {
  const { t } = useTranslation(["auth", "common"]);
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState({ phase: "verifying", message: "" });

  useEffect(() => {
    if (!token || token.length < 16) {
      setState({ phase: "error", message: t("auth:deviceVerify.invalidLink") });
      return;
    }
    let alive = true;
    (async () => {
      try {
        await api.post("/auth/device/verify", { token });
        if (alive) setState({ phase: "success", message: "" });
      } catch (e) {
        const d = e?.response?.data;
        const msg =
          d?.error?.message ||
          d?.message ||
          d?.error?.code ||
          d?.code ||
          e?.message ||
          t("auth:deviceVerify.verifyFailed");
        if (alive) setState({ phase: "error", message: msg });
      }
    })();
    return () => { alive = false; };
  }, [token, t]);

  const isVerifying = state.phase === "verifying";
  const isSuccess = state.phase === "success";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Link
          to={createPageUrl("Home")}
          className="flex items-center justify-center gap-3 mb-8"
          aria-label={t("auth:login.brandAriaLabel")}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md">
            <GraduationCap className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{t("common:sidebar.brandName")}</span>
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          {isVerifying && (
            <>
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">{t("auth:deviceVerify.verifying")}</h1>
              <p className="text-sm text-slate-500">{t("auth:deviceVerify.pleaseWait")}</p>
            </>
          )}
          {isSuccess && (
            <>
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">{t("auth:deviceVerify.verified")}</h1>
              <p className="text-sm text-slate-600 mb-6">
                {t("auth:deviceVerify.verifiedDesc")}
              </p>
              <Link to={createPageUrl("Home")}>
                <Button className="bg-indigo-600 hover:bg-indigo-700">{t("auth:deviceVerify.backToHome")}</Button>
              </Link>
            </>
          )}
          {state.phase === "error" && (
            <>
              <XCircle className="w-14 h-14 text-rose-500 mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">{t("auth:deviceVerify.verifyFailed")}</h1>
              <p className="text-sm text-rose-600 mb-2">{state.message}</p>
              <p className="text-xs text-slate-500 mb-6">
                {t("auth:deviceVerify.linkExpiredHint")}
              </p>
              <Link to={createPageUrl("Login")}>
                <Button variant="outline">{t("auth:deviceVerify.goToLogin")}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
