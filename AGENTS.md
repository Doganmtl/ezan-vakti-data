# Ajan çalışma kuralları — data

- Çalışmaya başlamadan PROJECT.md, ARCHITECTURE.md, TASKS.md, DECISIONS.md ve AUTOMATIONS.md oku.
- Yerel çalışma kökü C:\EzanVakti\Development; Backups ve OneDrive kopyalarına yazma. git status, fetch ve branch kontrolü yap; kirli çalışma ağacını koru.
- main üzerinde doğrudan geliştirme, force push, reset --hard, gizli anahtar paylaşımı yok. develop tabanlı küçük feature/fix dalları tercih et; PR ile develop, kullanıcı onayıyla main. Data otomasyonlarının main yazması istisnadır.
- Önce mevcut davranışı ve ilgili kaynakları incele; kapsam dışı refactor, özellik silme, bağımlılık veya şema kırılması yok. Her görevde kabul kriteri, test, risk ve geri dönüş planı yaz.
- API anahtarı, imza anahtarı, kişisel veri ve gerçek credential hiçbir commit/log/dokümana girmez. Public repo kabulüyle yaz.
- Gerçek cihaz testi yapılmadıysa yapılmış gibi raporlama. CI başarısı mağaza onayı değildir. TestFlight manuel dispatch veya yayın kullanıcı onayı gerektirir.
- TASKS ve CHANGELOG güncelle; açık kararları DECISIONS'a kaydet. Diğer platforma etkileri belirt. Çakışma halinde dur ve sor.
- ChatGPT ve Claude Code aynı dalda eşzamanlı yazmasın; görev sahibi ve son commit kontrolü yap.

Platforma özel ayrıntılar ARCHITECTURE.md ve TASKS.md içindedir. CLAUDE.md ile çelişki oluşursa dur ve kullanıcıya bildir. Bu belge bir teknik güvenlik mekanizması değildir; GitHub korumaları ve kullanıcı onayı ayrıca geçerlidir.
