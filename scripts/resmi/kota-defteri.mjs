// Diyanet servis kotası defteri (28.11.2026). Operasyonel HTTP defterinden (defter.mjs) AYRIDIR.
// Her gönderilen kota sayılan istek (giriş, yenileme ve Quota/My hariç; başarısızlar dahil) üç dönemde sayılır:
//   gun (İstanbul takvim günü), ay (YYYY-MM), yil (YYYY); anahtarlar "hizmet" (hizmet toplamı) ve "hizmet|parametre".
// Dönem değişince yalnız o dönemin sayacı sıfırlanır. Dosya yok → boş defter (yok: true; sunucu Quota/My kontrolü yabancı
// kullanımı yakalar). Bozuk → bozuk: true → o çalışmada istek yok. Actions cache ile çalışmalar arasında taşınır.
import fs from "node:fs/promises";
import path from "node:path";
import { hizmetParametre, ciftAnahtari } from "./kota.mjs";

const bos = (gun) => ({ gun, ay: gun.slice(0, 7), yil: gun.slice(0, 4), sayac: { gun: {}, ay: {}, yil: {} } });
const sayacGecerli = (x) => x && typeof x === "object" && !Array.isArray(x) && Object.values(x).every((v) => Number.isSafeInteger(v) && v >= 0);

/** Dönüş: { gun, ay, yil, sayac: {gun, ay, yil}, bozuk, yok? }. */
export async function kotaDefteriOku(dosya, bugun) {
  if (!dosya) return { ...bos(bugun), bozuk: false, yok: true };
  let ham;
  try { ham = await fs.readFile(dosya, "utf8"); }
  catch (e) { return e.code === "ENOENT" ? { ...bos(bugun), bozuk: false, yok: true } : { ...bos(bugun), bozuk: true }; }
  try {
    const d = JSON.parse(ham);
    if (d?.surum !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(d.gun ?? "") || !["gun", "ay", "yil"].every((k) => sayacGecerli(d.sayac?.[k]))) throw Error("biçim");
    if (d.gun > bugun) throw Error("gelecek tarih");
    const y = bos(bugun);
    if (d.gun === bugun) y.sayac.gun = { ...d.sayac.gun };
    if (d.gun.slice(0, 7) === y.ay) y.sayac.ay = { ...d.sayac.ay };
    if (d.gun.slice(0, 4) === y.yil) y.sayac.yil = { ...d.sayac.yil };
    return { ...y, bozuk: false };
  } catch { return { ...bos(bugun), bozuk: true }; }
}

/** İstemcinin bu çalışmadaki sayaçlarını ({anahtar: n}) üç döneme ekler (yeni nesne). */
export function kotaDefterineEkle(defter, istekSayilari) {
  const d = { ...defter, sayac: { gun: { ...defter.sayac.gun }, ay: { ...defter.sayac.ay }, yil: { ...defter.sayac.yil } } };
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
  const d = { surum: 1, gun: defter.gun, sayac: defter.sayac };
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  const tmp = `${dosya}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 1) + "\n");
  await fs.rename(tmp, dosya);
  return d;
}
