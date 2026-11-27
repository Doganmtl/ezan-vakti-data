// Kaynak bazlı bilinen istisnalar (config/bilinen-eksik.json). Saf doğrulama + yükleme.
import fs from "node:fs/promises";
export const BILINEN_EKSIK_DOSYASI = "config/bilinen-eksik.json";
export const KAYNAKLAR = ["ayna", "resmi"];
export function bilinenEksikDogrula(j) {
  if (j?.surum !== 1 || typeof j.kaynaklar !== "object") throw Error("geçersiz bilinen-eksik listesi");
  const out = {};
  for (const k of KAYNAKLAR) {
    const l = j.kaynaklar[k];
    if (!Array.isArray(l) || l.some((x) => !Number.isSafeInteger(x?.id) || x.id <= 0 || typeof x.sebep !== "string" || !x.sebep.trim())) throw Error("geçersiz bilinen-eksik kaydı: " + k);
    out[k] = new Set(l.map((x) => x.id));
    if (out[k].size !== l.length) throw Error("tekrarlanan bilinen-eksik: " + k);
  }
  return out;
}
export async function bilinenEksikYukle(kaynak, dosya = process.env.BILINEN_EKSIK_DOSYASI ?? BILINEN_EKSIK_DOSYASI) {
  if (!KAYNAKLAR.includes(kaynak)) throw Error("bilinmeyen kaynak: " + kaynak);
  return bilinenEksikDogrula(JSON.parse(await fs.readFile(dosya, "utf8")))[kaynak];
}
