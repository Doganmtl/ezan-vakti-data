// Kota durumu tablosu (saf; D23). Üç kaynağı AYRI gösterir:
//  API    — GET /api/Quota/My yanıtının bildirdiği (benefit, totalUsed, totalExceeded, lines, yenilenme alanı varsa)
//  BELGE  — resmî dokümantasyon kuralları (R1 DateRange yer/ay 10; R2/R3 hizmet+parametre 10, ilk 15 gün 100)
//  DEFTER — kendi kota defterimizin saydığı (gün/ay/yıl × hizmet, hizmet|parametre)
// API'nin vermediği bilgi tahmin edilmez: "API bildirmiyor". Satır (lines) alanları belgelenmediği için genel okunur:
// yol biçimli metin → hizmet; parametre adına benzeyen alan → parametre; bütün sayısal alanlar ayrı listelenir.
import { kotaOku, kuralSiniri, DONEMLER } from "./kota.mjs";

const GIZLI = /token|auth|pass|sifre|email|mail|user|kullanici|secret/i;
const PARAM_ANAHTAR = /param|city|state|country|place|location|yer|key|value|arg|id$/i;
const YENILENME = /reset|renew|next|expire|yenilen|period(start|end)|start|end/i;
const kisa = (v) => (typeof v === "string" && /^[\w/.{}:+ -]{1,60}$/.test(v) && !v.includes("@") ? v : undefined);
const yolHizmet = (v) => (typeof v === "string" ? v.match(/\/?api\/([A-Za-z]+\/[A-Za-z]+)/)?.[1] ?? null : null);

/** Bir satırı (lines[i]) genel olarak çözer. */
export function satirCoz(s) {
  const o = { hizmet: null, parametre: null, sayilar: {}, yenilenme: {}, diger: {} };
  for (const [k, v] of Object.entries(s ?? {})) {
    if (GIZLI.test(k)) continue;
    const h = yolHizmet(v);
    if (h && !o.hizmet) { o.hizmet = h; const p = String(v).match(/\/api\/[A-Za-z]+\/[A-Za-z]+\/([^/?\s]+)/)?.[1]; if (p && !o.parametre) o.parametre = p; continue; }
    if (YENILENME.test(k) && (typeof v === "number" || kisa(v))) { o.yenilenme[k] = v; continue; }
    if (PARAM_ANAHTAR.test(k) && !/used|count|total|limit|benefit|remain|kalan/i.test(k) && (kisa(v) !== undefined || typeof v === "number") && o.parametre === null) { o.parametre = String(v); continue; }
    if (typeof v === "number") { o.sayilar[k] = v; continue; }
    if (kisa(v) !== undefined) o.diger[k] = v;
  }
  return o;
}

/**
 * Satırlar: [{ kaynak: "API"|"BELGE"|"DEFTER", donem, hizmet, parametre, sinir, kullanilan, kalan, asim, yenilenme, not }]
 */
export function kotaTablosu(kota, { kotaDefteri = null, kural, bugun } = {}) {
  const satirlar = [];
  const k = kotaOku(kota);
  if (!k) satirlar.push({ kaynak: "API", not: "Quota/My yanıtı okunamadı (biçim beklenmedik)" });
  for (const donem of DONEMLER) {
    const liste = Array.isArray(kota?.[donem]) ? kota[donem] : [];
    if (!liste.length) satirlar.push({ kaynak: "API", donem, not: "liste boş (bu dönemde listelenen hizmet yok)" });
    for (const g of liste) {
      const ust = Object.fromEntries(Object.entries(g).filter(([a, v]) => YENILENME.test(a) && (typeof v === "number" || kisa(v))));
      const cozulen = (Array.isArray(g.lines) ? g.lines : []).map(satirCoz);
      const hizmetler = [...new Set(cozulen.map((x) => x.hizmet).filter(Boolean))];
      satirlar.push({ kaynak: "API", donem, hizmet: hizmetler.length === 1 ? hizmetler[0] : hizmetler.length ? hizmetler.join(", ") : "eşlenemedi",
        parametre: "(grup toplamı)", sinir: g.benefit, kullanilan: g.totalUsed, kalan: Number.isFinite(g.benefit) && Number.isFinite(g.totalUsed) ? g.benefit - g.totalUsed : null,
        asim: g.totalExceeded ?? null, yenilenme: Object.keys(ust).length ? ust : "API bildirmiyor", not: `satır ${Array.isArray(g.lines) ? g.lines.length : "-"}` });
      for (const c of cozulen) satirlar.push({ kaynak: "API", donem, hizmet: c.hizmet ?? "eşlenemedi", parametre: c.parametre ?? "API bildirmiyor",
        sinir: null, kullanilan: null, kalan: null, asim: null, yenilenme: Object.keys(c.yenilenme).length ? c.yenilenme : "API bildirmiyor",
        not: `satır alanları: ${JSON.stringify({ ...c.sayilar, ...c.diger })}` });
    }
  }
  if (kural && bugun) {
    const g = kuralSiniri(kural, bugun);
    satirlar.push({ kaynak: "BELGE", donem: "daily", hizmet: "her hizmet", parametre: "her parametre", sinir: g, not: `R2/R3: normal ${kural.ucParametreGunluk}, ilk ${kural.ilkGunSayisi} gün ${kural.ilk15GunUcParametreGunluk} (hesap ${kural.hesapAcilis}; kesin bitiş doğrulanmadı, ${kural.artirilmisEmniyetGun ?? 1} gün erken bitirilir)` });
    satirlar.push({ kaynak: "BELGE", donem: "monthly", hizmet: "PrayerTime/DateRange", parametre: "her yer", sinir: kural.dateRangeYerAylik, not: "R1: yer bazında aylık" });
  }
  if (kotaDefteri) {
    for (const [donem, ad] of [["daily", "gun"], ["monthly", "ay"], ["yearly", "yil"]]) {
      const s = kotaDefteri.sayac[ad];
      const anahtarlar = Object.keys(s).sort();
      if (!anahtarlar.length) satirlar.push({ kaynak: "DEFTER", donem, not: "kayıt yok" });
      for (const a of anahtarlar) {
        const [hizmet, parametre] = a.split("|");
        satirlar.push({ kaynak: "DEFTER", donem, hizmet, parametre: parametre ?? "(hizmet toplamı)", kullanilan: s[a] });
      }
    }
  }
  return satirlar;
}

const hucre = (v) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/\|/g, "\\|");
/** Markdown tablo (GITHUB_STEP_SUMMARY ve log için). Uzun listelerde DEFTER parametre satırları özetlenir. */
export function kotaTablosuMd(satirlar, { azamiDefterSatiri = 40 } = {}) {
  const b = ["| Kaynak | Dönem | Hizmet | Parametre | Sınır | Kullanılan | Kalan | Aşım | Yenilenme | Not |", "|---|---|---|---|---|---|---|---|---|---|"];
  let defter = 0, atlanan = 0;
  for (const s of satirlar) {
    if (s.kaynak === "DEFTER" && s.parametre && s.parametre !== "(hizmet toplamı)" && ++defter > azamiDefterSatiri) { atlanan++; continue; }
    b.push(`| ${[s.kaynak, s.donem, s.hizmet, s.parametre, s.sinir, s.kullanilan, s.kalan, s.asim, s.yenilenme, s.not].map(hucre).join(" | ")} |`);
  }
  if (atlanan) b.push(`| DEFTER | | | +${atlanan} parametre satırı daha | | | | | | özet kısaltıldı |`);
  return b.join("\n");
}
