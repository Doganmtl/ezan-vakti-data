import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const TODAY = "2026-11-28";
const gun = (i) => ({ gregorianDateShort: `${String(28 + i > 30 ? 28 + i - 30 : 28 + i).padStart(2, "0")}.${28 + i > 30 ? "12" : "11"}.2026`, fajr: "06:11", sunrise: "07:40", dhuhr: "12:33", asr: "15:05", maghrib: "17:16", isha: "18:39", hijriDateLong: "h" });

async function kur(t, { yabanci = 0, monthlyHata = false } = {}) {
  const hits = []; let kullanim = yabanci;
  const srv = http.createServer((req, res) => { hits.push(req.url); res.setHeader("Content-Type", "application/json");
    const ok = (d) => res.end(JSON.stringify({ success: true, data: d }));
    if (req.url === "/Auth/Login") return ok({ accessToken: "AT-gizli", refreshToken: "RT-gizli" });
    if (req.url === "/api/Quota/My") return ok({ date: `${TODAY}T10:00:00+03:00`, role: "Developer", userEmail: "k@x.invalid",
      daily: kullanim ? [{ period: "Daily", benefit: 100, totalUsed: kullanim, totalExceeded: 0, lines: Array.from({ length: kullanim }, (_, i) => ({ endpoint: "/api/PrayerTime/Monthly", parameter: String(9541 + i), not: "k@x.invalid" })) }] : [],
      weekly: [], monthly: [], yearly: [] });
    const m = req.url.match(/^\/api\/PrayerTime\/Monthly\/(\d+)$/);
    if (m) { if (monthlyHata) { res.writeHead(500); return res.end("{}"); } kullanim++; return ok(Array.from({ length: 30 }, (_, i) => gun(i))); }
    res.writeHead(404); res.end("{}"); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); t.after(() => new Promise((ok) => srv.close(ok)));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kota-oku-")); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const env = { ...process.env, TODAY, AWQAT_BASE_URL: "http://127.0.0.1:" + srv.address().port, AWQAT_EMAIL: "k@x.invalid", AWQAT_PASSWORD: "pw-gizli",
    AWQAT_DEFTER: path.join(dir, "op.json"), AWQAT_KOTA_DEFTERI: path.join(dir, "kota.json") };
  const run = (ek = {}) => exec(process.execPath, ["scripts/resmi/kota-oku.mjs"], { env: { ...env, ...ek } }).then((r) => ({ code: 0, ...r }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));
  const oku = async (f) => JSON.parse(await fs.readFile(env[f], "utf8"));
  return { hits, run, oku };
}
const gizliYok = (r) => { for (const g of ["AT-gizli", "RT-gizli", "pw-gizli", "k@x.invalid"]) assert.ok(!r.stdout.includes(g) && !r.stderr.includes(g), g); };

test("kota mode: exactly login + Quota/My, raw response printed (secrets dropped), operational ledger +2, quota ledger unchanged", async (t) => {
  const s = await kur(t); const r = await s.run({ KOTA_MODU: "kota" });
  assert.equal(r.code, 0, r.stderr); assert.deepEqual(s.hits, ["/Auth/Login", "/api/Quota/My"]);
  const ham = JSON.parse(r.stdout.split("\n").find((l) => l.startsWith("KOTA_HAM 1 ")).slice(11));
  assert.deepEqual(ham, { date: `${TODAY}T10:00:00+03:00`, role: "Developer", daily: [], weekly: [], monthly: [], yearly: [] });
  gizliYok(r);
  assert.equal((await s.oku("AWQAT_DEFTER")).toplam, 2);
  assert.deepEqual((await s.oku("AWQAT_KOTA_DEFTERI")).sayac, { gun: {}, ay: {}, yil: {} });
});
test("teshis mode: 6 requests in the planned order; lines shown; Monthly counted in quota ledger per service and parameter", async (t) => {
  const s = await kur(t); const r = await s.run({ KOTA_MODU: "teshis" });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(s.hits, ["/Auth/Login", "/api/Quota/My", "/api/PrayerTime/Monthly/9541", "/api/Quota/My", "/api/PrayerTime/Monthly/9206", "/api/Quota/My"]);
  const ham5 = JSON.parse(r.stdout.split("\n").find((l) => l.startsWith("KOTA_HAM 5 ")).slice(11));
  assert.equal(ham5.daily[0].totalUsed, 2); assert.deepEqual(ham5.daily[0].lines[0], { endpoint: "/api/PrayerTime/Monthly", parameter: "9541", not: "[gizli]" });
  gizliYok(r);
  assert.equal((await s.oku("AWQAT_DEFTER")).toplam, 6);
  const k = await s.oku("AWQAT_KOTA_DEFTERI");
  assert.deepEqual(k.sayac.gun, { "PrayerTime/Monthly": 2, "PrayerTime/Monthly|9541": 1, "PrayerTime/Monthly|9206": 1 });
});
test("teshis mode stops at the first problem: foreign usage → only login + one Quota/My; Monthly error → no further request", async (t) => {
  const s = await kur(t, { yabanci: 3 }); const r = await s.run({ KOTA_MODU: "teshis" });
  assert.equal(r.code, 1); assert.match(r.stderr, /saymadığımız kullanım/); assert.deepEqual(s.hits, ["/Auth/Login", "/api/Quota/My"]);
  const u = await kur(t, { monthlyHata: true }); const q = await u.run({ KOTA_MODU: "teshis" });
  assert.equal(q.code, 1); assert.deepEqual(u.hits, ["/Auth/Login", "/api/Quota/My", "/api/PrayerTime/Monthly/9541"]);
  assert.deepEqual((await u.oku("AWQAT_KOTA_DEFTERI")).sayac.gun, { "PrayerTime/Monthly": 1, "PrayerTime/Monthly|9541": 1 }, "başarısız istek de sayılır");
});
test("operational cap is checked before any request", async (t) => {
  const s = await kur(t);
  const r = await s.run({ KOTA_MODU: "teshis", GUNLUK_ISTEK_TAVANI: "5" });
  assert.equal(r.code, 3); assert.deepEqual(s.hits, []);
});
