import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const j = JSON.parse(readFileSync(new URL("./vektorler/hesaplama.json", import.meta.url), "utf8"));
const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;

test("hesaplama vektörleri: yapı ve kapsam", () => {
  assert.equal(j.surum, 1);
  assert.equal(j.referans.paket, "adhan@4.4.6");
  assert.equal(j.vakalar.length, 336);
  const yontem = new Set(j.vakalar.map((v) => v.yontem));
  assert.deepEqual([...yontem].sort(), ["isna", "karaci", "misir", "mwl", "ummalqura"]);
  for (const v of j.vakalar) {
    assert.match(v.tarih, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(v.ofset, /^[+-]\d{2}:\d{2}$/);
    assert.ok(["safii", "hanefi"].includes(v.ikindi));
    for (const k of ["imsak", "gunes", "ogle", "ikindi", "aksam", "yatsi"]) assert.match(v.vakitler[k], SAAT, `${v.yer} ${v.tarih} ${k}`);
  }
});

test("hesaplama vektörleri: yaz saati ofsetleri", () => {
  const ofset = (yer, tarih) => j.vakalar.find((v) => v.yer === yer && v.tarih === tarih).ofset;
  assert.equal(ofset("londra", "2026-01-15"), "+00:00");
  assert.equal(ofset("londra", "2026-03-29"), "+01:00");
  assert.equal(ofset("newyork", "2026-11-01"), "-05:00");
  assert.equal(ofset("ankara", "2026-06-21"), "+03:00");
});

test("hesaplama vektörleri: Hanefi ikindi Şafii'den sonra, diğer vakitler aynı", () => {
  const s = j.vakalar.filter((v) => v.ikindi === "safii" && v.yuksekEnlem === "ortagece");
  for (const h of j.vakalar.filter((v) => v.ikindi === "hanefi" && v.yuksekEnlem === "ortagece")) {
    const e = s.find((v) => v.yer === h.yer && v.tarih === h.tarih && v.yontem === h.yontem);
    assert.ok(h.vakitler.ikindi > e.vakitler.ikindi);
    assert.equal(h.vakitler.aksam, e.vakitler.aksam);
  }
});
