// Eşleme tablosu tutarlılığı: her v1 ilçesi bir kayda sahip; emushaf/resmi kimlikleri tekil.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
export function eslesmeDogrula(tablo, v1Ilceler) {
  if (tablo?.surum !== 1 || typeof tablo.ilceler !== "object") throw Error("geçersiz eşleme tablosu");
  const res = new Set(), em = new Set();
  for (const [k, x] of Object.entries(tablo.ilceler)) {
    if (!/^\d+$/.test(k) || !Number.isSafeInteger(x.ilId) || !Number.isSafeInteger(x.emushaf)) throw Error("geçersiz eşleme kaydı: " + k);
    if (em.has(x.emushaf)) throw Error("tekrarlanan emushaf kimliği: " + x.emushaf); em.add(x.emushaf);
    if (x.resmi !== null) {
      if (!Number.isSafeInteger(x.resmi) || x.resmi <= 0) throw Error("geçersiz resmi kimlik: " + k);
      if (res.has(x.resmi)) throw Error("tekrarlanan resmi kimlik: " + x.resmi); res.add(x.resmi);
      if (!x.dogrulama || typeof x.dogrulama.tarih !== "string") throw Error("resmi kimlik doğrulama kaydı yok: " + k);
    }
  }
  for (const id of v1Ilceler) if (!tablo.ilceler[id]) throw Error("eşlemesi olmayan v1 ilçesi: " + id);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const OUT = process.argv[2] ?? "docs/v1";
  const iller = JSON.parse(await fs.readFile(path.join(OUT, "iller.json"), "utf8"));
  const ids = [];
  for (const il of iller) for (const x of JSON.parse(await fs.readFile(path.join(OUT, "ilceler", il.id + ".json"), "utf8"))) ids.push(x.id);
  eslesmeDogrula(JSON.parse(await fs.readFile(process.argv[3] ?? "eslesme/ilce-kimlikleri.json", "utf8")), ids);
  console.log(`Eşleme tablosu geçerli: ${ids.length} ilçe.`);
}
