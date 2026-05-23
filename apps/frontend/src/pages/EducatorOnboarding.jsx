import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { auth, entities } from "@/api/dalClient";
import api from "@/lib/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, CheckCircle, FileText, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * EducatorOnboarding — yeni eğiticinin (email doğrulama sonrası) CV ve
 * uzmanlık alanlarını doldurması için zorunlu adım.
 *
 * Tamamlanmadan ana akışa geçemez (Layout/AuthContext yönlendirme yapar).
 * İki bölüm:
 *   1) CV yükleme (PDF, max 5MB) — zorunlu
 *   2) Uzmanlık alanları (en az 1 sınav türü) — zorunlu
 *
 * Tamamlanınca EducatorDashboard'a yönlendirir.
 */
export default function EducatorOnboarding() {
  const { t } = useTranslation(["pages", "common"]);
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  const [cvUrl, setCvUrl] = useState("");
  const [uploadingCv, setUploadingCv] = useState(false);
  const [selectedExams, setSelectedExams] = useState([]);
  const [saving, setSaving] = useState(false);

  // Aktif sınav türleri
  const { data: examTypes = [] } = useQuery({
    queryKey: ["examTypes"],
    queryFn: () => entities.ExamType.filter({ is_active: true }),
  });

  // Mevcut profil — varsa pre-fill (örn. kullanıcı sayfayı yeniden açtıysa)
  useEffect(() => {
    if (!user) return;
    if (user.cv_url) setCvUrl(user.cv_url);
    if (Array.isArray(user.specialized_exam_types)) {
      setSelectedExams(user.specialized_exam_types);
    }
  }, [user?.id]);

  // Zaten tamamlanmış eğiticiyi onboarding'e tutmayalım
  useEffect(() => {
    if (isLoadingAuth || !user) return;
    if ((user.role || "").toUpperCase() !== "EDUCATOR") {
      navigate(createPageUrl("Home"), { replace: true });
      return;
    }
    (async () => {
      const status = await auth.educatorOnboardingStatus();
      if (status?.complete) {
        navigate(createPageUrl("EducatorDashboard"), { replace: true });
      }
    })();
  }, [user?.id, isLoadingAuth, navigate]);

  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error(t("pages:educatorOnboarding.errors.invalidPdf"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("pages:educatorOnboarding.errors.fileTooBig"));
      return;
    }
    setUploadingCv(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data.url || res.data.fileUrl || res.data.file_url;
      setCvUrl(url);
      toast.success(t("pages:educatorOnboarding.cvUploaded"));
    } catch {
      toast.error(t("pages:educatorOnboarding.errors.uploadFailed"));
    } finally {
      setUploadingCv(false);
      e.target.value = "";
    }
  };

  const toggleExam = (id) => {
    setSelectedExams((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cvUrl) {
      toast.error(t("pages:educatorOnboarding.errors.cvRequired"));
      return;
    }
    if (selectedExams.length === 0) {
      toast.error(t("pages:educatorOnboarding.errors.examsRequired"));
      return;
    }
    setSaving(true);
    try {
      await auth.updateMe({
        cv_url: cvUrl,
        specialized_exam_types: selectedExams,
      });
      toast.success(t("pages:educatorOnboarding.success"));
      navigate(createPageUrl("EducatorDashboard"), { replace: true });
    } catch {
      toast.error(t("pages:educatorOnboarding.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (isLoadingAuth || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="max-w-3xl mx-auto py-12">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          {/* Başlık */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {t("pages:educatorOnboarding.title")}
            </h1>
            <p className="text-slate-600">
              {t("pages:educatorOnboarding.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Bölüm 1: CV yükleme */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
                  1
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("pages:educatorOnboarding.cvSection.title")}
                </h2>
              </div>
              <p className="text-sm text-slate-500 mb-4 ml-11">
                {t("pages:educatorOnboarding.cvSection.desc")}
              </p>
              <div className="ml-11">
                {cvUrl ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-900">
                        {t("pages:educatorOnboarding.cvSection.uploaded")}
                      </p>
                      <a
                        href={cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        {t("pages:educatorOnboarding.cvSection.viewFile")}
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("cv-onboarding").click()}
                      disabled={uploadingCv}
                    >
                      {t("pages:educatorOnboarding.cvSection.change")}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => document.getElementById("cv-onboarding").click()}
                    disabled={uploadingCv}
                    className="w-full p-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex flex-col items-center gap-2">
                      {uploadingCv ? (
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-slate-400" />
                      )}
                      <p className="text-sm font-medium text-slate-900">
                        {uploadingCv
                          ? t("pages:educatorOnboarding.cvSection.uploading")
                          : t("pages:educatorOnboarding.cvSection.upload")}
                      </p>
                      <p className="text-xs text-slate-500">{t("pages:educatorOnboarding.cvSection.format")}</p>
                    </div>
                  </button>
                )}
                <input
                  id="cv-onboarding"
                  type="file"
                  accept=".pdf"
                  onChange={handleCvUpload}
                  className="hidden"
                />
              </div>
            </section>

            {/* Bölüm 2: Uzmanlık alanları */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
                  2
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("pages:educatorOnboarding.expertiseSection.title")}
                </h2>
              </div>
              <p className="text-sm text-slate-500 mb-4 ml-11">
                {t("pages:educatorOnboarding.expertiseSection.desc")}
              </p>
              <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                {examTypes.map((exam) => {
                  const checked = selectedExams.includes(exam.id);
                  return (
                    <label
                      key={exam.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        checked
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleExam(exam.id)}
                      />
                      <div className="flex-1">
                        {/* exam.name user-generated — çevrilmez */}
                        <p className="font-medium text-slate-900 text-sm">{exam.name}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {examTypes.length === 0 && (
                <p className="ml-11 text-center text-slate-500 py-4 text-sm">
                  {t("pages:educatorOnboarding.expertiseSection.empty")}
                </p>
              )}
              {selectedExams.length > 0 && (
                <p className="ml-11 mt-3 text-xs text-indigo-600">
                  {t("pages:educatorOnboarding.expertiseSection.selectedCount", {
                    count: selectedExams.length,
                  })}
                </p>
              )}
            </section>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t("pages:educatorOnboarding.requiredHint")}
              </div>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={saving || !cvUrl || selectedExams.length === 0}
              >
                {saving
                  ? t("pages:educatorOnboarding.saving")
                  : t("pages:educatorOnboarding.submit")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
