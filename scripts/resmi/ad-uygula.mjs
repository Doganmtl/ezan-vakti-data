// Yayındaki il/ilçe adlarını Diyanet resmi adlarına çevirir (kullanıcı kararı 27.11.2026). Ağ yok.
// Kaynak: doğrulanmış eşleme raporu (eslesme-uygula ile aynı doğrulamalar). Yalnız ad alanı değişir;
// kimlikler, dosya listesi ve sıralama değişmez (kayıtlı konumlar korunur).
//   node scripts/resmi/ad-uygula.mjs <oneri.json> <run-id>
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { raporDogrula } from "./eslesme-uygula.mjs";
import { buyuk } from "./eslesme-il.mjs";

const gecerliAd = (s) => typeof s === "string" && s.trim().length > 0 && s.trim().length <= 60 && !/[<>{}\u0000-\u001f]/.test(s);

/** Saf: listeleri yeni adlarla döndürür, değişiklik listesini verir. */
export function adlariUygula({ iller, ilceler }, rapor) {
  const degisen = [];
  const yeniIller = iller.map((il) => {
    // Kullanıcı kararı (8. tur): resmi ad Türkçe büyük harf biçiminde uygulanır (ham biçim raporda kalır).
    const r = gecerliAd(rapor.ilAdlari?.[il.id]) ? buyuk(rapor.ilAdlari[il.id]) : null;
    if (r && r !== il.ad) { degisen.push({ tur: "il", id: il.id, eski: il.ad, yeni: r }); return { ...il, ad: r }; }
    return il;
  });
  const yeniIlceler = {};
  for (const [ilId, liste] of Object.entries(ilceler)) {
    yeniIlceler[ilId] = liste.map((x) => {
      const o = rapor.oneri?.[x.id];
      if (o && o.resmi === x.id && ["ayni-kimlik-ve-ad", "ayni-kimlik-ad-farkli"].includes(o.yontem) && gecerliAd(o.resmiAd) && buyuk(o.resmiAd) !== x.ad) {
        degisen.push({ tur: "ilce", id: x.id, eski: x.ad, yeni: buyuk(o.resmiAd) });
        return { ...x, ad: buyuk(o.resmiAd) };
      }
      return x;
    });
  }
  return { iller: yeniIller, ilceler: yeniIlceler, degisen };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [dosya, run] = process.argv.slice(2);
  if (!dosya || !run) { console.error("kullanım: ad-uygula.mjs <oneri.json> <run-id>"); process.exit(2); }
  const rapor = JSON.parse(await fs.readFile(dosya, "utf8"));
  const tablo = JSON.parse(await fs.readFile("eslesme/ilce-kimlikleri.json", "utf8"));
  const atasi = (sha) => { try { execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"]); return true; } catch { return false; } };
  const sorun = raporDogrula(rapor, tablo, { runId: run, commitAtasiMi: atasi });
  if (sorun.length) { console.error("Rapor reddedildi:\n- " + sorun.join("\n- ")); process.exit(1); }
  const iller = JSON.parse(await fs.readFile("docs/v1/iller.json", "utf8"));
  const ilceler = {};
  for (const il of iller) ilceler[il.id] = JSON.parse(await fs.readFile(`docs/v1/ilceler/${il.id}.json`, "utf8"));
  const r = adlariUygula({ iller, ilceler }, rapor);
  const { yazToplu } = await import("../atomik-yaz.mjs");
  await yazToplu([["docs/v1/iller.json", r.iller], ...Object.entries(r.ilceler).map(([ilId, l]) => [`docs/v1/ilceler/${ilId}.json`, l])]);
  console.log(JSON.stringify({ degisenSayisi: r.degisen.length, degisen: r.degisen }, null, 1));
}
