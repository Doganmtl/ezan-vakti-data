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
test("full mapping uses exactly 83 requests; identical ids and names map 1:1",async t=>{const s=srv();const r=await esle({istemci:mk(s.f),sozlesme:S,v1:await v1(t)});
 assert.equal(s.calls.length,83);assert.equal(ESLESME_ISTEK,83);assert.deepEqual(r.sayim,{toplam:162,ayni:162,ad:0,yok:0});assert.deepEqual(r.sorunlar,[]);});
test("different official id is proposed by name and flagged; missing name stays null",async t=>{const s=srv((l,i)=>i===3?[{id:7777,name:"MERKEZ 3"}]:l);const r=await esle({istemci:mk(s.f),sozlesme:S,v1:await v1(t)});
 assert.equal(r.oneri[9006].resmi,7777);assert.equal(r.oneri[9006].yontem,"ad");assert.equal(r.oneri[9007].resmi,null);assert.equal(r.sayim.yok,1);assert.equal(r.sorunlar.length,2);});
test("stops at first error without retry and never exceeds the cap",async t=>{const s=srv((l,i)=>{if(i===10)throw 0;return l;});
 const f=async u=>{const p=new URL(u).pathname;if(p==="/api/Place/Cities/510"){s.calls.push(p);return new Response("{}",{status:503});}return s.f(u);};
 await assert.rejects(esle({istemci:mk(f),sozlesme:S,v1:await v1(t)}));assert.equal(s.calls.filter(x=>x==="/api/Place/Cities/510").length,1);
 const s2=srv();await assert.rejects(esle({istemci:mk(s2.f,10),sozlesme:S,v1:await v1(t)}),/toplam istek/);assert.equal(s2.calls.length,10);});
test("apply: only same-id same-name proposals are written; conflicts and name-only matches are left",async()=>{const {uygula}=await import("../scripts/resmi/eslesme-uygula.mjs");
 const t={ilceler:{1:{resmi:null},2:{resmi:null},3:{resmi:5},4:{resmi:null}}};
 const s=uygula(t,{1:{resmi:1,yontem:"ayni-kimlik-ve-ad",resmiIl:9},2:{resmi:77,yontem:"ad"},3:{resmi:6,yontem:"ayni-kimlik-ve-ad"},4:{resmi:null,yontem:null},9:{resmi:9,yontem:"ayni-kimlik-ve-ad"}},{tarih:"2026-11-27",kaynak:"x"});
 assert.equal(s.islenen,1);assert.equal(t.ilceler[1].resmi,1);assert.equal(t.ilceler[1].dogrulama.tarih,"2026-11-27");assert.equal(t.ilceler[2].resmi,null);assert.equal(t.ilceler[3].resmi,5);assert.equal(s.atlanan.length,4);});
