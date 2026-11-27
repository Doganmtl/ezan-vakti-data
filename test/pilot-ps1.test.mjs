// PowerShell yürütücüsünün güvenlik özellikleri (statik denetim; bu ortamda PowerShell yok).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const s=await fs.readFile("scripts/resmi/pilot-calistir.ps1","utf8");
const at=x=>{const i=s.indexOf(x);assert.ok(i>=0,"missing: "+x);return i;};
test("order: repo checks -> offline tests -> same-day report -> dry-run exit -> consent -> credentials -> pilot",()=>{
 const o=[at("git rev-parse --abbrev-ref HEAD"),at("node --test @testler"),at("Test-Path $rapor"),at("if ($YalnizKontrol)"),at("Read-Host \"Pilot"),at("Read-Host 'Awqat Salah e-posta'"),at("node scripts/resmi/pilot.mjs")];
 assert.deepEqual([...o].sort((a,b)=>a-b),o);});
test("password: secure prompt, process-scope env only, cleared in finally",()=>{
 at("-AsSecureString");at("ZeroFreeBSTR");const fin=at("finally {");
 assert.ok(at("Remove-Item Env:AWQAT_PASSWORD, Env:AWQAT_EMAIL, Env:ALLOW_LIVE_API")>fin);
 assert.ok(!/SetEnvironmentVariable|setx|ConvertFrom-SecureString|Write-Host[^\n]*\$env:AWQAT_PASSWORD|Out-File|Set-Content/i.test(s));
 assert.ok(!/AWQAT_PASSWORD\s*=\s*['"]/.test(s),"no literal password");});
test("reviewed commit and clean tree required",()=>{at("git status --porcelain");at("git fetch --quiet origin");at("origin/$BeklenenDal");at("feature/diyanet-api-preparation");});
