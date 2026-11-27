// Eşleme önerisini (eslesme-esle.mjs çıktısı) tabloya işler. Ağ yok.
// Yalnız "aynı kimlik ve aynı ad" eşleşmeleri otomatik işlenir; farklı kimlikler (yontem "ad") ve eşleşmeyenler
// dokunulmadan raporlanır (elle inceleme + kullanıcı onayı). Var olan doğrulanmış kayıt değiştirilmez.
//   node scripts/resmi/eslesme-uygula.mjs <oneri.json> <kaynak-run-id>
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function uygula(tablo, oneri, { tarih, kaynak }) {
  const sonuc = { islenen: 0, atlanan: [], zatenVar: 0 };
  for (const [id, o] of Object.entries(oneri)) {
    const k = tablo.ilceler[id];
    if (!k) { sonuc.atlanan.push({ id: Number(id), sebep: "tabloda yok" }); continue; }
    if (k.resmi !== null) { if (k.resmi === o.resmi) sonuc.zatenVar++; else sonuc.atlanan.push({ id: Number(id), sebep: "mevcut kayıtla çelişiyor" }); continue; }
    if (o.yontem !== "ayni-kimlik-ve-ad" || o.resmi !== Number(id)) { sonuc.atlanan.push({ id: Number(id), sebep: o.yontem ?? "eşleşmedi" }); continue; }
    k.resmi = o.resmi; k.dogrulama = { tarih, yontem: "Place/Cities aynı kimlik ve ad", kaynak, resmiIl: o.resmiIl };
    sonuc.islenen++;
  }
  return sonuc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [dosya, run] = process.argv.slice(2);
  if (!dosya || !run) { console.error("kullanım: eslesme-uygula.mjs <oneri.json> <run-id>"); process.exit(2); }
  const r = JSON.parse(await fs.readFile(dosya, "utf8"));
  const tabloYolu = "eslesme/ilce-kimlikleri.json", tablo = JSON.parse(await fs.readFile(tabloYolu, "utf8"));
  const s = uygula(tablo, r.oneri, { tarih: String(r.tarih).slice(0, 10), kaynak: `Awqat run ${run}` });
  await fs.writeFile(tabloYolu, JSON.stringify(tablo, null, 1) + "\n");
  console.log(JSON.stringify(s));
}
