// 8. tur uçtan uca: guncelle.mjs (DateRange → Monthly) + bağımsız yayın doğrulayıcısı (yayin-dogrula.mjs). Ağ: yalnız 127.0.0.1.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { gunEkle } from "../scripts/v1-dogrulama.mjs";
import { eskiOkuyucuKabul, sozlesme2Dogrula } from "../scripts/resmi/sozlesme2.mjs";
const exec = promisify(execFile), root = fileURLToPath(new URL("../", import.meta.url));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const dmy = (iso) => iso.split("-").reverse().join(".");
const git = (cwd, ...a) => execFileSync("git", a, { cwd, stdio: "pipe", encoding: "utf8" }).trim();
const IDS = Array.from({ length: 81 }, (_, i) => 1001 + i);
const resmiGun = (iso, kay = 0) => ({ gregorianDateShort: dmy(iso), fajr: `06:${String(1 + kay).padStart(2, "0")}`, sunrise: "07:31", dhuhr: "12:31", asr: "15:01", maghrib: "17:31", isha: "19:01", hijriDateLong: "h " + iso });

async function kur(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "yillik-e2e-")), repo = path.join(dir, "repo"), out = path.join(repo, "docs/v1"), tablo = path.join(dir, "tablo.json");
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const durum = { aylikKay: () => 0, aralikBoz: new Set(), aralik403: false }, hits = { aralik: 0, aylik: 0, ayna: 0 };
  const server = http.createServer((req, res) => {
    const send = (c, b) => { res.writeHead(c, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); };
    const u = req.url;
    if (u === "/Auth/Login") { req.resume(); req.on("end", () => send(200, { success: true, data: { accessToken: "A", refreshToken: "R" } })); return; }
    if (u.startsWith("/api/Quota/My")) return send(200, { success: true, data: { daily: [{ period: "Daily", benefit: 1000, totalUsed: 0, totalExceeded: 0, lines: [] }] } });
    if (u === "/api/PrayerTime/DateRange") {
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
        hits.aralik++; if (durum.aralik403) return send(403, {});
        const j = JSON.parse(b), ilk = j.startDate.slice(0, 10), son = j.endDate.slice(0, 10), g = [];
        for (let d = ilk; d <= son; d = gunEkle(d, 1)) if (!(durum.aralikBoz.has(j.cityId) && d === gunEkle(ilk, 40))) g.push(resmiGun(d));
        send(200, { success: true, data: g });
      }); return;
    }
    const m = u.match(/^\/api\/PrayerTime\/Monthly\/(\d+)$/);
    if (m) { hits.aylik++; return send(200, { success: true, data: Array.from({ length: 32 }, (_, i) => resmiGun(gunEkle(today, i), i === 5 ? durum.aylikKay(Number(m[1])) : 0)) }); }
    hits.ayna++; const [, kind, id] = u.split("/");
    if (kind === "sehirler") return send(200, Array.from({ length: 81 }, (_, i) => ({ SehirID: i + 1, SehirAdi: "İl " + i })));
    if (kind === "ilceler") return send(200, [{ IlceID: 1000 + Number(id), IlceAdi: "İlçe " + id }]);
    if (kind === "vakitler") return send(200, Array.from({ length: 15 }, (_, i) => ({ MiladiTarihKisa: dmy(gunEkle(today, i)), Imsak: "06:00", Gunes: "07:30", Ogle: "12:30", Ikindi: "15:00", Aksam: "17:30", Yatsi: "19:00" })));
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  t.after(async () => { server.closeAllConnections(); await new Promise((ok) => server.close(ok)); });
  const url = "http://127.0.0.1:" + server.address().port;
  await fs.writeFile(tablo, JSON.stringify({ surum: 1, ilceler: Object.fromEntries(IDS.map((id, i) => [id, { ilId: i + 1, emushaf: id, resmi: id, dogrulama: { tarih: "2026-11-27" } }])) }));
  const base = { ...process.env, OUT_DIR: out, DELAY_MS: "0", RETRY_BASE_MS: "1", REQUEST_TIMEOUT_MS: "3000", SOURCE_URL: url, ESLESME_TABLOSU: tablo, GITHUB_RUN_ID: "e2e" };
  const resmi = (uc) => ({ VERI_KAYNAGI: "resmi", RESMI_UC: uc, RESMI_KAYNAK_ONAYI: "evet", RESMI_TOPLAM_ISTEK_SINIRI: "400", AWQAT_BASE_URL: url, AWQAT_EMAIL: "e@x.invalid", AWQAT_PASSWORD: "pw", AWQAT_TEST_HIZLI: "1" });
  const guncelle = (env = {}) => exec(process.execPath, [path.join(root, "scripts/guncelle.mjs")], { cwd: root, timeout: 60000, env: { ...base, ...env } });
  // Depo: doğrulayıcı ve yardımcıları + gözden geçirilmiş config (HEAD).
  await fs.mkdir(path.join(repo, "scripts/resmi"), { recursive: true }); await fs.mkdir(path.join(repo, "config"));
  for (const f of ["yayin-dogrula.mjs", "v1-dogrulama.mjs", "kimlik.mjs", "esik.mjs", "bilinen-eksik.mjs", "resmi/sozlesme2.mjs"]) await fs.copyFile(path.join(root, "scripts", f), path.join(repo, "scripts", f));
  await fs.writeFile(path.join(repo, "config/bilinen-eksik.json"), JSON.stringify({ surum: 1, kaynaklar: { ayna: [], resmi: [] } }));
  git(dir, "init", "--initial-branch=main", repo); git(repo, "config", "user.name", "T"); git(repo, "config", "user.email", "t@example.invalid");
  const dogrula = () => { git(repo, "add", "-A", "docs"); return exec(process.execPath, ["scripts/yayin-dogrula.mjs", "prayer"], { cwd: repo }); };
  const kaydet = (m) => { git(repo, "commit", "-q", "-m", m); };
  const oku = async (id) => JSON.parse(await fs.readFile(path.join(out, `vakitler/${id}.json`), "utf8"));
  const anlik = async () => { const r = {}; for (const id of IDS) r[id] = await fs.readFile(path.join(out, `vakitler/${id}.json`), "utf8"); r.meta = await fs.readFile(path.join(out, "meta.json"), "utf8"); return r; };
  // Başlangıç: ayna verisi (geçiş dönemi), HEAD olarak kaydedilir.
  await guncelle(); git(repo, "add", "-A"); kaydet("seed");
  return { repo, out, durum, hits, resmi, guncelle, dogrula, kaydet, oku, anlik };
}

test("end to end: DateRange yearly publish → Monthly verification → correction → systematic stop, all through the independent validator", async (t) => {
  const s = await kur(t);
  // 1) DateRange: 81 ilçe yıllık resmi veri (sözleşme 2), doğrulayıcı kabul eder.
  await s.guncelle(s.resmi("DateRange"));
  assert.equal(s.hits.aralik, 81);
  const d1 = await s.oku(1001);
  sozlesme2Dogrula(d1); assert.equal(d1.gunler.length, 365); assert.equal(d1.kaynak.tur, "resmi-yillik"); assert.equal(d1.guncelleme, d1.kaynak.alindi);
  assert.equal(d1.gecerlilik.ilk, today); assert.equal(d1.gunler[0].h, "h " + today);
  assert.equal(eskiOkuyucuKabul(d1, new Date().toISOString()), true);
  let m = JSON.parse(await fs.readFile(path.join(s.out, "meta.json"), "utf8"));
  assert.equal(m.uc, "DateRange"); assert.equal(m.sozlesme2.yenilendi.length, 81); assert.match(m.sozlesme2.arsiv, /D11/);
  await s.dogrula(); s.kaydet("daterange");

  // 2) Aynı gün DateRange tekrar: yenilemesi gelmemiş yıllık dosyalar istenmez, hiçbir şey yazılmaz.
  const once = await s.anlik(); const aralikOnce = s.hits.aralik;
  await assert.rejects(s.guncelle(s.resmi("DateRange")), /Yenilenecek yıllık dosya yok/);
  assert.equal(s.hits.aralik, aralikOnce); assert.deepEqual(await s.anlik(), once);

  // 3) Monthly eşit: yalnız doğrulama ilerler; guncelle/kaynak/surum/gunler aynı. Doğrulayıcı kabul eder.
  await s.guncelle(s.resmi("Monthly"));
  const d2 = await s.oku(1001);
  for (const a of ["guncelleme", "kaynak", "surum", "gunler", "gecerlilik"]) assert.deepEqual(d2[a], d1[a], a);
  assert.equal(d2.dogrulama.sonuc, "esit"); assert.equal(d2.dogrulama.gun, 32); assert.equal(d2.dogrulama.ilk, today);
  m = JSON.parse(await fs.readFile(path.join(s.out, "meta.json"), "utf8")); assert.equal(m.sozlesme2.dogrulandi.length, 81);
  await s.dogrula();
  // Kurcalama: doğrulanmış dosyaya sahte güncellik → doğrulayıcı reddeder.
  const f = path.join(s.out, "vakitler/1002.json"), x = JSON.parse(await fs.readFile(f, "utf8"));
  await fs.writeFile(f, JSON.stringify({ ...x, guncelleme: new Date().toISOString() }));
  await assert.rejects(s.dogrula(), /guncelleme|sahte/);
  await fs.writeFile(f, JSON.stringify(x)); await s.dogrula(); s.kaydet("monthly-esit");

  // 4) Tek ilçede gerçek düzeltme (1 dk): yeni sürüm, guncelleme ilerler, yeniden çekim kuyruğu. Doğrulayıcı kabul eder.
  s.durum.aylikKay = (id) => (id === 1005 ? 1 : 0);
  await s.guncelle(s.resmi("Monthly"));
  const d5 = await s.oku(1005), d1b = await s.oku(1001);
  assert.notEqual(d5.surum, d1.surum); assert.equal(d5.duzeltmeler.length, 1); assert.ok(Date.parse(d5.guncelleme) > Date.parse(d1.guncelleme));
  assert.equal(d5.gunler.find((g) => g.t === dmy(gunEkle(today, 5))).v[0], "06:02"); assert.equal(d1b.guncelleme, d1.guncelleme);
  m = JSON.parse(await fs.readFile(path.join(s.out, "meta.json"), "utf8")); assert.deepEqual(m.sozlesme2.yenidenCek, [1005]);
  await s.dogrula(); s.kaydet("monthly-duzeltme");

  // 5) Ülke çapında fark: güvenli durdurma, hiçbir dosya yazılmaz.
  s.durum.aylikKay = () => 1;
  const once2 = await s.anlik();
  await assert.rejects(s.guncelle(s.resmi("Monthly")), /Doğrulama durduruldu: sistematik fark/);
  assert.deepEqual(await s.anlik(), once2);
  // 6) Biçim hatası şüphesi (60 dk): tek ilçe bile olsa durdurulur.
  s.durum.aylikKay = (id) => (id === 1007 ? 58 : 0);
  await assert.rejects(s.guncelle(s.resmi("Monthly")), /dakikadan büyük/);
  assert.deepEqual(await s.anlik(), once2);
});

test("end to end: one bad DateRange district stays on its old file (D06 small tolerance); endpoint failure does not touch published data", async (t) => {
  const s = await kur(t);
  s.durum.aralikBoz.add(1003);
  await s.guncelle(s.resmi("DateRange"));
  const m = JSON.parse(await fs.readFile(path.join(s.out, "meta.json"), "utf8"));
  assert.equal(m.durum.basarili, 80); assert.deepEqual(m.durum.yedek, [1003]);
  assert.equal((await s.oku(1003)).sozlesme, undefined); // eski (ayna) dosya korunur, damgası yenilenmez
  await s.dogrula(); s.kaydet("daterange-kismi");
  // DateRange ucu yetki hatası: çalışma durur, hiçbir dosya değişmez; Monthly yayını ayrı çalışmada sürer.
  s.durum.aralik403 = true; s.durum.aralikBoz.clear();
  const once = await s.anlik();
  await assert.rejects(s.guncelle({ ...s.resmi("DateRange"), DILIM_BOYUTU: "5" }), /durduruldu|YETKI/);
  assert.deepEqual(await s.anlik(), once);
  await s.guncelle(s.resmi("Monthly"));
  assert.equal((await s.oku(1001)).dogrulama.sonuc, "esit");
  assert.equal((await s.oku(1003)).sozlesme, undefined); // yıllık olmayan ilçe Monthly ile eski yoldan yenilenir
  await s.dogrula();
});
