# v1 veri sözleşmesi (GitHub Pages `docs/v1`)

Bu belge mobil okuyucuların (iOS PR #5, Android PR #6 ve yayındaki sürümler) bağlı olduğu biçimi sabitler.
Alan silme, yeniden adlandırma veya biçim değiştirme yasaktır; yalnız **ek alan** eklenebilir (okuyucular bilinmeyen alanları yok sayar).

## Zaman damgaları
- `guncelleme` alanları **UTC, ISO 8601, `Z` sonekli** yazılır: `2026-11-19T08:49:17.694Z` (milisaniye isteğe bağlı).
- Ofsetli biçim (`+03:00`) üretilmez; okuyucular yine de kabul etmelidir (Android API 26+ dahil).
- Bir vakit dosyasının `guncelleme` değeri, **o dosyanın kaynaktan son kez başarıyla alındığı** çalışmanın zamanıdır. Kaynaktan yenilenemeyen dosyaya yeni zaman damgası verilmez (yayın doğrulaması bunu zorlar).
- Mobil kural: `guncelleme` 14 günden eski veya 5 dakikadan fazla ilerideyse dosya reddedilir, yedek kaynağa düşülür.

## Tarih biçimleri (bilinçli fark)
| Dosya | Alan | Biçim |
|---|---|---|
| `vakitler/{ilceId}.json` | `gunler[].t` | `GG.AA.YYYY` (Diyanet kaynak biçimi) |
| `gunluk.json` | `gunler[].t` | `YYYY-AA-GG` |
| `dini-gunler.json` | mevcut biçim korunur | değiştirilmez |
Tarihler Türkiye takvim günüdür (Europe/Istanbul); geçersiz takvim günü (31.11) ve tekrar reddedilir.

## Dosyalar
- `iller.json`: `[{id, ad}]`, 81 il.
- `ilceler/{ilId}.json`: `[{id, ad}]`. **Kimlikler kalıcıdır**: kaynakta kaybolan ilçe listede kalır; yeni kimlik yalnız `eslesme/onayli-gecisler.json` ile eklenir. Ad güncellenebilir.
- `vakitler/{ilceId}.json`: `{guncelleme, gunler:[{t, v:[imsak, gunes, ogle, ikindi, aksam, yatsi], h?}]}`. `v` 6 adet `HH:MM`, kesin artan. Yeni yazılan dosya bugün..bugün+14 kesintisiz içerir. Dosya hiç olmayabilir (sınıf `eksik`).
- `meta.json`: `{guncelleme, kaynak, ilSayisi, ilceSayisi, guncellenenIlce, aynayaBirakilanIlce, durum, uyarilar}`.
  - `durum` (ek alan, 2026-11-27): `{basarili: sayı, yedek, kisaKapsam, tukenmis, eksik, bilinenEksik: [id]}`
    - `basarili`: bu çalışmada kaynaktan alındı, `guncelleme` = meta `guncelleme`.
    - `yedek`: alınamadı; eski dosya bugün..+7 kapsıyor, dokunulmadı, eski damgası duruyor.
    - `kisaKapsam`: alınamadı; eski dosya bugün ve yarını kapsıyor ama 7 günden kısa, dokunulmadı.
    - `tukenmis`: alınamadı; eski dosya bugün/yarın için geçersiz, dokunulmadı (uygulama reddeder).
    - `eksik`: alınamadı ve dosya yok.
    - `bilinenEksik`: bilinçli istisna (ör. 33292); ayrıca yukarıdaki sınıflardan birinde de yer alır, oranlara girmez.
  - Eşikler (D06, **onay bekliyor**): kaynak hatası > %2 veya `tukenmis`+`eksik` > %1 ise hiçbir dosya yazılmaz.
- `gunluk.json`, `uzaktan.json`, `dini-gunler.json`: biçim değişmedi.

## Kaynak ve eşleme
- `eslesme/ilce-kimlikleri.json`: v1 ilçe kimliği → `emushaf` ve `resmi` (Awqat cityId). `resmi=null` doğrulanmamış demektir; v1 kimliği asla değişmez.
- Resmi API sözleşmesi: `config/awqat-sozlesme.json` (belgelerden, canlı doğrulanmadı; belirsizlikler dosyada).
- `meta.kaynak` resmi modda "T.C. Diyanet İşleri Başkanlığı (Awqat Salah resmi API)" olur; dosya biçimi değişmez.
