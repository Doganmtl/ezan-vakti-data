# Resmi API geçişi — hazırlık / Claude Code
Durum: izole geliştirme; canlı API, secret, docs/v1 değişikliği ve merge yasak.
1. Kullanıcıdan resmi sözleşme ve yeniden yayın iznini doğrula; limit, token süresi, endpoint ve kimlik eşleştirme belirsiz. Credential yalnız Actions secrets.
2. Mobil okuyucuların mevcut v1 kontratını doğrula; id/ad, guncelleme, gunler[{t,v,h?}] ve meta alanlarını koru. Resmi kimlikleri mevcut kimliklerle eşleştir; 33292 dahil kapsamı kontrol et.
3. Sağlayıcı adaptörü ve sahte HTTP testleri: 401/403/429/502, timeout, Retry-After, token yenileme. Canlı çağrı için ayrı onay.
4. Geçici dizinde gölge veri üret; tüm ilçelerde bugün+14 kesintisiz, benzersiz kimlik ve tarih, altı sıralı vakit. Yedek bugün+7 altında ise yayın yok. Mevcut istisna 33292 geçişte çözülmeli.
5. Atomik yayın, eski çalışmanın yeni veriyi ezmesini önleme, günlük içerik ve meta tazeliği; mevcut üretim workflow'larına dokunmadan test et.
6. iOS/Android kontrat regresyonu, gölge karşılaştırma, rollback ve kullanıcı onayı; sonra ayrı PR.
Sahiplik: ChatGPT hazırlık dalı; Claude Code ancak devir ve son SHA kontrolü sonrası aynı dalda çalışabilir. Test sonuçları ve açık riskler TASKS.md'ye yazılır.

Hazırlık: dosya bazlı atomik rename, tüm dosyaları önceden stage etme ve normal hata halinde rollback eklendi. SIGKILL/güç kaybında çok dosyalı işlem atomik değildir; Git commit/Pages yayın sınırı ve eski run koruması ayrıca doğrulanmalı. Testler loopback ve geçici dizin kullanır; gerçek API yok.

Yayın hazırlığı: scripts/publish-data.sh eski checkout'u reddeder, izinli JSON yollarını stage eder, staged snapshot doğrular ve tek normal fast-forward commit gönderir. Rebase/force yok. scripts/yayin-dogrula.mjs tüm ilçe yedek kapsamını ve meta zamanını kontrol eder. Yerel bare Git testleri kullanılır. Üretim workflow'ları bu aşamada değiştirilmedi; bağlantı, rerun/ref guard, Pages cache ve gerçek snapshot doğrulaması ayrı onayla yapılacak. 33292 mevcut istisna olarak kalır.

Yayın sertleştirme: il ve ilçe kimlik kümeleri (il bazında) değişmez; değişen vakit dosyası bugün+14, korunmuş dosya bugün+7 kapsar; eski ilçe timestamp reddedilir. Günlük arşiv yalnız birleşik tarih kümesinin en eski 400 üzeri kayıtlarını budar. Actions çalışmasında main/schedule veya dispatch/ilk attempt/event SHA şartı. Yerel Git testleri dışında üretim bağlantısı yok. İdari kimlik değişikliği ayrı migration onayı gerektirir; Mihalgazi mevcut istisnası açık.

## Nihai denetim / devir
26 Kasım: 19/19 offline test, main/develop ayrışması 1/1. Son vakit workflow 403 başarısız; main meta 19 Kasım. Günlük içerik ve Pages başarılı. Yayın scripti henüz bağlı değil. Kalan riskler: ham yeni veri boşluklarının eski birleştirilmiş veriyle maskelenmesi, String(undefined) isimler, 403 retry, günlük timestamp gerçek tazeliği, Pages cache/manifest, production-shaped fixture, 33292, resmi izin/limit/kimlik doğrulaması. Önce offline; sonra kullanıcı onaylı shadow pilot. Mobil PR #5/#6 ayrı review; birini diğerinin onayı sayma.

## Claude Code ilerlemesi — 27 Kasım 2026 (feature/diyanet-api-preparation)
- Resmi belgeler okundu (site, OpenAPI v1, kılavuz PDF); API'ye istek yok. Sözleşme `config/awqat-sozlesme.json`, çelişkiler içinde listeli.
- Adaptör `scripts/resmi/awqat-adaptor.mjs` + sahte taşıyıcı testleri; gölge çalıştırıcı `scripts/resmi/golge.mjs` (ALLOW_LIVE_API=evet olmadan çalışmaz, workflow'a bağlı değil).
- Eşleme tablosu 869 ilçe, `resmi` alanları boş; dolması için canlı Place/Cities çağrısı ve gölge karşılaştırma gerekir (ayrı onay).
- Kalan adımlar: (a) onayla gölge çalıştırma — önce 3 ilçe, sonra kademeli; (b) resmi kimliklerin tabloya işlenmesi; (c) guncelle.mjs'e resmi kaynak seçeneği; (d) üretim etkinleştirme ve merge ayrı onay.

## Resmi kaynağa geçiş planı — 27 Kasım 2026 (güncel)
**Önemli:** PR #2'nin merge'ü tek başına HTTP 403 sorununu çözmez. Main'deki eski workflow aynaya bağlı; merge sonrası da varsayılan kaynak `ayna` kalır. Veri, resmi kaynak etkinleştirilene kadar güncellenmez; yayındaki dosyalar 13 Aralık'tan itibaren bitmeye başlar (7 ilçe), 19 Aralık'ta tamamı biter.

| Adım | İş | Durum | Onay |
|---|---|---|---|
| 1 | Sözleşme, adaptör, güvenli varsayılanlar, `guncelle.mjs` resmi modu, offline testler | Tamam (PR #2) | — |
| 2 | 3 ilçelik pilot, 11 istek (PILOT-PLANI.md) | Hazır | Canlı API onayı + kullanıcı kimlik bilgisi |
| 3 | Tam il/ilçe eşlemesi (83 istek), `eslesme/ilce-kimlikleri.json` `resmi` alanları; inceleme commit'i | Pilot sonrası | Canlı API onayı |
| 4 | Kota stratejisi (Quota/My sonucuna göre tam ya da dönüşümlü) | Pilot sonrası | Karar |
| 5 | PR #2 → develop → main merge | Bekliyor | Merge onayı |
| 6 | Üretim etkinleştirme: `guncelle.yml`'ye `VERI_KAYNAGI=resmi`, `RESMI_KAYNAK_ONAYI=evet`, `RESMI_TOPLAM_ISTEK_SINIRI`, `AWQAT_*` secret; `workflow.test.mjs` buna göre | Hazırlanacak | Üretim onayı |
| 7 | İlk resmi çalışmanın izlenmesi; `meta.durum`, istek sayısı, gölge karşılaştırma | — | — |

Zaman çizelgesi önerisi: pilot bu hafta → eşleme ve kota kararı ≤ 3 Aralık → merge + etkinleştirme ≤ 6 Aralık (13 Aralık'tan önce en az iki başarılı çalışma). Resmi kaynak engellenirse mobil uygulamalar cihazdan aynaya düşer (cihaz erişimi doğrulanmadı).

Resmi modda kaynak davranışı: il/ilçe listeleri yayındaki dosyalardan (kimlik koruması), vakitler doğrulanmış `resmi` kimlikle `Monthly` ucundan; eşlemesi olmayan ilçe "kaynaktan alınamadı" sayılır ve D06 eşiklerine girer; KOTA/YETKI/GIRIS hatası veya toplam istek sınırı tüm çalışmayı yazmadan durdurur.

## Kota, takvim ve üretim planı — 27 Kasım 2026 (3. tur)
> **28.11.2026 düzeltmesi (D23):** bu bölümdeki "ortak havuz / tüm günlük grupların en az kalanı / ≈ 95 istek/gün" hesapları resmî dokümantasyonla çelişir ve geçersizdir. Doğru kota modeli, kanıt ve yeniden hesaplanan 869 ilçe planı: `KOTA-ANALIZI.md`.

**Ölçülen (pilot, run 45976882480):** Quota/My günlük gruplar uç başına ayrı görünüyor, `benefit: 100`. Gruplar ile uçların birebir eşleşmesi yanıtta görünmediği için kod en temkinli yorumu kullanır: **tüm günlük gruplar içindeki en az kalan hak** (`scripts/resmi/kota.mjs`). Biçim bilinmezse en çok 8 istek.

**Hesap açılışı:** kullanıcı beyanı "25 Aralık" → bugünden ileri olduğu için 25 Kasım olarak yorumlandı, **teyit bekleniyor**. 25 Kasım ise ilk 15 günlük (100) dönem en erken ~9–10 Aralık'ta biter. Kesin tarih kabul edilmez; her çalışma Quota/My ile ölçer.

**Bugünkü tüketim (27.11):** giriş 1, Countries 1, States 1, Cities 3, Monthly 3 (+Quota/My 2, sayılmadı). Kalan en az 97.

| Adım | İstek | Uç başına en yüksek | Onay |
|---|---|---|---|
| Tam eşleme | 85 (giriş 1, Quota 2, States 1, Cities 81) | Cities 84/100 | Gerekli |
| DateRange testi | 5 (giriş 1, Quota 2, DateRange 2) | DateRange 2/100; yer başına 1/10 ay | Gerekli |
| Üretim (günlük) | Quota 1 + giriş 1 + Monthly N, N = min(90, kalan − 6) | Monthly ≤ 90/100 | Merge + etkinleştirme |

**Üretim takvimi önerisi (tarihler, eşleme ve onaylar tamamlandıkça kayar):**
- G0: güvenlik PR'ı (#3) merge; tam eşleme; DateRange testi.
- G1: PR #2 develop→main; etkinleştirme commit'i (günde 1 çalışma, `VERI_KAYNAGI=resmi`, `DILIM_BOYUTU=90`, `RESMI_TOPLAM_ISTEK_SINIRI=95`).
- G1–G10: ~90 ilçe/gün, öncelik `sonKullanim` (mobil kabul süresi en erken bitecek önce). 868 ilçe ≈ 10 günde tamamlanır. 13 Aralık'tan önce bitirmek için en geç G1 = 2 Aralık.
- Dönem sonrası: Quota/My'ye göre N kendiliğinden düşer.

**Döngü koşulu (mobil 14 gün kuralı):** her ilçenin dosyası 14 günde en az bir kez yenilenmeli → günde ≥ 868/14 ≈ 62 ilçe. Dönem sonrası hak 10'a düşerse bu koşul Monthly ile **sağlanamaz**.

## Yıllık veri ve 14 gün kuralı (karar gerekir)
Mobil uygulamalar `vakitler/{id}.json` dosyasının `guncelleme` damgası 14 günden eskiyse dosyayı reddeder (güvenlik kuralı, gevşetilmedi). Yıllık DateRange verisi tek seferde alınır; damgası yenilenmediği için 14 gün sonra mobilde reddedilir. Eski veriye yeni damga vermek yasak (SOZLESME.md). Seçenekler:
1. **Yıllık veri yalnız yedek depo** (yayın dışı): hak düştüğünde yayın dosyaları Monthly ile döngüsel yenilenir; yetmezse dosyalar 14 günde reddedilir ve uygulama cihazdan aynaya düşer. Kural değişmez. (Önerilen başlangıç)
2. **Resmi takvim verisi için ayrı tazelik anlamı**: yıllık dosyaya `kaynakTuru: "resmi-yillik"` ve "geçerlilik sonu" alanı; mobil yalnız bu tür için yaş yerine kapsamı kontrol eder. Mobil sözleşme değişikliği ve **kullanıcı onayı** gerekir; uygulanmadı.
3. Diyanet'ten daha yüksek kota talebi.

**8. tur (27.11.2026):** tam resmi eşleme 81 il / 869 ilçe (run 45995729583 + 46004878195; ŞUHUT). Yıllık mimari PR #4'te (offline). Üretim geçişi: URETIM-HAZIRLIK.md "8. tur" (Plan A/B).
