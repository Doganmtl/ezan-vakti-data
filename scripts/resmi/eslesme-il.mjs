// Tek il için resmi ilçe listesi doğrulaması (8. tur: Afyonkarahisar, 9183 Şuhut). Kesin 4 istek:
// giriş 1 + Quota/My (önce) 1 + Place/Cities 1 + Quota/My (sonra) 1. Otomatik tekrar yok.
// Hiçbir yayın dosyasına ve eşleme tablosuna YAZMAZ; rapor üretir ve tek satır olarak log'a basar.
// Tabloya işleme ayrı, incelemeli commit'tir (scripts/resmi/eslesme-tamamla.mjs).
//   ALLOW_LIVE_API=evet ESLESME_IL=502 node scripts/resmi/eslesme-il.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { AwqatIstemci } from "./awqat-adaptor.mjs";
import { izinVerilen, enAzKalan } from "./kota.mjs";

export const IL_ISTEK = 4;
/** Türkçe büyük harf; aksan/karakter katlaması YOK (Ş ≠ S). */
export const buyuk = (s) => String(s ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

/** Kayıt kümesinin bütünlük özeti (anahtar sırası sabit, ham resmi ad dahil). */
export function ilButunluk(kayitlar) {
  const sirali = Object.keys(kayitlar).sort((a, b) => a - b)
    .map((k) => [k, kayitlar[k].resmi, kayitlar[k].yontem, kayitlar[k].resmiIl, kayitlar[k].resmiAdHam ?? null]);
  return createHash("sha256").update(JSON.stringify(sirali)).digest("hex");
}

/**
 * Saf sınıflandırma. v1Liste: [{id, ad}], resmiListe: Cities yanıtı, alan: {id, ad} alan adları.
 * Kural: aynı kimlik → eşleşme (ad aynı: "ayni-kimlik-ve-ad", farklı: "ayni-kimlik-ad-farkli");
 * farklı kimlikte aynı ad → "ad" (ASLA uygulanmaz); hiçbiri → null. Hiçbir durumda istisna listesine eklenmez.
 */
export function ilSiniflandir({ ilId, v1Liste, resmiListe, alan = { id: "id", ad: "name" } }) {
  const sorunlar = [], kayitlar = {};
  const gecerli = Array.isArray(resmiListe) && resmiListe.every((c) => Number.isSafeInteger(c?.[alan.id]) && typeof c?.[alan.ad] === "string")
    && new Set(resmiListe.map((c) => c[alan.id])).size === resmiListe.length;
  if (!gecerli) sorunlar.push({ tur: "resmi-ilce-listesi-gecersiz", il: ilId });
  const liste = gecerli ? resmiListe : [];
  for (const x of v1Liste) {
    const kimlik = liste.filter((c) => c[alan.id] === x.id);
    const adla = liste.filter((c) => buyuk(c[alan.ad]) === buyuk(x.ad) && c[alan.id] !== x.id);
    if (kimlik.length === 1) {
      const ham = kimlik[0][alan.ad].trim(), ayni = buyuk(ham) === buyuk(x.ad);
      kayitlar[x.id] = { resmi: x.id, yontem: ayni ? "ayni-kimlik-ve-ad" : "ayni-kimlik-ad-farkli", resmiIl: ilId, resmiAdHam: ham, resmiAd: buyuk(ham) };
      if (!ayni) sorunlar.push({ tur: "ad-farkli", id: x.id, v1Ad: x.ad, resmiAdHam: ham });
    } else if (adla.length === 1) {
      kayitlar[x.id] = { resmi: adla[0][alan.id], yontem: "ad", resmiIl: ilId, resmiAdHam: adla[0][alan.ad].trim() };
      sorunlar.push({ tur: "farkli-kimlik", id: x.id, ad: x.ad, resmi: adla[0][alan.id] });
    } else {
      kayitlar[x.id] = { resmi: null, yontem: null, resmiIl: ilId };
      sorunlar.push({ tur: "eslesmedi", id: x.id, ad: x.ad, aday: adla.length });
    }
  }
  const v1Ids = new Set(v1Liste.map((x) => x.id));
  const fazla = liste.filter((c) => !v1Ids.has(c[alan.id])).map((c) => ({ id: c[alan.id], resmiAdHam: c[alan.ad] }));
  if (fazla.length) sorunlar.push({ tur: "resmi-listede-fazla", ilceler: fazla });
  const sayim = { v1: v1Liste.length, resmi: liste.length, ayni: 0, adFarkli: 0, ad: 0, yok: 0 };
  for (const k of Object.values(kayitlar)) k.yontem === "ayni-kimlik-ve-ad" ? sayim.ayni++ : k.yontem === "ayni-kimlik-ad-farkli" ? sayim.adFarkli++ : k.yontem === "ad" ? sayim.ad++ : sayim.yok++;
  // "Tam" = il listesindeki her v1 ilçesi aynı kimlikle eşleşti; ad farkları kullanıcı kararıyla resmi ada çevrilir.
  const tam = gecerli && sayim.ayni + sayim.adFarkli === v1Liste.length && fazla.length === 0;
  return { tam, kayitlar, sayim, sorunlar, butunluk: ilButunluk(kayitlar) };
}

export async function cli(env = process.env, { simdi = new Date() } = {}) {
  if (env.ALLOW_LIVE_API !== "evet") { console.error("Canlı API kapalı: ALLOW_LIVE_API=evet gerekir."); return 2; }
  const ilId = Number(env.ESLESME_IL);
  if (!Number.isSafeInteger(ilId)) { console.error("ESLESME_IL (v1 il kimliği) gerekli."); return 2; }
  const bugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(simdi);
  const klasor = env.GOLGE_DIR ?? "golge", dosya = path.join(klasor, `eslesme-il-${ilId}-${bugun}.json`);
  try { await fs.access(dosya); console.error(`Bugünün raporu zaten var (${dosya}); istek gönderilmedi.`); return 4; } catch {}
  if (!env.AWQAT_EMAIL || !env.AWQAT_PASSWORD) { console.error("AWQAT_EMAIL ve AWQAT_PASSWORD gerekli; istek gönderilmedi."); return 2; }
  let v1Liste;
  try { v1Liste = JSON.parse(await fs.readFile(path.join("docs/v1/ilceler", `${ilId}.json`), "utf8")); } catch { console.error("v1 ilçe listesi okunamadı; istek gönderilmedi."); return 2; }
  const sozlesme = JSON.parse(await fs.readFile("config/awqat-sozlesme.json", "utf8"));
  if (env.AWQAT_BASE_URL) sozlesme.baseUrl = env.AWQAT_BASE_URL; // yalnız yerel test sunucusu
  // Toplam 4 istek kodla sabit; tekrarYok: 5xx/401 sonrası ek istek yok (sınır aşılırsa istemci istek göndermeden durur).
  const istemci = new AwqatIstemci({ sozlesme, email: env.AWQAT_EMAIL, sifre: env.AWQAT_PASSWORD, toplamIstekSiniri: IL_ISTEK, tekrarYok: true });
  let r, kotaOnce, kotaSonra;
  try {
    kotaOnce = await istemci.getir("kota", {});
    const izin = izinVerilen(kotaOnce);
    // 1 Cities isteği + son kota okuması için en az 2 hak; bilinmiyorsa izin 0 → dur.
    if (izin < 2) { console.error(`DURDU: kalan günlük hak yetersiz/bilinmiyor (izin ${izin}, gereken 2); istek gönderilmedi.`); return 5; }
    // Resmi il kimliği = v1 il kimliği: run 45995729583 bütünlük özetiyle doğrulandı (resmiIl alanı).
    const liste = await istemci.getir("ilceler", { stateId: ilId });
    r = ilSiniflandir({ ilId, v1Liste, resmiListe: liste, alan: sozlesme.yer });
    kotaSonra = await istemci.getir("kota", {});
  } catch (e) { console.error(`DURDU: ${e.kod ?? "HATA"}: ${istemci.maskele(e.message)} (istek ${istemci.toplamIstek})`); return 1; }
  let commit = env.GITHUB_SHA ?? null;
  if (!commit) { try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {} }
  const kaynak = { commit, runId: env.GITHUB_RUN_ID ?? "yerel", ref: env.GITHUB_REF ?? null };
  const kota = { onceEnAzKalan: enAzKalan(kotaOnce), sonraEnAzKalan: enAzKalan(kotaSonra) };
  const metin = istemci.maskele(JSON.stringify({ tarih: simdi.toISOString(), il: ilId, kaynak, kota, ...r, istek: istemci.toplamIstek, istekSayilari: istemci.istekSayilari }));
  if (istemci.gizliIcerir(metin)) { console.error("Rapor gizli değer içeriyor; yazılmadı."); return 3; }
  await fs.mkdir(klasor, { recursive: true });
  await fs.writeFile(dosya, metin + "\n", { flag: "wx" });
  console.log("ESLESME_IL_RAPOR " + metin);
  return r.tam ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await cli();
