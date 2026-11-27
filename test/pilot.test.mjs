import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {AwqatIstemci} from "../scripts/resmi/awqat-adaptor.mjs";
import {pilot,PILOT_ISTEK} from "../scripts/resmi/pilot.mjs";
const S=JSON.parse(await fs.readFile("config/awqat-sozlesme.json","utf8"));
const today="2026-11-27",dmy=i=>new Date(Date.UTC(2026,10,27+i)).toISOString().slice(0,10).split("-").reverse().join(".");
const ay=Array.from({length:30},(_,i)=>({gregorianDateShort:dmy(i),fajr:"06:00",sunrise:"07:30",dhuhr:"12:30",asr:"15:00",maghrib:"17:30",isha:"19:00"}));
const ok=d=>new Response(JSON.stringify({success:true,data:d}),{status:200});
function server(over={}){const calls=[];const f=async(url)=>{const p=new URL(url).pathname;calls.push(p);if(over[p])return over[p]();
 if(p==="/Auth/Login")return ok({accessToken:"A",refreshToken:"R"});if(p==="/api/Quota/My")return ok({kalan:"?"});
 if(p==="/api/Place/Countries")return ok([{id:2,code:"TR",name:"TÜRKİYE"},{id:3,code:"DE",name:"ALMANYA"}]);
 if(p==="/api/Place/States/2")return ok([{id:539,code:"",name:"İSTANBUL"},{id:506,code:"",name:"ANKARA"},{id:526,code:"",name:"ESKİŞEHİR"}]);
 if(p==="/api/Place/Cities/539")return ok([{id:9541,name:"İSTANBUL"},{id:9542,name:"ADALAR"}]);
 if(p==="/api/Place/Cities/506")return ok([{id:9206,name:"ANKARA"}]);
 if(p==="/api/Place/Cities/526")return ok([{id:33292,name:"MİHALGAZİ"}]);
 if(p.startsWith("/api/PrayerTime/Monthly/"))return ok(ay);return new Response("{}",{status:404});};return {calls,f};}
async function v1dir(t){const d=await fs.mkdtemp(path.join(os.tmpdir(),"pilot-"));t.after(()=>fs.rm(d,{recursive:true,force:true}));await fs.mkdir(path.join(d,"vakitler"));
 for(const id of [9541,9206])await fs.writeFile(path.join(d,"vakitler",id+".json"),JSON.stringify({gunler:ay.slice(0,15).map(g=>({t:g.gregorianDateShort,v:["06:00","07:30","12:30","15:00","17:30","19:00"]}))}));return d;}
const mk=f=>new AwqatIstemci({sozlesme:S,email:"e@x.invalid",sifre:"pw",fetchFn:f,toplamIstekSiniri:PILOT_ISTEK,tekrarYok:true,bekle:async()=>{}});
test("pilot uses exactly 11 requests in the planned order and passes all criteria",async t=>{const s=server(),c=mk(s.f);const r=await pilot({istemci:c,sozlesme:S,v1:await v1dir(t),bugun:today});
 assert.equal(r.sonuc,"GECTI");assert.equal(s.calls.length,11);assert.equal(PILOT_ISTEK,11);
 assert.deepEqual(s.calls,["/Auth/Login","/api/Quota/My","/api/Place/Countries","/api/Place/States/2","/api/Place/Cities/539","/api/Place/Cities/506","/api/Place/Cities/526","/api/PrayerTime/Monthly/9541","/api/PrayerTime/Monthly/9206","/api/PrayerTime/Monthly/33292","/api/Quota/My"]);
 assert.equal(r.ilceler[9541].ayniKimlik,true);assert.ok(!JSON.stringify(r).includes("pw"));});
test("pilot stops at first error with no retry and reports where",async t=>{for(const [p,code] of [["/api/Place/Countries",503],["/api/PrayerTime/Monthly/9206",429],["/api/PrayerTime/Monthly/9541",401]]){
 const s=server({[p]:()=>new Response("{}",{status:code,headers:{"Retry-After":"1"}})}),c=mk(s.f);const r=await pilot({istemci:c,sozlesme:S,v1:await v1dir(t),bugun:today});
 assert.equal(r.sonuc,"DURDU");assert.equal(s.calls.filter(x=>x===p).length,1);assert.ok(s.calls.length<11);}});
test("pilot fails criteria on differing times, short coverage or missing fields (no extra requests)",async t=>{
 const diff=ay.map((g,i)=>i===3?{...g,fajr:"05:59"}:g);let s=server({"/api/PrayerTime/Monthly/9541":()=>ok(diff)});let r=await pilot({istemci:mk(s.f),sozlesme:S,v1:await v1dir(t),bugun:today});assert.equal(r.sonuc,"KALDI");assert.equal(r.kriterler.K3_esitlik,false);assert.equal(s.calls.length,11);
 s=server({"/api/PrayerTime/Monthly/33292":()=>ok(ay.slice(0,10))});r=await pilot({istemci:mk(s.f),sozlesme:S,v1:await v1dir(t),bugun:today});assert.equal(r.kriterler.K2_kapsam,false);
 s=server({"/api/PrayerTime/Monthly/9206":()=>ok(ay.map(g=>({...g,extra:1})))});r=await pilot({istemci:mk(s.f),sozlesme:S,v1:await v1dir(t),bugun:today});assert.equal(r.sonuc,"GECTI");assert.ok(r.ilceler[9206].ornekAlanlar.includes("extra"));});
test("ambiguous name match stops the pilot",async t=>{const s=server({"/api/Place/Cities/526":()=>ok([{id:1,name:"MİHALGAZİ"},{id:2,name:"Mihalgazi"}])});const r=await pilot({istemci:mk(s.f),sozlesme:S,v1:await v1dir(t),bugun:today});assert.equal(r.sonuc,"DURDU");assert.match(r.hata,/MİHALGAZİ/);assert.ok(!s.calls.some(x=>x.includes("Monthly")));});
