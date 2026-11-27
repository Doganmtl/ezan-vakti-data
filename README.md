# ezan-vakti-data

Ezan Vakti uygulamasının kullandığı namaz vakti verisi. Türkiye'deki 81 il ve tüm ilçelerin vakitleri
T.C. Diyanet İşleri Başkanlığı verisinden **haftada iki kez otomatik** üretilir ve GitHub Pages
üzerinden ücretsiz yayınlanır. Uygulama vakitleri yalnızca buradan okur: kullanıcı başına giriş, jeton
veya sunucu masrafı yoktur.

## Nasıl çalışır
1. `.github/workflows/guncelle.yml` pazartesi ve perşembe 04:17'de (Türkiye saati) çalışır.
2. `scripts/guncelle.mjs` il → ilçe → vakit listelerini çeker, her günü doğrular
   (6 vakit, geçerli saat, sıralı), eski verilerle birleştirir ve `docs/v1/` altına yazar.
3. Her şey yolundaysa değişiklikler depoya kaydedilir; GitHub Pages yeni dosyaları yayınlar.

**Güvenlik ağı:** 81 il gelmezse ya da ilçelerin %2'sinden fazlası alınamazsa hiçbir dosya değiştirilmez, iş akışı kırmızıya düşer ve GitHub size e-posta atar.
Yayındaki veri her ilçe için en az 2 hafta ileriyi kapsadığından, sorunu çözmek için zamanınız olur.

## Dosyalar
| Yol | İçerik |
|---|---|
| `docs/v1/iller.json` | `[{ "id": 506, "ad": "ANKARA" }, …]` |
| `docs/v1/ilceler/{ilId}.json` | `[{ "id": 9206, "ad": "ANKARA" }, …]` |
| `docs/v1/vakitler/{ilceId}.json` | `{ "guncelleme": "…", "gunler": [{ "t": "18.11.2026", "v": ["06:03","07:30","12:39","15:14","17:38","19:00"], "h": "9 Cemaziyelahir 1448" }] }` |
| `docs/v1/meta.json` | Son güncelleme zamanı, il/ilçe sayısı, uyarılar |
| `docs/v1/uzaktan.json` | Uzaktan kapatma anahtarları (elle düzenlenir, aşağıya bakın) |

`v` sırası: İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı. Kimlikler Diyanet'in il/ilçe kimlikleridir.

## Uzaktan kapatma (`docs/v1/uzaktan.json`)
Bir hak sahibi şikâyet ederse ilgili bölüm, uygulama güncellemesi beklemeden kapatılabilir.
`kapali` listesine anahtarı yazıp kaydetmek yeterli; uygulamalar (Android ve iOS) bir sonraki açılışta
o bölümü gizler. Açmak için anahtarı listeden silin.

| Anahtar | Kapatılan bölüm |
|---|---|
| `gunluk` | Günün ayeti, hadisi ve duası |
| `hutbe` | Cuma hutbesi kartı |
| `esma` | Günün Esması ve 99 isim listesi |
| `tesbihat` | Namaz tesbihatı rehberi ve namaz sonrası dualar |
| `ezanSesi` | Ezan kaydı (bildirimler varsayılan sesle gelir) |

Örnek: `"kapali": ["ezanSesi", "gunluk"]`. Dosya okunamazsa uygulama son bildiği ayarla devam eder.

## Bakım
- **Elle güncelleme:** Actions → "Vakitleri güncelle" → Run workflow.
- **Resmi API:** zamanlanmış iş akışı resmi API'ye istek göndermez. Resmi kaynak entegrasyonu ayrı,
  onaylı bir değişiklikle gelir (PR #2).
- GitHub, 60 gün boyunca etkinlik olmayan public repolarda zamanlanmış iş akışlarını durdurabilir.
  Bu iş akışı her çalıştığında commit attığı için normalde sorun olmaz; Actions sekmesinde uyarı
  görürseniz "Enable workflow" demeniz yeterli.
- Kaynak: ezanvakti.emushaf.net (Diyanet verisinin aynası). Kaynak değişirse yalnızca
  `scripts/guncelle.mjs` değişir; uygulama ve dosya biçimi aynı kalır.

## Yerel test
```bash
node test/sahte-kaynak.mjs 8787 &           # sahte kaynak (modlar: normal, bozuk-saat, eksik-il, cok-hata)
SOURCE_URL=http://127.0.0.1:8787 DELAY_MS=0 OUT_DIR=/tmp/test/v1 node scripts/guncelle.mjs
```
