#!/usr/bin/env bash
#
# deploy.sh — production deploy for the Quadratic Voting (QV) app.
#
# Run ON the droplet, FROM the repo dir:
#   ssh root@64.225.61.72
#   cd /home/alex/rxc-voice-apps/production/quadratic-voting && ./deploy.sh
#
# What it does (code-only deploys): pre-flight checks -> pull -> rebuild the
# Docker image -> swap the :2000 container -> health-check with auto-rollback.
# The code is baked into the image (no bind mounts), so a rebuild is
# MANDATORY — a plain restart would rerun the old code.
#
# This script touches ONLY the QV container on port 2000. The other four
# apps on this droplet (eng_demo:2002, demo_br:2003, mudamos_qv:2001,
# rxc-voice_voice:4000, rxc-voice_api:8000) are never referenced.
#
# It deliberately does NOT run database migrations. If a pull contains new
# migrations it ABORTS and tells you to apply them by hand first (see OPS.md).

set -euo pipefail

# --- Configuration ----------------------------------------------------------
readonly EXPECTED_DIR="/home/alex/rxc-voice-apps/production/quadratic-voting"
readonly IMAGE="rxc_qv"            # built/tagged as rxc_qv:latest
readonly PORT="2000"               # QV is the only app on :2000
readonly ENV_FILE="./prisma/.env"
readonly HEALTH_URL="http://localhost:${PORT}/"
readonly HEALTH_RETRIES=15         # ~30s total (15 * 2s)
readonly HEALTH_SLEEP=2

# Predictable, sortable rollback tag — echoed so a human can roll back too.
readonly TS="$(date +%Y-%m-%d-%H%M%S)"
readonly ROLLBACK_TAG="${IMAGE}:pre-deploy-${TS}"

phase() { echo; echo "==> $*"; }
fail()  { echo; echo "!!! $*" >&2; exit 1; }

# --- 1. Pre-flight ----------------------------------------------------------
phase "PRE-FLIGHT"

# Must be in the repo dir, in a git work tree, on main.
if [ ! -f Dockerfile ] || [ ! -d prisma ]; then
  fail "Not in the QV repo dir (no Dockerfile/prisma/ here). Expected: ${EXPECTED_DIR}"
fi
if [ "$(pwd -P)" != "${EXPECTED_DIR}" ]; then
  echo "    WARNING: cwd $(pwd -P) != expected ${EXPECTED_DIR} (continuing)"
fi
git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail "Not a git work tree."
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "${BRANCH}" = "main" ] || fail "On branch '${BRANCH}', expected 'main'. Aborting."

# Env file must exist (it lives on the droplet, gitignored).
[ -f "${ENV_FILE}" ] || fail "Missing ${ENV_FILE} — required for --env-file. Aborting."

phase "Fetching origin and showing incoming commits"
git fetch origin
echo "Incoming (HEAD..origin/main):"
git log HEAD..origin/main --oneline || true

# MIGRATION GUARD — never auto-apply schema changes.
phase "Migration guard: scanning for pending migrations"
CHANGED="$(git diff --name-only HEAD origin/main || true)"
if echo "${CHANGED}" | grep -qE '^prisma/migrations/'; then
  echo "Changed files under prisma/migrations/:"
  echo "${CHANGED}" | grep -E '^prisma/migrations/' | sed 's/^/    /'
  fail "Pending migrations detected — apply them manually with psql before \
deploying, then re-run. See OPS.md."
fi
echo "    No migration changes. OK to proceed."

# Tag the CURRENT running image (rxc_qv:latest == what's live right now) as a
# rollback point BEFORE we pull/rebuild and overwrite :latest.
phase "Tagging current image as rollback point: ${ROLLBACK_TAG}"
docker image inspect "${IMAGE}:latest" >/dev/null 2>&1 \
  || fail "No ${IMAGE}:latest image found to tag as rollback. Aborting."
docker tag "${IMAGE}:latest" "${ROLLBACK_TAG}"
echo "    Rollback tag created: ${ROLLBACK_TAG}"

# --- 2. Pull ----------------------------------------------------------------
phase "PULL: git pull --ff-only origin main"
git pull --ff-only origin main
echo "    New HEAD: $(git log -1 --oneline)"

# --- 3. Build ---------------------------------------------------------------
phase "BUILD: docker build -t ${IMAGE} ."
docker build -t "${IMAGE}" . || fail "docker build failed. Nothing swapped; the live container is untouched."
NEW_IMAGE_ID="$(docker image inspect "${IMAGE}:latest" --format '{{.Id}}')"
echo "    Built ${IMAGE}:latest = ${NEW_IMAGE_ID}"

# --- 4. Swap ----------------------------------------------------------------
phase "SWAP: locating the single running container on port ${PORT}"
# Port 2000 uniquely identifies QV on this droplet. Refuse to guess if the
# match isn't exactly one container.
mapfile -t QV_CONTAINERS < <(docker ps --filter "publish=${PORT}" --format '{{.ID}}')
if [ "${#QV_CONTAINERS[@]}" -eq 0 ]; then
  fail "No running container publishes port ${PORT}. Aborting (nothing to swap)."
elif [ "${#QV_CONTAINERS[@]}" -gt 1 ]; then
  printf '    %s\n' "${QV_CONTAINERS[@]}"
  fail "Found ${#QV_CONTAINERS[@]} containers on port ${PORT} — expected exactly 1. Refusing to guess."
fi
OLD_ID="${QV_CONTAINERS[0]}"
echo "    Will stop/remove: ${OLD_ID} ($(docker ps --filter "id=${OLD_ID}" --format '{{.Names}} ({{.Image}})'))"

echo "    Stopping + removing old container ${OLD_ID} (~30s downtime starts now)"
docker stop "${OLD_ID}" >/dev/null
docker rm   "${OLD_ID}" >/dev/null

echo "    Starting new container from ${IMAGE}:latest"
NEW_ID="$(docker run -d --restart unless-stopped --env-file "${ENV_FILE}" -p "${PORT}:${PORT}" "${IMAGE}")"
echo "    New container: ${NEW_ID}"

# --- 5. Health check with auto-rollback -------------------------------------
phase "HEALTH CHECK: polling ${HEALTH_URL} (up to ~$((HEALTH_RETRIES * HEALTH_SLEEP))s)"
healthy=0
for i in $(seq 1 "${HEALTH_RETRIES}"); do
  if curl -sf "${HEALTH_URL}" >/dev/null 2>&1; then
    healthy=1
    echo "    Healthy after ${i} attempt(s)."
    break
  fi
  echo "    attempt ${i}/${HEALTH_RETRIES}: not ready yet, sleeping ${HEALTH_SLEEP}s..."
  sleep "${HEALTH_SLEEP}"
done

if [ "${healthy}" -ne 1 ]; then
  echo
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "!!! HEALTH CHECK FAILED — AUTO-ROLLBACK to ${ROLLBACK_TAG}"
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "--- last 50 log lines from the failed container (${NEW_ID}) ---"
  docker logs "${NEW_ID}" --tail 50 2>&1 || true
  echo "--- rolling back ---"
  docker stop "${NEW_ID}" >/dev/null 2>&1 || true
  docker rm   "${NEW_ID}" >/dev/null 2>&1 || true
  docker run -d --restart unless-stopped --env-file "${ENV_FILE}" -p "${PORT}:${PORT}" "${ROLLBACK_TAG}" >/dev/null \
    || fail "ROLLBACK FAILED to start ${ROLLBACK_TAG}. MANUAL INTERVENTION REQUIRED."
  echo "    Rolled back to ${ROLLBACK_TAG}."
  fail "Deploy failed and was rolled back. The new image is still tagged ${IMAGE}:latest; investigate before retrying."
fi

# --- 6. Success -------------------------------------------------------------
phase "SUCCESS"
echo "    QV is healthy on port ${PORT}."
echo "    New container : ${NEW_ID}"
echo "    New image     : ${IMAGE}:latest = ${NEW_IMAGE_ID}"
echo "    Rollback tag  : ${ROLLBACK_TAG}"
echo
echo "    To roll back manually:"
echo "      docker stop ${NEW_ID} && docker rm ${NEW_ID}"
echo "      cd ${EXPECTED_DIR} && \\"
echo "        docker run -d --restart unless-stopped --env-file ${ENV_FILE} -p ${PORT}:${PORT} ${ROLLBACK_TAG}"
echo
echo "Done."
