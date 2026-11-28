// Quota/My yanıtından güvenli karar (saf).
//
// Belge (Awqat Salah, kullanıcının aktardığı metin, 28.11.2026):
//  - Her hizmete, PARAMETRE BAZINDA AYRI AYRI olmak üzere 10 erişim sınırı vardır; kullanıcı açıldıktan sonraki ilk 15 gün 100.
//  - DateRange (yıllık) yer bazında AYLIK 10 istekle sınırlıdır.
//  - Quota/My kalan kotayı ve hangi hizmette ne kadar kullanım yapıldığını gösterir; kotalar günlük, aylık ve yıllık olarak ve
//    parametre bazında ayrı ayrı tutulur.
//
// Gözlem (pilot run 45976882480, 27.11.2026):
//  - İlk okuma: {date, daily:[], weekly:[], monthly:[], yearly:[]} (o gün hiç kullanım yok).
//  - 11 istekten sonra: daily altında 4 grup (benefit 100; totalUsed 3/1/1/3), haftalık/aylık/yıllık boş; giriş ve Quota/My
//    kendileri grup olarak görünmedi. Grup başına `lines` satır sayısı = totalUsed; satır içeriği pilot özetinde maskelenmişti.
//    3 farklı ilçe için Monthly → tek grupta totalUsed 3: grup = HİZMET, totalUsed = o hizmetin TÜM parametrelerinin toplamı.
//
// Sonuç ve kural (28.11.2026 düzeltmesi; önceki "günlük grup yoksa bilinmiyor" ve "tek ortak havuz" yorumları yanlıştı):
//  - Biçimi doğru ve listeleri boş yanıt "bu dönemde hiç kullanım yok" demektir, "bilinmiyor" DEĞİLDİR.
//  - Biçim bozuk/eksikse (date yok, daily dizi değil, sayısal alanlar bozuk) → bilinmiyor → istek yok (fail-closed).
//  - Herhangi bir grupta totalExceeded > 0 → istek yok.
//  - Bir parametrenin kullanımı, ait olduğu hizmet grubunun toplamını aşamaz. Grup–hizmet eşlemesi görünmediği için en kötü
//    durum: dönemdeki EN BÜYÜK grup toplamı. Günlük dönemde bu, kendi defterimizden çıkan üst sınırla da daraltılır
//    (çalışma başına parametre başına en çok 2 istek × bugünkü çalışma sayısı + günün ilk okumasında görülen dış kullanım).
//  - Sınır: yanıtta grup varsa o dönemin en küçük benefit değeri; grup yoksa belgelenen en küçük sınır (10).
//  - Çalışmaya izin: her dönemde  sınır − pay − enKötüKullanım ≥ çalışma başına parametre azamisi.
//  - Günlük toplam 100 istek tavanı (kullanıcı kuralı) ayrıca ve değişmeden uygulanır (defter.mjs).
export const BILINMIYOR_GUVENLI_ISTEK = 0;
export const PAY_ORANI = 0.05;
export const DONEMLER = Object.freeze(["daily", "weekly", "monthly", "yearly"]);
/** Belgelenen en küçük hizmet+parametre sınırı (ilk 15 gün sonrası). Yanıtta grup yokken bu varsayılır. */
export const BELGELI_PARAMETRE_SINIRI = 10;
/** DateRange: yer bazında aylık istek sınırı (belge). */
export const DATERANGE_AYLIK_SINIR = 10;

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

/** Günlük dönemdeki en büyük grup toplamı (günün ilk okumasında "dış kullanım" olarak defterde saklanır). */
export function gunlukEnBuyukKullanim(kota) {
  const k = kotaOku(kota);
  if (!k) return null;
  return Math.max(0, ...k.gruplar.filter((x) => x.donem === "daily").map((x) => x.kullanilan));
}

/**
 * Bu çalışma her parametreyi en çok `calismaBasinaParametre` kez isteyecekse güvenli mi?
 * bugunkuCalisma: defterde bugün kayıtlı çalışma sayısı; hariciKullanim: günün ilk okumasında görülen günlük en büyük toplam.
 * Dönüş: { izin, sebep, donemler:[{donem, sinir, pay, enKotu, kalan}] }.
 */
export function hizmetIzni(kota, { calismaBasinaParametre = 2, bugunkuCalisma = 0, hariciKullanim = null } = {}) {
  const k = kotaOku(kota);
  if (!k) return { izin: false, sebep: "kota yanıtı okunamadı (biçim beklenmedik): bilinmiyor", donemler: [] };
  if (k.asildi) return { izin: false, sebep: "kota aşılmış (totalExceeded > 0)", donemler: [] };
  const donemler = [];
  for (const donem of DONEMLER) {
    const ilgili = k.gruplar.filter((x) => x.donem === donem);
    if (donem !== "daily" && ilgili.length === 0) continue; // bu dönemde kullanım yok
    const sinir = ilgili.length ? Math.min(...ilgili.map((x) => x.limit)) : BELGELI_PARAMETRE_SINIRI;
    let enKotu = Math.max(0, ...ilgili.map((x) => x.kullanilan));
    if (donem === "daily" && Number.isFinite(hariciKullanim)) enKotu = Math.min(enKotu, calismaBasinaParametre * bugunkuCalisma + hariciKullanim);
    const pay = guvenlikPayi(sinir);
    donemler.push({ donem, sinir, pay, enKotu, kalan: sinir - pay - enKotu });
  }
  const dar = donemler.find((d) => d.kalan < calismaBasinaParametre);
  if (dar) return { izin: false, sebep: `${dar.donem}: parametre başına en kötü kalan ${dar.kalan} < ${calismaBasinaParametre}`, donemler };
  return { izin: true, sebep: k.kullanimYok ? "bu dönemde kullanım yok (listeler boş)" : "her dönemde parametre başına yeterli hak var", donemler };
}

/** Geriye uyum: parametre başına en kötü kalan (pay öncesi); bilinmiyorsa null, aşılmışsa 0. */
export function enAzKalan(kota) {
  const k = kotaOku(kota);
  if (!k) return null;
  if (k.asildi) return 0;
  const h = hizmetIzni(kota, { calismaBasinaParametre: 0 });
  return Math.max(0, Math.min(...h.donemler.map((d) => d.sinir - d.enKotu)));
}

/**
 * Geriye uyum (eşleme/test araçları, her parametreyi en çok bir kez ister): parametre başına güvenli kalan (pay sonrası).
 * Bilinmiyorsa 0. pay verilirse sabit pay.
 */
export function izinVerilen(kota, { pay } = {}) {
  const k = kotaOku(kota);
  if (!k || k.asildi) return BILINMIYOR_GUVENLI_ISTEK;
  const h = hizmetIzni(kota, { calismaBasinaParametre: 0 });
  return Math.max(0, Math.min(...h.donemler.map((d) => d.sinir - (pay ?? d.pay) - d.enKotu)));
}

/**
 * DateRange aylık yer sınırı: bu ay o yer için kayıtlı istek sayısıyla, bu çalışmanın azamisi eklendiğinde (pay dahil) sınır aşılmaz mı?
 */
export function aralikYerIzni(sayac, { calismaBasinaParametre = 2, sinir = DATERANGE_AYLIK_SINIR } = {}) {
  if (!Number.isSafeInteger(sayac) || sayac < 0) return false;
  return sayac + calismaBasinaParametre <= sinir - guvenlikPayi(sinir);
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
