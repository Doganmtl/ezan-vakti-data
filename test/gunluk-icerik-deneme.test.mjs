import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { yapi, arapcaAlanlari, DENEME_ISTEK } from "../scripts/resmi/gunluk-icerik-deneme.mjs";
const exec = promisify(execFile);
test("structure report detects Arabic fields without exposing whole texts", () => {
  const y = yapi({ verse: { arabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", turkish: "Allah sabredenlerle beraberdir.", ref: "Bakara 2/153" }, list: [{ a: "بسم الله" }] });
  assert.deepEqual(arapcaAlanlari(y).sort(), ["list[0].a", "verse.arabic"]);
  assert.ok(y.verse.turkish.onizleme.length <= 60);
  assert.equal(DENEME_ISTEK, 3);
});
test("probe CLI: exactly 3 requests (login, quota, DailyContent), no retries, no secrets in output", async (t) => {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url); const ok = (d) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ success: true, data: d })); };
    if (req.url === "/Auth/Login") return ok({ accessToken: "AT-gizli", refreshToken: "RT-gizli" });
    if (req.url === "/api/Quota/My") return ok({ date: "2026-11-28T00:05:00+03:00", daily: [{ benefit: 100, totalUsed: 0 }] });
    if (req.url === "/api/DailyContent") return ok({ verse: "Allah sabredenlerle beraberdir.", verseArabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ" });
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const env = { ...process.env, ALLOW_LIVE_API: "evet", AWQAT_EMAIL: "e@x.invalid", AWQAT_PASSWORD: "pw-gizli", AWQAT_BASE_URL: "http://127.0.0.1:" + server.address().port };
  const { stdout, stderr } = await exec(process.execPath, ["scripts/resmi/gunluk-icerik-deneme.mjs"], { env });
  assert.deepEqual(hits, ["/Auth/Login", "/api/Quota/My", "/api/DailyContent"]);
  const j = JSON.parse(stdout.split("\n").find((l) => l.startsWith("DAILYCONTENT_RAPOR ")).slice(19));
  assert.deepEqual(j.arapcaAlanlari, ["verseArabic"]); assert.equal(j.istek, 3);
  for (const g of ["AT-gizli", "RT-gizli", "pw-gizli", "e@x.invalid"]) assert.ok(!stdout.includes(g) && !stderr.includes(g));
});
