# Devir teslim — ezan-vakti-data
Son güncelleme: 28.11.2026 00:20 · Claude Code

| Alan | Değer |
|---|---|
| Aktif geliştirici | **Claude Code** |
| Aktif görev | Kota teşhisi: 28.11 Quota/My tüm dönem listeleri boş → kota bilinmiyor, 09:40 üretimi ön koşulu karşılanmıyor; karar bekleniyor (operasyon raporu, seçenek A/B/C) |
| Dallar | `develop` `72ff88f` · kota teşhis PR #13 `claude/kota-teshis` · `pilot/awqat-gunluk` `0122fb8` (deneme workflow'u kaldırıldı) · PR #11 taslak (merge yok) |
| Son commit | develop `f4ae109`; PR #12 ucu bu belgenin commit'i |
| CI / test | Yerel `node --test test/*.test.mjs` 144/144 (develop); PR #11 dalında 147/147 |
| Tamamlanan | Sözleşme 2, yıllık arşiv, DateRange/Monthly workflow'ları, günlük 100 istek defteri (D16), öncelikli ilk dilim (D17), hutbe arşivi, fonksiyon sözleşmesi 1.1 |
| Yarım | Kota listelerinin neden boş döndüğü (doğrulanmadı) · DailyContent biçimi (istenmedi) · zamanlama PR'ı ve kalıcı pilot/üretim ortak kota kaydı |
| Bilinen sorunlar | Pilot dalı Actions önbelleği main defterince görülmez → ortak defter/ofset gerekli · eski v1 mobil okuyucular yıllık dosyayı son içerik değişiminden 14 gün sonra reddeder (mobil v2 politikası herkese açık yayından önce) |
| Sonraki görev | Kullanıcı/ChatGPT kararına göre 09:40: A (yalnız teşhis Quota/My, 2 istek) / B (Diyanet'e sor) / C (açık onayla tek veri isteği). 28.11 tüketim: 4; üretime kalan en çok 96 |
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
