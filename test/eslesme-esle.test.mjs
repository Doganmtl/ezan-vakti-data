import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {AwqatIstemci} from "../scripts/resmi/awqat-adaptor.mjs";
import {esle,ESLESME_ISTEK} from "../scripts/resmi/eslesme-esle.mjs";
const S=JSON.parse(await fs.readFile("config/awqat-sozlesme.json","utf8"));
const ok=d=>new Response(JSON.stringify({success:true,data:d}),{status:200});
async function v1(t){const d=await fs.mkdtemp(path.join(os.tmpdir(),"esle-"));t.after(()=>fs.rm(d,{recursive:true,force:true}));await fs.mkdir(path.join(d,"ilceler"));
 await fs.writeFile(path.join(d,"iller.json"),JSON.stringify(Array.from({length:81},(_,i)=>({id:500+i,ad:"İL "+i}))));
 for(let i=0;i<81;i++)await fs.writeFile(path.join(d,"ilceler",(500+i)+".json"),JSON.stringify([{id:9000+i*2,ad:"MERKEZ "+i},{id:9001+i*2,ad:"İLÇE "+i}]));return d;}
const mk=(f,cap=ESLESME_ISTEK)=>new AwqatIstemci({sozlesme:S,email:"e@x.invalid",sifre:"pw",fetchFn:f,toplamIstekSiniri:cap,tekrarYok:true,bekle:async()=>{}});
function srv(tweak=x=>x){const calls=[];return {calls,f:async u=>{const p=new URL(u).pathname;calls.push(p);
 if(p==="/Auth/Login")return ok({accessToken:"A",refreshToken:"R"});
 if(p==="/api/Place/States/2")return ok(Array.from({length:81},(_,i)=>({id:500+i,name:"İl "+i})));
 const m=p.match(/^\/api\/Place\/Cities\/(\d+)$/);if(m){const i=Number(m[1])-500;return ok(tweak([{id:9000+i*2,name:"MERKEZ "+i},{id:9001+i*2,name:"İlçe "+i}],i));}
 return new Response("{}",{status:404});}};}
test("mapping core uses 83 requests (cli adds 2 quota reads = 85); 162-district fixture is NOT success (needs 869)",async t=>{const s=srv();const r=await esle({istemci:mk(s.f),sozlesme:S,v1:await v1(t)});
 assert.equal(s.calls.length,83);assert.equal(ESLESME_ISTEK,85);assert.deepEqual(r.sayim,{il:81,toplam:162,ayni:162,adFarkli:0,ad:0,yok:0});
 assert.equal(r.basarili,false);assert.deepEqual(r.sorunlar,[{tur:"v1-ilce-sayisi",beklenen:869,bulunan:162}]);assert.match(r.butunluk,/^[0-9a-f]{64}$/);});
test("different official id is proposed by name and flagged; missing name stays null",async t=>{const s=srv((l,i)=>i===3?[{id:7777,name:"MERKEZ 3"}]:l);const r=await esle({istemci:mk(s.f),sozlesme:S,v1:await v1(t)});
 assert.equal(r.oneri[9006].resmi,7777);assert.equal(r.oneri[9006].yontem,"ad");assert.equal(r.oneri[9007].resmi,null);assert.equal(r.sayim.yok,1);assert.equal(r.basarili,false);
 assert.ok(r.sorunlar.some(x=>x.tur==="farkli-kimlik")&&r.sorunlar.some(x=>x.tur==="eslesmedi"));});
test("stops at first error without retry and never exceeds the cap",async t=>{const s=srv((l,i)=>{if(i===10)throw 0;return l;});
 const f=async u=>{const p=new URL(u).pathname;if(p==="/api/Place/Cities/510"){s.calls.push(p);return new Response("{}",{status:503});}return s.f(u);};
 await assert.rejects(esle({istemci:mk(f),sozlesme:S,v1:await v1(t)}));assert.equal(s.calls.filter(x=>x==="/api/Place/Cities/510").length,1);
 const s2=srv();await assert.rejects(esle({istemci:mk(s2.f,10),sozlesme:S,v1:await v1(t)}),/toplam istek/);assert.equal(s2.calls.length,10);});
test("apply: only same-id same-name proposals are written; conflicts and name-only matches are left",async()=>{const {uygula}=await import("../scripts/resmi/eslesme-uygula.mjs");
 const t={ilceler:{1:{resmi:null},2:{resmi:null},3:{resmi:5},4:{resmi:null}}};
 const s=uygula(t,{1:{resmi:1,yontem:"ayni-kimlik-ve-ad",resmiIl:9},2:{resmi:77,yontem:"ad"},3:{resmi:6,yontem:"ayni-kimlik-ve-ad"},4:{resmi:null,yontem:null},9:{resmi:9,yontem:"ayni-kimlik-ve-ad"}},{tarih:"2026-11-27",kaynak:"x"});
 assert.equal(s.islenen,1);assert.equal(t.ilceler[1].resmi,1);assert.equal(t.ilceler[1].dogrulama.tarih,"2026-11-27");assert.equal(t.ilceler[2].resmi,null);assert.equal(t.ilceler[3].resmi,5);assert.equal(s.atlanan.length,4);});

async function v1Full(t){const d=await fs.mkdtemp(path.join(os.tmpdir(),"esle869-"));t.after(()=>fs.rm(d,{recursive:true,force:true}));await fs.mkdir(path.join(d,"ilceler"));
 await fs.writeFile(path.join(d,"iller.json"),JSON.stringify(Array.from({length:81},(_,i)=>({id:500+i,ad:"İL "+i}))));
 let n=0;for(let i=0;i<81;i++){const k=i<59?11:10;const l=[];for(let j=0;j<k;j++)l.push({id:10000+n++,ad:"İLÇE "+i+"-"+j});await fs.writeFile(path.join(d,"ilceler",(500+i)+".json"),JSON.stringify(l));}
 assert.equal(n,869);return d;}
function srvFull(v,tweak={}){const calls=[];return {calls,f:async u=>{const p=new URL(u).pathname;calls.push(p);
 if(p==="/Auth/Login")return ok({accessToken:"A",refreshToken:"R"});
 if(p==="/api/Place/States/2"){let st=Array.from({length:81},(_,i)=>({id:500+i,name:"İl "+i}));if(tweak.dropIl)st=st.filter(x=>x.id!==tweak.dropIl);return ok(st);}
 const m=p.match(/^\/api\/Place\/Cities\/(\d+)$/);if(m){let l=JSON.parse(await fs.readFile(path.join(v,"ilceler",m[1]+".json"))).map(x=>({id:x.id,name:x.ad}));if(tweak.cities)l=tweak.cities(Number(m[1]),l);return ok(l);}
 return new Response("{}",{status:404});}};}
test("strict success: all 81 provinces and 869 districts same id+name",async t=>{const v=await v1Full(t);const s=srvFull(v);const r=await esle({istemci:mk(s.f),sozlesme:S,v1:v});
 assert.equal(r.basarili,true);assert.deepEqual(r.kapsam,{il:81,ilce:869});assert.equal(r.sayim.ayni,869);assert.deepEqual(r.sorunlar,[]);});
test("strict failures: skipped province, missing district, duplicate official id, renamed id",async t=>{const v=await v1Full(t);
 let r=await esle({istemci:mk(srvFull(v,{dropIl:530}).f),sozlesme:S,v1:v});assert.equal(r.basarili,false);assert.ok(r.sorunlar.some(x=>x.tur==="il-eslesmedi"));assert.equal(r.sayim.toplam,869);
 r=await esle({istemci:mk(srvFull(v,{cities:(id,l)=>id===510?l.slice(1):l}).f),sozlesme:S,v1:v});assert.equal(r.basarili,false);assert.equal(r.sayim.yok,1);
 r=await esle({istemci:mk(srvFull(v,{cities:(id,l)=>id===511?l.map((x,i)=>i===0?{...x,id:7}:i===1?{...x,id:7}:x):l}).f),sozlesme:S,v1:v});assert.equal(r.basarili,false);assert.ok(r.sorunlar.some(x=>x.tur==="resmi-ilce-listesi-gecersiz"));
 r=await esle({istemci:mk(srvFull(v,{cities:(id,l)=>id===512?l.map((x,i)=>i===0?{...x,id:99999}:x):l}).f),sozlesme:S,v1:v});assert.equal(r.basarili,false);assert.ok(r.sorunlar.some(x=>x.tur==="farkli-kimlik"));});
test("apply verifies success, coverage, integrity hash, run id and source commit; never applies name-only matches",async t=>{const {raporDogrula,uygula}=await import("../scripts/resmi/eslesme-uygula.mjs");
 const v=await v1Full(t);const r=await esle({istemci:mk(srvFull(v).f),sozlesme:S,v1:v});
 const tablo={ilceler:Object.fromEntries(Object.keys(r.oneri).map(id=>[id,{resmi:null}]))};
 const rapor={...r,kaynak:{commit:"a".repeat(40),runId:"123"}};
 assert.deepEqual(raporDogrula(rapor,tablo,{runId:"123"}),[]);
 assert.ok(raporDogrula(rapor,tablo,{runId:"124"}).includes("run kimliği eşleşmiyor"));
 assert.ok(raporDogrula(rapor,tablo,{runId:"123",commitAtasiMi:()=>false}).some(x=>/commit/.test(x)));
 const bozuk=structuredClone(rapor);bozuk.oneri[10005].resmi=1;assert.ok(raporDogrula(bozuk,tablo,{runId:"123"}).includes("bütünlük özeti tutmuyor"));
 assert.ok(raporDogrula({...rapor,basarili:false},tablo,{runId:"123"}).includes("rapor başarılı değil"));
 const eksikTablo={ilceler:{...tablo.ilceler}};delete eksikTablo.ilceler[10000];assert.ok(raporDogrula(rapor,eksikTablo,{runId:"123"}).length>0);
 const s=uygula(tablo,{...r.oneri,10001:{resmi:5555,yontem:"ad",resmiIl:500}},{tarih:"2026-11-27",kaynak:"x"});assert.equal(s.islenen,868);assert.equal(tablo.ilceler[10001].resmi,null);});
test("quota decision: most conservative group, unknown -> small cap, exceeded -> 0",async()=>{const {enAzKalan,izinVerilen,BILINMIYOR_GUVENLI_ISTEK}=await import("../scripts/resmi/kota.mjs");
 const pilot={date:"2026-11-27T12:49:49+03:00",daily:[{benefit:100,totalUsed:3,totalExceeded:0},{benefit:100,totalUsed:1,totalExceeded:0},{benefit:100,totalUsed:1,totalExceeded:0},{benefit:100,totalUsed:3,totalExceeded:0}]};
 assert.equal(enAzKalan(pilot),97);assert.equal(izinVerilen(pilot),92);
 assert.equal(BILINMIYOR_GUVENLI_ISTEK,0);assert.equal(enAzKalan({daily:[]}),null);assert.equal(izinVerilen({daily:[]}),0);assert.equal(izinVerilen(null),0);
 assert.equal(izinVerilen({date:"x",daily:[{benefit:"x",totalUsed:1}]}),0);assert.equal(izinVerilen({date:"x",daily:[{benefit:100,totalUsed:100,totalExceeded:2}]}),0);
 // 28.11.2026: biçimi doğru ve boş = kullanım yok → belgelenen en küçük sınır 10 (pay 1 → 9).
 assert.equal(enAzKalan({date:"x",daily:[],weekly:[],monthly:[],yearly:[]}),10);assert.equal(izinVerilen({date:"x",daily:[],weekly:[],monthly:[],yearly:[]}),9);assert.equal(izinVerilen({daily:[{benefit:100,totalUsed:100,totalExceeded:2}]}),0);});
test("same id with different spelling (SUHUT/ŞUHUT) is a success with the official name recorded; names applied only for same-id records",async t=>{
 const v=await v1Full(t);const s=srvFull(v,{cities:(id,l)=>id===502?l.map((x,i)=>i===0?{...x,name:"ŞUHUT-"+x.name}:x):l});
 const r=await esle({istemci:mk(s.f),sozlesme:S,v1:v});assert.equal(r.basarili,true);assert.equal(r.sayim.adFarkli,1);assert.equal(r.adFarklari[0].resmiAd.startsWith("ŞUHUT-"),true);
 const {uygula}=await import("../scripts/resmi/eslesme-uygula.mjs");const tablo={ilceler:Object.fromEntries(Object.keys(r.oneri).map(id=>[id,{resmi:null}]))};
 const u=uygula(tablo,r.oneri,{tarih:"2026-11-28",kaynak:"x"});assert.equal(u.islenen,869);const id=r.adFarklari[0].id;assert.match(tablo.ilceler[id].dogrulama.yontem,/resmi ad farklı/);assert.equal(tablo.ilceler[id].resmiAd,r.adFarklari[0].resmiAd);
 const {adlariUygula}=await import("../scripts/resmi/ad-uygula.mjs");
 const iller=JSON.parse(await fs.readFile(path.join(v,"iller.json")));const ilceler={};for(const il of iller)ilceler[il.id]=JSON.parse(await fs.readFile(path.join(v,"ilceler",il.id+".json")));
 const a=adlariUygula({iller,ilceler},{...r,oneri:{...r.oneri,99999:{resmi:1,yontem:"ad",resmiAd:"X"}}});
 assert.ok(a.degisen.some(x=>x.tur==="ilce"&&x.id===id));assert.deepEqual(a.ilceler[502].map(x=>x.id),ilceler[502].map(x=>x.id)); // ids and order unchanged
 // 8. tur kararı: resmi ad Türkçe büyük harfle uygulanır; yalnız harf biçimi farkı (fixture "İl n" ↔ v1 "İL N") ad değiştirmez.
 assert.ok(!a.degisen.some(x=>x.tur==="il"));assert.equal(a.ilceler[502].find(x=>x.id===id).ad,r.adFarklari[0].resmiAd.toLocaleUpperCase("tr-TR"));});
test("different id is still never applied, even with matching name",async t=>{const v=await v1Full(t);const r=await esle({istemci:mk(srvFull(v,{cities:(id,l)=>id===512?l.map((x,i)=>i===0?{...x,id:99999}:x):l}).f),sozlesme:S,v1:v});
 assert.equal(r.basarili,false);const {adlariUygula}=await import("../scripts/resmi/ad-uygula.mjs");const id=Object.keys(r.oneri).find(k=>r.oneri[k].yontem==="ad");
 const a=adlariUygula({iller:[],ilceler:{512:[{id:Number(id),ad:"ESKI"}]}},{...r,oneri:{...r.oneri,[id]:{...r.oneri[id],resmiAd:"YENI"}}});assert.equal(a.degisen.length,0);});
