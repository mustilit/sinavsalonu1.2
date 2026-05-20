import { useState, useMemo } from "react";
import { entities } from "@/api/dalClient";
import api from "@/lib/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Percent, Copy, Search, X, PowerOff, Power } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { tr } from "date-fns/locale";

/**
 * MyDiscountCodes (İndirim Kodlarım) sayfası — eğiticinin kendi test
 * paketleri için indirim kodu oluşturmasını, listelemesini ve silmesini sağlar.
 * Kodlar eğiticinin e-postasına bağlıdır; maksimum indirim oranı %50 ile sınırlandırılmıştır.
 */
export default function MyDiscountCodes() {
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toUpperCase() === "ADMIN";
  // Yeni kod oluşturma diyaloğunun açık/kapalı durumu
  const [showDialog, setShowDialog] = useState(false);
  // Yeni kod formu alanları; varsayılan değerler: %10 indirim, 100 kullanım hakkı
  const [formData, setFormData] = useState({
    code: "",
    discount_percent: 10,
    max_uses: 100,
    test_package_id: "",
    valid_until: ""
  });
  // Filtre durumu
  const [filters, setFilters] = useState({
    search: "",
    minPercent: "",
    maxPercent: "",
    dateFrom: "",
    dateTo: "",
  });
  const queryClient = useQueryClient();

  // Admin tüm kodları görür; eğitici yalnızca kendi oluşturduklarını
  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["discountCodes", isAdmin ? "ALL" : user?.email],
    queryFn: () =>
      isAdmin
        ? entities.DiscountCode.adminFilter()
        : entities.DiscountCode.filter({ educator_email: user.email }, "-created_date"),
    enabled: !!user,
  });

  // Admin tarafından belirlenen maksimum indirim sınırı.
  // /site/service-status public endpoint — eğitici dahil tüm roller okuyabilir.
  const { data: serviceStatus } = useQuery({
    queryKey: ["serviceStatus"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/site/service-status");
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
  const maxDiscountForEducator = serviceStatus?.maxDiscountPercent ?? 50;
  // Admin'in kendisi sınırla kısıtlı değildir (1-100 arası)
  const effectiveMaxDiscount = isAdmin ? 100 : maxDiscountForEducator;

  // Aktif filtre sayısını hesapla (rozet için)
  const activeFilterCount = [filters.search, filters.minPercent, filters.maxPercent, filters.dateFrom, filters.dateTo]
    .filter(Boolean).length;

  // Filtrelenmiş kod listesi — tüm filtreler istemci tarafında uygulanır
  const filteredCodes = useMemo(() => {
    return codes.filter((c) => {
      // Kod numarası / metin araması
      if (filters.search && !c.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
      // İndirim oranı aralığı (backend alanı: percentOff veya discount_percent)
      const pct = c.percentOff ?? c.discount_percent ?? 0;
      if (filters.minPercent !== "" && pct < Number(filters.minPercent)) return false;
      if (filters.maxPercent !== "" && pct > Number(filters.maxPercent)) return false;
      // Tarih aralığı — kodun geçerlilik başlangıç tarihine (validFrom/valid_from) göre filtrele
      const refDate = c.createdAt ?? c.created_date;
      if (refDate) {
        const d = new Date(refDate);
        if (filters.dateFrom && d < startOfDay(parseISO(filters.dateFrom))) return false;
        if (filters.dateTo   && d > endOfDay(parseISO(filters.dateTo)))     return false;
      }
      return true;
    });
  }, [codes, filters]);

  const clearFilters = () => setFilters({ search: "", minPercent: "", maxPercent: "", dateFrom: "", dateTo: "" });

  // Kod oluşturma formunda belirli bir teste kısıtlama yapılabilmesi için eğiticinin testleri
  const { data: myTests = [] } = useQuery({
    queryKey: ["myTests", user?.email],
    queryFn: () => entities.TestPackage.filter({ educator_owns: true }),
    enabled: !!user,
  });

  // Kodu backend'e kaydeder; rol bazlı endpoint seçilir
  const createMutation = useMutation({
    mutationFn: (data) =>
      isAdmin
        ? entities.DiscountCode.adminCreate(data)
        : entities.DiscountCode.create({
            ...data,
            educator_email: user.email,
            current_uses: 0,
            is_active: true,
          }),
    onSuccess: () => {
      toast.success("İndirim kodu oluşturuldu");
      queryClient.invalidateQueries({ queryKey: ["discountCodes"] });
      setShowDialog(false);
      setFormData({ code: "", discount_percent: 10, max_uses: 100, test_package_id: "", valid_until: "" });
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.message || "İndirim kodu oluşturulamadı";
      toast.error(msg);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => isAdmin ? entities.DiscountCode.adminToggle(id) : entities.DiscountCode.toggle(id),
    onSuccess: (data) => {
      const msg = data?.isActive ? "İndirim kodu aktive edildi" : "İndirim kodu pasife alındı";
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["discountCodes"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "İşlem başarısız");
    },
  });

  // Formu doğrular ve kodu oluşturur.
  // Eğitici için: admin tarafından belirlenen `maxDiscountPercent` üst sınırı zorunlu.
  // Admin için: 1-100 aralığında esnek (admin override).
  const handleSubmit = () => {
    if (!formData.code || formData.discount_percent < 1) {
      toast.error("Lütfen gerekli alanları doldurun");
      return;
    }
    if (formData.discount_percent > effectiveMaxDiscount) {
      toast.error(`İndirim oranı maksimum %${effectiveMaxDiscount} olabilir`);
      return;
    }
    createMutation.mutate(formData);
  };

  // Kodu panoya kopyalar ve kullanıcıya bildirim gösterir
  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success("Kod kopyalandı");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isAdmin ? "İndirim Kodları" : "İndirim Kodlarım"}
          </h1>
          <p className="text-slate-500 mt-2">
            {isAdmin
              ? "Tüm eğitici ve admin indirim kodlarını yönet"
              : "Test paketlerin için indirim kodları oluştur"}
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Kod
        </Button>
      </div>

      {/* Filtre Paneli */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Kod arama */}
            <div className="flex-1 min-w-[160px] space-y-1">
              <Label className="text-xs text-slate-500">Kod</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Kod ara…"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>

            {/* İndirim oranı aralığı */}
            <div className="space-y-1 min-w-[80px]">
              <Label className="text-xs text-slate-500">Min % İndirim</Label>
              <Input
                type="number"
                min="1"
                max="50"
                className="h-9 text-sm w-24"
                placeholder="1"
                value={filters.minPercent}
                onChange={(e) => setFilters((f) => ({ ...f, minPercent: e.target.value }))}
              />
            </div>
            <div className="space-y-1 min-w-[80px]">
              <Label className="text-xs text-slate-500">Max % İndirim</Label>
              <Input
                type="number"
                min="1"
                max="50"
                className="h-9 text-sm w-24"
                placeholder="50"
                value={filters.maxPercent}
                onChange={(e) => setFilters((f) => ({ ...f, maxPercent: e.target.value }))}
              />
            </div>

            {/* Oluşturma tarihi aralığı */}
            <div className="space-y-1 min-w-[140px]">
              <Label className="text-xs text-slate-500">Başlangıç Tarihi</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-1 min-w-[140px]">
              <Label className="text-xs text-slate-500">Bitiş Tarihi</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>

            {/* Filtreleri temizle */}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-9 text-slate-500 hover:text-slate-800 gap-1.5" onClick={clearFilters}>
                <X className="w-3.5 h-3.5" />
                Temizle
                <Badge className="bg-indigo-100 text-indigo-700 ml-0.5">{activeFilterCount}</Badge>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-12">
              <Percent className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Henüz indirim kodu oluşturmadınız</p>
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Filtreyle eşleşen kod bulunamadı</p>
              <Button variant="link" className="text-indigo-600 mt-1" onClick={clearFilters}>Filtreleri temizle</Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCodes.map((code) => (
                <div key={code.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                      <Percent className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-slate-900">{code.code}</p>
                        <button onClick={() => copyCode(code.code)} className="text-slate-400 hover:text-slate-600">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-500">
                        %{code.percentOff ?? code.discount_percent} indirim • {code.usedCount ?? code.current_uses ?? 0}/{code.maxUses ?? code.max_uses ?? "∞"} kullanım
                      </p>
                      {isAdmin && code.creatorUsername && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Oluşturan:{" "}
                          <span className="font-medium text-slate-600">{code.creatorUsername}</span>
                          {code.creatorRole && (
                            <Badge className={`ml-1.5 ${code.creatorRole === "ADMIN" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {code.creatorRole === "ADMIN" ? "Yönetici" : "Eğitici"}
                            </Badge>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={(() => {
                      const active  = code.isActive ?? code.is_active ?? true;
                      const used    = code.usedCount ?? code.current_uses ?? 0;
                      const max     = code.maxUses  ?? code.max_uses;
                      const expired = code.validUntil && new Date(code.validUntil) < new Date();
                      const full    = max != null && used >= max;
                      return (active && !expired && !full) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
                    })()}>
                      {(() => {
                        const active  = code.isActive ?? code.is_active ?? true;
                        const used    = code.usedCount ?? code.current_uses ?? 0;
                        const max     = code.maxUses  ?? code.max_uses;
                        const expired = code.validUntil && new Date(code.validUntil) < new Date();
                        if (!active)                    return "Pasif";
                        if (expired)                    return "Süresi Doldu";
                        if (max != null && used >= max) return "Limit Doldu";
                        return "Aktif";
                      })()}
                    </Badge>
                    {(code.validUntil ?? code.valid_until) && (
                      <span className="text-sm text-slate-500">
                        {format(new Date(code.validUntil ?? code.valid_until), "d MMM yyyy", { locale: tr })}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={toggleMutation.isPending}
                      className={code.isActive ?? code.is_active ? "text-slate-400 hover:text-rose-600" : "text-emerald-600 hover:text-emerald-700"}
                      title={code.isActive ?? code.is_active ? "Pasife al" : "Aktive et"}
                      onClick={() => toggleMutation.mutate(code.id)}
                    >
                      {code.isActive ?? code.is_active
                        ? <PowerOff className="w-4 h-4" />
                        : <Power className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni İndirim Kodu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>İndirim Kodu *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Örn: YENI2024"
                className="uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>İndirim Oranı (%) *</Label>
                <Input
                  type="number"
                  min="1"
                  max={effectiveMaxDiscount}
                  value={formData.discount_percent}
                  onChange={(e) => setFormData({ ...formData, discount_percent: Number(e.target.value) })}
                />
                <p className="text-xs text-slate-500">
                  Maksimum %{effectiveMaxDiscount}
                  {isAdmin && " (admin override)"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Kullanım Limiti</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Geçerli Test (Opsiyonel)</Label>
              <Select value={formData.test_package_id} onValueChange={(v) => setFormData({ ...formData, test_package_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Tüm testler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Tüm testler</SelectItem>
                  {myTests.map((test) => (
                    <SelectItem key={test.id} value={test.id}>{test.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Geçerlilik Tarihi (Opsiyonel)</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Oluştur
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}