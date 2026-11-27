// Kısmi yayın sınıflandırması, kademeli seçim ve eşik kararı (saf; ağ/dosya yok). Ayrıntı: SOZLESME.md, DECISIONS D06.
import { gunlerDogrula, isoTarih } from "./v1-dogrulama.mjs";

export const YEDEK_MIN_GUN = 7;
export const SINIFLAR = ["yedek", "kisaKapsam", "tukenmis", "eksik"];
/** D06 (öneri A, kullanıcı onayı bekliyor). Yayın doğrulaması bu sabitleri kullanır; ortam değişkeniyle gevşetilemez. */
export const D06 = Object.freeze({ maxKaynakHatasi: 0.02, maxKullanilamaz: 0.01 });

/**
 * Kaynaktan yenilenmeyen ilçenin MEVCUT dosyasını sınıflandırır (dosyaya dokunmaz):
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

/** Dosyanın son geçerli günü (ISO) ya da null. Kademeli seçimde öncelik için. */
export function sonGun(eski) {
  let son = null;
  for (const g of eski?.gunler ?? []) { try { const iso = isoTarih(g.t); if (!son || iso > son) son = iso; } catch {} }
  return son;
}

/**
 * Kademeli güncelleme seçimi: en az kapsamı kalan ilçeler önce (dosyası olmayan en önce), eşitlikte kimlik sırası.
 * adaylar: [{id, sonGun|null}] → seçilen kimlik kümesi. boyut yoksa hepsi seçilir.
 */
export function dilimSec(adaylar, boyut) {
  if (boyut === undefined || boyut === null) return new Set(adaylar.map((x) => x.id));
  if (!Number.isSafeInteger(boyut) || boyut < 1) throw Error("geçersiz dilim boyutu");
  const sirali = [...adaylar].sort((a, b) => (a.sonGun ?? "") < (b.sonGun ?? "") ? -1 : (a.sonGun ?? "") > (b.sonGun ?? "") ? 1 : a.id - b.id);
  return new Set(sirali.slice(0, boyut).map((x) => x.id));
}

/**
 * Yayın kararı.
 *  aktif         = toplam − bilinenEksik (bilinçli istisnalar oranlara girmez)
 *  planli        = aktif − planliBekleyen (bu çalışmada kaynaktan istenen ilçeler)
 *  kaynakHatasi  = planlı olup alınamayanlar (yedek+kisaKapsam+tukenmis+eksik); payda planli.
 *                  Planlı olarak bu dilimde istenmeyen ilçe kaynak hatası DEĞİLDİR.
 *  kullanilamaz  = tukenmis+eksik (planlı) + planliBekleyen içinde tükenmiş/eksik olanlar; payda aktif.
 * Oranlar "büyüktür" ile karşılaştırılır: 868 aktifte %2 → en çok 17, %1 → en çok 8 ilçe.
 */
export function yayinKarari(d, esik = D06) {
  const { maxKaynakHatasi = D06.maxKaynakHatasi, maxKullanilamaz = D06.maxKullanilamaz } = esik;
  const bilinen = new Set(d.bilinenEksik ?? []);
  const say = (k) => d[k].filter((id) => !bilinen.has(id)).length;
  const aktif = d.toplam - bilinen.size;
  if (!(aktif > 0)) return { yayinla: false, sebep: "aktif ilçe yok", aktif };
  const bekleyen = (d.planliBekleyen ?? []).filter((id) => !bilinen.has(id)).length;
  const planli = aktif - bekleyen;
  const r = { aktif, planli, planliBekleyen: bekleyen, basarili: d.basarili, yedek: say("yedek"), kisaKapsam: say("kisaKapsam"),
    tukenmis: say("tukenmis"), eksik: say("eksik"), bilinenEksik: bilinen.size, planliKullanilamaz: d.planliKullanilamaz ?? 0 };
  r.kaynakHatasi = r.yedek + r.kisaKapsam + r.tukenmis + r.eksik;
  r.kullanilamaz = r.tukenmis + r.eksik + r.planliKullanilamaz;
  r.sinirKaynakHatasi = Math.floor(planli * maxKaynakHatasi);
  r.sinirKullanilamaz = Math.floor(aktif * maxKullanilamaz);
  if (!(planli > 0) || r.basarili + r.kaynakHatasi !== planli) return { ...r, yayinla: false, sebep: "sayım tutarsız" };
  if (r.kaynakHatasi / planli > maxKaynakHatasi) return { ...r, yayinla: false, sebep: `kaynak hatası ${r.kaynakHatasi} > ${r.sinirKaynakHatasi}` };
  if (r.kullanilamaz / aktif > maxKullanilamaz) return { ...r, yayinla: false, sebep: `kullanılamaz ${r.kullanilamaz} > ${r.sinirKullanilamaz}` };
  return { ...r, yayinla: true };
}
