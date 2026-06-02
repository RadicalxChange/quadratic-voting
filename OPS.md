# QV Production Operations

Operations guide for the production **Quadratic Voting (QV)** app. Keep this
in sync with `deploy.sh`.

## Architecture

Everything runs on a single DigitalOcean droplet, **rxc-voice-apps**
(`64.225.61.72`), as **six** Docker containers (five apps — rxc-voice runs as two) — each
publishing its own host port. Access is `ssh root@64.225.61.72` (root SSH
key). DigitalOcean load balancers sit in front and route public traffic to
these ports.

| App                | Host port | Repo dir (droplet)                                        |
| ------------------ | --------- | --------------------------------------------------------- |
| **quadratic-voting (QV)** | **2000** | `/home/alex/rxc-voice-apps/production/quadratic-voting` |
| mudamos_qv         | 2001      | (separate app)                                            |
| eng_demo           | 2002      | (separate app)                                            |
| demo_br            | 2003      | (separate app)                                            |
| rxc-voice_voice    | 4000      | (rxc-voice frontend)                                      |
| rxc-voice_api      | 8000      | (rxc-voice backend)                                       |

> **Only ever touch the container on port 2000.** The other five apps are
> independent and must be left running. `deploy.sh` keys entirely off port
> 2000 and refuses to act if the match isn't exactly one container.

**Containers / images.** The QV image is `rxc_qv:latest`. Containers run with
`--restart unless-stopped` and get auto-generated names (e.g.
`lucid_ramanujan`, `dreamy_bardeen`) — we do not pass `--name`. **The app
code is baked into the image (no bind mounts), so a code change requires a
full `docker build`; a plain `docker restart` reruns the OLD code.**

**Database.** Managed PostgreSQL on DigitalOcean (host
`...-do-user-6555646-0.b.db.ondigitalocean.com`, port `25060`, the
voice/api cluster). The QV app reads its connection string from
`prisma/.env` (`DATABASE_URL`), which is passed into the container via
`--env-file ./prisma/.env`.

> **Credentials are not stored in this doc.** They live in `prisma/.env` on
> the droplet (gitignored) and in the DigitalOcean control panel. Do not
> commit them.

## Deploy — normal (code-only)

The common case: a merged PR with no schema changes (no new
`prisma/migrations/`), no new dependencies.

```bash
ssh root@64.225.61.72
cd /home/alex/rxc-voice-apps/production/quadratic-voting
./deploy.sh
```

`deploy.sh` performs, in order:

1. **Pre-flight** — confirms repo dir + on `main` + `prisma/.env` present;
   `git fetch origin`; prints incoming commits; **migration guard** (see
   below); tags the currently-running image as a rollback point
   `rxc_qv:pre-deploy-<YYYY-MM-DD-HHMMSS>`.
2. **Pull** — `git pull --ff-only origin main`.
3. **Build** — `docker build -t rxc_qv .` (does not affect the live
   container; aborts the deploy on failure).
4. **Swap** — finds the single container on port 2000, stops + removes it,
   then `docker run -d --restart unless-stopped --env-file ./prisma/.env -p 2000:2000 rxc_qv`.
   This is the ~30s downtime window.
5. **Health check + auto-rollback** — polls `http://localhost:2000/` for
   ~30s. On success it prints the new image ID and the rollback command. On
   failure it auto-rolls back to the pre-deploy tag (see Rollback).

After it finishes, sanity-check manually if you like:

```bash
docker ps                                   # new container Up on :2000, other four untouched
docker logs <new_id> --tail 50              # clean start, no DB errors
curl -sI http://localhost:2000/ | head -5   # 200/302
curl -sI http://localhost:2000/create | head -5
```

## Deploy — with migrations

`deploy.sh` **never applies migrations.** If the pull contains any
new/changed file under `prisma/migrations/`, the migration guard aborts the
deploy before doing anything. Apply migrations by hand first:

```bash
ssh root@64.225.61.72
cd /home/alex/rxc-voice-apps/production/quadratic-voting
git fetch origin
git diff --name-only HEAD origin/main | grep '^prisma/migrations/'   # see what's pending

# Read DATABASE_URL from prisma/.env and apply the migration(s):
export $(grep -E '^DATABASE_URL=' prisma/.env | xargs)
psql "$DATABASE_URL" -f prisma/migrations/<file>.sql

# Verify the schema actually changed (example):
psql "$DATABASE_URL" -c '\d+ "Voters"'

# Only once the DB is migrated:
./deploy.sh
```

Notes:
- Apply migrations in commit order if there is more than one.
- The Prisma client is generated **at image build time** from
  `prisma/schema.prisma`; if a migration changes the schema, make sure the
  merged code carries the matching `schema.prisma` so the rebuilt image's
  client matches the live DB.

## Rollback

Every run tags the previously-live image as
`rxc_qv:pre-deploy-<timestamp>` **before** pulling/rebuilding, so the prior
version is always recoverable even after `:latest` is overwritten.

- **Automatic:** if the post-swap health check fails, `deploy.sh` stops/removes
  the new container and restarts the pre-deploy-tagged image automatically,
  then exits non-zero.
- **Manual:** `deploy.sh` prints the exact command on every run. It looks
  like:

  ```bash
  docker stop <new_id> && docker rm <new_id>
  cd /home/alex/rxc-voice-apps/production/quadratic-voting && \
    docker run -d --restart unless-stopped --env-file ./prisma/.env \
    -p 2000:2000 rxc_qv:pre-deploy-<timestamp>
  ```

List available rollback points with `docker images | grep rxc_qv`.

## Recovery notes

- **Rebuild is mandatory for code changes.** Code is baked into the image
  (no bind mounts). A `docker restart` will rerun the old code — always
  rebuild.
- **Restart policy** is `--restart unless-stopped`, so containers survive a
  droplet reboot. Preserve this flag on every `docker run`.
- **Docker won't start after a reboot?** Check `/etc/docker/daemon.json` is
  valid JSON (`python3 -m json.tool /etc/docker/daemon.json`), then
  `systemctl restart docker`. A malformed daemon config silently keeps the
  daemon down.
- **Health after a swap:** `docker logs <id> --tail 50`. Some endpoints log
  request-driven errors that are unrelated to startup (see Known
  follow-ups) — distinguish a crash loop from a clean
  `ready - started server on http://localhost:2000`.

## Known follow-ups

- **Error A — `generateStatistics` null `.map`.** `pages/api/events/details.js`
  throws `TypeError: Cannot read property 'map' of null` when a voter row has
  null `vote_data`. Needs a null-guard. Request-driven, not a startup
  failure. (Error B — public-link `voters.create` using a scalar
  `event_uuid` — was fixed in PR #34.)
- **Data-conditional null-`vote_data` risk** in the per-voter path
  (`pages/api/events/vote.js`): `vote_data.length`/null-id destructure can
  500 on legacy/edge rows. Same root cause family as Error A.
- **Rotate secrets.** Rotate the managed-Postgres password and `APP_SECRET`;
  update `prisma/.env` and the DO panel together.
- **Clean up TEST events.** Diagnostic events titled `TEST - delete me`
  (e.g. `d3a61307-...`) remain in the DB from troubleshooting; remove when
  convenient.
