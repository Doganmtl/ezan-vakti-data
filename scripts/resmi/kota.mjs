// Quota/My ve Awqat Salah kota kuralları (saf). Kaynak: kullanıcının aktardığı belge (28.11.2026), config/awqat-sozlesme.json "kota":
//  1. DateRange (yıllık) yer bazında AYLIK 10 istek.
//  2. Her hizmete, PARAMETRE BAZINDA AYRI AYRI 10 erişim.
//  3. Kullanıcı oluşturulduktan sonraki ilk 15 gün bu 10 sınırı 100 (hesap 25.11.2026 → 09.12.2026 dahil 100, 10.12.2026'dan itibaren 10).
//  4. Kalan kota ve hangi hizmette ne kadar kullanım yapıldığı GET /api/Quota/My'den okunur; kotalar günlük, aylık, yıllık ve
//     parametre bazında ayrı tutulur; geçerli sınırların tamamı bu uçtan öğrenilir.
// Uygulama:
//  - Her istek (hizmet, parametre) çifti için kendi defterimizde sayılır (günlük; DateRange ayrıca aylık yer sayacı).
//  - İstekten önce: o çiftin bugünkü sayısı + bu çalışmanın azamisi ≤ sınır − pay; DateRange için ayrıca bu ayki yer sayısı
//    + azami ≤ 10 − pay. Sınır = Quota/My'nin gösterdiği sınır (benefit), Quota/My o hizmeti henüz listelemiyorsa kural 2/3.
//  - Quota/My okunamazsa (biçim bozuk) ya da aşım gösterirse (totalExceeded > 0) istek yok (fail-closed, kullanıcı kuralı).
//  - Quota/My'nin gösterdiği günlük toplam kullanım, defterimizin bugün saydığından fazlaysa (bizim saymadığımız kullanım) istek yok.
//  - Pay: kullanıcı onaylı oransal güvenlik payı (D14) max(1, ceil(sınır × %5)). Günlük 100 HTTP istek tavanı (D16) ayrıca geçerli.
// Gözlem (pilot run 45976882480): ilk okuma {date, daily:[], weekly:[], monthly:[], yearly:[]} (kullanım yok); istekten sonra
// daily altında hizmet başına grup (benefit 100, totalUsed = o hizmetin bütün parametrelerinin toplamı). Giriş ve Quota/My grup
// olarak görünmedi (sayılmıyor).
export const BILINMIYOR_GUVENLI_ISTEK = 0;
export const PAY_ORANI = 0.05;
export const DONEMLER = Object.freeze(["daily", "weekly", "monthly", "yearly"]);

export const guvenlikPayi = (limit, oran = PAY_ORANI) => Math.max(1, Math.ceil(limit * oran));

const yolBul = (x, derinlik = 0, bulunan = new Set()) => {
  if (derinlik > 3 || x == null) return bulunan;
  if (typeof x === "string") { const m = x.match(/\/?api\/([A-Za-z]+\/[A-Za-z]+)/); if (m) bulunan.add(m[1]); return bulunan; }
  if (Array.isArray(x)) { for (const y of x) yolBul(y, derinlik + 1, bulunan); return bulunan; }
  if (typeof x === "object") for (const v of Object.values(x)) yolBul(v, derinlik + 1, bulunan);
  return bulunan;
};

/**
 * Yanıtı doğrular ve normalize eder. Biçim beklenmedikse null (bilinmiyor).
 * Zorunlu: nesne, `date` metni, `daily` dizisi. Diğer dönemler varsa dizi olmalı. Boş diziler geçerlidir (kullanım yok).
 */
export function kotaOku(kota) {
  if (!kota || typeof kota !== "object" || Array.isArray(kota)) return null;
  if (typeof kota.date !== "string" || !kota.date) return null;
  if (!Array.isArray(kota.daily)) return null;
  const g = [];
  for (const donem of DONEMLER) {
    const liste = kota[donem];
    if (liste === undefined) continue;
    if (!Array.isArray(liste)) return null;
    for (const x of liste) {
      if (!Number.isFinite(x?.benefit) || !Number.isFinite(x?.totalUsed) || x.benefit < 0 || x.totalUsed < 0) return null;
      if (x.totalExceeded !== undefined && !Number.isFinite(x.totalExceeded)) return null;
      const yollar = yolBul(x);
      g.push({ donem, limit: x.benefit, kullanilan: x.totalUsed, asildi: (x.totalExceeded ?? 0) > 0,
        kalan: Math.max(0, x.benefit - x.totalUsed), uc: yollar.size === 1 ? [...yollar][0] : null });
    }
  }
  return { tarih: kota.date, gruplar: g, kullanimYok: g.length === 0, asildi: g.some((x) => x.asildi) };
}

/** Normalize gruplar (boş dizi = kullanım yok) ya da null (bilinmiyor). */
export function gruplar(kota) { return kotaOku(kota)?.gruplar ?? null; }

/** Kural 2/3: bugün için hizmet+parametre başına günlük sınır (hesap açılışından itibaren ilk N gün yüksek sınır). */
export function kuralSiniri(kural, bugun) {
  const gun = Math.floor((Date.parse(`${bugun}T00:00:00Z`) - Date.parse(`${kural.hesapAcilis}T00:00:00Z`)) / 864e5);
  if (!Number.isFinite(gun)) throw new Error("kota kuralı: tarih okunamadı");
  return gun >= 0 && gun < kural.ilkGunSayisi ? kural.ilk15GunUcParametreGunluk : kural.ucParametreGunluk;
}

/**
 * İstemci sayaç anahtarından (hizmet, parametre). Giriş, yenileme ve Quota/My sayılmaz (null).
 *  "GET /api/PrayerTime/Monthly/9541" → {hizmet:"PrayerTime/Monthly", parametre:"9541"}
 *  'POST /api/PrayerTime/DateRange {"cityId":9541,...}' → {hizmet:"PrayerTime/DateRange", parametre:"9541"}
 */
export function hizmetParametre(anahtar) {
  const m = String(anahtar).match(/^[A-Z]+ \/api\/([A-Za-z]+\/[A-Za-z]+)(?:\/([^ ?]+))?(?: (\{.*\}))?$/);
  if (!m || m[1] === "Quota/My") return null;
  let parametre = m[2] ?? "";
  if (m[3]) { try { const g = JSON.parse(m[3]); parametre = String(g.cityId ?? g.placeId ?? parametre); } catch { parametre = m[3]; } }
  return { hizmet: m[1], parametre };
}
export const ciftAnahtari = (hizmet, parametre) => `${hizmet}|${parametre}`;

/**
 * Çalışma başında Quota/My kararı. sayilanBugun: defterin bugün saydığı (hizmet,parametre) istekleri toplamı.
 * Dönüş: { izin, sebep, sinir } — sinir: Quota/My'nin gösterdiği en küçük günlük sınır (yoksa null → kural sınırı).
 */
export function kotaKarari(kota, { sayilanBugun = 0 } = {}) {
  const k = kotaOku(kota);
  if (!k) return { izin: false, sebep: "Quota/My okunamadı (biçim beklenmedik)", sinir: null };
  if (k.asildi) return { izin: false, sebep: "Quota/My aşım gösteriyor (totalExceeded > 0)", sinir: null };
  const gunluk = k.gruplar.filter((x) => x.donem === "daily");
  const toplam = gunluk.reduce((a, x) => a + x.kullanilan, 0);
  if (toplam > sayilanBugun) return { izin: false, sebep: `Quota/My bugün ${toplam} kullanım gösteriyor, defterimiz ${sayilanBugun} saydı (saymadığımız kullanım var)`, sinir: null };
  const sinir = gunluk.length ? Math.min(...gunluk.map((x) => x.limit)) : null;
  return { izin: true, sebep: gunluk.length ? `bugün ${toplam} kullanım (defterle tutarlı)` : "bugün kullanım yok (listeler boş)", sinir };
}

/** Bir (hizmet, parametre) isteği gönderilebilir mi? gunluk: bugünkü sayı; aylik: DateRange için bu ayki yer sayısı. */
export function ciftIzni({ hizmet, gunluk = 0, aylik = 0, sinir, aylikSinir, azami = 2 }) {
  if (!Number.isSafeInteger(sinir) || sinir < 1) return { izin: false, sebep: "sınır bilinmiyor" };
  if (gunluk + azami > sinir - guvenlikPayi(sinir)) return { izin: false, sebep: `${hizmet}: bugün ${gunluk}/${sinir}` };
  if (hizmet === "PrayerTime/DateRange" && aylik + azami > aylikSinir - guvenlikPayi(aylikSinir)) return { izin: false, sebep: `DateRange: bu ay ${aylik}/${aylikSinir}` };
  return { izin: true };
}

/** Eşleme/test araçları (her parametreyi bir kez ister): günlük en küçük kalan (pay öncesi). Bilinmiyorsa null, aşılmışsa 0, boşsa null değil. */
export function enAzKalan(kota) {
  const k = kotaOku(kota);
  if (!k) return null;
  if (k.asildi) return 0;
  const g = k.gruplar.filter((x) => x.donem === "daily");
  return g.length ? Math.max(0, Math.min(...g.map((x) => x.kalan))) : Infinity;
}
/** Eşleme/test araçları: güvenli kalan (pay sonrası). Bilinmiyor/aşım → 0; liste boş → Infinity (çağıran kendi tavanıyla sınırlar). */
export function izinVerilen(kota, { pay } = {}) {
  const k = kotaOku(kota);
  if (!k || k.asildi) return BILINMIYOR_GUVENLI_ISTEK;
  const g = k.gruplar;
  return g.length ? Math.max(0, Math.min(...g.map((x) => x.kalan - (pay ?? guvenlikPayi(x.limit))))) : Infinity;
}

/** Log için güvenli kota özeti: sayılar, satır sayısı, satır anahtar adları ve yalnız yol/kimlik biçimli kısa değerler. */
export function kotaLogOzeti(kota) {
  const k = kotaOku(kota);
  if (!k) return { okunamadi: true, ust: kota && typeof kota === "object" ? Object.keys(kota).slice(0, 10) : typeof kota };
  const guvenli = (v) => typeof v === "number" || typeof v === "boolean" ? v
    : typeof v === "string" && /^[\w/.{}:-]{1,60}$/.test(v) && !/@/.test(v) && !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(v) ? v : undefined;
  const satir = (s) => Object.fromEntries(Object.entries(s ?? {}).filter(([a]) => !/token|auth|pass|sifre|email|mail|user|kullanici/i.test(a))
    .map(([a, v]) => [a, guvenli(v)]).filter(([, v]) => v !== undefined));
  const ozet = { tarih: k.tarih };
  for (const donem of DONEMLER) {
    const liste = kota[donem];
    if (!Array.isArray(liste)) continue;
    ozet[donem] = liste.map((x) => ({ period: guvenli(x.period), benefit: x.benefit, totalUsed: x.totalUsed, totalExceeded: x.totalExceeded,
      satir: Array.isArray(x.lines) ? x.lines.length : null,
      satirAnahtarlari: Array.isArray(x.lines) ? [...new Set(x.lines.flatMap((s) => Object.keys(s ?? {})))].filter((a) => !/token|auth|pass|sifre|email|mail|user|kullanici/i.test(a)).slice(0, 20) : [],
      ornek: Array.isArray(x.lines) ? x.lines.slice(0, 3).map(satir) : [] }));
  }
  return ozet;
}

/**
 * Bir çalışmanın toplam istek tavanı (istemcinin toplamIstekSiniri): veri istekleri + giriş + token yenileme + kota okumaları.
 * Başarısız ve tekrarlanan istekler de bu tavana sayılır (istemci her gönderimi sayar). Token 30 dk; 25. dakikada yenilenir.
 */
export function calismaTavani({ veriIstegi, tahminiDakika = 10, giris = 1, kotaOkuma = 2, tekrarPayi = 0 }) {
  const yenileme = Math.ceil(Math.max(0, tahminiDakika) / 25);
  return veriIstegi + giris + yenileme + kotaOkuma + tekrarPayi;
}
