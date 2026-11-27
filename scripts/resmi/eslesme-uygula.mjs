// Eşleme önerisini (eslesme-esle.mjs çıktısı) tabloya işler. Ağ yok.
// Önce raporu doğrular: başarı, kapsam (81 il / 869 ilçe = tablo), bütünlük özeti, run kimliği ve kaynak commit.
// Yalnız AYNI KİMLİK eşleşmeleri işlenir (ad aynı ya da yalnız yazımı farklı); farklı kimlik (yontem "ad") ve eşleşmeyenler ASLA uygulanmaz.
//   node scripts/resmi/eslesme-uygula.mjs <oneri.json> <run-id>
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { butunlukOzeti, BEKLENEN_IL, BEKLENEN_ILCE } from "./eslesme-esle.mjs";

/** Raporu doğrular; sorun listesi döner (boşsa geçerli). commitAtasiMi: (sha) => boolean */
export function raporDogrula(rapor, tablo, { runId, commitAtasiMi = () => true }) {
  const s = [];
  if (rapor?.basarili !== true) s.push("rapor başarılı değil");
  if (rapor?.kapsam?.il !== BEKLENEN_IL || rapor?.kapsam?.ilce !== BEKLENEN_ILCE) s.push("kapsam 81 il / 869 ilçe değil");
  const tabloIds = Object.keys(tablo.ilceler ?? {}), oneriIds = Object.keys(rapor?.oneri ?? {});
  if (oneriIds.length !== BEKLENEN_ILCE || tabloIds.length !== BEKLENEN_ILCE) s.push("öneri/tablo ilçe sayısı 869 değil");
  if (oneriIds.some((id) => !tablo.ilceler?.[id]) || tabloIds.some((id) => !rapor?.oneri?.[id])) s.push("öneri ile tablo kimlik kümesi farklı");
  if (!rapor?.oneri || butunlukOzeti(rapor.oneri) !== rapor.butunluk) s.push("bütünlük özeti tutmuyor");
  if (!runId || String(rapor?.kaynak?.runId) !== String(runId)) s.push("run kimliği eşleşmiyor");
  if (!/^[0-9a-f]{40}$/.test(rapor?.kaynak?.commit ?? "") || !commitAtasiMi(rapor.kaynak.commit)) s.push("kaynak commit bu dalın geçmişinde değil");
  return s;
}

export function uygula(tablo, oneri, { tarih, kaynak }) {
  const sonuc = { islenen: 0, atlanan: [], zatenVar: 0 };
  for (const [id, o] of Object.entries(oneri)) {
    const k = tablo.ilceler[id];
    if (!k) { sonuc.atlanan.push({ id: Number(id), sebep: "tabloda yok" }); continue; }
    if (k.resmi !== null) { if (k.resmi === o.resmi) sonuc.zatenVar++; else sonuc.atlanan.push({ id: Number(id), sebep: "mevcut kayıtla çelişiyor" }); continue; }
    if (!["ayni-kimlik-ve-ad", "ayni-kimlik-ad-farkli"].includes(o.yontem) || o.resmi !== Number(id)) { sonuc.atlanan.push({ id: Number(id), sebep: o.yontem ?? "eşleşmedi" }); continue; }
    k.resmi = o.resmi; k.dogrulama = { tarih, yontem: o.yontem === "ayni-kimlik-ve-ad" ? "Place/Cities aynı kimlik ve ad" : "Place/Cities aynı kimlik, resmi ad farklı", kaynak, resmiIl: o.resmiIl };
    if (o.resmiAd) k.resmiAd = o.resmiAd;
    sonuc.islenen++;
  }
  return sonuc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [dosya, run] = process.argv.slice(2);
  if (!dosya || !run) { console.error("kullanım: eslesme-uygula.mjs <oneri.json> <run-id>"); process.exit(2); }
  const r = JSON.parse(await fs.readFile(dosya, "utf8"));
  const tabloYolu = "eslesme/ilce-kimlikleri.json", tablo = JSON.parse(await fs.readFile(tabloYolu, "utf8"));
  const atasi = (sha) => { try { execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"]); return true; } catch { return false; } };
  const sorun = raporDogrula(r, tablo, { runId: run, commitAtasiMi: atasi });
  if (sorun.length) { console.error("Rapor reddedildi:\n- " + sorun.join("\n- ")); process.exit(1); }
  const s = uygula(tablo, r.oneri, { tarih: String(r.tarih).slice(0, 10), kaynak: `Awqat run ${run} @ ${r.kaynak.commit.slice(0, 7)}` });
  await fs.writeFile(tabloYolu, JSON.stringify(tablo, null, 1) + "\n");
  console.log(JSON.stringify(s));
}
