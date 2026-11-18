// Test için sahte kaynak sunucu: ezanvakti.emushaf.net ile aynı biçimde yanıt verir.
// Kullanım: node test/sahte-kaynak.mjs <port> [mod]
//   mod = "normal" | "bozuk-saat" | "eksik-il" | "cok-hata" | "429"
import http from "node:http";

const port = Number(process.argv[2] ?? 8787);
const mod = process.argv[3] ?? "normal";
const BUGUN = process.env.TODAY ?? "2026-11-18";

const ilSayisi = mod === "eksik-il" ? 80 : 81;
const iller = Array.from({ length: ilSayisi }, (_, i) => ({ SehirAdi: i === 5 ? "ANKARA" : `İL${i + 1}`, SehirID: String(500 + i) }));
const ilceler = (ilId) =>
  ilId === 505
    ? [{ IlceAdi: "ANKARA", IlceID: "9206" }, { IlceAdi: "ÇANKAYA", IlceID: "9207" }]
    : [{ IlceAdi: `MERKEZ${ilId}`, IlceID: String(ilId * 10) }, { IlceAdi: `İLÇE${ilId}`, IlceID: String(ilId * 10 + 1) }];

function vakitler(ilceId) {
  const gunler = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(BUGUN + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const t = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
    let v = ["06:03", "07:30", "12:39", "15:14", "17:38", "19:00"];
    if (mod === "bozuk-saat" && ilceId === 9207 && i === 3) v = ["06:03", "05:30", "12:39", "15:14", "17:38", "19:00"];
    gunler.push({ Imsak: v[0], Gunes: v[1], Ogle: v[2], Ikindi: v[3], Aksam: v[4], Yatsi: v[5], MiladiTarihKisa: t, HicriTarihUzun: "9 Cemaziyelahir 1448" });
  }
  return gunler;
}

let sayac = 0;
http
  .createServer((req, res) => {
    if (mod === "429" && ++sayac % 25 === 0) { res.writeHead(429, { "Retry-After": "1" }); return res.end(); }
    const [, tur, id] = req.url.split("/");
    let body;
    if (tur === "sehirler") body = iller;
    else if (tur === "ilceler") body = ilceler(Number(id));
    else if (tur === "vakitler") {
      if (mod === "cok-hata" && Number(id) % 3 === 0) { res.writeHead(500); return res.end(); }
      body = vakitler(Number(id));
    }
    if (!body) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  })
  .listen(port, () => console.log(`sahte kaynak :${port} (${mod})`));
