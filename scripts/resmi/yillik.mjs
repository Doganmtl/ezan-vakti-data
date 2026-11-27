// DateRange tabanlı yıllık resmi arşiv (8. tur, offline geliştirme). Saf; ağ ve dosya sistemi yok.
// Arşiv kaydı ile yayın dosyası AYRIDIR: arşiv ham yanıtın özetini, çalışma ve kimlik bilgisini taşır;
// yayın dosyası (docs/v1/vakitler/{id}.json, sözleşme 2) yalnız istemcinin ihtiyaç duyduğu alanları taşır.
// Not (operasyon koşulu D11): public repoda docs/ dışı dosyalar da kamuya açıktır. Ham yıllık arşivin
// kalıcı saklanacağı yer, yeniden yayın izni kesinleşmeden canlı olarak YAZILMAZ (arşiv yazımı varsayılan kapalı).
import { createHash } from "node:crypto";
import { gunEkle } from "../v1-dogrulama.mjs";
import { SOZLESME, surumHesapla, gunlerKesintisiz, zamanDogrula } from "./sozlesme2.mjs";
import { YENILEME_ONCESI_GUN } from "../esik.mjs";
export { YENILEME_ONCESI_GUN };

export const YIL_GUN = 365;             // 27.11.2026 DateRange testinde doğrulanan aralık (run 45996522915)

/** DateRange isteği gövdesi: [bugun, bugun+364]. */
export function aralikGovdesi(resmiId, bugun, gun = YIL_GUN) {
  const son = gunEkle(bugun, gun - 1);
  return { cityId: resmiId, startDate: `${bugun}T00:00:00`, endDate: `${son}T00:00:00`, ilk: bugun, son };
}

/**
 * DateRange yanıtını (v1 {t,v,h?} biçimine çevrilmiş) doğrular: tam olarak istenen aralık, kesintisiz,
 * tekrarsız, ay/yıl geçişleri ve artık yıl takvim aritmetiğiyle; 6 vakit geçerli ve sıralı.
 * Yanıt bir yer kimliği taşıyorsa istenen resmi kimlikle aynı olmalı.
 */
export function aralikDogrula(gunler, { ilk, son, resmiId, yanitKimlikleri = [] }) {
  const k = gunlerKesintisiz(gunler);
  if (k.ilk !== ilk || k.son !== son) throw Error(`aralık farklı: istenen ${ilk}..${son}, dönen ${k.ilk}..${k.son}`);
  for (const x of yanitKimlikleri) if (x !== undefined && x !== null && Number(x) !== resmiId) throw Error("yanıt başka bir yer kimliği taşıyor");
  return k;
}

/** Ham yanıtın sabit özeti (arşivde yanıtın kendisi yerine; içerik doğrulaması için). */
export const hamOzet = (ham) => "sha256:" + createHash("sha256").update(JSON.stringify(ham)).digest("hex");

/** Arşiv kaydı. alindi: yanıtın alındığı an (UTC Z). */
export function arsivKaydi({ v1Id, resmiId, gunler, alindi, calisma, ham, simdi }) {
  zamanDogrula(alindi, simdi, "alindi");
  const k = gunlerKesintisiz(gunler);
  if (!Number.isSafeInteger(v1Id) || !Number.isSafeInteger(resmiId)) throw Error("kimlik geçersiz");
  return { sozlesme: SOZLESME, v1Id, resmiId, uc: "DateRange", alindi, calisma, gecerlilik: { ilk: k.ilk, son: k.son },
    surum: surumHesapla(gunler), hamOzet: ham === undefined ? null : hamOzet(ham), gunler };
}

/**
 * Arşiv geçişi: daha eski bir alım yeni kaydı ezemez; aynı içerik yeni sürüm üretmez.
 * Dönüş: { kayit, degisti, gecmis } — gecmis: değişiklik günlüğü satırı (yalnız ekleme) ya da null.
 */
export function arsivGecis(eski, yeni) {
  if (eski && Date.parse(yeni.alindi) < Date.parse(eski.alindi)) throw Error("daha eski alım arşivdeki yeni kaydı ezemez");
  if (eski && eski.v1Id !== yeni.v1Id) throw Error("arşiv kimliği farklı");
  if (eski && eski.surum === yeni.surum && eski.gecerlilik.ilk === yeni.gecerlilik.ilk && eski.gecerlilik.son === yeni.gecerlilik.son)
    return { kayit: eski, degisti: false, gecmis: null };
  return { kayit: yeni, degisti: true, gecmis: { zaman: yeni.alindi, v1Id: yeni.v1Id, uc: "DateRange", eskiSurum: eski?.surum ?? null, yeniSurum: yeni.surum, calisma: yeni.calisma } };
}

/**
 * Yayın dosyası (sözleşme 2, resmi-yillik). İçerik değişmediyse (aynı surum) eski dosyanın guncelleme/kaynak
 * alanları korunur ve yalnız doğrulama ilerler (sahte güncellik yok).
 */
export function yayinDosyasi(arsiv, { eski = null, calisma } = {}) {
  const gunler = arsiv.gunler.map((g) => (g.h ? { t: g.t, v: [...g.v], h: g.h } : { t: g.t, v: [...g.v] }));
  if (eski?.sozlesme === SOZLESME && eski.surum === arsiv.surum && eski.gecerlilik?.ilk === arsiv.gecerlilik.ilk && eski.gecerlilik?.son === arsiv.gecerlilik.son)
    return { ...eski, dogrulama: { zaman: arsiv.alindi, uc: "DateRange", ilk: arsiv.gecerlilik.ilk, son: arsiv.gecerlilik.son, gun: gunler.length, sonuc: "esit", calisma } };
  return { guncelleme: arsiv.alindi, gunler, sozlesme: SOZLESME,
    kaynak: { tur: "resmi-yillik", uc: "DateRange", alindi: arsiv.alindi, resmiId: arsiv.resmiId, calisma: arsiv.calisma },
    gecerlilik: { ...arsiv.gecerlilik }, duzeltmeler: [], dogrulama: null, surum: arsiv.surum };
}

/** Yıllık dosyanın yenileme tarihi (bu tarihten itibaren DateRange kuyruğuna girer). */
export const yenilemeTarihi = (d) => gunEkle(d.gecerlilik.son, -YENILEME_ONCESI_GUN);
