# KVKK Aydınlatma Metni

> ⚠️ ŞABLON METİN — PRODUCTION ÖNCESİ AVUKAT ONAYI GEREKLİ

**Yürürlük tarihi:** [TARİH]
**Versiyon:** 1

## 1. Veri Sorumlusu

İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu
("KVKK") m.10 uyarınca Veri Sorumlusu sıfatıyla [ŞİRKET UNVANI]
(MERSİS: [NO], adres: [ADRES]) tarafından hazırlanmıştır.

## 2. İşlenen Kişisel Veriler

### Hesap verileri
- E-posta adresi
- Kullanıcı adı
- Ad / soyad (eğitici hesapları için zorunlu, aday için opsiyonel)
- Hesap parolası (geri döndürülemez şekilde hash'lenir — bcrypt)
- Profil fotoğrafı (yüklediğiniz takdirde)

### Kullanım verileri
- Giriş zamanı, IP adresi, tarayıcı bilgisi (cihaz parmak izi)
- Sınav çözüm performansı (doğru/yanlış sayısı, süre, konu dağılımı)
- Satın alma geçmişi
- Bildirim tercihleri

### Ödeme verileri
- Fatura adresi
- Kart bilgileri **Sınav Salonu'nda saklanmaz**; Iyzico / Stripe gibi PCI-DSS
  uyumlu ödeme sağlayıcıları işler. Sadece son 4 hane ve ödeme referans ID
  saklanır.

### İletişim verileri
- Destek talebi yazışmaları
- KVKK başvuru / cayma / iade talepleri

## 3. İşleme Amaçları

| Amaç | Hukuki sebep |
|---|---|
| Hizmet sunma (sınav çözme, satın alma) | Sözleşmenin kurulması (KVKK m.5/2-c) |
| Faturalandırma + muhasebe | Yasal yükümlülük (V.U.K.) |
| Müşteri destek + şikayet çözme | Meşru menfaat (KVKK m.5/2-f) |
| Güvenlik (brute force, fraud) | Meşru menfaat |
| Pazarlama e-postası, kampanya | **Açık rıza** (KVKK m.5/1) — ayrı checkbox |
| Yasal başvuru / mahkeme talebi | Yasal yükümlülük |

## 4. Aktarımlar

Verileriniz aşağıdaki üçüncü taraflara aktarılabilir:

| Alıcı | Amaç | Yer |
|---|---|---|
| Iyzico / Stripe | Ödeme işleme | AB / Türkiye |
| Brevo (mail sağlayıcı) | Bilgilendirme + pazarlama e-postası | AB sunucular |
| Cloudflare / Vercel | Site hizmet altyapısı | Küresel CDN |
| Sentry | Hata izleme | AB (sentry.io EU region) |
| PostHog | Ürün analitiği (consent verdiyseniz) | AB |
| Yasal merciler | Mahkeme / KVKK Kurulu kararı | TR |

Yurtdışı aktarımları KVKK m.9 kapsamında değerlendirilmiştir.

## 5. Saklama Süreleri

| Veri kategorisi | Saklama süresi |
|---|---|
| Hesap verileri | Hesap aktifken + silme sonrası 30 gün (anti-fraud) |
| Satın alma kayıtları | 10 yıl (V.U.K.) |
| Mail içeriği (full HTML) | 90 gün, sonra anonimleştirilir (sadece metrik) |
| Audit log | 2 yıl |
| Sınav cevapları + skor | Hesap aktifken (sınırsız) |

Hesap silme talebinde KVKK ham kişisel veriler 30 gün içinde silinir;
anonim hale getirilmiş istatistik veriler (örn. konu başarı oranı, eğitici
puanı) korunur.

## 6. Haklarınız (KVKK m.11)

KVKK m.11 uyarınca aşağıdaki haklara sahipsiniz:

- Kişisel verilerinizin işlenip işlenmediğini öğrenme
- İşlenmişse buna ilişkin bilgi talep etme
- Verilerin amaca uygun kullanılıp kullanılmadığını öğrenme
- Yurt içi / yurt dışı aktarıldığı üçüncü kişileri öğrenme
- Eksik / yanlış işlenmişse düzeltilmesini isteme
- Silinmesini / yok edilmesini isteme
- Düzeltme / silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme
- Otomatik karar verme sistemleriyle aleyhine bir sonuç ortaya çıkmasına itiraz etme
- Kanuna aykırı işleme nedeniyle zarara uğramışsa tazmin talep etme

## 7. Başvuru

KVKK başvuruları için:
- E-posta: [KVKK_BASVURU_EMAIL]
- KEP: [KEP_ADRESI]
- Posta: [ADRES]

Başvuru en geç 30 gün içinde cevaplanır.

## 8. Çerez Politikası

Detaylı çerez bilgileri için [Çerez Politikası]'na bakınız.

---

**Üye, bu Aydınlatma Metni'ni okuduğunu ve KVKK m.10 kapsamında
bilgilendirildiğini kayıt sırasındaki onay ile beyan eder. Pazarlama
amaçlı işleme için ayrıca AÇIK RIZA verilmesi gerekir.**
