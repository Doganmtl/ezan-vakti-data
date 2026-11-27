import {execFileSync} from "node:child_process";
import {gunlerDogrula,listeDogrula,gunEkle} from "./v1-dogrulama.mjs";
import {gecisDogrula,onayliEklemeler,kimlikGecisiDogrula} from "./kimlik.mjs";
import {siniflandir,yayinKarari,oncelik,D06,SINIFLAR} from "./esik.mjs";
import {sozlesme2Dogrula,gecisTuru} from "./resmi/sozlesme2.mjs";
import {bilinenEksikDogrula,KAYNAKLAR} from "./bilinen-eksik.mjs";
const git=(...args)=>execFileSync("git",args,{encoding:"utf8",maxBuffer:32*1024*1024});
const kind=process.argv[2];
if(!["prayer","daily"].includes(kind))throw Error("unknown publish kind");
const files=git("diff","--cached","--name-only","-z","--no-renames").split("\0").filter(Boolean);
const allowed=p=>kind==="daily"?p==="docs/v1/gunluk.json":/^docs\/v1\/(iller\.json|meta\.json|(?:ilceler|vakitler)\/[0-9]+\.json)$/.test(p);
if(!files.length||files.some(p=>!allowed(p)))throw Error("unexpected staged path");
if(git("diff","--cached","--no-renames","--diff-filter=D","--name-only").trim())throw Error("deletion forbidden");
const json=(p,old=false)=>JSON.parse(git("show",(old?"HEAD:":":")+"docs/v1/"+p));
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
// New timestamps: strict UTC "Z" (SOZLESME.md) and not more than 5 min in the future. Old (HEAD) values: parseable.
const UTC_Z=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
function stamp(x){if(typeof x!=="string"||!UTC_Z.test(x))throw Error("timestamp must be UTC Z: "+x);const n=Date.parse(x);if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,19)!==x.slice(0,19))throw Error("invalid timestamp");if(n>Date.now()+300_000)throw Error("future timestamp");return n;}
function oldStamp(x){const n=Date.parse(x);if(typeof x!=="string"||!Number.isFinite(n))throw Error("invalid old timestamp");return n;}
function notOlder(next,old){if(stamp(next)<oldStamp(old))throw Error("older timestamp");}
function ids(a,b){listeDogrula(a);listeDogrula(b);const s=new Set(b.map(x=>x.id));if(a.length!==s.size||a.some(x=>!s.has(x.id)))throw Error("identity set changed");}
function archive(d){if(!Array.isArray(d.gunler))throw Error("invalid daily archive");const set=new Set();for(const g of d.gunler){if(typeof g.t!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(g.t)||gunEkle(g.t,0)!==g.t||set.has(g.t))throw Error("invalid daily date");set.add(g.t);}return set;}
if(kind==="daily"){
 const d=json("gunluk.json"),old=json("gunluk.json",true);
 notOlder(d.guncelleme,old.guncelleme);
 const days=archive(d),prior=archive(old);
 const expected=[...new Set([...prior,...days])].sort().slice(-400);
 if(days.size!==expected.length||expected.some(t=>!days.has(t)))throw Error("daily archive lost or exceeds retention");
}else{
 const m=json("meta.json"),old=json("meta.json",true);
 notOlder(m.guncelleme,old.guncelleme);
 const il=json("iller.json");ids(il,json("iller.json",true));
 if(il.length!==81||m.ilSayisi!==81)throw Error("province coverage");
 // Approved migrations come from the reviewed commit (HEAD), never from this run's output.
 let approved=new Map();try{approved=onayliEklemeler(gecisDogrula(JSON.parse(git("show","HEAD:eslesme/onayli-gecisler.json"))));}catch(e){if(!/does not exist|exists on disk|fatal/.test(String(e.stderr??e.message)))throw e;}
 // Known exceptions per source come from the reviewed commit (HEAD); the run output cannot change them.
 if(!KAYNAKLAR.includes(m.kaynakTuru))throw Error("unknown source type");
 const known=bilinenEksikDogrula(JSON.parse(git("show","HEAD:config/bilinen-eksik.json")))[m.kaynakTuru];
 // Uç modu (öncelik kuralını belirler): yalnız resmi kaynakta Monthly/DateRange; meta.uc ile aynı olmalı.
 const mod=m.dilim?.mod;
 if(mod!==undefined&&(!["Monthly","DateRange"].includes(mod)||m.kaynakTuru!=="resmi"||m.uc!==mod))throw Error("invalid endpoint mode");
 const d=m.durum,LISTS=[...SINIFLAR,"bilinenEksik","planliBekleyen"];
 if(!d||!Number.isSafeInteger(d.basarili)||!LISTS.every(k=>Array.isArray(d[k])&&d[k].every(Number.isSafeInteger)))throw Error("missing district status");
 const cls=new Map();for(const k of SINIFLAR)for(const id of d[k]){if(cls.has(id))throw Error("district classified twice");cls.set(id,k);}
 const waiting=new Set(d.planliBekleyen);for(const id of waiting)if(cls.has(id))throw Error("planned district also classified: "+id);
 // Independent recomputation: classes from HEAD files, D06 with fixed constants (no env override).
 const R={toplam:0,basarili:0,yedek:[],kisaKapsam:[],tukenmis:[],eksik:[],bilinenEksik:[],planliBekleyen:[],planliKullanilamaz:0};
 const attemptedLast=[],waitingLast=[];
 const seen=new Set(),allowedFiles=new Set(["docs/v1/iller.json","docs/v1/meta.json"]);
 for(const x of il){
 const dp="ilceler/"+x.id+".json",districts=json(dp);
 allowedFiles.add("docs/v1/"+dp);const prev=json(dp,true);listeDogrula(districts);listeDogrula(prev);kimlikGecisiDogrula(districts,prev,approved.get(x.id));listeDogrula(districts,seen);
 for(const dd of districts){
  const vp="vakitler/"+dd.id+".json",full="docs/v1/"+vp;allowedFiles.add(full);R.toplam++;
  const changed=files.includes(full),exists=git("ls-tree","HEAD","--",full).trim(),head=exists?json(vp,true):null;
  if(known.has(dd.id)){
   if(changed)throw Error("known exception modified: "+dd.id);
   const k=siniflandir(head,today);if(cls.get(dd.id)!==k)throw Error("known exception misclassified: "+dd.id);
   R.bilinenEksik.push(dd.id);R[k].push(dd.id);continue;
  }
  if(changed){
   if(cls.has(dd.id)||waiting.has(dd.id))throw Error("unrefreshed district modified: "+dd.id);
   const current=json(vp);
   if(current.sozlesme===2||head?.sozlesme===2){
    // Sözleşme 2: içerik değiştiyse (yenilendi/ilk) guncelleme bu çalışmada alınmış olmalı; değişmediyse (dogrulandi)
    // guncelleme/kaynak/içerik AYNEN kalmalı ve yalnız doğrulama bu çalışmada ilerlemiş olmalı. Eski alım yeniyi ezemez.
    if(current.sozlesme!==2)throw Error("contract 2 downgrade: "+dd.id);
    sozlesme2Dogrula(current,{simdi:new Date(Date.now()).toISOString()});
    const tur=gecisTuru(head,current),runStart=oldStamp(m.guncelleme);
    if(tur==="dogrulandi"){if(stamp(current.dogrulama.zaman)<runStart)throw Error("verification not from this run: "+dd.id);}
    else{if(stamp(current.guncelleme)<runStart)throw Error("fresh district not from this run: "+dd.id);if(head)notOlder(current.guncelleme,head.guncelleme);}
    if(current.kaynak.tur!=="ayna"&&m.kaynakTuru!=="resmi")throw Error("official contract file from non-official run: "+dd.id);
   }else{
    if(current.guncelleme!==m.guncelleme)throw Error("fresh district timestamp mismatch: "+dd.id);
    stamp(current.guncelleme);if(head)notOlder(current.guncelleme,head.guncelleme);
   }
   gunlerDogrula(current.gunler,today,14);R.basarili++;attemptedLast.push(oncelik(head,{mod:m.dilim?.mod,bugun:today})??"");continue;
  }
  // Not refreshed: file untouched; its class is recomputed from HEAD, never trusted from the run output.
  const k=siniflandir(head,today);
  if(waiting.has(dd.id)){R.planliBekleyen.push(dd.id);if(k==="tukenmis"||k==="eksik")R.planliKullanilamaz++;waitingLast.push(oncelik(head,{mod:m.dilim?.mod,bugun:today})??"");continue;}
  if(!cls.has(dd.id))throw Error("district neither refreshed nor classified: "+dd.id);
  if(cls.get(dd.id)!==k)throw Error(`district ${dd.id} class ${cls.get(dd.id)} != recomputed ${k}`);
  R[k].push(dd.id);attemptedLast.push(oncelik(head,{mod:m.dilim?.mod,bugun:today})??"");
 }}
 for(const id of [...cls.keys(),...waiting])if(!seen.has(id))throw Error("classified unknown district: "+id);
 const knownSeen=[...known].filter(id=>seen.has(id)).sort((a,b)=>a-b);
 if(JSON.stringify([...d.bilinenEksik].sort((a,b)=>a-b))!==JSON.stringify(knownSeen))throw Error("known exception list differs from reviewed config");
 if(R.basarili!==d.basarili)throw Error("fresh district count mismatch");
 // Staged updates: the waiting districts must not have less remaining coverage than any attempted one.
 if(R.planliBekleyen.length){
  if(!m.dilim||!Number.isSafeInteger(m.dilim.boyut)||m.dilim.secilen!==attemptedLast.length||attemptedLast.length>m.dilim.boyut)throw Error("invalid staged-update metadata");
  const maxA=attemptedLast.reduce((a,b)=>a>b?a:b,""),minW=waitingLast.reduce((a,b)=>a<b?a:b,"9999");
  if(maxA>minW)throw Error("staged update skipped a district with less coverage");
 }
 const karar=yayinKarari(R,D06);
 if(!karar.yayinla)throw Error("D06 threshold: "+karar.sebep);
 if(seen.size!==m.ilceSayisi||seen.size<old.ilceSayisi)throw Error("district coverage changed");
 if(files.some(f=>!allowedFiles.has(f)))throw Error("orphan staged file");
}
console.log("DATA_PUBLISH: staged snapshot validated");
