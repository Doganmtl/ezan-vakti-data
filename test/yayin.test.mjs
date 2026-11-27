import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {gunEkle} from "../scripts/v1-dogrulama.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
// Prayer timestamps relative to now: the publish validator applies the mobile 14-day rule against the real date.
const T=h=>new Date(Math.floor((Date.now()-h*3600e3)/1000)*1000).toISOString().replace(".000Z","Z");
const git=(cwd,...args)=>execFileSync("git",args,{cwd,stdio:"pipe",encoding:"utf8"}).trim();
async function setup(t,prayer=false){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"publish-test-")),remote=path.join(dir,"remote.git"),a=path.join(dir,"a"),b=path.join(dir,"b");
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 git(dir,"init","--bare","--initial-branch=main",remote);
 git(dir,"clone",remote,a);git(a,"config","user.name","Test");git(a,"config","user.email","test@example.invalid");
 await fs.mkdir(path.join(a,"docs/v1"),{recursive:true});await fs.mkdir(path.join(a,"scripts"));
 for(const f of ["publish-data.sh","yayin-dogrula.mjs","v1-dogrulama.mjs","kimlik.mjs","esik.mjs","bilinen-eksik.mjs"])await fs.copyFile(path.join(root,"scripts",f),path.join(a,"scripts",f));
 await fs.mkdir(path.join(a,"config"));await fs.writeFile(path.join(a,"config/bilinen-eksik.json"),JSON.stringify({surum:1,kaynaklar:{ayna:[],resmi:[]}}));
 const data={guncelleme:"2026-11-26T00:00:00Z",gunler:[{t:"2026-11-26"}]};
 const write=async(cwd,file,value)=>{const dest=path.join(cwd,"docs/v1",file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,JSON.stringify(value));};
 await write(a,"gunluk.json",data);
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
 const stamp=T(48);
 const dayRows=Array.from({length:15},(_,i)=>({t:gunEkle(today,i).split("-").reverse().join("."),v:["06:00","07:30","12:30","15:00","17:30","19:00"]}));
 if(prayer){
 await write(a,"iller.json",Array.from({length:81},(_,i)=>({id:i+1,ad:"İl "+i})));
 await write(a,"meta.json",{guncelleme:stamp,ilSayisi:81,ilceSayisi:81});
 for(let i=1;i<=81;i++){await write(a,"ilceler/"+i+".json",[{id:1000+i,ad:"İlçe "+i}]);await write(a,"vakitler/"+(1000+i)+".json",{guncelleme:stamp,gunler:dayRows});}
 }
 git(a,"add",".");git(a,"commit","-m","seed");git(a,"push","origin","main");git(dir,"clone",remote,b);
 const change=async(cwd,stamp)=>fs.writeFile(path.join(cwd,"docs/v1/gunluk.json"),JSON.stringify({...data,guncelleme:stamp}));
 const publish=(cwd,env={})=>execFileSync("bash",["scripts/publish-data.sh",prayer?"prayer":"daily"],{cwd,stdio:"pipe",env:{...process.env,GITHUB_ACTIONS:"false",...env}});
 const ALL=Array.from({length:81},(_,i)=>1001+i),RUN=T(2);
 // meta: listed fresh ids, explicit classes in extra; every other district is planliBekleyen (staged update).
 const meta=(fresh,extra={},over={})=>{const used=new Set([...fresh,...Object.values(extra).flat()]);const waiting=ALL.filter(id=>!used.has(id));
  const known=new Set(extra.bilinenEksik??[]);const attempted=[...used].filter(id=>!known.has(id)).length;
  return {guncelleme:RUN,kaynakTuru:"ayna",ilSayisi:81,ilceSayisi:81,dilim:waiting.length?{boyut:attempted,secilen:attempted}:null,
   durum:{basarili:fresh.length,yedek:[],kisaKapsam:[],tukenmis:[],eksik:[],bilinenEksik:[],planliBekleyen:waiting,...extra},...over};};
 const writeFresh=async(ids)=>{for(const id of ids)await write(a,"vakitler/"+id+".json",{guncelleme:RUN,gunler:dayRows});};
 return {a,b,remote,change,publish,write,dayRows,today,meta,writeFresh,ALL,RUN};
}
test("one validated snapshot publishes; stale checkout cannot overwrite",async t=>{const s=await setup(t);await s.change(s.a,"2026-11-26T02:00:00Z");s.publish(s.a);const sha=git(s.remote,"rev-parse","main");await s.change(s.b,"2026-11-26T03:00:00Z");assert.throws(()=>s.publish(s.b));assert.equal(git(s.remote,"rev-parse","main"),sha);});
test("older timestamp and unrelated staged file rejected",async t=>{const s=await setup(t);const sha=git(s.remote,"rev-parse","main");await s.change(s.a,"2026-11-25T00:00:00Z");assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),sha);git(s.a,"reset");await s.change(s.a,"2026-11-26T03:00:00Z");await fs.writeFile(path.join(s.a,"extra"),"x");git(s.a,"add","extra");assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),sha);});

test("prayer snapshot publishes all staged changes as one commit",async t=>{const s=await setup(t,true);const before=git(s.remote,"rev-parse","main");await s.write(s.a,"vakitler/1001.json",{guncelleme:s.RUN,gunler:s.dayRows});await s.write(s.a,"meta.json",s.meta([1001]));s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),before);assert.equal(git(s.remote,"diff","--name-only",before,"main"),"docs/v1/meta.json\ndocs/v1/vakitler/1001.json");});
test("prayer rejects swapped district ID, older stamp, short coverage and orphan file",async t=>{const s=await setup(t,true);const before=git(s.remote,"rev-parse","main");const cases=[["ilceler/1.json",[{id:2001,ad:"new"}]],["vakitler/1001.json",{guncelleme:T(72),gunler:s.dayRows}],["vakitler/1001.json",{guncelleme:s.RUN,gunler:s.dayRows.slice(0,8)}],["vakitler/9999.json",{guncelleme:s.RUN,gunler:s.dayRows}],["iller.json",Array.from({length:81},(_,i)=>({id:i===0?99:i+1,ad:"İl "+i}))]];for(const [file,data] of cases){await s.write(s.a,"meta.json",s.meta([1001]));if(!file.startsWith("vakitler/1001"))await s.write(s.a,"vakitler/1001.json",{guncelleme:s.RUN,gunler:s.dayRows});await s.write(s.a,file,data);assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),before);git(s.a,"reset","--hard","HEAD");git(s.a,"clean","-fd");}});
test("daily retention allows only oldest overflow, rejects mass pruning",async t=>{const s=await setup(t);const days=Array.from({length:400},(_,i)=>({t:gunEkle("2026-11-26",i-399)}));await s.write(s.a,"gunluk.json",{guncelleme:"2026-11-26T01:00:00Z",gunler:days});s.publish(s.a);const before=git(s.remote,"rev-parse","main");const next={t:gunEkle(days.at(-1).t,1)};await s.write(s.a,"gunluk.json",{guncelleme:"2026-11-26T02:00:00Z",gunler:[next]});assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),before);git(s.a,"reset");await s.write(s.a,"gunluk.json",{guncelleme:"2026-11-26T02:00:00Z",gunler:[...days.slice(1),next]});s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),before);});
test("workflow ref, event, rerun and SHA guards",async t=>{const s=await setup(t);const before=git(s.remote,"rev-parse","main");await s.change(s.a,"2026-11-26T02:00:00Z");const good={GITHUB_ACTIONS:"true",GITHUB_REF:"refs/heads/main",GITHUB_EVENT_NAME:"schedule",GITHUB_RUN_ATTEMPT:"1",GITHUB_SHA:before};for(const bad of [{GITHUB_REF:"refs/heads/develop"},{GITHUB_EVENT_NAME:"pull_request"},{GITHUB_RUN_ATTEMPT:"2"},{GITHUB_SHA:"bad"}]){assert.throws(()=>s.publish(s.a,{...good,...bad}));assert.equal(git(s.remote,"rev-parse","main"),before);}s.publish(s.a,good);assert.equal(git(s.remote,"rev-parse","main^"),before);});

test("partial publish: unrefreshed districts untouched, classes recomputed, D06 enforced independently",async t=>{const s=await setup(t,true);const before=git(s.remote,"rev-parse","main");
 const fresh={guncelleme:s.RUN,gunler:s.dayRows};const reset=()=>{git(s.a,"reset","--hard","HEAD");git(s.a,"clean","-fd");};
 const bad=[
  async()=>{await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"vakitler/1002.json",{...fresh,guncelleme:T(40)});await s.write(s.a,"meta.json",s.meta([1001]));}, // waiting district restamped
  async()=>{await s.write(s.a,"vakitler/1001.json",{...fresh,guncelleme:T(30)});await s.write(s.a,"meta.json",s.meta([1001]));}, // fresh stamp != run stamp
  async()=>{await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"meta.json",s.meta([1001],{eksik:[1002]}));},      // claims missing, file present
  async()=>{await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"meta.json",s.meta([1001],{tukenmis:[1002]}));},   // claims exhausted, recomputed yedek
  async()=>{await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"meta.json",s.meta([]));},                        // count mismatch
  async()=>{await s.write(s.a,"vakitler/1001.json",fresh);const m=s.meta([1001]);delete m.durum;await s.write(s.a,"meta.json",m);},
  async()=>{await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"meta.json",s.meta([1001],{},{kaynakTuru:"x"}));},
  async()=>{await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"meta.json",s.meta([1001],{yedek:[1002],bilinenEksik:[1002]}));}, // run invents exception
  async()=>{await s.writeFresh([1001]);await s.write(s.a,"meta.json",s.meta([1001],{yedek:[1002,1003]}));},                    // 2/3 source failures > 2%
  async()=>{await s.writeFresh([1001]);await s.write(s.a,"meta.json",s.meta([1001],{},{guncelleme:T(2).replace("Z","+00:00")}));}, // not UTC Z
  async()=>{const fut=new Date(Date.now()+3600e3).toISOString();await s.write(s.a,"vakitler/1001.json",{...fresh,guncelleme:fut});await s.write(s.a,"meta.json",s.meta([1001],{},{guncelleme:fut}));}, // future
 ];
 for(const mk of bad){await mk();assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),before);reset();}
 // Valid: 79 fresh, 1080 short backup (kisaKapsam, recomputed), 1081 waiting -> 1/80 source failures.
 const short={guncelleme:T(48),gunler:s.dayRows.slice(0,3)};await s.write(s.a,"vakitler/1080.json",short);git(s.a,"add",".");git(s.a,"commit","-m","short");git(s.a,"push","origin","main");
 const base=git(s.remote,"rev-parse","main");const ids=s.ALL.slice(0,79);await s.writeFresh(ids);
 await s.write(s.a,"meta.json",s.meta(ids,{kisaKapsam:[1080]}));s.publish(s.a);
 assert.equal(git(s.remote,"rev-parse","main^"),base);assert.equal(git(s.remote,"show","main:docs/v1/vakitler/1080.json"),JSON.stringify(short));});
test("staged update must not skip a district with less remaining coverage",async t=>{const s=await setup(t,true);
 const short={guncelleme:T(48),gunler:s.dayRows.slice(0,10)};await s.write(s.a,"vakitler/1050.json",short);git(s.a,"add",".");git(s.a,"commit","-m","short");git(s.a,"push","origin","main");
 const base=git(s.remote,"rev-parse","main");await s.writeFresh([1001]);await s.write(s.a,"meta.json",s.meta([1001]));assert.throws(()=>s.publish(s.a),/less coverage/);assert.equal(git(s.remote,"rev-parse","main"),base);
 git(s.a,"reset","--hard","HEAD");await s.writeFresh([1050]);await s.write(s.a,"meta.json",s.meta([1050]));s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),base);});
test("known exceptions come only from the reviewed config",async t=>{const s=await setup(t,true);
 await fs.writeFile(path.join(s.a,"config/bilinen-eksik.json"),JSON.stringify({surum:1,kaynaklar:{ayna:[{id:1002,sebep:"onaylı test"}],resmi:[]}}));git(s.a,"add",".");git(s.a,"commit","-m","approve exception");git(s.a,"push","origin","main");
 const base=git(s.remote,"rev-parse","main");await s.writeFresh([1001]);
 await s.write(s.a,"meta.json",s.meta([1001],{yedek:[1002],bilinenEksik:[1002]}));s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),base);
 const base2=git(s.remote,"rev-parse","main");const others=s.ALL.filter(id=>id!==1002);
 for(const id of others)await s.write(s.a,"vakitler/"+id+".json",{guncelleme:T(1),gunler:s.dayRows});
 // resmi kaynakta 1002 istisna değildir: yenilenmediyse sınıflanmalı (yedek) ve bilinenEksik listesinde olmamalı.
 await s.write(s.a,"meta.json",{...s.meta(others,{yedek:[1002]}),guncelleme:T(1),kaynakTuru:"resmi"});
 s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),base2);});
test("district removal and unapproved addition rejected; approved addition publishes",async t=>{const s=await setup(t,true);const before=git(s.remote,"rev-parse","main");
 const fresh={guncelleme:s.RUN,gunler:s.dayRows};
 await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"ilceler/1.json",[{id:1001,ad:"İlçe 1"},{id:5001,ad:"Yeni"}]);await s.write(s.a,"vakitler/5001.json",fresh);
 const m={...s.meta([1001,5001]),ilceSayisi:82};m.durum.planliBekleyen=m.durum.planliBekleyen.filter(id=>id!==5001);await s.write(s.a,"meta.json",m);
 assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),before);
 git(s.a,"reset","--hard","HEAD");git(s.a,"clean","-fd");
 await s.write(s.a,"ilceler/2.json",[]);await s.write(s.a,"meta.json",s.meta([]));assert.throws(()=>s.publish(s.a));git(s.a,"reset","--hard","HEAD");git(s.a,"clean","-fd");
 await fs.mkdir(path.join(s.a,"eslesme"));await fs.writeFile(path.join(s.a,"eslesme/onayli-gecisler.json"),JSON.stringify({surum:1,gecisler:[{tur:"ekle",id:5001,ilId:1,ad:"Yeni",onay:{kim:"Test",tarih:"2026-11-27",gerekce:"test"}}]}));git(s.a,"add","eslesme");git(s.a,"commit","-m","approve");git(s.a,"push","origin","main");
 const base=git(s.remote,"rev-parse","main");
 await s.write(s.a,"vakitler/1001.json",fresh);await s.write(s.a,"ilceler/1.json",[{id:1001,ad:"İlçe 1"},{id:5001,ad:"Yeni"}]);await s.write(s.a,"vakitler/5001.json",fresh);await s.write(s.a,"meta.json",m);
 s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),base);});
