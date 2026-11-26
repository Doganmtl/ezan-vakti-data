import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {gunEkle} from "../scripts/v1-dogrulama.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const git=(cwd,...args)=>execFileSync("git",args,{cwd,stdio:"pipe",encoding:"utf8"}).trim();
async function setup(t,prayer=false){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"publish-test-")),remote=path.join(dir,"remote.git"),a=path.join(dir,"a"),b=path.join(dir,"b");
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 git(dir,"init","--bare","--initial-branch=main",remote);
 git(dir,"clone",remote,a);git(a,"config","user.name","Test");git(a,"config","user.email","test@example.invalid");
 await fs.mkdir(path.join(a,"docs/v1"),{recursive:true});await fs.mkdir(path.join(a,"scripts"));
 for(const f of ["publish-data.sh","yayin-dogrula.mjs","v1-dogrulama.mjs"])await fs.copyFile(path.join(root,"scripts",f),path.join(a,"scripts",f));
 const data={guncelleme:"2026-11-26T00:00:00Z",gunler:[{t:"2026-11-26"}]};
 const write=async(cwd,file,value)=>{const dest=path.join(cwd,"docs/v1",file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,JSON.stringify(value));};
 await write(a,"gunluk.json",data);
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
 const stamp="2026-11-26T00:00:00Z";
 const dayRows=Array.from({length:15},(_,i)=>({t:gunEkle(today,i).split("-").reverse().join("."),v:["06:00","07:30","12:30","15:00","17:30","19:00"]}));
 if(prayer){
 await write(a,"iller.json",Array.from({length:81},(_,i)=>({id:i+1,ad:"İl "+i})));
 await write(a,"meta.json",{guncelleme:stamp,ilSayisi:81,ilceSayisi:81});
 for(let i=1;i<=81;i++){await write(a,"ilceler/"+i+".json",[{id:1000+i,ad:"İlçe "+i}]);await write(a,"vakitler/"+(1000+i)+".json",{guncelleme:stamp,gunler:dayRows});}
 }
 git(a,"add",".");git(a,"commit","-m","seed");git(a,"push","origin","main");git(dir,"clone",remote,b);
 const change=async(cwd,stamp)=>fs.writeFile(path.join(cwd,"docs/v1/gunluk.json"),JSON.stringify({...data,guncelleme:stamp}));
 const publish=(cwd,env={})=>execFileSync("bash",["scripts/publish-data.sh",prayer?"prayer":"daily"],{cwd,stdio:"pipe",env:{...process.env,GITHUB_ACTIONS:"false",...env}});
 return {a,b,remote,change,publish,write,dayRows,today};
}
test("one validated snapshot publishes; stale checkout cannot overwrite",async t=>{const s=await setup(t);await s.change(s.a,"2026-11-26T02:00:00Z");s.publish(s.a);const sha=git(s.remote,"rev-parse","main");await s.change(s.b,"2026-11-26T03:00:00Z");assert.throws(()=>s.publish(s.b));assert.equal(git(s.remote,"rev-parse","main"),sha);});
test("older timestamp and unrelated staged file rejected",async t=>{const s=await setup(t);const sha=git(s.remote,"rev-parse","main");await s.change(s.a,"2026-11-25T00:00:00Z");assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),sha);git(s.a,"reset");await s.change(s.a,"2026-11-26T03:00:00Z");await fs.writeFile(path.join(s.a,"extra"),"x");git(s.a,"add","extra");assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),sha);});

test("prayer snapshot publishes all staged changes as one commit",async t=>{const s=await setup(t,true);const before=git(s.remote,"rev-parse","main");await s.write(s.a,"vakitler/1001.json",{guncelleme:"2026-11-27T00:00:00Z",gunler:s.dayRows});await s.write(s.a,"meta.json",{guncelleme:"2026-11-27T00:00:00Z",ilSayisi:81,ilceSayisi:81});s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),before);assert.equal(git(s.remote,"diff","--name-only",before,"main"),"docs/v1/meta.json\ndocs/v1/vakitler/1001.json");});
test("prayer rejects swapped district ID, older stamp, short coverage and orphan file",async t=>{const s=await setup(t,true);const before=git(s.remote,"rev-parse","main");const cases=[["ilceler/1.json",[{id:2001,ad:"new"}]],["vakitler/1001.json",{guncelleme:"2026-11-25T00:00:00Z",gunler:s.dayRows}],["vakitler/1001.json",{guncelleme:"2026-11-27T00:00:00Z",gunler:s.dayRows.slice(0,8)}],["vakitler/9999.json",{guncelleme:"2026-11-27T00:00:00Z",gunler:s.dayRows}],["iller.json",Array.from({length:81},(_,i)=>({id:i===0?99:i+1,ad:"İl "+i}))]];for(const [file,data] of cases){await s.write(s.a,file,data);assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),before);git(s.a,"reset","--hard","HEAD");git(s.a,"clean","-fd");}});
test("daily retention allows only oldest overflow, rejects mass pruning",async t=>{const s=await setup(t);const days=Array.from({length:400},(_,i)=>({t:gunEkle("2026-11-26",i-399)}));await s.write(s.a,"gunluk.json",{guncelleme:"2026-11-26T01:00:00Z",gunler:days});s.publish(s.a);const before=git(s.remote,"rev-parse","main");const next={t:gunEkle(days.at(-1).t,1)};await s.write(s.a,"gunluk.json",{guncelleme:"2026-11-26T02:00:00Z",gunler:[next]});assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),before);git(s.a,"reset");await s.write(s.a,"gunluk.json",{guncelleme:"2026-11-26T02:00:00Z",gunler:[...days.slice(1),next]});s.publish(s.a);assert.equal(git(s.remote,"rev-parse","main^"),before);});
test("workflow ref, event, rerun and SHA guards",async t=>{const s=await setup(t);const before=git(s.remote,"rev-parse","main");await s.change(s.a,"2026-11-26T02:00:00Z");const good={GITHUB_ACTIONS:"true",GITHUB_REF:"refs/heads/main",GITHUB_EVENT_NAME:"schedule",GITHUB_RUN_ATTEMPT:"1",GITHUB_SHA:before};for(const bad of [{GITHUB_REF:"refs/heads/develop"},{GITHUB_EVENT_NAME:"pull_request"},{GITHUB_RUN_ATTEMPT:"2"},{GITHUB_SHA:"bad"}]){assert.throws(()=>s.publish(s.a,{...good,...bad}));assert.equal(git(s.remote,"rev-parse","main"),before);}s.publish(s.a,good);assert.equal(git(s.remote,"rev-parse","main^"),before);});
