import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const git=(cwd,...args)=>execFileSync("git",args,{cwd,stdio:"pipe",encoding:"utf8"}).trim();
async function setup(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"publish-test-")),remote=path.join(dir,"remote.git"),a=path.join(dir,"a"),b=path.join(dir,"b");
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 git(dir,"init","--bare","--initial-branch=main",remote);
 git(dir,"clone",remote,a);git(a,"config","user.name","Test");git(a,"config","user.email","test@example.invalid");
 await fs.mkdir(path.join(a,"docs/v1"),{recursive:true});await fs.mkdir(path.join(a,"scripts"));
 for(const f of ["publish-data.sh","yayin-dogrula.mjs","v1-dogrulama.mjs"])await fs.copyFile(path.join(root,"scripts",f),path.join(a,"scripts",f));
 const data={guncelleme:"2026-11-26T00:00:00Z",gunler:[{t:"2026-11-26"}]};
 await fs.writeFile(path.join(a,"docs/v1/gunluk.json"),JSON.stringify(data));git(a,"add",".");git(a,"commit","-m","seed");git(a,"push","origin","main");git(dir,"clone",remote,b);
 const change=async(cwd,stamp)=>fs.writeFile(path.join(cwd,"docs/v1/gunluk.json"),JSON.stringify({...data,guncelleme:stamp}));
 const publish=cwd=>execFileSync("bash",["scripts/publish-data.sh","daily"],{cwd,stdio:"pipe"});
 return {a,b,remote,change,publish};
}
test("one validated snapshot publishes; stale checkout cannot overwrite",async t=>{const s=await setup(t);await s.change(s.a,"2026-11-26T02:00:00Z");s.publish(s.a);const sha=git(s.remote,"rev-parse","main");await s.change(s.b,"2026-11-26T03:00:00Z");assert.throws(()=>s.publish(s.b));assert.equal(git(s.remote,"rev-parse","main"),sha);});
test("older timestamp and unrelated staged file rejected",async t=>{const s=await setup(t);const sha=git(s.remote,"rev-parse","main");await s.change(s.a,"2026-11-25T00:00:00Z");assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),sha);git(s.a,"reset");await s.change(s.a,"2026-11-26T03:00:00Z");await fs.writeFile(path.join(s.a,"extra"),"x");git(s.a,"add","extra");assert.throws(()=>s.publish(s.a));assert.equal(git(s.remote,"rev-parse","main"),sha);});
