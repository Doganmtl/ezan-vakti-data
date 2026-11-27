// docs/v1 kimliklerinden resmi API eşleme tablosunu üretir/tamamlar.
// Var olan kayıtları DEĞİŞTİRMEZ; yalnız eksik v1 kimliklerini resmi=null (doğrulanmadı) olarak ekler.
// Kullanım: node scripts/eslesme-olustur.mjs [docs/v1] [eslesme/ilce-kimlikleri.json]
import fs from "node:fs/promises";
import path from "node:path";
const OUT = process.argv[2] ?? "docs/v1", TABLO = process.argv[3] ?? "eslesme/ilce-kimlikleri.json";
let t; try { t = JSON.parse(await fs.readFile(TABLO, "utf8")); } catch { t = { surum: 1, ilceler: {} }; }
t.aciklama = "v1 ilçe kimliği → kaynak kimlikleri. v1 kimliği asla değişmez (kayıtlı konumlar). resmi=null: Awqat Salah cityId gölge karşılaştırma ile doğrulanmadı.";
const iller = JSON.parse(await fs.readFile(path.join(OUT, "iller.json"), "utf8"));
let eklenen = 0;
for (const il of iller) for (const x of JSON.parse(await fs.readFile(path.join(OUT, "ilceler", il.id + ".json"), "utf8"))) {
  if (t.ilceler[x.id]) continue;
  t.ilceler[x.id] = { ilId: il.id, ad: x.ad, emushaf: x.id, resmi: null, dogrulama: null }; eklenen++;
}
t.ilceler = Object.fromEntries(Object.entries(t.ilceler).sort((a, b) => a[0] - b[0]));
await fs.writeFile(TABLO, JSON.stringify({ surum: 1, aciklama: t.aciklama, ilceler: t.ilceler }, null, 1) + "\n");
console.log(`${Object.keys(t.ilceler).length} kayıt, ${eklenen} eklendi.`);
