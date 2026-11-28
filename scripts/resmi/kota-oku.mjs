// Yalnız Quota/My okuması (28.11.2026, kullanıcı isteği): günlük/aylık/yıllık hakları ve parametre satırlarını HAM görmek.
// Canlı istek: giriş 1 + Quota/My 1 = 2. Vakit isteği ve dosya yazımı yok (yalnız ortak günlük defter). Günlük 100 tavanı uygulanır.
// Çıktı: KOTA_HAM — yanıtın tamamı; yalnız gizli olabilecek alanlar atılır (anahtar adı token/auth/pass/email/user, '@' içeren
// ya da JWT biçimli değerler). Sayılar, dönemler, uç yolları ve parametre değerleri olduğu gibi kalır.
import fs from "node:fs/promises";
import { AwqatIstemci } from "./awqat-adaptor.mjs";
import { defterOku, calismaSiniri, defterYaz } from "./defter.mjs";

const GIZLI_ANAHTAR = /token|auth|pass|sifre|şifre|email|mail|user|kullanici|secret/i;
export function temizle(x, d = 0) {
  if (d > 8) return "[derin]";
  if (Array.isArray(x)) return x.map((y) => temizle(y, d + 1));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).filter(([k]) => !GIZLI_ANAHTAR.test(k)).map(([k, v]) => [k, temizle(v, d + 1)]));
  if (typeof x === "string" && (/@/.test(x) || /^[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}$/.test(x))) return "[gizli]";
  return x;
}

const bugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const sozlesme = JSON.parse(await fs.readFile(process.env.AWQAT_SOZLESME ?? "config/awqat-sozlesme.json", "utf8"));
if (process.env.AWQAT_BASE_URL) sozlesme.baseUrl = process.env.AWQAT_BASE_URL; // yalnız testler
const defter = await defterOku(process.env.AWQAT_DEFTER, bugun);
const sinir = calismaSiniri({ envSinir: 2, tavan: Number(process.env.GUNLUK_ISTEK_TAVANI ?? 100), defter });
console.log(`Günlük defter: bugün ${defter.toplam} istek kayıtlı; bu okumanın tavanı ${sinir}.`);
if (sinir < 2) { console.error("HATA: günlük istek tavanı doldu ya da defter bozuk; istek gönderilmedi."); process.exit(3); }
const istemci = new AwqatIstemci({ sozlesme, email: process.env.AWQAT_EMAIL, sifre: process.env.AWQAT_PASSWORD, toplamIstekSiniri: 2, tekrarYok: true,
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000) });
let kod = 0;
try {
  const kota = await istemci.getir("kota", {});
  const ham = JSON.stringify(temizle(kota));
  if (istemci.gizliIcerir(ham)) throw new Error("çıktıda gizli bilgi bulundu; yazdırılmadı");
  console.log(`KOTA_HAM ${ham}`);
  for (const d of ["daily", "weekly", "monthly", "yearly"]) {
    const g = Array.isArray(kota?.[d]) ? kota[d] : null;
    console.log(`${d}: ${g === null ? "yok/dizi değil" : g.length + " grup" + (g.length ? " — " + g.map((x) => `sınır ${x?.benefit}, kullanılan ${x?.totalUsed}, aşım ${x?.totalExceeded}, satır ${Array.isArray(x?.lines) ? x.lines.length : "-"}`).join("; ") : "")}`);
  }
} catch (e) { console.error(`HATA: ${istemci.maskele(e.message)}`); kod = 1; }
finally {
  if (process.env.AWQAT_DEFTER) await defterYaz(process.env.AWQAT_DEFTER, defter, { calisma: process.env.GITHUB_RUN_ID ?? "yerel", uc: "kota-oku", istek: istemci.toplamIstek });
  console.log(`Canlı istek: ${istemci.toplamIstek}`);
}
process.exit(kod);
