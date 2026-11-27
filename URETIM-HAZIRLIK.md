# Üretime geçiş öncesi açık kararlar ve planlar (27.11.2026, 5. tur)

## 1. D06 ile mobil 14 gün kuralının etkileşimi (KARAR GEREKİR — D06 değiştirilmedi)
Sınıflandırma artık mobil davranışla aynı: dosya, bugün+yarını kapsıyor **ve** damgası 14 günden yeni ise kullanılabilir.
Yayındaki 868 dosyanın tamamı 19.11.2026 08:49 damgalı. Ölçüm (`siniflandir`, yayındaki dosyalar):

| Gün | yedek | kisaKapsam | tukenmis |
|---|---|---|---|
| 27.11 – 01.12 | 0 | 868 | 0 |
| 02.12 ve sonrası | 0 | 0 | 868 |

Not: yayındaki (main) mobil sürümlerde 14 gün kuralı yok; kural PR #5/#6 ile gelir. Mevcut kullanıcılar veriyi 13–19 Aralık'a kadar görür.

**Etki:** D06-A'da "kullanılamaz" oranı planlı bekleyen ilçeleri de sayar (> %1 → yayın durur). Kademeli güncelleme günde ~90 ilçeyle 868'i ~10 günde bitirir. 02.12'den itibaren henüz yenilenmemiş ilçelerin tamamı `tukenmis` olur → kullanılamaz oranı > %1 → **her yayın durur**, kalan ilçeler hiç yenilenemez (kilitlenme). 02.12'ye kadar tüm ilçeleri bitirmek, uç başına 100/gün ile mümkün değil (≥ 217/gün gerekir).

Kısmi yayın, yenilenmeyen dosyalara dokunmadığı için bekleyen ilçeleri kötüleştirmez; durdurmak yalnız yenilemeyi engeller.

Seçenekler (kullanıcı onayı gerekir):
- **A' (önerilen):** Eşikler aynı (%2 / %1) ama yalnız **bu çalışmada denenen** ilçelere uygulanır. Planlı bekleyenlerin kullanılamaz sayısı yayını durdurmaz; `meta.durum` ve iş akışı uyarısında raporlanır.
- A (mevcut): olduğu gibi kalır → 02.12'den sonra kilitlenme riski; 02.12'ye kadar başlanan ilçe sayısıyla sınırlı.
- C: Bekleyen kullanılamaz için ayrı, yüksek bir alarm eşiği (ör. %100 değil %50) — yine onay gerekir.

## 2. Küçük dilimlerde %2 kaynak hatası eşiği (KARAR GEREKİR — değiştirilmedi)
İzin verilen hata = floor(N × 0,02). N < 50 iken 0 → tek bir ilçe hatası tüm dilimi durdurur. N = 90 → 1.
| N (dilim) | 5 | 10 | 49 | 50 | 90 |
|---|---|---|---|---|---|
| İzin verilen hata | 0 | 0 | 0 | 1 | 1 |
Kota düşük günlerde tek bir geçici hata (örn. 502) o günün tüm güncellemesini kaybettirir. Seçenek: alt sınır "en az 1 hata" (max(1, %2)) — onay gerekir.

## 3. Secret izolasyonu: GitHub Environment planı
Amaç: canlı API secret'ları yalnız izin verilen işlere açılsın; üretim zamanlanmış işi her gün onaya takılmasın.

| Environment | Secret'lar | Koruma | Kullanan |
|---|---|---|---|
| `awqat-test` | `AWQAT_EMAIL`, `AWQAT_PASSWORD` | Required reviewers: depo sahibi | Pilot, tam eşleme, DateRange testi (her çalışma arayüzde onay bekler) |
| `awqat-uretim` | aynı (ayrı kopya) | Deployment branches: yalnız `main`; reviewer YOK | `guncelle.yml` zamanlanmış iş (onaysız, ama yalnız main'den) |

Adımlar (kullanıcı, GitHub arayüzü — değerleri yalnız kullanıcı girer):
1. Settings → Environments → New environment `awqat-test` → Required reviewers: Doganmtl → secret'ları ekle.
2. New environment `awqat-uretim` → Deployment branches: Selected → `main` → secret'ları ekle.
3. Repository secrets'tan `AWQAT_EMAIL` / `AWQAT_PASSWORD` silinir (PR #3 merge edildikten sonra; hiçbir workflow artık repository secret kullanmaz).
4. Kod tarafı: test workflow'larına `environment: awqat-test`, etkinleştirme commit'inde `guncelle.yml`'ye `environment: awqat-uretim` (ayrı onaylı commit'ler).
Böylece bir PR dalı veya yanlış push secret'a erişemez; üretim yalnız main'den, onaysız çalışır.

## 4. Hibrit veri stratejisi (DateRange GEÇERSE değerlendirilecek; mobil kural değişmez)
- **Yıllık arşiv (yayın dışı):** DateRange ile ilçe başına 1 yıl; ayrı dal/klasörde (`arsiv/`, GitHub Pages dışında). Mobil okumaz.
- **Monthly doğrulama ve yayın:** Yayın dosyaları yalnız Monthly ile yenilenir ve damgalanır (14 gün kuralı korunur). Her Monthly yanıtı arşivle gün gün karşılaştırılır; fark → o ilçe yayınlanmaz, uyarı.
- **Kazanç:** (a) Monthly verisinin bağımsız çapraz doğrulaması, (b) Monthly kotası düştüğünde hangi ilçelerin önce yenileneceğine dair kesin bilgi, (c) kaynak kesintisinde onaylı acil durum seçeneği.
- **Sınır:** Arşiv verisi damgası eskidiği için mobil kuralı değişmeden doğrudan yayınlanamaz. Hak 10'a düşerse günde ≥ 62 ilçe Monthly koşulu sağlanamaz; o durumda mobil kural kararı ayrıca gelir.

## 5. Kota dönemi ve toplam/uç ayrımı (TEYİT GEREKİR)
- Hesap açılışı: kullanıcı "25 Aralık" yazdı (gelecek tarih) → 25 Kasım varsayımı **teyit edilmedi**. Kesin tarih yazılmadı.
- Pilotta Quota/My günlük grupları uç başına ayrı `benefit: 100` gösterdi; toplam (tüm uçlar) sınırı görülmedi. Güvenlik filtresi satır ayrıntılarını boşalttığından grup→uç eşleşmesi kesin değil. Son commit ile API yolu biçimli metinler rapora alınır; tam eşleme çalışmasının raporunda grup ayrıntıları görülecek.
- Kod her durumda en temkinli yorumu kullanır (tüm gruplar içinde en az kalan) ve bilinmeyen kotada hiç istek göndermez.

## 6. Onaylanmış istek bütçeleri (onay bekliyor; aşılamaz — kodla sabit)
| İş | Toplam istek | Ön koşul | Sabit |
|---|---|---|---|
| Tam eşleme | 85 (giriş 1, Quota/My 2, States 1, Cities 81) | Quota/My: en az kalan ≥ 87 | `ESLESME_ISTEK=85` |
| DateRange testi | 5 (giriş 1, Quota/My 2, DateRange 2) | Quota/My: en az kalan ≥ 8 | `DR_ISTEK=5` |
Bugünkü tüketim (pilot): en çok 3/100 (Cities, Monthly). İkisi aynı gün çalışırsa Cities 84/100, DateRange 2/100.

---
# 6. tur sonuçları (27.11.2026, kullanıcı onaylı işlemler)

## Tamamlananlar
- **PR #3** squash merge → main `f3b50cb`. Main'de `dogrula.mjs` ve `AWQAT_*` referansı yok; yayın verisi değişmedi; veri workflow'u tetiklenmedi. PR #2 ile main arasında yalnız `guncelle.yml`'de beklenen çakışma var (PR #2 sürümü esas alınacak; eski adımı zaten içermiyor).
- **Environment'lar:** `awqat-test` (gerekli onaylayıcı Doganmtl, yönetici atlatması kapalı, yalnız `pilot/*` dalları); `awqat-uretim` (yalnız `main`, onaylayıcı yok, henüz hiçbir workflow'a bağlı değil). Dört environment secret'ı kullanıcı girdi (değerler görülmedi). Public repoda Environment korumaları destekleniyor (arayüzde etkin).
- **Repository secret'ları:** silme denemesi arayüzde istek göndermedi; **kullanıcı tarafından silinmeli** (Settings → Secrets and variables → Actions → Repository secrets → `AWQAT_EMAIL`, `AWQAT_PASSWORD`). Main'deki hiçbir workflow artık bunları kullanmıyor.
- **D06 A'+C** koda işlendi (20d0c92, CI 95/95, run 45985514525).

## Tam eşleme — run 45995729583 (commit 40dea4f, onaylı)
| | Değer |
|---|---|
| İstek | 85 / 85 (giriş 1, Quota/My 2, States 1, Cities 81) |
| İl | 81 / 81 aynı kimlik ve ad |
| İlçe | 868 / 869 aynı kimlik ve ad; **1 eşleşmedi: 9183 v1 "SUHUT"** (ad eşleşmesi yok; muhtemelen resmi "ŞUHUT") |
| Farklı kimlik / tekrar | 0 / 0 |
| Kota (en az kalan) | önce 97 → sonra 16 (Cities 84/100) |
| Sonuç | Katı kurala göre BAŞARISIZ → eşleme tablosu **değiştirilmedi** |
Kullanıcı kararı (27.11.2026 15:21): "Diyanet'ten alınan isimlere göre uyarla." → 47f2f9f: aynı kimlik + farklı yazım "ayni-kimlik-ad-farkli" olarak eşleşir, resmi ad kaydedilir; `ad-uygula.mjs` yalnız ad alanlarını resmi adlara çevirir. Bunun için **tam eşlemenin yeni kodla bir kez daha çalışması** gerekir (85 istek; Cities grubunda bugün 16 hak kaldığı için kota yenilendikten sonra, `awqat-test` onayıyla).

## DateRange — run 45996522915 (commit 94f4130, onaylı) — GEÇTİ
| | 9541 İstanbul | 9206 Ankara |
|---|---|---|
| İstenen / dönen gün | 365 / 365 | 365 / 365 |
| Aralık | 27.11.2026 – 26.11.2027 | aynı |
| Kesintisiz, tekrar, aralık dışı | evet, 0, 0 | evet, 0, 0 |
| 31.12 → 01.01 | var | var |
| Yayınla eşitlik (ortak gün) | 18 gün, fark 0 | 19 gün, fark 0 |
| Şema | 6 vakit + tarih tam | tam |
İstek 5/5 (giriş 1, Quota/My 2, DateRange 2). Kota en az kalan 16 → 16 (DateRange ayrı grup). Yer başına aylık DateRange hakkından 1 kullanıldı.

## Uç başına toplam kullanım (27.11.2026)
| Uç | Pilot | Eşleme | DateRange | Toplam |
|---|---|---|---|---|
| Auth/Login | 1 | 1 | 1 | 3 |
| Quota/My | 2 | 2 | 2 | 6 (kotaya sayılmadığı görüldü) |
| Place/Countries | 1 | – | – | 1 |
| Place/States | 1 | 1 | – | 2 |
| Place/Cities | 3 | 81 | – | 84 |
| PrayerTime/Monthly | 3 | – | – | 3 |
| PrayerTime/DateRange | – | – | 2 | 2 |
| **Toplam** | 11 | 85 | 5 | **101** |

## Üretim stratejisi (onay sonrası; bu turda etkinleştirilmedi)
Hesap açılışı 25.11.2026 (kullanıcı teyitli) → artırılmış (100) dönem yaklaşık 09–10.12.2026'ya kadar; kesin yenilenme saati ve sonraki limit Quota/My ile ölçülecek.
1. **Hemen (artırılmış dönem):** iki uç paralel, her biri günde ≤ 90 (pay 10):
   - **DateRange yıllık arşiv:** ilçe başına 1 istek (yer başına aylık 10 hakkın 1'i). 869 ilçe ≈ 10 gün; öncelik `sonKullanim`. Arşiv yayın dışı (`arsiv/` ayrı dal), Monthly verisini çapraz doğrular.
   - **Monthly yayın:** ≈ 90 ilçe/gün; D06 A'+C; `sonKullanim` önceliği. 869 ilçe ≈ 10 gün. Mihalgazi (33292) resmi modda istisna değil → aktif kapsamda.
   - Token: çalışma başına 1 giriş, 25 dk'da yenileme, rotasyon; kota bilinmezse istek yok.
2. **Dönem sonrası:** Quota/My ölçümüne göre N otomatik düşer. Uç başına 10/gün olursa Monthly ile 14 gün kuralı (≥ 62 ilçe/gün) **sağlanamaz.** Seçenekler:
   - **Veri geçerlilik politikası önerisi (mobil değişikliği, ayrı onay):** resmi yıllık takvim dosyaları için `kaynakTuru: "resmi"` ve `gecerlilikSonu` alanları; mobil, resmi kaynakta 14 gün yerine "kapsam + en çok 400 gün yaş + son Monthly örnek doğrulaması 30 günden yeni" kuralını uygular. Diyanet vakitleri tarih bazında sabit yayımlandığı için yıllık veri doğruluğunu korur; örnek doğrulama değişikliği yakalar.
   - **Diyanet'ten kota artışı talebi:** gerekçe — 869 ilçe × 2 uç, kamuya açık ücretsiz uygulama, istemci başına değil merkezi tek çekim (GitHub Pages önbelleği), günlük ~180 istek; yıllık DateRange ile toplam yük yılda ~869 + doğrulama.
3. **Ortam ayrımı:** canlı testler `awqat-test` (onaylı, `pilot/*`), üretim `awqat-uretim` (yalnız main). Etkinleştirme commit'i `guncelle.yml`'ye `environment: awqat-uretim` ekler (ayrı onay).
