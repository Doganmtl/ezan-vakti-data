# Devir teslim — ezan-vakti-data
Son güncelleme: 27.11.2026 23:50 · Claude Code

| Alan | Değer |
|---|---|
| Aktif geliştirici | **Claude Code** |
| Aktif görev | Üretim operasyonu: DailyContent denemesi (28.11 00:05), ilk kontrollü üretim (28.11 09:40) |
| Dallar | `develop` `f4ae109` · `main` (PR #5 + günlük bot) · belge PR'ı `claude/kapsam-alternatif-hesaplama` (PR #12) · yerel, push edilmemiş `pilot/awqat-gunluk` `5aba547` (DailyContent deneme workflow'u) |
| Son commit | develop `f4ae109`; PR #12 ucu bu belgenin commit'i |
| CI / test | Yerel `node --test test/*.test.mjs` 144/144 (develop); PR #11 dalında 147/147 |
| Tamamlanan | Sözleşme 2, yıllık arşiv, DateRange/Monthly workflow'ları, günlük 100 istek defteri (D16), öncelikli ilk dilim (D17), hutbe arşivi, fonksiyon sözleşmesi 1.1 |
| Yarım | DailyContent yanıt biçimi bilinmiyor (deneme bekliyor) · zamanlamayı açan PR (öncelik listesini kaldırma, dilim 90, pilot/üretim ortak kota defteri) |
| Bilinen sorunlar | Pilot dalı Actions önbelleği main defterince görülmez → ortak defter/ofset gerekli · eski v1 mobil okuyucular yıllık dosyayı son içerik değişiminden 14 gün sonra reddeder (mobil v2 politikası herkese açık yayından önce) |
| Sonraki görev | 00:05 deneme → rapor → workflow kaldır · 09:40 kota ≥ 90 doğrulanırsa DateRange dilim 4 → Monthly dilim 4 → Pages doğrulama → zamanlama PR'ı |
| Gerekli onaylar | `awqat-test` ve `awqat-uretim` ortam onayları · PR #12 → develop · yeni Data PR'larının main'e alınması · PR #11 taslak kalır (merge yok) |

## Codex'e devam talimatı (yalnız kullanıcı devrederse)
> Data deposunda **canlı API, workflow tetikleme, ortam onayı, secret ve kota işlemi yapma** — bunlar yalnız Claude'a aittir. Yalnız çevrimdışı kod/test/belge işi: `git fetch origin`, `DEVIR-TESLIM.md`'yi oku, `codex/<konu>` dalını `origin/develop`'tan aç, `node --test test/*.test.mjs` geçsin, taslak PR → develop. Bitince bu belgeyi güncelle.

## Değişmeyen kurallar (tüm devirlerde)
Diyanet tek resmî vakit kaynağı; eMushaf yedeği korunur; Adhan/alternatif hesaplama kapsam dışı. Canlı Diyanet API işlemleri ve günlük 100 istek tavanı **yalnız Claude**. Force push, yetkisiz merge, main/develop'a doğrudan yazma, secret işlemi, mağaza/TestFlight dağıtımı yok. Görsel tasarım kapsam dışı. Kullanıcı verisi ve mevcut fonksiyonlar korunur. Aynı depoda aynı anda tek yazar. Gerçek cihazda yapılmayan test yapılmış sayılmaz.

## Devir prosedürü (aktif geliştirici)
1. Yarım değişikliği derlenir/güvenli noktaya getir; yapılamıyorsa `wip:` önekiyle ayrı commit ve aşağıda "yarım" olarak yaz.
2. Commit + push; `git status --porcelain` boş, stash yok.
3. Bu belgedeki tabloyu ve "Codex'e devam talimatı"nı güncelle, commit + push.
4. Kullanıcıya bu belgenin bağlantısını ver.

Devralan: `git fetch origin` → bu belge → tablodaki dal/SHA ve PR/CI → `git log <son SHA>..` farkı. Genel proje analizi yapılmaz.
