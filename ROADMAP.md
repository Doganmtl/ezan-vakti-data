# Yol haritası

1. Altyapı: yedek, develop, GitHub erişimi, main koruması tamamlandı; alt ayarlar ve restore testi açık.
2. Dokümantasyon: ortak kurallar, mimari, görev listesi.
3. Stabilizasyon: resmi API, veri doğrulama, Live Activity, bildirim/cache, otomatik testler.
4. Fonksiyonlar: günlük içerik/widget, yöntem seçimi, takvim/onboarding, Türkçe UI, favoriler ve paylaşım.
5. Tasarım: logo seçimi, motifler, dinamik arka plan, adaptive tablet/foldable.
6. QA/yayın: cihaz matrisi, erişilebilirlik, performans, lisans, mağaza kontrolü.

Her fazın çıkış kriteri: ilgili kabul testleri, regresyon kontrolü, doküman güncellemesi ve kullanıcı onayı. Sürüm numarası ve yayın tarihi henüz kararlaştırılmadı. Monetizasyon sonraki faz.

## Resmi kaynak geçişi (27.11.2026, 8. tur sonrası)
1. ✅ Tam resmi eşleme ve resmi adlar (PR #2) · ✅ yıllık mimari offline (PR #4, stacked)
2. Onay: PR #2 → develop → main; PR #4 → develop → main
3. Plan A (önerilen): awqat-uretim ile DateRange yıllık yayın + Monthly doğrulama, artırılmış dönemde (≈09–10.12'ye kadar). Plan B: önce Monthly, sonra DateRange. Ayrıntı: URETIM-HAZIRLIK.md "8. tur".
4. Mobil v2 geçerlilik politikası (herkese açık yayından önce) · branch protection (ayrı veri dalı planı) · dönem sonrası kota kararı
