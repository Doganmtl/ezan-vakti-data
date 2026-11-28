// Kontrollü kota teşhisi (KOTA-ANALIZI.md §7; kullanıcı onayıyla elle). Vakit yayını ve dosya yazımı yok; yalnız iki defter.
//  KOTA_MODU=kota   → giriş + Quota/My                                            (2 HTTP, Diyanet kotası: 0)
//  KOTA_MODU=teshis → giriş + Quota/My + Monthly/9541 + Quota/My + Monthly/9206 + Quota/My (6 HTTP, Monthly hizmetinde 2)
// Her Quota/My yanıtı gizli alanlar atılarak ham yazdırılır (KOTA_HAM <adım> …). Herhangi bir hata, aşım ya da yabancı kullanım
// → kalan adımlar gönderilmez. Operasyonel 100 HTTP sınırı ve kota defteri (D18) uygulanır; istekler iki deftere de yazılır.
import fs from "node:fs/promises";
import { AwqatIstemci } from "./awqat-adaptor.mjs";
import { defterOku, calismaSiniri, defterYaz } from "./defter.mjs";
import { kotaDefteriOku, kotaDefterineEkle, kotaDefteriYaz, calismaSayaci } from "./kota-defteri.mjs";
import { hizmetDurumu, parametreIzni, kotaLogOzeti } from "./kota.mjs";

const GIZLI_ANAHTAR = /token|auth|pass|sifre|şifre|email|mail|user|kullanici|secret/i;
export function temizle(x, d = 0) {
  if (d > 8) return "[derin]";
  if (Array.isArray(x)) return x.map((y) => temizle(y, d + 1));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).filter(([k]) => !GIZLI_ANAHTAR.test(k)).map(([k, v]) => [k, temizle(v, d + 1)]));
  if (typeof x === "string" && (/@/.test(x) || /^[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}$/.test(x))) return "[gizli]";
  return x;
}

const mod = process.env.KOTA_MODU ?? "kota";
if (!["kota", "teshis"].includes(mod)) { console.error("HATA: KOTA_MODU kota ya da teshis olmalı"); process.exit(2); }
const plan = mod === "kota" ? ["kota"] : ["kota", ["aylik", 9541], "kota", ["aylik", 9206], "kota"];
const httpSayisi = 1 + plan.length;
const bugun = process.env.TODAY ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const sozlesme = JSON.parse(await fs.readFile(process.env.AWQAT_SOZLESME ?? "config/awqat-sozlesme.json", "utf8"));
if (process.env.AWQAT_BASE_URL) sozlesme.baseUrl = process.env.AWQAT_BASE_URL; // yalnız testler
// İstemci koruması aynı uç+parametreyi çalışma başına 2 ile sınırlar; teşhis Quota/My'yi 3 kez okur (kota sayılmaz, kanıt §4).
// Plan sabit olduğu için koruma bu çalışmada 3'e çıkar; Monthly parametreleri yine birer kez istenir (parametreIzni azami 1).
const kural = sozlesme.kota;
if (mod === "teshis") sozlesme.kota = { ...sozlesme.kota, calismaBasinaUcParametreAzami: 3 };
const defter = await defterOku(process.env.AWQAT_DEFTER, bugun);
const sinir = calismaSiniri({ envSinir: httpSayisi, tavan: Number(process.env.GUNLUK_ISTEK_TAVANI ?? 100), defter });
const kotaDefteri = await kotaDefteriOku(process.env.AWQAT_KOTA_DEFTERI, bugun);
console.log(`Mod ${mod}: en çok ${httpSayisi} HTTP. Operasyonel defter bugün ${defter.toplam}; bu çalışmanın tavanı ${sinir}.`);
if (sinir < httpSayisi) { console.error("HATA: operasyonel günlük HTTP sınırı yetmiyor ya da defter bozuk; istek gönderilmedi."); process.exit(3); }
if (kotaDefteri.bozuk) { console.error("HATA: kota defteri bozuk; istek gönderilmedi."); process.exit(3); }
const istemci = new AwqatIstemci({ sozlesme, email: process.env.AWQAT_EMAIL, sifre: process.env.AWQAT_PASSWORD, toplamIstekSiniri: httpSayisi, tekrarYok: true,
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000) });
let kod = 0, adim = 0;
try {
  for (const p of plan) {
    adim++;
    if (p === "kota") {
      const kota = await istemci.getir("kota", {});
      const ham = JSON.stringify(temizle(kota));
      if (istemci.gizliIcerir(ham)) throw new Error("çıktıda gizli bilgi bulundu; yazdırılmadı");
      console.log(`KOTA_HAM ${adim} ${ham}`);
      const o = kotaLogOzeti(kota);
      for (const d of ["daily", "weekly", "monthly", "yearly"]) console.log(`  ${d}: ${(o[d] ?? []).length} grup${(o[d] ?? []).map((x) => ` [sınır ${x.benefit}, kullanılan ${x.totalUsed}, aşım ${x.totalExceeded}, satır ${x.satir}]`).join("")}`);
      const durum = hizmetDurumu(kota, { hizmet: "PrayerTime/Monthly", kotaDefteri: kotaDefterineEkle(kotaDefteri, istemci.istekSayilari), kural, bugun });
      console.log(`KOTA_DURUM ${adim} ${JSON.stringify(durum)}`);
      if (!durum.izin) throw new Error(`durdu: ${durum.sebep}`);
      plan.durum = durum;
    } else {
      const [, id] = p;
      const r = parametreIzni({ durum: plan.durum, hizmet: "PrayerTime/Monthly", parametre: String(id), kotaDefteri, calisma: calismaSayaci(istemci.istekSayilari), kural, azami: 1 });
      if (!r.izin) throw new Error(`durdu: ${r.sebep}`);
      const gunler = await istemci.aylik(id);
      console.log(`Monthly/${id}: ${gunler.length} gün (${gunler[0]?.t} – ${gunler.at(-1)?.t}); yayına yazılmadı.`);
    }
  }
} catch (e) { console.error(`HATA (adım ${adim}): ${istemci.maskele(e.message)}`); kod = 1; }
finally {
  if (process.env.AWQAT_DEFTER) await defterYaz(process.env.AWQAT_DEFTER, defter, { calisma: process.env.GITHUB_RUN_ID ?? "yerel", uc: `kota-oku/${mod}`, istek: istemci.toplamIstek });
  if (process.env.AWQAT_KOTA_DEFTERI) await kotaDefteriYaz(process.env.AWQAT_KOTA_DEFTERI, kotaDefterineEkle(kotaDefteri, istemci.istekSayilari));
  console.log(`HTTP istek: ${istemci.toplamIstek} ${JSON.stringify(istemci.istekSayilari)}`);
}
process.exit(kod);
