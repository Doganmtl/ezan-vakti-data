# Görev listesi — data

Durum: aşağıdaki işler planlandı; tamamlandı olarak işaretlenmemiştir. P0 kritik, P1 özellik, P2 tasarım/kalite. Her işte owner, branch, kabul kriteri, test sonucu ve PR kaydı eklenir.

- [ ] P0: Diyanet resmi API geçişi; izin alınmış (kullanıcı beyanı), sözleşme ve kimlik bilgileri doğrulanacak.
- [ ] P0: Veri tazeliği, offline/cache, konum ve saat dilimi, bildirim güvenilirliği; hata durumunda yanlış vakit göstermeme.
- [ ] P0: iOS Live Activity/Dynamic Island taşması.
- [ ] P1: Günlük esma, hadis, ayet: Arapça üstte Türkçe altta; doğrulanmış kaynak, sıralı havuz gerekirse; günlük widget ve haftalık Cuma hutbesi widget'ı; remote flags.
- ~~P1: Alternatif namaz hesaplama yöntemleri~~ — **kapsam dışı** (kullanıcı kararı 27.11.2026, D19). Diyanet tek resmî kaynak; eMushaf yedeği korunur.
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
- [x] DATA-03A Saf v1 doğrulama ve günlük kayıt koruma: 13/13 CI başarılı (45838210431).
- [ ] DATA-03B Sahte HTTP entegrasyonu, atomik yayın ve mobil kontrat testleri: DIYANET-GECIS.md.

- [x] DATA-03C Loopback HTTP ve dosya hata enjeksiyonu: 13/13 CI başarılı (45838210431).
- [x] DATA-03D İzole yayın scripti, staged snapshot kontrolü ve stale checkout koruması; 15/15 CI başarılı (45838451813). Üretim workflow bağlantısı ayrı onay gerektirir.

- [ ] DATA-03E Kimlik kümesi, ilçe timestamp, 400 günlük arşiv, prayer Git ve workflow ref/event/rerun guard; CI bekleniyor.

## 27 Kasım 2026 — onaylı 10 madde (Claude Code)
- [x] DATA-P1 publish-data.sh workflow bağlantısı (CI bekleniyor; üretim merge ayrı onay)
- [x] DATA-P2 dogrula.mjs kaldırıldı; sözleşme tabanlı adaptör + sahte testler
- [x] DATA-P3 kısmi yayın + sınıflandırma; %1 eşiği onay bekliyor (D06)
- [x] DATA-P4 kimlik eşleme tablosu + onaylı geçiş listesi
- [x] DATA-P5 offline testler ağ/yayından önce
- [x] DATA-P6 SOZLESME.md
- [ ] Gölge çalıştırma (canlı API, ayrı onay), resmi kimliklerin doldurulması, üretim etkinleştirme

## 27 Kasım 2026 (2) — ChatGPT değerlendirmesi sonrası
- [x] guncelle.mjs resmi kaynak modu (varsayılan ayna; onay + istek sınırı zorunlu), offline testli
- [x] D06 sınıfları ayrıldı (yedek / kisaKapsam / tukenmis / eksik / bilinenEksik); karar onay bekliyor (DECISIONS)
- [x] Belge çelişkileri için güvenli varsayılanlar (token 30 dk, kota 5/gün, toplam sınır zorunlu)
- [x] 3 ilçelik pilot betiği ve PILOT-PLANI.md (11 istek) — çalıştırılmadı
- [ ] Pilot (canlı API onayı), tam eşleme (83 istek), kota stratejisi, üretim etkinleştirme, merge

## 27 Kasım 2026 (6. tur)
- [x] PR #3 merge (f3b50cb) · [x] awqat-test / awqat-uretim Environment · [x] D06 A'+C (CI 95/95)
- [x] Tam eşleme (85 istek): 81/81 il, 868/869 ilçe; 9183 SUHUT ad farkı → tablo değişmedi
- [x] DateRange testi (5 istek): GEÇTİ, 365 gün
- [x] Resmi ad uyarlama kodu (47f2f9f)
- [x] KULLANICI: repository seviyesindeki AWQAT_EMAIL / AWQAT_PASSWORD secret'ları silindi (8. turda salt okuma ile doğrulandı)
- [x] Tam eşleme 85 istekle tekrarlanmadı: önceki 868 kayıt bütünlükle yeniden kuruldu + Şuhut 4 istek (8. tur)
- [ ] PR #2 develop→main (guncelle.yml çakışması PR #2 lehine), üretim etkinleştirme (awqat-uretim) — ayrı onay
- [ ] Veri geçerlilik politikası (mobil) ve kota artışı talebi — karar

## 27 Kasım 2026 (8. tur) — owner: Claude Code
- [x] G0 secret/Environment izolasyonu salt okuma ile doğrulandı; genel izolasyon testleri (workflow.test.mjs)
- [x] G1 main → feature normal merge (01067a1); guncelle.yml PR #2 sürümü; eski canlı betik geri gelmedi
- [x] G2 868 kayıt bütünlükle yeniden kuruldu (c35aa255…afc8b), Şuhut 4 istek (run 46004878195): 81 il / 869 ilçe, SUHUT → ŞUHUT (165a73e)
- [x] G3 PR #4 (stacked, draft): sözleşme 2, DateRange yıllık arşiv, Monthly doğrulama, oransal pay, ayrı yayın grupları, doğrulayıcı (CI 46008187596, 131 test)
- [ ] KARAR: D12 sistematik fark eşiği, D13 mobil v2 eşikleri, D11 arşiv yeri/izin
- [ ] ONAY: PR #2 → develop → main, PR #4 merge, üretim aktivasyonu (Plan A/B: URETIM-HAZIRLIK.md), branch protection uygulaması
- [x] ~~Quota/My grup → uç eşleşmesi (ucPlani ortak havuz)~~ — D23 ile kapandı; ortak havuz kaldırıldı
- [ ] Gerçek cihaz: 365 günlük dosya, 14 gün sonrası önbellek davranışı, v2 politikası (mobil kod değişikliği ayrı onay)

## 27 Kasım 2026 (9. tur) — owner: Claude Code
- [x] PR #2 → develop (563b741), PR #4 → develop (d349782), develop → main PR #5 (0115c53)
- [x] Plan A aktivasyon kodu: günlük 100 istek defteri, ilk çalışma kota tazeliği, toleranssız doğrulama hatası, öncelikli ilk dilim, ayrı DateRange/Monthly workflow'ları, operasyon özeti
- [ ] İlk kontrollü üretim çalışması (4 ilçe) — D23 (PR #19) sonrasında, elle tetikleme
- [ ] İlk yayın doğrulanınca: öncelik listesini kaldır, zamanlamayı aç (DateRange günlük, Monthly sonrasında), dilim 90
- [ ] (P2, mobil geliştirmeyi bekletmez) `veri` dalı + ruleset geçişi; offline-tests main hedefli PR'larda da çalışsın
- [ ] Mobil: sözleşme 2 okuyucuları, Live Activity, Android sayaç/bildirim, günlük içerik, hutbe, widget, takvim, hesaplama yöntemleri, Türkçe, tablet/katlanabilir, paylaşım, dinamik arka plan (ayrı draft PR'lar)

## 28 Kasım 2026 — Diyanet kota modeli (D23) — owner: Claude Code
- [x] Kök neden, dosya/satır envanteri, kayıtlı Quota/My kanıtı (`KOTA-ANALIZI.md`)
- [x] Servis + parametre + dönem kota defteri; operasyonel HTTP sınırı ayrı; bağımsız servisler; Q1–Q11 testleri (161/161)
- [ ] Kullanıcı onayı → PR #19 main
- [ ] Kontrollü canlı teşhis (KOTA-ANALIZI §7, 6 HTTP isteği; PR #20) — ayrı onay
- [ ] Teşhis sonucu: benefit hizmet toplamına mı parametreye mi? → §6 planından A ya da B; gerekiyorsa `kota.mjs`'de toplam kontrolü gevşetilir (ayrı PR)
- [ ] DateRange üretimi: 29.11–08.12 her gün ≈ 94 ilçe (A yorumu) — zamanlama kullanıcı onayıyla
- [ ] Eşleme/test araçları (`eslesme-il`, `eslesme-esle`, `daterange-test`, `pilot`) yeniden kullanılacaksa `bosSinir` ve kota defteriyle güncellenecek
- [ ] Mobil: sözleşme 2 okuyucuları, Live Activity, Android sayaç/bildirim, günlük içerik, hutbe, widget, takvim, Türkçe, tablet/katlanabilir, paylaşım, dinamik arka plan (ayrı draft PR'lar)

- [x] Gizlilik politikası v2.0.0 (28.11.2026): `docs/gizlilik.html` yeniden yazıldı (30 madde, Türkçe, açık/koyu tema, yazdırılabilir, JS/çerez yok), v1 `docs/gizlilik-v1.html` arşivi, `test/gizlilik.test.mjs`. Açık: yürürlük tarihinin yayın günü yazılması, main'e alma (kullanıcı onayı), hukuki görüş.
