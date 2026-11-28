// Diyanet servis kotası defteri (28.11.2026). Operasyonel HTTP defterinden (defter.mjs) AYRIDIR.
// Her gönderilen kota sayılan istek (giriş, yenileme ve Quota/My hariç; başarısızlar dahil) üç dönemde sayılır:
//   gun (İstanbul takvim günü), ay (YYYY-MM), yil (YYYY); anahtarlar "hizmet" (hizmet toplamı) ve "hizmet|parametre".
// Dönem değişince yalnız o dönemin sayacı sıfırlanır. Bozuk → bozuk: true → o çalışmada istek yok.
// Ani kesinti (runner ölümü, `always()` adımları da çalışmaz): ÖNCEDEN YAZMA. Çalışma ilk sayılan istekten önce seçtiği her
// (hizmet, parametre) için en kötü durumu `rezervasyonlar`a yazar ve dala push eder. Normal bitişte kendi rezervasyonu gerçek
// sayılarla değiştirilir. Başka bir çalışmanın açık kalmış rezervasyonu okunurken TÜKETİLMİŞ sayılır (fazla sayım, asla eksik).
// Kalıcılık: depodaki `kota-defteri` dalı (iş akışları sırayla çalışır, her durumda commit + push). Üretimde zorunlu=true:
// dosya yoksa sayaç sıfırlanmaz, defter bozuk sayılır (cache/dal kaybında tüketim sıfırlanmaz).
import fs from "node:fs/promises";
import path from "node:path";
import { hizmetParametre, ciftAnahtari } from "./kota.mjs";

const bos = (gun) => ({ gun, ay: gun.slice(0, 7), yil: gun.slice(0, 4), sayac: { gun: {}, ay: {}, yil: {} } });
const sayacGecerli = (x) => x && typeof x === "object" && !Array.isArray(x) && Object.values(x).every((v) => Number.isSafeInteger(v) && v >= 0);

const rezGecerli = (r) => r && typeof r.calisma === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.gun ?? "") && sayacGecerli(r.kota);
/** Rezervasyonun İstanbul günü (yazıldığı çalışmanın günü). */
const rezGunu = (r) => r.gun;

/**
 * Dönüş: { gun, ay, yil, sayac: {gun, ay, yil}, bozuk, yok?, devralinan: [calisma] }.
 * calisma: bu çalışmanın kimliği; başka çalışmaların açık rezervasyonları tüketilmiş sayılıp sayaçlara katılır.
 */
export async function kotaDefteriOku(dosya, bugun, { zorunlu = false, calisma = null } = {}) {
  if (!dosya) return zorunlu ? { ...bos(bugun), bozuk: true, sebep: "defter yolu yok" } : { ...bos(bugun), bozuk: false, yok: true };
  let ham;
  try { ham = await fs.readFile(dosya, "utf8"); }
  catch (e) { return e.code === "ENOENT" && !zorunlu ? { ...bos(bugun), bozuk: false, yok: true } : { ...bos(bugun), bozuk: true, sebep: e.code === "ENOENT" ? "defter dosyası yok (zorunlu)" : "okunamadı" }; }
  try {
    const d = JSON.parse(ham);
    if (d?.surum !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(d.gun ?? "") || !["gun", "ay", "yil"].every((k) => sayacGecerli(d.sayac?.[k]))) throw Error("biçim");
    if (d.gun > bugun) throw Error("gelecek tarih");
    const rez = d.rezervasyonlar ?? [];
    if (!Array.isArray(rez) || !rez.every(rezGecerli)) throw Error("rezervasyon");
    const y = bos(bugun);
    if (d.gun === bugun) y.sayac.gun = { ...d.sayac.gun };
    if (d.gun.slice(0, 7) === y.ay) y.sayac.ay = { ...d.sayac.ay };
    if (d.gun.slice(0, 4) === y.yil) y.sayac.yil = { ...d.sayac.yil };
    // Açık rezervasyonlar: başka çalışmanınki tüketilmiş sayılır (ani kesinti); bu çalışmanınki (yeniden deneme) de aynı.
    const devralinan = [];
    for (const r of rez) {
      const g = rezGunu(r);
      for (const [k, n] of Object.entries(r.kota)) {
        if (g === bugun) y.sayac.gun[k] = (y.sayac.gun[k] ?? 0) + n;
        if (g.slice(0, 7) === y.ay) y.sayac.ay[k] = (y.sayac.ay[k] ?? 0) + n;
        if (g.slice(0, 4) === y.yil) y.sayac.yil[k] = (y.sayac.yil[k] ?? 0) + n;
      }
      devralinan.push(r.calisma);
    }
    void calisma;
    return { ...y, bozuk: false, devralinan };
  } catch { return { ...bos(bugun), bozuk: true }; }
}

/**
 * Önceden yazma: bu çalışmanın en kötü durum tüketimini rezervasyon olarak ekler (sayaçlara değil). planlanan: [{hizmet, parametre}].
 * Her parametre için `azami` istek; hizmet toplamı = azami × parametre sayısı.
 */
export function rezervasyonEkle(defter, { calisma, planlanan, azami = 2, gun = defter.gun, zaman = new Date().toISOString() }) {
  const kota = {};
  for (const { hizmet, parametre } of planlanan) {
    kota[hizmet] = (kota[hizmet] ?? 0) + azami;
    const k = ciftAnahtari(hizmet, String(parametre));
    kota[k] = (kota[k] ?? 0) + azami;
  }
  return { ...defter, rezervasyonlar: [...(defter.rezervasyonlar ?? []), { calisma: String(calisma), gun, zaman, kota }] };
}

/** İstemcinin bu çalışmadaki sayaçlarını ({anahtar: n}) üç döneme ekler (yeni nesne). Bu çalışmanın rezervasyonu kaldırılır. */
export function kotaDefterineEkle(defter, istekSayilari, { calisma = null } = {}) {
  const d = { ...defter, sayac: { gun: { ...defter.sayac.gun }, ay: { ...defter.sayac.ay }, yil: { ...defter.sayac.yil } },
    rezervasyonlar: (defter.rezervasyonlar ?? []).filter((r) => calisma === null || r.calisma !== String(calisma)) };
  for (const [a, n] of Object.entries(istekSayilari ?? {})) {
    const c = hizmetParametre(a);
    if (!c) continue;
    for (const donem of ["gun", "ay", "yil"]) for (const k of [c.hizmet, ciftAnahtari(c.hizmet, c.parametre)]) d.sayac[donem][k] = (d.sayac[donem][k] ?? 0) + n;
  }
  return d;
}

/** Bu çalışmadaki sayaçları { hizmet: n, "hizmet|parametre": n } biçimine çevirir. */
export function calismaSayaci(istekSayilari) {
  return kotaDefterineEkle({ sayac: { gun: {}, ay: {}, yil: {} } }, istekSayilari).sayac.gun;
}

export async function kotaDefteriYaz(dosya, defter) {
  if (defter.bozuk) return null; // bozuk defterin üzerine yazılmaz (elle incelenir)
  // Okunurken devralınan (tüketilmiş sayılan) rezervasyonlar artık sayaçlarda; yalnız bu çalışmanın açık rezervasyonları yazılır.
  const d = { surum: 1, gun: defter.gun, sayac: defter.sayac, ...(defter.rezervasyonlar?.length ? { rezervasyonlar: defter.rezervasyonlar } : {}) };
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  const tmp = `${dosya}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 1) + "\n");
  await fs.rename(tmp, dosya);
  return d;
}
