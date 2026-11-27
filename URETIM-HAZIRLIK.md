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
