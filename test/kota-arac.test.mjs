// D23: token özeti, kota tablosu, zorunlu defter, kalıcı defter dalı.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tokenOzeti } from "../scripts/resmi/awqat-adaptor.mjs";
import { kotaTablosu, kotaTablosuMd, satirCoz } from "../scripts/resmi/kota-tablo.mjs";
import { kotaDefteriOku } from "../scripts/resmi/kota-defteri.mjs";
import { defterOku } from "../scripts/resmi/defter.mjs";
const exec = promisify(execFile);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const KURAL = { hesapAcilis: "2026-11-25", ilkGunSayisi: 15, artirilmisEmniyetGun: 1, ilk15GunUcParametreGunluk: 100, ucParametreGunluk: 10, dateRangeYerAylik: 10 };

test("token summary: JWT times, lifetime, role and claim names only — never token, e-mail, subject or id values", () => {
  const iat = 1764316800; // 2025-11-28T08:00:00Z
  const erisim = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iat, nbf: iat, exp: iat + 45 * 60, sub: "gizli-sub-42", email: "k@x.invalid", jti: "gizli-jti",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Developer", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "gizli-id" })}.imza-gizli`;
  const o = tokenOzeti({ veri: { accessToken: erisim, refreshToken: "RT-gizli-degersiz", expiration: "2025-11-28T08:45:00Z" }, erisim, yenileme: "RT-gizli-degersiz", uc: "giris", simdi: iat * 1000 + 60_000, yenilemeZamani: iat * 1000 + 25 * 60_000 });
  assert.deepEqual(o.yanitAlanlari, ["accessToken", "expiration", "refreshToken"]);
  assert.deepEqual(o.sureAlanlari, { expiration: "2025-11-28T08:45:00Z" });
  assert.equal(o.erisim.jwt, true); assert.equal(o.erisim.alg, "HS256"); assert.equal(o.erisim.omurDk, 45); assert.equal(o.erisim.kalanDk, 44);
  assert.equal(o.erisim.exp, "2025-11-28T08:45:00.000Z"); assert.deepEqual(o.erisim.rol, ["Developer"]); assert.equal(o.erisim.gizliIddialarYazilmadi, 4);
  assert.deepEqual(o.yenileme, { var: true, jwt: false, exp: null }); assert.equal(o.istemciYenilemeZamani, "2025-11-28T08:25:00.000Z");
  const metin = JSON.stringify(o);
  for (const g of ["gizli-sub-42", "k@x.invalid", "gizli-jti", "gizli-id", "imza-gizli", "RT-gizli", erisim.slice(0, 20)]) assert.ok(!metin.includes(g), g);
  assert.deepEqual(tokenOzeti({ veri: { accessToken: "opak" }, erisim: "opak", uc: "giris" }).erisim, { jwt: false, var: true });
});
test("quota table keeps API, documentation and ledger values apart; nothing is guessed (reset: 'API bildirmiyor')", () => {
  const kota = { date: "d", daily: [{ period: "Daily", benefit: 100, totalUsed: 2, totalExceeded: 0, lines: [{ endpoint: "/api/PrayerTime/Monthly/9541", used: 1 }, { path: "/api/PrayerTime/Monthly", cityId: 9206, count: 1, resetAt: "2026-11-29T00:00:00+03:00" }] }], weekly: [], monthly: [], yearly: [] };
  const kd = { sayac: { gun: { "PrayerTime/Monthly": 2, "PrayerTime/Monthly|9541": 1, "PrayerTime/Monthly|9206": 1 }, ay: {}, yil: { "Place/Cities": 85 } } };
  const t = kotaTablosu(kota, { kotaDefteri: kd, kural: KURAL, bugun: "2026-11-28" });
  const api = t.filter((x) => x.kaynak === "API");
  assert.deepEqual(api[0], { kaynak: "API", donem: "daily", hizmet: "PrayerTime/Monthly", parametre: "(grup toplamı)", sinir: 100, kullanilan: 2, kalan: 98, asim: 0, yenilenme: "API bildirmiyor", not: "satır 2" });
  assert.equal(api[1].parametre, "9541"); assert.equal(api[2].parametre, "9206"); assert.deepEqual(api[2].yenilenme, { resetAt: "2026-11-29T00:00:00+03:00" });
  assert.ok(api.some((x) => x.donem === "monthly" && /liste boş/.test(x.not)));
  assert.deepEqual(t.filter((x) => x.kaynak === "BELGE").map((x) => [x.donem, x.hizmet, x.sinir]), [["daily", "her hizmet", 100], ["monthly", "PrayerTime/DateRange", 10]]);
  assert.deepEqual(t.filter((x) => x.kaynak === "DEFTER" && x.donem === "yearly"), [{ kaynak: "DEFTER", donem: "yearly", hizmet: "Place/Cities", parametre: "(hizmet toplamı)", kullanilan: 85 }]);
  assert.ok(t.some((x) => x.kaynak === "DEFTER" && x.donem === "monthly" && x.not === "kayıt yok"));
  const md = kotaTablosuMd(t); assert.match(md, /^\| Kaynak \| Dönem \| Hizmet \| Parametre \| Sınır \| Kullanılan \| Kalan \| Aşım \| Yenilenme \| Not \|/); assert.match(md, /\| API \| daily \| PrayerTime\/Monthly \| \(grup toplamı\) \| 100 \| 2 \| 98 \|/);
  assert.deepEqual(kotaTablosu(null, {})[0], { kaynak: "API", not: "Quota/My yanıtı okunamadı (biçim beklenmedik)" });
  assert.deepEqual(satirCoz({ userEmail: "k@x.invalid", accessToken: "x" }), { hizmet: null, parametre: null, sayilar: {}, yenilenme: {}, diger: {} });
});
test("mandatory ledgers: missing file is corrupt (no reset to zero); optional mode keeps the old behaviour", async (t) => {
  const yok = path.join(os.tmpdir(), `yok-${process.pid}-${Date.now()}.json`);
  assert.equal((await kotaDefteriOku(yok, "2026-11-28", { zorunlu: true })).bozuk, true);
  assert.equal((await kotaDefteriOku(yok, "2026-11-28")).yok, true);
  assert.equal((await defterOku(yok, "2026-11-28", { zorunlu: true })).bozuk, true);
  assert.equal((await defterOku(yok, "2026-11-28")).ilk, true);
});
test("ledger branch script: 'al' fails without the branch; 'kaydet' commits and fast-forwards; unchanged → no commit", async (t) => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "defter-dal-")); t.after(() => fs.rm(d, { recursive: true, force: true }));
  const git = (cwd, ...a) => exec("git", a, { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  const uzak = path.join(d, "uzak.git"), is = path.join(d, "is"), betik = path.resolve("scripts/defter-dali.sh");
  await git(d, "init", "-q", "--bare", uzak); await git(d, "init", "-q", is); await git(is, "remote", "add", "origin", uzak);
  await fs.writeFile(path.join(is, "x"), "1"); await git(is, "add", "x"); await git(is, "commit", "-qm", "m"); await git(is, "push", "-q", "origin", "HEAD:refs/heads/main");
  await assert.rejects(exec("bash", [betik, "al"], { cwd: is }));
  // Dalı tohumla
  const tohum = path.join(d, "tohum"); await git(d, "init", "-q", tohum);
  await fs.writeFile(path.join(tohum, "awqat.json"), "{}\n"); await fs.writeFile(path.join(tohum, "awqat-kota.json"), "{}\n");
  await git(tohum, "add", "."); await git(tohum, "commit", "-qm", "tohum"); await git(tohum, "push", "-q", uzak, "HEAD:refs/heads/kota-defteri");
  const r = await exec("bash", [betik, "al"], { cwd: is }); assert.match(r.stdout, /Defter dalı: /);
  assert.match((await exec("bash", [betik, "kaydet"], { cwd: is })).stdout, /Defter değişmedi/);
  await fs.writeFile(path.join(is, ".defter/awqat-kota.json"), '{"surum":1}\n');
  assert.match((await exec("bash", [betik, "kaydet"], { cwd: is, env: { ...process.env, GITHUB_WORKFLOW: "test", GITHUB_RUN_ID: "7" } })).stdout, /Defter kaydedildi/);
  const { stdout } = await git(d, "--git-dir", uzak, "log", "--format=%s", "kota-defteri"); assert.deepEqual(stdout.trim().split("\n"), ["defter: test #7", "tohum"]);
});
test("kotaYapisi (from PR #13): structure only, no text values; reason only for unreadable responses — empty lists are readable", async () => {
  const { kotaYapisi } = await import("../scripts/resmi/kota.mjs");
  const bos = kotaYapisi({ date: "2026-11-28T00:12:00+03:00", role: "Developer", daily: [], weekly: [], monthly: [], yearly: [] });
  assert.equal(bos.okunabilir, true); assert.equal(bos.neden, null);
  assert.deepEqual(bos.ozet.role, { tur: "metin", uzunluk: 9 }); assert.ok(!JSON.stringify(bos.ozet).includes("Developer"));
  for (const [k, n] of [[null, /nesne değil \(null\)/], [[], /liste/], [{ daily: [] }, /date/], [{ date: "x" }, /daily anahtarı yok/], [{ date: "x", daily: {} }, /daily liste değil/],
    [{ date: "x", daily: [], monthly: 3 }, /monthly liste değil/], [{ date: "x", daily: [{ benefit: "100", totalUsed: 1 }] }, /daily\[0\]/]])
    assert.match(kotaYapisi(k).neden, n, JSON.stringify(k));
});
