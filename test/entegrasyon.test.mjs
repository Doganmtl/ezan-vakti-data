import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {yazToplu} from "../scripts/atomik-yaz.mjs";
const exec=promisify(execFile), today="2026-11-26";
const rows=Array.from({length:15},(_,i)=>({MiladiTarihKisa:new Date(Date.UTC(2026,10,26+i)).toISOString().slice(0,10).split("-").reverse().join("."),Imsak:"06:00",Gunes:"07:30",Ogle:"12:30",Ikindi:"15:00",Aksam:"17:30",Yatsi:"19:00"}));
async function setup(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"ezan-test-"));
 let mode="normal", hits=0;
 const server=http.createServer((req,res)=>{
  const [,kind,id]=req.url.split("/");
  let data;
  if(kind==="sehirler"){
   hits++;
   if(mode==="403"){res.writeHead(403);return res.end();}
   if(mode==="timeout")return;
   if(mode==="429"&&hits===1){res.writeHead(429,{"Retry-After":"0"});return res.end();}
   data=Array.from({length:mode==="missing-province"?80:81},(_,i)=>({SehirID:i+1,SehirAdi:"İl "+i}));
  } else if(kind==="ilceler"){data=[{IlceID:1000+Number(id),IlceAdi:"İlçe "+id}];if(mode==="drop"&&id==="1")data=[];if(mode==="drop"&&id==="2")data=[{IlceID:1002,IlceAdi:"İlçe 2"},{IlceID:7002,IlceAdi:"Onaysız"}];if(mode==="drop"&&id==="1")data=[{IlceID:6001,IlceAdi:"Başka"}];}
  else if(kind==="vakitler"){
   if(mode==="502"&&id==="1001"){res.writeHead(502);return res.end();}
   data=mode==="gap"&&id==="1001"?rows.filter((_,i)=>i!==4):rows;
  } else if(kind==="daily"){res.writeHead(503);return res.end();}
  else if(kind==="hutbe")data=[{language:"tr",date:"2026-11-27",title:"Test hutbesi"}];
  else {res.writeHead(404);return res.end();}
  res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));
 });
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 t.after(async()=>{server.closeAllConnections();await new Promise(ok=>server.close(ok));await fs.rm(dir,{recursive:true,force:true});});
 const url="http://127.0.0.1:"+server.address().port;
 return {dir,setMode(m){mode=m;hits=0;},hits:()=>hits,run(script="guncelle",extra={}){return exec(process.execPath,["scripts/"+script+".mjs"],{timeout:30000,env:{...process.env,...extra,SOURCE_URL:url,OUT_DIR:dir,TODAY:today,DELAY_MS:"0",RETRY_BASE_MS:"1",RATE_LIMIT_WAIT_MS:"1",REQUEST_TIMEOUT_MS:"500",GUNLUK_URL:url+"/daily",HUTBE_URL:url+"/hutbe"}});}};
}
async function snapshot(dir){const result={};for(const f of await fs.readdir(dir,{recursive:true,withFileTypes:true})){if(f.isFile()){const p=path.join(f.parentPath,f.name);result[path.relative(dir,p)]=await fs.readFile(p,"utf8");}}return result;}
test("HTTP success, 429 retry and v1 output",async t=>{const s=await setup(t);s.setMode("429");await s.run();assert.equal(s.hits(),2);const m=JSON.parse(await fs.readFile(path.join(s.dir,"meta.json")));assert.equal(m.ilSayisi,81);assert.equal(m.guncellenenIlce,81);const v=JSON.parse(await fs.readFile(path.join(s.dir,"vakitler/1001.json")));assert.equal(v.gunler.length,15);assert.equal(v.gunler[0].v.length,6);});
test("403, timeout, missing province preserve entire prior snapshot",async t=>{const s=await setup(t);await s.run();const old=await snapshot(s.dir);for(const mode of ["403","timeout","missing-province"]){s.setMode(mode);await assert.rejects(s.run());assert.deepEqual(await snapshot(s.dir),old);}});
test("502 with adequate backup preserves district; without backup blocks all writes",async t=>{const s=await setup(t);await s.run();const f=path.join(s.dir,"vakitler/1001.json"),old=await fs.readFile(f,"utf8");s.setMode("502");await s.run();assert.equal(await fs.readFile(f,"utf8"),old);await fs.unlink(f);const snap=await snapshot(s.dir);await assert.rejects(s.run());assert.deepEqual(await snapshot(s.dir),snap);});
test("missing day without backup blocks writes",async t=>{const s=await setup(t);s.setMode("gap");await assert.rejects(s.run());assert.deepEqual(await snapshot(s.dir),{});});
test("daily HTTP failure preserves same-day content",async t=>{const s=await setup(t);const gun={t:today,ayet:{m:"test"}};await fs.writeFile(path.join(s.dir,"gunluk.json"),JSON.stringify({gunler:[gun]}));await assert.rejects(s.run("gunluk"));const j=JSON.parse(await fs.readFile(path.join(s.dir,"gunluk.json")));assert.deepEqual(j.gunler,[gun]);});
test("staged write failure and rename failure rollback",async t=>{const s=await setup(t);const a=path.join(s.dir,"a.json"),b=path.join(s.dir,"b.json");await fs.writeFile(a,"old");await assert.rejects(yazToplu([[a,{x:1}],[b,1n]]));assert.deepEqual(await snapshot(s.dir),{"a.json":"old"});await assert.rejects(yazToplu([[a,{x:1}],[b,{x:2}]],{beforeRename:async dest=>{if(dest===b)throw Error("injected");}}));assert.deepEqual(await snapshot(s.dir),{"a.json":"old"});await yazToplu([[a,{x:1}],[b,{x:2}]]);assert.deepEqual(JSON.parse(await fs.readFile(b)),{x:2});});
test("partial publish classifies districts and never restamps old data",async t=>{const s=await setup(t);await s.run();const f=path.join(s.dir,"vakitler/1001.json"),old=await fs.readFile(f,"utf8");
 s.setMode("502");const env={MAX_KRITIK_ILCE_ORANI:"0.05"};await s.run("guncelle",env);
 let m=JSON.parse(await fs.readFile(path.join(s.dir,"meta.json")));assert.deepEqual(m.durum,{basarili:80,yedek:[1001],kisaKapsam:[],tukenmis:[],eksik:[],bilinenEksik:[]});assert.equal(await fs.readFile(f,"utf8"),old);
 const other=JSON.parse(await fs.readFile(path.join(s.dir,"vakitler/1002.json")));assert.equal(other.guncelleme,m.guncelleme);assert.notEqual(JSON.parse(old).guncelleme,m.guncelleme);
 await fs.unlink(f);await s.run("guncelle",env);m=JSON.parse(await fs.readFile(path.join(s.dir,"meta.json")));assert.deepEqual(m.durum.eksik,[1001]);assert.equal(m.durum.basarili,80);
 await assert.rejects(s.run("guncelle",{MAX_KRITIK_ILCE_ORANI:"0.01"}));});
test("source dropping a saved district keeps its identity and unapproved new IDs stay out",async t=>{const s=await setup(t);await s.run();s.setMode("drop");await s.run("guncelle",{MAX_KRITIK_ILCE_ORANI:"0.05",MAX_HATALI_ILCE_ORANI:"0.05"});
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(s.dir,"ilceler/1.json"))),[{id:1001,ad:"İlçe 1"}]);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(s.dir,"ilceler/2.json"))).map(x=>x.id),[1002]);
 const m=JSON.parse(await fs.readFile(path.join(s.dir,"meta.json")));assert.deepEqual(m.durum.yedek,[1001]);assert.equal(m.ilceSayisi,81);assert.ok(m.uyarilar.some(x=>x.includes("7002")));});
