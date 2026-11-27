import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defterOku, defterYaz, calismaSiniri, GUNLUK_ISTEK_TAVANI } from "../scripts/resmi/defter.mjs";
import { oncelik } from "../scripts/esik.mjs";
test("ledger: missing → first run; other day → reset; corrupt or inconsistent → fail-closed", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "defter-")); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const f = path.join(dir, "d.json");
  assert.equal(GUNLUK_ISTEK_TAVANI, 100);
  let d = await defterOku(f, "2026-11-28"); assert.equal(d.ilk, true); assert.equal(d.toplam, 0);
  assert.equal(calismaSiniri({ envSinir: 400, defter: d }), 100);
  d = await defterYaz(f, d, { calisma: "1", uc: "DateRange", istek: 92 });
  d = await defterOku(f, "2026-11-28"); assert.equal(d.toplam, 92); assert.equal(d.ilk, false);
  assert.equal(calismaSiniri({ envSinir: 400, defter: d }), 8); assert.equal(calismaSiniri({ envSinir: 5, defter: d }), 5);
  assert.equal((await defterOku(f, "2026-11-29")).toplam, 0);
  await fs.writeFile(f, JSON.stringify({ surum: 1, gun: "2026-11-28", toplam: 1, calismalar: [{ istek: 50 }] }));
  d = await defterOku(f, "2026-11-28"); assert.equal(d.bozuk, true); assert.equal(calismaSiniri({ envSinir: 400, defter: d }), 0);
  await fs.writeFile(f, "x"); assert.equal(calismaSiniri({ envSinir: 400, defter: await defterOku(f, "2026-11-28") }), 0);
  await fs.writeFile(f, JSON.stringify({ surum: 1, gun: "2026-11-28", toplam: 120, calismalar: [{ istek: 120 }] }));
  assert.equal(calismaSiniri({ envSinir: 400, defter: await defterOku(f, "2026-11-28") }), 0);
});
test("priority list: listed districts first in official modes; never forces a not-yet-due yearly DateRange", () => {
  const legacy = { guncelleme: "2026-11-19T08:49:00Z", gunler: [{ t: "19.11.2026", v: ["06:00", "07:00", "12:00", "15:00", "17:00", "19:00"] }] };
  assert.equal(oncelik(legacy, { mod: "DateRange", bugun: "2026-11-28", oncelikli: true }), "!|");
  assert.equal(oncelik(null, { mod: "Monthly", bugun: "2026-11-28", oncelikli: true }), "!|");
  assert.notEqual(oncelik(legacy, { oncelikli: true }), "!|"); // ayna modu: liste uygulanmaz
  const yillik = { sozlesme: 2, kaynak: { tur: "resmi-yillik", alindi: "2026-11-28T05:00:00Z" }, gecerlilik: { son: "2027-11-27" } };
  assert.match(oncelik(yillik, { mod: "DateRange", bugun: "2026-11-29", oncelikli: true }), /^2\|/);
  assert.equal(oncelik(yillik, { mod: "Monthly", bugun: "2026-11-29", oncelikli: true }), "!|");
});
test("operations summary reads published data and the ledger (no network, no secrets)", async () => {
  const { ozet, markdown } = await import("../scripts/resmi/operasyon-raporu.mjs");
  const r = await ozet({ v1: "docs/v1", defter: null });
  assert.equal(r.ilce, 869); assert.equal(r.dogrulanmisEsleme, 869); assert.equal(r.yillik + r.yillikOlmayan + r.dosyasiz, 869);
  assert.match(r.enYakinBitis ?? "", /^\d{4}-\d{2}-\d{2}$/);
  const md = markdown(r); assert.match(md, /Doğrulanmış resmi eşleme \| 869/); assert.match(md, /En yakın veri bitişi/);
});
