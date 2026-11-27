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
const YEDEK_MIN_GUN = 7;

// Bu ilçelerin vakitleri veri deposunda tutulmaz (kaynak sürekli hata veriyor).
// İlçe listesinde kalırlar; uygulama vakitler/{id}.json bulamayınca doğrudan Diyanet aynasından alır.
const ATLANAN_ILCELER = new Set([
  33292, // ESKİŞEHİR/MİHALGAZİ — kaynak HTTP 502 veriyor (Kasım 2026)
]);

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


/** Eski ve yeni günleri tarihe göre birleştirir (yeni olan kazanır), eski günleri budar. */
function birlestir(eski, yeni, bugun) {
  const harita = new Map();
  for (const g of eski ?? []) harita.set(g.t, g);
  for (const g of yeni) harita.set(g.t, g);
  const alt = gunEkle(bugun, -GECMIS_TUT_GUN);
  return [...harita.values()]
    .filter((g) => isoTarih(g.t) >= alt)
    .sort((a, b) => (isoTarih(a.t) < isoTarih(b.t) ? -1 : 1));
}

/** Kaynaktan alınamayan bir ilçenin mevcut dosyasını sınıflandırır; dosyayı değiştirmez. */
function siniflandir(eski, bugun) {
  if (!eski) return "eksik";
  try { gunlerDogrula(eski.gunler, bugun, YEDEK_MIN_GUN); return "yedek"; } catch { return "suresiDolmus"; }
}

// ---------- Ana akış ----------

async function main() {
  const bugun = bugunIstanbul();
  const simdi = new Date().toISOString();
  const uyarilar = [];
  console.log(`Kaynak: ${SOURCE}  Bugün: ${bugun}`);

  // 1) İller
  const ilHam = await getJson(`${SOURCE}/sehirler/${TURKIYE}`);
  const iller = ilHam
    .map((x) => ({ id: Number(x.SehirID), ad: String(x.SehirAdi).trim() }))
    .filter((x) => Number.isInteger(x.id) && x.ad);
  if (iller.length !== BEKLENEN_IL_SAYISI) {
    throw new Error(`${BEKLENEN_IL_SAYISI} il bekleniyordu, ${iller.length} geldi. Hiçbir dosya değiştirilmedi.`);
  }

  listeDogrula(iller);
  const gorulenIlceler = new Set();
  // İlçe sınıfları: basarili (kaynaktan yeni, yeni zaman damgası), yedek (eski dosya ≥7 gün, dokunulmaz,
  // eski damgasını korur), suresiDolmus (eski dosya <7 gün, dokunulmaz), eksik (dosya yok).
  const durum = { basarili: 0, yedek: [], suresiDolmus: [], eksik: [] };

  // 2) İlçeler ve vakitler (önce hepsi bellekte toplanır, sonra topluca yazılır)
  const ilceListeleri = new Map(); // ilId → [{id, ad}]
  const vakitDosyalari = new Map(); // ilceId → { guncelleme, gunler }
  let toplamIlce = 0;
  let hataliIlce = 0;
  let atlananIlce = 0; // ATLANAN_ILCELER: bilerek aynaya bırakılanlar

  for (const [i, il] of iller.entries()) {
    await sleep(DELAY_MS);
    const ilceHam = await getJson(`${SOURCE}/ilceler/${il.id}`);
    const ilceler = ilceHam
      .map((x) => ({ id: Number(x.IlceID), ad: String(x.IlceAdi).trim() }))
      .filter((x) => Number.isInteger(x.id) && x.ad);
    if (ilceler.length === 0) throw new Error(`${il.ad} için ilçe listesi boş geldi.`);
    listeDogrula(ilceler, gorulenIlceler);
    ilceListeleri.set(il.id, ilceler);
    process.stdout.write(`[${i + 1}/${iller.length}] ${il.ad}: ${ilceler.length} ilçe\n`);

    for (const ilce of ilceler) {
      toplamIlce++;
      const dosya = path.join(OUT, "vakitler", `${ilce.id}.json`);
      const eski = await okuJson(dosya);
      if (ATLANAN_ILCELER.has(ilce.id)) {
        atlananIlce++;
        // Mevcut dosyayı silme; resmi kaynak eşleştirmesi bekleniyor.
        durum[siniflandir(eski, bugun)].push(ilce.id);
        continue;
      }
      try {
        await sleep(DELAY_MS);
        const ham = await getJson(`${SOURCE}/vakitler/${ilce.id}`);
        if (!Array.isArray(ham) || ham.length === 0) throw new Error("boş vakit listesi");
        const yeni = ham.map(gunuDonustur);
        if (new Set(yeni.map(x=>x.t)).size !== yeni.length) throw Error("tekrarlanan tarih");
        const gunler = birlestir(eski?.gunler, yeni, bugun);
        gunlerDogrula(gunler, bugun);
        const son = gunler.at(-1);
        if (!son || isoTarih(son.t) < gunEkle(bugun, MIN_ILERI_GUN)) {
          throw new Error(`yetersiz veri: son gün ${son?.t ?? "yok"}`);
        }
        vakitDosyalari.set(ilce.id, { guncelleme: simdi, gunler });
        durum.basarili++;
      } catch (e) {
        hataliIlce++;
        uyarilar.push(`${il.ad}/${ilce.ad} (${ilce.id}): ${e.message}`);
        // Eski dosyaya dokunulmaz ve zaman damgası yenilenmez; yalnızca sınıflandırılır.
        const sinif = siniflandir(eski, bugun);
        durum[sinif].push(ilce.id);
        if (sinif !== "yedek") uyarilar.push(`  ↳ ${ilce.ad}: ${sinif === "eksik" ? "yedek dosya yok" : "yedek veri 7 günden kısa"}`);
      }
    }
  }

  const aktif = toplamIlce - atlananIlce;
  const kritik = [...durum.suresiDolmus, ...durum.eksik].filter((id) => !ATLANAN_ILCELER.has(id)).length;
  if (hataliIlce / aktif > MAX_HATALI_ILCE_ORANI || kritik / aktif > MAX_KRITIK_ILCE_ORANI) {
    console.error(uyarilar.join("\n"));
    throw new Error(`${aktif} aktif ilçeden ${hataliIlce} alınamadı (sınır %${MAX_HATALI_ILCE_ORANI * 100}), ${kritik} ilçede kullanılabilir veri yok (sınır %${MAX_KRITIK_ILCE_ORANI * 100}). Hiçbir dosya değiştirilmedi.`);
  }

  // 3) Stage all JSON, then replace; metadata last.
  const entries = [[path.join(OUT, "iller.json"), iller]];
  for (const [ilId, ilceler] of ilceListeleri) entries.push([path.join(OUT, "ilceler", `${ilId}.json`), ilceler]);
  for (const [ilceId, veri] of vakitDosyalari) entries.push([path.join(OUT, "vakitler", `${ilceId}.json`), veri]);
  entries.push([path.join(OUT, "meta.json"), {
    guncelleme: simdi,
    kaynak: "T.C. Diyanet İşleri Başkanlığı (ezanvakti.emushaf.net aynası üzerinden)",
    ilSayisi: iller.length,
    ilceSayisi: toplamIlce,
    guncellenenIlce: vakitDosyalari.size,
    aynayaBirakilanIlce: atlananIlce,
    durum,
    uyarilar,
  }]);
  await yazToplu(entries);

  console.log(`\nTamam: ${iller.length} il, ${toplamIlce} ilçe, ${vakitDosyalari.size} güncellendi, ${atlananIlce} aynaya bırakıldı, ${hataliIlce} uyarı.`);
  if (uyarilar.length) console.log(uyarilar.join("\n"));
}

main().catch((e) => {
  console.error(`HATA: ${e.message}`);
  process.exit(1);
});
