import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const wf=async f=>fs.readFile(".github/workflows/"+f,"utf8");
const pos=(s,x)=>{const i=s.indexOf(x);assert.ok(i>=0,"missing: "+x);return i;};
for(const [file,fetchStep,kind] of [["guncelle.yml","node scripts/guncelle.mjs","prayer"],["gunluk.yml","node scripts/gunluk.mjs","daily"]]){
 test(file+": tests before network, publish only via guarded script",async()=>{const s=await wf(file);
  assert.ok(pos(s,"node --test test/*.test.mjs")<pos(s,fetchStep),"offline tests must precede network step");
  assert.ok(pos(s,fetchStep)<pos(s,"bash scripts/publish-data.sh "+kind));
  for(const bad of ["git push","git pull","-X theirs","--force","git commit","scripts/dogrula.mjs","AWQAT_"])assert.ok(!s.includes(bad),file+" must not contain "+bad);
  assert.match(s,/group: veri-guncelleme\n\s+cancel-in-progress: false/);});
}
// pilot/awqat-sehir dalına özel: tek seferlik canlı test yalnız bu dala push ile, awqat-test onayıyla (izolasyon testi ayrıca denetler).
test("no workflow sends official API requests or uses its secrets (except the branch-only approved test)",async()=>{for(const f of await fs.readdir(".github/workflows")){const s=await wf(f);
 if(f==="awqat-sehir.yml"){assert.match(s,/on:\n  push:\n    branches: \[pilot\/awqat-sehir\]\npermissions:\n  contents: read/);assert.match(s,/environment: awqat-test/);assert.ok(!/schedule|workflow_dispatch|pull_request|contents: write/.test(s));continue;}
 assert.ok(!/AWQAT_|awqatsalah|ALLOW_LIVE_API/i.test(s),f);}});

// ---- 8. tur G0: Environment ve secret izolasyonu (genel kural; dosya adına bağlı değil) ----
// Basit, bağımlılıksız YAML okuması: üst düzey "on:" bloğu ve job blokları metin olarak ayrıştırılır.
const blok=(s,anahtar)=>{const m=s.match(new RegExp("^"+anahtar+":[^\\n]*\\n((?:[ \\t]+[^\\n]*\\n|\\n)*)","m"));return m?m[1]:"";};
const joblar=s=>{const j=blok(s,"jobs");return j.split(/\n(?=  [A-Za-z0-9_-]+:\s*\n)/).filter(x=>/^\s*[A-Za-z0-9_-]+:/.test(x));};
export function izolasyonDenetle(ad,s){const h=[];const on=blok(s,"on"),perm=blok(s,"permissions");
 for(const j of joblar(s)){const env=(j.match(/^\s{4}environment:\s*([^\s#]+)/m)??[])[1]??null;
  if(/secrets\.AWQAT_/.test(j)&&!env)h.push(ad+": AWQAT secret'ı Environment'sız job'da");
  if(env==="awqat-test"){
   if(!/^  push:\s*\n\s+branches:\s*\[pilot\/[^\]]+\]\s*$/m.test(on)||/schedule|workflow_dispatch|pull_request|workflow_run|repository_dispatch/.test(on))h.push(ad+": awqat-test yalnız pilot/* push ile tetiklenebilir");
   if(!/contents:\s*read/.test(perm)||/write/.test(perm))h.push(ad+": awqat-test işi yazma yetkisi almamalı");}
  if(env==="awqat-uretim"){
   if(/pull_request|pilot\//.test(on))h.push(ad+": awqat-uretim PR veya pilot dalından tetiklenemez");
   const dallar=[...on.matchAll(/branches:\s*\[([^\]]*)\]/g)].flatMap(m=>m[1].split(",").map(x=>x.trim().replace(/['"]/g,"")));
   if(dallar.some(d=>d!=="main"))h.push(ad+": awqat-uretim yalnız main");
   if(/AWQAT_TEST|awqat-test/.test(j))h.push(ad+": üretim işinde test Environment'ı/secret'ı");}
  if(env&&!["awqat-test","awqat-uretim"].includes(env))h.push(ad+": bilinmeyen Environment "+env);}
 if(/pull_request/.test(on)&&/secrets\.|ALLOW_LIVE_API|environment:/.test(s))h.push(ad+": PR ile tetiklenen workflow secret/canlı API/Environment kullanamaz");
 return h;}
test("environment isolation holds for every workflow in the repository",async()=>{for(const f of await fs.readdir(".github/workflows"))assert.deepEqual(izolasyonDenetle(f,await wf(f)),[],f);});
test("environment isolation checker rejects unsafe patterns",()=>{
 const base=(on,env,extra="")=>`name: x\non:\n${on}permissions:\n  contents: read\njobs:\n  j:\n    runs-on: ubuntu-latest\n${env?`    environment: ${env}\n`:""}    steps:\n      - run: echo \${{ secrets.AWQAT_EMAIL }}${extra}\n`;
 const pilot="  push:\n    branches: [pilot/awqat-x]\n";
 assert.deepEqual(izolasyonDenetle("ok",base(pilot,"awqat-test")),[]);
 assert.match(izolasyonDenetle("a",base(pilot,null)).join(),/Environment'sız/);
 assert.match(izolasyonDenetle("b",base("  workflow_dispatch:\n","awqat-test")).join(),/pilot/);
 assert.match(izolasyonDenetle("c",base("  push:\n    branches: [main]\n","awqat-test")).join(),/pilot/);
 assert.match(izolasyonDenetle("d",base(pilot,"awqat-uretim")).join(),/awqat-uretim/);
 assert.match(izolasyonDenetle("e",base("  pull_request:\n    branches: [develop]\n","awqat-uretim")).join(),/PR/);
 assert.match(izolasyonDenetle("f",base("  push:\n    branches: [main, develop]\n","awqat-uretim")).join(),/yalnız main/);
 assert.deepEqual(izolasyonDenetle("g",base("  schedule:\n    - cron: '17 1 * * 1,4'\n  workflow_dispatch:\n","awqat-uretim")),[]);
 assert.match(izolasyonDenetle("h",base(pilot,"baska")).join(),/bilinmeyen/);
 assert.match(izolasyonDenetle("i",base(pilot,"awqat-test").replace("contents: read","contents: write")).join(),/yazma/);});
test("offline CI cannot reach the live API: no secrets/env, and every live-flag test targets 127.0.0.1",async()=>{
 const s=await wf("offline-tests.yml");assert.ok(!/secrets\.|ALLOW_LIVE_API|environment:|AWQAT_/.test(s));
 for(const f of (await fs.readdir("test")).filter(x=>x.endsWith(".mjs"))){const t=await fs.readFile("test/"+f,"utf8");
  if(/ALLOW_LIVE_API\s*:\s*"evet"/.test(t))assert.match(t,/AWQAT_BASE_URL\s*:\s*"http:\/\/127\.0\.0\.1:/,f+": canlı bayrak yalnız yerel sahte sunucuyla");}
 const {AwqatIstemci}=await import("../scripts/resmi/awqat-adaptor.mjs");const S=JSON.parse(await fs.readFile("config/awqat-sozlesme.json","utf8"));
 assert.throws(()=>new AwqatIstemci({sozlesme:{...S,baseUrl:"http://example.invalid"},email:"a",sifre:"b",toplamIstekSiniri:1}));});
