import {execFileSync} from "node:child_process";
import {gunlerDogrula,listeDogrula,gunEkle} from "./v1-dogrulama.mjs";
const git=(...args)=>execFileSync("git",args,{encoding:"utf8",maxBuffer:32*1024*1024});
const kind=process.argv[2];
if(!["prayer","daily"].includes(kind))throw Error("unknown publish kind");
const files=git("diff","--cached","--name-only","-z","--no-renames").split("\0").filter(Boolean);
const allowed=p=>kind==="daily"?p==="docs/v1/gunluk.json":/^docs\/v1\/(iller\.json|meta\.json|(?:ilceler|vakitler)\/[0-9]+\.json)$/.test(p);
if(!files.length||files.some(p=>!allowed(p)))throw Error("unexpected staged path");
if(git("diff","--cached","--no-renames","--diff-filter=D","--name-only").trim())throw Error("deletion forbidden");
const json=(p,old=false)=>JSON.parse(git("show",(old?"HEAD:":":")+"docs/v1/"+p));
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
function stamp(x){const n=Date.parse(x);if(typeof x!=="string"||!Number.isFinite(n))throw Error("invalid timestamp");return n;}
function notOlder(next,old){if(stamp(next)<stamp(old))throw Error("older timestamp");}
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
 const seen=new Set(),allowedFiles=new Set(["docs/v1/iller.json","docs/v1/meta.json"]);
 for(const x of il){
 const dp="ilceler/"+x.id+".json",districts=json(dp);
 allowedFiles.add("docs/v1/"+dp);ids(districts,json(dp,true));listeDogrula(districts,seen);
 for(const d of districts){
 const vp="vakitler/"+d.id+".json",full="docs/v1/"+vp;allowedFiles.add(full);
 // Known exception may stay absent, but any change to it requires validation.
 if(d.id===33292&&!files.includes(full))continue;
 const current=json(vp);
 stamp(current.guncelleme);
 const exists=git("ls-tree","HEAD","--",full).trim();
 if(exists)notOlder(current.guncelleme,json(vp,true).guncelleme);
 gunlerDogrula(current.gunler,today,files.includes(full)?14:7);
 }}
 if(seen.size!==m.ilceSayisi||seen.size!==old.ilceSayisi)throw Error("district coverage changed");
 if(files.some(f=>!allowedFiles.has(f)))throw Error("orphan staged file");
}
console.log("DATA_PUBLISH: staged snapshot validated");
