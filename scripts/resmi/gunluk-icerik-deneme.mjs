// Awqat DailyContent biçim denemesi (D18, kullanıcı isteği 27.11.2026): Arapça metin dönüyor mu?
// Kesin en çok 3 istek: giriş 1 + Quota/My 1 + GET /api/DailyContent 1. Tekrar yok. Hiçbir yayın dosyasına yazmaz.
// Rapor: yanıtın YAPISI (anahtarlar, türler), her metin alanının uzunluğu, Arapça harf oranı ve kısa önizleme.
//   ALLOW_LIVE_API=evet node scripts/resmi/gunluk-icerik-deneme.mjs
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { AwqatIstemci } from "./awqat-adaptor.mjs";
import { izinVerilen, enAzKalan } from "./kota.mjs";

export const DENEME_ISTEK = 3;
const ARAPCA = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;

/** Saf: değerin yapısını çıkarır; metinler için uzunluk, Arapça harf oranı ve en çok 60 karakter önizleme. */
export function yapi(x, derinlik = 0) {
  if (derinlik > 6) return "…";
  if (Array.isArray(x)) return { tur: "liste", uzunluk: x.length, ornek: x.length ? yapi(x[0], derinlik + 1) : null };
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, yapi(v, derinlik + 1)]));
  if (typeof x === "string") {
    const ar = (x.match(ARAPCA) ?? []).length, harf = x.replace(/\s/g, "").length || 1;
    return { tur: "metin", uzunluk: x.length, arapcaOrani: Math.round((ar / harf) * 100) / 100, onizleme: x.slice(0, 60) };
  }
  return { tur: typeof x, deger: typeof x === "number" || typeof x === "boolean" || x === null ? x : undefined };
}
/** Saf: yapı içinde Arapça ağırlıklı (oran ≥ 0,5) metin alanlarının yolları. */
export function arapcaAlanlari(y, yol = "") {
  if (!y || typeof y !== "object") return [];
  if (y.tur === "metin") return y.arapcaOrani >= 0.5 ? [yol] : [];
  if (y.tur === "liste") return arapcaAlanlari(y.ornek, yol + "[0]");
  return Object.entries(y).flatMap(([k, v]) => arapcaAlanlari(v, yol ? `${yol}.${k}` : k));
}

export async function cli(env = process.env) {
  if (env.ALLOW_LIVE_API !== "evet") { console.error("Canlı API kapalı: ALLOW_LIVE_API=evet gerekir."); return 2; }
  if (!env.AWQAT_EMAIL || !env.AWQAT_PASSWORD) { console.error("AWQAT_EMAIL ve AWQAT_PASSWORD gerekli; istek gönderilmedi."); return 2; }
  const sozlesme = JSON.parse(await fs.readFile("config/awqat-sozlesme.json", "utf8"));
  if (env.AWQAT_BASE_URL) sozlesme.baseUrl = env.AWQAT_BASE_URL; // yalnız yerel test sunucusu
  const istemci = new AwqatIstemci({ sozlesme, email: env.AWQAT_EMAIL, sifre: env.AWQAT_PASSWORD, toplamIstekSiniri: DENEME_ISTEK, tekrarYok: true });
  let veri;
  try {
    const kota = await istemci.getir("kota", {});
    const kalan = enAzKalan(kota);
    // Kota yenilenmesi doğrulanmadan DailyContent istenmez (üretimdeki ilk çalışma kuralıyla aynı: en az kalan >= 90).
    if (!(kalan >= Number(env.ASGARI_KALAN ?? 90))) { console.error(`DURDU: kota yenilenmiş görünmüyor (en az kalan ${kalan}); DailyContent istenmedi.`); return 5; }
    const izin = izinVerilen(kota);
    if (izin < 1) { console.error(`DURDU: kalan hak yetersiz/bilinmiyor (izin ${izin}); DailyContent istenmedi.`); return 5; }
    veri = await istemci.getir("gunlukIcerik", {});
  } catch (e) { console.error(`DURDU: ${e.kod ?? "HATA"}: ${istemci.maskele(e.message)} (istek ${istemci.toplamIstek})`); return 1; }
  const y = yapi(veri);
  const rapor = { istek: istemci.toplamIstek, arapcaAlanlari: arapcaAlanlari(y), yapi: y };
  const metin = istemci.maskele(JSON.stringify(rapor));
  if (istemci.gizliIcerir(metin)) { console.error("Rapor gizli değer içeriyor; basılmadı."); return 3; }
  console.log("DAILYCONTENT_RAPOR " + metin);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await cli();
