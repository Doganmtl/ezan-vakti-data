# Karar kaydı

- D01 (onaylı): main kararlı dal, develop geliştirme dalı; main merge kullanıcı onayıyla. Android/iOS derle kontrolü zorunlu; Data otomasyon yazımı korunur.
- D02 (onaylı): Diyanet resmi API entegrasyonu öncelikli; izin kullanıcı beyanıyla alınmış. Teknik sözleşme/credential doğrulanacak.
- D03 (onaylı): Türkçe UI, takvim popup/onboarding, günlük iki dilli dini içerik, widget, adaptive tasarım ve logo seçimi. Mevcut namaz takibi/bildirim/Ramazan kodu korunur.
- D04 (onaylı): monetizasyon ertelendi; stabilite ve tasarım öncelikli.
- D05 (öneri): feature/fix dalları ve küçük PR; kullanıcı onayı olmadan yayın yok.
- D06 (öneri, onay bekliyor): kısmi yayın eşikleri. Payda = aktif ilçe (toplam − bilinen istisna; şu an 869 − 1 = 868).
  Sınıflar: yedek (≥7 gün), kisaKapsam (bugün+yarın var, <7 gün), tukenmis (dosya var ama bugün/yarın geçersiz), eksik (dosya yok), bilinenEksik (ATLANAN, oranlara girmez).
  Kural: kaynak hatası (yedek+kisaKapsam+tukenmis+eksik) > %2 (en çok 17) veya kullanılamaz (tukenmis+eksik) > %1 (en çok 8) ise yayın durur. kisaKapsam tek başına durdurmaz.
  Not: önceki sürüm kısa ama geçerli yedeği "kullanılamaz" sayıyordu; düzeltildi. Kısmi yayın yenilenmeyen dosyalara dokunmadığı için eşik, yanlış veriyi değil kaynak çapında arızayı yakalar.
  Seçenekler: (A) önerilen — yukarıdaki gibi; (B) her zaman başarılı ilçeleri yayınla, eşik aşılırsa yalnız workflow'u kırmızı bitir (uyarı); (C) daha sıkı — %1 / %0,5.
- D07 (onaylı, 27.11.2026): ilçe kimlikleri kalıcı; yeni kimlik yalnız onaylı geçiş listesiyle. Resmi API sözleşmesi belgelerden; çelişkide OpenAPI/site esas.
- Açık: hesaplama yöntemleri listesi, içerik kaynak/izinleri, logo, crash reporting/sync sağlayıcısı, private repo geçişi, sürüm numarası. Karar verilmeden uygulama varsayımı yapma.
