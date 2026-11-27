// DateRange kontrollü testi (onay bekliyor). Kesin 5 istek: giriş 1 + Quota/My 2 + DateRange 2. Tekrar yok.
// Amaç: azami aralık, kesintisiz kapsam, yıl geçişi ve yayındaki (ayna = Monthly ile birebir, pilot D08) verilerle eşitlik.
// Yıllık kapsam ÖNCEDEN kabul edilmez: dönen gerçek kapsam raporlanır. Yayına/tabloya yazmaz.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AwqatIstemci, vakitDonustur } from "./awqat-adaptor.mjs";
import { izinVerilen, enAzKalan } from "./kota.mjs";
import { gunEkle, isoTarih } from "../v1-dogrulama.mjs";

export const DR_ISTEK = 5;
export const DR_ILCELER = [9541, 9206]; // pilotla doğrulanmış kimlikler; yayında karşılaştırma dosyası var
export const DR_GUN = 365;               // istenen aralık; yıl geçişini (31.12 → 01.01) içerir

export function kapsamAnalizi(gunler, bas, bit) {
  const tarihler = gunler.map((g) => isoTarih(g.t));
  const set = new Set(tarihler);
  const beklenen = []; for (let d = bas; d <= bit; d = gunEkle(d, 1)) beklenen.push(d);
  const eksik = beklenen.filter((d) => !set.has(d));
  const sirali = [...tarihler].sort();
  const yilGecisi = beklenen.some((d) => d.endsWith("-12-31")) ? set.has(beklenen.find((d) => d.endsWith("-12-31"))) && set.has(gunEkle(beklenen.find((d) => d.endsWith("-12-31")), 1)) : null;
  return { istenen: beklenen.length, donen: gunler.length, ilk: sirali[0] ?? null, son: sirali.at(-1) ?? null, tekrar: tarihler.length - set.size,
    kesintisiz: eksik.length === 0 && tarihler.length === set.size, eksikIlk: eksik.slice(0, 5), eksikSayi: eksik.length, yilGecisi, araliktaDisi: tarihler.filter((d) => d < bas || d > bit).length };
}

export async function drTest({ istemci, sozlesme, bugun, v1 = "docs/v1" }) {
  const bas = bugun, bit = gunEkle(bugun, DR_GUN - 1);
  const r = { bugun, aralik: { bas, bit }, ilceler: {}, kriterler: {}, durdu: null };
  for (const id of DR_ILCELER) {
    const govde = { cityId: id, startDate: `${bas}T00:00:00`, endDate: `${bit}T00:00:00` };
    let ham;
    try { ham = await istemci.getir("aralik", {}, govde); } catch (e) { r.durdu = `aralik-${id}`; r.hata = `${e.kod ?? "HATA"}: ${e.message}`; break; }
    const alanlar = [sozlesme.vakit.tarih, ...sozlesme.vakit.alanlar];
    const k = { eksikAlan: [...new Set((Array.isArray(ham) ? ham : []).flatMap((g) => alanlar.filter((a) => !(a in (g ?? {})))))] };
    try {
      const gunler = (ham ?? []).map((g) => vakitDonustur(g, sozlesme));
      Object.assign(k, kapsamAnalizi(gunler, bas, bit));
      const yayin = JSON.parse(await fs.readFile(path.join(v1, "vakitler", id + ".json"), "utf8")).gunler;
      const m = new Map(gunler.map((g) => [g.t, g.v.join(" ")]));
      const ortak = yayin.filter((g) => m.has(g.t));
      k.esitlik = { ortakGun: ortak.length, fark: ortak.filter((g) => m.get(g.t) !== g.v.join(" ")).map((g) => g.t).slice(0, 10) };
    } catch (e) { k.dogrulamaHatasi = e.message; }
    r.ilceler[id] = k;
    // İlk şema/doğrulama hatasında dur: ikinci ilçe için kota harcanmaz.
    if (k.eksikAlan.length || k.dogrulamaHatasi) { r.durdu = `dogrulama-${id}`; r.hata = k.dogrulamaHatasi ?? `eksik alan: ${k.eksikAlan.join(",")}`; break; }
  }
  const ik = Object.values(r.ilceler);
  r.kriterler = {
    D1_sema: ik.length === 2 && ik.every((k) => k.eksikAlan.length === 0 && !k.dogrulamaHatasi),
    D2_kesintisiz: ik.length === 2 && ik.every((k) => k.kesintisiz && k.araliktaDisi === 0),
    D3_yilGecisi: ik.length === 2 && ik.every((k) => k.yilGecisi === true),
    D4_esitlik: ik.length === 2 && ik.every((k) => k.esitlik?.ortakGun >= 7 && k.esitlik.fark.length === 0),
    D5_istek: istemci.toplamIstek <= DR_ISTEK,
  };
  r.sonuc = r.durdu ? "DURDU" : Object.values(r.kriterler).every(Boolean) ? "GECTI" : "KALDI";
  return r;
}

export async function cli(env = process.env, { simdi = new Date() } = {}) {
  if (env.ALLOW_LIVE_API !== "evet") { console.error("Canlı API kapalı: ALLOW_LIVE_API=evet gerekir."); return 2; }
  const bugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(simdi);
  const klasor = env.GOLGE_DIR ?? "golge", dosya = path.join(klasor, `daterange-${bugun}.json`);
  try { await fs.access(dosya); console.error(`Bugünün DateRange raporu zaten var (${dosya}); istek gönderilmedi.`); return 4; } catch {}
  if (!env.AWQAT_EMAIL || !env.AWQAT_PASSWORD) { console.error("AWQAT_EMAIL ve AWQAT_PASSWORD gerekli; istek gönderilmedi."); return 2; }
  const sozlesme = JSON.parse(await fs.readFile("config/awqat-sozlesme.json", "utf8"));
  if (env.AWQAT_BASE_URL) sozlesme.baseUrl = env.AWQAT_BASE_URL;
  const istemci = new AwqatIstemci({ sozlesme, email: env.AWQAT_EMAIL, sifre: env.AWQAT_PASSWORD, toplamIstekSiniri: DR_ISTEK, tekrarYok: true });
  let r, once, sonra;
  try {
    once = await istemci.getir("kota", {});
    // Fail-closed: kalan hak bilinmiyorsa (izin 0) ya da 2 DateRange + 1 son okuma için yetmiyorsa dur.
    if (izinVerilen(once) < 3) { console.error("DURDU: kalan günlük hak yetersiz/bilinmiyor; DateRange isteği gönderilmedi."); return 5; }
    r = await drTest({ istemci, sozlesme, bugun });
    sonra = await istemci.getir("kota", {});
  } catch (e) { console.error(`DURDU: ${e.kod ?? "HATA"}: ${istemci.maskele(e.message)}`); return 1; }
  r.kota = { onceEnAzKalan: enAzKalan(once), sonraEnAzKalan: enAzKalan(sonra) };
  r.kaynak = { commit: env.GITHUB_SHA ?? null, runId: env.GITHUB_RUN_ID ?? "yerel" };
  r.istek = istemci.toplamIstek;
  const metin = istemci.maskele(JSON.stringify(r, null, 1));
  if (istemci.gizliIcerir(metin)) { console.error("Rapor gizli değer içeriyor; yazılmadı."); return 3; }
  await fs.mkdir(klasor, { recursive: true });
  await fs.writeFile(dosya, metin + "\n", { flag: "wx" });
  console.log("DATERANGE_OZET " + JSON.stringify({ sonuc: r.sonuc, kriterler: r.kriterler, istek: r.istek, ilceler: r.ilceler, kota: r.kota, durdu: r.durdu, hata: r.hata ?? null }));
  return r.sonuc === "GECTI" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await cli();
