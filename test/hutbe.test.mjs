import test from "node:test";
import assert from "node:assert/strict";
import { hutbeArsivi, HUTBE_ARSIV } from "../scripts/gunluk.mjs";
const k = (date, title = "Hutbe " + date, extra = {}) => ({ language: "tr", date, title, pdf_url: `https://dinhizmetleri.diyanet.gov.tr/${date}.pdf`, ...extra });
test("hutbe archive: newest first, merged with the old archive, at most 52, Diyanet links only", () => {
  const eski = [{ baslik: "Eski", tarih: "2025-01-03", pdf: null, word: null, ses: null }];
  const a = hutbeArsivi(eski, [k("2026-11-20"), k("2026-11-27"), k("2026-11-13", "x", { pdf_url: "https://kotu.example/x.pdf" })], "2026-11-27");
  assert.deepEqual(a.map((h) => h.tarih), ["2026-11-27", "2026-11-20", "2026-11-13", "2025-01-03"]);
  assert.equal(a[2].pdf, null);                                   // Diyanet dışı bağlantı alınmaz
  assert.equal(HUTBE_ARSIV, 52);
  const cok = Array.from({ length: 80 }, (_, i) => k(new Date(Date.UTC(2025, 0, 3 + 7 * i)).toISOString().slice(0, 10)));
  assert.equal(hutbeArsivi([], cok, "2026-11-27").length, 52);
});
test("hutbe archive: future (>7 days), non-Turkish and malformed entries ignored; source update wins on same date", () => {
  const a = hutbeArsivi([{ baslik: "Eski başlık", tarih: "2026-11-27" }], [k("2026-12-11"), { ...k("2026-11-20"), language: "en" }, { date: "x", title: "y", language: "tr" }, k("2026-11-27", "Yeni başlık")], "2026-11-27");
  assert.deepEqual(a.map((h) => [h.tarih, h.baslik]), [["2026-11-27", "Yeni başlık"]]);
  assert.deepEqual(hutbeArsivi([{ baslik: "K", tarih: "2026-11-20" }], [], "2026-11-27").map((h) => h.tarih), ["2026-11-20"]); // kaynak boşsa arşiv korunur
});
