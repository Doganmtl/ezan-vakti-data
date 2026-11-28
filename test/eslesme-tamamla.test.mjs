// 8. tur: önceki 868 eşlemenin yeniden kurulması, Şuhut tek il doğrulaması, birleştirme ve resmi adlar. Ağ yok (yalnız 127.0.0.1 sahte sunucu).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { oncekiYenidenKur, runKanitDogrula, ilRaporDogrula, birlestir, tabloyaIsle, v1AdlariniGuncelle } from "../scripts/resmi/eslesme-tamamla.mjs";
import { ilSiniflandir, ilButunluk, buyuk, IL_ISTEK } from "../scripts/resmi/eslesme-il.mjs";
import { resmiAdlariKoru } from "../scripts/kimlik.mjs";
const exec = promisify(execFile);

const iller = JSON.parse(await fs.readFile("docs/v1/iller.json", "utf8"));
// Fixture: uygulama ÖNCESİ durum (8. turda 9183 "SUHUT" → "ŞUHUT" uygulandı; testler o anki duruma sabitlenir).
const ilceler = {};
for (const il of iller) ilceler[il.id] = JSON.parse(await fs.readFile(`docs/v1/ilceler/${il.id}.json`, "utf8")).map((x) => x.id === 9183 ? { ...x, ad: "SUHUT" } : x);
const onceTablo = async () => { const t = JSON.parse(await fs.readFile("eslesme/ilce-kimlikleri.json", "utf8")); delete t.tamEslesme;
  for (const [id, x] of Object.entries(t.ilceler)) { x.resmi = null; x.dogrulama = null; delete x.resmiAd; delete x.resmiAdHam; if (id === "9183") x.ad = "SUHUT"; } return t; };
const kanit = JSON.parse(await fs.readFile("eslesme/kanit/run-45995729583.json", "utf8"));
const afyon = ilceler[502];
const v1Adlar = Object.fromEntries(Object.values(ilceler).flat().map((x) => [x.id, x.ad]));
const resmiAfyon = (degis = (l) => l) => degis(afyon.map((x) => ({ id: x.id, name: x.id === 9183 ? "Şuhut" : x.ad })));

test("previous 868 mapping is rebuilt from v1 lists and matches the run's integrity hash exactly", () => {
  const r = oncekiYenidenKur({ iller, ilceler, ozet: kanit.ozet });
  assert.deepEqual(r.sorunlar, []);
  assert.equal(r.butunluk, "c35aa2550c28d9cc3efeb4563238952bb2f62b7304b3be4d87ced9714b5afc8b");
  assert.equal(Object.values(r.oneri).filter((o) => o.yontem === "ayni-kimlik-ve-ad").length, 868);
  assert.deepEqual(r.eslesmeyen, [9183]);
});
test("tampered previous summary is rejected (hash, counts, unexpected problem, truncated list)", () => {
  const z = kanit.ozet;
  assert.match(oncekiYenidenKur({ iller, ilceler, ozet: { ...z, butunluk: "0".repeat(64) } }).sorunlar.join(), /bütünlük/);
  assert.match(oncekiYenidenKur({ iller, ilceler, ozet: { ...z, sayim: { ...z.sayim, ayni: 869, yok: 0 } } }).sorunlar.join(), /sayım/);
  assert.match(oncekiYenidenKur({ iller, ilceler, ozet: { ...z, sorunlar: [...z.sorunlar, { tur: "farkli-kimlik", id: 9146 }] } }).sorunlar.join(), /kabul edilmeyen/);
  // Fazladan bir "eşleşmedi" kaydı: küme değişir → özet tutmaz.
  assert.match(oncekiYenidenKur({ iller, ilceler, ozet: { ...z, sorunlar: [...z.sorunlar, { tur: "eslesmedi", id: 9146 }] } }).sorunlar.join(), /bütünlük|sayım/);
  assert.match(oncekiYenidenKur({ iller, ilceler, ozet: { ...z, sorunlar: Array(50).fill(z.sorunlar[0]) } }).sorunlar.join(), /kesilmiş/);
  const eksikIl = { ...ilceler }; delete eksikIl[502];
  assert.ok(oncekiYenidenKur({ iller, ilceler: eksikIl, ozet: z }).sorunlar.length > 0);
});
test("run evidence: environment, approval, branch, attempt and commit are all required", () => {
  const ok = { kaynakCommit: kanit.ozet.kaynak.commit, runId: kanit.ozet.kaynak.runId };
  assert.deepEqual(runKanitDogrula(kanit, ok), []);
  const bozuk = (d) => runKanitDogrula({ run: { ...kanit.run, ...d } }, ok).join();
  assert.match(bozuk({ environment: "awqat-uretim" }), /awqat-test/);
  assert.match(bozuk({ onaylar: [] }), /onayı/);
  assert.match(bozuk({ onaylar: [{ state: "rejected", environments: ["awqat-test"] }] }), /onayı/);
  assert.match(bozuk({ head_branch: "main" }), /pilot/);
  assert.match(bozuk({ event: "workflow_dispatch" }), /pilot/);
  assert.match(bozuk({ run_attempt: 2 }), /yeniden/);
  assert.match(bozuk({ conclusion: "failure" }), /başarıyla/);
  assert.match(bozuk({ head_sha: "f".repeat(40) }), /commit/);
  assert.match(runKanitDogrula(kanit, { ...ok, runId: "1" }).join(), /run kimliği/);
});
test("Turkish uppercase keeps letters distinct (no accent folding)", () => {
  assert.equal(buyuk("Şuhut"), "ŞUHUT");
  assert.equal(buyuk(" iscehisar "), "İSCEHİSAR");
  assert.equal(buyuk("Iğdır"), "IĞDIR");
  assert.equal(buyuk("Afyon  karahisar"), "AFYON KARAHİSAR");
  assert.notEqual(buyuk("Şuhut"), buyuk("Suhut"));
  assert.notEqual(buyuk("ısparta"), buyuk("isparta"));
});
test("Şuhut: same id with different spelling → matched, raw official name kept, 17 others re-verified", () => {
  const r = ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: resmiAfyon() });
  assert.equal(r.tam, true);
  assert.deepEqual(r.sayim, { v1: 18, resmi: 18, ayni: 17, adFarkli: 1, ad: 0, yok: 0 });
  assert.deepEqual(r.kayitlar[9183], { resmi: 9183, yontem: "ayni-kimlik-ad-farkli", resmiIl: 502, resmiAdHam: "Şuhut", resmiAd: "ŞUHUT" });
  assert.equal(r.butunluk, ilButunluk(r.kayitlar));
});
test("Şuhut: different id is never applied; missing id is reported, not auto-excepted", async () => {
  const farkli = ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: resmiAfyon((l) => l.map((x) => x.id === 9183 ? { id: 99183, name: "SUHUT" } : x)) });
  assert.equal(farkli.tam, false);
  assert.equal(farkli.kayitlar[9183].yontem, "ad");
  assert.ok(farkli.sorunlar.some((s) => s.tur === "farkli-kimlik") && farkli.sorunlar.some((s) => s.tur === "resmi-listede-fazla"));
  const yok = ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: resmiAfyon((l) => l.filter((x) => x.id !== 9183)) });
  assert.equal(yok.tam, false);
  assert.equal(yok.kayitlar[9183].resmi, null);
  const once = await fs.readFile("config/bilinen-eksik.json", "utf8");
  const b = birlestir({ onceki: oncekiYenidenKur({ iller, ilceler, ozet: kanit.ozet }).oneri, oncekiRun: "45995729583", il: yok, ilRun: "1", v1Adlar });
  assert.equal(b.tam, false); assert.deepEqual(b.eksik, [9183]);
  assert.equal(await fs.readFile("config/bilinen-eksik.json", "utf8"), once); // istisna listesine otomatik ekleme yok
  assert.equal(ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: [{ id: 1, name: "A" }, { id: 1, name: "B" }] }).tam, false);
  assert.equal(ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: null }).tam, false);
});
test("merge: 869 complete, unique official ids, both run ids kept; previous mapping must re-verify", () => {
  const onceki = oncekiYenidenKur({ iller, ilceler, ozet: kanit.ozet }).oneri;
  const il = ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: resmiAfyon() });
  const b = birlestir({ onceki, oncekiRun: "45995729583", il, ilRun: "46000000001", v1Adlar });
  assert.equal(b.tam, true); assert.equal(b.eslesen, 869); assert.deepEqual(b.sorunlar, []);
  assert.deepEqual(b.kayitlar[9168].kaynaklar, ["45995729583", "46000000001"]);
  assert.deepEqual(b.kayitlar[9183].kaynaklar, ["46000000001"]);
  assert.deepEqual(b.kayitlar[9146].kaynaklar, ["45995729583"]);
  assert.equal(b.kayitlar[9146].resmiAdHam, null); // önceki run ham adı saklamamıştı: uydurulmaz
  assert.match(b.butunluk, /^[0-9a-f]{64}$/);
  // Afyon'da önceki eşleme yeni listede başka kimliğe dönmüşse → reddedilir.
  const cel = ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: resmiAfyon((l) => l.map((x) => x.id === 9168 ? { id: 99168, name: x.name } : x)) });
  assert.equal(birlestir({ onceki, oncekiRun: "a", il: cel, ilRun: "b", v1Adlar }).tam, false);
});
test("apply: table gets all 869 same-id records; only ŞUHUT name changes; ids and order unchanged", async () => {
  const tablo = await onceTablo();
  const b = birlestir({ onceki: oncekiYenidenKur({ iller, ilceler, ozet: kanit.ozet }).oneri, oncekiRun: "45995729583", il: ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: resmiAfyon() }), ilRun: "46000000001", v1Adlar });
  const t = tabloyaIsle(tablo, b.kayitlar, { tarih: "2026-11-27" });
  assert.equal(t.islenen + t.zatenVar, 869); assert.deepEqual(t.atlanan, []);
  assert.match(tablo.ilceler[9183].dogrulama.kaynak, /46000000001/);
  const ad = v1AdlariniGuncelle(ilceler, tablo);
  assert.deepEqual(ad.degisen, [{ id: 9183, eski: "SUHUT", yeni: "ŞUHUT" }]);
  assert.deepEqual(ad.ilceler[502].map((x) => x.id), afyon.map((x) => x.id));
  // Mevcut farklı resmi kimlik asla ezilmez.
  const t2 = await onceTablo(); t2.ilceler[9146].resmi = 12345;
  assert.ok(tabloyaIsle(t2, b.kayitlar, { tarih: "x" }).atlanan.includes(9146)); assert.equal(t2.ilceler[9146].resmi, 12345);
});
test("verified official names survive a mirror run that brings the old spelling", () => {
  const tablo = { ilceler: { 9183: { resmiAd: "ŞUHUT" } } };
  assert.deepEqual(resmiAdlariKoru([{ id: 9183, ad: "SUHUT" }, { id: 9184, ad: "SULTANDAĞI" }], tablo), [{ id: 9183, ad: "ŞUHUT" }, { id: 9184, ad: "SULTANDAĞI" }]);
  assert.deepEqual(resmiAdlariKoru([{ id: 1, ad: "A" }], null), [{ id: 1, ad: "A" }]);
});
test("single-province report validation rejects tampering and over-budget reports", () => {
  const r = { ...ilSiniflandir({ ilId: 502, v1Liste: afyon, resmiListe: resmiAfyon() }), kaynak: { runId: "9" }, istek: 4 };
  assert.deepEqual(ilRaporDogrula(r, { v1Liste: afyon, runId: "9" }), []);
  assert.match(ilRaporDogrula({ ...r, kayitlar: { ...r.kayitlar, 9183: { ...r.kayitlar[9183], resmiAdHam: "X" } } }, { v1Liste: afyon, runId: "9" }).join(), /bütünlük/);
  assert.match(ilRaporDogrula({ ...r, istek: 5 }, { v1Liste: afyon, runId: "9" }).join(), /4 istek/);
  assert.match(ilRaporDogrula(r, { v1Liste: afyon.slice(1), runId: "9" }).join(), /kimlik kümesi/);
});

// ---- eslesme-il CLI: 4 istek sınırı, kota, tekrar yok, gizli değer yok ----
async function sunucu(t, { kota = "normal", cities = "normal" } = {}) {
  const hits = [], dir = await fs.mkdtemp(path.join(os.tmpdir(), "esil-"));
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    const ok = (d) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ success: true, data: d })); };
    if (req.url === "/Auth/Login") return ok({ accessToken: "AT-secret", refreshToken: "RT-secret" });
    if (req.url.startsWith("/api/Quota/My")) {
      if (kota === "bilinmiyor") return ok({ daily: [] });
      return ok({ date: "2026-11-28T09:00:00+03:00", daily: [{ period: "Daily", benefit: 100, totalUsed: kota === "yetersiz" ? 95 : 84, totalExceeded: 0 }] });
    }
    if (req.url === "/api/Place/Cities/502") { if (cities === "500") { res.writeHead(500); return res.end(); } return ok(resmiAfyon()); }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  t.after(async () => { server.closeAllConnections(); await new Promise((ok) => server.close(ok)); await fs.rm(dir, { recursive: true, force: true }); });
  const env = { ...process.env, ALLOW_LIVE_API: "evet", ESLESME_IL: "502", AWQAT_EMAIL: "k@example.invalid", AWQAT_PASSWORD: "pw-secret",
    AWQAT_BASE_URL: "http://127.0.0.1:" + server.address().port, GOLGE_DIR: dir, GITHUB_SHA: "c".repeat(40), GITHUB_RUN_ID: "888" };
  const run = () => exec(process.execPath, ["scripts/resmi/eslesme-il.mjs"], { env, timeout: 30000 }).then((r) => ({ code: 0, ...r }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));
  return { hits, dir, run };
}
test("province CLI: exactly 4 requests in order, report in log, no secrets", async (t) => {
  const s = await sunucu(t); const r = await s.run();
  assert.equal(r.code, 0, r.stderr); assert.equal(IL_ISTEK, 4);
  assert.deepEqual(s.hits, ["/Auth/Login", "/api/Quota/My", "/api/Place/Cities/502", "/api/Quota/My"]);
  const satir = r.stdout.split("\n").find((l) => l.startsWith("ESLESME_IL_RAPOR "));
  const j = JSON.parse(satir.slice(17));
  assert.equal(j.kayitlar[9183].resmiAd, "ŞUHUT"); assert.equal(j.istek, 4); assert.equal(j.kaynak.runId, "888"); assert.equal(j.kota.onceEnAzKalan, 16);
  assert.deepEqual(ilRaporDogrula(j, { v1Liste: afyon, runId: "888" }), []);
  for (const g of ["AT-secret", "RT-secret", "pw-secret", "k@example.invalid", "Bearer"]) assert.ok(!r.stdout.includes(g) && !r.stderr.includes(g));
  const ikinci = await s.run(); assert.equal(ikinci.code, 4); assert.equal(s.hits.length, 4); // aynı gün ikinci çalışma ağa çıkmaz
});
test("province CLI: unknown or insufficient quota stops before the Cities request", async (t) => {
  for (const kota of ["bilinmiyor", "yetersiz"]) {
    const s = await sunucu(t, { kota }); const r = await s.run();
    assert.equal(r.code, 5, kota); assert.deepEqual(s.hits, ["/Auth/Login", "/api/Quota/My"]);
  }
});
test("province CLI: server error on Cities is not retried", async (t) => {
  const s = await sunucu(t, { cities: "500" }); const r = await s.run();
  assert.equal(r.code, 1); assert.equal(s.hits.filter((h) => h.includes("Cities")).length, 1); assert.ok(s.hits.length <= 4);
});
test("province CLI refuses without live flag, credentials or province id (no network)", async (t) => {
  const s = await sunucu(t);
  for (const sil of ["ALLOW_LIVE_API", "AWQAT_PASSWORD", "ESLESME_IL"]) {
    const env = { ...process.env, ALLOW_LIVE_API: "evet", ESLESME_IL: "502", AWQAT_EMAIL: "a@b.invalid", AWQAT_PASSWORD: "x", AWQAT_BASE_URL: "http://127.0.0.1:1", GOLGE_DIR: s.dir };
    delete env[sil];
    const r = await exec(process.execPath, ["scripts/resmi/eslesme-il.mjs"], { env }).then(() => ({ code: 0 }), (e) => ({ code: e.code }));
    assert.equal(r.code, 2, sil);
  }
  assert.equal(s.hits.length, 0);
});
test("committed state: 869 verified records, ŞUHUT published, combined hash recorded with both run ids", async () => {
  const t = JSON.parse(await fs.readFile("eslesme/ilce-kimlikleri.json", "utf8"));
  assert.equal(Object.values(t.ilceler).filter((x) => x.resmi !== null && x.resmi === x.emushaf).length, 869);
  assert.deepEqual(t.tamEslesme.kaynaklar, ["45995729583", "46004878195"]);
  assert.equal(t.tamEslesme.oncekiButunluk, "c35aa2550c28d9cc3efeb4563238952bb2f62b7304b3be4d87ced9714b5afc8b");
  assert.equal(JSON.parse(await fs.readFile("docs/v1/ilceler/502.json", "utf8")).find((x) => x.id === 9183).ad, "ŞUHUT");
  const k = JSON.parse(await fs.readFile("eslesme/kanit/run-46004878195.json", "utf8"));
  assert.deepEqual(ilRaporDogrula(k.rapor, { v1Liste: afyon, runId: "46004878195" }), []);
  assert.equal(k.rapor.istek, 4); assert.equal(k.rapor.kayitlar[9183].resmiAdHam, "ŞUHUT");
});
