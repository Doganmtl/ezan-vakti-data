// Gölge veri seti: resmi API'den çekilen vakitleri YAYINA DEĞİL ayrı bir klasöre yazar ve mevcut
// docs/v1 ile gün gün karşılaştırır. Hiçbir workflow'a bağlı değildir.
// Canlı istek yalnız ALLOW_LIVE_API=evet ve AWQAT_EMAIL/AWQAT_PASSWORD ortamda tanımlıyken yapılır
// (kullanıcının ayrı onayı gerekir). Kimlik bilgileri loglanmaz, dosyaya yazılmaz.
//   ALLOW_LIVE_API=evet node scripts/resmi/golge.mjs [ilceId,...]
import fs from "node:fs/promises";
import path from "node:path";
import { AwqatIstemci } from "./awqat-adaptor.mjs";
import { yazToplu } from "../atomik-yaz.mjs";

export function karsilastir(bizim, resmi) {
  const b = new Map((bizim ?? []).map((g) => [g.t, g.v.join(" ")]));
  const fark = [], ortak = [];
  for (const g of resmi) { if (!b.has(g.t)) continue; ortak.push(g.t); if (b.get(g.t) !== g.v.join(" ")) fark.push({ t: g.t, bizim: b.get(g.t), resmi: g.v.join(" ") }); }
  return { ortakGun: ortak.length, fark };
}

export async function golgeCalistir({ istemci, tablo, ilceler, out, v1 = "docs/v1", simdi = () => new Date().toISOString() }) {
  const rapor = { guncelleme: simdi(), ilceler: {}, hatalar: {} }, dosyalar = [];
  for (const id of ilceler) {
    const kayit = tablo.ilceler[id];
    if (!kayit || kayit.resmi === null) { rapor.hatalar[id] = "resmi kimlik eşlemesi yok"; continue; }
    try {
      const gunler = await istemci.aylik(kayit.resmi);
      let bizim = null; try { bizim = JSON.parse(await fs.readFile(path.join(v1, "vakitler", id + ".json"), "utf8")).gunler; } catch {}
      rapor.ilceler[id] = { resmi: kayit.resmi, gun: gunler.length, ...karsilastir(bizim, gunler) };
      dosyalar.push([path.join(out, "vakitler", id + ".json"), { guncelleme: rapor.guncelleme, kaynak: "awqat-golge", gunler }]);
    } catch (e) { rapor.hatalar[id] = `${e.kod ?? "HATA"}: ${e.message}`; if (e.kod === "KOTA" || e.kod === "YETKI" || e.kod === "GIRIS") break; }
  }
  rapor.istekSayilari = istemci.istekSayilari;
  dosyalar.push([path.join(out, "rapor.json"), rapor, 1]);
  await yazToplu(dosyalar);
  return rapor;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.ALLOW_LIVE_API !== "evet") { console.error("Canlı API kapalı: ALLOW_LIVE_API=evet gerekir (kullanıcı onayı)."); process.exit(2); }
  const sozlesme = JSON.parse(await fs.readFile("config/awqat-sozlesme.json", "utf8"));
  const tablo = JSON.parse(await fs.readFile("eslesme/ilce-kimlikleri.json", "utf8"));
  const ilceler = (process.argv[2] ?? "").split(",").filter(Boolean).map(Number);
  if (!ilceler.length) { console.error("İlçe listesi verin (ör. 9541,9206)."); process.exit(2); }
  const istemci = new AwqatIstemci({ sozlesme, email: process.env.AWQAT_EMAIL, sifre: process.env.AWQAT_PASSWORD });
  const rapor = await golgeCalistir({ istemci, tablo, ilceler, out: process.env.GOLGE_DIR ?? "golge" });
  console.log(JSON.stringify({ ilce: Object.keys(rapor.ilceler).length, hata: rapor.hatalar, istek: rapor.istekSayilari }, null, 1));
}
