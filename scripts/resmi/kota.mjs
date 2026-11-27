// Quota/My yanıtından güvenli karar (saf). Yanıt biçimi belgelenmemiştir; pilotta görülen (run 45976882480):
//   {date, daily:[{period, benefit, totalUsed, totalExceeded, lines:[...]}], weekly:[], monthly:[], yearly:[]}
// Grup → uç eşleşmesi yanıtta açıkça görünmedi. Kural (8. tur, kullanıcı onaylı oransal pay):
// - Güvenlik payı grup limitine oranlıdır: max(1, ceil(limit × 0.05)). (5 → 1, 10 → 1, 100 → 5)
// - Bir grup bir uca KESİN eşlenebiliyorsa (grupta/satırlarında tek bir API yolu) o ucun hakkı o gruptan;
//   eşlenemiyorsa bütün uçlar TEK ORTAK HAVUZ sayılır ve en kısıtlayıcı grup geçerlidir.
// - Bilinmeyen/eksik/aşılmış kota → 0 (fail-closed). Tüm dönemler (günlük/haftalık/aylık/yıllık) birlikte dikkate alınır.
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

/** Grupları normalize eder; biçim beklenmedikse null (bilinmiyor). */
export function gruplar(kota) {
  if (!kota || typeof kota !== "object") return null;
  const g = [];
  for (const donem of DONEMLER) {
    const liste = kota[donem];
    if (liste === undefined) continue;
    if (!Array.isArray(liste)) return null;
    for (const x of liste) {
      if (!Number.isFinite(x?.benefit) || !Number.isFinite(x?.totalUsed) || x.benefit < 0) return null;
      const yollar = yolBul(x);
      g.push({ donem, limit: x.benefit, kullanilan: x.totalUsed, asildi: (x.totalExceeded ?? 0) > 0, kalan: Math.max(0, x.benefit - x.totalUsed), uc: yollar.size === 1 ? [...yollar][0] : null });
    }
  }
  return g.some((x) => x.donem === "daily") ? g : null; // günlük grup görülmeden kota bilinmiyor sayılır
}

/**
 * Saf teşhis: kota yanıtının güvenli özeti (yalnız anahtar adları, türler, sayılar; metin içeriği yok) ve
 * gruplar() neden karar veremediyse sebebi. Kişisel/gizli bilgi taşımaz: metinler yalnız uzunluk olarak raporlanır.
 */
export function kotaTeshis(kota) {
  const ozet = (x, d = 0) => {
    if (d > 5) return "…";
    if (Array.isArray(x)) return { tur: "liste", uzunluk: x.length, ogeler: x.slice(0, 5).map((y) => ozet(y, d + 1)) };
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, ozet(v, d + 1)]));
    if (typeof x === "string") return { tur: "metin", uzunluk: x.length };
    return { tur: x === null ? "null" : typeof x, deger: typeof x === "number" || typeof x === "boolean" ? x : null };
  };
  let neden = null;
  if (!kota || typeof kota !== "object") neden = `yanıt nesne değil (${kota === null ? "null" : typeof kota})`;
  else {
    for (const donem of DONEMLER) {
      const liste = kota[donem];
      if (liste === undefined) continue;
      if (!Array.isArray(liste)) { neden = `${donem} liste değil`; break; }
      const bozuk = liste.findIndex((x) => !Number.isFinite(x?.benefit) || !Number.isFinite(x?.totalUsed) || x.benefit < 0);
      if (bozuk >= 0) { neden = `${donem}[${bozuk}] benefit/totalUsed sayı değil`; break; }
    }
    if (!neden && !DONEMLER.some((d) => kota[d] !== undefined)) neden = `bilinen dönem anahtarı yok (anahtarlar: ${Object.keys(kota).join(", ") || "—"})`;
    if (!neden && !(Array.isArray(kota.daily) && kota.daily.length)) neden = kota.daily === undefined ? "daily anahtarı yok" : "daily listesi boş";
  }
  return { ozet: ozet(kota), gruplar: gruplar(kota), enAzKalan: enAzKalan(kota), izin: izinVerilen(kota), neden };
}

export function enAzKalan(kota) {
  const g = gruplar(kota);
  if (!g) return null;
  if (g.some((x) => x.asildi)) return 0;
  return Math.max(0, Math.min(...g.map((x) => x.kalan)));
}

/**
 * İzin verilen istek sayısı (ortak havuz yorumu): her grupta kalan − pay; en küçüğü. Bilinmiyorsa 0.
 * pay verilirse sabit pay (eski davranış), verilmezse oransal pay.
 */
export function izinVerilen(kota, { pay } = {}) {
  const g = gruplar(kota);
  if (!g) return BILINMIYOR_GUVENLI_ISTEK;
  if (g.some((x) => x.asildi)) return 0;
  return Math.max(0, Math.min(...g.map((x) => x.kalan - (pay ?? guvenlikPayi(x.limit)))));
}

/**
 * Uç bazlı plan. talepler: [{uc: "PrayerTime/Monthly", istek: n}, ...] öncelik sırasıyla.
 * Dönüş: { izinler: {uc: n}, havuz: boolean, sebep }.
 * - Tüm talep edilen uçlar kendi grubuna kesin eşleniyorsa: her uç kendi grubundan (kalan − pay).
 * - Aksi halde ortak havuz: izinVerilen() kadar istek talepler arasında sırayla paylaştırılır.
 */
export function ucPlani(kota, talepler) {
  const g = gruplar(kota), izinler = Object.fromEntries(talepler.map((t) => [t.uc, 0]));
  if (!g) return { izinler, havuz: true, sebep: "kota bilinmiyor" };
  if (g.some((x) => x.asildi)) return { izinler, havuz: true, sebep: "kota aşılmış" };
  const eslesen = talepler.every((t) => g.some((x) => x.uc === t.uc));
  if (eslesen) {
    for (const t of talepler) {
      const ilgili = g.filter((x) => x.uc === t.uc);
      izinler[t.uc] = Math.max(0, Math.min(t.istek, ...ilgili.map((x) => x.kalan - guvenlikPayi(x.limit))));
    }
    return { izinler, havuz: false, sebep: "uç grupları eşlendi" };
  }
  let havuz = izinVerilen(kota);
  for (const t of talepler) { izinler[t.uc] = Math.min(t.istek, havuz); havuz -= izinler[t.uc]; }
  return { izinler, havuz: true, sebep: "uç grupları eşlenemedi: ortak havuz, en kısıtlayıcı grup" };
}

/**
 * Bir çalışmanın toplam istek tavanı (istemcinin toplamIstekSiniri): veri istekleri + giriş + token yenileme + kota okumaları.
 * Başarısız ve tekrarlanan istekler de bu tavana sayılır (istemci her gönderimi sayar). Token 30 dk; 25. dakikada yenilenir.
 */
export function calismaTavani({ veriIstegi, tahminiDakika = 10, giris = 1, kotaOkuma = 2, tekrarPayi = 0 }) {
  const yenileme = Math.ceil(Math.max(0, tahminiDakika) / 25);
  return veriIstegi + giris + yenileme + kotaOkuma + tekrarPayi;
}
