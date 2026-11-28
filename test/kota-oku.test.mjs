import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
test("quota reader: exactly login + Quota/My, raw response with all periods and lines printed, secrets dropped, ledger +2", async (t) => {
  const hits = [];
  const srv = http.createServer((req, res) => { hits.push(req.url); res.setHeader("Content-Type", "application/json");
    if (req.url === "/Auth/Login") return res.end(JSON.stringify({ success: true, data: { accessToken: "AT-gizli", refreshToken: "RT-gizli" } }));
    if (req.url === "/api/Quota/My") return res.end(JSON.stringify({ success: true, data: { date: "2026-11-28T10:00:00+03:00",
      daily: [{ period: "Daily", benefit: 100, totalUsed: 2, totalExceeded: 0, lines: [{ endpoint: "/api/PrayerTime/Monthly", parameter: "9541", used: 2, userEmail: "k@x.invalid", not: "k@x.invalid" }] }],
      weekly: [], monthly: [{ period: "Monthly", benefit: 10, totalUsed: 1, totalExceeded: 0, lines: [{}] }], yearly: [] } }));
    res.writeHead(404); res.end("{}"); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); t.after(() => new Promise((ok) => srv.close(ok)));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kota-oku-")); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const defter = path.join(dir, "d.json");
  const r = await exec(process.execPath, ["scripts/resmi/kota-oku.mjs"], { env: { ...process.env, AWQAT_BASE_URL: "http://127.0.0.1:" + srv.address().port, AWQAT_EMAIL: "k@x.invalid", AWQAT_PASSWORD: "pw-gizli", AWQAT_DEFTER: defter } });
  assert.deepEqual(hits, ["/Auth/Login", "/api/Quota/My"]);
  const ham = JSON.parse(r.stdout.split("\n").find((l) => l.startsWith("KOTA_HAM ")).slice(9));
  assert.deepEqual(ham.daily[0].lines[0], { endpoint: "/api/PrayerTime/Monthly", parameter: "9541", used: 2, not: "[gizli]" });
  assert.equal(ham.monthly[0].benefit, 10); assert.deepEqual(ham.yearly, []);
  assert.match(r.stdout, /monthly: 1 grup — sınır 10, kullanılan 1, aşım 0, satır 1/); assert.match(r.stdout, /Canlı istek: 2/);
  for (const g of ["AT-gizli", "RT-gizli", "pw-gizli", "k@x.invalid"]) assert.ok(!r.stdout.includes(g) && !r.stderr.includes(g), g);
  const d = JSON.parse(await fs.readFile(defter, "utf8")); assert.equal(d.toplam, 2);
});
