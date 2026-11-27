import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {AwqatIstemci} from "../scripts/resmi/awqat-adaptor.mjs";
import {drTest,kapsamAnalizi,DR_ISTEK} from "../scripts/resmi/daterange-test.mjs";
import {gunEkle} from "../scripts/v1-dogrulama.mjs";
const S=JSON.parse(await fs.readFile("config/awqat-sozlesme.json","utf8"));
const today="2026-11-27",dmy=iso=>iso.split("-").reverse().join(".");
const V=["06:00","07:30","12:30","15:00","17:30","19:00"];
const gun=iso=>({gregorianDateShort:dmy(iso),fajr:V[0],sunrise:V[1],dhuhr:V[2],asr:V[3],maghrib:V[4],isha:V[5]});
const yil=(n=365)=>Array.from({length:n},(_,i)=>gun(gunEkle(today,i)));
const ok=d=>new Response(JSON.stringify({success:true,data:d}),{status:200});
async function v1(t){const d=await fs.mkdtemp(path.join(os.tmpdir(),"dr-"));t.after(()=>fs.rm(d,{recursive:true,force:true}));await fs.mkdir(path.join(d,"vakitler"));
 for(const id of [9541,9206])await fs.writeFile(path.join(d,"vakitler",id+".json"),JSON.stringify({gunler:Array.from({length:20},(_,i)=>({t:dmy(gunEkle(today,i)),v:V}))}));return d;}
function srv(resp=()=>ok(yil())){const calls=[];return {calls,f:async(u,init)=>{const p=new URL(u).pathname;calls.push({p,body:init.body});
 if(p==="/Auth/Login")return ok({accessToken:"A",refreshToken:"R"});if(p==="/api/PrayerTime/DateRange")return resp(JSON.parse(init.body));return new Response("{}",{status:404});}};}
const mk=f=>new AwqatIstemci({sozlesme:S,email:"e@x.invalid",sifre:"pw",fetchFn:f,toplamIstekSiniri:DR_ISTEK,tekrarYok:true,bekle:async()=>{}});
test("DateRange: 365-day continuous range with year transition and equality passes; body as documented",async t=>{const s=srv();const r=await drTest({istemci:mk(s.f),sozlesme:S,bugun:today,v1:await v1(t)});
 assert.equal(r.sonuc,"GECTI");assert.equal(s.calls.filter(x=>x.p==="/api/PrayerTime/DateRange").length,2);
 assert.deepEqual(JSON.parse(s.calls[1].body),{cityId:9541,startDate:"2026-11-27T00:00:00",endDate:"2027-11-26T00:00:00"});
 assert.equal(r.ilceler[9541].yilGecisi,true);assert.equal(r.ilceler[9541].istenen,365);});
test("DateRange: shorter-than-requested, gap, year gap, mismatch and error are all detected",async t=>{
 let r=await drTest({istemci:mk(srv(()=>ok(yil(31))).f),sozlesme:S,bugun:today,v1:await v1(t)});assert.equal(r.kriterler.D2_kesintisiz,false);assert.equal(r.ilceler[9541].donen,31);
 r=await drTest({istemci:mk(srv(()=>ok(yil().filter(g=>g.gregorianDateShort!=="01.01.2027"))).f),sozlesme:S,bugun:today,v1:await v1(t)});assert.equal(r.kriterler.D3_yilGecisi,false);
 r=await drTest({istemci:mk(srv(()=>ok(yil().map((g,i)=>i===2?{...g,isha:"19:01"}:g))).f),sozlesme:S,bugun:today,v1:await v1(t)});assert.equal(r.kriterler.D4_esitlik,false);
 const s=srv(()=>new Response("{}",{status:400}));r=await drTest({istemci:mk(s.f),sozlesme:S,bugun:today,v1:await v1(t)});assert.equal(r.sonuc,"DURDU");assert.equal(s.calls.filter(x=>x.p==="/api/PrayerTime/DateRange").length,1);});
test("coverage analysis primitives",()=>{const a=kapsamAnalizi([{t:"31.12.2026"},{t:"01.01.2027"}],"2026-12-31","2027-01-01");assert.equal(a.kesintisiz,true);assert.equal(a.yilGecisi,true);
 assert.equal(kapsamAnalizi([{t:"31.12.2026"}],"2026-12-31","2027-01-01").yilGecisi,false);});
test("DateRange stops at the first schema/validation error (second district not requested)",async t=>{
 for(const bad of [()=>ok(yil().map(g=>{const {isha,...x}=g;return x;})),()=>ok(yil().map((g,i)=>i===3?{...g,fajr:"25:00"}:g))]){
  const s=srv(bad);const r=await drTest({istemci:mk(s.f),sozlesme:S,bugun:today,v1:await v1(t)});
  assert.equal(r.sonuc,"DURDU");assert.equal(r.durdu,"dogrulama-9541");assert.equal(s.calls.filter(x=>x.p==="/api/PrayerTime/DateRange").length,1);}});
