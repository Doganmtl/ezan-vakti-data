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
