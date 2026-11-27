// Tam eşlemeyi tamamlar (8. tur): run 45995729583'ün 868 kaydı + tek il (Afyonkarahisar/Şuhut) raporu.
// Ağ yok. 85 istekli tam eşleme TEKRARLANMAZ; önceki kayıtlar v1 listelerinden yeniden kurulur ve
// run'ın log'a bastığı bütünlük özetiyle BİREBİR eşleşmesi zorunludur. Kanıt dosyaları eslesme/kanit/ altında.
//   node scripts/resmi/eslesme-tamamla.mjs eslesme/kanit/run-45995729583.json eslesme/kanit/run-<il-run>.json [--uygula]
// --uygula olmadan yalnız doğrular ve özet basar (kuru çalışma).
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { BEKLENEN_IL, BEKLENEN_ILCE } from "./eslesme-esle.mjs";
import { ilButunluk, buyuk } from "./eslesme-il.mjs";

const SHA = /^[0-9a-f]{40}$/;

/** Run 45995729583'ün (commit 40dea4f) kullandığı bütünlük formülü — sabitlenmiş kopya: [k, resmi, yontem, resmiIl]. */
export function surum1Butunluk(oneri) {
  const sirali = Object.keys(oneri).sort((a, b) => a - b).map((k) => [k, oneri[k].resmi, oneri[k].yontem, oneri[k].resmiIl]);
  return createHash("sha256").update(JSON.stringify(sirali)).digest("hex");
}

/** Bir canlı run kanıtının meta verisini doğrular (GitHub REST'ten alınmış alanlar). */
export function runKanitDogrula(k, { kaynakCommit, runId }) {
  const s = [], r = k?.run ?? {};
  if (String(r.id) !== String(runId)) s.push("run kimliği eşleşmiyor");
  if (r.conclusion !== "success" || r.status !== "completed") s.push("run başarıyla tamamlanmamış");
  if (r.event !== "push" || !/^pilot\//.test(r.head_branch ?? "")) s.push("run pilot/* dalına push ile tetiklenmemiş");
  if (r.run_attempt !== 1) s.push("run yeniden denenmiş (run_attempt ≠ 1)");
  if (r.environment !== "awqat-test") s.push("run awqat-test Environment'ında değil");
  if (!(r.onaylar ?? []).some((o) => o.state === "approved" && (o.environments ?? []).includes("awqat-test"))) s.push("awqat-test onayı kaydı yok");
  if (!SHA.test(r.head_sha ?? "") || r.head_sha !== kaynakCommit) s.push("run commit'i rapordaki kaynak commit ile aynı değil");
  return s;
}

/**
 * Önceki tam eşleme önerisini (eski biçim: [k, resmi, yontem, resmiIl]) v1 listelerinden yeniden kurar.
 * ozet: run'ın ESLESME_OZET satırı. Yalnız "eslesmedi" sorunları kabul edilir; başka her sorun reddedilir.
 */
export function oncekiYenidenKur({ iller, ilceler, ozet }) {
  const s = [];
  const eslesmeyen = new Set();
  for (const x of ozet?.sorunlar ?? []) { if (x.tur === "eslesmedi" && Number.isSafeInteger(x.id)) eslesmeyen.add(x.id); else s.push("önceki raporda kabul edilmeyen sorun: " + (x.tur ?? "?")); }
  if ((ozet?.sorunlar?.length ?? 0) >= 50) s.push("önceki sorun listesi kesilmiş olabilir (≥ 50)");
  const oneri = {};
  for (const il of iller) for (const x of ilceler[il.id] ?? [])
    oneri[x.id] = eslesmeyen.has(x.id) ? { resmi: null, yontem: null, resmiIl: il.id } : { resmi: x.id, yontem: "ayni-kimlik-ve-ad", resmiIl: il.id };
  const ayni = Object.values(oneri).filter((o) => o.yontem).length;
  if (iller.length !== BEKLENEN_IL || Object.keys(oneri).length !== BEKLENEN_ILCE) s.push("v1 kapsamı 81 il / 869 ilçe değil");
  if (ozet?.sayim?.il !== BEKLENEN_IL || ozet?.sayim?.toplam !== BEKLENEN_ILCE || ozet?.sayim?.ayni !== ayni || ozet?.sayim?.yok !== eslesmeyen.size || ozet?.sayim?.ad !== 0)
    s.push("önceki sayım yeniden kurulan kümeyle tutarsız");
  const hesap = surum1Butunluk(oneri);
  if (hesap !== ozet?.butunluk) s.push(`bütünlük özeti tutmuyor (hesap ${hesap.slice(0, 12)}…, run ${String(ozet?.butunluk).slice(0, 12)}…)`);
  return { sorunlar: s, oneri, butunluk: hesap, eslesmeyen: [...eslesmeyen] };
}

/** Tek il raporunu doğrular (eslesme-il.mjs çıktısı). */
export function ilRaporDogrula(rapor, { v1Liste, runId }) {
  const s = [];
  if (String(rapor?.kaynak?.runId) !== String(runId)) s.push("il raporu run kimliği eşleşmiyor");
  if (!rapor?.kayitlar || ilButunluk(rapor.kayitlar) !== rapor.butunluk) s.push("il raporu bütünlük özeti tutmuyor");
  if (rapor?.istek > 4) s.push("il raporu 4 istek bütçesini aşmış");
  const ids = Object.keys(rapor?.kayitlar ?? {}).map(Number).sort((a, b) => a - b);
  const v1 = v1Liste.map((x) => x.id).sort((a, b) => a - b);
  if (JSON.stringify(ids) !== JSON.stringify(v1)) s.push("il raporu kimlik kümesi v1 il listesinden farklı");
  return s;
}

/** Birleşik kümenin bütünlük özeti (ham ad ve kaynak run'ları dahil). */
export function birlesikButunluk(k) {
  const sirali = Object.keys(k).sort((a, b) => a - b).map((id) => [id, k[id].resmi, k[id].yontem, k[id].resmiIl, k[id].resmiAd ?? null, k[id].resmiAdHam ?? null, k[id].kaynaklar]);
  return createHash("sha256").update(JSON.stringify(sirali)).digest("hex");
}

/**
 * 868 önceki + tek il kayıtlarını birleştirir. Çakışma (aynı ilçe için farklı resmi kimlik) → sorun, uygulanmaz.
 * Önceki kayıtların ham resmi adı saklanmamıştı: resmiAd = v1 adı (Türkçe büyük harf eşitliği run tarafından doğrulandı), resmiAdHam = null.
 */
export function birlestir({ onceki, oncekiRun, il, ilRun, v1Adlar }) {
  const s = [], k = {};
  for (const [id, o] of Object.entries(onceki)) k[id] = o.yontem ? { resmi: o.resmi, yontem: o.yontem, resmiIl: o.resmiIl, resmiAd: buyuk(v1Adlar[id]), resmiAdHam: null, kaynaklar: [String(oncekiRun)] }
    : { resmi: null, yontem: null, resmiIl: o.resmiIl, kaynaklar: [] };
  for (const [id, y] of Object.entries(il.kayitlar)) {
    const e = k[id];
    if (!e) { s.push("il raporunda bilinmeyen ilçe: " + id); continue; }
    if (e.resmiIl !== y.resmiIl) s.push(`il kimliği çelişiyor: ${id}`);
    if (e.resmi !== null && y.resmi !== e.resmi) { s.push(`önceki eşleme yeniden doğrulanamadı: ${id} (önce ${e.resmi}, şimdi ${y.resmi})`); continue; }
    if (y.yontem === "ad") { s.push(`farklı kimlik — otomatik uygulanmaz: ${id} → ${y.resmi}`); continue; }
    if (!y.yontem) { if (e.resmi !== null) s.push(`önceki eşleme yeni listede yok: ${id}`); continue; }
    k[id] = { resmi: y.resmi, yontem: y.yontem, resmiIl: y.resmiIl, resmiAd: buyuk(y.resmiAdHam), resmiAdHam: y.resmiAdHam,
      kaynaklar: e.resmi !== null ? [...e.kaynaklar, String(ilRun)] : [String(ilRun)] };
  }
  const gorulen = new Map();
  for (const [id, x] of Object.entries(k)) if (x.resmi !== null) { if (gorulen.has(x.resmi)) s.push(`tekrarlanan resmi kimlik ${x.resmi}`); gorulen.set(x.resmi, id); }
  const eslesen = Object.entries(k).filter(([id, x]) => x.resmi === Number(id)).length;
  const eksik = Object.entries(k).filter(([, x]) => x.resmi === null).map(([id]) => Number(id));
  return { sorunlar: s, kayitlar: k, eslesen, eksik, tam: s.length === 0 && eksik.length === 0 && Object.keys(k).length === BEKLENEN_ILCE && eslesen === BEKLENEN_ILCE, butunluk: birlesikButunluk(k) };
}

/** Tabloya işler (yalnız aynı kimlik). Mevcut farklı bir resmi kimlik ASLA ezilmez. */
export function tabloyaIsle(tablo, kayitlar, { tarih }) {
  const r = { islenen: 0, zatenVar: 0, atlanan: [] };
  for (const [id, x] of Object.entries(kayitlar)) {
    const t = tablo.ilceler[id];
    if (!t || x.resmi !== Number(id) || !["ayni-kimlik-ve-ad", "ayni-kimlik-ad-farkli"].includes(x.yontem)) { r.atlanan.push(Number(id)); continue; }
    if (t.resmi !== null && t.resmi !== x.resmi) { r.atlanan.push(Number(id)); continue; }
    if (t.resmi === x.resmi) r.zatenVar++; else r.islenen++;
    t.resmi = x.resmi;
    t.resmiAd = x.resmiAd;
    if (x.resmiAdHam) t.resmiAdHam = x.resmiAdHam;
    t.dogrulama = { tarih, yontem: x.yontem === "ayni-kimlik-ve-ad" ? "Place/Cities aynı kimlik ve ad" : "Place/Cities aynı kimlik, resmi ad farklı",
      kaynak: x.kaynaklar.map((run) => `Awqat run ${run}`).join(" + "), resmiIl: x.resmiIl };
  }
  return r;
}

/** v1 listelerindeki adları tablodaki resmi adlara çevirir (yalnız gerçekten farklı olanlar; kimlik ve sıra değişmez). */
export function v1AdlariniGuncelle(ilceler, tablo) {
  const degisen = [], yeni = {};
  for (const [ilId, liste] of Object.entries(ilceler)) yeni[ilId] = liste.map((x) => {
    const r = tablo.ilceler[x.id]?.resmiAd;
    if (typeof r === "string" && r && r !== x.ad) { degisen.push({ id: x.id, eski: x.ad, yeni: r }); return { ...x, ad: r }; }
    return x;
  });
  return { ilceler: yeni, degisen };
}

async function v1Oku(rev) {
  const oku = (p) => rev ? JSON.parse(execFileSync("git", ["show", `${rev}:${p}`], { encoding: "utf8", maxBuffer: 1 << 26 })) : fs.readFile(p, "utf8").then(JSON.parse);
  const iller = await oku("docs/v1/iller.json"), ilceler = {};
  for (const il of iller) ilceler[il.id] = await oku(`docs/v1/ilceler/${il.id}.json`);
  return { iller, ilceler };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [oncekiYol, ilYol, bayrak] = process.argv.slice(2);
  if (!oncekiYol || !ilYol) { console.error("kullanım: eslesme-tamamla.mjs <onceki-kanit.json> <il-kanit.json> [--uygula]"); process.exit(2); }
  const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
  const atasi = (sha) => { try { git("merge-base", "--is-ancestor", sha, "HEAD"); return true; } catch { return false; } };
  const kanitA = JSON.parse(await fs.readFile(oncekiYol, "utf8")), kanitB = JSON.parse(await fs.readFile(ilYol, "utf8"));
  const sorun = [];
  // A: önceki tam eşleme run'ı
  const ozet = kanitA.ozet, cA = ozet?.kaynak?.commit;
  sorun.push(...runKanitDogrula(kanitA, { kaynakCommit: cA, runId: ozet?.kaynak?.runId }).map((x) => "önceki: " + x));
  // Kaynak commit tek seferlik workflow commit'idir: ebeveyni bu dalın atası olmalı ve yalnız workflow/test eklemiş olmalı.
  let degisen = [];
  try { degisen = git("diff", "--name-only", `${cA}^`, cA).split("\n").filter(Boolean); } catch { sorun.push("önceki: kaynak commit okunamadı"); }
  if (!atasi(`${cA}^`)) sorun.push("önceki: kaynak commit ebeveyni bu dalın geçmişinde değil");
  if (degisen.some((f) => !/^(\.github\/workflows\/|test\/)/.test(f))) sorun.push("önceki: kaynak commit workflow/test dışında dosya değiştirmiş");
  const eski = await v1Oku(cA), simdi = await v1Oku(null);
  if (JSON.stringify(eski.iller.map((x) => x.id)) !== JSON.stringify(simdi.iller.map((x) => x.id))) sorun.push("il kimlik listesi değişmiş");
  for (const il of eski.iller) if (JSON.stringify(eski.ilceler[il.id].map((x) => x.id)) !== JSON.stringify((simdi.ilceler[il.id] ?? []).map((x) => x.id))) sorun.push("ilçe kimlik listesi değişmiş: il " + il.id);
  const yk = oncekiYenidenKur({ ...eski, ozet });
  sorun.push(...yk.sorunlar.map((x) => "önceki: " + x));
  // B: tek il run'ı
  const rB = kanitB.rapor;
  sorun.push(...runKanitDogrula(kanitB, { kaynakCommit: rB?.kaynak?.commit, runId: rB?.kaynak?.runId }).map((x) => "il: " + x));
  if (rB?.kaynak?.commit && !atasi(`${rB.kaynak.commit}^`)) sorun.push("il: kaynak commit ebeveyni bu dalın geçmişinde değil");
  sorun.push(...ilRaporDogrula(rB, { v1Liste: simdi.ilceler[rB?.il] ?? [], runId: rB?.kaynak?.runId }));
  if (sorun.length) { console.error("REDDEDİLDİ:\n- " + sorun.join("\n- ")); process.exit(1); }
  const v1Adlar = Object.fromEntries(Object.values(simdi.ilceler).flat().map((x) => [x.id, x.ad]));
  const b = birlestir({ onceki: yk.oneri, oncekiRun: ozet.kaynak.runId, il: rB, ilRun: rB.kaynak.runId, v1Adlar });
  const ozetSatir = { tam: b.tam, eslesen: b.eslesen, eksik: b.eksik, sorunlar: b.sorunlar, butunluk: b.butunluk, oncekiButunluk: yk.butunluk, ilSorunlari: rB.sorunlar };
  console.log(JSON.stringify(ozetSatir, null, 1));
  if (!b.tam) { console.error("Tam eşleme sağlanamadı; hiçbir dosya değiştirilmedi."); process.exit(1); }
  if (bayrak !== "--uygula") { console.log("Kuru çalışma: dosya değiştirilmedi (--uygula ile işlenir)."); process.exit(0); }
  const tabloYolu = "eslesme/ilce-kimlikleri.json", tablo = JSON.parse(await fs.readFile(tabloYolu, "utf8"));
  const tarih = String(rB.tarih).slice(0, 10);
  const t = tabloyaIsle(tablo, b.kayitlar, { tarih });
  if (t.atlanan.length || t.islenen + t.zatenVar !== BEKLENEN_ILCE) { console.error("Tabloya işleme eksik: " + JSON.stringify(t)); process.exit(1); }
  const ad = v1AdlariniGuncelle(simdi.ilceler, tablo);
  for (const d of ad.degisen) tablo.ilceler[d.id].ad = d.yeni;
  tablo.tamEslesme = { tarih, butunluk: b.butunluk, kaynaklar: [String(ozet.kaynak.runId), String(rB.kaynak.runId)], oncekiButunluk: yk.butunluk, ilRaporButunluk: rB.butunluk };
  const { yazToplu } = await import("../atomik-yaz.mjs");
  const degisenIl = new Set(ad.degisen.map((d) => String(tablo.ilceler[d.id].ilId)));
  await yazToplu([[tabloYolu, tablo, 1], ...Object.entries(ad.ilceler).filter(([ilId]) => degisenIl.has(ilId)).map(([ilId, l]) => [`docs/v1/ilceler/${ilId}.json`, l])]);
  console.log(JSON.stringify({ tablo: t, adDegisen: ad.degisen }));
}
