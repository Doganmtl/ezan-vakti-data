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
