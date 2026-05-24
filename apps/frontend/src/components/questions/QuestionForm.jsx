/**
 * Paylaşılan soru formu — CreateTest wizard ve EditTest tarafından kullanılır.
 * Export: ImageUploadButton, QuestionForm
 */
import { useState } from "react";
import api from "@/lib/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TopicCombobox } from "@/components/ui/TopicCombobox";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LETTERS = ["A", "B", "C", "D", "E"];

// ─── Görsel yükleme butonu ────────────────────────────────────────────────────
export function ImageUploadButton({ onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sadece görsel dosyası yükleyebilirsiniz");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Dosya 5MB'dan küçük olmalı");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onUploaded(data.url || data.fileUrl || data.file_url || "");
    } catch {
      toast.error("Görsel yüklenemedi");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <label
      className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
        border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors
        ${uploading ? "opacity-50 pointer-events-none" : ""}`}
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ImagePlus className="w-3.5 h-3.5" />
      )}
      {uploading ? "Yükleniyor..." : "Görsel"}
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </label>
  );
}

// ─── Soru formu ───────────────────────────────────────────────────────────────
/**
 * @param {object}   question     - Düzenlenen soru (null → yeni soru)
 * @param {object[]} options      - Mevcut şıklar
 * @param {object[]} topicList    - Konu listesi [{id, name, parentName?}]
 * @param {function} onSave       - Kaydet callback'i (formData) => void
 * @param {function} onCancel     - İptal callback'i
 * @param {boolean}  isLoading    - Kaydetme yükleniyor mu
 * @param {string}   saveLabel    - Kaydet butonu etiketi
 */
export function QuestionForm({
  question,
  options = [],
  topicList = [],
  onSave,
  onCancel,
  isLoading,
  saveLabel = "Kaydet",
}) {
  const initOptions = (options || []).map((o) => ({
    id: o.id,
    content: o.content,
    mediaUrl: o.mediaUrl ?? null,
    isCorrect: o.isCorrect ?? o.is_correct ?? false,
  }));
  while (initOptions.length < 5) {
    initOptions.push({ content: "", mediaUrl: null, isCorrect: false });
  }

  const [data, setData] = useState(
    question
      ? {
          question_text: question.content ?? "",
          question_mediaUrl: question.mediaUrl ?? null,
          order: question.order ?? 0,
          topicId: question.topicId ?? null,
          solutionText: question.solutionText ?? "",
          solutionMediaUrl: question.solutionMediaUrl ?? null,
          options: initOptions,
          correct_answer:
            LETTERS[initOptions.findIndex((o) => o.isCorrect)] || "A",
        }
      : {
          question_text: "",
          question_mediaUrl: null,
          order: 0,
          topicId: null,
          solutionText: "",
          solutionMediaUrl: null,
          options: initOptions,
          correct_answer: "A",
        }
  );

  const opts = data.options;

  // Dolu olan şık harfleri (içerik veya görsel olan)
  const filledLetters = LETTERS.filter(
    (_, i) => (opts[i]?.content || "").trim() || opts[i]?.mediaUrl
  );

  const setOpt = (i, patch) =>
    setData((d) => ({
      ...d,
      options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    }));

  const handleSave = () => {
    if (!data.question_text?.trim() && !data.question_mediaUrl) {
      toast.error("Soru metni veya görseli girin");
      return;
    }
    const hasA = (opts[0]?.content || "").trim() || opts[0]?.mediaUrl;
    const hasB = (opts[1]?.content || "").trim() || opts[1]?.mediaUrl;
    if (!hasA || !hasB) {
      toast.error("A ve B şıkları zorunludur");
      return;
    }

    const correctIdx = LETTERS.indexOf(data.correct_answer);
    if (
      !((opts[correctIdx]?.content || "").trim() || opts[correctIdx]?.mediaUrl)
    ) {
      toast.error(`Doğru cevap ${data.correct_answer} şıkkı boş olamaz`);
      return;
    }

    const finalOpts = opts
      .map((o, i) => ({
        content: o.content || "",
        mediaUrl: o.mediaUrl || null,
        isCorrect: data.correct_answer === LETTERS[i],
      }))
      .filter((o) => o.content.trim() || o.mediaUrl);

    if (finalOpts.length < 2) {
      toast.error("En az 2 şık girin");
      return;
    }

    onSave({
      question_text: data.question_text,
      question_mediaUrl: data.question_mediaUrl,
      order: data.order,
      topicId: data.topicId || null,
      correct_answer: data.correct_answer,
      solutionText: data.solutionText || "",
      solutionMediaUrl: data.solutionMediaUrl || null,
      options: finalOpts,
    });
  };

  return (
    <div className="border border-indigo-200 rounded-xl p-6 bg-indigo-50/40">
      <h3 className="font-semibold text-slate-900 mb-4">
        {question ? "Soruyu Düzenle" : "Yeni Soru"}
      </h3>

      <div className="space-y-4">
        {/* Soru metni */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Soru Metni *</Label>
            <ImageUploadButton
              onUploaded={(url) =>
                setData((d) => ({ ...d, question_mediaUrl: url }))
              }
            />
          </div>
          <Textarea
            value={data.question_text}
            onChange={(e) =>
              setData((d) => ({ ...d, question_text: e.target.value }))
            }
            rows={3}
            placeholder="Soruyu buraya yazın..."
          />
          {data.question_mediaUrl && (
            <div className="relative inline-block">
              <img
                src={data.question_mediaUrl}
                alt="Soru görseli"
                className="max-h-48 rounded-lg border border-slate-200"
              />
              <button
                type="button"
                onClick={() =>
                  setData((d) => ({ ...d, question_mediaUrl: null }))
                }
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Şıklar */}
        <div className="grid grid-cols-1 gap-3">
          {LETTERS.map((letter, i) => (
            <div
              key={letter}
              className="space-y-1.5 p-3 bg-white rounded-lg border border-slate-200"
            >
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  {letter} Şıkkı{" "}
                  <span className="text-slate-400 font-normal">
                    {i < 2 ? "*" : "(Opsiyonel)"}
                  </span>
                </Label>
                <ImageUploadButton
                  onUploaded={(url) => setOpt(i, { mediaUrl: url })}
                />
              </div>
              <Input
                value={opts[i]?.content ?? ""}
                onChange={(e) => setOpt(i, { content: e.target.value })}
                placeholder={`${letter} şıkkını yazın...`}
              />
              {opts[i]?.mediaUrl && (
                <div className="relative inline-block">
                  <img
                    src={opts[i].mediaUrl}
                    alt={`${letter} görseli`}
                    className="max-h-32 rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setOpt(i, { mediaUrl: null })}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Konu seçici — arama destekli combobox, ağaç yolu görünür */}
        {topicList.length > 0 && (
          <div className="space-y-2">
            <Label>
              Konu{" "}
              <span className="text-slate-400 font-normal">(opsiyonel)</span>
            </Label>
            <TopicCombobox
              value={data.topicId ?? null}
              onChange={(id) => setData((d) => ({ ...d, topicId: id }))}
              topics={topicList}
              placeholder="Konu seçin..."
              searchPlaceholder="Konu ara (örn. Sayılar)..."
            />
          </div>
        )}

        {/* Doğru cevap */}
        <div className="space-y-2">
          <Label>Doğru Cevap *</Label>
          <Select
            value={
              filledLetters.includes(data.correct_answer)
                ? data.correct_answer
                : filledLetters[0] || "A"
            }
            onValueChange={(v) => {
              const next = opts.map((o, i) => ({
                ...o,
                isCorrect: v === LETTERS[i],
              }));
              setData((d) => ({ ...d, correct_answer: v, options: next }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(filledLetters.length > 0 ? filledLetters : LETTERS.slice(0, 2)).map(
                (l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Çözüm (opsiyonel) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>
              Çözüm Açıklaması{" "}
              <span className="text-slate-400 font-normal">(opsiyonel)</span>
            </Label>
            <ImageUploadButton
              onUploaded={(url) =>
                setData((d) => ({ ...d, solutionMediaUrl: url }))
              }
            />
          </div>
          <Textarea
            value={data.solutionText}
            onChange={(e) =>
              setData((d) => ({ ...d, solutionText: e.target.value }))
            }
            rows={2}
            placeholder="Sorunun çözüm açıklaması (öğrenci cevapladıktan sonra gösterilir)..."
          />
          {data.solutionMediaUrl && (
            <div className="relative inline-block">
              <img
                src={data.solutionMediaUrl}
                alt="Çözüm görseli"
                className="max-h-32 rounded-lg border border-slate-200"
              />
              <button
                type="button"
                onClick={() =>
                  setData((d) => ({ ...d, solutionMediaUrl: null }))
                }
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Butonlar */}
        <div className="flex gap-3 justify-end pt-1">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              İptal
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? "Kaydediliyor..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
