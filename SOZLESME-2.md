# Veri sözleşmesi 2 (PR #4, offline geliştirme)

`docs/v1/vakitler/{ilceId}.json` için **geriye uyumlu** genişleme. v1 alanları (`guncelleme`, `gunler`) aynen kalır. Mevcut okuyucular bilinmeyen alanları yok sayar (Android `ignoreUnknownKeys`, iOS `Decodable`). Bu, `eskiOkuyucuKabul` taklidiyle test edilir.

```json
{
  "guncelleme": "2026-11-28T05:00:00.000Z",
  "gunler": [{ "t": "28.11.2026", "v": ["06:12","07:43","12:41","15:12","17:31","18:56"], "h": "…" }],
  "sozlesme": 2,
  "kaynak": { "tur": "resmi-yillik", "uc": "DateRange", "alindi": "2026-11-28T05:00:00.000Z", "resmiId": 9541, "calisma": { "runId": "…", "commit": "…" } },
  "gecerlilik": { "ilk": "2026-11-28", "son": "2027-11-27" },
  "duzeltmeler": [],
  "dogrulama": { "zaman": "…Z", "uc": "Monthly", "ilk": "2026-11-29", "son": "2026-12-30", "gun": 32, "sonuc": "esit", "calisma": { "runId": "…" } },
  "surum": "sha256:<64 hex>"
}
```

## Alanların kesin anlamları
| Alan | Anlam |
|---|---|
| `sozlesme` | 2. Bu alan yoksa dosya v1 kurallarına tabidir. |
| `kaynak.tur` | `resmi-yillik` (DateRange temelli) · `resmi-aylik` · `ayna`. |
| `kaynak.uc` | Temel verinin geldiği uç. `resmi-yillik` için yalnız `DateRange`. |
| `kaynak.alindi` | Temel verinin resmî API'den **alındığı an** (yanıt zamanı, UTC Z). Diyanet'in kendi yayın zamanı bilinmediği için uydurulmaz. Geriye gidemez: daha eski bir alım yeni veriyi ezemez. |
| `kaynak.calisma` | Veriyi alan çalışma: `runId` (GitHub Actions run kimliği) ve `commit`. |
| `kaynak.resmiId` | Resmî Awqat cityId (eşleme tablosu). |
| `gecerlilik.ilk` / `.son` | `gunler` dizisindeki ilk ve son gün (ISO). Dizi kesintisiz olmalı; doğrulayıcı eşitliği zorunlu tutar. |
| `duzeltmeler` | Temel alımdan sonra Monthly ile yapılan içerik düzeltmeleri: `{zaman, uc, ilk, son, gun, calisma}`. Zaman sırasında, en çok 10 kayıt. |
| `dogrulama.zaman` | En son resmî karşılaştırmanın yanıt zamanı. Sürümden (`guncelleme`) eski olamaz, yalnız ileri gider. |
| `dogrulama.ilk` / `.son` / `.gun` | **Yalnız karşılaştırılan** aralık ve gün sayısı. 32 günlük bir Monthly, 365 günün tamamını doğrulamaz. |
| `dogrulama.sonuc` | `esit` (fark yok) · `duzeltildi` (fark bulundu ve resmî değerle yeni sürüm üretildi). |
| `surum` | `"sha256:" + hex(SHA-256(kanonik metin))` (tam değer). Kanonik metin: her gün bir satır, `YYYY-MM-DD HH:MM HH:MM HH:MM HH:MM HH:MM HH:MM\n`, tarih sırasıyla, UTF-8, son satır dahil. Hicri metin dahil değildir. Test vektörleri `test/vektorler/surum.json` (Swift/Kotlin için). |
| `guncelleme` | Vakit **içeriğinin** (`surum`) en son değiştiği an = `max(kaynak.alindi, duzeltmeler[].zaman)`. Yalnız doğrulama ya da meta veri değiştiğinde **ilerlemez**. |
| `gunler` | v1 ile aynı. |

## Geçiş kuralları (üretici ve bağımsız doğrulayıcı aynı kuralları uygular)
- **Aynı `surum`:** `guncelleme`, `kaynak`, `gecerlilik`, `duzeltmeler` ve `gunler` aynen kalır; `dogrulama` ilerlemelidir. Sonuç: `dogrulandi`.
- **Farklı `surum`:** `guncelleme` ilerlemelidir ve bu çalışmada alınmış olmalıdır. `kaynak.alindi` geriye gidemez. Sonuç: `yenilendi`.
- **v1 → sözleşme 2:** `guncelleme` geriye gidemez. Sözleşme 2 → v1 dönüşü yasaktır.

## 14 günlük mobil kuralıyla ilişki
Mevcut v1 okuyucuları `guncelleme` 14 günden eskiyse **yeni indirmeyi** reddeder; önbellekteki veriyi kullanmaya devam eder (statik kod okuması, gerçek cihazda doğrulanmadı). `guncelleme` yalnız içerik değiştiğinde ilerlediği için:
- yeni yayımlanan ya da düzeltilen yıllık dosya 14 gün boyunca eski okuyucularca indirilebilir,
- sonra eski okuyucu yeni indirmeyi reddeder.

**Sahte damga üretilmez.** Herkese açık yayından önce mobil v2 politikası gereklidir (D13, D15). Uygulamalar şu an yalnız kapalı testte.

## Mobil v2 geçerlilik politikası — teknik taslak (mobil kod değiştirilmedi)
Yalnız `sozlesme ≥ 2` ve `kaynak.tur == "resmi-yillik"` dosyalar için:
1. **Kimlik:** dosya istenen ilçe için (`cityId`) ve `kaynak.resmiId` eşleme ile uyumlu.
2. **Bütünlük:** cihazda `surum` yeniden hesaplanır ve eşit olmalı (bozuk/eksik indirmeye karşı).
3. **Kapsam:** bugün ve yarın `gunler` içinde; `gecerlilik.son ≥ yarın`.
4. **Kaynak yaşı:** `kaynak.alindi` gelecekte değil (+5 dk) ve en çok **N gün** eski (taslak 400).
5. **Geriye gidiş yok:** yeni dosyanın `guncelleme` değeri önbellektekinden eski olamaz. `surum` farklıysa daha yeni `guncelleme` şartı aranır.
6. **Doğrulama yaşı reddetmez:** `dogrulama.zaman` **M gün** eskiyse (taslak 120) veri gösterilir ve "Son resmî doğrulama: <tarih>" uyarısı çıkar.
7. **14 gün kuralı:** ayna, `resmi-aylik` ve `sozlesme` alanı olmayan dosyalar için aynen kalır.
8. **Bildirim, widget ve Live Activity:** yalnız 1–5 kurallarını geçen önbellekten planlanır. Geçerlilik sonu yaklaşınca mevcut "veri bitiyor" uyarısı kullanılır.

N ve M kesin değildir; kota ölçümü, resmî güncelleme koşulları ve gerçek cihaz testinden sonra belirlenir.

Sunucu tarafı: `esik.mjs` `SUNUCU_MOBIL_POLITIKA = "v1"`. v2 sınıflandırması yalnız taslak olarak test edilir. Mobil v2 yayımlanınca gözden geçirilmiş bir değişiklikle açılır.

## Arşiv
Arşiv kaydı (`yillik.mjs` `arsivKaydi`) yayın dosyasından ayrıdır. İçeriği:
- `v1Id`, `resmiId`, `uc`, `alindi`, `calisma`, `gecerlilik`, `surum`,
- ham yanıtın özeti `hamOzet`,
- hicri alanlarla birlikte `gunler`.

Kalıcı yeri ve yeniden yayın izni kesinleşmeden (D11) canlı yazılmaz.
