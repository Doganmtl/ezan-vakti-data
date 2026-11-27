// Veri sözleşmesi 2 (8. tur): v1 vakit dosyasının geriye uyumlu genişlemesi. Saf; ağ ve dosya sistemi yok.
// v1 okuyucuları yalnız {guncelleme, gunler} okur ve bilinmeyen alanları yok sayar (Android ignoreUnknownKeys,
// iOS Decodable). Yeni alanların anlamları SOZLESME.md "Sözleşme 2" bölümündedir; özet:
//   guncelleme     : vakit İÇERİĞİNİN (surum) en son değiştiği an. Yalnız doğrulama yapıldığında İLERLEMEZ.
//   kaynak.alindi  : temel verinin resmi API'den alındığı an (yanıt zamanı). Diyanet'in yayın zamanı bilinmez; uydurulmaz.
//   duzeltmeler    : temel veri alındıktan sonra resmi Monthly ile yapılan içerik düzeltmeleri (en yeni sonda, en çok 10).
//   dogrulama      : en son resmi karşılaştırma; yalnız [ilk, son] aralığını doğrular, dosyanın tamamını değil.
//   surum          : "sha256:" + kanonik vakit metninin tam SHA-256 değeri (hicri metin dahil değildir).
import { createHash } from "node:crypto";
import { isoTarih, gunEkle } from "../v1-dogrulama.mjs";

export const SOZLESME = 2;
export const KAYNAK_TURLERI = Object.freeze(["resmi-yillik", "resmi-aylik", "ayna"]);
export const UCLAR = Object.freeze(["DateRange", "Monthly", "ayna"]);
export const ILERI_TOLERANS_MS = 5 * 60_000;
export const AZAMI_DUZELTME = 10;
const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;
const ZAMAN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const ISO_GUN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kanonik vakit metni (Swift/Kotlin ile aynı sonucu verecek kadar basit):
 * her gün bir satır "YYYY-MM-DD HH:MM HH:MM HH:MM HH:MM HH:MM HH:MM", tarih sırasıyla, satır sonu "\n" (son satır dahil), UTF-8.
 */
export function kanonikMetin(gunler) {
  return [...gunler].map((g) => [isoTarih(g.t), g.v]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([d, v]) => `${d} ${v.join(" ")}\n`).join("");
}
export const surumHesapla = (gunler) => "sha256:" + createHash("sha256").update(kanonikMetin(gunler), "utf8").digest("hex");

export function zamanDogrula(z, simdi, ad) {
  if (typeof z !== "string" || !ZAMAN.test(z) || !Number.isFinite(Date.parse(z))) throw Error(`${ad}: UTC "Z" zaman damgası değil`);
  if (simdi && Date.parse(z) > Date.parse(simdi) + ILERI_TOLERANS_MS) throw Error(`${ad}: gelecekteki zaman damgası`);
  return Date.parse(z);
}

/** Gün listesi: geçerli, tekrarsız, kesintisiz; [ilk, son] döner. */
export function gunlerKesintisiz(gunler) {
  if (!Array.isArray(gunler) || !gunler.length) throw Error("boş vakit listesi");
  const t = gunler.map((g) => {
    const d = isoTarih(g?.t);
    if (!Array.isArray(g.v) || g.v.length !== 6 || g.v.some((s) => typeof s !== "string" || !SAAT.test(s))) throw Error(`${d}: geçersiz vakit`);
    if (g.v.some((s, i) => i > 0 && s <= g.v[i - 1])) throw Error(`${d}: vakit sırası`);
    if (g.h !== undefined && (typeof g.h !== "string" || g.h.length > 60)) throw Error(`${d}: geçersiz hicri tarih`);
    return d;
  }).sort();
  for (let i = 1; i < t.length; i++) {
    if (t[i] === t[i - 1]) throw Error("tekrarlanan tarih: " + t[i]);
    if (gunEkle(t[i - 1], 1) !== t[i]) throw Error("eksik gün: " + gunEkle(t[i - 1], 1));
  }
  return { ilk: t[0], son: t.at(-1), gun: t.length };
}

/** `guncelleme` = içeriğin son değiştiği an: temel alım ya da en son düzeltme. */
export function beklenenGuncelleme(d) {
  const z = [d.kaynak.alindi, ...(d.duzeltmeler ?? []).map((x) => x.zaman)];
  return z.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

/** Tek dosyanın sözleşme 2 kurallarına uyduğunu doğrular; hata fırlatır. */
export function sozlesme2Dogrula(d, { simdi } = {}) {
  if (d?.sozlesme !== SOZLESME) throw Error("sözleşme 2 değil");
  const k = d.kaynak;
  if (!k || !KAYNAK_TURLERI.includes(k.tur) || !UCLAR.includes(k.uc)) throw Error("geçersiz kaynak");
  if (k.tur === "resmi-yillik" && k.uc !== "DateRange") throw Error("resmi-yillik yalnız DateRange temelli olabilir");
  if (k.tur !== "ayna" && (!Number.isSafeInteger(k.resmiId) || k.resmiId <= 0)) throw Error("resmi kaynakta resmiId zorunlu");
  if (!k.calisma || typeof k.calisma.runId !== "string" || !k.calisma.runId) throw Error("kaynak.calisma.runId zorunlu");
  const alindi = zamanDogrula(k.alindi, simdi, "kaynak.alindi");
  const kap = gunlerKesintisiz(d.gunler);
  if (!d.gecerlilik || d.gecerlilik.ilk !== kap.ilk || d.gecerlilik.son !== kap.son) throw Error("gecerlilik gün listesiyle tutarsız");
  if (d.surum !== surumHesapla(d.gunler)) throw Error("surum içerikle tutarsız");
  const dz = d.duzeltmeler ?? [];
  if (!Array.isArray(dz) || dz.length > AZAMI_DUZELTME) throw Error("geçersiz düzeltme listesi");
  let onceki = alindi;
  for (const x of dz) {
    const z = zamanDogrula(x.zaman, simdi, "duzeltme.zaman");
    if (z < onceki) throw Error("düzeltmeler zaman sırasında değil");
    if (x.uc !== "Monthly" || !ISO_GUN.test(x.ilk ?? "") || !ISO_GUN.test(x.son ?? "") || !(x.gun > 0)) throw Error("geçersiz düzeltme kaydı");
    onceki = z;
  }
  if (d.guncelleme !== beklenenGuncelleme(d)) throw Error("guncelleme içeriğin son değiştiği an değil");
  if (d.dogrulama != null) {
    const v = d.dogrulama;
    const z = zamanDogrula(v.zaman, simdi, "dogrulama.zaman");
    if (z < Date.parse(d.guncelleme)) throw Error("doğrulama içerik sürümünden eski");
    if (!["Monthly", "DateRange"].includes(v.uc) || !["esit", "duzeltildi"].includes(v.sonuc)) throw Error("geçersiz doğrulama");
    if (!ISO_GUN.test(v.ilk ?? "") || !ISO_GUN.test(v.son ?? "") || v.ilk > v.son || v.ilk < kap.ilk || v.son > kap.son) throw Error("doğrulama aralığı geçerlilik dışında");
    let n = 0; for (let x = v.ilk; x <= v.son; x = gunEkle(x, 1)) n++;
    if (v.gun !== n) throw Error("doğrulama gün sayısı aralıkla tutarsız");
    if (!v.calisma || typeof v.calisma.runId !== "string") throw Error("dogrulama.calisma zorunlu");
  }
  return { ...kap, tur: k.tur };
}

/**
 * Yayın geçişi (HEAD → yeni). Dönüş: "ilk" | "yenilendi" | "dogrulandi". Kurallar:
 * - Sözleşme 2'den eski biçime dönüş yok.
 * - Aynı surum: içerik, kaynak, geçerlilik, düzeltmeler ve guncelleme AYNEN kalır (sahte güncellik yok); yalnız doğrulama ilerleyebilir.
 * - Farklı surum: guncelleme ilerlemeli; temel veri daha eski bir alımla ezilemez (kaynak.alindi geriye gidemez).
 */
export function gecisTuru(eski, yeni) {
  if (eski?.sozlesme === SOZLESME && yeni?.sozlesme !== SOZLESME) throw Error("sözleşme 2'den eski biçime dönüş");
  if (yeni?.sozlesme !== SOZLESME) return null; // v1 kuralları uygulanır (çağıran)
  if (!eski) return "ilk";
  if (eski.sozlesme !== SOZLESME) { if (Date.parse(yeni.guncelleme) < Date.parse(eski.guncelleme)) throw Error("guncelleme geriye gidiyor"); return "ilk"; }
  if (Date.parse(yeni.kaynak.alindi) < Date.parse(eski.kaynak.alindi)) throw Error("daha eski resmi alım yeni veriyi ezemez");
  if (yeni.surum === eski.surum) {
    const ayni = (x) => JSON.stringify([x.guncelleme, x.kaynak, x.gecerlilik, x.duzeltmeler ?? [], x.gunler]);
    if (ayni(yeni) !== ayni(eski)) throw Error("içerik aynıyken veri/zaman alanı değişmiş (sahte güncellik)");
    if (!yeni.dogrulama || (eski.dogrulama && Date.parse(yeni.dogrulama.zaman) <= Date.parse(eski.dogrulama.zaman))) throw Error("doğrulama ilerlemiyor");
    return "dogrulandi";
  }
  if (Date.parse(yeni.guncelleme) <= Date.parse(eski.guncelleme)) throw Error("içerik değişti ama guncelleme ilerlemedi");
  return "yenilendi";
}

/**
 * Mevcut v1 okuyucusunun indirme kabulü (Android PrayerDataPolicy.valid / iOS PrayerDataPolicy.valid, PR #5/#6):
 * damga ≤ şimdi+5 dk ve ≥ şimdi−14 gün, önceki damgadan eski değil, tarihler tekil, 6 sıralı vakit, bugün ve yarın var.
 * Bilinmeyen alanlar yok sayılır. Test amaçlı birebir taklit; mobil kaynak kodu değiştirilmez.
 */
export function eskiOkuyucuKabul(dosya, simdi, onceki = null) {
  try {
    const { guncelleme, gunler } = JSON.parse(JSON.stringify(dosya)); // yalnız bilinen alanlar okunur
    const z = Date.parse(guncelleme), n = Date.parse(simdi);
    if (!(z <= n + 300_000 && z >= n - 14 * 86_400_000)) return false;
    if (onceki && z < Date.parse(onceki.guncelleme)) return false;
    const t = new Set();
    for (const g of gunler) { const d = isoTarih(g.t); if (t.has(d)) return false; t.add(d);
      if (g.v.length !== 6 || g.v.some((s) => !SAAT.test(s)) || g.v.some((s, i) => i > 0 && s <= g.v[i - 1])) return false; }
    const bugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(n));
    return t.has(bugun) && t.has(gunEkle(bugun, 1));
  } catch { return false; }
}
