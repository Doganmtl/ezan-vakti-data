# Claude Code çalışma talimatları — data

- Çalışmaya başlamadan PROJECT.md, ARCHITECTURE.md, TASKS.md, DECISIONS.md ve AUTOMATIONS.md oku.
- Yerel çalışma kökü C:\EzanVakti\Development; Backups ve OneDrive kopyalarına yazma. git status, fetch ve branch kontrolü yap; kirli çalışma ağacını koru.
- main üzerinde doğrudan geliştirme, force push, reset --hard, gizli anahtar paylaşımı yok. develop tabanlı küçük feature/fix dalları tercih et; PR ile develop, kullanıcı onayıyla main. Data otomasyonlarının main yazması istisnadır.
- Önce mevcut davranışı ve ilgili kaynakları incele; kapsam dışı refactor, özellik silme, bağımlılık veya şema kırılması yok. Her görevde kabul kriteri, test, risk ve geri dönüş planı yaz.
- API anahtarı, imza anahtarı, kişisel veri ve gerçek credential hiçbir commit/log/dokümana girmez. Public repo kabulüyle yaz.
- Gerçek cihaz testi yapılmadıysa yapılmış gibi raporlama. CI başarısı mağaza onayı değildir. TestFlight manuel dispatch veya yayın kullanıcı onayı gerektirir.
- TASKS ve CHANGELOG güncelle; açık kararları DECISIONS'a kaydet. Diğer platforma etkileri belirt. Çakışma halinde dur ve sor.
- ChatGPT ve Claude Code aynı dalda eşzamanlı yazmasın; görev sahibi ve son commit kontrolü yap.

Platform: Node.js 24, GitHub Pages https://doganmtl.github.io/ezan-vakti-data. scripts/guncelle.mjs, dogrula.mjs, gunluk.mjs; test/sahte-kaynak.mjs; docs/v1/meta.json, iller.json, ilceler/, vakitler/, gunluk.json, dini-gunler.json, uzaktan.json. Mevcut kaynak Diyanet verisinin eMushaf aynası; resmi API entegrasyonu henüz yapılmadı. 81 il, 869 ilçe. Mobil istemciler statik JSON ve fallback kullanır.

Görev başında planı ve etkilenen dosyaları sun; sonunda commit, test çıktısı, kalan riskler ve sonraki adımı raporla. Diyanet API geçişinden önce gerçek sözleşmeyi kullanıcıdan güvenli kanalla al; örnek endpoint uydurma.

## Devir — 26 Kasım 2026
Draft PR #2 feature/diyanet-api-preparation, önce HEAD ve CI doğrula, DIYANET-GECIS.md oku. Main d844d86 ve develop dd5d6d4 denetim anında ayrışmış (1/1); günlük içerik commitini koru, kullanıcı onayı olmadan birleştirme. P0: mirror 403 (run 45792782563), meta 19 Kasım, Mihalgazi 33292. 19 offline test başarılı (45839107799); yayın scripti üretime bağlı değil. Resmi sözleşme ve yeniden yayın izni, mock adaptör, token/rate limit, kimlik haritası, shadow dataset; kaynak tarihleri ve ham satırlar doğrulanmadan üretim yok. Canlı API/secret/merge ayrı onay. ChatGPT yazmayı bitirince tek görev sahibi ol.
