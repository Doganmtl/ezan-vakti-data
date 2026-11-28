# Değişiklik günlüğü

## 2026-11-28 — Diyanet kota modeli düzeltmesi (D23, PR #19 onayı bekliyor)
- Kök neden ve envanter: `KOTA-ANALIZI.md`. 28.11'de üç çalışma "kota yenilenmiş görünmüyor (en az kalan null)" ile durdu: boş Quota/My "bilinmiyor" sayılıyor, kota tek havuz ve operasyonel 100 ile karışık modelleniyordu.
- Yeni: `scripts/resmi/kota-defteri.mjs` (gün/ay/yıl × hizmet, hizmet|parametre), `kota.mjs` (`hizmetDurumu`, `parametreIzni`, `kuralSiniri`, `hizmetParametre`, `kotaLogOzeti`); `ucPlani` ve "en az kalan ≥ 90" kaldırıldı. `defter.mjs` yalnız operasyonel HTTP defteri. Hizmet dolarsa kalan ilçeler planlı bekleyen, parametre dolarsa yalnız o ilçe atlanır. İki üretim iş akışına kota defteri cache adımları. Sözleşme kota bloğu resmî metne göre (10/100, 25.11.2026, emniyet 1 gün).
- Testler: 161/161 (Q1–Q11 senaryoları ve uçtan uca kota testleri).



## 2026-11-28 — feature/privacy-compliance-v2
- Gizlilik politikası v2.0.0 (`docs/gizlilik.html`): kısa özet, içindekiler, 30 madde; Android ve iOS'un kaynak koda dayalı gerçek davranışı (konum/Geocoder/CLGeocoder, GitHub Pages ve eMushaf istekleri, cihazda saklama, yedekleme, widget ve Live Activities, uygulama içi silme, üçüncü taraf listesi, KVKK m.11 ve GDPR hakları). v1 arşivi `docs/gizlilik-v1.html`. Çevrimdışı sayfa testi (4).
## 2026-11-27 (kapsam değişikliği)
- Alternatif namaz vakti hesaplama yöntemleri kapsam dışı (kullanıcı kararı; D19). Fonksiyon sözleşmesi 1.1 §8, görev panosu, TASKS, ROADMAP güncellendi. Kod değişikliği yok (özelliğe başlanmamıştı); Data PR #11 taslak kalır.
## 2026-11-27 (9. tur)
- main'e alındı: PR #2 + PR #4 (PR #5, 0115c53). Yayında tek veri değişikliği: 9183 ŞUHUT.
- Plan A üretimi: `guncelle.yml` (DateRange) ve `guncelle-aylik.yml` (Monthly), `awqat-uretim`, günlük 100 istek defteri, ilk kontrollü dilim; ayna zamanlaması kaldırıldı (geri dönüş: bu PR'ın revert'ü).

## 2026-11-27 (8. tur)
- PR #2: main senkronizasyonu (01067a1); Environment izolasyon testleri; tam resmi eşleme 81/869 ve ŞUHUT (canlı: 4 istek, run 46004878195); resmi adlar Türkçe büyük harf ve ayna çalışmalarında korunur.
- PR #4 (stacked, draft): sözleşme 2 (geriye uyumlu), DateRange yıllık dosya ve arşiv kaydı, Monthly doğrulama ve değişiklik yönetimi, oransal kota payı, uç başına ayrı yayın çalışması, doğrulayıcıda sözleşme 2 kuralları. Üretim etkisi yok.

## 2026-11-27 (6. tur)
- Güvenlik: PR #3 main'e alındı (eski canlı API adımı kaldırıldı).
- Environment izolasyonu; D06 A'+C; tam eşleme ve DateRange canlı testleri; resmi ad uyarlama araçları.

## 2026-11-27 (2) — feature/diyanet-api-preparation
- Resmi kaynak modu, ayrıntılı kısmi yayın sınıfları, güvenli varsayılanlar, pilot betiği ve planı. Üretim etkisi yok.

## 2026-11-27 — feature/diyanet-api-preparation (Claude Code, draft PR #2)
- İlçe bazlı kısmi yayın ve `meta.durum` sınıflandırması; eski veriye yeni damga yok.
- Kalıcı ilçe kimlikleri, eşleme tablosu ve onaylı geçiş listesi.
- Workflow'lar: önce offline test, yayın yalnız publish-data.sh; eski canlı Awqat adımı kaldırıldı.
- Resmi API sözleşmesi, adaptör ve gölge çalıştırıcı (canlı çağrı yok). SOZLESME.md eklendi.
- Üretim etkisi yok: workflow'lar main'den çalışır, merge ayrı onay.

## 2026-11-26 — geliştirme altyapısı
- Yerel yedek ve Google Drive ZIP kullanıcı tarafından tamamlandı; git fsck ve main SHA eşleşmesi kontrol edildi.
- develop başlangıç commit'i: 81a93d787786de5e365d3a4abb6b2a9bfbb75ea7.
- main koruması aktif olarak doğrulandı; ayrıntılı admin ayarları API 403 nedeniyle bağımsız okunamadı.
- GitHub entegrasyonu Android geçici dalında branch/file/commit/PR işlemleriyle doğrulandı; PR #3 kapatıldı, test dosyası silindi, dal temizliği açık.
- Bu dokümantasyon yalnızca develop için; uygulama kodu ve yayın sürümü değişmez.

Önceki sürüm: v1 JSON sözleşmesi. Tarihsel değişiklikler için mevcut README ve Git geçmişine bak; bu belge eksiksiz geçmiş iddiasında bulunmaz.
