import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * PackageCoverUpload — eğiticinin paket kapak görselini yüklediği bileşen.
 *
 * - Yükleme: PNG/JPG/WebP, max 5MB.
 * - Live preview: TestDetail hero ve TestPackageCard'daki görünümü taklit eder.
 * - value boşsa default gradient + BookOpen ikonu gösterilir (kullanıcının paketi
 *   üretimde nasıl görüneceğini önceden anlaması için).
 */
export default function PackageCoverUpload({ value, onChange, titlePreview = "", difficulty = "medium" }) {
  const { t } = useTranslation(["pages"]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error(t("pages:testForm.package.cover.errors.invalidFormat"));
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("pages:testForm.package.cover.errors.tooBig"));
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const url = res.data.url || res.data.fileUrl || res.data.file_url;
      if (!url) throw new Error("upload returned no url");
      onChange(url);
      toast.success(t("pages:testForm.package.cover.uploaded"));
    } catch {
      toast.error(t("pages:testForm.package.cover.errors.uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange("");
  };

  const difficultyLabel = t(`pages:testCard.difficulty.${difficulty}`);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">{t("pages:testForm.package.cover.label")}</label>
      <p className="text-xs text-slate-500 -mt-1">{t("pages:testForm.package.cover.hint")}</p>

      {/* Hero preview — TestDetail'daki gibi görünür */}
      <div
        className="relative h-48 rounded-2xl overflow-hidden"
        style={{ backgroundColor: value ? "transparent" : "#0000CD" }}
      >
        {value ? (
          <img src={value} alt={titlePreview || "preview"} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-20 h-20 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 right-4">
          <Badge className="bg-white/90 text-amber-700">{difficultyLabel}</Badge>
        </div>
        <div className="absolute bottom-4 left-4 right-24">
          {/* titlePreview user-generated */}
          <h3 className="text-xl font-bold text-white truncate">
            {titlePreview || t("pages:testForm.package.cover.previewTitleFallback")}
          </h3>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
          id="package-cover-input"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("pages:testForm.package.cover.uploading")}</>
          ) : (
            <><ImagePlus className="w-4 h-4 mr-2" />{value ? t("pages:testForm.package.cover.change") : t("pages:testForm.package.cover.upload")}</>
          )}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
            <X className="w-4 h-4 mr-1" />
            {t("pages:testForm.package.cover.remove")}
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-400">{t("pages:testForm.package.cover.format")}</p>
    </div>
  );
}
