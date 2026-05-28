# Sınav Salonu — Yasal Metinler (PLACEHOLDER)

> ⚠️ **UYARI:** Bu dizindeki tüm sözleşme metinleri **şablondur**. Üretime
> alınmadan önce Türkiye hukuku konusunda yetkin bir avukat tarafından
> incelenmeli ve onaylanmalıdır. Yasal yükümlülükler (KVKK, TKHK, TBK)
> şirket türüne, hizmet kapsamına ve fiyatlama modeline göre değişir.

## Dosyalar ve hangi akışta tetiklenir

| Dosya | ContractType | Tetikleme noktası | Yasal dayanak |
|---|---|---|---|
| `uyelik-sozlesmesi.md` | `CANDIDATE` | Register (her kullanıcı) | TBK, e-ticaret kanunu |
| `kvkk-aydinlatma.md` | `PRIVACY` | Register (her kullanıcı) | KVKK m.10 |
| `mesafeli-satis-sozlesmesi.md` | `DISTANCE_SALE` | Her satın alma | TKHK m.48, Mesafeli Sözleşmeler Yönetmeliği |
| `egitici-hizmet-sozlesmesi.md` | `EDUCATOR` | Eğitici kaydı (`RegisterEducatorUseCase`) | TBK, eser sahipliği |

## Seed davranışı

`apps/backend/src/nest/bootstrap/seed.service.ts` her sistem boot'unda
4 contract'ı idempotent şekilde upsert eder. Admin paneli (`/yonetim/sozlesmeler`)
metinleri runtime'da güncelleyebilir; yeni versiyon `version` alanı +1 ile
yayımlanır, eski versiyon `isActive=false` olur.

## Versiyon politikası

- Tek tip için aynı anda **tek `isActive=true`** kayıt olabilir.
- Versiyon değişiminde eski acceptance'lar **korunur** (kanıt zinciri).
- Sprint 14 kapsamında re-acceptance modal'ı YOK (Kademe 4'e ertelendi).
  Kullanıcı eski versiyona onaylıyken yeni satın alma yaptığında, satın alma
  akışı yine taze `DISTANCE_SALE` onayı zorunlu kılar (her purchase için).

## Production checklist

- [ ] Avukat tüm 4 metni gözden geçirdi
- [ ] Şirket bilgileri (unvan, MERSİS, KEP, adres, vergi numarası) doğru
- [ ] Veri saklama süreleri KVKK Veri Saklama Politikası ile tutarlı
- [ ] İletişim bilgileri (DPO/aydınlatma sorumlusu) güncel
- [ ] Cayma hakkı dijital içerik istisnası madde 15/1-(ğ) doğru uygulandı
- [ ] Komisyon oranı eğitici sözleşmesinde net belirtildi
- [ ] Uyuşmazlık çözümü maddesi (tüketici hakem heyeti, mahkeme) net
