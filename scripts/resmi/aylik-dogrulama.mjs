// Monthly ile resmi yıllık verinin doğrulanması ve değişiklik yönetimi (8. tur). Saf; ağ yok.
// Monthly yalnız kendi döndürdüğü ortak günleri doğrular; 365 günün tamamı doğrulanmış sayılmaz (dogrulama.ilk/son).
import { isoTarih } from "../v1-dogrulama.mjs";
import { SOZLESME, AZAMI_DUZELTME, surumHesapla, gunlerKesintisiz, zamanDogrula } from "./sozlesme2.mjs";

/**
 * Sistematik fark eşiği — ÖNERİ (kullanıcı kararı değildir; DECISIONS D12). Gerekçe testlerde (aylik-dogrulama.test.mjs):
 * gerçek resmi düzeltmeler tek tük ilçede ve dakika düzeyinde beklenir; biçim/eşleme hataları ise çoğu ilçeyi ve/veya
 * büyük kaymaları etkiler. Bu iki dağılım arasında kalan her eşik iki uç senaryoyu ayırır.
 */
export const SISTEMATIK = Object.freeze({
  oran: 0.05,          // bir çalışmada farklı çıkan ilçe sınırı: max(1, floor(doğrulanan × oran))
  azamiDakika: 15,     // tek bir vakitte bu kadardan büyük fark → biçim/eşleme hatası şüphesi, otomatik düzeltme yok
  azamiGunOrani: 1,    // (bilgi) bir ilçede farklı gün oranı sınırlanmaz: gerçek düzeltme tüm günleri etkileyebilir
});

const dk = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/**
 * Bir yıllık dosyayı Monthly yanıtıyla karşılaştırır.
 * aylik: v1 {t,v,h?} biçiminde günler (geçerli ve kesintisiz olmalı). alindi: Monthly yanıtının alındığı an.
 * Dönüş: { sonuc: "esit" | "degisti" | "ortak-yok", ortak:{ilk,son,gun}, farklar:[{tarih, vakit, eski, yeni, dakika}], azamiDakika, dosya }
 * - esit: dosyanın içeriği, surum, guncelleme ve kaynak.alindi DEĞİŞMEZ; yalnız dogrulama güncellenir.
 * - degisti: Monthly değerleriyle düzeltilmiş YENİ sürüm (surum değişir, guncelleme = alindi, duzeltmeler'e eklenir).
 *   Uygulanıp uygulanmayacağına çalışma düzeyinde sistematikKarar() karar verir; ilçe DateRange yeniden çekim kuyruğuna girer.
 */
export function karsilastir(dosya, aylik, { alindi, calisma, simdi }) {
  if (dosya?.sozlesme !== SOZLESME || dosya.kaynak?.tur !== "resmi-yillik") throw Error("yalnız resmi yıllık dosya doğrulanır");
  zamanDogrula(alindi, simdi, "Monthly alindi");
  if (Date.parse(alindi) < Date.parse(dosya.guncelleme)) throw Error("Monthly yanıtı dosyanın içerik sürümünden eski");
  gunlerKesintisiz(aylik);
  const m = new Map(aylik.map((g) => [isoTarih(g.t), g]));
  const ortakGunler = dosya.gunler.filter((g) => m.has(isoTarih(g.t)));
  if (!ortakGunler.length) return { sonuc: "ortak-yok", ortak: null, farklar: [], azamiDakika: 0, dosya };
  const ilk = isoTarih(ortakGunler[0].t), son = isoTarih(ortakGunler.at(-1).t);
  const farklar = [];
  for (const g of ortakGunler) {
    const y = m.get(isoTarih(g.t));
    g.v.forEach((s, i) => { if (s !== y.v[i]) farklar.push({ tarih: isoTarih(g.t), vakit: i, eski: s, yeni: y.v[i], dakika: Math.abs(dk(y.v[i]) - dk(s)) }); });
  }
  const ortak = { ilk, son, gun: ortakGunler.length };
  const dogrulama = (sonuc) => ({ zaman: alindi, uc: "Monthly", ilk, son, gun: ortakGunler.length, sonuc, calisma });
  if (!farklar.length) return { sonuc: "esit", ortak, farklar, azamiDakika: 0, dosya: { ...dosya, dogrulama: dogrulama("esit") } };
  const gunler = dosya.gunler.map((g) => {
    const y = m.get(isoTarih(g.t));
    if (!y) return g;
    return g.h ? { t: g.t, v: [...y.v], h: y.h ?? g.h } : y.h ? { t: g.t, v: [...y.v], h: y.h } : { t: g.t, v: [...y.v] };
  });
  const duzeltmeler = [...(dosya.duzeltmeler ?? []), { zaman: alindi, uc: "Monthly", ilk, son, gun: new Set(farklar.map((f) => f.tarih)).size, calisma }].slice(-AZAMI_DUZELTME);
  const yeni = { ...dosya, guncelleme: alindi, gunler, duzeltmeler, surum: surumHesapla(gunler), dogrulama: dogrulama("duzeltildi") };
  return { sonuc: "degisti", ortak, farklar, azamiDakika: Math.max(...farklar.map((f) => f.dakika)), dosya: yeni, eskiSurum: dosya.surum, yeniSurum: yeni.surum };
}

/**
 * Çalışma düzeyinde karar. sonuclar: karsilastir() sonuçları (doğrulanan ilçeler).
 * Dönüş: { uygula: boolean, durdur: boolean, sebep, degisen, sinir }.
 * durdur=true → bu çalışmada HİÇBİR düzeltme yayınlanmaz (eşit olanların doğrulama güncellemesi de), insan incelemesi istenir.
 */
export function sistematikKarar(sonuclar, esik = SISTEMATIK) {
  const dogrulanan = sonuclar.filter((r) => r.sonuc !== "ortak-yok").length;
  const degisen = sonuclar.filter((r) => r.sonuc === "degisti");
  const sinir = Math.max(1, Math.floor(dogrulanan * esik.oran));
  const buyuk = degisen.filter((r) => r.azamiDakika > esik.azamiDakika);
  if (buyuk.length) return { uygula: false, durdur: true, sebep: `${buyuk.length} ilçede ${esik.azamiDakika} dakikadan büyük fark (biçim/eşleme hatası şüphesi)`, degisen: degisen.length, sinir };
  if (degisen.length > sinir) return { uygula: false, durdur: true, sebep: `sistematik fark: ${degisen.length}/${dogrulanan} ilçe (sınır ${sinir})`, degisen: degisen.length, sinir };
  return { uygula: true, durdur: false, sebep: degisen.length ? `${degisen.length} ilçede resmi düzeltme` : "tümü eşit", degisen: degisen.length, sinir };
}
