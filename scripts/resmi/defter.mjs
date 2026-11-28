// OPERASYONEL günlük HTTP istek defteri (9. tur, kullanıcı kuralı D16). Diyanet'in servis kotası DEĞİLDİR (o: kota-defteri.mjs).
// Bütün Data operasyonları için kullanıcının belirlediği ortak günlük tavan: GUNLUK_ISTEK_TAVANI (varsayılan 100)
// HTTP isteği — giriş, token yenileme, Quota/My, başarısız ve tekrarlanan istekler dahil. Defter Actions cache ile çalışmalar
// arasında taşınır (concurrency grubu veri-guncelleme: çalışmalar sırayla). Fail-closed:
//  - defter dosyası yok → günün ilk çalışması; zorunlu (üretim, kota-defteri dalı) ise bozuk → istek yok
//  - defter bozuk / başka güne ait değil ama okunamıyor → tavan 0 (istek yok)
import fs from "node:fs/promises";
import path from "node:path";

export const GUNLUK_ISTEK_TAVANI = 100;

/** Defteri okur. Dönüş: { gun, toplam, calismalar, ilk, bozuk }. */
export async function defterOku(dosya, bugun, { zorunlu = false } = {}) {
  if (!dosya) return zorunlu ? { gun: bugun, toplam: Infinity, calismalar: [], ilk: false, bozuk: true } : { gun: bugun, toplam: 0, calismalar: [], ilk: true, bozuk: false, yok: true };
  let ham;
  try { ham = await fs.readFile(dosya, "utf8"); }
  catch (e) { if (e.code === "ENOENT" && !zorunlu) return { gun: bugun, toplam: 0, calismalar: [], ilk: true, bozuk: false }; return { gun: bugun, toplam: Infinity, calismalar: [], ilk: false, bozuk: true }; }
  try {
    const d = JSON.parse(ham);
    if (d?.surum !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(d.gun ?? "") || !Array.isArray(d.calismalar)) throw Error("biçim");
    const toplam = d.calismalar.reduce((a, c) => { if (!Number.isSafeInteger(c?.istek) || c.istek < 0) throw Error("kayıt"); return a + c.istek; }, 0);
    if (toplam !== d.toplam) throw Error("toplam");
    if (d.gun !== bugun) return { gun: bugun, toplam: 0, calismalar: [], ilk: true, bozuk: false, onceki: d.gun };
    return { gun: bugun, toplam, calismalar: d.calismalar, ilk: d.calismalar.length === 0, bozuk: false };
  } catch { return { gun: bugun, toplam: Infinity, calismalar: [], ilk: false, bozuk: true }; }
}

/** Bu çalışmanın toplam istek tavanı: min(ortam sınırı, günlük tavan − bugün kullanılan). Bozuk defter → 0. */
export function calismaSiniri({ envSinir, tavan = GUNLUK_ISTEK_TAVANI, defter }) {
  if (defter.bozuk || !Number.isFinite(defter.toplam)) return 0;
  if (tavan === Infinity) return Math.max(0, envSinir); // D24: ortak günlük tavan yok; çalışma (grup) tavanı ve HTTP kaydı sürer
  if (!Number.isSafeInteger(tavan) || tavan < 1) return 0;
  return Math.max(0, Math.min(envSinir, tavan - defter.toplam));
}

/**
 * GUNLUK_ISTEK_TAVANI ortam değeri: sayı → o tavan; "yok" → ortak günlük tavan yok (D24, kullanıcı onayıyla etkinleşir);
 * tanımsız → 100 (eski güvenli varsayılan); başka her şey → 0 (istek yok).
 */
export function tavanOku(deger) {
  if (deger === undefined || deger === "") return GUNLUK_ISTEK_TAVANI;
  if (String(deger).trim().toLowerCase() === "yok") return Infinity;
  const n = Number(deger);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/**
 * Önceden yazma (ani kesinti): çalışma ilk istekten önce kendi HTTP tavanını rezerv kaydı olarak yazar. Normal bitişte
 * defterYaz bu kaydı gerçek sayıyla değiştirir; runner ölürse rezerv kaydı kalır ve tüketilmiş sayılır (fazla sayım).
 */
export async function rezervYaz(dosya, defter, { calisma, uc, istek }) {
  return defterYaz(dosya, defter, { calisma, uc, istek, rezerv: true });
}

/** Bu çalışmanın kullanımını ekleyip atomik yazar (aynı çalışmanın rezerv kaydı varsa yerine geçer). */
export async function defterYaz(dosya, defter, { calisma, uc, istek, rezerv = false }) {
  const calismalar = [...defter.calismalar.filter((c) => !(c.rezerv && c.calisma === String(calisma))),
    { calisma: String(calisma), uc: uc ?? null, istek, zaman: new Date().toISOString(), ...(rezerv ? { rezerv: true } : {}) }];
  const d = { surum: 1, gun: defter.gun, toplam: calismalar.reduce((a, c) => a + c.istek, 0), calismalar };
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  const tmp = `${dosya}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 1) + "\n");
  await fs.rename(tmp, dosya);
  return d;
}
