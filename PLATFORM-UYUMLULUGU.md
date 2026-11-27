# Platform uyumluluğu — iOS ve Android fonksiyonel fark listesi

Son denetim: 28.11.2026 · Claude Code · Kaynak kod karşılaştırması: iOS `feature/resmi-yillik-veri` (`2155499`), Android `claude/android-integration-test` (`4ff6968`) ve `claude/esitlik-duzeltmeleri`.
Hedef: kullanıcıya sunulan fonksiyonların eşdeğer olması. Native uygulamaların birebir aynı olması gerekmez. Görsel tasarım kapsam dışı.
Sınıflar: **P0** kritik fonksiyon/güvenlik · **P1** eksik fonksiyon veya UX tutarsızlığı · **P2** sonradan · **Native** işletim sisteminden kaynaklanan kabul edilebilir fark · **Tasarım** kullanıcının nihai tasarımıyla çözülecek.
Yöntem: ekran metinleri, ayar anahtarları, izinler, sağlayıcı zinciri ve widget/bildirim kodunun karşılaştırılması. **Gerçek cihazda doğrulanmadı.**

## Özet
| Durum | Sayı |
|---|---|
| Açık P0 | **0** |
| Bu turda kapatılan P1 | 3 (Türkçe hata mesajları iOS, hutbe bağlantı güvenliği iki platform, widget → uygulama içi Günlük) |
| Açık P1 | 3 (tablet/iPad uyarlanabilir yerleşim, katlanabilir — Android, favoriler — iki platform) |
| Açık P2 | 3 |
| Native | 9 |

## Alan bazında
| Alan | Durum | Fark / not | Sınıf |
|---|---|---|---|
| Ana ekran | Eşdeğer | Sıradaki vakit, geri sayım, 6 vakit, hicri tarih, dini gün, Ramazan hesabı (kod korunur, etkin değil) iki platformda | — |
| Namaz vakitleri ve veri kaynakları | Eşdeğer | Zincir aynı: GitHub Pages statik veri → eMushaf yedeği; sözleşme 2 okuyucu iki platformda (bayrak KAPALI). Diyanet tek resmî kaynak; alternatif hesaplama yok | — |
| Konum yönetimi | Eşdeğer | Otomatik konum (Android kaba konum, iOS kullanırken), elle seçim, kayıtlı konumlar, seyahat modu | Native (izin türü) |
| Bildirimler ve alarm | Büyük ölçüde eşdeğer | Önce hatırlatma, Cuma, Kehf, sahur, kandil, tebrik, ezan sesi iki platformda | — |
| | Fark | Android: tam zamanlı alarm izni, namazda telefonu sessize alma (Rahatsız Etmeyin erişimi), "Ezanı sustur" eylemi. iOS: bildirim sesi en çok 30 sn, sistem planlı bildirim | Native |
| Canlı sayaç | Platforma özgü | iOS Live Activity + Dynamic Island; Android kilit ekranı bildirimi, Android 16 canlı güncelleme. Hedefte bayatlama iki platformda | Native |
| Takvim | Eşdeğer | Seçili günün 6 kayıtlı vakti, hicri, dini gün; kayıt yoksa "Bu tarih için kayıtlı vakit yok". Android açılır pencere, iOS gün kartı | Tasarım (yerleşim) |
| Namaz ve kaza takibi | Eşdeğer | Kaza namazı/orucu sayacı (Diğer menüsü), yalnız cihazda | — |
| Zikirmatik | Eşdeğer | Sayaç, hedef, günlük/toplam, titreşim, tesbihat rehberi | — |
| | Fark | Android ses tuşuyla sayma; iOS'ta sistem buna izin vermez | Native |
| Kıble pusulası | Eşdeğer | Pusula ve kıble açısı | — |
| | Fark | Android ana yön adını (Kuzey, Güneydoğu…) metin olarak da gösterir; iOS yalnız erişilebilirlik etiketinde derece verir | P2 |
| Günlük ayet, hadis, Esmaül Hüsna | Eşdeğer | Arapça yalnız veride varsa; bugün yoksa en çok dün; tarih etiketi; 30 günlük geçmiş; uzaktan kapatma | — |
| Cuma hutbesi | Eşdeğer | Hafta kuralı, "henüz yayımlanmadı", arşiv; bağlantılar yalnız HTTPS + Diyanet alan adı (`GuvenliBaglanti`, aynı test vakaları) — **28.11'de kapatıldı** | (P1 kapandı) |
| İçerik arşivi | Eşdeğer | Önceki günler (30) ve önceki hutbeler (52), çevrimdışı | — |
| Widget'lar | Eşdeğer | Vakit widget'ları + 4 içerik widget'ı; içerik seçimi ve tarih kuralları aynı (`IcerikWidgetKurali`); dokununca uygulamadaki Günlük ekranı — **28.11'de eşitlendi** | (P1 kapandı) |
| | Fark | Yenileme: iOS zaman çizelgesi gün başında, Android RTC alarmı gün başında + 3 saat güvenlik periyodu. iOS kilit ekranı widget'ı; Android "widget ekle" sabitleme düğmeleri | Native |
| Paylaşım ve favoriler | Kısmi | Günlük içerik paylaşımı iki platformda; **favoriler iki platformda yok** (görev 12) | P1 |
| Ayarlar ve tercihler | Eşdeğer | Aynı ayar anahtarları (vakit düzeni, widget stili, arka plan, hicri takvim/düzeltme, canlı sayaç, bildirimler, dil) | — |
| | Fark | Android ayar metni widget türlerini sayı vermeden anlatır (28.11 düzeltildi) | (P2 kapandı) |
| Türkçe hata mesajları | Eşdeğer | Ham sistem/ağ/çözümleme hata metni kullanıcıya gösterilmez; Android #10, iOS `kullaniciHataMesaji` — **28.11'de kapatıldı** | (P1 kapandı) |
| | Fark | Android'de konum ve vakit hataları için birim testi var; iOS'ta eşleme fonksiyonu için regresyon testi yok (CI'daki swiftc listesinde değil) | P2 |
| Offline kullanım | Eşdeğer | Önbellek, sürüm düşürme uyumu, yeni veriyi eski alımın ezmemesi, widget'lar yalnız yerel veri | — |
| Dil | Eşdeğer | 12 dil; desteklenmeyen telefon dilinde Türkçe; kayıtlı seçim korunur (sözleşme 1.1 §9) | — |
| Tablet ve uyarlanabilir ekran | Kısmi | İki platformda geniş ekranda iki sütun (Android ≥ 600 dp, iOS regular size class); tam uyarlanabilir yerleşim, çoklu pencere, büyük yazı testleri yok (görev 10) | P1 |
| Katlanabilir telefon | Android'e özgü | Kapsamlı native destek yapılacak (görev 11, P1 talimatı) | P1 (Android) |
| Dinamik vakit arka planı | Kısmi | "Vakte göre" arka plan seçeneği iki platformda var; fonksiyonel altyapı (aktif vakit anahtarı, geçiş zamanı, azaltılmış hareket) görev 13 | P2 |
| Erişilebilirlik | Kısmi | İki platformda temel etiketler (iOS ~22, Android ~42 nokta); büyük yazı ve ekran okuyucu cihaz testleri yok | P2 (cihaz testiyle) |
| Gizlilik ve izinler | Eşdeğer | Analitik/çökme raporu yok; konum yalnız kullanırken/kaba; iOS PrivacyInfo; Android lisans ekranı (üçüncü taraf kitaplıklar), iOS'ta üçüncü taraf kitaplık yok | Native |

## Native farklar (kabul edilen, zorla eşitlenmez)
1. Live Activity / Dynamic Island ↔ Android kilit ekranı bildirimi ve Android 16 canlı güncelleme.
2. iOS kilit ekranı widget'ı ↔ Android bildirim kartı.
3. Android namazda sessize alma ↔ iOS'ta yok.
4. Android ses tuşuyla zikir ↔ iOS'ta yok.
5. Android tam zamanlı alarm izni ↔ iOS sistem bildirim planı.
6. iOS bildirim sesi 30 sn sınırı.
7. Widget yenileme mekanizmaları (WidgetKit zaman çizelgesi ↔ AppWidget + RTC alarmı).
8. Konum izin türü (kullanırken ↔ kaba konum).
9. Açık kaynak lisans ekranı yalnız Android (iOS'ta üçüncü taraf kitaplık yok).

## Açık işler (öncelik)
| # | İş | Platform | Sınıf |
|---|---|---|---|
| 1 | Tablet/iPad uyarlanabilir yerleşim | iki | P1 |
| 2 | Katlanabilir telefon desteği | Android | P1 |
| 3 | Favoriler | iki | P1 |
| 4 | Dinamik arka plan fonksiyonel altyapısı | iki | P2 |
| 5 | Kıble ana yön metni (iOS) | iOS | P2 |
| 6 | iOS hata eşleme regresyon testi | iOS | P2 |
