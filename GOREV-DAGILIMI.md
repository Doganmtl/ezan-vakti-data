# Görev dağılımı — Ezan Vakti (Data · iOS · Android)

## Güncel çalışma modeli · 27.11.2026

| Rol | Sorumluluk |
|---|---|
| Claude Code | Data, iOS ve Android ana geliştiricisi. Data üretim operasyonlarının sahibi. |
| Codex | Claude limite yaklaştığında veya çalışamadığında, kullanıcının açıkça devrettiği depo ve görev için yedek geliştirici. |
| ChatGPT | Merkezi proje yönetimi, bağımsız teknik denetim, güvenlik ve kalite kontrolü. |
| Kullanıcı | Proje sahibi ve nihai karar mercii. |

Her depoda aynı anda tek geliştirici yazar. Devirde temiz çalışma ağacı, push edilmiş dal, son SHA, açık PR ve test durumları kaydedilir. Limit bilgisi görünmüyorsa her anlamlı aşamada kontrol noktası oluşturulur. Yeni dallarda Claude için `claude/<konu>`, Codex için `codex/<konu>` kullanılır. Mevcut dallar ve geçmiş korunur. Mobil PR’lar taslaktır, merge kullanıcı onayı gerektirir. En son Android teslimi [CODEX-DEVIR.md](CODEX-DEVIR.md) içindedir.

## Görev panosu
| # | Görev | iOS (Claude) | Android (Claude) | Bağımlılık |
|---|---|---|---|---|
| 1 | Resmî yıllık veri (sözleşme 2) | ✅ `0ecf05a` | ✅ `d7554b6` | — |
| 1b | Haftalık arka plan yenilemesi | ✅ `4a36ce9` | ✅ `34b64e8` | — |
| 2 | iOS Live Activity / Dynamic Island | ✅ `38d8fc2` | — | — |
| 3 | Android canlı sayaç ve bildirim | — | ✅ `dea1f96`, `1cc27fb` | — |
| 4 | Günlük içerik altyapısı (Arapça alanı, tarih, geçmiş) | ✅ `9149436` | ✅ `0dfd03c` | Arapça kaynak: Data (Claude, DailyContent denemesi) |
| 5 | Cuma hutbesi (hafta kuralı, arşiv) | ✅ `2f76158` | ✅ `fd31076` | Data PR #8 develop'ta; main'e alınınca `hutbeler` yayına çıkar |
| 6 | Yeni widget içerikleri | ⏳ Claude | PR #8 · cihaz testi açık | Sözleşme §6 |
| 7 | Takvimde gün seçimi | ⏳ Claude | PR #9 · cihaz testi açık | Sözleşme §7 |
| 8 | ~~Alternatif hesaplama yöntemleri~~ | ❌ kapsam dışı | ❌ kapsam dışı | Kullanıcı kararı 27.11.2026; Data PR #11 taslak kalır |
| 9 | Türkçe odaklı arayüz | 🔧 dil çözümleme `913ad57`; kalan metinler ⏳ | PR #10 · dil ve hata mesajları, cihaz testi açık | — |
| 10 | iPad / Android tablet | ⏳ Claude | ⏳ Claude | — |
| 11 | Katlanabilir telefon (native) | — | ⏳ Claude | Ayrıntılı P1 talimatı (CODEX-DEVIR.md) |
| 12 | Paylaşım, favoriler, arşiv | ⏳ Claude | ⏳ Claude | Sözleşme §11 |
| 13 | Dinamik vakit arka planı (altyapı) | ⏳ Claude | ⏳ Claude | Sözleşme §12 |
| 14 | Performans ve regresyon | ⏳ Claude | ⏳ Claude | — |
| D | Data üretimi, DailyContent, kota defteri | Claude (yalnız) | — | Günlük 100 istek tavanı; canlı API yalnız Claude |

Durum işaretleri: ❌ kapsam dışı (yapılmaz) · ✅ tamam (CI başarılı, gerçek cihaz testi yok) · ⏳ yapılacak · 🔧 sürüyor (sahip ve dal yazılır) · ⛔ engelli (neden yazılır).
Bir göreve başlayan ajan kendi deposundaki bu tabloyu `🔧 + dal adı` ile günceller.

## Depo kapsamı
Claude üç deponun sahibidir. Codex için yazma kapsamı her yeni devirde `DEVIR-TESLIM.md`'de belirlenir. Ortak sözleşmenin (`FONKSIYON-SOZLESMESI.md`, `SOZLESME-2.md`, `test/vektorler/*`) asıl kaynağı Data deposudur; mobil kopyalar birebir kopyalanır.

## Devir teslim
Her depoda `DEVIR-TESLIM.md`: aktif geliştirici, aktif görev, dal, son commit, tamamlanan/yarım işler, CI, bilinen sorunlar, sonraki görev, gerekli onaylar ve Codex'e hazır devam talimatı. Aktif geliştirici her anlamlı aşamada (commit + push sonrası) bu belgeyi günceller; devralan yalnız bu belgeyi, ilgili PR'ları ve `git log` farkını okur — genel yeniden analiz yapılmaz.

## Sözleşme değişiklikleri
| Tarih | Değişiklik | Etkilenen |
|---|---|---|
| 27.11.2026 | Fonksiyon sözleşmesi sürüm 1 | iOS, Android |
| 27.11.2026 | Sürüm 1.1: §8 alternatif hesaplama yöntemleri **kapsam dışı**; Diyanet tek resmî kaynak, eMushaf yedeği korunur; §9 dil çözümleme: desteklenmeyen telefon dilinde Türkçe | iOS, Android |
| 28.11.2026 | Sürüm 1.2: §9 **yalnız Türkçe** (kullanıcı kararı); Arapça dini metin Türkçenin üstünde korunur | iOS, Android |

## Raporlama
Her ajan turu sonunda kendi raporunu yazar (tamamlanan, commit, CI, test, gerçek cihaz eksikleri, engeller). ChatGPT birleştirir ve denetler.

