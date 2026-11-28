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
// Gerçek Quota/My yanıtları (run 46126362363; gizli alanlar atılmış).
const V = JSON.parse(await fs.readFile(new URL("./vektorler/quota-my-2026-11-28.json", import.meta.url), "utf8"));
const SOZ = JSON.parse(await fs.readFile(new URL("../config/awqat-sozlesme.json", import.meta.url), "utf8"));
const ML = "PrayerTime/Monthly", DR = "PrayerTime/DateRange";
test("real Quota/My schema: 13 services with controllerName/resultName; per-parameter lines 'cityId:9541' with used/remainingUse/exceededCount; period bounds", async () => {
  const { kotaOku } = await import("../scripts/resmi/kota.mjs");
  const a2 = kotaOku(V.adim2_includeUnused), a6 = kotaOku(V.adim6_includeUnused_Monthly9206_sonrasi), a4 = kotaOku(V.adim4_varsayilan_Monthly9541_sonrasi);
  assert.equal(a2.rol, "Developer"); assert.equal(a2.gruplar.length, 13); assert.ok(a2.gruplar.every((g) => g.donem === "daily" && g.limit === 100 && g.kullanilan === 0));
  assert.ok(a2.gruplar.every((g) => g.donemBas === "2026-11-28T00:00:00" && g.donemSon === "2026-11-28T23:59:59.999"));
  assert.equal(a4.gruplar.length, 1, "varsayılan (includeUnused=false) yalnız kullanılmış hizmet");
  const m = a6.gruplar.find((g) => g.hizmet === "PrayerTime/PrayerTimeMonthly");
  assert.equal(m.kullanilan, 2);
  assert.deepEqual(m.parametreler.sort((x, y) => x.deger.localeCompare(y.deger)), [{ ad: "cityId", deger: "9206", kullanilan: 1, kalan: 99, asim: 0 }, { ad: "cityId", deger: "9541", kullanilan: 1, kalan: 99, asim: 0 }]);
  // remainingUse = benefit − o parametrenin kullanımı (grup toplamı 2 iken 99): sınır parametre başına.
  assert.ok(m.parametreler.every((p) => p.kalan === m.limit - p.kullanilan));
  assert.deepEqual([V.adim2_includeUnused.weekly, V.adim2_includeUnused.monthly, V.adim2_includeUnused.yearly], [[], [], []]);
});
test("real schema → decision: Monthly mapped and per-parameter usage read; DateRange limit visible before use; foreign usage per service", async () => {
  const { hizmetDurumu, parametreIzni, kotaAdi } = await import("../scripts/resmi/kota.mjs");
  assert.equal(kotaAdi(SOZ.kota, ML), "PrayerTime/PrayerTimeMonthly"); assert.equal(kotaAdi(SOZ.kota, "Place/Cities", { parametreli: false }), "Place/GetAllCities");
  const kd = { sayac: { gun: { [ML]: 2, [`${ML}|9541`]: 1, [`${ML}|9206`]: 1 }, ay: {}, yil: {} } };
  const d = hizmetDurumu(V.adim6_includeUnused_Monthly9206_sonrasi, { hizmet: ML, kotaDefteri: kd, kural: SOZ.kota, bugun: "2026-11-28" });
  assert.equal(d.izin, true); assert.equal(d.donemler.daily.kullanim, 2); assert.equal(d.donemler.daily.bas, "2026-11-28T00:00:00"); assert.equal(d.parametreler["9541"].kalan, 99);
  assert.equal(parametreIzni({ durum: d, hizmet: ML, parametre: "9541", kotaDefteri: kd, kural: SOZ.kota }).izin, true);
  const dr = hizmetDurumu(V.adim2_includeUnused, { hizmet: DR, kotaDefteri: kd, kural: SOZ.kota, bugun: "2026-11-28" });
  assert.equal(dr.izin, true); assert.equal(dr.donemler.daily.sinir, 10, "D24: API 100 gösterse de planlama 10"); assert.equal(dr.donemler.daily.kullanim, 0); // Monthly kullanımı DateRange'i etkilemez
  const y = hizmetDurumu(V.adim6_includeUnused_Monthly9206_sonrasi, { hizmet: ML, kotaDefteri: { sayac: { gun: {}, ay: {}, yil: {} } }, kural: SOZ.kota, bugun: "2026-11-28" });
  assert.equal(y.yabanci, true); assert.match(y.sebep, /PrayerTime\/Monthly: Quota\/My bugün 2/);
  assert.equal(hizmetDurumu(V.adim6_includeUnused_Monthly9206_sonrasi, { hizmet: DR, kotaDefteri: { sayac: { gun: {}, ay: {}, yil: {} } }, kural: SOZ.kota, bugun: "2026-11-28" }).izin, true, "başka hizmetin yabancı kullanımı bu hizmeti durdurmaz");
  // Parametre satırı aşım bildirirse yalnız o parametre reddedilir.
  const asim = structuredClone(V.adim6_includeUnused_Monthly9206_sonrasi); asim.daily.find((g) => g.resultName === "PrayerTimeMonthly").lines[0].exceededCount = 1;
  const da = hizmetDurumu(asim, { hizmet: ML, kotaDefteri: kd, kural: SOZ.kota, bugun: "2026-11-28" });
  const red = asim.daily.find((g) => g.resultName === "PrayerTimeMonthly").lines[0].parameter.split(":")[1];
  assert.equal(parametreIzni({ durum: da, hizmet: ML, parametre: red, kotaDefteri: kd, kural: SOZ.kota }).izin, false);
  assert.equal(parametreIzni({ durum: da, hizmet: ML, parametre: "1", kotaDefteri: kd, kural: SOZ.kota }).izin, true);
  // Hizmet toplamı tedbiri kapatılırsa (parametre başına yorum) kalan hizmet toplamıyla sınırlanmaz.
  const ac = hizmetDurumu(V.adim6_includeUnused_Monthly9206_sonrasi, { hizmet: ML, kotaDefteri: kd, kural: { ...SOZ.kota, hizmetToplamSiniri: false }, bugun: "2026-12-20" });
  assert.equal(ac.hizmetToplami, false); assert.equal(ac.kalan, Infinity);
  const kd9 = { sayac: { gun: { [ML]: 50, [`${ML}|1`]: 7 }, ay: {}, yil: {} } };
  assert.equal(parametreIzni({ durum: { ...ac, donemler: { daily: { sinir: 10, pay: 1, kullanim: 50, kalan: -41 } } }, hizmet: ML, parametre: "2", kotaDefteri: kd9, kural: SOZ.kota }).izin, true);
  assert.equal(parametreIzni({ durum: { ...ac, donemler: { daily: { sinir: 10, pay: 1, kullanim: 50, kalan: -41 } } }, hizmet: ML, parametre: "1", kotaDefteri: kd9, kural: SOZ.kota }).izin, true);
  assert.equal(parametreIzni({ durum: { ...ac, donemler: { daily: { sinir: 10, pay: 1, kullanim: 50, kalan: -41 } } }, hizmet: ML, parametre: "1", kotaDefteri: { sayac: { gun: { [`${ML}|1`]: 8 }, ay: {}, yil: {} } }, kural: SOZ.kota }).izin, false);
});
test("quota table from the real response keeps API, documentation and ledger apart; API period bounds shown; nothing guessed", () => {
  const kd = { sayac: { gun: { [ML]: 2, [`${ML}|9541`]: 1, [`${ML}|9206`]: 1 }, ay: {}, yil: { "Place/City": 0 } } };
  const t = kotaTablosu(V.adim6_includeUnused_Monthly9206_sonrasi, { kotaDefteri: kd, kural: SOZ.kota, bugun: "2026-11-28" });
  const m = t.filter((x) => x.kaynak === "API" && x.hizmet === "PrayerTime/PrayerTimeMonthly (PrayerTime/Monthly)");
  assert.equal(m.length, 3); assert.equal(m[0].kullanilan, 2); assert.deepEqual(m[0].yenilenme, { bas: "2026-11-28T00:00:00", son: "2026-11-28T23:59:59.999" });
  assert.deepEqual(m.slice(1).map((x) => [x.parametre, x.kullanilan, x.kalan, x.asim]).sort(), [["cityId:9206", 1, 99, 0], ["cityId:9541", 1, 99, 0]]);
  assert.ok(t.some((x) => x.kaynak === "API" && x.hizmet === "Place/GetAllCities (Place/Cities (parametresiz))"));
  assert.ok(t.some((x) => x.kaynak === "API" && x.donem === "monthly" && /liste boş/.test(x.not)));
  assert.deepEqual(t.filter((x) => x.kaynak === "BELGE").map((x) => [x.donem, x.hizmet, x.sinir]), [["daily", "her hizmet", 10], ["monthly", "PrayerTime/DateRange", 10]]);
  assert.ok(t.some((x) => x.kaynak === "DEFTER" && x.donem === "daily" && x.hizmet === ML && x.kullanilan === 2));
  const md = kotaTablosuMd(t); assert.match(md, /\| API \| daily \| PrayerTime\/PrayerTimeMonthly \(PrayerTime\/Monthly\) \| cityId:9541 \| 100 \| 1 \| 99 \| 0 \|/);
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
  await fs.writeFile(path.join(is, ".defter/awqat-kota.json"), '{"surum":1}\n'); await fs.writeFile(path.join(is, ".defter/kota-durum.md"), "# durum\n");
  assert.match((await exec("bash", [betik, "kaydet"], { cwd: is, env: { ...process.env, GITHUB_WORKFLOW: "test", GITHUB_RUN_ID: "7" } })).stdout, /Defter kaydedildi/);
  const { stdout } = await git(d, "--git-dir", uzak, "log", "--format=%s", "kota-defteri"); assert.deepEqual(stdout.trim().split("\n"), ["defter: test #7", "tohum"]);
  assert.match((await git(d, "--git-dir", uzak, "show", "kota-defteri:kota-durum.md")).stdout, /# durum/);
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

// ---- D24: kalıcı kota politikası ----
const D24 = { ...SOZ.kota }; // config: hizmetToplamSiniri false, artirilmisDonemPlanlamada false, ucParametreGunluk 10
const bosD24 = { date: "2026-11-28T09:00:00+03:00", daily: [], weekly: [], monthly: [], yearly: [] };
const grup = (o) => ({ controllerName: "PrayerTime", resultName: "PrayerTimeMonthly", period: "Daily", benefit: 100, totalUsed: 0, totalExceeded: 0, lines: [], ...o });
test("D24 config: planning 10, service-total measure off, boosted period not used", async () => {
  const { kuralSiniri } = await import("../scripts/resmi/kota.mjs");
  assert.equal(D24.ucParametreGunluk, 10); assert.equal(D24.hizmetToplamSiniri, false); assert.equal(D24.artirilmisDonemPlanlamada, false);
  assert.equal(kuralSiniri(D24, "2026-11-28"), 10); assert.equal(D24.dateRangeYerAylik, 10);
});
test("D24: 869 independent district parameters in one service — all allowed at the normal limit (each 0 + 2 ≤ 9); with the old service-total measure only 8 (ch + 2 ≤ 9)", async () => {
  const { hizmetDurumu, parametreIzni } = await import("../scripts/resmi/kota.mjs");
  const kd = { sayac: { gun: {}, ay: {}, yil: {} } };
  for (const [kural, beklenen] of [[D24, 869], [{ ...D24, hizmetToplamSiniri: true }, 8]]) {
    const d = hizmetDurumu(V.adim2_includeUnused, { hizmet: DR, kotaDefteri: kd, kural, bugun: "2026-11-28" });
    const calisma = {}; let izin = 0;
    for (let i = 0; i < 869; i++) {
      const p = String(9000 + i);
      if (!parametreIzni({ durum: d, hizmet: DR, parametre: p, kotaDefteri: kd, calisma, kural }).izin) break;
      izin++; calisma[DR] = (calisma[DR] ?? 0) + 1; calisma[`${DR}|${p}`] = 1;
    }
    assert.equal(izin, beklenen, `hizmetToplamSiniri=${kural.hizmetToplamSiniri}`);
  }
});
test("D24: a parameter's exhausted quota (lines exceededCount) stops only that parameter; unexplained or service-wide excess stops the service", async () => {
  const { hizmetDurumu, parametreIzni } = await import("../scripts/resmi/kota.mjs");
  const kd = { sayac: { gun: { [ML]: 12, [`${ML}|9541`]: 10, [`${ML}|9206`]: 2 }, ay: {}, yil: {} } };
  const k = (g) => ({ date: "d", daily: [grup(g)], weekly: [], monthly: [], yearly: [] });
  const satirli = k({ benefit: 10, totalUsed: 12, totalExceeded: 1, lines: [{ parameter: "cityId:9541", used: 10, remainingUse: 0, exceededCount: 1 }, { parameter: "cityId:9206", used: 2, remainingUse: 8, exceededCount: 0 }] });
  const d = hizmetDurumu(satirli, { hizmet: ML, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" });
  assert.equal(d.izin, true); assert.deepEqual(d.engelli, ["9541"]); assert.match(d.sebep, /aşımdaki parametreler: 9541/);
  assert.equal(parametreIzni({ durum: d, hizmet: ML, parametre: "9541", kotaDefteri: kd, kural: D24 }).izin, false);
  assert.equal(parametreIzni({ durum: d, hizmet: ML, parametre: "9206", kotaDefteri: kd, kural: D24 }).izin, true);
  assert.equal(parametreIzni({ durum: d, hizmet: ML, parametre: "1", kotaDefteri: kd, kural: D24 }).izin, true);
  // totalExceeded satırlarla açıklanamıyor (3 > 1) → hizmet durur; satır yok → kaynağı belirsiz → durur; eşlenemeyen grup → durur.
  const aciklanmayan = k({ benefit: 10, totalUsed: 12, totalExceeded: 3, lines: [{ parameter: "cityId:9541", used: 10, remainingUse: 0, exceededCount: 1 }] });
  assert.match(hizmetDurumu(aciklanmayan, { hizmet: ML, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" }).sebep, /hizmet geneli, satırlarla açıklanmıyor/);
  assert.match(hizmetDurumu(k({ totalUsed: 12, totalExceeded: 1 }), { hizmet: ML, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" }).sebep, /kaynağı belirsiz/);
  const adsiz = { date: "d", daily: [{ benefit: 10, totalUsed: 1, totalExceeded: 1 }] };
  assert.match(hizmetDurumu(adsiz, { hizmet: ML, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" }).sebep, /hizmet eşlenemedi/);
  // Başka hizmetin aşımı bu hizmeti durdurmaz.
  assert.equal(hizmetDurumu(satirli, { hizmet: DR, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" }).izin, true);
});
test("D24: weekly, monthly and yearly per-parameter server quotas are enforced even with the service-total measure off", async () => {
  const { hizmetDurumu, parametreIzni } = await import("../scripts/resmi/kota.mjs");
  const ay = (used) => ({ date: "d", daily: [grup({ benefit: 100, totalUsed: 0 })], weekly: [grup({ period: "Weekly", benefit: 20, totalUsed: 3, lines: [{ parameter: "cityId:7", used: 18, remainingUse: 2, exceededCount: 0 }] })],
    monthly: [grup({ period: "Monthly", benefit: 30, totalUsed: used, lines: [{ parameter: "cityId:9541", used, remainingUse: 30 - used, exceededCount: 0 }] })], yearly: [grup({ period: "Yearly", benefit: 50, totalUsed: 0 })] });
  const kd = { sayac: { gun: {}, ay: {}, yil: { [`${ML}|5`]: 48 } } };
  const d = hizmetDurumu(ay(26), { hizmet: ML, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" });
  assert.deepEqual(Object.keys(d.donemler), ["daily", "weekly", "monthly", "yearly"]); assert.equal(d.hizmetToplami, false);
  const iz = (p) => parametreIzni({ durum: d, hizmet: ML, parametre: p, kotaDefteri: kd, kural: D24 });
  assert.equal(iz("9541").izin, true);               // aylık: 26 + 2 ≤ 30 − 2
  assert.match(parametreIzni({ durum: hizmetDurumu(ay(27), { hizmet: ML, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" }), hizmet: ML, parametre: "9541", kotaDefteri: kd, kural: D24 }).sebep, /monthly: 27\/30/);
  assert.match(iz("7").sebep, /weekly: 18\/20/);   // haftalık: yalnız sunucu değeri (defterde haftalık sayaç yok)
  assert.match(iz("5").sebep, /yearly: 48\/50/);   // yıllık: kendi defterimiz (sunucu satırı yok)
  assert.equal(iz("1").izin, true);
});
test("D24: lower server limit wins (5 < 10) for every parameter; DateRange monthly place limit still applies", async () => {
  const { hizmetDurumu, parametreIzni } = await import("../scripts/resmi/kota.mjs");
  const k = { date: "d", daily: [grup({ resultName: "PrayerTimeDateRange", benefit: 5, totalUsed: 0 })], weekly: [], monthly: [], yearly: [] };
  const kd = { sayac: { gun: { [`${DR}|1`]: 3 }, ay: { [`${DR}|2`]: 8 }, yil: {} } };
  const d = hizmetDurumu(k, { hizmet: DR, kotaDefteri: kd, kural: D24, bugun: "2026-11-28" });
  assert.equal(d.donemler.daily.sinir, 5);
  assert.equal(parametreIzni({ durum: d, hizmet: DR, parametre: "1", kotaDefteri: kd, kural: D24 }).izin, false); // 3 + 2 > 5 − 1
  assert.match(parametreIzni({ durum: d, hizmet: DR, parametre: "2", kotaDefteri: kd, kural: D24 }).sebep, /bu ay: 8\/10/);
  assert.equal(parametreIzni({ durum: d, hizmet: DR, parametre: "3", kotaDefteri: kd, kural: D24 }).izin, true);
});
test("D24 operational cap: 'yok' removes the shared daily cap but keeps the per-run group cap and HTTP logging; undefined keeps 100; garbage → 0", async () => {
  const { tavanOku, calismaSiniri } = await import("../scripts/resmi/defter.mjs");
  assert.equal(tavanOku("yok"), Infinity); assert.equal(tavanOku(undefined), 100); assert.equal(tavanOku("150"), 150); assert.equal(tavanOku("x"), 0); assert.equal(tavanOku("-3"), 0);
  assert.equal(calismaSiniri({ envSinir: 110, tavan: Infinity, defter: { toplam: 5000, bozuk: false } }), 110);
  assert.equal(calismaSiniri({ envSinir: 110, tavan: Infinity, defter: { toplam: 0, bozuk: true } }), 0);
  assert.equal(calismaSiniri({ envSinir: 110, tavan: 100, defter: { toplam: 97, bozuk: false } }), 3);
});
test("write-ahead reservations: a dead run's reservation is folded into day/month/year by its own day; own reservation replaced on finish; corrupt → fail-closed", async (t) => {
  const { rezervasyonEkle, kotaDefteriYaz, kotaDefteriOku, kotaDefterineEkle } = await import("../scripts/resmi/kota-defteri.mjs");
  const { defterOku, defterYaz, rezervYaz } = await import("../scripts/resmi/defter.mjs");
  const f = path.join(os.tmpdir(), `rez-${process.pid}-${Date.now()}.json`), o = f + ".op"; t.after(() => Promise.all([fs.rm(f, { force: true }), fs.rm(o, { force: true })]));
  const bos = await kotaDefteriOku(f, "2026-11-30");
  const r = rezervasyonEkle(bos, { calisma: "1", planlanan: [{ hizmet: DR, parametre: 9541 }, { hizmet: DR, parametre: 9206 }], gun: "2026-11-30" });
  await kotaDefteriYaz(f, r);
  const ayni = await kotaDefteriOku(f, "2026-11-30");
  assert.deepEqual(ayni.devralinan, ["1"]); assert.equal(ayni.sayac.gun[DR], 4); assert.equal(ayni.sayac.ay[`${DR}|9541`], 2); assert.equal(ayni.sayac.yil[DR], 4);
  const ertesi = await kotaDefteriOku(f, "2026-12-01"); assert.deepEqual(ertesi.sayac.gun, {}); assert.deepEqual(ertesi.sayac.ay, {}); assert.equal(ertesi.sayac.yil[DR], 4);
  assert.deepEqual((await kotaDefteriOku(f, "2027-01-02")).sayac.yil, {});
  // Kendi rezervasyonu: bitişte kaldırılır, gerçek sayı yazılır.
  const son = kotaDefterineEkle(r, { [`POST /api/PrayerTime/DateRange {"cityId":9541}`]: 1 }, { calisma: "1" });
  assert.equal(son.rezervasyonlar.length, 0); assert.equal(son.sayac.gun[DR], 1);
  await fs.writeFile(f, JSON.stringify({ surum: 1, gun: "2026-11-30", sayac: { gun: {}, ay: {}, yil: {} }, rezervasyonlar: [{ calisma: "x", gun: "bozuk", kota: {} }] }));
  assert.equal((await kotaDefteriOku(f, "2026-11-30")).bozuk, true);
  // Operasyonel defter: rezerv kaydı tüketilmiş sayılır; aynı çalışma bitince yerine geçer.
  const d0 = await defterOku(o, "2026-11-30");
  await rezervYaz(o, d0, { calisma: "1", uc: "DateRange", istek: 110 });
  assert.equal((await defterOku(o, "2026-11-30")).toplam, 110);
  await defterYaz(o, await defterOku(o, "2026-11-30"), { calisma: "1", uc: "DateRange", istek: 37 });
  const d2 = await defterOku(o, "2026-11-30"); assert.equal(d2.toplam, 37); assert.equal(d2.calismalar.length, 1);
});
