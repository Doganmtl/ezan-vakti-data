# Diyanet kota durumu

- Okuma: 2026-11-28T09:26:35.563Z (İstanbul günü 2026-11-28)
- Kaynak: Kota durumu (Quota/My; elle) #46130424192 (kota-oku/kota)
- API = Quota/My'nin okuma anındaki bildirimi · BELGE = resmî dokümantasyon · DEFTER = çalışma sonrası kendi sayımımız

| Kaynak | Dönem | Hizmet | Parametre | Sınır | Kullanılan | Kalan | Aşım | Yenilenme | Not |
|---|---|---|---|---|---|---|---|---|---|
| API | daily | DailyContent/Get (DailyContent) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | Place/City (Place/Cities) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | Place/CityDetail (Place/CityDetail) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | Place/Country (Place/Countries) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | Place/GetAllCities (Place/Cities (parametresiz)) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | Place/GetAllStates (Place/States (parametresiz)) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | Place/State (Place/States) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | PrayerTime/PrayerTimeDaily (PrayerTime/Daily) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | PrayerTime/PrayerTimeDateRange (PrayerTime/DateRange) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | PrayerTime/PrayerTimeEid (PrayerTime/Eid) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | PrayerTime/PrayerTimeMonthly (PrayerTime/Monthly) | (grup toplamı) | 100 | 2 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 2 parametre satırı |
| API | daily | PrayerTime/PrayerTimeMonthly (PrayerTime/Monthly) | cityId:9206 | 100 | 1 | 99 | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} |  |
| API | daily | PrayerTime/PrayerTimeMonthly (PrayerTime/Monthly) | cityId:9541 | 100 | 1 | 99 | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} |  |
| API | daily | PrayerTime/PrayerTimeRamadan (PrayerTime/Ramadan) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | daily | PrayerTime/PrayerTimeWeekly (PrayerTime/Weekly) | (grup toplamı) | 100 | 0 |  | 0 | {"bas":"2026-11-28T00:00:00","son":"2026-11-28T23:59:59.999"} | sınır parametre başına (remainingUse); 0 parametre satırı |
| API | weekly |  |  |  |  |  |  |  | liste boş (bu dönemde listelenen hizmet yok) |
| API | monthly |  |  |  |  |  |  |  | liste boş (bu dönemde listelenen hizmet yok) |
| API | yearly |  |  |  |  |  |  |  | liste boş (bu dönemde listelenen hizmet yok) |
| BELGE | daily | her hizmet | her parametre | 100 |  |  |  |  | R2/R3: normal 10, ilk 15 gün 100 (hesap 2026-11-25; kesin bitiş doğrulanmadı, 1 gün erken bitirilir) |
| BELGE | monthly | PrayerTime/DateRange | her yer | 10 |  |  |  |  | R1: yer bazında aylık (Quota/My'de görünmüyor; kota defteriyle uygulanır) |
| DEFTER | daily | PrayerTime/Monthly | (hizmet toplamı) |  | 2 |  |  |  |  |
| DEFTER | daily | PrayerTime/Monthly | 9206 |  | 1 |  |  |  |  |
| DEFTER | daily | PrayerTime/Monthly | 9541 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | (hizmet toplamı) |  | 85 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 500 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 501 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 502 |  | 2 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 503 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 504 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 505 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 506 |  | 2 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 507 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 508 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 509 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 510 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 511 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 512 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 513 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 514 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 515 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 516 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 517 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 518 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 519 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 520 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 521 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 522 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 523 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 524 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 525 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 526 |  | 2 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 527 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 528 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 529 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 530 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 531 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 532 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 533 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 534 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 535 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 536 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Cities | 537 |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Countries | (hizmet toplamı) |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/Countries |  |  | 1 |  |  |  |  |
| DEFTER | monthly | Place/States | (hizmet toplamı) |  | 2 |  |  |  |  |
| DEFTER | monthly | PrayerTime/DateRange | (hizmet toplamı) |  | 2 |  |  |  |  |
| DEFTER | monthly | PrayerTime/Monthly | (hizmet toplamı) |  | 5 |  |  |  |  |
| DEFTER | yearly | Place/Cities | (hizmet toplamı) |  | 85 |  |  |  |  |
| DEFTER | yearly | Place/Countries | (hizmet toplamı) |  | 1 |  |  |  |  |
| DEFTER | yearly | Place/Countries |  |  | 1 |  |  |  |  |
| DEFTER | yearly | Place/States | (hizmet toplamı) |  | 2 |  |  |  |  |
| DEFTER | yearly | PrayerTime/DateRange | (hizmet toplamı) |  | 2 |  |  |  |  |
| DEFTER | yearly | PrayerTime/Monthly | (hizmet toplamı) |  | 5 |  |  |  |  |
| DEFTER | | | +136 parametre satırı daha | | | | | | özet kısaltıldı |
