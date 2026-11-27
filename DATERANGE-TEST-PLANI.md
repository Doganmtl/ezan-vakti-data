# DateRange kontrollü testi (onay bekliyor)

Durum: betik hazır (`scripts/resmi/daterange-test.mjs`), ÇALIŞTIRILMADI. Ayrı kullanıcı onayı gerekir.

## İstek bütçesi: kesin 5
| # | İstek | Not |
|---|---|---|
| 1 | `POST /Auth/Login` | |
| 2 | `GET /api/Quota/My` | Kalan hak < 3+5 veya bilinmiyorsa burada durur |
| 3 | `POST /api/PrayerTime/DateRange` {cityId: 9541, startDate: bugün, endDate: bugün+364} | Yer bazında aylık 10 haktan 1 |
| 4 | Aynısı 9206 için | |
| 5 | `GET /api/Quota/My` | Tüketimi ölçmek için |
Tekrar yok; ilk hatada (400 dahil) durur. Tarih biçimi OpenAPI'deki `date-time` (`YYYY-AA-GGT00:00:00`); kabul edilmezse test DURDU ile biter, ikinci deneme ayrı onayla.

## Kriterler (yıllık kapsam önceden kabul EDİLMEZ; dönen gerçek kapsam ölçülür)
| Kriter | Geçme koşulu |
|---|---|
| D1 şema | Her günde tarih + 6 vakit alanı, HH:MM, sıralı (Monthly ile aynı alanlar) |
| D2 kesintisiz | İstenen 365 günün tamamı, tekrarsız, aralık dışı gün yok. Daha kısa dönerse **azami aralık = dönen gün sayısı** olarak raporlanır, KALDI |
| D3 yıl geçişi | 31.12.2026 ve 01.01.2027 ikisi de var |
| D4 eşitlik | Yayındaki dosyalarla (ayna = Monthly, pilot D08) en az 7 ortak günde 6 vakit birebir aynı |
| D5 istek | ≤ 5 |

## Sonuca göre
- GEÇTİ: yıllık yedek veri deposu tasarlanır (yayına doğrudan değil; bkz. DIYANET-GECIS.md "Yıllık veri ve 14 gün kuralı").
- KALDI (kısa aralık): ölçülen azami aralığa göre parça sayısı hesaplanır (yer başına aylık 10 hak içinde).
- DURDU: biçim/aralık hatası; yeniden deneme ertesi gün ve onayla.
