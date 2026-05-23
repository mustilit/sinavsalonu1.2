import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, ShieldCheck } from "lucide-react";
import { auth } from "@/api/dalClient";

/**
 * SensitiveProfileOtpDialog — telefon/website/LinkedIn değişikliği için
 * 6 haneli e-posta doğrulaması.
 *
 * Akış:
 *   1. Dialog mount olur → backend'e OTP iste (POST /me/preferences/sensitive/request)
 *   2. Kullanıcı kodu girer → "Doğrula" (POST /me/preferences/sensitive/verify)
 *   3. Backend doğrularsa hassas alanları uygular ve onSuccess çağrılır
 *
 * Props:
 *   - open: boolean
 *   - onOpenChange: (open: boolean) => void
 *   - pendingFields: { phone?: string, website?: string, linkedin?: string }
 *   - onSuccess: () => void  — başarılı doğrulamadan sonra çağrılır
 */
export default function SensitiveProfileOtpDialog({
  open,
  onOpenChange,
  pendingFields,
  onSuccess,
}) {
  const { t } = useTranslation(["pages", "common"]);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Dialog her açılışta kodu otomatik gönder
  useEffect(() => {
    if (!open) {
      setCode("");
      setSentTo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setRequesting(true);
      try {
        const res = await auth.requestSensitiveProfileOtp();
        if (cancelled) return;
        setSentTo(res?.sentTo ?? null);
      } catch (err) {
        if (cancelled) return;
        const msg = err?.response?.data?.error?.message
          || err?.response?.data?.message
          || t("pages:profileSettings.sensitiveOtp.requestFailed");
        toast.error(msg);
        onOpenChange(false);
      } finally {
        if (!cancelled) setRequesting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResend = async () => {
    setRequesting(true);
    try {
      const res = await auth.requestSensitiveProfileOtp();
      setSentTo(res?.sentTo ?? null);
      setCode("");
      toast.success(t("pages:profileSettings.sensitiveOtp.resent"));
    } catch (err) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || t("pages:profileSettings.sensitiveOtp.requestFailed");
      toast.error(msg);
    } finally {
      setRequesting(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error(t("pages:profileSettings.sensitiveOtp.codeInvalid"));
      return;
    }
    setVerifying(true);
    try {
      await auth.verifySensitiveProfileChange({ code, ...pendingFields });
      toast.success(t("pages:profileSettings.sensitiveOtp.verified"));
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      let msg;
      if (code === "OTP_EXPIRED") msg = t("pages:profileSettings.sensitiveOtp.expired");
      else if (code === "OTP_MISMATCH") msg = t("pages:profileSettings.sensitiveOtp.mismatch");
      else msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || t("pages:profileSettings.sensitiveOtp.verifyFailed");
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            {t("pages:profileSettings.sensitiveOtp.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 flex items-start gap-2">
            <Mail className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
            <div>
              {requesting
                ? t("pages:profileSettings.sensitiveOtp.sending")
                : sentTo
                ? t("pages:profileSettings.sensitiveOtp.sentTo", { email: sentTo })
                : t("pages:profileSettings.sensitiveOtp.intro")}
            </div>
          </div>

          <div>
            <label htmlFor="otp-code" className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages:profileSettings.sensitiveOtp.codeLabel")}
            </label>
            <Input
              id="otp-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-2xl font-mono tracking-[0.4em] h-12"
              disabled={verifying || requesting}
            />
            <p className="text-xs text-slate-400 mt-1">
              {t("pages:profileSettings.sensitiveOtp.codeHint")}
            </p>
          </div>

          <div className="flex justify-between items-center gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={requesting || verifying}
              onClick={handleResend}
              className="text-slate-500"
            >
              {requesting
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{t("pages:profileSettings.sensitiveOtp.sending")}</>
                : t("pages:profileSettings.sensitiveOtp.resend")}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={verifying}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleVerify}
                disabled={code.length !== 6 || verifying}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {verifying
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("pages:profileSettings.sensitiveOtp.verifying")}</>
                  : t("pages:profileSettings.sensitiveOtp.verify")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
