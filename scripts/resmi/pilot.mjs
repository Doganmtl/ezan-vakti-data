// Kontrollü 3 ilçelik resmi API pilotu. Kesin 11 istek; tekrar yok; ilk hatada durur. Ayrıntı: PILOT-PLANI.md
// Yayına (docs/v1) ve eşleme tablosuna YAZMAZ; yalnız golge/pilot-*.json raporu üretir.
//   ALLOW_LIVE_API=evet AWQAT_EMAIL=... AWQAT_PASSWORD=... node scripts/resmi/pilot.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AwqatIstemci, vakitDonustur } from "./awqat-adaptor.mjs";
import { karsilastir } from "./golge.mjs";
import { gunEkle } from "../v1-dogrulama.mjs";

export const PILOT_ILCELER = [
  { v1: 9541, il: "İSTANBUL", ilce: "İSTANBUL" },   // en büyük kullanıcı kitlesi, ayna karşılaştırması var
  { v1: 9206, il: "ANKARA", ilce: "ANKARA" },       // ikinci karşılaştırma noktası
  { v1: 33292, il: "ESKİŞEHİR", ilce: "MİHALGAZİ" }, // aynada HTTP 502; resmi kaynakla kurtarılabilir mi
];
export const PILOT_ISTEK = 11; // giriş 1 + kota 2 + ülkeler 1 + iller 1 + ilçeler 3 + aylık 3
/**
 * Kota yanıtını güvenli alanlarla sınırlar: sayılar/mantıksal değerler ve yalnız izinli anahtarlardaki kısa metinler.
 * E-posta, JWT benzeri değer, uzun metin ve bilinmeyen metin alanları atılır. Derinlik 4, en çok 300 alan.
 */
const KOTA_METIN_ANAHTARLARI = /^(name|endpoint|path|route|service|period|type|method|unit|resetAt|resetDate|date)$/i;
export function kotaOzet(x, derinlik = 0, sayac = { n: 0 }) {
  if (derinlik > 4 || sayac.n > 300) return undefined;
  if (typeof x === "number" || typeof x === "boolean" || x === null) { sayac.n++; return x; }
  if (Array.isArray(x)) return x.slice(0, 100).map((y) => kotaOzet(y, derinlik + 1, sayac)).filter((y) => y !== undefined);
  if (typeof x === "object") {
    const o = {};
    for (const [k, v] of Object.entries(x)) {
      if (/token|auth|pass|sifre|şifre|email|mail|user|kullanici/i.test(k)) continue;
      if (typeof v === "string") {
        if (KOTA_METIN_ANAHTARLARI.test(k) && v.length <= 100 && !/@/.test(v) && !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) { o[k] = v; sayac.n++; }
        continue;
      }
      const y = kotaOzet(v, derinlik + 1, sayac);
      if (y !== undefined) o[k] = y;
    }
    return o;
  }
  return undefined;
}
const norm = (s) => String(s ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
const bul = (liste, ad, alan) => { const x = (liste ?? []).filter((y) => norm(y[alan.ad]) === norm(ad)); return x.length === 1 ? x[0] : null; };

export async function pilot({ istemci, sozlesme, v1 = "docs/v1", bugun, simdi = () => new Date().toISOString() }) {
  const r = { tarih: simdi(), bugun, adimlar: [], ilceler: {}, kriterler: {}, durdu: null };
  const adim = async (ad, fn) => { try { const x = await fn(); r.adimlar.push({ ad, sonuc: "tamam" }); return x; } catch (e) { r.adimlar.push({ ad, sonuc: "hata", kod: e.kod ?? "HATA", mesaj: e.message }); r.durdu = ad; throw e; } };
  const y = sozlesme.yer;
  try {
    r.kotaOnce = kotaOzet(await adim("kota-once", () => istemci.getir("kota", {})));
    const ulkeler = await adim("ulkeler", () => istemci.getir("ulkeler", {}));
    const tr = bul(ulkeler, "TÜRKİYE", y) ?? (ulkeler ?? []).find((u) => norm(u[y.kod]) === "TR") ?? null;
    if (!tr) throw Object.assign(new Error("Türkiye ülke kaydı bulunamadı"), { kod: "ESLESME" });
    r.turkiye = { id: tr[y.id], kod: tr[y.kod], ad: tr[y.ad] };
    const iller = await adim("iller", () => istemci.getir("iller", { countryId: tr[y.id] }));
    for (const p of PILOT_ILCELER) {
      const il = bul(iller, p.il, y);
      if (!il) throw Object.assign(new Error(`${p.il} il kaydı bulunamadı`), { kod: "ESLESME" });
      const ilceler = await adim(`ilceler-${p.il}`, () => istemci.getir("ilceler", { stateId: il[y.id] }));
      const ilce = bul(ilceler, p.ilce, y);
      if (!ilce) throw Object.assign(new Error(`${p.ilce} ilçe kaydı bulunamadı`), { kod: "ESLESME" });
      r.ilceler[p.v1] = { il: { id: il[y.id], ad: il[y.ad] }, resmi: ilce[y.id], ad: ilce[y.ad], ayniKimlik: ilce[y.id] === p.v1 };
    }
    for (const p of PILOT_ILCELER) {
      const ham = await adim(`aylik-${p.v1}`, () => istemci.getir("aylik", { cityId: r.ilceler[p.v1].resmi }));
      const k = r.ilceler[p.v1];
      const alanlar = [sozlesme.vakit.tarih, ...sozlesme.vakit.alanlar];
      k.eksikAlan = [...new Set((Array.isArray(ham) ? ham : []).flatMap((g) => alanlar.filter((a) => !(a in (g ?? {})))))];
      k.ornekAlanlar = Array.isArray(ham) && ham[0] ? Object.keys(ham[0]).sort() : [];
      const gunler = (ham ?? []).map((g) => vakitDonustur(g, sozlesme));
      const tarihler = new Set(gunler.map((g) => g.t));
      k.gun = gunler.length; k.ilk = gunler[0]?.t ?? null; k.son = gunler.at(-1)?.t ?? null;
      k.bugunArti14 = Array.from({ length: 15 }, (_, i) => gunEkle(bugun, i).split("-").reverse().join(".")).every((t) => tarihler.has(t));
      let bizim = null; try { bizim = JSON.parse(await fs.readFile(path.join(v1, "vakitler", p.v1 + ".json"), "utf8")).gunler; } catch {}
      k.karsilastirma = bizim ? karsilastir(bizim, gunler) : null;
    }
    r.kotaSonra = kotaOzet(await adim("kota-sonra", () => istemci.getir("kota", {})));
  } catch (e) { if (!r.durdu) { r.durdu = "dogrulama"; r.hata = `${e.kod ?? "HATA"}: ${e.message}`; } }
  const ik = Object.values(r.ilceler);
  r.kriterler = {
    K1_sema: ik.length === 3 && ik.every((k) => Array.isArray(k.eksikAlan) && k.eksikAlan.length === 0),
    K2_kapsam: ik.length === 3 && ik.every((k) => k.bugunArti14),
    K3_esitlik: [9541, 9206].every((id) => r.ilceler[id]?.karsilastirma && r.ilceler[id].karsilastirma.ortakGun >= 7 && r.ilceler[id].karsilastirma.fark.length === 0),
    K4_eslesme: ik.length === 3,
    K5_istek: istemci.toplamIstek <= PILOT_ISTEK,
  };
  r.istek = { toplam: istemci.toplamIstek, ayrinti: istemci.istekSayilari };
  r.sonuc = r.durdu ? "DURDU" : Object.values(r.kriterler).every(Boolean) ? "GECTI" : "KALDI";
  return r;
}

/** Raporu güvenle diske yazar: gizli değer içeriyorsa hiç yazmaz. Aynı adlı rapor varsa üzerine yazmaz. */
export async function raporYaz(rapor, istemci, dosya) {
  const metin = istemci.maskele(JSON.stringify(rapor, null, 1));
  if (istemci.gizliIcerir(metin)) throw new Error("Rapor gizli değer içeriyor; yazılmadı.");
  await fs.writeFile(dosya, metin + "\n", { flag: "wx" });
  return metin;
}

/** Komut satırı. Sıra: onay → aynı gün raporu kontrolü → kimlik bilgisi kontrolü → (ağ) pilot → güvenli yazım. */
export async function cli(env = process.env, { simdi = new Date() } = {}) {
  if (env.ALLOW_LIVE_API !== "evet") { console.error("Canlı API kapalı: ALLOW_LIVE_API=evet gerekir (kullanıcı onayı)."); return 2; }
  const bugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(simdi);
  const klasor = env.GOLGE_DIR ?? "golge";
  const dosya = path.join(klasor, `pilot-${bugun}.json`);
  // Aynı gün ikinci pilot kota harcamasın: herhangi bir ağ çağrısından ÖNCE dur.
  try { await fs.access(dosya); console.error(`Bugünün pilot raporu zaten var (${dosya}); yeni istek gönderilmedi.`); return 4; } catch {}
  if (!env.AWQAT_EMAIL || !env.AWQAT_PASSWORD) { console.error("AWQAT_EMAIL ve AWQAT_PASSWORD gerekli; istek gönderilmedi."); return 2; }
  const sozlesme = JSON.parse(await fs.readFile("config/awqat-sozlesme.json", "utf8"));
  if (env.AWQAT_BASE_URL) sozlesme.baseUrl = env.AWQAT_BASE_URL; // yalnız yerel test sunucusu (adaptör yalnız https veya 127.0.0.1 kabul eder)
  const istemci = new AwqatIstemci({ sozlesme, email: env.AWQAT_EMAIL, sifre: env.AWQAT_PASSWORD, toplamIstekSiniri: PILOT_ISTEK, tekrarYok: true });
  const rapor = await pilot({ istemci, sozlesme, bugun });
  await fs.mkdir(klasor, { recursive: true });
  await raporYaz(rapor, istemci, dosya);
  console.log(`${rapor.sonuc} — ${rapor.istek.toplam} istek — rapor: ${dosya}`);
  return rapor.sonuc === "GECTI" ? 0 : 1;
}

// Windows uyumlu giriş noktası kontrolü (C:\... yolları file:/// URL'ye çevrilir).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await cli();
}
