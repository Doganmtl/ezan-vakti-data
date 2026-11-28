// Günlük canlı istek defteri (9. tur). Bütün Data operasyonları için ortak günlük tavan: GUNLUK_ISTEK_TAVANI (varsayılan 100)
// HTTP isteği — giriş, token yenileme, Quota/My, başarısız ve tekrarlanan istekler dahil. Defter Actions cache ile çalışmalar
// arasında taşınır (concurrency grubu veri-guncelleme: çalışmalar sırayla). Fail-closed:
//  - defter dosyası yok → günün ilk çalışması (ek koşul: kota gerçekten yenilenmiş olmalı, guncelle.mjs)
//  - defter bozuk / başka güne ait değil ama okunamıyor → tavan 0 (istek yok)
import fs from "node:fs/promises";
import path from "node:path";

export const GUNLUK_ISTEK_TAVANI = 100;

/** Defteri okur. Dönüş: { gun, toplam, calismalar, ilk, bozuk }. */
export async function defterOku(dosya, bugun) {
  if (!dosya) return { gun: bugun, toplam: 0, calismalar: [], sayac: {}, ilk: true, bozuk: false, yok: true };
  let ham;
  try { ham = await fs.readFile(dosya, "utf8"); }
  catch (e) { if (e.code === "ENOENT") return { gun: bugun, toplam: 0, calismalar: [], sayac: {}, ilk: true, bozuk: false }; return { gun: bugun, toplam: Infinity, calismalar: [], sayac: {}, ilk: false, bozuk: true }; }
  try {
    const d = JSON.parse(ham);
    if (d?.surum !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(d.gun ?? "") || !Array.isArray(d.calismalar)) throw Error("biçim");
    const toplam = d.calismalar.reduce((a, c) => { if (!Number.isSafeInteger(c?.istek) || c.istek < 0) throw Error("kayıt"); return a + c.istek; }, 0);
    if (toplam !== d.toplam) throw Error("toplam");
    const sayac = d.sayac ?? {};
    if (typeof sayac !== "object" || Array.isArray(sayac) || Object.values(sayac).some((v) => !Number.isSafeInteger(v) || v < 0)) throw Error("sayaç");
    if (d.gun !== bugun) return { gun: bugun, toplam: 0, calismalar: [], sayac: {}, ilk: true, bozuk: false, onceki: d.gun };
    return { gun: bugun, toplam, calismalar: d.calismalar, sayac: { ...sayac }, ilk: d.calismalar.length === 0, bozuk: false };
  } catch { return { gun: bugun, toplam: Infinity, calismalar: [], sayac: {}, ilk: false, bozuk: true }; }
}

/** Bu çalışmanın toplam istek tavanı: min(ortam sınırı, günlük tavan − bugün kullanılan). Bozuk defter → 0. */
export function calismaSiniri({ envSinir, tavan = GUNLUK_ISTEK_TAVANI, defter }) {
  if (!Number.isSafeInteger(tavan) || tavan < 1 || defter.bozuk || !Number.isFinite(defter.toplam)) return 0;
  return Math.max(0, Math.min(envSinir, tavan - defter.toplam));
}

/** Bu çalışmanın kullanımını ekleyip atomik yazar. */
export async function defterYaz(dosya, defter, { calisma, uc, istek, istekSayilari = {} }) {
  const calismalar = [...defter.calismalar, { calisma: String(calisma), uc: uc ?? null, istek, zaman: new Date().toISOString() }];
  // sayac: bugün (hizmet|parametre) başına gönderilen istek (başarısızlar dahil; giriş/yenileme/Quota/My hariç). Kota kuralı 2/3.
  const { hizmetParametre, ciftAnahtari } = await import("./kota.mjs");
  const sayac = { ...(defter.sayac ?? {}) };
  for (const [a, n] of Object.entries(istekSayilari)) { const c = hizmetParametre(a); if (c) { const k = ciftAnahtari(c.hizmet, c.parametre); sayac[k] = (sayac[k] ?? 0) + n; } }
  const d = { surum: 1, gun: defter.gun, toplam: calismalar.reduce((a, c) => a + c.istek, 0), calismalar, sayac };
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  const tmp = `${dosya}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 1) + "\n");
  await fs.rename(tmp, dosya);
  return d;
}

// ---- DateRange aylık yer defteri (28.11.2026) ----
// Belge: DateRange yer bazında AYLIK 10 istek. Çalışma sonunda istemcinin saydığı her DateRange gönderimi (başarısızlar dahil) yere eklenir.
// Dosya yok → ayın ilk kaydı (Actions cache ay anahtarlı; ay içinde her gün okunduğu için 7 günlük silinmeye düşmez).
// Bozuk ya da tutarsız → bozuk (DateRange isteği yok).

/** Dönüş: { ay, yerler: {resmiId: n}, bozuk }. */
export async function aylikDefterOku(dosya, ay) {
  if (!dosya) return { ay, yerler: {}, bozuk: false, yok: true };
  let ham;
  try { ham = await fs.readFile(dosya, "utf8"); }
  catch (e) { return e.code === "ENOENT" ? { ay, yerler: {}, bozuk: false } : { ay, yerler: {}, bozuk: true }; }
  try {
    const d = JSON.parse(ham);
    if (d?.surum !== 1 || !/^\d{4}-\d{2}$/.test(d.ay ?? "") || !d.yerler || typeof d.yerler !== "object" || Array.isArray(d.yerler)) throw Error("biçim");
    for (const [k, v] of Object.entries(d.yerler)) if (!/^\d+$/.test(k) || !Number.isSafeInteger(v) || v < 0) throw Error("kayıt");
    if (d.ay !== ay) return { ay, yerler: {}, bozuk: false, onceki: d.ay };
    return { ay, yerler: { ...d.yerler }, bozuk: false };
  } catch { return { ay, yerler: {}, bozuk: true }; }
}

export async function aylikDefterYaz(dosya, defter) {
  if (defter.bozuk) return null; // bozuk defterin üzerine yazılmaz (elle incelenir)
  const d = { surum: 1, ay: defter.ay, yerler: defter.yerler };
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  const tmp = `${dosya}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 1) + "\n");
  await fs.rename(tmp, dosya);
  return d;
}
