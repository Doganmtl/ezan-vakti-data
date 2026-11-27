// Data operasyon özeti (9. tur): yayın klasöründen ve günlük defterden okunur; ağ yok, gizli bilgi yok.
// Çıktı: Markdown (GITHUB_STEP_SUMMARY) + tek satır "OPERASYON_OZET <json>" (günlük/haftalık izleme görevleri için).
//   node scripts/resmi/operasyon-raporu.mjs [docs/v1] [defter.json]
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isoTarih } from "../v1-dogrulama.mjs";

const okuJson = async (f) => { try { return JSON.parse(await fs.readFile(f, "utf8")); } catch { return null; } };

export async function ozet({ v1 = "docs/v1", defter = null, tablo = "eslesme/ilce-kimlikleri.json", tavan = 100 } = {}) {
  const meta = await okuJson(path.join(v1, "meta.json")) ?? {};
  const iller = await okuJson(path.join(v1, "iller.json")) ?? [];
  const t = await okuJson(tablo);
  const r = { sonYayin: meta.guncelleme ?? null, kaynakTuru: meta.kaynakTuru ?? null, uc: meta.uc ?? null, ilce: 0, dogrulanmisEsleme: 0, yillik: 0, monthlyDogrulanmis: 0, yillikOlmayan: 0, dosyasiz: 0,
    enYakinBitis: null, enYakinBitisIlce: null, calisma: { basarili: meta.durum?.basarili ?? null, planliBekleyen: meta.durum?.planliBekleyen?.length ?? null,
      basarisiz: ["yedek", "kisaKapsam", "tukenmis", "eksik"].reduce((a, k) => a + (meta.durum?.[k]?.length ?? 0), 0), kullanilamaz: meta.kullanilabilirlik?.turkiyeKullanilamaz ?? null,
      kritikUyari: meta.kullanilabilirlik?.kritikUyari ?? null, dogrulandi: meta.sozlesme2?.dogrulandi?.length ?? 0, duzeltildi: meta.sozlesme2?.duzeltildi?.length ?? 0, yenidenCek: meta.sozlesme2?.yenidenCek ?? [] },
    istek: { calisma: meta.resmiIstek?.calisma ?? null, bugun: null, tavan, kalan: null } };
  if (t?.ilceler) r.dogrulanmisEsleme = Object.values(t.ilceler).filter((x) => x.resmi !== null).length;
  for (const il of iller) for (const x of (await okuJson(path.join(v1, "ilceler", `${il.id}.json`))) ?? []) {
    r.ilce++;
    const d = await okuJson(path.join(v1, "vakitler", `${x.id}.json`));
    if (!d) { r.dosyasiz++; continue; }
    let son;
    if (d.sozlesme === 2 && d.kaynak?.tur === "resmi-yillik") { r.yillik++; if (d.dogrulama?.uc === "Monthly") r.monthlyDogrulanmis++; son = d.gecerlilik?.son; }
    else { r.yillikOlmayan++; try { son = d.gunler.map((g) => isoTarih(g.t)).sort().at(-1); } catch { son = null; } }
    if (son && (!r.enYakinBitis || son < r.enYakinBitis)) { r.enYakinBitis = son; r.enYakinBitisIlce = x.id; }
  }
  if (defter) { const d = await okuJson(defter); if (d?.surum === 1) { r.istek.bugun = d.toplam; r.istek.gun = d.gun; r.istek.kalan = Math.max(0, tavan - d.toplam); } }
  return r;
}

export function markdown(r) {
  const s = (x) => (x === null || x === undefined ? "—" : String(x));
  return [
    "## Data operasyon özeti", "",
    "| Gösterge | Değer |", "|---|---|",
    `| Son başarılı yayın | ${s(r.sonYayin)} (${s(r.kaynakTuru)}${r.uc ? ", " + r.uc : ""}) |`,
    `| İlçe (yayında) | ${r.ilce} |`,
    `| Doğrulanmış resmi eşleme | ${r.dogrulanmisEsleme} |`,
    `| Resmi yıllık verisi olan | ${r.yillik} |`,
    `| Monthly ile doğrulanmış yıllık | ${r.monthlyDogrulanmis} |`,
    `| Yıllık olmayan / dosyasız | ${r.yillikOlmayan} / ${r.dosyasiz} |`,
    `| Bu çalışmada başarılı | ${s(r.calisma.basarili)} (doğrulandı ${r.calisma.dogrulandi}, düzeltildi ${r.calisma.duzeltildi}) |`,
    `| Planlı bekleyen | ${s(r.calisma.planliBekleyen)} |`,
    `| Başarısız (kaynak hatası) | ${r.calisma.basarisiz} |`,
    `| Kullanılamaz (Türkiye geneli) | ${s(r.calisma.kullanilamaz)}${r.calisma.kritikUyari ? " ⚠️ kritik" : ""} |`,
    `| Yeniden çekim kuyruğu | ${r.calisma.yenidenCek.length ? r.calisma.yenidenCek.join(", ") : "—"} |`,
    `| İstek (çalışma / bugün / tavan / kalan) | ${s(r.istek.calisma)} / ${s(r.istek.bugun)} / ${r.istek.tavan} / ${s(r.istek.kalan)} |`,
    `| En yakın veri bitişi | ${s(r.enYakinBitis)} (ilçe ${s(r.enYakinBitisIlce)}) |`,
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [v1 = "docs/v1", defter = process.env.AWQAT_DEFTER ?? null] = process.argv.slice(2);
  const r = await ozet({ v1, defter, tavan: Number(process.env.GUNLUK_ISTEK_TAVANI ?? 100) });
  console.log(markdown(r));
  console.log("OPERASYON_OZET " + JSON.stringify(r));
}
