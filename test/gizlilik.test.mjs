import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sayfa = readFileSync(new URL("../docs/gizlilik.html", import.meta.url), "utf8");
const arsiv = readFileSync(new URL("../docs/gizlilik-v1.html", import.meta.url), "utf8");

test("gizlilik v2: Türkçe, sürüm, 30 madde ve özet", () => {
  assert.match(sayfa, /<html lang="tr">/);
  assert.match(sayfa, /<meta charset="utf-8">/);
  assert.match(sayfa, /Sürüm 2\.0\.0/);
  assert.equal((sayfa.match(/<h2 id="(?!ozet)/g) || []).length, 30);
  assert.match(sayfa, /doganmutlu\.apps@outlook\.com/);
  assert.match(sayfa, /Kısa özet/);
});

test("gizlilik v2: iç bağlantılar çözülür, kimlikler tekil", () => {
  const ids = [...sayfa.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, h] of sayfa.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(h), h);
});

test("gizlilik v2: takip/analiz/harici kaynak yok", () => {
  assert.doesNotMatch(sayfa, /<script|<iframe|<link[^>]+stylesheet|fonts\.googleapis|google-analytics|gtag\(|document\.cookie/i);
  assert.doesNotMatch(sayfa, /lang="(en|ar|de)"/);
});

test("gizlilik v1 arşivi işaretli", () => {
  assert.match(arsiv, /Arşiv: Bu, 19 Kasım 2026 tarihli 1\.0 sürümüdür/);
  assert.match(arsiv, /noindex/);
  assert.match(sayfa, /href="gizlilik-v1\.html"/);
});
