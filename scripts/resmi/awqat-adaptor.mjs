// Diyanet Awqat Salah resmi API adaptörü. Tüm uç, alan, token ve kota bilgisi config/awqat-sozlesme.json'dan
// gelir; kodda varsayım yoktur. Kimlik bilgileri yalnız çağıran tarafından (ortam/secret) verilir, loglanmaz.
// Bu modül tek başına ağ isteği başlatmaz; istemci oluşturulup çağrılmadıkça hiçbir şey yapmaz.
import { isoTarih } from "../v1-dogrulama.mjs";

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;
export class AwqatHatasi extends Error {
  constructor(kod, mesaj, { durum } = {}) { super(mesaj); this.kod = kod; this.durum = durum; }
}

export function sozlesmeDogrula(s) {
  const yok = (k) => { throw new AwqatHatasi("SOZLESME", "sözleşmede eksik alan: " + k); };
  if (s?.surum !== 1) yok("surum");
  // Yalnız https; http yalnız yerel test sunucusu (127.0.0.1) için.
  if (typeof s.baseUrl !== "string" || !/^(https:\/\/|http:\/\/127\.0\.0\.1:\d+$)/.test(s.baseUrl)) yok("baseUrl (https)");
  for (const u of ["giris", "yenile", "aylik"]) {
    const x = s.uclar?.[u];
    if (!x || !["GET", "POST"].includes(x.yontem) || typeof x.yol !== "string" || !x.yol.startsWith("/")) yok("uclar." + u);
  }
  for (const k of ["veri", "basari"]) if (typeof s.zarf?.[k] !== "string") yok("zarf." + k);
  for (const k of ["erisim", "yenileme"]) if (typeof s.token?.[k] !== "string") yok("token." + k);
  if (!(s.token.erisimOmruDk > 0) || !(s.token.guvenlikPayiDk >= 0)) yok("token.erisimOmruDk");
  if (typeof s.vakit?.tarih !== "string" || s.vakit.tarihBicimi !== "DD.MM.YYYY" || !Array.isArray(s.vakit.alanlar) || s.vakit.alanlar.length !== 6) yok("vakit");
  if (!Number.isSafeInteger(s.kota?.calismaBasinaUcParametreAzami) || s.kota.calismaBasinaUcParametreAzami < 1) yok("kota.calismaBasinaUcParametreAzami");
  return s;
}

/** Resmi API'nin bir gününü v1 {t, v, h?} biçimine çevirir; geçersizse hata. */
export function vakitDonustur(g, s) {
  const t = String(g?.[s.vakit.tarih] ?? "").trim();
  isoTarih(t);
  const v = s.vakit.alanlar.map((k) => String(g?.[k] ?? "").trim().slice(0, 5));
  if (v.some((x) => !SAAT.test(x))) throw new AwqatHatasi("VERI", `${t}: geçersiz saat`);
  for (let i = 1; i < 6; i++) if (v[i] <= v[i - 1]) throw new AwqatHatasi("VERI", `${t}: vakitler sıralı değil`);
  const h = s.vakit.hicri && g[s.vakit.hicri] ? String(g[s.vakit.hicri]).trim() : undefined;
  return h ? { t, v, h } : { t, v };
}

export class AwqatIstemci {
  #s; #email; #sifre; #fetch; #simdi; #bekle; #timeout; #maxBekleMs;
  #erisim = null; #yenileme = null; #bitis = 0; #sayac = new Map(); #toplam = 0; #toplamSinir; #tekrarYok;
  constructor({ sozlesme, email, sifre, fetchFn = globalThis.fetch, simdi = Date.now,
    bekle = (ms) => new Promise((r) => setTimeout(r, ms)), timeoutMs = 20_000, maxBekleMs = 120_000, toplamIstekSiniri, tekrarYok = false }) {
    // Toplam kota belgelerde net değil (bkz. sözleşme "belirsizlikler"): çağıran açık bir üst sınır vermek zorunda.
    if (!Number.isSafeInteger(toplamIstekSiniri) || toplamIstekSiniri < 1) throw new AwqatHatasi("KOTA_KORUMA", "toplam istek sınırı verilmedi");
    this.#toplamSinir = toplamIstekSiniri;
    this.#tekrarYok = tekrarYok; // pilot: hiçbir tekrar yok, ilk hata durdurur
    this.#s = sozlesmeDogrula(sozlesme);
    if (typeof email !== "string" || !email || typeof sifre !== "string" || !sifre) throw new AwqatHatasi("KIMLIK", "Awqat kimlik bilgisi tanımlı değil");
    this.#email = email; this.#sifre = sifre;
    this.#fetch = fetchFn; this.#simdi = simdi; this.#bekle = bekle; this.#timeout = timeoutMs; this.#maxBekleMs = maxBekleMs;
  }
  /** Bu çalışmada uç+parametre başına yapılan istek sayıları (kota izleme). */
  get istekSayilari() { return Object.fromEntries(this.#sayac); }
  get toplamIstek() { return this.#toplam; }
  /** Metindeki kimlik bilgisi ve token'ları maskeler (rapor/log yazmadan önce). */
  maskele(m) { return this.#temizle(m, 0); }
  /** Metin e-posta, şifre, erişim/yenileme token'ı ya da Authorization başlığı içeriyor mu? */
  gizliIcerir(m) {
    const x = String(m ?? "");
    return [this.#sifre, this.#email, this.#erisim, this.#yenileme].some((g) => g && x.includes(g)) || /bearer\s|authorization/i.test(x);
  }

  #temizle(m, sinir = 200) {
    let x = String(m ?? "");
    for (const gizli of [this.#sifre, this.#erisim, this.#yenileme, this.#email]) if (gizli) x = x.split(gizli).join("***");
    return sinir ? x.slice(0, sinir) : x;
  }
  #yol(uc, p = {}) {
    return this.#s.uclar[uc].yol.replace(/\{(\w+)\}/g, (_, k) => {
      if (p[k] === undefined || p[k] === null || p[k] === "") throw new AwqatHatasi("PARAM", "eksik parametre: " + k);
      return encodeURIComponent(String(p[k]));
    });
  }
  async #istek(uc, params, { govde, yetki = true } = {}) {
    const { yontem } = this.#s.uclar[uc];
    const yol = this.#yol(uc, params);
    // Kota anahtarı: hassas parametre (yenileme token) sayaca yazılmaz.
    const anahtar = uc === "yenile" ? "yenile" : `${yontem} ${yol}`;
    const n = this.#sayac.get(anahtar) ?? 0;
    const sinir = uc === "giris" ? (this.#s.kota.calismaBasinaGirisAzami ?? 3) : uc === "yenile" ? (this.#s.kota.calismaBasinaYenilemeAzami ?? 20) : this.#s.kota.calismaBasinaUcParametreAzami;
    if (n >= sinir) throw new AwqatHatasi("KOTA_KORUMA", `kota koruması: ${uc} bu çalışmada ${n} kez çağrıldı`);
    if (this.#toplam >= this.#toplamSinir) throw new AwqatHatasi("KOTA_KORUMA", `kota koruması: toplam istek sınırı ${this.#toplamSinir} doldu`);
    this.#sayac.set(anahtar, n + 1);
    this.#toplam++;
    const headers = { Accept: "application/json" };
    if (govde) headers["Content-Type"] = "application/json";
    if (yetki) headers.Authorization = `Bearer ${this.#erisim}`;
    try {
      return await this.#fetch(this.#s.baseUrl + yol, { method: yontem, headers, body: govde ? JSON.stringify(govde) : undefined,
        redirect: "error", signal: AbortSignal.timeout(this.#timeout) });
    } catch (e) {
      throw new AwqatHatasi("AG", `${uc}: ağ hatası (${this.#temizle(e.name === "TimeoutError" ? "zaman aşımı" : e.message)})`);
    }
  }
  async #zarf(res, uc) {
    let j; try { j = await res.json(); } catch { throw new AwqatHatasi("ZARF", `${uc}: JSON olmayan yanıt`, { durum: res.status }); }
    if (j?.[this.#s.zarf.basari] !== true) throw new AwqatHatasi("BASARISIZ", `${uc}: ${this.#temizle(j?.[this.#s.zarf.mesaj] ?? "başarısız yanıt")}`, { durum: res.status });
    return j[this.#s.zarf.veri];
  }
  #tokenAl(veri, uc) {
    const a = veri?.[this.#s.token.erisim], r = veri?.[this.#s.token.yenileme];
    if (typeof a !== "string" || !a) throw new AwqatHatasi("TOKEN", `${uc}: erişim token'ı yok`);
    this.#erisim = a;
    if (typeof r === "string" && r) this.#yenileme = r; else if (this.#s.token.rotasyon) this.#yenileme = null;
    this.#bitis = this.#simdi() + (this.#s.token.erisimOmruDk - this.#s.token.guvenlikPayiDk) * 60_000;
  }
  async #giris() {
    const res = await this.#istek("giris", {}, { govde: { email: this.#email, password: this.#sifre }, yetki: false });
    if (!res.ok) throw new AwqatHatasi("GIRIS", `giriş başarısız (HTTP ${res.status})`, { durum: res.status });
    this.#tokenAl(await this.#zarf(res, "giris"), "giris");
  }
  async #yenile() {
    const res = await this.#istek("yenile", { refreshToken: this.#yenileme }, { yetki: false });
    if (!res.ok) throw new AwqatHatasi("YENILE", `token yenileme başarısız (HTTP ${res.status})`, { durum: res.status });
    this.#tokenAl(await this.#zarf(res, "yenile"), "yenile");
  }
  async #tokenHazirla(zorla = false) {
    if (this.#erisim && !zorla && this.#simdi() < this.#bitis) return;
    if (this.#yenileme) { try { await this.#yenile(); return; } catch (e) { if (e.kod === "KOTA_KORUMA") throw e; this.#yenileme = null; } }
    await this.#giris();
  }
  #retryAfter(res) {
    const h = res.headers.get("retry-after");
    if (h === null) return null;
    const sn = Number(h);
    if (Number.isFinite(sn) && sn >= 0) return sn * 1000;
    const t = Date.parse(h);
    return Number.isFinite(t) ? Math.max(0, t - this.#simdi()) : null;
  }
  /** Yetkili GET; 401'de bir kez yeniden kimlik doğrulama, 429'da Retry-After, 5xx/ağda tek tekrar, 403'te tekrar yok. */
  async getir(uc, params) {
    await this.#tokenHazirla();
    let yeniKimlik = false;
    for (let deneme = 0; ; deneme++) {
      let res;
      try { res = await this.#istek(uc, params); }
      catch (e) { if (e.kod === "AG" && deneme === 0 && !this.#tekrarYok) { await this.#bekle(1000); continue; } throw e; }
      if (res.status === 401 && this.#tekrarYok) throw new AwqatHatasi("YETKI", `${uc}: 401 (pilotta tekrar yok)`, { durum: 401 });
      if (res.status === 401 && !yeniKimlik) { yeniKimlik = true; await this.#tokenHazirla(true); continue; }
      if (res.status === 429) {
        const ms = this.#retryAfter(res);
        if (ms === null || ms > this.#maxBekleMs || this.#tekrarYok) throw new AwqatHatasi("KOTA", `${uc}: 429, Retry-After ${ms === null ? "yok" : Math.round(ms / 1000) + " sn"}; kota tüketmemek için durduruldu`, { durum: 429 });
        await this.#bekle(ms); continue;
      }
      if (res.status === 403) throw new AwqatHatasi("YETKI", `${uc}: 403 (yetki veya kota); tekrar denenmez`, { durum: 403 });
      if (res.status >= 500 && deneme === 0 && !this.#tekrarYok) { await this.#bekle(1000); continue; }
      if (!res.ok) throw new AwqatHatasi("HTTP", `${uc}: HTTP ${res.status}`, { durum: res.status });
      return this.#zarf(res, uc);
    }
  }
  /** Bir ilçenin aylık vakitleri, v1 satırları olarak. */
  async aylik(cityId) {
    const veri = await this.getir("aylik", { cityId });
    if (!Array.isArray(veri) || veri.length === 0) throw new AwqatHatasi("VERI", "boş vakit listesi");
    const gunler = veri.map((g) => vakitDonustur(g, this.#s));
    if (new Set(gunler.map((x) => x.t)).size !== gunler.length) throw new AwqatHatasi("VERI", "tekrarlanan tarih");
    return gunler;
  }
}
