import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile),today="2026-11-26";
const dmy=i=>new Date(Date.UTC(2026,10,26+i)).toISOString().slice(0,10).split("-").reverse().join(".");
const ay=Array.from({length:30},(_,i)=>({gregorianDateShort:dmy(i),fajr:"06:01",sunrise:"07:31",dhuhr:"12:31",asr:"15:01",maghrib:"17:31",isha:"19:01",hijriDateLong:"x"}));
const ayna=Array.from({length:15},(_,i)=>({MiladiTarihKisa:dmy(i),Imsak:"06:00",Gunes:"07:30",Ogle:"12:30",Ikindi:"15:00",Aksam:"17:30",Yatsi:"19:00"}));
async function setup(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"resmi-")),out=path.join(dir,"v1");let mode="ok";const hits={ayna:0,login:0,monthly:0};
 const server=http.createServer((req,res)=>{const u=req.url,send=(c,b)=>{res.writeHead(c,{"Content-Type":"application/json"});res.end(JSON.stringify(b));};
  if(u==="/Auth/Login"){hits.login++;let body="";req.on("data",c=>body+=c);req.on("end",()=>{const j=JSON.parse(body);if(j.email!=="e@x.invalid"||j.password!=="pw")return send(400,{success:false});send(200,{success:true,data:{accessToken:"A",refreshToken:"R"}});});return;}
  let m=u.match(/^\/api\/PrayerTime\/Monthly\/(\d+)$/);if(m){hits.monthly++;if(req.headers.authorization!=="Bearer A")return send(401,{});if(mode==="403")return send(403,{});return send(200,{success:true,data:ay});}
  hits.ayna++;const [,kind,id]=u.split("/");
  if(kind==="sehirler")return send(200,Array.from({length:81},(_,i)=>({SehirID:i+1,SehirAdi:"İl "+i})));
  if(kind==="ilceler")return send(200,[{IlceID:1000+Number(id),IlceAdi:"İlçe "+id}]);
  if(kind==="vakitler")return send(200,ayna);res.writeHead(404);res.end();});
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 t.after(async()=>{server.closeAllConnections();await new Promise(ok=>server.close(ok));await fs.rm(dir,{recursive:true,force:true});});
 const url="http://127.0.0.1:"+server.address().port,table=path.join(dir,"tablo.json");
 const writeTable=async mapped=>fs.writeFile(table,JSON.stringify({surum:1,ilceler:Object.fromEntries(Array.from({length:81},(_,i)=>[1001+i,{ilId:i+1,emushaf:1001+i,resmi:mapped(1001+i)?5001+i:null,dogrulama:mapped(1001+i)?{tarih:"2026-11-27"}:null}]))}));
 const base={...process.env,OUT_DIR:out,TODAY:today,DELAY_MS:"0",RETRY_BASE_MS:"1",REQUEST_TIMEOUT_MS:"2000",SOURCE_URL:url};
 const resmi={VERI_KAYNAGI:"resmi",RESMI_KAYNAK_ONAYI:"evet",RESMI_TOPLAM_ISTEK_SINIRI:"200",AWQAT_BASE_URL:url,AWQAT_EMAIL:"e@x.invalid",AWQAT_PASSWORD:"pw",ESLESME_TABLOSU:table,AWQAT_TEST_HIZLI:"1"};
 const run=(env={})=>exec(process.execPath,["scripts/guncelle.mjs"],{timeout:30000,env:{...base,...env}});
 return {dir,out,hits,run,resmi,writeTable,setMode:x=>mode=x};
}
async function snap(dir){const r={};for(const f of await fs.readdir(dir,{recursive:true,withFileTypes:true}))if(f.isFile()){const p=path.join(f.parentPath,f.name);r[path.relative(dir,p)]=await fs.readFile(p,"utf8");}return r;}
test("official source: published IDs kept, mapped districts fetched, no mirror traffic",async t=>{const s=await setup(t);await s.run();const ilce1=await fs.readFile(path.join(s.out,"ilceler/1.json"),"utf8");s.hits.ayna=0;
 await s.writeTable(()=>true);const {stdout}=await s.run(s.resmi);
 assert.equal(s.hits.ayna,0);assert.equal(s.hits.login,1);assert.equal(s.hits.monthly,81);
 const m=JSON.parse(await fs.readFile(path.join(s.out,"meta.json")));assert.equal(m.durum.basarili,81);assert.match(m.kaynak,/Awqat Salah resmi API/);
 assert.equal(await fs.readFile(path.join(s.out,"ilceler/1.json"),"utf8"),ilce1);
 const v=JSON.parse(await fs.readFile(path.join(s.out,"vakitler/1001.json")));assert.deepEqual(v.gunler.find(g=>g.t===dmy(0)).v,["06:01","07:31","12:31","15:01","17:31","19:01"]);assert.equal(v.guncelleme,m.guncelleme);
 assert.ok(!stdout.includes("pw"));assert.match(stdout,/Resmi API istek sayısı: 82/);});
test("official source refuses without explicit approval or total cap; nothing written",async t=>{const s=await setup(t);await s.run();await s.writeTable(()=>true);const before=await snap(s.out);
 for(const drop of ["RESMI_KAYNAK_ONAYI","RESMI_TOPLAM_ISTEK_SINIRI","AWQAT_PASSWORD"]){const env={...s.resmi};delete env[drop];await assert.rejects(s.run(env));}
 await assert.rejects(s.run({VERI_KAYNAGI:"baska"}));assert.deepEqual(await snap(s.out),before);assert.equal(s.hits.monthly,0);});
test("unverified mappings are source failures: partial below threshold, abort above",async t=>{const s=await setup(t);await s.run();
 await s.writeTable(id=>id!==1001);await s.run({...s.resmi,MAX_KRITIK_ILCE_ORANI:"0.05"});let m=JSON.parse(await fs.readFile(path.join(s.out,"meta.json")));assert.deepEqual(m.durum.yedek,[1001]);assert.equal(m.durum.basarili,80);
 const before=await snap(s.out);await s.writeTable(id=>id<1010);await assert.rejects(s.run(s.resmi),/kaynak hatası/);assert.deepEqual(await snap(s.out),before);});
test("403 or total-cap exhaustion stops the whole run without writing",async t=>{const s=await setup(t);await s.run();await s.writeTable(()=>true);const before=await snap(s.out);
 s.setMode("403");await assert.rejects(s.run(s.resmi),/YETKI/);assert.equal(s.hits.monthly,1);assert.deepEqual(await snap(s.out),before);
 s.setMode("ok");await assert.rejects(s.run({...s.resmi,RESMI_TOPLAM_ISTEK_SINIRI:"10"}),/toplam istek sınırı/);assert.deepEqual(await snap(s.out),before);});
test("known exceptions are per source: ayna skips 1001, resmi refreshes it",async t=>{const s=await setup(t);await s.run();
 const cfg=path.join(s.dir,"bilinen.json");await fs.writeFile(cfg,JSON.stringify({surum:1,kaynaklar:{ayna:[{id:1001,sebep:"test"}],resmi:[]}}));
 const f=path.join(s.out,"vakitler/1001.json"),old=await fs.readFile(f,"utf8");
 await s.run({BILINEN_EKSIK_DOSYASI:cfg});let m=JSON.parse(await fs.readFile(path.join(s.out,"meta.json")));assert.deepEqual(m.durum.bilinenEksik,[1001]);assert.equal(m.kaynakTuru,"ayna");assert.equal(await fs.readFile(f,"utf8"),old);
 await s.writeTable(()=>true);await s.run({...s.resmi,BILINEN_EKSIK_DOSYASI:cfg});m=JSON.parse(await fs.readFile(path.join(s.out,"meta.json")));
 assert.deepEqual(m.durum.bilinenEksik,[]);assert.equal(m.kaynakTuru,"resmi");assert.equal(JSON.parse(await fs.readFile(f)).guncelleme,m.guncelleme);});
