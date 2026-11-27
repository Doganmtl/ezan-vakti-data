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
test("no workflow sends official API requests or uses its secrets",async()=>{for(const f of await fs.readdir(".github/workflows"))assert.ok(!/AWQAT_|awqatsalah|ALLOW_LIVE_API/i.test(await wf(f)),f);});
