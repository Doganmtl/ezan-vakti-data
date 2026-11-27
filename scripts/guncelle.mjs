// Türkiye'deki tüm il ve ilçelerin namaz vakitlerini Diyanet kaynaklı veriden çeker,
// doğrular ve docs/v1 altına küçük JSON dosyaları olarak yazar (GitHub Pages ile yayınlanır).
//
// Çıktı:
//   docs/v1/iller.json                 [{ id, ad }]
//   docs/v1/ilceler/{ilId}.json        [{ id, ad }]
//   docs/v1/vakitler/{ilceId}.json     { guncelleme, gunler: [{ t: "18.11.2026", v: [imsak, gunes, ogle, ikindi, aksam, yatsi], h }] }
//   docs/v1/meta.json                  { guncelleme, kaynak, ilSayisi, ilceSayisi, uyarilar }
//
// Bir şey ters giderse (eksik il, bozuk veri, çok sayıda hatalı ilçe) hiçbir dosyaya dokunmadan
// hata koduyla çıkar; böylece yayındaki veri bozulmaz ve GitHub size e-posta ile haber verir.
//
// Ortam değişkenleri (hepsi isteğe bağlı):
//   SOURCE_URL   Kaynak servis (varsayılan: https://ezanvakti.emushaf.net)
//   OUT_DIR      Çıktı klasörü (varsayılan: docs/v1)
//   DELAY_MS     İstekler arası bekleme, kaynağı yormamak için (varsayılan: 2000)
//   TODAY        Test için "bugün" (YYYY-MM-DD)

import fs from "node:fs/promises";
import path from "node:path";
import { yazToplu } from "./atomik-yaz.mjs";
import { isoTarih, gunEkle, listeDogrula, gunlerDogrula } from "./v1-dogrulama.mjs";
import { gecisYukle, onayliEklemeler, ilceBirlestir } from "./kimlik.mjs";
import { siniflandir, yayinKarari } from "./esik.mjs";
import { bilinenEksikYukle } from "./bilinen-eksik.mjs";

const SOURCE = (process.env.SOURCE_URL ?? "https://ezanvakti.emushaf.net").replace(/\/$/, "");
const OUT = process.env.OUT_DIR ?? "docs/v1";
const DELAY_MS = Number(process.env.DELAY_MS ?? 2000);           // kaynak ~1 istek/sn'de 429 veriyor
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS ?? 1000);
const RATE_LIMIT_WAIT_MS = Number(process.env.RATE_LIMIT_WAIT_MS ?? 60_000);
const TURKIYE = 2;

const BEKLENEN_IL_SAYISI = 81;
const MIN_ILERI_GUN = 14;        // her ilçe için en az bu kadar gün ileriye veri olmalı
const GECMIS_TUT_GUN = 2;        // geçmişe dönük tutulan gün (gece yarısı/yatsı hesabı için)
// Kaynaktan alınamayan ilçe oranı (yedekle karşılananlar dahil). Üstü kaynak çapında arıza sayılır.
const MAX_HATALI_ILCE_ORANI = Number(process.env.MAX_HATALI_ILCE_ORANI ?? 0.02);
// Kullanılabilir verisi kalmayan (süresi dolmuş + eksik) ilçe oranı. ÖNERİ, kullanıcı onayı bekliyor:
// 868 aktif ilçede %1 ≈ 8 ilçe. Bunun altı tek tük kaynak hatasıdır ve kısmi yayın diğer ilçeleri korur;
// üstü sistematik sorundur, hiçbir dosya yazılmaz.
const MAX_KRITIK_ILCE_ORANI = Number(process.env.MAX_KRITIK_ILCE_ORANI ?? 0.01);

// Bilinen istisnalar kaynağa göre config/bilinen-eksik.json'dan okunur (ayna: 33292; resmi: boş).
// İlçe listesinde kalırlar; dosyalarına dokunulmaz, oranlara girmezler.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Tarih yardımcıları (İstanbul saati) ----------

function bugunIstanbul() {
  if (process.env.TODAY) return process.env.TODAY;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()); // YYYY-MM-DD
}
/** "18.11.2026" → "2026-11-18" */


// ---------- Ağ ----------

async function getJson(url, deneme = 6) {
  let sonHata;
  for (let i = 0; i < deneme; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ezan-vakti-data (github actions)" },
        signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000)),
        redirect: "error",
      });
      if (res.status === 429) {
        // Kaynak "çok fazla istek" dedi: söylediği kadar (yoksa 60 sn, giderek artan) bekle ve tekrar dene.
        const retryAfter = Number(res.headers.get("retry-after"));
        const bekle = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_WAIT_MS * (i + 1);
        console.log(`  … 429 (çok fazla istek), ${Math.round(bekle / 1000)} sn bekleniyor`);
        sonHata = new Error("HTTP 429");
        await sleep(bekle);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      sonHata = e;
      await sleep(RETRY_BASE_MS * 2 ** i); // 1, 2, 4, 8 … sn
    }
  }
  throw new Error(`${url} alınamadı: ${sonHata?.message}`);
}

// ---------- Doğrulama ----------

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;
const TARIH = /^\d{2}\.\d{2}\.\d{4}$/;
const dakika = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Kaynağın bir gününü sadeleştirir; geçersizse hata fırlatır. */
function gunuDonustur(g) {
  const t = String(g.MiladiTarihKisa ?? "").trim();
  const v = [g.Imsak, g.Gunes, g.Ogle, g.Ikindi, g.Aksam, g.Yatsi].map((x) => String(x ?? "").trim().slice(0, 5));
  isoTarih(t);
  if (!TARIH.test(t)) throw new Error(`geçersiz tarih: "${t}"`);
  v.forEach((s) => {
    if (!SAAT.test(s)) throw new Error(`${t}: geçersiz saat "${s}"`);
  });
  for (let i = 1; i < 6; i++) {
    if (dakika(v[i]) <= dakika(v[i - 1])) throw new Error(`${t}: vakitler sıralı değil (${v.join(" ")})`);
  }
  const h = g.HicriTarihUzun ? String(g.HicriTarihUzun).trim() : undefined;
  return h ? { t, v, h } : { t, v };
}

// ---------- Dosya ----------

async function okuJson(dosya) {
  try {
    return JSON.parse(await fs.readFile(dosya, "utf8"));
  } catch {
    return null;
  }
}


/**
 * Yeni kaynak verisini eski dosyayla birleştirir. Bugün ve sonrası YALNIZ yeni veriden gelir; eski dosyadan
 * yalnız son GECMIS_TUT_GUN geçmiş gün (gece yarısı/yatsı için) taşınır. Böylece eski kayıtlar yeni zaman
 * damgasıyla "güncel" görünmez. Kapsam (bugün..+14) birleştirmeden ÖNCE yeni veri üzerinde doğrulanır.
 */
function birlestir(eski, yeni, bugun) {
  const alt = gunEkle(bugun, -GECMIS_TUT_GUN);
  const yeniTarih = new Set(yeni.map((g) => g.t));
  const gecmis = (eski ?? []).filter((g) => {
    try { const iso = isoTarih(g.t); return iso >= alt && iso < bugun && !yeniTarih.has(g.t); } catch { return false; }
  });
  return [...gecmis, ...yeni.filter((g) => isoTarih(g.t) >= alt)]
    .sort((a, b) => (isoTarih(a.t) < isoTarih(b.t) ? -1 : 1));
}

// ---------- Kaynaklar ----------
// Her kaynak: { ad, kaynakMetni, iller(), ilceler(il), vakitler(ilceId) }. Kimlikler her zaman v1 kimliğidir.

function aynaKaynagi() {
  return {
    ad: "ayna",
    kaynakMetni: "T.C. Diyanet İşleri Başkanlığı (ezanvakti.emushaf.net aynası üzerinden)",
    async iller() {
      return (await getJson(`${SOURCE}/sehirler/${TURKIYE}`))
        .map((x) => ({ id: Number(x.SehirID), ad: String(x.SehirAdi).trim() }))
        .filter((x) => Number.isInteger(x.id) && x.ad);
    },
    async ilceler(il) {
      await sleep(DELAY_MS);
      return (await getJson(`${SOURCE}/ilceler/${il.id}`))
        .map((x) => ({ id: Number(x.IlceID), ad: String(x.IlceAdi).trim() }))
        .filter((x) => Number.isInteger(x.id) && x.ad);
    },
    async vakitler(id) {
      await sleep(DELAY_MS);
      const ham = await getJson(`${SOURCE}/vakitler/${id}`);
      if (!Array.isArray(ham) || ham.length === 0) throw new Error("boş vakit listesi");
      return ham.map(gunuDonustur);
    },
  };
}

/**
 * Resmi Awqat Salah kaynağı. İl/ilçe listeleri YAYINDAKİ dosyalardan gelir (kimlik koruması; resmi yer
 * kimlikleri henüz doğrulanmadı), vakitler eşleme tablosundaki doğrulanmış `resmi` kimlikle çekilir.
 * Eşlemesi olmayan ilçe kaynaktan alınamamış sayılır ve sınıflandırılır. Açık onay ve istek sınırı zorunlu.
 */
async function resmiKaynagi() {
  if (process.env.RESMI_KAYNAK_ONAYI !== "evet") throw new Error("Resmi kaynak için RESMI_KAYNAK_ONAYI=evet gerekir (kullanıcı onayı).");
  const sinir = Number(process.env.RESMI_TOPLAM_ISTEK_SINIRI);
  if (!Number.isSafeInteger(sinir) || sinir < 1) throw new Error("RESMI_TOPLAM_ISTEK_SINIRI tanımlı değil: kota belirsiz, varsayılan kullanılmaz.");
  const { AwqatIstemci } = await import("./resmi/awqat-adaptor.mjs");
  const sozlesme = JSON.parse(await fs.readFile(process.env.AWQAT_SOZLESME ?? "config/awqat-sozlesme.json", "utf8"));
  if (process.env.AWQAT_BASE_URL) sozlesme.baseUrl = process.env.AWQAT_BASE_URL; // yalnız testler (yerel sahte sunucu)
  const tablo = JSON.parse(await fs.readFile(process.env.ESLESME_TABLOSU ?? "eslesme/ilce-kimlikleri.json", "utf8"));
  const istemci = new AwqatIstemci({ sozlesme, email: process.env.AWQAT_EMAIL, sifre: process.env.AWQAT_PASSWORD,
    toplamIstekSiniri: sinir, timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000),
    ...(process.env.AWQAT_TEST_HIZLI === "1" ? { bekle: async () => {} } : {}) });
  const okuListe = async (f) => { const x = await okuJson(f); if (!Array.isArray(x)) throw new Error(`${f} okunamadı`); return x; };
  return {
    ad: "resmi",
    kaynakMetni: "T.C. Diyanet İşleri Başkanlığı (Awqat Salah resmi API)",
    istemci,
    iller: () => okuListe(path.join(OUT, "iller.json")),
    ilceler: (il) => okuListe(path.join(OUT, "ilceler", `${il.id}.json`)),
    async vakitler(id) {
      const resmi = tablo.ilceler?.[id]?.resmi;
      if (!Number.isSafeInteger(resmi)) throw new Error("resmi kimlik eşlemesi doğrulanmadı");
      await sleep(DELAY_MS);
      return istemci.aylik(resmi);
    },
  };
}

// ---------- Ana akış ----------

async function main() {
  const bugun = bugunIstanbul();
  const simdi = new Date().toISOString();
  const uyarilar = [];
  const secim = process.env.VERI_KAYNAGI ?? "ayna";
  if (!["ayna", "resmi"].includes(secim)) throw new Error("VERI_KAYNAGI ayna veya resmi olmalı");
  const kaynak = secim === "resmi" ? await resmiKaynagi() : aynaKaynagi();
  console.log(`Kaynak: ${kaynak.ad}  Bugün: ${bugun}`);

  // 1) İller
  const iller = await kaynak.iller();
  if (iller.length !== BEKLENEN_IL_SAYISI) {
    throw new Error(`${BEKLENEN_IL_SAYISI} il bekleniyordu, ${iller.length} geldi. Hiçbir dosya değiştirilmedi.`);
  }
  listeDogrula(iller);
  const bilinenEksik = await bilinenEksikYukle(kaynak.ad);
  const onayli = onayliEklemeler(await gecisYukle());
  const gorulenIlceler = new Set();
  const durum = { basarili: 0, yedek: [], kisaKapsam: [], tukenmis: [], eksik: [], bilinenEksik: [] };

  // 2) İlçeler ve vakitler (önce hepsi bellekte toplanır, sonra topluca yazılır)
  const ilceListeleri = new Map();
  const vakitDosyalari = new Map();
  let toplamIlce = 0;

  for (const [i, il] of iller.entries()) {
    const kaynakIlceler = await kaynak.ilceler(il);
    if (kaynakIlceler.length === 0) throw new Error(`${il.ad} için ilçe listesi boş geldi.`);
    // Kayıtlı konumları koru: yayındaki kimlikler kalır, yeni kimlik yalnız onaylı geçişle eklenir.
    const { liste: ilceler, kaynaktaYok, reddedilen } = ilceBirlestir(await okuJson(path.join(OUT, "ilceler", `${il.id}.json`)), kaynakIlceler, onayli.get(il.id));
    for (const id of reddedilen) uyarilar.push(`${il.ad}: kaynakta onaysız yeni ilçe ${id}, yayına eklenmedi (eslesme/onayli-gecisler.json)`);
    const kaynaktaYokSet = new Set(kaynaktaYok);
    listeDogrula(ilceler, gorulenIlceler);
    ilceListeleri.set(il.id, ilceler);
    process.stdout.write(`[${i + 1}/${iller.length}] ${il.ad}: ${ilceler.length} ilçe\n`);

    for (const ilce of ilceler) {
      toplamIlce++;
      const dosya = path.join(OUT, "vakitler", `${ilce.id}.json`);
      const eski = await okuJson(dosya);
      if (bilinenEksik.has(ilce.id)) {
        // Bilinen istisna: dosyaya dokunulmaz, oranlara girmez, ayrıca raporlanır.
        durum.bilinenEksik.push(ilce.id);
        durum[siniflandir(eski, bugun)].push(ilce.id);
        continue;
      }
      try {
        if (kaynaktaYokSet.has(ilce.id)) throw new Error("kaynağın ilçe listesinde yok; kimlik korunuyor");
        const yeni = await kaynak.vakitler(ilce.id);
        if (new Set(yeni.map((x) => x.t)).size !== yeni.length) throw Error("tekrarlanan tarih");
        // Kapsam yalnız yeni veriyle sağlanmalı; eski kayıtlar boşluk dolduramaz.
        gunlerDogrula(yeni.filter((g) => isoTarih(g.t) >= bugun), bugun);
        const gunler = birlestir(eski?.gunler, yeni, bugun);
        gunlerDogrula(gunler, bugun);
        const son = gunler.at(-1);
        if (!son || isoTarih(son.t) < gunEkle(bugun, MIN_ILERI_GUN)) throw new Error(`yetersiz veri: son gün ${son?.t ?? "yok"}`);
        vakitDosyalari.set(ilce.id, { guncelleme: simdi, gunler });
        durum.basarili++;
      } catch (e) {
        uyarilar.push(`${il.ad}/${ilce.ad} (${ilce.id}): ${e.message}`);
        if (e.kod === "KOTA" || e.kod === "YETKI" || e.kod === "GIRIS" || e.kod === "KOTA_KORUMA" && /toplam/.test(e.message)) {
          throw new Error(`Resmi kaynak durduruldu (${e.kod}): ${e.message}. Hiçbir dosya değiştirilmedi.`);
        }
        // Eski dosyaya dokunulmaz ve zaman damgası yenilenmez; yalnızca sınıflandırılır.
        const sinif = siniflandir(eski, bugun);
        durum[sinif].push(ilce.id);
        if (sinif !== "yedek") uyarilar.push(`  ↳ ${ilce.ad}: ${{ kisaKapsam: "yedek 7 günden kısa", tukenmis: "yedek veri tükenmiş", eksik: "yedek dosya yok" }[sinif]}`);
      }
    }
  }

  const karar = yayinKarari({ toplam: toplamIlce, ...durum }, { maxKaynakHatasi: MAX_HATALI_ILCE_ORANI, maxKullanilamaz: MAX_KRITIK_ILCE_ORANI });
  console.log(`Karar: ${JSON.stringify(karar)}`);
  if (!karar.yayinla) {
    console.error(uyarilar.join("\n"));
    throw new Error(`Yayın durduruldu: ${karar.sebep} (aktif ${karar.aktif}). Hiçbir dosya değiştirilmedi.`);
  }

  // 3) Stage all JSON, then replace; metadata last.
  const entries = [[path.join(OUT, "iller.json"), iller]];
  for (const [ilId, ilceler] of ilceListeleri) entries.push([path.join(OUT, "ilceler", `${ilId}.json`), ilceler]);
  for (const [ilceId, veri] of vakitDosyalari) entries.push([path.join(OUT, "vakitler", `${ilceId}.json`), veri]);
  entries.push([path.join(OUT, "meta.json"), {
    guncelleme: simdi,
    kaynak: kaynak.kaynakMetni,
    kaynakTuru: kaynak.ad,
    ilSayisi: iller.length,
    ilceSayisi: toplamIlce,
    guncellenenIlce: vakitDosyalari.size,
    aynayaBirakilanIlce: durum.bilinenEksik.length,
    durum,
    uyarilar,
  }]);
  await yazToplu(entries);

  console.log(`\nTamam: ${iller.length} il, ${toplamIlce} ilçe, ${vakitDosyalari.size} güncellendi, ${uyarilar.length} uyarı.`);
  if (kaynak.istemci) console.log(`Resmi API istek sayısı: ${JSON.stringify(kaynak.istemci.toplamIstek)}`);
  if (uyarilar.length) console.log(uyarilar.join("\n"));
}

main().catch((e) => {
  console.error(`HATA: ${e.message}`);
  process.exit(1);
});
