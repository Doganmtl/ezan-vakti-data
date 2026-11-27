// 8. tur G3: sözleşme 2, DateRange yıllık arşiv, Monthly doğrulama, oransal kota. Ağ yok.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { kanonikMetin, surumHesapla, sozlesme2Dogrula, gecisTuru, eskiOkuyucuKabul, gunlerKesintisiz } from "../scripts/resmi/sozlesme2.mjs";
import { aralikGovdesi, aralikDogrula, arsivKaydi, arsivGecis, yayinDosyasi, yenilemeTarihi } from "../scripts/resmi/yillik.mjs";
import { karsilastir, sistematikKarar, SISTEMATIK } from "../scripts/resmi/aylik-dogrulama.mjs";
import { guvenlikPayi, izinVerilen, enAzKalan, ucPlani, gruplar, calismaTavani } from "../scripts/resmi/kota.mjs";
import { siniflandir, oncelik, aralikAdayi, dilimSec } from "../scripts/esik.mjs";
import { gunEkle } from "../scripts/v1-dogrulama.mjs";

const dmy = (iso) => iso.split("-").reverse().join(".");
const V = ["06:12", "07:43", "12:41", "15:12", "17:31", "18:56"];
const gunlerUret = (ilk, n, f = () => V, h = true) => Array.from({ length: n }, (_, i) => { const d = gunEkle(ilk, i); return h ? { t: dmy(d), v: f(d, i), h: "x " + i } : { t: dmy(d), v: f(d, i) }; });
const T0 = "2026-11-28T05:00:00.000Z", T1 = "2026-11-29T05:00:00.000Z", T2 = "2026-12-05T05:00:00.000Z";
const yillik = (ilk = "2026-11-28", n = 365, alindi = T0) => yayinDosyasi(arsivKaydi({ v1Id: 9541, resmiId: 9541, gunler: gunlerUret(ilk, n), alindi, calisma: { runId: "1", commit: null }, ham: [1], simdi: alindi }), { calisma: { runId: "1" } });

// ---- Sözleşme 2 ----
test("content version: canonical text and full SHA-256 match the cross-platform vectors", async () => {
  const v = JSON.parse(await fs.readFile("test/vektorler/surum.json", "utf8")).vektorler;
  assert.equal(v.length, 3);
  for (const x of v) { assert.equal(kanonikMetin(x.gunler), x.kanonik); assert.equal(surumHesapla(x.gunler), x.surum); assert.match(x.surum, /^sha256:[0-9a-f]{64}$/); }
  // Hicri metin sürüme girmez; sıra girişi etkilemez.
  const g = gunlerUret("2026-11-28", 3);
  assert.equal(surumHesapla(g), surumHesapla([...g].reverse().map((x) => ({ t: x.t, v: x.v }))));
});
test("contract 2 file: fields validated; guncelleme is the content time, not the verification time", () => {
  const d = yillik();
  assert.deepEqual(sozlesme2Dogrula(d, { simdi: T0 }), { ilk: "2026-11-28", son: "2027-11-27", gun: 365, tur: "resmi-yillik" });
  assert.equal(d.guncelleme, d.kaynak.alindi);
  const bozuk = (f) => assert.throws(() => sozlesme2Dogrula(f(structuredClone(d)), { simdi: T1 }));
  bozuk((x) => { x.guncelleme = T1; return x; });                       // sahte güncellik
  bozuk((x) => { x.surum = "sha256:" + "0".repeat(64); return x; });
  bozuk((x) => { x.gecerlilik.son = "2027-12-31"; return x; });
  bozuk((x) => { x.kaynak.alindi = "2099-01-01T00:00:00Z"; x.guncelleme = x.kaynak.alindi; return x; }); // gelecek
  bozuk((x) => { x.kaynak.alindi = "2026-11-28T05:00:00+03:00"; return x; }); // UTC Z değil
  bozuk((x) => { x.gunler.splice(10, 1); x.surum = surumHesapla(x.gunler); return x; }); // eksik gün
  bozuk((x) => { x.kaynak.resmiId = null; return x; });
  bozuk((x) => { x.dogrulama = { zaman: T1, uc: "Monthly", ilk: "2026-11-28", son: "2026-12-29", gun: 5, sonuc: "esit", calisma: { runId: "2" } }; return x; }); // gün sayısı
  bozuk((x) => { x.dogrulama = { zaman: "2026-11-27T00:00:00.000Z", uc: "Monthly", ilk: "2026-11-28", son: "2026-11-28", gun: 1, sonuc: "esit", calisma: { runId: "2" } }; return x; }); // sürümden eski
});
test("transitions: verification keeps content and stamps; older data cannot overwrite; no downgrade", () => {
  const d = yillik(), ay = gunlerUret("2026-11-29", 32);
  const k = karsilastir(d, ay, { alindi: T1, calisma: { runId: "2" }, simdi: T1 });
  assert.equal(gecisTuru(d, k.dosya), "dogrulandi");
  assert.throws(() => gecisTuru(d, { ...k.dosya, guncelleme: T1 }), /sahte|guncelleme/);
  assert.throws(() => gecisTuru(k.dosya, d), /doğrulama ilerlemiyor/); // doğrulama geri alınamaz
  const yeni = yillik("2026-12-05", 365, T2);
  assert.equal(gecisTuru(d, yeni), "yenilendi");
  assert.throws(() => gecisTuru(yeni, d), /daha eski/);
  assert.throws(() => gecisTuru(d, { guncelleme: T2, gunler: d.gunler }), /eski biçime/);
  assert.equal(gecisTuru({ guncelleme: "2026-11-19T08:49:00Z", gunler: [] }, d), "ilk");
  assert.throws(() => gecisTuru({ guncelleme: "2026-12-30T00:00:00Z", gunler: [] }, d), /geriye/);
});
test("v1 readers accept contract 2 files (unknown fields ignored) — and reject them after 14 days without a content change", async () => {
  const d = yillik();
  assert.equal(eskiOkuyucuKabul(d, "2026-11-28T09:00:00Z"), true);
  assert.equal(eskiOkuyucuKabul(d, "2026-12-11T09:00:00Z"), true);
  assert.equal(eskiOkuyucuKabul(d, "2026-12-13T09:00:00Z"), false);   // 14 gün kuralı: sahte damga üretilmez → eski okuyucu reddeder (bilinen sonuç)
  const k = karsilastir(d, gunlerUret("2026-12-12", 32), { alindi: "2026-12-12T05:00:00.000Z", calisma: { runId: "3" }, simdi: "2026-12-12T05:00:00.000Z" });
  assert.equal(k.dosya.guncelleme, d.guncelleme);                      // doğrulama damgayı ilerletmez
  assert.equal(eskiOkuyucuKabul(k.dosya, "2026-12-13T09:00:00Z"), false);
  // Gerçek yayın biçimiyle aynı alan kümesi: mevcut yayın dosyası da okunur.
  const yayindaki = JSON.parse(await fs.readFile("docs/v1/vakitler/9541.json", "utf8"));
  assert.equal(typeof yayindaki.guncelleme, "string");
});

// ---- DateRange ----
test("DateRange validation: exact range, continuity, month/year boundaries, leap day, duplicates, foreign place id", () => {
  const g = aralikGovdesi(9541, "2026-11-28");
  assert.deepEqual([g.ilk, g.son, g.startDate, g.endDate], ["2026-11-28", "2027-11-27", "2026-11-28T00:00:00", "2027-11-27T00:00:00"]);
  assert.equal(aralikDogrula(gunlerUret(g.ilk, 365), { ...g, resmiId: 9541 }).gun, 365);
  const artik = aralikGovdesi(1, "2027-12-01"); // 2028 artık yıl: 29.02 dahil 366 takvim günü içinden 365
  const ag = gunlerUret(artik.ilk, 365);
  assert.ok(ag.some((x) => x.t === "29.02.2028")); assert.equal(aralikDogrula(ag, { ...artik, resmiId: 1 }).son, "2028-11-29");
  assert.throws(() => aralikDogrula(gunlerUret(g.ilk, 364), { ...g, resmiId: 9541 }), /aralık farklı/);
  assert.throws(() => aralikDogrula(gunlerUret(g.ilk, 366), { ...g, resmiId: 9541 }), /aralık farklı/);
  const eksik = gunlerUret(g.ilk, 366); eksik.splice(40, 1);
  assert.throws(() => aralikDogrula(eksik, { ...g, resmiId: 9541 }), /eksik gün/);
  const tekrar = gunlerUret(g.ilk, 365); tekrar[5] = tekrar[4];
  assert.throws(() => aralikDogrula(tekrar, { ...g, resmiId: 9541 }), /tekrarlanan|eksik/);
  assert.throws(() => aralikDogrula(gunlerUret(g.ilk, 365, (d, i) => i === 3 ? ["06:00", "05:00", "12:00", "15:00", "17:00", "19:00"] : V), { ...g, resmiId: 9541 }), /sıra/);
  assert.throws(() => aralikDogrula(gunlerUret(g.ilk, 365, (d, i) => i === 3 ? ["24:00", "05:00", "12:00", "15:00", "17:00", "19:00"] : V), { ...g, resmiId: 9541 }), /geçersiz vakit/);
  assert.throws(() => aralikDogrula(gunlerUret(g.ilk, 365), { ...g, resmiId: 9541, yanitKimlikleri: [9206] }), /başka bir yer/);
  assert.throws(() => gunlerKesintisiz([{ t: "30.02.2027", v: V }]), /takvim/);
});
test("archive: separate from the publish file; older fetch cannot overwrite; same content makes no new version", () => {
  const a1 = arsivKaydi({ v1Id: 9541, resmiId: 9541, gunler: gunlerUret("2026-11-28", 365), alindi: T0, calisma: { runId: "1", commit: "a" }, ham: [{ x: 1 }], simdi: T0 });
  assert.equal(a1.uc, "DateRange"); assert.match(a1.hamOzet, /^sha256:/); assert.deepEqual(a1.gecerlilik, { ilk: "2026-11-28", son: "2027-11-27" });
  assert.throws(() => arsivKaydi({ v1Id: 9541, resmiId: 9541, gunler: a1.gunler, alindi: "2099-01-01T00:00:00Z", calisma: {}, simdi: T0 }), /gelecek/);
  const ayni = arsivGecis(a1, { ...a1, alindi: T1 });
  assert.equal(ayni.degisti, false); assert.equal(ayni.kayit.alindi, T0); assert.equal(ayni.gecmis, null);
  const a2 = arsivKaydi({ v1Id: 9541, resmiId: 9541, gunler: gunlerUret("2026-12-05", 365), alindi: T2, calisma: { runId: "2" }, simdi: T2 });
  const g = arsivGecis(a1, a2); assert.equal(g.degisti, true); assert.equal(g.gecmis.eskiSurum, a1.surum);
  assert.throws(() => arsivGecis(a2, a1), /daha eski/);
  const pub = yayinDosyasi(a1, { calisma: { runId: "1" } });
  assert.equal(pub.hamOzet, undefined); assert.equal(pub.calisma, undefined); assert.equal(pub.kaynak.resmiId, 9541); // yayın dosyası arşiv alanlarını taşımaz
  const tekrar = yayinDosyasi({ ...a1, alindi: T1 }, { eski: pub, calisma: { runId: "9" } });
  assert.equal(tekrar.guncelleme, T0); assert.equal(tekrar.dogrulama.uc, "DateRange"); assert.equal(gecisTuru(pub, tekrar), "dogrulandi");
  assert.equal(yenilemeTarihi(pub), gunEkle("2027-11-27", -130));
});

// ---- Monthly ----
test("Monthly equal: only verification fields change; 32 days verify only their own range", () => {
  const d = yillik(), k = karsilastir(d, gunlerUret("2026-11-29", 32), { alindi: T1, calisma: { runId: "2" }, simdi: T1 });
  assert.equal(k.sonuc, "esit");
  for (const a of ["guncelleme", "surum", "kaynak", "gunler", "gecerlilik"]) assert.deepEqual(k.dosya[a], d[a], a);
  assert.deepEqual({ ...k.dosya.dogrulama, calisma: undefined }, { zaman: T1, uc: "Monthly", ilk: "2026-11-29", son: "2026-12-30", gun: 32, sonuc: "esit", calisma: undefined });
  sozlesme2Dogrula(k.dosya, { simdi: T1 });
  assert.equal(karsilastir(d, gunlerUret("2028-01-01", 5), { alindi: T1, calisma: {}, simdi: T1 }).sonuc, "ortak-yok");
  assert.throws(() => karsilastir(d, gunlerUret("2026-11-29", 3), { alindi: "2026-11-27T00:00:00.000Z", calisma: {}, simdi: T1 }), /eski/);
  assert.throws(() => karsilastir({ ...d, kaynak: { ...d.kaynak, tur: "ayna" } }, [], { alindi: T1, calisma: {} }), /yalnız resmi/);
});
test("Monthly different: differences reported, new version with history, content time advances", () => {
  const d = yillik();
  const ay = gunlerUret("2026-11-29", 32, (x) => (x === "2026-12-10" ? ["06:13", "07:43", "12:41", "15:12", "17:31", "18:56"] : V));
  const k = karsilastir(d, ay, { alindi: T1, calisma: { runId: "2" }, simdi: T1 });
  assert.equal(k.sonuc, "degisti");
  assert.deepEqual(k.farklar, [{ tarih: "2026-12-10", vakit: 0, eski: "06:12", yeni: "06:13", dakika: 1 }]);
  assert.notEqual(k.yeniSurum, k.eskiSurum); assert.equal(k.dosya.guncelleme, T1); assert.equal(k.dosya.kaynak.alindi, T0);
  assert.equal(k.dosya.duzeltmeler.length, 1); assert.equal(k.dosya.dogrulama.sonuc, "duzeltildi");
  sozlesme2Dogrula(k.dosya, { simdi: T1 }); assert.equal(gecisTuru(d, k.dosya), "yenilendi");
});
test("systematic-difference rule (proposal): scenarios separate genuine corrections from format/mapping faults", () => {
  const sonuc = (n, degisen, dakika = 1) => Array.from({ length: n }, (_, i) => (i < degisen ? { sonuc: "degisti", azamiDakika: dakika } : { sonuc: "esit", azamiDakika: 0 }));
  // 1) Tek ilçede gerçek düzeltme (1-2 dk), büyük dilim → uygulanır
  assert.equal(sistematikKarar(sonuc(90, 1, 2)).uygula, true);
  // 2) Küçük dilimde (8) tek düzeltme → uygulanır (sınır max(1, floor(8×0,05)) = 1)
  assert.equal(sistematikKarar(sonuc(8, 1)).uygula, true);
  // 3) Küçük dilimde iki ilçe → insan incelemesi
  assert.equal(sistematikKarar(sonuc(8, 2)).durdur, true);
  // 4) Ülke çapında revizyon (tüm ilçeler 1 dk) → durdur
  assert.equal(sistematikKarar(sonuc(90, 90)).durdur, true);
  // 5) Biçim hatası: tek ilçede 60 dk kayma → durdur (otomatik düzeltme yok)
  assert.match(sistematikKarar(sonuc(90, 1, 60)).sebep, /dakikadan büyük/);
  // 6) 90 ilçede 4 düzeltme (sınır 4) → uygulanır; 5 → durdur
  assert.equal(sistematikKarar(sonuc(90, 4)).uygula, true); assert.equal(sistematikKarar(sonuc(90, 5)).durdur, true);
  assert.equal(SISTEMATIK.oran, 0.05); assert.equal(SISTEMATIK.azamiDakika, 15);
});

// ---- Kota (oransal pay) ----
const kota = (gruplarListe) => ({ date: "x", daily: gruplarListe, weekly: [], monthly: [], yearly: [] });
test("proportional safety reserve at 5, 10 and 100 per day", () => {
  assert.deepEqual([guvenlikPayi(5), guvenlikPayi(10), guvenlikPayi(100), guvenlikPayi(1000)], [1, 1, 5, 50]);
  for (const [limit, kullanilan, beklenen] of [[5, 0, 4], [5, 4, 0], [10, 0, 9], [10, 8, 1], [100, 0, 95], [100, 89, 6], [100, 97, 0]])
    assert.equal(izinVerilen(kota([{ period: "Daily", benefit: limit, totalUsed: kullanilan, totalExceeded: 0, lines: [] }])), beklenen, `${limit}/${kullanilan}`);
  // Eski sabit pay hâlâ seçilebilir; mevcut çağrılar için 100'de sonuç aynı.
  assert.equal(izinVerilen(kota([{ benefit: 100, totalUsed: 3 }]), { pay: 5 }), 92);
  assert.equal(izinVerilen(kota([{ benefit: 100, totalUsed: 3 }])), 92);
});
test("quota is fail-closed: unknown, malformed, missing daily group or exceeded → 0", () => {
  for (const k of [null, {}, { daily: [] }, { daily: "x" }, { daily: [{ benefit: "x", totalUsed: 1 }] }, { weekly: [{ benefit: 10, totalUsed: 0 }] }])
    assert.equal(izinVerilen(k), 0, JSON.stringify(k));
  assert.equal(izinVerilen(kota([{ benefit: 100, totalUsed: 10 }, { benefit: 100, totalUsed: 100, totalExceeded: 1 }])), 0);
  assert.equal(enAzKalan(kota([{ benefit: 100, totalUsed: 10, totalExceeded: 2 }])), 0);
  // Aylık/haftalık gruplar da en kısıtlayıcı limite girer.
  assert.equal(izinVerilen({ daily: [{ benefit: 100, totalUsed: 0 }], monthly: [{ benefit: 10, totalUsed: 8 }] }), 1);
});
test("per-endpoint plan only when groups map to endpoints; otherwise one shared pool (90+90 not assumed)", () => {
  const eslenmez = kota([{ benefit: 100, totalUsed: 0, lines: [{}] }, { benefit: 100, totalUsed: 0, lines: [{}] }]);
  const p = ucPlani(eslenmez, [{ uc: "PrayerTime/Monthly", istek: 90 }, { uc: "PrayerTime/DateRange", istek: 90 }]);
  assert.equal(p.havuz, true); assert.deepEqual(p.izinler, { "PrayerTime/Monthly": 90, "PrayerTime/DateRange": 5 }); // 95 ortak
  const eslenir = kota([{ benefit: 100, totalUsed: 10, lines: [{ endpoint: "/api/PrayerTime/Monthly" }] }, { benefit: 100, totalUsed: 2, lines: [{ endpoint: "/api/PrayerTime/DateRange" }] }]);
  assert.equal(gruplar(eslenir)[0].uc, "PrayerTime/Monthly");
  const q = ucPlani(eslenir, [{ uc: "PrayerTime/Monthly", istek: 90 }, { uc: "PrayerTime/DateRange", istek: 90 }]);
  assert.equal(q.havuz, false); assert.deepEqual(q.izinler, { "PrayerTime/Monthly": 85, "PrayerTime/DateRange": 90 });
  const dusuk = kota([{ benefit: 10, totalUsed: 0, lines: [{ e: "/api/PrayerTime/Monthly" }] }]);
  assert.deepEqual(ucPlani(dusuk, [{ uc: "PrayerTime/Monthly", istek: 90 }]).izinler, { "PrayerTime/Monthly": 9 });
  assert.deepEqual(ucPlani(null, [{ uc: "PrayerTime/Monthly", istek: 9 }]).izinler, { "PrayerTime/Monthly": 0 });
  // Toplam istek tavanı: veri + giriş + yenileme + kota okumaları (başarısız/tekrar dahil sayılır).
  assert.equal(calismaTavani({ veriIstegi: 90, tahminiDakika: 10 }), 94);
  assert.equal(calismaTavani({ veriIstegi: 8, tahminiDakika: 60 }), 14);
});

// ---- Seçim önceliği ve sınıflandırma ----
test("priority: legacy files first; DateRange skips yearly files not yet due; Monthly verifies the stalest first", () => {
  const bugun = "2026-12-01";
  const legacy = { guncelleme: "2026-11-19T08:49:00Z", gunler: gunlerUret("2026-11-19", 25, undefined, false) };
  const y1 = yillik(), y2 = { ...yillik("2026-11-28", 365, T0), dogrulama: { zaman: "2026-11-30T00:00:00.000Z" } };
  assert.match(oncelik(legacy, { mod: "DateRange", bugun }), /^0\|/);
  assert.match(oncelik(y1, { mod: "DateRange", bugun }), /^2\|/); assert.equal(aralikAdayi(oncelik(y1, { mod: "DateRange", bugun })), false);
  assert.match(oncelik(y1, { mod: "DateRange", bugun: "2027-07-21" }), /^1\|2027-07-20$/);
  const s = dilimSec([{ id: 3, sonGun: oncelik(y2, { mod: "Monthly", bugun }) }, { id: 2, sonGun: oncelik(y1, { mod: "Monthly", bugun }) }, { id: 1, sonGun: oncelik(legacy, { mod: "Monthly", bugun }) }], 2);
  assert.deepEqual([...s].sort(), [1, 2]);
  assert.equal(oncelik(legacy, {}), oncelik(legacy, { mod: undefined })); // mod yok: eski davranış
});
test("usability classes: v1 policy (current clients) by stamp; v2 draft by coverage and source age", () => {
  const d = yillik();
  assert.equal(siniflandir(d, "2026-11-30"), "yedek");
  assert.equal(siniflandir(d, "2026-12-20"), "tukenmis");                       // v1: damga 14 günü geçti
  assert.equal(siniflandir(d, "2026-12-20", { politika: "v2" }), "yedek");      // v2 taslak: kapsam + kaynak yaşı
  assert.equal(siniflandir(d, "2027-11-24", { politika: "v2" }), "kisaKapsam");
  assert.equal(siniflandir(d, "2027-11-28", { politika: "v2" }), "tukenmis");
});
