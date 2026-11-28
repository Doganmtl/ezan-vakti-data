# Diyanet Awqat Salah kota analizi ve düzeltmesi (D23) — 28.11.2026

Kaynaklar:
- Kullanıcının aktardığı resmî dokümantasyon metni.
- https://awqatsalah.diyanet.gov.tr/index.html ve /scalar/ (`openapi/v1.json`, `openapi/v2.json`). Bulut çalışma ortamı bu alan adına çıkamadığı için kullanıcının bilgisayarındaki tarayıcıdan okundu (28.11.2026 11:05). "Hatırlatma" metni kullanıcının aktardığıyla birebir aynı.
- Depodaki önceki sözleşme (`config/awqat-sozlesme.json`).
- Aşağıda numaraları verilen canlı çalışmaların güvenli kayıtları.

Bu belge yeni canlı istek, main birleştirmesi ya da zamanlanmış üretim için onay değildir.

## 0. Canlı teşhis sonucu (run 46126362363, 28.11.2026 11:37, 6 HTTP; ham yanıt: `test/vektorler/quota-my-2026-11-28.json`)
**Token:** Login yanıt alanları `accessToken`, `refreshToken`. Access token: JWT, HS256; iddia adları aud, email, exp, iss, name, role (iat yok). exp'e göre ömür 45 dk, belgeyle aynı. Rol `Developer`. Refresh token opak, JWT değil; süresi yerelde okunamıyor (belgeye göre 7 gün). Yenileme bu teşhiste kullanılmadı. Token, e-posta ve ad değerleri hiçbir çıktıya yazılmadı.

**Quota/My şeması (kanıt):** `{ date, role, daily|weekly|monthly|yearly: [ { controllerName, resultName, period, benefit, periodStart, periodEnd, totalUsed, totalExceeded, lines: [ { parameter: "cityId:9541", used, remainingUse, exceededCount } ] } ] }`
- `includeUnused=true`: kotalı **13 hizmet** listeleniyor, hepsinde `period: Daily`, `benefit: 100`.
  - DailyContent/Get
  - Place/City, Place/CityDetail, Place/Country, Place/GetAllCities, Place/GetAllStates, Place/State
  - PrayerTime/PrayerTimeDaily, PrayerTimeDateRange, PrayerTimeEid, PrayerTimeMonthly, PrayerTimeRamadan, PrayerTimeWeekly
- Varsayılan çağrı (`includeUnused=false`) yalnız kullanılmış hizmetleri listeliyor; 28.11'deki boş listelerin nedeni buydu.
- `lines`: kullanılmış her parametre için bir satır. 9541 ve 9206 için `used 1`, `remainingUse 99`; grup `totalUsed 2`. **`benefit` parametre başına uygulanıyor** (`remainingUse = benefit − o parametrenin used değeri`). `totalUsed` hizmet toplamıdır; grup düzeyinde ayrı bir tavan gözlenmedi.
- Dönem: `periodStart 2026-11-28T00:00:00` – `periodEnd 23:59:59.999` (`date` alanı +03:00). Günlük yenilenme İstanbul gece yarısı; API bunu bildiriyor.
- Haftalık, aylık ve yıllık listeler `includeUnused=true` ile de boş. R1 (DateRange yer başına aylık 10) Quota/My'de görünmüyor; kota defteriyle uygulanıyor.
- Giriş, yenileme ve Quota/My kotalı hizmetler listesinde yok; veri kotasından düşmüyor. Yenileme için bu, liste üzerinden kanıt; canlı çağrıyla denenmedi.

**Kesinleşmeyen hususlar** (D24: hizmet toplamı sınırı Diyanet kuralı olarak uygulanmaz; planlama 10):
- Grup düzeyinde ayrı bir tavan var mı? Bir gün içinde 100'ü aşan hizmet toplamı görülmeden kanıtlanamaz; `hizmetToplamSiniri` geçici tedbir olarak açık.
- DateRange'in `lines` parametre biçimi (Monthly'den genellenmez).
- 15 günlük dönemin kesin bitiş anı (09.12 ya da 10.12).
- 10'a düşüşün Quota/My'de görünmesi.
- Monthly dışındaki hizmet eşlemeleri yalnız adlandırmaya dayalı (`config/awqat-sozlesme.json` `hizmetEslemesi.kanit`).

## 1. Resmî kurallar
| # | Kural |
|---|---|
| R1 | DateRange (yıllık namaz vakitleri) yer bazında **aylık 10** istek. |
| R2 | Erişim limitleri **hizmet ve parametre bazında ayrı ayrı**; normal limit 10. |
| R3 | Hesap oluşturulduktan sonraki **ilk 15 gün** limit 100. Hesap 25.11.2026'da açıldı; **kesin bitiş anı doğrulanmadı.** |
| R4 | Kotalar **günlük, aylık, yıllık** ve parametre bazında tutulur. Geçerli kota ve kullanım `GET /api/Quota/My`'den okunur. |

Günde 100 HTTP isteği **kullanıcının operasyonel sınırıdır** (D16). Diyanet'in ortak günlük kotası değildir ve ayrı defterde tutulur.

### Resmî belgeden ek bulgular (28.11.2026 11:05)
- **`GET /api/Quota/My` sorgu parametresi alıyor: `includeUnused` (boolean, varsayılan `false`).** Varsayılan yanıt yalnız kullanılmış hizmetleri listeliyor; bu, 28.11'deki boş listeleri açıklıyor. `includeUnused=true` kullanılmamış hizmetleri de sınırlarıyla listelemeli. Yanıt şeması belgelenmemiş (`IResult`: success, message). Diyanet kotası harcamadan bütün geçerli sınırları okumanın belgelenmiş yolu bu (§7).
- Access token 45 dk (sözleşmemiz 30 dk varsayıyor; daha güvenli taraf, değişiklik gerekmez). Refresh token 7 gün, her kullanımda yenileniyor.
- Belgelenmiş diğer hizmetler: `PrayerTime/Daily|Weekly|Eid|Ramadan`, `DailyContent`, `IslamicReligiousDay/ByDay|ByYear`, v2 yer uçları. Her biri R2'ye göre kendi hizmet+parametre kotasına sahip.
- Resmî örnek proje (github.com/DinIsleriYuksekKurulu/AwqatSalah, son commit 03.07.2024) kota modeli içermiyor.

## 2. Kök neden
1. **Başlangıçtaki sözleşme doğruydu, sonradan bozuldu.** `config/awqat-sozlesme.json` (main) zaten "uç+parametre başına günlük; ilk 15 gün 100; DateRange yer bazında aylık 10" kuralını taşıyordu (`kota`, `celiskiler[3]`). Pilot (run 45976882480) sonrasında Quota/My günlük grupları hizmete eşlenemedi. 8. turda (D14) bu belirsizlik "**tek ortak havuz, en kısıtlayıcı grup**" diye çözüldü. Böylece hizmet+parametre kuralının yerine, bütün hizmetlerin tek bir 100'lük havuzu paylaştığı bir model geçti.
2. **Operasyonel sınır, Diyanet kotasıyla karıştırıldı.** 9. turda (D16) kullanıcının "günde en çok 100 canlı istek" kuralı uygulandı. Ancak "gerçek kota daha düşükse o geçerli" ifadesi ve "günün ilk çalışmasında en az kalan ≥ 90" koşulu, ortak havuz değerini bu sınırla birleştirdi.
3. **Boş liste "bilinmiyor" sayıldı.** `kota.mjs` günlük grup görmediğinde kotayı bilinmiyor saydı (`return g.some(daily) ? g : null`). Kayıtlar ise boş listenin "bu dönemde kullanım yok" demek olduğunu gösteriyor (bkz. §4). Sonuç: 28.11'de üç çalışma (00:02 ve 00:11 DailyContent denemeleri, 09:41 DateRange üretimi) hiç veri isteği göndermeden durdu; 6 HTTP isteği (3 giriş + 3 Quota/My) harcandı.
4. **Dönemler tek "günlük" boyuta indirgendi.** Aylık ve yıllık dönemler, DateRange'in aylık yer sınırı ve parametre ayrımı defterde tutulmadı.

## 3. Yanlış varsayımlar (main, dosya:satır)
| Dosya:satır | Varsayım | Düzeltme (PR #19) |
|---|---|---|
| `scripts/resmi/kota.mjs:3-7` | "uç grubu eşlenemezse TEK ORTAK HAVUZ, en kısıtlayıcı grup" | Kaldırıldı. Hizmet+parametre+dönem; eşlenemeyen gruptan yalnız en küçük sınır alınıyor, kullanım kendi defterimizden |
| `kota.mjs:36` | Günlük grup yoksa kota bilinmiyor | Boş liste = sunucu kullanım bildirmiyor. Sınır R2/R3'ten, kullanım defterden |
| `kota.mjs:47-77` (`izinVerilen`, `ucPlani`) | Havuz paylaştırma | `ucPlani` kaldırıldı. Yerine `hizmetDurumu` + `parametreIzni` |
| `scripts/guncelle.mjs:202-213` | `ucPlani` ve "günün ilk çalışması en az kalan ≥ 90" | Kaldırıldı. Yerine Quota/My + kota defteri + yabancı kullanım kontrolü |
| `guncelle.mjs` (döngü) | Kota hatası bütün çalışmayı durdurur | Hizmet dolarsa kalan ilçeler planlı bekleyen olur; tek parametre dolarsa yalnız o ilçe atlanır |
| `scripts/resmi/defter.mjs:1-4` | Defter = "ortak günlük tavan"; ilk çalışmada kota tazeliği | Yalnız **operasyonel** HTTP defteri. Diyanet kotası ayrı dosyada: `kota-defteri.mjs` |
| `config/awqat-sozlesme.json` `kota.ucParametreGunluk: 5` | Eski PDF değeri | 10 (R2). Ayrıca `hesapAcilis`, `ilkGunSayisi`, `artirilmisEmniyetGun` |
| `config/awqat-sozlesme.json` `belirsizlikler[0]` | "tüm endpointler için günlük 100 toplam mı?" | R2 ile çözüldü: hizmet ve parametre bazında |
| `.github/workflows/guncelle.yml:4`, `guncelle-aylik.yml:4` | "Ortak günlük tavan 100" | "Operasyonel"; kota defteri cache adımları eklendi |
| `DECISIONS.md:21` (D14) | Ortak havuz | Düzeltildi (D23). Oransal pay geçerli |
| `DECISIONS.md:23` (D16) | "gerçek kota daha düşükse o geçerli", "en az kalan < 90" | Düzeltildi. 100 yalnız operasyonel sınır |
| `DECISIONS.md:17` (D08) | "uç başına günlük hak 100" | Gözlem doğru, yorum eksik: hizmet toplamı ya da parametre başına mı belirsiz |
| `DIYANET-GECIS.md:44` | "tüm günlük gruplar içindeki en az kalan hak"; "biçim bilinmezse en çok 8 istek" | Geçersiz, bu belgeye yönlendirildi |
| `URETIM-HAZIRLIK.md:53,154,158,186` | Ortak havuz ≈ 95/gün; "869 ilçe 10 günde" | §6'da yeniden hesaplandı |
| `TASKS.md:72` | "ucPlani ortak havuzdan çıkar mı" | Kapatıldı (D23) |
| `TASKS.md:77-78` | "ilk çalışma kota tazeliği", "kota yenilendikten sonra" | D23'e göre güncellendi |
| `test/yillik-mimari.test.mjs:140-170` | Havuz testleri (95 ortak, 90+5) | Q1–Q11 senaryoları |
| `test/yillik-uctan.test.mjs:154-156` | "en az kalan 1000−960=40 < 90 → yenilenmiş görünmüyor" | Yabancı kullanım testi |
| `test/eslesme-esle.test.mjs:64` | `{daily:[]}` → bilinmiyor | Boş liste ≠ sınırsız; araç resmî sınırı vermeli |
| `DEVIR-TESLIM.md:14` (develop) | "09:40 kota ≥ 90 doğrulanırsa" | D23 ile kaldırıldı; sonraki görev teşhis + §6 planı |
| `DEVIR-TESLIM.md:21` (develop) | "günlük 100 istek tavanı" (türü belirsiz) | "kullanıcının operasyonel günlük 100 HTTP sınırı (Diyanet kotası değildir)" |
| `scripts/resmi/gunluk-icerik-deneme.mjs:41` (develop) | Boş listede `izinVerilen` → 0 / tek havuz | `bosSinir` = resmî kural sınırı; deneme kota defterine yazmaz (yeniden çalıştırılmadan önce bağlanmalı) |
| PR #13 `claude/kota-teshis` (develop'a açık) | Ayrıştırıcıya teşhis nedeni ekliyor, "fail-closed değişmedi" (boş liste = bilinmiyor) | D23 ile geçersiz; kapatılması önerilir (karar kullanıcının) |
| `scripts/resmi/eslesme-il.mjs:78`, `eslesme-esle.mjs:86`, `daterange-test.mjs:72`, `pilot.mjs` | Tek araç, en kısıtlayıcı grup | **Tamamlanmış tek seferlik araçlar.** D23 ile boş listede 0 döner; yeniden kullanılmadan önce `bosSinir` ile güncellenmeli |

## 4. Kayıtlı Quota/My yanıtları (kanıt)
| Çalışma | Saat (UTC) | Kota | Gözlem |
|---|---|---|---|
| 45976882480 pilot | 27.11 09:49 | önce: daily/weekly/monthly/yearly hepsi boş · sonra: 4 günlük grup (benefit 100; totalUsed 3/1/1/3), diğer dönemler boş | 11 istek: giriş 1, Quota/My 2, Countries 1, States 1, Cities 3, Monthly 3 |
| 45995729583 eşleme | 27.11 12:05 | en az kalan 97 → 16 | 81 farklı Cities parametresi; tek grup toplamı 3 + 81 = 84 |
| 45996522915 DateRange testi | 27.11 12:11 | 16 → 16 | 2 DateRange (9206, 9541), ayrı grup; Cities grubu değişmedi |
| 46004878195 Şuhut | 27.11 13:10 | 16 → 15 | Cities/502 +1; Quota/My ×2 ve giriş değiştirmedi |
| 46067658806 / 46068655951 DailyContent denemesi (pilot dalı) | 27.11 21:02 / 21:11 (= 28.11 00:02 / 00:11 İstanbul) | bütün listeler boş; `role` alanı var | Kod "kota yenilenmiş görünmüyor" deyip durdu |
| 46117777854 DateRange üretimi | 28.11 06:41 (09:41 İstanbul) | en az kalan null (günlük boş) | Aynı hata; vakit isteği yok |

**Soru–cevap** (kanıt düzeyi: **kanıt** = kayıtla doğrulandı, **işaret** = kayıtla uyumlu ama tek açıklama değil, **bilinmiyor**):
- **Kayıt hizmet kullanıldıktan sonra mı oluşuyor? — kanıt.** Pilotta istekten önce liste boştu, sonra 4 grup oluştu.
- **Hiç kullanılmamış hizmet listede görünüyor mu? — kanıt: hayır.** Pilot öncesinde ve 28.11'in bütün okumalarında listeler boştu.
- **Parametreler nasıl temsil ediliyor? — kanıt:** grup = hizmet; `totalUsed` = o hizmetin bütün parametrelerinin toplamı (81 farklı Cities parametresi tek grupta 84).
  - **Bilinmiyor:** `benefit` (100) bu toplama mı, her parametreye ayrı mı uygulanıyor? Parametre ayrıntısı muhtemelen `lines` içinde. Satır sayısı totalUsed'a eşit (3/1/1/3), içeriği pilot özetinde maskelenmişti.
  - D23 iki yorumu **birden** uyguluyor; hangisi doğru çıkarsa çıksın kota aşılmıyor.
- **DateRange için yer bazlı kota nasıl tanımlanıyor? — kısmen kanıt, kısmen bilinmiyor.**
  - DateRange testinden sonra Cities grubu değişmedi; yani DateRange ayrı bir grupta.
  - 28.11 00:02'de aylık liste de boştu. Aylık yer sınırı (R1) Quota/My'de görünmüyor ya da yalnız kullanım olduğu sürece görünüyor.
  - D23 R1'i kendi kota defterimizle uyguluyor.
- **Giriş kota tüketiyor mu? — kanıt: grup oluşturmadı.** Pilotta ve Şuhut çalışmasında değişim yalnız veri uçlarında oldu.
- **Quota/My kota tüketiyor mu? — kanıt: grup oluşturmadı.** Şuhut çalışmasında 2 Quota/My okumasına rağmen en az kalan yalnız 1 düştü (Cities).
- **Token yenileme kota tüketiyor mu? — bilinmiyor.** Hiçbir çalışmada yenileme olmadı. D23 bunu kota defterine saymıyor; operasyonel sınıra sayılıyor.
- **Boş günlük/aylık/yıllık listeler ne anlama geliyor? — kanıt + resmî belge:** varsayılan çağrı (`includeUnused=false`) yalnız kullanılmış hizmetleri listeliyor; o dönemde kullanım yoksa listeler boş geliyor.
  - Sıfır hak, sınırsız hak ya da kesin 100 anlamına gelmiyor.
  - 27.11'deki 100'ü aşkın sayılan isteğe (DateRange dahil) rağmen 28.11 00:02'de aylık ve yıllık listeler de boştu. Bu dönemlerin sayımı Quota/My'de görünmüyor ya da yalnız o döneme sınır tanımlı hizmetler için görünüyor.
- **Dönemler hangi saat dilimine göre yenileniyor? — işaret: Europe/Istanbul gece yarısı.**
  - 27.11'in son kullanımı 13:12 UTC'deydi. 21:02 UTC'de (İstanbul 00:02) liste boştu.
  - UTC günü yenilenmesi bunu açıklamaz; yenilenme 13:12–21:02 UTC arasında olmuş. İstanbul gece yarısı (21:00 UTC) en olası açıklama ama kanıt değil.
  - D23 günleri İstanbul takvimiyle sayıyor.

## 5. Doğru kota modeli (PR #19)
- **Diyanet kota defteri** (`scripts/resmi/kota-defteri.mjs`, `.defter/awqat-kota.json`, Actions cache):
  - Dönemler: `gun` / `ay` / `yil`. Anahtarlar: `hizmet` ve `hizmet|parametre`.
  - Başarısız istekler dahil sayılıyor; giriş, yenileme ve Quota/My sayılmıyor.
  - Dönem değişince yalnız o dönemin sayacı sıfırlanıyor. Bozuk defter → istek yok.
- **Karar** (`kota.mjs`, her çalışmanın hizmeti için ayrı):
  - Quota/My okunamazsa → istek yok.
  - Aşım: eşlenen hizmeti durduruyor, diğer hizmetleri durdurmuyor. Eşlenemeyen aşım → istek yok ve rapor.
  - Yabancı kullanım (sunucunun bugünkü toplamı > defterin bugünkü toplamı) → istek yok.
  - Her dönem için:
    - **sınır:** sunucunun benefit değeri (grup varsa). Günlükte ayrıca R2/R3 kural sınırı her zaman üst sınır. Artırılmış dönem bir gün erken bitiyor: 08.12 son 100 günü.
    - **kullanım:** defter ile sunucudan büyük olanı.
    - **kalan:** sınır − pay − kullanım.
  - Parametre isteğinden önce en kötü durum (istek + 1 tekrar) şu kontrollerin hepsine sığmalı:
    - hizmet toplamı (her dönem);
    - parametre (günlük, R2);
    - DateRange yer (aylık, R1).
- **Operasyonel HTTP sınırı** (`defter.mjs`, kullanıcı kuralı D16): günde 100 HTTP. Giriş, yenileme, Quota/My, başarısız ve tekrarlanan istekler dahil. Ayrı dosya, ayrı karar.
- **Testler** (`node --test test/*.test.mjs` → 161/161):
  - Q1 aynı servis, farklı konum
  - Q2 aynı konum, farklı servis
  - Q3 aynı servis, farklı parametre
  - Q4 aylık DateRange
  - Q5/Q6 ilk 15 gün ve normal limite geçiş
  - Q7 bir servisin tükenmesi
  - Q8 boş kota yanıtı
  - Q9 eksik veya bozuk gruplar
  - Q10 birden fazla dönem
  - Q11 operasyonel HTTP sınırı
  - Uçtan uca: R1 yer bazında atlama, hizmet toplamının dolması, başka servisin aşımı, yabancı kullanım, kota defteri sayımı.

## 5b. Kota durumunu görme (kalıcı)
- **Ek istek yok:** `kota-defteri` dalındaki `kota-durum.md` ve `kota-durum.json`. Her üretim çalışması ve kota aracı, kendi Quota/My okumasını (okuma anıyla) ve çalışma sonrası defteri buraya yazar.
- **Canlı:** Actions → "Kota durumu (Quota/My; elle)" → `kota`. Giriş + Quota/My?includeUnused=true (2 HTTP; Diyanet kotası 0). Tablo iş özetine yazılır.

## 6. Kalıcı üretim planı (D24 — normal 10 hak; geçici 100 planlamada yok)
İlke: istekler kota kapasitesine göre değil, gerçek veri ihtiyacına göre gönderilir. Diyanet sınırı hizmet+parametre başına (günlük 10) ve DateRange için yer başına aylık 10'dur. Her ilçe ayrı bir parametre olduğu için hizmet genelinde ortak bir kota yoktur. Ortak günlük HTTP tavanı da yoktur. Çalışmaları kontrollü işlem grupları, istekler arası bekleme ve güvenli durdurma sınırlar.

| Konu | Karar |
|---|---|
| İlk yıllık toplama | DateRange, ilçe başına 1 istek (365 gün). Öncelikli ilçeler (`config/oncelikli-ilceler.json`) önce, sonra yıllık dosyası olmayanlar. |
| İşlem grubu | DateRange en çok 100 ilçe ve en çok 110 HTTP/çalışma; Monthly en çok 30 ilçe ve en çok 40 HTTP/çalışma. |
| İstek sıklığı | İstekler arasında 2 sn (`DELAY_MS`); 429 gelirse Retry-After'a uyulur, yoksa ya da uzunsa durulur (tekrar yok). |
| İlk toplama süresi | 869 ilçe ÷ 100 = 9 grup. Günde 3 DateRange çalışmasıyla **≈ 3 gün**. Grup başına ≈ 4 dk istek süresi. |
| Yıllık yenileme | Geçerliliğin bitmesine **130 gün** kala yeniden DateRange (`YENILEME_ONCESI_GUN`). Geçerli yıllık verisi olan ilçe istenmez. Yenilenecek ilçe yoksa çalışma hiç istek göndermeden biter. |
| Monthly doğrulama | Günde 1 çalışma, en uzun süredir doğrulanmayan **30 ilçe** → 869 ilçe ≈ 29 günde bir, yani her ilçe yaklaşık ayda bir. Fark çıkarsa sözleşme 2 ve D12 kurallarına göre düzeltme ya da güvenli durdurma. DateRange ile bağımsız. |
| DailyContent | Mevcut kaynak (`gunluk.yml`, günde 2 deneme, 1 başarılı alım). Awqat DailyContent gerçek yanıtı doğrulanana kadar entegre edilmez. Eksik dini metin üretilmez. |
| Place | Doğrulanmış eşleme (`eslesme/ilce-kimlikleri.json`) korunur. Tam ülke taraması tekrarlanmaz; yalnız ihtiyaç hâlinde tek il/ilçe kontrolü. |
| Quota/My | Her üretim çalışmasının başında 1 okuma (`includeUnused=true`). Sonuç ek istek olmadan `kota-defteri/kota-durum.md`'ye yazılır. Gerektiğinde "Kota durumu" aracı (2 HTTP). Tek seferlik pilot iş akışı yok. |
| Token | Çalışma başına 1 giriş. Access token 45 dk; istemci 25. dk'da yenileme token'ıyla yeniler (yenileme ve rotasyon test edildi). Yenileme başarısızsa yeniden giriş yapılır. Secret'lar yalnız `awqat-uretim` ortamında. |
| Hata ve kesinti | Kota defteri ve HTTP kaydı her durumda `kota-defteri` dalına yazılır (yarım ya da iptal edilen çalışmanın tüketimi kaybolmaz). Dal ya da dosya yoksa istek gönderilmez; sayaç sıfırlanmaz. Alınamayan ilçe sonraki çalışmada önceliklidir. Bütün yazan iş akışları tek bir concurrency grubunda (`veri-guncelleme`), yani eşzamanlı istek yok. |
| Yayın | Doğrulayıcı (`dogrula.mjs`), D06 eşikleri ve `publish-data.sh`: yalnız main, fast-forward push, rerun yok. Pages yayını sonrası doğrulama kontrol listesi `URETIM-HAZIRLIK.md`'de. |

**Önerilen otomatik takvim (İstanbul saati; zamanlama ayrı onayla açılır):**
- DateRange: 02:13, 10:13, 20:43 (UTC 23:13, 07:13, 17:43).
- Monthly: 06:23 (UTC 03:23).
- DailyContent: mevcut 03:07 ve 07:37 (değişmez).

İlk toplama bittiğinde DateRange çalışmaları yenilenecek ilçe olmadığı için istek göndermeden kapanır. Yenileme dönemi geldiğinde kendiliğinden devreye girer.

### Önceki planlar (geçersiz, D24)
Ortak günlük havuz, 80 DateRange / 10 Monthly / 10 rezerv dağılımı, "en az 90 kalan hak", artırılmış döneme (08–09.12) yetişme hedefi ve hizmet toplamının parametre kotasına eşitlenmesi geçersizdir. Aşağıdaki tarihçe yalnız kayıt içindir.

## 7. Kontrollü canlı teşhis planı (uygulandı: run 46126362363)
**Önce kotasız adım (`kota` modu, 3 HTTP, Diyanet kotası 0):** giriş → `Quota/My` → `Quota/My?includeUnused=true`. Bütün hizmetlerin dönem sınırları ve satır yapısı görünürse aşağıdaki veri adımları gerekmeyebilir.

**Amaç:** §4'teki "bilinmiyor"ları gidermek: `lines` yapısı, benefit'in toplama mı parametreye mi uygulandığı, aylık/yıllık grupların davranışı, Quota/My'nin kendisinin sayılıp sayılmadığı.

- **İş akışı:** `kota-oku.yml` (PR #20, main'e alınmalı).
  - Elle tetiklenir, `contents: read`, ortak concurrency.
  - Ham yanıt gizli alanlar atılarak yazdırılır.
  - Data deposu public olduğu için GitHub dakikası harcamaz.
- **Teşhis için genişletilmiş adımlar:**
  | # | İstek | Beklenen |
  |---|---|---|
  | 1 | `POST /Auth/Login` | token (kota grubu oluşturmaz) |
  | 2 | `GET /api/Quota/My` | bugün kullanım yoksa bütün listeler boş |
| 2b | `GET /api/Quota/My?includeUnused=true` | kullanılmamış hizmetler de sınırlarıyla (sonraki Quota/My okumaları da bu biçimde) |
  | 3 | `GET /api/PrayerTime/Monthly/9541` | 30+ gün (yayına yazılmaz) |
  | 4 | `GET /api/Quota/My` | 1 günlük grup, totalUsed 1; `lines[0]` içeriği (yol/parametre) görünür |
  | 5 | `GET /api/PrayerTime/Monthly/9206` | — |
  | 6 | `GET /api/Quota/My` | Aynı grupta totalUsed 2 ise toplam gösterim doğrulanır; `lines` iki parametre gösterirse parametre ayrımı doğrulanır; Quota/My okumaları hiçbir grupta görünmezse sayılmadığı doğrulanır |
- **Toplam:** 7 HTTP isteği (operasyonel 100'den). Diyanet kotasından: Monthly hizmetinde 2 kullanım (9541 ve 9206 için birer).
- **Durma koşulları:** herhangi bir hata, 4xx/5xx, aşım ya da yabancı kullanım → kalan adımlar gönderilmez.
- **Yazılanlar:** yalnız operasyonel ve kota defterleri. Yayın yok.

## 8. Düzeltilecek eski kararlar
- **D08:** "uç başına günlük hak 100" bir gözlemdir; toplam mı parametre mi olduğu belirsizdir.
- **D14:** ortak havuz geçersiz. Oransal pay geçerli.
- **D16:** 100 yalnız operasyonel sınır. "Gerçek kota daha düşükse o geçerli" ifadesi Diyanet kotasına değil, `kota.mjs` kararına bırakıldı. "En az kalan < 90" kaldırıldı.
- **`DIYANET-GECIS.md` §Kota ve `URETIM-HAZIRLIK.md` §Üretim geçiş planları:** havuz hesapları bu belgedeki §6 ile değiştirildi.
