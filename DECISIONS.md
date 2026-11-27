# Karar kaydı

- D01 (onaylı): main kararlı dal, develop geliştirme dalı; main merge kullanıcı onayıyla. Android/iOS derle kontrolü zorunlu; Data otomasyon yazımı korunur.
- D02 (onaylı): Diyanet resmi API entegrasyonu öncelikli; izin kullanıcı beyanıyla alınmış. Teknik sözleşme/credential doğrulanacak.
- D03 (onaylı): Türkçe UI, takvim popup/onboarding, günlük iki dilli dini içerik, widget, adaptive tasarım ve logo seçimi. Mevcut namaz takibi/bildirim/Ramazan kodu korunur.
- D04 (onaylı): monetizasyon ertelendi; stabilite ve tasarım öncelikli.
- D05 (öneri): feature/fix dalları ve küçük PR; kullanıcı onayı olmadan yayın yok.
- D06 (revize, kullanıcı onayı 27.11.2026: A' + C ve kontrollü küçük dilim toleransı). Payda: aktif = toplam − bilinen istisna; denenen = aktif − planlı bekleyen.
  Kaynak hatası (denenen içinde yedek+kisaKapsam+tukenmis+eksik) sınırı max(1, floor(denenen × %2)).
  Kullanılamaz (denenen içinde tukenmis+eksik) sınırı floor(denenen × %1); başka ilçe başarıyla güncellendiyse en az 1 (kontrollü kurtarma).
  Başarılı ilçe yoksa yayın yok. Planlı bekleyenler kaynak hatası değildir ve yayını engellemez; dosyaları/damgaları korunur, kullanılamaz olanları raporlanır.
  Türkiye geneli kullanılamaz > floor(aktif × %1) → kritik operasyon uyarısı (meta.kullanilabilirlik, Actions ::warning::); başarılı ve doğrulanmış ilçelerin yayınını engellemez.
  Değişmeyen kurallar: bozuk/doğrulanmamış veri yayınlanmaz; eski veriye yeni damga yok; yetki/kimlik/kota hatasında güvenli durma; kota bilinmiyorsa istek yok; sözleşme ve kalıcı kimlikler; atomik yazma ve yayın korumaları.
  Sınıflar mobil davranışla aynıdır (kapsam + 14 gün damga yaşı). Önceki A sürümü (bekleyenleri de sayan) kademeli güncellemede 02.12'den sonra kilitlenme yaratacağı için değiştirildi.
- D08 (27.11.2026): Awqat pilotu GEÇTİ (11 istek, run 45976882480): kimlikler eMushaf ile aynı, 9541/9206 20 ortak günde birebir aynı, Monthly kayan 32 gün, uç başına günlük hak 100 (geliştirici dönemi). Üretimde kademeli güncelleme gerekir.
- D07 (onaylı, 27.11.2026): ilçe kimlikleri kalıcı; yeni kimlik yalnız onaylı geçiş listesiyle. Resmi API sözleşmesi belgelerden; çelişkide OpenAPI/site esas.
- Açık: hesaplama yöntemleri listesi, içerik kaynak/izinleri, logo, crash reporting/sync sağlayıcısı, private repo geçişi, sürüm numarası. Karar verilmeden uygulama varsayımı yapma.
