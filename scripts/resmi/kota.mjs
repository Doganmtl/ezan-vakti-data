// Diyanet Awqat Salah servis kotaları (saf). Operasyonel HTTP sınırı (kullanıcı kuralı, D16) bu dosyada DEĞİL: defter.mjs.
//
// Resmî kurallar (kullanıcının aktardığı dokümantasyon, 28.11.2026; config/awqat-sozlesme.json "kota"):
//  R1. DateRange yıllık namaz vakitleri yer bazında AYLIK 10 istek.
//  R2. Erişim limitleri hizmet ve parametre bazında ayrı ayrı uygulanır (normal 10).
//  R3. Hesap oluşturulduktan sonraki ilk 15 gün 10 yerine 100 (hesap 25.11.2026; kesin bitiş anı doğrulanmadı).
//  R4. Kotalar günlük, aylık, yıllık dönemlerde ve parametre bazında tutulur; GET /api/Quota/My geçerli kota ve kullanımı verir.
//
// Kayıtlı Quota/My yanıtlarından kanıt (KOTA-ANALIZI.md; doğrulanmamış olanlar "işaret"):
//  - Kayıt hizmet kullanıldıktan sonra oluşur; kullanılmamış hizmet listede yok (pilot 45976882480: önce boş, sonra 4 grup).
//  - Grup = hizmet; totalUsed = o hizmetin bütün parametrelerinin toplamı (eşleme 45995729583: 81 farklı Cities parametresi
//    tek grupta 84). Sınırın (benefit) bu toplama mı, her parametreye mi uygulandığı DOĞRULANMADI → ikisi birden uygulanır.
//  - Giriş ve Quota/My grup oluşturmadı (pilot, Şuhut 46004878195). Token yenileme hiç gözlenmedi.
//  - Günlük dönem: 27.11 21:02 UTC (= 28.11 00:02 İstanbul) okumada bütün listeler boş → İstanbul gece yarısı yenilenme işareti.
//  - Aylık/yıllık listeler, 27.11'deki DateRange dahil kullanımlardan sonra boş göründü: bu dönemlerin sınırları yanıtta
//    görünmüyor. R1 (DateRange aylık yer) bu yüzden kendi kota defterimizle uygulanır.
//
// Karar kuralları:
//  - Quota/My okunamazsa (biçim) → o çalışmada hiçbir istek yok.
//  - Boş liste sıfır hak, sınırsız hak ya da kesin 100 sayılmaz: "sunucu bu dönemde bu hizmet için kullanım bildirmiyor" demektir;
//    sınır o zaman resmî kuraldan (R2/R3; artırılmış dönem bir gün erken biter), kullanım kendi kota defterimizden gelir.
//  - Sunucunun bildirdiği sınır (benefit) ve kullanım (totalUsed), gruba hizmet eşlenebiliyorsa o hizmete uygulanır; eşlenemiyorsa
//    her hizmet için en küçük benefit üst sınır sayılır, kullanım kendi defterimizden gelir (havuz yok).
//  - Aşım (totalExceeded > 0): eşlenen hizmeti durdurur, başka hizmeti durdurmaz. Eşlenemeyen aşımda hangi hizmet olduğu
//    bilinmediği için o çalışma durur (fail-closed) ve raporlanır.
//  - Yabancı kullanım: sunucunun bugünkü toplamı kota defterimizin bugünkü toplamından büyükse (saymadığımız istek) → istek yok.
//  - Pay (D14, kullanıcı onaylı): max(1, ceil(sınır × %5)). Her parametre isteğinden önce en kötü durum (istek + 1 tekrar) sığmalı.
export const PAY_ORANI = 0.05;
export const BILINMIYOR_GUVENLI_ISTEK = 0;
export const DONEMLER = Object.freeze(["daily", "weekly", "monthly", "yearly"]);
/** Quota/My dönemi → kota defteri sayacı. Haftalık sayaç tutulmaz (sunucu bildirirse yalnız sunucu değeri kullanılır). */
export const DEFTER_DONEMI = Object.freeze({ daily: "gun", monthly: "ay", yearly: "yil" });
export const DATERANGE = "PrayerTime/DateRange";

export const guvenlikPayi = (limit, oran = PAY_ORANI) => Math.max(1, Math.ceil(limit * oran));

const yolBul = (x, derinlik = 0, bulunan = new Set()) => {
  if (derinlik > 4 || x == null) return bulunan;
  if (typeof x === "string") { const m = x.match(/\/?api\/([A-Za-z]+\/[A-Za-z]+)/); if (m) bulunan.add(m[1]); return bulunan; }
  if (Array.isArray(x)) { for (const y of x) yolBul(y, derinlik + 1, bulunan); return bulunan; }
  if (typeof x === "object") for (const v of Object.values(x)) yolBul(v, derinlik + 1, bulunan);
  return bulunan;
};

/**
 * Quota/My yanıtını doğrular ve normalize eder. Biçim beklenmedikse null (okunamadı).
 * Zorunlu: nesne, `date` metni, `daily` dizisi; diğer dönemler varsa dizi. Boş dizi geçerlidir.
 * Grup: { donem, limit, kullanilan, asildi, hizmet (eşlenebildiyse, yoksa null) }.
 */
export function kotaOku(kota) {
  if (!kota || typeof kota !== "object" || Array.isArray(kota)) return null;
  if (typeof kota.date !== "string" || !kota.date || !Array.isArray(kota.daily)) return null;
  const g = [];
  for (const donem of DONEMLER) {
    const liste = kota[donem];
    if (liste === undefined) continue;
    if (!Array.isArray(liste)) return null;
    for (const x of liste) {
      if (!Number.isFinite(x?.benefit) || !Number.isFinite(x?.totalUsed) || x.benefit < 0 || x.totalUsed < 0) return null;
      if (x.totalExceeded !== undefined && !Number.isFinite(x.totalExceeded)) return null;
      const yollar = yolBul(x);
      g.push({ donem, limit: x.benefit, kullanilan: x.totalUsed, asildi: (x.totalExceeded ?? 0) > 0, hizmet: yollar.size === 1 ? [...yollar][0] : null });
    }
  }
  return { tarih: kota.date, gruplar: g };
}
export function gruplar(kota) { return kotaOku(kota)?.gruplar ?? null; }

/**
 * Güvenli yapı özeti ve okunamama nedeni (PR #13'ten taşındı): yalnız anahtar adları, türler, uzunluklar ve sayılar; metin
 * içeriği yok. kotaOku() null döndüğünde neden loglanır. Boş liste D23'te okunamama nedeni DEĞİLDİR.
 */
export function kotaYapisi(kota) {
  const ozet = (x, d = 0) => {
    if (d > 5) return "…";
    if (Array.isArray(x)) return { tur: "liste", uzunluk: x.length, ogeler: x.slice(0, 5).map((y) => ozet(y, d + 1)) };
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, ozet(v, d + 1)]));
    if (typeof x === "string") return { tur: "metin", uzunluk: x.length };
    return { tur: x === null ? "null" : typeof x, deger: typeof x === "number" || typeof x === "boolean" ? x : null };
  };
  let neden = null;
  if (!kota || typeof kota !== "object" || Array.isArray(kota)) neden = `yanıt nesne değil (${kota === null ? "null" : Array.isArray(kota) ? "liste" : typeof kota})`;
  else if (typeof kota.date !== "string" || !kota.date) neden = "date alanı yok ya da metin değil";
  else if (!Array.isArray(kota.daily)) neden = kota.daily === undefined ? "daily anahtarı yok" : "daily liste değil";
  else for (const donem of DONEMLER) {
    const liste = kota[donem];
    if (liste === undefined) continue;
    if (!Array.isArray(liste)) { neden = `${donem} liste değil`; break; }
    const i = liste.findIndex((x) => !Number.isFinite(x?.benefit) || !Number.isFinite(x?.totalUsed) || x.benefit < 0 || x.totalUsed < 0 || (x.totalExceeded !== undefined && !Number.isFinite(x.totalExceeded)));
    if (i >= 0) { neden = `${donem}[${i}] benefit/totalUsed/totalExceeded sayı değil`; break; }
  }
  return { ozet: ozet(kota), okunabilir: neden === null, neden };
}

/**
 * R2/R3: bugün için hizmet ve parametre başına günlük sınır. Artırılmış dönemin kesin bitiş anı doğrulanmadığı için
 * `artirilmisEmniyetGun` gün erken biter (varsayılan 1: hesap 25.11.2026 → 08.12.2026 dahil 100, 09.12.2026'dan 10).
 */
export function kuralSiniri(kural, bugun) {
  const gun = Math.floor((Date.parse(`${bugun}T00:00:00Z`) - Date.parse(`${kural.hesapAcilis}T00:00:00Z`)) / 864e5);
  if (!Number.isFinite(gun)) throw new Error("kota kuralı: tarih okunamadı");
  const son = kural.ilkGunSayisi - (kural.artirilmisEmniyetGun ?? 1);
  return gun >= 0 && gun < son ? kural.ilk15GunUcParametreGunluk : kural.ucParametreGunluk;
}

/**
 * İstemci sayaç anahtarından (hizmet, parametre). Giriş, yenileme ve Quota/My kota sayılmaz (null; kanıt: grup oluşturmadılar).
 *  "GET /api/PrayerTime/Monthly/9541" → {PrayerTime/Monthly, 9541}; 'POST /api/PrayerTime/DateRange {"cityId":9541,…}' → {PrayerTime/DateRange, 9541}
 */
export function hizmetParametre(anahtar) {
  const m = String(anahtar).match(/^[A-Z]+ \/api\/([A-Za-z]+\/[A-Za-z]+)(?:\/([^ ?]+))?(?: (\{.*\}))?$/);
  if (!m || m[1] === "Quota/My") return null;
  let parametre = m[2] ?? "";
  if (m[3]) { try { const b = JSON.parse(m[3]); parametre = String(b.cityId ?? b.placeId ?? parametre); } catch { parametre = m[3]; } }
  return { hizmet: m[1], parametre };
}
export const ciftAnahtari = (hizmet, parametre) => `${hizmet}|${parametre}`;

/**
 * Çalışma başı karar (tek hizmet için). kotaDefteri: kota-defteri.mjs okuması ({ sayac: { gun, ay, yil } }).
 * Dönüş: { izin, sebep, donemler: { daily|weekly|monthly|yearly: { sinir, pay, kullanim, kalan } }, kalan }.
 */
export function hizmetDurumu(kota, { hizmet, kotaDefteri, kural, bugun }) {
  const k = kotaOku(kota);
  if (!k) return { izin: false, sebep: "Quota/My okunamadı (biçim beklenmedik)", donemler: {}, kalan: 0 };
  const asim = k.gruplar.filter((x) => x.asildi && (x.hizmet === hizmet || x.hizmet === null));
  if (asim.length) return { izin: false, sebep: `${hizmet}: Quota/My aşım bildiriyor (${asim.map((x) => x.donem + (x.hizmet ? "" : ", hizmet eşlenemedi")).join("; ")})`, donemler: {}, kalan: 0 };
  const sunucuBugun = k.gruplar.filter((x) => x.donem === "daily").reduce((a, x) => a + x.kullanilan, 0);
  const defterBugun = Object.entries(kotaDefteri.sayac.gun).filter(([a]) => !a.includes("|")).reduce((a, [, n]) => a + n, 0);
  if (sunucuBugun > defterBugun) return { izin: false, sebep: `Quota/My bugün ${sunucuBugun} kullanım bildiriyor, kota defteri ${defterBugun} saydı (saymadığımız kullanım)`, donemler: {}, kalan: 0, yabanci: true };
  const donemler = {};
  for (const donem of DONEMLER) {
    const ilgili = k.gruplar.filter((x) => x.donem === donem && (x.hizmet === hizmet || x.hizmet === null));
    const defterAdi = DEFTER_DONEMI[donem];
    const kullanim = Math.max(defterAdi ? (kotaDefteri.sayac[defterAdi][hizmet] ?? 0) : 0, ...ilgili.filter((x) => x.hizmet === hizmet).map((x) => x.kullanilan));
    let sinir = ilgili.length ? Math.min(...ilgili.map((x) => x.limit)) : null;
    if (donem === "daily") sinir = Math.min(sinir ?? Infinity, kuralSiniri(kural, bugun)); // R2/R3 her zaman üst sınır
    if (sinir === null) continue; // sunucu bu dönem için bu hizmete sınır bildirmiyor
    donemler[donem] = { sinir, pay: guvenlikPayi(sinir), kullanim, kalan: sinir - guvenlikPayi(sinir) - kullanim };
  }
  const dar = Object.entries(donemler).sort((a, b) => a[1].kalan - b[1].kalan)[0];
  return { izin: true, donemler, kalan: dar ? Math.max(0, dar[1].kalan) : 0,
    sebep: `${hizmet}: en dar dönem ${dar[0]} (sınır ${dar[1].sinir}, kullanım ${dar[1].kullanim}, kalan ${dar[1].kalan})` };
}

/**
 * Bir parametre isteği gönderilebilir mi? (istek + olası 1 tekrar = azami)
 *  - Hizmet toplamı: her dönemde kullanım + bu çalışmanın bu hizmetteki istekleri + azami ≤ sınır − pay
 *  - R2: parametre bazında günlük: kullanım + azami ≤ günlük sınır − pay
 *  - R1: DateRange yer bazında aylık: kullanım + azami ≤ 10 − pay
 * calisma: bu çalışmada şimdiye kadar { hizmet: n, "hizmet|parametre": n }.
 */
export function parametreIzni({ durum, hizmet, parametre, kotaDefteri, calisma = {}, kural, azami = 2 }) {
  if (!durum?.izin) return { izin: false, sebep: durum?.sebep ?? "kota durumu yok", hizmetDoldu: true };
  const ch = calisma[hizmet] ?? 0, cc = calisma[ciftAnahtari(hizmet, parametre)] ?? 0;
  for (const [donem, d] of Object.entries(durum.donemler))
    if (d.kullanim + ch + azami > d.sinir - d.pay) return { izin: false, sebep: `${hizmet} ${donem}: ${d.kullanim + ch}/${d.sinir}`, hizmetDoldu: true };
  const gunluk = durum.donemler.daily;
  const cg = (kotaDefteri.sayac.gun[ciftAnahtari(hizmet, parametre)] ?? 0) + cc;
  if (gunluk && cg + azami > gunluk.sinir - gunluk.pay) return { izin: false, sebep: `${hizmet} parametre ${parametre} günlük: ${cg}/${gunluk.sinir}` };
  if (hizmet === DATERANGE) {
    const s = kural.dateRangeYerAylik, ca = (kotaDefteri.sayac.ay[ciftAnahtari(hizmet, parametre)] ?? 0) + cc;
    if (ca + azami > s - guvenlikPayi(s)) return { izin: false, sebep: `DateRange yer ${parametre} bu ay: ${ca}/${s}` };
  }
  return { izin: true };
}

/** Eşleme/test araçları (tek hizmet): en kısıtlayıcı grup kalanı (pay öncesi). Okunamadı/boş → null, aşım → 0. */
export function enAzKalan(kota) {
  const k = kotaOku(kota);
  if (!k) return null;
  if (k.gruplar.some((x) => x.asildi)) return 0;
  return k.gruplar.length ? Math.max(0, Math.min(...k.gruplar.map((x) => x.limit - x.kullanilan))) : null;
}
/**
 * Eşleme/test araçları: güvenli kalan (pay sonrası). Okunamadı/aşım → 0. Liste boşsa sunucu sınır bildirmiyor: araç
 * `bosSinir` (resmî kural sınırı) verirse o kullanılır, vermezse 0 (boş liste "sınırsız" sayılmaz).
 */
export function izinVerilen(kota, { pay, bosSinir } = {}) {
  const k = kotaOku(kota);
  if (!k || k.gruplar.some((x) => x.asildi)) return BILINMIYOR_GUVENLI_ISTEK;
  if (!k.gruplar.length) return Number.isSafeInteger(bosSinir) ? Math.max(0, bosSinir - (pay ?? guvenlikPayi(bosSinir))) : BILINMIYOR_GUVENLI_ISTEK;
  return Math.max(0, Math.min(...k.gruplar.map((x) => x.limit - x.kullanilan - (pay ?? guvenlikPayi(x.limit)))));
}

/** Log için güvenli kota özeti: sayılar, satır sayısı, satır anahtar adları ve yalnız yol/kimlik biçimli kısa değerler. */
export function kotaLogOzeti(kota) {
  const k = kotaOku(kota);
  if (!k) return { okunamadi: true, ust: kota && typeof kota === "object" ? Object.keys(kota).slice(0, 10) : typeof kota };
  const gizli = /token|auth|pass|sifre|email|mail|user|kullanici/i;
  const guvenli = (v) => typeof v === "number" || typeof v === "boolean" ? v
    : typeof v === "string" && /^[\w/.{}:+-]{1,60}$/.test(v) && !/@/.test(v) && !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(v) ? v : undefined;
  const satir = (s) => Object.fromEntries(Object.entries(s ?? {}).filter(([a]) => !gizli.test(a)).map(([a, v]) => [a, guvenli(v)]).filter(([, v]) => v !== undefined));
  const ozet = { tarih: k.tarih };
  for (const donem of DONEMLER) {
    if (!Array.isArray(kota[donem])) continue;
    ozet[donem] = kota[donem].map((x) => ({ period: guvenli(x.period), benefit: x.benefit, totalUsed: x.totalUsed, totalExceeded: x.totalExceeded,
      satir: Array.isArray(x.lines) ? x.lines.length : null,
      satirAnahtarlari: Array.isArray(x.lines) ? [...new Set(x.lines.flatMap((s) => Object.keys(s ?? {})))].filter((a) => !gizli.test(a)).slice(0, 20) : [],
      ornek: Array.isArray(x.lines) ? x.lines.slice(0, 3).map(satir) : [] }));
  }
  return ozet;
}

/** Bir çalışmanın toplam HTTP istek tavanı (operasyonel; giriş, yenileme, kota okumaları dahil). */
export function calismaTavani({ veriIstegi, tahminiDakika = 10, giris = 1, kotaOkuma = 2, tekrarPayi = 0 }) {
  const yenileme = Math.ceil(Math.max(0, tahminiDakika) / 25);
  return veriIstegi + giris + yenileme + kotaOkuma + tekrarPayi;
}
