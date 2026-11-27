// Kullanım (yerel, gh oturumu gerekir): node scripts/resmi/kanit-al.mjs <run-id> <ESLESME_OZET|ESLESME_IL_RAPOR> > eslesme/kanit/run-<id>.json
// Bir canlı run'ın kanıtını GitHub REST'ten toplar (yalnız meta veri + log'daki tek rapor satırı).
import { execFileSync } from "node:child_process";
const [runId, satirOnEki] = process.argv.slice(2);
const gh = (p) => JSON.parse(execFileSync("gh", ["api", p], { encoding: "utf8", maxBuffer: 1 << 26 }));
const R = "repos/Doganmtl/ezan-vakti-data";
const r = gh(`${R}/actions/runs/${runId}`);
const job = gh(`${R}/actions/runs/${runId}/jobs`).jobs[0];
const log = execFileSync("gh", ["api", `${R}/actions/jobs/${job.id}/logs`], { encoding: "utf8", maxBuffer: 1 << 26 });
const satir = log.split("\n").map((l) => l.replace(/^\S+Z /, "")).filter((l) => l.startsWith(satirOnEki + " "));
if (satir.length !== 1) throw Error(`log'da ${satir.length} adet ${satirOnEki} satırı var`);
const dep = gh(`${R}/deployments?sha=${r.head_sha}`).filter((d) => d.ref === r.head_branch);
const onay = gh(`${R}/actions/runs/${runId}/approvals`);
const art = gh(`${R}/actions/runs/${runId}/artifacts`).artifacts.map((a) => ({ id: a.id, name: a.name, size_in_bytes: a.size_in_bytes, digest: a.digest, expires_at: a.expires_at }));
const out = {
  aciklama: "Canlı run kanıtı: GitHub REST meta verisi ve job log'undaki rapor satırı. Gizli değer içermez.",
  alindi: new Date().toISOString(),
  run: { id: r.id, status: r.status, conclusion: r.conclusion, event: r.event, head_branch: r.head_branch, head_sha: r.head_sha, run_attempt: r.run_attempt, path: r.path, created_at: r.created_at,
    environment: dep.length === 1 ? dep[0].environment : null, job: job.id,
    onaylar: onay.map((o) => ({ state: o.state, user: o.user.login, environments: o.environments.map((e) => e.name) })) },
  artifact: art,
  [satirOnEki === "ESLESME_OZET" ? "ozet" : "rapor"]: JSON.parse(satir[0].slice(satirOnEki.length + 1)),
};
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
