// Yayına çıkmadan önce son kontrol:
//  1) Birkaç büyük şehrin bugünkü vakitlerini Diyanet'in resmi Awqat Salah API'siyle karşılaştırır.
//     (Hesap bilgileri GitHub "Secrets" içinde AWQAT_EMAIL / AWQAT_PASSWORD olarak tanımlıysa.
//      Toplam 1 giriş + 3 istek: API'nin endpoint başına istek sınırının altında kalır.)
//  2) Hesap yoksa bu adım atlanır; yapısal kontroller guncelle.mjs içinde zaten yapıldı.
// Uyuşmazlık varsa hata koduyla çıkar → iş akışı veriyi kaydetmez.

import fs from "node:fs/promises";
import path from "node:path";

const OUT = process.env.OUT_DIR ?? "docs/v1";
const API = (process.env.AWQAT_URL ?? "https://awqatsalah.diyanet.gov.tr").replace(/\/$/, "");
const EMAIL = process.env.AWQAT_EMAIL;
const PASSWORD = process.env.AWQAT_PASSWORD;

// İstanbul (merkez), Ankara (merkez), İzmir (merkez)
const ORNEKLER = [
  { id: 9541, ad: "İstanbul" },
  { id: 9206, ad: "Ankara" },
  { id: 9560, ad: "İzmir" },
];

const bugun = () => {
  if (process.env.TODAY) return process.env.TODAY.split("-").reverse().join(".");
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()).split("-");
  return `${d}.${m}.${y}`;
};

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.log("Awqat Salah hesap bilgisi tanımlı değil; resmi API karşılaştırması atlandı.");
    return;
  }
  const login = await fetch(`${API}/Auth/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!login.ok) throw new Error(`Awqat girişi başarısız (HTTP ${login.status})`);
  const token = (await login.json())?.data?.accessToken;
  if (!token) throw new Error("Awqat girişinden erişim jetonu gelmedi");

  const tarih = bugun();
  const sorunlar = [];
  for (const yer of ORNEKLER) {
    const res = await fetch(`${API}/api/PrayerTime/Daily/${yer.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${yer.ad}: Awqat HTTP ${res.status}`);
    const resmi = (await res.json())?.data?.[0];
    if (!resmi) throw new Error(`${yer.ad}: Awqat boş yanıt`);
    const resmiV = [resmi.fajr, resmi.sunrise, resmi.dhuhr, resmi.asr, resmi.maghrib, resmi.isha].map((s) => String(s).slice(0, 5));

    const bizim = JSON.parse(await fs.readFile(path.join(OUT, "vakitler", `${yer.id}.json`), "utf8"));
    const gun = bizim.gunler.find((g) => g.t === tarih);
    if (!gun) {
      sorunlar.push(`${yer.ad}: bizim veride ${tarih} yok`);
      continue;
    }
    if (gun.v.join(" ") !== resmiV.join(" ")) {
      sorunlar.push(`${yer.ad} ${tarih}: bizim [${gun.v.join(" ")}] ≠ Diyanet [${resmiV.join(" ")}]`);
    } else {
      console.log(`✓ ${yer.ad} ${tarih}: Diyanet ile birebir aynı`);
    }
  }
  if (sorunlar.length) throw new Error("Resmi veriyle uyuşmazlık:\n" + sorunlar.join("\n"));
}

main().catch((e) => {
  console.error(`HATA: ${e.message}`);
  process.exit(1);
});
