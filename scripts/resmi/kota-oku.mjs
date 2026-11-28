// Kalıcı kota sorgulama aracı ve onaylı teşhis (D23; KOTA-ANALIZI.md §7). Vakit yayını ve veri dosyası yazımı yok.
//  KOTA_MODU=kota   → Auth/Login + Quota/My?includeUnused=true                                    (2 HTTP; Diyanet kotası 0)
//  KOTA_MODU=teshis → Auth/Login + Quota/My?includeUnused=true + Monthly/9541 + Quota/My (varsayılan)
//                     + Monthly/9206 + Quota/My?includeUnused=true                                   (6 HTTP; Monthly hizmetinde 2)
//                     Kullanıcı onayı 28.11.2026: en çok 6 HTTP; otomatik tekrar ve ek istek yok.
// Çıktı: TOKEN_OZET (değersiz), KOTA_HAM <adım> (gizli alanlar atılmış ham yanıt), KOTA_TABLO (API / BELGE / DEFTER ayrı),
// GITHUB_STEP_SUMMARY'ye tablo. Durma: kimlik doğrulama hatası, HTTP/kota reddi (401/403/429/5xx), Quota/My aşım bildirimi,
// gizli bilgi sızıntısı şüphesi. Boş kota listesi ya da yanıtın ayrıştırılamaması teşhisi DURDURMAZ (ham yanıt incelenir).
// Bütün HTTP istekleri operasyonel deftere, sayılan istekler (giriş/yenileme/Quota/My hariç) Diyanet kota defterine yazılır.
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { AwqatIstemci } from "./awqat-adaptor.mjs";
import { defterOku, calismaSiniri, defterYaz } from "./defter.mjs";
import { kotaDefteriOku, kotaDefterineEkle, kotaDefteriYaz } from "./kota-defteri.mjs";
import { kotaOku, kotaYapisi } from "./kota.mjs";
import { kotaTablosu, kotaTablosuMd } from "./kota-tablo.mjs";

const GIZLI_ANAHTAR = /token|auth|pass|sifre|şifre|email|mail|user|kullanici|secret/i;
export function temizle(x, d = 0) {
  if (d > 8) return "[derin]";
  if (Array.isArray(x)) return x.map((y) => temizle(y, d + 1));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).filter(([k]) => !GIZLI_ANAHTAR.test(k)).map(([k, v]) => [k, temizle(v, d + 1)]));
  if (typeof x === "string" && (/@/.test(x) || /^[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}$/.test(x))) return "[gizli]";
  return x;
}

export const PLANLAR = Object.freeze({
  kota: ["kotaTum"],
  teshis: ["kotaTum", ["aylik", 9541], "kota", ["aylik", 9206], "kotaTum"],
});

export async function calistir(env = process.env, yaz = console.log, hata = console.error) {
  const mod = env.KOTA_MODU ?? "kota";
  if (!PLANLAR[mod]) { hata("HATA: KOTA_MODU kota ya da teshis olmalı"); return 2; }
  const plan = PLANLAR[mod], httpSayisi = 1 + plan.length;
  const bugun = env.TODAY ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const sozlesme = JSON.parse(await fs.readFile(env.AWQAT_SOZLESME ?? "config/awqat-sozlesme.json", "utf8"));
  if (env.AWQAT_BASE_URL) sozlesme.baseUrl = env.AWQAT_BASE_URL; // yalnız testler (yerel sahte sunucu)
  const kural = sozlesme.kota, zorunlu = env.KOTA_DEFTERI_ZORUNLU === "evet";
  const defter = await defterOku(env.AWQAT_DEFTER, bugun, { zorunlu });
  const sinir = calismaSiniri({ envSinir: httpSayisi, tavan: Number(env.GUNLUK_ISTEK_TAVANI ?? 100), defter });
  const kotaDefteri = await kotaDefteriOku(env.AWQAT_KOTA_DEFTERI, bugun, { zorunlu });
  yaz(`Mod ${mod}: en çok ${httpSayisi} HTTP. Operasyonel defter bugün ${Number.isFinite(defter.toplam) ? defter.toplam : "okunamadı"}; bu çalışmanın tavanı ${sinir}.`);
  if (kotaDefteri.bozuk) { hata(`HATA: kota defteri okunamadı (${kotaDefteri.sebep ?? "bozuk"}); istek gönderilmedi.`); return 3; }
  if (sinir < httpSayisi) { hata("HATA: operasyonel günlük HTTP sınırı yetmiyor ya da defter okunamadı; istek gönderilmedi."); return 3; }
  const istemci = new AwqatIstemci({ sozlesme, email: env.AWQAT_EMAIL, sifre: env.AWQAT_PASSWORD, toplamIstekSiniri: httpSayisi, tekrarYok: true,
    timeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 20_000) });
  const ozet = { mod, adimlar: [] };
  let kod = 0, adim = 1, sonKota = null;
  const guvenliYaz = (etiket, nesne) => {
    const m = JSON.stringify(nesne);
    if (istemci.gizliIcerir(m)) throw Object.assign(new Error("çıktıda gizli bilgi bulundu; yazdırılmadı"), { kod: "GUVENLIK" });
    yaz(`${etiket} ${m}`);
  };
  try {
    for (const p of plan) {
      adim++;
      if (p === "kota" || p === "kotaTum") {
        const kota = await istemci.getir(p, {});
        if (adim === 2) guvenliYaz("TOKEN_OZET", istemci.tokenBilgisi);
        guvenliYaz(`KOTA_HAM ${adim} ${p === "kotaTum" ? "includeUnused=true" : "varsayılan"}`, temizle(kota));
        const y = kotaYapisi(kota);
        if (!y.okunabilir) yaz(`  ayrıştırılamadı (teşhis sürer): ${y.neden}`);
        const g = kotaOku(kota)?.gruplar ?? [];
        ozet.adimlar.push({ adim, uc: p, gruplar: g.length, okunabilir: y.okunabilir });
        if (g.some((x) => x.asildi)) throw Object.assign(new Error("Quota/My aşım bildiriyor (totalExceeded > 0)"), { kod: "KOTA" });
        sonKota = kota;
      } else {
        const [, id] = p;
        const gunler = await istemci.aylik(id);
        yaz(`Monthly/${id}: ${gunler.length} gün (${gunler[0]?.t} – ${gunler.at(-1)?.t}); yayına yazılmadı.`);
        ozet.adimlar.push({ adim, uc: `Monthly/${id}`, gun: gunler.length });
      }
    }
  } catch (e) { hata(`DURDU (adım ${adim}): ${e.kod ?? "HATA"}: ${istemci.maskele(e.message)} — kalan adımlar gönderilmedi.`); kod = 1; }
  finally {
    const yeniKota = kotaDefterineEkle(kotaDefteri, istemci.istekSayilari);
    if (env.AWQAT_DEFTER) await defterYaz(env.AWQAT_DEFTER, defter, { calisma: env.GITHUB_RUN_ID ?? "yerel", uc: `kota-oku/${mod}`, istek: istemci.toplamIstek });
    if (env.AWQAT_KOTA_DEFTERI) await kotaDefteriYaz(env.AWQAT_KOTA_DEFTERI, yeniKota);
    const tablo = kotaTablosu(sonKota, { kotaDefteri: yeniKota, kural, bugun });
    const md = kotaTablosuMd(tablo);
    yaz(`KOTA_TABLO ${JSON.stringify(tablo)}`);
    yaz(md);
    if (env.GITHUB_STEP_SUMMARY) await fs.appendFile(env.GITHUB_STEP_SUMMARY, `## Diyanet kota durumu (${bugun}, ${mod})\n\nAPI = Quota/My'nin bildirdiği · BELGE = resmî dokümantasyon · DEFTER = kendi sayımımız\n\n${md}\n\nHTTP istek: ${istemci.toplamIstek}\n`);
    yaz(`HTTP istek: ${istemci.toplamIstek} ${JSON.stringify(istemci.istekSayilari)}`);
    yaz(`KOTA_OKU_OZET ${JSON.stringify({ ...ozet, http: istemci.toplamIstek, kod })}`);
  }
  return kod;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await calistir();
