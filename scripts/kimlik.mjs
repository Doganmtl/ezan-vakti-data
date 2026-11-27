// Kimlik (ID) koruması: yayındaki il/ilçe kimlikleri kullanıcıların kayıtlı konumlarıdır.
// Kaynakta kaybolan kimlik silinmez; yeni kimlik yalnızca onaylı geçiş listesindeyse eklenir.
// Saf fonksiyonlar; ağ yok.
import fs from "node:fs/promises";

export const GECIS_DOSYASI = process.env.GECIS_DOSYASI ?? "eslesme/onayli-gecisler.json";

/** Onaylı geçiş listesini doğrular. Yalnız "ekle" türü vardır; kaldırma/ID değiştirme yoktur. */
export function gecisDogrula(g) {
  if (!g || g.surum !== 1 || !Array.isArray(g.gecisler)) throw Error("geçersiz geçiş listesi");
  const ids = new Set();
  for (const x of g.gecisler) {
    if (x.tur !== "ekle") throw Error("desteklenmeyen geçiş türü: " + x.tur);
    if (!Number.isSafeInteger(x.id) || x.id <= 0 || !Number.isSafeInteger(x.ilId) || x.ilId <= 0) throw Error("geçersiz geçiş kimliği");
    if (!x.onay || typeof x.onay.kim !== "string" || !x.onay.kim.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(x.onay.tarih ?? "") || typeof x.onay.gerekce !== "string" || !x.onay.gerekce.trim())
      throw Error("geçiş onayı eksik: " + x.id);
    if (ids.has(x.id)) throw Error("tekrarlanan geçiş: " + x.id);
    ids.add(x.id);
  }
  return g;
}
export async function gecisYukle(dosya = GECIS_DOSYASI) {
  try { return gecisDogrula(JSON.parse(await fs.readFile(dosya, "utf8"))); }
  catch (e) { if (e.code === "ENOENT") return { surum: 1, gecisler: [] }; throw e; }
}
/** Onaylı eklemelerin ilçe kümesi (ilId'ye göre). */
export function onayliEklemeler(g) {
  const m = new Map();
  for (const x of g.gecisler) { if (!m.has(x.ilId)) m.set(x.ilId, new Set()); m.get(x.ilId).add(x.id); }
  return m;
}

/**
 * Bir ilin ilçe listesini birleştirir.
 * onceki: yayındaki liste (null → ilk kurulum, kaynak olduğu gibi kabul edilir)
 * kaynak: kaynaktan gelen liste
 * Dönüş: { liste, kaynaktaYok: [id], reddedilen: [id] }
 */
export function ilceBirlestir(onceki, kaynak, onayli = new Set()) {
  if (!onceki) return { liste: kaynak, kaynaktaYok: [], reddedilen: [] };
  const kaynakMap = new Map(kaynak.map((x) => [x.id, x]));
  const liste = onceki.map((x) => kaynakMap.get(x.id) ?? x); // ad kaynaktan güncellenir, kimlik korunur
  const eskiler = new Set(onceki.map((x) => x.id));
  const kaynaktaYok = onceki.filter((x) => !kaynakMap.has(x.id)).map((x) => x.id);
  const reddedilen = [];
  for (const x of kaynak) {
    if (eskiler.has(x.id)) continue;
    if (onayli.has(x.id)) liste.push(x); else reddedilen.push(x.id);
  }
  return { liste, kaynaktaYok, reddedilen };
}

/** Yayın kontrolü: yeni küme eskisini kapsamalı; fazlası onaylı olmalı. */
export function kimlikGecisiDogrula(yeni, eski, onayli = new Set()) {
  const y = new Set(yeni.map((x) => x.id)), e = new Set(eski.map((x) => x.id));
  for (const id of e) if (!y.has(id)) throw Error("identity removed: " + id);
  for (const id of y) if (!e.has(id) && !onayli.has(id)) throw Error("identity added without approved migration: " + id);
}

/**
 * Doğrulanmış resmi adları korur (kullanıcı kararı 27.11.2026: resmi Diyanet adları esas).
 * Kaynak (ör. ayna) farklı yazım getirse de tabloda resmiAd'ı olan ilçenin adı resmi ad kalır. Kimlik ve sıra değişmez.
 */
export function resmiAdlariKoru(liste, tablo) {
  return liste.map((x) => { const r = tablo?.ilceler?.[x.id]?.resmiAd; return typeof r === "string" && r && r !== x.ad ? { ...x, ad: r } : x; });
}
