// Kısmi yayın sınıflandırması, kademeli seçim ve eşik kararı (saf; ağ/dosya yok). Ayrıntı: SOZLESME.md, DECISIONS D06.
import { gunlerDogrula, isoTarih, gunEkle } from "./v1-dogrulama.mjs";

export const YEDEK_MIN_GUN = 7;
export const SINIFLAR = ["yedek", "kisaKapsam", "tukenmis", "eksik"];
/** D06 A'+C (kullanıcı onaylı 27.11.2026): %2 kaynak hatası, %1 kullanılamaz; ayrıntı yayinKarari. Yayın doğrulaması bu sabitleri kullanır; ortam değişkeniyle gevşetilemez. */
export const D06 = Object.freeze({ maxKaynakHatasi: 0.02, maxKullanilamaz: 0.01 });

/**
 * Damga nedeniyle mobilde TAM GÜN kabul edilen son gün (ISO). Mobil, damga + 14 gün anından sonra dosyayı reddeder;
 * o anın içinde bulunduğu gün tam kabul edilmez → (damga + 14 gün)'ün UTC tarihinden bir önceki gün. Damga yoksa/bozuksa null.
 */
export function damgaSonGun(eski) {
  const n = Date.parse(eski?.guncelleme);
  return Number.isFinite(n) ? gunEkle(new Date(n + 14 * 86400e3).toISOString().slice(0, 10), -1) : null;
}

/**
 * Kaynaktan yenilenmeyen ilçenin MEVCUT dosyasını mobil davranışa göre sınıflandırır (dosyaya dokunmaz).
 * Mobil bir dosyayı yalnız (a) bugün ve yarını kapsıyor ve (b) guncelleme damgası en çok 14 gün eskiyse kabul eder.
 *  yedek      bugün..bugün+7 kesintisiz VE damga bugün+7'ye kadar kabul ediliyor
 *  kisaKapsam bugün+yarın kapsanıyor VE damga yarına kadar kabul ediliyor, ama 7 günden kısa
 *  tukenmis   dosya var ama mobil bugün/yarın reddeder (kapsam yok ya da damga 14 günden eski/bozuk)
 *  eksik      dosya yok
 */
export function siniflandir(eski, bugun) {
  if (!eski) return "eksik";
  const damga = damgaSonGun(eski);
  const kapsar = (n) => { try { gunlerDogrula(eski.gunler, bugun, n); return true; } catch { return false; } };
  if (damga && damga >= gunEkle(bugun, YEDEK_MIN_GUN) && kapsar(YEDEK_MIN_GUN)) return "yedek";
  if (damga && damga >= gunEkle(bugun, 1) && kapsar(1)) return "kisaKapsam";
  return "tukenmis";
}

/** Dosyanın son geçerli günü (ISO) ya da null. Kademeli seçimde öncelik için. */
export function sonGun(eski) {
  let son = null;
  for (const g of eski?.gunler ?? []) { try { const iso = isoTarih(g.t); if (!son || iso > son) son = iso; } catch {} }
  return son;
}

/** Mobil uygulamaların dosyayı kabul ettiği süre (VERI-ENTEGRASYON / SOZLESME: guncelleme en çok 14 gün eski). */
export const MOBIL_YAS_GUN = 14;
/**
 * Dosyanın mobilde kullanılabileceği son gün (ISO): min(son veri günü, guncelleme tarihi + 14 gün). Dosya yoksa null
 * (en öncelikli). Kademeli seçimde öncelik anahtarı: hem verisi hem "tazeliği" önce bitecek ilçe önce yenilenir.
 */
export function sonKullanim(eski) {
  if (!eski) return null;
  const sg = sonGun(eski), taze = damgaSonGun(eski) ?? "";
  if (!sg) return taze;
  return taze < sg ? taze : sg;
}

/**
 * Kademeli güncelleme seçimi: mobilde kullanılabilirliği en erken bitecek ilçeler önce (dosyası olmayan en önce), eşitlikte kimlik sırası.
 * adaylar: [{id, sonGun|null}] → seçilen kimlik kümesi. boyut yoksa hepsi seçilir.
 */
export function dilimSec(adaylar, boyut) {
  if (boyut === undefined || boyut === null) return new Set(adaylar.map((x) => x.id));
  if (!Number.isSafeInteger(boyut) || boyut < 1) throw Error("geçersiz dilim boyutu");
  const sirali = [...adaylar].sort((a, b) => (a.sonGun ?? "") < (b.sonGun ?? "") ? -1 : (a.sonGun ?? "") > (b.sonGun ?? "") ? 1 : a.id - b.id);
  return new Set(sirali.slice(0, boyut).map((x) => x.id));
}

/**
 * Yayın kararı — D06 A'+C (kullanıcı onayı 27.11.2026).
 *  aktif         = toplam − bilinenEksik (bilinçli istisnalar oranlara girmez)
 *  denenen       = aktif − planliBekleyen (bu çalışmada kaynaktan istenen ilçeler)
 *  kaynakHatasi  = denenen içinde alınamayanlar (yedek+kisaKapsam+tukenmis+eksik)
 *                  sınır = max(1, floor(denenen × %2))  — küçük dilimde en az 1 hata toleransı
 *  kullanilamaz  = denenen içinde tukenmis+eksik
 *                  sınır = floor(denenen × %1); başka ilçe başarıyla güncellendiyse en az 1 (kontrollü kurtarma)
 *  basarili = 0 → yayın YOK.
 *  Planlı bekleyenler kaynak hatası sayılmaz ve yayını engellemez; kullanılamaz olanları ayrıca raporlanır.
 *  Türkiye geneli: (denenen kullanılamaz + bekleyen kullanılamaz) > floor(aktif × %1) → kritikUyari (yayını engellemez).
 */
export function yayinKarari(d, esik = D06) {
  const { maxKaynakHatasi = D06.maxKaynakHatasi, maxKullanilamaz = D06.maxKullanilamaz } = esik;
  const bilinen = new Set(d.bilinenEksik ?? []);
  const say = (k) => d[k].filter((id) => !bilinen.has(id)).length;
  const aktif = d.toplam - bilinen.size;
  if (!(aktif > 0)) return { yayinla: false, sebep: "aktif ilçe yok", aktif };
  const bekleyen = (d.planliBekleyen ?? []).filter((id) => !bilinen.has(id)).length;
  const denenen = aktif - bekleyen;
  const r = { aktif, denenen, planli: denenen, planliBekleyen: bekleyen, basarili: d.basarili, yedek: say("yedek"), kisaKapsam: say("kisaKapsam"),
    tukenmis: say("tukenmis"), eksik: say("eksik"), bilinenEksik: bilinen.size, bekleyenKullanilamaz: d.planliKullanilamaz ?? 0 };
  r.kaynakHatasi = r.yedek + r.kisaKapsam + r.tukenmis + r.eksik;
  r.kullanilamaz = r.tukenmis + r.eksik;
  r.sinirKaynakHatasi = Math.max(1, Math.floor(denenen * maxKaynakHatasi));
  r.sinirKullanilamaz = r.basarili > 0 ? Math.max(1, Math.floor(denenen * maxKullanilamaz)) : 0;
  r.turkiyeKullanilamaz = r.kullanilamaz + r.bekleyenKullanilamaz;
  r.sinirTurkiye = Math.floor(aktif * maxKullanilamaz);
  r.kritikUyari = r.turkiyeKullanilamaz > r.sinirTurkiye;
  if (!(denenen > 0) || r.basarili + r.kaynakHatasi !== denenen) return { ...r, yayinla: false, sebep: "sayım tutarsız" };
  if (r.basarili === 0) return { ...r, yayinla: false, sebep: "başarılı ilçe yok" };
  if (r.kaynakHatasi > r.sinirKaynakHatasi) return { ...r, yayinla: false, sebep: `kaynak hatası ${r.kaynakHatasi} > ${r.sinirKaynakHatasi}` };
  if (r.kullanilamaz > r.sinirKullanilamaz) return { ...r, yayinla: false, sebep: `kullanılamaz ${r.kullanilamaz} > ${r.sinirKullanilamaz}` };
  return { ...r, yayinla: true };
}
