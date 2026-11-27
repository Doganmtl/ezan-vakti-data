# Teknik mimari — data

Node.js 24, GitHub Pages https://doganmtl.github.io/ezan-vakti-data. scripts/guncelle.mjs, dogrula.mjs, gunluk.mjs; test/sahte-kaynak.mjs; docs/v1/meta.json, iller.json, ilceler/, vakitler/, gunluk.json, dini-gunler.json, uzaktan.json. Mevcut kaynak Diyanet verisinin eMushaf aynası; resmi API entegrasyonu henüz yapılmadı. 81 il, 869 ilçe. Mobil istemciler statik JSON ve fallback kullanır.

## Veri akışı
Diyanet verisi → mevcut eMushaf aynası → Node güncelleme/validasyon → GitHub Pages v1 JSON → mobil provider/cache → UI, widget ve bildirim. Uluslararası ve hata fallback'leri platform bazında doğrulanacak. Resmi API hedefi sunucu tarafında; mobil istemciye kimlik bilgisi gömülmez. JSON sözleşmesi değişirse iki mobil istemciyle uyumluluk testi zorunlu.

## Riskler
Veri eskimesi, eksik ilçe/gün, saat dilimi, cihaz bildirim kısıtları, dış kaynak kesintisi. Data meta 19 Kasım 2026: 868/869 güncellenen ilçe, Mihalgazi HTTP 502; sonraki durum yeniden ölçülmeli. Mobil test kapsamı ve içerik lisansları açık inceleme konusudur.

## CI
guncelle.yml: Pazartesi/Perşembe 04:17 TR, manuel; gunluk.yml: günlük 03:07 ve 07:37 TR, manuel. Ortak concurrency; main üzerine otomatik commit. AWQAT_EMAIL/PASSWORD opsiyonel doğrulama secret referansları, mevcut değerler bilinmiyor.

Bu belge ön incelemeye dayanır; ayrıntılı kaynak ve gerçek cihaz doğrulaması görev bazında yapılır.
