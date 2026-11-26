# Görev listesi — data

Durum: aşağıdaki işler planlandı; tamamlandı olarak işaretlenmemiştir. P0 kritik, P1 özellik, P2 tasarım/kalite. Her işte owner, branch, kabul kriteri, test sonucu ve PR kaydı eklenir.

- [ ] P0: Diyanet resmi API geçişi; izin alınmış (kullanıcı beyanı), sözleşme ve kimlik bilgileri doğrulanacak.
- [ ] P0: Veri tazeliği, offline/cache, konum ve saat dilimi, bildirim güvenilirliği; hata durumunda yanlış vakit göstermeme.
- [ ] P0: iOS Live Activity/Dynamic Island taşması.
- [ ] P1: Günlük esma, hadis, ayet: Arapça üstte Türkçe altta; doğrulanmış kaynak, sıralı havuz gerekirse; günlük widget ve haftalık Cuma hutbesi widget'ı; remote flags.
- [ ] P1: Alternatif namaz hesaplama yöntemleri seçimi (saat diliminden ayrı); resmi kaynak varsayılanı ve yöntem etiketleri; farklar test edilecek.
- [ ] P1: Türkçe-only UI; çeviri kaynaklarını silmeden önce bağımlılık ve migration incelemesi. Takvimde herhangi bir gün seçilince vakit popup; onboarding gösterimi.
- [ ] P1: Favoriler/arşiv, dini içerik paylaşımı, vakte göre dinamik arka plan.
- [ ] P2: İslami motif/mimari temalı UI, yeni logo kataloğu ve kullanıcı seçimi, tablet/foldable.
- [ ] P2: Erişilebilirlik, performans, crash reporting ve senkronizasyon tasarımı; veri minimizasyonu, izin ve maliyet onayı.
- [ ] P0/P2: Birim/entegrasyon/UI testleri, gerçek cihaz regresyonu, lisans ve mağaza kontrolü.
Mevcut gelişmiş ezan/bildirim, namaz takibi ve kapalı Ramazan modu kullanıcı tarafından mevcut olarak bildirildi; yeniden yazma veya silme, önce kaynakta doğrula.

## Repository özel görevler
- [ ] DATA-01 Resmi Diyanet API sözleşmesini ve izin kapsamını doğrula; kimlik bilgileri yalnızca sunucu/Actions secrets; şema uyumluluğu ve gölge karşılaştırma.
- [ ] DATA-02 403/502, Mihalgazi 33292, veri yaşlanması ve eksik yarın verisi; son başarılı yayın ve ilçe bazlı kapsama kontrolü. Son iyi veriyi koru.
- [ ] DATA-03 Sahte kaynak testlerini genişlet; timeout, retry/backoff, rate limit, eksik gün, timezone, atomik yayın.
- [ ] DATA-04 Arapça/Türkçe doğrulanmış içerik havuzu, kaynak/izin ve remote flags; geriye uyumlu şema.

## Altyapı açık işleri
- [ ] ZIP restore testi; diğer remote dallar ve signing/secret yedek stratejisi.
- [ ] Android integration-test dalını sil (PR #3 kapalı, merge yok).
- [ ] Data koruması sonrası ilk scheduled run ve yayın doğrulaması.
- [ ] iOS manuel TestFlight main guard; kullanıcı onayıyla ayrı PR.
- [ ] Public/private geçişi ve GitHub Pages etkisi değerlendirmesi.

## API hazırlık dalı
- [ ] DATA-03A Saf v1 doğrulama ve günlük kayıt koruma: offline CI sonucu bekleniyor.
- [ ] DATA-03B Sahte HTTP entegrasyonu, atomik yayın ve mobil kontrat testleri: DIYANET-GECIS.md.
