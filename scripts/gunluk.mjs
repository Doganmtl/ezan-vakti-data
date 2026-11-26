// Günlük içerik: Diyanet'in ana sayfasında yayımladığı "Günün Ayeti / Hadisi / Duası" ile
// haftanın Cuma hutbesi. Her gün çalışır, docs/v1/gunluk.json dosyasına yazar.
//
//  • Günün ayet/hadis/duası: diyanet.gov.tr ana sayfasının kendi kullandığı herkese açık adres
//    (giriş/jeton gerekmez). Diyanet yalnızca o günün içeriğini verir; geçmiş günler bu dosyada
//    birikir (en fazla 400 gün).
//  • Cuma hutbesi: Diyanet Din Hizmetleri'nin Türkçe hutbelerini toplayan açık kaynak ayna
//    (github.com/Strekeos/turkce-hutbe-api). PDF / Word / ses bağlantıları Diyanet'in kendi
//    dosyalarına gider.
//
// Günlük içerik alınamazsa (site kapalı, biçim değişti) eski kayıtlar korunur, hutbe yine güncellenir
// ve iş akışı hata koduyla biter → GitHub e-posta atar.

import fs from "node:fs/promises";
import path from "node:path";
import { yazToplu } from "./atomik-yaz.mjs";
import { gunlukBirlestir } from "./v1-dogrulama.mjs";

const OUT = process.env.OUT_DIR ?? "docs/v1";
const DOSYA = path.join(OUT, "gunluk.json");
const GUNLUK_URL = process.env.GUNLUK_URL ?? "https://diyanet.gov.tr/proxy/home/daily-content?lang=tr-TR";
const HUTBE_URL = process.env.HUTBE_URL ?? "https://raw.githubusercontent.com/Strekeos/turkce-hutbe-api/main/hutbeler.json";
const UA = "ezan-vakti-data (github.com/Doganmtl/ezan-vakti-data)";

const bugun = () =>
  process.env.TODAY ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

const temiz = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

async function getJson(url) {
  let son;
  for (let deneme = 1; deneme <= 3; deneme++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000)),
        redirect: "error",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      son = e;
      await new Promise((ok) => setTimeout(ok, Number(process.env.RETRY_BASE_MS ?? 3000) * deneme));
    }
  }
  throw new Error(`${url}: ${son?.message ?? son}`);
}

async function gununIcerigi(tarih) {
  const j = await getJson(GUNLUK_URL);
  const bul = (kod) => j?.items?.find((x) => x?.contentTypeCode === kod);
  const parca = (kod) => {
    const x = bul(kod);
    let m = temiz(x?.title);
    // Diyanet uzun metinleri 255 karakterde kesiyor (kendi sitesinde de öyle görünüyor): yarım kaldığını belli et.
    if (m.length >= 250 && !/[.!?…"”'’)]$/.test(m)) {
      m = m.replace(/["“]$/, "") + "…";
      if (/^["“]/.test(m) && !/["”]/.test(m.slice(1))) m = m.slice(1); // kapanmayan tırnak
    }
    if (m.length < 10) throw new Error(`"${kod}" boş ya da eksik geldi`);
    return { m, k: temiz(x?.source) };
  };
  const gun = { t: tarih, g: Number(j?.dayOfYear) || null, ayet: parca("ayet"), hadis: parca("hadis"), dua: parca("dua") };
  // Diyanet günü sunucu saatine göre değiştirir; yılın günü bizim tarihle tutmuyorsa kaydı yanlış güne yazmayalım.
  const [y, a, d] = tarih.split("-").map(Number);
  const beklenen = Math.round((Date.UTC(y, a - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  // (Artık yıl sayımı farkı için 1 günlük sapmaya izin verilir.)
  if (gun.g && Math.abs(gun.g - beklenen) > 1) throw new Error(`Diyanet yılın ${gun.g}. gününü verdi, bugün ${beklenen}. gün; atlandı`);
  return gun;
}

async function sonHutbe(tarih) {
  const j = await getJson(HUTBE_URL);
  const liste = (Array.isArray(j) ? j : j?.data ?? []).filter(
    (h) => h?.language === "tr" && /^\d{4}-\d{2}-\d{2}$/.test(h?.date ?? "") && temiz(h?.title),
  );
  // Diyanet hutbeyi Cuma'dan birkaç gün önce yayımlar; en fazla 7 gün ilerisini kabul et.
  const sinir = new Date(Date.parse(tarih) + 7 * 86_400_000).toISOString().slice(0, 10);
  const h = liste.filter((x) => x.date <= sinir).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!h) throw new Error("Hutbe listesi boş");
  const diyanetMi = (u) => (typeof u === "string" && /^https:\/\/[a-z.]*diyanet\.gov\.tr\//.test(u) ? u : null);
  return {
    baslik: temiz(h.title),
    tarih: h.date,
    pdf: diyanetMi(h.pdf_url),
    word: diyanetMi(h.doc_url),
    ses: diyanetMi(h.audio_url),
  };
}

async function main() {
  const tarih = bugun();
  let eski = { gunler: [] };
  try {
    eski = JSON.parse(await fs.readFile(DOSYA, "utf8"));
  } catch {}

  const hatalar = [];
  let gun = null;
  let hutbe = eski.hutbe ?? null;
  try {
    gun = await gununIcerigi(tarih);
    console.log(`✓ ${tarih} günün ayeti/hadisi/duası alındı (yılın ${gun.g}. günü)`);
  } catch (e) {
    hatalar.push(`Günlük içerik: ${e.message}`);
  }
  try {
    hutbe = await sonHutbe(tarih);
    console.log(`✓ Hutbe: ${hutbe.tarih} "${hutbe.baslik}"`);
  } catch (e) {
    console.warn(`Uyarı — hutbe alınamadı, eskisi korunuyor: ${e.message}`);
  }

  const gunler = gunlukBirlestir(eski.gunler ?? [], gun);

  const yeni = {
    guncelleme: new Date().toISOString(),
    kaynak: {
      gunluk: "T.C. Diyanet İşleri Başkanlığı — diyanet.gov.tr (Günün Ayeti, Hadisi, Duası)",
      hutbe: "T.C. Diyanet İşleri Başkanlığı Din Hizmetleri Genel Müdürlüğü (ayna: github.com/Strekeos/turkce-hutbe-api)",
    },
    hutbe,
    gunler: gunler.slice(-400),
  };
  await yazToplu([[DOSYA, yeni, 1]]);

  if (hatalar.length) {
    console.error("HATA:\n" + hatalar.join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`HATA: ${e.message}`);
  process.exit(1);
});
