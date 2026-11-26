import {execFileSync} from "node:child_process";
import {gunlerDogrula,listeDogrula} from "./v1-dogrulama.mjs";
const git=(...args)=>execFileSync("git",args,{encoding:"utf8",maxBuffer:32*1024*1024});
const kind=process.argv[2];
if(!["prayer","daily"].includes(kind))throw Error("unknown publish kind");
const files=git("diff","--cached","--name-only","-z").split("\0").filter(Boolean);
const allowed=p=>kind==="daily"?p==="docs/v1/gunluk.json":/^docs\/v1\/(iller\.json|meta\.json|(?:ilceler|vakitler)\/[0-9]+\.json)$/.test(p);
if(!files.length||files.some(p=>!allowed(p)))throw Error("unexpected staged path");
if(git("diff","--cached","--diff-filter=D","--name-only").trim())throw Error("deletion forbidden");
const json=p=>JSON.parse(git("show",":docs/v1/"+p));
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
if(kind==="daily"){
 const d=json("gunluk.json");
 if(!Array.isArray(d.gunler)||!Number.isFinite(Date.parse(d.guncelleme)))throw Error("invalid daily snapshot");
 const old=JSON.parse(git("show","HEAD:docs/v1/gunluk.json"));
 if(Date.parse(d.guncelleme)<Date.parse(old.guncelleme))throw Error("older daily timestamp");
 const days=new Set();
 for(const g of d.gunler){if(!/^\d{4}-\d{2}-\d{2}$/.test(g.t)||days.has(g.t))throw Error("invalid daily date");days.add(g.t);}
 if(old.gunler.some(g=>g.t>= (d.gunler[0]?.t??"")&&!days.has(g.t)))throw Error("daily record lost");
}else{
 const m=json("meta.json"),old=JSON.parse(git("show","HEAD:docs/v1/meta.json"));
 if(!Number.isFinite(Date.parse(m.guncelleme))||Date.parse(m.guncelleme)<Date.parse(old.guncelleme))throw Error("older or invalid prayer timestamp");
 const il=json("iller.json");listeDogrula(il);if(il.length!==81||m.ilSayisi!==81)throw Error("province coverage");
 const seen=new Set();
 for(const x of il){const districts=json("ilceler/"+x.id+".json");listeDogrula(districts,seen);
 for(const d of districts){
 // Existing known exception stays explicit until official mapping is validated.
 if(d.id===33292)continue;
 const v=json("vakitler/"+d.id+".json");
 if(!Number.isFinite(Date.parse(v.guncelleme)))throw Error("invalid district timestamp");
 gunlerDogrula(v.gunler,today,7);
 }}
 if(seen.size!==m.ilceSayisi||seen.size!==old.ilceSayisi)throw Error("district coverage changed");
}
console.log("DATA_PUBLISH: staged snapshot validated");
