import { test } from "node:test";
import assert from "node:assert/strict";
import { gruplar, enAzKalan, izinVerilen, kotaTeshis } from "../scripts/resmi/kota.mjs";

const g = (benefit, totalUsed, extra = {}) => ({ period: 1, benefit, totalUsed, totalExceeded: 0, lines: [], ...extra });

test("kota: geçerli dolu yanıt", () => {
  const k = { date: "2026-11-28", role: "x", daily: [g(100, 10)], weekly: [], monthly: [], yearly: [] };
  assert.equal(enAzKalan(k), 90); assert.equal(izinVerilen(k), 85); assert.equal(kotaTeshis(k).neden, null);
});
test("kota: boş günlük grup (28.11 canlı yanıtının biçimi) → bilinmiyor, fail-closed", () => {
  const k = { date: "2026-11-28T00:12:00", role: "Developer", daily: [], weekly: [], monthly: [], yearly: [] };
  assert.equal(gruplar(k), null); assert.equal(enAzKalan(k), null); assert.equal(izinVerilen(k), 0);
  assert.equal(kotaTeshis(k).neden, "daily listesi boş");
  assert.ok(!(enAzKalan(k) >= 90), "boş liste sınırsız/100 sayılmaz");
});
test("kota: eksik günlük grup", () => {
  const k = { weekly: [g(500, 1)] };
  assert.equal(enAzKalan(k), null); assert.equal(izinVerilen(k), 0); assert.equal(kotaTeshis(k).neden, "daily anahtarı yok");
});
test("kota: sıfır kullanılan hak (yenilenmiş gün)", () => {
  const k = { daily: [g(100, 0)] };
  assert.equal(enAzKalan(k), 100); assert.ok(enAzKalan(k) >= 90);
});
test("kota: eksik limit değeri", () => {
  const k = { daily: [{ period: 1, totalUsed: 3 }] };
  assert.equal(enAzKalan(k), null); assert.equal(izinVerilen(k), 0); assert.match(kotaTeshis(k).neden, /benefit\/totalUsed/);
});
test("kota: değişmiş JSON yapısı", () => {
  for (const k of [{ quotas: [{ limit: 100 }] }, { daily: { benefit: 100, totalUsed: 0 } }]) {
    assert.equal(enAzKalan(k), null); assert.equal(izinVerilen(k), 0); assert.ok(kotaTeshis(k).neden);
  }
});
test("kota: birden fazla grup → en kısıtlayıcı", () => {
  const k = { daily: [g(100, 10), g(20, 15)], weekly: [g(1000, 900)] };
  assert.equal(enAzKalan(k), 5); assert.equal(izinVerilen(k), 4);
});
test("kota: tükenme ve aşım", () => {
  assert.equal(izinVerilen({ daily: [g(100, 100)] }), 0);
  assert.equal(enAzKalan({ daily: [g(100, 50, { totalExceeded: 1 })] }), 0);
});
test("kota: yenilenme (dün tükenmiş, bugün sıfırlanmış)", () => {
  const dun = { daily: [g(100, 100)] }, bugun = { daily: [g(100, 0)] };
  assert.ok(!(enAzKalan(dun) >= 90)); assert.ok(enAzKalan(bugun) >= 90);
});
test("kota: bozuk veya tanınmayan yanıt", () => {
  for (const k of [null, undefined, "x", 42, [], {}]) {
    assert.equal(enAzKalan(k), null); assert.equal(izinVerilen(k), 0); assert.ok(kotaTeshis(k).neden);
  }
});
test("kota teşhisi metin değeri içermez", () => {
  const t = JSON.stringify(kotaTeshis({ date: "gizli@ornek.com", role: "rol", daily: [] }));
  assert.ok(!t.includes("gizli@ornek.com") && !t.includes("\"rol\""));
});
