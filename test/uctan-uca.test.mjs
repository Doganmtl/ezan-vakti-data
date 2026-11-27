// guncelle.mjs çıktısı, publish-data.sh + yayin-dogrula.mjs tarafından gerçek bir git deposunda kabul edilmeli.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {execFileSync,execFile} from "node:child_process";
import {promisify} from "node:util";
const execA=promisify(execFile);
import {fileURLToPath} from "node:url";
import {gunEkle} from "../scripts/v1-dogrulama.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const git=(cwd,...a)=>execFileSync("git",a,{cwd,stdio:"pipe",encoding:"utf8"}).trim();
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
const rows=Array.from({length:20},(_,i)=>({MiladiTarihKisa:gunEkle(today,i).split("-").reverse().join("."),Imsak:"06:00",Gunes:"07:30",Ogle:"12:30",Ikindi:"15:00",Aksam:"17:30",Yatsi:"19:00"}));
test("guncelle output is accepted by the independent publish validator (full, partial, staged)",async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"e2e-"));let mode="ok";
 const server=http.createServer((req,res)=>{const [,k,id]=req.url.split("/");let d;
  if(k==="sehirler")d=Array.from({length:81},(_,i)=>({SehirID:i+1,SehirAdi:"İl "+i}));
  else if(k==="ilceler")d=[{IlceID:1000+Number(id),IlceAdi:"İlçe "+id}];
  else if(k==="vakitler"){if(mode==="502"&&id==="1001"){res.writeHead(502);return res.end();}d=rows;}
  res.setHeader("Content-Type","application/json");res.end(JSON.stringify(d));});
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 t.after(async()=>{server.closeAllConnections();await new Promise(ok=>server.close(ok));await fs.rm(dir,{recursive:true,force:true});});
 const remote=path.join(dir,"r.git"),a=path.join(dir,"a");git(dir,"init","--bare","--initial-branch=main",remote);git(dir,"clone",remote,a);
 git(a,"config","user.name","T");git(a,"config","user.email","t@example.invalid");
 for(const d of ["scripts","config","eslesme"])await fs.cp(path.join(root,d),path.join(a,d),{recursive:true});
 const env={...process.env,SOURCE_URL:"http://127.0.0.1:"+server.address().port,TODAY:today,DELAY_MS:"0",RETRY_BASE_MS:"1",REQUEST_TIMEOUT_MS:"2000",GITHUB_ACTIONS:"false"};
 const run=(extra={})=>execA(process.execPath,["scripts/guncelle.mjs"],{cwd:a,env:{...env,...extra},timeout:60000});
 const publish=()=>execFileSync("bash",["scripts/publish-data.sh","prayer"],{cwd:a,env,stdio:"pipe",encoding:"utf8"});
 await run();git(a,"add",".");git(a,"commit","-m","seed");git(a,"push","origin","main");
 await new Promise(r=>setTimeout(r,1100)); // distinct, strictly newer run timestamps
 mode="502";await run();assert.match(publish(),/staged snapshot validated/);                 // partial: 1001 yedek
 let m=JSON.parse(git(remote,"show","main:docs/v1/meta.json"));assert.deepEqual(m.durum.yedek,[1001]);
 await new Promise(r=>setTimeout(r,1100));
 mode="ok";await run({DILIM_BOYUTU:"10"});assert.match(publish(),/staged snapshot validated/); // staged: 10 refreshed
 m=JSON.parse(git(remote,"show","main:docs/v1/meta.json"));assert.equal(m.durum.basarili,10);assert.equal(m.durum.planliBekleyen.length,71);
 assert.ok(m.durum.planliBekleyen.every(id=>id!==1001)); // 1001 had the oldest data -> selected first
});
