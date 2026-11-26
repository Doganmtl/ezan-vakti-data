#!/usr/bin/env bash
set -euo pipefail
kind=${1:?usage: publish-data.sh prayer|daily}
case "$kind" in
 prayer) scope=(docs/v1/iller.json docs/v1/ilceler docs/v1/vakitler docs/v1/meta.json);;
 daily) scope=(docs/v1/gunluk.json);;
 *) exit 2;;
esac
base=$(git rev-parse HEAD)
# GitHub Actions must be an original main schedule/manual run, not a rerun.
if [ "${GITHUB_ACTIONS:-}" = true ]; then
  [ "${GITHUB_REF:-}" = refs/heads/main ] || { echo "DATA_PUBLISH: invalid ref" >&2; exit 1; }
  case "${GITHUB_EVENT_NAME:-}" in schedule|workflow_dispatch) ;; *) exit 1;; esac
  [ "${GITHUB_RUN_ATTEMPT:-}" = 1 ] || { echo "DATA_PUBLISH: rerun forbidden" >&2; exit 1; }
  [ "${GITHUB_SHA:-}" = "$base" ] || { echo "DATA_PUBLISH: event SHA mismatch" >&2; exit 1; }
fi
# Reject stale run before staging. A normal non-force push also rejects a concurrent update.
git fetch --no-tags origin refs/heads/main
remote=$(git rev-parse FETCH_HEAD)
if [ "$base" != "$remote" ]; then
  echo "DATA_PUBLISH: stale checkout; refusing to publish" >&2
  exit 1
fi
# No pre-staged files; stage only intended outputs.
git diff --cached --quiet || { echo "DATA_PUBLISH: unexpected staged changes" >&2; exit 1; }
git add -- "${scope[@]}"
if git diff --cached --quiet; then
  echo "DATA_PUBLISH: no changes"
  exit 0
fi
# Reject any accidental deletion or temporary files in the staged dataset.
node scripts/yayin-dogrula.mjs "$kind"
git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit -m "Data snapshot: $kind"
# Explicit destination, fast-forward only. Never pull/rebase or force.
git push origin HEAD:refs/heads/main
echo "DATA_PUBLISH: snapshot committed"
