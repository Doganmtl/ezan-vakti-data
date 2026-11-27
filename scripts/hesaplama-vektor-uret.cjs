// Alternatif hesaplama test vektörlerini üretir (geliştirme aracı; CI ve yayında çalışmaz).
// Kullanım: geçici klasörde `npm i adhan@4.4.6` sonra `NODE_PATH=<klasör>/node_modules node scripts/hesaplama-vektor-uret.cjs`.
// Çıktı: çalışma dizinine hesaplama.json -> test/vektorler/ altına kopyalanır.
const a=require('adhan');
const yerler=[["ankara",39.9334,32.8597,"Europe/Istanbul"],["istanbul",41.0082,28.9784,"Europe/Istanbul"],["londra",51.5074,-0.1278,"Europe/London"],["newyork",40.7128,-74.006,"America/New_York"],["mekke",21.4225,39.8262,"Asia/Riyadh"],["kahire",30.0444,31.2357,"Africa/Cairo"],["karaci",24.8607,67.0011,"Asia/Karachi"],["oslo",59.9139,10.7522,"Europe/Oslo"]];
const tarihler=["2026-01-15","2026-03-29","2026-06-21","2026-11-01"];
const yontemler={mwl:"MuslimWorldLeague",isna:"NorthAmerica",ummalqura:"UmmAlQura",misir:"Egyptian",karaci:"Karachi"};
const hl={ortagece:a.HighLatitudeRule.MiddleOfTheNight,yedide:a.HighLatitudeRule.SeventhOfTheNight,aci:a.HighLatitudeRule.TwilightAngle};
const f=(d,tz)=>new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(d);
const off=(d,tz)=>{const s=new Intl.DateTimeFormat("en-US",{timeZone:tz,timeZoneName:"longOffset"}).formatToParts(d).find(p=>p.type=="timeZoneName").value;return s=="GMT"?"+00:00":s.slice(3)};
const vakaler=[];
for(const [ad,lat,lon,tz] of yerler)for(const t of tarihler)for(const [yk,yn] of Object.entries(yontemler))for(const mezhep of ["safii","hanefi"]){
  if(mezhep=="hanefi"&&yk!="mwl"&&yk!="karaci")continue;
  const kurallar=(ad=="oslo"||ad=="londra")?Object.keys(hl):["ortagece"];
  for(const k of kurallar){
    const p=a.CalculationMethod[yn]();p.madhab=mezhep=="hanefi"?a.Madhab.Hanafi:a.Madhab.Shafi;p.highLatitudeRule=hl[k];
    const [y,m,g]=t.split("-").map(Number);
    const v=new a.PrayerTimes(new a.Coordinates(lat,lon),new Date(Date.UTC(y,m-1,g,12)),p);
    vakaler.push({yer:ad,enlem:lat,boylam:lon,saatDilimi:tz,tarih:t,ofset:off(v.dhuhr,tz),yontem:yk,ikindi:mezhep,yuksekEnlem:k,
      vakitler:{imsak:f(v.fajr,tz),gunes:f(v.sunrise,tz),ogle:f(v.dhuhr,tz),ikindi:f(v.asr,tz),aksam:f(v.maghrib,tz),yatsi:f(v.isha,tz)}});
  }}
const cikti={surum:1,referans:{kutuphane:"adhan (batoulapps) JavaScript",paket:"adhan@4.4.6",esdegerler:["adhan-swift","adhan-kotlin / adhan-java"]},
kurallar:{yuvarlama:"en yakın dakika (adhan Rounding.Nearest: 30 sn ve üstü yukarı)",
 duzeltmeler:{mwl:{ogle:1},isna:{ogle:1},misir:{ogle:1},karaci:{ogle:1},ummalqura:{}},
 aksam:"gün batımı + 0 dk (PrayTimes'ın varsayılan +1 dk'sı uygulanmaz)",
 ummalqura:"yatsı = akşam + 90 dk; Ramazan'da 120 dk (bu dosyada Ramazan vakası yok, hicri ay tespiti ayrı kural)",
 ikindi:"şafii gölge 1, hanefi gölge 2",
 yuksekEnlem:"ortagece = MiddleOfTheNight (varsayılan), yedide = SeventhOfTheNight, aci = TwilightAngle",
 tarih:"yerel takvim günü; ofset o günün öğle anındaki UTC ofseti"},
 tolerans:"0 dk (birebir eşleşme)",vakalar:vakaler};
require('fs').writeFileSync('hesaplama.json',JSON.stringify(cikti,null,1)+"\n");console.log(vakaler.length);
