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

const SOURCE = (process.env.SOURCE_URL ?? "https://ezanvakti.emushaf.net").replace(/\/$/, "");
const OUT = process.env.OUT_DIR ?? "docs/v1";
const DELAY_MS = Number(process.env.DELAY_MS ?? 2000);           // kaynak ~1 istek/sn'de 429 veriyor
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS ?? 1000);
const RATE_LIMIT_WAIT_MS = Number(process.env.RATE_LIMIT_WAIT_MS ?? 60_000);
const TURKIYE = 2;

const BEKLENEN_IL_SAYISI = 81;
const MIN_ILERI_GUN = 14;        // her ilçe için en az bu kadar gün ileriye veri olmalı
const GECMIS_TUT_GUN = 2;        // geçmişe dönük tutulan gün (gece yarısı/yatsı hesabı için)
const MAX_HATALI_ILCE_ORANI = 0.02;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Tarih yardımcıları (İstanbul saati) ----------

function bugunIstanbul() {
  if (process.env.TODAY) return process.env.TODAY;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()); // YYYY-MM-DD
}
/** "18.11.2026" → "2026-11-18" */
const isoTarih = (t) => t.split(".").reverse().join("-");
function gunEkle(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- Ağ ----------

async function getJson(url, deneme = 6) {
  let sonHata;
  for (let i = 0; i < deneme; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ezan-vakti-data (github actions)" },
        signal: AbortSignal.timeout(20_000),
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
async function yazJson(dosya, veri) {
  await fs.mkdir(path.dirname(dosya), { recursive: true });
  await fs.writeFile(dosya, JSON.stringify(veri) + "\n");
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

  // 2) İlçeler ve vakitler (önce hepsi bellekte toplanır, sonra topluca yazılır)
  const ilceListeleri = new Map(); // ilId → [{id, ad}]
  const vakitDosyalari = new Map(); // ilceId → { guncelleme, gunler }
  let toplamIlce = 0;
  let hataliIlce = 0;

  for (const [i, il] of iller.entries()) {
    await sleep(DELAY_MS);
    const ilceHam = await getJson(`${SOURCE}/ilceler/${il.id}`);
    const ilceler = ilceHam
      .map((x) => ({ id: Number(x.IlceID), ad: String(x.IlceAdi).trim() }))
      .filter((x) => Number.isInteger(x.id) && x.ad);
    if (ilceler.length === 0) throw new Error(`${il.ad} için ilçe listesi boş geldi.`);
    ilceListeleri.set(il.id, ilceler);
    process.stdout.write(`[${i + 1}/${iller.length}] ${il.ad}: ${ilceler.length} ilçe\n`);

    for (const ilce of ilceler) {
      toplamIlce++;
      const dosya = path.join(OUT, "vakitler", `${ilce.id}.json`);
      const eski = await okuJson(dosya);
      try {
        await sleep(DELAY_MS);
        const ham = await getJson(`${SOURCE}/vakitler/${ilce.id}`);
        if (!Array.isArray(ham) || ham.length === 0) throw new Error("boş vakit listesi");
        const yeni = ham.map(gunuDonustur);
        const gunler = birlestir(eski?.gunler, yeni, bugun);
        const son = gunler.at(-1);
        if (!son || isoTarih(son.t) < gunEkle(bugun, MIN_ILERI_GUN)) {
          throw new Error(`yetersiz veri: son gün ${son?.t ?? "yok"}`);
        }
        vakitDosyalari.set(ilce.id, { guncelleme: simdi, gunler });
      } catch (e) {
        hataliIlce++;
        uyarilar.push(`${il.ad}/${ilce.ad} (${ilce.id}): ${e.message}`);
        // Eski dosya hâlâ yeterince ileriye uzanıyorsa ona dokunma; yoksa bu ciddi bir sorun.
        const eskiSon = eski?.gunler?.at(-1)?.t;
        if (!eskiSon || isoTarih(eskiSon) < gunEkle(bugun, 7)) {
          uyarilar.push(`  ↳ ${ilce.ad} için yedek veri de 7 günden kısa!`);
        }
      }
    }
  }

  if (hataliIlce / toplamIlce > MAX_HATALI_ILCE_ORANI) {
    console.error(uyarilar.join("\n"));
    throw new Error(`${toplamIlce} ilçeden ${hataliIlce} tanesi alınamadı (sınır %${MAX_HATALI_ILCE_ORANI * 100}). Hiçbir dosya değiştirilmedi.`);
  }

  // 3) Yaz
  await yazJson(path.join(OUT, "iller.json"), iller);
  for (const [ilId, ilceler] of ilceListeleri) await yazJson(path.join(OUT, "ilceler", `${ilId}.json`), ilceler);
  for (const [ilceId, veri] of vakitDosyalari) await yazJson(path.join(OUT, "vakitler", `${ilceId}.json`), veri);
  await yazJson(path.join(OUT, "meta.json"), {
    guncelleme: simdi,
    kaynak: "T.C. Diyanet İşleri Başkanlığı (ezanvakti.emushaf.net aynası üzerinden)",
    ilSayisi: iller.length,
    ilceSayisi: toplamIlce,
    guncellenenIlce: vakitDosyalari.size,
    uyarilar,
  });

  console.log(`\nTamam: ${iller.length} il, ${toplamIlce} ilçe, ${vakitDosyalari.size} güncellendi, ${hataliIlce} uyarı.`);
  if (uyarilar.length) console.log(uyarilar.join("\n"));
}

main().catch((e) => {
  console.error(`HATA: ${e.message}`);
  process.exit(1);
});
