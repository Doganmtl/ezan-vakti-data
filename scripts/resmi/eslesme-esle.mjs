// Tam il/ilçe kimlik eşlemesi (resmi Awqat ↔ v1). Kesin 83 istek: giriş 1 + iller 1 + ilçeler 81. Tekrar yok.
// Hiçbir yayın dosyasına ve eşleme tablosuna YAZMAZ; öneri raporu üretir (golge/eslesme-oneri-*.json).
// Tabloya işleme ayrı, incelemeli bir commit'tir (scripts/resmi/eslesme-uygula.mjs).
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AwqatIstemci } from "./awqat-adaptor.mjs";

export const TURKIYE_RESMI = 2; // pilot 27.11.2026 (run 45976882480)
export const ESLESME_ISTEK = 83;
const norm = (s) => String(s ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

export async function esle({ istemci, sozlesme, v1 = "docs/v1" }) {
  const y = sozlesme.yer;
  const v1Iller = JSON.parse(await fs.readFile(path.join(v1, "iller.json"), "utf8"));
  const resmiIller = await istemci.getir("iller", { countryId: TURKIYE_RESMI });
  const oneri = {}, sorunlar = [];
  for (const il of v1Iller) {
    const adayAyni = resmiIller.filter((s) => s[y.id] === il.id && norm(s[y.ad]) === norm(il.ad));
    const adayAd = resmiIller.filter((s) => norm(s[y.ad]) === norm(il.ad));
    const st = adayAyni.length === 1 ? adayAyni[0] : adayAd.length === 1 ? adayAd[0] : null;
    if (!st) { sorunlar.push({ tur: "il", id: il.id, ad: il.ad }); continue; }
    const cities = await istemci.getir("ilceler", { stateId: st[y.id] });
    for (const x of JSON.parse(await fs.readFile(path.join(v1, "ilceler", il.id + ".json"), "utf8"))) {
      const ayni = cities.filter((c) => c[y.id] === x.id && norm(c[y.ad]) === norm(x.ad));
      const ad = cities.filter((c) => norm(c[y.ad]) === norm(x.ad));
      if (ayni.length === 1) oneri[x.id] = { resmi: x.id, yontem: "ayni-kimlik-ve-ad", resmiIl: st[y.id] };
      else if (ad.length === 1) { oneri[x.id] = { resmi: ad[0][y.id], yontem: "ad", resmiIl: st[y.id] }; sorunlar.push({ tur: "farkli-kimlik", id: x.id, ad: x.ad, resmi: ad[0][y.id] }); }
      else { oneri[x.id] = { resmi: null, yontem: null, resmiIl: st[y.id] }; sorunlar.push({ tur: "eslesmedi", id: x.id, ad: x.ad, aday: ad.length }); }
    }
  }
  const sayim = { toplam: Object.keys(oneri).length, ayni: 0, ad: 0, yok: 0 };
  for (const o of Object.values(oneri)) o.yontem === "ayni-kimlik-ve-ad" ? sayim.ayni++ : o.yontem === "ad" ? sayim.ad++ : sayim.yok++;
  return { oneri, sorunlar, sayim, istek: istemci.toplamIstek };
}

export async function cli(env = process.env, { simdi = new Date() } = {}) {
  if (env.ALLOW_LIVE_API !== "evet") { console.error("Canlı API kapalı: ALLOW_LIVE_API=evet gerekir."); return 2; }
  const bugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(simdi);
  const klasor = env.GOLGE_DIR ?? "golge", dosya = path.join(klasor, `eslesme-oneri-${bugun}.json`);
  try { await fs.access(dosya); console.error(`Bugünün eşleme raporu zaten var (${dosya}); istek gönderilmedi.`); return 4; } catch {}
  if (!env.AWQAT_EMAIL || !env.AWQAT_PASSWORD) { console.error("AWQAT_EMAIL ve AWQAT_PASSWORD gerekli; istek gönderilmedi."); return 2; }
  const sozlesme = JSON.parse(await fs.readFile("config/awqat-sozlesme.json", "utf8"));
  if (env.AWQAT_BASE_URL) sozlesme.baseUrl = env.AWQAT_BASE_URL; // yalnız yerel test sunucusu
  const istemci = new AwqatIstemci({ sozlesme, email: env.AWQAT_EMAIL, sifre: env.AWQAT_PASSWORD, toplamIstekSiniri: ESLESME_ISTEK, tekrarYok: true });
  let r;
  try { r = await esle({ istemci, sozlesme }); }
  catch (e) { console.error(`DURDU: ${e.kod ?? "HATA"}: ${istemci.maskele(e.message)} (istek ${istemci.toplamIstek})`); return 1; }
  const metin = istemci.maskele(JSON.stringify({ tarih: simdi.toISOString(), ...r }, null, 1));
  if (istemci.gizliIcerir(metin)) { console.error("Rapor gizli değer içeriyor; yazılmadı."); return 3; }
  await fs.mkdir(klasor, { recursive: true });
  await fs.writeFile(dosya, metin + "\n", { flag: "wx" });
  console.log("ESLESME_OZET " + JSON.stringify({ sayim: r.sayim, istek: r.istek, sorunlar: r.sorunlar }));
  return r.sayim.yok === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await cli();
