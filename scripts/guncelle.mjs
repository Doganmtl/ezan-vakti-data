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
import { gecisYukle, onayliEklemeler, ilceBirlestir, resmiAdlariKoru } from "./kimlik.mjs";
import { siniflandir, yayinKarari, dilimSec, oncelik, aralikAdayi } from "./esik.mjs";
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
// Kullanılabilir verisi kalmayan (tükenmiş + eksik) ilçe oranı. D06-A, kullanıcı onaylı (27.11.2026):
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
  const envSinir = Number(process.env.RESMI_TOPLAM_ISTEK_SINIRI);
  if (!Number.isSafeInteger(envSinir) || envSinir < 1) throw new Error("RESMI_TOPLAM_ISTEK_SINIRI tanımlı değil: kota belirsiz, varsayılan kullanılmaz.");
  // Günlük ortak tavan (9. tur, kullanıcı onaylı): bütün Data operasyonları için günde en çok GUNLUK_ISTEK_TAVANI HTTP isteği
  // (giriş, yenileme, Quota/My, başarısız ve tekrarlanan istekler dahil). Çalışmalar arası defter: AWQAT_DEFTER (Actions cache).
  const { defterOku, calismaSiniri } = await import("./resmi/defter.mjs");
  const defter = await defterOku(process.env.AWQAT_DEFTER, bugunIstanbul());
  const sinir = calismaSiniri({ envSinir, tavan: Number(process.env.GUNLUK_ISTEK_TAVANI ?? 100), defter });
  console.log(`Günlük defter: bugün ${defter.toplam} istek kayıtlı (${defter.calismalar.length} çalışma); bu çalışmanın tavanı ${sinir}.`);
  if (sinir < 4) throw new Error(`Günlük istek tavanı doldu (kalan ${sinir}); istek gönderilmedi, hiçbir dosya değiştirilmedi.`);
  const { AwqatIstemci } = await import("./resmi/awqat-adaptor.mjs");
  const sozlesme = JSON.parse(await fs.readFile(process.env.AWQAT_SOZLESME ?? "config/awqat-sozlesme.json", "utf8"));
  if (process.env.AWQAT_BASE_URL) sozlesme.baseUrl = process.env.AWQAT_BASE_URL; // yalnız testler (yerel sahte sunucu)
  const tablo = JSON.parse(await fs.readFile(process.env.ESLESME_TABLOSU ?? "eslesme/ilce-kimlikleri.json", "utf8"));
  const istemci = new AwqatIstemci({ sozlesme, email: process.env.AWQAT_EMAIL, sifre: process.env.AWQAT_PASSWORD,
    toplamIstekSiniri: sinir, timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000),
    ...(process.env.AWQAT_TEST_HIZLI === "1" ? { bekle: async () => {} } : {}) });
  const okuListe = async (f) => { const x = await okuJson(f); if (!Array.isArray(x)) throw new Error(`${f} okunamadı`); return x; };
  // Uç seçimi (8. tur): Monthly (varsayılan; mevcut yayın + yıllık dosya doğrulaması) ya da DateRange (yıllık resmi veri).
  // İki uç ayrı çalışmalarda yayınlanır: birinin hatası diğerinin yayınlanmış verisini etkilemez.
  const uc = process.env.RESMI_UC ?? "Monthly";
  if (!["Monthly", "DateRange"].includes(uc)) throw new Error("RESMI_UC Monthly veya DateRange olmalı");
  const calisma = { runId: process.env.GITHUB_RUN_ID ?? "yerel", commit: process.env.GITHUB_SHA ?? null };
  const { vakitDonustur } = await import("./resmi/awqat-adaptor.mjs");
  const Y = await import("./resmi/yillik.mjs"), A = await import("./resmi/aylik-dogrulama.mjs");
  const resmiId = (id) => { const r = tablo.ilceler?.[id]?.resmi; if (!Number.isSafeInteger(r)) throw new Error("resmi kimlik eşlemesi doğrulanmadı"); return r; };
  return {
    ad: "resmi",
    uc,
    defter,
    sinir,
    kaynakMetni: "T.C. Diyanet İşleri Başkanlığı (Awqat Salah resmi API)",
    istemci,
    // Quota/My: 1 istek; bu çalışmanın ucuna gidecek istek sayısını sınırlar. Oransal pay; uç grubu eşlenemiyorsa ortak havuz
    // (en kısıtlayıcı grup). Son okuma için 1 ayrılır.
    async kotaIzni() {
      const { ucPlani } = await import("./resmi/kota.mjs");
      const yol = uc === "DateRange" ? "PrayerTime/DateRange" : "PrayerTime/Monthly";
      const { enAzKalan } = await import("./resmi/kota.mjs");
      const kota = await istemci.getir("kota", {});
      const kalan = enAzKalan(kota);
      // Günün ilk çalışması (defter boş): kota gerçekten yenilenmiş olmalı; önceki gün/onaylı testlerin tüketimi sürüyorsa başlama.
      if (defter.ilk && !defter.yok && !(kalan >= Number(process.env.ILK_CALISMA_ASGARI_KALAN ?? 90))) throw Object.assign(new Error(`günün ilk çalışması ama kota yenilenmiş görünmüyor (en az kalan ${kalan}); istek gönderilmedi`), { kod: "KOTA" });
      const p = ucPlani(kota, [{ uc: yol, istek: Number.MAX_SAFE_INTEGER }]);
      console.log(`Kota planı: ${p.sebep}; en az kalan ${kalan}`);
      // Veri istekleri: kota izni ile günlük tavanın küçüğü; giriş, bu kota okuması ve olası token yenilemesi için 3 ayrılır.
      return Math.max(0, Math.min(p.izinler[yol] - 1, sinir - 3));
    },
    iller: () => okuListe(path.join(OUT, "iller.json")),
    ilceler: (il) => okuListe(path.join(OUT, "ilceler", `${il.id}.json`)),
    async vakitler(id) {
      const resmi = tablo.ilceler?.[id]?.resmi;
      if (!Number.isSafeInteger(resmi)) throw new Error("resmi kimlik eşlemesi doğrulanmadı");
      await sleep(DELAY_MS);
      return istemci.aylik(resmi);
    },
    /**
     * Sözleşme 2 dosyası üretir ya da null (eski Monthly yolu). Dönüş: { dosya, tur, karsilastirma? }.
     *  DateRange: yıllık resmi dosya ("yenilendi"; içerik aynıysa yalnız doğrulama: "dogrulandi").
     *  Monthly + yıllık dosya: karşılaştırma ("dogrulandi" | "duzeltildi"); ortak gün yoksa kaynak hatası.
     */
    async dosyaUret(id, eski, { bugun, simdi }) {
      if (uc === "DateRange") {
        const r = resmiId(id), g = Y.aralikGovdesi(r, bugun);
        await sleep(DELAY_MS);
        const ham = await istemci.getir("aralik", {}, { cityId: g.cityId, startDate: g.startDate, endDate: g.endDate });
        const alindi = new Date().toISOString();
        // Şema/kimlik/bütünlük hatası toleranslı kaynak hatası DEĞİLDİR (D12, 9. tur): çalışma yazmadan durur.
        const dogrula = (fn) => { try { return fn(); } catch (e) { throw Object.assign(new Error(`doğrulama: ${e.message}`), { kod: "DOGRULAMA" }); } };
        if (!Array.isArray(ham)) throw Object.assign(new Error("doğrulama: DateRange yanıtı liste değil"), { kod: "DOGRULAMA" });
        const gunler = dogrula(() => ham.map((x) => vakitDonustur(x, sozlesme)));
        dogrula(() => Y.aralikDogrula(gunler, { ilk: g.ilk, son: g.son, resmiId: r, yanitKimlikleri: ham.map((x) => x?.cityId ?? x?.placeId) }));
        const arsiv = Y.arsivKaydi({ v1Id: id, resmiId: r, gunler, alindi, calisma, ham, simdi: alindi });
        const dosya = Y.yayinDosyasi(arsiv, { eski, calisma });
        return { dosya, tur: dosya.surum === eski?.surum && eski?.sozlesme === 2 ? "dogrulandi" : "yenilendi", arsiv };
      }
      if (eski?.sozlesme !== 2 || eski.kaynak?.tur !== "resmi-yillik") return null;
      const r = resmiId(id);
      await sleep(DELAY_MS);
      let ay;
      try { ay = await istemci.aylik(r); } catch (e) { if (e.kod === "VERI") e.kod = "DOGRULAMA"; throw e; }
      let k;
      try { k = A.karsilastir(eski, ay, { alindi: new Date().toISOString(), calisma, simdi }); }
      catch (e) { throw Object.assign(new Error(`doğrulama: ${e.message}`), { kod: "DOGRULAMA" }); }
      if (k.sonuc === "ortak-yok") throw new Error("Monthly yanıtı yıllık dosyayla ortak gün içermiyor");
      return { dosya: k.dosya, tur: k.sonuc === "esit" ? "dogrulandi" : "duzeltildi", karsilastirma: k };
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
  defterKaynagi = kaynak;
  console.log(`Kaynak: ${kaynak.ad}  Bugün: ${bugun}`);

  // 1) İller
  const iller = await kaynak.iller();
  if (iller.length !== BEKLENEN_IL_SAYISI) {
    throw new Error(`${BEKLENEN_IL_SAYISI} il bekleniyordu, ${iller.length} geldi. Hiçbir dosya değiştirilmedi.`);
  }
  listeDogrula(iller);
  const bilinenEksik = await bilinenEksikYukle(kaynak.ad);
  const onayli = onayliEklemeler(await gecisYukle());
  // Doğrulanmış resmi adlar her kaynak modunda korunur (ayna farklı yazım getirse bile).
  const adTablosu = await okuJson(process.env.ESLESME_TABLOSU ?? "eslesme/ilce-kimlikleri.json");
  const gorulenIlceler = new Set();
  const durum = { basarili: 0, yedek: [], kisaKapsam: [], tukenmis: [], eksik: [], bilinenEksik: [], planliBekleyen: [] };
  const dilimBoyutu = process.env.DILIM_BOYUTU ? Number(process.env.DILIM_BOYUTU) : undefined;

  // 2a) İlçe listeleri ve mevcut dosyalar (ağdan vakit çekmeden önce)
  const ilceListeleri = new Map();
  const vakitDosyalari = new Map();
  const isler = []; // {il, ilce, eski, kaynaktaYok}
  for (const [i, il] of iller.entries()) {
    const kaynakIlceler = await kaynak.ilceler(il);
    if (kaynakIlceler.length === 0) throw new Error(`${il.ad} için ilçe listesi boş geldi.`);
    // Kayıtlı konumları koru: yayındaki kimlikler kalır, yeni kimlik yalnız onaylı geçişle eklenir.
    const birlesik = ilceBirlestir(await okuJson(path.join(OUT, "ilceler", `${il.id}.json`)), kaynakIlceler, onayli.get(il.id));
    const { kaynaktaYok, reddedilen } = birlesik, ilceler = resmiAdlariKoru(birlesik.liste, adTablosu);
    for (const id of reddedilen) uyarilar.push(`${il.ad}: kaynakta onaysız yeni ilçe ${id}, yayına eklenmedi (eslesme/onayli-gecisler.json)`);
    const yok = new Set(kaynaktaYok);
    listeDogrula(ilceler, gorulenIlceler);
    ilceListeleri.set(il.id, ilceler);
    process.stdout.write(`[${i + 1}/${iller.length}] ${il.ad}: ${ilceler.length} ilçe\n`);
    for (const ilce of ilceler) isler.push({ il, ilce, eski: await okuJson(path.join(OUT, "vakitler", `${ilce.id}.json`)), kaynaktaYok: yok.has(ilce.id) });
  }
  const toplamIlce = isler.length;

  // 2b) Kademeli seçim (DILIM_BOYUTU verilirse): en az kapsamı kalanlar önce. Seçilmeyenler "planliBekleyen":
  // kaynak hatası sayılmaz, dosyalarına dokunulmaz; verisi tükenmişse yine "kullanılamaz" sayılır.
  const mod = kaynak.uc; // ayna: undefined → eski öncelik (sonKullanim)
  // Öncelikli ilçeler (gözden geçirilmiş config; ilk kontrollü üretim dilimi): yalnız resmi modda, yenilemesi gelmemiş yıllık dosyaları istemez.
  const oncelikli = mod ? new Set((await okuJson(process.env.ONCELIKLI_ILCELER_DOSYASI ?? "config/oncelikli-ilceler.json"))?.ilceler ?? []) : new Set();
  const adaylar = isler.filter((x) => !bilinenEksik.has(x.ilce.id)).map((x) => ({ id: x.ilce.id, sonGun: oncelik(x.eski, { mod, bugun, oncelikli: oncelikli.has(x.ilce.id) }) }));
  // Resmi kaynakta günlük kalan hak çalışmanın başında okunur; dilim bu hakkı aşamaz (bilinmiyorsa küçük güvenli sınır).
  let boyut = dilimBoyutu;
  let kotaIzin = null;
  if (kaynak.kotaIzni) {
    kotaIzin = await kaynak.kotaIzni();
    boyut = Math.min(boyut ?? adaylar.length, kotaIzin);
    // DateRange: yenilemesi gelmemiş yıllık dosyalar istenmez (kota israfı yok).
    if (mod === "DateRange") boyut = Math.min(boyut, adaylar.filter((x) => aralikAdayi(x.sonGun)).length);
    console.log(`Kota: izin verilen ${kotaIzin} istek; bu çalışmada en çok ${boyut} ilçe.`);
    if (boyut < 1) throw new Error(mod === "DateRange" && kotaIzin > 0 ? "Yenilenecek yıllık dosya yok; istek gönderilmedi." : "Günlük kalan hak yok ya da bilinmiyor; istek gönderilmedi, hiçbir dosya değiştirilmedi.");
  }
  const secilen = dilimSec(adaylar, boyut);
  let planliKullanilamaz = 0;
  const sozlesme2Durum = { yenilendi: [], dogrulandi: [], duzeltildi: [] }, karsilastirmalar = [];

  // 2c) Vakitler
  for (const { il, ilce, eski, kaynaktaYok } of isler) {
    if (bilinenEksik.has(ilce.id)) {
      // Bilinen istisna: dosyaya dokunulmaz, oranlara girmez, ayrıca raporlanır.
      durum.bilinenEksik.push(ilce.id);
      durum[siniflandir(eski, bugun)].push(ilce.id);
      continue;
    }
    if (!secilen.has(ilce.id)) {
      durum.planliBekleyen.push(ilce.id);
      if (["tukenmis", "eksik"].includes(siniflandir(eski, bugun))) planliKullanilamaz++;
      continue;
    }
    try {
      if (kaynaktaYok) throw new Error("kaynağın ilçe listesinde yok; kimlik korunuyor");
      const uretim = kaynak.dosyaUret ? await kaynak.dosyaUret(ilce.id, eski, { bugun, simdi }) : null;
      if (uretim) {
        const { sozlesme2Dogrula, gecisTuru } = await import("./resmi/sozlesme2.mjs");
        try { sozlesme2Dogrula(uretim.dosya, { simdi: new Date().toISOString() }); gecisTuru(eski, uretim.dosya); gunlerDogrula(uretim.dosya.gunler, bugun); }
        catch (e) { throw Object.assign(new Error(`bütünlük: ${e.message}`), { kod: "DOGRULAMA" }); }
        vakitDosyalari.set(ilce.id, uretim.dosya);
        sozlesme2Durum[uretim.tur].push(ilce.id);
        if (uretim.karsilastirma) karsilastirmalar.push({ id: ilce.id, ...uretim.karsilastirma });
        durum.basarili++;
        continue;
      }
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
      if (e.kod === "KOTA" || e.kod === "YETKI" || e.kod === "GIRIS" || e.kod === "DOGRULAMA" || e.kod === "KOTA_KORUMA" && /toplam/.test(e.message)) {
        throw new Error(`Resmi kaynak durduruldu (${e.kod}): ${e.message}. Hiçbir dosya değiştirilmedi.`);
      }
      // Eski dosyaya dokunulmaz ve zaman damgası yenilenmez; yalnızca sınıflandırılır.
      const sinif = siniflandir(eski, bugun);
      durum[sinif].push(ilce.id);
      if (sinif !== "yedek") uyarilar.push(`  ↳ ${ilce.ad}: ${{ kisaKapsam: "yedek 7 günden kısa", tukenmis: "yedek veri tükenmiş", eksik: "yedek dosya yok" }[sinif]}`);
    }
  }

  // Monthly doğrulamasında sistematik fark → güvenli durdurma (hiçbir dosya yazılmaz), insan incelemesi.
  if (karsilastirmalar.length) {
    const { sistematikKarar } = await import("./resmi/aylik-dogrulama.mjs");
    const sk = sistematikKarar(karsilastirmalar);
    console.log(`Doğrulama: ${JSON.stringify(sk)}`);
    if (sk.durdur) {
      const ornek = karsilastirmalar.filter((k) => k.sonuc === "degisti").slice(0, 5).map((k) => ({ id: k.id, fark: k.farklar.slice(0, 3) }));
      console.log(`::error title=Resmi veri farkı::${sk.sebep}. İnsan incelemesi gerekli.`);
      throw new Error(`Doğrulama durduruldu: ${sk.sebep}. Örnek: ${JSON.stringify(ornek)}. Hiçbir dosya değiştirilmedi.`);
    }
  }
  const karar = yayinKarari({ toplam: toplamIlce, ...durum, planliKullanilamaz }, { maxKaynakHatasi: MAX_HATALI_ILCE_ORANI, maxKullanilamaz: MAX_KRITIK_ILCE_ORANI });
  console.log(`Karar: ${JSON.stringify(karar)}`);
  if (karar.kritikUyari) {
    const m = `KRİTİK: Türkiye genelinde ${karar.turkiyeKullanilamaz} ilçede kullanılabilir veri yok (sınır ${karar.sinirTurkiye}); bunun ${karar.bekleyenKullanilamaz} tanesi planlı bekleyen. Başarılı ilçeler yine yayınlanır.`;
    uyarilar.unshift(m);
    console.log(`::warning title=Kullanılabilirlik::${m}`);
  }
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
    kullanilabilirlik: { kritikUyari: karar.kritikUyari, turkiyeKullanilamaz: karar.turkiyeKullanilamaz, bekleyenKullanilamaz: karar.bekleyenKullanilamaz, sinir: karar.sinirTurkiye },
    dilim: boyut !== undefined && secilen.size < adaylar.length ? { boyut, secilen: secilen.size, kotaIzin, ...(mod ? { mod } : {}) } : null,
    ...(kaynak.istemci ? { resmiIstek: { calisma: kaynak.istemci.toplamIstek, gunlukOnce: kaynak.defter.toplam, tavan: kaynak.sinir } } : {}),
    ...(mod ? { uc: mod, sozlesme2: { ...sozlesme2Durum, yenidenCek: sozlesme2Durum.duzeltildi, arsiv: "yazılmadı (D11: kalıcı ham arşiv yeri ve yeniden yayın izni kesinleşmedi)" } } : {}),
    uyarilar,
  }]);
  await yazToplu(entries);

  console.log(`\nTamam: ${iller.length} il, ${toplamIlce} ilçe, ${vakitDosyalari.size} güncellendi, ${uyarilar.length} uyarı.`);
  if (kaynak.istemci) console.log(`Resmi API istek sayısı: ${JSON.stringify(kaynak.istemci.toplamIstek)}`);
  if (uyarilar.length) console.log(uyarilar.join("\n"));
}

// Defter her durumda yazılır (başarısız çalışmanın istekleri de günlük tavana sayılır).
let defterKaynagi = null;
main().catch((e) => {
  console.error(`HATA: ${e.message}`);
  process.exitCode = 1;
}).finally(async () => {
  if (defterKaynagi?.istemci && process.env.AWQAT_DEFTER) {
    const { defterYaz } = await import("./resmi/defter.mjs");
    await defterYaz(process.env.AWQAT_DEFTER, defterKaynagi.defter, { calisma: process.env.GITHUB_RUN_ID ?? "yerel", uc: defterKaynagi.uc, istek: defterKaynagi.istemci.toplamIstek });
    console.log(`Günlük defter: bu çalışma ${defterKaynagi.istemci.toplamIstek} istek; bugün toplam ${defterKaynagi.defter.toplam + defterKaynagi.istemci.toplamIstek}.`);
  }
});
