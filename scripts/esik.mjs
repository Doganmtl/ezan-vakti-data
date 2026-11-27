// Kısmi yayın sınıflandırması ve eşik kararı (saf; ağ/dosya yok). Ayrıntı: SOZLESME.md, DECISIONS D06.
import { gunlerDogrula } from "./v1-dogrulama.mjs";

export const YEDEK_MIN_GUN = 7;
export const SINIFLAR = ["yedek", "kisaKapsam", "tukenmis", "eksik"];

/**
 * Kaynaktan yenilenemeyen ilçenin MEVCUT dosyasını sınıflandırır (dosyaya dokunmaz):
 *  yedek      bugün..bugün+7 kesintisiz → kullanıcı için güvenli
 *  kisaKapsam bugün ve yarın var ama 7 günden kısa → bugün doğru, yakında tükenecek
 *  tukenmis   dosya var, bugün+yarın geçerli değil → uygulama bu dosyayı reddeder
 *  eksik      dosya yok
 */
export function siniflandir(eski, bugun) {
  if (!eski) return "eksik";
  try { gunlerDogrula(eski.gunler, bugun, YEDEK_MIN_GUN); return "yedek"; } catch {}
  try { gunlerDogrula(eski.gunler, bugun, 1); return "kisaKapsam"; } catch {}
  return "tukenmis";
}

/**
 * Yayın kararı. Payda: aktif = toplam − bilinenEksik (bilinçli istisnalar oranlara girmez, raporlanır).
 *  kaynakHatasi  = kaynaktan alınamayan aktif ilçe (yedek+kisaKapsam+tukenmis+eksik)
 *  kullanilamaz  = tukenmis+eksik (aktif)  — kullanıcı bugün vakit göremez
 *  kisaKapsam    raporlanır; tek başına yayını durdurmaz (dosyalara dokunulmadığı için zarar vermez)
 * Oranlar "büyüktür" ile karşılaştırılır: 868 aktifte %2 → en çok 17, %1 → en çok 8 ilçe kabul.
 */
export function yayinKarari(d, { maxKaynakHatasi = 0.02, maxKullanilamaz = 0.01 } = {}) {
  const bilinen = new Set(d.bilinenEksik ?? []);
  const say = (k) => d[k].filter((id) => !bilinen.has(id)).length;
  const aktif = d.toplam - bilinen.size;
  if (!(aktif > 0)) return { yayinla: false, sebep: "aktif ilçe yok", aktif };
  const r = { aktif, basarili: d.basarili, yedek: say("yedek"), kisaKapsam: say("kisaKapsam"), tukenmis: say("tukenmis"), eksik: say("eksik"), bilinenEksik: bilinen.size };
  r.kaynakHatasi = r.yedek + r.kisaKapsam + r.tukenmis + r.eksik;
  r.kullanilamaz = r.tukenmis + r.eksik;
  r.sinirKaynakHatasi = Math.floor(aktif * maxKaynakHatasi);
  r.sinirKullanilamaz = Math.floor(aktif * maxKullanilamaz);
  if (r.basarili + r.kaynakHatasi !== aktif) return { ...r, yayinla: false, sebep: "sayım tutarsız" };
  if (r.kaynakHatasi / aktif > maxKaynakHatasi) return { ...r, yayinla: false, sebep: `kaynak hatası ${r.kaynakHatasi} > ${r.sinirKaynakHatasi}` };
  if (r.kullanilamaz / aktif > maxKullanilamaz) return { ...r, yayinla: false, sebep: `kullanılamaz ${r.kullanilamaz} > ${r.sinirKullanilamaz}` };
  return { ...r, yayinla: true };
}
