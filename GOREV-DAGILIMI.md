# Görev dağılımı — Ezan Vakti (Data · iOS · Android)

Kesinleşme: 27.11.2026 (kullanıcı + ChatGPT). Aynı içerik üç depoda; asıl kaynak `ezan-vakti-data/GOREV-DAGILIMI.md`.

## Roller
| Ajan | Sorumluluk | Yazabileceği depolar |
|---|---|---|
| **Claude Code** | Data deposu (üretim, Diyanet API, günlük 100 istek tavanı, veri sözleşmesi, test vektörleri) ve iOS | `ezan-vakti-data`, `ezan-vakti-ios` |
| **Codex** | Android | `ezan-vakti-android` |
| **ChatGPT** | Proje yönetimi, bağımsız teknik denetim, GitHub/CI takibi, platformlar arası uyum | — (yalnız inceleme) |

- Claude Android deposunda **kaynak kodu değiştirmez**. Codex Data ve iOS depolarında **kaynak kodu değiştirmez**. Karşılıklı **salt okunur** inceleme serbest.
- **Canlı Diyanet API isteği yalnız Claude** tarafından, Data deposunun onaylı workflow'larından gönderilir. Codex canlı istek göndermez, secret kullanmaz.
- Ortak davranış: `FONKSIYON-SOZLESMESI.md`. Veri biçimi: `ezan-vakti-data/SOZLESME-2.md`. Değişiklikler yalnız Data deposunda, CHANGELOG ve aşağıdaki "Sözleşme değişiklikleri" ile duyurulur.
- Codex iOS'u beklemeden sözleşmeye göre ilerleyebilir; iOS da Android'i beklemez.

## Dal kuralları
- Yeni dallar: Claude `claude/<konu>`, Codex `codex/<konu>`. Mevcut dallar **yeniden adlandırılmaz**.
- Android'in devir tabanı: `feature/resmi-yillik-veri` (kod `fd31076`; dokümantasyon commit'i üstünde). Codex bu dalın ucundan `codex/<konu>` açar; bu dala Claude artık yazmaz.
- Aynı dala iki ajan yazmaz. İşe başlamadan: `git fetch`, bu tablo, dalın son commit sahibi kontrolü.
- Force push, `reset --hard` ile uzak geçmiş değiştirme, secret değişikliği, yetkisiz merge, mağaza dağıtımı **yok**. Mobil PR'lar taslak kalır; merge kullanıcı onayıyla.
- Data deposunda develop'a PR ile; main'e her PR için kullanıcı onayı.

## Görev panosu
| # | Görev | iOS (Claude) | Android (Codex) | Bağımlılık |
|---|---|---|---|---|
| 1 | Resmî yıllık veri (sözleşme 2) | ✅ `0ecf05a` | ✅ `d7554b6` | — |
| 1b | Haftalık arka plan yenilemesi | ✅ `4a36ce9` | ✅ `34b64e8` | — |
| 2 | iOS Live Activity / Dynamic Island | ✅ `38d8fc2` | — | — |
| 3 | Android canlı sayaç ve bildirim | — | ✅ `dea1f96`, `1cc27fb` | — |
| 4 | Günlük içerik altyapısı (Arapça alanı, tarih, geçmiş) | ✅ `9149436` | ✅ `0dfd03c` | Arapça kaynak: Data (Claude, DailyContent denemesi) |
| 5 | Cuma hutbesi (hafta kuralı, arşiv) | ✅ `2f76158` | ✅ `fd31076` | Data PR #8 develop'ta; main'e alınınca `hutbeler` yayına çıkar |
| 6 | Yeni widget içerikleri | ⏳ Claude | ⏳ Codex | Sözleşme §6 |
| 7 | Takvimde gün seçimi | ⏳ Claude | ⏳ Codex | Sözleşme §7 |
| 8 | Alternatif hesaplama yöntemleri | ⏳ Claude | ⏳ Codex | Data `test/vektorler/hesaplama.json` (Claude hazırlayacak) |
| 9 | Türkçe odaklı arayüz | ⏳ Claude | ⏳ Codex | — |
| 10 | iPad / Android tablet | ⏳ Claude | ⏳ Codex | — |
| 11 | Katlanabilir telefon (native) | — | ⏳ Codex | Ayrıntılı P1 talimatı (CODEX-DEVIR.md) |
| 12 | Paylaşım, favoriler, arşiv | ⏳ Claude | ⏳ Codex | Sözleşme §11 |
| 13 | Dinamik vakit arka planı (altyapı) | ⏳ Claude | ⏳ Codex | Sözleşme §12 |
| 14 | Performans ve regresyon | ⏳ Claude | ⏳ Codex | — |
| D | Data üretimi, DailyContent, kota defteri | Claude | — | Günlük 100 istek tavanı |

Durum işaretleri: ✅ tamam (CI başarılı, gerçek cihaz testi yok) · ⏳ yapılacak · 🔧 sürüyor (sahip ve dal yazılır) · ⛔ engelli (neden yazılır).
Bir göreve başlayan ajan kendi deposundaki bu tabloyu `🔧 + dal adı` ile günceller.

## Dosya kapsamı (eşzamanlı değişiklik olmaması için)
- Claude: `ezan-vakti-data/**`, `ezan-vakti-ios/**`.
- Codex: `ezan-vakti-android/**`.
- Ortak sözleşme dosyaları (`FONKSIYON-SOZLESMESI.md`, `SOZLESME-2.md`, `test/vektorler/*`) yalnız Data'da Claude tarafından değişir; mobil depolardaki kopyaları her ajan kendi deposunda günceller (yalnız kopyalama, içerik değişikliği yok).

## Sözleşme değişiklikleri
| Tarih | Değişiklik | Etkilenen |
|---|---|---|
| 27.11.2026 | Fonksiyon sözleşmesi sürüm 1 | iOS, Android |

## Raporlama
Her ajan turu sonunda kendi raporunu yazar (tamamlanan, commit, CI, test, gerçek cihaz eksikleri, engeller). ChatGPT birleştirir ve denetler.
