# Resmi API kontrollü pilotu — 3 ilçe (onay bekliyor)

Durum: hazır, ÇALIŞTIRILMADI. Çalıştırmak için kullanıcının açık onayı gerekir. Yayına (`docs/v1`), eşleme tablosuna ve
`main`'e hiçbir şey yazmaz; yalnız `golge/pilot-YYYY-AA-GG.json` raporu üretir (gitignore'da, commit edilmez).

## İlçeler
| v1 | İl / ilçe | Neden |
|---|---|---|
| 9541 | İstanbul / İstanbul (merkez) | En büyük kullanıcı kitlesi; ayna verisiyle gün gün karşılaştırma |
| 9206 | Ankara / Ankara (merkez) | İkinci karşılaştırma noktası |
| 33292 | Eskişehir / Mihalgazi | Aynada HTTP 502 → dosyası yok; resmi kaynak bu ilçeyi kurtarabilir mi |

## Kesin istek sayısı: 11 (kodla sabit, `PILOT_ISTEK`)
| # | İstek | Adet |
|---|---|---|
| 1 | `POST /Auth/Login` | 1 |
| 2 | `GET /api/Quota/My` (önce) | 1 |
| 3 | `GET /api/Place/Countries` | 1 |
| 4 | `GET /api/Place/States/{TürkiyeId}` | 1 |
| 5–7 | `GET /api/Place/Cities/{ilId}` (İstanbul, Ankara, Eskişehir) | 3 |
| 8–10 | `GET /api/PrayerTime/Monthly/{cityId}` | 3 |
| 11 | `GET /api/Quota/My` (sonra) | 1 |

- Her uç+parametre en çok 1 kez (Quota/My 2); belgelerdeki en katı sınır (günde 5) ve olası toplam 100'ün çok altında.
- **Tekrar yok**: 401, 403, 429, 5xx, zaman aşımı → ilk hatada durur (`tekrarYok: true`). Toplam sınır 11'de kod isteği göndermeden durdurur.
- Token yenileme çağrısı olmaz (pilot 25 dakikadan çok kısa sürer).

## Secret gereksinimleri
- `AWQAT_EMAIL`, `AWQAT_PASSWORD` — **kullanıcı girer**; koda, loga, rapora, sohbete girmez (rapor ve hata metinleri maskelenir).
- `ALLOW_LIVE_API=evet` — açık onay anahtarı; yoksa betik istek göndermeden çıkar (kod 2).
- Çalıştırma seçenekleri:
  - **A (önerilen): kullanıcının bilgisayarı, `scripts/resmi/pilot-calistir.ps1`.** Kimlik bilgisi makineden çıkmaz; şifre
    `Read-Host -AsSecureString` ile gizli alınır (komut geçmişine yazılmaz), yalnız o PowerShell sürecine ve node alt sürecine
    verilir, işlem sonunda ortam değişkenleri silinir ve bellek kopyası sıfırlanır. Ayrıntılı prosedür aşağıda.
  - B: GitHub Actions secret + yalnız elle tetiklenen pilot workflow'u. `workflow_dispatch` yalnız `main`'deki workflow dosyasıyla çalıştığı için ayrı onaylı bir merge gerektirir; bu yüzden şimdilik önerilmez.

## Karşılaştırma kriterleri (rapor `kriterler`)
| Kriter | Geçme koşulu | Kalırsa anlamı |
|---|---|---|
| K1 şema | 3 ilçede her günde `gregorianDateShort` + 6 vakit alanı var, biçim HH:MM, sıralı | Sözleşme/alan adları yanlış; adaptör güncellenmeli |
| K2 kapsam | 3 ilçede bugün..bugün+14 kesintisiz | Monthly takvim ayı olabilir; DateRange/Weekly değerlendirilir |
| K3 eşitlik | 9541 ve 9206'da en az 7 ortak günde 6 vaktin tamamı **dakikası dakikasına aynı** (tolerans 0) | `fajr`≠imsak veya farklı veri; geçiş durur, fark tablosu incelenir |
| K4 eşleme | 3 ilçe ad ile tekil eşleşti; `ayniKimlik` raporlanır | Ad eşleşmesi belirsiz → tam eşleme otomatik yapılamaz |
| K5 istek | toplam ≤ 11 | Kod hatası |
Ayrıca raporlanır: Türkiye countryId, resmi il/ilçe kimlikleri, ilk/son gün, örnek alan listesi, Quota/My önce/sonra ham yanıtı.

## Durdurma koşulları
Giriş başarısız; herhangi bir 401/403/429/5xx/zaman aşımı; Türkiye/il/ilçe bulunamadı veya birden çok eşleşme; şema doğrulaması hatası; toplam istek sınırı. Durunca rapor `sonuc: "DURDU"` ve `durdu` alanı adımı gösterir; yeniden deneme kullanıcı kararıyla ve en erken ertesi gün (günlük kota).

## Sonraki adımlar (her biri ayrı onay)
1. Pilot GEÇTİ → tam eşleme: `Countries 1 + States 1 + Cities 81 = 83` istek (her biri farklı parametre). Quota/My toplam sınır gösterirse güne bölünür.
2. Kota belirlenince üretim kademesi: toplam günlük sınır yoksa ilçe başına 1 Monthly (≈868 istek/çalışma, haftada 2); toplam 100/gün ise ilçeleri gün gün dönüşümlü güncelleme (≈87/gün, her ilçe ~10 günde bir, Monthly 30 gün kapsar).
3. Üretim etkinleştirme (guncelle.yml'ye `VERI_KAYNAGI=resmi`, onay anahtarı, istek sınırı ve secret'lar) ayrı commit + merge onayı.

## Tek seferlik pilot prosedürü (Windows PowerShell)
1. PowerShell'i açın ve Data deposuna gidin: `cd C:\EzanVakti\Development\ezan-vakti-data`
2. Dalı ve güncel commit'i alın: `git fetch origin; git switch feature/diyanet-api-preparation; git pull --ff-only`
3. Önce istek göndermeyen kontrol: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\resmi\pilot-calistir.ps1 -YalnizKontrol`
   — dal/commit, temiz çalışma ağacı, Node ≥ 22, offline testler, eşleme tablosu ve aynı gün raporu kontrol edilir. "Tüm kontroller tamam" görülmeli.
4. Pilot: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\resmi\pilot-calistir.ps1`
   — `evet` yazın, e-postayı ve şifreyi (görünmez) girin. En çok 11 istek gönderilir; ilk hatada durur.
5. Sonuç: `GEÇTİ` / `kaldı veya durdu` ve rapor yolu `golge\pilot-YYYY-AA-GG.json`. Rapor gizli bilgi içermez (yazmadan önce denetlenir);
   içeriğini paylaşın, **commit etmeyin**. Aynı gün ikinci çalıştırma istek göndermeden durur.
-ExecutionPolicy Bypass yalnız bu süreç içindir; sistem ayarı değişmez.
