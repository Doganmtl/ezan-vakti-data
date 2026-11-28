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
  const ters = Object.fromEntries(Object.entries(kural?.hizmetEslemesi ?? {}).filter(([a]) => !a.startsWith("_")).flatMap(([url, e]) => [[e.kota, url], ...(e.kotaParametresiz ? [[e.kotaParametresiz, `${url} (parametresiz)`]] : [])]));
  for (const donem of DONEMLER) {
    const gruplar = (k?.gruplar ?? []).filter((x) => x.donem === donem);
    if (k && !gruplar.length) satirlar.push({ kaynak: "API", donem, not: "liste boş (bu dönemde listelenen hizmet yok)" });
    for (const g of gruplar) {
      const yenilenme = g.donemBas || g.donemSon ? { bas: g.donemBas, son: g.donemSon } : "API bildirmiyor";
      const url = g.hizmet && ters[g.hizmet] ? ` (${ters[g.hizmet]})` : "";
      satirlar.push({ kaynak: "API", donem, hizmet: (g.hizmet ?? "eşlenemedi") + url, parametre: "(grup toplamı)", sinir: g.limit, kullanilan: g.kullanilan,
        kalan: null, asim: g.asildi ? "var" : 0, yenilenme, not: `sınır parametre başına (remainingUse); ${g.parametreler.length} parametre satırı` });
      for (const p of g.parametreler) satirlar.push({ kaynak: "API", donem, hizmet: (g.hizmet ?? "eşlenemedi") + url, parametre: p.ad ? `${p.ad}:${p.deger}` : p.deger,
        sinir: g.limit, kullanilan: p.kullanilan, kalan: p.kalan, asim: p.asim, yenilenme });
    }
  }
  if (kural && bugun) {
    const g = kuralSiniri(kural, bugun);
    satirlar.push({ kaynak: "BELGE", donem: "daily", hizmet: "her hizmet", parametre: "her parametre", sinir: g, not: `R2/R3: normal ${kural.ucParametreGunluk}, ilk ${kural.ilkGunSayisi} gün ${kural.ilk15GunUcParametreGunluk} (hesap ${kural.hesapAcilis}; kesin bitiş doğrulanmadı, ${kural.artirilmisEmniyetGun ?? 1} gün erken bitirilir)` });
    satirlar.push({ kaynak: "BELGE", donem: "monthly", hizmet: "PrayerTime/DateRange", parametre: "her yer", sinir: kural.dateRangeYerAylik, not: "R1: yer bazında aylık (Quota/My'de görünmüyor; kota defteriyle uygulanır)" });
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

/**
 * Son kota durumu anlık görüntüsü (D23): kalıcı defter dalına `kota-durum.json` ve `kota-durum.md` yazar. Ek istek yoktur:
 * API değerleri çalışmanın kendi Quota/My okumasıdır (okuma anı `okumaZamani`); DEFTER değerleri çalışma sonrasıdır.
 * kota okunmadıysa (null) yazılmaz; önceki görüntü korunur.
 */
export async function kotaDurumuYaz(dizin, { kota, okumaZamani, kotaDefteri, kural, bugun, kaynak }) {
  if (!dizin || !kota) return null;
  const fs = await import("node:fs/promises"), path = await import("node:path");
  const tablo = kotaTablosu(kota, { kotaDefteri, kural, bugun });
  const ust = { surum: 1, okumaZamani, gun: bugun, kaynak, not: "API = Quota/My'nin okuma anındaki bildirimi · BELGE = resmî dokümantasyon · DEFTER = çalışma sonrası kendi sayımımız" };
  await fs.mkdir(dizin, { recursive: true });
  await fs.writeFile(path.join(dizin, "kota-durum.json"), JSON.stringify({ ...ust, tablo }, null, 1) + "\n");
  await fs.writeFile(path.join(dizin, "kota-durum.md"), `# Diyanet kota durumu\n\n- Okuma: ${okumaZamani} (İstanbul günü ${bugun})\n- Kaynak: ${kaynak}\n- ${ust.not}\n\n${kotaTablosuMd(tablo)}\n`);
  return ust;
}
