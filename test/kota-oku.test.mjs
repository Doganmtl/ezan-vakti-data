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
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const AT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iat, exp: iat + 2700, sub: "gizli-sub", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Developer", email: "k@x.invalid" })}.imzaGizliImzaGizli`;
const gun = (i) => { const d = new Date(Date.UTC(2026, 10, 28 + i)); return { gregorianDateShort: `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`, fajr: "06:11", sunrise: "07:40", dhuhr: "12:33", asr: "15:05", maghrib: "17:16", isha: "18:39", hijriDateLong: "h" }; };
const Q = "/api/Quota/My?includeUnused=true";

async function kur(t, { asim = false, monthlyHata = false, bozukKota = false } = {}) {
  const hits = []; const kullanim = {};
  const srv = http.createServer((req, res) => { hits.push(req.url); res.setHeader("Content-Type", "application/json");
    const ok = (d) => res.end(JSON.stringify({ success: true, data: d }));
    if (req.url === "/Auth/Login") return ok({ accessToken: AT, refreshToken: "RT-gizli" });
    const tum = req.url === Q;
    if (req.url === "/api/Quota/My" || tum) {
      if (bozukKota) return ok({ beklenmedik: true });
      const m = Object.keys(kullanim);
      return ok({ date: `${TODAY}T10:00:00+03:00`, role: "Developer", userEmail: "k@x.invalid",
        daily: [...(m.length ? [{ period: "Daily", benefit: 100, totalUsed: m.length, totalExceeded: asim ? 1 : 0, lines: m.map((p) => ({ endpoint: `/api/PrayerTime/Monthly/${p}`, used: 1, not: "k@x.invalid" })) }] : []),
          ...(tum ? [{ period: "Daily", benefit: 100, totalUsed: 0, totalExceeded: 0, lines: [{ endpoint: "/api/PrayerTime/DateRange" }] }] : [])],
        weekly: [], monthly: [], yearly: [] });
    }
    const mm = req.url.match(/^\/api\/PrayerTime\/Monthly\/(\d+)$/);
    if (mm) { if (monthlyHata) { res.writeHead(500); return res.end("{}"); } kullanim[mm[1]] = 1; return ok(Array.from({ length: 30 }, (_, i) => gun(i))); }
    res.writeHead(404); res.end("{}"); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); t.after(() => new Promise((ok) => srv.close(ok)));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kota-oku-")); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const env = { ...process.env, TODAY, AWQAT_BASE_URL: "http://127.0.0.1:" + srv.address().port, AWQAT_EMAIL: "k@x.invalid", AWQAT_PASSWORD: "pw-gizli",
    AWQAT_DEFTER: path.join(dir, "op.json"), AWQAT_KOTA_DEFTERI: path.join(dir, "kota.json"), GITHUB_STEP_SUMMARY: path.join(dir, "ozet.md") };
  const run = (ek = {}) => exec(process.execPath, ["scripts/resmi/kota-oku.mjs"], { env: { ...env, ...ek } }).then((r) => ({ code: 0, ...r }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));
  const oku = async (f) => JSON.parse(await fs.readFile(env[f], "utf8"));
  return { hits, run, oku, env };
}
const satir = (r, on) => { const l = r.stdout.split("\n").find((x) => x.startsWith(on)); return JSON.parse(l.slice(on.length).replace(/^[^{[]*/, "")); };
const gizliYok = (r) => { for (const g of ["gizli-sub", "imzaGizli", "RT-gizli", "pw-gizli", "k@x.invalid", AT.slice(0, 30)]) assert.ok(!r.stdout.includes(g) && !r.stderr.includes(g), g); };

test("kota mode (persistent tool): login + Quota/My?includeUnused=true only; token summary; table in step summary; ledgers updated", async (t) => {
  const s = await kur(t); const r = await s.run({ KOTA_MODU: "kota" });
  assert.equal(r.code, 0, r.stderr); assert.deepEqual(s.hits, ["/Auth/Login", Q]);
  const tok = satir(r, "TOKEN_OZET "); assert.equal(tok.erisim.jwt, true); assert.equal(tok.erisim.omurDk, 45); assert.deepEqual(tok.erisim.rol, ["Developer"]); assert.equal(tok.yenileme.var, true);
  assert.match(r.stdout, /KOTA_HAM 2 includeUnused=true \{/);
  assert.ok(Array.isArray(satir(r, "KOTA_TABLO ")));
  const md = await fs.readFile(s.env.GITHUB_STEP_SUMMARY, "utf8");
  assert.match(md, /\| API \| daily \| PrayerTime\/DateRange \| \(grup toplamı\) \| 100 \| 0 \|  \| 0 \|/); assert.match(md, /\| BELGE \| daily \| her hizmet \|/); assert.match(md, /HTTP istek: 2/);
  gizliYok(r);
  assert.equal((await s.oku("AWQAT_DEFTER")).toplam, 2); assert.deepEqual((await s.oku("AWQAT_KOTA_DEFTERI")).sayac.gun, {});
});
test("teshis mode: exactly the approved 6 requests in order; Monthly counted per service and parameter; raw lines visible", async (t) => {
  const s = await kur(t); const r = await s.run({ KOTA_MODU: "teshis" });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(s.hits, ["/Auth/Login", Q, "/api/PrayerTime/Monthly/9541", "/api/Quota/My", "/api/PrayerTime/Monthly/9206", Q]);
  const h6 = satir(r, "KOTA_HAM 6 "); assert.equal(h6.daily[0].totalUsed, 2); assert.deepEqual(h6.daily[0].lines.find((l) => l.endpoint.endsWith("/9541")), { endpoint: "/api/PrayerTime/Monthly/9541", used: 1, not: "[gizli]" });
  gizliYok(r);
  assert.equal((await s.oku("AWQAT_DEFTER")).toplam, 6);
  const k = await s.oku("AWQAT_KOTA_DEFTERI");
  for (const d of ["gun", "ay", "yil"]) assert.deepEqual(k.sayac[d], { "PrayerTime/Monthly": 2, "PrayerTime/Monthly|9541": 1, "PrayerTime/Monthly|9206": 1 });
  assert.equal(satir(r, "KOTA_OKU_OZET ").http, 6);
});
test("teshis: unparseable quota does NOT stop; exceeded quota and HTTP errors do (no retry, no extra request); failed request still counted", async (t) => {
  const b = await kur(t, { bozukKota: true }); const rb = await b.run({ KOTA_MODU: "teshis" });
  assert.equal(rb.code, 0, rb.stderr); assert.equal(b.hits.length, 6); assert.match(rb.stdout, /ayrıştırılamadı \(teşhis sürer\)/);
  const a = await kur(t, { asim: true }); const ra = await a.run({ KOTA_MODU: "teshis" });
  assert.equal(ra.code, 1); assert.match(ra.stderr, /aşım bildiriyor/); assert.deepEqual(a.hits, ["/Auth/Login", Q, "/api/PrayerTime/Monthly/9541", "/api/Quota/My"]);
  const m = await kur(t, { monthlyHata: true }); const rm = await m.run({ KOTA_MODU: "teshis" });
  assert.equal(rm.code, 1); assert.deepEqual(m.hits, ["/Auth/Login", Q, "/api/PrayerTime/Monthly/9541"]);
  assert.deepEqual((await m.oku("AWQAT_KOTA_DEFTERI")).sayac.gun, { "PrayerTime/Monthly": 1, "PrayerTime/Monthly|9541": 1 });
});
test("guards before any request: operational cap, mandatory ledger missing, unknown mode", async (t) => {
  const s = await kur(t);
  assert.equal((await s.run({ KOTA_MODU: "teshis", GUNLUK_ISTEK_TAVANI: "5" })).code, 3);
  assert.equal((await s.run({ KOTA_MODU: "kota", KOTA_DEFTERI_ZORUNLU: "evet" })).code, 3);
  assert.equal((await s.run({ KOTA_MODU: "hepsi" })).code, 2);
  assert.deepEqual(s.hits, []);
});
