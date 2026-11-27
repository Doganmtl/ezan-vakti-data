# Fonksiyon sözleşmesi — iOS ve Android ortak davranış kuralları

**Asıl kaynak:** `ezan-vakti-data/FONKSIYON-SOZLESMESI.md` (sahibi Claude Code). iOS ve Android depolarındaki aynı adlı dosya bunun kopyasıdır.
**Değişiklik:** yalnız Data deposunda yapılır; `CHANGELOG.md`'ye ve `GOREV-DAGILIMI.md` "Sözleşme değişiklikleri" bölümüne yazılır, Codex'e kullanıcı/ChatGPT aracılığıyla bildirilir.
**Sürüm:** 1 (27.11.2026). Görsel tasarım bu sözleşmenin kapsamı dışındadır; yalnız davranış tanımlanır.

## 1. Resmî yıllık veri (sözleşme 2) — iki platformda TAMAMLANDI
- Veri biçimi: `ezan-vakti-data/SOZLESME-2.md`. v1 alanları (`guncelleme`, `gunler`) aynen okunur, yeni alanlar isteğe bağlıdır.
- **İçerik sürümü:** `surum = "sha256:" + hex(SHA-256(kanonik))`. Kanonik metin: her gün bir satır `YYYY-MM-DD HH:MM HH:MM HH:MM HH:MM HH:MM HH:MM\n`, tarih sırasıyla, UTF-8, son satır dahil; hicri metin dahil değil. Test vektörleri: `ezan-vakti-data/test/vektorler/surum.json`. Her platform bu vektörleri **birebir** üretmeli (Android `surum-vektorleri.json`, iOS `Tests/surum-vektorleri.json` kopyaları).
- **Kabul** (yalnız `sozlesme ≥ 2` ve `kaynak.tur == "resmi-yillik"`, bayrak açıkken):
  `kaynak.resmiId == istenen ilçe kimliği` → `surum` yeniden hesaplanıp eşit → tarihler geçerli, tekil, kesintisiz; `gecerlilik.ilk/son` = ilk/son gün → her gün 6 sıralı `HH:MM` → `kaynak.alindi` ve `guncelleme` ≤ şimdi + 5 dk → `guncelleme ≥ kaynak.alindi` → `kaynak.alindi` en çok **N** gün eski (taslak 400) → bugün ve yarın (Europe/Istanbul) mevcut → önceki dosyaya göre: daha eski `guncelleme` yok; aynı `guncelleme` farklı `surum` yok; daha eski `kaynak.alindi` yok.
- Ret nedenleri (aynı metin): `ilçe kimliği uyuşmuyor`, `içerik bütünlüğü`, `biçim`, `gelecek zaman damgası`, `zaman damgaları tutarsız`, `kaynak çok eski`, `bugün/yarın kapsanmıyor`, `daha yeni içerik eskiyle ezilemez`, `aynı sürüm damgasıyla farklı içerik`, `daha eski resmî alım`.
- **Doğrulama yaşı reddetmez:** `dogrulama.zaman` yoksa ya da **M** günden eskiyse (taslak 120) yalnız uyarı.
- **Bayrak varsayılan KAPALI** (`ResmiYillik.etkin`). Kapalıyken bütün dosyalar mevcut 14 gün kuralıyla kabul edilir. Bayrağı açmak ve N/M kesinleştirmek kullanıcı kararıdır.
- **Meta veri:** yeni alanlar (`kaynakTuru, kaynakAlindi, dogrulamaZamani, dogrulamaIlk, dogrulamaSon, surum, gecerlilikSon`) isteğe bağlı; eski sürüm aynı JSON'u okuyabilmeli (sürüm düşürme). Önbellekteki daha yeni resmî alımın üzerine daha eskisi yazılamaz.
- **Gösterim:** "Veri yayın tarihi", "Son indirme", "Resmî veri alınma", "Son resmî doğrulama (ilk – son)", "Veri geçerlilik sonu" ayrı satırlar.

## 2. Arka plan veri yenilemesi — TAMAMLANDI
`arkaPlanYenilemeli(simdi, sonDeneme, sonGun, bugun, sonIndirme)`: son denemeden 12 saat geçmediyse hayır; kayıtlı veri yok ya da son gün < bugün + 10 ise evet; değilse son başarılı indirme ≥ 7 gün önceyse evet. (iOS: işletim sistemi arka plan görevinin zamanını garanti etmez.)

## 3. Canlı sayaç — TAMAMLANDI (platforma göre)
- Gösterilen kalan süre dakika **yukarı** yuvarlanır: `S:DD` (`4:42`, `0:45`, `10:05`); 59:00 → `0:59`, 59:00 + 1 sn → `1:00`.
- **Hedef vakit geçtikten sonra eski hedefe ait sayaç gösterilmez.** iOS: etkinlik hedefte eskir, "‹vakit› vakti girdi" yazar. Android: kilit ekranı kartı hedef + 90 sn'de kendiliğinden kalkar, Tazeleyici hedefte (+2 sn) yeni hedefle yazar.
- Planlar şu olaylarda baştan kurulur: yeniden başlatma, uygulama güncellemesi, saat elle değişimi, saat dilimi değişimi, (Android) tam zamanlı alarm izni değişimi, konum değişimi. Eski konumun alarmı/bildirimi kalmaz.
- Kullanıcı izni olmadan ses/bildirim/sessize alma ayarı değiştirilmez.

## 4. Günlük içerik (ayet, hadis, dua, Esmaül Hüsna) — TAMAMLANDI (Arapça kaynak bekleniyor)
- `gunluk.json` → `gunler[] {t: YYYY-MM-DD, g, ayet/hadis/dua: {m, k, ar?}}`. `m` Türkçe metin, `k` kaynak referansı, `ar` Arapça asıl metin **yalnız veri deposu doğrulanmış kaynaktan doldurursa**. Uygulama Arapça metin üretmez ya da uydurmaz.
- Arapça varsa Türkçenin **üstünde**, sağdan sola. Paylaşımda Arapça (varsa) + Türkçe + kaynak + "(T.C. Diyanet İşleri Başkanlığı)".
- Bugünün içeriği yoksa en çok **dünkü** gösterilir ve tarihi yazılır ("İçerik tarihi: GG.AA.YYYY"); daha eskisi bugünün yerine gösterilmez.
- "Önceki günler": bugünden önceki en çok 30 gün, en yeni önce (çevrimdışı önbellek).
- Esmaül Hüsna: uygulamadaki `esma` verisi (Arapça + okunuş + anlam, Diyanet listesi).
- Uzaktan kapatma: `uzaktan.json` anahtarları (`gunluk`, `hutbe`, `esma`) korunur.

## 5. Cuma hutbesi — TAMAMLANDI
- `gunluk.json` → `hutbe` (en son, geriye uyumlu) ve `hutbeler[]` (en yeni önce, en çok 52). Eski dosyada `hutbeler` yoksa `[hutbe]`.
- "Bu haftanın Cuma hutbesi" yalnız içinde bulunulan haftanın (Pazartesi–Pazar) Cuma'sına ait hutbe için kullanılır. Değilse "Son yayımlanan hutbe" yazılır. Hutbe tarihi bu haftanın Cuma'sından eskiyse "Bu haftanın hutbesi henüz yayımlanmadı." notu çıkar.
- Bağlantılar yalnız `diyanet.gov.tr` alan adından (veri deposu süzer). "Önceki hutbeler" arşivde.

## 6. Widget'lar — YAPILACAK
- Hedef içerikler: sonraki vakit ve geri sayım; günlük vakitler; günün ayeti; günün hadisi; günün esması; Cuma hutbesi kısa özeti/erişim. Mevcut widget'lar korunur.
- Veri: uygulamayla **aynı önbellek ve aynı kabul kuralları**; çevrimdışı çalışır; kayıtlı konum değiştiyse eski konumun verisi gösterilmez (konum kimliği eşleşmesi zorunlu); veri yoksa boş durum.
- Güncelleme: platform limitleri içinde (iOS zaman çizelgesi; Android sistem zamanlaması), dakika ve vakit geçişlerinde; gereksiz ağ isteği yok. Desteklenmeyen platform özelliği taklit edilmez.
- Günlük içerik widget'ı: bugünün içeriği yoksa en çok dünkü (tarih etiketiyle), daha eskisi gösterilmez; Arapça kuralı §4.

## 7. Takvimde gün seçimi — YAPILACAK
- Takvimde bir güne dokunulunca o günün: tarih, İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı, varsa hicri tarih ve o güne ait dini gün.
- Kaynak: seçili konumun önbelleği (resmî yıllık veriyle ileri tarihler). Kayıt olmayan gün için vakit **uydurulmaz** ("Bu tarih için kayıtlı vakit yok").
- Seçilen tarih ile konum eşleşmesi zorunlu; konum değişince seçim yeni konumun verisiyle yenilenir. Mevcut dini gün takvimi korunur.

## 8. Alternatif hesaplama yöntemleri — YAPILACAK
- **Varsayılan ve Türkiye için resmî kaynak Diyanet verisidir.** Alternatif yöntem seçilirse vakitler cihazda **hesaplanır** ve her yerde "Hesaplanan vakit (‹yöntem›) — resmî Diyanet verisi değildir" olarak etiketlenir.
- Yöntemler (parametreler uygulamadan önce PrayTimes.org ve adhan kütüphanesi belgeleriyle doğrulanacak): Muslim World League (Fecr 18°, Yatsı 17°), ISNA (15°, 15°), Umm al-Qura (18,5°, Yatsı Akşam + 90 dk, Ramazan'da 120 dk), Mısır Genel Araştırma Kurumu (19,5°, 17,5°), Karaçi İslami İlimler Üniversitesi (18°, 18°). İkindi: Şafii (gölge 1×) varsayılan, Hanefi (2×) seçenek. Yüksek enlem kuralı (gece ortası / yedide bir / açı tabanlı) belirtilmeli.
- Seçim tutarlı biçimde: ana ekran, bildirimler, geri sayım, widget'lar, canlı sayaç, takvim. Yöntem değişince planlar baştan kurulur.
- Diyanet Türkiye verisi ile yurt dışı konum veri politikası birbirine karıştırılmaz. Saat dilimi, DST, koordinat ve yüksek enlem testleri zorunlu.
- **İki platform aynı girdide aynı dakikayı üretmeli:** ortak test vektörleri (konum, tarih, yöntem → 6 vakit) Data deposunda `test/vektorler/hesaplama.json` olarak tanımlanacak (sahibi Claude; hazır olunca bildirilir).

## 9. Türkçe odaklı arayüz — YAPILACAK
- Arayüz metinleri Türkçe öncelikli; İngilizce/başka dilde kalan kullanıcı mesajları, hata, bildirim, ayar ve erişilebilirlik metinleri Türkçeleştirilir. Kullanıcı ayarları ve konumlar kaybolmaz (güvenli ayar geçişi). Arapça dini metinler korunur; diğer dillerin kaldırılması kullanıcı kararıdır, bu turda dil kaldırılmaz.

## 10. Tablet, iPad ve katlanabilir cihazlar — YAPILACAK
- Farklı boyut, yatay/dikey, çoklu pencere, büyük yazı boyutu: içerik taşmaz, kesilmez, erişilemeyen fonksiyon kalmaz.
- Ekran/katlama değişiminde durum korunur: açık sekme, seçili konum, zikir sayacı, namaz/kaza kayıtları, geri sayım. Cihaz modeline özel kod yok; platformun adaptif API'leri.
- Görsel yeniden tasarım değildir; sonraki tasarım entegrasyonuna uygun responsive altyapıdır.

## 11. Paylaşım, favoriler, içerik arşivi — YAPILACAK
- Ayet, hadis, dua, esma için native paylaşım (metin + kaynak); favorilere ekle/çıkar; favoriler cihazda kalıcı ve sürüm düşürme uyumlu; geçmiş içeriklere erişim (§4). Paylaşım kartı görseli yok; ileride tasarımla takılabilir yapı.

## 12. Dinamik vakit arka planı — YAPILACAK (yalnız altyapı)
- Aktif vakit (İmsak…Yatsı) ve sonraki vakte geçiş anı belirlenir; tema/varlık seçimi için genişletilebilir anahtar (`imsak, gunes, ogle, ikindi, aksam, yatsi`). Ön plan/arka plan geçişinde güncellenir; azaltılmış hareket ayarına uyulur; düşük pil tüketimi. **Yeni görsel, renk veya animasyon yok.**

## 13. Ortak kurallar
- Mevcut özellikler kaldırılmaz/devre dışı bırakılmaz; Ramazan modu kodu korunur, etkinleştirilmez.
- Minimum işletim sistemi değiştirilmez (Android API 26, iOS mevcut hedef).
- Yeni ücretli servis, analytics, crash reporting yok. Gereksiz bağımlılık yok.
- Gerçek cihazda yapılmayan test yapılmış sayılmaz; CI başarısı mağaza onayı değildir.
