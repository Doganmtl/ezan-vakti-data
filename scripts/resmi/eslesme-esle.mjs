// Tam il/ilçe kimlik eşlemesi (resmi Awqat ↔ v1). Kesin 83 istek: giriş 1 + iller 1 + ilçeler 81. Tekrar yok.
// Hiçbir yayın dosyasına ve eşleme tablosuna YAZMAZ; öneri raporu üretir (golge/eslesme-oneri-*.json).
// Tabloya işleme ayrı, incelemeli bir commit'tir (scripts/resmi/eslesme-uygula.mjs).
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { AwqatIstemci } from "./awqat-adaptor.mjs";
import { izinVerilen, enAzKalan } from "./kota.mjs";

export const TURKIYE_RESMI = 2; // pilot 27.11.2026 (run 45976882480)
export const BEKLENEN_IL = 81, BEKLENEN_ILCE = 869;
// Kesin bütçe: giriş 1 + Quota/My 2 (önce/sonra) + iller 1 + ilçeler 81 = 85
export const ESLESME_ISTEK = 85;
const ILCE_ISTEGI = 81; // aynı uca en çok bu kadar istek
/** Öneri kümesinin bütünlük özeti (anahtar sırası sabit). */
export function butunlukOzeti(oneri) {
  const sirali = Object.keys(oneri).sort((a, b) => a - b).map((k) => [k, oneri[k].resmi, oneri[k].yontem, oneri[k].resmiIl, oneri[k].resmiAd ?? null]);
  return createHash("sha256").update(JSON.stringify(sirali)).digest("hex");
}
const norm = (s) => String(s ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

export async function esle({ istemci, sozlesme, v1 = "docs/v1" }) {
  const y = sozlesme.yer;
  const v1Iller = JSON.parse(await fs.readFile(path.join(v1, "iller.json"), "utf8"));
  const v1Ilceler = new Map();
  for (const il of v1Iller) v1Ilceler.set(il.id, JSON.parse(await fs.readFile(path.join(v1, "ilceler", il.id + ".json"), "utf8")));
  const v1Toplam = [...v1Ilceler.values()].reduce((a, l) => a + l.length, 0);
  const resmiIller = await istemci.getir("iller", { countryId: TURKIYE_RESMI });
  const oneri = {}, sorunlar = [], adFarklari = [], ilAdlari = {};
  if (v1Iller.length !== BEKLENEN_IL) sorunlar.push({ tur: "v1-il-sayisi", beklenen: BEKLENEN_IL, bulunan: v1Iller.length });
  if (v1Toplam !== BEKLENEN_ILCE) sorunlar.push({ tur: "v1-ilce-sayisi", beklenen: BEKLENEN_ILCE, bulunan: v1Toplam });
  if (!Array.isArray(resmiIller) || new Set(resmiIller.map((s) => s[y.id])).size !== resmiIller.length) sorunlar.push({ tur: "resmi-il-listesi-gecersiz" });
  let eslesenIl = 0;
  for (const il of v1Iller) {
    // Önce aynı kimlik (ad farklı olabilir: Diyanet resmi adı esas alınır), sonra ad.
    const adayKimlik = (resmiIller ?? []).filter((s) => s[y.id] === il.id);
    const adayAd = (resmiIller ?? []).filter((s) => norm(s[y.ad]) === norm(il.ad));
    const st = adayKimlik.length === 1 ? adayKimlik[0] : adayAd.length === 1 ? adayAd[0] : null;
    if (st) { ilAdlari[il.id] = String(st[y.ad]).trim(); if (st[y.id] === il.id && norm(st[y.ad]) !== norm(il.ad)) adFarklari.push({ tur: "il", id: il.id, v1Ad: il.ad, resmiAd: ilAdlari[il.id] }); }
    if (!st) { sorunlar.push({ tur: "il-eslesmedi", id: il.id, ad: il.ad }); for (const x of v1Ilceler.get(il.id)) oneri[x.id] = { resmi: null, yontem: null, resmiIl: null }; continue; }
    if (st[y.id] !== il.id) sorunlar.push({ tur: "il-farkli-kimlik", id: il.id, resmi: st[y.id] });
    eslesenIl++;
    const cities = await istemci.getir("ilceler", { stateId: st[y.id] });
    if (!Array.isArray(cities) || new Set(cities.map((c) => c[y.id])).size !== cities.length) sorunlar.push({ tur: "resmi-ilce-listesi-gecersiz", il: il.id });
    for (const x of v1Ilceler.get(il.id)) {
      const ayni = (cities ?? []).filter((c) => c[y.id] === x.id && norm(c[y.ad]) === norm(x.ad));
      const kimlik = (cities ?? []).filter((c) => c[y.id] === x.id);
      const ad = (cities ?? []).filter((c) => norm(c[y.ad]) === norm(x.ad));
      if (ayni.length === 1) oneri[x.id] = { resmi: x.id, yontem: "ayni-kimlik-ve-ad", resmiIl: st[y.id], resmiAd: String(ayni[0][y.ad]).trim() };
      else if (kimlik.length === 1) {
        // Aynı kimlik, farklı yazım (ör. SUHUT ↔ ŞUHUT): kimlik eşleşir, resmi ad kaydedilir ve ayrıca raporlanır.
        oneri[x.id] = { resmi: x.id, yontem: "ayni-kimlik-ad-farkli", resmiIl: st[y.id], resmiAd: String(kimlik[0][y.ad]).trim() };
        adFarklari.push({ tur: "ilce", id: x.id, v1Ad: x.ad, resmiAd: oneri[x.id].resmiAd });
      }
      else if (ad.length === 1) { oneri[x.id] = { resmi: ad[0][y.id], yontem: "ad", resmiIl: st[y.id] }; sorunlar.push({ tur: "farkli-kimlik", id: x.id, ad: x.ad, resmi: ad[0][y.id] }); }
      else { oneri[x.id] = { resmi: null, yontem: null, resmiIl: st[y.id] }; sorunlar.push({ tur: "eslesmedi", id: x.id, ad: x.ad, aday: ad.length }); }
    }
  }
  // Aynı resmi kimlik iki v1 ilçesine verilemez.
  const gorulen = new Map();
  for (const [id, o] of Object.entries(oneri)) if (o.resmi !== null) { if (gorulen.has(o.resmi)) sorunlar.push({ tur: "tekrarlanan-resmi-kimlik", resmi: o.resmi, ilceler: [gorulen.get(o.resmi), Number(id)] }); else gorulen.set(o.resmi, Number(id)); }
  const sayim = { il: eslesenIl, toplam: Object.keys(oneri).length, ayni: 0, adFarkli: 0, ad: 0, yok: 0 };
  for (const o of Object.values(oneri)) o.yontem === "ayni-kimlik-ve-ad" ? sayim.ayni++ : o.yontem === "ayni-kimlik-ad-farkli" ? sayim.adFarkli++ : o.yontem === "ad" ? sayim.ad++ : sayim.yok++;
  // Başarı: 81 il ve 869 ilçenin TAMAMI aynı kimlikle eşleşti (ad farkları ayrıca raporlanır ve kullanıcı kararıyla resmi ada çevrilir),
  // sayımlar tutarlı, tekrar yok, hiç sorun yok.
  const basarili = sorunlar.length === 0 && eslesenIl === BEKLENEN_IL && sayim.toplam === BEKLENEN_ILCE && sayim.ayni + sayim.adFarkli === BEKLENEN_ILCE
    && sayim.ayni + sayim.adFarkli + sayim.ad + sayim.yok === sayim.toplam;
  return { basarili, kapsam: { il: v1Iller.length, ilce: v1Toplam }, oneri, ilAdlari, adFarklari, butunluk: butunlukOzeti(oneri), sorunlar, sayim, istek: istemci.toplamIstek };
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
  let r, kotaOnce, kotaSonra;
  try {
    // Önce kalan günlük hak: en temkinli grup ilçe isteği + pay için yetmiyorsa ya da bilinmiyorsa hiç başlama.
    kotaOnce = await istemci.getir("kota", {});
    const izin = izinVerilen(kotaOnce);
    if (izin < ILCE_ISTEGI + 1) { console.error(`DURDU: kalan günlük hak yetersiz/bilinmiyor (izin ${izin}, gereken ${ILCE_ISTEGI + 1}); eşleme başlatılmadı.`); return 5; }
    r = await esle({ istemci, sozlesme });
    kotaSonra = await istemci.getir("kota", {});
  } catch (e) { console.error(`DURDU: ${e.kod ?? "HATA"}: ${istemci.maskele(e.message)} (istek ${istemci.toplamIstek})`); return 1; }
  let commit = env.GITHUB_SHA ?? null;
  if (!commit) { try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {} }
  const kaynak = { commit, runId: env.GITHUB_RUN_ID ?? "yerel", ref: env.GITHUB_REF ?? null };
  const kota = { onceEnAzKalan: enAzKalan(kotaOnce), sonraEnAzKalan: enAzKalan(kotaSonra) };
  const metin = istemci.maskele(JSON.stringify({ tarih: simdi.toISOString(), kaynak, kota, ...r, istek: istemci.toplamIstek }, null, 1));
  if (istemci.gizliIcerir(metin)) { console.error("Rapor gizli değer içeriyor; yazılmadı."); return 3; }
  await fs.mkdir(klasor, { recursive: true });
  await fs.writeFile(dosya, metin + "\n", { flag: "wx" });
  console.log("ESLESME_OZET " + JSON.stringify({ basarili: r.basarili, kapsam: r.kapsam, sayim: r.sayim, butunluk: r.butunluk, kaynak, kota, istek: istemci.toplamIstek, sorunlar: r.sorunlar.slice(0, 50), adFarklari: r.adFarklari }));
  // Artifact indirilemeyen ortamlar için raporun tamamı tek satır (gizli bilgi içermediği yukarıda denetlendi).
  console.log("ESLESME_RAPOR " + JSON.stringify(JSON.parse(metin)));
  // Ad uygulaması için tam liste (gizli bilgi içermez): v1 kimliği → resmi ad.
  console.log("ESLESME_ADLAR " + JSON.stringify({ iller: r.ilAdlari, ilceler: Object.fromEntries(Object.entries(r.oneri).filter(([, o]) => o.resmiAd).map(([id, o]) => [id, o.resmiAd])) }));
  return r.basarili ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await cli();
