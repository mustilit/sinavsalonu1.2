import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

/**
 * PaginationBar — basit prev/next navigasyon + sayfa göstergesi.
 *
 * Client-side liste paging için kullanılır (Educators, MyTests,
 * EducatorProfile gibi sayfalarda zaten tüm veri belleğe çekilmiş).
 *
 * Props:
 *   - page         : mevcut sayfa (1-based)
 *   - totalPages   : toplam sayfa sayısı
 *   - onPageChange : (newPage: number) => void
 *
 * totalPages <= 1 ise hiçbir şey render etmez.
 */
export default function PaginationBar({ page, totalPages, onPageChange }) {
  const { t } = useTranslation(["common"]);
  if (!totalPages || totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-center gap-3 mt-8">
      <Button
        variant="outline"
        size="sm"
        disabled={!canPrev}
        onClick={() => canPrev && onPageChange(page - 1)}
        aria-label={t("common:pagination.previous")}
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        {t("common:pagination.previous")}
      </Button>
      <span className="text-sm text-slate-600 tabular-nums">
        {t("common:pagination.pageOf", { current: page, total: totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={!canNext}
        onClick={() => canNext && onPageChange(page + 1)}
        aria-label={t("common:pagination.next")}
      >
        {t("common:pagination.next")}
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}
