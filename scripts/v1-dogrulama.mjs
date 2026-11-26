// Pure v1 validation: no network or filesystem.
export function isoTarih(t) {
  if (typeof t !== "string" || !/^\d{2}\.\d{2}\.\d{4}$/.test(t)) throw Error("geçersiz tarih");
  const iso = t.split(".").reverse().join("-");
  const d = new Date(iso + "T00:00:00Z");
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10) !== iso) throw Error("geçersiz takvim tarihi");
  return iso;
}
export function gunEkle(iso,n) {
  const d = new Date(iso+"T00:00:00Z");
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10)!==iso) throw Error("geçersiz ISO tarih");
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
export function listeDogrula(liste, gorulen = new Set()) {
  if (!Array.isArray(liste) || !liste.length) throw Error("boş liste");
  for (const x of liste) {
    if (!Number.isSafeInteger(x.id) || x.id<=0 || typeof x.ad!=="string" || !x.ad.trim() || gorulen.has(x.id)) throw Error("geçersiz veya tekrarlanan kimlik");
    gorulen.add(x.id);
  }
}
export function gunlerDogrula(gunler, bugun, ileri=14) {
  if (!Array.isArray(gunler) || !gunler.length) throw Error("boş vakit listesi");
  const tarihler=new Set();
  for (const g of gunler) {
    const t=isoTarih(g.t);
    if (tarihler.has(t)) throw Error("tekrarlanan tarih");
    tarihler.add(t);
    if (!Array.isArray(g.v) || g.v.length!==6 || g.v.some(s=>typeof s!=="string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) throw Error("geçersiz vakit");
    if (g.v.some((s,i)=>i>0 && s<=g.v[i-1])) throw Error("vakit sırası");
    if (g.h!==undefined && typeof g.h!=="string") throw Error("geçersiz hicri tarih");
  }
  for(let i=0;i<=ileri;i++) if(!tarihler.has(gunEkle(bugun,i))) throw Error("eksik gün: "+gunEkle(bugun,i));
}
export function gunlukBirlestir(eski, gun) {
  const liste=gun ? eski.filter(x=>x.t!==gun.t).concat(gun) : [...eski];
  return liste.sort((a,b)=>a.t.localeCompare(b.t)).slice(-400);
}
